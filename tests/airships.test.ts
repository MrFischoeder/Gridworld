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
import { Terrain } from '../src/gen/terrain';
import { findPoi, villageSeed, GRIDHOLM_ID } from '../src/gen/regions';
import { mastProblem, mastLine, fieldClaims, reservedZones } from '../src/gen/fields';
import { amastPlan, handOverAmast, placeMast, hasAmast, mastAt, moorPose, airNeeds, airRows, handOverAir, newAirship, burnAir, chargeAir, fuelAir, airRangeKm, lowest, type AirBuild } from '../src/gen/airships';
import type { Hub } from '../src/gen/warehouses';

const W = 12345;

describe('mooring masts and airships (0.256)', () => {
  it('a village builds its mast from its stock; it wants a hand; an outpost builds it as a part and it draws power', () => {
    const s: TownState = { amspot: { x: 0, z: 0, a: 0 } }, v = allVillages(W)[0]; // (0.257) staked already: the builders start at once
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
  it('(0.257) a village mast waits for its stake; the ground under its airship is kept clear and level enough', () => {
    const T = new Terrain(W), s: TownState = {};
    const r = handOverAmast(s, () => 99, 100);
    expect(r.wait).toBe(true); expect(s.amWait).toBe(true); expect(jobOf(s, 'airmast')).toBeFalsy();
    expect(handOverAmast(s, () => 99, 100).taken).toEqual([]);
    const gh = findPoi(W, GRIDHOLM_ID)!;
    expect(mastProblem(T, gh, villageSeed(W, gh), s, gh.x, gh.z, 0, [], { x: gh.x + 80, z: gh.z })).toMatch(/village/i);
    expect(mastProblem(T, gh, villageSeed(W, gh), s, gh.x + 80 + AIRMAST.near + 40, gh.z, 0, [], { x: gh.x + 80, z: gh.z })).toMatch(/far/i);
    let spot: { x: number; z: number; a: number } | null = null, home = gh, hall = { x: 0, z: 0 };
    for (const v of allVillages(W).slice(0, 6)) for (let q = 0; q < 4 && !spot; q++) {
      const hl = { x: v.x + Math.cos(q * 1.57) * 85, z: v.z + Math.sin(q * 1.57) * 85 }, sd = villageSeed(W, v);
      for (let k = 0; k < 24 && !spot; k++) for (const d of [30, 60, 100]) {
        const x = Math.round(hl.x + Math.cos(k * 0.27) * d), z = Math.round(hl.z + Math.sin(k * 0.27) * d), a = k * 0.27 + q * 1.57;
        if (!mastProblem(T, v, sd, s, x, z, a, [], hl)) { spot = { x, z, a }; home = v; hall = hl; break; }
      }
    }
    const seed = villageSeed(W, home);
    expect(spot).not.toBeNull();
    expect(placeMast(s, spot!, 200)).toBe(true); expect(placeMast(s, spot!, 200)).toBe(false);
    expect(s.amWait).toBeUndefined(); expect(jobOf(s, 'airmast')).toBeTruthy();
    const h: Hub = { id: 'v:' + home.id, kind: 'village', x: hall.x, z: hall.z, hex: '', name: '', vid: home.id };
    const m = mastAt(W, h, { [home.id]: s });
    expect(m.x).toBe(spot!.x); expect(m.a).toBeCloseTo(spot!.a, 2);
    const p = moorPose(m, 0), [tx, , tr] = mastLine(m).at(-1)!;
    expect(Math.hypot(p.x - m.x, p.z - m.z)).toBeLessThan(Math.hypot(tx - m.x, p.z - m.z) + tr); // the ship lies over the kept ground
    expect(fieldClaims({ [home.id]: s }).length).toBe(mastLine(m).length);
    expect(reservedZones(W, home, seed, s).some((z) => z.k === 'mast')).toBe(true);
  });
  it('the gondola keeps clear of the ground', () => {
    expect(lowest(10) - AIRSHIP.below).toBeCloseTo(10 + AIRSHIP.min);
  });
});
