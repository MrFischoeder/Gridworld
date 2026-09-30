// Toxic fog: a few poisoned places of the old world where a heavy green fog lies on the ground and never lifts.
// Some are small islands out at sea (the whole island shrouded), others patches of land far from Gridholm, where the
// land is dangerous anyway. Without a gas mask with a working filter the fog burns the lungs (world/toxic.ts).
// In the middle of each stands a contaminated site (an old army depot, a research lab or a crashed probe) whose
// sealed lockers still hold rare things: the reward for going in.
//
// Pure and deterministic from the world seed: at most one zone per 256 m region (`regionFog`, cached per canonical
// region and shifted to the copy of the planet asked for). Everything is read from the natural land (gen/heights.ts)
// and the sea mask, so the terrain, trees and plants can ask `inFogSite` without an import loop.
import { hash } from '../core/rng';
import { REGION, POLAR_Z, wrapR, regionOf, worldDist, wrapDx, poisNear, villageDist, type Rect } from './regions';
import { seaMask, islesNear } from './seas';
import { naturalHeight } from './heights';
import { mountainMask } from './mountains';
import { nearRiver } from './rivers';
import { regionRoads, nearestOnRoad } from './roads';
import type { ItemKey } from '../data/items';

export const FOG = {
  /** Islands: no nearer than this to Gridholm (m); the share of the sea's islands (gen/seas.ts) that are poisoned. */
  isleFrom: 6000, isleChance: 0.3,
  /** Land zones: from this far out (m), the chance per region there and further out (to `landFar`). */
  landFrom: 15000, landFar: 30000, landChance: [0.012, 0.025] as [number, number],
  /** Radius of a land zone (m), and the most any zone may have (it must stay within its region's neighbours). */
  landR: [90, 170] as [number, number], maxR: 250,
  /** Share of the radius that is the dense core (density 1). */
  core: 0.45,
  /** The ground cleared round the site in the middle (m). */
  site: 22,
  /** Villages keep this far from the zone's edge; other places this far from the site (camps from the whole zone) (m). */
  village: 700, place: 30,
};

export type FogSiteKind = 'depot' | 'lab' | 'probe';
export const FOG_SITE: Record<FogSiteKind, { name: string; lockers: number; blurb: string }> = {
  depot: { name: 'Old Army Depot', lockers: 4, blurb: 'a walled depot of the old army: a bunker, a row of sheds and rusted drums leaking the fog' },
  lab: { name: 'Old Research Lab', lockers: 3, blurb: 'a sealed research block with its tanks cracked open: whatever they held still seeps out' },
  probe: { name: 'Crashed Probe', lockers: 3, blurb: 'a probe of the old world that came down burning, its tanks split: the ground round it still steams' },
};
export interface FogZone {
  /** 'fog:<rx>:<rz>' (canonical region). */
  id: string;
  kind: 'isle' | 'land';
  /** Middle (where the site stands), radius, ground height at the site, the site's turn. */
  x: number; z: number; r: number; y: number; yaw: number;
  site: FogSiteKind;
  name: string;
}

const rectDist = (r: Rect, x: number, z: number) => Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.z0 - z, 0, z - r.z1));
const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const u01 = (world: number, rx: number, rz: number, k: number) => (hash(world, rx, rz, k) % 10000) / 10000;

const ISLE_NAMES = ['Blight Isle', 'Choke Island', 'the Green Shroud', 'Ashen Isle', 'the Sick Island', 'Fume Island', 'the Drowned Vats', 'Hollow Isle'];
const LAND_NAMES = ['the Green Blight', 'Choke Hollow', 'the Poisoned Fields', 'the Fume Flats', 'the Sick Mile', 'the Dead Pastures', 'the Shroud', 'Gasser\'s Waste'];

