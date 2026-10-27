import { describe, it, expect } from 'vitest';
import { stationDir, STATION, sunAngle } from '../src/core/time';

describe('orbital station', () => {
  it('moves on the unit sphere, rises and sets, and is far quicker than the sun', () => {
    let up = 0, n = 0;
    for (let t = 0; t < STATION.period; t += 2) { const d = stationDir(t); expect(Math.hypot(...d)).toBeCloseTo(1, 6); n++; if (d[1] > 0) up++; }
    expect(up / n).toBeGreaterThan(0.3); expect(up / n).toBeLessThan(0.7);
    expect(STATION.period).toBeLessThan(1440 / 4);
    expect(Math.abs(sunAngle(10) - sunAngle(0))).toBeLessThan(0.05);
  });
});
