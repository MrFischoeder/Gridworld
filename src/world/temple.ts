// Draws the alien temple of a ruin (gen/ruins.ts TempleDeco): tapered, leaning masses with ragged tops, a stepped
// portal, two pylons and their ring, an avenue of obelisks, fallen pieces and rubble. Every solid has a dark fill
// and encloses the collision voxels under it, so their grid lines stay hidden inside.
import * as THREE from 'three';
import { GRID } from './render';
import { PropBatch } from './props';
import { rng, hash } from '../core/rng';
import { templeXZ, type TempleDeco, type Obelisk } from '../gen/ruins';

const STONE = GRID, GLYPH = 0x7dffc8;
type P = number[];

/**
 * The temple's shapes and, in `blocks`, the fallen pieces lying about that have no collision voxels (rubble, snapped
 * pylon tops, the broken block) as world circles [x, z, r]: vehicles bump into them (world/overworld.ts).
 */
/**
 * (0.222, the owner's report: you and the foes walked through the stones round a ruin) A temple piece for collision:
 * the convex outline of a solid seen from above (or a rubble stone's circle `c`) and the heights it spans. Leaning
 * pieces are taken whole (their outline holds both the foot and the top), a little generous but never hollow.
 */
export interface TempleSolid { hull: [number, number][]; c?: [number, number, number]; y0: number; y1: number; x0: number; x1: number; z0: number; z1: number }
/** The convex hull (from above) of a solid's corners, with its height span and box. */
function prism(pts: number[][]): TempleSolid {
  const q = pts.map((p) => [p[0], p[2]] as [number, number]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: [number, number], a: [number, number], b: [number, number]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: [number, number][] = [], hi: [number, number][] = [];
  for (const p of q) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = q.length - 1; i >= 0; i--) { const p = q[i]; while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
  const hull = [...lo.slice(0, -1), ...hi.slice(0, -1)], ys = pts.map((p) => p[1]), xs = hull.map((p) => p[0]), zs = hull.map((p) => p[1]);
  return { hull, y0: Math.min(...ys), y1: Math.max(...ys), x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
}
/** How far (x, z) lies outside the piece's outline from above (0 inside). */
export function solidDist(s: TempleSolid, x: number, z: number): number {
  if (s.c) return Math.max(0, Math.hypot(x - s.c[0], z - s.c[1]) - s.c[2]);
  const h = s.hull; let inside = true, best = Infinity;
  for (let i = 0; i < h.length; i++) {
    const a = h[i], b = h[(i + 1) % h.length], ex = b[0] - a[0], ez = b[1] - a[1];
    if (ex * (z - a[1]) - ez * (x - a[0]) < 0) inside = false; // the hull runs anticlockwise (x right, z up)
    const L = ex * ex + ez * ez || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * ex + (z - a[1]) * ez) / L));
    best = Math.min(best, Math.hypot(a[0] + ex * t - x, a[1] + ez * t - z));
  }
  return inside ? 0 : best;
}
/**
 * (0.241, the owner's report: too many cubes round the temples) A weathered wall stone over a 1 m collision column
 * of height h: an irregular 6–8-sided prism (every side at least 0.71 m from the middle, so the cube stays inside),
 * leaning a little, its broken top sloping and rising 0.15–0.6 m above the column, with a crack now and then.
 */
