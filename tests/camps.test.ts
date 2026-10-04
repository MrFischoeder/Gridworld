import { describe, expect, it } from 'vitest';
import { generateCamp } from '../src/gen/camps';
import type { Poi } from '../src/gen/regions';

const poi = { id: 123, name: 'Test camp', rect: { x0: -10, z0: -10, x1: 10, z1: 10 } } as Poi;
describe('camp palisade access', () => {
  it('keeps north and south entrance routes open and inhabitants inside the walls', () => {
    for (let world = 0; world < 50; world++) {
      const c = generateCamp(world, poi, 5);
      expect(generateCamp(world, poi, 5)).toEqual(c);
      const solid = (x: number, z: number) => c.ops.some(o => x >= o.x && x < o.x + o.w && z >= o.z && z < o.z + o.d);
      for (const z of [-10, 9]) {
        for (let x = -2; x < 2; x++) expect(solid(x, z)).toBe(false);
        for (const x of [-9, -3, 2, 8]) expect(solid(x, z)).toBe(true);
      }
      expect(solid(c.stash.x, c.stash.z)).toBe(false);
      for (const spawn of c.spawns) expect(solid(spawn.x, spawn.z)).toBe(false);
      const seen = new Set<string>(), pending: [number, number][] = [[0, -10]];
      while (pending.length) {
        const [x, z] = pending.pop()!, key = x + ':' + z;
        if (x < -10 || x >= 10 || z < -10 || z >= 10 || solid(x, z) || seen.has(key)) continue;
        seen.add(key); pending.push([x - 1, z], [x + 1, z], [x, z - 1], [x, z + 1]);
      }
      for (const point of [c.fire, c.stash, ...c.spawns, { x: 0, z: 9 }]) expect(seen.has(Math.floor(point.x) + ':' + Math.floor(point.z))).toBe(true);
      expect(c.palisade.every(o => o.h === 3)).toBe(true);
    }
  });
});
