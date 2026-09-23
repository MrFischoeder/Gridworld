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
