import { describe, it, expect } from 'vitest';
import { newChar, trunksOut, trunkKey } from '../src/save';
import type { VehicleState } from '../src/save';
import { freshParts } from '../src/data/vehicles';

describe('vehicles belong to nobody (0.248)', () => {
  it('an old save\'s trunks and cargo bays become the shared containers', () => {
    const c = newChar();
    const v: VehicleState = { id: 'van-1', model: 'van', x: 0, z: 0, heading: 0, parts: freshParts('van'), trunk: { items: [{ k: 'stone', n: 4 }, null], gold: 7 }, bays: [{ k: 'crateW', n: 1, b: { k: 'planks', n: 10 } }, null] };
    c.vehicles.push(v);
    trunksOut(c);
    expect(v.trunk).toBeUndefined();
    expect(v.bays).toBeUndefined();
    expect(c.containers[trunkKey('van-1')]).toEqual({ items: [{ k: 'stone', n: 4 }, null], gold: 7, bays: [{ k: 'crateW', n: 1, b: { k: 'planks', n: 10 } }, null] });
  });
  it('a trunk already moved out is kept, never overwritten', () => {
    const c = newChar();
    c.containers[trunkKey('s')] = { items: [{ k: 'scrap', n: 1 }], gold: 0 };
    c.vehicles.push({ id: 's', model: 'scout', x: 0, z: 0, heading: 0, parts: freshParts('scout'), trunk: { items: [], gold: 0 } });
    trunksOut(c);
    expect(c.containers[trunkKey('s')].items[0]).toEqual({ k: 'scrap', n: 1 });
    expect(c.vehicles[0].trunk).toBeUndefined();
  });
});
