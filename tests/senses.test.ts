import { describe, it, expect } from 'vitest';
import { SENSES, sensesOf, viewFacing, seenAs, hears } from '../src/gen/senses';
import { CREATURES } from '../src/data/creatures';
import { ROBOTS } from '../src/data/robots';
import { SPAWN, leadOf } from '../src/gen/spawnring';

describe('how foes find you (L2)', () => {
  it('every creature and robot kind has its senses', () => {
    for (const k of Object.keys(CREATURES)) expect(SENSES[k as keyof typeof SENSES]).toBeTruthy();
    for (const k of Object.keys(ROBOTS)) expect(SENSES[k as keyof typeof SENSES]).toBeTruthy();
    expect(sensesOf(undefined)).toBe(SENSES.bandit);
  });
  it('noses track, eyes do not; a nose keeps you longer than it looks', () => {
    expect(SENSES.ravager.scent).toBeGreaterThan(SENSES.gnawer.scent);
    expect(SENSES.ravager.trail).toBeGreaterThan(SENSES.ravager.lose);
    for (const k of ['scout', 'guardian', 'sentinel', 'bandit', 'leechwing'] as const) { expect(SENSES[k].scent).toBe(0); expect(SENSES[k].trail).toBe(0); }
  });
  it('all-round eyes see behind, a cone does not; thermal eyes are not fooled by the night', () => {
    expect(viewFacing(SENSES.leechwing, -1)).toBe(1);
    expect(viewFacing(SENSES.scout, -0.4)).toBe(1);
    expect(viewFacing(SENSES.bandit, -0.4)).toBe(-0.4);
    expect(seenAs(SENSES.sentinel, 0.3, 1)).toBe(1);
    expect(seenAs(SENSES.bandit, 0.3, 1)).toBe(0.3);
  });
  it('ears differ: leechwings hear a shot far, brambles hardly', () => {
    expect(hears('leechwing', 55)).toBeGreaterThan(hears('ravager', 55));
    expect(hears('bramble', 55)).toBeLessThan(hears('bandit', 55));
  });
  it('a crossing meets your way further ahead than a plain meeting', () => {
    expect(leadOf(4, SPAWN.crossLead)).toBeGreaterThan(leadOf(4));
    expect(SPAWN.march).toBeGreaterThanOrEqual(180);
  });
});
