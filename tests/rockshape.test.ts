import { expect, it } from 'vitest';
import { rockShape, rockFacePoint } from '../src/gen/rockshape';

it('makes bounded, repeatable boulders with a broad multi-cornered crown instead of an apex', () => {
  for (const sides of [3, 4, 5, 6, 7, 8, 9]) for (const rot of [0, .7, 3.2, 5.9]) {
    const shape = rockShape(3, 4, sides, rot);
    expect(rockShape(3, 4, sides, rot)).toEqual(shape);
    for (const ring of shape) {
      expect(ring.length).toBeGreaterThanOrEqual(5);
      for (const [x, y, z] of ring) { expect(Math.hypot(x, z)).toBeLessThanOrEqual(3); expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(4); }
      // Convex horizontal contours allow the opaque caps to be filled without gaps or overhangs.
      const turns = ring.map((p, i) => { const q = ring[(i + 1) % ring.length], r = ring[(i + 2) % ring.length]; return (q[0] - p[0]) * (r[2] - q[2]) - (q[2] - p[2]) * (r[0] - q[0]); });
      expect(turns.every(v => v > 0)).toBe(true);
    }
    expect(shape[2].every(p => p[1] === 4)).toBe(true);
    expect(Math.max(...shape[2].map(p => p[0])) - Math.min(...shape[2].map(p => p[0]))).toBeGreaterThan(1);
  }
  expect(rockShape(3, 4, 6, 0)).not.toEqual(rockShape(3, 4, 6, 1));
});
it('keeps ore surface points on the filled facets and their normals pointing outward', () => {
  const shape = rockShape(3, 4, 7, .7);
  for (const band of [0, 1] as const) for (let face = 0; face < shape[0].length; face++) for (const [s, t] of [[.1, .8], [.8, .1], [.5, .5]]) {
    const { point, normal } = rockFacePoint(shape, band, face, s, t), origin = shape[band][face];
    expect(Math.hypot(...normal)).toBeCloseTo(1);
    expect(normal[0] * point[0] + normal[2] * point[2]).toBeGreaterThan(0);
    expect(point.reduce((sum, v, i) => sum + (v - origin[i]) * normal[i], 0)).toBeCloseTo(0);
    expect(point[1]).toBeGreaterThanOrEqual(shape[band][0][1]); expect(point[1]).toBeLessThanOrEqual(shape[band + 1][0][1]);
  }
});
