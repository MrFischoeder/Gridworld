import { describe, it, expect } from 'vitest';
import { Terrain } from '../src/gen/terrain';
import { biomeAt, biomeOfCell } from '../src/gen/biomes';
import { CHUNK } from '../src/gen/regions';
import { chunkGiants, jungleChunk, thornContact, thornHurt, JUNGLE, THORN, type Giant, type JungleChunk } from '../src/gen/jungle';

const world = 12345, T = new Terrain(world);
/** A jungle spot of the world: the first on a 1 km grid whose 1 km round it is all jungle. */
function jungleSpot(): [number, number] {
  for (let x = -40000; x < 40000; x += 1000) for (let z = -20000; z < 20000; z += 1000) {
    if (biomeAt(world, x, z) !== 'jungle') continue;
    if ([[300, 0], [-300, 0], [0, 300], [0, -300]].every(([a, b]) => biomeOfCell(world, x + a, z + b) === 'jungle')) return [x, z];
  }
  throw new Error('no jungle');
}

describe('the jungle (0.287)', () => {
  const [jx, jz] = jungleSpot(), cx0 = Math.floor(jx / CHUNK), cz0 = Math.floor(jz / CHUNK);
  const giants: Giant[] = [], thorns: JungleChunk['thorns'] = [];
  for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) { giants.push(...chunkGiants(T, cx0 + i, cz0 + j)); thorns.push(...jungleChunk(T, cx0 + i, cz0 + j).thorns); }

  it('grows giants, kept apart, the same every time', () => {
    expect(giants.length).toBeGreaterThan(10);
    for (const a of giants) for (const b of giants) if (a !== b) expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThanOrEqual(JUNGLE.gap);
    for (const g of giants) { expect(g.h).toBeGreaterThanOrEqual(JUNGLE.h[0]); expect(g.r).toBeGreaterThanOrEqual(JUNGLE.r[0]); }
    expect(jungleChunk(T, cx0, cz0)).toEqual(jungleChunk(T, cx0, cz0));
  });
  it('hangs thorny lianas low enough to run into', () => {
    expect(thorns.length).toBeGreaterThan(5);
    let low = 0;
    for (const { p } of thorns) {
      for (const [x, y, z] of p) expect(y).toBeGreaterThanOrEqual(T.heightAt(x, z) + 0.1);
      if (p.some(([x, y, z]) => y - T.heightAt(x, z) < 1.6)) low++;
    }
    expect(low).toBeGreaterThan(thorns.length / 2);
  });
  it('a body at a liana touches it, one far off does not; slow creeping does no harm', () => {
    const { p } = thorns.find(({ p }) => p.some(([x, y, z]) => y - T.heightAt(x, z) < 1.2))!;
    const [x, y, z] = p.reduce((a, b) => (b[1] - T.heightAt(b[0], b[2]) < a[1] - T.heightAt(a[0], a[2]) ? b : a));
    const g = T.heightAt(x, z);
    expect(thornContact([p], x + 0.2, g, z, 0.35)).not.toBeNull();
    expect(thornContact([p], x + 5, g, z + 5, 0.35)).toBeNull();
    expect(y).toBeGreaterThan(g);
    expect(thornHurt(0.3)).toBe(0);
    expect(thornHurt(6)).toBeCloseTo(THORN.hurt + THORN.perMs * 6);
  });
  it('no giants outside the jungle', () => {
    expect(chunkGiants(T, 0, 0)).toEqual([]);
  });
});
