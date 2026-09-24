import { describe, it, expect } from 'vitest';
import { RECIPES, craft, hasAll, canUseAt } from '../src/data/crafting';
import { ITEMS } from '../src/data/items';
import type { Slot } from '../src/save';

const inv = (...s: (Slot | null)[]) => Array.from({ length: 12 }, (_, i) => s[i] ?? null);
const rec = (k: string) => RECIPES.find((r) => r.out === k)!;

describe('crafting', () => {
  it('uses up the materials and puts the result in the backpack', () => {
    const b = inv({ k: 'log', n: 3 }, { k: 'stone', n: 1 }, { k: 'stone', n: 4 });
    expect(craft(b, rec('pickaxe'), 40)).toBe('');
    expect(b.slice(0, 3)).toEqual([{ k: 'log', n: 2 }, { k: 'pickaxe', n: 1 }, { k: 'stone', n: 2 }]); // the small stack went first, the tool took its slot
  });
  it('refuses without the materials or without room, and leaves the backpack as it was', () => {
    const b = inv({ k: 'log', n: 1 });
    expect(craft(b, rec('firekit'), 40)).toBe('missing');
    expect(b[0]).toEqual({ k: 'log', n: 1 });
    // the materials free their room: two stones and a scrap make a hatchet even in a full backpack
    const full = inv({ k: 'log', n: 6 }, { k: 'stone', n: 4 }, { k: 'scrap', n: 1 });
    expect(craft(full, rec('hatchet'), 44)).toBe('');
    // but not when the rest leaves too little room for it
    const tight = inv({ k: 'log', n: 6 }, { k: 'stone', n: 2 }, { k: 'scrap', n: 1 }, { k: 'engine', n: 1 });
    const before = JSON.stringify(tight);
    expect(craft(tight, rec('hatchet'), 39)).toBe('room');
    expect(JSON.stringify(tight)).toBe(before);
    // a workbench kit is too big for the backpack: it comes out into your hands, which must be free
    const kit = inv({ k: 'log', n: 6 }, { k: 'stone', n: 4 });
    expect(craft(kit, rec('benchkit'), 40, [{ k: 'blaster', n: 1 }])).toBe('hands');
    const hands: ({ k: 'benchkit'; n: number } | null)[] = [null];
    expect(craft(kit, rec('benchkit'), 40, hands)).toBe('');
    expect(hands[0]).toEqual({ k: 'benchkit', n: 1 });
    expect(kit.every((s) => !s)).toBe(true);
  });
  it('keeps metalwork at the forge', () => {
    expect(canUseAt(rec('plating'), 'bench')).toBe(false);
    expect(canUseAt(rec('plating'), 'forge')).toBe(true);
    expect(canUseAt(rec('hatchet'), 'bench')).toBe(true);
    expect(hasAll(inv({ k: 'scrap', n: 4 }, { k: 'circuit', n: 1 }), rec('engine'))).toBe(true);
    expect(hasAll(inv({ k: 'scrap', n: 9 }), rec('engine'))).toBe(false);
    for (const r of RECIPES) for (const [k] of r.needs) expect(ITEMS[k], k).toBeTruthy();
  });
});
