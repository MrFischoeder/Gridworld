// (0.193) Rounds of their own kind are shelved: every gun fires Energy Cells, nothing gives or makes the old rounds.
import { describe, it, expect } from 'vitest';
import { GUNS, AMMO_TYPES, roundsInUse, SHOT } from '../src/data/weapons';
import { ORDERS } from '../src/data/orders';
import { ITEMS } from '../src/data/items';

describe('one kind of rounds for now', () => {
  it('every gun fires Energy Cells and keeps its own round on the shelf', () => {
    expect(AMMO_TYPES).toBe(false);
    for (const [k, g] of Object.entries(GUNS)) {
      expect(g!.ammo, k).toBe('ammoE');
      if (k !== 'blaster') expect(ITEMS[g!.round!], k).toBeTruthy();
    }
  });
  it('the old rounds still exist as items but nobody makes them', () => {
    for (const k of ['ammo9', 'ammoS', 'ammoR'] as const) { expect(ITEMS[k]).toBeTruthy(); expect(roundsInUse(k)).toBe(false); }
    expect(roundsInUse('ammoE')).toBe(true);
    expect(ORDERS.filter((o) => roundsInUse(o.out)).some((o) => o.out === 'ammo9')).toBe(false);
  });
  it('every gun shoots its own way', () => {
    const looks = new Set(Object.values(GUNS).map((g) => JSON.stringify(SHOT[g!.look])));
    expect(looks.size).toBe(Object.keys(GUNS).length);
  });
});
