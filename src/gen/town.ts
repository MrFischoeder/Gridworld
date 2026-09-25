// What the player changes about a village, and the rules for it (pure; saved as char.towns[villageId]):
// - fortification: the elder commissions the next tier of the wall (gen/village.ts WALL_TIERS). Materials can be
//   handed over bit by bit (a backpack cannot hold 60 planks); once all are in, the wall goes up.
// - power: every village draws its electricity from its own kind of plant outside the fence (a diesel generator,
//   a solar array or wind turbines), chosen from the village seed. It wears down with time (and later with raids)
//   and needs mending with the right parts; below `POWER_DOWN` the lights go out.
import { hash, rng, type Dir } from '../core/rng';
import { villageGates, WALL_TIERS } from './village';
import type { ItemKey } from '../data/items';
import type { PlantState, PlantKind } from './plants';
import type { StationState, StationKind } from './energy';

export interface TownState {
  /** The wall's tier (0 = the stake fence every village starts with). */
  wall?: number;
  /** Materials handed over towards the next tier. */
  given?: Partial<Record<ItemKey, number>>;
  /** Game time the power plant was last mended (undefined: never by you, see `lastFix`). */
  fixed?: number;
  /** Extra damage to the plant (raids fought while you were there), in percent. */
  hurt?: number;
  /** How the bandit raids you were there for ended (gen/raids.ts), by raid number. */
  raids?: Record<number, 'won' | 'lost' | 'paid'>;
  /** The storehouse (gen/store.ts): crates at a time, its tier, materials handed over towards the next one. */
  store?: { n: number; t: number }; storeTier?: number; sgiven?: Partial<Record<ItemKey, number>>;
  /** When villagers were killed in raids you were there for (they are missed for a couple of days). */
  dead?: number[];
  /** The industry site (gen/industry.ts): when you last mended it, damage bandits did at it and when, the refinery built and its materials so far. */
  siteFixed?: number; siteHurt?: number; siteHurtT?: number; built?: boolean; bgiven?: Partial<Record<ItemKey, number>>;
  /** Defence works done (WORKS: turrets on the wall, barricades round the site and the plant) and materials towards the next of each. */
  works?: Partial<Record<WorkKind, number>>; wgiven?: Partial<Record<WorkKind, Partial<Record<ItemKey, number>>>>;
  /** Processing works (gen/plants.ts): those built here, and the one being built. */
  plants?: PlantState[]; pbuild?: { k: PlantKind | StationKind; given: Partial<Record<ItemKey, number>> };
  /** Power stations (gen/energy.ts) built here. */
  stations?: StationState[];
}

// ---------- defence works ----------
/**
 * What the elder can commission besides the wall: auto turrets on the wall top (one at a time, up to the wall's
 * mount spots; they need at least a palisade), and barricades round the industry site and round the power plant
 * (sandbag walls and spiked timber, one each): bandits there do much less harm.
 */
export type WorkKind = 'turret' | 'siteGuard' | 'plantGuard';
export const WORKS: Record<WorkKind, { name: string; needs: [ItemKey, number][]; gold: number; xp: number; max: number }> = {
  turret: { name: 'Auto Turret', needs: [['turretkit', 1], ['circuit', 2], ['wire', 4], ['scrap', 4]], gold: 150, xp: 60, max: 6 },
  siteGuard: { name: 'Barricades round the works', needs: [['planks', 24], ['stone', 20], ['scrap', 8], ['rope', 6]], gold: 220, xp: 90, max: 1 },
  plantGuard: { name: 'Barricades round the power plant', needs: [['planks', 16], ['stone', 16], ['scrap', 6], ['rope', 4]], gold: 180, xp: 70, max: 1 },
};
/** How much less harm bandits do at a barricaded site or plant (live raids), and to it in a lost raid. */
export const GUARDED = { live: 0.35, lost: 0.5 };
export const worksOf = (s: TownState | undefined, k: WorkKind) => s?.works?.[k] ?? 0;
/** The next piece of work k: what is still missing, or null when there is no more to do (`limit`: the spots there are). */
export function workPlan(s: TownState | undefined, k: WorkKind, limit = WORKS[k].max) {
  const w = WORKS[k], done = worksOf(s, k);
  if (done >= Math.min(w.max, limit)) return null;
  const rows = w.needs.map(([i, n]) => ({ k: i, n, given: Math.min(n, s?.wgiven?.[k]?.[i] ?? 0) }));
  return { kind: k, done, rows, complete: rows.every((r) => r.given >= r.n), gold: w.gold, xp: w.xp };
}
/** Hand over materials for the next piece of work k (bit by bit); it is done once all are in. */
export function handOverWork(s: TownState, k: WorkKind, have: (i: ItemKey) => number, limit = WORKS[k].max): { taken: [ItemKey, number][]; done: boolean } {
  const plan = workPlan(s, k, limit);
  if (!plan) return { taken: [], done: false };
  const g = ((s.wgiven ??= {})[k] ??= {}), taken: [ItemKey, number][] = [];
  for (const r of plan.rows) { const n = Math.min(r.n - r.given, have(r.k)); if (n > 0) { g[r.k] = r.given + n; taken.push([r.k, n]); } }
  if (workPlan(s, k, limit)!.complete) { (s.works ??= {})[k] = plan.done + 1; s.wgiven![k] = {}; return { taken, done: true }; }
  return { taken, done: false };
}

