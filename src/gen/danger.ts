// How dangerous the wilds are at a point (0 = safe .. 8). Pure: every spawner (creatures, robots, bandits,
// raiders) asks this. Right outside any village it is calm; it grows with the distance from the nearest village
// (villages are ~2.5 km apart, so the deep wilds between them are the worst), and the far side of the planet,
// away from Gridholm, is harsher still. Ruins add a little.
import { allVillages, worldDist, nearX } from './regions';

const rectD = (r: { x0: number; z0: number; x1: number; z1: number }, x: number, z: number) =>
  Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.z0 - z, 0, z - r.z1));

/** Distance (m) from the nearest village's walls. */
export function villageFar(world: number, x: number, z: number): number {
  let d = Infinity;
  for (const v of allVillages(world)) {
    if (worldDist(x, z, v.x, v.z) - 60 > d) continue;
    d = Math.min(d, rectD(v.rect, nearX(x, v.x), z));
  }
  return d;
}

/** Danger bands: the first metres past the gates are safe, then it climbs about 1 per 280 m. */
export const DANGER = { safe: 60, perM: 1 / 280, localMax: 5.5, farPerM: 1 / 4000, farMax: 2.5, ruin: 0.6, max: 8 };

const cache = new Map<string, number>();
/** Danger at (x, z); `nearRuin` adds the ruin bonus. Cached on a 16 m grid. */
export function dangerAt(world: number, x: number, z: number, nearRuin = false): number {
  const k = world + ':' + Math.round(x / 16) + ':' + Math.round(z / 16);
  let base = cache.get(k);
  if (base === undefined) {
    const local = Math.min(DANGER.localMax, Math.max(0, villageFar(world, x, z) - DANGER.safe) * DANGER.perM);
    const far = Math.min(DANGER.farMax, worldDist(x, z, 0, 0) * DANGER.farPerM);
    base = local * (1 + far * 0.2) + far * Math.min(1, local / 2);
    if (cache.size > 20000) cache.clear();
    cache.set(k, base);
  }
  return Math.min(DANGER.max, base + (nearRuin ? DANGER.ruin * Math.min(1, base) : 0));
}
