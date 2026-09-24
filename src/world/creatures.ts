// Wild creatures of the open world: Ravager packs, territorial Brambles and diving Leechwings.
// Spawns and movement use Math.random (unsaved, like drones); models are built from PropBatch.
import * as THREE from 'three';
import { nearX } from '../gen/regions';
import { onNoise } from './noise';
import { scene, V, lineMat } from './render';
import { G, W } from '../game';
import { PropBatch, sharedFill } from './props';
import { CREATURES, HOSTILE, CALM, DROPS, type CreatureKind } from '../data/creatures';
import { foeRules } from './enemies';
import { rayWorld } from './player';
import { burst } from './fx';
import { dropCrystal, dropPickup } from './loot';
import { logLine, showToast } from '../ui/hud';
import { onKill } from './quests';
import { mayspawn } from './threat';
import { ALPHA, type Quest } from '../gen/quests';
import { textSprite } from './npc';

type State = 'roam' | 'hunt' | 'dash' | 'retreat' | 'threat' | 'charge' | 'recover' | 'stalk' | 'dive' | 'climb' | 'investigate';

export interface Creature {
  kind: CreatureKind; boss?: false;
  g: THREE.Group; mat: THREE.LineBasicMaterial;
  /** Body centre (the hit sphere is around it). */
  p: THREE.Vector3; heading: number; speed: number;
  hp: number; maxHp: number; r: number; flash: number;
  state: State; timer: number; anim: number;
  legs: THREE.Group[]; wings: THREE.Group[]; head: THREE.Group | null; jaw: THREE.Group | null; tail: THREE.Group | null;
  pack: Creature[] | null; flank: number; home: THREE.Vector3; dir: THREE.Vector3; level: number; hurt: boolean;
  /** Part of a notice-board hunt (kept around longer, reported on death); the leader is the `alpha`. */
  questId?: string; alpha?: boolean; dmgMul: number;
  /** Where a noise came from (state 'investigate'). */
  noiseAt: THREE.Vector3 | null;
  /** Leechwing flight: orbit angle, banking into turns, the creature it is hunting (null = the player), spotted you yet. */
  orbit: number; bank: number; prey: Creature | null; spotted: boolean;
}

// ---------- models (local +z forward, origin at the body centre) ----------
type P = number[];
/** Four-sided spike from a base centre along a direction. */
function spike(pb: PropBatch, c: P, dir: P, len: number, w: number, color: number) {
  const n = Math.hypot(dir[0], dir[1], dir[2]), d = dir.map((v) => v / n);
  const up = Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const a = [d[1] * up[2] - d[2] * up[1], d[2] * up[0] - d[0] * up[2], d[0] * up[1] - d[1] * up[0]], an = Math.hypot(...a), u = a.map((v) => v / an);
  const b = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]];
  const tip = c.map((v, i) => v + d[i] * len), base = [[1, 0], [0, 1], [-1, 0], [0, -1]].map(([s, t]) => c.map((v, i) => v + (u[i] * s + b[i] * t) * w));
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; pb.seg(color, base[i], tip); pb.seg(color, base[i], base[j]); pb.face(base[i], base[j], tip); }
}
const box8 = (pb: PropBatch, b: P[], t: P[], c: number) => pb.solid8(b, t, c);
function finish(pb: PropBatch, mat: THREE.LineBasicMaterial): THREE.Group {
  const g = pb.build();
  g.traverse((o) => { if ((o as THREE.LineSegments).isLineSegments) (o as THREE.LineSegments).material = mat; else if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = sharedFill(); });
  return g;
}
/** A jointed leg: hip at the group origin, knee, foot on the ground (-drop), a few claws. */
function leg(mat: THREE.LineBasicMaterial, knee: P, foot: P, thick: number, claws = 3): THREE.Group {
  const pb = new PropBatch(), C = 0;
  if (thick > 0.12) {
    const t = thick;
    box8(pb, [[-t, -0.05, -t], [t, -0.05, -t], [t, -0.05, t], [-t, -0.05, t]].map((q) => [q[0], q[1], q[2]]),
      [[-t, 0.1, -t], [t, 0.1, -t], [t, 0.1, t], [-t, 0.1, t]], C);
    box8(pb, [[knee[0] - t, knee[1], knee[2] - t], [knee[0] + t, knee[1], knee[2] - t], [knee[0] + t, knee[1], knee[2] + t], [knee[0] - t, knee[1], knee[2] + t]],
      [[-t, 0, -t], [t, 0, -t], [t, 0, t], [-t, 0, t]], C);
    box8(pb, [[foot[0] - t * 1.2, foot[1], foot[2] - t * 1.2], [foot[0] + t * 1.2, foot[1], foot[2] - t * 1.2], [foot[0] + t * 1.2, foot[1], foot[2] + t * 1.3], [foot[0] - t * 1.2, foot[1], foot[2] + t * 1.3]],
      [[knee[0] - t * 0.9, knee[1], knee[2] - t * 0.9], [knee[0] + t * 0.9, knee[1], knee[2] - t * 0.9], [knee[0] + t * 0.9, knee[1], knee[2] + t * 0.9], [knee[0] - t * 0.9, knee[1], knee[2] + t * 0.9]], C);
  } else {
    pb.line(C, [0, 0, 0], knee, foot); pb.line(C, [thick, 0, 0], [knee[0] + thick, knee[1], knee[2]], [foot[0] + thick * 0.5, foot[1], foot[2]]);
  }
  for (let i = 0; i < claws; i++) { const a = (i - (claws - 1) / 2) * 0.35; pb.line(C, foot, [foot[0] + Math.sin(a) * 0.12, foot[1] - 0.02, foot[2] + Math.cos(a) * 0.14]); }
  const g = finish(pb, mat);
  const pivot = new THREE.Group(); pivot.add(g); return pivot;
}

