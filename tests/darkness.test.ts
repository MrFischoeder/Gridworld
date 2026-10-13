import { describe, it, expect } from 'vitest';
import { surfaceDark, underAmb, dungeonLamps, caveLamps, nearestLamps, NIGHT, UNDER, LIGHT } from '../src/gen/darkness';
import { generateDungeon } from '../src/gen/dungeon';
import { generateMetro } from '../src/gen/metro';
import { citySites } from '../src/gen/cities';
import { generateCave, floorAtCave } from '../src/gen/cavegen';
import { generateShip } from '../src/gen/ship';
import { hash } from '../src/core/rng';

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
    expect(dungeonLamps(generateShip(hash(9, 1))).length).toBeGreaterThan(0);
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
