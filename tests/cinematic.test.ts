import { expect, it } from 'vitest';
import { CINEMATIC_SECONDS, CINEMATIC_SHOTS, STRIKE, cinematicFrame } from '../src/core/cinematic';
it('covers the whole film without gaps and switches at each shot boundary', () => {
  expect(CINEMATIC_SECONDS).toBe(48);
  expect(CINEMATIC_SHOTS[0].start).toBe(0);
  CINEMATIC_SHOTS.forEach((s, i) => {
    expect(s.end).toBe(i + 1 < CINEMATIC_SHOTS.length ? CINEMATIC_SHOTS[i + 1].start : CINEMATIC_SECONDS);
    expect(cinematicFrame(s.start).shot).toBe(i);
    expect(cinematicFrame((s.start + s.end) / 2).progress).toBeCloseTo(.5);
  });
  expect(cinematicFrame(CINEMATIC_SECONDS - .001).finished).toBe(false);
  expect(cinematicFrame(CINEMATIC_SECONDS).finished).toBe(true);
});
it('captions each shot, flashes at the strike, then reveals the title and the two credits', () => {
  expect(cinematicFrame(0).veil).toBe(1);
  expect(cinematicFrame(1).veil).toBe(0);
  expect(cinematicFrame(2).caption).toBe(1);
  expect(cinematicFrame(4.05).caption).toBe(0); // just after a cut
  expect(cinematicFrame(STRIKE).flash).toBe(1); expect(cinematicFrame(STRIKE + 1).flash).toBe(0);
  expect(cinematicFrame(44).caption).toBe(0); // the last shot has the title instead
  expect(cinematicFrame(43).title).toBe(0); expect(cinematicFrame(45.1).title).toBe(1);
  expect(cinematicFrame(45.2).design).toBe(0); expect(cinematicFrame(46.4).design).toBe(1);
  expect(cinematicFrame(46.2).music).toBe(0); expect(cinematicFrame(47.4).music).toBe(1);
  expect(cinematicFrame(CINEMATIC_SECONDS).veil).toBe(1);
  for (let t = -1; t <= 50; t += .1) {
    const f = cinematicFrame(t);
    for (const v of [f.progress, f.veil, f.title, f.design, f.music, f.caption, f.flash]) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
  }
});
