import { describe, it, expect } from 'vitest';
import { handOverFarm, farmsOf } from '../src/gen/farms';
import { handOver, handOverWork, wallOf, worksOf, type TownState } from '../src/gen/town';
import { handOverPlant, startPlant, plantsOf } from '../src/gen/plants';
import { jobOf, jobShare, dueJobs, jobEnd, hoursOf } from '../src/gen/construction';
import { finishJob } from '../src/gen/jobs';
import { allVillages, GRIDHOLM_ID } from '../src/gen/regions';

const WORLD = 12345;
const village = () => allVillages(WORLD).find((v) => v.id !== GRIDHOLM_ID)!;

describe('construction time', () => {
  it('a farm with every material in starts a job and stands only when its hours are up', () => {
    const v = village(), s: TownState = {}, now = 7 * 60;
    const r = handOverFarm(s, 4242, false, now, () => 99, true);
    expect(r.started).toBe(true); expect(r.built).toBe(false); expect(farmsOf(s)).toBe(0);
    const j = jobOf(s, 'farm')!;
    expect(j.h).toBe(hoursOf('farm')); expect(j.h).toBeGreaterThanOrEqual(10); // a good part of a game day
    expect(handOverFarm(s, 4242, false, now + 60, () => 99, true).taken).toEqual([]); // nothing more is taken meanwhile
    expect(jobShare(j, now + j.h * 30)).toBeCloseTo(0.5, 5);
    expect(dueJobs(s, now + 60)).toEqual([]);
    const due = dueJobs(s, jobEnd(j));
    expect(due).toHaveLength(1);
    finishJob(WORLD, v, s, due[0], jobEnd(j));
    expect(farmsOf(s)).toBe(1); expect(s.jobs).toBeUndefined();
  });
  it('without a start time a build stands at once (as before), and other kinds are timed the same way', () => {
    const s: TownState = {};
    expect(handOverFarm(s, 4242, false, 0, () => 99).built).toBe(true);
    const w: TownState = {}, now = 100;
    expect(handOver(w, () => 999, now).started).toBe(true); expect(wallOf(w)).toBe(0);
    expect(handOverWork(w, 'siteGuard', () => 999, 1, now).started).toBe(true); expect(worksOf(w, 'siteGuard')).toBe(0);
    for (const j of dueJobs(w, now + 48 * 60)) finishJob(WORLD, village(), w, j, now + 48 * 60);
    expect(wallOf(w)).toBe(1); expect(worksOf(w, 'siteGuard')).toBe(1);
  });
  it('works are paid when the builders start and stand when they are done', () => {
    const s: TownState = {}, now = 500;
    expect(startPlant(s, 'smelter')).toBe('');
    let paid = 0;
    const r = handOverPlant(s, () => 999, now, (fee) => { paid += fee; return true; }, true);
    expect(r.started).toBe(true); expect(paid).toBeGreaterThan(0); expect(plantsOf(s)).toHaveLength(0);
    const j = jobOf(s, 'plant', 'smelter')!;
    finishJob(WORLD, village(), s, j, jobEnd(j));
    expect(plantsOf(s).map((p) => p.k)).toEqual(['smelter']); expect(s.pbuild).toBeUndefined();
  });
});
