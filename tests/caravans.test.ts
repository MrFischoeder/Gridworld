import { describe, it, expect } from 'vitest';
import { network } from '../src/gen/roads';
import { departures, onRoad, caravanOf, caravanS, roadsOf, caravanShift, CARAVAN } from '../src/gen/caravans';
import { profileOf, quote, MARKET } from '../src/gen/market';
import { GRIDHOLM_ID, findPoi, villageSeed } from '../src/gen/regions';
import { hash } from '../src/core/rng';

const w = hash(6, 6);
describe('caravans', () => {
  it('keep a timetable on every road: set out in turn from each end, carry what home makes, arrive after the road is driven', () => {
    const roads = roadsOf(w, GRIDHOLM_ID);
    expect(roads.length).toBeGreaterThanOrEqual(2);
    const day = departures(w, roads[0], 0, 3 * 1440);
    expect(day.length).toBeGreaterThan(2);
    for (const c of day) {
      expect(caravanOf(w, roads[0], c.k)).toEqual(c);
      expect(c.from === roads[0].a.id ? c.back : !c.back).toBe(false);
      const home = findPoi(w, c.from)!;
      expect(profileOf(w, home, villageSeed(w, home)).makes).toContain(c.good);
      expect(c.n).toBeGreaterThan(0); expect(c.T).toBeGreaterThan(0);
      expect(caravanS(c, c.t0 + c.T)).toBeCloseTo(c.T * CARAVAN.speed, 5);
    }
    // at any hour of a day something is on the move somewhere round Gridholm
    let busy = 0;
    for (let t = 0; t < 1440; t += 60) if (roads.some((e) => onRoad(w, e, 2000 + t).length)) busy++;
    expect(busy).toBeGreaterThan(12);
  });
  it('move the markets: a delivery cheapens the good where it arrives', () => {
    let checked = 0;
    for (const e of network(w).slice(0, 40)) for (const c of departures(w, e, 3000, 6000)) {
      const dest = findPoi(w, c.to)!, at = c.t0 + c.T + 1, s = villageSeed(w, dest);
      const withC = quote(dest, s, w, c.good, {}, at).sell, without = quote(dest, s, w, c.good, {}, at, false).sell;
      const shift = caravanShift(w, dest.id, at, MARKET.half)[c.good] ?? 0;
      if (shift > 0) { expect(withC).toBeLessThanOrEqual(without); checked++; }
    }
    expect(checked).toBeGreaterThan(5);
  });
});
