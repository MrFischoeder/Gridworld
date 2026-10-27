// (0.277, the owner's request) The models of the Crystal Wastes' creatures: shardlings (a knot of shards on four
// crystal legs), prismwalkers (a bundle of tall prisms striding on three legs) and the Crystal Colossus, a humanoid
// giant of crystal 26 m tall with a glowing heart. Every shardling and prismwalker is a different combination of
// crystals (looks only, rolled with Math.random: nothing of it is saved or shared). Origins at the body centre, +z
// forward, like the other creatures; lines take the creature's own material, the inner glow its own.
import * as THREE from 'three';
import { PropBatch, sharedFill } from './props';

export type P3 = [number, number, number];
/** The colour of the crystals' inner glow (the wastes' violet). */
export const CRYSTAL_GLOW = 0xd8b8ff;
let glowMat: THREE.LineBasicMaterial | null = null;
/** The inner glow: drawn without fog, added on top, so the hearts shine at night. */
export const crystalGlowMat = () => (glowMat ??= new THREE.LineBasicMaterial({ color: CRYSTAL_GLOW, transparent: true, opacity: 0.85, fog: false, blending: THREE.AdditiveBlending, depthWrite: false }));

/** A crystal: an n-sided prism from `base` along `dir` for 70% of `len`, then a point; `w` its radius. */
export function crystal(pb: PropBatch, base: P3, dir: P3, len: number, w: number, sides = 6, color = 0) {
  const n = Math.hypot(...dir), d = dir.map((v) => v / n) as P3;
  const up: P3 = Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const cx = (a: P3, b: P3): P3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const u0 = cx(d, up), ul = Math.hypot(...u0), u = u0.map((v) => v / ul) as P3, v = cx(d, u);
  const at = (t: number, a: number, r: number): number[] => [0, 1, 2].map((i) => base[i] + d[i] * t + (u[i] * Math.cos(a) + v[i] * Math.sin(a)) * r);
  const shoulder = len * 0.7, tip = at(len, 0, 0), foot = at(0, 0, 0);
  const lo: number[][] = [], hi: number[][] = [];
  for (let i = 0; i < sides; i++) { const a = (i / sides) * 6.2832; lo.push(at(0, a, w * 0.85)); hi.push(at(shoulder, a, w)); }
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    pb.seg(color, lo[i], hi[i]); pb.seg(color, hi[i], tip); pb.seg(color, hi[i], hi[j]); pb.seg(color, lo[i], lo[j]);
    pb.face(lo[i], lo[j], hi[j], hi[i]); pb.face(hi[i], hi[j], tip); pb.face(lo[j], lo[i], foot);
  }
}
/** A batch built with the creature's material on its lines and the dark fill on its faces. */
function built(pb: PropBatch, mat: THREE.LineBasicMaterial): THREE.Group {
  const g = pb.build();
  g.traverse((o) => { if ((o as THREE.LineSegments).isLineSegments) (o as THREE.LineSegments).material = mat; else if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = sharedFill(); });
  return g;
}
/** Glowing lines (a heart, the cores of the shards). */
function glow(pts: number[]): THREE.LineSegments {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const l = new THREE.LineSegments(g, crystalGlowMat()); l.renderOrder = 3; return l;
}
/** A star of glowing lines round a point (a heart). */
function star(c: P3, r: number): number[] {
  const out: number[] = [];
  for (const [a, b, e] of [[1, 0, 0], [0, 1, 0], [0, 0, 1], [0.6, 0.6, 0.5], [-0.6, 0.6, 0.5], [0.6, -0.6, 0.5], [0.6, 0.6, -0.5]]) out.push(c[0] - a * r, c[1] - b * r, c[2] - e * r, c[0] + a * r, c[1] + b * r, c[2] + e * r);
  return out;
}
/** A jointed crystal leg from its hip (the group's origin) through the knee to the foot: two shards. */
function crystalLeg(mat: THREE.LineBasicMaterial, knee: P3, foot: P3, w: number): THREE.Group {
  const pb = new PropBatch();
  crystal(pb, [0, 0, 0], knee, Math.hypot(...knee) * 1.05, w, 5);
  crystal(pb, knee, [foot[0] - knee[0], foot[1] - knee[1], foot[2] - knee[2]], Math.hypot(foot[0] - knee[0], foot[1] - knee[1], foot[2] - knee[2]), w * 0.8, 5);
  const pivot = new THREE.Group(); pivot.add(built(pb, mat)); return pivot;
}

