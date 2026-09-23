import { describe, it, expect } from 'vitest';
import { clockOf, fmtClock, sunHeight, daylight, twilight, boardPeriod, nextPosting, START_TIME, DAY } from '../src/core/time';

describe('game clock', () => {
  it('counts days and hours', () => {
    expect(fmtClock(START_TIME)).toBe('Day 1, 08:00');
    expect(clockOf(DAY * 2 + 13 * 60 + 5)).toEqual({ day: 3, h: 13, m: 5 });
  });
  it('the sun rises at 6, peaks at noon, sets at 18', () => {
    expect(sunHeight(6 * 60)).toBeCloseTo(0);
    expect(sunHeight(12 * 60)).toBeCloseTo(1);
    expect(sunHeight(18 * 60)).toBeCloseTo(0);
    expect(sunHeight(0)).toBeCloseTo(-1);
    expect(daylight(12 * 60)).toBe(1);
    expect(daylight(0)).toBe(0);
    expect(daylight(DAY * 5 + 12 * 60)).toBe(1);
    expect(twilight(18 * 60)).toBeGreaterThan(0.9);
    expect(twilight(12 * 60)).toBeLessThan(0.01);
  });
  it('the board posts every 6 hours', () => {
    expect(boardPeriod(5 * 60 + 59)).toBe(0);
    expect(boardPeriod(6 * 60)).toBe(1);
    expect(nextPosting(START_TIME)).toBe(12 * 60);
  });
});
