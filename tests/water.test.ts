import { describe, it, expect } from 'vitest';
import { Terrain } from '../src/gen/terrain';
import { regionLakes, regionWells, shoreR, LAKE_REACH } from '../src/gen/water';
import { chunkTrees } from '../src/gen/trees';
import { poisNear, CHUNK, NR, REGION } from '../src/gen/regions';
import { hash } from '../src/core/rng';

const WORLDS = [hash(7, 1), hash(7, 2), hash(7, 3), hash(7, 4)];

describe('lakes', () => {
  it('exist in all three kinds, hold water in a bowl and never spill over the rim', () => {
    const kinds = { fresh: 0, murky: 0, toxic: 0 };
    for (const w of WORLDS) {
      const t = new Terrain(w);
      for (let rx = -12; rx <= 12; rx++) for (let rz = -12; rz <= 12; rz++) for (const l of regionLakes(t, rx, rz)) {
        kinds[l.kind]++;
        // deep in the middle, dry just outside the widest shore
        const mid = t.water(l.x, l.z);
        expect(mid, `lake ${l.id}`).toBeTruthy();
        expect(mid!.depth).toBeGreaterThan(1);
        let dry = 0;
        for (let i = 0; i < 32; i++) { const a = i / 32 * 6.283, rr = l.r * LAKE_REACH * 1.2; if (!t.water(l.x + Math.cos(a) * rr, l.z + Math.sin(a) * rr)) dry++; }
        expect(dry).toBeGreaterThanOrEqual(30);
        // no trees standing in it, no places touching it
        const cx = Math.floor(l.x / CHUNK), cz = Math.floor(l.z / CHUNK);
        for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) for (const tr of chunkTrees(t, cx + i, cz + j)) expect(t.water(tr.x, tr.z)).toBeNull();
        for (const p of poisNear(w, l.x, l.z, 200)) expect(Math.hypot(p.x - l.x, p.z - l.z)).toBeGreaterThan(l.r);
      }
    }
    expect(kinds.fresh).toBeGreaterThan(10); expect(kinds.murky).toBeGreaterThan(5); expect(kinds.toxic).toBeGreaterThan(0);
  }, 120000);
  it('are deterministic and wrap round the planet', () => {
    const t = new Terrain(WORLDS[0]), t2 = new Terrain(WORLDS[0]);
    for (let rx = -5; rx <= 5; rx++) {
      expect(regionLakes(t, rx, 3)).toEqual(regionLakes(t2, rx, 3));
      const a = regionLakes(t, rx, 3), b = regionLakes(t, rx + NR, 3);
      expect(b.map((l) => l.id)).toEqual(a.map((l) => l.id));
      b.forEach((l, i) => expect(l.x - a[i].x).toBeCloseTo(NR * REGION));
    }
  });
  it('shore radius stays near the mean', () => {
    for (const l of regionLakes(new Terrain(WORLDS[1]), 2, 2)) for (let a = 0; a < 6.3; a += 0.3) {
      expect(shoreR(l, a)).toBeGreaterThan(l.r * 0.6); expect(shoreR(l, a)).toBeLessThan(l.r * LAKE_REACH);
    }
  });
});
describe('wells', () => {
  it('stand on dry ground in the wilds', () => {
    let n = 0;
    for (const w of WORLDS) {
      const t = new Terrain(w);
      for (let rx = -10; rx <= 10; rx++) for (let rz = -10; rz <= 10; rz++) for (const well of regionWells(t, rx, rz)) {
        n++;
        expect(t.water(well.x, well.z)).toBeNull();
        for (const p of poisNear(w, well.x, well.z, 60)) expect(Math.hypot(p.x - well.x, p.z - well.z)).toBeGreaterThan(20);
      }
    }
    expect(n).toBeGreaterThan(50);
  });
});
