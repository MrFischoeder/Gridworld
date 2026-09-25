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
