import { describe, it, expect } from 'vitest';
import type { TownState } from '../src/gen/town';
import type { OutpostState } from '../src/gen/outposts';
import { partProblem, partNeeds } from '../src/gen/outposts';
import { demandOf } from '../src/gen/grid';
import { postsOf } from '../src/gen/workforce';
import { jobOf } from '../src/gen/construction';
import { finishJob } from '../src/gen/jobs';
import { allVillages } from '../src/gen/regions';
import { AIRMAST, AIRSHIP } from '../src/gen/airmast';
import { amastPlan, handOverAmast, hasAmast, mastAt, moorPose, airNeeds, airRows, handOverAir, newAirship, burnAir, chargeAir, fuelAir, airRangeKm, lowest, type AirBuild } from '../src/gen/airships';
import type { Hub } from '../src/gen/warehouses';

const W = 12345;

describe('mooring masts and airships (0.256)', () => {
  it('a village builds its mast from its stock; it wants a hand; an outpost builds it as a part and it draws power', () => {
    const s: TownState = {}, v = allVillages(W)[0];
    expect(handOverAmast(s, () => 99, 100).started).toBe(true);
    expect(amastPlan(s).every((r) => r.given >= r.n)).toBe(true);
    finishJob(W, v, s, jobOf(s, 'airmast')!, 100 + AIRMAST.hours * 60);
    expect(s.amast).toBeGreaterThan(0); expect(s.agiven).toBeUndefined();
    expect(postsOf({ ...s, settlement: { v: 1 } } as TownState).some((p) => p.id === 'airmast')).toBe(true);
    const o = { k: 'store', x: 0, z: 0, name: 'W', o: 'crew', by: 'x', t: 0 } as OutpostState;
    expect(partProblem(o, 'amast')).not.toBe('');
    o.done = { port: true };
    expect(partProblem(o, 'amast')).toBe('');
    expect(partNeeds('store', 'amast')).toEqual(AIRMAST.needs);
    const before = demandOf(o); o.done!.amast = true;
    expect(demandOf(o) - before).toBe(AIRMAST.kw);
    const h: Hub = { id: o.k, kind: 'wild', x: 0, z: 0, hex: '0:0', name: 'W' };
    expect(hasAmast(h, {}, { [h.id]: o })).toBe(true);
  });
  it('a moored airship has its nose at the mast\'s head and lies away from the warehouse', () => {
    const h: Hub = { id: 'wh:1:1', kind: 'wild', x: 500, z: 300, hex: '1:1', name: 'W' };
    const m = mastAt(W, h), p = moorPose(m, 20);
    expect(Math.hypot(m.x - h.x, m.z - h.z)).toBeCloseTo(34, 3);
    const nx = p.x + Math.sin(p.yaw) * AIRSHIP.len / 2, nz = p.z + Math.cos(p.yaw) * AIRSHIP.len / 2;
    expect(Math.hypot(nx - m.x, nz - m.z)).toBeLessThan(1);
    expect(p.y).toBe(20 + AIRMAST.h);
    expect(Math.hypot(p.x - h.x, p.z - h.z)).toBeGreaterThan(Math.hypot(m.x - h.x, m.z - h.z)); // the hull lies away from the shed
    expect(p.y - AIRSHIP.below).toBeLessThan(20 + 3.5); // the gondola hangs within reach of the ground
  });
  it('an airship takes its drive\'s parts; built, it is moored with some energy', () => {
    const b: AirBuild = { drive: 'cell', given: {} };
    expect(airNeeds('cell').some(([k]) => k === 'powercell')).toBe(true);
    expect(airNeeds('fuel').some(([k]) => k === 'engine')).toBe(true);
    expect(handOverAir(b, () => 3).built).toBe(false);
    expect(handOverAir(b, () => 99).built).toBe(true);
    expect(airRows(b).every((r) => r.given >= r.n)).toBe(true);
    const a = newAirship(b, 'v:5', { x: 1, y: 2, z: 3, yaw: 0 }, 'Ada', 'p1', 77);
    expect(a.moor).toBe('v:5'); expect(a.kwh).toBe(AIRSHIP.cell.cap / 2); expect(a.fuel).toBe(0);
    expect(a.id).toBe('air:p1:77');
  });
  it('diesel burns and is poured in; cells drain and charge; empty means no thrust', () => {
    const f = newAirship({ drive: 'fuel', given: {} }, 'x', { x: 0, y: 0, z: 0, yaw: 0 }, 'A', 'p', 0);
    expect(airRangeKm(f)).toBeGreaterThan(10);
    expect(fuelAir(f, 20)).toBe(20);
    expect(burnAir(f, 1, 100)).toBe(true);
    expect(f.fuel).toBeCloseTo(AIRSHIP.fuel.tank / 4 + 20 - AIRSHIP.fuel.burn * 100);
    expect(burnAir(f, 1, 1e6)).toBe(false);
    expect(chargeAir(f, 10)).toBe(0); // diesel does not charge
    const c = newAirship({ drive: 'cell', given: {} }, 'x', { x: 0, y: 0, z: 0, yaw: 0 }, 'A', 'p', 0);
    expect(fuelAir(c, 20)).toBe(0);
    burnAir(c, 0, 10);
    expect(c.kwh).toBeLessThan(AIRSHIP.cell.cap / 2); // the systems draw even idle
    expect(chargeAir(c, 1e6)).toBeGreaterThan(0); expect(c.kwh).toBe(AIRSHIP.cell.cap);
  });
  it('the gondola keeps clear of the ground', () => {
    expect(lowest(10) - AIRSHIP.below).toBeCloseTo(10 + AIRSHIP.min);
  });
});