function ravagerModel(c: Creature) {
  const pb = new PropBatch(), m = c.mat, K = 0;
  // torso: deep chest, narrower hips
  box8(pb, [[-0.17, -0.02, -0.6], [0.17, -0.02, -0.6], [0.21, -0.14, 0.45], [-0.21, -0.14, 0.45]], [[-0.13, 0.14, -0.6], [0.13, 0.14, -0.6], [0.18, 0.24, 0.45], [-0.18, 0.24, 0.45]], K);
  // neck and head (wedge snout)
  box8(pb, [[-0.2, -0.1, 0.45], [0.2, -0.1, 0.45], [0.13, 0.02, 0.75], [-0.13, 0.02, 0.75]], [[-0.2, 0.3, 0.45], [0.2, 0.3, 0.45], [0.12, 0.28, 0.75], [-0.12, 0.28, 0.75]], K);
  box8(pb, [[-0.13, 0.04, 0.75], [0.13, 0.04, 0.75], [0.04, 0.02, 1.18], [-0.04, 0.02, 1.18]], [[-0.12, 0.28, 0.75], [0.12, 0.28, 0.75], [0.04, 0.12, 1.18], [-0.04, 0.12, 1.18]], K);
  pb.line(K, [-0.1, 0.2, 0.86], [-0.06, 0.22, 0.9]); pb.line(K, [0.1, 0.2, 0.86], [0.06, 0.22, 0.9]); // eyes
  // spine ridge of spikes
  for (let i = 0; i < 9; i++) { const z = -0.55 + i * 0.15, y = 0.12 + (z + 0.6) / 1.05 * 0.18; spike(pb, [0, y, z], [0, 1, -0.5], 0.14 + (i % 3) * 0.05, 0.035, K); }
  // tail curving up and back
  const tail: P[] = [[0, 0.02, -0.6], [0, 0.1, -0.95], [0, 0.28, -1.25], [0, 0.5, -1.45]];
  for (let i = 0; i + 1 < tail.length; i++) { const w = 0.1 * (1 - i / 3) + 0.02; box8(pb, [[-w, tail[i][1] - w, tail[i][2]], [w, tail[i][1] - w, tail[i][2]], [w * 0.7, tail[i + 1][1] - w * 0.7, tail[i + 1][2]], [-w * 0.7, tail[i + 1][1] - w * 0.7, tail[i + 1][2]]], [[-w, tail[i][1] + w, tail[i][2]], [w, tail[i][1] + w, tail[i][2]], [w * 0.7, tail[i + 1][1] + w * 0.7, tail[i + 1][2]], [-w * 0.7, tail[i + 1][1] + w * 0.7, tail[i + 1][2]]], K); }
  c.g.add(finish(pb, m));
  // lower jaw with teeth (opens when biting)
  const jb = new PropBatch();
  box8(jb, [[-0.1, -0.06, 0], [0.1, -0.06, 0], [0.03, -0.04, 0.4], [-0.03, -0.04, 0.4]], [[-0.1, 0.02, 0], [0.1, 0.02, 0], [0.03, 0.01, 0.4], [-0.03, 0.01, 0.4]], K);
  const teeth: P[] = []; for (let i = 0; i <= 8; i++) teeth.push([0, 0.02 + (i % 2) * 0.06, 0.02 + i * 0.045]);
  jb.line(K, ...teeth.map((t) => [0.07 - t[2] * 0.1, t[1], t[2]])); jb.line(K, ...teeth.map((t) => [-0.07 + t[2] * 0.1, t[1], t[2]]));
  c.jaw = new THREE.Group(); c.jaw.add(finish(jb, m)); c.jaw.position.set(0, 0.04, 0.78); c.g.add(c.jaw);
  // legs
  for (const [x, z, fz] of [[-0.2, 0.35, 0.15], [0.2, 0.35, 0.15], [-0.17, -0.5, -0.1], [0.17, -0.5, -0.1]]) {
    const l = leg(m, [x * 0.2, -0.36, fz > 0 ? -0.1 : 0.16], [x * 0.1, -0.64, fz], 0.03);
    l.position.set(x, -0.02, z); c.g.add(l); c.legs.push(l);
  }
}
function brambleModel(c: Creature) {
  const pb = new PropBatch(), m = c.mat, K = 0;
  // two faceted masses: high shoulders, lower hips, with armour bands
  box8(pb, [[-0.85, -0.45, 0], [0.85, -0.45, 0], [0.7, -0.35, 1.2], [-0.7, -0.35, 1.2]], [[-0.6, 0.78, 0], [0.6, 0.78, 0], [0.45, 0.6, 1.2], [-0.45, 0.6, 1.2]], K);
  box8(pb, [[-0.7, -0.4, -1.4], [0.7, -0.4, -1.4], [0.85, -0.45, 0], [-0.85, -0.45, 0]], [[-0.45, 0.35, -1.4], [0.45, 0.35, -1.4], [0.6, 0.78, 0], [-0.6, 0.78, 0]], K);
  for (const z of [-0.9, -0.45, 0.45, 0.85]) {
    const k = z < 0 ? 1 + z / 1.4 * 0.35 : 1 - z / 1.2 * 0.2, top = z < 0 ? 0.78 + z / 1.4 * 0.43 : 0.78 - z / 1.2 * 0.18;
    pb.line(K, [-0.86 * k, -0.44, z], [-0.62 * k, top * 0.6, z], [0, top + 0.02, z], [0.62 * k, top * 0.6, z], [0.86 * k, -0.44, z]);
  }
  // back spikes, biggest over the shoulders
  const row = [[-1.2, 0.36, 0.35], [-0.8, 0.5, 0.45], [-0.4, 0.62, 0.55], [0, 0.78, 0.8], [0.35, 0.72, 0.7], [0.7, 0.66, 0.55], [1.0, 0.62, 0.4]];
  for (const [z, y, len] of row) { spike(pb, [0, y, z], [0, 1, -0.25], len, 0.12, K); spike(pb, [0.4, y - 0.12, z], [0.5, 1, -0.2], len * 0.5, 0.08, K); spike(pb, [-0.4, y - 0.12, z], [-0.5, 1, -0.2], len * 0.5, 0.08, K); }
  spike(pb, [0, 0.05, -1.4], [0, 0.35, -1], 0.9, 0.18, K); // tail spike
  c.g.add(finish(pb, m));
  // head on a pivot so it can drop for the charge
  const hb = new PropBatch();
  box8(hb, [[-0.42, -0.5, 0], [0.42, -0.5, 0], [0.25, -0.78, 0.85], [-0.25, -0.78, 0.85]], [[-0.42, 0.28, 0], [0.42, 0.28, 0], [0.2, -0.35, 0.85], [-0.2, -0.35, 0.85]], K);
  spike(hb, [0, -0.42, 0.72], [0, 0.9, 0.55], 0.85, 0.13, K);
  spike(hb, [0.3, 0.05, 0.3], [0.8, 0.6, 0.4], 0.35, 0.07, K); spike(hb, [-0.3, 0.05, 0.3], [-0.8, 0.6, 0.4], 0.35, 0.07, K);
  hb.line(K, [0.3, -0.2, 0.5], [0.36, -0.16, 0.56]); hb.line(K, [-0.3, -0.2, 0.5], [-0.36, -0.16, 0.56]);
  c.head = new THREE.Group(); c.head.add(finish(hb, m)); c.head.position.set(0, 0.25, 1.15); c.g.add(c.head);
  for (const [x, z] of [[-0.6, 0.75], [0.6, 0.75], [-0.55, -1.0], [0.55, -1.0]]) {
    const l = leg(m, [0, -0.35, 0.05], [0, -0.7, 0], 0.17, 3);
    l.position.set(x, -0.35, z); c.g.add(l); c.legs.push(l);
  }
}
function leechwingModel(c: Creature) {
  const pb = new PropBatch(), m = c.mat, K = 0;
  // thorax, segmented abdomen tapering to a sting, narrow head
  box8(pb, [[-0.22, -0.2, -0.25], [0.22, -0.2, -0.25], [0.18, -0.15, 0.5], [-0.18, -0.15, 0.5]], [[-0.2, 0.2, -0.25], [0.2, 0.2, -0.25], [0.15, 0.22, 0.5], [-0.15, 0.22, 0.5]], K);
  const seg: [number, number][] = [[-0.25, 0.2], [-0.6, 0.18], [-0.95, 0.14], [-1.3, 0.09], [-1.65, 0.02]];
  for (let i = 0; i + 1 < seg.length; i++) {
    const [z0, w0] = seg[i], [z1, w1] = seg[i + 1];
    box8(pb, [[-w0, -w0, z0], [w0, -w0, z0], [w1, -w1, z1], [-w1, -w1, z1]], [[-w0, w0, z0], [w0, w0, z0], [w1, w1, z1], [-w1, w1, z1]], K);
  }
  box8(pb, [[-0.15, -0.12, 0.5], [0.15, -0.12, 0.5], [0.06, -0.08, 0.95], [-0.06, -0.08, 0.95]], [[-0.13, 0.15, 0.5], [0.13, 0.15, 0.5], [0.05, 0.05, 0.95], [-0.05, 0.05, 0.95]], K);
  for (const s of [-1, 1]) pb.line(K, [s * 0.08, -0.06, 0.9], [s * 0.2, -0.1, 1.05], [s * 0.18, -0.25, 1.15], [s * 0.08, -0.3, 1.1]); // mandibles
  // six dangling legs
  for (const z of [0.35, 0.1, -0.15]) for (const s of [-1, 1]) pb.line(K, [s * 0.15, -0.18, z], [s * 0.5, -0.4, z + 0.1], [s * 0.45, -0.85, z + 0.2], [s * 0.5, -0.92, z + 0.3]);
  c.g.add(finish(pb, m));
  // wings: a curved membrane with veins, hinged at the shoulders
  for (const s of [-1, 1]) {
    const wb = new PropBatch(), lead: P[] = [[0, 0, 0], [0.8, 0.35, 0.12], [1.6, 0.45, -0.1], [2.25, 0.3, -0.55]], trail: P[] = [[1.5, 0.08, -0.85], [0.8, 0, -0.75], [0.1, 0, -0.45]];
    const X = (q: P) => [q[0] * s, q[1], q[2]], edge = [...lead, ...trail].map(X);
    for (let i = 1; i + 1 < edge.length; i++) wb.face(edge[0], edge[i], edge[i + 1]);
    wb.line(K, ...lead.map(X)); wb.line(K, ...[lead[3], ...trail, [0, 0, 0]].map(X));
    for (const q of [lead[1], lead[2], trail[0]]) wb.line(K, [0, 0, 0], X(q));
    const wing = new THREE.Group(); wing.add(finish(wb, m)); wing.position.set(s * 0.18, 0.18, 0.15); c.g.add(wing); c.wings.push(wing);
  }
}

