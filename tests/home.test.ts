import { describe, it, expect } from 'vitest';
import { generateVillage, HOUSE, furnSolid } from '../src/gen/village';
import { VoxelGrid } from '../src/core/voxel';
import { sleepSpan, SLEEP } from '../src/data/survival';

describe("the hero's house", () => {
  it('stands in Gridholm only, with the bed and the chest inside on open floor', () => {
    for (const seed of [1, 2, 3, 77, 12345]) {
      expect(generateVillage(seed, 5, 0, 0, 'Elsewhere', false).house).toBeNull();
      const vm = generateVillage(seed, 5), h = vm.house!, g = VoxelGrid.surface(vm.ops, vm.rect, 5);
      const mine = vm.buildings.filter((b) => b.mine);
      expect(mine.length).toBe(1); expect(mine[0].name).toBe('YOUR HOUSE');
      const t = HOUSE.thick, inside = (x: number, z: number) => x > mine[0].x + t && x < mine[0].x + mine[0].w - t && z > mine[0].z + t && z < mine[0].z + mine[0].d - t;
      for (const [x, z] of [[h.bed.x0, h.bed.z0], [h.bed.x1, h.bed.z1], [h.chest.x, h.chest.z], [h.bed.side.x, h.bed.side.z]]) {
        expect(inside(x, z)).toBe(true);
        expect(g.empty(Math.floor(x), 5, Math.floor(z))).toBe(true);
      }
    }
  });
  it('has timber houses: thin walls with a doorway, apart from each other, the keepers inside', () => {
    for (const seed of [1, 2, 3, 77, 12345, 999]) for (const home of [true, false]) {
      const vm = generateVillage(seed, 5, 0, 0, home ? 'Gridholm' : 'Elsewhere', home), bs = vm.buildings;
      const hit = (x: number, z: number, r: number) => bs.some((b) => b.walls.some((w) => Math.hypot(x - Math.max(w[0], Math.min(w[3], x)), z - Math.max(w[2], Math.min(w[5], z))) < r && w[1] < 5 + 1.7));
      for (const b of bs) {
        for (const w of b.walls) expect(Math.min(w[3] - w[0], w[5] - w[2])).toBeCloseTo(HOUSE.thick);
        // you can walk in through the doorway: from 1 m outside to 1 m inside
        for (let k = -1; k <= 1; k += 0.25) expect(hit(b.door.x - b.out[0] * k, b.door.z - b.out[1] * k, 0.3), `${seed} ${b.name} door`).toBe(false);
        if (b.home) expect(hit(b.home.x, b.home.z, 0.3)).toBe(false);
        for (const o of bs) if (o !== b) expect(b.x + b.w + 1 <= o.x || o.x + o.w + 1 <= b.x || b.z + b.d + 1 <= o.z || o.z + o.d + 1 <= b.z, `${b.name} / ${o.name}`).toBe(true);
      }
      for (const t of vm.towers) { const l = t.ladder!; expect(hit(l.x + l.nx * 0.45, l.z + l.nz * 0.45, 0.35)).toBe(false); }
      for (const [x, z] of vm.walk) expect(hit(x + 0.5, z + 0.5, 0.3)).toBe(false);
    }
  });
  it('furnishes the houses inside, leaving the way from the door to the counter clear', () => {
    for (const seed of [1, 2, 3, 77, 12345, 999]) for (const home of [true, false]) {
      const vm = generateVillage(seed, 5, 0, 0, home ? 'Gridholm' : 'Elsewhere', home), t = HOUSE.thick;
      for (const b of vm.buildings) {
        const solid = b.furniture.filter((f) => furnSolid(f.k));
        const hit = (x: number, z: number, r: number) => solid.some((f) => Math.hypot(x - Math.max(f.x0, Math.min(f.x1, x)), z - Math.max(f.z0, Math.min(f.z1, z))) < r);
        for (const f of b.furniture) expect(f.x0 >= b.x + t - 0.01 && f.x1 <= b.x + b.w - t + 0.01 && f.z0 >= b.z + t - 0.01 && f.z1 <= b.z + b.d - t + 0.01, `${b.name} ${f.k}`).toBe(true);
        if (b.home) expect(hit(b.home.x, b.home.z, 0.3), `${b.name} keeper`).toBe(false);
        // from the doorway straight in: to the counter's front (shops), or 2 m in (homes)
        const counter = b.furniture.find((f) => f.k === 'counter' || f.k === 'desk');
        const stop = counter ? Math.abs((b.out[0] ? (b.out[0] > 0 ? counter.x1 : counter.x0) : (b.out[1] > 0 ? counter.z1 : counter.z0)) - (b.out[0] ? b.door.x : b.door.z)) - 0.45 : 2;
        for (let k = 0; k < stop; k += 0.25) expect(hit(b.door.x - b.out[0] * k, b.door.z - b.out[1] * k, 0.35), `${seed} ${b.name} way in at ${k}`).toBe(false);
        if (b.mine) for (const [x, z] of [[vm.house!.bed.side.x, vm.house!.bed.side.z], [vm.house!.chest.x + 0.9, vm.house!.chest.z]]) expect(hit(x, z, 0.3)).toBe(false);
      }
    }
  });
  it('sleeps through the night until morning, or naps by day', () => {
    expect(sleepSpan(22 * 60)).toEqual({ min: 9 * 60, night: true });
    expect(sleepSpan(3 * 1440 + 2 * 60)).toEqual({ min: 5 * 60, night: true });
    expect(sleepSpan(13 * 60)).toEqual({ min: SLEEP.nap, night: false });
  });
});
