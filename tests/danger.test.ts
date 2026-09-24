import { describe, it, expect } from 'vitest';
import { dangerAt, villageFar } from '../src/gen/danger';
import { allVillages, regionInfo, NR, REGION } from '../src/gen/regions';
import { hash } from '../src/core/rng';

describe('danger', () => {
  const w = hash(5, 5);
  it('is calm by every village and grows with the distance from it', () => {
    for (const v of allVillages(w).slice(0, 40)) {
      expect(dangerAt(w, v.x + 70, v.z)).toBeLessThan(0.3); // just outside the walls
      const out = [150, 400, 800].map((d) => dangerAt(w, v.x, v.z + 38 + d));
      if (villageFar(w, v.x, v.z + 38 + 800) > 700) expect(out[2]).toBeGreaterThan(out[0]);
    }
    expect(dangerAt(w, 0, 60)).toBe(0);
  });
  it('grows in rings round Gridholm: a calm patch at home, the worst far away', () => {
    const at = (d: number) => [0, 1, 2, 3, 4, 5].map((k) => dangerAt(w, Math.cos(k * 1.05) * d, Math.sin(k * 1.05) * Math.min(d, 20000)));
    for (const v of at(1000)) expect(v).toBeLessThanOrEqual(1.3);
    const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
    const m = [1000, 5000, 15000, 40000].map((d) => mean(at(d)));
    for (let i = 1; i < m.length; i++) expect(m[i]).toBeGreaterThan(m[i - 1]);
    expect(m[3]).toBeGreaterThan(5.5);
  });
  it('reaches the heavy machines only deep in the wilds, and is the same on both sides of the seam', () => {
    let max = 0;
    for (let x = -30000; x < 30000; x += 997) max = Math.max(max, dangerAt(w, x, 7000));
    expect(max).toBeGreaterThan(5);
    expect(max).toBeLessThanOrEqual(8);
    expect(dangerAt(w, 1234, 5678)).toBeCloseTo(dangerAt(w, 1234 + NR * REGION, 5678), 5);
  });
  it('keeps bandit camps out of the calm ground around villages', () => {
    for (let rx = -15; rx <= 15; rx++) for (let rz = -15; rz <= 15; rz++) for (const p of regionInfo(w, rx, rz).pois) {
      if (p.type === 'camp') expect(villageFar(w, p.x, p.z)).toBeGreaterThan(400);
    }
  });
});
