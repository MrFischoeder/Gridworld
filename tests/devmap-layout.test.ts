import { describe, expect, it } from 'vitest';
import { continents, continentEdge } from '../src/gen/continents';
import { seaMask } from '../src/gen/seas';
import { riversOf } from '../src/gen/rivers';
import { WORLD_W, X_MIN, POLE_Z, wrapX } from '../src/gen/regions';
import { oceanMapSeam, mapOverview, longitudeCopies, mapToScreen, mapToWorld } from '../src/ui/devmap-layout';

describe('developer map ocean seam', () => {
  it('cuts deep ocean and keeps every mainland intact on two- and three-continent worlds', () => {
    const counts = new Set<number>();
    for (const world of [12345, 4242, 777, 42, 1, 2, 3, 4]) {
      const land = continents(world), seam = oceanMapSeam(world); counts.add(land.length);
      for (let z = -19000; z <= 19000; z += 500) for (const offset of [-1000, 0, 1000])
        expect(seaMask(world, seam + offset, z)).toBe(1);
      const view = mapOverview(world, 1440, 900);
      for (const c of land) {
        const [centre] = longitudeCopies(c.x, view.x, WORLD_W);
        for (let i = 0; i < 720; i++) {
          const angle = i * Math.PI * 2 / 720;
          const x = centre + Math.cos(angle) * c.rx * continentEdge(c, angle);
          expect(x).toBeGreaterThan(seam);
          expect(x).toBeLessThan(seam + WORLD_W);
        }
      }
      const home = longitudeCopies(0, view.x, WORLD_W);
      expect(home).toHaveLength(1);
      expect(Math.abs(home[0] - view.x)).toBeGreaterThan(WORLD_W / 5);
      const edges = longitudeCopies(seam, view.x, WORLD_W);
      expect(edges).toHaveLength(2);
      expect(edges[0]).toBeCloseTo(seam, 6);
      expect(edges[1]).toBeCloseTo(seam + WORLD_W, 6);
    }
    expect([...counts].sort()).toEqual([2, 3]);
  });

  it('fits all continents and both poles into the overview, including wide windows', () => {
    for (const [width, height] of [[1280, 720], [1440, 900], [2560, 720], [800, 600]]) {
      const view = mapOverview(42, width, height), seam = oceanMapSeam(42);
      for (const x of [seam, seam + WORLD_W]) for (const z of [-POLE_Z, POLE_Z]) {
        const [sx, sy] = mapToScreen(view, width, height, x, z);
        expect(sx).toBeGreaterThanOrEqual(-1e-8); expect(sx).toBeLessThanOrEqual(width + 1e-8);
        expect(sy).toBeGreaterThanOrEqual(49.9); expect(sy).toBeLessThanOrEqual(height - 49.9);
      }
    }
  });

  it('repeats markers across every visible planet copy and retains their canonical destinations', () => {
    for (const x of [0, X_MIN, X_MIN + WORLD_W - 1, 23000]) for (const centre of [-4 * WORLD_W, 0, 3 * WORLD_W]) {
      const copies = longitudeCopies(x, centre, WORLD_W * 2.5, 100);
      expect(copies.length).toBeGreaterThanOrEqual(2);
      expect(new Set(copies).size).toBe(copies.length);
      for (const copy of copies) {
        expect(Math.abs(copy - centre)).toBeLessThanOrEqual(WORLD_W * 1.25 + 100);
        expect(wrapX(copy)).toBeCloseTo(wrapX(x), 6);
      }
      for (let k = -8; k <= 8; k++) {
        const candidate = x + k * WORLD_W;
        if (Math.abs(candidate - centre) <= WORLD_W * 1.25 + 100) expect(copies).toContain(candidate);
      }
    }
    // A city's centre can be off-screen while its footprint is still visible.
    expect(longitudeCopies(550, 0, 1000, 100)).toEqual([550]);
    expect(longitudeCopies(550, 0, 1000)).toEqual([]);
  });

  it('round-trips clicks in repeated copies and keeps the same point under wheel zoom', () => {
    const width = 1440, height = 900, view = mapOverview(12345, width, height);
    for (const x of [X_MIN - 20, X_MIN + WORLD_W + 20, 3 * WORLD_W + 800]) {
      const screen = mapToScreen(view, width, height, x, 1234);
      const world = mapToWorld(view, width, height, ...screen);
      expect(world[0]).toBeCloseTo(x, 6); expect(world[1]).toBeCloseTo(1234, 6);
      expect(wrapX(world[0])).toBeCloseTo(wrapX(x), 6);
    }
    const pointer: [number, number] = [1250, 350];
    const before = mapToWorld(view, width, height, ...pointer);
    view.mpp *= 0.8;
    const after = mapToWorld(view, width, height, ...pointer);
    view.x += before[0] - after[0]; view.z += before[1] - after[1];
    expect(mapToWorld(view, width, height, ...pointer)).toEqual(before);
    view.x += WORLD_W;
    const shifted = mapToWorld(view, width, height, ...pointer);
    expect(wrapX(shifted[0])).toBeCloseTo(wrapX(before[0]), 6);
    expect(shifted[1]).toBeCloseTo(before[1], 6);
  });

  it('draws complete real rivers with their markers across the old canonical seam', () => {
    const width = 1440, height = 900, view = mapOverview(12345, width, height);
    const rivers = riversOf(12345).list;
    const crossing = rivers.filter(r => Math.min(...r.x) < X_MIN || Math.max(...r.x) >= X_MIN + WORLD_W);
    expect(crossing.length).toBeGreaterThan(0);
    for (const r of crossing) {
      const lo = Math.min(...r.x), hi = Math.max(...r.x), centre = (lo + hi) / 2;
      const copies = longitudeCopies(centre, view.x, width * view.mpp, (hi - lo) / 2);
      expect(copies.length).toBeGreaterThan(0);
      for (const copy of copies) for (let i = 1; i < r.x.length; i++) {
        const a = mapToScreen(view, width, height, r.x[i - 1] + copy - centre, r.z[i - 1]);
        const b = mapToScreen(view, width, height, r.x[i] + copy - centre, r.z[i]);
        expect(Math.abs(b[0] - a[0])).toBeLessThan(width / 2);
        const marker = longitudeCopies(wrapX(r.x[i]), view.x, width * view.mpp, (hi - lo) / 2);
        expect(marker.some(x => Math.abs(x - (r.x[i] + copy - centre)) < 1e-6)).toBe(true);
      }
    }
  }, 60000);
});
