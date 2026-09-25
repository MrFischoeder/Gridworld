// Processing works. What a village digs, pumps or grows depends on its land (gen/industry.ts), but any village can put
// up any works to process goods, `PLANT_SLOTS` of them outside its fence: a smelter, a refinery, a glassworks, a
// wire mill, an electronics shop, a machine shop, a foundry, a chemical works. You commission one from the elder
// (materials handed over bit by bit and a fee in gold) and then it is yours to run: load crates of the inputs into
// its hopper, pick what it makes, and collect the output later. It works one batch every `batch` game minutes while
// it has the inputs and room for the output. Processed goods are worth well over their inputs (gen/market.ts
// GOOD_INFO, `proc`): processing is how a trader earns, and the shuttle in the hangar needs them (gen/shuttle.ts).
//
// State (in the village's TownState): the works built (`plants`, each with its hopper, output and clock) and the
// one being built. The run is pure: `runPlant` settles the batches done by any game time.
import { hash, type Dir } from '../core/rng';
import { powerSite, type TownState } from './town';
import { industrySite, type Industry } from './industry';
import type { Good } from './market';
import type { ItemKey } from '../data/items';

export type PlantKind = 'smelter' | 'refinery' | 'glassworks' | 'wiremill' | 'electronics' | 'machineshop' | 'foundry' | 'chemworks';
export const PLANT_KINDS: PlantKind[] = ['smelter', 'refinery', 'glassworks', 'wiremill', 'electronics', 'machineshop', 'foundry', 'chemworks'];
export interface Recipe { in: [Good, number][]; out: [Good, number] }
export interface PlantSpec {
  name: string; blurb: string;
  recipes: Recipe[];
  /** Game minutes a batch takes. */
  batch: number;
  /** What it takes to build: materials (handed over bit by bit), the fee in gold, the xp. */
  needs: [ItemKey, number][]; fee: number; xp: number;
}
export const PLANTS: Record<PlantKind, PlantSpec> = {
  smelter: { name: 'Smelter', blurb: 'melts ore with coal into ingots', batch: 60,
    recipes: [{ in: [['ore', 2], ['coal', 1]], out: ['steel', 1] }, { in: [['copper', 2], ['coal', 1]], out: ['copperbar', 1] }],
    needs: [['stone', 40], ['scrap', 12], ['planks', 16], ['log', 8]], fee: 600, xp: 150 },
  refinery: { name: 'Oil Refinery', blurb: 'cracks crude oil into fuel or plastic resin', batch: 60,
    recipes: [{ in: [['crude', 1]], out: ['fuel', 1] }, { in: [['crude', 2]], out: ['plastic', 1] }],
    needs: [['scrap', 30], ['wire', 12], ['circuit', 4], ['planks', 16]], fee: 900, xp: 200 },
  glassworks: { name: 'Glassworks', blurb: 'melts quartz sand with coal into glass', batch: 45,
    recipes: [{ in: [['sand', 2], ['coal', 1]], out: ['glass', 1] }],
    needs: [['stone', 30], ['scrap', 8], ['planks', 12]], fee: 450, xp: 120 },
  wiremill: { name: 'Wire Mill', blurb: 'draws copper ingots into cable', batch: 45,
    recipes: [{ in: [['copperbar', 1]], out: ['cable', 2] }],
    needs: [['scrap', 16], ['wire', 8], ['planks', 12], ['engine', 1]], fee: 700, xp: 160 },
  electronics: { name: 'Electronics Shop', blurb: 'etches circuit boards from cable, resin and glass', batch: 90,
    recipes: [{ in: [['cable', 1], ['plastic', 1], ['glass', 1]], out: ['boards', 1] }],
    needs: [['circuit', 8], ['wire', 10], ['scrap', 10], ['planks', 16]], fee: 1400, xp: 300 },
  machineshop: { name: 'Machine Shop', blurb: 'machines steel into parts, and tools', batch: 75,
    recipes: [{ in: [['steel', 2]], out: ['parts', 1] }, { in: [['steel', 1], ['timber', 1]], out: ['tools', 3] }],
    needs: [['scrap', 20], ['engine', 1], ['planks', 16], ['nails', 20]], fee: 1100, xp: 240 },
  foundry: { name: 'Alloy Foundry', blurb: 'casts hull alloy from steel, copper and coal', batch: 120,
    recipes: [{ in: [['steel', 2], ['copperbar', 1], ['coal', 1]], out: ['alloy', 1] }],
    needs: [['stone', 50], ['scrap', 24], ['pcore', 1], ['planks', 16]], fee: 1800, xp: 350 },
  chemworks: { name: 'Chemical Works', blurb: 'blends rocket propellant from fuel and salt', batch: 60,
    recipes: [{ in: [['fuel', 1], ['salt', 1]], out: ['propellant', 1] }],
    needs: [['scrap', 20], ['wire', 8], ['circuit', 4], ['planks', 12]], fee: 1000, xp: 220 },
};
/** Works per village, the most a hopper holds of each input, and the most finished crates the output bay holds. */
export const PLANT_SLOTS = 2, HOPPER = 40, OUT_CAP = 40;

export interface PlantState {
  k: PlantKind; rec: number;
  /** Crates in the hopper, finished crates waiting, and the game time up to which the batches are settled. */
  inp: Partial<Record<Good, number>>; out: Partial<Record<Good, number>>; t: number;
}
/** Plant state lives in the village's TownState. */
type PlantTown = TownState;

