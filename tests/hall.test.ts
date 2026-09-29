import { describe, it, expect } from 'vitest';
import { HALL, holdVol, holdRoom, deposit, withdraw, holdOf, stockOf, OWN } from '../src/gen/hall';
import { allVillages, villageSeed } from '../src/gen/regions';
import { BULK } from '../src/data/items';
import { industrySite } from '../src/gen/industry';
import { powerSite } from '../src/gen/town';
import { plantSite, } from '../src/gen/plants';
import { stationSite } from '../src/gen/energy';
import { farmPlot } from '../src/gen/farms';
import type { TownState } from '../src/gen/town';

describe('the village hall', () => {
  it('stores and gives back, up to its volume', () => {
    const s: TownState = {};
    expect(deposit(s, 'log', 10)).toBe(10); expect(holdOf(s, 'log')).toBe(10);
    expect(holdVol(s)).toBeCloseTo(10 * BULK.log[1], 5);
    expect(withdraw(s, 'log', 4)).toBe(4); expect(holdOf(s, 'log')).toBe(6);
    expect(withdraw(s, 'log', 99)).toBe(6); expect(s.hold!.log).toBeUndefined();
    const big = holdRoom(s, 'timber'); expect(deposit(s, 'timber', big + 50)).toBe(big);
    expect(holdRoom(s, 'timber')).toBe(0); expect(holdVol(s)).toBeLessThanOrEqual(HALL.vol);
  });
  it('stands clear of the other sites outside the wall and of the north gate', () => {
    const over = (a: { x0: number; x1: number; z0: number; z1: number }, b: { x0: number; x1: number; z0: number; z1: number }) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;
    const rect = (s: { x: number; z: number; w: number; d: number }) => ({ x0: s.x - s.w / 2, x1: s.x + s.w / 2, z0: s.z - s.d / 2, z1: s.z + s.d / 2 });
    for (let seed = 1; seed < 300; seed++) for (const k of ['farm', 'mine', 'workshop'] as const) {
      const others = [powerSite(seed), industrySite(seed, k), plantSite(seed, k, 0), plantSite(seed, k, 1), stationSite(seed, k, 0), stationSite(seed, k, 1)].map(rect);
      for (let i = 0; i < 3; i++) others.push(farmPlot(seed, i));
      for (const o of others) expect(over(HALL, o)).toBe(false);
    }
    expect(HALL.x1).toBeLessThan(34 - 4); // the north gate (plaza x 34) and its road stay clear
  });
  it('keeps the village\'s own goods beside the hold: they pile up to a cap, builds use both, the market only its own', () => {
    const v = allVillages(1)[3], seed = villageSeed(1, v), s: TownState = {};
    const st0 = stockOf(1, v, seed, s, 0), g = st0.own[0];
    expect(st0.own.length).toBeGreaterThan(0);
    expect(st0.ownOf(g)).toBeGreaterThan(0); expect(st0.ownOf(g)).toBeLessThanOrEqual(OWN.cap);
    expect(stockOf(1, v, seed, s, 0).ownOf(g)).toBe(st0.ownOf(g)); // the same without any state
    const late = stockOf(1, v, seed, s, 400 * 60);
    if (late.prod >= 1) { expect(late.ownOf(g)).toBeCloseTo(OWN.cap, 5); expect(late.full).toBe(true); }
    deposit(s, 'log', 5); deposit(s, g, 2);
    const st = stockOf(1, v, seed, s, 400 * 60), before = st.ownOf(g);
    expect(st.has('log')).toBe(5);
    expect(st.has(g)).toBe(2 + Math.floor(before));
    expect(st.take(g, 3)).toBe(3); expect(holdOf(s, g)).toBe(0); // the hold first ...
    expect(stockOf(1, v, seed, s, 400 * 60).ownOf(g)).toBeCloseTo(before - 1, 5); // ... then its own goods
    expect(st.takeOwn('log' as Parameters<typeof st.takeOwn>[0], 5)).toBe(0); // the market never sells what you stored
    // old saves: the industry storehouse's crates carry over
    const old: TownState = { store: { n: 20, t: 100 } }, o = stockOf(1, v, seed, old, 100);
    expect(o.own.reduce((a, x) => a + o.ownOf(x), 0)).toBeCloseTo(20, 5);
  });
  it('farms put what they grow into the hall, from when they start on it', async () => {
    const { farmYield, CROPS, UPGRADE, soil } = await import('../src/gen/farms');
    const { settleOwn, anchorNew } = await import('../src/gen/hall');
    const v = allVillages(1)[5], seed = villageSeed(1, v), s: TownState = {};
    settleOwn(1, v, seed, s, 1000); s.farms = 2; s.fup = 1; s.crops = ['hens', 'hens']; anchorNew(1, v, seed, s, 1000);
    const perH = farmYield(seed, s).eggs!;
    expect(perH).toBeCloseTo(CROPS.hens.perDay / 24 * soil(seed) * (UPGRADE.mult + 1), 5);
    const a = stockOf(1, v, seed, s, 1000), b = stockOf(1, v, seed, s, 1000 + 600);
    expect(a.ownOf('eggs')).toBe(0);
    expect(b.ownOf('eggs')).toBeCloseTo(perH * 10, 5);
    expect(b.has('eggs')).toBe(Math.floor(perH * 10));
    expect(stockOf(1, v, seed, s, 1000 + 1e6).ownOf('eggs')).toBe(OWN.cap);
    expect(b.full).toBe(stockOf(1, v, seed, s, 1600).full); // the farms do not stop the industry site
    // sowing another crop: the eggs so far stay, the milk starts now
    settleOwn(1, v, seed, s, 1600); s.crops = ['hens', 'cows']; anchorNew(1, v, seed, s, 1600);
    const c = stockOf(1, v, seed, s, 1600 + 60);
    expect(c.ownOf('milk')).toBeGreaterThan(0); expect(c.ownOf('eggs')).toBeGreaterThan(b.ownOf('eggs'));
  });
});