function gnawerModel(c: Creature) {
  const pb = new PropBatch(), m = c.mat, K = 0;
  // hunched body: low rump, high back, tapering to the neck
  box8(pb, [[-0.2, -0.16, -0.42], [0.2, -0.16, -0.42], [0.16, -0.14, 0.2], [-0.16, -0.14, 0.2]], [[-0.16, 0.14, -0.42], [0.16, 0.14, -0.42], [0.12, 0.2, 0.2], [-0.12, 0.2, 0.2]], K);
  box8(pb, [[-0.16, -0.14, 0.2], [0.16, -0.14, 0.2], [0.1, -0.08, 0.42], [-0.1, -0.08, 0.42]], [[-0.12, 0.2, 0.2], [0.12, 0.2, 0.2], [0.08, 0.12, 0.42], [-0.08, 0.12, 0.42]], K);
  // pointed head with a blunt muzzle
  box8(pb, [[-0.1, -0.08, 0.42], [0.1, -0.08, 0.42], [0.04, -0.06, 0.74], [-0.04, -0.06, 0.74]], [[-0.08, 0.12, 0.42], [0.08, 0.12, 0.42], [0.03, 0.02, 0.74], [-0.03, 0.02, 0.74]], K);
  // the big incisors: two long curved teeth hanging from the muzzle
  for (const s of [-1, 1]) pb.solid8([[s * 0.005, -0.06, 0.7], [s * 0.035, -0.06, 0.7], [s * 0.035, -0.06, 0.74], [s * 0.005, -0.06, 0.74]], [[s * 0.008, -0.22, 0.76], [s * 0.03, -0.22, 0.76], [s * 0.03, -0.22, 0.78], [s * 0.008, -0.22, 0.78]], K);
  // ears, eyes, whiskers
  for (const s of [-1, 1]) {
    pb.line(K, [s * 0.07, 0.1, 0.46], [s * 0.15, 0.22, 0.44], [s * 0.13, 0.12, 0.52], [s * 0.07, 0.1, 0.46]);
    pb.line(K, [s * 0.06, 0.06, 0.6], [s * 0.05, 0.07, 0.63]);
    pb.line(K, [s * 0.03, -0.02, 0.72], [s * 0.2, 0.0, 0.8]); pb.line(K, [s * 0.03, -0.03, 0.72], [s * 0.19, -0.05, 0.77]);
  }
  // bristly ridge along the back
  for (let i = 0; i < 6; i++) spike(pb, [0, 0.16 + (i < 3 ? i * 0.02 : 0.05 - (i - 3) * 0.02), -0.3 + i * 0.12], [0, 1, -0.6], 0.08, 0.025, K);
  c.g.add(finish(pb, m));
  // the tail: a long whip of segments studded with spikes, on a pivot at the rump so it can lash
  const tb = new PropBatch(), segs: [number, number, number][] = [[0, 0, 0], [0, 0.02, -0.35], [0, 0.08, -0.7], [0, 0.18, -1.0], [0, 0.32, -1.25]];
  for (let i = 0; i + 1 < segs.length; i++) {
    const [, y0, z0] = segs[i], [, y1, z1] = segs[i + 1], w0 = 0.07 * (1 - i / 4) + 0.015, w1 = 0.07 * (1 - (i + 1) / 4) + 0.015;
    box8(tb, [[-w0, y0 - w0, z0], [w0, y0 - w0, z0], [w1, y1 - w1, z1], [-w1, y1 - w1, z1]], [[-w0, y0 + w0, z0], [w0, y0 + w0, z0], [w1, y1 + w1, z1], [-w1, y1 + w1, z1]], K);
    const mz = (z0 + z1) / 2, my = (y0 + y1) / 2 + w0;
    spike(tb, [0, my, mz], [0, 1, -0.3], 0.12, 0.025, K);
    for (const s of [-1, 1]) spike(tb, [s * w0, my - w0, mz], [s, 0.4, -0.2], 0.09, 0.02, K);
  }
  spike(tb, [0, 0.32, -1.25], [0, 0.6, -1], 0.16, 0.03, K); // barb at the tip
  c.tail = new THREE.Group(); c.tail.add(finish(tb, m)); c.tail.position.set(0, 0, -0.42); c.g.add(c.tail);
  // four short legs with long claws
  for (const [x, z] of [[-0.14, 0.25], [0.14, 0.25], [-0.17, -0.3], [0.17, -0.3]]) {
    const l = leg(m, [0, -0.08, z > 0 ? 0.04 : -0.06], [0, -0.16, z > 0 ? 0.08 : 0.02], 0.025, 3);
    l.position.set(x, -0.14, z); c.g.add(l); c.legs.push(l);
  }
}

