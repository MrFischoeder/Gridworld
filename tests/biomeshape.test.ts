import { describe, it, expect } from 'vitest';
import { naturalHeight, baseHeight } from '../src/gen/heights';
import { shapeWeights, swampWater } from '../src/gen/biomeshape';
import { shapedWorld, newWorldSeed } from '../src/gen/worldrules';
import { Terrain } from '../src/gen/terrain';

/** The first spot (on a coarse sweep) where a biome's shape takes hold fully. */
function find(world: number, k: 'swamp' | 'desert') {
  for (let r = 7000; r < 26000; r += 700) for (let a = 0; a < 6.28; a += 0.13) {
    const x = Math.cos(a) * r, z = Math.sin(a) * r * 0.85, h = baseHeight(world, x, z);
    if (shapeWeights(world, x, z, h)[k] > 0.95) return [x, z];
  }
  return null;
}
describe('biomes shape the land (0.233, B3)', () => {
  it('only new worlds are shaped; older seeds keep their land', () => {
    expect(shapedWorld(newWorldSeed())).toBe(true);
    for (const w of [12345, -42, -999_999, -1_500_000_000]) {
      expect(shapedWorld(w)).toBe(false);
      for (const [x, z] of [[9000, 4000], [-15000, 12000]]) expect(naturalHeight(w, x, z)).toBe(baseHeight(w, x, z));
    }
  });
  it('a swamp is full of shallow pools of murky water', () => {
    for (const W of [-5_000_001, -73_000_017]) {
      const at = find(W, 'swamp');
      expect(at, 'no swamp found').not.toBeNull();
      const t = new Terrain(W), [x0, z0] = at!;
      let wet = 0, n = 0, deepest = 0;
      for (let i = -20; i <= 20; i++) for (let j = -20; j <= 20; j++) {
        const x = x0 + i * 3, z = z0 + j * 3, h = baseHeight(W, x, z);
        if (shapeWeights(W, x, z, h).swamp < 0.95 || swampWater(W, x, z, h) === null) continue;
        n++; const w = t.water(x, z);
        if (w && w.kind === 'murky' && w.level === swampWater(W, x, z, h)) { wet++; deepest = Math.max(deepest, w.depth); }
      }
      console.log('swamp water share', (wet / n).toFixed(2), 'deepest', deepest.toFixed(2));
      expect(n).toBeGreaterThan(100);
      expect(wet / n).toBeGreaterThan(0.4); expect(wet / n).toBeLessThan(0.8);
      expect(deepest).toBeLessThan(1.1);
    }
  }, 60000);
  it('a desert rises into dunes', () => {
    const W = -5_000_001, at = find(W, 'desert');
    expect(at).not.toBeNull();
    let lo = Infinity, hi = -Infinity;
    for (let s = 0; s < 200; s += 4) { const d = naturalHeight(W, at![0] + s, at![1] + s) - baseHeight(W, at![0] + s, at![1] + s); lo = Math.min(lo, d); hi = Math.max(hi, d); }
    expect(hi - lo).toBeGreaterThan(2);
  }, 60000);
});
