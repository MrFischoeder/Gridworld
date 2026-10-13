import { describe, it, expect } from 'vitest';
import { LH, handOverLh, lhProgress, flashAt, beamAngle, lhProblem, type Lighthouse } from '../src/gen/lighthouses';

describe('lighthouses (0.204)', () => {
  const mk = (): Lighthouse => ({ id: 'lh:a', x: 0, z: 0, y: 5, given: {}, p: 8, on: true, by: 'a' });
  it('is built bit by bit', () => {
    const l = mk();
    expect(handOverLh(l, (k) => (k === 'stone' ? 10 : 0), 100).built).toBe(false);
    expect(lhProgress(l)).toBeGreaterThan(0);
    expect(handOverLh(l, () => 999, 200).built).toBe(true); expect(l.done).toBe(200); expect(lhProgress(l)).toBe(1);
  });
  it('flashes twice a turn towards a viewer, faster with a shorter period, and lights nothing when off', () => {
    const l = mk(); handOverLh(l, () => 999, 1);
    let flashes = 0, prev = 0;
    for (let t = 1; t < 9; t += 0.02) { const f = flashAt(l, t, 0, 500); if (f > 0.5 && prev <= 0.5) flashes++; prev = f; }
    expect(flashes).toBe(2);
    l.p = 4; flashes = 0; prev = 0;
    for (let t = 1; t < 9; t += 0.02) { const f = flashAt(l, t, 0, 500); if (f > 0.5 && prev <= 0.5) flashes++; prev = f; }
    expect(flashes).toBe(4);
    expect(beamAngle(l, 2)).toBeCloseTo(Math.PI);
    l.on = false; expect(flashAt(l, 0, 0, 500)).toBe(0);
  });
  it('keeps off villages and other lighthouses', () => {
    expect(lhProblem(0, 0, [{ x: 50, z: 0 }], [])).toBe('village');
    expect(lhProblem(0, 0, [], [{ ...mk(), x: 30 }])).toBe('close');
    expect(lhProblem(0, 0, [{ x: 500, z: 0 }], [{ ...mk(), x: 300 }])).toBe('');
    expect(LH.periods).toContain(LH.p0);
  });
});
