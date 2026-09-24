import { describe, it, expect } from 'vitest';
import { Terrain } from '../src/gen/terrain';
import { chunkPlants, PLANT_SPAN } from '../src/gen/flora';
import { chunkTrees } from '../src/gen/trees';
import { generateDungeon } from '../src/gen/dungeon';
import { CHUNK, NR, REGION } from '../src/gen/regions';
import { hash } from '../src/core/rng';

describe('edible plants', () => {
  const t = new Terrain(hash(9, 1)), fresh = new Terrain(hash(9, 1));
  const all = [] as ReturnType<typeof chunkPlants>;
  for (let cx = -40; cx < 40; cx++) for (let cz = -40; cz < 40; cz++) all.push(...chunkPlants(t, cx, cz));

  it('grow both kinds, deterministically', () => {
    const n = { shroom: 0, pod: 0 };
    for (const p of all) n[p.kind]++;
    expect(n.shroom).toBeGreaterThan(20);
    expect(n.pod).toBeGreaterThan(5);
    const again = [] as typeof all;
    for (let cx = -40; cx < 40; cx++) for (let cz = -40; cz < 40; cz++) again.push(...chunkPlants(fresh, cx, cz));
    expect(again).toEqual(all);
  });
  it('stand on dry land with no tree inside their clearing', () => {
    for (const p of all) {
      expect(t.water(p.x, p.z)).toBeNull();
      const cx = Math.floor(p.x / CHUNK), cz = Math.floor(p.z / CHUNK);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const tr of chunkTrees(t, cx + i, cz + j)) {
        expect(Math.hypot(tr.x - p.x, tr.z - p.z), p.key).toBeGreaterThan(PLANT_SPAN[p.kind]);
      }
    }
  });
  it('keep the same save key on both sides of the seam', () => {
    const p = all[0], cx = Math.floor(p.x / CHUNK), cz = Math.floor(p.z / CHUNK), W = NR * REGION / CHUNK;
    const copy = chunkPlants(t, cx + W, cz)[0];
    expect(copy.key).toBe(p.key);
    expect(copy.x).toBeCloseTo(p.x + NR * REGION);
  });
});

describe('nutrient crystals', () => {
  it('grow in some dungeon rooms, the same every time, without changing the layout', () => {
    let n = 0;
    for (let s = 1; s <= 20; s++) {
      const a = generateDungeon(hash(3, s)), b = generateDungeon(hash(3, s));
      expect(a.crystals).toEqual(b.crystals);
      n += a.crystals.length;
    }
    expect(n).toBeGreaterThan(10);
  });
});
