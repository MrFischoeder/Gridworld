import { describe, it, expect } from 'vitest';
import { regionFog, fogsNear, fogAt, fogDensity, inFogSite, lockerLoot, filterWear, fogHarm, FOG, MASK, FOG_SITE } from '../src/gen/toxic';
import { isleOf, islesNear, isleHeight, SEA, ISLE } from '../src/gen/seas';
import { naturalHeight } from '../src/gen/heights';
import { Terrain } from '../src/gen/terrain';
import { villageDist, REGION, CHUNK } from '../src/gen/regions';
import { chunkTrees, chunkRocks } from '../src/gen/trees';
import { ORDERS } from '../src/data/orders';
import { TECH_BY_ID } from '../src/gen/tech';
import { ITEMS, WEAR } from '../src/data/items';

const W = 12345;
/** Every zone of a band of regions round the planet's middle (x -60..60 km, z -25..25 km, every other region). */
function sample() {
  const out = [];
  for (let rx = -234; rx <= 234; rx += 2) for (let rz = -96; rz <= 96; rz += 2) { const f = regionFog(W, rx, rz); if (f) out.push(f); }
  return out;
}

describe('islands', () => {
  it('stand out of the open sea, dry in the middle', () => {
    let n = 0;
    for (let i = 0; i < 75 && n < 12; i++) for (let j = -15; j <= 15; j++) {
      const s = isleOf(W, i, j);
      if (!s) continue;
      n++;
      expect(naturalHeight(W, s.x, s.z)).toBeGreaterThan(SEA.level + 0.5);
      expect(isleHeight(W, s.x, s.z)).toBeGreaterThan(SEA.level + ISLE.top[0] - 0.1);
      expect(naturalHeight(W, s.x + s.r * 2.2, s.z)).toBeLessThan(SEA.level); // sea round it
    }
    expect(n).toBeGreaterThan(5);
  });
  it('are the same on both sides of the seam', () => {
    const s = isleOf(W, 3, 2)!;
    if (s) expect(islesNear(W, s.x + 120320, s.z).some((q) => Math.abs(q.x - s.x - 120320) < 1e-6)).toBe(true);
  });
});

describe('toxic fog zones', () => {
  const zones = sample();
  it('come on islands and far out on land, never near home or a village', () => {
    const isles = zones.filter((f) => f.kind === 'isle'), land = zones.filter((f) => f.kind === 'land');
    expect(isles.length).toBeGreaterThan(4);
    expect(land.length).toBeGreaterThan(4);
    for (const f of zones) {
      expect(Math.hypot(f.x, f.z)).toBeGreaterThan(FOG.isleFrom);
      expect(f.r).toBeLessThanOrEqual(FOG.maxR);
      expect(villageDist(W, f.x, f.z, f.r + 200)).toBeGreaterThan(f.kind === 'land' ? f.r : 0);
      expect(FOG_SITE[f.site]).toBeTruthy();
    }
    for (const f of land) expect(Math.hypot(f.x, f.z)).toBeGreaterThanOrEqual(FOG.landFrom);
    for (const f of isles) expect(naturalHeight(W, f.x, f.z)).toBeGreaterThan(SEA.level); // the site stands on the island
  });
  it('are deterministic and found from nearby points', () => {
    const f = zones[0];
    expect(regionFog(W, Math.floor((f.x + 128) / REGION), Math.floor((f.z + 128) / REGION))).toEqual(f);
    expect(fogsNear(W, f.x + f.r * 0.3, f.z).some((q) => q.id === f.id)).toBe(true);
    expect(fogAt(W, f.x, f.z).d).toBe(1);
    expect(fogDensity(f, f.x + f.r * 1.2, f.z)).toBe(0);
    expect(fogAt(W, 0, 0).d).toBe(0);
    expect(inFogSite(W, f.x + 5, f.z - 5)).toBe(true);
    expect(inFogSite(W, f.x + FOG.site + 30, f.z)).toBe(false);
  });
  it('thin out towards the edge', () => {
    const f = zones[1];
    let last = 2;
    for (let d = 0; d < f.r; d += f.r / 10) { const v = fogDensity(f, f.x, f.z + d); expect(v).toBeLessThanOrEqual(last + 1e-9); last = v; }
  });
  it('fill the lockers the same way every time, with rare things', () => {
    const f = zones[2];
    const a = lockerLoot(W, f, 0), b = lockerLoot(W, f, 0);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(1);
    for (const [k, n] of a) { expect(ITEMS[k]).toBeTruthy(); expect(n).toBeGreaterThan(0); }
    const all = zones.slice(0, 20).flatMap((z) => [0, 1, 2].flatMap((i) => lockerLoot(W, z, i)));
    expect(all.some(([k]) => k === 'pcore')).toBe(true);
  });
  it('keep the trees and rocks off the site', () => {
    const t = new Terrain(W);
    for (const f of zones.filter((z) => z.kind === 'land').slice(0, 3)) {
      expect(t.water(f.x, f.z)).toBeNull();
      const cx = Math.floor(f.x / CHUNK), cz = Math.floor(f.z / CHUNK);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        for (const tr of chunkTrees(t, cx + i, cz + j)) expect(Math.hypot(tr.x - f.x, tr.z - f.z)).toBeGreaterThan(FOG.site);
        for (const r of chunkRocks(t, cx + i, cz + j)) expect(Math.hypot(r.x - f.x, r.z - f.z)).toBeGreaterThan(FOG.site);
      }
    }
  });
});

describe('the gas mask', () => {
  it('filters wear out by the fog, and the fog hurts without one', () => {
    expect(filterWear(0)).toBe(0);
    expect(filterWear(1)).toBeCloseTo(1);
    expect(filterWear(0.3)).toBeLessThan(filterWear(0.9));
    expect(fogHarm(1)).toBeCloseTo(MASK.dmg);
    expect(fogHarm(MASK.faint / 2)).toBe(0);
  });
  it('is made by the blacksmith from the Filter Masks plans', () => {
    expect(TECH_BY_ID.filters).toBeTruthy();
    expect(ORDERS.find((o) => o.out === 'gasmask')?.tech).toBe('filters');
    expect(ORDERS.find((o) => o.out === 'filter')?.tech).toBe('filters');
    expect(WEAR.gasmask?.slot).toBe('face');
  });
});
