// Cave mouths on the mountain flanks (gen/mountains.ts): where the ground you walk up to is gentle and the rock
// behind rises steeply, an opening leads into the mountain. Two mouths close together (each the other's nearest)
// often belong to one cave system that runs through the mountain: both carry its name, and going in at one you can
// come out at the other. The inside is gen/cavegen.ts. Pure and deterministic, per region; drawn by world/caves.ts.
// (0.244, the owner's request: more caves, also away from the mountains) The mouths rolled before 0.244 (`old`) keep
// their places, so the data carriers hidden in caves (gen/tech.ts) stay where they were; a second stream adds a mouth
// to mountain regions that had none, and lone caves under a heap of great boulders (`outcrop`) on the lowlands.
import { rng, hash } from '../core/rng';
import { customWorld, placesIn } from './customworld';
import { REGION, CHUNK, wrapR, ruinName, NR, POLAR_Z, villageDist, poisNear, worldDist, wrapDx, regionOf, type Rect } from './regions';
import { caveTitle, regionIndex } from './placenames'; // (0.243) the old name's draws stay, so the mouth's size is unchanged
import { mountainMask } from './mountains';
import { naturalHeight } from './heights';
import { inCity } from './cities';
import { regionRoads, nearestOnRoad } from './roads';
import { regionLakes } from './water';
import { inFogSite } from './toxic';
import { inLode } from './lodes';
import { inCrystals } from './crystals';
import { megalithsNear } from './megaliths';
import { gatesNear } from './worldgates';
import { inSea } from './seas';
import { nearRiver } from './rivers';
import type { Terrain } from './terrain';
import { TL } from '../i18n';

const R0C = -(NR >> 1);

