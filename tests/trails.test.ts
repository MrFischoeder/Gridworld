import { describe, it, expect } from 'vitest';
import { Terrain } from '../src/gen/terrain';
import { regionSummit, regionTrails, trailHeight, TRAIL } from '../src/gen/trails';
import { hash } from '../src/core/rng';

describe('mountain trails', () => {
  it('lead from the foot of a mountain to its summit at a walkable grade', () => {
    const w = hash(3, 7), t = new Terrain(w);
    let summits = 0, trails = 0, maxCut = 0, len = 0;
    for (let rx = -40; rx <= 40; rx++) for (let rz = -40; rz <= 40; rz += 1) {
      const s = regionSummit(t, rx, rz); if (!s) continue; summits++;
      const [r] = regionTrails(t, rx, rz); if (!r) continue; trails++;
      const h = r.h!, last = r.pts[r.pts.length - 1];
      expect(last).toEqual([s.x, s.z]);
      for (let i = 1; i < h.length; i++) {
        const d = Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]);
        expect(Math.abs(h[i] - h[i - 1]) / d).toBeLessThanOrEqual(TRAIL.grade + 1e-6);
        len += d; maxCut = Math.max(maxCut, Math.abs(h[i] - t.base(r.pts[i][0], r.pts[i][1])));
      }
      // the ground on the trail is the profile
      const [px, pz] = r.pts[Math.floor(r.pts.length / 2)];
      expect(t.exact(px, pz)).toBeCloseTo(trailHeight(r, px, pz)[1], 1);
    }
    console.log(`summits ${summits}, trails ${trails}, mean length ${(len / Math.max(1, trails)).toFixed(0)} m, deepest cut/fill ${maxCut.toFixed(1)} m`);
    expect(summits).toBeGreaterThan(3);
    expect(trails).toBeGreaterThan(10);
    expect(maxCut).toBeLessThanOrEqual(9 + 1e-6);
  });
});
