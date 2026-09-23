// Draws the alien temple of a ruin (gen/ruins.ts TempleDeco): tapered, leaning masses with ragged tops, a stepped
// portal, two pylons and their ring, an avenue of obelisks, fallen pieces and rubble. Every solid has a dark fill
// and encloses the collision voxels under it, so their grid lines stay hidden inside.
import * as THREE from 'three';
import { GRID } from './render';
import { PropBatch } from './props';
import { rng } from '../core/rng';
import { templeXZ, type TempleDeco, type Obelisk } from '../gen/ruins';

const STONE = GRID, GLYPH = 0x7dffc8;
type P = number[];

export function drawTemple(t: TempleDeco, seed: number): THREE.Group {
  const pb = new PropBatch(), f = t.frame, R = rng(seed ^ 0x7e3b1);
  const P = (u: number, v: number, h: number): P => { const [x, z] = templeXZ(f, u, v); return [x, f.y + h, z]; };
  /** A solid from a bottom and a top quad given in (u, v, h). */
  const solid = (b: [number, number, number][], tp: [number, number, number][]) => pb.solid8(b.map((q) => P(...q)), tp.map((q) => P(...q)), STONE);
  const crack = (pts: [number, number, number][]) => pb.line(STONE, ...pts.map((q) => P(...q)));

  // ---- the main body: two leaning side masses and the lintel over the portal, tops broken off unevenly
  const W = t.bodyW, H = t.bodyH, j = t.jag, back = 10.3;
  for (const s of [-1, 1]) {
    const o = s < 0 ? 0 : 3;
    solid([[-0.05, s * W, -0.3], [back, s * W, -0.3], [back, s * 1.56, -0.3], [-0.05, s * 1.56, -0.3]],
      [[1.4, s * (W - 2.2), H - j[o]], [back - 1.2, s * (W - 2.2), H - j[o + 1]], [back - 1.2, s * 1.56, H - j[o + 2]], [1.4, s * 1.56, H - j[o + 2] * 0.5]]);
    // weathering: cracks running down the front and the side
    crack([[-0.02 + 0.3, s * (W - 0.6), 0.4], [0.5, s * (W - 1.4), 2.2], [0.8, s * (W - 1.1), 3.9], [1.1, s * (W - 1.9), 5.5]]);
    crack([[3, s * (W + 0.02), 0.2], [3.6, s * (W - 0.4), 1.8], [4.4, s * (W - 0.9), 3.1]]);
  }
  solid([[-0.05, -1.56, 3.05], [back, -1.56, 3.05], [back, 1.56, 3.05], [-0.05, 1.56, 3.05]],
    [[1.4, -1.56, H - j[2] * 0.5], [back - 1.2, -1.56, H - Math.max(j[2], j[5])], [back - 1.2, 1.56, H - Math.max(j[2], j[5])], [1.4, 1.56, H - j[5] * 0.5]]);
  // a glyph over the portal: a small ring with a line through it
  const gy = 4.6, gu = -0.1;
  for (let i = 0; i < 16; i++) { const a0 = i / 16 * 6.283, a1 = (i + 1) / 16 * 6.283; pb.seg(GLYPH, P(gu, Math.cos(a0) * 0.7, gy + Math.sin(a0) * 0.7), P(gu, Math.cos(a1) * 0.7, gy + Math.sin(a1) * 0.7)); }
  pb.seg(GLYPH, P(gu, 0, 3.4), P(gu, 0, 6));

  // ---- the stepped portal: frames getting bigger outwards, like a tunnel mouth (some of them fallen)
  for (let k = 1; k <= t.frames; k++) {
    const u = -0.75 * k, hw = 1.6 + 0.55 * k, hh = 3.2 + 0.75 * k, th = 0.35, top = hw - 0.35 * k;
    for (const s of [-1, 1]) solid([[u - th, s * hw, -0.2], [u, s * hw, -0.2], [u, s * (hw + th), -0.2], [u - th, s * (hw + th), -0.2]],
      [[u - th, s * top, hh], [u, s * top, hh], [u, s * (top + th), hh], [u - th, s * (top + th), hh]]);
    solid([[u - th, -top - th, hh], [u, -top - th, hh], [u, top + th, hh], [u - th, top + th, hh]],
      [[u - th, -top - th, hh + th], [u, -top - th, hh + th], [u, top + th, hh + th], [u - th, top + th, hh + th]]);
  }
  // pieces of the fallen frames in front
  for (let k = t.frames + 1; k <= 3; k++) {
    const u = -0.75 * k - 2 - R() * 3, v = (R() - 0.5) * 6, l = 2 + R() * 2, a = R() * 3;
    const dv = Math.cos(a) * l, du = Math.sin(a) * l;
    solid([[u, v, 0], [u + du, v + dv, 0], [u + du + 0.4, v + dv, 0], [u + 0.4, v, 0]], [[u, v, 0.35], [u + du, v + dv, 0.35], [u + du + 0.4, v + dv, 0.35], [u + 0.4, v, 0.35]]);
  }

  // ---- the two pylons flanking the portal, leaning in; snapped ones leave their top lying beside them
  t.pylons.forEach((p, i) => {
    const s = i ? 1 : -1, h = p.h, jj = p.snapped ? () => R() * 1.6 : () => 0;
    solid([[-1.8, s * 1.9, -0.3], [2.6, s * 1.9, -0.3], [2.6, s * 5.6, -0.3], [-1.8, s * 5.6, -0.3]],
      [[-0.6, s * 1.7, h - jj()], [1.4, s * 1.7, h - jj()], [1.4, s * 3.3, h - jj()], [-0.6, s * 3.3, h - jj()]]);
    // a groove down its face
    crack([[-1.2, s * 3.6, 0.5], [-0.5, s * 2.6, h * 0.6]]);
    if (!p.snapped) { const tip = P(0.4, s * 2.5, h + 2.4); const c = [P(-0.6, s * 1.7, h), P(1.4, s * 1.7, h), P(1.4, s * 3.3, h), P(-0.6, s * 3.3, h)]; for (let q = 0; q < 4; q++) { pb.seg(STONE, c[q], c[(q + 1) % 4]); pb.seg(STONE, c[q], tip); pb.face(c[q], c[(q + 1) % 4], tip); } }
    else { // the broken-off top, lying out to the side
      const l = 6 + R() * 6, v0 = s * (6.5 + R() * 2), u0 = -3 - R() * 4;
      solid([[u0, v0, 0], [u0 + 1.2, v0, 0], [u0 + 1.2 + l * 0.2, v0 + s * l, 0], [u0 + l * 0.2, v0 + s * l, 0]],
        [[u0 + 0.2, v0, 1.1], [u0 + 1.0, v0, 1.1], [u0 + 1.0 + l * 0.2, v0 + s * l, 0.6], [u0 + 0.2 + l * 0.2, v0 + s * l, 0.6]]);
    }
  });

  // ---- the great ring between the pylon tops (or where it fell)
  const ringAt = (cu: number, cv: number, ch: number, r: number, flat: boolean, from = 0, to = 24) => {
    for (let i = from; i < to; i++) {
      const a0 = i / 24 * 6.283, a1 = (i + 1) / 24 * 6.283, q = (a: number, rr: number, du: number): [number, number, number] =>
        flat ? [cu + Math.cos(a) * rr, cv + Math.sin(a) * rr, ch + du] : [cu + du, cv + Math.cos(a) * rr, ch + Math.sin(a) * rr];
      solid([q(a0, r, 0), q(a1, r, 0), q(a1, r - 0.45, 0), q(a0, r - 0.45, 0)], [q(a0, r, 0.4), q(a1, r, 0.4), q(a1, r - 0.45, 0.4), q(a0, r - 0.45, 0.4)]);
    }
  };
  const lowP = Math.min(...t.pylons.map((p) => p.h));
  if (t.ring === 'up') { ringAt(0.1, 0, lowP * 0.82, 2.3, false); pb.seg(GLYPH, P(0.3, 0, H - 1), P(0.3, 0, lowP * 0.82 + 2.6)); }
  else if (t.ring === 'fallen') { const cu = -6 - R() * 5, cv = (R() - 0.5) * 5; ringAt(cu, cv, -0.3, 2.3, true, 0, 17); } // half sunk, part of it broken away
  else for (let k = 0; k < 3; k++) ringAt(-4 - R() * 10, (R() - 0.5) * 14, -0.1, 2.3, true, (k * 7) % 24, (k * 7) % 24 + 3);

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
  { const s = R() < 0.5 ? -1 : 1, u0 = 3 + R() * 4, v0 = s * (W + 1.5 + R() * 2), l = 2.5 + R() * 2;
    solid([[u0, v0, -0.2], [u0 + l, v0 + s * 0.6, -0.2], [u0 + l, v0 + s * 2.6, -0.2], [u0, v0 + s * 2.2, -0.2]], [[u0 + 0.3, v0, 1.4], [u0 + l - 0.2, v0 + s * 0.7, 1.9], [u0 + l - 0.4, v0 + s * 2.3, 1.2], [u0 + 0.2, v0 + s * 2, 1.0]]); }

  // ---- rubble
  for (const r of t.rubble) { const [x, z] = templeXZ(f, r.u, r.v); pb.rock(x, f.y - 0.1, z, r.r, r.h, 4 + (r.rot * 10 | 0) % 3, r.rot, STONE); }
  return pb.build();
}
