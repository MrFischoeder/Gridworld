import { describe, it, expect } from 'vitest';
import { chasmsIn, chasmPoint, chasmPath } from '../src/gen/chasms';
import { boulderDensity } from '../src/gen/boulders';
import { Terrain } from '../src/gen/terrain';
import { chunkRocks } from '../src/gen/trees';
import { WORLD_W, CHUNK } from '../src/gen/regions';
import { planBridge, bridgeProblem, deckAt, deckY, bridgeNeeds, handOverBridge, type BridgeState } from '../src/gen/bridges';

const world = 12345, t = new Terrain(world);
const rect = { x0: -15000, z0: -15000, x1: 15000, z1: 15000 };
const list = chasmsIn(world, rect);

describe('ravines and boulder fields', () => {
  it('generates dry mainland ravines at the requested scale and repeats around the planet', () => {
    expect(list.length).toBeGreaterThan(5);
    expect(chasmsIn(world, rect)).toEqual(list);
    const copy = chasmsIn(world, { ...rect, x0: rect.x0 + WORLD_W, x1: rect.x1 + WORLD_W });
    expect(copy.map(c => c.id)).toEqual(list.map(c => c.id));
    for (const c of list) {
      expect(c.width).toBeGreaterThanOrEqual(50); expect(c.width).toBeLessThanOrEqual(100);
      expect(c.length).toBeGreaterThanOrEqual(320); expect(c.length).toBeLessThanOrEqual(600);
      expect(c.entries).toBe(2);
    }
    expect(chasmsIn(world, { x0: -500, z0: -500, x1: 500, z1: 500 })).toEqual([]);
  });

  it('has two continuous, unobstructed walkable paths on the actual rendered height lattice', () => {
    const c = list[0];
    expect(t.water(c.x, c.z)).toBeNull();
    expect(t.heightAt(c.x, c.z)).toBeCloseTo(c.floor, 2);
    for (let i = 0; i < c.entries; i++) {
      let previous = chasmPath(c, i, 0), y = t.heightAt(...previous);
      const start = y;
      for (let j = 1; j <= 180; j++) {
        const p = chasmPath(c, i, j / 180), h = t.heightAt(...p), distance = Math.hypot(p[0] - previous[0], p[1] - previous[1]);
        expect(Math.abs(h - y) / distance).toBeLessThan(0.65);
        const rocks = chunkRocks(t, Math.floor(p[0] / CHUNK), Math.floor(p[1] / CHUNK));
        expect(rocks.some(k => Math.hypot(k.x - p[0], k.z - p[1]) < k.r + 1)).toBe(false);
        previous = p; y = h;
      }
      expect(start - y).toBeGreaterThan(20);
      expect(y).toBeCloseTo(c.floor, 1);
    }
    // A direct crossing encounters a steep wall; the footpaths provide the escape route.
    const a = chasmPoint(c, 0, c.width / 2), b = chasmPoint(c, 0, c.width / 2 - 8);
    expect(t.heightAt(...a) - t.heightAt(...b)).toBeGreaterThan(12);
  });

  it('lets the existing kit build a saved bridge across a ravine, with ramps and a driveable deck', () => {
    const c = list[0], [x, z] = chasmPoint(c, 0, c.width / 2 + 10);
    const ground = (x: number, z: number) => t.heightAt(x, z);
    const f = planBridge(world, x, z, x, z, ground)!;
    expect(f.kind).toBe('chasm'); expect(bridgeProblem(world, f, [])).toBeNull();
    expect(2 * f.half).toBeGreaterThan(c.width);
    expect(deckAt(f, f.x, f.z)).toBeGreaterThan(c.floor + 20);
    expect(deckY(f, -f.end)).toBeCloseTo(f.g0); expect(deckY(f, f.end)).toBeCloseTo(f.g1);
    const state: BridgeState = { given: {} };
    const materials = Object.fromEntries(bridgeNeeds(f));
    expect(handOverBridge(f, state, k => materials[k] ?? 0, 100).built).toBe(true);
    expect(JSON.parse(JSON.stringify({ f, state })).f.kind).toBe('chasm');
    expect(bridgeProblem(world, f, [f])).toMatch(/too close/);
  });

  it('adds dense, large colliding boulders outside the safe starting area and repeats them at the seam', () => {
    expect(boulderDensity(world, 0, 0)).toBe(0);
    let spot: [number, number] | undefined;
    for (let x = -4000; x <= 4000 && !spot; x += 40) for (let z = -4000; z <= 4000; z += 40)
      if (boulderDensity(world, x, z) > 0.9 && !t.water(x, z)) { spot = [x, z]; break; }
    expect(spot).toBeDefined();
    const [x, z] = spot!, cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK), rocks = chunkRocks(t, cx, cz);
    expect(rocks.filter(k => k.r >= 2.5 && k.h >= 3).length).toBeGreaterThan(4);
    expect(chunkRocks(t, cx, cz)).toEqual(rocks);
    const shifted = chunkRocks(t, cx + WORLD_W / CHUNK, cz);
    expect(shifted.map(k => ({ ...k, x: k.x - WORLD_W }))).toEqual(rocks.map(k => ({ ...k, x: expect.closeTo(k.x, 7) })));
  });
});
