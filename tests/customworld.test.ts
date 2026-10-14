import { describe, it, expect } from 'vitest';
import { newWorld, type WorldFile } from '../src/gen/mapfile';
import { customSeed, isCustomSeed, setCustomWorld, customWorld, fileHeight } from '../src/gen/customworld';
import { townsWorld } from '../src/gen/worldrules';
import { naturalHeight } from '../src/gen/heights';
import { seaMask, isleOf, SEA } from '../src/gen/seas';
import { mountainMask } from '../src/gen/mountains';
import { allVillages, regionInfo, regionOf, GRIDHOLM_ID } from '../src/gen/regions';
import { riversOf, nearRiver } from '../src/gen/rivers';
import { citySites } from '../src/gen/cities';
import { installSites } from '../src/gen/installs';
import { worldMegaliths } from '../src/gen/megaliths';
import { regionCaves } from '../src/gen/caves';
import { regionLode, startLodes } from '../src/gen/lodes';
import { Terrain } from '../src/gen/terrain';

/** A drawn continent 30 × 20 km round the start, a mountain east, sea all round. */
function drawn(): WorldFile {
  const f = newWorld('Test land', 120, 60), c = f.cell;
  for (let j = 0; j < f.h; j++) for (let i = 0; i < f.w; i++) {
    const x = (i + 0.5) * c - 30000, z = (j + 0.5) * c - 15000, d = Math.hypot(x / 15000, z / 10000);
    let y = d < 1 ? 6 + 20 * (1 - d) : -20;
    const m = Math.hypot(x - 9000, z) / 3000;
    if (m < 1) y += 140 * (1 - m);
    f.land[j * f.w + i] = Math.round(y);
  }
  const at = (x: number, z: number): [number, number] => [x + 30000, z + 15000];
  f.places.push({ k: 'start', x: 30000, z: 15000 });
  for (const [k, x, z, extra] of [
    ['village', 5000, 2000, { name: 'Testholm' }], ['village', -6000, -3000, {}], ['ruin', 2000, -1500, {}], ['camp', -3000, 2500, {}],
    ['wreck', 3500, 4000, {}], ['city', -9000, 3000, { r: 700 }], ['install', 4000, -6000, { install: 'uranium' }],
    ['megalith', -2000, -6000, {}], ['cave', 7600, 900, {}],
  ] as const) { const [px, pz] = at(x, z); f.places.push({ k, x: px, z: pz, ...extra }); }
  f.rivers.push({ pts: [at(8000, -2500), at(10000, -6000), at(12000, -9500), at(13000, -12000)], w: 14, name: 'Drawn River' });
  f.lodes.push({ k: 'iron', x: 30000 + 1500, z: 15000 + 3000, rich: 1.4 });
  return f;
}
const name = 'Test land', W = customSeed(name);
setCustomWorld(W, drawn());

describe('stage E2: a world drawn in the editor', () => {
  it('has a seed of its own that follows the towns rules', () => {
    expect(customSeed(name)).toBe(W);
    expect(isCustomSeed(W)).toBe(true);
    expect(isCustomSeed(-12345)).toBe(false);
    expect(townsWorld(W)).toBe(true);
    expect(customWorld(W)).not.toBeNull();
    expect(customWorld(-12345)).toBeNull();
  });
  it('takes its land, sea and mountains from the file', () => {
    expect(fileHeight(customWorld(W)!, 0, 0)).toBeGreaterThan(24);
    expect(naturalHeight(W, 0, 0)).toBeGreaterThan(SEA.level + 5);
    expect(seaMask(W, 0, 0)).toBe(0);
    expect(seaMask(W, 0, 14000)).toBeGreaterThan(0.9); // south of the coast
    expect(naturalHeight(W, 0, 14000)).toBeLessThan(SEA.level - 10);
    expect(naturalHeight(W, 40000, 0)).toBeLessThan(SEA.level - 30); // beyond the file: deep sea
    expect(mountainMask(W, 9000, 0)).toBeGreaterThan(0.9);
    expect(naturalHeight(W, 9000, 0)).toBeGreaterThan(120);
    for (let i = 0; i < 40; i++) expect(isleOf(W, i, 0)).toBeNull(); // no islands of the seed's
  });
  it('puts the villages and places where they were drawn', () => {
    const v = allVillages(W);
    expect(v[0].id).toBe(GRIDHOLM_ID);
    expect(v.length).toBe(3);
    const t = v.find((p) => p.name === 'Testholm')!;
    expect(Math.abs(t.x - 5000)).toBeLessThan(200);
    const kind = (k: string, x: number, z: number) => { const [rx, rz] = regionOf(x, z); return regionInfo(W, rx, rz).pois.find((p) => p.type === k); };
    expect(kind('ruin', 2000, -1500)).toBeTruthy();
    expect(kind('camp', -3000, 2500)).toBeTruthy();
    expect(kind('wreck', 3500, 4000)).toBeTruthy();
    // nothing rolled by the seed in an empty region
    expect(regionInfo(W, 20, 20).pois).toEqual([]);
  });
  it('lays its rivers, cities, plants, megaliths, caves and deposits from the file', () => {
    const r = riversOf(W).list;
    expect(r.length).toBe(1);
    expect(r[0].name).toBe('Drawn River');
    expect(r[0].lv[0]).toBeGreaterThanOrEqual(r[0].lv[r[0].lv.length - 1]);
    expect(nearRiver(W, 9000, -4250, 120)).toBe(true); // (the middle of the first drawn stretch; it meanders)
    const c = citySites(W);
    expect(c.length).toBe(1);
    expect(c[0].r).toBe(700);
    const s = installSites(new Terrain(W));
    expect(s.map((o) => o.k)).toEqual(['uranium']);
    expect(worldMegaliths(W).length).toBe(1);
    const [cx, cz] = regionOf(7600, 900);
    expect(regionCaves(new Terrain(W), cx, cz).length).toBe(1);
    expect(startLodes(W)).toEqual([]);
    const [lx, lz] = regionOf(1500, 3000), l = regionLode(W, lx, lz);
    expect(l?.k).toBe('iron');
    expect(l?.rich).toBe(1.4);
  });
});
