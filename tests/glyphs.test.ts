import { describe, expect, it } from 'vitest';
import { alienGlyph, inscription } from '../src/gen/glyphs';
import { wreckShape, hullY, bendV, generateWreck } from '../src/gen/wreck';
import { hash } from '../src/core/rng';

describe('(0.241) glyphs, ruin stones, wreck shapes', () => {
  it('glyphs are deterministic, stay in the unit square and differ from seed to seed', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const g = alienGlyph(hash(7, i));
      expect(alienGlyph(hash(7, i))).toEqual(g);
      expect(g.length).toBeGreaterThanOrEqual(2);
      for (const st of g) for (const [u, v] of st) { expect(Math.abs(u)).toBeLessThanOrEqual(1); expect(Math.abs(v)).toBeLessThanOrEqual(1); }
      seen.add(JSON.stringify(g));
    }
    expect(seen.size).toBeGreaterThan(180);
    expect(inscription(5, 3)).toHaveLength(3);
  });
  it('wrecks come down in different ways, the hatch always at the ground', () => {
    const shapes = Array.from({ length: 300 }, (_, i) => wreckShape(99, i));
    expect(shapes.some((s) => s.pitch < 0.05)).toBe(true);
    expect(shapes.some((s) => s.pitch > 0.1)).toBe(true);
    expect(shapes.some((s) => s.kink !== 0)).toBe(true);
    expect(shapes.some((s) => s.engines === 2)).toBe(true);
    expect(shapes.some((s) => s.fins === 2)).toBe(true);
    for (const s of shapes) { expect(hullY(-2, s)).toBeCloseTo(2.55); expect(bendV(-2, s)).toBe(0); expect(s.kinkU).toBeGreaterThan(2); }
  });
  it('a wreck with a bent bow still fits its plot', () => {
    for (let i = 0; i < 80; i++) {
      const w = hash(3, i), poi = { type: 'wreck' as const, id: i * 7 + 3, name: 'X', x: 0, z: 0, rect: { x0: -26, z0: -12, x1: 26, z1: 12 }, flat: 4, blend: 8 };
      const m = generateWreck(w, poi, 0);
      for (const o of m.ops) if (o.op === 'solid') { expect(o.z).toBeGreaterThanOrEqual(-12); expect(o.z + o.d).toBeLessThanOrEqual(12); }
    }
  });
});
import { generateRuin } from '../src/gen/ruins';
describe('(0.241) ruin wall stones', () => {
  it('every wall column is drawn as a stone and left out of the voxel mesh, but still collides', () => {
    const poi = { type: 'ruin' as const, id: 45, name: 'R', x: 0, z: 0, rect: { x0: -30, z0: -30, x1: 30, z1: 30 }, flat: 4, blend: 8 };
    const r = generateRuin(12345, poi, 0);
    expect(r.temple.stones.length).toBeGreaterThan(30);
    expect(r.shown.length).toBe(r.ops.length - r.temple.stones.length);
    for (const s of r.temple.stones) expect(r.ops.some((o) => o.x === s.x && o.z === s.z && o.w === 1 && o.h === s.h)).toBe(true);
  });
});
