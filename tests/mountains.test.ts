import { describe, it, expect } from 'vitest';
import { Terrain } from '../src/gen/terrain';
import { mountainMask, MOUNTAIN_CLEAR } from '../src/gen/mountains';
import { allVillages, poisNear } from '../src/gen/regions';
import { hash } from '../src/core/rng';
import { regionCaves } from '../src/gen/caves';

describe('mountains', () => {
  it('rise here and there, tall, but never round Gridholm or under places', () => {
    const w = hash(3, 7), t = new Terrain(w);
    let on = 0, n = 0, top = 0;
    for (let x = -20000; x <= 20000; x += 400) for (let z = -20000; z <= 20000; z += 400) {
      const m = mountainMask(w, x, z); n++; if (m > 0.01) on++;
      if (m > 0.5) top = Math.max(top, t.base(x, z));
    }
    console.log(`mountain share ${(on / n * 100).toFixed(1)}%, highest sample ${top.toFixed(0)} m, villages ${allVillages(w).length}`);
    expect(on / n).toBeGreaterThan(0.04); expect(on / n).toBeLessThan(0.3);
    expect(top).toBeGreaterThan(70);
    for (let a = 0; a < 6.28; a += 0.3) expect(mountainMask(w, Math.cos(a) * MOUNTAIN_CLEAR * 0.9, Math.sin(a) * MOUNTAIN_CLEAR * 0.9)).toBe(0);
    for (const v of allVillages(w)) expect(mountainMask(w, v.x, v.z)).toBe(0);
    for (const p of poisNear(w, 0, 0, 12000)) expect(mountainMask(w, p.x, p.z)).toBeLessThan(0.02);
  });
  it('put cave mouths on the flanks, with a walkable approach and rock behind', () => {
    const w = hash(3, 7), t = new Terrain(w), caves = [];
    for (let rx = -40; rx <= 40; rx += 1) for (let rz = -40; rz <= 40; rz += 2) caves.push(...regionCaves(t, rx, rz));
    expect(caves.length).toBeGreaterThan(5);
    for (const c of caves) {
      const fx = Math.cos(c.face), fz = Math.sin(c.face);
      expect(Math.abs(t.base(c.x + fx * 8, c.z + fz * 8) - c.y) / 8).toBeLessThan(0.6); // the approach
      expect(t.base(c.x - fx * 9, c.z - fz * 9) - c.y).toBeGreaterThan(5); // the rock face
      expect(regionCaves(t, Math.floor((c.x + 128) / 256), Math.floor((c.z + 128) / 256))).toContainEqual(c); // deterministic
    }
  });
});
