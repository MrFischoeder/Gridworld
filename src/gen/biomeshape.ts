// (0.233, PLAN_BIOMOW.md stage B3) The biomes shape the land, in new worlds only (`shapedWorld`, from the seed): dunes
// in the desert, a swamp flattened down to its water table and full of shallow pools of murky water, frost-heaved
// ground in the tundra, jagged ridges in the crystal wastes. The climate (warmth, the wetness's own noise) lives here
// so gen/heights.ts can shape the land without asking the biomes, which read the heights (no import loop); the
// weights ease in and out, so a biome's shape fades over its border. Rivers do not enter the shape (they are laid out
// on the shaped land). Pure and deterministic.
import { fbm } from '../core/noise';
import { hash } from '../core/rng';
import { WORLD_W, POLAR_Z, wrapDx } from './regions';
import { mountainMask } from './mountains';
import { SEA } from './seas';
import { shapedWorld } from './worldrules';

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
export const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v: number) => { const t = clamp(v); return t * t * (3 - 2 * t); };
export const noise = (world: number, salt: number, s: number, x: number, z: number, oct = 3) => { const [k, p] = sc(s); return fbm(hash(world, salt), x / k, z / k, oct, p); };

/** Warmth at a spot: 0 (polar) .. 1 (torrid), before the home rule. `h` is the land's height there. */
export function warmthAt(world: number, x: number, z: number, h: number): number {
  const lat = Math.min(1, Math.abs(z) / POLAR_Z), n = noise(world, 0xb10e1, BIOME.warm, x, z);
  return clamp(0.2 + 0.6 * (1 - lat * lat) + 1.2 * (n - 0.5) - Math.max(0, h - SEA.level) * BIOME.lapse);
}
/** The wetness's own part (without the rivers; not clamped, so the rivers' part adds as in stage B1). */
export const wetNoise = (world: number, x: number, z: number) => 0.5 + 1.3 * (noise(world, 0xb10e2, BIOME.wet, x, z) - 0.5);
/** 0 round Gridholm .. 1 out where the land has its own climate. */
export const awayFromHome = (x: number, z: number) => clamp((Math.hypot(wrapDx(x), z) - BIOME.home) / BIOME.fade);

/** The shapes' numbers. */
export const SHAPE = {
  /** Dunes: wavelength (m), height (m), how far a dune's crest wanders. */
  dune: { len: 64, amp: [2.5, 6] as [number, number], wander: 3 },
  /** Swamps: the water table's height over the sea and how much of the old relief is left; the pools' grain (m), the
   *  ground's rise and fall round the table (m: below 0 is a pool), and the weight from which the pools hold water. */
  swamp: { over: 2.2, keep: 0.25, grain: 26, bump: 1.3, sink: 0.26, wet: 0.45, deep: 0.85 },
  /** Frost-heaved tundra and the crystal ridges (m). */
  tundra: 1.6, crystal: 6,
};
/** How much of each biome's shape a spot takes (0..1), from its climate and the base land's height. */
export function shapeWeights(world: number, x: number, z: number, h: number) {
  const out = { desert: 0, swamp: 0, tundra: 0, crystal: 0 };
  if (Math.abs(z) > POLAR_Z || h < SEA.level + 0.3) return out;
  const home = awayFromHome(x, z);
  if (home <= 0) return out;
  const hills = 1 - smooth((mountainMask(world, x, z) - 0.15) / 0.2);
  if (hills <= 0) return out;
  const d = Math.hypot(wrapDx(x), z);
  const crys = d > BIOME.crysFrom ? smooth((noise(world, 0xb10e3, BIOME.crys, x, z) - BIOME.crysAt + 0.02) / 0.05) : 0;
  const t = 0.47 + (warmthAt(world, x, z, h) - 0.47) * home, w = 0.5 + (clamp(wetNoise(world, x, z)) - 0.5) * home, inland = smooth((h - SEA.level - 3) / 5);
  out.crystal = crys * hills * smooth((home - 0.9) / 0.1); // the wastes begin where the home climate has faded (gen/biomes.ts)
  const rest = (1 - crys) * hills * home;
  out.swamp = rest * smooth((w - BIOME.swamp + 0.02) / 0.06) * smooth((BIOME.swampH + 2 - h) / 6) * smooth((t - BIOME.cold + 0.02) / 0.06) * smooth((h - SEA.level - 0.6) / 1.2);
  out.desert = rest * (1 - out.swamp) * smooth((t - BIOME.hot + 0.02) / 0.06) * smooth((BIOME.arid + 0.02 - w) / 0.06) * inland;
  out.tundra = rest * (1 - out.swamp) * smooth((BIOME.cold + 0.02 - t) / 0.08);
  return out;
}
/** The swamp's water table at a spot of base height h (the pools' surface). */
export const swampTable = (h: number) => SEA.level + SHAPE.swamp.over + Math.max(0, h - SEA.level - SHAPE.swamp.over) * SHAPE.swamp.keep;
/** The swamp ground's rise and fall round its table (m; below 0 a pool). */
const swampBump = (world: number, x: number, z: number) => Math.max(-SHAPE.swamp.deep, (noise(world, 0xb10e5, SHAPE.swamp.grain, x, z, 2) - 0.5) * 2 * SHAPE.swamp.bump - SHAPE.swamp.sink);

/** The land's height after its biome shaped it (new worlds), from the base height h. */
export function shapeLand(world: number, x: number, z: number, h: number): number {
  if (!shapedWorld(world)) return h;
  const W = shapeWeights(world, x, z, h);
  if (W.desert > 0) {
    const a = (hash(world, 0xd0e1) % 628) / 100, along = x * Math.cos(a) + z * Math.sin(a), D = SHAPE.dune;
    const ph = along / D.len * 6.283 + D.wander * noise(world, 0xd0e2, 300, x, z), amp = D.amp[0] + (D.amp[1] - D.amp[0]) * noise(world, 0xd0e3, 900, x, z);
    const s = 0.5 + 0.5 * Math.sin(ph + 0.6 * Math.sin(ph)); // a steeper lee face
    h += W.desert * amp * (s * s - 0.35);
  }
  if (W.tundra > 0) h += W.tundra * SHAPE.tundra * (noise(world, 0xd0e4, 22, x, z, 2) - 0.5) * 2;
  if (W.crystal > 0) h += W.crystal * SHAPE.crystal * Math.max(0, 1 - Math.abs(noise(world, 0xd0e5, 140, x, z) - 0.5) * 6) ** 2;
  if (W.swamp > 0) h += (swampTable(h) + swampBump(world, x, z) - h) * W.swamp;
  return h;
}
/** The swamp's water at a spot of base height h: its level, or null where it holds none (dry land, the edges). */
export function swampWater(world: number, x: number, z: number, h: number): number | null {
  if (!shapedWorld(world)) return null;
  const W = shapeWeights(world, x, z, h);
  if (W.swamp < SHAPE.swamp.wet) return null;
  return swampTable(h);
}
