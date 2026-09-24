// Cave mouths on the mountain flanks (gen/mountains.ts): where the ground you walk up to is gentle and the rock
// behind rises steeply, an opening leads into the mountain. Two mouths close together (each the other's nearest)
// often belong to one cave system that runs through the mountain: both carry its name, and going in at one you can
// come out at the other. The inside is gen/cavegen.ts. Pure and deterministic, per region; drawn by world/caves.ts.
import { rng, hash } from '../core/rng';
import { REGION, CHUNK, wrapR, ruinName } from './regions';
import { mountainMask } from './mountains';
import type { Terrain } from './terrain';

export interface Cave {
  id: number; name: string;
  /** The cave system this mouth opens into (its id and name are the system's), and the other mouth, if linked. */
  sys: number; other: { x: number; z: number; face: number } | null; mouth: 0 | 1;
  /** The foot of the mouth, and the way it faces (out of the mountain, radians: 0 = +x, like atan2(z, x)). */
  x: number; z: number; y: number; face: number;
  /** Mouth width and height (m). */
  w: number; h: number;
}
const cache = new Map<string, Cave[]>(), linked = new Map<string, Cave[]>();
/** Linked mouths are at most this far apart (m), and link with this chance. */
const LINK_DIST = 650, LINK_CHANCE = 0.75;
/** The raw mouths of a region (at most one; about half of the mountain regions have one), not yet linked. */
function rawCaves(t: Terrain, rx: number, rz: number): Cave[] {
  const c = wrapR(rx);
  if (c !== rx) return rawCaves(t, c, rz).map((v) => ({ ...v, x: v.x + (rx - c) * REGION }));
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
      const id = hash(t.world, rx, rz, 0xca7e);
      out.push({ id, name: ruinName(R) + ' Cave', sys: id, other: null, mouth: 0, x, z, y, face: Math.atan2(-uz, -ux), w: 3.6 + R() * 1.4, h: 3 + R() });
      break;
    }
  }
  cache.set(key, out);
  return out;
}
/** Raw mouths within `r` metres of (x, z). */
function rawNear(t: Terrain, x: number, z: number, r: number): Cave[] {
  const out: Cave[] = [], n = Math.ceil(r / REGION) + 1, rx = Math.round(x / REGION), rz = Math.round(z / REGION);
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) for (const c of rawCaves(t, rx + i, rz + j)) if (Math.hypot(c.x - x, c.z - z) <= r) out.push(c);
  return out;
}
const nearestOf = (t: Terrain, c: Cave) => rawNear(t, c.x, c.z, LINK_DIST).filter((o) => o.id !== c.id).sort((a, b) => Math.hypot(a.x - c.x, a.z - c.z) - Math.hypot(b.x - c.x, b.z - c.z))[0];
/** The cave mouths of a region, linked into systems: two mouths that are each other's nearest (within LINK_DIST) share one. */
export function regionCaves(t: Terrain, rx: number, rz: number): Cave[] {
  const c = wrapR(rx);
  if (c !== rx) return regionCaves(t, c, rz).map((v) => ({ ...v, x: v.x + (rx - c) * REGION, other: v.other && { ...v.other, x: v.other.x + (rx - c) * REGION } }));
  const key = t.world + ':' + rx + ':' + rz;
  let out = linked.get(key);
  if (out) return out;
  if (linked.size > 4096) linked.clear();
  out = rawCaves(t, rx, rz).map((cv) => {
    const o = nearestOf(t, cv);
    if (!o || nearestOf(t, o)?.id !== cv.id) return cv;
    const lo = cv.id < o.id ? cv : o, hi = lo === cv ? o : cv;
    if (hash(t.world, lo.id, hi.id, 0x11c) % 1000 >= LINK_CHANCE * 1000) return cv;
    return { ...cv, sys: lo.id, name: lo.name, mouth: cv === lo ? 0 : 1, other: { x: o.x, z: o.z, face: o.face } } as Cave;
  });
  linked.set(key, out);
  return out;
}
/** The caves whose mouth lies in chunk (cx, cz). */
export function chunkCaves(t: Terrain, cx: number, cz: number): Cave[] {
  const rx = Math.floor((cx * CHUNK + CHUNK / 2 + REGION / 2) / REGION), rz = Math.floor((cz * CHUNK + CHUNK / 2 + REGION / 2) / REGION);
  return regionCaves(t, rx, rz).filter((v) => Math.floor(v.x / CHUNK) === cx && Math.floor(v.z / CHUNK) === cz);
}
