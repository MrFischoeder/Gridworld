// Standing water: lakes and ponds carved into the terrain, and wells out in the wilds. Pure and deterministic.
// A lake is a still surface at one level over a bowl dug into the land; its kind says what the water is like:
//   fresh  clean, safe to drink
//   murky  swampy valley water: drinkable at a pinch, may turn your stomach
//   toxic  poisoned by the old machines around ruins: hurts to wade in, never drink it
// Rivers and streams will come later. Everything else asks `Terrain.water(x, z)` what water is at a point.
import { rng, hash } from '../core/rng';
import { REGION, CHUNK, POLAR_Z, wrapR, poisNear, type Rect } from './regions';
import { regionRoads, nearestOnRoad } from './roads';
import type { Terrain } from './terrain';

export type WaterKind = 'fresh' | 'murky' | 'toxic';
export interface Lake {
  /** Stable id (packed region + index), for save keys later. */
  id: number;
  x: number; z: number;
  /** Mean radius of the shore; the shoreline wobbles around it (shoreR). */
  r: number;
  /** Water surface height and the deepest point below it. */
  level: number; depth: number;
  kind: WaterKind;
  /** Shore wobble phases. */
  p1: number; p2: number;
}
export interface Well { x: number; z: number }
export interface WaterHere { level: number; depth: number; kind: WaterKind }

/** How far past the mean radius the water can reach (the widest bulge of the shore). */
export const LAKE_REACH = 1.4;
/** Shore radius in the direction of angle a. */
export const shoreR = (l: Lake, a: number) => l.r * (1 + 0.22 * Math.sin(3 * a + l.p1) + 0.1 * Math.sin(5 * a + l.p2));
const rectD = (r: Rect, x: number, z: number) => Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.z0 - z, 0, z - r.z1));
const smooth = (t: number) => t * t * (3 - 2 * t);

/**
 * Height of the lake's bowl at (x, z), or null when the lake does not reach there. Inside the shore the ground
 * drops below the water level (deepest in the middle); a band outside it blends back to the natural land.
 */
export function lakeBed(l: Lake, x: number, z: number, natural: number): number | null {
  const dx = x - l.x, dz = z - l.z, d = Math.hypot(dx, dz);
  if (d > l.r * LAKE_REACH * 1.25) return null;
  const n = d / shoreR(l, Math.atan2(dz, dx));
  if (n < 1) return Math.min(natural, l.level - 0.25 - l.depth * (1 - n * n));
  // just past the shore the ground rises to a low lip above the water, then blends back into the land
  const lip = l.level + 0.2;
  if (n < 1.08) return l.level - 0.25 + (lip - l.level + 0.25) * smooth((n - 1) / 0.08);
  if (n < 1.3) return lip + (Math.max(natural, lip) - lip) * smooth((n - 1.08) / 0.22);
  return null;
}

const nearRoad = (world: number, x: number, z: number, m: number) => {
  const [rx0, rz0] = [Math.floor((x + REGION / 2) / REGION), Math.floor((z + REGION / 2) / REGION)];
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) for (const r of regionRoads(world, rx0 + i, rz0 + j)) if (nearestOnRoad(r, x, z)[0] < r.half + m) return true;
  return false;
};

const lakeCache = new Map<string, Lake[]>();
/**
 * Lakes of a region: about a third of the regions have one, more often in low ground. They keep clear of places,
 * roads and the ice (frozen lakes can come later). Their level sits just below the lowest point of the rim, so
 * the water never spills over the land around it.
 */
