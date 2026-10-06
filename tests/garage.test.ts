import { it, expect } from 'vitest';
import { GARAGE, GARAGE_MAX } from '../src/data/garage';
import { ITEMS } from '../src/data/items';
import { VEHICLES } from '../src/data/vehicles';

it('the mechanic builds vehicles from salvage and makes repair kits, in game hours (document 04)', () => {
  expect(GARAGE_MAX).toBeGreaterThan(0);
  for (const g of GARAGE) {
    expect(!!g.car !== !!g.out).toBe(true);
    if (g.car) expect(VEHICLES[g.car]).toBeTruthy(); else expect(ITEMS[g.out!]).toBeTruthy();
    expect(g.hours).toBeGreaterThan(0);
    for (const [k, n] of g.needs) { expect(ITEMS[k], k).toBeTruthy(); expect(n).toBeGreaterThan(0); }
  }
  const scout = GARAGE.find((g) => g.car === 'scout')!;
  expect(scout.needs.map(([k]) => k).sort()).toEqual(['circuit', 'engine', 'gears', 'parts', 'scrap']); // salvage only: nothing a young village makes
  expect(GARAGE.some((g) => g.out === 'repairkit')).toBe(true);
});
