// (0.249, PLAN_MAGAZYNOW.md stage M1) The warehouse network. The planet is cut into hexes of `HEX` (120 across the
// planet's girth, about a kilometre from side to side) and every warehouse serves the hex it stands in, one warehouse a
// hex: a village's warehouse (an old world's hall, a settlement's staked warehouse), a port's warehouse at a dock, or
// a warehouse built in the wilds (an `outposts` entry of kind 'store', id 'wh:<hex>'). What the deposits in a
// warehouse's hex dig goes there on its own: every two hours the carriers take the crates from the outposts to it, as
// long as the warehouse works (its crew and power, or an old village's hall). Every warehouse has a name the players
// can change; the village computers list them all (their stocks only with the radio link of stage M3).
//
// Two cumulative counters carry the crates, each written by one side only (like the convoy routes, gen/routes.ts):
// the outpost counts what its carriers took (`OutpostState.out`, settled on every game alike), the warehouse counts what
// it took in (`rcv[<lode id>:<since>]`, under its own lock), so a stale write delays a delivery but never doubles it.
//
// Pure: the hex maths, the list of warehouses from the shared state, the hand-off and the warehouse's side of it.
import type { ItemKey } from '../data/items';
import { WORLD_W, wrapDx, nearX, allVillages, villageSeed, worldDist, ruinName, type Poi } from './regions';
import { VILLAGE_OFFSET } from './village';
import { progressive, projectDone } from './settlement';
import { hallSpec, hallStands, deposit } from './hall';
import { serviceOf } from './energy';
import { portWorks, portPut } from './ports';
import { settle, type OutpostState } from './outposts';
import { pwOf } from './grid';
import { procOf } from './outpostproc';
import type { Lode } from './lodes';
import type { TownState } from './town';
import { rng, hash } from '../core/rng';
import { TL } from '../i18n';

// ---------- the hexes ----------
/** Pointy-topped hexes: `cols` across the planet (so they close round its seam), `w` from side to side, `r` from the
 *  middle to a corner, rows `dz` apart, every odd row shifted half a hex east. */
export const HEX = (() => { const cols = 120, w = WORLD_W / cols, r = w / Math.sqrt(3); return { cols, w, r, dz: 1.5 * r }; })();
export interface Hex { c: number; r: number; key: string }
const wrapCol = (c: number) => ((c % HEX.cols) + HEX.cols) % HEX.cols;
const hexKey = (c: number, r: number) => wrapCol(c) + ':' + r;
/** The hex a point lies in. */
export function hexOf(x: number, z: number): Hex {
  const X = wrapDx(x), q = (Math.sqrt(3) / 3 * X - z / 3) / HEX.r, rr = (2 / 3 * z) / HEX.r;
  // round the cube coordinates
  let cx = Math.round(q), cz = Math.round(rr), cy = Math.round(-q - rr);
  const dx = Math.abs(cx - q), dz = Math.abs(cz - rr), dy = Math.abs(cy + q + rr);
  if (dx > dy && dx > dz) cx = -cy - cz; else if (dy <= dz) cz = -cx - cy;
  const r = cz, c = cx + (r - (r & 1)) / 2;
  return { c: wrapCol(c), r, key: hexKey(c, r) };
}
/** The middle of a hex (canonical x). */
export function hexCenter(c: number, r: number): [number, number] {
  return [wrapDx((c + ((r & 1) ? 0.5 : 0)) * HEX.w), r * HEX.dz];
}
/** The six corners of the hex a point lies in, on the copy of the planet nearest `ref` (for the maps). */
export function hexCorners(h: Hex, ref = 0): [number, number][] {
  const [x, z] = hexCenter(h.c, h.r), cx = nearX(x, ref);
  return Array.from({ length: 6 }, (_, i) => { const a = Math.PI / 6 + i * Math.PI / 3; return [cx + Math.cos(a) * HEX.r, z + Math.sin(a) * HEX.r] as [number, number]; });
}
export const parseHex = (key: string): Hex => { const [c, r] = key.split(':').map(Number); return { c, r, key }; };

