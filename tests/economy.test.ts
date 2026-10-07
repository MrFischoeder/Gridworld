import { describe, it, expect } from 'vitest';
import { PLANTS, PLANT_KINDS, HOPPER, OUT_CAP, runPlant, feed, collect, startPlant, handOverPlant, plantProblem, fixPlant, BASIC_VALUE, type BasicMat, type PlantState, type PlantKind, type Stuff } from '../src/gen/plants';
import { GOOD_INFO, GOODS, PROCESSED, type Good } from '../src/gen/market';
import { RARES, RARE_VALUE, isRare } from '../src/gen/deposits';
import { CROPS } from '../src/gen/farms';
import { INSTALL_WORK } from '../src/gen/installs';
import { TECH_BY_ID } from '../src/gen/tech';
import { INDUSTRY } from '../src/gen/industry';
import { STAGES, giveToStage, stageRows, stagesDone, fixShuttle, type ShuttleState } from '../src/gen/shuttle';
import type { TownState } from '../src/gen/town';

describe('processing chains', () => {
  const dug = new Set<Stuff>([...Object.values(INDUSTRY).flatMap((i) => [...i.pool, ...(i.extra?.goods ?? [])]), ...RARES.map((r) => r.k), ...Object.values(CROPS).map((c) => c.out as Stuff), 'stone', 'circuit', 'log', 'scrap']); // (stone gathered, circuit and scrap salvaged, logs felled or from a great grove)
  const made = new Set<Stuff>([...PLANT_KINDS.flatMap((k) => PLANTS[k].recipes.map((r) => r.out[0])), ...Object.values(INSTALL_WORK).map((w) => w!.out as Stuff)]);
  const value = (g: Stuff) => (g in BASIC_VALUE ? BASIC_VALUE[g as BasicMat] : isRare(g) ? RARE_VALUE[g] : GOOD_INFO[g as Good].base);
  it('every input can be dug, grown or made, and every processed good comes out of some works or old plant', () => {
    for (const k of PLANT_KINDS) for (const r of PLANTS[k].recipes) for (const [g] of r.in) expect(dug.has(g) || made.has(g), `${k}: ${g}`).toBe(true);
    for (const g of PROCESSED) expect(made.has(g), g).toBe(true);
    for (const g of PROCESSED) expect(dug.has(g), `${g} is not dug anywhere`).toBe(false);
  });
  it('every good of the land is dug somewhere', () => {
    for (const g of GOODS) if (GOOD_INFO[g].raw) expect(dug.has(g), g).toBe(true);
  });
  it('every recipe pays: its output is worth well over its inputs', () => {
    for (const k of PLANT_KINDS) for (const r of PLANTS[k].recipes) {
      const cost = r.in.reduce((a, [g, n]) => a + value(g) * n, 0), worth = value(r.out[0]) * r.out[1];
      expect(worth / cost, `${k} → ${r.out[0]}`).toBeGreaterThan(1.2);
    }
  });
  it('the shuttle wants only processed goods and the old plants\' goods, every stage something from them', () => {
    const made = new Set(Object.values(INSTALL_WORK).map((w) => w!.out as string)); made.add('ceramics'); made.add('composite'); made.add('rocketeng'); // (INSTALL_MORE)
    for (const st of STAGES) for (const [g] of st.needs) expect(made.has(g) || GOOD_INFO[g as Good].proc, g).toBe(true);
    for (const st of STAGES) expect(st.needs.some(([g]) => made.has(g)), st.key).toBe(true);
    expect(STAGES.find((x) => x.key === 'avionics')!.needs.map(([g]) => g)).toContain('microchip');
    expect(GOODS.length).toBe(new Set(GOODS).size);
  });
});

