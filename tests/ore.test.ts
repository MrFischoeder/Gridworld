import { describe, it, expect } from 'vitest';
import { hash } from '../src/core/rng';
import { Terrain } from '../src/gen/terrain';
import { chunkRocks, ORE } from '../src/gen/trees';
import { mountainMask } from '../src/gen/mountains';
import { CHUNK } from '../src/gen/regions';

describe('ore veins', () => {
  const t = new Terrain(hash(21, 3));
  const tally = (pick: (x: number, z: number) => boolean, span: number) => {
    let rocks = 0, ore = 0;
    const kinds = new Set<string>();
    for (let cx = -span; cx < span; cx += 3) for (let cz = -span; cz < span; cz += 3) {
      if (!pick(cx * CHUNK, cz * CHUNK)) continue;
      for (const k of chunkRocks(t, cx, cz)) if (k.r >= ORE.minR) { rocks++; if (k.ore) { ore++; kinds.add(k.ore); } }
    }
    return { rocks, ore, kinds };
  };
  it('are rare near Gridholm, and only in rocks big enough to work', () => {
    const home = tally((x, z) => Math.hypot(x, z) < 1200, 40);
    expect(home.rocks).toBeGreaterThan(100);
    expect(home.ore / home.rocks).toBeLessThan(0.15);
    for (let cx = 0; cx < 20; cx++) for (const k of chunkRocks(t, cx, 3)) if (k.ore) expect(k.r).toBeGreaterThanOrEqual(ORE.minR);
  });
  it('are common in the mountains, iron and copper both', () => {
    const hills = tally((x, z) => mountainMask(t.world, x, z) > 0.5, 160);
    expect(hills.rocks).toBeGreaterThan(50);
    expect(hills.ore / hills.rocks).toBeGreaterThan(0.25);
    expect([...hills.kinds].sort()).toEqual(['copper', 'iron']);
  });
  it('never change the rocks themselves, and are the same every time', () => {
    const a = chunkRocks(t, 7, -4), b = chunkRocks(new Terrain(hash(21, 3)), 7, -4);
    expect(a).toEqual(b);
  });
});
