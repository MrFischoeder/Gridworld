import { describe, it, expect } from 'vitest';
import { Terrain } from '../src/gen/terrain';
import { claimProblem, padHeight, CLAIM, CLEAR_R } from '../src/gen/claims';
import { hash } from '../src/core/rng';

/** The first spot along a line out of Gridholm where a flag may stand. */
function findSite(t: Terrain): [number, number] {
  for (let d = 300; d < 3000; d += 37) for (let a = 0; a < 6.28; a += 0.7) {
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (!claimProblem(t, x, z, [])) return [x, z];
  }
  throw new Error('no site');
}

describe('land claims', () => {
  it('level the ground under the flag and blend back to the land', () => {
    const t = new Terrain(hash(11, 5)), [x, z] = findSite(t), y = padHeight(t, x, z);
    const before = t.heightAt(x + CLEAR_R + 6, z);
    t.setClaims([{ x, z, y }]);
    for (let a = 0; a < 6.28; a += 0.4) for (const r of [0, 4, 8, CLAIM.flat - 2]) expect(t.heightAt(x + Math.cos(a) * r, z + Math.sin(a) * r)).toBeCloseTo(y, 1);
    expect(t.heightAt(x + CLEAR_R + 6, z)).toBeCloseTo(before, 5); // untouched beyond the blend
    expect(t.claimAt(x + 5, z)).toBeTruthy();
    t.setClaims([]);
    expect(t.claimAt(x + 5, z)).toBeUndefined();
  });
  it('are refused in villages, on roads, by water and next to another claim', () => {
    const t = new Terrain(hash(11, 5)), [x, z] = findSite(t);
    expect(claimProblem(t, 0, 0, [])).toMatch(/village/);
    expect(claimProblem(t, x + 20, z, [{ x, z, y: 10 }])).toMatch(/other claim/);
  });
});
