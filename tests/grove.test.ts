import { describe, it, expect } from 'vitest';
import { groveTrees, groveRoll, villageDeposits, RESOURCE_PLOTS, GROVE_REACH } from '../src/gen/resource-sites';
import { allVillages, GRIDHOLM_ID, findPoi, villageSeed } from '../src/gen/regions';
import { projectAvailable, resourceYield, initializeSettlements, PROJECTS } from '../src/gen/settlement';
import { PLANTS } from '../src/gen/plants';
import { planksForLogs } from '../src/gen/wood';
import { reservedZones } from '../src/gen/fields';
import { newChar } from '../src/save';

const world = 12345;
describe('great groves and planks', () => {
  it('a grove by some villages (always Gridholm): giant trees round the lumber camp, the village side open', () => {
    const vs = allVillages(world), with_ = vs.filter((v) => groveRoll(world, v.id)).length / vs.length;
    expect(groveRoll(world, GRIDHOLM_ID)).toBe(true); expect(with_).toBeGreaterThan(0.25); expect(with_).toBeLessThan(0.6);
    const g = groveTrees(world, GRIDHOLM_ID);
    expect(g).toEqual(groveTrees(world, GRIDHOLM_ID)); expect(g.length).toBe(9);
    for (const t of g) {
      const d = Math.hypot(t.u, t.v / 0.9);
      expect(d).toBeGreaterThanOrEqual(23); expect(d).toBeLessThan(GROVE_REACH);
      if (t.u < -8) expect(Math.abs(t.v)).toBeGreaterThan(12); // not across the track to the village (west)
      expect(t.h).toBeGreaterThanOrEqual(26); expect(t.r).toBeGreaterThanOrEqual(1.6);
    }
  });
  it('the lumber camp needs a grove and gives logs for good; the sawmill saws logs into planks', () => {
    const c = newChar(); c.world = world; initializeSettlements(c);
    for (const v of allVillages(world).slice(0, 40)) {
      const s = c.towns[v.id];
      expect(s.settlement!.deposits!.grove).toBe(villageDeposits(world, v.id).grove);
      expect(projectAvailable(s, 'lumber')).toBe(!!s.settlement!.deposits!.grove);
    }
    const s = c.towns[GRIDHOLM_ID]; s.settlement!.done = { lumber: true };
    expect(resourceYield(s).log).toBeGreaterThan(0);
    expect(PROJECTS.lumber.name).toBe('Lumber camp');
    expect(PLANTS.sawmill.recipes[0].out[0]).toBe('lumber'); // (kept at index 0)
    expect(PLANTS.sawmill.recipes[1]).toEqual({ in: [['log', 2]], out: ['planks', 12] });
  });
  it('builds want planks, not logs; logs already handed over count as planks', () => {
    for (const p of Object.values(PROJECTS)) expect(p.needs.some(([k]) => k === 'log'), p.name).toBe(false);
    const c = { towns: { 5: { fgiven: { log: 3, stone: 2 }, settlement: { v: 1, given: { quarry: { log: 4, planks: 1 } } } } }, bridges: { b: { given: { log: 2 } } } } as never as Parameters<typeof planksForLogs>[0];
    expect(planksForLogs(c)).toBe(3);
    expect(c).toEqual({ towns: { 5: { fgiven: { planks: 6, stone: 2 }, settlement: { v: 1, given: { quarry: { planks: 9 } } } } }, bridges: { b: { given: { planks: 4 } } } });
    expect(planksForLogs(c)).toBe(0); // only once
  });
  it('fields keep off the grove', () => {
    const home = findPoi(world, GRIDHOLM_ID)!, z = reservedZones(world, home, villageSeed(world, home), {}).find((r) => /grove/.test(r.why))!;
    const px = home.x - 36 + RESOURCE_PLOTS.lumber.x, pz = home.z - 36 + RESOURCE_PLOTS.lumber.z;
    for (const g of groveTrees(world, GRIDHOLM_ID)) { const x = px + g.u, zz = pz + g.v; expect(x >= z.x0 && x <= z.x1 && zz >= z.z0 && zz <= z.z1).toBe(true); }
  });
});
