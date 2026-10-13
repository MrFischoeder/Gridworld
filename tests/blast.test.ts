import { describe, it, expect } from 'vitest';
import { BLAST, blastShare, blastPulse, ROBOTS } from '../src/data/robots';
import { labyrinthGuards, DEPTH_GUARDS } from '../src/gen/dungeonguards';
import { generateDungeon } from '../src/gen/dungeon';

describe('machine blasts', () => {
  it('hurt most at the middle, a little at the edge, nothing beyond', () => {
    expect(blastShare(0, 4)).toBe(1);
    expect(blastShare(3.99, 4)).toBeGreaterThan(BLAST.edge - 0.01);
    expect(blastShare(4, 4)).toBe(0);
    expect(blastShare(9, 4)).toBe(0);
  });
  it('are small next to the machines\' own blows', () => {
    for (const k of Object.keys(BLAST.kinds) as (keyof typeof BLAST.kinds)[]) {
      expect(BLAST.kinds[k].hurt).toBeLessThanOrEqual(15);
      expect(BLAST.kinds[k].r).toBeGreaterThan(ROBOTS[k].r);
    }
  });
  it('pulse within 0..1', () => {
    for (let t = 0; t < BLAST.pulse; t += 0.05) { const p = blastPulse(t); expect(p).toBeGreaterThanOrEqual(0); expect(p).toBeLessThanOrEqual(1); }
  });
});

describe('labyrinth guards', () => {
  const weight = (k: string) => ({ scout: 1, guardian: 1.5, repair: 1.5, sentinel: 4, assault: 4.5, artillery: 4 } as Record<string, number>)[k];
  it('are deterministic, inside rooms, heavier the deeper', () => {
    const avg = [0, 0, 0];
    for (let s = 1; s <= 30; s++) for (let depth = 1; depth <= 3; depth++) {
      const map = generateDungeon(s * 7919 + depth, { depth });
      const g = labyrinthGuards(map, depth);
      expect(labyrinthGuards(map, depth)).toEqual(g);
      for (const r of g) expect(map.boxes.some((b) => r.x >= b.x && r.x < b.x + b.w && r.z >= b.z && r.z < b.z + b.d)).toBe(true);
      if (depth === 1) for (const r of g) expect(['scout', 'guardian']).toContain(r.kind);
      avg[depth - 1] += g.reduce((t, r) => t + weight(r.kind), 0);
    }
    expect(avg[1]).toBeGreaterThan(avg[0]);
    expect(avg[2]).toBeGreaterThan(avg[1]);
    expect(DEPTH_GUARDS.length).toBe(3);
  });
});