// ---------- spawning ----------
function make(kind: CreatureKind, p: THREE.Vector3, level: number): Creature {
  const s = CREATURES[kind], mat = lineMat(kind === 'bramble' ? CALM : HOSTILE), g = new THREE.Group();
  const hp = Math.round(s.hp * (1 + level * 0.35));
  const c: Creature = {
    kind, g, mat, p: p.clone(), heading: Math.random() * 6.28, speed: 0, hp, maxHp: hp, r: s.r, flash: 0,
    state: kind === 'leechwing' ? 'roam' : 'roam', timer: 0, anim: Math.random() * 10, legs: [], wings: [], head: null, jaw: null, tail: null,
    pack: null, flank: 0, home: p.clone(), dir: V(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(), level, hurt: false, dmgMul: 1,
    noiseAt: null, orbit: Math.random() * 6.283, bank: 0, prey: null, spotted: false,
  };
  if (kind === 'ravager') ravagerModel(c); else if (kind === 'bramble') brambleModel(c); else if (kind === 'gnawer') gnawerModel(c); else leechwingModel(c);
  g.position.copy(p); g.rotation.order = 'YXZ'; scene.add(g);
  W.creatures.push(c);
  return c;
}
export interface SpawnEnv {
  ground(x: number, z: number): number;
  /** 0 near the start, growing with distance (see overworld danger()). */
  danger(x: number, z: number): number;
  nearRuin(x: number, z: number): boolean;
  /** Too close to the village or inside a structure. */
  forbidden(x: number, z: number): boolean;
}
let env: SpawnEnv | null = null, spawnT = 2;
/**
 * How much noise there has been lately (gunfire): it makes creatures turn up faster and in greater numbers,
 * coming from all around the place the shooting was heard. It fades over half a minute or so.
 */
let heat = 0, heard = false;
const lastNoise = new THREE.Vector3();
onNoise((at, r) => {
  heat = Math.min(4, heat + r / 55); lastNoise.copy(at); heard = true;
  for (const c of W.creatures) {
    if (c.kind === 'bramble') continue; // grazers do not care about a bang in the distance
    const reach = c.kind === 'leechwing' ? r * 1.8 : r; // flyers hear it from further and see it from above
    if (Math.hypot(c.p.x - at.x, c.p.z - at.z) > reach) continue;
    if (c.state === 'roam' || c.state === 'investigate') { c.state = 'investigate'; c.noiseAt = at.clone(); c.timer = 14; }
  }
});
export function setCreatureEnv(e: SpawnEnv | null) { env = e; }

/**
 * Something new turns up behind the player (or around a noise). What it may be depends on the danger there
 * (gen/danger.ts): gnawer nests and grazing brambles anywhere, ravager packs from 1.2, leechwings from 2.5; how
 * much there may be at once is the shared threat budget (world/threat.ts).
 */
function trySpawn() {
  if (!env) return;
  const pos = G.pos, fwx = -Math.sin(G.yaw), fwz = -Math.cos(G.yaw);
  if (Math.random() > 0.55 + heat * 0.12) return;
  const drawn = heard && heat > 0.4 && Math.random() < 0.75, before = W.creatures.length; // the shooting draws them in
  for (let tries = 0; tries < 10; tries++) {
    const a = drawn ? Math.random() * 6.283 : Math.atan2(-fwx, -fwz) + (Math.random() - 0.5) * 2.6, d = drawn ? 55 + Math.random() * 25 : 45 + Math.random() * 25;
    const bx = drawn ? lastNoise.x : pos.x, bz = drawn ? lastNoise.z : pos.z, x = bx + Math.sin(a) * d, z = bz + Math.cos(a) * d;
    if (Math.hypot(x - pos.x, z - pos.z) < 40) continue;
    if (env.forbidden(x, z)) continue;
    const h = env.ground(x, z), lv = env.danger(x, z), roll = Math.random();
    if (Math.random() < 0.35) { // gnawers turn up anywhere: fields, woods, ruins, hills, lakesides, even the ice
      const n = lv < 1 ? 2 + (Math.random() < 0.5 ? 1 : 0) : 3 + Math.floor(Math.random() * (1 + Math.min(3, lv)));
      if (!mayspawn(n * 0.5, lv, heat)) return;
      const nest: Creature[] = [];
      for (let i = 0; i < n; i++) {
        const px = x + (Math.random() - 0.5) * 5, pz = z + (Math.random() - 0.5) * 5;
        if (env.forbidden(px, pz)) continue;
        const c = make('gnawer', V(px, env.ground(px, pz) + CREATURES.gnawer.lift, pz), lv);
        c.pack = nest; c.flank = Math.random() * 6.283; nest.push(c);
      }
    } else if ((env.nearRuin(x, z) || h > 17) && lv >= 2.5 && roll < 0.6) {
      if (!mayspawn(1.5, lv, heat)) return;
      make('leechwing', V(x, h + 22, z), lv);
    } else if (h < 9 && roll < 0.6) {
      const n = lv > 2 && Math.random() < 0.3 ? 2 : 1;
      if (!mayspawn(n * 0.4, lv, heat)) return;
      for (let i = 0; i < n; i++) make('bramble', V(x + i * 5, env.ground(x + i * 5, z) + CREATURES.bramble.lift, z), lv);
    } else if (lv >= 1.2) {
      const n = lv < 2.5 ? 2 : Math.min(4, 2 + Math.floor(Math.random() * (lv - 1)));
      if (!mayspawn(n, lv, heat)) return;
      const pack: Creature[] = [];
      for (let i = 0; i < n; i++) {
        const px = x + (Math.random() - 0.5) * 6, pz = z + (Math.random() - 0.5) * 6;
        const c = make('ravager', V(px, env.ground(px, pz) + CREATURES.ravager.lift, pz), lv);
        c.flank = (i - (n - 1) / 2) * 1.1; c.pack = pack; pack.push(c);
      }
    } else continue;
    if (drawn) for (const c of W.creatures.slice(before)) if (c.kind !== 'bramble') { c.state = 'investigate'; c.noiseAt = lastNoise.clone(); c.timer = 20; }
    return;
  }
}

// ---------- behaviour ----------
function blockedAt(c: Creature, x: number, z: number): boolean {
  if (!env) return true;
  if (foeRules.blocked(V(x, c.p.y, z)) || env.forbidden(x, z)) return true;
  return !G.space.empty(Math.floor(x), Math.floor(env.ground(x, z) + 0.5), Math.floor(z));
}
/** Walk over the ground towards a direction; slides along obstacles. */
function walk(c: Creature, dx: number, dz: number, speed: number, dt: number) {
  const L = Math.hypot(dx, dz);
  c.speed = 0;
  if (L < 1e-3 || !env) return;
  const sx = dx / L * speed * dt, sz = dz / L * speed * dt;
  if (!blockedAt(c, c.p.x + sx, c.p.z + sz)) { c.p.x += sx; c.p.z += sz; }
  else if (!blockedAt(c, c.p.x + sx, c.p.z)) c.p.x += sx;
  else if (!blockedAt(c, c.p.x, c.p.z + sz)) c.p.z += sz;
  else return;
  c.speed = speed;
  let dh = Math.atan2(dx, dz) - c.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
  c.heading += dh * Math.min(1, dt * 8);
  c.p.y = env.ground(c.p.x, c.p.z) + CREATURES[c.kind].lift;
}
function bite(dmg: number) {
  if (foeRules.shielded()) { foeRules.shieldHit(dmg * 0.5); return; }
  G.hp -= dmg; G.dmgFlash = 0.4;
}
const alerted = new WeakSet<Creature[]>();

function ravager(c: Creature, dt: number, to: THREE.Vector3, dist: number, safe: boolean) {
  const s = CREATURES.ravager, speed = s.speed + Math.min(1.5, c.level * 0.5);
  c.timer -= dt;
  if (safe || dist > 50) { if (c.state !== 'roam') c.state = 'roam'; }
  switch (c.state) {
    case 'roam': {
      if (c.timer <= 0) { c.dir.set(Math.random() - 0.5, 0, Math.random() - 0.5); c.timer = 2 + Math.random() * 3; }
      const back = c.home.clone().sub(c.p); back.y = 0;
      if (back.length() > 15) c.dir.copy(back);
      walk(c, c.dir.x, c.dir.z, 2, dt);
      if (!safe && dist < 22 && rayWorld(c.p, to.clone().normalize(), dist) >= dist - 0.3) {
        for (const m of c.pack ?? [c]) { m.state = 'hunt'; m.timer = 3 + Math.random() * 2; }
        if (c.pack && !alerted.has(c.pack)) { alerted.add(c.pack); logLine('Ravagers are hunting you!'); }
      }
      break;
    }
    case 'hunt': { // circle to a flanking spot, then go in
      const base = Math.atan2(c.p.x - G.pos.x, c.p.z - G.pos.z) + c.flank;
      const fx = G.pos.x + Math.sin(base) * 4.5, fz = G.pos.z + Math.cos(base) * 4.5;
      walk(c, fx - c.p.x, fz - c.p.z, speed, dt);
      if (Math.hypot(fx - c.p.x, fz - c.p.z) < 1.5 || c.timer <= 0) { c.state = 'dash'; c.timer = 1.6; }
      break;
    }
    case 'dash':
      walk(c, to.x, to.z, speed * 1.25, dt);
      if (dist < 1.5) { bite((s.damage + 2 * c.level) * c.dmgMul); c.state = 'retreat'; c.timer = 0.8; }
      else if (c.timer <= 0) { c.state = 'hunt'; c.timer = 2.5; }
      break;
    case 'retreat':
      walk(c, -to.x, -to.z, speed, dt);
      if (c.timer <= 0) { c.state = 'hunt'; c.timer = 1.5 + Math.random() * 2; }
      break;
  }
  if (c.jaw) c.jaw.rotation.x = c.state === 'dash' && dist < 4 ? 0.5 : 0.05;
}
function bramble(c: Creature, dt: number, to: THREE.Vector3, dist: number, safe: boolean) {
  const s = CREATURES.bramble;
  c.timer -= dt;
  const angry = c.state === 'threat' || c.state === 'charge' || c.state === 'recover';
  if (!angry && !safe && (dist < 11 || c.hurt)) { c.state = 'threat'; c.timer = 0.9; c.mat.color.setHex(HOSTILE); showToast('A Bramble charges!'); }
  switch (c.state) {
    case 'roam': // graze: amble a little, then stand
      if (c.timer <= 0) { c.dir.set(Math.random() - 0.5, 0, Math.random() - 0.5); c.timer = 3 + Math.random() * 4; }
      if (c.timer > 2) walk(c, c.dir.x, c.dir.z, 0.8, dt); else c.speed = 0;
      break;
    case 'threat': { // face the intruder, head down, then go
      let dh = Math.atan2(to.x, to.z) - c.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); c.heading += dh * Math.min(1, dt * 5);
      if (c.timer <= 0) { c.state = 'charge'; c.timer = 2.2; c.dir.set(to.x, 0, to.z).normalize(); }
      break;
    }
    case 'charge': {
      const before = c.p.clone();
      walk(c, c.dir.x, c.dir.z, s.speed, dt);
      if (dist < 2.4 && c.speed > 0) {
        bite((s.damage + 4 * c.level) * c.dmgMul);
        if (!foeRules.shielded()) { G.vel.x += c.dir.x * 10; G.vel.z += c.dir.z * 10; G.vel.y = 5; G.onGround = false; }
        c.state = 'recover'; c.timer = 1.6;
      } else if (c.timer <= 0 || before.distanceTo(c.p) < 1e-3) { c.state = 'recover'; c.timer = 1.4; }
      break;
    }
    case 'recover':
      c.speed = 0;
      if (c.timer <= 0) {
        if (!safe && dist < 26) { c.state = 'threat'; c.timer = 1.0; }
        else { c.state = 'roam'; c.hurt = false; c.mat.color.setHex(CALM); }
      }
      break;
  }
  if (c.head) c.head.rotation.x += ((c.state === 'charge' || c.state === 'threat' ? 0.45 : 0) - c.head.rotation.x) * Math.min(1, dt * 6);
}
/**
 * Leechwings fly by steering: they turn only so fast, so every move is an arc. They soar high in wide, lazy
 * loops over their range, watching the ground (they spot prey up to ~90 m off), then circle their quarry in
 * big sweeps that tighten and drop with every pass, dive, and pull out in a long climbing arc. When no person
 * is about they hunt Gnawers.
 */
