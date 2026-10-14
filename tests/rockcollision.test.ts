import { describe, it, expect } from 'vitest';
import { rockShape, rockSurface, ringReach } from '../src/gen/rockshape';
import { footStep } from '../src/core/footstep';

describe('0.211.1: rocks are solid to their faces', () => {
  const r = 2, h = 1.8, s = rockShape(r, h, 7, 0.4);
  it('has a flat crown, faces falling to the foot and nothing beyond it', () => {
    expect(rockSurface(s, 0, 0)).toBeCloseTo(h);
    expect(rockSurface(s, 0.3, 0.2)).toBeCloseTo(h);
    for (let a = 0; a < 6.28; a += 0.3) {
      const top = ringReach(s[2], a), foot = Math.max(ringReach(s[0], a), ringReach(s[1], a));
      expect(top).toBeGreaterThan(0.6);
      expect(foot).toBeLessThanOrEqual(r * 1.2);
      let last = h + 1e-9;
      for (let d = 0; d < foot; d += 0.05) { const y = rockSurface(s, Math.cos(a) * d, Math.sin(a) * d); expect(y).toBeLessThanOrEqual(last + 1e-9); last = y; }
      expect(rockSurface(s, Math.cos(a) * (foot + 0.01), Math.sin(a) * (foot + 0.01))).toBe(-Infinity);
      // the old collision stopped at 0.55 r: most of the stone you could walk into
      expect(rockSurface(s, Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7)).toBeGreaterThan(h * 0.4);
    }
  });
});
describe('0.211.1: foes walk round what blocks them', () => {
  const tree = (x: number, z: number) => Math.hypot(x - 1, z) < 0.6;
  it('turns aside round a trunk straight ahead', () => {
    const to = footStep(0, 0, 0.5, 0, tree)!;
    expect(to).not.toBeNull();
    expect(tree(to[0], to[1])).toBe(false);
    expect(to[0]).toBeGreaterThan(0);
  });
  it('walks out of something it stands in, but not into forbidden ground', () => {
    expect(footStep(1, 0, 0.5, 0, tree, true)).toEqual([1.5, 0]);
    expect(footStep(1, 0, 0.5, 0, tree, true, () => true)).toBeNull();
  });
  it('stands still when boxed in', () => { expect(footStep(0, 0, 0.5, 0, () => true)).toBeNull(); });
});
