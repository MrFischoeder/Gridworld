// Farms (pure): fields cleared outside a village's corners (up to FARM.max). Each feeds more people, so the village's
// population target rises (gen/people.ts), and with it its workers and its output. Built through the elder with wood
// and stone from the village hall, no plans needed. Each farm grows the crop you choose for it (`CROPS`): its yield
// goes into the village hall (gen/hall.ts stockOf), more on rich soil and with steel ploughs.
import { progressive, projectDone, localIndustryDone, SETTLEMENT_START, housingCapacity } from './settlement';
import { hash } from '../core/rng';
import type { ItemKey } from '../data/items';
import type { TownState } from './town';
import { peopleAt, setPeople, basePeople, PEOPLE } from './people';
import { assign } from './workforce';

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
  if (progressive(s)) return settleTarget(seed, s, p);
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
export function farmProblem(s: TownState | undefined): string {
  if (!progressive(s)) return '';
  if (!s?.settlement?.supplies) return 'Report the stored supplies to the elder first.';
  if (farmsOf(s) === 1 && !projectDone(s, 'comms') && !s.settlement.station) return 'Restore the satellite receiver before building the second farm.';
  if (farmsOf(s) === 2 && !localIndustryDone(s)) return 'Develop the warehouse, power and available local industry before building the third farm.';
  return '';
}
/** What the next farm still needs, or null when the village has all it can take. */
export function farmPlan(s: TownState | undefined) {
  if (farmProblem(s)) return null;
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

// ---------- what each farm grows ----------
export type Crop = 'wheat' | 'carrots' | 'potatoes' | 'hens' | 'cows' | 'flax' | 'sheep' | 'cotton';
/** The crops a farm can grow: what goes into the village hall and how many crates a game day on fair soil. */
export const CROPS: Record<Crop, { name: string; out: ItemKey; perDay: number; blurb: string; also?: [ItemKey, number] }> = {
  wheat: { name: 'Wheat', out: 'grain', perDay: 4, blurb: 'grain for bread' },
  carrots: { name: 'Carrots', out: 'carrots', perDay: 4, blurb: 'rows of carrots' },
  potatoes: { name: 'Potatoes', out: 'potatoes', perDay: 5, blurb: 'potatoes, the most food a field gives' },
  hens: { name: 'Hens', out: 'eggs', perDay: 3, blurb: 'a coop and a run: eggs, and a little meat', also: ['meat', 0.5] },
  cows: { name: 'Cows', out: 'milk', perDay: 3, blurb: 'a byre and a pasture: milk and meat', also: ['meat', 1] },
  flax: { name: 'Flax', out: 'fibre', perDay: 4, blurb: 'tall blue-flowered flax: fibre for a textile mill' },
  sheep: { name: 'Sheep', out: 'wool', perDay: 3, blurb: 'a fold and a pasture: wool for a textile mill' },
  cotton: { name: 'Cotton', out: 'cotton', perDay: 4, blurb: 'bushes of white cotton bolls: fibre for a textile mill' },
};
export const CROP_KINDS = Object.keys(CROPS) as Crop[];
/** What farm i grows (farms you have not set: wheat and potatoes by turns, as they were drawn before). */
export const cropOf = (s: TownState | undefined, i: number): Crop => s?.crops?.[i] ?? (i % 2 === 0 ? 'wheat' : 'potatoes');
/** Crates a game hour the village's farms put into its hall, by what they yield (the first `upgradedOf` farms have steel ploughs). */
export function farmYield(seed: number, s: TownState | undefined, workers?: number, power = 1): Partial<Record<ItemKey, number>> {
  const out: Partial<Record<ItemKey, number>> = {}, up = upgradedOf(s), sl = soil(seed);
  // a new settlement's farm yields by the hands it has (gen/workforce.ts), and its steel ploughs' extra by the power
  // the farms got (`power`, 0..1: their pumps); established villages' farms always worked
  const settled = workers !== undefined && progressive(s), posts = settled ? assign(s, workers).posts : null;
  const upMult = settled ? 1 + (UPGRADE.mult - 1) * Math.max(0, Math.min(1, power)) : UPGRADE.mult;
  for (let i = 0; i < farmsOf(s); i++) {
    const c = CROPS[cropOf(s, i)], fill = posts ? (posts.find((q) => q.id === 'farm:' + i)?.fill ?? 0) : 1, k = sl * (i < up ? upMult : 1) * fill / 24;
    out[c.out] = (out[c.out] ?? 0) + c.perDay * k;
    if (c.also) out[c.also[0]] = (out[c.also[0]] ?? 0) + c.also[1] * k;
  }
  return out;
}

// ---------- food (new-world settlements): the people eat what the farms grow ----------
/**
 * `eat` food crates a person a game day (the first `SETTLEMENT_START` live off the wilds), `value` how much food a
 * crate of each crop is (flax and wool are none), `margin` the spare food a settlement wants before families settle
 * (they come while the food would still cover them with this to spare), `short` below which people begin to leave.
 */
export const FOOD = { eat: 0.26, margin: 1.1, short: 0.95, value: { grain: 1, carrots: 1, potatoes: 1, eggs: 4 / 3, milk: 4 / 3, meat: 1.5 } as Partial<Record<ItemKey, number>> };
/**
 * The food processing house (a settlement's project 'foodworks': mill, bakery, dairy, smokehouse): while its crew is
 * at work the staples feed `gain` more (flour and bread, cheese, smoked meat keep and go further), so the same fields
 * keep more people. Only the staples it handles.
 */
export const PROCESSING = { gain: 0.35, staples: ['grain', 'potatoes', 'milk', 'meat'] as ItemKey[] };
/** Food (crate value) the farms grow a game hour with `workers` in the village, the farms' pumps getting `power`. */
export function foodMade(seed: number, s: TownState | undefined, workers: number, power = 1): number {
  const proc = progressive(s) ? 1 + PROCESSING.gain * (assign(s, workers).posts.find((p) => p.id === 'foodworks')?.fill ?? 0) : 1;
  return Object.entries(farmYield(seed, s, workers, power)).reduce((a, [k, n]) => a + (FOOD.value[k as ItemKey] ?? 0) * (PROCESSING.staples.includes(k as ItemKey) ? proc : 1) * (n ?? 0), 0);
}
/** Food (crate value) `people` eat a game hour. */
export const foodNeed = (people: number) => Math.max(0, people - SETTLEMENT_START) * FOOD.eat / 24;
/** How many people the farms feed with `workers` at work (the wilds feed the first few). */
export const peopleFed = (seed: number, s: TownState | undefined, workers: number, power = 1) => SETTLEMENT_START + foodMade(seed, s, workers, power) * 24 / FOOD.eat;
/**
 * The people a settlement grows to: no more than its homes take, and no more than its farms feed with food to spare,
 * where the farms are worked by the people it would have (more people, more hands, more food): the highest count
 * that holds up, found by stepping down from the homes.
 */
export function settleTarget(seed: number, s: TownState | undefined, power = 1): number {
  const cap = housingCapacity(s);
  let t = cap;
  for (let k = 0; k < 8; k++) {
    const fed = peopleFed(seed, s, Math.floor(t * PEOPLE.work), power);
    const n = Math.max(SETTLEMENT_START, Math.min(cap, SETTLEMENT_START + Math.floor((fed - SETTLEMENT_START) / FOOD.margin)));
    if (n >= t) break;
    t = n;
  }
  return t;
}
/** The share of the food grown that the people eat (a settlement's stock keeps the rest), for `people` heading for it. */
export function eatenShare(seed: number, s: TownState | undefined, workers: number, people: number, power = 1): number {
  const made = foodMade(seed, s, workers, power);
  return made > 0 ? Math.min(1, foodNeed(people) / made) : 0;
}
