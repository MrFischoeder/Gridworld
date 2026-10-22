import { describe, it, expect } from 'vitest';
import type { TownState } from '../src/gen/town';
import type { OutpostState } from '../src/gen/outposts';
import type { ItemKey } from '../src/data/items';
import { partProblem } from '../src/gen/outposts';
import { demandOf } from '../src/gen/grid';
import { postsOf } from '../src/gen/workforce';
import { jobOf } from '../src/gen/construction';
import { finishJob } from '../src/gen/jobs';
import { allVillages } from '../src/gen/regions';
import { takeHold } from '../src/gen/hublines';
import { setForward, transitCount } from '../src/gen/transit';
import { padClaim } from '../src/gen/fields';
import { claimFlatten } from '../src/gen/claims';
import { PAD, DRONE } from '../src/gen/dronepad';
import { padPlan, handOverPad, placePad, padAt, newAirLine, alLeg, alPeriod, alAt, alDue, settleAirLine, alDrain, alKey, airLoad, alWay, airLinesOf, ownAirLines, allAirLines, type AirLine } from '../src/gen/airlines';
import type { Hub } from '../src/gen/warehouses';

const W = 12345;
const A: Hub = { id: 'v:5', kind: 'village', x: 0, z: 0, hex: '0:0', name: 'Alpha', vid: 5 };
const B: Hub = { id: 'wh:3:4', kind: 'wild', x: 6000, z: 0, hex: '3:4', name: 'Beta' };
const hold = (h: Partial<Record<ItemKey, number>>) => (cap: number, only?: ItemKey[]) => takeHold(h, cap, only, (k, n) => { h[k] = (h[k] ?? 0) - n; return n; });

describe('cargo drones (0.254)', () => {
  it('a village builds its pad from its stock; it wants a hand; an outpost builds it as a part and it draws power', () => {
    const s: TownState = {}, v = allVillages(W)[0];
    expect(handOverPad(s, () => 99, 100)).toMatchObject({ started: false, wait: true }); // (0.255) its place is staked out first
    expect(s.dpWait).toBe(true);
    expect(placePad(s, { x: v.x + 30, z: v.z }, 100)).toBe(true);
    expect(placePad(s, { x: v.x + 40, z: v.z }, 100)).toBe(false); // only once
    expect(s.dpWait).toBeUndefined();
    expect(padPlan(s).every((r) => r.given >= r.n)).toBe(true);
    finishJob(W, v, s, jobOf(s, 'dronepad')!, 100 + PAD.hours * 60);
    expect(s.dpad).toBeGreaterThan(0); expect(s.dgiven).toBeUndefined();
    expect(postsOf({ ...s, settlement: { v: 1 } } as TownState).some((p) => p.id === 'dronepad')).toBe(true); // a settlement's pad wants a hand
    const o = { k: 'store', x: 0, z: 0, name: 'W', o: 'crew', by: 'x', t: 0 } as OutpostState;
    expect(partProblem(o, 'pad')).not.toBe('');
    o.done = { port: true };
    expect(partProblem(o, 'pad')).toBe('');
    const before = demandOf(o); o.done.pad = true;
    expect(demandOf(o)).toBe(before + PAD.kw);
  });
  it('flies straight and fast, a few crates at a time, only when it can', () => {
    const l = newAirLine(A, B, 0);
    expect(l.km).toBe(6);
    expect(alLeg(l)).toBe(Math.ceil(6000 / DRONE.pace));
    expect(alPeriod(l)).toBe(2 * (alLeg(l) + DRONE.load));
    l.drone = { by: 'Ada' }; l.t0 = 0;
    const at = DRONE.load + alLeg(l);
    expect(alDue(l, at - 1)).toBe(false); expect(alDue(l, at)).toBe(true);
    const h: Partial<Record<ItemKey, number>> = { steel: 10 };
    expect(settleAirLine(W, A, l, false, true, true, hold(h), at)).toEqual(['silent']);
    l.k = 0; expect(settleAirLine(W, A, l, true, false, true, hold(h), at)).toEqual(['nopad']);
    l.k = 0; expect(settleAirLine(W, A, l, true, true, false, hold(h), at)).toEqual(['flat']);
    expect(alAt(l, at + 1).at).toBe('parked'); // it stayed down this round
    l.k = 0; l.only = ['log']; expect(settleAirLine(W, A, l, true, true, true, hold(h), at)).toEqual(['empty']);
    delete l.only;
    let ok = 0;
    for (let k = 0; k < 40 && l.drone; k++) { l.k = 0; l.t0 = -k * alPeriod(l) * 3; ok += settleAirLine(W, A, l, true, true, true, hold({ steel: 10 }), at).filter((q) => q === 'ok').length; } // storms may keep some down
    expect(ok).toBeGreaterThan(0);
    expect(l.sent.steel).toBeGreaterThan(0);
  });
  it('over dangerous land a drone is lost with its load, and the line waits for another', () => {
    const far: Hub = { ...A, x: 0, z: 22000 }, l = newAirLine(far, { ...B, x: 9000, z: 22000 }, 0);
    l.drone = { by: 'Ada' }; l.t0 = 0;
    const out = settleAirLine(W, far, l, true, true, true, () => [['steel', 3]], 400 * alPeriod(l));
    expect(out).toContain('lost');
    expect(l.drone).toBeUndefined(); expect(l.lost).toBe(1);
  });
  it('the other warehouse takes the load in once, and may send it on by its own drone', () => {
    const l: AirLine = { ...newAirLine(A, B, 9), sent: { steel: 6 } };
    const towns: Record<string, TownState> = { 5: { aline: l } }, outposts: Record<string, OutpostState> = {};
    const dest = {} as OutpostState;
    const mine = { ...newAirLine(B, A, 30), only: ['log'] as ItemKey[] };
    setForward(dest, alKey('v:5', l), alWay(mine));
    expect(alDrain(B.id, towns, outposts, dest, (_k, n) => n)).toEqual([['steel', 6]]);
    expect(alDrain(B.id, towns, outposts, dest, (_k, n) => n)).toEqual([]);
    expect(transitCount(dest, alWay(mine))).toBe(6);
    const h: Partial<Record<ItemKey, number>> = { steel: 6, log: 50 };
    expect(airLoad(dest, mine, h, DRONE.cap, (k, n) => { h[k]! -= n; return n; })).toEqual([['steel', DRONE.cap]]);
  });
});

