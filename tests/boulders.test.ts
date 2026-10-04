import { it, expect } from 'vitest';
import { boulderDensity } from '../src/gen/boulders';
import { Terrain } from '../src/gen/terrain';
import { chunkRocks } from '../src/gen/trees';
import { WORLD_W, CHUNK } from '../src/gen/regions';
const world = 12345, t = new Terrain(world);
  it('adds dense, large colliding boulders outside the safe starting area and repeats them at the seam', () => {
    expect(boulderDensity(world, 0, 0)).toBe(0);
    let spot: [number, number] | undefined;
    for (let x = -4000; x <= 4000 && !spot; x += 40) for (let z = -4000; z <= 4000; z += 40)
      if (boulderDensity(world, x, z) > 0.9 && !t.water(x, z)) { spot = [x, z]; break; }
    expect(spot).toBeDefined();
    const [x, z] = spot!, cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK), rocks = chunkRocks(t, cx, cz);
    expect(rocks.filter(k => k.r >= 2.5 && k.h >= 3).length).toBeGreaterThan(4);
    expect(chunkRocks(t, cx, cz)).toEqual(rocks);
    const shifted = chunkRocks(t, cx + WORLD_W / CHUNK, cz);
    expect(shifted.map(k => ({ ...k, x: k.x - WORLD_W }))).toEqual(rocks.map(k => ({ ...k, x: expect.closeTo(k.x, 7) })));
  });
