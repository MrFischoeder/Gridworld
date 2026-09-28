// Farms (pure): fields cleared outside a village's corners (up to FARM.max). Each feeds more people, so the village's
// population target rises (gen/people.ts), and with it its workers and its output. Built through the elder with wood
// and stone handed over bit by bit, no plans needed.
import { hash } from '../core/rng';
import type { ItemKey } from '../data/items';
import type { TownState } from './town';
import { peopleAt, setPeople, basePeople } from './people';

export const FARM = { max: 3, people: 15, needs: [['log', 8], ['stone', 6]] as [ItemKey, number][], xp: 60, gold: 40, kw: 3 };
/** Steel ploughs and pumps (the Steel Ploughs plans): an upgraded farm feeds `mult` × as many, but draws more power. */
export const UPGRADE = { tech: 'plough', needs: [['scrap', 5], ['wire', 4]] as [ItemKey, number][], mult: 1.6, kw: 8, xp: 80, gold: 60 };
/** What a farm feeds without power (its share of its full yield): irrigation pumps and lamps stop. */
export const UNPOWERED = 0.6;
export const farmsOf = (s: TownState | undefined) => s?.farms ?? 0;
/** The land's soil, 0.7–1.3 (a village's fields all share it). */
export const soil = (seed: number) => 0.7 + (hash(seed, 0xf42) % 61) / 100;
/** People one farm feeds here. */
export const farmPeople = (seed: number) => Math.round(FARM.people * soil(seed));
export const upgradedOf = (s: TownState | undefined) => Math.min(farmsOf(s), s?.fup ?? 0);
/** Power the village's farms draw (kW). */
export const farmsKw = (s: TownState | undefined) => (farmsOf(s) - upgradedOf(s)) * FARM.kw + upgradedOf(s) * UPGRADE.kw;
/**
 * The population the village's food supports with its farms powered a share `p` (0..1, over the last day): a plain
 * farm feeds 60% of its yield without power, an upgraded one 60% of the plain yield without power and 160% with it.
 */
export function farmTarget(seed: number, home: boolean, s: TownState | undefined, p: number): number {
  const F = farmPeople(seed), plain = farmsOf(s) - upgradedOf(s), up = upgradedOf(s);
  return basePeople(seed, home) + Math.round(F * (plain * (UNPOWERED + (1 - UNPOWERED) * p) + up * (UNPOWERED + (UPGRADE.mult - UNPOWERED) * p)));
}
/** What the next upgrade still needs, or null when every farm has it. */
export function upgradePlan(s: TownState | undefined) {
  if (upgradedOf(s) >= farmsOf(s)) return null;
  const rows = UPGRADE.needs.map(([k, n]) => ({ k, n, given: Math.min(n, s?.ugiven?.[k] ?? 0) }));
  return { n: upgradedOf(s) + 1, rows, done: rows.every((r) => r.given >= r.n) };
}
/** Hand over materials for the next upgrade (needs the Steel Ploughs plans); upgrades a farm once complete. */
export function handOverUpgrade(s: TownState, tech: Record<string, number>, have: (k: ItemKey) => number): { taken: [ItemKey, number][]; built: boolean } {
  const plan = upgradePlan(s);
  if (!plan || tech[UPGRADE.tech] === undefined) return { taken: [], built: false };
  s.ugiven ??= {};
  const taken: [ItemKey, number][] = [];
  for (const r of plan.rows) { const n = Math.min(r.n - r.given, have(r.k)); if (n > 0) { s.ugiven[r.k] = r.given + n; taken.push([r.k, n]); } }
  if (!upgradePlan(s)!.done) return { taken, built: false };
  s.fup = upgradedOf(s) + 1; s.ugiven = {};
  return { taken, built: true };
}
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
