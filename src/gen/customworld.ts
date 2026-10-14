// (0.208) Worlds drawn in the map editor (gen/mapfile.ts WorldFile, stage E2 of PLAN_EDYTORA.md), played in the game.
// A drawn world has a seed of its own (`customSeed`: from its name, negative and below -1e9, so it follows the rules
// of the new towns worlds, gen/worldrules.ts) and, while its file is registered here (`setCustomWorld`), the
// generators take from the file what the owner drew instead of rolling it: the land's heights and so the seas and
// the mountains (gen/heights.ts, gen/seas.ts, gen/mountains.ts), the rivers (gen/rivers.ts), the villages, ruins,
// camps and wrecks (gen/regions.ts), the dead cities, the old plants, the megaliths, the caves and the deposits.
// The seed still makes everything else (trees, rocks, lakes, weather, interiors, people). The file's start place is
// Gridholm, at the game's origin; beyond the file lies deep sea.
// Pure: no three.js, no DOM. The game registers the file from the browser's editor store (world/custommaps.ts).
import { hash } from '../core/rng';
import type { WorldFile, WorldPlace, PlaceKind } from './mapfile';
import type { LodeKind } from './lodes';
import { WORLD_W, wrapDx, wrapX, wrapR, regionOf } from './regions';

/** Drawn worlds' seeds lie in [-2e9, -1e9]: far from the rolled ones (towns worlds go down to -1e6). */
export const CUSTOM_SEED = { lo: -2_000_000_000, hi: -1_000_000_000 };
/** The world seed of the drawn world called `name` (the same in every browser). */
export function customSeed(name: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) { h ^= name.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return CUSTOM_SEED.hi - (hash(h >>> 0, 0xed17) % 999_999_999);
}
export const isCustomSeed = (world: number) => world >= CUSTOM_SEED.lo && world <= CUSTOM_SEED.hi;

/** Outside the drawn grid: the sea bed (m below the sea level). */
export const OFF_MAP = -40;
/** A place of the file in game metres (canonical x), with the region it stands in. */
export interface GamePlace { k: PlaceKind; x: number; z: number; rx: number; rz: number; name?: string; r?: number; install?: string; i: number }
export interface GameLode { k: LodeKind; x: number; z: number; rx: number; rz: number; rich: number; i: number }
export interface GameRiver { x: number[]; z: number[]; w: number; name?: string }
export interface CustomWorld {
  world: number; f: WorldFile;
  /** Where the start (Gridholm) lies in the file (m from its north-west corner). */
  sx: number; sz: number;
  places: GamePlace[]; lodes: GameLode[]; rivers: GameRiver[];
  /** Places and deposits by canonical region ('rx:rz'). */
  byRegion: Map<string, GamePlace[]>; lodeByRegion: Map<string, GameLode>;
}
const reg = new Map<number, CustomWorld>();
const rkey = (rx: number, rz: number) => rx + ':' + rz;

/** Make `world` the drawn world `f` (null: back to the seed's own land). Clear the generators' caches by using a new
 *  seed, or by reloading the page, when a file changes under a seed already played. */
