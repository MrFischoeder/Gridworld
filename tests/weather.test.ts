import { describe, it, expect } from 'vitest';
import { weatherAt, WEATHER } from '../src/gen/weather';

describe('weather', () => {
  it('is the same for the same place and time, and changes smoothly', () => {
    expect(weatherAt(7, 120, -340, 5000)).toEqual(weatherAt(7, 120, -340, 5000));
    let last = weatherAt(7, 0, 0, 0);
    for (let t = 1; t < 3 * 1440; t += 1) {
      const w = weatherAt(7, 0, 0, t);
      for (const k of ['cloud', 'rain', 'fog', 'storm'] as const) { expect(w[k]).toBeGreaterThanOrEqual(0); expect(w[k]).toBeLessThanOrEqual(1); expect(Math.abs(w[k] - last[k])).toBeLessThan(0.06); }
      last = w;
    }
  });
  it('brings every kind now and then, and differs from place to place', () => {
    const seen = new Set<string>();
    for (let t = 0; t < 40 * 1440; t += WEATHER.slot) seen.add(weatherAt(3, 500, 500, t + WEATHER.fade + 5).kind);
    expect([...seen].sort()).toEqual(['clear', 'fog', 'overcast', 'rain', 'storm']);
    let differ = 0;
    for (let t = 0; t < 20 * 1440; t += WEATHER.slot) if (weatherAt(3, 0, 0, t + 100).kind !== weatherAt(3, 30000, 9000, t + 100).kind) differ++;
    expect(differ).toBeGreaterThan(20);
  });
  it('is gentle in space: a few metres make no jump', () => {
    for (let x = -4000; x < 4000; x += 37) {
      const a = weatherAt(9, x, 1200, 7000), b = weatherAt(9, x + 5, 1200, 7000);
      expect(Math.abs(a.rain - b.rain)).toBeLessThan(0.02);
    }
  });
});
