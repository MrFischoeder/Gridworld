import { describe, it, expect } from 'vitest';
import { reactorVillages, oldReactor, fuelOrder, FUEL, chipVillages, chipBuyer, chipOrder, specialOrders, CHIPS } from '../src/gen/contracts';
import { allVillages, worldDist, GRIDHOLM_ID } from '../src/gen/regions';

describe('fuel orders', () => {
  it('come from a few villages far out with old reactors, fixed per world', () => {
    for (const w of [12345, 777, 1]) {
      const r = reactorVillages(w);
      expect(r.map((v) => v.id)).toEqual(reactorVillages(w).map((v) => v.id));
      expect(r.length).toBeGreaterThan(3); expect(r.length).toBeLessThan(40);
      for (const v of r) { expect(v.id).not.toBe(GRIDHOLM_ID); expect(worldDist(v.x, v.z, 0, 0)).toBeGreaterThanOrEqual(FUEL.from); }
    }
  });
  it('post an order most days: 1-3 crates of rods, well paid, due in 3-6 days', () => {
    const v = reactorVillages(12345)[0];
    let orders = 0;
    for (let day = 0; day < 40; day++) {
      const now = day * 1440 + 300, o = fuelOrder(12345, v, now);
      expect(o).toEqual(fuelOrder(12345, v, day * 1440 + 1200));
      if (!o) continue;
      orders++;
      expect(o.good).toBe('nfuel'); expect(o.kind).toBe('supply'); expect(o.to).toBe(v.id);
      expect(o.n).toBeGreaterThanOrEqual(1); expect(o.n).toBeLessThanOrEqual(3);
      expect(o.pay).toBeGreaterThanOrEqual(FUEL.pay);
      expect(o.due - day * 1440).toBeGreaterThanOrEqual(3 * 1440); expect(o.due - day * 1440).toBeLessThanOrEqual(6 * 1440);
    }
    expect(orders).toBeGreaterThan(15); expect(orders).toBeLessThan(40);
    const other = allVillages(12345).find((x) => !oldReactor(12345, x))!;
    expect(fuelOrder(12345, other, 0)).toBeNull();
  });
  it('chip orders come from craft villages away from Gridholm', () => {
    for (const w of [12345, 777, 1]) {
      const r = chipVillages(w);
      expect(r.length).toBeGreaterThan(3); expect(r.length).toBeLessThan(45);
      for (const v of r) { expect(v.id).not.toBe(GRIDHOLM_ID); expect(worldDist(v.x, v.z, 0, 0)).toBeGreaterThanOrEqual(CHIPS.from); }
    }
    const v = chipVillages(12345)[0];
    let orders = 0;
    for (let day = 0; day < 40; day++) {
      const o = chipOrder(12345, v, day * 1440 + 60);
      if (!o) continue;
      orders++;
      expect(o.good).toBe('microchip'); expect(o.n).toBeGreaterThanOrEqual(1); expect(o.n).toBeLessThanOrEqual(4); expect(o.pay).toBeGreaterThanOrEqual(CHIPS.pay);
      expect(specialOrders(12345, v, day * 1440 + 60)).toContainEqual(o);
    }
    expect(orders).toBeGreaterThan(10);
    const other = allVillages(12345).find((x) => !chipBuyer(12345, x))!;
    expect(chipOrder(12345, other, 0)).toBeNull();
  });
});
