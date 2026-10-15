import { describe, it, expect } from 'vitest';
import { MORALE, FATE, TERRITORY, DEN, fateOf, shocked, effective, breaks, pastEdge, clamp01 } from '../src/gen/morale';

describe('morale and retreat (stage W6)', () => {
  it('shocks knock morale down and never below zero', () => {
    expect(shocked(0.6, 'ally')).toBeCloseTo(0.45);
    expect(shocked(0.6, 'leader')).toBeCloseTo(0.25);
    expect(shocked(0.1, 'leader')).toBe(0);
    expect(clamp01(1.4)).toBe(1);
  });
  it('a bandit holds while his boss is near, breaks after losses without him', () => {
    let m = MORALE.start.bandit;
    m = shocked(m, 'ally'); m = shocked(m, 'ally');
    expect(breaks(effective(m, { leader: true }))).toBe(false);
    expect(breaks(effective(m, {}))).toBe(true);
  });
  it('a beast by its den never breaks', () => {
    expect(breaks(effective(0, { atDen: true }))).toBe(false);
    expect(DEN.floor).toBeGreaterThan(MORALE.brk);
  });
  it('your wounds put heart into them', () => {
    expect(effective(0.2, { weakTarget: true })).toBeGreaterThan(MORALE.brk);
  });
  it('the fates are chosen at random, a cornered man gives up more often', () => {
    const count = (cornered: boolean) => { const n = { run: 0, give: 0, back: 0 }; for (let i = 0; i < 1000; i++) n[fateOf(i / 1000, cornered)]++; return n; };
    const open = count(false), close = count(true);
    expect(open.give).toBeCloseTo(FATE.give * 1000, -1);
    expect(close.give).toBeGreaterThan(open.give);
    expect(open.back).toBeGreaterThan(0); expect(open.run).toBeGreaterThan(0);
    expect(open.run + open.give + open.back).toBe(1000);
  });
  it('every hunting beast keeps to its ground; the harmless fish has none', () => {
    expect(pastEdge('ravager', TERRITORY.ravager + 1)).toBe(true);
    expect(pastEdge('ravager', TERRITORY.ravager - 1)).toBe(false);
    expect(pastEdge('silverfin', 1e6)).toBe(false);
  });
});