const SIGHT = 90;
function leechwing(c: Creature, dt: number, to: THREE.Vector3, dist: number, safe: boolean) {
  const s = CREATURES.leechwing, g = env!.ground(c.p.x, c.p.z), hd = Math.hypot(to.x, to.z);
  c.timer -= dt;
  const steer = (tx: number, ty: number, tz: number, speed: number, turn: number) => {
    const want = V(tx - c.p.x, ty - c.p.y, tz - c.p.z), L = want.length();
    if (L > 0.01) want.divideScalar(L);
    const before = Math.atan2(c.dir.x, c.dir.z);
    c.dir.lerp(want, Math.min(1, turn * dt)).normalize();
    let dh = Math.atan2(c.dir.x, c.dir.z) - before; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    c.bank += (Math.max(-0.9, Math.min(0.9, -dh / Math.max(dt, 1e-3) * 0.45)) - c.bank) * Math.min(1, dt * 3); // lean into the turn
    c.p.addScaledVector(c.dir, speed * dt);
    const floor = env!.ground(c.p.x, c.p.z) + 2;
    if (c.p.y < floor) { c.p.y = floor; if (c.dir.y < 0.1) c.dir.y = 0.1; }
    c.heading = Math.atan2(c.dir.x, c.dir.z); c.speed = speed;
  };
  const seesPlayer = () => !safe && hd < SIGHT && rayWorld(c.p, to.clone().normalize(), dist) >= dist - 1;
  if (c.prey && !W.creatures.includes(c.prey)) c.prey = null; // someone else got it
  const target = c.prey ? c.prey.p : V(G.pos.x, G.pos.y + 1.1, G.pos.z);
  if (safe && !c.prey && (c.state === 'stalk' || c.state === 'dive')) { c.state = 'climb'; c.timer = 2; }
  const lookAround = () => {
    if (c.timer > 0) return;
    c.timer = 0.6;
    if (seesPlayer()) {
      c.prey = null; c.state = 'stalk'; c.timer = 6 + Math.random() * 4; c.orbit = Math.atan2(c.p.x - G.pos.x, c.p.z - G.pos.z);
      if (!c.spotted) { c.spotted = true; logLine('A Leechwing has spotted you from above.'); }
      return;
    }
    const prey = W.creatures.find((o) => o.kind === 'gnawer' && o.p.distanceTo(c.p) < SIGHT * 0.8);
    if (prey && Math.random() < 0.35) { c.prey = prey; c.state = 'stalk'; c.timer = 4 + Math.random() * 3; c.orbit = Math.atan2(c.p.x - prey.p.x, c.p.z - prey.p.z); }
  };
  switch (c.state) {
    case 'roam': { // soar in wide loops over its range, drifting up and down
      c.orbit += dt * 0.1;
      const R = 40 + 15 * Math.sin(c.orbit * 0.7 + c.flank);
      steer(c.home.x + Math.cos(c.orbit) * R, g + 24 + 6 * Math.sin(c.orbit * 1.3), c.home.z + Math.sin(c.orbit * 1.4) * R * 0.8, 11, 0.6);
      lookAround();
      break;
    }
    case 'investigate': { // something was heard: sweep over there high up and look
      const n = c.noiseAt ?? c.home;
      steer(n.x, env!.ground(n.x, n.z) + 26, n.z, 15, 0.8);
      if (Math.hypot(n.x - c.p.x, n.z - c.p.z) < 25) { c.home.copy(n); c.state = 'roam'; c.timer = 0; }
      if (c.timer < 10) lookAround();
      break;
    }
    case 'stalk': { // circle the quarry: wide at first, tighter and lower with every pass
      c.orbit += dt * 0.32;
      const k = Math.max(0, c.timer), R = 14 + k * 2.6;
      steer(target.x + Math.cos(c.orbit) * R, target.y + 10 + k * 1.3, target.z + Math.sin(c.orbit) * R, 13, 1.0);
      if (c.timer <= 0) { c.state = 'dive'; c.timer = 3.5; }
      if (!c.prey && (hd > SIGHT * 1.25 || safe)) { c.state = 'roam'; c.home.copy(c.p); c.timer = 2; }
      break;
    }
    case 'dive': {
      steer(target.x, target.y, target.z, s.speed, 2.6);
      const d = c.p.distanceTo(target);
      if (c.prey && d < 1.6) { // caught one
        const p = c.prey; c.prey = null; burst(p.p.clone(), HOSTILE, 12, 0.8); removeCreature(p);
        c.state = 'climb'; c.timer = 3;
      } else if (!c.prey && dist < 1.8) { bite((s.damage + 3 * c.level) * c.dmgMul); c.state = 'climb'; c.timer = 3; }
      else if (c.timer <= 0) { c.state = 'climb'; c.timer = 2.5; }
      break;
    }
    case 'climb': // pull out in a long climbing arc, carrying on the way it was going
      steer(c.p.x + c.dir.x * 30, g + 24, c.p.z + c.dir.z * 30, 14, 0.7);
      if (c.timer <= 0) {
        if (!safe && hd < SIGHT && !c.prey && c.spotted) { c.state = 'stalk'; c.timer = 5 + Math.random() * 3; }
        else { c.state = 'roam'; c.home.copy(c.p); c.timer = 1; }
      }
      break;
    default: c.state = 'roam';
  }
}

