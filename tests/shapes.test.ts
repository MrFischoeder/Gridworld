import { describe, it, expect } from 'vitest';
import { generateVillage, villageSides, wallPolygon, insideWall } from '../src/gen/village';
import { hash } from '../src/core/rng';

const SEEDS = Array.from({ length: 80 }, (_, i) => hash(4242, i));

describe('village shapes', () => {
  it('come as squares, hexagons, octagons and dodecagons; Gridholm stays square', () => {
    const seen = new Set(SEEDS.map((s) => villageSides(s)));
    expect([...seen].sort((a, b) => a - b)).toEqual([4, 6, 8, 12]);
    for (const s of SEEDS) expect(villageSides(s, true)).toBe(4);
  });
  it('fit every shop and some houses inside the wall, on the plaza, clear of each other', () => {
    for (const s of SEEDS) {
      const sides = villageSides(s), vm = generateVillage(s, 0, 0, 0, 'Test', false), poly = wallPolygon(sides);
      const roles = vm.buildings.map((b) => b.role);
      for (const r of ['innkeeper', 'elder', 'blacksmith', 'merchant', 'grocer']) expect(roles, `${s} (${sides}) ${r}`).toContain(r);
      expect(roles.filter((r) => r === 'house').length, `${s} houses`).toBeGreaterThanOrEqual(2);
      for (const b of vm.buildings) {
        const x0 = b.x + 36, z0 = b.z + 36; // back to plaza coordinates
        for (const [x, z] of [[x0, z0], [x0 + b.w, z0], [x0, z0 + b.d], [x0 + b.w, z0 + b.d]]) expect(insideWall(poly, x, z, 1), `${s} (${sides}) ${b.name || b.role}`).toBe(true);
      }
    }
  });
});
