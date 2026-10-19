import { describe, it, expect } from 'vitest';
import { surfaceDark, underAmb, dungeonLamps, caveLamps, nearestLamps, villageLanterns, NIGHT, UNDER, LIGHT } from '../src/gen/darkness';
import { generateVillage } from '../src/gen/village';
import { generateDungeon } from '../src/gen/dungeon';
import { generateMetro } from '../src/gen/metro';
import { citySites } from '../src/gen/cities';
import { generateCave, floorAtCave } from '../src/gen/cavegen';
import { generateShip } from '../src/gen/ship';
import { hash } from '../src/core/rng';
import { VoxelGrid } from '../src/core/voxel';

describe('darkness and lamps (0.199)', () => {
  it('the surface is dark only once the day fades, clouds take the moon', () => {
    expect(surfaceDark(1).dark).toBe(0);
    expect(surfaceDark(0.6).dark).toBe(0);
    expect(surfaceDark(0).dark).toBe(1);
    expect(surfaceDark(0, 0).amb).toBeCloseTo(NIGHT.amb);
    expect(surfaceDark(0, 1).amb).toBeLessThan(NIGHT.amb);
  });
  it('below ground it gets darker the deeper you go; caves and the metro are pitch dark', () => {
    expect(underAmb('labyrinth', 1)).toBeGreaterThan(underAmb('labyrinth', 2));
    expect(underAmb('labyrinth', 2)).toBeGreaterThan(underAmb('labyrinth', 3));
    expect(underAmb('cave')).toBeLessThan(0.05); expect(underAmb('metro')).toBeLessThan(0.05);
    expect(UNDER.wreck).toBeLessThan(underAmb('labyrinth', 1));
  });
  it('lamps hang in some rooms, fewer deeper down, the same every time', () => {
    let a = 0, c = 0;
    for (let i = 0; i < 20; i++) {
      const m1 = generateDungeon(hash(7, i), { depth: 1 }), m3 = generateDungeon(hash(7, i, 3), { depth: 3 });
      const l1 = dungeonLamps(m1, 1), l3 = dungeonLamps(m3, 3);
      expect(dungeonLamps(m1, 1)).toEqual(l1);
      a += l1.length / Math.max(1, m1.boxes.length); c += l3.length / Math.max(1, m3.boxes.length);
      for (const l of l1) { expect(l.r).toBeGreaterThan(5); expect(l.y).toBeGreaterThan(1); }
    }
    expect(a).toBeGreaterThan(c);
    let ship = 0; for (let i = 1; i < 6; i++) ship += dungeonLamps(generateShip(hash(9, i))).length;
    expect(ship).toBeGreaterThan(0);
  });
  it('adds plentiful wall torches and electric fixtures while retaining dark rooms and passages', () => {
    let torch = 0, elec = 0, boxes = 0;
    for (let i = 0; i < 30; i++) {
      const m = generateDungeon(hash(8, i), { depth: 1 }); boxes += m.boxes.length;
      for (const l of dungeonLamps(m, 1)) {
        expect(l.n).toBeDefined();
        if (l.k === 'torch') torch++; else { expect(l.k).toBe('electric'); elec++; }
      }
    }
    expect(torch).toBeGreaterThan(elec); expect(elec).toBeGreaterThan(0);
    expect((torch + elec) / boxes).toBeGreaterThan(0.3);
    expect((torch + elec) / boxes).toBeLessThan(1.2);
    for (const l of dungeonLamps(generateShip(hash(9, 2)))) expect(l.k).toBe('electric');
  });
  it('mounts lights against real walls with air round the flame or bulb and keeps doorways clear', () => {
    const maps = [generateDungeon(1234, { depth: 1 }), generateDungeon(777, { depth: 3 }), generateShip(1234), generateMetro(11, citySites(11)[0])];
    for (const map of maps) {
      const grid = VoxelGrid.fromOps(map.ops), lamps = dungeonLamps(map);
      expect(lamps.length).toBeGreaterThan(5);
      expect(dungeonLamps(map)).toEqual(lamps);
      for (const l of lamps) {
        const [nx, nz] = l.n!;
        const deck = map.metro?.decks.find(d => l.x >= d.x && l.x < d.x + d.w && l.z >= d.z && l.z < d.z + d.d);
        expect(l.y - (deck ? deck.y + deck.h : 0)).toBeGreaterThanOrEqual(2.1);
        expect(grid.empty(Math.floor(l.x), Math.floor(l.y), Math.floor(l.z))).toBe(true);
        expect(grid.empty(Math.floor(l.x - nx * .5), Math.floor(l.y), Math.floor(l.z - nz * .5))).toBe(false);
        expect(grid.empty(Math.floor(l.x + nx * .2), Math.floor(l.y + .35), Math.floor(l.z + nz * .2))).toBe(true);
        for (const d of [...map.doorCands, ...map.portals]) expect(Math.abs(l.x - (d.axis === 'x' ? d.m : d.c)) >= 2 || Math.abs(l.z - (d.axis === 'x' ? d.c : d.m)) >= 2).toBe(true);
      }
      for (let i = 0; i < lamps.length; i++) for (let j = i + 1; j < lamps.length; j++) expect(Math.hypot(lamps[i].x - lamps[j].x, lamps[i].z - lamps[j].z)).toBeGreaterThanOrEqual(6);
    }
  });
  it('(0.200) a town has oil lanterns by its gates and its shops', () => {
    const v = generateVillage(1234, 0, 0, 0, 'Testholm', false), ls = villageLanterns(v);
    expect(ls.length).toBe(v.gates.length * 2 + v.buildings.filter((b) => b.role !== 'house').length);
    for (const l of ls) expect(Number.isFinite(l.x) && Number.isFinite(l.z)).toBe(true);
  });
  it('some metro stations still have power, some are dark', () => {
    let lit = 0, dark = 0;
    for (const w of [11, 12, 13]) for (const city of citySites(w).slice(0, 3)) {
      const m = generateMetro(w, city), lamps = dungeonLamps(m);
      for (const s of m.metro!.stations) (lamps.some((l) => Math.hypot(l.x - s.x, l.z - s.z) < 12) ? lit++ : dark++);
    }
    expect(lit).toBeGreaterThan(0); expect(dark).toBeGreaterThan(0);
  });
  it('a cave is lit only at its mouths and by its crystals', () => {
    const m = generateCave(hash(3, 4), 2), lamps = caveLamps(m, (x, z) => floorAtCave(m, x, z));
    expect(lamps.length).toBe(m.exits.length + m.crystals.length);
  });
  it('the shader takes the nearest lamps in reach', () => {
    const lamps = Array.from({ length: 30 }, (_, i) => ({ x: i * 5, y: 2, z: 0, r: 8 }));
    const n = nearestLamps(lamps, 0, 2, 0);
    expect(n.length).toBe(LIGHT.slots); expect(n[0].x).toBe(0);
    expect(nearestLamps(lamps, 1000, 2, 0).length).toBe(0);
  });
});
