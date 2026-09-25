import { describe, it, expect } from 'vitest';
import { newLife, stepLife, runLife, lifeInfo, decide, LIFE, type LifePlace } from '../src/gen/growth';
import { allVillages, villageSeed, worldDist } from '../src/gen/regions';
import { industryOf, fertility } from '../src/gen/industry';
import { ringDanger } from '../src/gen/danger';

const place = (seed: number, danger = 2, fert = 1, food = false): LifePlace => ({ seed, danger, fertility: fert, foodIndustry: food });

describe('village life', () => {
  it('is deterministic: the same village and hours give the same state', () => {
    const p = place(4242, 3.5, 1.2, true), a = newLife(p), b = newLife(p);
    runLife(a, p, 24 * 60); runLife(b, p, 24 * 60);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
  it('a starving village shrinks but never below the least population', () => {
    const p = place(7), s = newLife(p);
    s.built.farm = 0; s.built.works = 0; s.food = 0; s.gold = 0;
    runLife(s, p, 24 * 30);
    expect(s.pop).toBeGreaterThanOrEqual(LIFE.minPop);
    expect(s.log.starvedDays + s.log.bought).toBeGreaterThan(0);
  });
  it('the governor builds a farm first when food runs short', () => {
    const p = place(9), s = newLife(p);
    s.pop = 60; s.built.house = 7; s.built.farm = 1; s.food = 20; s.gold = 500;
    expect(decide(s, p)).toBe('farm');
  });
  it('a whole world lives a year: no one dies out, nothing breaks, growth levels off', () => {
    const world = 12345, vs = allVillages(world).map((v) => {
      const seed = villageSeed(world, v), ind = industryOf(world, v, seed);
      const p: LifePlace = { seed, danger: ringDanger(Math.max(0, worldDist(v.x, v.z, 0, 0) - 40)), fertility: fertility(world, v, seed), foodIndustry: ind === 'farm' || ind === 'fishery' };
      return { p, s: newLife(p) };
    });
    const total = () => vs.reduce((a, v) => a + v.s.pop, 0), start = total();
    const m = { food: 1, goods: 1 };
    let at300 = 0;
    for (let h = 1; h <= 365 * 24; h++) {
      for (const v of vs) stepLife(v.s, v.p, m);
      if (h === 300 * 24) at300 = total();
    }
    for (const v of vs) {
      const i = lifeInfo(v.s, v.p);
      for (const x of [v.s.pop, v.s.food, v.s.gold, v.s.happy]) expect(Number.isFinite(x)).toBe(true);
      expect(v.s.pop).toBeGreaterThanOrEqual(LIFE.minPop);
      expect(v.s.pop).toBeLessThanOrEqual(i.housing * 1.2 + 1);
      expect(v.s.gold).toBeGreaterThanOrEqual(0);
    }
    expect(total()).toBeGreaterThan(start * 2);          // villages grow...
    expect(total()).toBeLessThan(at300 * 1.15);           // ...but level off
  });
});
