// (0.275, the owner's request) The stepped pyramids drawn (gen/pyramids.ts has the plan, gen/megaliths.ts the
// stones it collides with): terraces of worked stone with course lines and carved panels (or sloping and upright
// panels with the old script on them), stairs of single steps between heavy balustrades, feathered serpents' heads
// at the stairs' feet with the serpent's body running up the balustrade, and the shrine on the top: thick walls, a
// lintel carved with glyphs over a door lit faintly from within, merlons, a stepped roof or a pierced roof comb, and
// inside a stair going down into the dark (the way into the pyramid: world/interact.ts). Braziers burn at the top's
// corners. Everything in the site's frame, scaled like the stones.
import type { PropBatch } from './props';
import { MEGALITH_XZ_SCALE as XS, MEGALITH_Y_SCALE as YS, pyramidOfDesign, type Megalith } from '../gen/megaliths';
import { faceAxes, facePoint, tierTop, PYR, type PyramidPlan, type PyrTier, type PyrStair, type PyrShrine } from '../gen/pyramids';
import { alienGlyph } from '../gen/glyphs';
import { hash } from '../core/rng';

const STONE = 0xb8b48a, COURSE = 0x6f7a58, CARVE = 0x8fae7a, GLYPH = 0xd1c597, GLOW = 0xc8ff6a, FIRE = 0xffb347, SERPENT = 0x7dffc8;
const S = (x: number, y: number, z: number) => [x * XS, y * YS, z * XS];
const loop = (hx: number, hz: number, y: number) => [S(-hx, y, -hz), S(hx, y, -hz), S(hx, y, hz), S(-hx, y, hz)];
const boxS = (pb: PropBatch, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: number) => pb.box(x0 * XS, y0 * YS, z0 * XS, x1 * XS, y1 * YS, z1 * XS, c);
/** Does a stair cover this stretch of a face (`a` across, ± half)? */
const underStair = (p: PyramidPlan, face: number, a: number, half: number) => p.stairs.some((s) => s.face === face && Math.abs(a - s.off) < s.w / 2 + half + 1);
/** A glyph of the old script on a face, `u` out from the middle, centred at (a, y), `size` across. */
function glyph(pb: PropBatch, face: number, u: number, a: number, y: number, size: number, seed: number, c = GLYPH) {
  for (const st of alienGlyph(seed)) pb.line(c, ...st.map(([gx, gy]) => S(...facePoint(face, u, a + gx * size * 0.5, y + gy * size * 0.5))));
}
/** A point on a terrace's sloping face: `f` of the way up it, `a` across. */
const onTier = (t: PyrTier, face: number, a: number, f: number, out = 0.06) => S(...facePoint(face, (face % 2 === 0 ? t.hz : t.hx) - t.bat * f + out, a, t.y + t.h * f));