export interface Cave {
  id: number; name: string;
  /** The cave system this mouth opens into (its id and name are the system's), and the other mouth, if linked. */
  sys: number; other: { x: number; z: number; face: number } | null; mouth: 0 | 1;
  /** The foot of the mouth, and the way it faces (out of the mountain, radians: 0 = +x, like atan2(z, x)). */
  x: number; z: number; y: number; face: number;
  /** Mouth width and height (m). */
  w: number; h: number;
  /** (0.244) Opening into a mountainside, or into a heap of boulders on open ground; rolled before 0.244. */
  kind: 'mountain' | 'outcrop'; old?: boolean;
}
/** (0.244) How often the new caves come: a mountain region without an old mouth, a lowland region (an outcrop). */
export const CAVES = { mountain: 0.55, wild: 0.07, home: 900, village: 260, place: 30, road: 18, river: 45, outcrop: 11 };
const cache = new Map<string, Cave[]>(), linked = new Map<string, Cave[]>();
/** Linked mouths are at most this far apart (m), and link with this chance. */
const LINK_DIST = 650, LINK_CHANCE = 0.75;
/** The raw mouths of a region (at most one; about half of the mountain regions have one), not yet linked. */
function oldRaw(t: Terrain, rx: number, rz: number): Cave[] {
  const c = wrapR(rx);
  if (c !== rx) return oldRaw(t, c, rz).map((v) => ({ ...v, x: v.x + (rx - c) * REGION }));
  const key = t.world + ':' + rx + ':' + rz;
  let out = cache.get(key);
  if (out) return out;
  if (cache.size > 4096) cache.clear();
  out = [];
  const R = rng(hash(t.world, rx, rz, 0xcae5)), cx = rx * REGION, cz = rz * REGION, cw = customWorld(t.world);
  if (cw) { // (0.208) a drawn world: a cave where one was drawn, opening downhill
    const p = placesIn(cw, rx, rz).find((q) => q.k === 'cave');
    if (p) {
      const h = (px: number, pz: number) => t.base(px, pz), gx = h(p.x + 4, p.z) - h(p.x - 4, p.z), gz = h(p.x, p.z + 4) - h(p.x, p.z - 4);
      const id = hash(t.world, rx, rz, 0xca7e);
      out.push({ id, name: p.name ?? TL`${(ruinName(R), caveTitle(t.world, regionIndex(rx - R0C, rz, NR)))} Cave`, sys: id, other: null, mouth: 0, x: p.x, z: p.z, y: h(p.x, p.z), face: Math.hypot(gx, gz) > 0.01 ? Math.atan2(-gz, -gx) : 0, w: 6 + R() * 2.5, h: 5 + R() * 2, kind: 'mountain', old: true });
    }
  } else if (mountainMask(t.world, cx, cz) + mountainMask(t.world, cx + 90, cz) + mountainMask(t.world, cx, cz + 90) > 0.2 && R() < 0.45) {
    for (let tries = 0; tries < 30; tries++) {
      const x = cx + (R() - 0.5) * 220, z = cz + (R() - 0.5) * 220, m = mountainMask(t.world, x, z);
      if (m < 0.25 || m > 0.9 || inSea(t.world, x, z, 30) || nearRiver(t.world, x, z, 40)) continue;
      const h = (px: number, pz: number) => t.base(px, pz);
      // uphill: the gradient; the mouth faces the other way
      const gx = h(x + 2, z) - h(x - 2, z), gz = h(x, z + 2) - h(x, z - 2), g = Math.hypot(gx, gz);
      if (g < 0.4) continue;
      const ux = gx / g, uz = gz / g, y = h(x, z);
      // a gentle approach in front, a steep face behind
      const front = (y - h(x - ux * 8, z - uz * 8)) / 8, behind = h(x + ux * 9, z + uz * 9) - y;
      if (front > 0.55 || front < -0.2 || behind < 6) continue;
      const id = hash(t.world, rx, rz, 0xca7e);
      out.push({ id, name: TL`${(ruinName(R), caveTitle(t.world, regionIndex(rx - R0C, rz, NR)))} Cave`, sys: id, other: null, mouth: 0, x, z, y, face: Math.atan2(-uz, -ux), w: 6 + R() * 2.5, h: 5 + R() * 2, kind: 'mountain', old: true });
      break;
    }
  }
  cache.set(key, out);
  return out;
}
const rawAll = new Map<string, Cave[]>();
/** (0.244) The old mouths of a region, or (none there) the new stream's. */
function rawCaves(t: Terrain, rx: number, rz: number): Cave[] {
  const c = wrapR(rx);
  if (c !== rx) return rawCaves(t, c, rz).map((v) => ({ ...v, x: v.x + (rx - c) * REGION }));
  const old = oldRaw(t, rx, rz);
  if (old.length || customWorld(t.world)) return old;
  const key = t.world + ':' + rx + ':' + rz;
  let out = rawAll.get(key);
  if (out) return out;
  if (rawAll.size > 4096) rawAll.clear();
  const e = extraCave(t.world, rx, rz); out = e ? [e] : [];
  rawAll.set(key, out);
  return out;
}
const rectDist = (r: Rect, x: number, z: number) => Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.z0 - z, 0, z - r.z1));
/** (0.244) Why a lowland cave cannot open at (x, z) ('' = it can): the heap of boulders keeps off places, roads, water. */
function wildMisfit(world: number, x: number, z: number): string {
  const r = CAVES.outcrop;
  if (inSea(world, x, z, r + 30) || nearRiver(world, x, z, r + CAVES.river)) return 'water';
  if (villageDist(world, x, z, CAVES.village + 60) < CAVES.village) return 'village';
  if (inCity(world, x, z, r + 80)) return 'city';
  if (poisNear(world, x, z, r + CAVES.place + 40).some((p) => rectDist(p.rect, x, z) < r + CAVES.place)) return 'place';
  if (inFogSite(world, x, z, r + 20) || inLode(world, x, z, r + 15) || inCrystals(world, x, z, r + 15)) return 'site';
  if (megalithsNear(world, x, z, r + 40).length || gatesNear(world, x, z, r + 50).length) return 'landmark';
  const [rx, rz] = regionOf(x, z), t = { world, base: (a: number, b: number) => naturalHeight(world, a, b) };
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    for (const l of regionLakes(t, rx + i, rz + j)) if (worldDist(l.x, l.z, x, z) < l.r * 1.6 + r + 12) return 'lake';
    for (const rd of regionRoads(world, rx + i, rz + j)) if (nearestOnRoad(rd, x, z)[0] < r + CAVES.road) return 'road';
  }
  return '';
}
/** (0.244) The second stream: a mouth in a mountain region that had none, or a lone outcrop cave on the lowlands. */
function extraCave(world: number, rx: number, rz: number): Cave | null {
  const cx = rx * REGION, cz = rz * REGION;
  if (Math.abs(cz) > POLAR_Z - 600 || Math.hypot(wrapDx(cx), cz) < CAVES.home) return null;
  const R = rng(hash(world, rx, rz, 0xcae6)), h = (px: number, pz: number) => naturalHeight(world, px, pz);
  const id = hash(world, rx, rz, 0xca7f), name = TL`${caveTitle(world, regionIndex(rx - R0C, rz, NR))} Cave`;
  const hilly = mountainMask(world, cx, cz) + mountainMask(world, cx + 90, cz) + mountainMask(world, cx, cz + 90) > 0.2;
  if (R() >= (hilly ? CAVES.mountain : CAVES.wild)) return null;
  for (let tries = 0; tries < 40; tries++) {
    const x = cx + (R() - 0.5) * 200, z = cz + (R() - 0.5) * 200, m = mountainMask(world, x, z);
    if (hilly) {
      if (m < 0.2 || m > 0.92 || inSea(world, x, z, 30) || nearRiver(world, x, z, 40)) continue;
      const gx = h(x + 2, z) - h(x - 2, z), gz = h(x, z + 2) - h(x, z - 2), g = Math.hypot(gx, gz);
      if (g < 0.3) continue;
      const ux = gx / g, uz = gz / g, y = h(x, z), front = (y - h(x - ux * 8, z - uz * 8)) / 8, behind = h(x + ux * 9, z + uz * 9) - y;
      if (front > 0.6 || front < -0.25 || behind < 4) continue;
      return { id, name, sys: id, other: null, mouth: 0, x, z, y, face: Math.atan2(-uz, -ux), w: 6 + R() * 2.5, h: 5 + R() * 2, kind: 'mountain' };
    }
    if (m > 0.08) continue;
    const y = h(x, z), lo = Math.min(h(x + 10, z), h(x - 10, z), h(x, z + 10), h(x, z - 10)), hi = Math.max(h(x + 10, z), h(x - 10, z), h(x, z + 10), h(x, z - 10));
    if (hi - lo > 4 || y < 1.5 || wildMisfit(world, x, z)) continue;
    // it faces downhill if there is a slope, else any way
    const gx = h(x + 6, z) - h(x - 6, z), gz = h(x, z + 6) - h(x, z - 6), face = Math.hypot(gx, gz) > 0.4 ? Math.atan2(-gz, -gx) : R() * Math.PI * 2;
    return { id, name, sys: id, other: null, mouth: 0, x, z, y, face, w: 6 + R() * 2, h: 5 + R() * 1.5, kind: 'outcrop' };
  }
  return null;
}
/** (0.244) Whether (x, z) lies within `m` of a lowland cave's heap of boulders (trees, rocks and plants keep off). */
export function nearOutcrop(world: number, x: number, z: number, m = 0): boolean {
  const [rx, rz] = regionOf(x, z);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const c = cachedExtra(world, rx + i, rz + j);
    if (c && c.kind === 'outcrop' && worldDist(c.x, c.z, x, z) < CAVES.outcrop + 8 + m) return true;
  }
  return false;
}
const extraCache = new Map<string, Cave | null>();
function cachedExtra(world: number, rx: number, rz: number): Cave | null {
  const c = wrapR(rx);
  if (c !== rx) { const v = cachedExtra(world, c, rz); return v && { ...v, x: v.x + (rx - c) * REGION }; }
  const key = world + ':' + rx + ':' + rz;
  if (extraCache.has(key)) return extraCache.get(key)!;
  if (extraCache.size > 20000) extraCache.clear();
  // only lowland regions can hold an outcrop: a hilly one is a mountain cave or nothing
  const cx = rx * REGION, cz = rz * REGION, hilly = mountainMask(world, cx, cz) + mountainMask(world, cx + 90, cz) + mountainMask(world, cx, cz + 90) > 0.2;
  const v = hilly || customWorld(world) ? null : extraCave(world, rx, rz);
  extraCache.set(key, v);
  return v;
}
/** Raw mouths within `r` metres of (x, z). */
function rawNear(t: Terrain, x: number, z: number, r: number, oldOnly: boolean): Cave[] {
  const out: Cave[] = [], n = Math.ceil(r / REGION) + 1, rx = Math.round(x / REGION), rz = Math.round(z / REGION);
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) for (const c of (oldOnly ? oldRaw : rawCaves)(t, rx + i, rz + j)) if (Math.hypot(c.x - x, c.z - z) <= r) out.push(c);
  return out;
}
const nearestOf = (t: Terrain, c: Cave) => rawNear(t, c.x, c.z, LINK_DIST, !!c.old).filter((o) => o.id !== c.id && !!o.old === !!c.old && o.kind === 'mountain' && c.kind === 'mountain').sort((a, b) => Math.hypot(a.x - c.x, a.z - c.z) - Math.hypot(b.x - c.x, b.z - c.z))[0];
/** The cave mouths of a region, linked into systems: two mouths that are each other's nearest (within LINK_DIST) share one. */
/** `oldOnly`: only the mouths rolled before 0.244 (gen/tech.ts: the data carriers keep their caves; quicker). */
export function regionCaves(t: Terrain, rx: number, rz: number, oldOnly = false): Cave[] {
  const c = wrapR(rx);
  if (c !== rx) return regionCaves(t, c, rz, oldOnly).map((v) => ({ ...v, x: v.x + (rx - c) * REGION, other: v.other && { ...v.other, x: v.other.x + (rx - c) * REGION } }));
  const key = t.world + ':' + rx + ':' + rz + (oldOnly ? ':o' : '');
  let out = linked.get(key);
  if (out) return out;
  if (linked.size > 4096) linked.clear();
  out = (oldOnly ? oldRaw : rawCaves)(t, rx, rz).map((cv) => {
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