/** A poisoned island (gen/seas.ts ISLE) whose middle lies in canonical region (rx, rz), or null. */
function isleIn(world: number, rx: number, rz: number): FogZone | null {
  const cx = rx * REGION, cz = rz * REGION;
  if (Math.hypot(wrapDx(cx), cz) < FOG.isleFrom || seaMask(world, cx, cz) < 0.2) return null;
  for (const s of islesNear(world, cx, cz, REGION)) {
    const [qx, qz] = regionOf(s.x, s.z);
    if (qx !== rx || qz !== rz || (hash(world, s.i, s.j, 0xf061) % 1000) / 1000 > FOG.isleChance) continue;
    return { id: `fog:${rx}:${rz}`, kind: 'isle', x: s.x, z: s.z, r: Math.min(FOG.maxR, s.r * 1.25 + 30), y: naturalHeight(world, s.x, s.z), yaw: s.ph,
      site: (['depot', 'lab', 'probe'] as const)[hash(world, rx, rz, 0xf063) % 3], name: ISLE_NAMES[hash(world, rx, rz, 0xf064) % ISLE_NAMES.length] };
  }
  return null;
}

/** A poisoned patch of land in canonical region (rx, rz), or null. */
function landIn(world: number, rx: number, rz: number): FogZone | null {
  const x = rx * REGION + (u01(world, rx, rz, 0xf071) - 0.5) * REGION * 0.6, z = rz * REGION + (u01(world, rx, rz, 0xf072) - 0.5) * REGION * 0.6;
  const d = Math.hypot(wrapDx(x), z);
  if (d < FOG.landFrom || Math.abs(z) > POLAR_Z - 1500) return null;
  const [c0, c1] = FOG.landChance, chance = c0 + (c1 - c0) * smooth((d - FOG.landFrom) / (FOG.landFar - FOG.landFrom));
  if (u01(world, rx, rz, 0xf073) > chance) return null;
  const [r0, r1] = FOG.landR, r = r0 + u01(world, rx, rz, 0xf074) * (r1 - r0);
  if (seaMask(world, x, z) > 0 || [0, 1.57, 3.14, 4.71].some((a) => seaMask(world, x + Math.cos(a) * r, z + Math.sin(a) * r) > 0)) return null;
  if (mountainMask(world, x, z) > 0.3) return null;
  const y = naturalHeight(world, x, z);
  for (let a = 0; a < 6.28; a += 0.785) if (Math.abs(naturalHeight(world, x + Math.cos(a) * FOG.site, z + Math.sin(a) * FOG.site) - y) > 3) return null; // the site wants level ground
  if (nearRiver(world, x, z, FOG.site + 20)) return null;
  if (villageDist(world, x, z, r + FOG.village) < r + FOG.village) return null;
  if (poisNear(world, x, z, r + FOG.place).some((p) => p.type === 'camp' || rectDist(p.rect, x, z) < FOG.site + FOG.place)) return null; // ruins and wrecks may lie in the fog, not under the site
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const rd of regionRoads(world, rx + i, rz + j)) if (nearestOnRoad(rd, x, z)[0] < r + 20) return null;
  return { id: `fog:${rx}:${rz}`, kind: 'land', x, z, r, y, yaw: u01(world, rx, rz, 0xf075) * Math.PI * 2, site: (['depot', 'lab', 'probe'] as const)[hash(world, rx, rz, 0xf076) % 3], name: LAND_NAMES[hash(world, rx, rz, 0xf077) % LAND_NAMES.length] };
}

