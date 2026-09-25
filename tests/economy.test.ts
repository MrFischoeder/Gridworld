import { describe, it, expect } from 'vitest';
import { PLANTS, PLANT_KINDS, HOPPER, OUT_CAP, runPlant, feed, collect, startPlant, handOverPlant, plantProblem, type PlantState } from '../src/gen/plants';
import { GOOD_INFO, GOODS, PROCESSED, type Good } from '../src/gen/market';
import { INDUSTRY } from '../src/gen/industry';
import { STAGES, giveToStage, stageRows, stagesDone, type ShuttleState } from '../src/gen/shuttle';
import type { TownState } from '../src/gen/town';

describe('processing chains', () => {
  const dug = new Set<Good>(Object.values(INDUSTRY).flatMap((i) => i.pool));
  const made = new Set<Good>(PLANT_KINDS.flatMap((k) => PLANTS[k].recipes.map((r) => r.out[0])));
  it('every input can be dug, grown or made, and every processed good comes out of some works', () => {
    for (const k of PLANT_KINDS) for (const r of PLANTS[k].recipes) for (const [g] of r.in) expect(dug.has(g) || made.has(g), `${k}: ${g}`).toBe(true);
    for (const g of PROCESSED) expect(made.has(g), g).toBe(true);
    for (const g of PROCESSED) expect(dug.has(g), `${g} is not dug anywhere`).toBe(false);
  });
  it('every recipe pays: its output is worth well over its inputs', () => {
    for (const k of PLANT_KINDS) for (const r of PLANTS[k].recipes) {
      const cost = r.in.reduce((a, [g, n]) => a + GOOD_INFO[g].base * n, 0), worth = GOOD_INFO[r.out[0]].base * r.out[1];
      expect(worth / cost, `${k} → ${r.out[0]}`).toBeGreaterThan(1.2);
    }
  });
  it('the shuttle wants only processed goods', () => {
    for (const st of STAGES) for (const [g] of st.needs) expect(GOOD_INFO[g].proc, g).toBe(true);
    expect(GOODS.length).toBe(new Set(GOODS).size);
  });
});

describe('a works', () => {
  const smelter = (): PlantState => ({ k: 'smelter', rec: 0, inp: {}, out: {}, t: 0 });
  it('makes a batch every period while fed, and waits when it runs dry', () => {
    const p = smelter();
    feed(p, 'ore', 4, 0); feed(p, 'coal', 1, 0);
    runPlant(p, PLANTS.smelter.batch * 5);
    expect(p.out.steel).toBe(1); // coal for one batch only
    expect(p.inp.ore).toBe(2);
    feed(p, 'coal', 5, 1000);
    runPlant(p, 1000 + PLANTS.smelter.batch * 3);
    expect(p.out.steel).toBe(2); // then the ore ran out
    expect(feed(p, 'grain', 3, 2000)).toBe(0); // it does not take what it cannot use
    const coal = p.inp.coal ?? 0;
    expect(feed(p, 'coal', 999, 2000)).toBe(HOPPER - coal);
    expect(collect(p, 'steel', 9, 2000)).toBe(2);
  });
  it('stops when its output bay is full', () => {
    const p = smelter();
    p.inp = { ore: HOPPER, coal: HOPPER };
    runPlant(p, 1e7);
    expect(p.out.steel).toBe(Math.min(OUT_CAP, HOPPER / 2));
  });
  it('is built from materials and a fee, two to a village', () => {
    const s: TownState = {};
    expect(startPlant(s, 'glassworks')).toBe('');
    expect(plantProblem(s, 'smelter')).not.toBe('');
    const r1 = handOverPlant(s, () => 999, 0, () => false);
    expect(r1.built).toBeNull(); // no fee, no works
    const r2 = handOverPlant(s, () => 0, 5, () => true);
    expect(r2.built).toBe('glassworks'); expect(s.plants![0].t).toBe(5);
    expect(startPlant(s, 'glassworks')).not.toBe('');
    expect(startPlant(s, 'smelter')).toBe(''); handOverPlant(s, () => 999, 0, () => true);
    expect(plantProblem(s, 'foundry')).toMatch(/room/);
  });
});

describe('the shuttle', () => {
  it('takes crates stage by stage and no more than each needs', () => {
    const s: ShuttleState = { given: {} };
    expect(giveToStage(s, 'fuel', 'steel', 5)).toBe(0);
    expect(giveToStage(s, 'fuel', 'propellant', 50)).toBe(30);
    expect(stageRows(s, STAGES.find((x) => x.key === 'fuel')!).done).toBe(true);
    expect(stagesDone(s)).toBe(1);
  });
});

describe('power', async () => {
  const { STATIONS, stationKw, fuelAt, loadBunker, balance, VILLAGE_KW, DRAW, windAt } = await import('../src/gen/energy');
  const { findPoi, GRIDHOLM_ID } = await import('../src/gen/regions');
  const v = findPoi(1, GRIDHOLM_ID)!;
  it('a solar farm makes nothing at night, a coal station only while it has coal', () => {
    expect(stationKw(v, 1, { k: 'solarfarm', on: true, fuel: 0, t: 0 }, 1440 + 0)).toBe(0);
    expect(stationKw(v, 1, { k: 'solarfarm', on: true, fuel: 0, t: 0 }, 1440 + 720)).toBeGreaterThan(40);
    const coal = { k: 'coalplant' as const, on: true, fuel: 0, t: 0 };
    expect(stationKw(v, 1, coal, 10)).toBe(0);
    expect(loadBunker(coal, 3, 100)).toBe(3);
    expect(stationKw(v, 1, coal, 100 + 60)).toBe(STATIONS.coalplant.kw);
    expect(fuelAt(coal, 100 + STATIONS.coalplant.burn! * 3 + 1)).toBe(0);
    expect(stationKw(v, 1, coal, 100 + STATIONS.coalplant.burn! * 3 + 1)).toBe(0);
    for (let t = 0; t < 3000; t += 97) { const w = windAt(5, t); expect(w).toBeGreaterThanOrEqual(0.15); expect(w).toBeLessThanOrEqual(1); }
  });
  it('powers the works in the order they were built while there is enough', () => {
    const smelter: PlantState = { k: 'smelter', rec: 0, inp: { ore: 10, coal: 10 }, out: {}, t: 0 };
    const foundry: PlantState = { k: 'foundry', rec: 0, inp: { steel: 10, copperbar: 10, coal: 10 }, out: {}, t: 0 };
    const s: TownState = { plants: [smelter, foundry] };
    const none = balance(1, v, 1, s, 600);
    expect(none.powered).toEqual([false, false]); // the village's own plant hardly covers the village
    s.stations = [{ k: 'coalplant', on: true, fuel: 20, t: 0 }];
    const some = balance(1, v, 1, s, 600);
    expect(some.made - VILLAGE_KW).toBeGreaterThanOrEqual(DRAW.smelter);
    expect(some.powered[0]).toBe(true);
    expect(some.powered[1]).toBe(some.made - VILLAGE_KW - DRAW.smelter >= DRAW.foundry);
  });
  it('a works without power makes nothing', () => {
    const p: PlantState = { k: 'smelter', rec: 0, inp: { ore: 10, coal: 10 }, out: {}, t: 0 };
    runPlant(p, 600, () => false);
    expect(p.out.steel ?? 0).toBe(0);
    runPlant(p, 1200, () => true);
    expect(p.out.steel).toBe(5);
  });
});
