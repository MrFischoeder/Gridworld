// Seas separating two or three large continents, with seeded coast detail and small offshore islands.
// Gridholm stays on the home continent; the polar ice buffer remains dry. Pure and deterministic.
import { fbm } from '../core/noise';
import { continents, continentDistance } from './continents';
import { hash } from '../core/rng';
import { WORLD_W, X_MIN, POLAR_Z, wrapDx, wrapX } from './regions';

export const SEA = {
  /** Height of the sea's surface (m). */
  level: 1,
  /** Approximate sea share between the ice caps (continental geometry replaces a global noise quantile). */
  share: 0.5,
  /** No sea within `clear` of Gridholm; it may come in over the next `fade` metres. */
  clear: 4500, fade: 3500,
  /** The sea keeps this far from the polar ice (m), fading in over `poleFade`. */
  pole: 1500, poleFade: 3000,
  /** Deepest bed below the level, in the middle of a basin (m). */
  deep: 38,
  /** Width of the coast in normalised continent radius units: how gradually the land goes down into the sea. */
  coast: 0.08,
};

const wrap = (s: number): [number, number] => { const n = Math.round(WORLD_W / s); return [WORLD_W / n, n]; };
let coastScale: [number, number] | null = null;
const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
/** Normalised mainland edge; retained as an exported threshold for map/debug callers. */
export const seaThreshold = (_world: number): number => 1;
export function seaMask(world: number, x: number, z: number): number {
  if (Math.hypot(wrapDx(x), z) < SEA.clear) return 0;
  let distance = Infinity;
  for (const c of continents(world)) distance = Math.min(distance, continentDistance(c, x, z));
  if (distance < 0.94) return 0;
  const pole = smooth((POLAR_Z - SEA.pole - Math.abs(z)) / SEA.poleFade);
  if (distance > 1.08) return pole;
  const [scale, period] = coastScale ??= wrap(1800);
  const detail = 0.025 * (2 * fbm(hash(world, 0x5ea2), x / scale, z / scale, 2, period) - 1);
  return smooth((distance + detail - 0.97) / SEA.coast) * pole;
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
