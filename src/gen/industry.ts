// What a village lives on: its industry, worked at a site outside its fence. Farming villages till fields (grain,
// carrots, potatoes), mining villages dig a mine (coal, iron ore, copper; mostly by the hills), oil villages pump
// crude from their wells, and a village with oil wells not far off may put up a refinery that turns crude into fuel
// (it has to be built first: the elder commissions it). Others saw timber, dry fish and salt, run workshops (tools,
// cloth) or strip salvage from the ruins (tech, medicine). The industry decides what the village's market makes
// (gen/market.ts) and wants. Raids wreck the site for a while (lost raids and bandits at the site), which cuts the
// output; the villagers patch it up over a few days, or you mend it at once. Pure and deterministic.
import { hash, rng, type Dir } from '../core/rng';
import { allVillages, worldDist, villageSeed, type Poi } from './regions';
import { mountainMask } from './mountains';
import { powerSite, worksOf, GUARDED } from './town';
import { raidsBetween, raidOutcome, RAID } from './raids';
import type { TownState } from './town';
import type { Good } from './market';
import type { ItemKey } from '../data/items';

export type Industry = 'farm' | 'mine' | 'oil' | 'refinery' | 'lumber' | 'fishery' | 'workshop' | 'salvage';
export interface IndustrySpec {
  name: string; site: string;
  /** What it can make (a village makes up to two of these) and what it always wants. */
  pool: Good[]; wants: Good[];
  /** Parts to mend the site, and (refinery) what it takes to build it. */
  fix: [ItemKey, number][]; build?: [ItemKey, number][];
}
export const INDUSTRY: Record<Industry, IndustrySpec> = {
  farm: { name: 'Farming village', site: 'Fields', pool: ['grain', 'carrots', 'potatoes'], wants: ['tools'], fix: [['planks', 6], ['nails', 10]] },
  mine: { name: 'Mining village', site: 'Mine', pool: ['coal', 'ore', 'copper', 'sand'], wants: ['grain'], fix: [['planks', 8], ['scrap', 4]] },
  oil: { name: 'Oil village', site: 'Oil Wells', pool: ['crude'], wants: ['tools'], fix: [['scrap', 6], ['wire', 4]] },
  refinery: { name: 'Refinery town', site: 'Refinery', pool: ['fuel'], wants: ['crude'], fix: [['scrap', 8], ['circuit', 2]], build: [['scrap', 40], ['circuit', 10], ['wire', 20], ['planks', 30]] },
  lumber: { name: 'Timber village', site: 'Sawmill', pool: ['timber'], wants: ['tools'], fix: [['planks', 4], ['nails', 10]] },
  fishery: { name: 'Fishing village', site: 'Fish Racks', pool: ['fish', 'salt', 'sand'], wants: ['grain'], fix: [['planks', 4], ['rope', 3]] },
  workshop: { name: 'Craft village', site: 'Workshops', pool: ['tools', 'cloth'], wants: ['ore'], fix: [['planks', 4], ['scrap', 3]] },
  salvage: { name: 'Salvage village', site: 'Salvage Yard', pool: ['tech', 'meds'], wants: ['copper'], fix: [['scrap', 5], ['wire', 3]] },
};
/** How a site suffers: a lost raid takes `raid`, and damage heals by itself over `heal` game minutes. */
export const SITE = { raid: 40, heal: 4 * 1440, floor: 10 };

