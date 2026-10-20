// (0.231, PLAN_BIOMOW.md stage B1) Biomes: the land falls into broad belts of its own kind (plains, forest, taiga,
// tundra, desert, savanna, swamp, jungle, mountains, coast, and the giant crystals). Each spot gets a warmth (cooler
// towards the poles and higher up, with slow patches of its own), a wetness (slow noise, wetter by rivers and the sea)
// and the mountains and the sea the land already has; the biome follows from those. Round Gridholm the land is always
// temperate, so the start stays as it was. Looks only for now (stage B2 draws them, B4 gives them rules).
// Pure and deterministic from the world seed: every player sees the same biome at the same spot.
import { fbm } from '../core/noise';
import { hash } from '../core/rng';
import { WORLD_W, POLAR_Z, wrapDx } from './regions';
import { naturalHeight } from './heights';
import { mountainMask } from './mountains';
import { seaMask, SEA } from './seas';
import { nearRiver } from './rivers';

export type Biome = 'plains' | 'forest' | 'taiga' | 'tundra' | 'desert' | 'savanna' | 'swamp' | 'jungle' | 'mountain' | 'coast' | 'crystal';
/** Where there is no land biome: the open sea and the polar ice. */
export type BiomeHere = Biome | 'sea' | 'ice';

/** Name (English, translated where shown) and the map colour of each. */
export const BIOMES: Record<BiomeHere, { name: string; c: string }> = {
  plains: { name: 'Plains', c: '#9ccc4a' },
  forest: { name: 'Forest', c: '#2f9a3c' },
  taiga: { name: 'Taiga', c: '#2e6e58' },
  tundra: { name: 'Tundra', c: '#c4d8d0' },
  desert: { name: 'Desert', c: '#e0b850' },
  savanna: { name: 'Savanna', c: '#c0b048' },
  swamp: { name: 'Swamp', c: '#6a7a38' },
  jungle: { name: 'Jungle', c: '#127a2a' },
  mountain: { name: 'Mountains', c: '#9a9a8a' },
  coast: { name: 'Coast', c: '#e8dca0' },
  crystal: { name: 'Crystal Wastes', c: '#c49cff' },
  sea: { name: 'Sea', c: '#1a4a8c' },
  ice: { name: 'Ice', c: '#e8fff8' },
};
export const BIOME_KINDS = Object.keys(BIOMES).filter((k) => k !== 'sea' && k !== 'ice') as Biome[];

export const BIOME = {
  /** Slow noise scales (m): warmth, wetness, the crystal patches. */
  warm: 9000, wet: 6500, crys: 5200,
  /** Within `home` m of Gridholm the land is temperate plains or forest, easing to its own over `fade` m. */
  home: 3500, fade: 3000,
  /** Warmth falls by `lapse` per metre of height. */
  lapse: 1 / 320,
  /** Thresholds: cold below, hot above; arid below, humid above. */
  cold: 0.34, hot: 0.6, arid: 0.4, humid: 0.6,
  /** Mountains from this mask; the coast within `coast` m of the sea and below `coastH` m. */
  mountain: 0.35, coast: 260, coastH: 10,
  /** Swamps: wet above this, below `swampH` m. */
  swamp: 0.72, swampH: 18,
  /** The crystal wastes: the patch noise above `crysAt`, never within `crysFrom` m of Gridholm. */
  crysAt: 0.7, crysFrom: 6000,
};

const wrap = (s: number): [number, number] => { const n = Math.round(WORLD_W / s); return [WORLD_W / n, n]; };
const scales = new Map<number, [number, number]>();
const sc = (s: number) => { let v = scales.get(s); if (!v) scales.set(s, (v = wrap(s))); return v; };
const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const noise = (world: number, salt: number, s: number, x: number, z: number) => { const [k, p] = sc(s); return fbm(hash(world, salt), x / k, z / k, 3, p); };

/** Warmth at a spot: 0 (polar) .. 1 (torrid), before the home rule. */
export function warmth(world: number, x: number, z: number, h = naturalHeight(world, x, z)): number {
  const lat = Math.min(1, Math.abs(z) / POLAR_Z), n = noise(world, 0xb10e1, BIOME.warm, x, z);
  return clamp(0.2 + 0.6 * (1 - lat * lat) + 1.2 * (n - 0.5) - Math.max(0, h - SEA.level) * BIOME.lapse);
}
/** Wetness at a spot: 0 (arid) .. 1 (soaked), before the home rule. */
export function wetness(world: number, x: number, z: number): number {
  const n = noise(world, 0xb10e2, BIOME.wet, x, z);
  const river = nearRiver(world, x, z, 250) ? 0.22 : nearRiver(world, x, z, 900) ? 0.1 : 0;
  return clamp(0.5 + 1.3 * (n - 0.5) + river);
}
const nearSea = (world: number, x: number, z: number, r: number) => [0, 1.57, 3.14, 4.71].some((a) => seaMask(world, x + Math.cos(a) * r, z + Math.sin(a) * r) > 0.01);

