import { describe, it, expect } from 'vitest';
import { vehiclesOpen, GRIDHOLM_ID } from '../src/gen/settlement';
import type { TownState } from '../src/gen/town';

describe('no vehicles before the mechanic (0.202)', () => {
  const town = (done: Record<string, boolean> = {}): TownState => ({ settlement: { v: 1, done } } as TownState);
  it('an old world keeps its vehicles', () => expect(vehiclesOpen({ towns: {} })).toBe(true));
  it('a new settlement has none until the mechanic comes (power and a yard)', () => {
    expect(vehiclesOpen({ towns: { [GRIDHOLM_ID]: town() } })).toBe(false);
    expect(vehiclesOpen({ towns: { [GRIDHOLM_ID]: town({ power: true }) } })).toBe(false);
    expect(vehiclesOpen({ towns: { [GRIDHOLM_ID]: town({ power: true, quarry: true }) } })).toBe(true);
  });
  it('a vehicle you own or ordered keeps them', () => {
    expect(vehiclesOpen({ towns: { [GRIDHOLM_ID]: town() }, vehicles: [{}] })).toBe(true);
    expect(vehiclesOpen({ towns: { [GRIDHOLM_ID]: town() }, garage: [{}] })).toBe(true);
  });
});
