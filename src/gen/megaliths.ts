// Reserved ancient landmarks: twelve stone sanctuaries, then ten valleys of colossal stone heads, then (0.275) five
// stepped pyramids (gen/pyramids.ts), each appended so the earlier sites keep their places. Stable ids are future
// quest anchors; no activation state is generated or saved (a pyramid's inside is a dungeon: `pyramidId`).
import { hash, rng } from '../core/rng';
import { customWorld, placesOf } from './customworld';
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
import { tl, TL } from '../i18n';
import { pyramidPlan, faceAxes, tierTop, PYR, type PyramidLayout, type PyramidPlan } from './pyramids';
import { tiltFrame } from './tilt';

// Scale geometry and cleared grounds together; survey with the original footprint to preserve reserved sites.
export const MEGALITH_XZ_SCALE = .75, MEGALITH_Y_SCALE = .7;
export const MEGALITH_COUNT = 27, MEGALITH_BLEND = 35, MEGALITH_HOME_GAP = 3500;
export const MEGALITH_DESIGNS = [
  { name: tl('Crown of the First Dawn'), radius: 100, height: 42, count: 16, rings: 1, form: 'crown' },
  { name: tl('The Twin Horizons'), radius: 120, height: 46, count: 18, rings: 2, form: 'circles' },
  { name: tl('Court of the Sky Bearers'), radius: 130, height: 64, count: 12, rings: 1, form: 'horseshoe' },
  { name: tl('The Silent Procession'), radius: 140, height: 40, count: 12, rings: 1, form: 'avenue' },
  { name: tl('The Spiral of Ages'), radius: 130, height: 48, count: 24, rings: 1, form: 'spiral' },
  { name: tl('Throne of the Four Winds'), radius: 110, height: 58, count: 12, rings: 1, form: 'cardinal' },
  { name: tl('Sanctuary of the Three Suns'), radius: 145, height: 50, count: 18, rings: 3, form: 'circles' },
  { name: tl('The Broken Halo'), radius: 115, height: 52, count: 18, rings: 1, form: 'broken' },
  { name: tl('The Starward Assembly'), radius: 135, height: 60, count: 10, rings: 2, form: 'star' },
  { name: tl('The Longest Shadow'), radius: 125, height: 68, count: 14, rings: 1, form: 'obelisk' },
  { name: tl('The Gate of Giants'), radius: 105, height: 62, count: 12, rings: 1, form: 'gate' },
  { name: tl('The Last Constellation'), radius: 150, height: 56, count: 24, rings: 2, form: 'constellation' },
  // the colossal heads: faceted stone faces with glowing eyes, a few to a site, sunk and leaning (0.275)
  { name: tl('Vale of the Watchers'), radius: 120, height: 58, count: 3, rings: 1, form: 'heads', layout: 'valley' },
  { name: tl('Council of Stone Faces'), radius: 125, height: 56, count: 4, rings: 1, form: 'heads', layout: 'council' },
  { name: tl('The Seaward Gaze'), radius: 115, height: 54, count: 3, rings: 1, form: 'heads', layout: 'row' },
  { name: tl('The Sunken Choir'), radius: 120, height: 62, count: 4, rings: 1, form: 'heads', layout: 'sunken' },
  { name: tl('The Twin Guardians'), radius: 110, height: 66, count: 2, rings: 1, form: 'heads', layout: 'twin' },
  { name: tl('The Leaning Elders'), radius: 115, height: 56, count: 3, rings: 1, form: 'heads', layout: 'leaning' },
  { name: tl('The Grand Assembly'), radius: 140, height: 58, count: 4, rings: 1, form: 'heads', layout: 'assembly' },
  { name: tl('Eyes of the Old Sky'), radius: 110, height: 60, count: 3, rings: 1, form: 'heads', layout: 'outward' },
  { name: tl('The Patriarch'), radius: 120, height: 76, count: 3, rings: 1, form: 'heads', layout: 'patriarch' },
  { name: tl('The Long Vigil'), radius: 135, height: 60, count: 3, rings: 1, form: 'heads', layout: 'vigil' },
  // (0.275) the stepped pyramids (gen/pyramids.ts): `count` terraces; a stair up to the shrine, its door the way in
  { name: tl('Pyramid of the Feathered Serpent'), radius: 120, height: 98, count: 9, rings: 1, form: 'pyramid', layout: 'serpent' },
  { name: tl('Pyramid of the Devoured Sun'), radius: 125, height: 92, count: 5, rings: 1, form: 'pyramid', layout: 'sun' },
  { name: tl('The Twin Shrines'), radius: 120, height: 88, count: 6, rings: 1, form: 'pyramid', layout: 'twin' },
  { name: tl('The Jaguar Spire'), radius: 100, height: 110, count: 8, rings: 1, form: 'pyramid', layout: 'spire' },
  { name: tl('Pyramid of the Pale Moon'), radius: 115, height: 84, count: 6, rings: 1, form: 'pyramid', layout: 'moon' },
] as const;
type HeadLayout = 'valley' | 'council' | 'row' | 'sunken' | 'twin' | 'leaning' | 'assembly' | 'outward' | 'patriarch' | 'vigil';
/**
 * One colossal head in its site's frame: base (`y`, below 0 when sunk deep), height `h`, facing (`yaw`: its face looks
 * along (sin yaw, cos yaw)), a forward `lean`. Its shape is fixed by `h` (world/megaliths.ts `HEAD_RINGS`).
 */
