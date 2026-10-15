import { describe, it, expect } from 'vitest';
import { condOf, condTime, bleedDps, condMult, playerBleed, COND, BLEED, PLAYER_COND, POISE } from '../src/gen/conditions';

describe('conditions (stage W5)', () => {
  it('a light hit does nothing, a heavy one staggers, a sledge fells the light ones', () => {
    expect(condOf('ravager', 0.5, 5, { impact: 1 })).toBeNull();
    expect(condOf('bramble', 6, 16, { impact: 1 })).toBe('stagger');
    expect(condOf('ravager', 2, 5, { impact: 1.6, knock: true })).toBe('down');
    expect(condOf('bramble', 10, 16, { impact: 1.6, knock: true })).toBe('stagger'); // too big to fell
    expect(condOf('sentinel', 10, 26, { impact: 1.6, knock: true })).toBe('stagger');
    expect(condOf('assault', 5, 34, { impact: 1, cut: true })).toBeNull(); // a blade does not shake it
    expect(condOf('assault', 10, 34, { impact: 1.6, knock: true })).toBe('stagger'); // a sledge does, but never fells it
  });
  it('a blaster bolt never staggers a heavy machine', () => {
    expect(condOf('sentinel', 1.5, 26, { impact: 1 })).toBeNull();
  });
  it('EMP short-circuits machines only, heavy ones for less time', () => {
    expect(condOf('guardian', 3, 7, { impact: 0, emp: true })).toBe('stun');
    expect(condOf('drone', 3, 3, { impact: 0, emp: true })).toBe('stun');
    expect(condOf('ravager', 3, 5, { impact: 0, emp: true })).toBeNull();
    expect(condOf('gunner', 3, 5, { impact: 0, emp: true })).toBeNull();
    expect(condTime('assault', 'stun')).toBeLessThan(condTime('scout', 'stun'));
    expect(condTime('scout', 'down')).toBe(COND.down);
  });
  it('bleeding grows with cuts and is capped', () => {
    const a = bleedDps(0, 5, 16), b = bleedDps(a, 5, 16);
    expect(a).toBeCloseTo(5 * BLEED.share);
    expect(b).toBeGreaterThan(a);
    expect(bleedDps(100, 50, 16)).toBeCloseTo(16 * BLEED.cap);
  });
  it('the extra while down or short-circuited, and the player bleeding', () => {
    expect(condMult('down')).toBeGreaterThan(1);
    expect(condMult('stun')).toBeGreaterThan(1);
    expect(condMult('stagger')).toBe(1);
    expect(condMult('')).toBe(1);
    expect(playerBleed(10)).toBeCloseTo(PLAYER_COND.bleed.max * PLAYER_COND.bleed.dps);
    for (const k of Object.values(POISE)) expect(k).toBeGreaterThan(0);
  });
});
