import { describe, it, expect } from 'vitest';
import { fortifyPlan, handOver, FORTIFY, powerKind, powerSite, powerCondition, POWER, type TownState } from '../src/gen/town';
import { villageGates, WALL_TIERS } from '../src/gen/village';

describe('village fortification', () => {
  it('takes materials a load at a time and raises the wall once all are in', () => {
    const s: TownState = {};
    expect(fortifyPlan(s)!.to).toBe(1);
    const carry: Record<string, number> = { planks: 20, nails: 40 };
    let r = handOver(s, (k) => carry[k] ?? 0);
    expect(r.raised).toBe(false);
    expect(s.given).toEqual({ planks: 20, nails: 40 });
    r = handOver(s, () => 999); // more than enough: only what is missing is taken
    expect(r.raised).toBe(true);
    expect(r.taken.find(([k]) => k === 'planks')![1]).toBe(40);
    expect(s.wall).toBe(1); expect(s.given).toEqual({});
    handOver(s, () => 999);
    expect(s.wall).toBe(2);
    expect(fortifyPlan(s)).toBeNull();
    expect(FORTIFY.length).toBe(WALL_TIERS.length - 1);
  });
});
describe('village power', () => {
  it('varies between villages, stands outside the fence clear of the gates, and wears down until mended', () => {
    const kinds = new Set<string>();
    for (let seed = 1; seed < 200; seed++) {
      kinds.add(powerKind(seed));
      const p = powerSite(seed), gates = villageGates(seed);
      expect(p.side).not.toBe('N');
      // outside the plaza (0..72) and its 1 m wall, but not far
      const out = p.side === 'W' ? -p.x : p.side === 'E' ? p.x - 72 : p.z - 72;
      expect(out - (p.side === 'S' ? p.d : p.w) / 2).toBeGreaterThan(8);
      // off the middle of the side, where the gates are
      const along = p.side === 'S' ? p.x : p.z;
      if (gates.includes(p.side)) expect(Math.abs(along - 37)).toBeGreaterThan(15);
      const s: TownState = {};
      const a = powerCondition(seed, s, 1440 * 10), b = powerCondition(seed, s, 1440 * 12);
      expect(b).toBeLessThanOrEqual(a);
      s.fixed = 1440 * 12;
      expect(powerCondition(seed, s, 1440 * 12)).toBe(100);
      expect(powerCondition(seed, s, 1440 * 13)).toBeCloseTo(100 - POWER[powerKind(seed)].wear, 5);
    }
    expect(kinds.size).toBe(3);
  });
});
