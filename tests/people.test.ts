import { describe, it, expect } from 'vitest';
import { basePeople, peopleAt, losePeople, staffing, workersAt, PEOPLE } from '../src/gen/people';
import type { TownState } from '../src/gen/town';

describe('village population', () => {
  it('starts at the base, which comes from the seed', () => {
    expect(basePeople(123, false)).toBe(basePeople(123, false));
    for (let s = 0; s < 50; s++) { const b = basePeople(s, false); expect(b).toBeGreaterThanOrEqual(PEOPLE.min); expect(b).toBeLessThanOrEqual(PEOPLE.min + PEOPLE.span); }
    expect(basePeople(1, true)).toBe(PEOPLE.home);
    expect(peopleAt(7, false, undefined, 5000)).toBe(basePeople(7, false));
    expect(staffing(7, false, undefined, 0)).toBe(1);
  });
  it('losses set it back and it grows back towards the base', () => {
    const s: TownState = {}, b = basePeople(9, false);
    losePeople(s, 9, false, 1000, 0, 0.5);
    expect(peopleAt(9, false, s, 1000)).toBeCloseTo(b / 2, 5);
    expect(staffing(9, false, s, 1000)).toBeCloseTo(0.5, 5);
    const later = peopleAt(9, false, s, 1000 + PEOPLE.tau), much = peopleAt(9, false, s, 1000 + 10 * PEOPLE.tau);
    expect(later).toBeGreaterThan(b / 2); expect(later).toBeLessThan(b); expect(much).toBeCloseTo(b, 0);
    expect(workersAt(9, false, s, 1000)).toBe(Math.floor(b / 2 * PEOPLE.work));
  });
});
