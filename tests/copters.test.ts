import { describe, it, expect } from 'vitest';
import type { OutpostState } from '../src/gen/outposts';
import { bare } from '../src/gen/outposts';
import { TECHS } from '../src/gen/tech';
import { COPTER, copRows, handOverCop, copterSpot, newCopter, burnCop, fuelCop, copRangeKm, fitToLand, COP_SEATS, type CopterBuild } from '../src/gen/copters';
import type { Hub } from '../src/gen/warehouses';

const H: Hub = { id: 'wh:1:1', kind: 'wild', x: 500, z: 300, hex: '1:1', name: 'W' };

describe('rotorcraft (0.259)', () => {
  it('has its own plans, a parking spot by the warehouse and two seats', () => {
    expect(TECHS.find((t) => t.id === COPTER.tech)?.tier).toBe(4);
    const a = copterSpot(H), b = copterSpot(H, 1);
    expect(Math.hypot(a.x - H.x, a.z - H.z)).toBeCloseTo(COPTER.spot, 3);
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(5); // the next one stands elsewhere
    expect(COP_SEATS.length).toBe(COPTER.seats);
  });
  it('is built from the warehouse\'s stock, bit by bit, and starts with a quarter of a tank', () => {
    const b: CopterBuild = { given: {} };
    expect(handOverCop(b, () => 2).built).toBe(false);
    expect(copRows(b).some((r) => r.given > 0 && r.given < r.n || r.given === r.n)).toBe(true);
    expect(handOverCop(b, () => 99).built).toBe(true);
    expect(copRows(b).every((r) => r.given >= r.n)).toBe(true);
    const c = newCopter(H.id, { x: 1, y: 2, z: 3, yaw: 0 }, 'Ala', 'p1', 77);
    expect(c.id).toBe('cop:p1:77'); expect(c.fuel).toBe(COPTER.fuel.tank / 4);
    const o = { k: 'store', x: 0, z: 0, name: 'W', o: 'crew', by: 'x', t: 0 } as OutpostState;
    o.cbuild = { given: {} }; expect(bare(o)).toBe(false);
  });
  it('burns diesel in the air, takes canisters, and goes a useful way on a tank', () => {
    const c = newCopter(H.id, { x: 0, y: 0, z: 0, yaw: 0 }, 'A', 'p', 0);
    expect(burnCop(c, 1, 10)).toBe(true);
    expect(c.fuel).toBeCloseTo(COPTER.fuel.tank / 4 - (COPTER.fuel.idle + COPTER.fuel.burn) * 10);
    expect(fuelCop(c, COPTER.fuel.can)).toBe(COPTER.fuel.can);
    const room = COPTER.fuel.tank - c.fuel;
    expect(fuelCop(c, 1e6)).toBeCloseTo(room);
    expect(c.fuel).toBe(COPTER.fuel.tank);
    expect(copRangeKm(c)).toBeGreaterThan(20); // a full tank crosses a region and back
    expect(burnCop(c, 1, 1e6)).toBe(false); expect(c.fuel).toBe(0);
  });
  it('sets down only on level, dry ground', () => {
    expect(fitToLand([3, 3.4, 3.6, 3.2, 3], false)).toBe(true);
    expect(fitToLand([3, 5, 3, 3, 3], false)).toBe(false);
    expect(fitToLand([3, 3, 3], true)).toBe(false);
  });
});