/** What it takes to raise the wall to tier i+1 (index = the tier you have), and what the village pays for it. */
export const FORTIFY: { needs: [ItemKey, number][]; gold: number; xp: number }[] = [
  { needs: [['planks', 60], ['log', 16], ['nails', 40], ['rope', 10]], gold: 350, xp: 120 },
  { needs: [['stone', 80], ['scrap', 30], ['planks', 20], ['nails', 30]], gold: 900, xp: 300 },
];
export const wallOf = (s: TownState | undefined) => Math.min(WALL_TIERS.length - 1, s?.wall ?? 0);
/** The next tier's requirements with what is still missing, or null when the wall is at its best. */
export function fortifyPlan(s: TownState | undefined) {
  const t = wallOf(s), f = FORTIFY[t];
  if (!f) return null;
  const rows = f.needs.map(([k, n]) => ({ k, n, given: Math.min(n, s?.given?.[k] ?? 0) }));
  return { from: t, to: t + 1, rows, done: rows.every((r) => r.given >= r.n), gold: f.gold, xp: f.xp };
}
/** Hand over up to `have(k)` of each missing material; returns what was taken. Raises the wall when complete. */
export function handOver(s: TownState, have: (k: ItemKey) => number): { taken: [ItemKey, number][]; raised: boolean } {
  const plan = fortifyPlan(s);
  if (!plan) return { taken: [], raised: false };
  const taken: [ItemKey, number][] = [];
  s.given ??= {};
  for (const r of plan.rows) {
    const n = Math.min(r.n - r.given, have(r.k));
    if (n > 0) { s.given[r.k] = r.given + n; taken.push([r.k, n]); }
  }
  const after = fortifyPlan(s)!;
  if (after.done) { s.wall = plan.to; s.given = {}; return { taken, raised: true }; }
  return { taken, raised: false };
}

// ---------- power ----------
export type PowerKind = 'generator' | 'solar' | 'wind';
export const POWER: Record<PowerKind, { name: string; fix: [ItemKey, number][]; wear: number; pay: number }> = {
  generator: { name: 'Diesel Generator', fix: [['engine', 1], ['scrap', 2]], wear: 20, pay: 60 },
  solar: { name: 'Solar Array', fix: [['circuit', 2], ['wire', 2]], wear: 11, pay: 50 },
  wind: { name: 'Wind Turbines', fix: [['scrap', 3], ['wire', 2], ['rope', 1]], wear: 15, pay: 55 },
};
/** Below this condition (percent) the power is out; below POWER_LOW it is failing (a job for you). */
export const POWER_DOWN = 25, POWER_LOW = 60;
const DAY = 1440;
export const powerKind = (seed: number): PowerKind => (['generator', 'solar', 'wind'] as const)[hash(seed, 0x90e7) % 3];
/** When the plant was last mended: by you, or (never touched) some time in the last few days, per village. */
export const lastFix = (seed: number, s: TownState | undefined) => s?.fixed ?? -(hash(seed, 0x90e8) % (4 * DAY));
/** The plant's condition (0..100) at game time `now`. */
export function powerCondition(seed: number, s: TownState | undefined, now: number, raidHurt = 0): number {
  const k = powerKind(seed), age = Math.max(0, now - lastFix(seed, s)) / DAY;
  return Math.max(0, Math.min(100, 100 - age * POWER[k].wear - (s?.hurt ?? 0) - raidHurt));
}
/**
 * Where the plant stands, in plaza-local metres (the plaza runs 0..72): on a side of the village the seed picks
 * (never the north one, where Gridholm's vehicle yard is), off a corner so the road from any gate stays clear,
 * `off` metres out from the fence. `face` is the outward direction.
 */
export function powerSite(seed: number): { x: number; z: number; w: number; d: number; side: Dir; face: [number, number] } {
  const R = rng(hash(seed, 0x90e9)), gates = villageGates(seed);
  const sides: Dir[] = (['W', 'E', 'S'] as Dir[]).sort((a, b) => (gates.includes(a) ? 1 : 0) - (gates.includes(b) ? 1 : 0));
  const side = R() < 0.7 ? sides[0] : sides[1 + Math.floor(R() * 2)], along = R() < 0.5 ? 14 : 58, off = 17;
  const w = 14, d = 10;
  if (side === 'W') return { x: -off, z: along, w: d, d: w, side, face: [-1, 0] };
  if (side === 'E') return { x: 72 + off, z: along, w: d, d: w, side, face: [1, 0] };
  return { x: along, z: 72 + off, w, d, side, face: [0, 1] };
}