export interface MegalithHead { x: number; z: number; y: number; h: number; yaw: number; lean: number; /** (0.275) rolled to a side */ roll: number }
/** A boulder round a head's feet (drawn by `PropBatch.rock`). */
export interface MegalithRock { x: number; z: number; r: number; h: number; sides: number; rot: number }
/** A head's footprint for collision, in its own frame: half-widths across and along (its shoulders), as a share of h. */
export const HEAD_FOOT = { w: .5, d: .4 };
export interface Megalith { id: string; index: number; name: string; x: number; y: number; z: number; yaw: number; radius: number; height: number; seed: number }
/** Local oriented stone volume. Uprights and overhead lintels share this model and collision data. */
/** `kind`: an invisible volume for a head or a boulder (drawn by their own models, collides like a stone); (0.275) a
 *  pyramid's terraces, stair ramps (`ramp`: the top rises along the stone's local +d from `y` to `y + h`; solid from
 *  the ground), shrine walls and carvings; a head is a capsule up `axis` from its base, `w` across. */
export interface MegalithStone { x: number; z: number; y: number; w: number; d: number; h: number; yaw: number; cap: boolean; kind?: 'head' | 'rock' | 'tier' | 'ramp' | 'shrine' | 'decor'; axis?: [number, number, number] }
const cache = new Map<number, Megalith[]>();
export function worldMegaliths(world: number): Megalith[] {
  const found = cache.get(world); if (found) return found;
  const cw = customWorld(world);
  if (cw) { // (0.208) a drawn world: its megaliths where they were drawn, the designs in turn
    const out = placesOf(cw, 'megalith').slice(0, MEGALITH_COUNT).map((p, index): Megalith => {
      const design = MEGALITH_DESIGNS[index], R = rng(hash(world, index, 0x6e6a));
      return { id: `megalith:${index}`, index, name: p.name ?? design.name, x: p.x, z: p.z, y: Math.round(naturalHeight(world, p.x, p.z)), yaw: R() * Math.PI * 2, radius: (design.radius + 15) * MEGALITH_XZ_SCALE, height: design.height + (design.form === 'obelisk' ? 10 : 0), seed: hash(world, index, 0x6e6b) };
    });
    out.forEach(m => m.height = Math.max(...megalithStones(m).map(b => b.y + b.h)));
    cache.set(world, out); return out;
  }
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
      // (0.275) never two pyramids in sight of each other: a few to a continent, far apart
      if (design.form === 'pyramid' && out.some(m => MEGALITH_DESIGNS[m.index].form === 'pyramid' && worldDist(m.x, m.z, x, z) < PYRAMID_APART)) continue;
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
    if (!site) throw new Error(TL`No dry site for megalith ${index} in world ${world}`);
    out.push({ id: `megalith:${index}`, index, name: design.name, x: site[0], z: site[1], y: site[2], yaw: R() * Math.PI * 2, radius: radius * MEGALITH_XZ_SCALE, height: design.height + (design.form === 'obelisk' ? 10 : 0), seed: hash(world, index, 0x6e6b) });
  }
  out.forEach(m => m.height = Math.max(...megalithStones(m).map(b => b.y + b.h)));
  if (cache.size > 64) cache.clear(); cache.set(world, out); return out;
}
/** Early distance rejection keeps normal starting-world streaming independent of the remote landmark survey. */
export function megalithsNear(world: number, x: number, z: number, radius: number): Megalith[] {
  if (Math.hypot(wrapDx(x), z) + radius < MEGALITH_HOME_GAP && !customWorld(world)) return [];
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
const facing = (x: number, z: number, tx: number, tz: number) => Math.atan2(tx - x, tz - z);
/** (0.275) How a head stands: most lean a little, many clearly, a few badly (radians, signed). */
function headTilt(R: () => number): number {
  const q = R(), side = R() < 0.5 ? -1 : 1;
  return q < 0.3 ? (R() - 0.5) * 0.08 : q < 0.82 ? side * (0.08 + R() * 0.17) : side * (0.27 + R() * 0.23);
}
/**
 * The heads and boulders of a head site, in plan units (the site's frame before the scales). (0.275, the owner's
 * request) No crowds: two to four heads spread wide over the ground, each sunk and leaning its own way, as if
 * dropped there long ago; the layout only sets which way they look.
 */
function headPlan(m: Megalith): { heads: MegalithHead[]; rocks: MegalithRock[] } {
  const d = MEGALITH_DESIGNS[m.index];
  if (d.form !== 'heads') return { heads: [], rocks: [] };
  const R = rng(hash(m.seed, 0x4eae)), heads: MegalithHead[] = [], R0 = d.radius, top = d.height, layout = d.layout as HeadLayout;
  const jit = (a: number) => (R() - .5) * 2 * a, gaze = R() * Math.PI * 2;
  for (let tries = 0; heads.length < d.count && tries < 600; tries++) {
    const big = layout === 'patriarch' && heads.length === 0, a = R() * Math.PI * 2, r = big ? 0 : R0 * (.2 + R() * .62);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (heads.some(o => Math.hypot(o.x - x, o.z - z) < 48)) continue;
    const h = big ? top : top * (.62 + R() * .38);
    const yaw = layout === 'council' || layout === 'twin' || layout === 'patriarch' ? facing(x, z, 0, 0) + jit(.6)
      : layout === 'outward' ? Math.atan2(x, z) + jit(.5) : layout === 'row' || layout === 'vigil' ? gaze + jit(.4) : R() * Math.PI * 2;
    const sink = layout === 'sunken' ? .3 + R() * .2 : .1 + R() * .3;
    heads.push({ x, z, y: -h * sink, h, yaw, lean: headTilt(R), roll: headTilt(R) * .8 });
  }
  // boulders round every head's shoulders, as if the ground had heaved round them
  const rocks: MegalithRock[] = [];
  for (const o of heads) {
    const n = 5 + Math.floor(R() * 4);
    for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 2, reach = o.h * (.3 + R() * .2), r = 3 + R() * 5.5;
      rocks.push({ x: o.x + Math.cos(a) * reach, z: o.z + Math.sin(a) * reach, r, h: r * (.7 + R() * .8), sides: 6 + Math.floor(R() * 3), rot: R() * Math.PI });
    }
  }
  for (let n = 0, tries = 0; n < 6 && tries < 200; tries++) { // great boulders strewn over the site, clear of the heads
    const a = R() * Math.PI * 2, d0 = R0 * (.15 + R() * .6), x = Math.cos(a) * d0, z = Math.sin(a) * d0, r = 5 + R() * 7;
    if (heads.some(o => Math.hypot(o.x - x, o.z - z) < o.h * .45 + r)) continue;
    rocks.push({ x, z, r, h: r * (.8 + R() * .9), sides: 7 + Math.floor(R() * 3), rot: R() * Math.PI }); n++;
  }
  return { heads, rocks };
}
/** A head site's heads and boulders in the site's frame (scaled like its stones). */
export function megalithHeads(m: Megalith): { heads: MegalithHead[]; rocks: MegalithRock[] } {
  const p = headPlan(m), XS = MEGALITH_XZ_SCALE, YS = MEGALITH_Y_SCALE;
  return {
    heads: p.heads.map(o => ({ ...o, x: o.x * XS, z: o.z * XS, y: o.y * YS, h: o.h * YS })),
    rocks: p.rocks.map(o => ({ ...o, x: o.x * XS, z: o.z * XS, r: o.r * XS, h: o.h * YS })),
  };
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
  if (d.form === 'heads') { // (0.275) a head is a capsule up its tilted axis, a boulder a plain volume (drawn apart); already scaled
    const p = megalithHeads(m);
    for (const o of p.heads) stones.push({ x: o.x, z: o.z, y: o.y, w: o.h * HEAD_FOOT.w * .8, d: o.h * HEAD_FOOT.w * .8, h: o.h, yaw: o.yaw, cap: false, kind: 'head', axis: tiltFrame(o.lean, o.roll, o.yaw)(0, 1, 0) });
    for (const o of p.rocks) stones.push({ x: o.x, z: o.z, y: 0, w: o.r * 1.5, d: o.r * 1.5, h: o.h, yaw: o.rot, cap: false, kind: 'rock' });
    return stones;
  } else if (d.form === 'pyramid') pyramidStones(pyramidOfDesign(m), R, stone, stones);
  else if (d.form === 'avenue') {
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
    if (b.axis) { // (0.275) a tilted head: a capsule up its axis
      const [ax, ay, az] = b.axis, r = b.w / 2 + radius;
      for (const yy of [y + .35, y + height * .55, y + height - .2]) {
        const t = Math.max(0, Math.min(b.h * .9, (x - b.x) * ax + (yy - b.y) * ay + (z - b.z) * az));
        if (Math.hypot(b.x + ax * t - x, b.y + ay * t - yy, b.z + az * t - z) < r) return true;
      }
      return false;
    }
    if (b.kind !== 'ramp' && (y >= b.y + b.h - (b.kind === 'tier' ? .7 : .01) || y + height <= b.y + .01)) return false; // a terrace's edge steps up off the stair
    const dx = x - b.x, dz = z - b.z, c = Math.cos(b.yaw), s = Math.sin(b.yaw), u = dx * c - dz * s, v = dx * s + dz * c;
    const ox = Math.max(0, Math.abs(u) - b.w / 2), oz = Math.max(0, Math.abs(v) - b.d / 2);
    if (!(radius === 0 ? ox === 0 && oz === 0 : ox * ox + oz * oz < radius * radius)) return false;
    return b.kind !== 'ramp' || y < rampTop(b, v) - .45; // (0.275) a stair: you walk up it, its sides stop you
  });
}
/** (0.275) A ramp stone's top over local v (along its d): rising from `y` at −d/2 to `y + h` at +d/2. */
export const rampTop = (b: MegalithStone, v: number) => b.y + b.h * Math.max(0, Math.min(1, (v + b.d / 2) / b.d));