function terrace(pb: PropBatch, p: PyramidPlan, t: PyrTier, i: number, seed: number) {
  if (p.panels === 'talud') { // a sloping skirt, then an upright panel standing out over it
    const ty = t.y + t.h * 0.42, tin = t.bat * 1.6, [tx, tz] = tierTop(p, t);
    pb.solid8(loop(t.hx, t.hz, t.y), loop(t.hx - tin, t.hz - tin, ty), STONE);
    pb.solid8(loop(tx, tz, ty), loop(tx, tz, t.y + t.h), STONE);
    for (let face = 0; face < 4; face++) { // a sunken frame along the upright, glyphs in it
      const u = (face % 2 === 0 ? tz : tx) + 0.06, half = face % 2 === 0 ? tx : tz, y0 = ty + t.h * 0.1, y1 = t.y + t.h * 0.9;
      pb.line(CARVE, S(...facePoint(face, u, -half + 1.5, y0)), S(...facePoint(face, u, half - 1.5, y0)), S(...facePoint(face, u, half - 1.5, y1)), S(...facePoint(face, u, -half + 1.5, y1)), S(...facePoint(face, u, -half + 1.5, y0)));
      const size = Math.min(7, (y1 - y0) * 0.75), n = Math.floor((2 * half - 4) / (size * 1.6));
      for (let k = 0; k < n; k++) {
        const a = -half + 2 + (k + 0.5) * (2 * half - 4) / n;
        if (!underStair(p, face, a, size / 2)) glyph(pb, face, u + 0.03, a, (y0 + y1) / 2, size, hash(seed, i, face, k));
      }
    }
    return;
  }
  pb.solid8(loop(t.hx, t.hz, t.y), loop(t.hx - t.bat, t.hz - t.bat, t.y + t.h), STONE);
  for (const f of [1 / 3, 2 / 3]) { // courses of masonry round the terrace, joints staggered between them
    const hx = t.hx - t.bat * f + 0.05, hz = t.hz - t.bat * f + 0.05, y = t.y + t.h * f;
    pb.line(COURSE, S(-hx, y, -hz), S(hx, y, -hz), S(hx, y, hz), S(-hx, y, hz), S(-hx, y, -hz));
  }
  for (let face = 0; face < 4; face++) {
    const half = face % 2 === 0 ? t.hx : t.hz;
    for (let band = 0; band < 3; band++) for (let a = -half + 3 + (band % 2) * 4; a < half - 2; a += 8) {
      if (underStair(p, face, a, 0)) continue;
      pb.seg(COURSE, onTier(t, face, a, band / 3 + 0.02), onTier(t, face, a, (band + 1) / 3 - 0.02));
    }
    if (p.panels !== 'framed') continue;
    // El Castillo's panels: sunken rectangles along each terrace, a glyph in every other one
    const pw = 14, n = Math.max(1, Math.floor((2 * half - 4) / pw));
    for (let k = 0; k < n; k++) {
      const a0 = -half + 2 + k * (2 * half - 4) / n + 1, a1 = -half + 2 + (k + 1) * (2 * half - 4) / n - 1;
      if (underStair(p, face, (a0 + a1) / 2, (a1 - a0) / 2)) continue;
      pb.line(CARVE, onTier(t, face, a0, 0.25, 0.1), onTier(t, face, a1, 0.25, 0.1), onTier(t, face, a1, 0.78, 0.1), onTier(t, face, a0, 0.78, 0.1), onTier(t, face, a0, 0.25, 0.1));
      if ((k + i) % 2 === 0) for (const st of alienGlyph(hash(seed, i, face, k))) {
        const sz = Math.min(a1 - a0, t.h * 0.5) * 0.4;
        pb.line(GLYPH, ...st.map(([gx, gy]) => onTier(t, face, (a0 + a1) / 2 + gx * sz, 0.515 + gy * sz / t.h, 0.14)));
      }
    }
  }
}

function stair(pb: PropBatch, p: PyramidPlan, s: PyrStair) {
  const [n, a] = faceAxes(s.face), L = s.u0 - s.u1, N = Math.max(8, Math.round(s.top / PYR.step));
  const P = (u: number, lat: number, y: number) => S(n[0] * u + a[0] * (s.off + lat), y, n[1] * u + a[1] * (s.off + lat));
  const half = s.w / 2, inner = half - PYR.rail, rh = PYR.railH;
  for (let k = 0; k < N; k++) { // a riser and a tread a step, the nose of each lit along its edge
    const u = s.u0 - L * k / N, u1 = s.u0 - L * (k + 1) / N, y = s.top * k / N, y1 = s.top * (k + 1) / N;
    pb.face(P(u, -inner, y), P(u, inner, y), P(u, inner, y1), P(u, -inner, y1));
    pb.face(P(u, -inner, y1), P(u, inner, y1), P(u1, inner, y1), P(u1, -inner, y1));
    pb.seg(STONE, P(u, -inner, y1), P(u, inner, y1));
  }
  for (const side of [-1, 1]) { // the balustrades: wedges from the ground up to the head of the stair
    const li = side * inner, lo = side * half;
    pb.solid8([P(s.u0, li, 0), P(s.u0, lo, 0), P(s.u0, lo, rh), P(s.u0, li, rh)], [P(s.u1, li, 0), P(s.u1, lo, 0), P(s.u1, lo, s.top + rh), P(s.u1, li, s.top + rh)], STONE);
    if (!p.serpents) continue;
    // the feathered serpent: its body a band of scales up the balustrade, its head at the foot, jaws open
    const mid = side * (half - PYR.rail / 2), Z = 16;
    for (let k = 0; k < Z; k++) {
      const f0 = k / Z, f1 = (k + 1) / Z, u0 = s.u0 - L * f0, u1 = s.u0 - L * f1, y0 = rh + s.top * f0 + 0.08, y1 = rh + s.top * f1 + 0.08;
      pb.line(SERPENT, P(u0, mid, y0), P((u0 + u1) / 2, mid - PYR.rail * 0.45, (y0 + y1) / 2), P(u1, mid, y1), P((u0 + u1) / 2, mid + PYR.rail * 0.45, (y0 + y1) / 2), P(u0, mid, y0));
    }
    const hb = PYR.rail * 1.1, hf = PYR.rail * 0.9, u0 = s.u0 - 0.5, u1 = s.u0 + 5.5, top = rh * 2.6;
    pb.solid8([P(u0, mid - hb, 0), P(u0, mid + hb, 0), P(u0, mid + hb, top), P(u0, mid - hb, top)], [P(u1, mid - hf, 0), P(u1, mid + hf, 0), P(u1, mid + hf, top * 0.62), P(u1, mid - hf, top * 0.62)], STONE);
    pb.line(SERPENT, P(u1 + 0.02, mid - hf, top * 0.3), P(u1 - 1.5, mid - hf * 0.2, top * 0.38), P(u1 + 0.02, mid + hf, top * 0.3)); // the open jaws
    for (const f of [-0.55, 0.55]) pb.seg(GLYPH, P(u1 + 0.03, mid + f * hf, top * 0.55), P(u1 + 0.03, mid + f * hf, top * 0.34)); // fangs
    for (const f of [-1, 1]) { // eyes on the sides of the head
      const ex = mid + f * (hb + 0.05), ring: number[][] = [];
      for (let k = 0; k <= 8; k++) { const q = k / 8 * Math.PI * 2; ring.push(P(u0 + 3 + Math.cos(q) * 0.8, ex, top * 0.72 + Math.sin(q) * 0.6)); }
      pb.line(GLOW, ...ring);
    }
    for (let k = 0; k < 6; k++) { // the crest of plumes fanning back over the head
      const q = (k / 5 - 0.5) * 1.6;
      pb.seg(SERPENT, P(u0 + 1, mid + Math.sin(q) * hb, top), P(u0 - 2.5 - Math.cos(q) * 1.5, mid + Math.sin(q) * hb * 1.8, top + 2.2 + Math.cos(q)));
    }
  }
}

