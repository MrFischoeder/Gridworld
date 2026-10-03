import { describe, expect, it } from 'vitest';
import { continents, nearestContinent } from '../src/gen/continents';
import { seaMask } from '../src/gen/seas';
import { WORLD_W, X_MIN, POLAR_Z, wrapX } from '../src/gen/regions';
import { citySites, CITY } from '../src/gen/cities';

describe('large separated continents', () => {
  it('has two or three deterministic mainland masses, with home safely on the first', () => {
    const counts = new Set<number>();
    for (const world of [12345, 4242, 777, 42, 1, 2, 3, 4]) {
      const land = continents(world); counts.add(land.length);
      expect([2, 3]).toContain(land.length); expect(continents(world)).toEqual(land);
      expect(seaMask(world, 0, 0)).toBe(0);
      for (const c of land) {
        expect(seaMask(world, c.x, c.z)).toBe(0);
        expect(seaMask(world, c.x + WORLD_W, c.z)).toBe(seaMask(world, c.x, c.z));
        const midpoint = c.x + WORLD_W / land.length / 2;
        // Every gap contains an uninterrupted 6 km ocean band across playable latitudes.
        for (let z = -POLAR_Z + 6000; z <= POLAR_Z - 6000; z += 1000) for (const offset of [-3000, 0, 3000]) expect(seaMask(world, midpoint + offset, z)).toBe(1);
      }
    }
    expect([...counts].sort()).toEqual([2, 3]);
  });
  it('keeps mainland components disconnected even across the east-west wrap seam', () => {
    for (const world of [12345, 777, 42]) {
      const nx = 240, nz = 100, sx = WORLD_W / nx, sz = 2 * POLAR_Z / nz;
      const labels = new Int32Array(nx * nz), dry = new Uint8Array(nx * nz), sizes: number[] = [0];
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) dry[i + j * nx] = seaMask(world, X_MIN + (i + 0.5) * sx, -POLAR_Z + (j + 0.5) * sz) < 0.01 ? 1 : 0;
      let label = 0;
      for (let k = 0; k < dry.length; k++) if (dry[k] && !labels[k]) {
        label++; sizes[label] = 0; const stack = [k]; labels[k] = label;
        while (stack.length) {
          const p = stack.pop()!, i = p % nx, j = Math.floor(p / nx); sizes[label]++;
          const adjacent = [(i + nx - 1) % nx + j * nx, (i + 1) % nx + j * nx];
          if (j) adjacent.push(p - nx); if (j + 1 < nz) adjacent.push(p + nx);
          for (const n of adjacent) if (dry[n] && !labels[n]) { labels[n] = label; stack.push(n); }
        }
      }
      const components = continents(world).map(c => {
        const i = Math.floor((wrapX(c.x) - X_MIN) / sx), j = Math.floor((c.z + POLAR_Z) / sz), l = labels[i + j * nx];
        expect(sizes[l]).toBeGreaterThan(1000); return l;
      });
      expect(new Set(components).size).toBe(continents(world).length);
    }
  });
  it('places twelve ruined cities across every mainland, retaining four vault IDs per city', () => {
    for (const world of [12345, 4242, 777]) {
      const cities = citySites(world), counts = new Map<number, number>();
      expect(CITY.n).toBe(12); expect(cities).toHaveLength(12);
      for (const city of cities) { const i = nearestContinent(world, city.x, city.z).i; counts.set(i, (counts.get(i) ?? 0) + 1); }
      expect(counts.size).toBe(continents(world).length);
      for (const count of counts.values()) expect(count).toBe(12 / continents(world).length);
    }
  });
});