describe('a works', () => {
  const smelter = (): PlantState => ({ k: 'smelter', rec: 0, inp: {}, out: {}, t: 0 });
  it('makes a batch every period while fed, and waits when it runs dry', () => {
    const p = smelter();
    feed(p, 'ore', 4, 0); feed(p, 'coal', 1, 0);
    runPlant(p, PLANTS.smelter.batch * 5);
    expect(p.out.iron).toBe(2); // coal for one batch only (2 iron a batch)
    expect(p.inp.ore).toBe(2);
    feed(p, 'coal', 5, 1000);
    runPlant(p, 1000 + PLANTS.smelter.batch * 3);
    expect(p.out.iron).toBe(4); // then the ore ran out
    expect(feed(p, 'grain', 3, 2000)).toBe(0); // it does not take what it cannot use
    const coal = p.inp.coal ?? 0;
    expect(feed(p, 'coal', 999, 2000)).toBe(HOPPER - coal);
    expect(collect(p, 'iron', 9, 2000)).toBe(4);
  });
  it('stops when its output bay is full', () => {
    const p = smelter();
    p.inp = { ore: HOPPER, coal: HOPPER };
    runPlant(p, 1e7);
    expect(p.out.iron).toBe(Math.min(OUT_CAP, HOPPER));
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
  it('the plain works need no plans, the others the old plans for their craft; old saves keep a valid recipe', () => {
    for (const k of PLANT_KINDS) {
      const t = PLANTS[k].tech;
      if (!t) { expect(plantProblem({}, k, {})).toBe(''); continue; }
      expect(TECH_BY_ID[t], t).toBeDefined();
      expect(plantProblem({}, k, {})).toMatch(/old plans/);
      expect(plantProblem({}, k, { [t]: 1 })).toBe('');
    }
    for (const k of ['sawmill', 'brickworks', 'cementworks', 'smelter', 'glassworks'] as PlantKind[]) expect(PLANTS[k].tech).toBeUndefined();
    const old: PlantState = { k: 'glassworks', rec: 2, inp: {}, out: {}, t: 0 };
    fixPlant(old); expect(old.rec).toBe(0);
  });
});

describe('the shuttle', () => {
  it('takes crates stage by stage and no more than each needs', () => {
    const s: ShuttleState = { given: {} };
    expect(giveToStage(s, 'fuel', 'steel', 5)).toBe(0);
    expect(giveToStage(s, 'fuel', 'propellant', 50)).toBe(30);
    expect(stageRows(s, STAGES.find((x) => x.key === 'fuel')!).done).toBe(true);
    expect(stagesDone(s)).toBe(1);
    expect(s.done).toEqual(['fuel']);
  });
  it('a stage finished under the old needs stays finished; the new power stage is open', () => {
    const s: ShuttleState = { given: { hull: { alloy: 12, steel: 20 }, shield: { glass: 24, alloy: 4, plastic: 3 } } };
    const back = fixShuttle(s);
    expect(s.done).toEqual(['hull']);
    expect(back).toEqual({ glass: 24, plastic: 3, alloy: 4 }); // the shield's old crates come back (the new shield takes ancient alloy, not advanced alloy)
    expect(s.given.shield).toEqual({});
    expect(stageRows(s, STAGES.find((x) => x.key === 'hull')!).done).toBe(true);
    expect(stageRows(s, STAGES.find((x) => x.key === 'shield')!).done).toBe(false); // half done: it now wants ceramics
    expect(giveToStage(s, 'hull', 'steel', 5)).toBe(0);
    expect(stagesDone(s)).toBe(1);
    expect(STAGES.map((x) => x.key)).toEqual(['hull', 'engines', 'avionics', 'shield', 'power', 'life', 'fuel']);
    const again = JSON.parse(JSON.stringify(s)); fixShuttle(again); expect(again.done).toEqual(['hull']);
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
  it('a small reactor needs the enrichment plans, holds 4 crates of rods and runs days on each', () => {
    expect(plantProblem({}, 'reactor', {})).toMatch(/Uranium Enrichment/);
    expect(plantProblem({}, 'reactor', { enrichment: 1 })).toBe('');
    expect(plantProblem({}, 'reactor')).toBe(''); // (the check is the caller's: no plans given, no check)
    const r = { k: 'reactor' as const, on: true, fuel: 0, t: 0 };
    expect(loadBunker(r, 9, 0)).toBe(4);
    expect(stationKw(v, 1, r, 60)).toBe(STATIONS.reactor.kw);
    expect(STATIONS.reactor.burn!).toBeGreaterThanOrEqual(1440 * 3);
    expect(fuelAt(r, STATIONS.reactor.burn! * 4 + 1)).toBe(0);
    expect(STATIONS.reactor.fuel).toBe('nfuel');
  });
  it('powers the works in the order they were built while there is enough', () => {
    const smelter: PlantState = { k: 'smelter', rec: 0, inp: { ore: 10, coal: 10 }, out: {}, t: 0 };
    const foundry: PlantState = { k: 'foundry', rec: 0, inp: { steel: 10, aluminium: 10, nickel: 10 }, out: {}, t: 0 };
    const s: TownState = { plants: [smelter, foundry] };
    const none = balance(1, v, 1, s, 600);
    expect(none.powered).toEqual([false, false]); // the village's own plant hardly covers the village
    s.stations = [{ k: 'coalplant', on: true, fuel: 20, t: 0 }];
    const some = balance(1, v, 1, s, 600);
    expect(some.made - VILLAGE_KW - some.site).toBeGreaterThanOrEqual(DRAW.smelter);
    expect(some.powered[0]).toBe(true);
    expect(some.powered[1]).toBe(some.made - VILLAGE_KW - some.farms - some.site - DRAW.smelter >= DRAW.foundry);
    expect(some.sitePowered).toBe(1); // the industry site is fed before the works
  });
  it('a works without power makes nothing', () => {
    const p: PlantState = { k: 'smelter', rec: 0, inp: { ore: 10, coal: 10 }, out: {}, t: 0 };
    runPlant(p, 600, () => false);
    expect(p.out.iron ?? 0).toBe(0);
    runPlant(p, 1200, () => true);
    expect(p.out.iron).toBe(10);
  });
});

describe('stone and strategic metals (0.144)', () => {
  it('the older rares keep their order and the new ones are appended', () => {
    expect(RARES.map((r) => r.k).slice(-3)).toEqual(['pgmore', 'rutile', 'chromite']);
  });
  it('the stoneworks dresses stone and advanced metallurgy wants its plans', () => {
    expect(PLANTS.stoneworks.recipes[0].in).toEqual([['stone', 3]]);
    expect(PLANTS.stoneworks.tech).toBeUndefined();
    expect(PLANTS.metallurgy.tech).toBe('metallurgy');
    expect(TECH_BY_ID.metallurgy).toBeDefined();
    expect(PLANTS.metallurgy.recipes.map((r) => r.out[0])).toEqual(['advsteel', 'titanium', 'pgm']);
    expect(PLANT_KINDS.slice(-6, -4)).toEqual(['stoneworks', 'metallurgy']);
  });
});

describe('electronics (0.145)', () => {
  it('silicon processing and advanced electronics want their plans, and the older recipes keep their numbers', () => {
    expect(PLANT_KINDS.slice(-4, -2)).toEqual(['siliconworks', 'advelec']);
    expect(PLANTS.siliconworks.tech).toBe('semiconductors');
    expect(PLANTS.advelec.tech).toBe('computing');
    expect(TECH_BY_ID.semiconductors && TECH_BY_ID.computing).toBeTruthy();
    expect(PLANTS.glassworks.recipes[0].out[0]).toBe('glass');
    expect(PLANTS.glassworks.recipes[1].out[0]).toBe('optics');
    expect(PLANTS.electronics.recipes[0].out[0]).toBe('boards');
    expect(PLANTS.electronics.recipes[1].out[0]).toBe('control');
    expect(PLANTS.advelec.recipes.map((r) => r.out[0])).toEqual(['hpe', 'computer', 'pcm']);
  });
});

describe('the space program (0.147)', () => {
  it('avionics and life support works want their plans; the Chariot gets a life support stage', () => {
    expect(PLANT_KINDS.slice(-2)).toEqual(['avionworks', 'lifeworks']);
    expect(PLANTS.avionworks.tech).toBe('avionics'); expect(PLANTS.lifeworks.tech).toBe('lifesupport');
    expect(TECH_BY_ID.avionics && TECH_BY_ID.lifesupport && TECH_BY_ID.rocketry).toBeTruthy();
    const need = (k: string) => STAGES.find((x) => x.key === k)!.needs.map(([g]) => g);
    expect(need('hull')).toContain('aerocomp'); expect(need('engines')).toContain('rocketeng'); expect(need('avionics')).toContain('avionics'); expect(need('life')).toContain('lifesup');
  });
  it('a Chariot finished under six stages stays finished; an unfinished one gets the new stage', () => {
    const six = ['hull', 'engines', 'avionics', 'shield', 'power', 'fuel'] as const;
    const a: ShuttleState = { given: {}, done: [...six], v: 2 }; fixShuttle(a);
    expect(stagesDone(a)).toBe(STAGES.length);
    const b: ShuttleState = { given: {}, done: ['hull'], v: 2 }; fixShuttle(b);
    expect(stagesDone(b)).toBe(1); expect(b.v).toBe(3);
    expect(giveToStage(b, 'life', 'lifesup', 9)).toBe(4);
  });
});
describe('the metal ladder (0.173)', () => {
  const v = (g: Stuff) => (g in BASIC_VALUE ? BASIC_VALUE[g as BasicMat] : GOOD_INFO[g as Good].base);
  it('ranks ore below scrap below ingots, and makes wire from iron bars', () => {
    expect(GOOD_INFO.ore.base / 8).toBeLessThan(BASIC_VALUE.scrap); // a lump of ore (8 to a crate) < a piece of scrap
    const remelt = PLANTS.smelter.recipes.find((r) => r.in.some(([g]) => g === 'scrap'))!;
    expect(remelt.out).toEqual(['iron', 2]);
    const per = remelt.in.reduce((a, [g, n]) => a + v(g) * n, 0) / 2; // what the scrap in a crate of iron is worth
    expect(per).toBeLessThan(GOOD_INFO.iron.base); expect(BASIC_VALUE.scrap * 12 / 2).toBeLessThan(GOOD_INFO.iron.base);
    const wire = PLANTS.wiremill.recipes.find((r) => r.out[0] === 'wire')!;
    expect(wire.in).toEqual([['iron', 1]]); expect(PLANTS.wiremill.recipes[0].out[0]).toBe('cable'); // old recipe indexes kept
    expect(BASIC_VALUE.wire).toBeGreaterThan(BASIC_VALUE.scrap);
  });
});
