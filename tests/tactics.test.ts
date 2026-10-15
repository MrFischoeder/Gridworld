import { describe, it, expect } from 'vitest';
import { TACTICS, hitMult, fromOf } from '../src/gen/tactics';
import { CREATURES } from '../src/data/creatures';
import { ROBOTS } from '../src/data/robots';

describe('every foe has its strong and weak sides (stage W1)', () => {
  it('covers every creature, machine and bandit', () => {
    for (const k of [...Object.keys(CREATURES), ...Object.keys(ROBOTS), 'gunner', 'bruiser', 'leader', 'drone']) expect(TACTICS[k as keyof typeof TACTICS]).toBeDefined();
  });
  it('the Bramble shrugs off the front and bleeds from behind', () => {
    expect(fromOf(1)).toBe('front'); expect(fromOf(-1)).toBe('back'); expect(fromOf(0)).toBe('side');
    expect(hitMult('bramble', 1, 0, false).k).toBeCloseTo(0.4, 5);
    expect(hitMult('bramble', -1, 0, false).k).toBeGreaterThan(1.5);
    expect(hitMult('bramble', -1, -0.8, false).spot).toBe(true); // the soft belly
  });
  it('a Sentinel wants a head shot, an Artillery Walker a blade up close', () => {
    expect(hitMult('sentinel', 0, 0.9, false).k).toBeCloseTo(2, 5);
    expect(hitMult('sentinel', 0, 0, true).k).toBeLessThan(1);
    expect(hitMult('artillery', 0, null, true).k).toBeGreaterThan(1.5);
  });
  it('a drone has no front or back; no foe is made immune', () => {
    expect(hitMult('drone', NaN, 0, false).from).toBe(null);
    for (const t of Object.values(TACTICS)) for (const v of [t.front, t.side, t.back, t.gun, t.melee]) expect(v).toBeGreaterThanOrEqual(0.4);
  });
});
