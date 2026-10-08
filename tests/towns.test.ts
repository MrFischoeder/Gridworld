import { describe, it, expect } from 'vitest';
import { townsWorld } from '../src/gen/worldrules';
import { allVillages, worldDist, GRIDHOLM_ID, TOWNS } from '../src/gen/regions';
import { network, edgePath } from '../src/gen/roads';
import { startLodes, regionLode, lodesWithin, lodeGives, LODE, LODES } from '../src/gen/lodes';
import { fertility, FERTILITY } from '../src/gen/fertility';
import { initializeSettlements } from '../src/gen/settlement';
import type { TownState } from '../src/gen/town';

const W = -12345;
describe('stage O1: a new world of towns', () => {
  it('reads the rules from the seed', () => {
    expect(townsWorld(-1)).toBe(true);
    expect(townsWorld(0)).toBe(false);
    expect(townsWorld(424242)).toBe(false);
  });
  it('has about 20 towns besides Gridholm, spread far apart, the first ones near home', () => {
    const v = allVillages(W);
    expect(v[0].id).toBe(GRIDHOLM_ID);
    expect(v.length).toBe(TOWNS.n + 1);
    const near = v.slice(1).filter((p) => { const d = worldDist(p.x, p.z, 0, 0); return d >= TOWNS.ring[0] && d <= TOWNS.ring[1] + 300; });
    expect(near.length).toBeGreaterThanOrEqual(TOWNS.near);
    let min = Infinity;
    for (let i = 1; i < v.length; i++) for (let j = i + 1; j < v.length; j++) min = Math.min(min, worldDist(v[i].x, v[i].z, v[j].x, v[j].z));
    expect(min).toBeGreaterThan(3000);
    expect(allVillages(W).map((p) => p.id)).toEqual(v.map((p) => p.id)); // deterministic
  });
  it('keeps the old worlds as they were', () => {
    expect(allVillages(12345).length).toBeGreaterThan(60);
    expect(regionLode(12345, 3, 4)).toBeNull();
    expect(startLodes(12345)).toEqual([]);
  });
  it('joins Gridholm to the towns by road, never across the sea', () => {
    const e = network(W).filter((x) => x.a.id === GRIDHOLM_ID || x.b.id === GRIDHOLM_ID);
    expect(e.length).toBeGreaterThanOrEqual(2);
    expect(e.some((x) => edgePath(W, x))).toBe(true);
  }, 60000);
  it('lays the basic deposits round Gridholm and more out in the wilds', () => {
    const s = startLodes(W);
    expect(s.map((l) => l.k).sort()).toEqual([...LODE.start].sort());
    for (const l of s) { const d = worldDist(l.x, l.z, 0, 0); expect(d).toBeGreaterThanOrEqual(LODE.ring[0] - 1); expect(d).toBeLessThanOrEqual(LODE.ring[1] + 1); }
    const far = lodesWithin(W, 0, 0, 7000);
    expect(far.length).toBeGreaterThan(15);
    for (const l of far) { expect(l.rich).toBeGreaterThanOrEqual(LODE.rich[0]); expect(l.rich).toBeLessThanOrEqual(LODE.rich[1]); expect(lodeGives(l).length).toBeGreaterThan(0); expect(LODES[l.k]).toBeTruthy(); }
    expect(lodesWithin(W, 0, 0, 7000).map((l) => l.id)).toEqual(far.map((l) => l.id));
  }, 60000);
  it('gives every spot a fertility of 0.4 to 1.8 (0 on the sea)', () => {
    let lo = Infinity, hi = 0;
    for (let x = -20000; x <= 20000; x += 2500) for (let z = -15000; z <= 15000; z += 2500) {
      const f = fertility(W, x, z);
      if (f === 0) continue;
      expect(f).toBeGreaterThanOrEqual(FERTILITY.min); expect(f).toBeLessThanOrEqual(FERTILITY.max);
      lo = Math.min(lo, f); hi = Math.max(hi, f);
    }
    expect(hi - lo).toBeGreaterThan(0.6);
  }, 60000);
  it('builds the towns: only Gridholm is a settlement, the towns start with a wall', () => {
    const c = { settlementRules: 1, world: W, towns: {} as Record<string, TownState> };
    initializeSettlements(c);
    expect(c.towns[GRIDHOLM_ID].settlement?.v).toBe(1);
    for (const v of allVillages(W).slice(1)) { expect(c.towns[v.id].settlement).toBeUndefined(); expect(c.towns[v.id].wall).toBeGreaterThanOrEqual(1); }
  });
});
