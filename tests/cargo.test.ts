import { describe, it, expect } from 'vitest';
import { CARGO, holds, boxCap, boxRoom, packFrom, takeOut, slotKg, isCargo } from '../src/data/cargo';
import { VEHICLES, SEATS, BAY_SPOTS, HULL_BOXES, MODEL_ORDER, modelOf, fitBays, EV, type VehicleModel } from '../src/data/vehicles';
import { HANDS_ONLY, BULK } from '../src/data/items';
import { putSlot, stackable, weightOf } from '../src/inventory';
import { unloadBays } from '../src/gen/hall';
import { ROUTE } from '../src/gen/routes';
import { GARAGE } from '../src/data/garage';
import type { Slot } from '../src/save';

describe('crates and barrels (0.247)', () => {
  it('a steel one holds more than a wooden one, both carried in the hands', () => {
    expect(CARGO.crateM!.cap).toBeGreaterThan(CARGO.crateW!.cap);
    expect(CARGO.barrelM!.cap).toBeGreaterThan(CARGO.barrelW!.cap);
    for (const k of ['crateW', 'crateM', 'barrelW', 'barrelM'] as const) { expect(HANDS_ONLY.has(k)).toBe(true); expect(isCargo(k)).toBe(true); }
    expect(boxCap('crateW', 'planks')).toBe(40);
    expect(boxCap('crateM', 'planks')).toBe(66);
    expect(boxCap('barrelW', 'fuel')).toBe(3);
    expect(boxCap('barrelM', 'fuel')).toBe(5);
  });
  it('a crate takes building stuff, a barrel liquids, neither the other', () => {
    expect(holds('crateW', 'stone')).toBe(true);
    expect(holds('crateW', 'ironO')).toBe(true);
    expect(holds('crateW', 'fuel')).toBe(false);
    expect(holds('barrelW', 'fuel')).toBe(true);
    expect(holds('barrelW', 'planks')).toBe(false);
    expect(holds('crateW', 'crateW')).toBe(false);
    expect(holds('crateW', 'wheelL')).toBe(false);
  });
  it('packs one kind at a time, up to the brim, and empties again', () => {
    const crate: Slot = { k: 'crateW', n: 1 }, from: (Slot | null)[] = [{ k: 'planks', n: 20 }, { k: 'planks', n: 20 }, { k: 'planks', n: 20 }, { k: 'stone', n: 5 }];
    expect(packFrom(crate, from, 0)).toBe(20);
    expect(from[0]).toBe(null);
    expect(packFrom(crate, from, 1)).toBe(20);
    expect(packFrom(crate, from, 2)).toBe(0); // full
    expect(packFrom(crate, from, 3)).toBe(0); // planks inside, not stone
    expect(crate.b).toEqual({ k: 'planks', n: 40 });
    expect(boxRoom(crate, 'planks')).toBe(0);
    expect(slotKg(crate)).toBeCloseTo(BULK.crateW[0] + 40 * BULK.planks[0]);
    expect(weightOf([crate])).toBeCloseTo(slotKg(crate));
    expect(takeOut(crate, 15)).toBe(15);
    expect(crate.b!.n).toBe(25);
    expect(takeOut(crate)).toBe(25);
    expect(crate.b).toBeUndefined();
  });
  it('a filled crate never stacks and keeps its load wherever it is put', () => {
    const a: Slot = { k: 'crateW', n: 1, b: { k: 'stone', n: 10 } }, list: (Slot | null)[] = [{ k: 'crateW', n: 1 }, null];
    expect(stackable(a, list[0]!)).toBe(false);
    expect(putSlot(list, a)).toBe(0);
    expect(list[1]!.b).toEqual({ k: 'stone', n: 10 });
  });
  it('the warehouse takes what the crates in the bays hold, the empty crates stay aboard', () => {
    const bays: (Slot | null)[] = [{ k: 'crateW', n: 1, b: { k: 'planks', n: 30 } }, { k: 'barrelW', n: 1, b: { k: 'fuel', n: 2 } }, null];
    const s = {} as Parameters<typeof unloadBays>[0];
    expect(unloadBays(s, bays)).toBe(32);
    expect(bays[0]!.k).toBe('crateW');
    expect(bays[0]!.b).toBeUndefined();
  });
});

describe('the van (0.247)', () => {
  it('sits between the jeep and the truck', () => {
    const s = VEHICLES.scout, v = VEHICLES.van, m = VEHICLES.mastodon;
    for (const k of ['length', 'bays', 'trunk', 'hull', 'tank', 'price'] as const) { expect(v[k]).toBeGreaterThan(s[k]); expect(v[k]).toBeLessThan(m[k]); }
    expect(v.maxSpeed).toBeLessThan(s.maxSpeed); expect(v.maxSpeed).toBeGreaterThan(m.maxSpeed);
    expect(EV.van.cap).toBeGreaterThan(EV.scout.cap);
    expect(ROUTE.cap.van).toBeGreaterThan(ROUTE.cap.scout);
    expect(GARAGE.some((g) => g.car === 'van')).toBe(true);
  });
  it('every model has its seats, bays and hull', () => {
    for (const m of Object.keys(VEHICLES) as VehicleModel[]) {
      expect(SEATS[m].length).toBe(VEHICLES[m].seats);
      expect(BAY_SPOTS[m].at.length).toBe(VEHICLES[m].bays);
      expect(HULL_BOXES[m].length).toBeGreaterThan(0);
      expect(fitBays(m, undefined).length).toBe(VEHICLES[m].bays);
      expect(MODEL_ORDER.includes(m)).toBe(true);
    }
  });
  it('the models keep their numbers for the other players', () => {
    expect(MODEL_ORDER.slice(0, 2)).toEqual(['scout', 'mastodon']);
    expect(modelOf(2)).toBe('van');
    expect(modelOf(9)).toBe('scout');
  });
});
