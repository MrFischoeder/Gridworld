// Cave mouths on the mountain flanks (gen/mountains.ts): where the ground you walk up to is gentle and the rock
// behind rises steeply, an opening leads into the mountain. For now every cave has fallen in (the cave systems come
// later), so the mouths are sealed with rubble. Pure and deterministic, per region; drawn by world/caves.ts.
import { rng, hash } from '../core/rng';
import { REGION, CHUNK, wrapR, ruinName } from './regions';
import { mountainMask } from './mountains';
import type { Terrain } from './terrain';

export interface Cave {
  id: number; name: string;
  /** The foot of the mouth, and the way it faces (out of the mountain, radians: 0 = +x, like atan2(z, x)). */
  x: number; z: number; y: number; face: number;
  /** Mouth width and height (m). */
  w: number; h: number;
}
const cache = new Map<string, Cave[]>();
/** The caves of a region (at most one; about a third of the mountain regions have one). */
export function regionCaves(t: Terrain, rx: number, rz: number): Cave[] {
  const c = wrapR(rx);
  if (c !== rx) return regionCaves(t, c, rz).map((v) => ({ ...v, x: v.x + (rx - c) * REGION }));
  const key = t.world + ':' + rx + ':' + rz;
  let out = cache.get(key);
  if (out) return out;
  if (cache.size > 4096) cache.clear();
  out = [];
  const R = rng(hash(t.world, rx, rz, 0xcae5)), cx = rx * REGION, cz = rz * REGION;
  if (mountainMask(t.world, cx, cz) + mountainMask(t.world, cx + 90, cz) + mountainMask(t.world, cx, cz + 90) > 0.2 && R() < 0.45) {
    for (let tries = 0; tries < 30; tries++) {
      const x = cx + (R() - 0.5) * 220, z = cz + (R() - 0.5) * 220, m = mountainMask(t.world, x, z);
      if (m < 0.25 || m > 0.9) continue;
      const h = (px: number, pz: number) => t.base(px, pz);
      // uphill: the gradient; the mouth faces the other way
      const gx = h(x + 2, z) - h(x - 2, z), gz = h(x, z + 2) - h(x, z - 2), g = Math.hypot(gx, gz);
      if (g < 0.4) continue;
      const ux = gx / g, uz = gz / g, y = h(x, z);
      // a gentle approach in front, a steep face behind
      const front = (y - h(x - ux * 8, z - uz * 8)) / 8, behind = h(x + ux * 9, z + uz * 9) - y;
      if (front > 0.55 || front < -0.2 || behind < 6) continue;
      out.push({ id: hash(t.world, rx, rz, 0xca7e), name: ruinName(R) + ' Cave', x, z, y, face: Math.atan2(-uz, -ux), w: 3.6 + R() * 1.4, h: 3 + R() });
      break;
    }
  }
  cache.set(key, out);
  return out;
}
/** The caves whose mouth lies in chunk (cx, cz). */
export function chunkCaves(t: Terrain, cx: number, cz: number): Cave[] {
  const rx = Math.floor((cx * CHUNK + CHUNK / 2 + REGION / 2) / REGION), rz = Math.floor((cz * CHUNK + CHUNK / 2 + REGION / 2) / REGION);
  return regionCaves(t, rx, rz).filter((v) => Math.floor(v.x / CHUNK) === cx && Math.floor(v.z / CHUNK) === cz);
}
