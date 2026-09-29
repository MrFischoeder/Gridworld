import { describe, it, expect } from 'vitest';
import { MENU, portions, priceOf, sellPortion, type Larder } from '../src/gen/foodshop';
import type { ItemKey } from '../src/data/items';
import type { TownState } from '../src/gen/town';

const larderOf = (have: Partial<Record<ItemKey, number>>): Larder => ({ has: (k) => have[k] ?? 0, take: (k, n) => { const m = Math.min(n, have[k] ?? 0); have[k] = (have[k] ?? 0) - m; return m; } });
const dish = (k: string) => MENU.find((d) => d.k === k)!;

describe('the food shop', () => {
  it('cooks a crate from the hall into portions and sells them one by one', () => {
    const s: TownState = {}, have: Partial<Record<ItemKey, number>> = { eggs: 1 }, l = larderOf(have), d = dish('eggsB');
    expect(portions(d, s, l)).toBe(d.per);
    expect(sellPortion(d, s, l)).toBe(true); expect(have.eggs).toBe(0); expect(s.pantry!.eggsB).toBe(d.per - 1);
    for (let i = 1; i < d.per; i++) expect(sellPortion(d, s, l)).toBe(true);
    expect(portions(d, s, l)).toBe(0); expect(sellPortion(d, s, l)).toBe(false);
  });
  it('makes stew from potatoes or carrots, and bakes dear bread from bought flour without grain', () => {
    const s: TownState = {}, l = larderOf({ carrots: 2 });
    expect(portions(dish('stew'), s, l)).toBe(2 * dish('stew').per);
    expect(portions(dish('cheese'), s, l)).toBe(0);
    const b = dish('bread');
    expect(portions(b, s, l)).toBe(Infinity); expect(priceOf(b, s, l)).toBe(b.fallback);
    expect(sellPortion(b, s, l)).toBe(true);
    expect(priceOf(b, s, larderOf({ grain: 1 }))).toBe(b.price);
  });
});
