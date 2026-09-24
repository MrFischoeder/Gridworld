import { describe, it, expect } from 'vitest';
import { snap, partProblem, baseHitLocal, solids, floorLocal, rayLocal, refund, stairDir, type Part } from '../src/gen/base';

const wall = (gx: number, gz: number, d: number, lv = 0, k: Part['k'] = 'wallW'): Part => ({ k, gx, gz, d, lv });
describe('building on a claim', () => {
  it('snaps walls to the nearest cell edge and floors to the cell', () => {
    expect(snap('wall', 3, 2.2)).toEqual({ gx: 1, gz: 1, d: 0 });
    expect(snap('wall', 3.9, 3)).toEqual({ gx: 2, gz: 1, d: 1 });
    expect(snap('roof', 3, 3)).toEqual({ gx: 1, gz: 1, d: 0 });
    expect(stairDir(0)).toBe(3); // facing north (-v): stairs climb north
    expect(stairDir(-Math.PI / 2)).toBe(0); // facing east
  });
  it('keeps parts on the levelled ground, off the flagpole and out of each other', () => {
    const w = wall(1, 1, 0);
    expect(partProblem([], w)).toBeNull();
    expect(partProblem([w], { k: 'doorM', gx: 1, gz: 1, d: 0, lv: 0 })).toMatch(/already/);
    expect(partProblem([], wall(0, 0, 0))).toMatch(/flagpole/);
    expect(partProblem([], wall(6, 0, 0))).toMatch(/levelled/);
  });
  it('needs support for upper storeys', () => {
    const roof: Part = { k: 'roofW', gx: 1, gz: 1, d: 0, lv: 1 };
    expect(partProblem([], roof)).toMatch(/wall under/);
    expect(partProblem([], { ...roof, lv: 0 })).toMatch(/look up/);
    expect(partProblem([wall(1, 1, 0)], roof)).toBeNull();
    // a floor next to a floor, a wall on a floor, a wall on a wall
    expect(partProblem([wall(1, 1, 0), roof], { ...roof, gx: 2 })).toBeNull();
    expect(partProblem([wall(1, 1, 0), roof], wall(1, 1, 1, 1))).toBeNull();
    expect(partProblem([wall(1, 1, 0)], wall(1, 1, 0, 1))).toBeNull();
    expect(partProblem([], wall(1, 1, 0, 1))).toMatch(/floor beside it/);
    // stairs need headroom
    const stairs: Part = { k: 'stairsW', gx: 1, gz: 1, d: 0, lv: 0 };
    expect(partProblem([wall(1, 1, 0), roof], stairs)).toMatch(/headroom/);
    expect(partProblem([wall(1, 1, 0), stairs], roof)).toMatch(/stairwell/);
  });
  it('blocks walking through walls and shut doors, not open doorways; floors carry you and stop your head', () => {
    const door: Part = { k: 'doorW', gx: 1, gz: 1, d: 0 };
    expect(baseHitLocal([door], 3, 0, 2, 0.3)).toBe(true);
    door.open = true;
    expect(baseHitLocal([door], 3, 0, 2, 0.3)).toBe(false);
    expect(baseHitLocal([door], 2.1, 0, 2, 0.3)).toBe(true); // the jamb
    expect(baseHitLocal([wall(1, 1, 1)], 2.3, 0, 3, 0.3)).toBe(true);
    expect(baseHitLocal([wall(1, 1, 1)], 2.3, 3, 3, 0.3)).toBe(false); // above it
    const roof: Part = { k: 'roofW', gx: 1, gz: 1, d: 0, lv: 1 };
    expect(baseHitLocal([roof], 3, 1.2, 3, 0.3)).toBe(true); // jumping into it from below
    expect(baseHitLocal([roof], 3, 3, 3, 0.3)).toBe(false); // standing on it
    expect(floorLocal([roof], 3, 3, 3.5)).toBe(3);
    expect(floorLocal([roof], 3, 3, 1)).toBe(-Infinity); // out of reach from the ground
    const stairs: Part = { k: 'stairsW', gx: 1, gz: 1, d: 0, lv: 0 };
    expect(floorLocal([stairs], 2, 3, 9)).toBeCloseTo(0); expect(floorLocal([stairs], 4, 3, 9)).toBeCloseTo(1.5); expect(floorLocal([stairs], 6, 3, 9)).toBeCloseTo(3);
  });
  it('stops rays at walls and floors', () => {
    const boxes = solids([wall(1, 1, 1)]);
    expect(rayLocal([0, 1, 3], [1, 0, 0], 20, boxes)).toBeCloseTo(1.9);
    expect(rayLocal([0, 5, 3], [1, 0, 0], 20, boxes)).toBe(20); // over the top
    expect(rayLocal([3, 0.5, 3], [0, 1, 0], 20, solids([{ k: 'roofM', gx: 1, gz: 1, d: 0, lv: 1 }]))).toBeCloseTo(2.3);
  });
  it('gives back half the materials', () => {
    expect(refund('wallW')).toEqual([['planks', 2], ['nails', 1]]);
    expect(refund('roofM')).toEqual([['scrap', 1]]);
  });
});
