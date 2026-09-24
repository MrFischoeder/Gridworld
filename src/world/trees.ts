// Tree models, built into a PropBatch (dark fill + lines). Shapes come from each tree's seed, so every player sees
// the same forest. lod 1 = near chunks, lod 2 = far chunks (fewer sides, no twigs or vines).
//   pine      high ground: trunk and cone (the original tree)
//   broad     everywhere else: faceted crown on a tapered trunk
//   twisted   T-01 Ancient Twisted Tree: leaning, gnarled trunk, roots, forked branches with bare twigs
//   umbrella  T-02 Umbrella Tree: bent trunk carrying flat faceted canopies with hanging vines
//   arch      T-03 Hollow Arch Tree: a trunk grown into an arch you can walk through, crowned with spikes
import { rng } from '../core/rng';
import { GRID } from './render';
import type { PropBatch } from './props';
import type { Tree } from '../gen/trees';

export type P = [number, number, number];
const BARK = GRID, LEAF = 0x3dff6e, VINE = 0x1f9a44;
const add = (a: P, b: P, k = 1): P => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const sub = (a: P, b: P): P => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm = (a: P): P => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a: P, b: P): P => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/**
 * Faceted tube through points (trunks, branches, the arch): a ring of `sides` corners around every point,
 * lines along the ring edges and the long edges, filled quads between rings.
 */
export function tube(pb: PropBatch, pts: P[], radii: number[], sides: number, color = BARK, twist = 0) {
  const rings: P[][] = [];
  let u: P = [0, 0, 0];
  for (let i = 0; i < pts.length; i++) {
    const d = norm(sub(pts[Math.min(i + 1, pts.length - 1)], pts[Math.max(i - 1, 0)]));
    // parallel transport: carry the previous ring's orientation along, so bends never twist the tube shut
    if (i === 0) u = norm(cross(d, Math.abs(d[0]) > 0.9 ? [0, 0, 1] : [1, 0, 0]));
    else { const k = u[0] * d[0] + u[1] * d[1] + u[2] * d[2]; u = norm([u[0] - d[0] * k, u[1] - d[1] * k, u[2] - d[2] * k]); }
    const v = cross(d, u);
    const ring: P[] = [];
    for (let k = 0; k < sides; k++) { const a = twist + k / sides * 6.283; ring.push(add(add(pts[i], u, Math.cos(a) * radii[i]), v, Math.sin(a) * radii[i])); }
    rings.push(ring);
  }
  for (let i = 0; i < rings.length; i++) for (let k = 0; k < sides; k++) {
    const k1 = (k + 1) % sides;
    pb.seg(color, rings[i][k], rings[i][k1]);
    if (i + 1 < rings.length) { pb.seg(color, rings[i][k], rings[i + 1][k]); pb.face(rings[i][k], rings[i][k1], rings[i + 1][k1], rings[i + 1][k]); }
  }
  const last = rings[rings.length - 1]; pb.face(...last); // cap the tip
}
/** Faceted blob crown: two staggered rings between a top and a bottom point. */
function crown(pb: PropBatch, c: P, r: number, h: number, n: number, R: () => number) {
  const rot = R() * 6.283, top: P = [c[0], c[1] + h * 0.5, c[2]], bot: P = [c[0], c[1] - h * 0.5, c[2]];
  const ring = (y: number, rr: number, off: number) => Array.from({ length: n }, (_, k): P => {
    const a = rot + (k + off) / n * 6.283, j = 0.85 + R() * 0.3;
    return [c[0] + Math.cos(a) * rr * j, c[1] + y, c[2] + Math.sin(a) * rr * j];
  });
  const lo = ring(-h * 0.22, r, 0), hi = ring(h * 0.18, r * 0.85, 0.5);
  for (let k = 0; k < n; k++) {
    const k1 = (k + 1) % n;
    pb.seg(LEAF, lo[k], lo[k1]); pb.seg(LEAF, hi[k], hi[k1]); pb.seg(LEAF, hi[k], top); pb.seg(LEAF, lo[k], hi[k]);
    if (n > 5) pb.seg(LEAF, lo[k1], hi[k]);
    pb.face(lo[k], lo[k1], hi[k]); pb.face(lo[k1], hi[k1], hi[k]); pb.face(hi[k], hi[k1], top); pb.face(lo[k1], lo[k], bot);
  }
}
/** Flat, faceted canopy (Umbrella Tree): raised top, a rim, a flat underside, vines hanging from the rim. */
function canopy(pb: PropBatch, c: P, r: number, n: number, vines: number, R: () => number) {
  const thick = 0.45 + r * 0.08, rot = R() * 6.283, top: P = [c[0], c[1] + r * 0.28, c[2]], under: P = [c[0], c[1] - thick * 1.4, c[2]];
  const rim: P[] = [], low: P[] = [];
  for (let k = 0; k < n; k++) {
    const a = rot + k / n * 6.283, j = 0.85 + R() * 0.3;
    rim.push([c[0] + Math.cos(a) * r * j, c[1] + (R() - 0.5) * 0.3, c[2] + Math.sin(a) * r * j]);
    low.push([c[0] + Math.cos(a) * r * j * 0.8, c[1] - thick, c[2] + Math.sin(a) * r * j * 0.8]);
  }
  for (let k = 0; k < n; k++) {
    const k1 = (k + 1) % n;
    pb.seg(LEAF, rim[k], rim[k1]); pb.seg(LEAF, rim[k], top); pb.seg(LEAF, low[k], low[k1]); pb.seg(LEAF, rim[k], low[k]);
    pb.face(rim[k], rim[k1], top); pb.face(rim[k], low[k], low[k1], rim[k1]); pb.face(low[k1], low[k], under);
  }
  for (let v = 0; v < vines; v++) {
    const p = low[(R() * n) | 0], l = 1 + R() * 2.2, mid: P = [p[0] + (R() - 0.5) * 0.3, p[1] - l * 0.5, p[2] + (R() - 0.5) * 0.3];
    pb.line(VINE, p, mid, [mid[0], p[1] - l, mid[2]]);
  }
}
/** Sharp three-sided spike (Hollow Arch crown, rocky bases). */
function spike(pb: PropBatch, base: P, dir: P, len: number, w: number) {
  const d = norm(dir), u = norm(cross(d, Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0])), v = cross(d, u);
  const tri = [0, 1, 2].map((k): P => { const a = k / 3 * 6.283; return add(add(base, u, Math.cos(a) * w), v, Math.sin(a) * w); });
  const tip = add(base, d, len);
  for (let k = 0; k < 3; k++) { const k1 = (k + 1) % 3; pb.seg(BARK, tri[k], tri[k1]); pb.seg(BARK, tri[k], tip); pb.face(tri[k], tri[k1], tip); }
  pb.face(tri[0], tri[2], tri[1]);
}
/** Bare twigs forking off a branch tip: lines only (they are thin enough to be see-through). */
function twigs(pb: PropBatch, p: P, dir: P, len: number, depth: number, R: () => number) {
  for (let i = 0; i < 2; i++) {
    const d = norm(add(dir, [(R() - 0.5) * 1.4, R() * 0.6, (R() - 0.5) * 1.4])), q = add(p, d, len * (0.7 + R() * 0.5));
    pb.seg(BARK, p, q);
    if (depth > 1) twigs(pb, q, d, len * 0.6, depth - 1, R);
  }
}

