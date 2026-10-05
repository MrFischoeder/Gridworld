import { expect, it } from 'vitest';
import { worldMegaliths, megalithsNear, megalithStones, megalithStoneHit, megalithPoint, megalithLocal, megalithHeads, MEGALITH_DESIGNS, MEGALITH_BLEND, MEGALITH_XZ_SCALE, MEGALITH_Y_SCALE, MEGALITH_COUNT } from '../src/gen/megaliths';
import { installSites } from '../src/gen/installs';
import { claimProblem } from '../src/gen/claims';
import { Terrain } from '../src/gen/terrain';
import { WORLD_W, worldDist } from '../src/gen/regions';
import { nearestContinent, continents } from '../src/gen/continents';
import { worldGates } from '../src/gen/worldgates';
import { seaMask } from '../src/gen/seas';

it('reserves twelve sanctuaries and ten head valleys, distinct, repeatable huge monuments across the mainland without moving existing gates', () => {
  for (const world of [12345, 42, 777]) {
    const factories = structuredClone(installSites(new Terrain(world, false)));
    const gates = structuredClone(worldGates(world)), list = worldMegaliths(world);
    expect(installSites(new Terrain(world))).toEqual(factories);
    expect(list).toHaveLength(MEGALITH_COUNT); expect(MEGALITH_COUNT).toBe(22); expect(worldMegaliths(world)).toEqual(list); expect(worldGates(world)).toEqual(gates);
    expect(new Set(list.map(m => m.id)).size).toBe(22); expect(new Set(list.map(m => m.name)).size).toBe(22);
    expect(new Set(list.map(m => nearestContinent(world, m.x, m.z).i)).size).toBe(continents(world).length);
    for (const m of list) {
      expect(m.radius * 2).toBeGreaterThanOrEqual(172.5); expect(m.radius * 2).toBeLessThanOrEqual(247.5);
      expect(m.radius).toBe((MEGALITH_DESIGNS[m.index].radius+15)*MEGALITH_XZ_SCALE);
      expect(m.height).toBeGreaterThanOrEqual(MEGALITH_DESIGNS[m.index].form === 'heads' ? 20 : 32); expect(m.height).toBeLessThanOrEqual(78*MEGALITH_Y_SCALE);
      expect(seaMask(world, m.x, m.z)).toBe(0); expect(Math.hypot(m.x, m.z)).toBeGreaterThan(3500);
      for (const f of factories) expect(worldDist(m.x, m.z, f.x, f.z)).toBeGreaterThan(m.radius + MEGALITH_BLEND + f.r + 40);
      for (const g of gates) expect(worldDist(m.x, m.z, g.x, g.z)).toBeGreaterThan(m.radius + MEGALITH_BLEND + 100);
      for (const n of list) if (n !== m) expect(worldDist(m.x, m.z, n.x, n.z)).toBeGreaterThan(m.radius + n.radius + 900);
      const stones = megalithStones(m); expect(megalithStones(m)).toEqual(stones); expect(stones.length).toBeGreaterThan(15);
      expect(Math.max(...stones.map(b => b.y + b.h))).toBe(m.height);
      for (const b of stones) expect(Math.hypot(b.x, b.z) + Math.hypot(b.w, b.d) / 2).toBeLessThan(m.radius);
    }
  }
}, 300000); // Cold surveys generate roads, rivers and sites across multiple worlds.
it('grounds entire sanctuaries on a flat pad and repeats ids, geometry and coordinates at the planet seam', () => {
  const world = 12345, T = new Terrain(world);
  expect(megalithsNear(world, 0, 0, 500)).toEqual([]);
  for (const m of worldMegaliths(world)) {
    expect(claimProblem(T, m.x, m.z, [])).toMatch(/megalith/);
    for (const [u, v] of [[0, 0], [m.radius - 4, 0], [0, -m.radius + 4], [0, m.radius + 10]]) {
      const [x, z] = megalithPoint(m, u, v);
      if (Math.hypot(u, v) < m.radius - 2) { expect(T.heightAt(x, z)).toBeCloseTo(m.y, 3); expect(T.water(x, z)).toBeNull(); }
      const local = megalithLocal(m, x, z); expect(local[0]).toBeCloseTo(u); expect(local[1]).toBeCloseTo(v);
    }
    const wrapped = megalithsNear(world, m.x + WORLD_W, m.z, 1).find(n => n.id === m.id)!;
    expect(wrapped.x).toBeCloseTo(m.x + WORLD_W); expect(megalithStones(wrapped)).toEqual(megalithStones(m));
    expect(T.heightAt(m.x + WORLD_W, m.z)).toBeCloseTo(m.y, 3);
  }
});
it('collides with uprights and lintels individually and leaves the giant gate opening driveable', () => {
  const index = 10, design = MEGALITH_DESIGNS[index];
  const m = { id: 'megalith:10', index, name: design.name, x: 0, y: 0, z: 0, yaw: 0, radius: design.radius + 15, height: design.height, seed: 12345 };
  const stones = megalithStones(m);
  expect(megalithStoneHit(stones, 0, 0, 0, 2, 6)).toBe(false);
  expect(megalithStoneHit(stones, 0, 58*MEGALITH_Y_SCALE, 0, .5)).toBe(true);
  for (const b of stones.filter(b => !b.cap)) expect(megalithStoneHit(stones, b.x, 0, b.z, .4)).toBe(true);
  for (let z = -45; z <= 20; z += 2) expect(megalithStoneHit(stones, 0, 0, z, 2, 6)).toBe(false);
});

it('raises colossal heads among boulders at the ten head sites, solid where they stand, open between them', () => {
  const world = 12345, list = worldMegaliths(world).filter(m => MEGALITH_DESIGNS[m.index].form === 'heads');
  expect(list).toHaveLength(10);
  for (const m of list) {
    const { heads, rocks } = megalithHeads(m), d = MEGALITH_DESIGNS[m.index];
    expect(heads).toHaveLength(d.count); expect(rocks.length).toBeGreaterThanOrEqual(heads.length * 3);
    expect(megalithHeads(m)).toEqual({ heads, rocks });
    const stones = megalithStones(m);
    for (const o of heads) {
      expect(o.h).toBeGreaterThan(15); expect(o.y).toBeLessThanOrEqual(0); expect(Math.abs(o.lean)).toBeLessThan(.25);
      expect(megalithStoneHit(stones, o.x, 0, o.z, .4)).toBe(true); // you cannot walk through a head
    }
    for (const a of heads) for (const b of heads) if (a !== b) expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(8);
  }
});