export interface BeastParts { body: THREE.Group; legs: THREE.Group[]; gait: number[]; head: THREE.Group | null; arms: THREE.Group[] }
const R = Math.random, rr = (a: number, b: number) => a + R() * (b - a);

/** A shardling: 3–6 shards of a knot (each of its own size and lean), four thin legs (lift 0.55). */
export function shardlingModel(g: THREE.Group, mat: THREE.LineBasicMaterial): BeastParts {
  const pb = new PropBatch(), n = 3 + Math.floor(R() * 4), core: number[] = [];
  crystal(pb, [0, -0.15, -0.25], [0, 0.25, 1], 0.75, 0.2, 5); // the body: a shard lying forward
  for (let i = 0; i < n; i++) {
    const a = rr(-1.4, 1.4), z = rr(-0.25, 0.25), len = rr(0.35, 0.8);
    crystal(pb, [Math.sin(a) * 0.08, 0, z], [Math.sin(a) * 0.7, 1, rr(-0.5, 0.2)], len, rr(0.05, 0.11), R() < 0.5 ? 4 : 6);
  }
  core.push(...star([0, 0, 0.05], 0.12));
  const body = new THREE.Group(); body.add(built(pb, mat)); body.add(glow(core)); g.add(body);
  const legs: THREE.Group[] = [], gait = [1, -1, -1, 1];
  for (const [x, z] of [[-0.18, 0.2], [0.18, 0.2], [-0.18, -0.2], [0.18, -0.2]]) {
    const l = crystalLeg(mat, [Math.sign(x) * 0.28, -0.05, z * 0.5], [Math.sign(x) * 0.4, -0.55, z * 0.8], 0.04);
    l.position.set(x, -0.08, z); g.add(l); legs.push(l);
  }
  return { body, legs, gait, head: null, arms: [] };
}

/** A prismwalker: 2–4 tall prisms bundled, a crown of small shards, three long legs (lift 2.1). */
export function prismModel(g: THREE.Group, mat: THREE.LineBasicMaterial): BeastParts {
  const pb = new PropBatch(), n = 2 + Math.floor(R() * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.28 + rr(-0.3, 0.3), off = i ? rr(0.2, 0.45) : 0, len = i ? rr(1.4, 2.3) : rr(2.4, 3);
    crystal(pb, [Math.cos(a) * off, -0.6, Math.sin(a) * off], [Math.cos(a) * 0.15, 1, Math.sin(a) * 0.15], len, rr(0.2, 0.32), 6);
  }
  const crown = new PropBatch(), m = 3 + Math.floor(R() * 4);
  for (let i = 0; i < m; i++) { const a = (i / m) * 6.28; crystal(crown, [Math.cos(a) * 0.2, 1.5, Math.sin(a) * 0.2], [Math.cos(a), 0.6, Math.sin(a)], rr(0.4, 0.8), 0.07, 4); }
  const body = new THREE.Group(); body.add(built(pb, mat)); g.add(body);
  const head = new THREE.Group(); head.add(built(crown, mat)); head.add(glow(star([0, 1.4, 0], 0.25))); body.add(head);
  body.add(glow(star([0, 0.2, 0], 0.3)));
  const legs: THREE.Group[] = [], gait = [1, -1, 1];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * 6.28 + 0.5, s = Math.sin(a), c = Math.cos(a);
    const l = crystalLeg(mat, [s * 0.9, 0.5, c * 0.9], [s * 1.3, -1.95, c * 1.3], 0.09);
    l.position.set(s * 0.25, -0.5, c * 0.25); g.add(l); legs.push(l);
  }
  return { body, legs, gait, head: null, arms: [] }; // (the crown stays still: the grazing nod is for heads on necks)
}

/** A crystal pointed at both ends (a bipyramid): a point at `base`, the prism from `foot` to 70% of `len`, a point at
 *  the tip; its axis returned as glowing core lines (the light inside the crystal) when `core` is given. */
