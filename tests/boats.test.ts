import { describe, it, expect } from 'vitest';
import { BOATS, KEEL, floats, boatRows, handOverBoat, type BoatBuild } from '../src/gen/boats';

describe('boats', () => {
  it('are built bit by bit on the slip', () => {
    const b: BoatBuild = { k: 'row', given: {} };
    let r = handOverBoat(b, (k) => (k === 'log' ? 4 : 0));
    expect(r.built).toBe(false); expect(b.given.log).toBe(4);
    r = handOverBoat(b, () => 99);
    expect(r.built).toBe(true);
    expect(boatRows(b).every((x) => x.given === x.n)).toBe(true);
    expect(r.taken.find(([k]) => k === 'log')![1]).toBe(BOATS.row.needs.find(([k]) => k === 'log')![1] - 4);
  });
  it('float only over water deeper than their draught and keel', () => {
    expect(floats('row', BOATS.row.draft + KEEL)).toBe(true);
    expect(floats('row', BOATS.row.draft)).toBe(false);
    expect(floats('row', 0.3)).toBe(false);
  });
});

import { windAngle, polar, bestSheet, trim, sailSpeed, NO_GO } from '../src/gen/boats';
describe('sailing', () => {
  it('runs before the wind, is fastest across it and makes no way into it', () => {
    const dir = 0; // the wind blows to +x
    const running = windAngle(Math.PI / 2, dir), beam = windAngle(0, dir), head = windAngle(-Math.PI / 2, dir);
    expect(running).toBeCloseTo(0, 6); expect(beam).toBeCloseTo(Math.PI / 2, 6); expect(head).toBeCloseTo(Math.PI, 6);
    expect(polar(head)).toBe(0); expect(polar(NO_GO + 0.01)).toBe(0);
    expect(polar(beam)).toBeGreaterThan(polar(running));
    expect(sailSpeed('sail', 0.5, head, 0.5)).toBe(0);
    expect(sailSpeed('sail', 0.5, beam, bestSheet(beam))).toBeGreaterThan(sailSpeed('sail', 0.5, running, bestSheet(running)));
  });
  it('wants the sheet let out running and hauled in close-hauled', () => {
    expect(bestSheet(0)).toBe(1);
    expect(bestSheet(0.74 * Math.PI)).toBeLessThan(0.1);
    expect(trim(Math.PI / 2, bestSheet(Math.PI / 2))).toBe(1);
    expect(trim(Math.PI / 2, 1)).toBeLessThan(trim(Math.PI / 2, 0.4));
  });
});

import { NEW_BOATS, refitsOf, isShip, launchSpot, hullPoints, halfBeam } from '../src/gen/boats';
describe('the small boat and the ships', () => {
  it('builds the rowboat and the two ships new; the rowboat is refitted with a sail or a motor', () => {
    expect(NEW_BOATS.sort()).toEqual(['row', 'ship', 'steamer'].sort());
    expect(refitsOf('row').sort()).toEqual(['motor', 'sail']);
    expect(refitsOf('sail')).toEqual([]);
    expect(isShip('ship') && isShip('steamer') && !isShip('row')).toBe(true);
    // the ship only sails, the motor ship only steams: no oars on either
    expect(BOATS.ship.sails && !BOATS.ship.row && !BOATS.ship.motor).toBe(true);
    expect(!!BOATS.steamer.motor && !BOATS.steamer.sails).toBe(true);
  });
  it('the ships carry far more than the small boats', () => {
    const small = Math.max(BOATS.row.hold, BOATS.sail.hold, BOATS.motor.hold);
    expect(BOATS.ship.hold).toBeGreaterThan(small * 2.5);
    expect(BOATS.steamer.hold).toBeGreaterThan(small * 2.5);
    expect(BOATS.ship.hold).not.toBe(BOATS.steamer.hold);
  });
  it('the hull narrows to the stem and every point under it lies within the hull', () => {
    for (const k of ['row', 'ship'] as const) {
      expect(halfBeam(k, 0)).toBeCloseTo(BOATS[k].beam / 2, 6);
      expect(halfBeam(k, BOATS[k].len / 2)).toBe(0);
      for (const [u, v] of hullPoints(k)) expect(Math.abs(v)).toBeLessThanOrEqual(BOATS[k].beam / 2 + 1e-9), expect(Math.abs(u)).toBeLessThanOrEqual(BOATS[k].len / 2);
    }
  });
  it('launches alongside a dock where the water is deep enough, beyond its head if need be, else nowhere', () => {
    const dock = { x: 0, z: 0, dx: 0, dz: 1, len: 30, head: 5, headW: 6, w: 3.2 };
    const deep = (_x: number, z: number) => (z < 3 ? null : z * 0.15); // the sea floor falls away from the beach
    const row = launchSpot('row', dock, deep)!, ship = launchSpot('ship', dock, deep)!;
    expect(row).not.toBeNull(); expect(ship).not.toBeNull();
    expect(Math.abs(row.x)).toBeGreaterThan(dock.headW / 2); // beside the head, not on it
    for (const [u, v] of hullPoints('ship')) { const z = ship.z + Math.cos(ship.yaw) * u - Math.sin(ship.yaw) * v; expect(deep(0, z)!).toBeGreaterThanOrEqual(BOATS.ship.draft); }
    expect(launchSpot('ship', dock, () => 0.8)).toBeNull(); // too shallow everywhere
  });
});
