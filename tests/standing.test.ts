import { describe, it, expect } from 'vitest';
import { addTrust, trustTier, shareLeft, useShare, TRUST, TRUST_TIERS } from '../src/gen/standing';
import type { TownState } from '../src/gen/town';

describe('standing in a village', () => {
  it('trust grows with help and raises the tier', () => {
    const s: TownState = {};
    expect(trustTier(s)).toBe(0); expect(shareLeft(s, 0)).toBe(0);
    expect(addTrust(s, 'wall')).toBe(-1); // 20: still a stranger
    expect(addTrust(s, 'power')).toBe(1); // 26: known
    expect(s.trust).toBe(TRUST.wall + TRUST.power);
    expect(shareLeft(s, 0)).toBe(TRUST_TIERS[1].crates);
  });
  it('the share is per game day and renews at midnight', () => {
    const s: TownState = { trust: 60 };
    expect(shareLeft(s, 100)).toBe(4);
    useShare(s, 3, 100); expect(shareLeft(s, 200)).toBe(1);
    useShare(s, 1, 300); expect(shareLeft(s, 1439)).toBe(0);
    expect(shareLeft(s, 1440)).toBe(4);
  });
  it('tiers climb in order', () => {
    for (let i = 1; i < TRUST_TIERS.length; i++) { expect(TRUST_TIERS[i].min).toBeGreaterThan(TRUST_TIERS[i - 1].min); expect(TRUST_TIERS[i].crates).toBeGreaterThan(TRUST_TIERS[i - 1].crates); }
  });
});
