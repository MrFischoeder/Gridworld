// (0.182, PLAN_PLACOWEK.md stage O1) Deposits in the wilds: in a towns world (gen/worldrules.ts) what the land gives
// lies out in the open as places of its own, not by the villages: stone outcrops, great groves, coal seams, ore
// bodies, oil seeps and, further out, the rare deposits. The players will set up outposts at them (stage O2); for now
// they are found by travelling (a deposit's chunk explored), by the orbital scan and by rumours in the towns.
//
// Pure and deterministic from the world seed: at most one deposit per 256 m region (`regionLode`, cached per canonical
// region and shifted to the copy of the planet asked for), plus a few placed round Gridholm so the first trips find the
// basics (`startLodes`). Everything is read from the natural land, the sea mask, the places and the roads, so the
// trees, rocks and plants can ask `inLode` to keep the ground clear.
import { hash, rng } from '../core/rng';
import { REGION, POLAR_Z, wrapR, regionOf, worldDist, wrapDx, poisNear, villageDist, type Rect } from './regions';
import { seaMask } from './seas';
import { naturalHeight } from './heights';
import { mountainMask } from './mountains';
import { nearRiver } from './rivers';
import { inCity } from './cities';
import { regionRoads, nearestOnRoad } from './roads';
import { regionLakes } from './water';
import { inFogSite } from './toxic';
import { RARES, RARE_NAME, type Rare } from './deposits';
import { townsWorld } from './worldrules';
import type { ItemKey } from '../data/items';

export type LodeKind = 'stone' | 'grove' | 'coal' | 'iron' | 'copper' | 'lead' | 'oil' | Rare;
export type LodeMineral = 'limestone' | 'clay' | 'sand';
export interface LodeSpec {
  name: string;
  /** What it gives (crates; the first is the main one). */
  gives: ItemKey[];
  /** Roll weight; from how far out (m) it is found; the ground it clears (m). */
  w: number; from: number; r: number;
  /** Map and marker colour. */
  c: number;
  /** One-line description (rumours, the map). */
  blurb: string;
}
const RARE_C: Record<Rare, number> = { bauxite: 0xd08a5a, sulfur: 0xe8e040, lithium: 0xd0e8ff, rareearth: 0xc080ff, uranium: 0xb6ff3a, nickel: 0xa5c852, chromite: 0x8090a0, rutile: 0xe0b080, pgmore: 0xf0f0f0 };
const RARE_GOOD: Record<Rare, ItemKey> = { bauxite: 'bauxite', sulfur: 'sulfur', lithium: 'lithium', rareearth: 'rareearth', uranium: 'uranium', nickel: 'nickel', chromite: 'chromite', rutile: 'rutile', pgmore: 'pgmore' };
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
export const LODES: Record<LodeKind, LodeSpec> = {
  stone: { name: 'Stone Outcrop', gives: ['stone'], w: 20, from: 0, r: 16, c: 0xc8d0c0, blurb: 'a face of good building stone breaking out of the hillside' },
  grove: { name: 'Great Grove', gives: ['log'], w: 14, from: 0, r: 26, c: 0x6fd24a, blurb: 'a stand of giant old trees, timber for a lifetime' },
  coal: { name: 'Coal Seam', gives: ['coal'], w: 12, from: 0, r: 14, c: 0x687e98, blurb: 'a black seam of coal showing at the surface' },
  iron: { name: 'Iron Ore Body', gives: ['ore'], w: 12, from: 0, r: 14, c: 0xd0703c, blurb: 'rust-red rock heavy with iron' },
  copper: { name: 'Copper Ore Body', gives: ['copper'], w: 9, from: 1500, r: 14, c: 0x38d0b8, blurb: 'green-stained rock, rich in copper' },
  lead: { name: 'Lead Ore Body', gives: ['lead'], w: 6, from: 3000, r: 14, c: 0xa8a9db, blurb: 'grey lead ore in a broken ridge' },
  oil: { name: 'Oil Seep', gives: ['crude', 'salt'], w: 8, from: 2500, r: 12, c: 0x8a6a3a, blurb: 'crude oil welling up into black pools' },
  ...(Object.fromEntries(RARES.map((r) => [r.k, { name: cap(RARE_NAME[r.k].replace(/ \(.*\)/, '')) + ' Deposit', gives: [RARE_GOOD[r.k]], w: 1.6, from: r.from, r: 14, c: RARE_C[r.k], blurb: 'a deposit of ' + RARE_NAME[r.k] + ', worth a long journey' }])) as Record<Rare, LodeSpec>),
};
const KINDS = Object.keys(LODES) as LodeKind[];
export const MINERAL_OF: Record<LodeMineral, ItemKey> = { limestone: 'limestone', clay: 'clay', sand: 'sand' };
export const LODE = {
  /** The share of regions holding a deposit (more near Gridholm, within `home` m). */
  chance: 0.06, homeChance: 0.1, home: 4000,
  /** Villages keep this far (m), other places this far from the edge, roads and rivers this far. */
  village: 500, place: 30, road: 14, river: 18,
  /** Most height difference across the cleared ground (m); richness range. */
  steep: 6, rich: [0.6, 1.6] as [number, number],
  /** Start deposits: their kinds, and how far from Gridholm (m). */
  start: ['stone', 'grove', 'coal', 'iron', 'copper'] as LodeKind[], ring: [800, 2600] as [number, number],
};
export interface Lode {
  /** 'lode:<rx>:<rz>' (canonical region) or 'lode:s<i>' (a start deposit). */
  id: string;
  k: LodeKind;
  x: number; z: number; y: number;
  /** Cleared ground (m), the turn of its pieces, how rich (0.6..1.6: the output of an outpost later). */
  r: number; yaw: number; rich: number;
  /** A stone outcrop's second mineral; an oil seep with brine. */
  mineral?: LodeMineral; salt?: boolean;
  name: string;
}
const rectDist = (r: Rect, x: number, z: number) => Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.z0 - z, 0, z - r.z1));
const u01 = (...v: number[]) => (hash(...v) % 10000) / 10000;

