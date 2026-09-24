// Mountain trails: every peak (the highest point of a massif in its region, gen/mountains.ts) gets a named summit and
// a trail up to it from the nearest foot of the mountain. The trail climbs like a walker would: it heads for the top
// while the ground allows, and turns across the slope (switchbacks) where it is too steep. Its height profile is the
// ground along it, smoothed and held to a walkable grade; the terrain cuts a bench for it like it flattens roads.
// A trail is a Road (gen/roads.ts) with `gate: 'trail'` and the profile in `h`, so trees, rocks, plants and claims
// keep off it on their own. Pure and deterministic, per region, cached.
import { rng, hash } from '../core/rng';
import { REGION, wrapR, ruinName } from './regions';
import { mountainMask } from './mountains';
import { lakesIn } from './water';
import type { Road } from './roads';
import type { Terrain } from './terrain';

export interface Summit { id: number; name: string; x: number; z: number; y: number }
/** The steepest a trail may climb (rise per metre), and how wide it is. */
export const TRAIL = { grade: 0.36, half: 2.2, step: 8 }; // at least two terrain lattice points (2 m) across the bench
/** Peaks lower than this get no trail (the foothills); a peak needs no higher one within PROMINENCE (m). */
const MIN_PEAK = 70, PROMINENCE = 450;
/** A trail that would need a cut or a bank deeper than this is not made (the mountain is too wild there). */
const MAX_CUT = 9;
/** Legs of the trail never come closer than this to its earlier stretches (m). */
const LEG_GAP = 14;

const summitCache = new Map<string, Summit | null>(), trailCache = new Map<string, Road[]>();
/** The summit of region (rx, rz) (canonical), if its highest point is a real peak inside it. */
export function regionSummit(t: Terrain, rx: number, rz: number): Summit | null {
  const c = wrapR(rx);
  if (c !== rx) { const s = regionSummit(t, c, rz); return s && { ...s, x: s.x + (rx - c) * REGION }; }
  const key = t.world + ':' + rx + ':' + rz;
  if (summitCache.has(key)) return summitCache.get(key)!;
  if (summitCache.size > 4096) summitCache.clear();
  let out: Summit | null = null;
  const cx = rx * REGION, cz = rz * REGION, H = REGION / 2;
  const m = Math.max(...[[0, 0], [-80, -80], [80, -80], [-80, 80], [80, 80]].map(([a, b]) => mountainMask(t.world, cx + a, cz + b)));
  if (m > 0.3) {
    let bx = cx, bz = cz, bh = -Infinity;
    for (let i = -H; i <= H; i += 16) for (let j = -H; j <= H; j += 16) { const h = t.base(cx + i, cz + j); if (h > bh) { bh = h; bx = cx + i; bz = cz + j; } }
    // climb to the very top
    for (let s = 0; s < 40; s++) {
      let moved = false;
      for (const [a, b] of [[4, 0], [-4, 0], [0, 4], [0, -4], [3, 3], [-3, 3], [3, -3], [-3, -3]]) { const h = t.base(bx + a, bz + b); if (h > bh + 0.01) { bh = h; bx += a; bz += b; moved = true; } }
      if (!moved) break;
    }
    // each peak belongs to the region it stands in (neighbours climbing to the same top drop it)
    if (bh >= MIN_PEAK && Math.abs(bx - cx) < H && Math.abs(bz - cz) < H) {
      const R = rng(hash(t.world, rx, rz, 0x5a11));
      out = { id: hash(t.world, rx, rz, 0x5a12), name: 'Mount ' + ruinName(R), x: bx, z: bz, y: bh };
    }
  }
  summitCache.set(key, out);
  return out;
}

/** The trail up the summit of region (rx, rz), as a road with a height profile (none when no way up was found). */
export function regionTrails(t: Terrain, rx: number, rz: number): Road[] {
  const c = wrapR(rx);
  if (c !== rx) return regionTrails(t, c, rz).map((r) => ({ ...r, id: r.id + '@' + rx, pts: r.pts.map(([x, z]) => [x + (rx - c) * REGION, z] as [number, number]) }));
  const key = t.world + ':' + rx + ':' + rz;
  let out = trailCache.get(key);
  if (out) return out;
  if (trailCache.size > 2048) trailCache.clear();
  out = [];
  const s = regionSummit(t, rx, rz);
  // only the true tops get a trail: no higher summit within PROMINENCE metres
  let top = !!s;
  for (let i = -2; i <= 2 && top; i++) for (let j = -2; j <= 2 && top; j++) {
    if (!i && !j) continue;
    const o = regionSummit(t, rx + i, rz + j);
    if (o && s && Math.hypot(o.x - s.x, o.z - s.z) < PROMINENCE && (o.y > s.y || (o.y === s.y && o.id > s.id))) top = false;
  }
  if (s && top) { const r = climb(t, s); if (r) out.push(r); }
  trailCache.set(key, out);
  return out;
}

