// Mountains: now and then the land rises into a massif of ridges and peaks, up to ~160 m, some of it too steep to
// climb. A low-frequency mask says where the massifs are (0 = none, 1 = the heart of one); places (villages, ruins,
// camps, wrecks), roads, lakes and wells keep off them, and the start around Gridholm stays as it always was.
// Pure and deterministic; the terrain adds `mountainLift` to its heights, gen/caves.ts puts cave mouths on the flanks.
import { fbm } from '../core/noise';
import { hash } from '../core/rng';
import { WORLD_W, wrapDx } from './regions';

/** Noise scale adjusted so a whole number of lattice cells fits round the planet (as in gen/terrain.ts). */
const wrap = (s: number): [number, number] => { const n = Math.round(WORLD_W / s); return [WORLD_W / n, n]; };
let scales: { mask: [number, number]; ridge: [number, number]; peak: [number, number] } | null = null;
/** Computed on first use: gen/regions.ts (WORLD_W) and this module import each other. */
const S = () => (scales ??= { mask: wrap(1300), ridge: wrap(260), peak: wrap(90) });

/** No mountains within this distance of Gridholm (m); they fade in over the next FADE. */
export const MOUNTAIN_CLEAR = 1400, FADE = 700;
/** Tallest lift of the land in the heart of a massif, on top of the ordinary hills (m). */
export const MOUNTAIN_LIFT = 135;
const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** Where the massifs are: 0 (none) .. 1 (the heart of one). About one tenth of the land is mountain. */
export function mountainMask(world: number, x: number, z: number): number {
  const [s, p] = S().mask, d = Math.hypot(wrapDx(x), z);
  if (d < MOUNTAIN_CLEAR) return 0;
  const n = fbm(hash(world, 0x3e11), x / s, z / s, 3, p);
  return smooth((n - 0.67) / 0.1) * smooth((d - MOUNTAIN_CLEAR) / FADE);
}
/** How much the mountains raise the land at (x, z), given the mask there: ridges, and peaks on the ridges. */
export function mountainLift(world: number, x: number, z: number, m: number): number {
  if (m <= 0) return 0;
  const [rs, rp] = S().ridge, [ps, pp] = S().peak;
  const r = 1 - Math.abs(2 * fbm(hash(world, 0x3e12), x / rs, z / rs, 4, rp) - 1); // sharp ridge lines
  const pk = fbm(hash(world, 0x3e13), x / ps, z / ps, 2, pp);
  return m * (14 + MOUNTAIN_LIFT * (0.35 * m + 0.65 * r * r) * (0.75 + 0.5 * pk));
}
/** Is (x, z) on or near a mountain (for keeping places, roads and water off them)? */
export const onMountain = (world: number, x: number, z: number, margin = 0) =>
  mountainMask(world, x, z) > 0.01 || (margin > 0 && [0, 1.57, 3.14, 4.71].some((a) => mountainMask(world, x + Math.cos(a) * margin, z + Math.sin(a) * margin) > 0.01));
