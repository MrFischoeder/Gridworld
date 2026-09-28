import { describe, it, expect } from 'vitest';
import { Terrain } from '../src/gen/terrain';
import { landingSite, inScar, misfit, LANDING } from '../src/gen/landing';
import { chunkTrees, chunkRocks } from '../src/gen/trees';
import { CHUNK } from '../src/gen/regions';

describe('landing site', () => {
  it('is deterministic, a few hundred metres out, fits, and the scar is clear of trees and rocks', () => {
    for (const w of [1, 12345, 777, 4242, 99, 6, 7]) {
      const t = new Terrain(w), a = landingSite(t), b = landingSite(new Terrain(w));
      expect(a).toEqual(b);
      const d = Math.hypot(a.x, a.z);
      expect(d).toBeGreaterThanOrEqual(LANDING.near - 1); expect(d).toBeLessThanOrEqual(LANDING.far + 1);
      expect(misfit(t, a.x, a.z, a.yaw)).toBeNull();
      const cx = Math.floor(a.x / CHUNK), cz = Math.floor(a.z / CHUNK);
      for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
        for (const tr of chunkTrees(t, cx + i, cz + j)) expect(inScar(t, tr.x, tr.z, 8)).toBe(false);
        for (const k of chunkRocks(t, cx + i, cz + j)) expect(inScar(t, k.x, k.z, 7)).toBe(false);
      }
    }
  });
});
