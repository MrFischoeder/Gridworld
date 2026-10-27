import { describe, expect, it } from 'vitest';
import { CRYSTAL_BEASTS, WILD, WILD_KINDS, wildPick, scared, provoke, temperAfter } from '../src/gen/wildlife';
import { CREATURES, DROPS, calmBeast } from '../src/data/creatures';
import { FAUNA_IDS } from '../src/models/fauna';

const stand = { vis: 1, speed: 1.5, front: 0 }, low = { vis: 0.45, speed: 1, front: 0 };

describe('(0.240) wildlife', () => {
  it('every wild kind has a creature entry, drops and a fauna model', () => {
    for (const k of WILD_KINDS) {
      expect(CREATURES[k].hp).toBeGreaterThan(0);
      expect(DROPS[k]).toBeDefined();
      if (!CRYSTAL_BEASTS.includes(k)) expect(FAUNA_IDS).toContain(WILD[k].model); // (0.277) the crystal ones are drawn by world/crystalbeasts.ts
    }
  });
  it('picks only what lives in the land, at its danger, and nothing at sea', () => {
    for (let r = 0; r < 1; r += 0.05) {
      const k = wildPick('desert', 3, r, false);
      if (k) expect(WILD[k].biomes).toContain('desert');
      const t = wildPick('plains', 0, r, false);
      if (t) expect(WILD[t].from).toBe(0);
    }
    expect(wildPick('sea', 5, 0.5, true)).toBeNull();
    // a shore animal only by the water, the giant only once nearby
    for (let r = 0; r < 1; r += 0.02) expect(wildPick('swamp', 5, r, false)).not.toBe('crestjaw');
    for (let r = 0; r < 1; r += 0.02) expect(wildPick('plains', 5, r, true, { titan: 1 })).not.toBe('titan');
  });
  it('a timid one lets you come about half as near when you keep low and slow', () => {
    const w = WILD.hexastrider;
    expect(scared(w, { d: 25, ...stand })).toBe(true);
    expect(scared(w, { d: 25, ...low })).toBe(false);
    expect(scared(w, { d: 25, vis: 1, speed: 8, front: 0 })).toBe(true);
    expect(provoke(w, { d: 1, ...stand })).toBeLessThan(0); // it never attacks
  });
  it('a wary one warns inside its ring and charges inside the strike distance', () => {
    const w = WILD.ridgeback;
    expect(provoke(w, { d: 40, ...stand })).toBeLessThan(0);
    expect(provoke(w, { d: 18, ...stand })).toBeGreaterThan(0);
    expect(provoke(w, { d: 5, ...stand })).toBeGreaterThanOrEqual(10);
    let a = 0; for (let t = 0; t < 3; t += 0.1) a = temperAfter(a, provoke(w, { d: 14, ...stand }), 0.1);
    expect(a).toBeGreaterThanOrEqual(1); // standing your ground in its ring ends in a charge
  });
  it('a touchy one lets a careful approach pass and takes a careless one badly', () => {
    const w = WILD.scorpid;
    expect(provoke(w, { d: 6, vis: 0.45, speed: 1, front: 0 })).toBeLessThan(0);
    expect(provoke(w, { d: 6, vis: 1, speed: 6, front: 0.9 })).toBeGreaterThan(0.8);
    expect(provoke(w, { d: 2, vis: 0.45, speed: 0.5, front: 0 })).toBeGreaterThan(1); // right next to it, always
  });
  it('an ambusher strikes at once from close, less far when you keep low', () => {
    const w = WILD.crestjaw;
    expect(provoke(w, { d: 7, ...stand })).toBeGreaterThanOrEqual(10);
    expect(provoke(w, { d: 7, ...low })).toBeLessThan(0);
  });
  it('a defensive one never angers on its own', () => {
    for (const k of ['titan', 'tusker'] as const) expect(provoke(WILD[k], { d: 1, vis: 1, speed: 8, front: 1 })).toBeLessThan(0);
  });
  it('wildlife counts as calm until roused', () => {
    expect(calmBeast('hexastrider', 'flee')).toBe(true);
    expect(calmBeast('ridgeback', 'roam')).toBe(true);
    expect(calmBeast('ridgeback', 'charge')).toBe(false);
    expect(calmBeast('ravager', 'roam')).toBe(false);
  });
});
