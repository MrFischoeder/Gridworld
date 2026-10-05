// Batched, opaque ancient stonework. Each monument is a local mesh, streamed independently of terrain chunks.
import * as THREE from 'three';
import { megalithsNear, megalithStones, megalithLocal, megalithStoneHit, megalithHeads, type Megalith, type MegalithStone, type MegalithHead } from '../gen/megaliths';
import { PropBatch } from './props';
import { scene, disposeTree } from './render';
import { rng } from '../core/rng';
const STONE = 0x91ad94, CARVING = 0x4f765a, CROWN = 0xd1c597, EYES = 0xc8ff6a, BOULDER = 0x3fbf62, FACE = 0x46d870, GROOVE = 0x2a8f4a;
/**
 * The colossal head's cross-sections from the buried shoulders to the flat crown, as shares of its height:
 * [height, half-width, front, back]. The chin, the heavy brow and the long flat face come from the front column.
 */
const HEAD_RINGS = [
  [0, .27, .19, .2], [.14, .26, .18, .19], [.2, .2, .2, .16], [.25, .21, .25, .16], [.31, .225, .22, .16], [.42, .225, .18, .16],
  [.56, .215, .17, .16], [.62, .2, .15, .16], [.7, .225, .235, .17], [.78, .21, .19, .17], [.9, .195, .16, .165], [.97, .175, .13, .14], [1, .14, .1, .11],
];
/** A small fixed wobble per head and corner, so the facets look weathered rather than machined. */
const wob = (o: MegalithHead, r: number, i: number) => { const v = Math.sin(o.x * 12.9898 + o.z * 78.233 + r * 37.71 + i * 11.13) * 43758.5453; return v - Math.floor(v) - .5; };
/** The front of the face at height t (a share of h), from the rings. */
function frontAt(t: number): number {
  for (let i = 1; i < HEAD_RINGS.length; i++) {
    const [t1, , f1] = HEAD_RINGS[i], [t0, , f0] = HEAD_RINGS[i - 1];
    if (t <= t1) return f0 + (f1 - f0) * (t - t0) / (t1 - t0);
  }
  return HEAD_RINGS[HEAD_RINGS.length - 1][2];
}
/** One colossal head: a faceted, triangulated stone bust with nose, lips, ears and glowing visor eyes. */
function drawHead(pb: PropBatch, o: MegalithHead) {
  const H = o.h, cy = Math.cos(o.yaw), sy = Math.sin(o.yaw), cl = Math.cos(o.lean), sl = Math.sin(o.lean);
  // head frame (x across, y up, z out of the face) → site frame: lean forward about x, turn by yaw, move to its place
  const P = (x: number, y: number, z: number) => { const y1 = y * cl - z * sl, z1 = y * sl + z * cl; return [o.x + cy * x + sy * z1, o.y + y1, o.z - sy * x + cy * z1]; };
  const rings = HEAD_RINGS.map(([t, a, f, b], r) => {
    const y = t * H, A = a * H, F = f * H, B = b * H, k = r === 0 || r === HEAD_RINGS.length - 1 ? .015 : .035;
    return [[-A * .7, y, F], [A * .7, y, F], [A, y, F * .45], [A, y, -B * .45], [A * .7, y, -B], [-A * .7, y, -B], [-A, y, -B * .45], [-A, y, F * .45]]
      .map(([x, yy, z], i) => P(x * (1 + wob(o, r, i) * k * 2), yy + (r && r < HEAD_RINGS.length - 1 ? wob(o, r, i + 8) * H * .012 : 0), z + (i < 2 ? 0 : wob(o, r, i + 16) * H * k)));
  });
  for (let r = 0; r + 1 < rings.length; r++) for (let i = 0; i < 8; i++) {
    const j = (i + 1) % 8, a = rings[r][i], b = rings[r][j], c = rings[r + 1][j], d = rings[r + 1][i];
    pb.face(a, b, c, d);
    pb.seg(FACE, a, b); pb.seg(FACE, a, d);
    pb.seg(FACE, (r + i) % 2 ? a : b, (r + i) % 2 ? c : d); // facets split corner to corner, as in worked stone
  }
  const crown = rings[rings.length - 1];
  pb.face(...crown); pb.line(FACE, ...crown, crown[0]); pb.face(...rings[0]);
  // the nose: a long wedge down the middle of the face
  const n0 = .45, n1 = .69, fz0 = frontAt(n0) * H, fz1 = frontAt(n1) * H;
  pb.solid8([P(-.055 * H, n0 * H, fz0 - .01 * H), P(.055 * H, n0 * H, fz0 - .01 * H), P(.035 * H, n0 * H, fz0 + .1 * H), P(-.035 * H, n0 * H, fz0 + .1 * H)],
    [P(-.025 * H, n1 * H, fz1 - .01 * H), P(.025 * H, n1 * H, fz1 - .01 * H), P(.012 * H, n1 * H, fz1 + .015 * H), P(-.012 * H, n1 * H, fz1 + .015 * H)], FACE);
  // pursed lips over the jutting chin
  const ly = .34 * H, lz = frontAt(.34) * H;
  pb.solid8([P(-.08 * H, ly - .02 * H, lz - .01 * H), P(.08 * H, ly - .02 * H, lz - .01 * H), P(.08 * H, ly - .02 * H, lz + .025 * H), P(-.08 * H, ly - .02 * H, lz + .025 * H)],
    [P(-.075 * H, ly + .02 * H, lz - .01 * H), P(.075 * H, ly + .02 * H, lz - .01 * H), P(.075 * H, ly + .02 * H, lz + .02 * H), P(-.075 * H, ly + .02 * H, lz + .02 * H)], FACE);
  pb.line(GROOVE, P(-.07 * H, ly, lz + .027 * H), P(0, ly - .006 * H, lz + .03 * H), P(.07 * H, ly, lz + .027 * H));
  // long ears down the sides of the head
  for (const side of [-1, 1]) {
    const x0 = side * .2 * H, x1 = side * .235 * H;
    pb.solid8([P(x0, .42 * H, -.02 * H), P(x1, .42 * H, -.02 * H), P(x1, .42 * H, .05 * H), P(x0, .42 * H, .05 * H)],
      [P(x0, .72 * H, -.04 * H), P(x1, .72 * H, -.04 * H), P(x1, .72 * H, .06 * H), P(x0, .72 * H, .06 * H)], FACE);
  }
  // the eyes: dark visor plates under the brow, lit with rows of glowing glyph lines
  const ey = .635 * H, ez = frontAt(.635) * H;
  for (const side of [-1, 1]) {
    const x0 = side * .035 * H, x1 = side * .165 * H, lo = ey - .034 * H, hi = ey + .034 * H, z0 = ez - .005 * H, z1 = ez + .018 * H;
    pb.solid8([P(x0, lo, z0), P(x1, lo, z0), P(x1, lo, z1), P(x0, lo, z1)], [P(x0, hi, z0), P(x1, hi, z0), P(x1, hi, z1), P(x0, hi, z1)], GROOVE);
    const zf = z1 + .004 * H, xa = Math.min(x0, x1), xb = Math.max(x0, x1);
    for (let row = 0; row < 3; row++) {
      const y = lo + (row + 1) * (hi - lo) / 4;
      for (let k = 0; k < 4; k++) { // dashes like a line of old script
        const u0 = xa + (xb - xa) * (k / 4 + .03 + ((row + k) % 2) * .04), u1 = xa + (xb - xa) * ((k + 1) / 4 - .03);
        pb.seg(EYES, P(u0, y, zf), P(u1, y, zf));
      }
    }
    pb.line(EYES, P(x0, lo, zf), P(x1, lo, zf), P(x1, hi, zf), P(x0, hi, zf), P(x0, lo, zf));
  }
}
interface Loaded { site: Megalith; group: THREE.Group; stones: MegalithStone[] }
const loaded = new Map<string, Loaded>();
export function megalithModel(site: Megalith): THREE.Group {
  const pb = new PropBatch(), R = rng(site.seed);
  const { heads, rocks } = megalithHeads(site);
  for (const o of heads) drawHead(pb, o);
  for (const o of rocks) pb.rock(o.x, 0, o.z, o.r, o.h, o.sides, o.rot, BOULDER);
  for (const b of megalithStones(site)) {
    if (b.kind) continue; // heads and boulders are drawn above
    const c = Math.cos(b.yaw), s = Math.sin(b.yaw);
    const point = (x: number, y: number, z: number) => [b.x + c * x + s * z, b.y + y, b.z - s * x + c * z];
    const ring = (y: number, factor: number) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => point(x * b.w / 2 * factor, y, z * b.d / 2 * factor));
    pb.solid8(ring(0, 1), ring(b.h, .94), b.cap ? CROWN : STONE);
    // Irregular fracture lines follow each taper instead of floating in front of the stone.
    for (const side of [-1, 1]) {
      const y = b.h * (.2 + R() * .5), x = (R() - .5) * b.w * .5;
      const p = (u: number, v: number) => point(u, v, side * (b.d / 2 * (1 - .06 * v / b.h) + .025));
      pb.line(CARVING, p(x - b.w * .2, y + b.h * .15), p(x, y), p(x + b.w * .1, Math.max(.5, y - b.h * .15)));
    }
    if (!b.cap) {
      const y = b.h * .55, z = b.d / 2 * (1 - .06 * y / b.h) + .04, w = b.w * .16;
      pb.line(CARVING, point(-w, y, z), point(0, y + w * 1.5, z), point(w, y, z), point(0, y - w * 1.5, z), point(-w, y, z));
    }
  }
  // Flush ancient paving outlines mark the sanctuary without a raised step or a solid courtyard collider.
  for (const radius of [site.radius - 4, 18]) for (let i = 0; i < 64; i++) {
    const a = i / 64 * Math.PI * 2, b = (i + 1) / 64 * Math.PI * 2;
    pb.seg(CARVING, [Math.cos(a) * radius, .035, Math.sin(a) * radius], [Math.cos(b) * radius, .035, Math.sin(b) * radius]);
  }
  const group = pb.build(); group.name = site.id; group.userData.landmark = site.id; return group;
}
export function syncMegaliths(world: number, x: number, z: number) {
  const near = megalithsNear(world, x, z, 420), keep = new Set(near.map(m => m.id));
  for (const [id, m] of loaded) if (!keep.has(id)) { disposeTree(m.group); loaded.delete(id); }
  for (const site of near) {
    const old = loaded.get(site.id);
    if (old) { old.site = site; old.group.position.set(site.x, site.y, site.z); continue; }
    const group = megalithModel(site); group.position.set(site.x, site.y, site.z); group.rotation.y = site.yaw; scene.add(group);
    loaded.set(site.id, { site, group, stones: megalithStones(site) });
  }
}
export function clearMegaliths() { for (const m of loaded.values()) disposeTree(m.group); loaded.clear(); }
export function megalithHit(x: number, y: number, z: number, radius: number): boolean {
  for (const m of loaded.values()) { const [u, v] = megalithLocal(m.site, x, z); if (megalithStoneHit(m.stones, u, y - m.site.y, v, radius)) return true; }
  return false;
}
const caster = new THREE.Raycaster();
export function megalithRay(o: { x: number; y: number; z: number }, d: { x: number; y: number; z: number }, maxT: number): number {
  caster.ray.origin.set(o.x, o.y, o.z); caster.ray.direction.set(d.x, d.y, d.z); caster.near = 0; caster.far = maxT;
  for (const m of loaded.values()) {
    m.group.updateMatrixWorld(true); const stone = m.group.children[0];
    if (!(stone instanceof THREE.Mesh)) continue;
    const hit = caster.intersectObject(stone, false)[0]; if (hit && hit.distance < maxT) { maxT = hit.distance; caster.far = maxT; }
  }
  return maxT;
}
export const megalithName = (x: number, z: number) => [...loaded.values()].find(m => Math.hypot(...megalithLocal(m.site, x, z)) < m.site.radius)?.site.name;

/** Extend the local view only near these exceptionally large structures. */
export const nearMegalith = (x: number, z: number) => [...loaded.values()].some(m => Math.hypot(...megalithLocal(m.site, x, z)) < m.site.radius + 220);
export function megalithFloor(x: number, y: number, z: number): number {
  let floor = -Infinity;
  for (const m of loaded.values()) {
    const [u, v] = megalithLocal(m.site, x, z);
    for (const b of m.stones) {
      const top = m.site.y + b.y + b.h; if (y < top - .5) continue;
      const c = Math.cos(b.yaw), s = Math.sin(b.yaw), dx = u - b.x, dz = v - b.z;
      if (Math.abs(c * dx - s * dz) <= b.w * .47 && Math.abs(s * dx + c * dz) <= b.d * .47) floor = Math.max(floor, top);
    }
  }
  return floor;
}