// ---------- the warehouses ----------
export type HubKind = 'village' | 'port' | 'wild';
/** A warehouse: its id ('v:<village id>' or the outposts' id), where it stands, its hex, its name. */
export interface Hub { id: string; kind: HubKind; x: number; z: number; hex: string; name: string; vid?: number }
/** A village's warehouse id. */
export const villageHub = (vid: number) => 'v:' + vid;
/** The id of a warehouse built in the wilds of hex `key`. */
export const wildId = (key: string) => 'wh:' + key;
/** A wild warehouse's name, hashed from its hex. */
export const wildName = (world: number, key: string) => TL`${ruinName(rng(hash(world, key.length, ...key.split(':').map(Number), 0x57a3e)))} Warehouse`;
/** A name typed for a warehouse, cleaned (no markup, at most 28 characters). */
export const cleanHubName = (s: string) => s.replace(/[\u0000-\u001f<>"&]/g, '').trim().slice(0, 28);
/** A village's warehouse name: the one given to it, else the village's. */
export const villageHubName = (v: Poi, s: TownState | undefined) => s?.whn || TL`${v.name} Warehouse`;
/** Where village v's hall or warehouse stands (its middle), or null while it has none. */
export function villageHall(v: Poi, s: TownState | undefined): [number, number] | null {
  if (!hallStands(s) || (progressive(s) && !projectDone(s, 'warehouse'))) return null;
  const h = hallSpec(s);
  return [v.x + VILLAGE_OFFSET.x + (h.x0 + h.x1) / 2, v.z + VILLAGE_OFFSET.z + (h.z0 + h.z1) / 2];
}
/** Every warehouse on the planet: the villages' that stand, the ports' and the wild ones (built or going up). */
export function hubs(world: number, towns: Record<string, TownState | undefined>, outposts: Record<string, OutpostState | undefined>): Hub[] {
  const out: Hub[] = [];
  for (const v of allVillages(world)) {
    const s = towns[v.id], at = villageHall(v, s);
    if (at) out.push({ id: villageHub(v.id), kind: 'village', x: at[0], z: at[1], hex: hexOf(at[0], at[1]).key, name: villageHubName(v, s), vid: v.id });
  }
  for (const [id, o] of Object.entries(outposts)) {
    if (!o || (o.k !== 'port' && o.k !== 'store')) continue;
    out.push({ id, kind: o.k === 'port' ? 'port' : 'wild', x: o.x, z: o.z, hex: hexOf(o.x, o.z).key, name: o.name });
  }
  return out;
}
/** The warehouse serving the hex of (x, z) (the first one standing there), or null. */
export const hubAt = (list: Hub[], x: number, z: number, except?: string) => { const k = hexOf(x, z).key; return list.find((h) => h.hex === k && h.id !== except) ?? null; };
/** Why no new warehouse can serve the hex of (x, z) ('' = it can): another one serves it already. */
export function hexProblem(list: Hub[], x: number, z: number, except?: string): string {
  const h = hubAt(list, x, z, except);
  return h ? TL`${h.name} already serves this area: one warehouse to a hex.` : '';
}
/** Does warehouse h take crates in now: an old village's hall always; a settlement's warehouse with its storekeepers
 *  and power (gen/energy.ts `serviceOf`); a port's or a wild one with its whole crew and power (gen/ports.ts). */
export function hubWorks(world: number, h: Hub, towns: Record<string, TownState | undefined>, outposts: Record<string, OutpostState>, t: number): boolean {
  if (h.kind === 'village') {
    const v = allVillages(world).find((q) => q.id === h.vid);
    if (!v) return false;
    const s = towns[v.id];
    return !progressive(s) || !serviceOf(world, v, villageSeed(world, v), s, 'warehouse', t).why;
  }
  return !portWorks(world, outposts, h.id, t).why;
}

// ---------- the carriers ----------
/** What an outpost's carriers took to the warehouse of its hex: since when, to which, and how many of each (cumulative). */
export interface HandOff { hub: string; since: number; n: Partial<Record<ItemKey, number>> }
/** The warehouse's counter key for an outpost's carriers (the outpost and when they began carrying there). */
export const rcvKeyOf = (lodeId: string, o: HandOff) => lodeId + ':' + o.since;
/**
 * Every two hours (world/lodes.ts, after the outposts are settled): the outposts whose deposit lies in the hex of a
 * warehouse that works hand their whole crates over to it. Returns how many went from each outpost.
 */
export function handOff(world: number, outposts: Record<string, OutpostState>, towns: Record<string, TownState | undefined>, lodeOf: (id: string) => Lode | null, now: number): { id: string; hub: Hub; n: number }[] {
  const list = hubs(world, towns, outposts), went: { id: string; hub: Hub; n: number }[] = [];
  for (const [id, o] of Object.entries(outposts)) {
    if (!o?.done?.dig) continue;
    const l = lodeOf(id), h = l ? hubAt(list, l.x, l.z, id) : null;
    if (!l || !h || !hubWorks(world, h, towns, outposts, now)) continue;
    settle(o, l, now, pwOf(world, outposts, id, now));
    if (!o.out || o.out.hub !== h.id) o.out = { hub: h.id, since: Math.round(now), n: {} };
    let n = 0;
    const works = o.done?.proc ? procOf(o.k) : null; // the works on site keep what they process
    for (const [g, m] of Object.entries(o.stock?.n ?? {}) as [ItemKey, number][]) {
      const whole = Math.floor(m + 1e-6);
      if (whole <= 0 || g === works?.inp) continue;
      o.out.n[g] = (o.out.n[g] ?? 0) + whole; o.stock!.n[g] = m - whole; n += whole;
    }
    if (n) went.push({ id, hub: h, n });
  }
  return went;
}
/** The crates the carriers brought to warehouse `hubId` that it has not taken in yet: [outpost id, its counter key, good, how many]. */
export function waitingAt(hubId: string, outposts: Record<string, OutpostState>, rcv: Record<string, Partial<Record<ItemKey, number>>> | undefined): [string, string, ItemKey, number][] {
  const out: [string, string, ItemKey, number][] = [];
  for (const [id, o] of Object.entries(outposts)) {
    if (o?.out?.hub !== hubId) continue;
    const key = rcvKeyOf(id, o.out), got = rcv?.[key] ?? {};
    for (const [g, n] of Object.entries(o.out.n) as [ItemKey, number][]) { const m = n - (got[g] ?? 0); if (m > 0) out.push([id, key, g, m]); }
  }
  return out;
}
/** A village's warehouse takes in what the carriers brought (under the village's lock): as much as its hold has room
 *  for; the rest waits. Returns [good, how many] taken. */
export function drainVillage(s: TownState, vid: number, outposts: Record<string, OutpostState>): [ItemKey, number][] {
  const got: [ItemKey, number][] = [];
  for (const [, key, g, n] of waitingAt(villageHub(vid), outposts, s.rcv)) {
    const m = deposit(s, g, n);
    if (m) { const r = ((s.rcv ??= {})[key] ??= {}); r[g] = (r[g] ?? 0) + m; got.push([g, m]); }
  }
  return got;
}
/** A port's or a wild warehouse takes in what the carriers brought (under its lock). */
export function drainStore(id: string, outposts: Record<string, OutpostState>): [ItemKey, number][] {
  const o = outposts[id], got: [ItemKey, number][] = [];
  if (!o?.done?.port) return got;
  for (const [, key, g, n] of waitingAt(id, outposts, o.rcv)) {
    const m = portPut(o, g, n);
    if (m) { const r = ((o.rcv ??= {})[key] ??= {}); r[g] = (r[g] ?? 0) + m; got.push([g, m]); }
  }
  return got;
}
/** The deposits worked in the hex of warehouse h (outposts with their dig built): [outpost id, its name]. */
export function feeders(h: Hub, outposts: Record<string, OutpostState>, lodeOf: (id: string) => Lode | null): [string, string][] {
  const out: [string, string][] = [];
  for (const [id, o] of Object.entries(outposts)) { if (!o?.done?.dig) continue; const l = lodeOf(id); if (l && hexOf(l.x, l.z).key === h.hex) out.push([id, o.name]); }
  return out;
}
/** The warehouses nearest to (x, z), nearest first, with their distance. */
export const hubsNear = (list: Hub[], x: number, z: number) => list.map((h) => ({ h, d: worldDist(h.x, h.z, x, z) })).sort((a, b) => a.d - b.d);
