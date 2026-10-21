import { describe, expect, it } from 'vitest';
import { Terrain } from '../src/gen/terrain';
import { regionCaves, nearOutcrop, CAVES } from '../src/gen/caves';
import { generateCave } from '../src/gen/cavegen';
import { caveBeasts, caveDrones, DENS } from '../src/gen/cavefauna';
import { CREATURES } from '../src/data/creatures';
import { villageDist } from '../src/gen/regions';

const W = 12345, t = new Terrain(W);
describe('(0.244) caves', () => {
  it('open far more often, on the lowlands too, under a heap of boulders clear of the villages', () => {
    let old = 0, mountain = 0, outcrop = 0;
    for (let rx = -20; rx <= 20; rx++) for (let rz = -20; rz <= 20; rz++) for (const c of regionCaves(t, rx, rz)) {
      if (c.old) old++; else if (c.kind === 'mountain') mountain++; else outcrop++;
      expect(c.w).toBeGreaterThanOrEqual(6); expect(c.h).toBeGreaterThanOrEqual(5);
      if (c.kind === 'outcrop') { expect(villageDist(W, c.x, c.z, 400)).toBeGreaterThan(CAVES.village); expect(nearOutcrop(W, c.x, c.z)).toBe(true); expect(t.water(c.x, c.z)).toBeNull(); }
    }
    expect(outcrop).toBeGreaterThan(20);
    expect(old + mountain + outcrop).toBeGreaterThan(old * 3);
  });
  it('a cave is mostly beasts, now and then a machine', () => {
    let drones = 0, beasts = 0;
    for (let s = 1; s <= 8; s++) {
      const m = generateCave(s * 104729, s % 2 ? 2 : 1), b = caveBeasts(m, 3);
      expect(b).toEqual(caveBeasts(m, 3));
      expect(new Set(b.map((x) => x.group)).size).toBeGreaterThanOrEqual(3);
      for (const x of b) { expect(CREATURES[x.kind]).toBeDefined(); expect(m.exits.every((e) => Math.hypot(x.x - e.x, x.z - e.z) > 20)).toBe(true); }
      beasts += b.length; drones += caveDrones(m.seed);
    }
    expect(drones).toBeLessThan(beasts / 4);
    for (const d of DENS) expect(CREATURES[d.kind]).toBeDefined();
    expect(caveBeasts(generateCave(7, 1), 0).every((x) => DENS.find((d) => d.kind === x.kind)!.from <= 0)).toBe(true);
  });
});
