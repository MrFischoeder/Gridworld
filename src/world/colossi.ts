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
 * The sphinx's body from the ground to the neck, as horizontal rings: [height, middle (forward), half-width, front,
 * back] as shares of H. Seated upright on its haunches: the rump spread on the ground behind, the back rising to the
 * shoulders, the chest thrust forward over the straight front legs.
 */
const BODY = [
  [0, -0.18, 0.21, 0.3, 0.26], [0.12, -0.17, 0.22, 0.28, 0.27], [0.24, -0.14, 0.2, 0.22, 0.24], [0.34, -0.06, 0.16, 0.2, 0.17],
  [0.46, 0.04, 0.17, 0.2, 0.13], [0.58, 0.1, 0.18, 0.17, 0.12], [0.66, 0.13, 0.14, 0.12, 0.1], [0.73, 0.17, 0.075, 0.08, 0.07],
];
/** The head: [height, half-width, front, back] round its middle at z 0.2 H. */
const HEAD = [[0.73, 0.075, 0.075, 0.07], [0.77, 0.085, 0.095, 0.08], [0.83, 0.09, 0.1, 0.09], [0.88, 0.088, 0.1, 0.095], [0.94, 0.08, 0.085, 0.09], [0.985, 0.06, 0.06, 0.07], [1, 0.03, 0.03, 0.04]];
const HZ = 0.2;
type Pt = (x: number, y: number, z: number) => number[];
/** Octagonal rings lofted into a faceted solid (each ring: centre z, height, half-width, front, back; all × H). */
function loft(pb: PropBatch, P: Pt, H: number, rings: [number, number, number, number, number][], color: number, diag = true) {
  const pts = rings.map(([y, cz, a, f, b]) => [[-a * 0.7, f], [a * 0.7, f], [a, f * 0.45], [a, -b * 0.45], [a * 0.7, -b], [-a * 0.7, -b], [-a, -b * 0.45], [-a, f * 0.45]].map(([x, z]) => P(x * H, y * H, (cz + z) * H)));
  for (let r = 0; r + 1 < pts.length; r++) for (let i = 0; i < 8; i++) {
    const j = (i + 1) % 8, a = pts[r][i], b = pts[r][j], c = pts[r + 1][j], d = pts[r + 1][i];
    pb.face(a, b, c, d); pb.seg(color, a, b); pb.seg(color, a, d);
    if (diag && (r + i) % 3 === 0) pb.seg(color, a, c);
  }
  pb.face(...pts[0]); const top = pts[pts.length - 1]; pb.face(...top); pb.line(color, ...top, top[0]);
}
const quad = (P: Pt, x0: number, x1: number, y: number, z0: number, z1: number) => [P(x0, y, z0), P(x1, y, z0), P(x1, y, z1), P(x0, y, z1)];
/** One sphinx (gen/colossi.ts): a lion seated upright, a woman's face under long stone hair, a diadem, a broad collar. */
export function drawSphinx(pb: PropBatch, o: Pick<Colossus, 'x' | 'y' | 'z' | 'h' | 'yaw' | 'lean' | 'roll' | 'seed'>) {
  const H = o.h, P = tiltFrame(o.lean, o.roll, o.yaw, o.x, o.y, o.z);
  loft(pb, P, H, BODY.map(([y, cz, a, f, b]) => [y, cz, a, f, b]) as [number, number, number, number, number][], SAND);
  loft(pb, P, H, HEAD.map(([y, a, f, b]) => [y, HZ, a, f, b]) as [number, number, number, number, number][], SAND, false);
  const X = (v: number) => v * H;
  // the front legs, straight down from the shoulders, and the great paws on the ground
  for (const side of [-1, 1]) {
    const lx = side * 0.1;
    pb.solid8(quad(P, X(lx - 0.06), X(lx + 0.06), X(0.52), X(0.14), X(0.26)), quad(P, X(lx - 0.045), X(lx + 0.045), X(0.06), X(0.28), X(0.37)), SAND);
    pb.solid8(quad(P, X(lx - 0.055), X(lx + 0.055), 0, X(0.27), X(0.47)), quad(P, X(lx - 0.05), X(lx + 0.05), X(0.07), X(0.28), X(0.45)), SAND);
    for (const t of [-0.025, 0, 0.025]) pb.seg(CRACK, P(X(lx + t), X(0.04), X(0.47)), P(X(lx + t), X(0.07), X(0.43))); // the toes
    // the hind leg folded along the flank, its paw on the ground before the haunch
    const hx = side * 0.21;
    pb.solid8(quad(P, X(hx - 0.03), X(hx + 0.03), 0, X(-0.36), X(-0.04)), quad(P, X(hx - 0.02), X(hx + 0.02), X(0.2), X(-0.3), X(-0.12)), SAND);
    pb.solid8(quad(P, X(hx - 0.045), X(hx + 0.045), 0, X(-0.02), X(0.12)), quad(P, X(hx - 0.04), X(hx + 0.04), X(0.05), X(-0.01), X(0.1)), SAND);
    // long stone hair falling down past the cheeks onto the breast
    pb.solid8(quad(P, X(side * 0.075), X(side * 0.1), X(0.93), X(HZ - 0.05), X(HZ + 0.03)), quad(P, X(side * 0.1), X(side * 0.14), X(0.6), X(HZ - 0.02), X(HZ + 0.07)), SAND);
    for (let k = 1; k < 4; k++) pb.seg(CRACK, P(X(side * (0.075 + 0.006 * k)), X(0.92), X(HZ + 0.032)), P(X(side * (0.1 + 0.01 * k)), X(0.61), X(HZ + 0.072))); // its strands
  }
  // the hair down the back of the head to the shoulders
  pb.solid8(quad(P, X(-0.09), X(0.09), X(0.97), X(HZ - 0.1), X(HZ - 0.04)), quad(P, X(-0.13), X(0.13), X(0.62), X(HZ - 0.12), X(HZ - 0.05)), SAND);
  // the tail curled along the ground round the haunch
  pb.line(CRACK, P(X(0.12), X(0.02), X(-0.45)), P(X(0.24), X(0.02), X(-0.42)), P(X(0.28), X(0.02), X(-0.2)), P(X(0.27), X(0.03), X(0.02)), P(X(0.22), X(0.05), X(0.1)));
  // the face: a straight nose, full lips, and the calm eyes that may open
  const fz = (HZ + 0.1) * H, n0 = 0.84, n1 = 0.89;
  pb.solid8([P(X(-0.014), X(n0), fz - X(0.005)), P(X(0.014), X(n0), fz - X(0.005)), P(X(0.01), X(n0), fz + X(0.022)), P(X(-0.01), X(n0), fz + X(0.022))],
    [P(X(-0.008), X(n1), fz - X(0.004)), P(X(0.008), X(n1), fz - X(0.004)), P(X(0.005), X(n1), fz + X(0.004)), P(X(-0.005), X(n1), fz + X(0.004))], SAND);
  pb.line(CRACK, P(X(-0.025), X(0.81), fz + X(0.004)), P(0, X(0.805), fz + X(0.008)), P(X(0.025), X(0.81), fz + X(0.004)));
  pb.line(CRACK, P(X(-0.02), X(0.8), fz + X(0.003)), P(0, X(0.795), fz + X(0.006)), P(X(0.02), X(0.8), fz + X(0.003)));
  drawEyes(pb, P, H, 0.905, fz - X(0.006), 0.035, 0.019, 0.009);
  // the diadem round the brow, a stone set over the eyes, and the broad collar over the breast
  const ring = (y: number, f: number, s = 1) => Array.from({ length: 9 }, (_, k) => { const q = -Math.PI * 0.85 + k / 8 * Math.PI * 1.7; return P(X(Math.sin(q) * 0.092 * s), X(y), X(HZ + Math.cos(q) * f * s)); });
  pb.line(CROWN, ...ring(0.955, 0.088, 1.05));
  pb.line(GLOW, P(0, X(0.95), fz + X(0.004)), P(X(0.01), X(0.962), fz + X(0.002)), P(0, X(0.975), fz), P(X(-0.01), X(0.962), fz + X(0.002)), P(0, X(0.95), fz + X(0.004)));
  for (let k = 0; k < 3; k++) {
    const y = 0.66 - k * 0.035, pts = Array.from({ length: 11 }, (_, i) => { const q = -1.3 + i / 10 * 2.6; return P(X(Math.sin(q) * (0.16 + k * 0.012)), X(y), X(0.13 + Math.cos(q) * (0.13 + k * 0.012))); });
    pb.line(CROWN, ...pts);
  }
  // weathering: cracks down the flanks and the back
  const R = rng(hash(o.seed, 0x5f1));
  for (let k = 0; k < 6; k++) {
    const side = R() < 0.5 ? -1 : 1, y0 = 0.1 + R() * 0.4, z0 = -0.25 + R() * 0.3;
    pb.line(CRACK, P(X(side * 0.205), X(y0 + 0.12), X(z0)), P(X(side * 0.212), X(y0 + 0.05), X(z0 + 0.03)), P(X(side * 0.208), X(y0), X(z0 - 0.02)));
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
