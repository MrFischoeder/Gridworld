import { describe, it, expect } from 'vitest';
import { groveTrees, plotsOf, RESOURCE_PLOTS, RESOURCE_YARD, GROVE_CLEAR, GROVE_REACH } from '../src/gen/resource-sites';
import { allVillages, poisNear, GRIDHOLM_ID } from '../src/gen/regions';

const gap = (r: { x0: number; z0: number; x1: number; z1: number }, x: number, z: number) => Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.z0 - z, 0, z - r.z1));
describe('(0.283.1) the yards and the great groves keep off the other places', () => {
  it('Gridholm\'s grove in world 12345 no longer stands in the Ruins of Hoshi Hall', () => {
    const lp = plotsOf(12345, GRIDHOLM_ID).lumber;
    expect(lp).not.toEqual(RESOURCE_PLOTS.lumber);
    expect(groveTrees(12345, GRIDHOLM_ID).length).toBe(9);
  });
  it('a yard moves only when it must, and then clear of every place; no giant stands on one', () => {
    let moved = 0, kept = 0;
    for (const world of [12345, -499177371, -7]) {
      for (const v of allVillages(world)) {
        const plots = plotsOf(world, v.id), places = poisNear(world, v.x, v.z, 330).filter((p) => p.id !== v.id);
        for (const [k, p] of Object.entries(plots)) {
          const same = p.x === RESOURCE_PLOTS[k as keyof typeof RESOURCE_PLOTS].x && p.z === RESOURCE_PLOTS[k as keyof typeof RESOURCE_PLOTS].z;
          if (same) kept++; else moved++;
          if (same) continue; // an unmoved yard found no better spot or never needed one
          const x = v.x - 36 + p.x, z = v.z - 36 + p.z, m = k === 'lumber' ? GROVE_REACH + 4 : 0;
          for (const q of places) expect(gap(q.rect, x, z)).toBeGreaterThan(Math.min(RESOURCE_YARD.halfX, RESOURCE_YARD.halfZ) + m);
        }
        const px = v.x - 36 + plots.lumber.x, pz = v.z - 36 + plots.lumber.z;
        for (const g of groveTrees(world, v.id)) for (const q of places) expect(gap(q.rect, px + g.u, pz + g.v)).toBeGreaterThanOrEqual(g.r * 2 + GROVE_CLEAR);
      }
    }
    expect(moved).toBeGreaterThan(0); expect(kept).toBeGreaterThan(moved * 5);
  });
});