function bipyr(pb: PropBatch, base: P3, dir: P3, len: number, w: number, sides = 6, foot = 0.18, core?: number[]) {
  const n = Math.hypot(...dir), d = dir.map((v) => v / n) as P3;
  const up: P3 = Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const cx = (a: P3, b: P3): P3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const u0 = cx(d, up), ul = Math.hypot(...u0), u = u0.map((v) => v / ul) as P3, v = cx(d, u);
  const at = (t: number, a: number, r: number): number[] => [0, 1, 2].map((i) => base[i] + d[i] * t + (u[i] * Math.cos(a) + v[i] * Math.sin(a)) * r);
  const tip = at(len, 0, 0), bot = at(0, 0, 0), lo: number[][] = [], hi: number[][] = [];
  for (let i = 0; i < sides; i++) { const a = (i / sides) * 6.2832; lo.push(at(len * foot, a, w * 0.9)); hi.push(at(len * 0.7, a, w)); }
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    pb.seg(0, lo[i], hi[i]); pb.seg(0, hi[i], tip); pb.seg(0, lo[i], bot); pb.seg(0, hi[i], hi[j]); pb.seg(0, lo[i], lo[j]);
    pb.face(lo[i], lo[j], hi[j], hi[i]); pb.face(hi[i], hi[j], tip); pb.face(lo[j], lo[i], bot);
  }
  if (core) { // the light along its axis and two fractures
    const a = at(len * 0.08, 0, 0), b = at(len * 0.9, 0, 0);
    core.push(...a, ...b, ...at(len * 0.3, 1, w * 0.45), ...at(len * 0.62, 2.6, w * 0.4), ...at(len * 0.45, 4, w * 0.5), ...at(len * 0.78, 5.2, w * 0.3));
  }
}
/** A druse: `n` crystals bursting from one point, round `dir` within `spread` (rad). */
function druse(pb: PropBatch, at: P3, dir: P3, n: number, len: [number, number], w: [number, number], spread: number) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.283 + rr(-0.4, 0.4), k = i ? rr(0.4, 1) * spread : 0;
    const d: P3 = [dir[0] + Math.cos(a) * Math.sin(k) * 1.4, dir[1] + Math.sin(a) * Math.sin(k) * 1.4 * (1 - Math.abs(dir[1])), dir[2] + Math.sin(a) * Math.sin(k) * 1.4];
    crystal(pb, at, d, rr(len[0], len[1]), rr(w[0], w[1]), R() < 0.5 ? 5 : 6);
  }
}

/**
 * The Crystal Colossus (lift 13: its feet at −13, hips at −1, its crown 14 over the middle): a walking crystal formation
 * rather than a body. A great double-pointed crystal is its trunk and head at once, two leaning crystals its shoulders,
 * druses burst from its back and flanks, every limb is a chain of long crystals ending in a burst of points; a glowing
 * geode is its heart and light runs inside the crystals. The torso and the heart are in `body` (it leans when it
 * runs); the legs pivot at the hips, the arms at the shoulders.
 */