/** Ground creatures that heard something walk over to have a look; seeing the player there sets them off. */
function investigate(c: Creature, dt: number, to: THREE.Vector3, dist: number, safe: boolean) {
  const n = c.noiseAt ?? c.home, s = CREATURES[c.kind];
  c.timer -= dt;
  walk(c, n.x - c.p.x, n.z - c.p.z, s.speed * 0.7, dt);
  const sight = c.kind === 'gnawer' ? 18 : 24;
  if (!safe && dist < sight && rayWorld(c.p, to.clone().normalize(), dist) >= dist - 0.3) {
    for (const m of c.pack ?? [c]) { m.state = 'hunt'; m.timer = c.kind === 'ravager' ? 2 + Math.random() * 2 : Math.random() * 0.6; }
    return;
  }
  if (Math.hypot(n.x - c.p.x, n.z - c.p.z) < 4 || c.timer <= 0) { c.home.set(n.x, c.home.y, n.z); c.state = 'roam'; c.timer = 0; }
}

/**
 * Gnawers: a nest scurries about in nervous bursts, sniffing. Once one spots you the whole nest swarms in,
 * zig-zagging, bites and skitters off, then comes back. With only one or two left they lose their nerve and run.
 */
function gnawer(c: Creature, dt: number, to: THREE.Vector3, dist: number, safe: boolean) {
  const s = CREATURES.gnawer, speed = s.speed + Math.min(2, c.level * 0.4);
  c.timer -= dt;
  const nest = c.pack ?? [c];
  if (safe || dist > 45) { if (c.state !== 'roam') c.state = 'roam'; }
  switch (c.state) {
    case 'roam': {
      if (c.timer <= 0) { c.dir.set(Math.random() - 0.5, 0, Math.random() - 0.5); c.timer = 0.4 + Math.random() * 1.6; }
      const back = c.home.clone().sub(c.p); back.y = 0;
      if (back.length() > 10) c.dir.copy(back);
      if (c.timer > 0.5) walk(c, c.dir.x, c.dir.z, 3.5, dt); else c.speed = 0; // scurry, stop, sniff
      if (!safe && dist < 18 && rayWorld(c.p, to.clone().normalize(), dist) >= dist - 0.3) {
        for (const m of nest) { m.state = 'hunt'; m.timer = 0.2 + Math.random() * 0.8; }
        if (c.pack && !alerted.has(c.pack)) { alerted.add(c.pack); logLine('Gnawers! A whole nest of them!'); }
      }
      break;
    }
    case 'hunt': { // zig-zag in
      if (nest.length <= 2 && c.hurt) { c.state = 'retreat'; c.timer = 4; break; }
      const side = Math.sin(c.anim * 0.35 + c.flank) * 0.9, sx = -to.z, sz = to.x, L = Math.hypot(sx, sz) || 1;
      walk(c, to.x + sx / L * side * Math.min(4, dist), to.z + sz / L * side * Math.min(4, dist), speed, dt);
      if (dist < 1.25) { bite((s.damage + c.level) * c.dmgMul); c.state = 'retreat'; c.timer = 0.5 + Math.random() * 0.6; }
      break;
    }
    case 'retreat':
      walk(c, -to.x + (Math.random() - 0.5) * 2, -to.z + (Math.random() - 0.5) * 2, speed, dt);
      if (c.timer <= 0) { c.state = nest.length <= 2 && c.hurt ? 'retreat' : 'hunt'; c.timer = nest.length <= 2 && c.hurt ? 3 : 0; }
      break;
  }
}

