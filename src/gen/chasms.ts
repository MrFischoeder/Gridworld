// Dry, steep-sided ravines with two continuous footpaths along their walls.
import { hash, rng } from '../core/rng';
import { WORLD_W, POLAR_Z, wrapX, wrapDx, poisNear, type Rect } from './regions';
import { seaMask } from './seas';
import { mountainMask } from './mountains';
import { inCity } from './cities';
import { nearRiver } from './rivers';
import { naturalHeight } from './heights';

export const CHASM_CELL = 1280;
export interface Chasm { id: string; x: number; z: number; dx: number; dz: number; width: number; length: number; depth: number; floor: number; entries: number }
const cache = new Map<string, Chasm | null>();
const smooth = (t: number) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
function cell(world: number, ix: number, iz: number): Chasm | null {
  const n = WORLD_W / CHASM_CELL, c = ((ix % n) + n) % n, key = `${world}:${c}:${iz}`;
  if (cache.has(key)) return cache.get(key)!;
  if (cache.size > 8192) cache.clear();
  cache.set(key, null);
  const R = rng(hash(world, c, iz, 0xc4a5));
  if (R() > 0.55) return null;
  const x = wrapX((c + 0.3 + R() * 0.4) * CHASM_CELL), z = (iz + 0.3 + R() * 0.4) * CHASM_CELL;
  const a = R() * Math.PI * 2, width = 50 + R() * 50, length = 320 + R() * 280, depth = 22 + R() * 14;
  const dx = Math.cos(a), dz = Math.sin(a), margin = length / 2 + width / 2 + 60;
  if (Math.hypot(wrapDx(x), z) < 1800 + margin || Math.abs(z) > POLAR_Z - margin - 1500 || inCity(world, x, z, margin)) return null;
  if (poisNear(world, x, z, margin + 200).some(p => {
    const ox = wrapDx(p.x - x), oz = p.z - z;
    const r = Math.hypot(p.rect.x1 - p.rect.x0, p.rect.z1 - p.rect.z0) / 2 + p.flat + p.blend + 30;
    return Math.abs(ox * dx + oz * dz) < length / 2 + r && Math.abs(-ox * dz + oz * dx) < width / 2 + r;
  })) return null;
  let low = Infinity, high = -Infinity;
  for (const u of [-length / 2, 0, length / 2]) for (const v of [-width / 2 - 15, 0, width / 2 + 15]) {
    const px = x + dx * u - dz * v, pz = z + dz * u + dx * v;
    if (seaMask(world, px, pz) > 0 || mountainMask(world, px, pz) > 0.01 || nearRiver(world, px, pz, 70)) return null;
    const h = naturalHeight(world, px, pz); low = Math.min(low, h); high = Math.max(high, h);
  }
  if (high - low > 20) return null;
  const out = { id: `chasm:${c}:${iz}`, x, z, dx, dz, width, length, depth, floor: low - depth, entries: 2 };
  cache.set(key, out); return out;
}
export function chasmsIn(world: number, r: Rect): Chasm[] {
  const out: Chasm[] = [];
  for (let i = Math.floor((r.x0 - 400) / CHASM_CELL); i <= Math.floor((r.x1 + 400) / CHASM_CELL); i++)
    for (let j = Math.floor((r.z0 - 400) / CHASM_CELL); j <= Math.floor((r.z1 + 400) / CHASM_CELL); j++) {
      const c = cell(world, i, j); if (!c) continue;
      const x = (r.x0 + r.x1) / 2 + wrapDx(c.x - (r.x0 + r.x1) / 2), rad = c.length / 2 + c.width / 2 + 20;
      if (x + rad < r.x0 || x - rad > r.x1 || c.z + rad < r.z0 || c.z - rad > r.z1) continue;
      out.push({ ...c, x });
    }
  return out;
}
export const chasmLocal = (c: Chasm, x: number, z: number): [number, number] => [(x - c.x) * c.dx + (z - c.z) * c.dz, -(x - c.x) * c.dz + (z - c.z) * c.dx];
export const chasmPoint = (c: Chasm, u: number, v: number): [number, number] => [c.x + c.dx * u - c.dz * v, c.z + c.dz * u + c.dx * v];
/** Each path goes from an outer lip along a wall to the flat bottom. Its bench is 8 m wide. */
export function chasmPath(c: Chasm, i: number, t: number): [number, number] {
  const side = i === 1 ? -1 : 1, dir = i === 2 ? -1 : 1;
  const u = dir * (-c.length * 0.4 + t * c.length * 0.72);
  const v = side * (c.width / 2 + 12 - 30 * Math.min(1, t * 5));
  return chasmPoint(c, u, v);
}
/** Applied after road flattening so a road cannot fill in a ravine. */
export function chasmHeight(world: number, c: Chasm, x: number, z: number, h: number): number {
  const [u, v] = chasmLocal(c, x, z), half = c.width / 2;
  if (Math.abs(u) > c.length / 2 + 8 || Math.abs(v) > half + 20) return h;
  const mask = smooth((c.length / 2 - Math.abs(u)) / 7) * smooth((half - Math.abs(v)) / 8);
  let out = h + (c.floor - h) * mask;
  for (let i = 0; i < c.entries; i++) {
    const dir = i === 2 ? -1 : 1, t = (u * dir + c.length * 0.4) / (c.length * 0.72);
    if (t < 0 || t > 1) continue;
    const [px, pz] = chasmPath(c, i, t), [, pv] = chasmLocal(c, px, pz), d = Math.abs(v - pv);
    if (d >= 8) continue;
    const [ex, ez] = chasmPath(c, i, 0), start = naturalHeight(world, ex, ez);
    const target = start + (c.floor - start) * smooth(t), w = 1 - smooth((d - 4) / 4);
    out += (target - out) * w;
  }
  return out;
}
