// Farms (pure): fields cleared outside a village's corners (up to FARM.max). Each feeds more people, so the village's
// population target rises (gen/people.ts), and with it its workers and its output. Built through the elder with wood
// and stone handed over bit by bit, no plans needed.
import { hash } from '../core/rng';
import type { ItemKey } from '../data/items';
import type { TownState } from './town';
import { peopleAt, setPeople } from './people';

export const FARM = { max: 3, people: 15, needs: [['log', 8], ['stone', 6]] as [ItemKey, number][], xp: 60, gold: 40 };
export const farmsOf = (s: TownState | undefined) => s?.farms ?? 0;
/** The land's soil, 0.7–1.3 (a village's fields all share it). */
export const soil = (seed: number) => 0.7 + (hash(seed, 0xf42) % 61) / 100;
/** People one farm feeds here. */
export const farmPeople = (seed: number) => Math.round(FARM.people * soil(seed));
/** What the next farm still needs, or null when the village has all it can take. */
export function farmPlan(s: TownState | undefined) {
  if (farmsOf(s) >= FARM.max) return null;
  const rows = FARM.needs.map(([k, n]) => ({ k, n, given: Math.min(n, s?.fgiven?.[k] ?? 0) }));
  return { n: farmsOf(s) + 1, rows, done: rows.every((r) => r.given >= r.n) };
}
/** Hand over materials for the next farm; builds it once complete (the population curve is re-anchored first, so it grows from where it is). */
export function handOverFarm(s: TownState, seed: number, home: boolean, now: number, have: (k: ItemKey) => number): { taken: [ItemKey, number][]; built: boolean } {
  const plan = farmPlan(s);
  if (!plan) return { taken: [], built: false };
  s.fgiven ??= {};
  const taken: [ItemKey, number][] = [];
  for (const r of plan.rows) { const n = Math.min(r.n - r.given, have(r.k)); if (n > 0) { s.fgiven[r.k] = r.given + n; taken.push([r.k, n]); } }
  if (!farmPlan(s)!.done) return { taken, built: false };
  setPeople(s, seed, home, now, peopleAt(seed, home, s, now));
  s.farms = farmsOf(s) + 1; s.fgiven = {};
  return { taken, built: true };
}
/** The i-th farm's field in plaza-local metres: outside a corner of the wall, clear of the sites on the sides and the gates. */
export function farmPlot(seed: number, i: number): { x0: number; z0: number; x1: number; z1: number } {
  const corners: [number, number][] = [[-10, -10], [82, -10], [82, 82], [-10, 82]], k = (hash(seed, 0xf43) + i) % 4, [cx, cz] = corners[k];
  return { x0: cx - 6, z0: cz - 6, x1: cx + 6, z1: cz + 6 };
}
