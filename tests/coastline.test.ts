import { describe, expect, it } from 'vitest';
import { continents, continentDistance, continentEdge } from '../src/gen/continents';
import { ISLE, SEA, isleOf, islesNear, isleEdge, isleHeight } from '../src/gen/seas';
import { WORLD_W, X_MIN, wrapDx } from '../src/gen/regions';
import { naturalHeight } from '../src/gen/heights';

describe('organic coastlines', () => {
  it('has many distinct inlets and headlands instead of nearly elliptical shores', () => {
    for (const world of [12345, 777, 42]) for (const c of continents(world)) {
      const edge = Array.from({ length: 720 }, (_, i) => continentEdge(c, i * Math.PI * 2 / 720));
      expect(Math.max(...edge) - Math.min(...edge)).toBeGreaterThan(0.25);
      // Count separate local bays with shoulders on both sides, at least ~100 m deep.
      let bays = 0;
      for (let i = 0; i < edge.length; i++) if (edge[i] < edge[(i + 719) % 720] && edge[i] < edge[(i + 1) % 720]
        && edge[(i + 708) % 720] - edge[i] > 0.008 && edge[(i + 12) % 720] - edge[i] > 0.008) bays++;
      expect(bays, `world ${world}, continent ${c.i}`).toBeGreaterThanOrEqual(8);
    }
  });
  it('leaves real seawater between every mainland headland and the polar ice', () => {
    for (const world of [12345, 777, 42]) for (const c of continents(world)) for (const side of [-1, 1]) {
      let x = 0, edgeZ = -Infinity;
      for (let i = 0; i < 720; i++) {
        const a = i * Math.PI * 2 / 720, edge = continentEdge(c, a), z = side * (c.z + c.rz * Math.sin(a) * edge);
        if (z > edgeZ) { edgeZ = z; x = c.x + c.rx * Math.cos(a) * edge; }
      }
      let run = 0, longest = 0;
      for (let z = edgeZ + 200; z < 23500; z += 100) {
        run = naturalHeight(world, x, side * z) < SEA.level ? run + 100 : 0;
        longest = Math.max(longest, run);
      }
      expect(longest, `world ${world}, continent ${c.i}, pole ${side}`).toBeGreaterThanOrEqual(400);
    }
  });
  it('is continuous across angular and planetary seams and independent of query order', () => {
    for (const c of continents(12345)) {
      expect(continentEdge(c, -1e-8)).toBeCloseTo(continentEdge(c, 1e-8), 6);
      for (let a = -3; a < 3; a += 0.17) {
        expect(continentEdge(c, a + Math.PI * 2)).toBeCloseTo(continentEdge(c, a), 10);
        const x = c.x + Math.cos(a) * c.rx, z = c.z + Math.sin(a) * c.rz;
        expect(continentDistance(c, x + WORLD_W, z)).toBeCloseTo(continentDistance(c, x, z), 10);
        expect(continentEdge({ ...c }, a)).toBe(continentEdge(c, a));
      }
    }
  });
});

const islands = () => {
  const out = [];
  for (let i = 0; i < 75; i++) for (let j = -15; j <= 15; j++) { const s = isleOf(12345, i, j); if (s) out.push(s); }
  return out;
};
describe('larger ocean islands', () => {
  it('provides hundreds-of-metres-wide dry land with gentle hills', () => {
    const list = islands();
    expect(list.length).toBeGreaterThan(100);
    expect(list.some(s => s.r > 600)).toBe(true);
    for (const s of list.slice(0, 20)) {
      expect(s.r).toBeGreaterThanOrEqual(240);
      for (let a = 0; a < Math.PI * 2; a += 0.5) {
        const r = isleEdge(s, a) * 0.8;
        expect(naturalHeight(12345, s.x + Math.cos(a) * r, s.z + Math.sin(a) * r)).toBeGreaterThan(SEA.level);
      }
    }
  });
  it('retains protruding submerged lobes past the nominal footprint radius', () => {
    let checked = 0;
    for (const s of islands().slice(0, 20)) for (let a = 0; a < Math.PI * 2; a += 0.05) {
      if (isleEdge(s, a) < s.r * 1.1) continue;
      const r = isleEdge(s, a) * ISLE.foot * 0.95, x = s.x + Math.cos(a) * r, z = s.z + Math.sin(a) * r;
      expect(islesNear(12345, x, z).some(q => q.i === s.i && q.j === s.j)).toBe(true);
      expect(Number.isFinite(isleHeight(12345, x, z))).toBe(true);
      expect(isleHeight(12345, x + WORLD_W, z)).toBeCloseTo(isleHeight(12345, x, z), 7);
      checked++;
    }
    expect(checked).toBeGreaterThan(50);
  });
  it('finds complete footprints across cell boundaries, the world seam and wide search margins', () => {
    const list = islands();
    for (const [x, z, margin] of [[X_MIN, 9000, 0], [X_MIN + WORLD_W, -11000, 3200], [20000, 12000, 3200], [list[0].x, list[0].z, 3200]]) {
      const expected = list.filter(s => Math.hypot(wrapDx(s.x - x), s.z - z) < s.r * ISLE.foot * ISLE.edgeMax + margin).map(s => `${s.i}:${s.j}`).sort();
      const found = islesNear(12345, x, z, margin).map(s => `${s.i}:${s.j}`).sort();
      expect(found).toEqual(expected);
    }
  });
});
