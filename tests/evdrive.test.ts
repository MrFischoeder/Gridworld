import { describe, it, expect } from 'vitest';
import { freshParts, isEV, evCap, evBurn, evRangeKm, energyOf, outOfFuel, immobile, EV, VEHICLES, FUEL } from '../src/data/vehicles';
import { projectProblem, buildProject, optionalProjects, projectDone, CHARGER, RESOURCE_PLOTS } from '../src/gen/settlement';
import { ORDERS } from '../src/data/orders';
import { TECHS } from '../src/gen/tech';
import type { TownState } from '../src/gen/town';

describe('electric drive (0.180)', () => {
  it('a converted vehicle runs on its battery, goes about as far and costs less a km than diesel', () => {
    for (const m of ['scout', 'mastodon'] as const) {
      const p = freshParts(m); expect(isEV(p)).toBe(false); expect(energyOf(m, p)[3]).toBe('L');
      p.ev = evCap(m, p) * EV.start; expect(isEV(p)).toBe(true); expect(energyOf(m, p)[3]).toBe('kWh');
      expect(evRangeKm(m, evCap(m, p))).toBeGreaterThan(150);
      expect(evBurn(m, 1000, 1, 0)).toBeCloseTo(EV[m].use);
      expect(EV[m].use * EV.price).toBeLessThan(VEHICLES[m].fuelUse / FUEL.can * 70); // gold a km at full throttle, a canister at ~70 g
      p.evPack = true; expect(evCap(m, p)).toBe(EV[m].cap * EV.pack);
      p.ev = 0; p.fuel = 60; expect(outOfFuel(p)).toBe(true); expect(immobile(p)).toBeNull();
    }
  });
  it('the kit and the lithium pack are ordered with their plans', () => {
    expect(TECHS.some((t) => t.id === 'evdrive')).toBe(true);
    expect(ORDERS.find((o) => o.out === 'evkit')?.tech).toBe('evdrive');
    expect(ORDERS.find((o) => o.out === 'evpack')?.needs.some(([k]) => k === 'powercell')).toBe(true);
  });
  it('the charging post is built after the power plant, never there by itself', () => {
    const s = { farms: 2, people: { n: 60, t: 0, tg: 60 }, settlement: { v: 1, deposits: { kind: 'lumber', v: 2, oil: false, grove: true }, done: { warehouse: true } } } as TownState;
    expect(projectProblem(s, 'charger')).toMatch(/power/); expect(optionalProjects(s)).not.toContain('charger');
    s.settlement!.done!.power = true; expect(projectProblem(s, 'charger')).toBe(''); expect(optionalProjects(s)).toContain('charger');
    expect(buildProject(s, 'charger', () => 99).built).toBe(true); expect(projectDone(s, 'charger')).toBe(true);
    expect(CHARGER.kw).toBeGreaterThan(0); expect(RESOURCE_PLOTS.charger).toBeDefined();
  });
});