// ---------- (0.275) the pyramids ----------
/** Pyramids keep this far apart (m), so a continent holds only a few. */
export const PYRAMID_APART = 9000;
/** A pyramid's inside is a dungeon saved under this id (outside the region and city vault namespaces). */
export const PYRAMID_BASE = 2 ** 33;
export const pyramidId = (m: Megalith) => PYRAMID_BASE + m.index;
export const isPyramidId = (id: number) => id >= PYRAMID_BASE && id < PYRAMID_BASE + MEGALITH_COUNT;
/** The pyramid saved under a dungeon id, or null. */
export function pyramidOf(world: number, id: number): Megalith | null {
  if (!isPyramidId(id)) return null;
  const m = worldMegaliths(world).find(o => o.index === id - PYRAMID_BASE);
  return m && MEGALITH_DESIGNS[m.index].form === 'pyramid' ? m : null;
}
export const isPyramid = (m: Megalith) => MEGALITH_DESIGNS[m.index].form === 'pyramid';
/** A pyramid's plan (plan units), or null for any other megalith. */
export function pyramidOfDesign(m: Megalith): PyramidPlan {
  const d = MEGALITH_DESIGNS[m.index];
  if (d.form !== 'pyramid') throw new Error('not a pyramid');
  return pyramidPlan(d.layout as PyramidLayout, d.height, d.count);
}
type StoneFn = (x: number, z: number, y: number, w: number, depth: number, h: number, yaw: number, cap?: boolean) => void;
/** The terraces, stairs, balustrades, shrines and serpent heads as stones (plan units). */
function pyramidStones(p: PyramidPlan, R: () => number, stone: StoneFn, stones: MegalithStone[]) {
  const kind = (k: MegalithStone['kind']) => { stones[stones.length - 1].kind = k; };
  for (const t of p.tiers) { const [hx, hz] = tierTop(p, t); stone(0, 0, t.y, 2 * hx, 2 * hz, t.h, 0); kind('tier'); }
  for (const s of p.stairs) {
    const [n, a] = faceAxes(s.face), um = (s.u0 + s.u1) / 2, L = s.u0 - s.u1, yaw = Math.atan2(n[0], n[1]) + Math.PI;
    const at = (off: number) => [n[0] * um + a[0] * (s.off + off), n[1] * um + a[1] * (s.off + off)];
    const [cx, cz] = at(0); stone(cx, cz, 0, s.w - 2 * PYR.rail, L, s.top, yaw); kind('ramp');
    for (const side of [-1, 1]) { const [rx, rz] = at(side * (s.w / 2 - PYR.rail / 2)); stone(rx, rz, PYR.railH, PYR.rail, L, s.top, yaw); kind('ramp'); }
    if (p.serpents) for (const side of [-1, 1]) { // the serpent's head at the foot of each balustrade
      const ox = side * (s.w / 2 - PYR.rail / 2), hx = n[0] * (s.u0 + 2.5) + a[0] * (s.off + ox), hz = n[1] * (s.u0 + 2.5) + a[1] * (s.off + ox);
      stone(hx, hz, 0, PYR.rail * 2.2, 6, PYR.railH * 2.6, yaw); kind('decor');
    }
  }
  const t = PYR.wall;
  for (const q of p.shrines) {
    const w = (x: number, z: number, y: number, ww: number, dd: number, hh: number, cap = false) => { stone(q.x + x, q.z + z, y, ww, dd, hh, 0, cap); kind('shrine'); };
    w(0, -q.hz + t / 2, q.y, 2 * q.hx, t, q.h); // the back wall
    for (const side of [-1, 1]) w(side * (q.hx - t / 2), 0, q.y, t, 2 * q.hz - 2 * t, q.h);
    const fw = q.hx - q.door / 2; // the front wall either side of the door, and the lintel over it
    for (const side of [-1, 1]) w(side * (q.door / 2 + fw / 2), q.hz - t / 2, q.y, fw, t, q.h);
    w(0, q.hz - t / 2, q.y + q.doorH, q.door, t, q.h - q.doorH);
    w(0, 0, q.y + q.h, 2 * q.hx + 2, 2 * q.hz + 2, PYR.roof, true);
    if (q.roof === 'stepped') w(0, 0, q.y + q.h + PYR.roof, 2 * q.hx - 4, 2 * q.hz - 4, 6, true);
    if (q.comb) w(0, -q.hz * .35, q.y + q.h + PYR.roof, 2 * q.hx * .72, 4, q.comb, true);
  }
  // blocks fallen from the terraces, lying round the foot
  const B = p.tiers[0];
  for (let i = 0; i < 7; i++) {
    const face = Math.floor(R() * 4), [n, a] = faceAxes(face), half = face % 2 ? B.hz : B.hx, u = (face % 2 ? B.hx : B.hz) + 4 + R() * 8, along = (R() - .5) * 1.6 * half;
    if (p.stairs.some(s => s.face === face && Math.abs(along - s.off) < s.w / 2 + 8)) continue;
    const r = 2.5 + R() * 3; stone(n[0] * u + a[0] * along, n[1] * u + a[1] * along, 0, r * 1.5, r * 1.5, r * (.8 + R() * .5), R() * Math.PI); kind('rock');
  }
}
/** A pyramid's shrines in the site's frame, scaled: the room inside (x0..x1, z0..z1), its floor, the door's middle and the way out. */
export interface PyramidDoor { i: number; x0: number; z0: number; x1: number; z1: number; y: number; door: [number, number]; out: [number, number] }
export function pyramidDoors(m: Megalith): PyramidDoor[] {
  if (!isPyramid(m)) return [];
  const XS = MEGALITH_XZ_SCALE, YS = MEGALITH_Y_SCALE, t = PYR.wall;
  return pyramidOfDesign(m).shrines.map((q, i) => ({
    i, x0: (q.x - q.hx + t) * XS, x1: (q.x + q.hx - t) * XS, z0: (q.z - q.hz + t) * XS, z1: (q.z + q.hz - t) * XS, y: q.y * YS,
    door: [q.x * XS, (q.z + q.hz) * XS], out: [q.x * XS, (q.z + q.hz + 4) * XS],
  }));
}

/** Worker results are generated only from the seed, never from a character's saved changes. */
export const megalithSitesReady = (world: number) => cache.get(world) ?? null;
export function seedMegalithSites(world: number, sites: Megalith[]) {
  if (!cache.has(world) && sites.length === MEGALITH_COUNT && sites.every((m, i) => m.id === `megalith:${i}`)) cache.set(world, sites);
}
