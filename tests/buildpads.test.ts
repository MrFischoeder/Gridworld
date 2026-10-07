import { describe, it, expect } from 'vitest';
import { allVillages, villageSeed } from '../src/gen/regions';
import { buildSites, sitePads } from '../src/gen/buildpads';
import { industryOf } from '../src/gen/industry';
import { Terrain } from '../src/gen/terrain';

const world = 12345;
describe('level building sites (0.172)', () => {
  it('lays every village building site flat at the village height', () => {
    const T = new Terrain(world, false), vs = allVillages(world).slice(0, 6);
    T.setSettlementPads(vs.flatMap((v) => sitePads(world, v, T.padY(v))));
    for (const v of vs) {
      const y = T.padY(v), seed = villageSeed(world, v), ox = v.x - 36, oz = v.z - 36;
      const rects = buildSites(seed, industryOf(world, v, seed));
      expect(rects.length).toBe(7);
      for (const r of rects) for (let u = 0; u <= 1; u += 0.25) for (let w = 0; w <= 1; w += 0.25) {
        const x = ox + r.x0 + (r.x1 - r.x0) * u, z = oz + r.z0 + (r.z1 - r.z0) * w;
        expect(T.heightAt(x, z)).toBeCloseTo(y, 3);
      }
    }
  });
});
