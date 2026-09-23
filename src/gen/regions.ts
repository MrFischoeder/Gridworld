// World overview map: the world is split into 256 m regions. Each region decides its own
// features from hash(world, rx, rz): points of interest (villages, ruins), forest density, terrain roughness.
// New kinds of places are added as new PoiType values plus a placement rule here.
import { hash, rng, rangeInt, DIRV, type Dir } from '../core/rng';

export const REGION = 256, CHUNK = 32;

// ---------- the planet ----------
// The world wraps round east-west: 470 regions (~120 km) and you are back where you started. North and south it
// ends at the poles: ice caps, then an impassable ice wall. Generators work in canonical coordinates (regions
// R0..R0+NR-1) and shift what they return to the copy of the world the caller asked about, so a place just across
// the seam has the same id (and save keys) as its canonical self.
export const NR = 470, WORLD_W = NR * REGION;
const R0 = -(NR >> 1), C0 = R0 * (REGION / CHUNK) - (REGION / CHUNK) / 2;
/** Western edge of the canonical strip of the world (x in [X_MIN, X_MIN + WORLD_W)). */
export const X_MIN = R0 * REGION - REGION / 2;
const mod = (a: number, n: number) => ((a % n) + n) % n;
/** Canonical region column. */
export const wrapR = (rx: number) => mod(rx - R0, NR) + R0;
/** Canonical chunk column. */
export const wrapC = (cx: number) => mod(cx - C0, NR * (REGION / CHUNK)) + C0;
/** Canonical x. */
export const wrapX = (x: number) => mod(x - X_MIN, WORLD_W) + X_MIN;
/** Shortest east-west offset (the world is round). */
export const wrapDx = (dx: number) => dx - Math.round(dx / WORLD_W) * WORLD_W;
/** The copy of x nearest to `ref`. */
export const nearX = (x: number, ref: number) => ref + wrapDx(x - ref);
/** Distance on the planet's surface (east-west wraps). */
export const worldDist = (ax: number, az: number, bx: number, bz: number) => Math.hypot(wrapDx(bx - ax), bz - az);

/** Poles: ice from POLAR_Z (no places, no forests), the ice wall at POLE_Z. */
export const POLE_Z = 117 * REGION + REGION / 2, POLAR_Z = 25000;
/** Latitude in radians (0 at Gridholm's equator, ±PI/2 at the poles). */
export const latitude = (z: number) => Math.max(-1, Math.min(1, -z / POLE_Z)) * Math.PI / 2;
const polarRegion = (rz: number) => Math.abs(rz * REGION) + REGION / 2 > POLAR_Z;

export type PoiType = 'village' | 'ruin' | 'camp';
export interface Rect { x0: number; z0: number; x1: number; z1: number }
export interface Poi {
  type: PoiType;
  /** Stable id: packed region coordinates + index. Used in dungeon seeds and save keys. */
  id: number;
  name: string;
  /** Centre of the place. */
  x: number; z: number;
  /** Voxel-owned footprint (even-aligned): the terrain is replaced by the structure's own floor here. */
  rect: Rect;
  /** Extra perfectly flat margin around the rect, then a blend distance back to natural terrain. */
  flat: number; blend: number;
}
export interface RegionInfo { rx: number; rz: number; pois: Poi[]; forest: number; rough: number }

/** Region (rx, rz) spans [rx*256-128, rx*256+128) on both axes, so region (0,0) is centred on the origin. */
export const regionOf = (x: number, z: number): [number, number] => [Math.floor((x + REGION / 2) / REGION), Math.floor((z + REGION / 2) / REGION)];

export const packId = (rx: number, rz: number, i: number) => ((rx & 0x7fff) << 17) | ((rz & 0x7fff) << 2) | (i & 3);

const SYL_A = ['Kar', 'Vel', 'Mor', 'Dun', 'Ith', 'Zar', 'Ost', 'Bel', 'Quor', 'Nym', 'Tor', 'Rha', 'Sel', 'Gorm', 'Ael', 'Vorn'];
const SYL_B = ['os', 'ane', 'ith', 'um', 'ar', 'eth', 'ix', 'ora', 'ag', 'und', 'el', 'is'];
export function ruinName(R: () => number): string {
  const ri = rangeInt(R);
  return SYL_A[ri(0, SYL_A.length - 1)] + SYL_B[ri(0, SYL_B.length - 1)];
}

const even = (v: number) => 2 * Math.round(v / 2);

