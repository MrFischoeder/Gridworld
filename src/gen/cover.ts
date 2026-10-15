// (0.224, PLAN_WALKI.md stage W3: cover) Pure geometry for cover: how far along a ray it meets a tree trunk or a
// stone (an upright cylinder), a ruin's stone piece (an upright prism over a convex outline) or a crystal (a leaning
// cylinder, tested by the closest approach of the two lines); and the order in which a foe looks over the ground
// round it for a spot to hide (`coverSpots`). The world side (world/cover.ts) asks the game's own rays whether a
// spot really hides the foe from its threat and whether it can rise or lean out to shoot from it.

export interface V3 { x: number; y: number; z: number }

/** Where a ray (o + d·t, d of unit length) first enters an upright cylinder, or maxT when it misses before maxT. */
export function rayCyl(o: V3, d: V3, maxT: number, cx: number, cz: number, r: number, y0: number, y1: number): number {
  let t0 = 0, t1 = maxT;
  const px = o.x - cx, pz = o.z - cz, a = d.x * d.x + d.z * d.z, c = px * px + pz * pz - r * r;
  if (a < 1e-12) { if (c > 0) return maxT; }
  else {
    const b = px * d.x + pz * d.z, disc = b * b - a * c;
    if (disc < 0) return maxT;
    const s = Math.sqrt(disc);
    t0 = Math.max(t0, (-b - s) / a); t1 = Math.min(t1, (-b + s) / a);
    if (t0 > t1) return maxT;
  }
  return slab(o.y, d.y, y0, y1, t0, t1, maxT);
}
/** Clip [t0, t1] by y0 ≤ y ≤ y1 and give its start (maxT when empty). */
function slab(oy: number, dy: number, y0: number, y1: number, t0: number, t1: number, maxT: number): number {
  if (Math.abs(dy) < 1e-9) { if (oy < y0 || oy > y1) return maxT; }
  else {
    let a = (y0 - oy) / dy, b = (y1 - oy) / dy; if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, b);
  }
  return t0 <= t1 ? t0 : maxT;
}
/** Where a ray first enters an upright prism over a convex outline `hull` (anticlockwise, x right, z up). */
export function rayHull(o: V3, d: V3, maxT: number, hull: [number, number][], y0: number, y1: number): number {
  let t0 = 0, t1 = maxT;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i], b = hull[(i + 1) % hull.length], ex = b[0] - a[0], ez = b[1] - a[1];
    const f0 = ex * (o.z - a[1]) - ez * (o.x - a[0]), den = ex * d.z - ez * d.x; // inside: f ≥ 0
    if (Math.abs(den) < 1e-12) { if (f0 < 0) return maxT; continue; }
    const t = -f0 / den;
    if (den > 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t);
    if (t0 > t1) return maxT;
  }
  return slab(o.y, d.y, y0, y1, t0, t1, maxT);
}
/**
 * A leaning cylinder from `p` along the unit `a` for `len`, radius `w`: where the ray comes within `w` of its axis
 * (at the closest approach of the two lines, a little before it), or maxT.
 */
export function rayRod(o: V3, d: V3, maxT: number, p: V3, a: V3, len: number, w: number): number {
  const rx = o.x - p.x, ry = o.y - p.y, rz = o.z - p.z;
  const b = d.x * a.x + d.y * a.y + d.z * a.z, dd = d.x * rx + d.y * ry + d.z * rz, ee = a.x * rx + a.y * ry + a.z * rz;
  const den = 1 - b * b;
  let t = den > 1e-9 ? (b * ee - dd) / den : 0;
  t = Math.max(0, Math.min(maxT, t));
  let s = Math.max(0, Math.min(len, ee + b * t));
  t = Math.max(0, Math.min(maxT, b * s - dd)); s = Math.max(0, Math.min(len, ee + b * t));
  const gx = rx + d.x * t - a.x * s, gy = ry + d.y * t - a.y * s, gz = rz + d.z * t - a.z * s, g = Math.hypot(gx, gy, gz);
  if (g >= w) return maxT;
  return Math.max(0, t - Math.sqrt(w * w - g * g));
}

export const COVER = {
  /** The rings searched round the foe (m) and the spots on each. */
  rings: [3, 5.5, 8, 11] as number[], per: 10,
  /** A spot is no use nearer the threat than this, or further than the foe's own `keep` range allows. */
  near: 7,
  /** The hidden check: from the spot at `low` m above the ground, cover must stand within `within` m towards the threat. */
  low: 0.85, within: 3.5,
  /** Rising: the eye above the ground when standing; leaning out: this far to a side. */
  stand: 1.55, lean: 1.2,
  /** Hiding and shooting spells (s), and how often the spot is weighed again. */
  hide: [1.8, 3] as [number, number], peek: [1.4, 2.2] as [number, number], recheck: 3,
  /** Crouched behind cover the body sinks this much. */
  duck: 0.5,
};
/**
 * The spots a foe at (x, z) looks over for cover from a threat at (tx, tz), best first: on rings round it, on the
 * side away from the threat before the side towards it, nearer ones first, none nearer the threat than `COVER.near`
 * or further from it than `far`. `[x, z, score]`; the lowest score first.
 */
export function coverSpots(x: number, z: number, tx: number, tz: number, far: number): [number, number, number][] {
  const out: [number, number, number][] = [], ax = Math.atan2(tz - z, tx - x);
  for (const r of COVER.rings) for (let i = 0; i < COVER.per; i++) {
    const a = ax + (i / COVER.per) * Math.PI * 2 + (r % 2) * 0.3, sx = x + Math.cos(a) * r, sz = z + Math.sin(a) * r;
    const dt = Math.hypot(tx - sx, tz - sz);
    if (dt < COVER.near || dt > far) continue;
    out.push([sx, sz, r + Math.max(0, Math.cos(a - ax)) * 3]); // running towards the threat costs more
  }
  return out.sort((p, q) => p[2] - q[2]);
}
