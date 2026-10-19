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