function shrine(pb: PropBatch, q: PyrShrine, i: number, seed: number) {
  const t = PYR.wall, x0 = q.x - q.hx, x1 = q.x + q.hx, z0 = q.z - q.hz, z1 = q.z + q.hz, y = q.y, top = y + q.h, d = q.door / 2;
  boxS(pb, x0, y, z0, x1, top, z0 + t, STONE); // back wall
  boxS(pb, x0, y, z0 + t, x0 + t, top, z1 - t, STONE); boxS(pb, x1 - t, y, z0 + t, x1, top, z1 - t, STONE); // sides
  boxS(pb, x0, y, z1 - t, q.x - d, top, z1, STONE); boxS(pb, q.x + d, y, z1 - t, x1, top, z1, STONE); // front either side of the door
  boxS(pb, q.x - d, y + q.doorH, z1 - t, q.x + d, top, z1, STONE); // the lintel
  boxS(pb, x0 - 1, top, z0 - 1, x1 + 1, top + PYR.roof, z1 + 1, GLYPH); // the roof slab
  // the door: a frame lit faintly from inside, glyphs carved across the lintel
  pb.line(GLOW, S(q.x - d, y + 0.1, z1 + 0.05), S(q.x - d, y + q.doorH, z1 + 0.05), S(q.x + d, y + q.doorH, z1 + 0.05), S(q.x + d, y + 0.1, z1 + 0.05));
  for (let k = -1; k <= 1; k++) glyph(pb, 0, z1 + 0.05, q.x + k * (q.hx * 0.55), y + q.doorH + (q.h - q.doorH) / 2, Math.min(5, q.h - q.doorH - 1), hash(seed, i, k, 0x5e1));
  const rt = top + PYR.roof;
  if (q.roof === 'stepped') { // a stepped roof, the house of the rain
    boxS(pb, x0 + 2, rt, z0 + 2, x1 - 2, rt + 6, z1 - 2, GLYPH);
    boxS(pb, x0 + 5, rt + 6, z0 + 5, x1 - 5, rt + 9, z1 - 5, GLYPH);
    for (let k = 0; k < 4; k++) { const a = x0 + 4 + k * (2 * q.hx - 8) / 3; glyph(pb, 0, z1 - 1.95, a, rt + 3, 3.5, hash(seed, i, k, 0x5e2), GLOW); }
  } else if (q.roof === 'comb' && q.comb) { // the roof comb: a tall pierced crest at the back
    const cz = q.z - q.hz * 0.35, cx = q.hx * 0.72;
    boxS(pb, q.x - cx, rt, cz - 2, q.x + cx, rt + q.comb, cz + 2, STONE);
    const rows = 4, cols = 3;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { // its openings, and a face in the middle
      const ax = q.x - cx + (c + 0.5) * (2 * cx) / cols, ay = rt + (r + 0.5) * q.comb / rows, w = cx / cols * 0.55, h = q.comb / rows * 0.3;
      pb.line(COURSE, S(ax - w, ay - h, cz + 2.05), S(ax + w, ay - h, cz + 2.05), S(ax + w, ay + h, cz + 2.05), S(ax - w, ay + h, cz + 2.05), S(ax - w, ay - h, cz + 2.05));
    }
    glyph(pb, 0, cz + 2.08, q.x, rt + q.comb * 0.62, Math.min(cx, q.comb * 0.4), hash(seed, i, 0x5e3), GLOW);
  } else { // merlons round the roof's edge
    for (let x = x0; x <= x1 + 0.01; x += 4) for (const z of [z0 - 0.4, z1 + 0.4]) boxS(pb, x - 0.7, rt, z - 0.7, x + 0.7, rt + 2.2, z + 0.7, GLYPH);
    for (let z = z0 + 4; z < z1 - 1; z += 4) for (const x of [x0 - 0.4, x1 + 0.4]) boxS(pb, x - 0.7, rt, z - 0.7, x + 0.7, rt + 2.2, z + 0.7, GLYPH);
  }
  // inside, at the back: the stair going down into the pyramid, a dark well framed in carved stone
  const hx = 2.6, hz0 = z0 + t + 1.2, hz1 = hz0 + 6.5, fy = y + 0.04;
  pb.line(CARVE, S(q.x - hx, fy, hz0), S(q.x + hx, fy, hz0), S(q.x + hx, fy, hz1), S(q.x - hx, fy, hz1), S(q.x - hx, fy, hz0));
  for (let k = 1; k < 7; k++) { // the steps' noses fading into the dark
    const z = hz1 - k * (hz1 - hz0) / 7, w = hx * (1 - k * 0.07);
    pb.seg(k < 3 ? GLOW : COURSE, S(q.x - w, fy, z), S(q.x + w, fy, z));
  }
}
/** Where the braziers burn: at the top's corners (site frame, scaled; y over the site's ground). */
export function pyramidFires(m: Megalith): [number, number, number][] {
  const p = pyramidOfDesign(m), t = p.tiers[p.tiers.length - 1], [hx, hz] = tierTop(p, t), k = 3;
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => S(a * (hx - k), p.body + 3.2, b * (hz - k)) as [number, number, number]);
}
/** One pyramid into a batch, in its site's frame. */
export function drawPyramid(pb: PropBatch, m: Megalith) {
  const p = pyramidOfDesign(m);
  p.tiers.forEach((t, i) => terrace(pb, p, t, i, m.seed));
  for (const s of p.stairs) stair(pb, p, s);
  p.shrines.forEach((q, i) => shrine(pb, q, i, m.seed));
  for (const [x, y, z] of pyramidFires(m)) { // braziers: a stone cup on a pedestal, a fire in it
    const X = x / XS, Z = z / XS, Y = y / YS;
    boxS(pb, X - 0.9, Y - 3.2, Z - 0.9, X + 0.9, Y - 1.2, Z + 0.9, STONE);
    boxS(pb, X - 1.6, Y - 1.2, Z - 1.6, X + 1.6, Y, Z + 1.6, GLYPH);
    for (let k = 0; k < 5; k++) { const q = k / 5 * Math.PI * 2; pb.line(FIRE, S(X + Math.cos(q) * 1.1, Y, Z + Math.sin(q) * 1.1), S(X + Math.cos(q + 0.6) * 0.5, Y + 1.6, Z + Math.sin(q + 0.6) * 0.5), S(X, Y + 2.4, Z)); }
  }
  // the processional way from the main stair out across the plaza
  const main = p.stairs[0], [n, a] = faceAxes(main.face), far = (m.radius - 6) / XS;
  for (const side of [-1, 1]) {
    const lat = main.off + side * (main.w / 2 + 3);
    pb.seg(COURSE, S(n[0] * main.u0 + a[0] * lat, 0.05, n[1] * main.u0 + a[1] * lat), S(n[0] * far + a[0] * lat, 0.05, n[1] * far + a[1] * lat));
  }
  for (let u = main.u0 + 6; u < far; u += 6) pb.seg(COURSE, S(n[0] * u + a[0] * (main.off - main.w / 2 - 3), 0.05, n[1] * u + a[1] * (main.off - main.w / 2 - 3)), S(n[0] * u + a[0] * (main.off + main.w / 2 + 3), 0.05, n[1] * u + a[1] * (main.off + main.w / 2 + 3)));
}
