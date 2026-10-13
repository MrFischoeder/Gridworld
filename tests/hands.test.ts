import { describe, it, expect } from 'vitest';
import { OFF_HAND, SHIELD, TWO_HANDED, INV_SIZE, WEAPON_KIND, ITEMS, type ItemKey } from '../src/data/items';
import { loadChar, newChar, SAVE_KEY } from '../src/save';

describe('two hands and the bigger backpack (0.201)', () => {
  it('long guns, the spear and the sledge take both hands; the pistol and the blades one', () => {
    for (const k of ['blaster', 'smg', 'shotgun', 'rifle', 'spear', 'sledge'] as ItemKey[]) expect(TWO_HANDED.has(k)).toBe(true);
    for (const k of ['pistol', 'blade', 'machete', 'hatchet'] as ItemKey[]) expect(TWO_HANDED.has(k)).toBe(false);
    for (const k of Object.keys(WEAPON_KIND) as ItemKey[]) expect(ITEMS[k]).toBeDefined();
  });
  it('the other hand takes the lights and the shields, and shields soak a share of a hit', () => {
    for (const k of ['flashlight', 'oillamp', 'firebrand', 'woodshield', 'riotshield'] as ItemKey[]) expect(OFF_HAND.has(k)).toBe(true);
    expect(SHIELD.woodshield!).toBeGreaterThan(0); expect(SHIELD.riotshield!).toBeGreaterThan(SHIELD.woodshield!);
    for (const k of OFF_HAND) expect(TWO_HANDED.has(k)).toBe(false);
  });
  it('a new character has 24 backpack slots and an empty other hand; an old save grows to them', () => {
    const c = newChar();
    expect(INV_SIZE).toBe(24); expect(c.inv.length).toBe(24); expect(c.off).toEqual([null]);
    const old = { ...c, inv: c.inv.slice(0, 12), settlementRules: 1 } as Record<string, unknown>;
    (old.inv as unknown[])[3] = { k: 'log', n: 2 }; delete old.off;
    const raw = JSON.stringify(old), back = loadChar({ getItem: (k: string) => (k === SAVE_KEY ? raw : null) });
    expect(back.inv.length).toBe(24); expect(back.inv[3]).toEqual({ k: 'log', n: 2 }); expect(back.off).toEqual([null]);
  });
});
