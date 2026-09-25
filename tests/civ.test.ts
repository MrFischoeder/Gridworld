import { describe, it, expect } from 'vitest';
import { allVillages, villageSeed, worldDist, GRIDHOLM_ID } from '../src/gen/regions';
import { industryOf, fertility } from '../src/gen/industry';
import { ringDanger } from '../src/gen/danger';
import { newCiv, civDay, MATS, type CivSeed } from '../src/gen/civ';

const W = 12345;
const seeds = (): CivSeed[] => allVillages(W).map((v) => {
  const seed = villageSeed(W, v), ind = industryOf(W, v, seed);
  return { name: v.name, x: v.x, z: v.z, industry: ind, home: v.id === GRIDHOLM_ID,
    place: { seed, danger: ringDanger(Math.max(0, worldDist(v.x, v.z, 0, 0) - 40)), fertility: fertility(W, v, seed), foodIndustry: ind === 'farm' || ind === 'fishery' } };
});

describe('civilisation layer', () => {
  it('spreads ~20 projects over the continent and puts every village in one region', () => {
    const w = newCiv(seeds());
    expect(w.projects.length).toBe(20);
    expect(w.projects.reduce((a, p) => a + p.members.length, 0)).toBe(w.villages.length);
    expect(new Set(w.projects.map((p) => p.anchor)).size).toBe(20);
  });
  it('is deterministic', () => {
    const a = newCiv(seeds(), 2), b = newCiv(seeds(), 2);
    for (let d = 0; d < 40; d++) { civDay(a); civDay(b); }
    expect(JSON.stringify(a.pool)).toBe(JSON.stringify(b.pool));
    expect(a.villages.map((v) => [v.tier, v.plants, Math.round(v.life.pop)])).toEqual(b.villages.map((v) => [v.tier, v.plants, Math.round(v.life.pop)]));
  });
  it('without players the villages process goods and rise, but no project gets past its relic stage', () => {
    const w = newCiv(seeds(), 0);
    for (let d = 0; d < 300; d++) civDay(w);
    expect(w.villages.reduce((a, v) => a + v.plants.length, 0)).toBeGreaterThan(30);
    expect(w.villages.some((v) => v.tier >= 1)).toBe(true);
    expect(w.projects.every((p) => p.stage < 3)).toBe(true);
    expect(w.chariot.stage).toBe(0);
    for (const m of MATS) { expect(Number.isFinite(w.pool.price[m])).toBe(true); expect(w.pool.stock[m]).toBeGreaterThanOrEqual(0); }
  });
  it('players carry the Chariot and finish a project with relics', () => {
    const w = newCiv(seeds(), 4);
    for (let d = 0; d < 300; d++) civDay(w);
    expect(w.chariot.stage).toBeGreaterThanOrEqual(3);
    expect(w.projects.some((p) => p.stage === 3)).toBe(true);
  });
});
