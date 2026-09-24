import { describe, it, expect } from 'vitest';
import { raidSource, raidsBetween, raidOutcome, raidHurt, raidOf, RAID } from '../src/gen/raids';
import { allVillages, worldDist } from '../src/gen/regions';
import { hash } from '../src/core/rng';

const w = hash(8, 8);
describe('village raids', () => {
  const vs = allVillages(w).slice(0, 60), raided = vs.filter((v) => raidSource(w, v));
  it('come from a bandit camp within reach, every few days, never in the first days of a game', () => {
    expect(raided.length).toBeGreaterThan(5);
    for (const v of raided.slice(0, 15)) {
      const camp = raidSource(w, v)!;
      expect(camp.type).toBe('camp');
      expect(worldDist(camp.x, camp.z, v.x, v.z)).toBeLessThanOrEqual(RAID.reach);
      const rs = raidsBetween(w, v, 0, 30 * 1440);
      expect(rs.length).toBeGreaterThanOrEqual(5); expect(rs.length).toBeLessThanOrEqual(16);
      expect(rs[0].t0).toBeGreaterThanOrEqual(RAID.period[0]);
      for (let i = 1; i < rs.length; i++) expect(rs[i].t0).toBeGreaterThan(rs[i - 1].t0);
      expect(raidOf(w, v, rs[2].k)).toEqual(rs[2]);
    }
  });
  it('are won or lost by the wall when you are away, as fought when you were there; lost ones wreck the power plant', () => {
    let held = [0, 0, 0], n = 0;
    for (const v of raided) for (const r of raidsBetween(w, v, 0, 40 * 1440)) {
      n++; for (let t = 0; t < 3; t++) if (raidOutcome(w, r, { wall: t }) === 'won') held[t]++;
    }
    expect(held[2]).toBeGreaterThan(held[1]); expect(held[1]).toBeGreaterThan(held[0]); expect(n).toBeGreaterThan(50);
    const v = raided[0], rs = raidsBetween(w, v, 0, 40 * 1440);
    const lostAll = { raids: Object.fromEntries(rs.map((r) => [r.k, 'lost' as const])) }, wonAll = { raids: Object.fromEntries(rs.map((r) => [r.k, 'won' as const])) };
    expect(raidHurt(w, v, lostAll, 0, 40 * 1440)).toBe(rs.length * RAID.loss);
    expect(raidHurt(w, v, wonAll, 0, 40 * 1440)).toBe(0);
    expect(raidHurt(w, v, lostAll, rs[1].t0 + RAID.duration + 1, 40 * 1440)).toBe((rs.length - 2) * RAID.loss); // mended after the second
  });
});