export function setCustomWorld(world: number, f: WorldFile | null) {
  if (!f) { reg.delete(world); return; }
  const start = f.places.find((p) => p.k === 'start');
  const sx = start ? start.x : f.w * f.cell / 2, sz = start ? start.z : f.h * f.cell / 2;
  const toGame = (x: number, z: number): [number, number] => [wrapX(x - sx), z - sz];
  const places: GamePlace[] = [], byRegion = new Map<string, GamePlace[]>();
  f.places.forEach((p: WorldPlace, i) => {
    if (p.k === 'start') return;
    const [x, z] = toGame(p.x, p.z), [rx, rz] = regionOf(x, z), g: GamePlace = { k: p.k, x, z, rx: wrapR(rx), rz, name: p.name || undefined, r: p.r, install: p.install, i };
    places.push(g);
    const k = rkey(g.rx, g.rz);
    let l = byRegion.get(k); if (!l) byRegion.set(k, l = []); l.push(g);
  });
  const lodes: GameLode[] = [], lodeByRegion = new Map<string, GameLode>();
  f.lodes.forEach((l, i) => {
    const [x, z] = toGame(l.x, l.z), [rx, rz] = regionOf(x, z), g: GameLode = { k: l.k, x, z, rx: wrapR(rx), rz, rich: l.rich, i };
    lodes.push(g);
    if (!lodeByRegion.has(rkey(g.rx, g.rz))) lodeByRegion.set(rkey(g.rx, g.rz), g); // one a region
  });
  const rivers: GameRiver[] = f.rivers.filter((r) => r.pts.length > 1).map((r) => {
    // unwrapped along the way (x from the first point's canonical copy on)
    const x: number[] = [], z: number[] = [];
    for (const [px, pz] of r.pts) { const [gx, gz] = toGame(px, pz); x.push(x.length ? x[x.length - 1] + wrapDx(gx - x[x.length - 1]) : gx); z.push(gz); }
    return { x, z, w: r.w, name: r.name || undefined };
  });
  reg.set(world, { world, f, sx, sz, places, lodes, rivers, byRegion, lodeByRegion });
}
/** The drawn world registered for `world`, or null (every seed's own land). */
export const customWorld = (world: number): CustomWorld | null => (reg.size ? reg.get(world) ?? null : null);
/** The file's places of a kind / in a canonical region. */
export const placesOf = (cw: CustomWorld, k: PlaceKind) => cw.places.filter((p) => p.k === k);
export const placesIn = (cw: CustomWorld, rx: number, rz: number): GamePlace[] => cw.byRegion.get(rkey(wrapR(rx), rz)) ?? [];

/** The drawn ground at game (x, z), metres above the sea level (0), smooth between the cells (Catmull-Rom, kept
 *  within its four nearest cells so a coast never dips below the sea). */
export function fileHeight(cw: CustomWorld, x: number, z: number): number {
  const f = cw.f, wide = f.w * f.cell >= WORLD_W;
  const u = (cw.sx + wrapDx(x)) / f.cell - 0.5, v = (cw.sz + z) / f.cell - 0.5;
  const i0 = Math.floor(u), j0 = Math.floor(v), tu = u - i0, tv = v - j0;
  const at = (i: number, j: number) => {
    if (wide) i = ((i % f.w) + f.w) % f.w;
    return i < 0 || j < 0 || i >= f.w || j >= f.h ? OFF_MAP : f.land[j * f.w + i];
  };
  const cr = (a: number, b: number, c: number, d: number, t: number) => b + 0.5 * t * (c - a + t * (2 * a - 5 * b + 4 * c - d + t * (3 * (b - c) + d - a)));
  const row = (j: number) => cr(at(i0 - 1, j), at(i0, j), at(i0 + 1, j), at(i0 + 2, j), tu);
  const y = cr(row(j0 - 1), row(j0), row(j0 + 1), row(j0 + 2), tv);
  const a = at(i0, j0), b = at(i0 + 1, j0), c = at(i0, j0 + 1), d = at(i0 + 1, j0 + 1);
  return Math.max(Math.min(a, b, c, d), Math.min(Math.max(a, b, c, d), y));
}
const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
/** Where the drawn sea is: 0 on land 1 m and more above the sea level, up to 1 some 8 m under it. */
export const CW = { sea: [1, 9] as [number, number], mountain: [42, 80] as [number, number] };
export const customSeaMask = (cw: CustomWorld, x: number, z: number) => smooth((CW.sea[0] - fileHeight(cw, x, z)) / CW.sea[1]);
/** Mountains are what the owner drew high: from `CW.mountain[0]` m up, full `CW.mountain[1]` m higher. */
export const customMountainMask = (cw: CustomWorld, x: number, z: number) => smooth((fileHeight(cw, x, z) - CW.mountain[0]) / CW.mountain[1]);
