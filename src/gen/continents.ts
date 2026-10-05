// A small, guaranteed-separated set of mainland masses on the wrapping planet. Pure seeded geography.
import { hash } from '../core/rng';
import { valueNoise } from '../core/noise';
import { WORLD_W, POLAR_Z, wrapDx, wrapX } from './regions';
export interface Continent { i: number; x: number; z: number; rx: number; rz: number; phase: number }
const cache = new Map<number, Continent[]>();
const outlines = new WeakMap<Continent, Float64Array>();
const OUTLINE_SAMPLES = 1024;
/** Seeded bays and headlands, sampled once to keep terrain queries inexpensive.
 * Sampling noise on a circle makes the coastline continuous at the angular seam.
 * The bounded radius keeps broad sea lanes between neighbouring continents. */
export function continentEdge(c: Continent, angle: number): number {
  let outline = outlines.get(c);
  if (!outline) {
    outline = new Float64Array(OUTLINE_SAMPLES);
    const seed = hash(c.i, Math.round(c.phase * 1e6), 0xc076);
    for (let i = 0; i < OUTLINE_SAMPLES; i++) {
      const a = i * Math.PI * 2 / OUTLINE_SAMPLES, u = Math.cos(a), v = Math.sin(a);
      const broad = valueNoise(seed, 17 + u * 2.5, 31 + v * 2.5);
      const detail = valueNoise(seed + 1, 43 + u * 7, 59 + v * 7);
      const coves = valueNoise(seed + 2, 71 + u * 17, 89 + v * 17);
      const edge = 1.12 + 0.13 * Math.sin(3 * a + c.phase) + 0.08 * Math.sin(5 * a - c.phase)
        + 0.1 * (2 * broad - 1) + 0.065 * (2 * detail - 1) - 0.18 * Math.max(0, (coves - 0.42) / 0.58);
      // Allow long northern/southern headlands, but reserve at least 6 km of
      // deep ocean east/west even on a three-continent planet.
      const seaLaneLimit = 1 / Math.sqrt(u * u / (1.1 * 1.1) + v * v / (1.25 * 1.25));
      // Headlands must also leave a sea gap before the continuous polar ice.
      const polarLimit = (POLAR_Z - 4500 - Math.abs(c.z)) / (c.rz * Math.abs(v));
            // Keep the settled mainland core; coves cut into the new headlands
      // without removing the villages that supply progression materials.
      const inland = 1 + 0.045 * Math.sin(3 * a + c.phase) + 0.025 * Math.sin(5 * a - c.phase);
      outline[i] = Math.min(polarLimit, Math.max(inland, Math.min(seaLaneLimit, edge)));
    }
    outlines.set(c, outline);
  }
  const t = ((angle / (Math.PI * 2) % 1 + 1) % 1) * OUTLINE_SAMPLES, i = Math.floor(t), f = t - i;
  return outline[i] * (1 - f) + outline[(i + 1) % OUTLINE_SAMPLES] * f;
}
export function continents(world: number): Continent[] {
  const found = cache.get(world); if (found) return found;
  const count = 2 + hash(world, 0xc071) % 2, spacing = WORLD_W / count;
  const out = Array.from({ length: count }, (_, i) => {
    const h = (salt: number) => hash(world, i, salt) / 1e6;
    return { i, x: wrapX(i * spacing), z: i ? (h(0xc072) - 0.5) * POLAR_Z * 0.06 : 0,
      rx: spacing * (0.33 + h(0xc073) * 0.025), rz: POLAR_Z * (0.72 + h(0xc074) * 0.04), phase: h(0xc075) * Math.PI * 2 };
  });
  cache.set(world, out); return out;
}
export function continentDistance(c: Continent, x: number, z: number): number {
  const u = wrapDx(x - c.x) / c.rx, v = (z - c.z) / c.rz, angle = Math.atan2(v, u);
  return Math.hypot(u, v) / continentEdge(c, angle);
}
/** The nearest mainland, useful for assigning cities; dry/coastal classification remains in seaMask. */
export function nearestContinent(world: number, x: number, z: number): Continent {
  return continents(world).reduce((best, c) => continentDistance(c, x, z) < continentDistance(best, x, z) ? c : best);
}
