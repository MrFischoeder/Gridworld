// A small, guaranteed-separated set of mainland masses on the wrapping planet. Pure seeded geography.
import { hash } from '../core/rng';
import { WORLD_W, POLAR_Z, wrapDx, wrapX } from './regions';
export interface Continent { i: number; x: number; z: number; rx: number; rz: number; phase: number }
const cache = new Map<number, Continent[]>();
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
  const edge = 1 + 0.045 * Math.sin(3 * angle + c.phase) + 0.025 * Math.sin(5 * angle - c.phase);
  return Math.hypot(u, v) / edge;
}
/** The nearest mainland, useful for assigning cities; dry/coastal classification remains in seaMask. */
export function nearestContinent(world: number, x: number, z: number): Continent {
  return continents(world).reduce((best, c) => continentDistance(c, x, z) < continentDistance(best, x, z) ? c : best);
}
