import { describe, it, expect } from 'vitest';
import { generateVillage } from '../src/gen/village';
import { VoxelGrid } from '../src/core/voxel';
import { sleepSpan, SLEEP } from '../src/data/survival';

describe("the hero's house", () => {
  it('stands in Gridholm only, with the bed and the chest inside on open floor', () => {
    for (const seed of [1, 2, 3, 77, 12345]) {
      expect(generateVillage(seed, 5, 0, 0, 'Elsewhere', false).house).toBeNull();
      const vm = generateVillage(seed, 5), h = vm.house!, g = VoxelGrid.surface(vm.ops, vm.rect, 5);
      const mine = vm.buildings.filter((b) => b.mine);
      expect(mine.length).toBe(1); expect(mine[0].name).toBe('YOUR HOUSE');
      const inside = (x: number, z: number) => x > mine[0].x && x < mine[0].x + mine[0].w - 1 && z > mine[0].z && z < mine[0].z + mine[0].d - 1;
      for (const [x, z] of [[h.bed.x0, h.bed.z0], [h.bed.x1, h.bed.z1], [h.chest.x, h.chest.z], [h.bed.side.x, h.bed.side.z]]) {
        expect(inside(x, z)).toBe(true);
        expect(g.empty(Math.floor(x), 5, Math.floor(z))).toBe(true);
      }
    }
  });
  it('sleeps through the night until morning, or naps by day', () => {
    expect(sleepSpan(22 * 60)).toEqual({ min: 9 * 60, night: true });
    expect(sleepSpan(3 * 1440 + 2 * 60)).toEqual({ min: 5 * 60, night: true });
    expect(sleepSpan(13 * 60)).toEqual({ min: SLEEP.nap, night: false });
  });
});
