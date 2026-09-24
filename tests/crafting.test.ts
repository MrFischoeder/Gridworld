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
    // the materials free their room: six logs and four stones (44 L, overfull) become one 20 L workbench kit
    const full = inv({ k: 'log', n: 6 }, { k: 'stone', n: 4 });
    expect(craft(full, rec('benchkit'), 40)).toBe('');
    // but not when a tire and engine parts (28 L) leave too little room for it
    const tight = inv({ k: 'log', n: 6 }, { k: 'stone', n: 4 }, { k: 'wheelL', n: 1 }, { k: 'engine', n: 1 });
    const before = JSON.stringify(tight);
    expect(craft(tight, rec('benchkit'), 40)).toBe('room');
    expect(JSON.stringify(tight)).toBe(before);
  });
  it('keeps metalwork at the forge', () => {
    expect(canUseAt(rec('plating'), 'bench')).toBe(false);
    expect(canUseAt(rec('plating'), 'forge')).toBe(true);
    expect(canUseAt(rec('hatchet'), 'bench')).toBe(true);
    expect(hasAll(inv({ k: 'scrap', n: 5 }), rec('engine'))).toBe(true);
    for (const r of RECIPES) for (const [k] of r.needs) expect(ITEMS[k], k).toBeTruthy();
  });
});
