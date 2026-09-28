import { describe, it, expect } from 'vitest';
import { FARM, farmPlan, handOverFarm, farmPeople, farmPlot, farmsOf } from '../src/gen/farms';
import { peopleAt, peopleTarget, basePeople, PEOPLE } from '../src/gen/people';
import type { TownState } from '../src/gen/town';

describe('farms', () => {
  it('are built bit by bit and raise the population target without a jump', () => {
    const s: TownState = {}, seed = 4242, now = 5000, b = basePeople(seed, false);
    expect(handOverFarm(s, seed, false, now, (k) => (k === 'log' ? 8 : 0)).built).toBe(false);
    expect(farmPlan(s)!.rows.find((r) => r.k === 'log')!.given).toBe(8);
    const before = peopleAt(seed, false, s, now);
    expect(handOverFarm(s, seed, false, now, () => 99).built).toBe(true);
    expect(farmsOf(s)).toBe(1);
    expect(peopleAt(seed, false, s, now)).toBeCloseTo(before, 6); // no jump
    expect(peopleTarget(seed, false, s)).toBe(b + farmPeople(seed));
    expect(peopleAt(seed, false, s, now + 10 * PEOPLE.tau)).toBeCloseTo(b + farmPeople(seed), 0); // grown into
  });
  it('stop at the most a village can take, and their fields lie outside the wall corners', () => {
    const s: TownState = { farms: FARM.max };
    expect(farmPlan(s)).toBeNull();
    const plots = [0, 1, 2].map((i) => farmPlot(77, i));
    for (const p of plots) expect(p.x0 >= 72.5 || p.x1 <= -0.5).toBe(true);
    expect(new Set(plots.map((p) => p.x0 + ',' + p.z0)).size).toBe(3);
  });
});
