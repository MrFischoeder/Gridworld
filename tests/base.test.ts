import { describe, it, expect } from 'vitest';
import { snap, partProblem, baseHitLocal, solidSegs, refund, type Part } from '../src/gen/base';

describe('building on a claim', () => {
  it('snaps walls to the nearest cell edge and roofs to the cell', () => {
    expect(snap('wall', 3, 2.2)).toEqual({ gx: 1, gz: 1, d: 0 }); // just past the line v = 2: that edge
    expect(snap('wall', 3.9, 3)).toEqual({ gx: 2, gz: 1, d: 1 }); // near the line u = 4
    expect(snap('roof', 3, 3)).toEqual({ gx: 1, gz: 1, d: 0 });
  });
  it('keeps parts on the levelled ground, off the flagpole and out of each other', () => {
    const wall: Part = { k: 'wallW', gx: 1, gz: 1, d: 0 };
    expect(partProblem([], wall)).toBeNull();
    expect(partProblem([wall], { k: 'doorM', gx: 1, gz: 1, d: 0 })).toMatch(/already/);
    expect(partProblem([wall], { k: 'roofW', gx: 1, gz: 1, d: 0 })).toBeNull(); // a roof over the cell is another slot
    expect(partProblem([], { k: 'wallW', gx: 0, gz: 0, d: 0 })).toMatch(/flagpole/);
    expect(partProblem([], { k: 'wallW', gx: 6, gz: 0, d: 0 })).toMatch(/levelled/);
  });
  it('blocks walking through walls and shut doors, not open doorways', () => {
    const door: Part = { k: 'doorW', gx: 1, gz: 1, d: 0 };
    expect(baseHitLocal([door], 3, 2, 0.3)).toBe(true); // in the shut doorway
    door.open = true;
    expect(baseHitLocal([door], 3, 2, 0.3)).toBe(false);
    expect(baseHitLocal([door], 2.1, 2, 0.3)).toBe(true); // the jamb
    expect(solidSegs([{ k: 'roofW', gx: 0, gz: 0, d: 0 }])).toEqual([]);
    expect(baseHitLocal([{ k: 'wallM', gx: 1, gz: 1, d: 1 }], 2.3, 3, 0.3)).toBe(true);
    expect(baseHitLocal([{ k: 'wallM', gx: 1, gz: 1, d: 1 }], 3, 3, 0.3)).toBe(false);
  });
  it('gives back half the materials', () => {
    expect(refund('wallW')).toEqual([['planks', 2], ['nails', 1]]);
    expect(refund('roofM')).toEqual([['scrap', 1]]);
  });
});
