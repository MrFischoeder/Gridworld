// Where a village's new farms go (pure). The elder no longer picks a corner of the wall: once a farm's materials are
// in, the hero gets a Survey Stake and walks out to choose its field within `FIELD.reach` of the village. The
// ground under it is levelled (a claim-like pad in the terrain, gen/claims.ts `claimFlatten`, with the field's own
// smaller radius) and the builders start there. Some ground is kept for other work and refused: the village and its
// clearing, the yards of its resources (quarry, mine, oil, lumber, refinery, the food processing house:
// gen/resource-sites.ts), its industry site, the power plant, the works and power station plots, the hall and the
// warehouse, Gridholm's vehicle yard, the other fields; and roads, water, places, player bases and ground too steep
// to level. Farms built before keep their corner of the wall (`farmPlot`).
// Saved: `TownState.fplots[i]` (shared on a server) = where farm i stands; `TownState.fwait` = the farm's materials
// are in and it waits for its field.
import { worldDist, wrapDx, poisNear, GRIDHOLM_ID, type Poi } from './regions';
import { VILLAGE_OFFSET } from './village';
import { RESOURCE_PLOTS, RESOURCE_YARD, GROVE_REACH } from './resource-sites';
import { industryOf, industrySite } from './industry';
import { powerSite, type TownState } from './town';
import { plantSite } from './plants';
import { stationSite } from './energy';
import { HALL, VEHICLE_HALL } from './hall';
import { YARD } from './vehicles';
import { nearestOnRoad } from './roads';
import { farmPlot, farmsOf } from './farms';
import { claimDist, clearOf, type Claim } from './claims';
import type { Terrain } from './terrain';

/** How far out a field may go (from the village's middle), its half size, the levelled radius and the blend back, the most the ground may be cut or filled. */
export const FIELD = { reach: 500, half: 6, flat: 9, blend: 10, maxCut: 3.5 };
/** Where a farm's field stands (world; x as placed) and the height its ground is levelled to. */
export interface FieldSpot { x: number; z: number; y: number }

interface Zone { x0: number; z0: number; x1: number; z1: number; why: string }
/** The ground kept for other things round a village (world rects). */
export function reservedZones(world: number, poi: Poi, seed: number, s: TownState | undefined): Zone[] {
  const ox = poi.x + VILLAGE_OFFSET.x, oz = poi.z + VILLAGE_OFFSET.z, out: Zone[] = [];
  const rect = (x0: number, z0: number, x1: number, z1: number, why: string) => out.push({ x0: ox + x0, z0: oz + z0, x1: ox + x1, z1: oz + z1, why });
  const site = (p: { x: number; z: number; w: number; d: number }, why: string) => rect(p.x, p.z, p.x + p.w, p.z + p.d, why);
  rect(-14, -14, 86, 86, 'Too close to the village: its walls and clearing'); // the wall, the gates' lanes and the ring of side plots
  for (const [k, p] of Object.entries(RESOURCE_PLOTS)) {
    const word = k === 'quarry' ? 'the stone quarry' : k === 'oil' ? 'the oil wells' : k === 'mine' ? 'the mine' : k === 'lumber' ? 'the lumber camp' : k === 'refinery' ? 'the refinery' : 'the food processing house';
    const m = k === 'lumber' ? GROVE_REACH + 4 : 6; // the lumber camp's yard lies in the great grove
    rect(p.x - RESOURCE_YARD.halfX - m, p.z - RESOURCE_YARD.halfZ - m, p.x + RESOURCE_YARD.halfX + m, p.z + RESOURCE_YARD.halfZ + m, k === 'lumber' ? 'That is the great grove: its ground is kept for the lumber camp' : `That ground is kept for ${word}`);
  }
  const ind = industryOf(world, poi, seed);
  site(industrySite(seed, ind), 'That ground is kept for the village\'s industry');
  site(powerSite(seed), 'That ground is kept for the power plant');
  for (const i of [0, 1]) { site(plantSite(seed, ind, i), 'That ground is kept for the works'); site(stationSite(seed, ind, i), 'That ground is kept for a power station'); }
  rect(HALL.x0, HALL.z0, HALL.x1, HALL.z1, 'That ground is kept for the village hall');
  rect(VEHICLE_HALL.x0, VEHICLE_HALL.z0, VEHICLE_HALL.x1, VEHICLE_HALL.z1, 'That ground is kept for the warehouse');
  if (poi.id === GRIDHOLM_ID) { const xs = [YARD.dealer.x, ...YARD.bays.map((b) => b.x)], zs = [YARD.dealer.z, ...YARD.bays.map((b) => b.z)]; rect(Math.min(...xs) - 6, Math.min(...zs) - 6, Math.max(...xs) + 6, Math.max(...zs) + 6, 'That ground is the vehicle yard'); }
  for (let i = 0; i < farmsOf(s); i++) if (!s?.fplots?.[i]) { const p = farmPlot(seed, i); rect(p.x0, p.z0, p.x1, p.z1, 'Another farm stands there'); } // the old corner fields
  return out;
}
const rectGap = (z: { x0: number; z0: number; x1: number; z1: number }, x: number, zz: number) => Math.hypot(Math.max(z.x0 - x, 0, x - z.x1), Math.max(z.z0 - zz, 0, zz - z.z1));

