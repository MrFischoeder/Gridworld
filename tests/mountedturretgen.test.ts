import { describe, expect, it } from 'vitest';
import { dungeonTurrets } from '../src/gen/mountedturrets';
import { generateDungeon } from '../src/gen/dungeon';
import { VoxelGrid } from '../src/core/voxel';
import { hash } from '../src/core/rng';

describe('mounted dungeon defences', () => {
  it('places supported wall, floor and ceiling guns deterministically away from arrival rooms', () => {
    for (let i = 0; i < 32; i++) {
      const map = generateDungeon(hash(12345, i), { depth: i % 3 + 1 }), grid = VoxelGrid.fromOps(map.ops), guns = dungeonTurrets(map, grid);
      expect(guns.map(g => g.mount)).toEqual(['wall', 'floor', 'ceiling']);
      expect(dungeonTurrets(map, grid)).toEqual(guns);
      for (const g of guns) {
        expect(Math.hypot(g.x - map.spawn[0], g.z - map.spawn[2])).toBeGreaterThan(12);
        expect(grid.empty(Math.floor(g.x), Math.floor(g.y), Math.floor(g.z))).toBe(true);
        expect(grid.empty(Math.floor(g.x - g.normal[0]), Math.floor(g.y - g.normal[1]), Math.floor(g.z - g.normal[2]))).toBe(false);
      }
    }
  });
});
