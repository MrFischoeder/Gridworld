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
