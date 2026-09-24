import { describe, it, expect } from 'vitest';
import { generateCave, headroom, floorAtCave } from '../src/gen/cavegen';

/** Walkable cells (headroom for a standing figure, steps no steeper than the player manages) reached from (x, z). */
function reach(m: ReturnType<typeof generateCave>, x: number, z: number) {
  const seen = new Set<number>(), q: [number, number][] = [[Math.round(x), Math.round(z)]];
  const ok = (i: number, k: number) => i >= 0 && k >= 0 && i < m.nx && k < m.nz && headroom(m, i, k) > 1.95;
  while (q.length) {
    const [i, k] = q.pop()!, key = i + m.nx * k;
    if (seen.has(key)) continue; seen.add(key);
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + a, nk = k + b;
      if (ok(ni, nk) && Math.abs(floorAtCave(m, ni, nk) - floorAtCave(m, i, k)) < 0.8) q.push([ni, nk]);
    }
  }
  return seen;
}
describe('cave interiors', () => {
  it('are one walkable labyrinth from the entrance to every chamber and out the other side', () => {
    for (let s = 1; s <= 40; s++) {
      const m = generateCave(s * 7919, s % 2 ? 2 : 1), e = m.exits[0], r = reach(m, e.x, e.z);
      const at = (x: number, z: number) => r.has(Math.round(x) + m.nx * Math.round(z));
      expect(m.exits.length).toBe(s % 2 ? 2 : 1);
      for (const n of m.nodes) expect(at(n.x, n.z)).toBe(true);
      if (m.exits.length === 2) expect(at(m.exits[1].x, m.exits[1].z)).toBe(true);
      expect(generateCave(s * 7919, s % 2 ? 2 : 1).floor).toEqual(m.floor);
    }
  });
});
