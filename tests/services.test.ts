import { describe, it, expect } from 'vitest';
import { allVillages, GRIDHOLM_ID, villageSeed } from '../src/gen/regions';
import { postsOf, assign, JOBS } from '../src/gen/workforce';
import { serviceOf, siteKw, SERVICE_KW } from '../src/gen/energy';
import { settleConvoys, stayedHome, deposit } from '../src/gen/hall';
import { roadsOf, departures } from '../src/gen/caravans';
import type { TownState } from '../src/gen/town';

const world = 12345, home = allVillages(world).find((v) => v.id === GRIDHOLM_ID)!, seed = villageSeed(world, home);
const town = (done: Record<string, boolean>, n = 60): TownState => ({ farms: 2, people: { n, t: 0, tg: n }, settlement: { v: 1, deposits: { kind: 'lumber', v: 2, oil: false, grove: true }, done } } as TownState);

describe('everything needs power and people (0.215)', () => {
  it('the warehouse is manned right after the power plant, the pump, the charger and the depot after the works', () => {
    const ids = postsOf(town({ power: true, warehouse: true, sawmill: true, fuelpump: true, charger: true, depot: true })).map((p) => p.id);
    expect(ids.slice(0, 4)).toEqual(['farm:0', 'farm:1', 'power', 'warehouse']);
    expect(ids.slice(-3)).toEqual(['fuelpump', 'charger', 'depot']);
    const p = assign(town({ power: true, warehouse: true, depot: true }), 13).posts; // 8 farm hands, 2 at the plant, 2 storekeepers, 1 left
    expect(p.find((q) => q.id === 'warehouse')!.fill).toBe(1);
    expect(p.find((q) => q.id === 'depot')!.got).toBe(0); // a depot takes its whole crew of 4 or nobody
  });
  it('services draw power from the site', () => {
    const s = town({ power: true, warehouse: true, fuelpump: true, depot: true });
    expect(siteKw(world, home, seed, s) - siteKw(world, home, seed, town({ power: true }))).toBe(SERVICE_KW.warehouse + SERVICE_KW.fuelpump + SERVICE_KW.depot);
  });
  it('a service stands still without its crew; an established village or a service not built is always on', () => {
    const t = 3 * 1440;
    expect(serviceOf(world, home, seed, town({ power: true, warehouse: true, depot: true }, 60), 'depot', t).why).toBe('');
    expect(serviceOf(world, home, seed, town({ power: true, warehouse: true, depot: true }, 14), 'depot', t).why).toBe('hands');
    expect(serviceOf(world, home, seed, town({ power: true }), 'depot', t).why).toBe('');
    expect(serviceOf(world, home, seed, {}, 'warehouse', t).why).toBe('');
    expect(JOBS.depot).toBe(4);
  });
  it("a settlement's convoys leave only from its manned depot", () => {
    const t0 = 2 * 1440, t1 = t0 + 3 * 1440;
    const due = roadsOf(world, home.id).flatMap((e) => departures(world, e, t0, t1)).filter((c) => c.from === home.id && c.t0 > t0 && c.t0 <= t1);
    expect(due.length).toBeGreaterThan(0);
    for (const s of [town({ power: true, warehouse: true }), town({ power: true, warehouse: true, depot: true }, 14)]) {
      settleConvoys(world, home, seed, s, t0); deposit(s, 'fuel', 99);
      expect(settleConvoys(world, home, seed, s, t1)).toBe(0);
      for (const c of due) expect(stayedHome(s, c.id)).toBe(true);
      expect(s.convoy!.dry.every((d) => d[2] === 'depot')).toBe(true);
    }
  });
});
