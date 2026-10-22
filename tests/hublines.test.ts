import { describe, it, expect } from 'vitest';
import { freshParts } from '../src/data/vehicles';
import { ROUTE } from '../src/gen/routes';
import { newHubLine, hlPeriod, hlLeg, hlAt, hlDue, settleHubLine, hlWaiting, hlDrain, takeHold, hlKey, hlFuel, hlEnergy } from '../src/gen/hublines';
import type { Hub } from '../src/gen/warehouses';
import type { TownState } from '../src/gen/town';
import type { OutpostState } from '../src/gen/outposts';
import type { ItemKey } from '../src/data/items';

const A: Hub = { id: 'v:5', kind: 'village', x: 0, z: 0, hex: '0:0', name: 'Alpha', vid: 5 };
const B: Hub = { id: 'wh:3:4', kind: 'wild', x: 6000, z: 0, hex: '3:4', name: 'Beta' };
const truck = (fuel?: number) => ({ id: 't1', model: 'mastodon' as const, parts: { ...freshParts('mastodon'), ...(fuel === undefined ? {} : { fuel }) }, by: 'Ada' });
const hold = (h: Partial<Record<ItemKey, number>>) => (cap: number, only?: ItemKey[]) => takeHold(h, cap, only, (k, n) => { h[k] = (h[k] ?? 0) - n; return n; });

describe('convoys between warehouses (0.252)', () => {
  it('a line measures its road and keeps a timetable', () => {
    const l = newHubLine(A, B, 100);
    expect(l.km).toBeCloseTo(6 * ROUTE.detour, 1);
    expect(hlPeriod(l)).toBe(2 * (hlLeg(l) + ROUTE.load));
    expect(hlAt(l, 200).at).toBe('parked'); // no truck yet
    l.truck = truck(); l.t0 = 1000;
    expect(hlAt(l, 1000 + ROUTE.load + 1).at).toBe('out');
    expect(hlDue(l, 1000)).toBe(false);
    expect(hlDue(l, 1000 + ROUTE.load + hlLeg(l))).toBe(true);
  });
  it('stays home without the radio, without fuel or with nothing to carry; else delivers', () => {
    const l = newHubLine(A, B, 0); l.truck = truck(0); l.t0 = 0;
    const h: Partial<Record<ItemKey, number>> = { stone: 50 };
    const at = ROUTE.load + hlLeg(l);
    expect(settleHubLine(1, A, l, false, true, hold(h), at)).toEqual([]);
    expect(l.last?.[1]).toBe('silent');
    l.k = 0; settleHubLine(1, A, l, true, true, hold(h), at);
    expect(l.last?.[1]).toBe('dry'); expect(h.stone).toBe(50);
    hlFuel(l, 10); expect(hlEnergy(l)[0]).toBeGreaterThan(hlEnergy(l)[1]);
    l.k = 0; l.only = ['log']; settleHubLine(1, A, l, true, true, hold(h), at);
    expect(l.last?.[1]).toBe('empty');
    l.k = 0; delete l.only; l.truck.parts.hull = 1e6; // robbery only scratches it
    const r = settleHubLine(1, A, l, true, true, hold(h), at);
    expect(r.length).toBe(1);
    if (r[0] === 'ok') { expect(l.sent.stone).toBe(ROUTE.cap.mastodon); expect(h.stone).toBe(50 - ROUTE.cap.mastodon); }
    else expect(r[0]).toBe('robbed');
    expect(l.trips).toBe(1);
  });
  it('the other warehouse takes the cargo in once, by its own counter', () => {
    const l = newHubLine(A, B, 7); l.sent = { stone: 12, log: 4 };
    const towns: Record<string, TownState> = { 5: { hline: l } as TownState };
    const outposts: Record<string, OutpostState> = {};
    const dest: { rcv?: Record<string, Partial<Record<ItemKey, number>>> } = {};
    expect(hlWaiting(B.id, towns, outposts, dest.rcv).length).toBe(2);
    let room = 10;
    hlDrain(B.id, towns, outposts, dest, (_k, n) => { const m = Math.min(n, room); room -= m; return m; });
    expect(dest.rcv?.[hlKey(A.id, l)]).toEqual({ stone: 10 });
    room = 100;
    const got = hlDrain(B.id, towns, outposts, dest, (_k, n) => { const m = Math.min(n, room); room -= m; return m; });
    expect(got).toEqual([['stone', 2], ['log', 4]]);
    expect(hlDrain(B.id, towns, outposts, dest, (_k, n) => n)).toEqual([]); // nothing twice
    expect(hlWaiting('v:9', towns, outposts, undefined)).toEqual([]);
  });
  it('loads the goods picked, most first, up to the load', () => {
    const h: Partial<Record<ItemKey, number>> = { stone: 5, log: 20, wire: 8 };
    expect(hold(h)(15)).toEqual([['log', 15]]);
    expect(hold(h)(10, ['wire', 'stone'])).toEqual([['wire', 8], ['stone', 2]]);
  });
});