// ---------- villages ----------
/** Gridholm, the starting village at the origin. */
export const GRIDHOLM_ID = packId(0, 0, 0);
/** The planet is cut into cells of VCELL x VCELL regions (~2.5 km); many cells hold one village somewhere inside. */
const VCELL = 10, VILLAGE_CHANCE = 0.6;
const V_A = ['Ost', 'Brenn', 'Kal', 'Hollow', 'Mirr', 'Stone', 'Ash', 'Wend', 'Rook', 'Tarn', 'Elm', 'Kest', 'Vard', 'Lorn', 'Dusk', 'Irons', 'Fell', 'Gale'];
const V_B = ['wick', 'ford', 'mere', 'holm', 'stead', 'gate', 'moor', 'dale', 'haven', 'reach', 'watch', 'barrow', 'field', 'crest'];
/** Where the village of cell (gx, gz) stands (region coordinates), or null. Gridholm's cell holds only Gridholm. */
function villageOfCell(world: number, gx: number, gz: number): [number, number] | null {
  const R = rng(hash(world, gx, gz, 0x7111)), ri = rangeInt(R);
  if (R() > VILLAGE_CHANCE) return null;
  const rx = R0 + gx * VCELL + ri(2, VCELL - 3), rz = gz * VCELL - (VCELL >> 1) + ri(2, VCELL - 3);
  if (polarRegion(rz) || polarRegion(rz + Math.sign(rz))) return null;
  if (Math.max(Math.abs(wrapR(rx)), Math.abs(rz)) < 6) return null; // keep the start region to Gridholm
  return [rx, rz];
}
/** Is region (rx, rz) (canonical) the site of a village other than Gridholm? */
function isVillageRegion(world: number, rx: number, rz: number): boolean {
  const gx = Math.floor((rx - R0) / VCELL), gz = Math.floor((rz + (VCELL >> 1)) / VCELL), v = villageOfCell(world, gx, gz);
  return !!v && v[0] === rx && v[1] === rz;
}
/** Village layouts and gates come from this seed (Gridholm keeps the world seed it always had). */
export const villageSeed = (world: number, p: Poi) => (p.id === GRIDHOLM_ID ? world : hash(world, p.id, 0x71a9e));
const villageAt = (rx: number, rz: number, name: string): Poi => {
  const x = rx * REGION, z = rz * REGION;
  return { type: 'village', id: packId(rx, rz, 0), name, x, z, rect: { x0: VILLAGE_RECT.x0 + x, z0: VILLAGE_RECT.z0 + z, x1: VILLAGE_RECT.x1 + x, z1: VILLAGE_RECT.z1 + z }, flat: 8, blend: 34 };
};
const villageCache = new Map<number, Poi[]>();
/** Every village on the planet (canonical coordinates), Gridholm first. */
export function allVillages(world: number): Poi[] {
  let v = villageCache.get(world);
  if (!v) {
    v = [];
    for (let gx = 0; gx < NR / VCELL; gx++) for (let gz = -12; gz <= 12; gz++) {
      const c = villageOfCell(world, gx, gz);
      if (c) v.push(...regionInfo(world, c[0], c[1]).pois.filter((p) => p.type === 'village'));
    }
    v.unshift(regionInfo(world, 0, 0).pois[0]);
    villageCache.set(world, v);
  }
  return v;
}
const rectD = (r: Rect, x: number, z: number) => Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.z0 - z, 0, z - r.z1));
/** The village whose walls (footprint) contain (x, z), if any. */
export const villageContaining = (world: number, x: number, z: number): Poi | undefined =>
  poisNear(world, x, z, 50).find((p) => p.type === 'village' && rectD(p.rect, x, z) === 0 && x < p.rect.x1 && z < p.rect.z1);
/** Distance from (x, z) to the nearest village footprint (Infinity when none within r). */
export function villageDist(world: number, x: number, z: number, r = 120): number {
  let d = Infinity;
  for (const p of poisNear(world, x, z, r)) if (p.type === 'village') d = Math.min(d, rectD(p.rect, x, z));
  return d;
}
/** Ruins are alien temples on a 40 m square (see gen/ruins.ts). */
export const RUIN_SIZE = 40;
export const VILLAGE_RECT: Rect = { x0: -38, z0: -38, x1: 38, z1: 38 };

function ruinAt(rx: number, rz: number, i: number, x: number, z: number, R: () => number): Poi {
  const x0 = even(x - RUIN_SIZE / 2), z0 = even(z - RUIN_SIZE / 2);
  return {
    type: 'ruin', id: packId(rx, rz, i), name: 'Ruins of ' + ruinName(R),
    x: x0 + RUIN_SIZE / 2, z: z0 + RUIN_SIZE / 2, rect: { x0, z0, x1: x0 + RUIN_SIZE, z1: z0 + RUIN_SIZE }, flat: 4, blend: 26,
  };
}

export const CAMP_SIZE = 20;
const CAMP_NAMES = ['Rustjaw', 'Ashpit', 'Blackfang', 'Coilbreak', 'Gallows', 'Scrapper', 'Redline', 'Hollow Tooth'];
function campAt(rx: number, rz: number, x: number, z: number, R: () => number): Poi {
  const x0 = even(x - CAMP_SIZE / 2), z0 = even(z - CAMP_SIZE / 2);
  return {
    type: 'camp', id: packId(rx, rz, 2), name: CAMP_NAMES[Math.floor(R() * CAMP_NAMES.length)] + ' Camp',
    x: x0 + CAMP_SIZE / 2, z: z0 + CAMP_SIZE / 2, rect: { x0, z0, x1: x0 + CAMP_SIZE, z1: z0 + CAMP_SIZE }, flat: 4, blend: 18, // flat margin even: the terrain lattice is 2 m
  };
}