function pine(pb: PropBatch, t: Tree, lod: number) {
  pb.box(t.x - 0.3, t.y - 0.5, t.z - 0.3, t.x + 0.3, t.y + 2, t.z + 0.3, GRID);
  pb.cone(t.x, t.y + 2, t.z, t.r, t.h, GRID, lod > 1 ? 6 : 8);
}
function broad(pb: PropBatch, t: Tree, lod: number, R: () => number) {
  const trunkH = 1.6 + t.h * 0.18;
  tube(pb, [[t.x, t.y - 0.4, t.z], [t.x + (R() - 0.5) * 0.3, t.y + trunkH + 0.6, t.z + (R() - 0.5) * 0.3]], [0.4, 0.24], lod > 1 ? 3 : 5);
  crown(pb, [t.x, t.y + trunkH + t.h * 0.42, t.z], t.r, t.h * 0.85, lod > 1 ? 5 : 6, R);
}
function twisted(pb: PropBatch, t: Tree, lod: number, R: () => number) {
  const lean: P = [Math.cos(t.rot), 0, Math.sin(t.rot)], side: P = [-lean[2], 0, lean[0]], s = lod > 1 ? 4 : 6, H = t.h;
  const at = (up: number, fw: number, sd: number): P => [t.x + lean[0] * fw + side[0] * sd, t.y + up, t.z + lean[2] * fw + side[2] * sd];
  const trunk = [at(-0.5, 0, 0), at(H * 0.22, 0.9, 0.3), at(H * 0.42, 0.2, -0.4), at(H * 0.55, 1.1, 0.2)];
  tube(pb, trunk, [1.5, 1.1, 0.85, 0.6], s, BARK, t.rot);
  if (lod === 1) for (let i = 0; i < 3; i++) { // roots
    const a = t.rot + 1 + i * 2.1, d: P = [Math.cos(a), 0, Math.sin(a)];
    tube(pb, [add(at(0.7, 0, 0), d, 0.8), add(at(-0.35, 0, 0), d, 2.8 + R())], [0.5, 0.15], 4);
  }
  const nb = lod > 1 ? 4 : 5;
  for (let i = 0; i < nb; i++) {
    const a = t.rot + i / nb * 6.283 + (R() - 0.5) * 0.8, el = 0.3 + R() * 0.5, len = H * (0.36 + R() * 0.14);
    const d: P = [Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el)], from = trunk[i % 2 ? 2 : 3];
    const mid = add(add(from, d, len * 0.55), [0, len * 0.08, 0]), end = add(add(from, d, len), [0, len * 0.22, 0]);
    tube(pb, [from, mid, end], [0.55, 0.32, 0.14], lod > 1 ? 3 : 4);
    if (lod === 1) { twigs(pb, end, d, 1.6, 3, R); twigs(pb, mid, norm(add(d, [0, 0.8, 0])), 1.2, 2, R); }
  }
  if (lod === 1) for (let i = 0; i < 3; i++) { const a = t.rot + i * 2.3 + 0.5; pb.rock(t.x + Math.cos(a) * 1.6, t.y - 0.2, t.z + Math.sin(a) * 1.6, 0.5 + R() * 0.5, 0.5 + R() * 0.5, 4, a, BARK); }
}
function umbrella(pb: PropBatch, t: Tree, lod: number, R: () => number) {
  const lean: P = [Math.cos(t.rot), 0, Math.sin(t.rot)], H = t.h;
  const at = (up: number, fw: number): P => [t.x + lean[0] * fw, t.y + up, t.z + lean[2] * fw];
  const trunk = [at(-0.5, 0), at(H * 0.3, 1.2), at(H * 0.6, 0.4), at(H * 0.86, -0.5)];
  tube(pb, trunk, [1.25, 0.9, 0.65, 0.45], lod > 1 ? 4 : 6, BARK, t.rot);
  const n = lod > 1 ? 6 : 9, vines = lod > 1 ? 0 : 3;
  canopy(pb, add(trunk[3], [0, 0.4, 0]), 4.6 + R() * 1.2, n + 1, vines + 1, R);
  const nb = 3;
  for (let i = 0; i < nb; i++) {
    const a = t.rot + 1.2 + i * (4 / nb) + (R() - 0.5) * 0.5, d: P = [Math.cos(a), 0.45 + R() * 0.3, Math.sin(a)], from = trunk[1 + (i % 2)];
    const len = 3.2 + R() * 1.6, mid = add(add(from, norm(d), len * 0.5), [0, -0.3, 0]), end = add(from, norm(d), len);
    tube(pb, [from, mid, end], [0.45, 0.3, 0.2], lod > 1 ? 3 : 4);
    canopy(pb, add(end, [0, 0.3, 0]), 2.4 + R() * 1.2, n, vines, R);
  }
}
function arch(pb: PropBatch, t: Tree, lod: number, R: () => number) {
  const ax: P = [Math.cos(t.rot), 0, Math.sin(t.rot)], H = t.h, n = lod > 1 ? 6 : 10, pts: P[] = [], radii: number[] = [];
  for (let i = 0; i <= n; i++) {
    const th = Math.PI * (1 - i / n), bulge = 1 + 0.12 * Math.sin(i / n * Math.PI * 2);
    pts.push([t.x + ax[0] * Math.cos(th) * t.r * bulge, t.y - 0.3 + Math.sin(th) * H * 0.82, t.z + ax[2] * Math.cos(th) * t.r * bulge]);
    radii.push(0.95 + 0.9 * Math.abs(Math.cos(th)) ** 2);
  }
  tube(pb, pts, radii, lod > 1 ? 4 : 6, BARK, t.rot);
  // spikes along the top, leaning outwards; a couple of shards at each foot
  const ns = lod > 1 ? 4 : 7;
  for (let i = 0; i < ns; i++) {
    const k = 0.18 + i / (ns - 1) * 0.64, j = Math.round(k * n), p = pts[j], out = norm(sub(p, [t.x, t.y - H * 0.2, t.z]));
    spike(pb, p, add(out, [(R() - 0.5) * 0.5, 0.6, (R() - 0.5) * 0.5]), 2 + R() * 2.8, 0.35 + R() * 0.2);
  }
  for (const f of [pts[0], pts[n]]) {
    spike(pb, add(f, [0, 0.6, 0]), [(R() - 0.5), 1, (R() - 0.5)], 1.6 + R() * 1.4, 0.4);
    if (lod === 1) pb.rock(f[0] + (R() - 0.5) * 2, f[1] + 0.1, f[2] + (R() - 0.5) * 2, 0.8 + R() * 0.6, 0.7 + R() * 0.5, 5, R() * 6, BARK);
  }
  if (lod === 1) for (let i = 0; i < 4; i++) { // moss hanging under the arch
    const p = pts[Math.round((0.3 + R() * 0.4) * n)], l = 1.2 + R() * 2.5;
    pb.line(VINE, [p[0], p[1] - 0.6, p[2]], [p[0] + (R() - 0.5) * 0.4, p[1] - 0.6 - l, p[2] + (R() - 0.5) * 0.4]);
  }
}

/** Adds one tree of any kind to the batch. */
export function drawTree(pb: PropBatch, t: Tree, lod: number) {
  const R = rng(t.seed + 1);
  switch (t.kind) {
    case 'pine': pine(pb, t, lod); break;
    case 'broad': broad(pb, t, lod, R); break;
    case 'twisted': twisted(pb, t, lod, R); break;
    case 'umbrella': umbrella(pb, t, lod, R); break;
    case 'arch': arch(pb, t, lod, R); break;
  }
}
/** A broadleaf crown on its own (village trees stand on voxel trunks). */
export function drawCrown(pb: PropBatch, x: number, y: number, z: number, r: number, h: number, seed: number) {
  crown(pb, [x, y + h * 0.4, z], r, h * 0.85, 6, rng(seed));
}
