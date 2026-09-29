import { describe, it, expect } from 'vitest';
import { tribute, raidOutcome, type Raid } from '../src/gen/raids';

describe('bandit tribute', () => {
  const r = (k: number, strength: number): Raid => ({ village: 5, k, t0: 0, strength, camp: { id: 1, name: 'X Camp', x: 0, z: 0 } as Raid['camp'] });
  it('asks more of a rich village and of a strong band, less behind a stone wall', () => {
    expect(tribute(r(1, 4), 1000, 0)).toBeGreaterThan(tribute(r(1, 4), 0, 0));
    expect(tribute(r(1, 6), 0, 0)).toBeGreaterThan(tribute(r(1, 2), 0, 0));
    expect(tribute(r(1, 4), 500, 2)).toBeLessThan(tribute(r(1, 4), 500, 0));
    expect(tribute(r(1, 4), 500, 0) % 10).toBe(0);
  });
  it('villages without you sometimes pay, the weak more often', () => {
    const tally = (wall: number) => { let paid = 0; for (let k = 1; k <= 400; k++) if (raidOutcome(9, r(k, 4), { wall }) === 'paid') paid++; return paid; };
    expect(tally(0)).toBeGreaterThan(tally(2));
    expect(tally(0)).toBeGreaterThan(40);
    expect(raidOutcome(9, r(3, 4), { raids: { 3: 'paid' } })).toBe('paid');
  });
});