const cache = new Map<string, FogZone | null>();
/** The fog zone whose middle lies in region (rx, rz), if any. */
export function regionFog(world: number, rx: number, rz: number): FogZone | null {
  const c = wrapR(rx);
  if (c !== rx) { const z = regionFog(world, c, rz); return z && { ...z, x: z.x + (rx - c) * REGION }; }
  const key = world + ':' + rx + ':' + rz;
  let z = cache.get(key);
  if (z !== undefined) return z;
  if (cache.size > 20000) cache.clear();
  z = isleIn(world, rx, rz) ?? landIn(world, rx, rz);
  cache.set(key, z);
  return z;
}
/** Fog zones that may reach within `m` of (x, z). */
export function fogsNear(world: number, x: number, z: number, m = 0): FogZone[] {
  if (Math.hypot(wrapDx(x), z) + m < FOG.isleFrom - FOG.maxR) return []; // none near home
  const out: FogZone[] = [], n = Math.ceil((FOG.maxR + m) / REGION), [rx, rz] = regionOf(x, z);
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
    const f = regionFog(world, rx + i, rz + j);
    if (f && worldDist(f.x, f.z, x, z) < f.r + m) out.push(f);
  }
  return out;
}
/** The edge's wobble: a zone is a blob, not a circle. */
function edge(f: FogZone, a: number): number {
  const p = f.yaw;
  return f.r * (1 + 0.1 * Math.sin(3 * a + p) + 0.06 * Math.sin(5 * a + 2 * p) - 0.16);
}
/** How thick the fog of one zone is at (x, z): 1 in the core, easing to 0 at its edge. */
export function fogDensity(f: FogZone, x: number, z: number): number {
  const dx = wrapDx(x - f.x), dz = z - f.z, d = Math.hypot(dx, dz), e = edge(f, Math.atan2(dz, dx)), core = f.r * FOG.core;
  return d >= e ? 0 : d <= core ? 1 : smooth((e - d) / (e - core));
}
/** The thickest fog at (x, z) (0 = clean air) and the zone it belongs to. */
export function fogAt(world: number, x: number, z: number): { d: number; zone: FogZone | null } {
  let best = 0, zone: FogZone | null = null;
  for (const f of fogsNear(world, x, z)) { const d = fogDensity(f, x, z); if (d > best) { best = d; zone = f; } }
  return { d: best, zone };
}
/** Is (x, z) on the cleared ground of a contaminated site (within its radius plus m)? */
export function inFogSite(world: number, x: number, z: number, m = 0): boolean {
  if (Math.hypot(wrapDx(x), z) < FOG.isleFrom - FOG.maxR) return false;
  const [rx, rz] = regionOf(x, z);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const f = regionFog(world, rx + i, rz + j);
    if (f && worldDist(f.x, f.z, x, z) < FOG.site + m) return true;
  }
  return false;
}

// ---------- the gas mask and its filters ----------
export const MASK = {
  /** Seconds of breathing the thickest fog one filter lasts (thinner fog wears it slower). */
  filter: 300,
  /** HP a second the thickest fog takes without protection; below `faint` of density it only makes you cough. */
  dmg: 9, faint: 0.08,
};
/** How fast the fog wears a filter at density d (filter lives a second of use per second at d = 1). */
export const filterWear = (d: number) => (d <= MASK.faint ? 0 : 0.35 + 0.65 * d);
/** HP a second the fog takes at density d without a working mask. */
export const fogHarm = (d: number) => (d <= MASK.faint ? 0 : MASK.dmg * (0.2 + 0.8 * d));

// ---------- the lockers of a contaminated site ----------
/** What one locker holds: rolled from the world, the zone and the locker (deterministic). */
export function lockerLoot(world: number, f: FogZone, i: number): [ItemKey, number][] {
  const R = (k: number) => (hash(world, hash(f.id.length, f.x | 0, f.z | 0), i, k) % 1000) / 1000;
  const out: [ItemKey, number][] = [];
  const add = (k: ItemKey, n: number) => { if (n > 0) out.push([k, n]); };
  const far = f.kind === 'land' ? 1 : 0.6; // the land zones lie further out: a little richer
  add('pcore', R(1) < 0.55 * far + 0.2 ? 1 + (R(2) < 0.3 ? 1 : 0) : 0);
  add('circuit', 2 + Math.floor(R(3) * 5));
  add('scrap', 2 + Math.floor(R(4) * 5));
  if (R(5) < 0.35) add((['shield', 'lens', 'edge', 'servo', 'cell'] as ItemKey[])[Math.floor(R(6) * 5)], 1);
  if (R(7) < 0.4) add((['engine', 'plating', 'turbo'] as ItemKey[])[Math.floor(R(8) * 3)], 1);
  if (R(9) < 0.5) add('filter', 1 + Math.floor(R(10) * 2)); // the old crews left spare filters
  if (R(11) < 0.3) add('medkit', 1);
  if (f.site === 'lab' && R(12) < 0.5) add('glass', 1 + Math.floor(R(13) * 2));
  if (f.site === 'depot' && R(12) < 0.5) add('steel', 1);
  if (R(14) < 0.6) add('ammoE', 20 + Math.floor(R(15) * 40)); // (new draws on their own keys: the older contents stay)
  if (R(16) < 0.25) add(R(17) < 0.5 ? 'ammoR' : 'ammoS', 6 + Math.floor(R(18) * 8));
  return out;
}
