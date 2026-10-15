import { describe, it, expect } from 'vitest';
import { regionCrystals, fieldCrystals, inCrystals, crystalFieldsNear, CRYSTALS } from '../src/gen/crystals';
import { seaMask } from '../src/gen/seas';
import { allVillages, worldDist } from '../src/gen/regions';

const W = 4242;
describe('crystal forests', () => {
  const fields = [] as NonNullable<ReturnType<typeof regionCrystals>>[];
  for (let rx = -22; rx <= 22; rx++) for (let rz = -22; rz <= 22; rz++) { const f = regionCrystals(W, rx, rz); if (f) fields.push(f); }
  it('turn up here and there, away from home, the sea and the villages', () => {
    expect(fields.length).toBeGreaterThan(5);
    const vs = allVillages(W);
    for (const f of fields) {
      expect(Math.hypot(f.x, f.z)).toBeGreaterThan(CRYSTALS.from);
      expect(seaMask(W, f.x, f.z)).toBe(0);
      expect(vs.every((v) => worldDist(v.x, v.z, f.x, f.z) > CRYSTALS.village - 60)).toBe(true);
      expect(inCrystals(W, f.x, f.z)).toBe(true);
      expect(crystalFieldsNear(W, f.x, f.z).map((q) => q.id)).toContain(f.id);
    }
  });
  it('are giants at the heart, the same every time', () => {
    const f = fields[0], a = fieldCrystals(f);
    expect(Math.max(...a.map((c) => c.len))).toBeGreaterThan(25);
    expect(a.length).toBeGreaterThan(60);
    for (const c of a) { expect(Math.hypot(c.dx, c.dz)).toBeLessThan(f.r + 1); expect(c.d[1]).toBeGreaterThan(0.2); }
    expect(regionCrystals(W, 3, 3)).toEqual(regionCrystals(W, 3, 3));
  });
});
