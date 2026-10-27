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

/**
 * The Crystal Colossus (lift 13: its feet at −13, hips at −1, shoulders at 7, the head's top at 13). The torso, the
 * head and the heart are in `body` (it leans when it runs); the legs pivot at the hips, the arms at the shoulders.
 */
export function colossusModel(g: THREE.Group, mat: THREE.LineBasicMaterial): BeastParts {
  const pb = new PropBatch();
  // pelvis, a broad waist and a great chest of stacked crystal blocks
  pb.solid8([[-3.2, -2.2, -1.6], [3.2, -2.2, -1.6], [3.2, -2.2, 1.6], [-3.2, -2.2, 1.6]], [[-3.6, 0.5, -1.8], [3.6, 0.5, -1.8], [3.6, 0.5, 1.8], [-3.6, 0.5, 1.8]], 0);
  pb.solid8([[-3.4, 0.5, -1.8], [3.4, 0.5, -1.8], [3.4, 0.5, 1.9], [-3.4, 0.5, 1.9]], [[-5.6, 6.5, -2.6], [5.6, 6.5, -2.6], [5.6, 6.5, 2.8], [-5.6, 6.5, 2.8]], 0);
  pb.solid8([[-5.6, 6.5, -2.6], [5.6, 6.5, -2.6], [5.6, 6.5, 2.8], [-5.6, 6.5, 2.8]], [[-4.2, 8.4, -2], [4.2, 8.4, -2], [4.2, 8.4, 2.2], [-4.2, 8.4, 2.2]], 0);
  // shards growing from the shoulders and back, a ridge down the spine
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) crystal(pb, [s * (3.6 + i * 0.5), 7 + i * 0.2, rr(-1.6, 1.2)], [s * rr(0.4, 1.1), 1, rr(-0.6, 0.2)], rr(2.4, 5), rr(0.4, 0.8), 6);
  for (let i = 0; i < 6; i++) crystal(pb, [rr(-1.5, 1.5), 1 + i * 1.2, -2 - i * 0.12], [rr(-0.3, 0.3), 0.5, -1], rr(1.5, 3.2), rr(0.3, 0.55), 5);
  // crystals breaking out of the chest, the flanks and the belly, all leaning outwards and up
  for (let i = 0; i < 14; i++) {
    const side = i % 2 ? 1 : -1, y = rr(1, 7), x = side * rr(1.2, 4.6), z = rr(0.6, 2.4);
    crystal(pb, [x, y, z], [side * rr(0.2, 0.9), rr(0.3, 1), rr(0.4, 1)], rr(1, 2.6), rr(0.25, 0.5), R() < 0.5 ? 5 : 6);
  }
  for (let i = 0; i < 6; i++) { const side = i % 2 ? 1 : -1; crystal(pb, [side * rr(3, 5), rr(0.5, 6), rr(-2, 1)], [side, rr(0.2, 0.8), rr(-0.5, 0.3)], rr(1.6, 3), rr(0.3, 0.6), 6); }
  const body = new THREE.Group(); body.add(built(pb, mat));
  // the heart: a geode set in the chest, its own crystal outlined in glowing lines with a burning star inside
  const hp = new PropBatch(), hz = 2.7, hy = 4.6, pts: number[] = [];
  const oct: P3[] = [[0, hy + 1.6, hz], [1.2, hy, hz], [0, hy - 1.6, hz], [-1.2, hy, hz]];
  for (let i = 0; i < 4; i++) { const a = oct[i], b = oct[(i + 1) % 4], f: P3 = [0, hy, hz + 1.1], k: P3 = [0, hy, hz - 0.6]; hp.face(a, b, f); pts.push(...a, ...b, ...a, ...f, ...a, ...k); }
  const hg = hp.build(); hg.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = sharedFill(); });
  body.add(hg); body.add(glow([...pts, ...star([0, hy, hz + 0.3], 0.9)]));
  // the head: a faceted helm with a crest of shards and two glowing slits
  const hb = new PropBatch();
  hb.solid8([[-1.5, 0, -1.4], [1.5, 0, -1.4], [1.3, 0, 1.6], [-1.3, 0, 1.6]], [[-1.2, 3.2, -1.2], [1.2, 3.2, -1.2], [0.9, 2.8, 1.5], [-0.9, 2.8, 1.5]], 0);
  for (let i = 0; i < 5; i++) crystal(hb, [(i - 2) * 0.45, 3, rr(-0.8, 0.6)], [(i - 2) * 0.25, 1, -0.3], rr(1.4, 2.6), 0.28, 5);
  const head = new THREE.Group(); head.add(built(hb, mat)); head.add(glow([-1, 1.9, 1.62, -0.35, 1.7, 1.62, 0.35, 1.7, 1.62, 1, 1.9, 1.62]));
  head.position.set(0, 8.4, 0.2); body.add(head);
  g.add(body);
  // legs: a thick crystal thigh and shin to a broad foot (pivot at the hip, 12 m to the ground)
  const legs: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const lb = new PropBatch();
    crystal(lb, [0, 0, 0], [s * 0.12, -1, 0.05], 6.5, 1.5, 6);
    crystal(lb, [s * 0.75, -5.8, 0.3], [s * 0.05, -1, -0.04], 6, 1.2, 6);
    lb.solid8([[-1.6, -12, -1.4], [1.6, -12, -1.4], [1.6, -12, 2.8], [-1.6, -12, 2.8]].map(([x, y, z]) => [x + s * 0.9, y, z]), [[-1.2, -10.8, -1.1], [1.2, -10.8, -1.1], [1.1, -11.2, 1.8], [-1.1, -11.2, 1.8]].map(([x, y, z]) => [x + s * 0.9, y, z]), 0);
    crystal(lb, [s * 1.3, -6.2, 1], [s * 0.5, 0.2, 1], 1.8, 0.4, 4); // a knee spur
    for (let i = 0; i < 4; i++) crystal(lb, [s * rr(0.6, 1.4), rr(-9, -1.5), rr(-1, 1)], [s * rr(0.4, 1), rr(-0.2, 0.6), rr(-0.6, 0.6)], rr(0.9, 2), rr(0.2, 0.4), 5);
    const l = new THREE.Group(); l.add(built(lb, mat)); l.position.set(s * 2.4, -1, 0); g.add(l); legs.push(l);
  }
  // arms: hanging from the shoulders to great crystal fists
  const arms: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const ab = new PropBatch();
    crystal(ab, [0, 0, 0], [s * 0.2, -1, 0.05], 5.5, 1.2, 6);
    crystal(ab, [s * 1, -5.2, 0.25], [s * 0.05, -1, 0.15], 5, 1, 6);
    ab.solid8([[-1.4, -12, -1.2], [1.4, -12, -1.2], [1.4, -12, 1.4], [-1.4, -12, 1.4]].map(([x, y, z]) => [x + s * 1.2, y, z + 0.8]), [[-1.6, -9.6, -1.4], [1.6, -9.6, -1.4], [1.6, -9.6, 1.6], [-1.6, -9.6, 1.6]].map(([x, y, z]) => [x + s * 1.2, y, z + 0.8]), 0);
    for (let i = 0; i < 3; i++) crystal(ab, [s * 1.2 + (i - 1) * 0.8, -11.5, 1.6], [(i - 1) * 0.2, -0.3, 1], 1.4, 0.3, 4); // knuckle shards
    for (let i = 0; i < 4; i++) crystal(ab, [s * rr(0.8, 1.6), rr(-9, -1), rr(-0.8, 0.6)], [s * rr(0.5, 1), rr(-0.1, 0.7), rr(-0.8, 0.2)], rr(1, 2.4), rr(0.2, 0.4), 5); // shards along the arm
    const a = new THREE.Group(); a.add(built(ab, mat)); a.position.set(s * 6.2, 6.5, 0); body.add(a); arms.push(a);
  }
  return { body, legs, gait: [1, -1], head, arms };
}
