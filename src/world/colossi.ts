// (0.275) The scattered colossi drawn (gen/colossi.ts): the lone stone heads (the megaliths' faceted heads,
// world/megaliths.ts `drawHead`) and the sphinxes, each sunk into the ground, leaning and rolled as it was rolled,
// with heaved boulders round its foot. A site within sight is one group at its middle (small local vertices); its
// solids are capsules (the player, the foes, vehicles, shots). The sphinxes' eyes glow faintly by night.
import * as THREE from 'three';
import { scene, disposeTree } from './render';
import { G } from '../game';
import { OW } from './overworld';
import { PropBatch } from './props';
import { colossiNear, colossusCapsules, type ColossusSite, type Colossus } from '../gen/colossi';
import { tiltFrame, capsulesHit, type Capsule } from '../gen/tilt';
import { nearX, worldDist, latitude } from '../gen/regions';
import { rayRod, type V3 } from '../gen/cover';
import { daylight, sunTilt } from '../core/time';
import { addGlows } from './light';
import { drawHead, drawEyes } from './megaliths';
import { hash, rng } from '../core/rng';
import { TL } from '../i18n';

const NEAR = 1000, DROP = 1200;
const SAND = 0xc8c0a0, CRACK = 0x8a8468, CROWN = 0xd1c597, GLOW = 0xc8ff6a, BOULDER = 0x3fbf62;
/**
 * (0.276) The sphinx's torso from the waist to the neck, as horizontal rings: [height, middle (forward), half-width,
 * front, back] as shares of H: the back rising from the hips to the shoulders, a broad chest thrust forward.
 */
const TORSO = [
  [0.2, -0.12, 0.19, 0.17, 0.12], [0.3, -0.06, 0.18, 0.18, 0.13], [0.42, 0.03, 0.19, 0.19, 0.13], [0.52, 0.09, 0.2, 0.17, 0.12],
  [0.6, 0.13, 0.18, 0.14, 0.11], [0.67, 0.15, 0.125, 0.1, 0.09], [0.73, 0.18, 0.075, 0.08, 0.07],
];
/** The hindquarters, as rings across the body along z: [z, height of the middle, half-width, half-height]: rounded at the rump, widest at the hips. */
const HAUNCH = [[-0.53, 0.13, 0.07, 0.07], [-0.49, 0.15, 0.17, 0.14], [-0.42, 0.18, 0.225, 0.18], [-0.32, 0.2, 0.235, 0.2], [-0.2, 0.21, 0.215, 0.2], [-0.08, 0.23, 0.185, 0.17]];
/** The head: [height, half-width, front, back] round its middle at z 0.2 H. */
const HEAD = [[0.73, 0.075, 0.075, 0.07], [0.77, 0.088, 0.098, 0.082], [0.83, 0.094, 0.104, 0.092], [0.88, 0.092, 0.104, 0.097], [0.94, 0.084, 0.088, 0.093], [0.985, 0.063, 0.062, 0.072], [1, 0.03, 0.03, 0.04]];
const HZ = 0.2;
type Pt = (x: number, y: number, z: number) => number[];
/** Octagonal rings lofted into a faceted solid (each ring: height, centre z, half-width, front, back, centre x; all × H). */
function loft(pb: PropBatch, P: Pt, H: number, rings: number[][], color: number, diag = true) {
  const pts = rings.map(([y, cz, a, f, b, cx = 0]) => [[-a * 0.7, f], [a * 0.7, f], [a, f * 0.45], [a, -b * 0.45], [a * 0.7, -b], [-a * 0.7, -b], [-a, -b * 0.45], [-a, f * 0.45]].map(([x, z]) => P((cx + x) * H, y * H, (cz + z) * H)));
  sew(pb, pts, color, diag);
}
/** Octagonal rings standing across z (each: z, middle height, half-width, half-height, middle x; all × H). */
function loftZ(pb: PropBatch, P: Pt, H: number, rings: number[][], color: number) {
  const pts = rings.map(([z, cy, a, b, cx = 0]) => [[-0.7, 1], [0.7, 1], [1, 0.45], [1, -0.45], [0.7, -1], [-0.7, -1], [-1, -0.45], [-1, 0.45]].map(([u, v]) => P((cx + u * a) * H, (cy + v * b) * H, z * H)));
  sew(pb, pts, color, true);
}
function sew(pb: PropBatch, pts: number[][][], color: number, diag: boolean) {
  for (let r = 0; r + 1 < pts.length; r++) for (let i = 0; i < 8; i++) {
    const j = (i + 1) % 8, a = pts[r][i], b = pts[r][j], c = pts[r + 1][j], d = pts[r + 1][i];
    pb.face(a, b, c, d); pb.seg(color, a, b); pb.seg(color, a, d);
    if (diag && (r + i) % 3 === 0) pb.seg(color, a, c);
  }
  pb.face(...pts[0]); const top = pts[pts.length - 1]; pb.face(...top); pb.line(color, ...top, top[0]); pb.line(color, ...pts[0], pts[0][0]);
}
const quad = (P: Pt, x0: number, x1: number, y: number, z0: number, z1: number) => [P(x0, y, z0), P(x1, y, z0), P(x1, y, z1), P(x0, y, z1)];
/**
 * (0.276) A great wing folded along the flank (side ±1), in the sphinx's frame: rising from the shoulder to the wrist
 * over the back, the long flight feathers sweeping down behind it to a raised tip past the rump. [z, y] along the edge
 * from the root, round the leading edge and back along the trailing one; it stands off the flank a little more towards
 * the tip.
 */
