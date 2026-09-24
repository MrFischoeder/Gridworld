import { describe, it, expect } from 'vitest';
import { putItems, moveStack } from '../src/inventory';
import type { Slot } from '../src/save';

const slots = (n: number, init: (Slot | null)[] = []) => Array.from({ length: n }, (_, i) => init[i] ?? null);

describe('inventory moves', () => {
  it('tops up stacks before using empty slots, respecting stack limits', () => {
    const s = slots(3, [{ k: 'medkit', n: 4 }]);
    expect(putItems(s, 'medkit', 3)).toBe(0);
    expect(s).toEqual([{ k: 'medkit', n: 5 }, { k: 'medkit', n: 2 }, null]);
  });
  it('reports what does not fit', () => {
    const s = slots(1, [{ k: 'lens', n: 1 }]);
    expect(putItems(s, 'shield', 1)).toBe(1);
  });
  it('moves a whole stack, or only the part that fits', () => {
    const chest = slots(2, [{ k: 'bread', n: 6 }, { k: 'lens', n: 1 }]);
    const pack = slots(2, [{ k: 'bread', n: 7 }, { k: 'emp', n: 1 }]);
    expect(moveStack(chest, 0, pack)).toBe(2); // bread stacks to 9
    expect(chest[0]).toEqual({ k: 'bread', n: 4 });
    expect(moveStack(chest, 1, pack)).toBe(0); // no room for a relic
    expect(chest[1]).toEqual({ k: 'lens', n: 1 });
    expect(moveStack(pack, 1, chest)).toBe(0);
    expect(moveStack(chest, 5, pack)).toBe(0);
  });
});

describe('weight and bulk', () => {
  it('fill the backpack only as far as its litres allow', async () => {
    const { putItems, bulkOf, weightOf, dropStack, moveStack } = await import('../src/inventory');
    const inv: (import('../src/save').Slot | null)[] = Array(12).fill(null);
    expect(putItems(inv, 'wheelL', 3, 40)).toBe(2); // one 22 L tire fits in 40 L, two do not
    expect(bulkOf(inv)).toBe(22); expect(weightOf(inv)).toBe(12);
    const box: (import('../src/save').Slot | null)[] = [{ k: 'engine', n: 5 }, { k: 'wheelH', n: 1 }, null];
    // 18 L left: three Engine Parts (6 L each) come over, two stay in the box
    expect(moveStack(box, 0, inv, 40)).toBe(3); expect(box[0]).toEqual({ k: 'engine', n: 2 });
    // a Heavy Tire cannot be dragged in, nor swapped for the light one (36 L > 22 L)
    expect(dropStack(box, 1, inv, 5, 40)).toBe(false);
    const i = inv.findIndex((s) => s?.k === 'wheelL');
    expect(dropStack(box, 1, inv, i, 40)).toBe(false);
    // without a cap (a container) anything goes
    expect(dropStack(inv, i, box, 2)).toBe(true);
  });
});

describe('eating', () => {
  it('stops at a full stomach, and light rich food feeds more than bulky fruit', async () => {
    const { cantEat, NOURISH, STOMACH } = await import('../src/data/survival');
    const { BULK } = await import('../src/data/items');
    expect(cantEat(0.5, 1000, 1.8)).toBe('full');
    expect(cantEat(0.35, 1000, 1.6)).toBe('');
    expect(cantEat(0.1, 2990, 0)).toBe('sated');
    const perStomach = (k: 'pod' | 'cap' | 'meatC' | 'ncrys') => NOURISH[k].kcal! / BULK[k][0] * STOMACH.cap;
    expect(perStomach('meatC')).toBeGreaterThan(3 * perStomach('pod'));
    expect(perStomach('cap')).toBeLessThan(1000); // a stomach full of mushrooms is not a day's food
  });
});
