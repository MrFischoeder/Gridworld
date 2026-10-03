// Local boulder fields, separate from the old scattered-rock stream and its save keys.
import { hash, rng } from '../core/rng';
import { WORLD_W, wrapDx } from './regions';
export const BOULDER_CELL = 640;
export function boulderDensity(world: number, x: number, z: number): number {
  if (Math.hypot(wrapDx(x), z) < 1500 || Math.abs(z) > 23000) return 0;
  const n = WORLD_W / BOULDER_CELL;
  let best = 0;
  for (let i = Math.floor(x / BOULDER_CELL) - 1; i <= Math.floor(x / BOULDER_CELL) + 1; i++)
    for (let j = Math.floor(z / BOULDER_CELL) - 1; j <= Math.floor(z / BOULDER_CELL) + 1; j++) {
      const c = ((i % n) + n) % n, R = rng(hash(world, c, j, 0xb01d));
      if (R() > 0.3) continue;
      const px = (i + R()) * BOULDER_CELL, pz = (j + R()) * BOULDER_CELL, rx = 70 + R() * 60, rz = 60 + R() * 60;
      const d = Math.hypot((x - px) / rx, (z - pz) / rz);
      best = Math.max(best, Math.min(1, (1 - d) * 3));
    }
  return best;
}
