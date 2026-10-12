import { describe, it, expect } from 'vitest';
import { startLodes } from '../src/gen/lodes';
import { newOutpost, handOver, finishDue, partProblem, bare, OUTPOST, BUNKS, type OutpostState } from '../src/gen/outposts';
import { LIFE, lifeNow, settleLife, loadFood, crewFactor, crews, bedsOf, isHamlet } from '../src/gen/outpostlife';
import { pwOf } from '../src/gen/grid';

const W = -12345, all = () => 999, DAY = 1440;
const lode = () => startLodes(W).find((l) => l.k === 'iron')!;
/** Build part p n times, each right after the last (returns the time it ends). */
function build(o: OutpostState, p: 'dig' | 'store' | 'power' | 'bunks' | 'field', n: number, t: number) {
  const l = lode();
  for (let i = 0; i < n; i++) { handOver(o, p, all, t); t += OUTPOST.hours[p] * 60; expect(finishDue(o, l, t)).toBe(p); }
  return t;
}
describe('stage O4: people and food at the outposts', () => {
  it('builds up to three bunkhouses and fields, one at a time', () => {
    const o = newOutpost(lode(), 'Ada', 0);
    let t = build(o, 'bunks', BUNKS.max, 0);
    expect(o.n?.bunks).toBe(3); expect(bedsOf(o)).toBe(24);
    expect(partProblem(o, 'bunks')).toMatch(/All 3/);
    expect(bare(o)).toBe(false);
    t = build(o, 'field', 1, t);
    expect(o.n?.field).toBe(1);
    expect(o.life?.t).toBe(Math.floor(OUTPOST.hours.bunks * 60 / LIFE.step) * LIFE.step); // the people's clock starts with the first bunkhouse
  });
  it('draws nobody without food or beds, settlers with a stocked pantry, and they go when it runs out', () => {
    const o = newOutpost(lode(), 'Ada', 0), t = build(o, 'bunks', 1, 0);
    expect(lifeNow(W, o, t + 3 * DAY).n).toBe(0); // beds but no food
    settleLife(W, o, t);
    expect(loadFood(W, o, 'grain', 100, t)).toBe(LIFE.pantry); // up to the pantry
    expect(loadFood(W, o, 'log', 5, t)).toBe(0);
    const L = lifeNow(W, o, t + 2 * DAY);
    expect(L.n).toBeGreaterThan(2); expect(L.n).toBeLessThanOrEqual(LIFE.beds);
    const late = lifeNow(W, o, t + 40 * DAY); // no fields: the pantry empties and they leave
    expect(late.food).toBe(0); expect(late.n).toBeLessThan(1);
  });
  it('is the same whenever it is settled (whole two-hour marks)', () => {
    const a = newOutpost(lode(), 'Ada', 0), t0 = build(a, 'field', 2, build(a, 'bunks', 2, 0));
    settleLife(W, a, t0); loadFood(W, a, 'potatoes', 20, t0);
    const b: OutpostState = JSON.parse(JSON.stringify(a));
    for (let m = t0; m < t0 + 5 * DAY; m += 37) settleLife(W, a, m); // often, at odd times
    settleLife(W, a, t0 + 5 * DAY); settleLife(W, b, t0 + 5 * DAY); // once
    expect(a.life).toEqual(b.life);
  });
  it('feeds itself from its fields, works the dig with the rest and becomes a hamlet', () => {
    const o = newOutpost(lode(), 'Ada', 0);
    let t = build(o, 'dig', 1, 0);
    o.pk = 'wind'; t = build(o, 'power', 1, t);
    t = build(o, 'bunks', 3, t); t = build(o, 'field', 3, t);
    settleLife(W, o, t); loadFood(W, o, 'grain', 30, t);
    const L = lifeNow(W, o, t + 30 * DAY);
    expect(L.n).toBeGreaterThanOrEqual(LIFE.hamlet.people);
    expect(L.v).toBeDefined();
    settleLife(W, o, t + 30 * DAY);
    expect(isHamlet(o)).toBe(true);
    const w = crews(o, o.life!.n);
    expect(w.farm).toBe(9); expect(w.dig).toBe(Math.min(LIFE.digCrew, Math.floor(o.life!.n) - 9));
    expect(crewFactor(o)).toBeGreaterThan(1);
    expect(pwOf(W, { [lode().id]: o }, lode().id, t + 30 * DAY)).toBeGreaterThan(0.5 * crewFactor(o) - 1e-9);
  });
});
