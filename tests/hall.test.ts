import { describe, it, expect } from 'vitest';
import { HALL, holdVol, holdRoom, deposit, withdraw, holdOf } from '../src/gen/hall';
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
});