export function colossusModel(g: THREE.Group, mat: THREE.LineBasicMaterial): BeastParts {
  const pb = new PropBatch(), core: number[] = [];
  bipyr(pb, [0, -3.5, 0.2], [0, 1, 0.04], 18, 3.4, 6, 0.16, core); // the trunk, pointed at the crown
  for (const s of [-1, 1]) {
    bipyr(pb, [s * 1.8, 0.5, 0.1], [s * 0.6, 1, 0], 11, 2.1, 6, 0.2, core); // the shoulders, leaning out
    bipyr(pb, [s * 1.2, -1.5, -1.2], [s * 0.35, 1, -0.45], 9, 1.6, 5, 0.2, core); // the flanks and back
    bipyr(pb, [s * 1.4, -2.5, 1], [s * 0.5, 0.7, 0.5], 5.5, 1.1, 5, 0.2); // the hips
  }
  bipyr(pb, [0, 0, -1.6], [0, 1, -0.55], 10, 1.9, 6, 0.2, core); // the spine, out of the back
  druse(pb, [0, 5, -2.2], [0, 0.4, -1], 6, [1.8, 3.6], [0.35, 0.7], 0.9); // a burst on the back
  for (const s of [-1, 1]) druse(pb, [s * 2.6, 2, 1.2], [s, 0.5, 0.4], 4, [1, 2.2], [0.25, 0.45], 0.7); // on the flanks
  const body = new THREE.Group(); body.add(built(pb, mat)); body.add(glow(core));
  // the heart: a geode set in the chest, its own crystal outlined in glowing lines with a burning star inside
  const hp = new PropBatch(), hz = 3.6, hy = 4.6, pts: number[] = [];
  const oct: P3[] = [[0, hy + 1.6, hz], [1.2, hy, hz], [0, hy - 1.6, hz], [-1.2, hy, hz]];
  for (let i = 0; i < 4; i++) { const a = oct[i], b = oct[(i + 1) % 4], f: P3 = [0, hy, hz + 1.1], k: P3 = [0, hy, hz - 0.6]; hp.face(a, b, f); pts.push(...a, ...b, ...a, ...f, ...a, ...k); }
  const hg = hp.build(); hg.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = sharedFill(); });
  body.add(hg); body.add(glow([...pts, ...star([0, hy, hz + 0.3], 0.9)]));
  // the head: no face, only a crown of crystals round the trunk's point and two cold sparks for eyes
  const hb = new PropBatch();
  druse(hb, [0, 0, 0], [0, 1, 0.15], 5, [1.6, 3.2], [0.3, 0.55], 0.6);
  const head = new THREE.Group(); head.add(built(hb, mat));
  head.add(glow([...star([-0.8, -0.6, 2.25], 0.3), ...star([0.8, -0.6, 2.25], 0.3)]));
  head.position.set(0, 9.6, 0.2); body.add(head);
  g.add(body);
  // legs: two long crystals from the hip to the ground, the foot a burst of points gripping it (12 m to the ground)
  const legs: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const lb = new PropBatch(), lc: number[] = [];
    bipyr(lb, [0, 1, 0], [s * 0.1, -1, 0.05], 7.4, 1.5, 6, 0.18, lc);
    bipyr(lb, [s * 0.65, -5.4, 0.3], [s * 0.04, -1, -0.02], 6.8, 1.2, 6, 0.18, lc);
    druse(lb, [s * 0.9, -11.3, 0.4], [0, -0.35, 1], 5, [1.2, 2.4], [0.3, 0.55], 1.2); // the foot
    crystal(lb, [s * 1.1, -5.6, 0.9], [s * 0.5, 0.3, 1], 1.8, 0.45, 5); // a knee spur
    for (let i = 0; i < 3; i++) crystal(lb, [s * rr(0.6, 1.3), rr(-9, -2), rr(-0.9, 0.9)], [s * rr(0.4, 1), rr(-0.1, 0.6), rr(-0.6, 0.6)], rr(0.9, 1.9), rr(0.2, 0.4), 5);
    const l = new THREE.Group(); l.add(built(lb, mat)); l.add(glow(lc)); l.position.set(s * 2.4, -1, 0); g.add(l); legs.push(l);
  }
  // arms: two long crystals hanging from the shoulders, the fist a druse of points
  const arms: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const ab = new PropBatch(), ac: number[] = [];
    bipyr(ab, [0, 1, 0], [s * 0.15, -1, 0.05], 6.6, 1.15, 6, 0.18, ac);
    bipyr(ab, [s * 0.9, -4.8, 0.3], [s * 0.05, -1, 0.15], 6, 0.95, 6, 0.18, ac);
    druse(ab, [s * 1.2, -10, 1], [0, -1, 0.25], 7, [1.6, 3], [0.4, 0.7], 1.1); // the fist
    for (let i = 0; i < 3; i++) crystal(ab, [s * rr(0.7, 1.4), rr(-8.5, -1), rr(-0.7, 0.5)], [s * rr(0.5, 1), rr(-0.1, 0.7), rr(-0.8, 0.2)], rr(1, 2.2), rr(0.2, 0.4), 5);
    const a = new THREE.Group(); a.add(built(ab, mat)); a.add(glow(ac)); a.position.set(s * 6.2, 6.5, 0); body.add(a); arms.push(a);
  }
  return { body, legs, gait: [1, -1], head, arms };
}
