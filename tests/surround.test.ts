import { describe, it, expect } from 'vitest';
import { SURROUND, shareSlots, slotAngle, nearestSlot, heightMult, upSpread, backToWall, HEIGHT } from '../src/gen/surround';

const N = SURROUND.slots, all = () => Array(N).fill(true) as boolean[];
const ringGap = (a: number, b: number) => { const d = Math.abs(a - b) % N; return Math.min(d, N - d); };

describe('surrounding and tight places (stage W7)', () => {
  it('a group coming from one side spreads out round its target', () => {
    const bearings = [0.1, 0.2, 0.3, 0.4];
    const got = shareSlots(bearings, [0, 1, 2, 3], all());
    expect(got.every((k) => k >= 0)).toBe(true);
    for (let i = 0; i < got.length; i++) for (let j = i + 1; j < got.length; j++) expect(ringGap(got[i], got[j])).toBeGreaterThanOrEqual(3);
  });
  it('each keeps near its own side when it can', () => {
    const got = shareSlots([slotAngle(0), slotAngle(6)], [0, 1], all());
    expect(got).toEqual([0, 6]);
  });
  it('back to a wall: only the open half is used, the rest wait', () => {
    const open = all().map((_, k) => k >= 3 && k <= 9); // seven places open
    const got = shareSlots([0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => i * 0.7), [0, 1, 2, 3, 4, 5, 6, 7, 8], open);
    expect(got.filter((k) => k >= 0).every((k) => open[k])).toBe(true);
    expect(got.filter((k) => k < 0).length).toBe(2);
  });
  it('in a passage they come one at a time from each end', () => {
    const open = all().map((_, k) => k === 0 || k === 6);
    const got = shareSlots([0, 0.2, 0.4, 3.1, 3.3], [0, 1, 2, 3, 4], open);
    expect(got.filter((k) => k >= 0).sort()).toEqual([0, 6]);
    expect(got.filter((k) => k < 0).length).toBe(3);
  });
  it('the nearest place to a bearing wraps round', () => {
    expect(nearestSlot(Math.PI * 2 - 0.01)).toBe(0);
    expect(nearestSlot(Math.PI)).toBe(6);
  });
  it('a height counts more, shooting uphill scatters more', () => {
    expect(heightMult(0)).toBe(1);
    expect(heightMult(HEIGHT.from)).toBe(1);
    expect(heightMult(3)).toBeGreaterThan(1);
    expect(heightMult(20)).toBeCloseTo(HEIGHT.max);
    expect(upSpread(1)).toBe(0);
    expect(upSpread(5)).toBeGreaterThan(0);
    expect(backToWall(SURROUND.wall)).toBe(true);
    expect(backToWall(1)).toBe(false);
  });
});
