// (0.222, the owner's request) Crystal forests: here and there on the planet the ground breaks into a grove of giant
// crystals, great six-sided columns many times a man's height leaning out of a common root, clusters of smaller
// ones round them and shards underfoot, the tallest at the heart. For now they are only scenery (solid, they light
// the night a little); nothing is taken from them.
//
// Pure and deterministic from the world seed, like the deposits (gen/lodes.ts): at most one field per 256 m region
// (`regionCrystals`, cached per canonical region and shifted to the copy of the planet asked for), read from the
// natural land, the sea mask, the places, the roads and the rivers, so the trees, rocks and plants can ask
// `inCrystals` to keep their ground clear. The crystals of a field (`fieldCrystals`) are field-local.
import { hash, rng } from '../core/rng';
import { REGION, POLAR_Z, wrapR, regionOf, worldDist, wrapDx, poisNear, villageDist, type Rect } from './regions';
import { seaMask } from './seas';
import { naturalHeight } from './heights';
import { nearRiver } from './rivers';
import { inCity } from './cities';
import { regionRoads, nearestOnRoad } from './roads';
import { regionLakes } from './water';
import { inFogSite } from './toxic';
import { inLode } from './lodes';
import { megalithsNear } from './megaliths';
import { gatesNear } from './worldgates';
import { biomeAt } from './biomes';

/** Field colours: [line, the inner facets]. */
export const CRYSTAL_HUES: [number, number][] = [[0x7ae8ff, 0x3a8ab8], [0xc09cff, 0x6a4ab0], [0x9dffd0, 0x3aa878], [0xff9ce0, 0xa04a8a], [0xe8f8ff, 0x7898b0], [0xb6ff3a, 0x5a9a20]];
export const CRYSTALS = {
  /** The share of regions holding a field, none within `from` m of Gridholm. */
  chance: 0.03, from: 1800,
  /** (0.232) The share in the Crystal Wastes biome. */
  wastes: 0.6,
  /** The field's radius (m). */
  r: [34, 90] as [number, number],
  /** Villages keep this far (m), other places this far from the edge, roads and rivers this far. */
  village: 450, place: 25, road: 10, river: 14,
  /** Trees, rocks and plants keep this far inside the edge (the outskirts have a few trees among the shards). */
  clear: -6,
};
export interface CrystalField { id: string; x: number; z: number; r: number; hue: number; seed: number; name: string }
/** One crystal, field-local: the root (dx, dz), the direction it grows (unit), its length, radius and turn. */
export interface Crystal { dx: number; dz: number; d: [number, number, number]; len: number; w: number; rot: number; sides: number }

const rectDist = (r: Rect, x: number, z: number) => Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.z0 - z, 0, z - r.z1));
function misfit(world: number, x: number, z: number, r: number): string {
  if (Math.abs(z) > POLAR_Z - 1000) return 'ice';
  if (seaMask(world, x, z) > 0 || [0, 1.57, 3.14, 4.71].some((a) => seaMask(world, x + Math.cos(a) * (r + 20), z + Math.sin(a) * (r + 20)) > 0)) return 'sea';
  if (nearRiver(world, x, z, r + CRYSTALS.river)) return 'river';
  if (villageDist(world, x, z, CRYSTALS.village + 60) < CRYSTALS.village) return 'village';
  if (inCity(world, x, z, r + 120)) return 'city';
  if (poisNear(world, x, z, r + CRYSTALS.place + 40).some((p) => rectDist(p.rect, x, z) < r + CRYSTALS.place)) return 'place';
  if (inFogSite(world, x, z, r + 30)) return 'fog';
  if (inLode(world, x, z, r + 20)) return 'lode';
  if (megalithsNear(world, x, z, r + 40).length || gatesNear(world, x, z, r + 60).length) return 'landmark';
  const [rx, rz] = regionOf(x, z), t = { world, base: (a: number, b: number) => naturalHeight(world, a, b) };
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    for (const l of regionLakes(t, rx + i, rz + j)) if (worldDist(l.x, l.z, x, z) < l.r * 1.6 + r + 12) return 'lake';
    for (const rd of regionRoads(world, rx + i, rz + j)) if (nearestOnRoad(rd, x, z)[0] < r + CRYSTALS.road) return 'road';
  }
  return '';
}
const NAMES_A = ['Glass', 'Singing', 'Shattered', 'Pale', 'Burning', 'Silent', 'Hollow', 'Prism', 'Frozen', 'Ghost', 'Shining', 'Thorn'];
const NAMES_B = ['Spires', 'Grove', 'Thicket', 'Garden', 'Forest', 'Teeth', 'Choir', 'Field', 'Halls', 'Crown'];
const cache = new Map<string, CrystalField | null>();
/** The crystal field of region (rx, rz), or null. */
export function regionCrystals(world: number, rx: number, rz: number): CrystalField | null {
  const c = wrapR(rx);
  if (c !== rx) { const f = regionCrystals(world, c, rz); return f && { ...f, x: f.x + (rx - c) * REGION }; }
  const key = world + ':' + rx + ':' + rz;
  let f = cache.get(key);
  if (f !== undefined) return f;
  if (cache.size > 20000) cache.clear();
  f = rollField(world, rx, rz);
  cache.set(key, f);
  return f;
}
function rollField(world: number, rx: number, rz: number): CrystalField | null {
  const R = rng(hash(world, rx, rz, 0xc7a1)), x = rx * REGION + (R() - 0.5) * REGION * 0.5, z = rz * REGION + (R() - 0.5) * REGION * 0.5;
  const roll = R(); // (0.232) the crystal wastes are thick with fields
  if (Math.hypot(wrapDx(x), z) < CRYSTALS.from || roll > CRYSTALS.chance && (roll > CRYSTALS.wastes || biomeAt(world, x, z) !== 'crystal')) return null;
  const [a, b] = CRYSTALS.r, r = a + (b - a) * R();
  if (misfit(world, x, z, r)) return null;
  const seed = hash(world, rx, rz, 0xc7a2);
  return {
    id: `crystals:${rx}:${rz}`, x, z, r, seed, hue: hash(seed, 0xc7a3) % CRYSTAL_HUES.length,
    name: `${NAMES_A[hash(seed, 0xc7a4) % NAMES_A.length]} ${NAMES_B[hash(seed, 0xc7a5) % NAMES_B.length]}`,
  };
}
/** The fields whose ground may reach within `m` of (x, z). */
export function crystalFieldsNear(world: number, x: number, z: number, m = 0): CrystalField[] {
  const out: CrystalField[] = [], n = Math.ceil((CRYSTALS.r[1] + m) / REGION), [rx, rz] = regionOf(x, z);
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
    const f = regionCrystals(world, rx + i, rz + j);
    if (f && worldDist(f.x, f.z, x, z) < f.r + m) out.push(f);
  }
  return out;
}
/** Is (x, z) on a crystal field's ground (its radius less `CRYSTALS.clear`, plus m)? Trees, rocks and plants keep off. */
export const inCrystals = (world: number, x: number, z: number, m = 0) => crystalFieldsNear(world, x, z, m + CRYSTALS.clear).length > 0;

