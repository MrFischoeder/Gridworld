import { describe, it, expect } from 'vitest';
import { startLodes } from '../src/gen/lodes';
import { allVillages } from '../src/gen/regions';
import { newOutpost, handOver, finishDue, OUTPOST, type OutpostState } from '../src/gen/outposts';
import { ROUTE, newRoute, periodOf, legOf, tripFuel, assignTruck, recallTruck, fuelTruck, convoyAt, settleRoute, drainRoutes, waiting, truckProblem, takeFood, robChance } from '../src/gen/routes';
import { freshParts, VEHICLES } from '../src/data/vehicles';
import type { TownState } from '../src/gen/town';

const W = -12345, all = () => 999, DAY = 1440;
const lode = () => startLodes(W).find((l) => l.k === 'iron')!;
function digging(): OutpostState {
  const o = newOutpost(lode(), 'Ada', 0);
  handOver(o, 'dig', all, 0); finishDue(o, lode(), OUTPOST.hours.dig * 60);
  handOver(o, 'store', all, 1000); finishDue(o, lode(), 1000 + OUTPOST.hours.store * 60);
  return o;
}
const village = (o: OutpostState) => allVillages(W).sort((a, b) => Math.hypot(a.x - o.x, a.z - o.z) - Math.hypot(b.x - o.x, b.z - o.z))[0];
describe('stage O6: convoy routes', () => {
  it('times a round trip by the road and burns the tank by the trip', () => {
    const o = digging(), v = village(o), r = newRoute(o, v, v.name);
    expect(r.km).toBeGreaterThan(0);
    expect(periodOf(r)).toBe(2 * (legOf(r) + ROUTE.load));
    expect(tripFuel(r, 'mastodon')).toBeGreaterThan(tripFuel(r, 'scout'));
    expect(convoyAt(r, 0).at).toBe('parked');
    const parts = freshParts('mastodon');
    expect(truckProblem(parts, 'mastodon')).toBe('');
    expect(truckProblem({ ...parts, ev: 10 }, 'mastodon')).toBe(''); // (0.188) electric convoys run too
    assignTruck(r, { id: 't1', model: 'mastodon', parts, by: 'Ada' }, 2000);
    expect(convoyAt(r, 2010).at).toBe('outpost');
    expect(convoyAt(r, 2000 + ROUTE.load + legOf(r) / 2).at).toBe('out');
    expect(convoyAt(r, 2000 + periodOf(r) - 1).at).toBe('back');
    expect(fuelTruck(r, 5)).toBe(0); // the tank is full
  });
  it('hauls the crates on time, the same however often it is settled, and the village takes them in once', () => {
    const l = lode(), a = digging(), v = village(a);
    a.route = newRoute(a, v, v.name);
    assignTruck(a.route, { id: 't1', model: 'mastodon', parts: freshParts('mastodon'), by: 'Ada' }, 3000);
    const b: OutpostState = JSON.parse(JSON.stringify(a)), end = 3000 + 6 * DAY;
    for (let t = 3000; t < end; t += 97) settleRoute(W, a, l, t);
    settleRoute(W, a, l, end); settleRoute(W, b, l, end);
    expect(a.route).toEqual(b.route); expect(a.stock).toEqual(b.stock);
    const sent = Object.values(a.route.sent).reduce((x, n) => x + (n ?? 0), 0);
    expect(sent).toBeGreaterThan(0);
    expect(VEHICLES.mastodon.tank - (a.route.truck!.parts.fuel ?? 0)).toBeGreaterThan(0);
    const s: TownState = {}, outposts = { [l.id]: a };
    const got = drainRoutes(s, v.id, outposts).got.reduce((x, [, n]) => x + n, 0);
    expect(got).toBe(sent);
    expect(drainRoutes(s, v.id, outposts).got).toEqual([]); // never twice
    expect(waiting(a.route, s, l.id)).toBe(0);
  });
  it('misses trips on a dry tank and stops when the truck is wrecked', () => {
    const l = lode(), o = digging(), v = village(o);
    o.route = newRoute(o, v, v.name);
    const parts = { ...freshParts('scout'), fuel: 0 };
    assignTruck(o.route, { id: 't2', model: 'scout', parts, by: 'Ada' }, 3000);
    settleRoute(W, o, l, 3000 + 3 * periodOf(o.route));
    expect(o.route.last?.[1]).toBe('dry'); expect(o.route.sent).toEqual({});
    o.route.truck!.parts.hull = 0;
    settleRoute(W, o, l, 3000 + 6 * periodOf(o.route));
    expect(o.route.last?.[1]).toBe('wrecked');
    expect(recallTruck(o.route)?.id).toBe('t2'); expect(o.route.truck).toBeUndefined();
  });
  it('robs more trips without a cannon, and brings food back into the pantry', () => {
    const o = digging(), v = village(o);
    o.route = newRoute(o, v, v.name);
    const bare = robChance(W, o, o.route);
    assignTruck(o.route, { id: 't3', model: 'mastodon', parts: { ...freshParts('mastodon'), gun: true }, by: 'Ada' }, 0);
    expect(robChance(W, o, o.route)).toBeLessThan(bare);
    o.route.food = true; o.n = { bunks: 1 };
    const s: TownState = { hold: { grain: 10 } }, take = (k: string, n: number) => { const h = s.hold as Record<string, number>; const m = Math.min(n, h[k] ?? 0); h[k] = (h[k] ?? 0) - m; return m; };
    const { food } = drainRoutes(s, v.id, { [lode().id]: o }, take as never);
    expect(food).toBeGreaterThan(0);
    expect(takeFood(W, o, s.ship![lode().id], 100)).toBe(food);
    expect(o.life?.food).toBe(food);
  });
});
