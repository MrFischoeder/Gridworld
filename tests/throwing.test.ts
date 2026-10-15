import { describe, it, expect } from 'vitest';
import { THROW, THROWABLES, GRENADE, throwKind, throwSpeed, throwShare, throwVelocity, landing, lobVelocity, grenadeHarm } from '../src/gen/throwing';
import { ITEMS } from '../src/data/items';
import { ORDERS } from '../src/data/orders';

describe('throwing (W4)', () => {
  it('a longer hold throws harder, up to a full swing', () => {
    expect(throwSpeed(0)).toBe(THROW.min);
    expect(throwSpeed(THROW.charge * 0.5)).toBeGreaterThan(THROW.min);
    expect(throwSpeed(10)).toBe(THROW.max);
    expect(throwShare(10)).toBe(1);
  });
  it('a level full swing lands some 20-40 m off on flat ground, a tap much nearer', () => {
    const flat = () => 0, from: [number, number, number] = [0, 1.5, 0];
    const far = landing(from, throwVelocity(0, 0, throwSpeed(1)), flat), near = landing(from, throwVelocity(0, 0, throwSpeed(0)), flat);
    const d = (p: number[]) => Math.hypot(p[0], p[2]);
    expect(d(far)).toBeGreaterThan(20); expect(d(far)).toBeLessThan(45);
    expect(d(near)).toBeLessThan(d(far) / 2);
    expect(far[2]).toBeLessThan(0); // yaw 0 looks along -z, like the camera
  });
  it('every throwable is an item; stones clatter, flares hiss, meat is quiet bait', () => {
    for (const k of THROWABLES) expect(ITEMS[k]).toBeTruthy();
    expect(throwKind('stone')).toBe('stone'); expect(throwKind('flare')).toBe('flare'); expect(throwKind('meatR')).toBe('meat');
    expect(THROW.noise.flare).toBeGreaterThan(THROW.noise.stone); expect(THROW.noise.meat).toBe(0);
    expect(ORDERS.some((o) => o.out === 'flare' && o.tech === '')).toBe(true);
  });
  it('W2: a lobbed grenade comes down by its target and hurts less towards the edge', () => {
    for (const [x, z] of [[8, 0], [0, -20], [15, 12]]) {
      const at = landing([0, 1.6, 0], lobVelocity([0, 1.6, 0], [x, 0, z]), () => 0, 1 / 120);
      expect(Math.hypot(at[0] - x, at[2] - z)).toBeLessThan(0.6);
    }
    expect(grenadeHarm(0)).toBe(GRENADE.dmg); expect(grenadeHarm(GRENADE.r * 0.9)).toBeLessThan(GRENADE.dmg * 0.5); expect(grenadeHarm(GRENADE.r)).toBe(0);
  });
});
