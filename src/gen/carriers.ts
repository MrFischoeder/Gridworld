// (0.250, PLAN_MAGAZYNOW.md stage M2) The carriers you see: the people who take what is dug and grown to the warehouse.
// A route runs from where the goods come from to the warehouse's doors: from an outpost at a deposit in a warehouse's
// hex (crates, oil rolled in barrels), and in a settlement whose warehouse stands, from each farm's field (sacks of grain
// and roots, crates of eggs, cans of milk) and each yard it works (crates of stone, ore and logs, barrels of crude). Only
// while the warehouse works. Each carrier walks there loaded, sets the load down, walks back empty and goes again,
// timed by the game clock (`carrierAt`), so every player sees the same people in the same places.
//
// Pure: the routes from the shared state; the drawing is world/carriers.ts.
import { hash } from '../core/rng';
import { allVillages, villageSeed, wrapDx, worldDist } from './regions';
import { VILLAGE_OFFSET } from './village';
import { progressive, projectDone } from './settlement';
import { RESOURCE_PLOTS } from './resource-sites';
import { farmField } from './fields';
import { cropOf, farmsOf } from './farms';
import { hubs, hubAt, hubWorks, villageHall, villageHub, type Hub } from './warehouses';
import type { OutpostState } from './outposts';
import type { TownState } from './town';
import type { Lode } from './lodes';

export type Load = 'sack' | 'crate' | 'barrel';
/** A carriers' route: from (ax, az) to the warehouse at (bx, bz), how many walk it, what they carry. */
export interface CarrierRoute { id: string; ax: number; az: number; bx: number; bz: number; n: number; load: Load }
/** Walking pace (m a game minute: a real second is a game minute), the pause at each end (game minutes), a route's
 *  longest stretch, how many walk a deposit's route. */
export const CARRY = { pace: 70, pause: 3, longest: 1300, deposit: 2 };

/** Every carriers' route whose middle lies within `reach` of (x, z) (canonical coordinates; the drawing shifts them). */
export function carrierRoutes(world: number, towns: Record<string, TownState | undefined>, outposts: Record<string, OutpostState>, lodeOf: (id: string) => Lode | null, x: number, z: number, reach: number, t: number): CarrierRoute[] {
  const out: CarrierRoute[] = [], list = hubs(world, towns, outposts), works = new Map<string, boolean>();
  const on = (h: Hub) => { let w = works.get(h.id); if (w === undefined) works.set(h.id, w = hubWorks(world, h, towns, outposts, t)); return w; };
  const add = (r: CarrierRoute) => {
    const len = worldDist(r.ax, r.az, r.bx, r.bz);
    if (len < 8 || len > CARRY.longest || worldDist((r.ax + r.bx) / 2, (r.az + r.bz) / 2, x, z) > reach + len / 2) return;
    out.push(r);
  };
  // the deposits' outposts in a warehouse's hex
  for (const [id, o] of Object.entries(outposts)) {
    if (!o?.done?.dig) continue;
    const l = lodeOf(id), h = l ? hubAt(list, l.x, l.z, id) : null;
    if (!l || !h || !on(h)) continue;
    const dx = wrapDx(h.x - l.x), dz = h.z - l.z, d = Math.hypot(dx, dz) || 1, off = Math.min(d / 2, l.r * 0.6);
    add({ id: 'c:' + id, ax: l.x + dx / d * off, az: l.z + dz / d * off, bx: h.x, bz: h.z, n: CARRY.deposit, load: l.k === 'oil' ? 'barrel' : 'crate' });
  }
  // a settlement's fields and yards to its warehouse
  for (const v of allVillages(world)) {
    const s = towns[v.id], at = progressive(s) ? villageHall(v, s) : null;
    if (!at || worldDist(v.x, v.z, x, z) > reach + 600) continue;
    const h = list.find((q) => q.id === villageHub(v.id));
    if (!h || !on(h)) continue;
    const seed = villageSeed(world, v);
    for (let i = 0; i < farmsOf(s); i++) {
      const f = farmField(v, seed, s, i), c = cropOf(s, i);
      add({ id: `f:${v.id}:${i}`, ax: (f.x0 + f.x1) / 2, az: (f.z0 + f.z1) / 2, bx: at[0], bz: at[1], n: 1, load: c === 'cows' ? 'barrel' : c === 'hens' ? 'crate' : 'sack' });
    }
    for (const k of ['quarry', 'mine', 'lumber', 'oil', 'raremine'] as const) {
      if (!projectDone(s, k)) continue;
      const p = RESOURCE_PLOTS[k];
      add({ id: `y:${v.id}:${k}`, ax: v.x + VILLAGE_OFFSET.x + p.x, az: v.z + VILLAGE_OFFSET.z + p.z, bx: at[0], bz: at[1], n: 1, load: k === 'oil' ? 'barrel' : 'crate' });
    }
  }
  return out;
}

/** Where carrier i of route r is at game time t: the point, the way it faces, whether it carries its load, and how far
 *  it has walked along the way (for rolling a barrel). */
export function carrierAt(r: CarrierRoute, i: number, t: number): { x: number; z: number; face: number; loaded: boolean; walk: number; moving: boolean } {
  const dx = wrapDx(r.bx - r.ax), dz = r.bz - r.az, len = Math.hypot(dx, dz) || 1, leg = len / CARRY.pace, P = 2 * leg + 2 * CARRY.pause;
  const off = (hash(i, r.id.length, ...[...r.id].map((ch) => ch.charCodeAt(0))) % 1000) / 1000 * P + i * P / Math.max(1, r.n);
  const p = (((t + off) % P) + P) % P;
  let s: number, loaded: boolean, moving = true;
  if (p < leg) { s = p / leg; loaded = true; }
  else if (p < leg + CARRY.pause) { s = 1; loaded = false; moving = false; }
  else if (p < 2 * leg + CARRY.pause) { s = 1 - (p - leg - CARRY.pause) / leg; loaded = false; }
  else { s = 0; loaded = true; moving = false; }
  const out = p >= leg && p < 2 * leg + CARRY.pause; // walking back
  return { x: r.ax + dx * s, z: r.az + dz * s, face: Math.atan2(out ? -dx : dx, out ? -dz : dz), loaded, walk: s * len, moving };
}
