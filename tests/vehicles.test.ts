import { describe, it, expect } from 'vitest';
import { freshParts, upgradeParts, immobile, partPerformance, resaleValue, health, VEHICLES, wheelCount, type VehicleParts } from '../src/data/vehicles';
import { PART_PRICE, PART_BUYBACK } from '../src/data/items';

describe('vehicle parts', () => {
  it('a new vehicle drives at full performance and sells for half its price', () => {
    const p = freshParts('scout');
    expect(p.wheels.length).toBe(wheelCount('scout'));
    expect(immobile(p)).toBeNull();
    expect(partPerformance(p)).toBeCloseTo(1);
    expect(resaleValue('scout', p, 400, 0.2)).toBe(VEHICLES.scout.price / 2);
  });
  it('legacy wheel and engine damage cannot stop a usable vehicle or reduce performance', () => {
    const p = freshParts('mastodon'); p.wheels = [-1, 0, 10, 0, -1, 2]; p.engine = 0;
    expect(immobile(p)).toBeNull(); expect(partPerformance(p)).toBe(1);
    upgradeParts('mastodon', p); expect(p.wheels).toEqual(Array(6).fill(100)); expect(p.engine).toBe(100);
  });
  it('condition alone determines resale value; a cannon adds its buy-back value', () => {
    const p = freshParts('scout'); p.hull *= .3;
    expect(partPerformance(p)).toBe(1);
    const worn = resaleValue('scout', p, 400, .2); expect(worn).toBeLessThan(VEHICLES.scout.price / 2);
    p.gun = true; expect(resaleValue('scout', p, 400, .2) - worn).toBe(80);
  });
  it('a hull shot to pieces stops the vehicle and lowers its value; old saves get a full hull and tank', () => {
    const p = freshParts('scout');
    expect(p.hull).toBe(VEHICLES.scout.hull);
    expect(health('scout', p)).toBe(1);
    p.hull = 0;
    expect(immobile(p)).toMatch(/0%/);
    expect(resaleValue('scout', p, 400, 0.2)).toBeLessThan(VEHICLES.scout.price / 2);
    const old = { wheels: [100, 100, 100, 100, 100, 100], engine: 100, gun: false } as unknown as VehicleParts;
    upgradeParts('mastodon', old);
    expect(old.hull).toBe(VEHICLES.mastodon.hull);
    expect(old.fuel).toBe(VEHICLES.mastodon.tank);
    expect(immobile(old)).toBeNull();
  });
  it('parts sell back for far less than they cost', () => {
    for (const k of Object.keys(PART_PRICE) as (keyof typeof PART_PRICE)[]) expect(PART_PRICE[k]! * PART_BUYBACK).toBeLessThanOrEqual(PART_PRICE[k]! / 4);
  });
});
