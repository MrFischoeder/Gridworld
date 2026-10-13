import { describe, it, expect } from 'vitest';
import { citySites } from '../src/gen/cities';
import { generateMetro, metroCity, metroId, METRO } from '../src/gen/metro';
import { cityEntrances, cityDecoys } from '../src/gen/citydungeons';
import { VoxelGrid } from '../src/core/voxel';

const walk = (g: VoxelGrid, x: number, z: number) => g.empty(x, 0, z) && g.empty(x, 1, z) && !g.empty(x, -1, z);
function reach(g: VoxelGrid, sx: number, sz: number) {
  const seen = new Set<string>(), q: [number, number][] = [[sx, sz]]; seen.add(sx + ',' + sz);
  while (q.length) {
    const [x, z] = q.pop()!;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = (x + dx) + ',' + (z + dz);
      if (!seen.has(k) && walk(g, x + dx, z + dz)) { seen.add(k); q.push([x + dx, z + dz]); }
    }
  }
  return seen;
}

describe('the metro under a dead city', () => {
  for (const world of [12345, 4242]) for (const city of citySites(world).slice(0, 4)) {
    it(`world ${world} city ${city.i}`, () => {
      const m = generateMetro(world, city), info = m.metro!, ents = cityEntrances(world, city);
      expect(m.style).toBe('metro');
      expect(metroCity(world, ents[ents.length - 1].id)?.i).toBe(city.i);
      expect(metroId(world, city)).toBe(ents[0].id);
      // a station and stairs up for every entrance, plus stations underground only
      expect(m.portals.map((p) => p.key).sort()).toEqual(ents.map((e) => 'V' + e.n).sort());
      expect(info.stations.filter((s) => s.entrance < 0).length).toBeGreaterThanOrEqual(METRO.inner);
      // tunnels are taller than wide
      for (const b of m.boxes.filter((b) => b.tunnel)) expect(Math.min(b.w, b.d)).toBeLessThan(b.h);
      // on foot you get from the first station to every other one, past every blockage
      const g = VoxelGrid.fromOps(m.ops), s0 = info.stations[0], got = reach(g, s0.x, s0.z);
      for (const s of info.stations) expect(got.has(s.x + ',' + s.z)).toBe(true);
      for (const b of info.blocks) expect(g.empty(b.x, 1, b.z)).toBe(false);
      // and every chest and guard stands where you can get to
      for (const c of m.chests) expect(got.has(c.x + ',' + c.z)).toBe(true);
      // the caved-in entrances keep away from the real ones
      for (const d of cityDecoys(world, city)) for (const e of ents) expect(Math.hypot(d.u - e.u, d.v - e.v)).toBeGreaterThanOrEqual(70);
      expect(generateMetro(world, city)).toBe(m);
    });
  }
});
