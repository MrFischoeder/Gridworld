// How dangerous the wilds are at a point (0 = safe .. 8). Pure: every spawner (creatures, robots, bandits,
// raiders) asks this. Danger grows in rings round Gridholm: the country round the start is a calm patch (about 1),
// and the further out you go the more there is about, and the more of it is the heavy kind. The rings are not
// perfect circles: their edges wander in and out. Every village is a refuge: calm right outside its walls, the
// danger of its ring coming back over the next few hundred metres. Ruins add a little.
import { allVillages, worldDist, nearX, wrapDx } from './regions';
import { hash } from '../core/rng';

const rectD = (r: { x0: number; z0: number; x1: number; z1: number }, x: number, z: number) =>
  Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.z0 - z, 0, z - r.z1));

/** Distance (m) from the nearest village's walls. */
export function villageFar(world: number, x: number, z: number): number {
  let d = Infinity;
  for (const v of allVillages(world)) {
    if (worldDist(x, z, v.x, v.z) - 60 > d) continue;
    d = Math.min(d, rectD(v.rect, nearX(x, v.x), z));
  }
  return d;
}

/**
 * Danger bands: `rings` are [distance from Gridholm's walls (m), danger] steps, eased in between; `wobble` is how far
 * the ring edges wander (a share of the distance); past a village's walls it is calm for `safe` m, then the ring's
 * danger comes back over `refuge` m.
 */
export const DANGER = {
  safe: 60, refuge: 500, ruin: 0.6, max: 8, wobble: 0.16,
  rings: [[0, 0], [60, 0], [600, 1], [1600, 1], [4000, 2], [8000, 3], [13000, 4], [19000, 5], [26000, 6], [34000, 7], [44000, 8]] as [number, number][],
};
const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
/** The ring's danger at `d` m from Gridholm's walls. */
export function ringDanger(d: number): number {
  const R = DANGER.rings;
  for (let i = 1; i < R.length; i++) if (d < R[i][0]) { const [a, va] = R[i - 1], [b, vb] = R[i]; return va + (vb - va) * smooth((d - a) / (b - a)); }
  return R[R.length - 1][1];
}
/** How far the ring edges are pushed in or out in the direction of (x, z) from Gridholm (a factor round 1). */
function wobble(world: number, x: number, z: number, d: number): number {
  const a = Math.atan2(z, wrapDx(x));
  let w = 0;
  for (let k = 1; k <= 4; k++) {
    const ph = (hash(world, k, 0xd4a6) % 6283) / 1000, drift = (hash(world, k, 0xd4a7) % 1000) / 1000 - 0.5;
    w += Math.sin(k * 2 * a + ph + d * drift / 6000) / k; // a twist with the distance, so the edges are no spokes
  }
  return 1 + DANGER.wobble * w / 1.6;
}

const cache = new Map<string, number>();
/** Danger at (x, z); `nearRuin` adds the ruin bonus. Cached on a 16 m grid. */
export function dangerAt(world: number, x: number, z: number, nearRuin = false): number {
  const k = world + ':' + Math.round(x / 16) + ':' + Math.round(z / 16);
  let base = cache.get(k);
  if (base === undefined) {
    const vs = allVillages(world), home = rectD(vs[0].rect, nearX(x, vs[0].x), z);
    const ring = ringDanger(home * (home > DANGER.safe ? 1 / wobble(world, x, z, home) : 1));
    // every village is a refuge: calm outside its walls, the ring's danger returning over the next few hundred metres
    const vf = villageFar(world, x, z);
    base = ring * smooth((vf - DANGER.safe) / DANGER.refuge);
    if (cache.size > 20000) cache.clear();
    cache.set(k, base);
  }
  return Math.min(DANGER.max, base + (nearRuin ? DANGER.ruin * Math.min(1, base) : 0));
}
