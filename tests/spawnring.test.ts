import { describe, it, expect } from 'vitest';
import { SPAWN, ringOf, leadOf } from '../src/gen/spawnring';

describe('the spawn ring (L1)', () => {
  it('begins past what the eye makes out, by day and by night', () => {
    const day = ringOf(167), night = ringOf(112), fogged = ringOf(40);
    expect(day[0]).toBeGreaterThan(167); expect(day[1] - day[0]).toBe(SPAWN.span);
    expect(night[0]).toBeGreaterThan(112); expect(night[0]).toBeLessThan(day[0]);
    expect(fogged[0]).toBe(SPAWN.near[0]); // never closer than 120 m
    expect(ringOf(900)[0]).toBe(SPAWN.near[1]);
  });
  it('a foe goes only well beyond the ring, never inside it', () => {
    expect(SPAWN.despawn).toBeGreaterThan(ringOf(167)[1]);
    expect(SPAWN.hard).toBeGreaterThan(SPAWN.despawn);
    expect(SPAWN.minPlayer).toBeLessThanOrEqual(SPAWN.near[0]);
    expect(SPAWN.threat).toBeGreaterThanOrEqual(ringOf(167)[1]);
  });
  it('newcomers aim a little ahead of a moving player', () => {
    expect(leadOf(0)).toBe(0); expect(leadOf(3)).toBe(60); expect(leadOf(30)).toBe(SPAWN.leadMax);
  });
});