function wallStone(pb: PropBatch, x: number, y: number, z: number, h: number, seed: number) {
  const R = rng(seed), n = 6 + Math.floor(R() * 3), rot = R() * 6.283, lx = (R() - 0.5) * 0.18, lz = (R() - 0.5) * 0.18;
  const radius = Array.from({ length: n }, () => 0.84 + R() * 0.22), tilt = R() * 6.283, slope = 0.15 + R() * 0.35;
  const ang = Array.from({ length: n }, (_, i) => rot + (i + (R() - 0.5) * 0.35) / n * 6.283);
  const bot = ang.map((a, i) => [x + Math.cos(a) * radius[i], y - 0.15, z + Math.sin(a) * radius[i]]);
  const mid = ang.map((a, i) => [x + lx + Math.cos(a) * radius[i] * 0.97, y + h, z + lz + Math.sin(a) * radius[i] * 0.97]);
  const top = ang.map((a, i) => { const k = 0.62 + R() * 0.2; return [x + lx * 1.2 + Math.cos(a) * radius[i] * k, y + h + 0.15 + slope * (1 + Math.cos(a - tilt)) + R() * 0.12, z + lz * 1.2 + Math.sin(a) * radius[i] * k]; });
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    pb.face(bot[i], bot[j], mid[j], mid[i]); pb.face(mid[i], mid[j], top[j], top[i]);
    pb.seg(STONE, bot[i], mid[i]); pb.seg(STONE, mid[i], top[i]); pb.seg(STONE, top[i], top[j]);
    if (h > 1.5 && R() < 0.3) pb.seg(STONE, mid[i], mid[j]); // a course line on the taller ones
  }
  pb.face(...top);
  if (R() < 0.35) { const i = Math.floor(R() * n), j = (i + 1) % n, m = (k: number, t: number) => bot[k].map((v, q) => v + (mid[k][q] - v) * t); pb.line(STONE, m(i, 0.15), m(j, 0.55).map((v, q) => (q === 1 ? v : (v + m(i, 0.55)[q]) / 2)), m(j, 0.85)); }
}
export function drawTemple(t: TempleDeco, seed: number): { g: THREE.Group; blocks: [number, number, number][]; solids: TempleSolid[] } {
  const pb = new PropBatch(), f = t.frame, R = rng(seed ^ 0x7e3b1), blocks: [number, number, number][] = [], solids: TempleSolid[] = [];
  const block = (u: number, v: number, r: number) => { const [x, z] = templeXZ(f, u, v); blocks.push([x, z, r]); };
  const P = (u: number, v: number, h: number): P => { const [x, z] = templeXZ(f, u, v); return [x, f.y + h, z]; };
  /** A solid from a bottom and a top quad given in (u, v, h). */
  const solid = (b: [number, number, number][], tp: [number, number, number][]) => {
    const bb = b.map((q) => P(...q)), tt = tp.map((q) => P(...q));
    pb.solid8(bb, tt, STONE);
    solids.push(prism([...bb, ...tt])); // (0.222) every stone piece is solid to you and the foes, not only those over voxels
  };
  const crack = (pts: [number, number, number][]) => pb.line(STONE, ...pts.map((q) => P(...q)));

  // ---- the main body: two leaning side masses and the lintel over the portal, tops broken off unevenly
  const W = t.bodyW, H = t.bodyH, j = t.jag, back = 15.4;
  for (const s of [-1, 1]) {
    const o = s < 0 ? 0 : 3;
    solid([[-0.05, s * W, -0.3], [back, s * W, -0.3], [back, s * 1.56, -0.3], [-0.05, s * 1.56, -0.3]],
      [[2.1, s * (W - 3.3), H - j[o]], [back - 1.8, s * (W - 3.3), H - j[o + 1]], [back - 1.8, s * 1.56, H - j[o + 2]], [2.1, s * 1.56, H - j[o + 2] * 0.5]]);
    // weathering: cracks running down the front and the side
    crack([[0.3, s * (W - 0.9), 0.6], [0.75, s * (W - 2.1), 3.3], [1.2, s * (W - 1.6), 5.8], [1.6, s * (W - 2.8), 8.2]]);
    crack([[4.5, s * (W + 0.02), 0.3], [5.4, s * (W - 0.6), 2.7], [6.6, s * (W - 1.3), 4.6]]);
  }
  solid([[-0.05, -1.56, 3.05], [back, -1.56, 3.05], [back, 1.56, 3.05], [-0.05, 1.56, 3.05]],
    [[2.1, -1.56, H - j[2] * 0.5], [back - 1.8, -1.56, H - Math.max(j[2], j[5])], [back - 1.8, 1.56, H - Math.max(j[2], j[5])], [2.1, 1.56, H - j[5] * 0.5]]);
  // a glyph over the portal: a small ring with a line through it
  const gy = 5.4, gu = -0.1;
  for (let i = 0; i < 16; i++) { const a0 = i / 16 * 6.283, a1 = (i + 1) / 16 * 6.283; pb.seg(GLYPH, P(gu, Math.cos(a0) * 1, gy + Math.sin(a0) * 1), P(gu, Math.cos(a1) * 1, gy + Math.sin(a1) * 1)); }
  pb.seg(GLYPH, P(gu, 0, 3.4), P(gu, 0, 7.2));

  // ---- the stepped portal: frames getting bigger outwards, like a tunnel mouth (some of them fallen)
  for (let k = 1; k <= t.frames; k++) {
    const u = -0.75 * k, hw = 1.6 + 0.55 * k, hh = 3.2 + 1.0 * k, th = 0.35, top = hw - 0.35 * k;
    for (const s of [-1, 1]) solid([[u - th, s * hw, -0.2], [u, s * hw, -0.2], [u, s * (hw + th), -0.2], [u - th, s * (hw + th), -0.2]],
      [[u - th, s * top, hh], [u, s * top, hh], [u, s * (top + th), hh], [u - th, s * (top + th), hh]]);
    solid([[u - th, -top - th, hh], [u, -top - th, hh], [u, top + th, hh], [u - th, top + th, hh]],
      [[u - th, -top - th, hh + th], [u, -top - th, hh + th], [u, top + th, hh + th], [u - th, top + th, hh + th]]);
  }
  // pieces of the fallen frames in front
  for (let k = t.frames + 1; k <= 3; k++) {
    const u = -0.75 * k - 3 - R() * 4.5, v = (R() - 0.5) * 7, l = 3 + R() * 3, a = R() * 3;
    const dv = Math.cos(a) * l, du = Math.sin(a) * l;
    solid([[u, v, 0], [u + du, v + dv, 0], [u + du + 0.4, v + dv, 0], [u + 0.4, v, 0]], [[u, v, 0.35], [u + du, v + dv, 0.35], [u + du + 0.4, v + dv, 0.35], [u + 0.4, v, 0.35]]);
  }

  // ---- the two pylons flanking the portal, leaning in; snapped ones leave their top lying beside them
  t.pylons.forEach((p, i) => {
    const s = i ? 1 : -1, h = p.h, jj = p.snapped ? () => R() * 1.6 : () => 0;
    solid([[-2.2, s * 3.8, -0.3], [3.9, s * 3.8, -0.3], [3.9, s * 9, -0.3], [-2.2, s * 9, -0.3]],
      [[-0.9, s * 4.3, h - jj()], [2.1, s * 4.3, h - jj()], [2.1, s * 6.8, h - jj()], [-0.9, s * 6.8, h - jj()]]);
    // a groove down its face
    crack([[-2.22, s * 6.4, 0.6], [-1.3, s * 5.4, h * 0.6]]);
    if (!p.snapped) { const tip = P(0.6, s * 5.55, h + 3.6); const c = [P(-0.9, s * 4.3, h), P(2.1, s * 4.3, h), P(2.1, s * 6.8, h), P(-0.9, s * 6.8, h)]; for (let q = 0; q < 4; q++) { pb.seg(STONE, c[q], c[(q + 1) % 4]); pb.seg(STONE, c[q], tip); pb.face(c[q], c[(q + 1) % 4], tip); } }
    else { // the broken-off top, lying out to the side
      const l = 9 + R() * 9, v0 = s * (10 + R() * 3), u0 = -4.5 - R() * 6;
      solid([[u0, v0, 0], [u0 + 1.8, v0, 0], [u0 + 1.8 + l * 0.2, v0 + s * l, 0], [u0 + l * 0.2, v0 + s * l, 0]],
        [[u0 + 0.3, v0, 1.6], [u0 + 1.5, v0, 1.6], [u0 + 1.5 + l * 0.2, v0 + s * l, 0.9], [u0 + 0.3 + l * 0.2, v0 + s * l, 0.9]]);
      for (let q = 0; q <= l; q += 1.5) block(u0 + 0.9 + q * 0.2, v0 + s * q, 1.1);
    }
  });

  // ---- the great ring between the pylon tops (or where it fell)
  const ringAt = (cu: number, cv: number, ch: number, r: number, flat: boolean, from = 0, to = 24) => {
    for (let i = from; i < to; i++) {
      const a0 = i / 24 * 6.283, a1 = (i + 1) / 24 * 6.283, q = (a: number, rr: number, du: number): [number, number, number] =>
        flat ? [cu + Math.cos(a) * rr, cv + Math.sin(a) * rr, ch + du] : [cu + du, cv + Math.cos(a) * rr, ch + Math.sin(a) * rr];
      solid([q(a0, r, 0), q(a1, r, 0), q(a1, r - 0.65, 0), q(a0, r - 0.65, 0)], [q(a0, r, 0.6), q(a1, r, 0.6), q(a1, r - 0.65, 0.6), q(a0, r - 0.65, 0.6)]);
    }
  };
  const lowP = Math.min(...t.pylons.map((p) => p.h));
  if (t.ring === 'up') { ringAt(0.1, 0, lowP * 0.82, 3.4, false); pb.seg(GLYPH, P(0.3, 0, H - 1), P(0.3, 0, lowP * 0.82 + 3.8)); }
  else if (t.ring === 'fallen') { const cu = -9 - R() * 7, cv = (R() - 0.5) * 7; ringAt(cu, cv, -0.4, 3.4, true, 0, 17); } // half sunk, part of it broken away
  else for (let k = 0; k < 3; k++) ringAt(-6 - R() * 15, (R() - 0.5) * 20, -0.1, 3.4, true, (k * 7) % 24, (k * 7) % 24 + 3);

  // ---- obelisks along the avenue, and the pylons at the ends of the other arms
  const obelisk = (b: Obelisk) => {
    const w = b.w / 2, top = w * 0.35, stand = b.broken ? b.h * b.broken : b.h, jj = () => (b.broken ? R() * 0.9 : 0);
    const k = stand / b.h, tu = b.u + b.lu * k, tv = b.v + b.lv * k; // leaning a little, as the ground has settled
    solid([[b.u - w, b.v - w, -0.3], [b.u + w, b.v - w, -0.3], [b.u + w, b.v + w, -0.3], [b.u - w, b.v + w, -0.3]],
      [[tu - top - (b.broken ? w * 0.4 : 0), tv - top, stand - jj()], [tu + top, tv - top, stand - jj()], [tu + top, tv + top, stand - jj()], [tu - top, tv + top, stand - jj()]]);
    if (!b.broken) { // a little pyramid cap
      const c = [P(tu - top, tv - top, stand), P(tu + top, tv - top, stand), P(tu + top, tv + top, stand), P(tu - top, tv + top, stand)], tip = P(tu, tv, stand + top * 2.2);
      for (let q = 0; q < 4; q++) { pb.seg(STONE, c[q], tip); pb.face(c[q], c[(q + 1) % 4], tip); }
    } else { // its upper part lies where it fell
      const l = b.h * (1 - b.broken) * 0.9, du = Math.cos(b.fall), dv = Math.sin(b.fall), s = w * 0.7, u0 = b.u + du * (w + 0.4), v0 = b.v + dv * (w + 0.4);
      const nu = -dv * s, nv = du * s;
      solid([[u0 + nu, v0 + nv, 0], [u0 + du * l + nu * 0.5, v0 + dv * l + nv * 0.5, 0], [u0 + du * l - nu * 0.5, v0 + dv * l - nv * 0.5, 0], [u0 - nu, v0 - nv, 0]],
        [[u0 + nu, v0 + nv, s * 1.6], [u0 + du * l + nu * 0.5, v0 + dv * l + nv * 0.5, s * 0.8], [u0 + du * l - nu * 0.5, v0 + dv * l - nv * 0.5, s * 0.8], [u0 - nu, v0 - nv, s * 1.6]]);
    }
  };
  for (const b of t.obelisks) obelisk(b);
  for (const b of t.armPylons) obelisk(b);

  // ---- a block broken off the temple's top, lying by its side
  { const s = R() < 0.5 ? -1 : 1, u0 = 4.5 + R() * 6, v0 = s * (W + 2 + R() * 3), l = 3.8 + R() * 3;
    solid([[u0, v0, -0.2], [u0 + l, v0 + s * 0.9, -0.2], [u0 + l, v0 + s * 3.9, -0.2], [u0, v0 + s * 3.3, -0.2]], [[u0 + 0.4, v0, 2.1], [u0 + l - 0.3, v0 + s * 1, 2.8], [u0 + l - 0.6, v0 + s * 3.4, 1.8], [u0 + 0.3, v0 + s * 3, 1.5]]);
    for (let q = 0.8; q < l; q += 1.6) block(u0 + q, v0 + s * 2, 2); }

  // ---- (0.241) the broken walls: a weathered many-sided stone over each collision column (gen/ruins.ts `stones`)
  for (const st of t.stones) wallStone(pb, st.x + 0.5, f.y, st.z + 0.5, st.h, hash(seed, st.x, st.z, 0x570e));

  // ---- rubble
  for (const r of t.rubble) { const [x, z] = templeXZ(f, r.u, r.v); pb.rock(x, f.y - 0.1, z, r.r, r.h, 4 + (r.rot * 10 | 0) % 3, r.rot, STONE); if (r.h > 0.6) blocks.push([x, z, r.r * 0.9]); solids.push({ c: [x, z, r.r * 0.85], hull: [], y0: f.y - 0.1, y1: f.y - 0.1 + r.h, x0: x - r.r, x1: x + r.r, z0: z - r.r, z1: z + r.r }); }
  return { g: pb.build(), blocks, solids };
}