const cryCache = new Map<string, Crystal[]>();
/**
 * The crystals of a field, field-local. Clusters spread over the field by dart throwing, bigger towards the heart
 * (where one or two titans of 25-38 m stand); each cluster is a main column (upright or leaning a little) and a fan
 * of smaller ones leaning out from the same root; shards and low clusters fill the ground between.
 */
export function fieldCrystals(f: CrystalField): Crystal[] {
  let out = cryCache.get(f.id);
  if (out) return out;
  out = [];
  const R = rng(f.seed ^ 0x51ab), push = (dx: number, dz: number, a: number, tilt: number, len: number, w: number) => {
    out!.push({ dx, dz, d: [Math.cos(a) * Math.sin(tilt), Math.cos(tilt), Math.sin(a) * Math.sin(tilt)], len, w, rot: R() * 6.283, sides: R() < 0.8 ? 6 : 5 });
  };
  const centres: [number, number, number][] = [];
  // the heart: one or two titans
  const titans = 1 + (R() < 0.45 ? 1 : 0);
  for (let i = 0; i < titans; i++) centres.push([(R() - 0.5) * f.r * 0.3, (R() - 0.5) * f.r * 0.3, 1]);
  const want = Math.round(f.r * f.r / 160);
  for (let tries = 0; centres.length < want + titans && tries < want * 12; tries++) {
    const a = R() * 6.283, d = Math.sqrt(R()) * f.r * 0.92, x = Math.cos(a) * d, z = Math.sin(a) * d;
    const big = 1 - d / f.r, gap = 3 + big * 6;
    if (centres.some(([cx, cz]) => Math.hypot(cx - x, cz - z) < gap)) continue;
    centres.push([x, z, big * big * 0.8 + R() * 0.25]);
  }
  centres.forEach(([cx, cz, big], i) => {
    const titan = i < titans, main = titan ? 25 + R() * 13 : 2.5 + big * 18 + R() * 4;
    const ma = R() * 6.283, mt = titan ? R() * 0.12 : R() * 0.32;
    push(cx, cz, ma, mt, main, main * (titan ? 0.085 : 0.1 + R() * 0.04));
    const n = (titan ? 5 : 2) + ((R() * (titan ? 4 : 4)) | 0);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * 6.283 + R() * 0.6, tilt = 0.3 + R() * 0.6, len = main * (0.25 + R() * 0.45), off = main * 0.05;
      push(cx + Math.cos(a) * off, cz + Math.sin(a) * off, a, tilt, len, len * (0.1 + R() * 0.05));
    }
  });
  // shards underfoot
  const shards = Math.round(f.r * 1.4);
  for (let k = 0; k < shards; k++) {
    const a = R() * 6.283, d = Math.sqrt(R()) * f.r, len = 0.4 + R() * 1.8;
    push(Math.cos(a) * d, Math.sin(a) * d, R() * 6.283, R() * 0.9, len, len * (0.12 + R() * 0.06));
  }
  if (cryCache.size > 64) cryCache.clear();
  cryCache.set(f.id, out);
  return out;
}
/** Crystals tall enough to stop a body (shards are stepped over). */
export const CRYSTAL_SOLID = 1.6;
