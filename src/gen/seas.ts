// Seas: great bodies of salt water that cover about a quarter of the planet between the ice caps. A very
// low-frequency mask (a few basins round the planet, with a wobbly coast from a finer noise) says where they are;
// the terrain sinks below `SEA.level` there (beaches at the edge, the bed deepening towards the middle), and
// places, roads, lakes, wells, trees and trails keep off them. The land round Gridholm stays as it always was.
// The threshold is picked per world from a sample of the whole planet, so every world has the same share of sea.
// Pure and deterministic; the terrain applies `seaSink`, `Terrain.water` reports the sea ('sea' water).
import { fbm } from '../core/noise';
import { hash } from '../core/rng';
import { WORLD_W, X_MIN, POLAR_Z, wrapDx } from './regions';

export const SEA = {
  /** Height of the sea's surface (m). */
  level: 1,
  /** Share of the land between the ice caps that is sea. */
  share: 0.25,
  /** No sea within `clear` of Gridholm; it may come in over the next `fade` metres. */
  clear: 4500, fade: 3500,
  /** The sea keeps this far from the polar ice (m), fading in over `poleFade`. */
  pole: 1500, poleFade: 3000,
  /** Deepest bed below the level, in the middle of a basin (m). */
  deep: 38,
  /** Width of the coast in noise units: how gradually the land goes down into the sea. */
  coast: 0.015,
};

const wrap = (s: number): [number, number] => { const n = Math.round(WORLD_W / s); return [WORLD_W / n, n]; };
let scales: { basin: [number, number]; coast: [number, number] } | null = null;
/** Computed on first use: gen/regions.ts (WORLD_W) and this module import each other. */
const S = () => (scales ??= { basin: wrap(22000), coast: wrap(1800) });
const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
/** How much the finer coast noise can move the basin value either way. */
const WOBBLE = 0.06;

/** The basin value before the threshold: big noise, pushed down near Gridholm and the ice. Without the coast wobble. */
function basin(world: number, x: number, z: number): number {
  const [s, p] = S().basin, dx = wrapDx(x), a = Math.atan2(z, dx);
  // the land kept round Gridholm is a blob, not a circle
  const d = Math.hypot(dx, z) * (1 + 0.22 * Math.sin(2 * a + 1.3) + 0.12 * Math.sin(3 * a + 4.1) + 0.08 * Math.sin(5 * a + 0.7));
  const n = fbm(hash(world, 0x5ea1), x / s, z / s, 2, p);
  const home = smooth((d - SEA.clear) / SEA.fade), pole = smooth((POLAR_Z - SEA.pole - Math.abs(z)) / SEA.poleFade);
  return n - 0.6 * (1 - home) - 0.6 * (1 - pole);
}
const wobble = (world: number, x: number, z: number) => { const [s, p] = S().coast; return WOBBLE * 2 * (fbm(hash(world, 0x5ea2), x / s, z / s, 2, p) - 0.5); };

const thresholds = new Map<number, number>();
/** The world's threshold: the basin value above which the land (between the ice caps) is sea, `SEA.share` of it. */
export function seaThreshold(world: number): number {
  let t = thresholds.get(world);
  if (t !== undefined) return t;
  const v: number[] = [], step = 400;
  for (let z = -POLAR_Z + step / 2; z < POLAR_Z; z += step) for (let x = X_MIN + step / 2; x < X_MIN + WORLD_W; x += step) v.push(basin(world, x, z) + wobble(world, x, z));
  v.sort((a, b) => a - b);
  t = v[Math.floor(v.length * (1 - SEA.share))];
  thresholds.set(world, t);
  return t;
}

/** Where the seas are: 0 (dry land) .. 1 (open sea, far from the coast). Past ~0.5 the ground is under water. */
export function seaMask(world: number, x: number, z: number): number {
  const t = seaThreshold(world), b = basin(world, x, z);
  if (b + WOBBLE < t - SEA.coast) return 0; // most of the land: no need for the finer noise
  return smooth((b + wobble(world, x, z) - t + SEA.coast) / (4 * SEA.coast));
}
/** The land at (x, z) given the natural height h and the sea mask m: sunk towards the sea bed. */
export function seaSink(h: number, m: number): number {
  if (m <= 0) return h;
  const bed = SEA.level - 2 - SEA.deep * smooth((m - 0.25) / 0.75);
  return h + (bed - h) * smooth(m * 2.2);
}
/** Is (x, z) in or near the sea (for keeping places, roads and trees off it)? */
export const inSea = (world: number, x: number, z: number, margin = 0) =>
  seaMask(world, x, z) > 0.01 || (margin > 0 && [0, 1.57, 3.14, 4.71].some((a) => seaMask(world, x + Math.cos(a) * margin, z + Math.sin(a) * margin) > 0.01));
