import { describe, it, expect } from 'vitest';
import { assign, fillOf, JOBS } from '../src/gen/workforce';
import { settleTarget, foodMade, peopleFed, FOOD, farmYield } from '../src/gen/farms';
import { SETTLEMENT_START, housingCapacity } from '../src/gen/settlement';
import { villageStats } from '../src/gen/villagestats';
import type { TownState } from '../src/gen/town';

const settled = (more: Partial<TownState> = {}): TownState => ({ settlement: { v: 1, supplies: true }, ...more });

describe('settlement workers (gen/workforce.ts)', () => {
  it('fill the farms first, then power, the yards and the works, and leave the rest free', () => {
    const s = settled({ farms: 2, settlement: { v: 1, supplies: true, done: { power: true, quarry: true } } });
    const a = assign(s, 9);
    expect(a.posts.map((p) => p.id)).toEqual(['farm:0', 'farm:1', 'power', 'quarry']);
    expect(a.posts.map((p) => p.got)).toEqual([4, 4, 1, 0]);
    expect(a.free).toBe(0); expect(a.jobs).toBe(2 * JOBS.farm + JOBS.power + JOBS.quarry);
    expect(assign(s, 30).free).toBe(30 - a.jobs);
  });
  it('run a works or a station only with its whole crew', () => {
    const s = settled({ plants: [{ k: 'smelter', rec: 0, inp: {}, out: {}, t: 0 }] as TownState['plants'] });
    expect(fillOf(s, JOBS.works - 1, 'works:0')).toBe(0);
    expect(fillOf(s, JOBS.works, 'works:0')).toBe(1);
  });
  it('leave established villages alone', () => {
    expect(assign({ farms: 3 }, 0).posts).toEqual([]);
    expect(fillOf({ farms: 3 }, 0, 'farm:0')).toBe(1);
  });
});

describe('settlement food (gen/farms.ts)', () => {
  const seed = 1234;
  it('farms grow by the hands they have; flax feeds no one', () => {
    const s = settled({ farms: 1 });
    expect(foodMade(seed, s, 0)).toBe(0);
    expect(foodMade(seed, s, 2)).toBeCloseTo(foodMade(seed, s, 4) / 2, 6);
    expect(foodMade(seed, settled({ farms: 1, crops: ['flax'] }), 4)).toBe(0);
    expect(farmYield(seed, settled({ farms: 1, crops: ['flax'] }), 4).fibre).toBeGreaterThan(0);
  });
  it('families settle only where food, homes and hands allow, with food to spare', () => {
    expect(settleTarget(seed, settled())).toBe(SETTLEMENT_START);
    for (const farms of [1, 2, 3]) {
      const s = settled({ farms }), t = settleTarget(seed, s);
      expect(t).toBeGreaterThan(SETTLEMENT_START);
      expect(t).toBeLessThanOrEqual(housingCapacity(s));
      // at the target the farms feed everyone with the margin to spare
      expect(peopleFed(seed, s, Math.floor(t * 0.6)) - SETTLEMENT_START).toBeGreaterThanOrEqual((t - SETTLEMENT_START) * FOOD.margin - 1e-6);
    }
    // flax instead of food: back to those the wilds feed
    expect(settleTarget(seed, settled({ farms: 1, crops: ['flax'] }))).toBe(SETTLEMENT_START);
  });
  it('the village at a glance', () => {
    const s = settled({ farms: 1, people: { n: 14, t: 0 } }), v = villageStats(seed, false, s, 0, 6);
    expect(v.settled).toBe(true); expect(Math.round(v.people)).toBe(14);
    expect(v.workers).toBe(8); expect(v.assigned).toBe(4); expect(v.free).toBe(4);
    expect(v.housing).toBe(housingCapacity(s)); expect(v.development).toBe(1);
    expect(['short', 'tight', 'secure']).toContain(v.food.state);
    expect(v.food.days).toBeCloseTo(6 / v.food.need, 6);
  });
});

describe('farming document (0.142)', () => {
  const seed = 77;
  it('livestock give meat beside their eggs or milk; cotton is a fibre crop', () => {
    const y = farmYield(seed, settled({ farms: 2, crops: ['cows', 'hens'] }), 8);
    expect(y.milk).toBeGreaterThan(0); expect(y.eggs).toBeGreaterThan(0); expect(y.meat).toBeGreaterThan(0);
    expect(farmYield(seed, settled({ farms: 1, crops: ['cotton'] }), 4).cotton).toBeGreaterThan(0);
    expect(foodMade(seed, settled({ farms: 1, crops: ['cotton'] }), 4)).toBe(0);
  });
  it('the food processing house makes the same fields feed more, while its crew works', () => {
    const base = settled({ farms: 2, settlement: { v: 1, supplies: true, done: { power: true } } });
    const proc = settled({ farms: 2, settlement: { v: 1, supplies: true, done: { power: true, foodworks: true } } });
    expect(foodMade(seed, proc, 8 + 2)).toBeCloseTo(foodMade(seed, base, 10), 6); // farms and power manned, no hands for it
    expect(foodMade(seed, proc, 8 + 2 + JOBS.foodworks)).toBeGreaterThan(foodMade(seed, base, 13) * 1.3);
    expect(settleTarget(seed, proc)).toBeGreaterThanOrEqual(settleTarget(seed, base));
  });
  it('steel ploughs need their pumps powered in a settlement', () => {
    const s = settled({ farms: 1, fup: 1 });
    expect(foodMade(seed, s, 4, 1)).toBeGreaterThan(foodMade(seed, s, 4, 0) * 1.5);
    expect(foodMade(seed, s, 4, 0)).toBeCloseTo(foodMade(seed, settled({ farms: 1 }), 4), 6);
  });
});
