import { describe, it, expect } from 'vitest';
import { FALL, fallIn, fallSlot, fallSpot, fallLoot, fallPath } from '../src/gen/skyfall';
import { ITEMS } from '../src/data/items';

describe('sky falls', () => {
  it('are rare, deterministic and fall inside their slot', () => {
    let n = 0;
    for (let s = 0; s < 400; s++) { const f = fallIn(-777, s); expect(fallIn(-777, s)).toEqual(f); expect(f.at).toBeGreaterThanOrEqual(s * FALL.period); expect(f.at).toBeLessThan((s + 1) * FALL.period); if (f.go) n++; }
    expect(n / 400).toBeGreaterThan(0.25); expect(n / 400).toBeLessThan(0.55);
    expect(fallSlot(FALL.period * 3 + 5)).toBe(3);
  });
  it('lands 380-820 m away and holds real items', () => {
    for (let k = 0; k < 20; k++) { const p = fallSpot(5, 2, 100, -50, k); const d = Math.hypot(p.x - 100, p.z + 50); expect(d).toBeGreaterThanOrEqual(FALL.near - 1); expect(d).toBeLessThanOrEqual(FALL.far + 1); }
    for (let s = 0; s < 50; s++) for (const [k, n] of fallLoot(9, s)) { expect((ITEMS as Record<string, unknown>)[k]).toBeTruthy(); expect(n).toBeGreaterThan(0); }
  });
  it('the streak ends on the impact point', () => {
    const to = { x: 10, y: 3, z: -4 }, e = fallPath(to, 1.2, 1), s = fallPath(to, 1.2, 0);
    expect(e).toEqual(to); expect(s.y - to.y).toBeGreaterThan(900);
  });
});