/** Why (x, z) does not suit a deposit of kind k (radius r), or '' when it does. */
function misfit(world: number, x: number, z: number, r: number, k: LodeKind): string {
  if (Math.abs(z) > POLAR_Z - 1000) return 'ice';
  if (seaMask(world, x, z) > 0 || [0, 1.57, 3.14, 4.71].some((a) => seaMask(world, x + Math.cos(a) * (r + 20), z + Math.sin(a) * (r + 20)) > 0)) return 'sea';
  const m = mountainMask(world, x, z);
  if (m > (k === 'grove' || k === 'oil' ? 0.12 : 0.35)) return 'mountain'; // ores may lie in the foothills
  const y = naturalHeight(world, x, z);
  for (let a = 0; a < 6.28; a += 0.785) if (Math.abs(naturalHeight(world, x + Math.cos(a) * r, z + Math.sin(a) * r) - y) > LODE.steep) return 'steep';
  if (nearRiver(world, x, z, r + LODE.river)) return 'river';
  if (villageDist(world, x, z, LODE.village + 60) < LODE.village) return 'village';
  if (inCity(world, x, z, r + 120)) return 'city';
  if (poisNear(world, x, z, r + LODE.place + 40).some((p) => rectDist(p.rect, x, z) < r + LODE.place)) return 'place';
  if (inFogSite(world, x, z, r + 30)) return 'fog';
  const [rx, rz] = regionOf(x, z), t = { world, base: (a: number, b: number) => naturalHeight(world, a, b) };
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    for (const l of regionLakes(t, rx + i, rz + j)) if (worldDist(l.x, l.z, x, z) < l.r * 1.6 + r + 12) return 'lake';
    for (const rd of regionRoads(world, rx + i, rz + j)) if (nearestOnRoad(rd, x, z)[0] < r + LODE.road) return 'road';
  }
  return '';
}
const NAMES_A = ['Old', 'Black', 'Red', 'Grey', 'Long', 'High', 'Deep', 'Broken', 'Silent', 'Windy', 'Low', 'Far'];
const NAMES_B = ['Hollow', 'Ridge', 'Flats', 'Knoll', 'Gully', 'Bluff', 'Bank', 'Rise', 'Scar', 'Barrens', 'Shelf', 'Fold'];
function make(world: number, id: string, k: LodeKind, x: number, z: number, salt: number): Lode {
  const s = LODES[k], [a, b] = LODE.rich;
  return {
    id, k, x, z, y: naturalHeight(world, x, z), r: s.r, yaw: u01(world, salt, 0x10d1) * Math.PI * 2,
    rich: Math.round((a + (b - a) * u01(world, salt, 0x10d2)) * 100) / 100,
    ...(k === 'stone' ? { mineral: (['limestone', 'clay', 'sand'] as const)[hash(world, salt, 0x10d3) % 3] } : {}),
    ...(k === 'oil' ? { salt: hash(world, salt, 0x10d4) % 2 === 0 } : {}),
    name: s.name + ' at ' + NAMES_A[hash(world, salt, 0x10d5) % NAMES_A.length] + ' ' + NAMES_B[hash(world, salt, 0x10d6) % NAMES_B.length],
  };
}
const startCache = new Map<number, Lode[]>();
/** The deposits placed round Gridholm so the first trips find the basics (`LODE.start`), one each. */
export function startLodes(world: number): Lode[] {
  let out = startCache.get(world);
  if (out) return out;
  out = [];
  if (townsWorld(world)) for (const [i, k] of LODE.start.entries()) {
    for (let t = 0; t < 60; t++) {
      const a = u01(world, i, t, 0x10e1) * Math.PI * 2, d = LODE.ring[0] + (LODE.ring[1] - LODE.ring[0]) * u01(world, i, t, 0x10e2);
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (out.some((o) => worldDist(o.x, o.z, x, z) < o.r + LODES[k].r + 150) || misfit(world, x, z, LODES[k].r, k)) continue;
      out.push(make(world, 'lode:s' + i, k, x, z, 0x5000 + i)); break;
    }
  }
  startCache.set(world, out);
  return out;
}
const cache = new Map<string, Lode | null>();
/** The deposit whose middle lies in region (rx, rz), if any (none outside a towns world). */
export function regionLode(world: number, rx: number, rz: number): Lode | null {
  if (!townsWorld(world)) return null;
  const c = wrapR(rx);
  if (c !== rx) { const l = regionLode(world, c, rz); return l && { ...l, x: l.x + (rx - c) * REGION }; }
  const key = world + ':' + rx + ':' + rz;
  let l = cache.get(key);
  if (l !== undefined) return l;
  if (cache.size > 20000) cache.clear();
  l = startLodes(world).find((o) => { const [qx, qz] = regionOf(o.x, o.z); return qx === rx && qz === rz; }) ?? rollLode(world, rx, rz);
  cache.set(key, l);
  return l;
}
function rollLode(world: number, rx: number, rz: number): Lode | null {
  const R = rng(hash(world, rx, rz, 0x10f0)), x = rx * REGION + (R() - 0.5) * REGION * 0.6, z = rz * REGION + (R() - 0.5) * REGION * 0.6;
  const d = Math.hypot(wrapDx(x), z);
  if (R() > (d < LODE.home ? LODE.homeChance : LODE.chance)) return null;
  if (startLodes(world).some((o) => worldDist(o.x, o.z, x, z) < 400)) return null;
  // the kind: by weight among those found this far out; ores likelier in the hills, groves in the lowland forests
  const m = mountainMask(world, x, z), kinds = KINDS.filter((k) => d >= LODES[k].from);
  const w = kinds.map((k) => LODES[k].w * (k === 'grove' ? 1 - m * 2 : k === 'stone' || k === 'oil' ? 1 : 1 + m * 3));
  let pick = R() * w.reduce((a, b) => a + Math.max(0, b), 0), k: LodeKind = kinds[0];
  for (let i = 0; i < kinds.length; i++) { pick -= Math.max(0, w[i]); if (pick < 0) { k = kinds[i]; break; } }
  if (misfit(world, x, z, LODES[k].r, k)) return null;
  return make(world, `lode:${rx}:${rz}`, k, x, z, hash(rx, rz, 0x10f5));
}
/** The deposits whose ground may reach within `m` of (x, z). */
export function lodesNear(world: number, x: number, z: number, m = 0): Lode[] {
  if (!townsWorld(world)) return [];
  const out: Lode[] = [], n = Math.ceil((40 + m) / REGION), [rx, rz] = regionOf(x, z);
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
    const l = regionLode(world, rx + i, rz + j);
    if (l && worldDist(l.x, l.z, x, z) < l.r + m) out.push(l);
  }
  return out;
}
/** Is (x, z) on a deposit's cleared ground (its radius plus m)? A grove keeps its giants: only small trees give way. */
export const inLode = (world: number, x: number, z: number, m = 0) => townsWorld(world) && lodesNear(world, x, z, m).length > 0;
/** Every deposit within r of (x, z), nearest first (rumours, the maps). */
export function lodesWithin(world: number, x: number, z: number, r: number): Lode[] {
  if (!townsWorld(world)) return [];
  const out: Lode[] = [], n = Math.ceil(r / REGION), [rx, rz] = regionOf(x, z);
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
    const l = regionLode(world, rx + i, rz + j);
    if (l && worldDist(l.x, l.z, x, z) < r) out.push(l);
  }
  return out.sort((a, b) => worldDist(a.x, a.z, x, z) - worldDist(b.x, b.z, x, z) || (a.id < b.id ? -1 : 1));
}
/** What a deposit gives, in words ("iron ore", "stone and limestone"). */
export function lodeGives(l: Lode): ItemKey[] {
  return [...LODES[l.k].gives.filter((g) => g !== 'salt' || l.salt), ...(l.mineral ? [MINERAL_OF[l.mineral]] : [])];
}
