import { describe, it, expect } from 'vitest';
import { MAKES, TOOLS, CELLS, matching, batches, claimedByOther, claimFresh, CLAIM } from '../src/gen/workshop';
import { ITEMS } from '../src/data/items';

describe('the workshop cells', () => {
  it('every recipe uses real items and fits the cells', () => {
    for (const m of MAKES) {
      expect(ITEMS[m.out[0]], m.id).toBeTruthy();
      expect(m.inputs.length).toBeLessThanOrEqual(CELLS.inputs);
      expect(m.tools.length).toBeLessThanOrEqual(CELLS.tools);
      for (const [k] of m.inputs) expect(ITEMS[k], k).toBeTruthy();
      for (const k of m.tools) { expect(ITEMS[k], k).toBeTruthy(); expect(TOOLS.has(k)).toBe(true); }
    }
  });
  it('a log and a saw make planks; without the saw or with something else, nothing', () => {
    const log = { k: 'log' as const, n: 1 }, saw = { k: 'saw' as const, n: 1 };
    expect(matching([log, null], [saw, null, null]).map((m) => m.id)).toEqual(['planks']);
    expect(matching([log], [null, null, null])).toEqual([]);
    expect(matching([log, { k: 'stone', n: 1 }], [saw])).toEqual([]); // a stone is no part of planks
    expect(matching([{ k: 'log', n: 3 }], [saw]).map((m) => m.id)).toContain('planks');
  });
  it('counts the batches the materials make', () => {
    const planks = MAKES.find((m) => m.id === 'planks')!;
    expect(batches(planks, [{ k: 'log', n: 2 }, { k: 'log', n: 1 }])).toBe(3);
  });
  it('a lying thing worked by another hero is theirs for a while', () => {
    const claims = { 'drop:1': { by: 'a', n: 'Ann', t: 100 } };
    expect(claimedByOther(claims, 'drop:1', 'b', 105)?.n).toBe('Ann');
    expect(claimedByOther(claims, 'drop:1', 'a', 105)).toBeNull();
    expect(claimedByOther(claims, 'drop:1', 'b', 100 + CLAIM.life + 1)).toBeNull();
    expect(claimFresh(undefined, 0)).toBe(false);
  });
});
