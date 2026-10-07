import { describe, it, expect } from 'vitest';
import { allVillages, GRIDHOLM_ID, villageSeed } from '../src/gen/regions';
import { projectProblem, buildProject, furnaceLevel, FURNACE, optionalProjects } from '../src/gen/settlement';
import { smeltStock, deposit, holdOf } from '../src/gen/hall';
import { siteKw } from '../src/gen/energy';
import { postsOf } from '../src/gen/workforce';
import type { TownState } from '../src/gen/town';

const world = 12345, home = allVillages(world).find((v) => v.id === GRIDHOLM_ID)!, seed = villageSeed(world, home);
const town = (): TownState => ({ farms: 2, people: { n: 60, t: 0, tg: 60 }, settlement: { v: 1, deposits: { kind: 'lumber', v: 2, oil: false, grove: true }, done: { power: true, warehouse: true } } } as TownState);

describe('the village furnace (0.176)', () => {
  it('comes after power and the warehouse, then coke ovens and the electric arc', () => {
    const s = town(); delete s.settlement!.done!.warehouse;
    expect(projectProblem(s, 'furnace')).toMatch(/warehouse/);
    s.settlement!.done!.warehouse = true; expect(projectProblem(s, 'furnace')).toBe('');
    expect(projectProblem(s, 'furnace2')).toMatch(/coal furnace/);
    expect(buildProject(s, 'furnace', () => 99).built).toBe(true); expect(furnaceLevel(s)).toBe(1);
    expect(optionalProjects(s)).toContain('furnace2');
    expect(buildProject(s, 'furnace2', () => 99).built).toBe(true); expect(furnaceLevel(s)).toBe(2);
    expect(buildProject(s, 'furnace3', () => 99).built).toBe(true); expect(furnaceLevel(s)).toBe(3);
    expect(optionalProjects(s).some((k) => k.startsWith('furnace'))).toBe(false);
    expect(postsOf(s).some((p) => p.kind === 'furnace')).toBe(true);
  });
  it('melts ore with coal into bars, more with coke, and without coal on the arc', () => {
    const run = (lv: number) => {
      const s = town(); const d = s.settlement!.done!; d.furnace = true; if (lv >= 2) d.furnace2 = true; if (lv >= 3) d.furnace3 = true;
      s.settlement!.smeltAt = 0; deposit(s, 'ore', 20); deposit(s, 'coal', 4); deposit(s, 'scrap', 24);
      const melts = smeltStock(world, home, seed, s, 10 * 60);
      return { melts, iron: holdOf(s, 'iron'), coal: holdOf(s, 'coal'), ore: holdOf(s, 'ore'), kw: siteKw(world, home, seed, s) };
    };
    const a = run(1), b = run(2), c = run(3);
    expect(a.melts).toBeGreaterThan(0); expect(a.coal).toBe(4 - a.melts); expect(a.iron).toBe(a.melts * 2);
    expect(b.iron).toBe(b.melts * 3); expect(c.coal).toBe(4); expect(c.melts).toBeGreaterThan(0); expect(c.iron).toBe(c.melts * 3); // (the arc's 70 kW wants a power station; on the village plant alone it runs short)
    expect(c.kw - a.kw).toBe(FURNACE.kw[3] - FURNACE.kw[1]);
    // every melt pays at base prices: worked out in tests/economy (metal ladder); scrap melts after the ore
    const s = town(); s.settlement!.done!.furnace = true; s.settlement!.smeltAt = 0; deposit(s, 'scrap', 12); deposit(s, 'coal', 1);
    expect(smeltStock(world, home, seed, s, 60 * 3)).toBe(1); expect(holdOf(s, 'iron')).toBe(2); expect(holdOf(s, 'scrap')).toBe(0);
  });
});