/** The height the field's ground would be levelled to: the mean of the ground under it, to 0.25 m. */
export function fieldPad(t: Pick<Terrain, 'heightAt'>, x: number, z: number): number {
  let sum = 0, n = 0;
  for (let u = -FIELD.half; u <= FIELD.half; u += 2) for (let v = -FIELD.half; v <= FIELD.half; v += 2) { sum += t.heightAt(x + u, z + v); n++; }
  return Math.round(sum / n * 4) / 4;
}
/** The field as a terrain claim (gen/claims.ts): levelled within `flat`, blended back over `blend`. */
export const fieldClaim = (f: FieldSpot): Claim => ({ x: f.x, z: f.z, y: f.y, flat: FIELD.flat, blend: FIELD.blend });
/** Every placed field of every village (the terrain levels them all, on every player's game alike). */
export function fieldClaims(towns: Record<string, TownState | undefined>): Claim[] {
  const out: Claim[] = [];
  for (const s of Object.values(towns)) for (const f of Object.values(s?.fplots ?? {})) if (f) out.push(fieldClaim(f));
  return out;
}

/**
 * Why a field cannot go at (x, z) for this village ('' = it can). `claims` = the other levelled ground standing (player
 * bases and every placed field); `t` gives the natural ground (heights before this field) and what lies there.
 */
export function fieldProblem(t: Terrain, poi: Poi, seed: number, s: TownState | undefined, x: number, z: number, claims: Claim[]): string {
  if (worldDist(poi.x, poi.z, x, z) > FIELD.reach) return `Too far from ${poi.name}: a field goes within ${FIELD.reach} m of the village.`;
  const r = FIELD.half;
  for (const zn of reservedZones(t.world, poi, seed, s)) if (rectGap(zn, x, z) < r + 2) return zn.why + '.';
  for (const c of claims) if (claimDist(c, x, z) < clearOf(c) + r) return 'Too close to another field or a base: their ground is levelled already.';
  for (const p of poisNear(t.world, x, z, 200)) if (p.type !== 'village' && rectGap(p.rect, wrapDx(x - p.x) + p.x, z) < r + p.flat + p.blend + 6) return 'Too close to ' + p.name + '.';
  for (const p of poisNear(t.world, x, z, 200)) if (p.type === 'village' && p.id !== poi.id && rectGap(p.rect, wrapDx(x - p.x) + p.x, z) < 120) return 'That is the land of ' + p.name + '.';
  const reach = FIELD.flat + FIELD.blend, f = t.featuresIn({ x0: x - reach, z0: z - reach, x1: x + reach, z1: z + reach });
  for (const road of f.roads) if (nearestOnRoad(road, x, z)[0] < road.half + r + 4) return road.h ? 'A trail runs there.' : 'A road runs there: keep the field off it.';
  if (f.megaliths.length || f.gates.length) return 'The old stones there are not to be ploughed.';
  for (let u = -r - 2; u <= r + 2; u += 2) for (let v = -r - 2; v <= r + 2; v += 2) if (t.water(x + u, z + v)) return 'There is water there.';
  const y = fieldPad(t, x, z);
  for (let u = -r; u <= r; u += 2) for (let v = -r; v <= r; v += 2) if (Math.abs(t.heightAt(x + u, z + v) - y) > FIELD.maxCut) return 'Too steep: the ground there cannot be levelled for a field.';
  return '';
}

/** Farm i's field (world; x as placed, shift it with nearX): its staked spot, or the old corner of the wall. */
export function farmField(poi: Pick<Poi, 'x' | 'z'>, seed: number, s: TownState | undefined, i: number): { x0: number; z0: number; x1: number; z1: number } {
  const f = s?.fplots?.[i];
  if (f) return { x0: f.x - FIELD.half, z0: f.z - FIELD.half, x1: f.x + FIELD.half, z1: f.z + FIELD.half };
  const p = farmPlot(seed, i), ox = poi.x + VILLAGE_OFFSET.x, oz = poi.z + VILLAGE_OFFSET.z;
  return { x0: ox + p.x0, z0: oz + p.z0, x1: ox + p.x1, z1: oz + p.z1 };
}
