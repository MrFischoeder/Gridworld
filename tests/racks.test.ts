import { describe, it, expect } from 'vitest';
import { RACK, rackVol, rackGain, rackProblem, putRack, takeRack, rackCount, type Racks } from '../src/gen/racks';
import { hallVol, holdRoom, hallSpec } from '../src/gen/hall';
import { portCap, portRoom } from '../src/gen/ports';
import { PORT, type OutpostState } from '../src/gen/outposts';
import { carrierRoutes, carrierAt, CARRY } from '../src/gen/carriers';
import { villageHall } from '../src/gen/warehouses';
import { allVillages } from '../src/gen/regions';
import type { TownState } from '../src/gen/town';
import type { Lode } from '../src/gen/lodes';

describe('racks (0.250)', () => {
  it('an empty crate or barrel on the racks adds 2.5 times its size, up to the most', () => {
    expect(rackGain('crateW')).toBe(250);
    expect(rackGain('barrelM')).toBe(250);
    const r: Racks = {};
    expect(rackProblem(r, 'crateW', true)).toBe('loaded');
    expect(rackProblem(r, 'stone', false)).toBe('not');
    putRack(r, 'crateW'); putRack(r, 'barrelM');
    expect(rackVol(r)).toBe(500);
    for (let i = rackCount(r); i < RACK.max; i++) putRack(r, 'crateW');
    expect(rackProblem(r, 'crateW', false)).toBe('full');
  });
  it('the hold grows with them, and one comes off only while what is stored still fits', () => {
    const s: TownState = { racks: { crateM: 2 } };
    expect(hallVol(s)).toBe(hallSpec(s).vol + 500);
    expect(holdRoom(s, 'stone')).toBeGreaterThan(holdRoom({}, 'stone'));
    const r: Racks = { crateM: 1 };
    expect(takeRack(r, 'crateM', 6100, 6250)).toBe(false);
    expect(takeRack(r, 'crateM', 5000, 6250)).toBe(true);
    expect(r).toEqual({});
    const o = { done: { port: true }, racks: { barrelW: 4 } } as unknown as OutpostState;
    expect(portCap(o)).toBe(PORT.vol + 1000);
    expect(portRoom(o, 'stone')).toBeGreaterThan(0);
  });
});

describe('carriers (0.250)', () => {
  const world = 12345, v = allVillages(world)[0], at = villageHall(v, undefined)!;
  const lode = { id: 'lode:t', k: 'oil', x: at[0] + 150, z: at[1] + 60, y: 0, r: 20, yaw: 0, rich: 1, name: 'Oil' } as Lode;
  const outposts: Record<string, OutpostState> = { [lode.id]: { o: 'crew', by: 'A', t: 0, k: 'oil', x: lode.x, z: lode.z, name: 'Oil', done: { dig: true } } };
  it('a deposit in a warehouse\'s hex sends carriers rolling barrels of crude to it', () => {
    const rs = carrierRoutes(world, {}, outposts, (id) => (id === lode.id ? lode : null), at[0], at[1], 400, 0);
    expect(rs).toHaveLength(1);
    expect(rs[0]).toMatchObject({ load: 'barrel', n: CARRY.deposit, bx: at[0], bz: at[1] });
    expect(carrierRoutes(world, {}, outposts, () => lode, at[0] + 30000, at[1], 400, 0)).toHaveLength(0); // far from you: none
  });
  it('a carrier walks there loaded and back empty, the same at the same game time', () => {
    const r = { id: 'x', ax: 0, az: 0, bx: 140, bz: 0, n: 1, load: 'crate' as const };
    const seen = new Set<string>();
    for (let t = 0; t < 10; t += 0.25) { const p = carrierAt(r, 0, t); expect(p.x).toBeGreaterThanOrEqual(-1e-6); expect(p.x).toBeLessThanOrEqual(140 + 1e-6); seen.add(p.loaded ? 'L' : 'E'); }
    expect(seen).toEqual(new Set(['L', 'E']));
    expect(carrierAt(r, 0, 3.3)).toEqual(carrierAt(r, 0, 3.3));
  });
});