/** Spawning, behaviour and animation of every creature (open world only). */
export function updateCreatures(dt: number, time: number) {
  if (!env) return;
  heat *= Math.exp(-dt / 25);
  if ((spawnT -= dt) <= 0) { spawnT = 4.5 / (1 + heat); trySpawn(); }
  const safe = foeRules.playerSafe(), head = V(G.pos.x, G.pos.y + 1.2, G.pos.z);
  for (let i = W.creatures.length - 1; i >= 0; i--) {
    const c = W.creatures[i], to = head.clone().sub(c.p), dist = to.length();
    if (Math.hypot(to.x, to.z) > (c.questId ? 240 : c.kind === 'leechwing' ? 220 : 130)) { removeCreature(c); continue; }
    if (c.state === 'investigate' && c.kind !== 'leechwing') investigate(c, dt, to, dist, safe);
    else if (c.kind === 'ravager') ravager(c, dt, to, dist, safe);
    else if (c.kind === 'bramble') bramble(c, dt, to, dist, safe);
    else if (c.kind === 'gnawer') gnawer(c, dt, to, dist, safe);
    else leechwing(c, dt, to, dist, safe);
    animate(c, dt, time);
  }
}
function animate(c: Creature, dt: number, time: number) {
  c.g.position.copy(c.p); c.g.rotation.y = c.heading;
  c.anim += dt * (1 + c.speed * 1.4);
  const sw = c.speed > 0.1 ? Math.sin(c.anim * 1.6) * Math.min(0.7, 0.2 + c.speed * 0.06) : 0;
  c.legs.forEach((l, i) => { l.rotation.x = (i === 0 || i === 3 ? 1 : -1) * sw; });
  if (c.tail) c.tail.rotation.y = Math.sin(time * (c.state === 'hunt' ? 12 : 4) + c.flank) * (c.state === 'hunt' ? 0.45 : 0.25);
  if (c.wings.length) {
    // gliding on outstretched wings, beating hard when climbing, folded back in a dive; nose follows the flight path
    const beat = c.state === 'climb' ? 0.5 + Math.sin(time * 11) * 0.45 : c.state === 'stalk' ? 0.25 + Math.sin(time * 5) * 0.2 : 0.12 + Math.sin(time * 2.2) * 0.1;
    const lift = c.state === 'dive' ? 0.95 : beat;
    c.wings[0].rotation.z = -lift; c.wings[1].rotation.z = lift;
    c.g.rotation.x = -Math.asin(Math.max(-1, Math.min(1, c.dir.y))); c.g.rotation.z = c.bank;
  }
  c.flash -= dt;
  if (c.flash > 0) c.mat.color.setHex(0xffffff);
  else c.mat.color.setHex(c.kind === 'bramble' && c.state === 'roam' ? CALM : HOSTILE);
}

