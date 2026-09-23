// Forest placement per chunk: jittered candidates kept by forest density; never on roads or places.
import { rng, hash } from '../core/rng';
import { CHUNK } from './regions';
import { rectDist, type Terrain } from './terrain';
import { nearestOnRoad } from './roads';

export interface Tree { x: number; z: number; y: number; h: number; r: number }

export function chunkTrees(t: Terrain, cx: number, cz: number): Tree[] {
  const R = rng(hash(t.world, cx, cz, 0x7733)), out: Tree[] = [], f = t.chunkFeatures(cx, cz);
  const n = 6, G = CHUNK / n;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = cx * CHUNK + (i + 0.2 + R() * 0.6) * G, z = cz * CHUNK + (j + 0.2 + R() * 0.6) * G, roll = R(), h = 4 + R() * 3.5, r = 1.2 + R() * 0.8;
    if (roll > t.forest(x, z) * 0.85) continue;
    if (f.pads.some((p) => rectDist(p.poi.rect, x, z) < p.poi.flat + 6)) continue;
    if (f.roads.some((rd) => nearestOnRoad(rd, x, z)[0] < rd.half + 3.5)) continue;
    // stand the trunk on the lowest ground under it so it never floats
    const y = Math.min(t.heightAt(x - 0.3, z - 0.3), t.heightAt(x + 0.3, z - 0.3), t.heightAt(x - 0.3, z + 0.3), t.heightAt(x + 0.3, z + 0.3));
    out.push({ x, z, y, h, r });
  }
  return out;
}
