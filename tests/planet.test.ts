import { describe, it, expect } from 'vitest';
import { Terrain } from '../src/gen/terrain';
import { regionInfo, wrapR, wrapC, wrapX, wrapDx, nearX, worldDist, NR, WORLD_W, X_MIN, POLE_Z, POLAR_Z, REGION, CHUNK, latitude } from '../src/gen/regions';
import { chunkTrees, chunkRocks } from '../src/gen/trees';
import { regionVehicle } from '../src/gen/vehicles';
import { isDiscovered, discover } from '../src/save';
import { sunHeight, sunTilt, daylight } from '../src/core/time';
import { hash } from '../src/core/rng';

const WORLDS = [hash(5, 1), hash(5, 2), hash(5, 3)];
const NC = WORLD_W / CHUNK;

describe('the planet wraps east-west', () => {
  it('has helpers that fold coordinates into one strip', () => {
    expect(WORLD_W).toBe(NR * REGION);
    expect(WORLD_W).toBeGreaterThan(119000);
    expect(wrapR(0)).toBe(0); expect(wrapR(NR)).toBe(0); expect(wrapR(-NR - 3)).toBe(-3);
    expect(wrapC(5 + NC)).toBe(5);
    expect(wrapX(X_MIN - 10)).toBeCloseTo(X_MIN + WORLD_W - 10);
    expect(wrapDx(WORLD_W - 30)).toBeCloseTo(-30);
    expect(nearX(X_MIN + 5, X_MIN + WORLD_W - 5)).toBeCloseTo(X_MIN + WORLD_W + 5);
    expect(worldDist(X_MIN + 1, 0, X_MIN + WORLD_W - 1, 0)).toBeCloseTo(2);
  });
  it('repeats the land, places, trees, rocks and abandoned vehicles', () => {
    for (const w of WORLDS) {
      const t = new Terrain(w);
      for (const [x, z] of [[123.4, -56.7], [X_MIN + 3.3, 200.1], [-4000.5, 1234.5], [59990.2, -777.7]])
        expect(t.heightAt(x + WORLD_W, z)).toBeCloseTo(t.heightAt(x, z), 6);
      for (const [rx, rz] of [[3, 2], [-235, 0], [234, -4], [0, 1]]) {
        const a = regionInfo(w, rx, rz), b = regionInfo(w, rx + NR, rz);
        expect(b.pois.map((p) => p.id)).toEqual(a.pois.map((p) => p.id));
        b.pois.forEach((p, i) => { expect(p.x - a.pois[i].x).toBe(WORLD_W); expect(p.rect.x0 - a.pois[i].rect.x0).toBe(WORLD_W); });
        const v = regionVehicle(t, rx, rz), v2 = regionVehicle(t, rx - NR, rz);
        expect(v2?.id).toBe(v?.id);
        if (v && v2) expect(v.x - v2.x).toBeCloseTo(WORLD_W);
      }
      for (const cx of [-1884, -1883, 1875, 7]) {
        const a = chunkTrees(t, cx, 3), b = chunkTrees(t, cx + NC, 3);
        expect(b.map((tr) => tr.kind)).toEqual(a.map((tr) => tr.kind));
        b.forEach((tr, i) => expect(tr.x - a[i].x).toBeCloseTo(WORLD_W));
        expect(chunkRocks(t, cx - NC, 3).length).toBe(chunkRocks(t, cx, 3).length);
      }
    }
  });
  it('treats a chunk across the seam as the same explored chunk', () => {
    const d: Record<string, string> = {};
    discover(d, 1875, 4);
    expect(isDiscovered(d, 1875 - NC, 4)).toBe(true);
  });
});

describe('the poles', () => {
  it('are ice: no places, no forest, and a wall at the end', () => {
    for (const w of WORLDS) {
      const t = new Terrain(w);
      for (let rx = -5; rx <= 5; rx++) for (const rz of [100, 110, 117, -100, -117]) expect(regionInfo(w, rx, rz).pois).toEqual([]);
      for (const x of [0, 777, -3000]) {
        expect(t.forest(x, POLAR_Z + 100)).toBe(0);
        expect(t.forest(x, -POLAR_Z - 100)).toBe(0);
        expect(t.heightAt(x, POLE_Z - 10)).toBeGreaterThan(t.heightAt(x, POLE_Z - 300) + 40);
        expect(t.heightAt(x, -POLE_Z + 10)).toBeGreaterThan(t.heightAt(x, -POLE_Z + 300) + 40);
      }
    }
  });
  it('keep the sun low', () => {
    expect(latitude(0)).toBeCloseTo(0);
    expect(latitude(-POLE_Z)).toBeCloseTo(Math.PI / 2);
    const noonEq = sunHeight(720, sunTilt(latitude(0))), noonPolar = sunHeight(720, sunTilt(latitude(-POLAR_Z)));
    expect(noonEq).toBeGreaterThan(0.85);
    expect(noonPolar).toBeLessThan(0.35);
    for (const t of [0, 360, 720, 1080]) expect(Math.abs(sunHeight(t, sunTilt(latitude(POLE_Z))))).toBeLessThan(0.05); // endless dusk at the pole
    expect(daylight(0, sunTilt(latitude(0)))).toBe(0);
  });
});
