import { describe, it, expect } from 'vitest';
import { citySites } from '../src/gen/cities';
import { generateMetro, metroCity, metroId, METRO } from '../src/gen/metro';
import { cityEntrances, cityDecoys } from '../src/gen/citydungeons';
import { VoxelGrid } from '../src/core/voxel';

/** The floor you stand on in a column: the track's level (0) or a platform's (1); null = no way through. */
const floor = (g: VoxelGrid, x: number, z: number) => { for (const y of [0, 1]) if (g.empty(x, y, z) && g.empty(x, y + 1, z) && !g.empty(x, y - 1, z)) return y; return null; };
/** On foot, a metre up or down at a time (the half steps take you up onto a platform). */
function reach(g: VoxelGrid, sx: number, sz: number) {
  const seen = new Set<string>(), q: [number, number][] = [[sx, sz]]; seen.add(sx + ',' + sz);
  while (q.length) {
    const [x, z] = q.pop()!, y = floor(g, x, z)!;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = (x + dx) + ',' + (z + dz), y2 = floor(g, x + dx, z + dz);
      if (!seen.has(k) && y2 !== null && Math.abs(y2 - y) <= 1 && g.empty(x + dx, Math.max(y, y2) + 1, z + dz) && g.empty(x, Math.max(y, y2) + 1, z)) { seen.add(k); q.push([x + dx, z + dz]); }
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
      // (0.205) the track lies in a trench: the platforms a step higher, with half steps up out of it
      for (const s of info.stations) {
        expect(floor(g, s.x, s.z)).toBe(0);
        const side = s.alongX ? [s.x + 3, s.z + 4] : [s.x + 4, s.z + 3], other = s.alongX ? [s.x + 3, s.z - 4] : [s.x - 4, s.z + 3];
        expect(floor(g, side[0], side[1])).toBe(METRO.platform);
        expect(floor(g, other[0], other[1])).toBe(METRO.platform);
      }
      expect(info.steps.length).toBe(info.stations.length * METRO.stepsAt.length * 2);
      for (const st of info.steps) expect(st.h).toBeLessThanOrEqual(0.6);
      for (const p of m.portals) expect(p.y0).toBe(METRO.platform);
      // and every chest and guard stands where you can get to
      for (const c of m.chests) expect(got.has(c.x + ',' + c.z)).toBe(true);
      // the caved-in entrances keep away from the real ones
      for (const d of cityDecoys(world, city)) for (const e of ents) expect(Math.hypot(d.u - e.u, d.v - e.v)).toBeGreaterThanOrEqual(70);
      expect(generateMetro(world, city)).toBe(m);
    });
  }
});
