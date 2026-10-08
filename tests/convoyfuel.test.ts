import { describe, it, expect } from 'vitest';
import { allVillages, GRIDHOLM_ID, villageSeed } from '../src/gen/regions';
import { settleConvoys, stayedHome, convoyNeed, deposit, holdOf } from '../src/gen/hall';
import { roadsOf, departures, convoyCans, caravanShift, CARAVAN, CONVOY_FUEL } from '../src/gen/caravans';
import type { TownState } from '../src/gen/town';

const world = 12345, home = allVillages(world).find((v) => v.id === GRIDHOLM_ID)!, seed = villageSeed(world, home);
const town = (): TownState => ({ farms: 2, people: { n: 60, t: 0, tg: 60 }, settlement: { v: 1, deposits: { kind: 'lumber', v: 2, oil: false, grove: true }, done: { power: true, warehouse: true } } } as TownState);
const leaving = (t1: number, t2: number) => roadsOf(world, home.id).flatMap((e) => departures(world, e, t1, t2)).filter((c) => c.from === home.id && c.t0 > t1 && c.t0 <= t2);

describe('convoys burn fuel (0.178)', () => {
  it('a departure takes a canister for every 10 km of road, at least one', () => {
    const cs = leaving(0, 5 * 1440);
    expect(cs.length).toBeGreaterThan(0);
    for (const c of cs) expect(convoyCans(c)).toBe(Math.max(1, Math.ceil(c.T * CARAVAN.speed / 1000 * CONVOY_FUEL.lpkm / CONVOY_FUEL.can)));
    expect(convoyNeed(world, home.id, 5 * 1440)).toBeGreaterThan(0);
  });
  it('the market feels the fuel the convoys take at their home', () => {
    const c = leaving(0, 5 * 1440)[0];
    expect(caravanShift(world, home.id, c.t0 + 1, 36 * 60).fuel ?? 0).toBeLessThan(0);
  });
  it("a settlement's convoys fill up from the stock, and stay home without fuel", () => {
    const t0 = 2 * 1440, t1 = t0 + 3 * 1440, due = leaving(t0, t1), need = due.reduce((a, c) => a + convoyCans(c), 0);
    const s = town(); settleConvoys(world, home, seed, s, t0); deposit(s, 'fuel', need + 2);
    expect(settleConvoys(world, home, seed, s, t1)).toBe(need);
    expect(holdOf(s, 'fuel')).toBe(2); expect(s.convoy!.dry.length).toBe(0);
    const dry = town(); settleConvoys(world, home, seed, dry, t0);
    expect(settleConvoys(world, home, seed, dry, t1)).toBe(0);
    expect(dry.convoy!.dry.length).toBe(due.length);
    for (const c of due) expect(stayedHome(dry, c.id)).toBe(true);
    // settling in pieces gives the same as at once (whichever player looks first)
    const a = town(); settleConvoys(world, home, seed, a, t0); deposit(a, 'fuel', need + 2);
    for (let t = t0 + 300; t < t1; t += 300) settleConvoys(world, home, seed, a, t);
    settleConvoys(world, home, seed, a, t1); expect(holdOf(a, 'fuel')).toBe(2);
    // an established village keeps no count
    const old: TownState = {}; expect(settleConvoys(world, home, seed, old, t1)).toBe(0); expect(old.convoy).toBeUndefined();
  });
});