export function regionLakes(t: Terrain, rx: number, rz: number): Lake[] {
  const c = wrapR(rx);
  if (c !== rx) return regionLakes(t, c, rz).map((l) => ({ ...l, x: l.x + (rx - c) * REGION }));
  const key = t.world + ':' + rx + ':' + rz;
  let out = lakeCache.get(key);
  if (out) return out;
  if (lakeCache.size > 4096) lakeCache.clear();
  out = [];
  const R = rng(hash(t.world, rx, rz, 0x1a4e)), roll = R();
  const x = rx * REGION + (R() - 0.5) * 150, z = rz * REGION + (R() - 0.5) * 150, r = 12 + R() * 26, p1 = R() * 6.283, p2 = R() * 6.283, kr = R();
  const low = t.base(x, z) < 9;
  if (roll < (low ? 0.55 : 0.28) && Math.abs(z) + r * 2 < POLAR_Z) {
    const pois = poisNear(t.world, x, z, r * 2 + 120);
    const clear = pois.every((p) => rectD(p.rect, x, z) > r * LAKE_REACH * 1.3 + p.flat + p.blend + 6) && !nearRoad(t.world, x, z, r * LAKE_REACH * 1.3 + 8);
    if (clear) {
      // the level: just under the lowest natural ground around the rim
      let rim = Infinity;
      for (let i = 0; i < 48; i++) { const a = i / 48 * 6.283, rr = r * 1.3 * (1 + 0.22 * Math.sin(3 * a + p1) + 0.1 * Math.sin(5 * a + p2)); rim = Math.min(rim, t.base(x + Math.cos(a) * rr, z + Math.sin(a) * rr)); }
      const ruin = pois.some((p) => p.type === 'ruin' && Math.hypot(p.x - x, p.z - z) < 260);
      const kind: 'fresh' | 'murky' | 'toxic' = ruin && kr < 0.7 ? 'toxic' : low || kr > 0.8 ? 'murky' : 'fresh';
      out.push({ id: hash(t.world, rx, rz, 0x1a4f), x, z, r, level: rim - 0.35, depth: 1.5 + r * 0.09, kind, p1, p2 });
    }
  }
  lakeCache.set(key, out);
  return out;
}
/** Lakes whose water may reach into the rect (for terrain features). */
export function lakesIn(t: Terrain, r: Rect): Lake[] {
  const out: Lake[] = [], m = 45 * LAKE_REACH * 1.25;
  const rx0 = Math.floor((r.x0 - m + REGION / 2) / REGION), rx1 = Math.floor((r.x1 + m + REGION / 2) / REGION);
  const rz0 = Math.floor((r.z0 - m + REGION / 2) / REGION), rz1 = Math.floor((r.z1 + m + REGION / 2) / REGION);
  for (let rx = rx0; rx <= rx1; rx++) for (let rz = rz0; rz <= rz1; rz++) for (const l of regionLakes(t, rx, rz)) {
    const reach = l.r * LAKE_REACH * 1.25;
    if (l.x + reach >= r.x0 && l.x - reach <= r.x1 && l.z + reach >= r.z0 && l.z - reach <= r.z1) out.push(l);
  }
  return out;
}

const wellCache = new Map<string, Well[]>();
/** Old wells out in the wilds: about one region in four has one, on dry ground away from places, roads and lakes. */
export function regionWells(t: Terrain, rx: number, rz: number): Well[] {
  const c = wrapR(rx);
  if (c !== rx) return regionWells(t, c, rz).map((w) => ({ ...w, x: w.x + (rx - c) * REGION }));
  const key = t.world + ':' + rx + ':' + rz;
  let out = wellCache.get(key);
  if (out) return out;
  if (wellCache.size > 4096) wellCache.clear();
  out = [];
  const R = rng(hash(t.world, rx, rz, 0x3e11));
  if (R() < 0.25 && Math.abs(rz * REGION) + REGION < POLAR_Z) {
    for (let i = 0; i < 4 && !out.length; i++) {
      const x = rx * REGION + (R() - 0.5) * 200, z = rz * REGION + (R() - 0.5) * 200;
      if (poisNear(t.world, x, z, 80).some((p) => rectD(p.rect, x, z) < p.flat + p.blend + 4)) continue;
      if (nearRoad(t.world, x, z, 6)) continue;
      if (lakesIn(t, { x0: x - 4, z0: z - 4, x1: x + 4, z1: z + 4 }).some((l) => Math.hypot(l.x - x, l.z - z) < l.r * LAKE_REACH * 1.3 + 6)) continue;
      out.push({ x: Math.round(x) + 0.5, z: Math.round(z) + 0.5 });
    }
  }
  wellCache.set(key, out);
  return out;
}
/** Wells whose centre lies in chunk (cx, cz). */
export function chunkWells(t: Terrain, cx: number, cz: number): Well[] {
  const rx = Math.floor((cx * CHUNK + CHUNK / 2 + REGION / 2) / REGION), rz = Math.floor((cz * CHUNK + CHUNK / 2 + REGION / 2) / REGION);
  const out: Well[] = [];
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const w of regionWells(t, rx + i, rz + j))
    if (Math.floor(w.x / CHUNK) === cx && Math.floor(w.z / CHUNK) === cz) out.push(w);
  return out;
}
