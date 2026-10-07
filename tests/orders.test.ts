import { describe, it, expect } from 'vitest';
import { ORDERS, VILLAGE_TECHS, orderState, placeOrder } from '../src/data/orders';
import { TECHS, TECH_BY_ID } from '../src/gen/tech';
import { ITEMS } from '../src/data/items';
import type { Slot } from '../src/save';

const inv = (...s: [string, number][]): (Slot | null)[] => [...s.map(([k, n]) => ({ k, n }) as Slot), ...Array(12 - s.length).fill(null)];

describe('craftsmen orders', () => {
  it('name real technologies and items, and every technology is for the craftsmen or the villages', () => {
    for (const o of ORDERS) { if (o.tech) expect(TECH_BY_ID[o.tech]).toBeTruthy(); expect(ITEMS[o.out]).toBeTruthy(); for (const [k] of o.needs) expect(ITEMS[k]).toBeTruthy(); }
    for (const t of TECHS) expect(ORDERS.some((o) => o.tech === t.id) || VILLAGE_TECHS.includes(t.id)).toBe(true);
  });
  it('need the plans and the materials, and take the materials', () => {
    const o = ORDERS.find((x) => x.out === 'hammer')!, bag = inv(['planks', 3], ['scrap', 2]), hands: (Slot | null)[] = [null];
    expect(orderState(o, {}, bag)).toBe('plans');
    expect(placeOrder(o, {}, bag, 40, hands)).toBe('plans');
    expect(orderState(o, { forging: 1 }, inv(['planks', 3]))).toBe('missing');
    expect(orderState(o, { forging: 1 }, bag)).toBe('');
    expect(placeOrder(o, { forging: 1 }, bag, 40, hands)).toBe('');
    expect(bag.filter(Boolean)).toEqual([{ k: 'planks', n: 2 }, { k: 'hammer', n: 1 }]);
  });
  it('the basics need no plans: nobody is stuck without a hatchet and a pickaxe', () => {
    for (const out of ['hatchet', 'pickaxe', 'firekit', 'flask', 'saw']) expect(ORDERS.some((o) => o.out === out && !o.tech)).toBe(true);
    const o = ORDERS.find((x) => x.out === 'hatchet')!;
    expect(orderState(o, {}, inv(['log', 1], ['stone', 2]))).toBe('');
  });
  it('hand big things over into empty hands only', () => {
    const o = ORDERS.find((x) => x.out === 'wheelL')!, bag = inv(['planks', 4], ['scrap', 2]);
    expect(placeOrder(o, { wagons: 1 }, bag, 40, [{ k: 'blaster', n: 1 }])).toBe('hands');
    const hands: (Slot | null)[] = [null];
    expect(placeOrder(o, { wagons: 1 }, bag, 40, hands)).toBe('');
    expect(hands[0]?.k).toBe('wheelL');
  });
});
