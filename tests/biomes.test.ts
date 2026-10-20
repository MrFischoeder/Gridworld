import { describe, it, expect } from 'vitest';
import { biomeAt, BIOME_KINDS, type BiomeHere } from '../src/gen/biomes';
import { BIOMES } from '../src/gen/biomes';
import { PL } from '../src/i18n/pl';
import { WORLD_W, X_MIN, POLAR_Z } from '../src/gen/regions';

const survey = (world: number, step = 1500) => {
  const n: Partial<Record<BiomeHere, number>> = {};
  for (let x = X_MIN; x < X_MIN + WORLD_W; x += step) for (let z = -POLAR_Z + 500; z < POLAR_Z; z += step) { const b = biomeAt(world, x, z); n[b] = (n[b] ?? 0) + 1; }
  return n;
};

describe('biomes (0.231)', () => {
  it('the same spot gives the same biome', () => {
    for (const [x, z] of [[1234, 5678], [-20000, 9000], [40000, -15000]]) expect(biomeAt(7, x, z)).toBe(biomeAt(7, x, z));
  });
  it('Gridholm stands in temperate land', () => {
    for (const w of [1, 7, 12345, -42]) for (const [x, z] of [[0, 0], [600, 300], [-900, -1200], [2000, 1500]]) expect(['plains', 'forest', 'coast', 'swamp']).toContain(biomeAt(w, x, z));
  });
  it('every biome has its Polish name', () => { for (const b of Object.values(BIOMES)) expect(PL[b.name], b.name).toBeTruthy(); });
  it('the ice caps are ice', () => { expect(biomeAt(3, 1000, POLAR_Z + 500)).toBe('ice'); expect(biomeAt(3, 1000, -POLAR_Z - 500)).toBe('ice'); });
  it('every biome turns up on a planet', () => {
    const n = survey(12345);
    for (const b of BIOME_KINDS) expect(n[b] ?? 0, b).toBeGreaterThan(0);
  }, 120000);
});

import { biomeTint, treeIn, BIOME_LOOK } from '../src/gen/biomes';
describe('biome looks (0.232)', () => {
  it('the ground colour changes smoothly (no jumps between neighbouring vertices)', () => {
    let worst = 0;
    for (let x = 5000; x < 9000; x += 2) { const a = biomeTint(7, x, 3000), b = biomeTint(7, x + 2, 3000); worst = Math.max(worst, Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2])); }
    expect(worst).toBeLessThan(0.12);
  });
  it('a desert grows a few cacti, a forest every tree, and no great trees stand in the tundra', () => {
    const n = (b: Parameters<typeof treeIn>[0], big = false) => Array.from({ length: 1000 }, (_, i) => treeIn(b, i * 7919, big)).filter(Boolean).length;
    expect(n('forest')).toBe(1000);
    expect(n('desert')).toBeGreaterThan(150); expect(n('desert')).toBeLessThan(300);
    expect(treeIn('desert', 3, false)?.look ?? 'cactus').toBe('cactus');
    expect(n('tundra', true)).toBe(0);
    expect(Object.keys(BIOME_LOOK).length).toBe(13);
  });
});