const baseCache = new Map<string, Industry>(), cache = new Map<string, Industry>();
/** The industry the land suggests (before refineries). */
function baseIndustry(world: number, v: Poi, seed: number): Industry {
  const key = world + ':' + v.id;
  let k = baseCache.get(key);
  if (k) return k;
  const R = rng(hash(seed, 0x1d57)), far = Math.min(1, worldDist(v.x, v.z, 0, 0) / 30000);
  let hills = 0;
  for (let a = 0; a < 8; a++) hills = Math.max(hills, mountainMask(world, v.x + Math.cos(a * 0.785) * 1500, v.z + Math.sin(a * 0.785) * 1500));
  const w: Record<Exclude<Industry, 'refinery'>, number> = {
    farm: 2.2 + far, mine: hills > 0.1 ? 5 : 0.4, oil: far > 0.08 ? 0.9 : 0.1, lumber: 1 + far * 0.5,
    fishery: 0.8, workshop: 1.6 - far, salvage: 1.1 - far * 0.5,
  };
  let r = R() * Object.values(w).reduce((a, b) => a + b, 0);
  for (const [name, x] of Object.entries(w)) { if ((r -= x) <= 0) { k = name as Industry; break; } }
  k ??= 'farm';
  if (baseCache.size > 4000) baseCache.clear();
  baseCache.set(key, k);
  return k;
}
/** What village v (seed `seed`) lives on. A village near oil wells (within 9 km) may be a refinery town instead. */
export function industryOf(world: number, v: Poi, seed: number): Industry {
  const key = world + ':' + v.id;
  let k = cache.get(key);
  if (k) return k;
  k = baseIndustry(world, v, seed);
  if ((k === 'workshop' || k === 'farm' || k === 'salvage') && hash(seed, 0x1d58) % 100 < 45) {
    const oil = allVillages(world).some((o) => o.id !== v.id && worldDist(o.x, o.z, v.x, v.z) < 9000 && baseIndustry(world, o, villageSeed(world, o)) === 'oil');
    if (oil) k = 'refinery';
  }
  if (cache.size > 4000) cache.clear();
  cache.set(key, k);
  return k;
}
/** Is the village's site standing (a refinery must be built first)? */
export const siteBuilt = (k: Industry, s: TownState | undefined) => !INDUSTRY[k].build || !!s?.built;
/** The site's condition 0..100: lost raids and bandits at the site knock it down, and it heals with time or your repair. */
export function siteCondition(world: number, v: Poi, s: TownState | undefined, now: number): number {
  const since = Math.max(s?.siteFixed ?? -Infinity, now - SITE.heal - RAID.duration * 2);
  let dmg = 0;
  for (const r of raidsBetween(world, v, since - RAID.duration, now)) {
    const end = r.t0 + RAID.duration;
    if (end > since && end <= now && raidOutcome(world, r, s) === 'lost') dmg += SITE.raid * (worksOf(s, 'siteGuard') ? GUARDED.lost : 1) * Math.max(0, 1 - (now - end) / SITE.heal);
  }
  if (s?.siteHurt && s.siteHurtT !== undefined && s.siteHurtT > (s.siteFixed ?? -Infinity)) dmg += s.siteHurt * Math.max(0, 1 - (now - s.siteHurtT) / SITE.heal);
  return Math.max(SITE.floor, Math.min(100, 100 - dmg));
}
/**
 * How good a farming village's fields are: 0.6 (thin, stony soil) .. 1.6 (deep black earth), from the seed and the
 * land (hills make poorer fields). Anyone can farm, but rich fields make a surplus to sell. 1 for any other village.
 */
export function fertility(world: number, v: Poi, seed: number): number {
  if (industryOf(world, v, seed) !== 'farm') return 1;
  const hills = mountainMask(world, v.x, v.z), r = (hash(seed, 0xfe27) % 1000) / 1000;
  return Math.round(Math.max(0.6, Math.min(1.6, 0.6 + r * 1.1 - hills * 0.8)) * 100) / 100;
}
/** How much the village's industry puts out now (0: its refinery is not built yet): its condition, times the fields' fertility on a farm. */
export function production(world: number, v: Poi, seed: number, s: TownState | undefined, now: number): number {
  const k = industryOf(world, v, seed);
  return siteBuilt(k, s) ? siteCondition(world, v, s, now) / 100 * fertility(world, v, seed) : 0;
}
/**
 * Where the site lies, in plaza-local metres: on a side (W, E or S) other than the power plant's, off its middle so
 * the gate stays clear, `w` along the fence and `d` out from it. `face` points away from the village.
 */
export function industrySite(seed: number, k: Industry): { x: number; z: number; w: number; d: number; side: Dir; face: [number, number] } {
  const p = powerSite(seed), R = rng(hash(seed, 0x1d59)), sides = (['W', 'E', 'S'] as Dir[]).filter((s) => s !== p.side);
  const side = sides[Math.floor(R() * sides.length)], along = R() < 0.5 ? 16 : 56;
  const w = k === 'farm' ? 28 : 18, d = k === 'farm' ? 18 : 14, off = 11 + d / 2; // within the village's tree clearing
  if (side === 'W') return { x: -off, z: along, w: d, d: w, side, face: [-1, 0] };
  if (side === 'E') return { x: 72 + off, z: along, w: d, d: w, side, face: [1, 0] };
  return { x: along, z: 72 + off, w, d, side, face: [0, 1] };
}
/** The refinery commission: what is still missing (like the wall's in gen/town.ts), or null once built. */
export function buildPlan(k: Industry, s: TownState | undefined) {
  const need = INDUSTRY[k].build;
  if (!need || s?.built) return null;
  const rows = need.map(([i, n]) => ({ k: i, n, given: Math.min(n, s?.bgiven?.[i] ?? 0) }));
  return { rows, done: rows.every((r) => r.given >= r.n) };
}
/** Hand over materials for the refinery; builds it once everything is in. */
export function handOverBuild(k: Industry, s: TownState, have: (i: ItemKey) => number): { taken: [ItemKey, number][]; built: boolean } {
  const plan = buildPlan(k, s);
  if (!plan) return { taken: [], built: false };
  s.bgiven ??= {};
  const taken: [ItemKey, number][] = [];
  for (const r of plan.rows) { const n = Math.min(r.n - r.given, have(r.k)); if (n > 0) { s.bgiven[r.k] = r.given + n; taken.push([r.k, n]); } }
  if (buildPlan(k, s)!.done) { s.built = true; s.bgiven = {}; return { taken, built: true }; }
  return { taken, built: false };
}
