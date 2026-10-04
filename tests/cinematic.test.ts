import { expect, it } from 'vitest';
import { CINEMATIC_SECONDS, CINEMATIC_SHOTS, cinematicFrame } from '../src/core/cinematic';
it('covers exactly twenty seconds without gaps and switches at each shot boundary', () => {
  expect(CINEMATIC_SECONDS).toBe(20);
  expect(CINEMATIC_SHOTS[0].start).toBe(0);
  CINEMATIC_SHOTS.forEach((s, i) => {
    expect(s.end).toBe(i + 1 < CINEMATIC_SHOTS.length ? CINEMATIC_SHOTS[i + 1].start : 20);
    expect(cinematicFrame(s.start).shot).toBe(i);
    expect(cinematicFrame((s.start + s.end) / 2).progress).toBeCloseTo(.5);
  });
  expect(cinematicFrame(19.999).finished).toBe(false);
  expect(cinematicFrame(20).finished).toBe(true);
});
it('reveals the title then the two credits and fades cleanly at the ends', () => {
  expect(cinematicFrame(0).veil).toBe(1);
  expect(cinematicFrame(1).veil).toBe(0);
  expect(cinematicFrame(12).title).toBe(0);
  expect(cinematicFrame(14.5).title).toBe(1);
  expect(cinematicFrame(15).design).toBe(0);
  expect(cinematicFrame(16.5).design).toBe(1);
  expect(cinematicFrame(16.6).music).toBe(0);
  expect(cinematicFrame(18).music).toBe(1);
  expect(cinematicFrame(20).veil).toBe(1);
  for (let t = -1; t <= 21; t += .1) {
    const f = cinematicFrame(t);
    for (const v of [f.progress, f.veil, f.title, f.design, f.music]) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
  }
});
