import { describe, it, expect } from 'vitest';
import { Terrain } from '../src/gen/terrain';
import { installSites, installMisfit, inInstall, INSTALLS } from '../src/gen/installs';
import { chunkTrees } from '../src/gen/trees';
import { CHUNK } from '../src/gen/regions';

describe('great installations', () => {
  it('stand in fixed, fitting places in their band, on bare ground', () => {
    for (const w of [12345, 777, 1, 4242]) {
      const t = new Terrain(w), a = installSites(t);
      expect(a).toEqual(installSites(new Terrain(w)));
      expect(a.length).toBe(INSTALLS.length);
      for (const s of a) {
        const spec = INSTALLS.find((x) => x.k === s.k)!, d = Math.hypot(s.x, s.z);
        expect(d).toBeGreaterThanOrEqual(spec.band[0] - 1); expect(d).toBeLessThanOrEqual(spec.band[1] + 1);
        expect(installMisfit(t, s.x, s.z, s.r)).toBeNull();
        const cx = Math.floor(s.x / CHUNK), cz = Math.floor(s.z / CHUNK);
        for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) for (const tr of chunkTrees(t, cx + i, cz + j)) expect(inInstall(t, tr.x, tr.z)).toBe(false);
      }
    }
  });
});