const LEAD: [number, number][] = [[0.1, 0.6], [0.05, 0.78], [-0.02, 0.95], [-0.12, 1.08], [-0.24, 1.07], [-0.4, 0.97], [-0.58, 0.83], [-0.76, 0.67], [-0.92, 0.52]];
/** The flight feathers' tips along the trailing edge, from the wing's tip back towards the shoulder. */
const TIPS: [number, number][] = [[-0.84, 0.45], [-0.72, 0.39], [-0.6, 0.36], [-0.47, 0.35], [-0.34, 0.37], [-0.21, 0.42], [-0.08, 0.5]];
const WMID: [number, number] = [-0.38, 0.72];
/** Between two feather tips the edge cuts back in towards the wing's middle (the notch). */
const notch = (a: [number, number], b: [number, number]): [number, number] => { const z = (a[0] + b[0]) / 2, y = (a[1] + b[1]) / 2; return [z + (WMID[0] - z) * 0.18, y + (WMID[1] - y) * 0.18]; };
/** The wing's outline: up the leading edge, then back along the notched trailing edge. */
const WING: [number, number][] = [...LEAD, ...TIPS.flatMap((t, i): [number, number][] => i + 1 < TIPS.length ? [t, notch(t, TIPS[i + 1])] : [t])];
const wingX = (z: number, y: number) => 0.17 + Math.max(0, 0.1 - z) * 0.15 + Math.max(0, y - 0.75) * 0.09;
function drawWing(pb: PropBatch, P: Pt, H: number, side: number) {
  const at = (z: number, y: number, out = 0) => P(side * (wingX(z, y) + out) * H, y * H, z * H), n = WING.length;
  const toward = (p: [number, number], k: number): [number, number] => [p[0] + (WMID[0] - p[0]) * k, p[1] + (WMID[1] - p[1]) * k];
  // the wing as a thin slab: its outer face and its inner face, joined at the edge
  for (let i = 0; i < n; i++) {
    const [z0, y0] = WING[i], [z1, y1] = WING[(i + 1) % n];
    pb.face(at(WMID[0], WMID[1], 0.028), at(z0, y0, 0.012), at(z1, y1, 0.012));
    pb.face(at(WMID[0], WMID[1], -0.012), at(z1, y1, -0.004), at(z0, y0, -0.004));
    pb.face(at(z0, y0, 0.012), at(z0, y0, -0.004), at(z1, y1, -0.004), at(z1, y1, 0.012));
    pb.seg(SAND, at(z0, y0, 0.013), at(z1, y1, 0.013));
  }
  // the leading edge: a heavy rolled bone from the shoulder over the wrist to the tip
  pb.line(CROWN, ...LEAD.map(([z, y]) => at(z, y, 0.03)));
  // rows of scalloped coverts along the leading edge, each feather a rounded lobe
  for (let row = 1; row <= 3; row++) {
    const k = row * 0.15, pts: number[][] = [];
    for (let i = 1; i < LEAD.length - 1; i++) {
      const p = toward(LEAD[i], k), q = toward(LEAD[i + 1], k);
      for (let j = 0; j < 4; j++) { // a rounded lobe: the edge bowed in towards the wing's middle
        const t = j / 4, b = Math.sin(Math.PI * t) * 0.05, z = p[0] + (q[0] - p[0]) * t, y = p[1] + (q[1] - p[1]) * t, dz = WMID[0] - z, dy = WMID[1] - y, L = Math.hypot(dz, dy) || 1;
        pts.push(at(z + dz / L * b, y + dy / L * b, 0.028 + b * 0.05));
      }
    }
    pts.push(at(...toward(LEAD[LEAD.length - 1], k), 0.027));
    pb.line(SAND, ...pts);
  }
  // the long flight feathers: each from under the coverts out to its own tip, with the notches between them
  for (let i = 0; i < TIPS.length; i++) {
    const t = TIPS[i], root = toward(t, 0.6);
    pb.seg(CROWN, at(root[0], root[1], 0.03), at(t[0], t[1], 0.016)); // the quill
    if (i + 1 < TIPS.length) { const nn = notch(t, TIPS[i + 1]), r2 = toward(nn, 0.5); pb.seg(CRACK, at(r2[0], r2[1], 0.028), at(nn[0], nn[1], 0.016)); }
  }
}
/**
 * One sphinx (gen/colossi.ts), (0.276) a winged lion seated upright: rounded hindquarters with the thighs folded along
 * them, the back rising to broad shoulders, straight front legs on great paws, a woman's face under long stone hair, a
 * diadem and a broad collar, and two great feathered wings folded along the flanks with their tips raised behind.
 */
