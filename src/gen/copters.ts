// (0.259, PLAN_LOTNICTWA.md stage F5) The rotorcraft: a small, quick machine the players fly themselves. Two seats, a small
// hold, diesel only, and it sets down on any flat place (it will not touch down on a steep slope or deep water). It is
// built at a working warehouse (a village's, a port's or a wild one) from the warehouse's stock with the plans
// 'rotorcraft' (`COPTER.needs`, no mast and no build time: a vehicle, not a building), parked on its apron, and
// goes into the shared list `Char.copters` (`Copter`; its hold is `Char.containers[id]`). Where it lands, it stays.
// It does not take power or people. Pure; the flight is world/copters.ts.
import { hash } from '../core/rng';
import type { ItemKey } from '../data/items';
import type { TownState } from './town';
import type { OutpostState } from './outposts';
import type { Hub } from './warehouses';
import { tl } from '../i18n';

/**
 * Cruise `speed` m/s (astern `back`), `climb` m/s up or down, `turn` rad/s; the wind pushes it at `wind` of its speed; its
 * skids' bottom stays `min` m over the ground in flight and at most `ceil` m over the sea's level. `seats` aboard, a hold
 * of `hold` slots, at most `max` on a world. Diesel: a `tank` of litres burnt at `burn` L/s at full throttle plus `idle`
 * L/s while it is in the air; a flat tank gives no lift (it settles at `fall` m/s). Landing wants the ground under
 * its skids level within `relief` m and dry. `spot` m from the warehouse it is built at.
 */
export const COPTER = {
  name: tl('Rotorcraft'), tech: 'rotorcraft', xp: 300, max: 6,
  speed: 30, back: 7, climb: 7, turn: 1.5, wind: 0.12, min: 0.4, ceil: 400, hold: 8, seats: 2, fall: 4,
  fuel: { tank: 90, burn: 0.045, idle: 0.015, can: 20 }, relief: 1.1, spot: 26,
  needs: [['aluminium', 8], ['motor', 3], ['engine', 2], ['control', 2], ['cable', 4], ['plastic', 4], ['planks', 2]] as [ItemKey, number][],
};
export interface Copter {
  /** 'cop:<pid>:<time>'; its skids' bottom (x, y, z), heading (forward = (sin yaw, cos yaw)), the diesel in its tank. */
  id: string; x: number; y: number; z: number; yaw: number; fuel: number;
  /** The warehouse it was built at; who built it; when. */
  hub: string; by: string; t: number;
  /** (0.260) The hull in percent (gen/airhull.ts; absent = whole). */
  hull?: number;
}
/** A rotorcraft going up at a warehouse: what was handed over (absent: none going up). */
export interface CopterBuild { given: Partial<Record<ItemKey, number>> }
export const copRows = (b: CopterBuild | undefined) => COPTER.needs.map(([k, n]) => ({ k, n, given: Math.min(n, b?.given?.[k] ?? 0) }));
/** Hand over what it still needs (`have` from the warehouse's stock); true once it is complete. */
export function handOverCop(b: CopterBuild, have: (k: ItemKey) => number): { taken: [ItemKey, number][]; built: boolean } {
  const taken: [ItemKey, number][] = [];
  for (const r of copRows(b)) { const n = Math.max(0, Math.min(r.n - r.given, Math.floor(have(r.k)))); if (n) { b.given[r.k] = r.given + n; taken.push([r.k, n]); } }
  return { taken, built: copRows(b).every((r) => r.given >= r.n) };
}
/** Where warehouse h's rotorcrafts are parked: `spot` m out at a hashed heading, facing away from it. */
export function copterSpot(h: Hub, n = 0): { x: number; z: number; yaw: number } {
  const a = (hash(h.x | 0, h.z | 0, 0xc07e) % 628) / 100 + n * 1.1;
  return { x: h.x + Math.cos(a) * COPTER.spot, z: h.z + Math.sin(a) * COPTER.spot, yaw: Math.atan2(Math.cos(a), Math.sin(a)) };
}
/** A new rotorcraft at spot `at` of warehouse `hub` with a quarter of a tank. */
export const newCopter = (hub: string, at: { x: number; y: number; z: number; yaw: number }, by: string, pid: string, now: number): Copter =>
  ({ id: `cop:${pid}:${Math.round(now)}`, x: at.x, y: at.y, z: at.z, yaw: at.yaw, fuel: COPTER.fuel.tank / 4, hub, by, t: now });
/** Burn what `dt` seconds in the air at throttle `th` (−1..1) take; false once the tank is flat. */
export function burnCop(c: Copter, th: number, dt: number): boolean {
  c.fuel = Math.max(0, c.fuel - (COPTER.fuel.idle + Math.abs(th) * COPTER.fuel.burn) * dt);
  return c.fuel > 0;
}
/** Pour a canister (L) in; the litres taken. */
export function fuelCop(c: Copter, litres: number): number {
  const n = Math.min(litres, COPTER.fuel.tank - c.fuel);
  c.fuel += n;
  return n;
}
/** Range left at three quarters throttle (km). */
export const copRangeKm = (c: Copter) => c.fuel / (COPTER.fuel.idle + COPTER.fuel.burn * 0.75) * COPTER.speed * 0.75 / 1000;
/** The ground under its skids is fit to set down on: level within `relief` over the sampled points and none of it deep water. */
export const fitToLand = (heights: number[], wet: boolean) => !wet && Math.max(...heights) - Math.min(...heights) <= COPTER.relief;
/** Where its seats are (u forward, v to the right of the cabin's middle; the pilot first). */
export const COP_SEATS: [number, number][] = [[0.5, 0.45], [0.5, -0.45]];
/** A warehouse's rotorcraft in the making and the ones parked there (for the window). */
export const copBuildOf = (id: string, towns: Record<string, TownState | undefined>, outposts: Record<string, OutpostState | undefined>) =>
  id.startsWith('v:') ? towns[id.slice(2)]?.cbuild : outposts[id]?.cbuild;
