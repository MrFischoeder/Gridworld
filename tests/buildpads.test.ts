import { describe, it, expect } from 'vitest';
import { allVillages, villageSeed } from '../src/gen/regions';
import { buildSites, sitePads, SITE_PAD } from '../src/gen/buildpads';
import { industryOf } from '../src/gen/industry';
import { Terrain } from '../src/gen/terrain';
import type { TownState } from '../src/gen/town';

const world = 12345;
const fresh = (): TownState => ({ settlement: { v: 1 } } as TownState);
describe('ground under village buildings (0.181)', () => {
  it('levels nothing in advance round a new settlement', () => {
    for (const v of allVillages(world).slice(0, 6)) expect(sitePads(world, v, fresh())).toEqual([]);
  });
  it('eases the ground under a site once it is going up, keeping some relief and no cliffs', () => {
    const T = new Terrain(world, false), N = new Terrain(world, false);
    for (const v of allVillages(world).slice(0, 6)) {
      const s = fresh(); s.settlement!.given = { power: { scrap: 2 } };
      const pads = sitePads(world, v, s); expect(pads.length).toBe(1);
      T.setSettlementPads(pads);
      const r = pads[0].poi.rect, y = pads[0].y;
      let maxDev = 0, maxNat = 0;
      for (let u = 0; u <= 1; u += 0.25) for (let w = 0; w <= 1; w += 0.25) {
        const x = r.x0 + (r.x1 - r.x0) * u, z = r.z0 + (r.z1 - r.z0) * w;
        maxDev = Math.max(maxDev, Math.abs(T.exact(x, z) - y)); maxNat = Math.max(maxNat, Math.abs(N.exact(x, z) - y));
      }
      expect(maxDev).toBeLessThanOrEqual(maxNat * SITE_PAD.soft + 0.01); // the relief is softened, not erased
      // walking out across the blend: no step steeper than the natural land's worst plus a little
      for (let a = 0; a < 6.28; a += 0.8) for (let d = 0; d < 30; d += 2) {
        const cx = (r.x0 + r.x1) / 2 + Math.cos(a) * d, cz = (r.z0 + r.z1) / 2 + Math.sin(a) * d;
        const s1 = Math.abs(T.exact(cx + Math.cos(a) * 2, cz + Math.sin(a) * 2) - T.exact(cx, cz)) / 2;
        const s0 = Math.abs(N.exact(cx + Math.cos(a) * 2, cz + Math.sin(a) * 2) - N.exact(cx, cz)) / 2;
        expect(s1).toBeLessThan(Math.max(0.6, s0 + 0.35));
      }
    }
  });
  it('an old village keeps its plant, site and hall on eased ground', () => {
    const v = allVillages(world)[3], seed = villageSeed(world, v);
    expect(buildSites(seed, industryOf(world, v, seed), {}).length).toBeGreaterThanOrEqual(2);
  });
});