export function drawSphinx(pb: PropBatch, o: Pick<Colossus, 'x' | 'y' | 'z' | 'h' | 'yaw' | 'lean' | 'roll' | 'seed'>) {
  const H = o.h, P = tiltFrame(o.lean, o.roll, o.yaw, o.x, o.y, o.z), X = (v: number) => v * H;
  loftZ(pb, P, H, HAUNCH, SAND);
  loft(pb, P, H, TORSO, SAND);
  loft(pb, P, H, HEAD.map(([y, a, f, b]) => [y, HZ, a, f, b]), SAND, false);
  // the spine: a ridge from the rump up the back to the neck
  pb.line(CROWN, P(0, X(0.3), X(-0.5)), P(0, X(0.39), X(-0.38)), P(0, X(0.41), X(-0.22)), P(0, X(0.4), X(-0.12)), P(0, X(0.47), X(-0.06)), P(0, X(0.6), X(0.03)), P(0, X(0.71), X(0.1)));
  for (const side of [-1, 1]) {
    // the hind thigh folded along the haunch, its knee forward, and the hind paw before it on the ground
    loftZ(pb, P, H, [[-0.42, 0.13, 0.04, 0.08, side * 0.215], [-0.34, 0.17, 0.07, 0.15, side * 0.235], [-0.2, 0.15, 0.07, 0.14, side * 0.235], [-0.08, 0.1, 0.05, 0.09, side * 0.22], [-0.02, 0.07, 0.03, 0.05, side * 0.21]], SAND);
    pb.solid8(quad(P, X(side * 0.21 - 0.05), X(side * 0.21 + 0.05), 0, X(-0.06), X(0.12)), quad(P, X(side * 0.21 - 0.045), X(side * 0.21 + 0.045), X(0.055), X(-0.04), X(0.11)), SAND);
    // the front leg: the upper arm down from the shoulder to the elbow, the straight forearm, the great paw with its toes
    const lx = side * 0.105;
    loft(pb, P, H, [[0.32, 0.24, 0.05, 0.05, 0.06, lx], [0.45, 0.21, 0.065, 0.065, 0.075, lx * 1.05], [0.58, 0.16, 0.055, 0.06, 0.06, lx * 1.1]], SAND);
    pb.solid8(quad(P, X(lx - 0.055), X(lx + 0.055), X(0.36), X(0.19), X(0.29)), quad(P, X(lx - 0.042), X(lx + 0.042), X(0.06), X(0.28), X(0.37)), SAND);
    pb.solid8(quad(P, X(lx - 0.058), X(lx + 0.058), 0, X(0.26), X(0.48)), quad(P, X(lx - 0.052), X(lx + 0.052), X(0.075), X(0.28), X(0.455)), SAND);
    for (const t of [-0.036, -0.012, 0.012, 0.036]) { // four toes, each with a claw line
      pb.seg(CRACK, P(X(lx + t), X(0.075), X(0.43)), P(X(lx + t), X(0.02), X(0.48)));
      pb.seg(CROWN, P(X(lx + t), X(0.015), X(0.48)), P(X(lx + t * 1.1), 0, X(0.5)));
    }
    // long stone hair falling down past the cheeks onto the breast
    pb.solid8(quad(P, X(side * 0.075), X(side * 0.102), X(0.93), X(HZ - 0.05), X(HZ + 0.03)), quad(P, X(side * 0.1), X(side * 0.145), X(0.6), X(HZ - 0.02), X(HZ + 0.075)), SAND);
    for (let k = 1; k < 4; k++) pb.seg(CRACK, P(X(side * (0.075 + 0.006 * k)), X(0.92), X(HZ + 0.032)), P(X(side * (0.1 + 0.011 * k)), X(0.61), X(HZ + 0.077))); // its strands
    drawWing(pb, P, H, side);
  }
  // the hair down the back of the head to the shoulders
  pb.solid8(quad(P, X(-0.09), X(0.09), X(0.97), X(HZ - 0.1), X(HZ - 0.04)), quad(P, X(-0.13), X(0.13), X(0.62), X(HZ - 0.12), X(HZ - 0.05)), SAND);
  // the tail curled along the ground round the haunch to a tuft by the paw
  pb.line(CRACK, P(X(0.06), X(0.06), X(-0.52)), P(X(0.2), X(0.02), X(-0.5)), P(X(0.28), X(0.02), X(-0.32)), P(X(0.29), X(0.02), X(-0.1)), P(X(0.26), X(0.03), X(0.06)));
  for (const q of [-0.4, 0, 0.4]) pb.seg(CROWN, P(X(0.26), X(0.03), X(0.06)), P(X(0.26 + Math.sin(q) * 0.03), X(0.04), X(0.06 + Math.cos(q) * 0.04)));
  // the face: a straight nose, full lips, and the calm eyes that may open
  const fz = (HZ + 0.104) * H, n0 = 0.84, n1 = 0.89;
  pb.solid8([P(X(-0.014), X(n0), fz - X(0.005)), P(X(0.014), X(n0), fz - X(0.005)), P(X(0.01), X(n0), fz + X(0.022)), P(X(-0.01), X(n0), fz + X(0.022))],
    [P(X(-0.008), X(n1), fz - X(0.004)), P(X(0.008), X(n1), fz - X(0.004)), P(X(0.005), X(n1), fz + X(0.004)), P(X(-0.005), X(n1), fz + X(0.004))], SAND);
  pb.line(CRACK, P(X(-0.025), X(0.81), fz + X(0.004)), P(0, X(0.805), fz + X(0.008)), P(X(0.025), X(0.81), fz + X(0.004)));
  pb.line(CRACK, P(X(-0.02), X(0.8), fz + X(0.003)), P(0, X(0.795), fz + X(0.006)), P(X(0.02), X(0.8), fz + X(0.003)));
  drawEyes(pb, P, H, 0.905, fz - X(0.006), 0.036, 0.02, 0.0095);
  // the diadem round the brow, a stone set over the eyes, and the broad collar over the breast
  const ring = (y: number, f: number, s = 1) => Array.from({ length: 9 }, (_, k) => { const q = -Math.PI * 0.85 + k / 8 * Math.PI * 1.7; return P(X(Math.sin(q) * 0.095 * s), X(y), X(HZ + Math.cos(q) * f * s)); });
  pb.line(CROWN, ...ring(0.955, 0.09, 1.05));
  pb.line(GLOW, P(0, X(0.95), fz + X(0.004)), P(X(0.01), X(0.962), fz + X(0.002)), P(0, X(0.975), fz), P(X(-0.01), X(0.962), fz + X(0.002)), P(0, X(0.95), fz + X(0.004)));
  for (let k = 0; k < 3; k++) {
    const y = 0.66 - k * 0.035, pts = Array.from({ length: 11 }, (_, i) => { const q = -1.3 + i / 10 * 2.6; return P(X(Math.sin(q) * (0.165 + k * 0.012)), X(y), X(0.13 + Math.cos(q) * (0.135 + k * 0.012))); });
    pb.line(CROWN, ...pts);
  }
  // weathering: cracks down the flanks
  const R = rng(hash(o.seed, 0x5f1));
  for (let k = 0; k < 6; k++) {
    const side = R() < 0.5 ? -1 : 1, y0 = 0.08 + R() * 0.2, z0 = -0.4 + R() * 0.25;
    pb.line(CRACK, P(X(side * 0.236), X(y0 + 0.12), X(z0)), P(X(side * 0.24), X(y0 + 0.05), X(z0 + 0.03)), P(X(side * 0.236), X(y0), X(z0 - 0.02)));
  }
}
/** Where a sphinx's eyes are (for their glow by night). */
const sphinxEyes = (o: Colossus) => { const P = tiltFrame(o.lean, o.roll, o.yaw, o.x, o.y, o.z), H = o.h; return [-1, 1].map((s) => P(s * 0.035 * H, 0.9 * H, (HZ + 0.1) * H)); };

