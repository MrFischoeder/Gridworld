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

describe('0.211.2: camp folk use the gates', async () => {
  const { generateCamp, campGates, campWay, inPoly } = await import('../src/gen/camps');
  const camps = [70, 71, 72, 73, 74, 75, 76, 77].map((id) => generateCamp(4242, { id, type: 'camp', name: 'Test', x: 0, z: 0, rect: { x0: -10, z0: -10, x1: 10, z1: 10 } } as never, 5));
  const walk = (c: (typeof camps)[0], x: number, z: number, tx: number, tz: number) => {
    const sx0 = x, sz0 = z;
    const solid = new Set(c.palisade.map((o) => o.x + ',' + o.z));
    for (let i = 0; i < 800; i++) {
      const w = campWay(c, x, z, tx, tz) ?? [tx, tz], dx = w[0] - x, dz = w[1] - z, L = Math.hypot(dx, dz);
      if (L < 0.2) break;
      x += dx / L * 0.2; z += dz / L * 0.2;
      if (solid.has(Math.floor(x) + ',' + Math.floor(z))) throw new Error('sides ' + c.ring.length + ' from ' + [sx0, sz0] + ' to ' + [tx, tz] + ' hit at ' + x.toFixed(2) + ',' + z.toFixed(2) + ' aim ' + JSON.stringify(w) + ' gates ' + JSON.stringify(campGates(c)));
    }
    return Math.hypot(tx - x, tz - z);
  };
  it('has 6 to 8 sides and two openings in the palisade', () => {
    expect(new Set(camps.map((c) => c.ring.length)).size).toBeGreaterThan(1);
    for (const c of camps) {
      const solid = new Set(c.palisade.map((o) => o.x + ',' + o.z)), g = campGates(c);
      expect(g.length).toBe(2);
      for (const [x, z] of g) expect(solid.has(Math.floor(x) + ',' + Math.floor(z))).toBe(false);
    }
  });
  it('leads out through a gate, in through a gate and round the outside, never through the palisade', () => {
    for (const c of camps) {
      for (const [tx, tz] of [[30, 2], [-25, -20], [5, 30], [-30, 0], [2, -20]]) expect(walk(c, 3, 1, tx, tz)).toBeLessThan(0.5);
      for (const [sx, sz] of [[25, -3], [-20, 0], [12, 12], [0, 25], [-14, -14], [20, 1]]) expect(walk(c, sx, sz, 1, 2)).toBeLessThan(0.5);
      for (const [sx, sz, tx, tz] of [[0, 14, 2, -20], [16, 0, -16, 1], [12, 12, -12, -12], [-15, 3, 15, -4]]) expect(walk(c, sx, sz, tx, tz)).toBeLessThan(0.5);
      expect(inPoly(c.ring, 0, 0, 3, 1)).toBe(true);
    }
  });
});

describe('stones on a slope (0.237.2)', () => {
  it('lean with the hillside: the foot fully, the crown a little less', async () => {
    const { leanY, LEAN_TOP } = await import('../src/gen/rockshape');
    expect(leanY(undefined, 1, 1, 0, 1)).toBe(0);
    expect(leanY([0.3, 0], 2, 0, 0, 1)).toBeCloseTo(0.6);
    expect(leanY([0.3, 0], 2, 0, 1, 1)).toBeCloseTo(0.6 * LEAN_TOP);
    expect(leanY([0, -0.5], 0, 1, 0.5, 1)).toBeCloseTo(-0.5 * (1 + LEAN_TOP) / 2);
  });
});
