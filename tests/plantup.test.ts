import { describe, it, expect } from 'vitest';
import { PLANT_LEVELS, plantLevel, plantUpPlan, handOverPlantUp, levelTech } from '../src/gen/plantup';
import { powerKind, type TownState } from '../src/gen/town';
import { baseKw } from '../src/gen/energy';
import { allVillages, villageSeed } from '../src/gen/regions';

const seedOf = (kind: string) => { for (let s = 1; s < 500; s++) if (powerKind(s) === kind) return s; throw new Error(kind); };

describe('power plant upgrades', () => {
  it('wind and solar need their plans for level 1, a generator none; level 2 needs electronics, level 3 microchips', () => {
    expect(levelTech(seedOf('wind'), {})).toBe('rotor');
    expect(levelTech(seedOf('solar'), {})).toBe('solar');
    expect(levelTech(seedOf('generator'), {})).toBeNull();
    const s: TownState = {}, seed = seedOf('wind');
    expect(plantUpPlan(seed, s, {})!.plans).toBe(false);
    expect(handOverPlantUp(seed, s, {}, () => 99).built).toBe(false);
    expect(handOverPlantUp(seed, s, { rotor: 1 }, () => 99).built).toBe(true);
    expect(plantLevel(s)).toBe(1);
    expect(plantUpPlan(seed, s, {})!.rows.map((r) => r.k)).toContain('pcore');
    expect(handOverPlantUp(seed, s, {}, () => 99).built).toBe(true);
    expect(plantUpPlan(seed, s, {})!.rows.map((r) => r.k)).toContain('microchip');
    expect(handOverPlantUp(seed, s, {}, () => 99).built).toBe(true);
    expect(plantLevel(s)).toBe(3);
    expect(plantUpPlan(seed, s, {})).toBeNull();
  });
  it('each level multiplies what the plant makes', () => {
    const v = allVillages(777)[0], seed = villageSeed(777, v), t = 12 * 60;
    const k0 = baseKw(777, v, seed, { fixed: t }, t), k2 = baseKw(777, v, seed, { fixed: t, pup: 2 }, t);
    if (k0 > 0) expect(k2 / k0).toBeCloseTo(PLANT_LEVELS[2].mult, 5);
  });
});
