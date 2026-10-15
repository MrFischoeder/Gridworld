import { describe, it, expect } from 'vitest';
import { rayCyl, rayHull, rayRod, coverSpots, COVER } from '../src/gen/cover';

const o = { x: 0, y: 1, z: 0 }, east = { x: 1, y: 0, z: 0 };
describe('cover geometry (W3)', () => {
  it('a ray meets an upright cylinder at its face, misses above it and beside it', () => {
    expect(rayCyl(o, east, 20, 5, 0, 1, 0, 2)).toBeCloseTo(4, 5);
    expect(rayCyl(o, east, 20, 5, 0, 1, 0, 0.8)).toBe(20); // a stone lower than the line
    expect(rayCyl(o, east, 20, 5, 2, 1, 0, 2)).toBe(20); // off to a side
    expect(rayCyl(o, east, 3, 5, 0, 1, 0, 2)).toBe(3); // beyond the end
  });
  it('a ray meets a prism over a convex outline', () => {
    const sq: [number, number][] = [[4, -1], [6, -1], [6, 1], [4, 1]];
    expect(rayHull(o, east, 20, sq, 0, 2)).toBeCloseTo(4, 5);
    expect(rayHull(o, east, 20, [...sq].reverse(), 0, 2)).toBe(20); // (wound the wrong way it is never inside)
    expect(rayHull(o, east, 20, sq, 0, 0.5)).toBe(20);
    expect(rayHull({ x: 0, y: 1, z: 3 }, east, 20, sq, 0, 2)).toBe(20);
  });
  it('a ray meets a leaning crystal near its axis', () => {
    const t = rayRod(o, east, 20, { x: 5, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, 6, 0.5);
    expect(t).toBeGreaterThan(4.4); expect(t).toBeLessThan(5);
    expect(rayRod(o, east, 20, { x: 5, y: 0, z: 2 }, { x: 0, y: 1, z: 0 }, 6, 0.5)).toBe(20);
    expect(rayRod(o, east, 20, { x: 5, y: 2, z: 0 }, { x: 0, y: 1, z: 0 }, 6, 0.5)).toBe(20); // starts above the line
  });
  it('cover spots: away from the threat first, none too near it', () => {
    const s = coverSpots(0, 0, 20, 0, 40);
    expect(s.length).toBeGreaterThan(10);
    for (const [x, z] of s) expect(Math.hypot(20 - x, z)).toBeGreaterThanOrEqual(COVER.near);
    expect(s[0][0]).toBeLessThanOrEqual(0.01); // the first is not towards the threat
    for (let i = 1; i < s.length; i++) expect(s[i][2]).toBeGreaterThanOrEqual(s[i - 1][2]);
  });
});
