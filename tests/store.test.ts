import { describe, it, expect } from 'vitest';
import { storeAt, storeCap, storeFull, takeStore, storePlan, handOverStore, STORE } from '../src/gen/store';
import { tribute, raidOutcome, type Raid } from '../src/gen/raids';
import type { TownState } from '../src/gen/town';

describe('storehouse', () => {
  it('fills while the site works, empties while it stands, and stays within its walls', () => {
    const s: TownState = { store: { n: 10, t: 0 } };
    expect(storeAt(1, s, 600, 1)).toBeCloseTo(10 + (STORE.rate - STORE.ship) * 10);
    expect(storeAt(1, s, 600, 0)).toBeCloseTo(10 - STORE.ship * 10);
    expect(storeAt(1, s, 1e6, 1)).toBe(storeCap(s));
    expect(storeFull(1, s, 1e6, 1)).toBe(true);
    expect(storeAt(1, s, 1e6, 0)).toBe(0);
    // an untouched village starts part full, the same every time
    expect(storeAt(7, undefined, 0, 1)).toBe(storeAt(7, undefined, 0, 1));
    expect(storeAt(7, undefined, 0, 1)).toBeGreaterThan(0);
  });
  it('gives up crates you buy, and grows when built bigger', () => {
    const s: TownState = { store: { n: 20, t: 0 } };
    expect(takeStore(s, 1, 5, 0, 1)).toBe(5); expect(storeAt(1, s, 0, 1)).toBe(15);
    expect(takeStore(s, 1, 99, 0, 1)).toBe(15); expect(storeAt(1, s, 0, 1)).toBe(0);
    const t: TownState = { store: { n: 40, t: 0 } };
    const plan = storePlan(t)!;
    const r1 = handOverStore(t, 1, 0, 1, (k) => (k === 'planks' ? 10 : 0));
    expect(r1.built).toBe(false); expect(r1.taken).toEqual([['planks', 10]]);
    const r2 = handOverStore(t, 1, 0, 1, () => 999);
    expect(r2.built).toBe(true); expect(t.storeTier).toBe(plan.to);
    expect(storeCap(t)).toBe(STORE.tiers[1].cap); expect(storeAt(1, t, 0, 1)).toBe(40); // kept what was in it
  });
});

describe('bandit tribute', () => {
  const r = (k: number, strength: number): Raid => ({ village: 5, k, t0: 0, strength, camp: { id: 1, name: 'X Camp', x: 0, z: 0 } as Raid['camp'] });
  it('asks more of a rich village and of a strong band, less behind a stone wall', () => {
    expect(tribute(r(1, 4), 1000, 0)).toBeGreaterThan(tribute(r(1, 4), 0, 0));
    expect(tribute(r(1, 6), 0, 0)).toBeGreaterThan(tribute(r(1, 2), 0, 0));
    expect(tribute(r(1, 4), 500, 2)).toBeLessThan(tribute(r(1, 4), 500, 0));
    expect(tribute(r(1, 4), 500, 0) % 10).toBe(0);
  });
  it('villages without you sometimes pay, the weak more often', () => {
    const tally = (wall: number) => { let paid = 0; for (let k = 1; k <= 400; k++) if (raidOutcome(9, r(k, 4), { wall }) === 'paid') paid++; return paid; };
    expect(tally(0)).toBeGreaterThan(tally(2));
    expect(tally(0)).toBeGreaterThan(40);
    expect(raidOutcome(9, r(3, 4), { raids: { 3: 'paid' } })).toBe('paid');
  });
});