interface Live { s: ColossusSite; g: THREE.Group; ox: number; list: Colossus[]; caps: Capsule[]; eyes: number[][] }
const live = new Map<string, Live>();
let tick = 0;
function build(s: ColossusSite): Live {
  const T = OW.terrain!, ox = nearX(s.x, G.pos.x), dx = ox - s.x, list = s.list.map((o) => ({ ...o, x: o.x + dx }));
  const y0 = Math.round(T.heightAt(ox, s.z)), pb = new PropBatch(), caps: Capsule[] = [], eyes: number[][] = [];
  for (const o of list) {
    const local = { ...o, x: o.x - ox, y: o.y - y0, z: o.z - s.z };
    if (o.k === 'head') drawHead(pb, local); else { drawSphinx(pb, local); eyes.push(...sphinxEyes(o)); }
    caps.push(...colossusCapsules(o));
    // the ground heaved round its foot: boulders and broken earth
    const R = rng(hash(o.seed, 0xb01d)), n = 5 + Math.floor(R() * 4);
    for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 2, d = o.h * (0.3 + R() * 0.3), r = 1.4 + R() * 3, x = o.x + Math.cos(a) * d, z = o.z + Math.sin(a) * d, h = r * (0.7 + R() * 0.7);
      const gy = T.heightAt(x, z);
      pb.rock(x - ox, gy - y0 - r * 0.25, z - s.z, r, h, 6 + Math.floor(R() * 3), R() * Math.PI, BOULDER);
      caps.push({ a: [x, gy - 1, z], b: [x, gy + h * 0.6, z], r: r * 0.7 });
    }
  }
  const g = pb.build(); g.position.set(ox, y0, s.z); scene.add(g);
  return { s, g, ox, list, caps, eyes };
}
function drop(L: Live) { scene.remove(L.g); disposeTree(L.g); }
export function dropColossi() { for (const L of live.values()) drop(L); live.clear(); }
/** Main loop: the colossi within sight drawn (checked twice a second). */
export function updateColossi(dt: number) {
  const T = OW.terrain;
  if (!T || G.char.loc !== 'overworld') { if (live.size) dropColossi(); return; }
  if ((tick -= dt) > 0) return;
  tick = 0.5;
  const seen = new Set<string>();
  for (const s of colossiNear(T.world, G.pos.x, G.pos.z, DROP)) {
    if (!live.has(s.id) && worldDist(s.x, s.z, G.pos.x, G.pos.z) > NEAR + s.r) continue;
    seen.add(s.id);
    const L = live.get(s.id);
    if (L && L.ox === nearX(s.x, G.pos.x)) continue;
    if (L) drop(L);
    live.set(s.id, build(s));
  }
  for (const [id, L] of live) if (!seen.has(id)) { drop(L); live.delete(id); }
}
/** A body (feet at y, r wide) runs into a colossus or the boulders at its foot. */
export function colossusHit(x: number, y: number, z: number, r: number): boolean {
  for (const L of live.values()) if (Math.abs(x - L.ox) < L.s.r + 30 && Math.abs(z - L.s.z) < L.s.r + 30 && capsulesHit(L.caps, x, y, z, r)) return true;
  return false;
}
/** Where a ray first meets a colossus (shots and sight lines stop there), or maxT. */
export function colossusRay(o: V3, d: V3, maxT: number): number {
  let best = maxT;
  const mx = o.x + d.x * maxT / 2, mz = o.z + d.z * maxT / 2;
  for (const L of live.values()) {
    if (Math.hypot(mx - L.ox, mz - L.s.z) > L.s.r + 40 + maxT / 2) continue;
    for (const c of L.caps) {
      const ax = c.b[0] - c.a[0], ay = c.b[1] - c.a[1], az = c.b[2] - c.a[2], len = Math.hypot(ax, ay, az) || 1;
      best = rayRod(o, d, best, { x: c.a[0], y: c.a[1], z: c.a[2] }, { x: ax / len, y: ay / len, z: az / len }, len, c.r);
    }
  }
  return best;
}
/** The name of the colossus you stand by, for the HUD's place name. */
export function colossusName(x: number, z: number): string | null {
  for (const L of live.values()) if (Math.hypot(x - L.ox, z - L.s.z) < L.s.r + 10) {
    const s = L.s;
    return s.k === 'head' ? TL`Stone head: ${s.name}` : s.list.length > 1 ? TL`Sphinx gate: the ${s.name} Gate` : TL`Sphinx: the ${s.name} Sphinx`;
  }
  return null;
}
/** Near a colossus (they are seen from far off: the view reaches further, like at the megaliths). */
export const nearColossus = (x: number, z: number) => [...live.values()].some((L) => Math.hypot(x - L.ox, z - L.s.z) < L.s.r + 260);
addGlows((out) => {
  if (G.char.loc !== 'overworld' || daylight(G.char.time, sunTilt(latitude(G.pos.z))) > 0.5) return;
  for (const L of live.values()) for (const [x, y, z] of L.eyes) out.push({ x, y, z, c: GLOW, s: 0.025, a: 0.55, far: 1500 });
});
