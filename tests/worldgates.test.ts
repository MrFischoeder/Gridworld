import { describe, expect, it } from 'vitest';
import { worldGates, gateDestination, gatesNear, gateLocal, gatePoint, gateRocks, GATE_CLEAR, GATE_PANEL, GATE_TABLET, tabletDestinations } from '../src/gen/worldgates';
import { GATE_GLYPHS } from '../src/data/gates';
import { GATE_OUTLINE, GATE_OPENING, UNMARKED_CORNERS, crossedGate, ringHit, vehicleFitsGate } from '../src/gen/gategeometry';
import { Terrain } from '../src/gen/terrain';
import { WORLD_W, worldDist, wrapDx } from '../src/gen/regions';
import { continents, nearestContinent } from '../src/gen/continents';
import { claimProblem } from '../src/gen/claims';

describe('ancient addressed surface gates', () => {
  it('keeps a locally generated home gate unchanged when the entire network is surveyed later', () => {
    const world = 101010, local = gatesNear(world, 0, 0, 1200);
    expect(local).toHaveLength(1); expect(local[0].id).toBe(0);
    const all = worldGates(world); expect(all).toHaveLength(40); expect(all[0]).toEqual(local[0]);
    expect(gatesNear(world, WORLD_W, 0, 1200)[0].x).toBeCloseTo(local[0].x + WORLD_W);
    for (const g of all) expect(gatesNear(world, g.x, g.z, 1).map(g => g.id)).toContain(g.id);
  });
  it('places forty unique-address gates on dry accessible ground across every continent, for different worlds', () => {
    for (const world of [12345, 4242, 777, 42]) {
      const list = worldGates(world), T = new Terrain(world);
      expect(list).toHaveLength(40); expect(worldGates(world)).toEqual(list);
      expect(new Set(list.map(g => g.address.join(','))).size).toBe(40);
      expect(new Set(list.map(g => nearestContinent(world, g.x, g.z).i)).size).toBe(continents(world).length);
      expect(Math.hypot(list[0].x, list[0].z)).toBeLessThan(1101);
      for (const g of list) {
        expect(g.address).toHaveLength(3);
        for (const s of g.address) expect(s).toBeGreaterThanOrEqual(0), expect(s).toBeLessThan(6);
        for (const [x, z] of [[0, 0], [0, 4], [0, -4], [14, 5.2], [-14, 5.2], [-6, 6], [6, -6]]) {
          const [px, pz] = gatePoint(g, x, z);
          expect(T.water(px, pz)).toBeNull(); expect(T.heightAt(px, pz)).toBeCloseTo(g.y, 5);
        }
        for (const other of list) if (other.id !== g.id) expect(worldDist(g.x, g.z, other.x, other.z)).toBeGreaterThanOrEqual(1600);
      }
    }
  });
  it('connects only exact ordered three-symbol addresses, rejects self and unused addresses', () => {
    const world = 12345, list = worldGates(world), from = list[0];
    for (const g of list.slice(1)) expect(gateDestination(world, from.id, g.address)).toEqual(g);
    expect(gateDestination(world, from.id, from.address)).toBeNull();
    for (const invalid of [[], [1], [1, 2], [0, 1, 2, 3], [-1, 2, 3], [6, 2, 3], [.5, 2, 3], [NaN, 2, 3]]) expect(gateDestination(world, from.id, invalid)).toBeNull();
    let unused = 0;
    for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) for (let c = 0; c < 6; c++) {
      const g = list.find(g => g.address.join(',') === [a, b, c].join(','));
      if (!g) { unused++; expect(gateDestination(world, from.id, [a, b, c])).toBeNull(); }
    }
    expect(unused).toBe(176);
  });
  it('wraps positions and keeps local geometry and rubble stable across the seam', () => {
    const g = worldGates(12345)[20], [x, z] = gatePoint(g, 6.3, 4.1);
    expect(gateLocal(g, x, z)[0]).toBeCloseTo(6.3); expect(gateLocal(g, x + WORLD_W, z)[1]).toBeCloseTo(4.1);
    const copy = gatesNear(12345, g.x + WORLD_W, g.z, 1)[0];
    expect(copy.id).toBe(g.id); expect(copy.x).toBeCloseTo(g.x + WORLD_W);
    expect(gateRocks(copy)).toEqual(gateRocks(g));
    expect(gateRocks(g)).not.toEqual(gateRocks(worldGates(12345)[21]));
    expect(wrapDx(copy.x - g.x)).toBeCloseTo(0);
    for (const b of gateRocks(g)) { expect(Math.abs(b.x) - b.r >= 5 || Math.abs(b.z) - b.r >= 24).toBe(true); expect(Math.hypot(b.x - GATE_PANEL[0], b.z - GATE_PANEL[1]) - b.r).toBeGreaterThan(1.5); }
  });
  it('has six different glyph paths and only two grounded, unmarked corners', () => {
    expect(GATE_GLYPHS).toHaveLength(6); expect(new Set(GATE_GLYPHS.map(g => JSON.stringify(g.paths))).size).toBe(6);
    expect(UNMARKED_CORNERS).toEqual([5, 6]);
    expect(GATE_OUTLINE).toHaveLength(8); expect(GATE_OPENING).toHaveLength(8);
    for (const i of UNMARKED_CORNERS) expect(GATE_OUTLINE[i][1]).toBeCloseTo(0);
    expect(ringHit(0, 1, 0, .3)).toBe(false); expect(ringHit(10.3, 10, 0, .3)).toBe(true);
    expect(ringHit(10.3, 10, 4, .3)).toBe(false);
  });
  it('detects fast crossings from either side, excluding the frame, walks beside it and remote jumps', () => {
    expect(crossedGate([0, 1, 2], [0, 1, -2])).toBe(true);
    expect(crossedGate([0, 1, -2], [0, 1, 2])).toBe(true);
    expect(crossedGate([11.5, 1, 2], [11.5, 1, -2])).toBe(false);
    expect(crossedGate([0, 1, 4], [0, 1, 2])).toBe(false);
    expect(crossedGate([0, 1, 2], [0, 1, 2])).toBe(false);
    expect(crossedGate([0, 1, 20], [0, 1, -20])).toBe(false);
  });
  it('protects the ring clearing from new player bases and keeps flattening local', () => {
    const T = new Terrain(12345), g = worldGates(12345)[0];
    expect(claimProblem(T, g.x, g.z, [])).toBe('Too close to an ancient gate.');
    expect(T.heightAt(g.x + GATE_CLEAR / 2, g.z)).toBe(g.y);
    const x = g.x + 25, z = g.z;
    expect(T.chunkFeatures(Math.floor(x / 32), Math.floor(z / 32)).gates).toBeDefined();
  });
});

