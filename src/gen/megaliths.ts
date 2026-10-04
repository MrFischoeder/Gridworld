// Twelve reserved ancient landmarks. Stable ids are future quest anchors; no activation state is generated or saved.
import { hash, rng } from '../core/rng';
import { continents } from './continents';
import { wrapX, wrapDx, nearX, worldDist, poisNear, regionOf, type Rect } from './regions';
import { seaMask } from './seas';
import { mountainMask } from './mountains';
import { naturalHeight } from './heights';
import { nearRiver } from './rivers';
import { lakesIn, LAKE_REACH } from './water';
import { inCity } from './cities';
import { gatesNear } from './worldgates';
import { Terrain } from './terrain';
import { installSites } from './installs';
import { regionRoads, nearestOnRoad } from './roads';

// Scale geometry and cleared grounds together; survey with the original footprint to preserve reserved sites.
export const MEGALITH_XZ_SCALE = .75, MEGALITH_Y_SCALE = .7;
export const MEGALITH_COUNT = 12, MEGALITH_BLEND = 35, MEGALITH_HOME_GAP = 3500;
export const MEGALITH_DESIGNS = [
  { name: 'Crown of the First Dawn', radius: 100, height: 42, count: 16, rings: 1, form: 'crown' },
  { name: 'The Twin Horizons', radius: 120, height: 46, count: 18, rings: 2, form: 'circles' },
  { name: 'Court of the Sky Bearers', radius: 130, height: 64, count: 12, rings: 1, form: 'horseshoe' },
  { name: 'The Silent Procession', radius: 140, height: 40, count: 12, rings: 1, form: 'avenue' },
  { name: 'The Spiral of Ages', radius: 130, height: 48, count: 24, rings: 1, form: 'spiral' },
  { name: 'Throne of the Four Winds', radius: 110, height: 58, count: 12, rings: 1, form: 'cardinal' },
  { name: 'Sanctuary of the Three Suns', radius: 145, height: 50, count: 18, rings: 3, form: 'circles' },
  { name: 'The Broken Halo', radius: 115, height: 52, count: 18, rings: 1, form: 'broken' },
  { name: 'The Starward Assembly', radius: 135, height: 60, count: 10, rings: 2, form: 'star' },
  { name: 'The Longest Shadow', radius: 125, height: 68, count: 14, rings: 1, form: 'obelisk' },
  { name: 'The Gate of Giants', radius: 105, height: 62, count: 12, rings: 1, form: 'gate' },
  { name: 'The Last Constellation', radius: 150, height: 56, count: 24, rings: 2, form: 'constellation' },
] as const;
export interface Megalith { id: string; index: number; name: string; x: number; y: number; z: number; yaw: number; radius: number; height: number; seed: number }
/** Local oriented stone volume. Uprights and overhead lintels share this model and collision data. */
export interface MegalithStone { x: number; z: number; y: number; w: number; d: number; h: number; yaw: number; cap: boolean }
const cache = new Map<number, Megalith[]>();
export function worldMegaliths(world: number): Megalith[] {
  const found = cache.get(world); if (found) return found;
  const factories = installSites(new Terrain(world, false));
  const out: Megalith[] = [], cs = continents(world), base = { world, base: (x: number, z: number) => naturalHeight(world, x, z) };
  for (let index = 0; index < MEGALITH_COUNT; index++) {
    const design = MEGALITH_DESIGNS[index], R = rng(hash(world, index, 0x6e6a)), c = cs[index % cs.length];
    const radius = design.radius + 15, reach = radius + MEGALITH_BLEND;
    let site: [number, number, number] | null = null;
    for (let attempt = 0; attempt < 24000; attempt++) {
      const angle = R() * Math.PI * 2, fraction = Math.sqrt(.08 + R() * .56);
      const x = wrapX(Math.round(c.x + Math.cos(angle) * c.rx * fraction)), z = Math.round(c.z + Math.sin(angle) * c.rz * fraction);
      if (Math.hypot(wrapDx(x), z) < MEGALITH_HOME_GAP + reach || inCity(world, x, z, reach + 60)) continue;
      if (factories.some(f => worldDist(f.x, f.z, x, z) < reach + f.r + 40)) continue;
      if (out.some(m => worldDist(m.x, m.z, x, z) < reach + MEGALITH_DESIGNS[m.index].radius + 15 + MEGALITH_BLEND + 900)) continue;
      if (poisNear(world, x, z, reach + 220).some(p => Math.hypot(Math.max(p.rect.x0 - x, 0, x - p.rect.x1), Math.max(p.rect.z0 - z, 0, z - p.rect.z1)) < reach + p.flat + 5)) continue;
      let lo = Infinity, hi = -Infinity, dry = true;
      for (const dx of [-reach, 0, reach]) for (const dz of [-reach, 0, reach]) {
        const px = x + dx, pz = z + dz, h = base.base(px, pz); lo = Math.min(lo, h); hi = Math.max(hi, h);
        if (seaMask(world, px, pz) > 0 || mountainMask(world, px, pz) > .01 || h < 3) dry = false;
      }
      if (!dry || hi - lo > 24 || nearRiver(world, x, z, reach + 80)) continue;
      const rect = { x0: x - reach, z0: z - reach, x1: x + reach, z1: z + reach };
      if (lakesIn(base, rect).some(l => Math.hypot(l.x - x, l.z - z) < reach + l.r * LAKE_REACH + 20)) continue;
      if (gatesNear(world, x, z, reach + 100).length) continue;
      const [rx, rz] = regionOf(x, z); let road = false;
      for (let i = -2; i <= 2 && !road; i++) for (let j = -2; j <= 2 && !road; j++) if (regionRoads(world, rx + i, rz + j).some(r => nearestOnRoad(r, x, z)[0] < reach + r.half + 20)) road = true;
      if (road) continue;
      site = [x, z, Math.round((lo + hi) / 2)]; break;
    }
    if (!site) throw new Error(`No dry site for megalith ${index} in world ${world}`);
    out.push({ id: `megalith:${index}`, index, name: design.name, x: site[0], z: site[1], y: site[2], yaw: R() * Math.PI * 2, radius: radius * MEGALITH_XZ_SCALE, height: design.height + (design.form === 'obelisk' ? 10 : 0), seed: hash(world, index, 0x6e6b) });
  }
  out.forEach(m => m.height = Math.max(...megalithStones(m).map(b => b.y + b.h)));
  if (cache.size > 64) cache.clear(); cache.set(world, out); return out;
}
/** Early distance rejection keeps normal starting-world streaming independent of the remote landmark survey. */
export function megalithsNear(world: number, x: number, z: number, radius: number): Megalith[] {
  if (Math.hypot(wrapDx(x), z) + radius < MEGALITH_HOME_GAP) return [];
  return worldMegaliths(world).filter(m => worldDist(m.x, m.z, x, z) <= radius + m.radius).map(m => ({ ...m, x: nearX(m.x, x) }));
}
export function megalithsIn(world: number, rect: Rect): Megalith[] {
  const x = (rect.x0 + rect.x1) / 2, z = (rect.z0 + rect.z1) / 2;
  return megalithsNear(world, x, z, Math.hypot(rect.x1 - rect.x0, rect.z1 - rect.z0) / 2 + MEGALITH_BLEND);
}
export function megalithPoint(m: Megalith, x: number, z: number): [number, number] {
  const c = Math.cos(m.yaw), s = Math.sin(m.yaw); return [wrapX(m.x + c * x + s * z), m.z - s * x + c * z];
}
export function megalithLocal(m: Megalith, x: number, z: number): [number, number] {
  const dx = wrapDx(x - m.x), dz = z - m.z, c = Math.cos(m.yaw), s = Math.sin(m.yaw); return [c * dx - s * dz, s * dx + c * dz];
}
export function megalithStones(m: Megalith): MegalithStone[] {
  const d = MEGALITH_DESIGNS[m.index], R = rng(m.seed), stones: MegalithStone[] = [];
  const stone = (x: number, z: number, y: number, w: number, depth: number, h: number, yaw: number, cap = false) => stones.push({ x, z, y, w, d: depth, h, yaw, cap });
  const arch = (x: number, z: number, yaw: number, height: number, span = 24) => {
    const w = 7 + R() * 2, depth = 8 + R() * 2, offset = (span - w) / 2;
    for (const side of [-1, 1]) stone(x + Math.cos(yaw) * offset * side, z - Math.sin(yaw) * offset * side, 0, w, depth, height - 6, yaw);
    stone(x, z, height - 6, span + 2, depth + 1, 6, yaw, true);
  };
  const circle = (radius: number, count: number, height: number, broken = false, horseshoe = false) => {
    for (let i = 0; i < count; i++) {
      const a = i / count * Math.PI * 2;
      if (horseshoe && Math.cos(a) > .55) continue;
      const x = Math.cos(a) * radius, z = Math.sin(a) * radius, yaw = -a - Math.PI / 2;
      if (broken && i % 5 === 0) stone(x, z, 0, 24, 10, 7, yaw, true);
      else arch(x, z, yaw, height + (i % 3 - 1) * 2, Math.min(26, radius * Math.PI * 2 / count * .8));
    }
  };
  if (d.form === 'avenue') {
    for (let i = 0; i < 7; i++) arch(0, (i - 3) * 34, 0, d.height + (3 - Math.abs(i - 3)) * 5, 50);
  } else if (d.form === 'spiral') {
    for (let i = 0; i < d.count; i++) { const a = i / (d.count - 1) * Math.PI * 3.5, r = 24 + i * 3.8; arch(Math.cos(a) * r, Math.sin(a) * r, -a - Math.PI / 2, 22 + i / d.count * 26, 20); }
  } else if (d.form === 'cardinal') {
    circle(85, 12, 35); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; arch(Math.cos(a) * 45, Math.sin(a) * 45, -a - Math.PI / 2, d.height, 38); }
  } else if (d.form === 'gate') {
    circle(82, 12, 34, false, true); arch(0, 0, 0, d.height, 60); arch(0, -35, 0, d.height - 10, 44);
  } else {
    for (let ring = 0; ring < d.rings; ring++) circle(d.radius - 14 - ring * 31, Math.max(8, d.count - ring * 4), d.height - ring * 10, d.form === 'broken', d.form === 'horseshoe');
    if (d.form === 'crown') for (let i = 0; i < 5; i++) { const a = (i + 1) * Math.PI / 4; arch(Math.cos(a) * 35, Math.sin(a) * 35, -a - Math.PI / 2, d.height + 12); }
    if (d.form === 'obelisk') stone(0, 0, 0, 13, 13, d.height + 10, .2);
    if (d.form === 'star') for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; stone(Math.cos(a) * 30, Math.sin(a) * 30, 0, 9, 9, 35, -a); }
    if (d.form === 'constellation') for (let i = 0; i < 7; i++) stone((R() - .5) * 55, (R() - .5) * 55, 0, 7, 7, 24 + R() * 18, R() * Math.PI);
  }
  return stones.map(b => ({ ...b, x: b.x * MEGALITH_XZ_SCALE, z: b.z * MEGALITH_XZ_SCALE, w: b.w * MEGALITH_XZ_SCALE, d: b.d * MEGALITH_XZ_SCALE, y: b.y * MEGALITH_Y_SCALE, h: b.h * MEGALITH_Y_SCALE }));
}
/** Capsule-height actor collision with individual stones; the courtyard and arch openings remain passable. */
export function megalithStoneHit(stones: readonly MegalithStone[], x: number, y: number, z: number, radius: number, height = 1.7): boolean {
  return stones.some(b => {
    if (y >= b.y + b.h - .01 || y + height <= b.y + .01) return false;
    const dx = x - b.x, dz = z - b.z, c = Math.cos(b.yaw), s = Math.sin(b.yaw), u = dx * c - dz * s, v = dx * s + dz * c;
    const ox = Math.max(0, Math.abs(u) - b.w / 2), oz = Math.max(0, Math.abs(v) - b.d / 2);
    return radius === 0 ? ox === 0 && oz === 0 : ox * ox + oz * oz < radius * radius;
  });
}

/** Worker results are generated only from the seed, never from a character's saved changes. */
export const megalithSitesReady = (world: number) => cache.get(world) ?? null;
export function seedMegalithSites(world: number, sites: Megalith[]) {
  if (!cache.has(world) && sites.length === MEGALITH_COUNT && sites.every((m, i) => m.id === `megalith:${i}`)) cache.set(world, sites);
}
