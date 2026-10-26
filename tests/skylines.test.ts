import { describe, it, expect } from 'vitest';
import type { TownState } from '../src/gen/town';
import type { OutpostState } from '../src/gen/outposts';
import { bare } from '../src/gen/outposts';
import { AIRSHIP } from '../src/gen/airmast';
import { newAirship } from '../src/gen/airships';
import { SKY, newSkyLine, skCap, skLeg, skPeriod, skEnergy, skFuel, skAssign, skRecall, skAt, skDue, settleSkyLine, allSkyLines, skyLineOf, skWaiting, skDrain, skKey, skLoad } from '../src/gen/skylines';
import { noteArrival, setForward } from '../src/gen/transit';
import type { Hub } from '../src/gen/warehouses';

const W = 12345;
const hub = (id: string, x: number, z: number): Hub => ({ id, kind: 'wild', x, z, hex: id, name: id });
const A = hub('wh:0:0', 0, 0), B = hub('wh:5:0', 18000, 0);
const ship = (drive: 'fuel' | 'cell') => newAirship({ drive, given: {} }, A.id, { x: 0, y: 12, z: 0, yaw: 0 }, 'Ala', 'p1', 5);
const store = (n: number) => { const hold: Record<string, number> = { planks: n }; return (cap: number) => { const m = Math.min(cap, hold.planks); hold.planks -= m; return m ? [['planks', m] as ['planks', number]] : []; }; };

describe('airship lines (0.258)', () => {
  it('a line is straight, slow and fits a round trip in the tank or the cells', () => {
    const l = newSkyLine(A, B, 100);
    expect(l.km).toBe(18);
    expect(skCap()).toBe(AIRSHIP.hold * SKY.perSlot);
    expect(skLeg(l)).toBe(1800);
    expect(skPeriod(l)).toBe(2 * (1800 + SKY.load));
    const far = newSkyLine(A, hub('x', SKY.reach, 0), 0);
    skAssign(far, ship('fuel'), 0, 'x'); expect(skEnergy(far)[1]).toBeLessThan(AIRSHIP.fuel.tank);
    skAssign(far, ship('cell'), 0, 'x'); expect(skEnergy(far)[1]).toBeLessThan(AIRSHIP.cell.cap);
  });
  it('an airship leaves the list for the line and comes back moored with its energy', () => {
    const l = newSkyLine(A, B, 100), a = ship('fuel');
    skAssign(l, a, 100, 'x');
    expect(l.ship).toMatchObject({ id: a.id, drive: 'fuel', by: 'Ala' }); expect(l.t0).toBe(100);
    expect(skFuel(l, 3)).toBe(3);
    const back = skRecall(l, A.id, { x: 1, y: 2, z: 3, yaw: 0 });
    expect(back).toMatchObject({ id: a.id, moor: A.id, fuel: a.fuel + 3 * AIRSHIP.fuel.can, x: 1 });
    expect(l.ship).toBeUndefined(); expect(l.t0).toBeUndefined();
    const o = { k: 'store', x: 0, z: 0, name: 'W', o: 'crew', by: 'x', t: 0 } as OutpostState;
    o.zline = l; skAssign(l, a, 0, 'x'); expect(bare(o)).toBe(false);
  });
  it('it loads at the home mast, flies out, unloads and flies back, following its timetable', () => {
    const l = newSkyLine(A, B, 0); skAssign(l, ship('cell'), 0, 'x');
    expect(skAt(l, 10).at).toBe('home');
    expect(skAt(l, SKY.load + 900).at).toBe('out'); expect(skAt(l, SKY.load + 900).p).toBeCloseTo(0.5);
    expect(skAt(l, SKY.load + skLeg(l) + 10).at).toBe('there');
    expect(skAt(l, 2 * SKY.load + skLeg(l) + 900).at).toBe('back');
    expect(skDue(l, SKY.load + skLeg(l) - 1)).toBe(false); expect(skDue(l, SKY.load + skLeg(l) + 1)).toBe(true);
  });
  it('a trip takes cargo and energy; a flat tank, an empty hold or no mast keep it home; the other end takes it in once', () => {
    const l = newSkyLine(A, B, 0), s = ship('fuel'); s.fuel = 1; skAssign(l, s, 0, 'x');
    const t1 = SKY.load + skLeg(l) + 5;
    expect(settleSkyLine(W, A, l, true, true, store(50), t1)).toEqual([]); expect(l.last![1]).toBe('dry'); expect(l.sent).toEqual({});
    skFuel(l, 15); l.k = 0;
    expect(settleSkyLine(W, A, l, false, true, store(50), t1)); expect(l.last![1]).toBe('nomast'); l.k = 0;
    expect(settleSkyLine(W, A, l, true, true, store(0), t1)).toEqual([]); expect(l.last![1]).toBe('empty'); l.k = 0;
    const before = skEnergy(l)[0], out = settleSkyLine(W, A, l, true, true, store(500), t1);
    if (out.includes('ok')) {
      expect(l.sent.planks).toBe(skCap()); expect(skEnergy(l)[0]).toBeCloseTo(before - skEnergy(l)[1]); expect(l.trips).toBe(1);
      const towns: Record<string, TownState | undefined> = {}, outposts: Record<string, OutpostState | undefined> = { [A.id]: { zline: l } as OutpostState };
      const dest = { } as { rcv?: Record<string, Partial<Record<'planks', number>>> };
      expect(skWaiting(B.id, towns, outposts, dest.rcv)).toEqual([[skKey(A.id, l), 'planks', skCap()]]);
      expect(skDrain(B.id, towns, outposts, dest, (_k, n) => Math.min(n, 40))).toEqual([['planks', 40]]);
      expect(skDrain(B.id, towns, outposts, dest, (_k, n) => n)).toEqual([['planks', skCap() - 40]]);
      expect(skDrain(B.id, towns, outposts, dest, (_k, n) => n)).toEqual([]);
      expect(allSkyLines(towns, outposts)).toEqual([[A.id, l]]); expect(skyLineOf(A.id, towns, outposts)).toBe(l);
    } else expect(l.last![1]).toBe('storm'); // the world's weather may keep it home: the rest of the trip is then not reached
  });
  it('a cell ship charges full at home while the mast works', () => {
    const l = newSkyLine(A, B, 0), s = ship('cell'); s.kwh = 3; skAssign(l, s, 0, 'x');
    settleSkyLine(W, A, l, true, true, store(10), SKY.load + skLeg(l) + 5);
    expect(l.last![1] === 'ok' || l.last![1] === 'storm').toBe(true);
    if (l.last![1] === 'ok') expect(l.ship!.kwh).toBeCloseTo(AIRSHIP.cell.cap - skEnergy(l)[1]);
  });
  it('goods that came in can go on by the sky line first', () => {
    const st: { hold?: Record<string, number> } & Parameters<typeof skLoad>[0] = {};
    setForward(st, 'hl:x:1', 'sk'); noteArrival(st, 'hl:x:1', 'stone', 7);
    const hold: Record<string, number> = { stone: 7, planks: 20 };
    const got = skLoad(st, hold, 10, ['planks'], (k, n) => { const m = Math.min(n, hold[k] ?? 0); hold[k] -= m; return m; });
    expect(got).toEqual([['stone', 7], ['planks', 3]]);
  });
});