/** The biome at (x, z). */
export function biomeAt(world: number, x: number, z: number): BiomeHere {
  if (Math.abs(z) > POLAR_Z) return 'ice';
  const h = naturalHeight(world, x, z);
  if (h < SEA.level && seaMask(world, x, z) > 0) return 'sea';
  if (mountainMask(world, x, z) > BIOME.mountain) return 'mountain';
  if (h < BIOME.coastH && nearSea(world, x, z, BIOME.coast)) return 'coast';
  const d = Math.hypot(wrapDx(x), z), home = clamp((d - BIOME.home) / BIOME.fade); // 0 at home .. 1 away
  if (home >= 1 && d > BIOME.crysFrom && noise(world, 0xb10e3, BIOME.crys, x, z) > BIOME.crysAt) return 'crystal';
  let t = warmth(world, x, z, h), w = wetness(world, x, z);
  t = 0.47 + (t - 0.47) * home; w = 0.5 + (w - 0.5) * home; // temperate round Gridholm
  if (w > BIOME.swamp && h < BIOME.swampH && t >= BIOME.cold) return 'swamp';
  if (t < BIOME.cold) return w > 0.45 && t > 0.12 ? 'taiga' : 'tundra';
  if (t > BIOME.hot) return w < BIOME.arid ? 'desert' : w > BIOME.humid ? 'jungle' : 'savanna';
  return w > 0.5 ? 'forest' : 'plains';
}
/** The biome's name for the HUD and the maps (English; pass through tl). */
export const biomeName = (b: BiomeHere) => BIOMES[b].name;

// ---------- stage B2: the look (0.232) ----------
/**
 * How each biome looks: `line` the colour of the ground's lines, rocks and bark; `leaf` crowns and grass; `fill` the
 * dark fill under the lines; `keep` the share of the generated trees that stand there; `tree` what they grow into
 * (null: as generated); `big` whether the great trees (twisted, umbrella, arch) stand; `size` the trees' scale.
 */
