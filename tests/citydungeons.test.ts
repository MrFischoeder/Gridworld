import { describe, it, expect } from 'vitest';
import { CITY, citySites, cityLayout, bldsNear, carsNear, inBld, worldToCity } from '../src/gen/cities';
import { CITY_VAULTS, CITY_VAULT_BASE, cityEntrances, cityEntrance, dungeonSeed } from '../src/gen/citydungeons';
import { findPoi } from '../src/gen/regions';
import { VoxelGrid } from '../src/core/voxel';
import { placeTunnelDoors, tryPlaceDoor, setDoorCells } from '../src/gen/doors';
import { reachableCells, columnReached } from '../src/gen/reach';
import { DIRV, hash } from '../src/core/rng';
import { generateDungeon } from '../src/gen/dungeon';

describe('city underground entrances', () => {
  it('places four distinct, separated, unobstructed entrances in every city across world layouts', () => {
    for (const world of [12345, 4242, 777]) {
      const ids = new Set<number>();
      for (const city of citySites(world)) {
        const entries = cityEntrances(world, city), L = cityLayout(world, city);
        expect(entries).toHaveLength(CITY_VAULTS);
        expect(cityEntrances(world, city)).toEqual(entries);
        for (const e of entries) {
          expect(ids.has(e.id)).toBe(false); ids.add(e.id);
          expect(Number.isSafeInteger(e.id)).toBe(true);
          expect(e.id).toBeGreaterThanOrEqual(CITY_VAULT_BASE);
          expect(findPoi(world, e.id)).toBeUndefined();
          expect(cityEntrance(world, JSON.parse(JSON.stringify({ id: e.id })).id)).toEqual(e);
          const [u, v] = worldToCity(city, e.x, e.z);
          expect(u).toBeCloseTo(e.u, 6); expect(v).toBeCloseTo(e.v, 6);
          expect(Math.hypot(e.u, e.v)).toBeLessThan(city.r - 30);
          expect(bldsNear(L, e.u, e.v, 6).every(i => !inBld(L.blds[i], e.u, e.v, 5))).toBe(true);
          expect(carsNear(L, e.u, e.v, 7).every(i => Math.hypot(L.cars[i].x - e.u, L.cars[i].z - e.v) > 7)).toBe(true);
          for (const other of entries) if (e !== other) expect(Math.hypot(e.u - other.u, e.v - other.v)).toBeGreaterThanOrEqual(city.r * 0.35);
        }
      }
    }
  });
  it('rejects identifiers outside the city entrance namespace', () => {
    for (const id of [-1, 0, CITY_VAULT_BASE - 1, CITY_VAULT_BASE + CITY.n * CITY_VAULTS, CITY_VAULT_BASE + 0.5, NaN]) expect(cityEntrance(12345, id)).toBeUndefined();
  });
  it('keeps old dungeon seeds and gives each entrance a separate single-level labyrinth', () => {
    const world = 12345, pos = { ruinId: 21, depth: 1, gx: 0, gz: 0 };
    expect(dungeonSeed(world, pos)).toBe(hash(world, 21, 1, 0, 0));
    const seeds = new Set<number>();
    for (const e of cityEntrances(world, citySites(world)[0])) {
      const seed = dungeonSeed(world, { ...pos, ruinId: e.id });
      expect(seeds.has(seed)).toBe(false); seeds.add(seed);
      expect(seed).not.toBe(dungeonSeed(world, { ...pos, ruinId: e.id | 0 }));
      const map = generateDungeon(seed);
      expect(map.portals.map(p => p.key)).toEqual(['V']);
      expect(map.hatch).toBeNull();
      const grid = VoxelGrid.fromOps(map.ops), doors = placeTunnelDoors(grid, map.doorCands), p = map.portals[0];
      expect(tryPlaceDoor(grid, { axis: p.axis, m: p.m, c: p.c, stair: true }, doors)).toBeTruthy();
      for (const d of doors) if (!d.stair && !d.locked) setDoorCells(grid, d.cells, false);
      const seen = reachableCells(grid, [Math.floor(map.spawn[0]), 0, Math.floor(map.spawn[2])]);
      const direction = DIRV[p.dir], front = p.m - (direction[0] || direction[1]);
      expect(columnReached(seen, p.axis === 'x' ? front : p.c, p.axis === 'x' ? p.c : front, -1, 12)).toBe(true);
    }
  });
});
