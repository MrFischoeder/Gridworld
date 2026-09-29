// Seas: great bodies of salt water that cover about a quarter of the planet between the ice caps. A very
// low-frequency mask (a few basins round the planet, with a wobbly coast from a finer noise) says where they are;
// the terrain sinks below `SEA.level` there (beaches at the edge, the bed deepening towards the middle), and
// places, roads, lakes, wells, trees and trails keep off them. The land round Gridholm stays as it always was.
// The threshold is picked per world from a sample of the whole planet, so every world has the same share of sea.
// Pure and deterministic; the terrain applies `seaSink`, `Terrain.water` reports the sea ('sea' water).
import { fbm } from '../core/noise';
import { hash } from '../core/rng';
import { WORLD_W, X_MIN, POLAR_Z, wrapDx, wrapX } from './regions';

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

// ---------- islands ----------
// Small islands out in the open sea: on a grid of `ISLE.cell` cells round the planet, some cells hold one (a hashed
// spot, size and height) where the sea is deep enough round it. `naturalHeight` raises the sea bed to them.
export const ISLE = {
  /** Grid cell (m, adjusted to fit round the planet), the share of cells with an island. */
  cell: 1600, chance: 0.35,
  /** The dry island's radius (m) and top above the sea (m). */
  r: [60, 220] as [number, number], top: [3, 11] as [number, number],
  /** The sea mask wanted at the middle (open water, the coast out of sight). */
  mask: 0.6,
  /** The island's foot reaches this many times its dry radius under water. */
  foot: 1.7,
};
export interface Isle { i: number; j: number; x: number; z: number; r: number; top: number; ph: number }
let isleGrid: [number, number] | null = null;
const IG = () => (isleGrid ??= (() => { const n = Math.round(WORLD_W / ISLE.cell); return [WORLD_W / n, n]; })());
const isles = new Map<string, Isle | null>();
/** The island of grid cell (i, j) (i canonical, 0 .. n-1), or null. */
export function isleOf(world: number, i: number, j: number): Isle | null {
  const key = world + ':' + i + ':' + j;
  let s = isles.get(key);
  if (s !== undefined) return s;
  if (isles.size > 50000) isles.clear();
  s = null;
  const [c] = IG(), u = (k: number) => (hash(world, i, j, k) % 10000) / 10000;
  if (u(0x151e) < ISLE.chance) {
    const x = X_MIN + (i + 0.5 + (u(0x1511) - 0.5) * 0.5) * c, z = (j + 0.5 + (u(0x1512) - 0.5) * 0.5) * c;
    const r = ISLE.r[0] + u(0x1513) * (ISLE.r[1] - ISLE.r[0]);
    if (Math.abs(z) < POLAR_Z - SEA.pole && seaMask(world, x, z) >= ISLE.mask && [0, 2.1, 4.2].every((a) => seaMask(world, x + Math.cos(a) * r * 2.5, z + Math.sin(a) * r * 2.5) > 0.35))
      s = { i, j, x, z, r, top: ISLE.top[0] + u(0x1514) * (ISLE.top[1] - ISLE.top[0]), ph: u(0x1515) * 6.283 };
  }
  isles.set(key, s);
  return s;
}
/** The islands whose foot may reach (x, z) (their x on the copy of the planet near x). */
export function islesNear(world: number, x: number, z: number, m = 0): Isle[] {
  const [c, n] = IG(), fi = Math.floor((wrapX(x) - X_MIN) / c), fj = Math.floor(z / c), out: Isle[] = [];
  for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
    const s = isleOf(world, ((fi + di) % n + n) % n, fj + dj);
    if (!s) continue;
    const sx = x + wrapDx(s.x - x);
    if (Math.hypot(sx - x, s.z - z) < s.r * ISLE.foot + m) out.push(sx === s.x ? s : { ...s, x: sx });
  }
  return out;
}
/** The island's radius in direction a (a lobed outline, not a circle). */
export const isleEdge = (s: Isle, a: number) => s.r * (1 + 0.14 * Math.sin(3 * a + s.ph) + 0.08 * Math.sin(5 * a + 2 * s.ph));
/** The ground of the islands at (x, z) (the highest), or -Infinity where there is none. */
export function isleHeight(world: number, x: number, z: number): number {
  let h = -Infinity;
  for (const s of islesNear(world, x, z)) {
    const dx = x - s.x, dz = z - s.z, d = Math.hypot(dx, dz) / isleEdge(s, Math.atan2(dz, dx));
    if (d >= ISLE.foot) continue;
    // dry to d = 1, then down under the sea to the foot; a gentle dome on top
    const y = d <= 1 ? SEA.level + 0.6 + (s.top - 0.6) * smooth(1 - d) : SEA.level + 0.6 - (SEA.deep * 0.4) * smooth((d - 1) / (ISLE.foot - 1));
    h = Math.max(h, y);
  }
  return h;
}
