import { describe, it, expect } from 'vitest';
import { generateVillage, villageSides, WALK, MOUNTS_MAX, WALL_TIERS } from '../src/gen/village';
import { workPlan, handOverWork, worksOf, WORKS, type TownState } from '../src/gen/town';

describe('wall-walk and turret mounts', () => {
  it('a stake fence has none; a palisade and a stone wall have a walk, ladders and mounts', () => {
    for (let s = 1; s < 60; s += 7) {
      const home = s === 1;
      expect(generateVillage(s * 7919, 0, 0, 0, 'X', home, 0).walkway).toEqual([]);
      for (const tier of [1, 2]) {
        const v = generateVillage(s * 7919, 0, 0, 0, 'X', home, tier);
        expect(v.walkway.length, `sides ${villageSides(s * 7919, home)}`).toBeGreaterThan(3);
        for (const w of v.walkway) { // every stretch of the walk can be reached
          const L = Math.hypot(w.x1 - w.x0, w.z1 - w.z0);
          expect(v.walkLadders.some((l) => { const a = ((l.x - w.x0) * (w.x1 - w.x0) + (l.z - w.z0) * (w.z1 - w.z0)) / L, o = (l.x - w.x0) * w.nx + (l.z - w.z0) * w.nz; return a > 0 && a < L && Math.abs(o - WALK.in1 - 0.05) < 0.1; })).toBe(true);
        }
        expect(v.mounts.length).toBeGreaterThan(1); expect(v.mounts.length).toBeLessThanOrEqual(MOUNTS_MAX);
        for (const w of v.walkway) {
          expect(w.h).toBe(WALL_TIERS[tier].walk);
          // the deck points into the village
          const mx = (w.x0 + w.x1) / 2 + w.nx * WALK.in1, mz = (w.z0 + w.z1) / 2 + w.nz * WALK.in1, c = v.ox + 36, cz = v.oz + 36;
          expect(Math.hypot(mx - c, mz - cz)).toBeLessThan(Math.hypot((w.x0 + w.x1) / 2 - c, (w.z0 + w.z1) / 2 - cz));
        }
        // a ladder's foot stands on the plaza, clear of every building
        for (const l of v.walkLadders) for (const b of v.buildings) {
          const x = l.x + l.nx * 0.45, z = l.z + l.nz * 0.45;
          expect(x > b.x - 0.3 && x < b.x + b.w + 0.3 && z > b.z - 0.3 && z < b.z + b.d + 0.3).toBe(false);
        }
      }
    }
  });
});

describe('defence works', () => {
  it('are handed over bit by bit, one at a time, up to the spots there are', () => {
    const s: TownState = {};
    expect(workPlan(s, 'turret', 2)!.done).toBe(0);
    const r1 = handOverWork(s, 'turret', (k) => (k === 'turretkit' ? 1 : 0), 2);
    expect(r1.done).toBe(false); expect(r1.taken).toEqual([['turretkit', 1]]);
    expect(handOverWork(s, 'turret', () => 99, 2).done).toBe(true);
    expect(worksOf(s, 'turret')).toBe(1);
    expect(handOverWork(s, 'turret', () => 99, 2).done).toBe(true);
    expect(workPlan(s, 'turret', 2)).toBeNull(); // no more room on the wall
    expect(handOverWork(s, 'siteGuard', () => 99).done).toBe(true);
    expect(workPlan(s, 'siteGuard')).toBeNull();
    expect(WORKS.plantGuard.max).toBe(1);
  });
});