describe('drone pads in the settlements (0.255)', () => {
  it('a pad serves several lines; a 0.254 line moves into the list with its goods on the way', () => {
    const old: AirLine = { ...newAirLine(A, B, 5), drone: { by: 'Ada' }, t0: 5 };
    const st: TownState = { aline: old, fwd: { 'hl:x:1': 'al' }, tr: { al: { steel: 4 } } };
    const other = newAirLine(A, { ...B, id: 'wh:9:9', x: 3000 }, 7);
    expect(airLinesOf(st)).toEqual([old]);
    const list = ownAirLines(st); list.push(other);
    expect(st.aline).toBeUndefined();
    expect(airLinesOf(st)).toEqual([old, other]);
    expect(st.fwd!['hl:x:1']).toBe(alWay(old)); expect(st.tr![alWay(old)]).toEqual({ steel: 4 }); expect(st.tr!.al).toBeUndefined();
    expect(allAirLines({ 5: st }, {}).map(([h, l]) => [h, l.to])).toEqual([['v:5', B.id], ['v:5', 'wh:9:9']]);
    expect(alWay(old)).not.toBe(alWay(other));
  });
  it('a staked pad stands where it was put and keeps the trees off without levelling the ground', () => {
    const v = allVillages(W)[1], h: Hub = { ...A, id: 'v:' + v.id, vid: v.id, x: v.x + 60, z: v.z };
    const towns: Record<string, TownState> = { [v.id]: { dpspot: { x: v.x + 70, z: v.z + 15 } } };
    expect(padAt(W, h, towns)).toMatchObject({ x: v.x + 70, z: v.z + 15 });
    expect(padAt(W, h)).not.toMatchObject({ x: v.x + 70, z: v.z + 15 }); // unstaked (a 0.254 pad): beside the warehouse
    const c = padClaim({ x: 10, z: 10 });
    expect(claimFlatten(c, 10, 10, 37.5)).toBeCloseTo(37.5);
  });
});
