import { describe, it, expect } from 'vitest';
import { newSway, stepSway, type SwayIn } from '../src/core/sway';

/** The largest |value| of each offset over a few seconds of the given gait. */
function peak(i: SwayIn) {
  const s = newSway(), m = { up: 0, right: 0, yaw: 0, pitch: 0, roll: 0 };
  for (let k = 0; k < 600; k++) {
    stepSway(s, i, 1 / 60);
    if (k > 120) for (const f of Object.keys(m) as (keyof typeof m)[]) m[f] = Math.max(m[f], Math.abs(s[f]));
  }
  return m;
}
const base: SwayIn = { speed: 0, ground: true, run: false, crouch: false, aim: 0, winded: 0 };

describe('the body in first person', () => {
  it('standing still the view only breathes', () => {
    const p = peak(base);
    expect(p.up).toBe(0); expect(p.right).toBe(0);
    expect(p.yaw).toBeGreaterThan(0); expect(p.yaw).toBeLessThan(0.005);
  });
  it('walking rocks the view, running more, crouching less', () => {
    const walk = peak({ ...base, speed: 5 }), run = peak({ ...base, speed: 8.5, run: true }), low = peak({ ...base, speed: 2.5, crouch: true });
    expect(walk.up).toBeGreaterThan(0.02);
    expect(run.up).toBeGreaterThan(walk.up * 2); expect(run.roll).toBeGreaterThan(walk.roll * 2);
    expect(low.up).toBeLessThan(walk.up);
  });
  it('aiming steadies it, being winded does not help', () => {
    expect(peak({ ...base, aim: 1 }).yaw).toBeLessThan(peak(base).yaw * 0.4);
    expect(peak({ ...base, speed: 5, aim: 1 }).up).toBeLessThan(peak({ ...base, speed: 5 }).up * 0.4);
    expect(peak({ ...base, winded: 1 }).yaw).toBeGreaterThan(peak(base).yaw * 2);
  });
  it('in the air nothing steps', () => {
    expect(peak({ ...base, speed: 6, ground: false }).up).toBe(0);
  });
});