const has = (p: PlantState, r: Recipe) => r.in.every(([g, n]) => (p.inp[g] ?? 0) >= n);
const outN = (p: PlantState) => Object.values(p.out).reduce((a, n) => a + (n ?? 0), 0);
/** Can it work a batch now (inputs in, room for the output)? */
export const running = (p: PlantState) => has(p, PLANTS[p.k].recipes[p.rec]) && outN(p) + PLANTS[p.k].recipes[p.rec].out[1] <= OUT_CAP;
/**
 * Settle the batches done by `now`: every `batch` minutes one batch while it can work; idle time does not bank.
 * Returns the batches done. Pure on the state object.
 */
export function runPlant(p: PlantState, now: number): number {
  const spec = PLANTS[p.k], r = spec.recipes[p.rec];
  let n = 0;
  while (now - p.t >= spec.batch && running(p) && n < 500) {
    for (const [g, k] of r.in) p.inp[g] = (p.inp[g] ?? 0) - k;
    p.out[r.out[0]] = (p.out[r.out[0]] ?? 0) + r.out[1];
    p.t += spec.batch; n++;
  }
  if (!running(p) || now - p.t >= spec.batch) p.t = now; // stopped: the clock starts again when it is fed
  return n;
}
/** How far the batch under way is (0..1), or null when it stands. */
export const progress = (p: PlantState, now: number) => (running(p) ? Math.min(1, (now - p.t) / PLANTS[p.k].batch) : null);
/** Feed n crates of g into the hopper (settles first, so the new crates do not count for time already gone); returns how many went in. */
export function feed(p: PlantState, g: Good, n: number, now: number): number {
  runPlant(p, now);
  if (!PLANTS[p.k].recipes.some((r) => r.in.some(([x]) => x === g))) return 0;
  const k = Math.max(0, Math.min(n, HOPPER - (p.inp[g] ?? 0)));
  const was = running(p);
  p.inp[g] = (p.inp[g] ?? 0) + k;
  if (!was) p.t = now;
  return k;
}
/** Take up to n finished crates of g out. */
export function collect(p: PlantState, g: Good, n: number, now: number): number {
  runPlant(p, now);
  const was = running(p), k = Math.max(0, Math.min(n, p.out[g] ?? 0));
  p.out[g] = (p.out[g] ?? 0) - k;
  if (!p.out[g]) delete p.out[g];
  if (!was) p.t = now; // it was full: it starts again now
  return k;
}
/** Switch what it makes (the batch under way is dropped, the hopper kept). */
export function setRecipe(p: PlantState, rec: number, now: number) { runPlant(p, now); p.rec = rec; p.t = now; }

// ---------- building one ----------
/** The works being built at the village, and what it still needs; or null. */
export function plantPlan(s: PlantTown | undefined) {
  const b = s?.pbuild;
  if (!b) return null;
  const spec = PLANTS[b.k], rows = spec.needs.map(([k, n]) => ({ k, n, given: Math.min(n, b.given[k] ?? 0) }));
  return { k: b.k, rows, done: rows.every((r) => r.given >= r.n), fee: spec.fee, xp: spec.xp };
}
/** Why works k cannot be started here, or ''. */
export function plantProblem(s: PlantTown | undefined, k: PlantKind): string {
  if (s?.pbuild) return 'Another works is being built here: finish it first.';
  if ((s?.plants?.length ?? 0) >= PLANT_SLOTS) return `There is room for ${PLANT_SLOTS} works here, and both are built.`;
  if (s?.plants?.some((p) => p.k === k)) return 'The village has one of those already.';
  return '';
}
/** Start building works k (the fee is paid when it is finished). */
export function startPlant(s: PlantTown, k: PlantKind): string {
  const why = plantProblem(s, k);
  if (why) return why;
  s.pbuild = { k, given: {} };
  return '';
}
/** Hand over materials for the works being built; it stands once all are in and the fee is paid (`pay` says if you can). */
export function handOverPlant(s: PlantTown, have: (k: ItemKey) => number, now: number, pay: (fee: number) => boolean): { taken: [ItemKey, number][]; built: PlantKind | null } {
  const plan = plantPlan(s);
  if (!plan) return { taken: [], built: null };
  const taken: [ItemKey, number][] = [];
  for (const r of plan.rows) { const n = Math.min(r.n - r.given, have(r.k)); if (n > 0) { s.pbuild!.given[r.k] = r.given + n; taken.push([r.k, n]); } }
  if (plantPlan(s)!.done && pay(plan.fee)) {
    (s.plants ??= []).push({ k: plan.k, rec: 0, inp: {}, out: {}, t: now });
    s.pbuild = undefined;
    return { taken, built: plan.k };
  }
  return { taken, built: null };
}

// ---------- where they stand ----------
/**
 * Where works i stands, in plaza-local metres: on the side of the village that has neither the power plant nor the
 * industry site (W, E or S), at one end of it or the other, off the gates, 11 m + half its depth out.
 */
export function plantSite(seed: number, k: Industry, i: number): { x: number; z: number; w: number; d: number; side: Dir; face: [number, number] } {
  const p = powerSite(seed), s = industrySite(seed, k), side = (['W', 'E', 'S'] as Dir[]).find((d) => d !== p.side && d !== s.side) ?? 'S';
  const along = (i === 0) !== (hash(seed, 0x9147) % 2 === 0) ? 15 : 57, w = 18, d = 14, off = 11 + d / 2;
  if (side === 'W') return { x: -off, z: along, w: d, d: w, side, face: [-1, 0] };
  if (side === 'E') return { x: 72 + off, z: along, w: d, d: w, side, face: [1, 0] };
  return { x: along, z: 72 + off, w, d, side, face: [0, 1] };
}
/** Plant state in a village's TownState. */
export const plantsOf = (s: TownState | undefined): PlantState[] => s?.plants ?? [];