/** Where the trail starts: the nearest foot of the mountain from the summit, on dry ground. */
function trailhead(t: Terrain, s: Summit): [number, number] | null {
  let best: [number, number] | null = null, bd = Infinity;
  for (let k = 0; k < 16; k++) {
    const a = k / 16 * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
    for (let d = 40; d < Math.min(bd, 1100); d += 12) {
      const x = s.x + dx * d, z = s.z + dz * d;
      if (mountainMask(t.world, x, z) > 0.06 || t.base(x, z) > 36) continue;
      if (lakesIn(t, { x0: x - 30, z0: z - 30, x1: x + 30, z1: z + 30 }).length) break;
      if (d < bd) { bd = d; best = [x, z]; }
      break;
    }
  }
  return best;
}
/** Walk up from the trailhead to the summit, then smooth the heights into a walkable profile. */
function climb(t: Terrain, s: Summit): Road | null {
  const start = trailhead(t, s);
  if (!start) return null;
  const st = TRAIL.step, pts: [number, number][] = [start];
  let [x, z] = start, prev = Math.atan2(s.z - z, s.x - x);
  for (let n = 0; n < 320; n++) {
    const toTop = Math.hypot(s.x - x, s.z - z);
    if (toTop < st * 1.5) { pts.push([s.x, s.z]); break; }
    const aim = Math.atan2(s.z - z, s.x - x), h0 = t.base(x, z);
    let bestA = aim, bestScore = Infinity;
    for (let k = -7; k <= 7; k++) {
      const a = aim + k * Math.PI / 14, nx = x + Math.cos(a) * st, nz = z + Math.sin(a) * st, g = (t.base(nx, nz) - h0) / st;
      const turn = Math.abs(((a - prev + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      // keep the legs of a switchback apart, so each has its own bench in the slope
      if (pts.slice(0, -2).some(([px, pz]) => Math.hypot(px - nx, pz - nz) < LEG_GAP)) continue;
      // climb at an easy grade, towards the top, without zig-zagging at every step; never down, never too steep
      const score = Math.abs(g - TRAIL.grade * 0.7) * 6 + Math.abs(k) * 0.08 + turn * 0.9 + (g > TRAIL.grade * 1.2 ? 20 : 0) + (g < -0.05 ? 4 : 0);
      if (score < bestScore) { bestScore = score; bestA = a; }
    }
    x += Math.cos(bestA) * st; z += Math.sin(bestA) * st; prev = bestA;
    pts.push([x, z]);
  }
  const last = pts[pts.length - 1];
  if (last[0] !== s.x || last[1] !== s.z) return null; // it never made it up
  // the profile: the ground along the way, smoothed, never steeper than the grade, and the top at the summit
  let h = pts.map(([px, pz]) => t.base(px, pz));
  h = h.map((_, i) => { let a = 0, n = 0; for (let j = Math.max(0, i - 2); j <= Math.min(h.length - 1, i + 2); j++) { a += h[j]; n++; } return a / n; });
  h[h.length - 1] = s.y;
  const seg = (i: number) => Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  const clamp = (v: number, ref: number, d: number) => Math.max(ref - TRAIL.grade * d, Math.min(ref + TRAIL.grade * d, v));
  for (let i = h.length - 2; i >= 0; i--) h[i] = clamp(h[i], h[i + 1], seg(i + 1)); // down from the top...
  for (let i = 1; i < h.length; i++) h[i] = clamp(h[i], h[i - 1], seg(i)); // ...and up from the foot: every step within the grade
  if (h.some((v, i) => Math.abs(v - t.base(pts[i][0], pts[i][1])) > MAX_CUT)) return null;
  return { id: 'trail:' + s.id, from: s.id, to: s.id, gate: 'trail', pts, half: TRAIL.half, h, name: s.name };
}
/** Height of a trail's profile at the point of it nearest to (x, z): [distance, height]. */
export function trailHeight(r: Road, x: number, z: number): [number, number] {
  let bd = Infinity, bh = 0;
  for (let i = 0; i + 1 < r.pts.length; i++) {
    const [ax, az] = r.pts[i], [bx, bz] = r.pts[i + 1], dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz;
    const u = L ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L)) : 0, d = Math.hypot(x - ax - dx * u, z - az - dz * u);
    if (d < bd) { bd = d; bh = r.h![i] + (r.h![i + 1] - r.h![i]) * u; }
  }
  return [bd, bh];
}
