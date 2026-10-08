import { describe, it, expect } from 'vitest';
import { allVillages, GRIDHOLM_ID, villageSeed } from '../src/gen/regions';
import { projectProblem, buildProject, sawLevel, SAW, HAND_PLANKS, optionalProjects, tutorialStep } from '../src/gen/settlement';
import { sawStock, deposit, holdOf } from '../src/gen/hall';
import { siteKw } from '../src/gen/energy';
import { postsOf } from '../src/gen/workforce';
import type { TownState } from '../src/gen/town';

const world = 12345, home = allVillages(world).find((v) => v.id === GRIDHOLM_ID)!, seed = villageSeed(world, home);

describe('the sawmill (0.170)', () => {
  it('comes right after the power plant, then its circular and band saws beside the tutorial', () => {
    const s = { farms: 2, settlement: { v: 1, deposits: { kind: 'lumber', v: 2, oil: false, grove: true } } } as TownState;
    expect(projectProblem(s, 'sawmill')).toMatch(/power/);
    s.settlement!.done = { power: true };
    expect(tutorialStep(s)?.project).toBe('sawmill'); expect(projectProblem(s, 'sawmill')).toBe('');
    expect(buildProject(s, 'sawmill', () => 99).built).toBe(true);
    expect(sawLevel(s)).toBe(1); expect(tutorialStep(s)?.project).toBe('warehouse');
    expect(optionalProjects(s)).toEqual([]); // nothing beside the tutorial before the warehouse
    s.settlement!.done!.warehouse = true;
    expect(optionalProjects(s)).toEqual(['refinery', 'fuelpump', 'charger', 'sawmill2', 'furnace']);
    expect(buildProject(s, 'sawmill2', () => 99).built).toBe(true); expect(sawLevel(s)).toBe(2);
    expect(optionalProjects(s)).toEqual(['refinery', 'fuelpump', 'charger', 'sawmill3', 'furnace']);
    expect(buildProject(s, 'sawmill3', () => 99).built).toBe(true); expect(sawLevel(s)).toBe(3);
    expect(SAW.perLog).toEqual([0, 6, 7, 8]); expect(HAND_PLANKS).toBe(4);
    expect(postsOf(s).some((p) => p.kind === 'sawmill')).toBe(true);
  });
  it('draws power by its saws and cuts the village\'s logs into planks in the hold', () => {
    const s = { farms: 2, people: { n: 60, t: 0, tg: 60 }, settlement: { v: 1, deposits: { kind: 'lumber', v: 2, oil: false, grove: true }, done: { power: true, warehouse: true } } } as TownState;
    const before = siteKw(world, home, seed, s);
    s.settlement!.done!.sawmill = true;
    expect(siteKw(world, home, seed, s) - before).toBe(SAW.kw[1]);
    deposit(s, 'log', 10);
    s.settlement!.sawnAt = 0;
    expect(sawStock(world, home, seed, s, 0)).toBe(0);
    const cut = sawStock(world, home, seed, s, SAW.batch * 4);
    expect(cut % SAW.perLog[1]).toBe(0); expect(cut).toBeGreaterThan(0);
    expect(holdOf(s, 'planks')).toBe(cut); expect(holdOf(s, 'log')).toBe(10 - cut / SAW.perLog[1]);
    expect(sawStock(world, home, seed, s, SAW.batch * 4)).toBe(0); // no batch twice
  });
});
