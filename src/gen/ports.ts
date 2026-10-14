// (0.216, PLAN_PRAD_I_LUDZIE.md stage Z2) Ports: on a finished dock (gen/piers.ts) the players found a port, an entry of
// the shared `outposts` under 'port:<dock id>' with `k` 'port'. It is worked like an outpost (gen/outposts.ts): a power
// source of its own (gen/grid.ts, on the outposts' grid), bunkhouses and fields, and settlers who come on their own
// (gen/outpostlife.ts). Its own building is the port warehouse (a yard, a shed and a crane): its hold takes crates by
// hand at any time; its crane, which loads and unloads boats and trucks, works only with its whole crew and power (the
// same rule as the settlement's services, gen/energy.ts `serviceOf`). Cargo voyages between ports come in stage Z3.
//
// Pure: everything from the dock, the terrain asked through callbacks and the shared state.
import { BULK, type ItemKey } from '../data/items';
import { rng, hash } from '../core/rng';
import { ruinName } from './regions';
import { PIER, type Pier } from './piers';
import { PORT, type OutpostState, type PortSpots } from './outposts';
import { naturalHeight } from './heights';
import type { Claim } from './claims';
import { crews, lifeNow } from './outpostlife';
import { powerShare } from './grid';

export const portId = (pierId: string) => 'port:' + pierId;
export const isPort = (o: OutpostState | undefined) => o?.k === 'port';
/** The port's name, hashed from the dock's place. */
export const portName = (world: number, p: Pier) => ruinName(rng(hash(world, p.x | 0, p.z | 0, 0x9077))) + ' Port';

/** A point in the dock's frame: a along it (out to sea +, inland −) from its root, b across. */
export const portPoint = (p: Pier, a: number, b: number): [number, number] => [p.x + p.dx * a - p.dz * b, p.z + p.dz * a + p.dx * b];
/** Where the pieces of a port stand (world x, z on the dock's copy of the planet): the warehouse (its doors towards the
 *  dock), the crane by the dock's root, the power source, three bunkhouses and three fields, each the first of its
 *  candidates on dry land clear of the others (`dry` tells dry ground; the fallback is the first candidate). */
export function portSpots(p: Pier, dry: (x: number, z: number) => boolean): PortSpots {
  const B = PORT.back, taken: [number, number, number][] = [];
  const pick = (cands: [number, number][], r: number): [number, number] => {
    for (const [a, b] of cands) {
      const [x, z] = portPoint(p, a, b);
      if (taken.some(([tx, tz, tr]) => Math.hypot(tx - x, tz - z) < tr + r + 2)) continue;
      const ok = [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]].every(([u, v]) => dry(x + u, z + v));
      if (ok) { taken.push([x, z, r]); return [x, z]; }
    }
    const [x, z] = portPoint(p, cands[0][0], cands[0][1]); taken.push([x, z, r]); return [x, z];
  };
  const house = pick([[-B, 0]], 8);
  const crane: [number, number] = portPoint(p, -2, PIER.w / 2 + 3.5); taken.push([crane[0], crane[1], 2.5]);
  const power = pick([[-B, 18], [-B, -18], [-B - 16, 14], [-B - 16, -14], [-B - 28, 0], [-B + 6, 20], [-B + 6, -20]], 6);
  const bunks: [number, number][] = [], fields: [number, number][] = [];
  const near: [number, number][] = [], far: [number, number][] = [];
  for (const a of [14, 24, 34, 44]) for (const b of [0, -12, 12, -24, 24, -36, 36]) near.push([-B - a, b]);
  for (const a of [44, 60, 76, 92]) for (const b of [0, -16, 16, -32, 32, -48, 48]) far.push([-B - a, b]);
  for (let i = 0; i < 3; i++) bunks.push(pick(near, 5));
  for (let i = 0; i < 3; i++) fields.push(pick(far, 8));
  const r = (q: [number, number]): [number, number] => [Math.round(q[0] * 10) / 10, Math.round(q[1] * 10) / 10];
  return { house: r(house), crane: r(crane), power: r(power), bunks: bunks.map(r), fields: fields.map(r) };
}
/** Why the port warehouse cannot stand behind this dock ('' = it can): its ground must be dry and not too steep. */
export function portProblem(p: Pier, ground: (x: number, z: number) => number, dry: (x: number, z: number) => boolean): string {
  if (!p.done) return 'unbuilt';
  const hs: number[] = [];
  for (const a of [-PORT.back - 7, -PORT.back, -PORT.back + 7]) for (const b of [-7, 0, 7]) {
    const [x, z] = portPoint(p, a, b);
    if (!dry(x, z)) return 'wet';
    hs.push(ground(x, z));
  }
  return Math.max(...hs) - Math.min(...hs) > 4 ? 'steep' : '';
}
/** A new port at dock p (its middle is the warehouse's); `ps` = where its pieces will stand (`portSpots`, kept so that
 *  the ground levelled under them cannot move them). */
