import { describe, it, expect } from 'vitest';
import { visibility, reach, awareness, STEALTH, type Exposure } from '../src/gen/stealth';

const day: Exposure = { crouch: false, speed: 5, sprint: false, light: 1, under: false, fog: 0, rain: 0, shot: Infinity };

describe('sneaking', () => {
  it('crouching, keeping still, the night and the fog hide you; sprinting and shooting give you away', () => {
    const walk = visibility(day);
    expect(walk).toBeCloseTo(1, 5);
    expect(visibility({ ...day, crouch: true })).toBeCloseTo(0.5, 5);
    expect(visibility({ ...day, crouch: true, speed: 0 })).toBeLessThanOrEqual(0.4);
    expect(visibility({ ...day, light: 0 })).toBeLessThan(walk);
    expect(visibility({ ...day, fog: 1 })).toBeLessThan(walk);
    expect(visibility({ ...day, sprint: true, speed: 9 })).toBeGreaterThan(walk);
    expect(visibility({ ...day, shot: 0 })).toBeGreaterThan(walk);
    expect(visibility({ ...day, crouch: true, speed: 0, light: 0, fog: 1 })).toBeGreaterThanOrEqual(STEALTH.min);
  });
  it('a foe sees far ahead, badly behind; hunting it looks further and all round', () => {
    expect(reach(30, 1, 1, false)).toBe(30);
    expect(reach(30, 1, -1, false)).toBeLessThan(15);
    expect(reach(30, 1, -1, true)).toBeGreaterThan(reach(30, 1, -1, false));
    expect(reach(30, 0.5, 1, false)).toBe(15);
  });
  it('awareness takes a while at the edge of sight, comes at once up close, and fades out of sight', () => {
    let a = 0, t = 0;
    while (a < STEALTH.spotted && t < 10) { a = awareness(a, 0.1, true, 28, 30, false); t += 0.1; }
    expect(t).toBeGreaterThan(1.2); // a moment to slip away
    expect(awareness(0, 0.1, true, 1.5, 30, false)).toBeGreaterThanOrEqual(STEALTH.spotted);
    let b = 0.9; for (let i = 0; i < 50; i++) b = awareness(b, 0.1, false, 20, 30, false);
    expect(b).toBe(0);
    // hunting it forgets slowly
    let h = 1; for (let i = 0; i < 50; i++) h = awareness(h, 0.1, false, 20, 30, true);
    expect(h).toBeGreaterThan(0.6);
  });
});
