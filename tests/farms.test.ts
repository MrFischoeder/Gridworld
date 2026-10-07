import { describe, it, expect } from 'vitest';
import { FARM, farmPlan, handOverFarm, farmPeople, farmPlot, farmsOf } from '../src/gen/farms';
import { peopleAt, peopleTarget, basePeople, PEOPLE } from '../src/gen/people';
import type { TownState } from '../src/gen/town';

describe('farms', () => {
  it('are built bit by bit and raise the population target without a jump', () => {
    const s: TownState = {}, seed = 4242, now = 5000, b = basePeople(seed, false);
    expect(handOverFarm(s, seed, false, now, (k) => (k === 'planks' ? 8 : 0)).built).toBe(false);
    expect(farmPlan(s)!.rows.find((r) => r.k === 'planks')!.given).toBe(8);
    const before = peopleAt(seed, false, s, now);
    expect(handOverFarm(s, seed, false, now, () => 99).built).toBe(true);
    expect(farmsOf(s)).toBe(1);
    expect(peopleAt(seed, false, s, now)).toBeCloseTo(before, 6); // no jump
    expect(peopleTarget(seed, false, s)).toBe(b + farmPeople(seed));
    expect(peopleAt(seed, false, s, now + 10 * PEOPLE.tau)).toBeCloseTo(b + farmPeople(seed), 0); // grown into
  });
  it('stop at the most a village can take, and their fields lie outside the wall corners', () => {
    const s: TownState = { farms: FARM.max };
    expect(farmPlan(s)).toBeNull();
    const plots = [0, 1, 2].map((i) => farmPlot(77, i));
    for (const p of plots) expect(p.x0 >= 72.5 || p.x1 <= -0.5).toBe(true);
    expect(new Set(plots.map((p) => p.x0 + ',' + p.z0)).size).toBe(3);
  });
});

import { farmTarget, farmsKw, handOverUpgrade, upgradePlan, UPGRADE, UNPOWERED } from '../src/gen/farms';
import { retarget, targetNow } from '../src/gen/people';
import { balance, VILLAGE_KW } from '../src/gen/energy';
import { allVillages, villageSeed } from '../src/gen/regions';

describe('steel ploughs and power', () => {
  it('upgrades need the plans and metal, feed more with power, less without', () => {
    const s: TownState = { farms: 2 }, seed = 4242, F = farmPeople(seed), b = basePeople(seed, false);
    expect(handOverUpgrade(s, {}, () => 99).built).toBe(false); // no plans
    expect(handOverUpgrade(s, { plough: 1 }, () => 99).built).toBe(true);
    expect(upgradePlan(s)!.n).toBe(2);
    expect(farmsKw(s)).toBe(FARM.kw + UPGRADE.kw);
    expect(farmTarget(seed, false, s, 1)).toBe(b + Math.round(F * (1 + UPGRADE.mult)));
    expect(farmTarget(seed, false, s, 0)).toBe(b + Math.round(F * 2 * UNPOWERED));
  });
  it('a new target re-anchors the curve without a jump', () => {
    const s: TownState = { farms: 1 }, seed = 9;
    const before = peopleAt(seed, false, s, 3000);
    retarget(s, seed, false, 3000, 200);
    expect(peopleAt(seed, false, s, 3000)).toBeCloseTo(before, 6);
    expect(targetNow(seed, false, s)).toBe(200);
    expect(peopleAt(seed, false, s, 3000 + 10 * PEOPLE.tau)).toBeCloseTo(200, 0);
  });
  it('the farms take their power before the works', () => {
    const v = allVillages(12345)[3], seed = villageSeed(12345, v);
    const s: TownState = { farms: 3, fup: 3, plants: [{ k: 'smelter', rec: 0, inp: { ore: 5, coal: 5 }, out: {}, t: 0 }] as TownState['plants'] };
    const b = balance(12345, v, seed, s, 720);
    expect(b.farms).toBe(3 * UPGRADE.kw);
    expect(b.free).toBeLessThanOrEqual(Math.max(0, b.made - VILLAGE_KW - b.farms) + 1e-9);
    if (b.made - VILLAGE_KW >= b.farms) expect(b.farmsPowered).toBe(1);
  });
});