/** A region's data moved east or west by dx metres (a copy of a canonical region across the seam). */
function shifted(r: RegionInfo, rx: number, dx: number): RegionInfo {
  return { ...r, rx, pois: r.pois.map((p) => ({ ...p, x: p.x + dx, rect: { x0: p.rect.x0 + dx, z0: p.rect.z0, x1: p.rect.x1 + dx, z1: p.rect.z1 } })) };
}
const baseCache = new Map<string, RegionInfo>(), cache = new Map<string, RegionInfo>();
/** Village and ruins of a region (camps are added on top, see regionInfo). */
function baseInfo(world: number, rx: number, rz: number): RegionInfo {
  const c = wrapR(rx);
  if (c !== rx) return shifted(baseInfo(world, c, rz), rx, (rx - c) * REGION);
  const key = world + ':' + rx + ':' + rz;
  let r = baseCache.get(key);
  if (r) return r;
  if (baseCache.size > 4096) baseCache.clear();
  const R = rng(hash(world, rx, rz, 0x7e61)), ri = rangeInt(R);
  const forest = R(), rough = R();
  const pois: Poi[] = [];
  const cx = rx * REGION, cz = rz * REGION;
  if (polarRegion(rz)) { /* nothing lives on the ice */ }
  else if (rx === 0 && rz === 0) {
    pois.push({ type: 'village', id: packId(0, 0, 0), name: 'Gridholm', x: 0, z: 0, rect: { ...VILLAGE_RECT }, flat: 8, blend: 34 });
  } else if (isVillageRegion(world, rx, rz)) {
    const Rv = rng(hash(world, rx, rz, 0x7a3e));
    pois.push(villageAt(rx, rz, V_A[Math.floor(Rv() * V_A.length)] + V_B[Math.floor(Rv() * V_B.length)]));
  } else if (Math.abs(rx) + Math.abs(rz) === 1) {
    // The four regions next to the start: three of them always hold ruins within ~300 m of the village.
    const dirs: Dir[] = ['N', 'E', 'S', 'W'];
    const skip = dirs[hash(world, 0x5c1) % 4];
    const dir = dirs.find((d) => DIRV[d][0] === rx && DIRV[d][1] === rz)!;
    if (dir !== skip || R() < 0.35) {
      const dist = ri(150, 250), lat = ri(-60, 60), o = DIRV[dir];
      pois.push(ruinAt(rx, rz, 1, o[0] * dist + (o[0] ? 0 : lat), o[1] * dist + (o[1] ? 0 : lat), R));
    }
  } else if (R() < (Math.abs(rx) <= 1 && Math.abs(rz) <= 1 ? 0.4 : 0.5)) {
    pois.push(ruinAt(rx, rz, 1, cx + ri(-80, 80), cz + ri(-80, 80), R));
  }
  r = { rx, rz, pois, forest, rough };
  baseCache.set(key, r);
  return r;
}

/** Everything in a region: its village and ruins, plus maybe a bandit camp. */
export function regionInfo(world: number, rx: number, rz: number): RegionInfo {
  const c = wrapR(rx);
  if (c !== rx) return shifted(regionInfo(world, c, rz), rx, (rx - c) * REGION);
  const key = world + ':' + rx + ':' + rz;
  let r = cache.get(key);
  if (r) return r;
  if (cache.size > 4096) cache.clear();
  const base = baseInfo(world, rx, rz), pois = [...base.pois];
  // Bandit camps: not in the start region nor right by the village, near the middle of their region (so camps
  // never crowd each other), and clear of every ruin around so their flat ground does not overlap.
  const Rc = rng(hash(world, rx, rz, 0xca4b)), cx = rx * REGION, cz = rz * REGION;
  if (!(rx === 0 && rz === 0) && !polarRegion(rz) && Rc() < (Math.abs(rx) + Math.abs(rz) <= 1 ? 0.25 : 0.4)) {
    const around: Poi[] = [];
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) around.push(...baseInfo(world, rx + i, rz + j).pois);
    for (let t = 0; t < 6; t++) {
      const x = cx + (Rc() - 0.5) * 140, z = cz + (Rc() - 0.5) * 140;
      if (worldDist(x, z, 0, 0) < 230) continue;
      if (around.some((p) => Math.hypot(p.x - x, p.z - z) < (p.type === 'village' ? 260 : 130))) continue;
      pois.push(campAt(rx, rz, x, z, Rc)); break;
    }
  }
  r = { ...base, pois };
  cache.set(key, r);
  return r;
}

/** All POIs in regions overlapping the square [x-r, x+r] x [z-r, z+r]. */
export function poisNear(world: number, x: number, z: number, r: number): Poi[] {
  const [ax, az] = regionOf(x - r, z - r), [bx, bz] = regionOf(x + r, z + r), out: Poi[] = [];
  for (let rx = ax; rx <= bx; rx++) for (let rz = az; rz <= bz; rz++) out.push(...regionInfo(world, rx, rz).pois);
  return out;
}
export const findPoi = (world: number, id: number): Poi | undefined => {
  const rx = (id << 0) >> 17, rz = ((id << 15) >> 17);
  return regionInfo(world, rx, rz).pois.find((p) => p.id === id);
};
