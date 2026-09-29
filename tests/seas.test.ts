import { describe, it, expect } from 'vitest';
import { seaMask, seaThreshold, SEA } from '../src/gen/seas';
import { Terrain } from '../src/gen/terrain';
import { allVillages, regionInfo, X_MIN, WORLD_W, POLAR_Z, NR, REGION } from '../src/gen/regions';
import { network, edgePath } from '../src/gen/roads';
import { chunkTrees } from '../src/gen/trees';

const WORLDS = [12345, 777, 42];

describe('seas', () => {
  it('cover about a quarter of the land between the ice caps', () => {
    for (const w of WORLDS) {
      let sea = 0, n = 0;
      for (let z = -POLAR_Z + 150; z < POLAR_Z; z += 700) for (let x = X_MIN + 150; x < X_MIN + WORLD_W; x += 700) { n++; if (seaMask(w, x, z) > 0.3) sea++; }
      expect(sea / n, `world ${w}`).toBeGreaterThan(0.2);
      expect(sea / n, `world ${w}`).toBeLessThan(0.3);
    }
  });
  it('leave the land round Gridholm as it was', () => {
    for (const w of WORLDS) for (let a = 0; a < 6.28; a += 0.2) for (const d of [0, 1000, 2500, 3400]) expect(seaMask(w, Math.cos(a) * d, Math.sin(a) * d)).toBe(0);
  });
  it('keep villages, ruins, camps and crash sites on dry land', () => {
    for (const w of WORLDS) {
      for (const v of allVillages(w)) expect(seaMask(w, v.x, v.z), v.name).toBeLessThan(0.01);
      for (let rx = -60; rx <= 60; rx += 3) for (let rz = -60; rz <= 60; rz += 3)
        for (const p of regionInfo(w, rx, rz).pois) expect(seaMask(w, p.x, p.z), `${p.type} ${p.name}`).toBeLessThan(0.01);
    }
  });
  it('are deep salt water where the mask is high, and wrap round the planet', () => {
    const w = WORLDS[0], t = new Terrain(w);
    let found = 0;
    for (let z = -POLAR_Z + 500; z < POLAR_Z && found < 20; z += 1300) for (let x = X_MIN; x < X_MIN + WORLD_W && found < 20; x += 1300) {
      if (seaMask(w, x, z) < 0.9) continue;
      found++;
      const h = t.water(x, z);
      expect(h?.kind).toBe('sea');
      expect(h!.level).toBe(SEA.level);
      expect(h!.depth).toBeGreaterThan(10);
      expect(seaMask(w, x + NR * REGION, z)).toBeCloseTo(seaMask(w, x, z), 6);
      // no trees in it
      expect(chunkTrees(t, Math.floor(x / 32), Math.floor(z / 32)).length).toBe(0);
    }
    expect(found).toBeGreaterThan(5);
    expect(seaThreshold(w)).toBe(seaThreshold(w));
  });
  it('are never crossed by a road', () => {
    const w = WORLDS[0], t = new Terrain(w);
    for (const e of network(w).slice(0, 120)) {
      const p = edgePath(w, e);
      if (!p) continue;
      for (const [x, z] of p.pts) expect(t.water(x, z)?.kind).not.toBe('sea');
    }
  }, 120000);
});