export type TreeLook = 'pine' | 'cactus' | 'dead' | 'palm' | 'acacia' | 'shard' | 'lush' | null;
export interface BiomeLook { /** The day's haze over it (0: the plain green sky) and how much thicker its air is (0..1). */ haze?: number; thick?: number; line: number; leaf: number; fill: number; keep: number; tree: TreeLook; big: boolean; size: number; deco: 'reeds' | 'grass' | 'snow' | 'pebbles' | null }
export const BIOME_LOOK: Record<BiomeHere, BiomeLook> = {
  plains:   { line: 0x2fe060, leaf: 0x3dff6e, fill: 0x010d04, keep: 0.7, tree: null, big: true, size: 1, deco: 'grass' },
  forest:   { line: 0x28d24c, leaf: 0x34f060, fill: 0x010f04, keep: 1, tree: null, big: true, size: 1.1, deco: null },
  taiga:    { haze: 0x5aa890, thick: 0.1, line: 0x3ccf98, leaf: 0x2fd8a0, fill: 0x01100c, keep: 1, tree: 'pine', big: false, size: 1.15, deco: 'snow' },
  tundra:   { haze: 0xc8e0e0, thick: 0.15, line: 0xc8e8e0, leaf: 0xd8fff4, fill: 0x0a1212, keep: 0.25, tree: 'pine', big: false, size: 0.6, deco: 'snow' },
  desert:   { haze: 0xd0a850, thick: 0, line: 0xe8b848, leaf: 0xa8d050, fill: 0x120c02, keep: 0.22, tree: 'cactus', big: false, size: 1, deco: 'pebbles' },
  savanna:  { haze: 0xb8b058, thick: 0, line: 0xd0c848, leaf: 0xb8d848, fill: 0x0e0e02, keep: 0.35, tree: 'acacia', big: true, size: 1, deco: 'grass' },
  swamp:    { haze: 0x7a8a48, thick: 0.35, line: 0x9aac48, leaf: 0x7c9a3c, fill: 0x080c02, keep: 0.75, tree: 'dead', big: true, size: 1, deco: 'reeds' },
  jungle:   { haze: 0x3aa860, thick: 0.2, line: 0x1cf040, leaf: 0x18ff50, fill: 0x001404, keep: 1, tree: 'lush', big: true, size: 1.3, deco: null },
  mountain: { haze: 0x8ab09a, thick: 0, line: 0x8fcf9c, leaf: 0x3dff6e, fill: 0x060c08, keep: 1, tree: null, big: true, size: 1, deco: 'pebbles' },
  coast:    { haze: 0xb8c8a0, thick: 0, line: 0xe0dca0, leaf: 0x9ae070, fill: 0x0e0e08, keep: 0.35, tree: 'palm', big: false, size: 1, deco: 'grass' },
  crystal:  { haze: 0x9a78d8, thick: 0.1, line: 0xb48cff, leaf: 0xc8a0ff, fill: 0x0a0614, keep: 0.2, tree: 'shard', big: false, size: 1, deco: 'pebbles' },
  sea:      { line: 0x2fe060, leaf: 0x3dff6e, fill: 0x010d04, keep: 1, tree: null, big: true, size: 1, deco: null },
  ice:      { line: 0xbfffe8, leaf: 0xd8fff4, fill: 0x0a1212, keep: 0.2, tree: 'pine', big: false, size: 0.6, deco: 'snow' },
};
/** The biome map's cell (m): the ground's colours are blended between cells, so a border fades over ~3 cells. */
export const BIOME_CELL = 24;
const cellCache = new Map<string, BiomeHere>();
let cellWorld = NaN;
/** The biome at cell (i, j) (its middle), cached. */
export function biomeCell(world: number, i: number, j: number): BiomeHere {
  if (world !== cellWorld) { cellCache.clear(); soft.clear(); cellWorld = world; }
  const k = i + ',' + j;
  let b = cellCache.get(k);
  if (b === undefined) { if (cellCache.size > 300000) cellCache.clear(); b = biomeAt(world, (i + 0.5) * BIOME_CELL, (j + 0.5) * BIOME_CELL); cellCache.set(k, b); }
  return b;
}
/** The biome of the cell holding (x, z). */
export const biomeOfCell = (world: number, x: number, z: number) => biomeCell(world, Math.floor(x / BIOME_CELL), Math.floor(z / BIOME_CELL));
const soft = new Map<string, [number, number, number]>();
const rgb = (c: number): [number, number, number] => [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];
/** A cell's colour (`line` or `fill`) averaged over it and its 8 neighbours. */
function softCell(world: number, i: number, j: number, k: 'line' | 'fill'): [number, number, number] {
  const key = k + i + ',' + j;
  let c = soft.get(key);
  if (c) return c;
  if (soft.size > 200000) soft.clear();
  c = [0, 0, 0];
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const [r, g, bl] = rgb(BIOME_LOOK[biomeCell(world, i + a, j + b)][k]); c[0] += r / 9; c[1] += g / 9; c[2] += bl / 9; }
  soft.set(key, c);
  return c;
}
/** The ground's colour at (x, z) (0..1 rgb), blended smoothly across the biomes' borders. */
export function biomeTint(world: number, x: number, z: number, k: 'line' | 'fill' = 'line'): [number, number, number] {
  biomeCell(world, 0, 0); // a new world clears the caches
  const u = x / BIOME_CELL - 0.5, v = z / BIOME_CELL - 0.5, i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
  const a = softCell(world, i, j, k), b = softCell(world, i + 1, j, k), c = softCell(world, i, j + 1, k), d = softCell(world, i + 1, j + 1, k);
  const mix = (n: number) => (a[n] * (1 - fu) + b[n] * fu) * (1 - fv) + (c[n] * (1 - fu) + d[n] * fu) * fv;
  return [mix(0), mix(1), mix(2)];
}
/** What a generated tree becomes in its biome: null = it does not stand there; else the look and the scale. */
export function treeIn(b: BiomeHere, seed: number, big: boolean): { look: TreeLook; size: number } | null {
  const L = BIOME_LOOK[b];
  if (big && !L.big) return null;
  if (((seed >>> 0) % 1000) / 1000 >= L.keep) return null;
  let look = big ? null : L.tree;
  if (look === 'dead' && (seed >>> 7) % 2) look = null; // half the swamp's trees still green
  return { look, size: big ? 1 : L.size };
}
