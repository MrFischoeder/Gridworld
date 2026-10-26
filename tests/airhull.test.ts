import { describe, it, expect } from 'vitest';
import { HULL, hullOf, hullHit, hullDamage, hullMend, hullSpeed, strikeEvery, hasFlak, flakHit, FLAK, tripRisk, RISK } from '../src/gen/airhull';
import { newAirship } from '../src/gen/airships';
import { newCopter } from '../src/gen/copters';
import { SKY, newSkyLine, skAssign, skRecall, skAt, skLeg, settleSkyLine, skFuel, type SkyLine } from '../src/gen/skylines';
import type { Hub } from '../src/gen/warehouses';

const W = 12345;
describe('the dangers of the air (0.260)', () => {
  it('a hull takes hits scaled by the machine, mends in kit steps and never goes below 0 or above 100', () => {
    const a = newAirship({ drive: 'fuel', given: {} }, 'x', { x: 0, y: 0, z: 0, yaw: 0 }, 'A', 'p', 0), c = newCopter('x', { x: 0, y: 0, z: 0, yaw: 0 }, 'A', 'p', 0);
    expect(hullOf(a)).toBe(100);
    expect(hullHit(a, 'airship', 20)).toBeCloseTo(20 * HULL.armour.airship); expect(hullHit(c, 'copter', 20)).toBeCloseTo(20 * HULL.armour.copter);
    expect(HULL.armour.copter).toBeGreaterThan(HULL.armour.airship); // the rotorcraft's skin is thin
    hullDamage(a, 1000); expect(hullOf(a)).toBe(0);
    expect(hullMend(a)).toBe(HULL.kit); expect(hullOf(a)).toBe(HULL.kit);
    hullMend(a); hullMend(a); expect(hullOf(a)).toBe(100); expect(a.hull).toBeUndefined(); // whole again: no field
    expect(hullMend(a)).toBe(0);
  });
  it('a torn hull flies slower and a lightning bolt only comes in a real storm', () => {
    expect(hullSpeed(100)).toBe(1); expect(hullSpeed(HULL.worn)).toBe(1); expect(hullSpeed(0)).toBeCloseTo(HULL.slow);
    expect(hullSpeed(25)).toBeGreaterThan(HULL.slow); expect(hullSpeed(25)).toBeLessThan(1);
    expect(strikeEvery(0.3)).toBe(0); expect(strikeEvery(HULL.storm - 0.01)).toBe(0);
    expect(strikeEvery(HULL.storm)).toBeGreaterThan(strikeEvery(1)); expect(strikeEvery(1)).toBeGreaterThan(0);
  });
  it('some bandit camps have an anti-air gun, only where it is dangerous, and a burst misses at a distance', () => {
    let n = 0; for (let id = 0; id < 400; id++) if (hasFlak(W, id, 3)) n++;
    expect(n / 400).toBeGreaterThan(FLAK.chance * 0.6); expect(n / 400).toBeLessThan(FLAK.chance * 1.5);
    expect(hasFlak(W, 5, FLAK.from - 1)).toBe(false);
    expect(flakHit(10, 0)).toBeGreaterThan(flakHit(FLAK.range * 0.9, 0)); expect(flakHit(FLAK.range, 0)).toBe(0);
    expect(flakHit(50, 40)).toBeLessThan(flakHit(50, 0)); // a fast target is harder
  });
  it('a trip is riskier where it is dangerous and in a storm, never above the cap', () => {
    expect(tripRisk(5, 0)).toBeGreaterThan(tripRisk(0, 0)); expect(tripRisk(0, 0.9)).toBeGreaterThan(tripRisk(0, 0.2));
    expect(tripRisk(99, 1)).toBe(RISK.max);
  });
  it('a damaged line ship loses the load; a wrecked one stops the line until it is recalled; the hull travels with the ship', () => {
    const A: Hub = { id: 'a', kind: 'wild', x: 0, z: 0, hex: 'a', name: 'A' }, B: Hub = { id: 'b', kind: 'wild', x: 20000, z: 0, hex: 'b', name: 'B' };
    const l: SkyLine = newSkyLine(A, B, 0), s = newAirship({ drive: 'fuel', given: {} }, 'a', { x: 0, y: 0, z: 0, yaw: 0 }, 'Ala', 'p', 0); s.hull = 60;
    skAssign(l, s, 0, 'x'); expect(l.ship!.hull).toBe(60); skFuel(l, 15);
    const hold = { n: 5000 }, take = (cap: number): [import('../src/data/items').ItemKey, number][] => { const m = Math.min(cap, hold.n); hold.n -= m; return m ? [['planks', m]] : []; };
    let fates: string[] = [];
    // run many trips: with a high risk some are damaged (their load is lost), and the hull only falls
    for (let w = 0; w < 400 && hullOf(l.ship!) > 0; w++) {
      const ll = newSkyLine(A, B, 0); skAssign(ll, { ...s, hull: l.ship!.hull } as typeof s, 0, 'x'); ll.ship!.fuel = 300; ll.id = w;
      const before = hullOf(ll.ship!), out = settleSkyLine(W, A, ll, true, true, take, SKY.load + skLeg(ll) + 5);
      fates = fates.concat(out);
      if (out.includes('damaged') || out.includes('wrecked')) { expect(hullOf(ll.ship!)).toBeLessThan(before); expect(ll.sent).toEqual({}); l.ship!.hull = ll.ship!.hull; if (out.includes('wrecked')) break; }
    }
    expect(fates.includes('ok')).toBe(true); expect(fates.some((f) => f === 'damaged' || f === 'wrecked')).toBe(true);
    const w = newSkyLine(A, B, 0); skAssign(w, { ...s, hull: 0 } as typeof s, 0, 'x');
    expect(skAt(w, 5000).at).toBe('parked');
    expect(settleSkyLine(W, A, w, true, true, take, 1e6)).toEqual([]); expect(w.last![1]).toBe('wrecked');
    const back = skRecall(w, 'a', { x: 0, y: 0, z: 0, yaw: 0 }); expect(hullOf(back)).toBe(0);
  });
});