// ---------- damage ----------
export function hurtCreature(c: Creature, dmg: number) {
  // the Bramble's head and front plates shrug off most of a hit
  if (c.kind === 'bramble') {
    const toShooter = V(G.pos.x - c.p.x, 0, G.pos.z - c.p.z).normalize();
    if (toShooter.x * Math.sin(c.heading) + toShooter.z * Math.cos(c.heading) > 0.5) dmg *= 0.4;
  }
  c.hp -= dmg; c.flash = 0.12; c.hurt = true; G.hitFlash = 0.15;
  if (c.kind === 'ravager' && c.state === 'roam') for (const m of c.pack ?? [c]) { m.state = 'hunt'; m.timer = 2; }
  if (c.kind === 'leechwing' && (c.state === 'roam' || c.state === 'investigate')) { c.prey = null; c.spotted = true; c.state = 'stalk'; c.timer = 2; }
  if (c.kind === 'gnawer') for (const m of c.pack ?? [c]) { m.hurt = true; if (m.state === 'roam') { m.state = 'hunt'; m.timer = 0; } }
  if (c.hp > 0) return;
  const at = c.p.clone(), s = CREATURES[c.kind];
  burst(at, HOSTILE, 30, 1.6);
  for (let i = 0; i < s.crystals; i++) dropCrystal(at);
  if (Math.random() < 0.15) dropPickup(at, 'medkit');
  for (const [k, chance, lo, hi] of DROPS[c.kind]) if (Math.random() < chance) {
    const n = lo + Math.floor(Math.random() * (hi - lo + 1));
    for (let i = 0; i < n; i++) dropPickup(V(at.x + (Math.random() - 0.5) * 1.2, at.y, at.z + (Math.random() - 0.5) * 1.2), k);
  }
  logLine((c.alpha ? ALPHA[c.kind] : s.name) + ' killed');
  const qid = c.questId, alpha = !!c.alpha;
  removeCreature(c);
  onKill(c.kind, qid, alpha);
}
export function removeCreature(c: Creature) {
  scene.remove(c.g);
  c.g.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); });
  c.mat.dispose();
  const i = W.creatures.indexOf(c); if (i >= 0) W.creatures.splice(i, 1);
  if (c.pack) { const j = c.pack.indexOf(c); if (j >= 0) c.pack.splice(j, 1); }
}
export function clearCreatures() { for (const c of [...W.creatures]) removeCreature(c); }
/** Debug / console: put a creature near the player. */
export function spawnCreatureNear(kind: CreatureKind, d = 18) {
  if (!env) return false;
  const x = G.pos.x - Math.sin(G.yaw) * d, z = G.pos.z - Math.cos(G.yaw) * d;
  const lv = env.danger(x, z);
  if (kind === 'gnawer') { const nest: Creature[] = []; for (let i = 0; i < 5; i++) { const px = x + (Math.random() - 0.5) * 4, pz = z + (Math.random() - 0.5) * 4, c = make(kind, V(px, env.ground(px, pz) + CREATURES.gnawer.lift, pz), lv); c.pack = nest; c.flank = Math.random() * 6.283; nest.push(c); } return true; }
  if (kind === 'ravager') { const pack: Creature[] = []; for (let i = 0; i < 3; i++) { const c = make(kind, V(x + i * 1.5, env.ground(x + i * 1.5, z) + CREATURES.ravager.lift, z), lv); c.flank = (i - 1) * 1.1; c.pack = pack; pack.push(c); } }
  else make(kind, V(x, env.ground(x, z) + (kind === 'leechwing' ? 12 : CREATURES[kind].lift), z), lv);
  return true;
}

/** Bring a notice-board hunt group into the world: the survivors so far, plus the leader if still alive. */
export function spawnQuestGroup(q: Quest) {
  if (!env || !q.at || !q.pack) return;
  const { kind, count, alpha } = q.pack, left = count - (q.killed ?? 0), lv = Math.max(0.5, env.danger(q.at.x, q.at.z)), pack: Creature[] = [];
  const ax = nearX(q.at.x, G.pos.x); // the copy of the spot on this side of the planet's seam
  const at = (i: number) => { const a = i * 2.1, r = i ? 3 + i * 1.5 : 0, x = ax + Math.cos(a) * r, z = q.at!.z + Math.sin(a) * r; return V(x, env!.ground(x, z) + (kind === 'leechwing' ? 14 : CREATURES[kind].lift), z); };
  const members: Creature[] = [];
  if (!q.alphaDead) {
    const c = make(kind, at(0), lv);
    c.alpha = true; c.hp = c.maxHp = c.maxHp * 3; c.dmgMul = 1.5; c.r *= 1.35; c.g.scale.setScalar(1.35);
    const tag = textSprite(alpha, '#ffb347', 2.4); tag.position.y = kind === 'bramble' ? 1.9 : 1.3; c.g.add(tag);
    members.push(c);
  }
  for (let i = 0; i < left; i++) members.push(make(kind, at(i + 1), lv));
  members.forEach((c, i) => { c.questId = q.id; c.home.set(ax, c.home.y, q.at!.z); if (kind === 'ravager') { c.pack = pack; c.flank = (i - (members.length - 1) / 2) * 1.1; pack.push(c); } });
}
