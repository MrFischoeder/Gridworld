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