export function newPort(world: number, p: Pier, by: string, now: number, owner = 'crew', ps?: PortSpots): OutpostState {
  const [x, z] = portPoint(p, -PORT.back, 0);
  return { o: owner, by, t: now, k: 'port', x: Math.round(x), z: Math.round(z), name: portName(world, p), pier: p.id, ...(ps ? { ps } : {}) };
}
/** The ground levelled under a port's pieces from the moment the builders begin on them (eased, not table-flat), which
 *  also clears the trees and rocks there: the warehouse, the power source, the bunkhouses and the fields. */
export const PORT_PAD = { house: [11, 10, 0.25], power: [5, 8, 0.3], bunks: [6, 8, 0.3], field: [8, 10, 0.3] } as const;
export function portClaims(world: number, outposts: Record<string, OutpostState>): Claim[] {
  const out: Claim[] = [];
  for (const o of Object.values(outposts)) {
    const sp = o?.k === 'port' ? o.ps : undefined;
    if (!sp) continue;
    const pad = (q: [number, number], [flat, blend, soft]: readonly [number, number, number]) => out.push({ x: q[0], z: q[1], y: Math.round(naturalHeight(world, q[0], q[1]) * 10) / 10, flat, blend, soft });
    const going = (p: string) => o.job?.p === p;
    if (o.done?.port || going('port')) pad(sp.house, PORT_PAD.house);
    if (o.done?.power || going('power')) pad(sp.power, PORT_PAD.power);
    sp.bunks.forEach((q, i) => { if (i < (o.n?.bunks ?? 0) + (going('bunks') ? 1 : 0)) pad(q, PORT_PAD.bunks); });
    sp.fields.forEach((q, i) => { if (i < (o.n?.field ?? 0) + (going('field') ? 1 : 0)) pad(q, PORT_PAD.field); });
  }
  return out;
}

// ---------- the hold ----------
const vol = (k: ItemKey) => BULK[k]?.[1] ?? 1;
export const portVol = (o: OutpostState) => Object.entries(o.hold ?? {}).reduce((a, [k, n]) => a + vol(k as ItemKey) * (n ?? 0), 0);
export const portRoom = (o: OutpostState, k: ItemKey) => (o.done?.port ? Math.max(0, Math.floor((PORT.vol - portVol(o) + 1e-6) / vol(k))) : 0);
/** Store up to n of k (as much as fits); how many went in. */
export function portPut(o: OutpostState, k: ItemKey, n: number): number {
  const m = Math.max(0, Math.min(n, portRoom(o, k)));
  if (m) (o.hold ??= {})[k] = (o.hold[k] ?? 0) + m;
  return m;
}
/** Take up to n of k out; how many came out. */
export function portTake(o: OutpostState, k: ItemKey, n: number): number {
  const m = Math.max(0, Math.min(n, o.hold?.[k] ?? 0));
  if (m) { o.hold![k] = (o.hold![k] ?? 0) - m; if (!o.hold![k]) delete o.hold![k]; }
  return m;
}

/** Does the crane work: the warehouse stands, its whole crew is at work, and the grid met at least `PORT.power` of the
 *  demand over the last day. `why` '' (it works), 'unbuilt', 'hands' or 'power'. */
export function portWorks(world: number, outposts: Record<string, OutpostState>, id: string, now: number): { hands: number; power: number; why: '' | 'unbuilt' | 'hands' | 'power' } {
  const o = outposts[id];
  if (!o?.done?.port) return { hands: 0, power: 0, why: 'unbuilt' };
  const L = lifeNow(world, o, now), hands = crews(o, L.n).dig, power = powerShare(world, outposts, id, now);
  return { hands, power, why: hands < PORT.crew ? 'hands' : power < PORT.power ? 'power' : '' };
}
