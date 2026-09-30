import { describe, it, expect } from 'vitest';
import { CREATURES, DROPS, FLYERS, SWIMMERS, type CreatureKind } from '../src/data/creatures';
import { ALPHA } from '../src/gen/quests';
import { ITEMS } from '../src/data/items';
import { NOURISH } from '../src/data/survival';

describe('creatures', () => {
  it('every kind has its drops (real items), a quest leader name, and is a flyer, a swimmer or walks', () => {
    for (const k of Object.keys(CREATURES) as CreatureKind[]) {
      for (const [i] of DROPS[k]) expect(ITEMS[i], `${k}: ${i}`).toBeTruthy();
      expect(ALPHA[k]).toBeTruthy();
    }
    expect(FLYERS).toContain('skitter'); expect(SWIMMERS).toEqual(['lurker', 'silverfin']);
    expect(FLYERS.some((k) => SWIMMERS.includes(k))).toBe(false);
  });
  it('the small fliers are weak and the sea gives fish to eat', () => {
    expect(CREATURES.skitter.hp).toBeLessThan(CREATURES.leechwing.hp);
    expect(CREATURES.skitter.damage).toBeLessThan(CREATURES.gnawer.damage);
    expect(CREATURES.silverfin.damage).toBe(0);
    expect(DROPS.silverfin.map(([k]) => k)).toContain('fishR'); expect(NOURISH.fishR?.kcal).toBeGreaterThan(0);
  });
});
