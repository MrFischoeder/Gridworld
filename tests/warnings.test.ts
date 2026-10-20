import { describe, it, expect } from 'vitest';
import { FAR_CALLS, CALL_NEAR, farGain, muffle, PRINTS, TRACKS, printFade, printSegs, SMOKE } from '../src/gen/warnings';
import { SFX_NAMES } from '../src/audio/synth';
import { SPAWN } from '../src/gen/spawnring';

describe('warnings before you see it (stage L4)', () => {
  it('calls carry out to the spawn ring, fainter and more muffled the further', () => {
    for (const c of Object.values(FAR_CALLS)) { expect(SFX_NAMES).toContain(c.s); expect(c.far).toBeGreaterThan(CALL_NEAR); }
    expect(FAR_CALLS.ravager.far).toBeGreaterThan(SPAWN.near[1]); // a pack is heard where it turns up
    expect(farGain(200, 260)).toBeGreaterThan(0.03);
    expect(farGain(100, 260)).toBeGreaterThan(farGain(200, 260));
    expect(farGain(260, 260)).toBe(0);
    expect(muffle(200)).toBeLessThan(muffle(50));
    expect(muffle(1e4)).toBeGreaterThanOrEqual(600);
  });
  it('prints point the way the walker went and fade out in two game minutes', () => {
    for (const p of Object.values(PRINTS)) {
      const north = printSegs(p.k, p.size, 0, 1), east = printSegs(p.k, p.size, Math.PI / 2, -1);
      expect(north.length).toBeLessThanOrEqual(TRACKS.segs);
      const tipN = Math.max(...north.flatMap((s) => [s[1], s[3]])), tipE = Math.max(...east.flatMap((s) => [s[0], s[2]]));
      expect(tipN).toBeGreaterThan(0); expect(tipE).toBeGreaterThan(0); // the toes lead (+z north, +x east)
    }
    expect(printFade(0)).toBe(1);
    expect(printFade(TRACKS.life / 2)).toBeGreaterThan(0); expect(printFade(TRACKS.life / 2)).toBeLessThan(1);
    expect(printFade(TRACKS.life)).toBe(0);
    expect(PRINTS.leechwing).toBeUndefined(); // fliers leave none
  });
  it('a waiting band\'s fire is seen further than the ring', () => {
    expect(SMOKE.far).toBeGreaterThan(SPAWN.wait[1] + SPAWN.near[1]);
    expect(SMOKE.linger).toBeGreaterThan(0);
  });
});