describe('vehicle gates and permanent tablets', () => {
  it('engraves exactly three stable other addresses at every gate', () => {
    for (const g of worldGates(12345)) {
      const list = tabletDestinations(12345, g);
      expect(list).toHaveLength(3); expect(new Set(list.map(v => v.id)).size).toBe(3);
      expect(list.some(v => v.id === g.id)).toBe(false);
      expect(tabletDestinations(12345, { ...g, x: g.x + WORLD_W })).toEqual(list);
      for (const b of gateRocks(g)) expect(Math.hypot(b.x - GATE_TABLET[0], b.z - GATE_TABLET[1]) - b.r).toBeGreaterThan(1.5);
    }
    expect(worldGates(12345)[0]).toMatchObject({ x: 665, z: -82, address: [0, 2, 1] });
  });
  it('fits the largest vehicle with its cannon and standing gunner, in either direction', () => {
    for (const h of [0, Math.PI, .3, -.3]) expect(vehicleFitsGate(0, 0, h, 3.6, 9.8, 5.26)).toBe(true);
    expect(vehicleFitsGate(0, 0, 0, 2.1, 4.2, 3.8)).toBe(true);
    expect(vehicleFitsGate(7, 0, 0, 3.6, 9.8, 5.26)).toBe(false);
    expect(vehicleFitsGate(0, 0, 0, 20, 9.8, 5.26)).toBe(false);
  });
});
