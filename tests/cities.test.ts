import { describe, it, expect } from 'vitest';
import { citySites, cityLayout, inCity, cityDanger, corners, inBld, segDist, CITY, PATTERNS } from '../src/gen/cities';
import { allVillages, regionInfo, regionOf, worldDist } from '../src/gen/regions';
import { seaMask } from '../src/gen/seas';
import { mountainMask } from '../src/gen/mountains';
import { dangerAt } from '../src/gen/danger';

describe('dead cities', () => {
  const W = 12345;
  it('a world has its cities, far apart, on dry level land away from home', () => {
    for (const w of [W, 4242, 777]) {
      const cs = citySites(w);
      expect(cs.length).toBeGreaterThanOrEqual(8);
      expect(new Set(cs.map((c) => c.pattern)).size).toBeGreaterThanOrEqual(3); // they do not all look alike
      for (const c of cs) {
        expect(Math.hypot(c.x, c.z)).toBeGreaterThan(CITY.near[0] - 1);
        expect(c.r).toBeGreaterThanOrEqual(CITY.r[0]);
        expect(seaMask(w, c.x, c.z)).toBe(0);
        expect(mountainMask(w, c.x, c.z)).toBeLessThan(0.05);
        for (const o of cs) if (o !== c) expect(worldDist(c.x, c.z, o.x, o.z)).toBeGreaterThan(c.r + o.r + CITY.apart - 1);
      }
      expect(citySites(w)).toBe(cs); // cached, the same every time
    }
  });
  it('nothing else is placed in a city: villages, temples, camps, crash sites', () => {
    const cs = citySites(W);
    for (const v of allVillages(W)) expect(inCity(W, v.x, v.z, CITY.village - 100)).toBe(false);
    for (const c of cs.slice(0, 4)) {
      const [ax, az] = regionOf(c.x - c.r, c.z - c.r), [bx, bz] = regionOf(c.x + c.r, c.z + c.r);
      for (let rx = ax; rx <= bx; rx++) for (let rz = az; rz <= bz; rz++) for (const p of regionInfo(W, rx, rz).pois) expect(worldDist(p.x, p.z, c.x, c.z)).toBeGreaterThan(c.r);
    }
  });
  it('a city is dangerous', () => {
    const c = citySites(W)[0];
    expect(cityDanger(W, c.x, c.z)).toBe(CITY.danger);
    expect(cityDanger(W, c.x + c.r + CITY.fade + 10, c.z)).toBe(0);
    expect(dangerAt(W, c.x, c.z)).toBeGreaterThan(dangerAt(W, c.x + c.r + 900, c.z) - 0.5 + 1);
  });
  it('lays out streets and buildings that do not stand on the streets or on each other', () => {
    for (const c of citySites(W)) {
      const L = cityLayout(W, c);
      expect(L.blds.length).toBeGreaterThan(300);
      expect(L.streets.length).toBeGreaterThan(200);
      expect(cityLayout(W, c)).toBe(L);
      expect(Math.max(...L.blds.map((b) => b.f))).toBeGreaterThan(15); // a core of towers
      expect(L.blds.some((b) => b.st === 2) && L.blds.some((b) => b.st === 1)).toBe(true); // fallen and gutted ones
      for (const b of L.blds.slice(0, 200)) {
        for (const [x, z] of corners(b)) expect(Math.hypot(x, z)).toBeLessThan(c.r);
        // the middle of no street runs through a building
        for (const s of L.streets) expect(inBld(b, (s.ax + s.bx) / 2, (s.az + s.bz) / 2, 0)).toBe(false);
        expect(L.streets.every((s) => segDist(b.x, b.z, s.ax, s.az, s.bx, s.bz) > s.w / 2)).toBe(true);
        for (const o of L.blds.slice(0, 200)) if (o !== b) expect(inBld(o, b.x, b.z, 0)).toBe(false);
      }
    }
  });
  it('every pattern is used across a few worlds', () => {
    const seen = new Set<string>();
    for (const w of [1, 2, 3, 4, 5]) for (const c of citySites(w)) seen.add(c.pattern);
    expect([...seen].sort()).toEqual([...PATTERNS].sort());
  });
});
