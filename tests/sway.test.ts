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

import { RECOIL, newRecoil, kickRecoil, stepRecoil } from '../src/core/sway';
describe('recoil', () => {
  const settle = (r: ReturnType<typeof newRecoil>, secs: number) => { let back = 0; for (let i = 0; i < secs * 60; i++) back += stepRecoil(r, 1 / 60); return back; };
  it('a shot climbs the aim and most of it comes back, the punch springs back', () => {
    const r = newRecoil(), k = kickRecoil(r, RECOIL.rifle, 0, false, 0);
    expect(k.pitch).toBeGreaterThan(0); expect(r.up).toBeGreaterThan(0);
    const back = settle(r, 2);
    expect(back).toBeCloseTo(k.pitch * (1 - RECOIL.rifle.keep), 5);
    expect(r.up).toBeLessThan(1e-6); expect(r.shove).toBeLessThan(1e-4);
  });
  it('heavier guns kick harder; aiming and crouching soften it', () => {
    const hit = (g: string, aim = 0, crouch = false) => kickRecoil(newRecoil(), RECOIL[g], aim, crouch, 0).pitch;
    expect(hit('shotgun')).toBeGreaterThan(hit('pistol')); expect(hit('pistol')).toBeGreaterThan(hit('blaster'));
    expect(hit('rifle', 1)).toBeLessThan(hit('rifle')); expect(hit('rifle', 0, true)).toBeLessThan(hit('rifle'));
  });
  it('a burst walks upwards', () => {
    const r = newRecoil(); let pitch = 0;
    for (let i = 0; i < 20; i++) { pitch += kickRecoil(r, RECOIL.smg, 0, false, 0).pitch; pitch -= settle(r, 0.085); }
    expect(pitch).toBeGreaterThan(RECOIL.smg.climb * 3);
  });
});
