import { describe, it, expect } from 'vitest';
import { startLodes } from '../src/gen/lodes';
import { newOutpost, handOver, finishDue, partProblem, partName, OUTPOST, WALL, wallOf, type OutpostState } from '../src/gen/outposts';
import { OUTRAID, outRaid, nextRaid, holdChance, raidResult, settleRaids, strengthAt } from '../src/gen/outpostraids';
import { LIFE, PESTS, foodMade, settleLife, loadFood } from '../src/gen/outpostlife';
import { dangerAt } from '../src/gen/danger';

const W = -12345, all = () => 999, DAY = 1440;
// a deposit far enough out for raids
const lode = () => startLodes(W).find((l) => dangerAt(W, l.x, l.z) >= OUTRAID.from)!;
function build(o: OutpostState, p: 'dig' | 'wall' | 'turret' | 'bunks' | 'field', n: number, t: number) {
  for (let i = 0; i < n; i++) { handOver(o, p, all, t); t += OUTPOST.hours[p] * 60; expect(finishDue(o, lode(), t)).toBe(p); }
  return t;
}
describe('stage O5: defence of the outposts', () => {
  it('raises the wall a tier a build, each tier its own materials, up to stone', () => {
    const o = newOutpost(lode(), 'Ada', 0);
    expect(partName(o.k, 'wall', o.pk, wallOf(o))).toBe(WALL[0].name);
    let t = build(o, 'wall', 2, 0);
    expect(wallOf(o)).toBe(2);
    expect(partName(o.k, 'wall', o.pk, wallOf(o))).toBe(WALL[2].name);
    t = build(o, 'wall', 1, t);
    expect(partProblem(o, 'wall')).toMatch(/stone wall stands/);
    build(o, 'turret', 2, t);
    expect(partProblem(o, 'turret')).toMatch(/All 2/);
  });
  it('holds more often behind a better wall and with turrets, less against a strong band', () => {
    const o = newOutpost(lode(), 'Ada', 0), base = holdChance(o, 3);
    o.n = { wall: 2 }; const walled = holdChance(o, 3);
    o.n.turret = 2; const armed = holdChance(o, 3);
    expect(walled).toBeGreaterThan(base); expect(armed).toBeGreaterThan(walled);
    expect(holdChance(o, 7)).toBeLessThan(armed);
  });
  it('raids from its own timetable, none in the first period and none near Gridholm', () => {
    const l = lode(), o = newOutpost(l, 'Ada', 500);
    expect(strengthAt(W, o)).toBeGreaterThan(0);
    const r1 = outRaid(W, l.id, o, 1)!, r2 = outRaid(W, l.id, o, 2)!;
    expect(r1.t0).toBeGreaterThanOrEqual(500 + OUTRAID.period[0]);
    expect(r2.t0).toBeGreaterThan(r1.t0);
    expect(nextRaid(W, l.id, o, r1.t0 + 1)?.k).toBe(1);
    expect(nextRaid(W, l.id, o, r1.t0 + OUTRAID.duration)?.k).toBe(2);
    const home = newOutpost({ ...l, x: 30, z: 30 }, 'Ada', 0);
    expect(strengthAt(W, home)).toBe(0);
    expect(settleRaids(W, 'home', home, null, 100 * DAY)).toEqual([]);
  });
  it('settles the same however often, a lost raid takes the crates, the pantry and people, a fought one is kept', () => {
    const l = lode(), a = newOutpost(l, 'Ada', 0);
    let t = build(a, 'dig', 1, 0); t = build(a, 'bunks', 1, t);
    settleLife(W, a, t); loadFood(W, a, 'grain', 30, t);
    const b: OutpostState = JSON.parse(JSON.stringify(a)), end = t + 40 * DAY;
    for (let m = t; m < end; m += 211) settleRaids(W, l.id, a, l, m);
    const ra = settleRaids(W, l.id, a, l, end), rb = settleRaids(W, l.id, b, l, end);
    expect(a.rk).toBe(b.rk); expect(a.rlast).toEqual(b.rlast); expect(a.stock).toEqual(b.stock); expect(a.life).toEqual(b.life);
    expect(rb.length).toBeGreaterThan(3); void ra;
    // a fought outcome wins over the roll
    const c = newOutpost(l, 'Ada', 0); build(c, 'dig', 1, 0);
    const r = outRaid(W, l.id, c, 1)!; (c.raids ??= {})[1] = 'won';
    expect(raidResult(W, c, r)).toBe('won');
    expect(settleRaids(W, l.id, c, l, r.t0 + OUTRAID.duration)[0]).toEqual({ k: 1, won: true });
    expect(c.raids?.[1]).toBeUndefined();
    // a lost one plunders
    const d = newOutpost(l, 'Ada', 0); build(d, 'dig', 1, 0); (d.raids ??= {})[1] = 'lost';
    const rd = outRaid(W, l.id, d, 1)!; settleRaids(W, l.id, d, l, rd.t0 - 1);
    const before = Math.floor(d.stock!.n.ore ?? 0);
    settleRaids(W, l.id, d, l, rd.t0 + OUTRAID.duration);
    expect(d.rlast).toEqual([1, 'lost']);
    expect(d.stock!.n.ore ?? 0).toBeLessThanOrEqual(Math.ceil(before * (1 - OUTRAID.stock)) + 1);
  });
  it('lets animals trample unfenced fields', () => {
    const o = newOutpost(lode(), 'Ada', 0); o.n = { field: 1 };
    const open = foodMade(o, LIFE.fieldCrew, 1); o.n.wall = 1;
    expect(open).toBeCloseTo(foodMade(o, LIFE.fieldCrew, 1) * (1 - PESTS.trample), 5);
  });
});
