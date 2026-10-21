// Wild creatures of the open world: Ravager packs, territorial Brambles and diving Leechwings, Gnawer nests,
// Skitterwing flocks fluttering low in the near wilds, and in the sea Sea Lurkers and shoals of Silverfin.
// Spawns and movement use Math.random (unsaved, like drones); models are built from PropBatch.
import { addIntent, type IntentOps } from './intents';
import { hears } from '../gen/senses';
import { ringSpot, heading, hiddenFrom, farFromPlayers, meetPoint, mayDrop, wayClear, SPAWN } from './spawnring';
import { play } from './sound';
import { hurtPlayer } from './damage';
import * as THREE from 'three';
import { nearX } from '../gen/regions';
import { onNoise } from './noise';
import { baits, baitNear, baitAlive, fires, type Bait } from './baits';
import { slotFor } from './surround';
import { MORALE, DEN, LEASH_POSE, TERRITORY, effective, breaks, pastEdge, shocked } from '../gen/morale';
import { THROW } from '../gen/throwing';
import { scene, V, lineMat } from './render';
import { G, W } from '../game';
import { PropBatch, sharedFill } from './props';
import { CREATURES, HOSTILE, CALM, DROPS, FLYERS, SWIMMERS, calmBeast, type CreatureKind } from '../data/creatures';
import { footStep } from '../core/footstep';
import { foeRules } from './enemies';
import { rayWorld } from './player';
import { burst } from './fx';
import { dropCrystal, dropPickup } from './loot';
import { logLine, showToast } from '../ui/hud';
import { onKill } from './quests';
import { mayspawn, FOE_HIT } from './threat';
import { ALPHA, type Quest } from '../gen/quests';
import { textSprite } from './npc';
import { targetingFoe, proxied, stepRemote, withFoeTarget, nearestPlayer, remoteOf } from './remote';
import { tickCond, knockDown, heavyHit, bleed, type CondFoe } from './conditions';
import { mindOf, sense, loseOf, share, spottedBy, targetVis } from './stealth';
import { STEALTH } from '../gen/stealth';
import { tl, TL } from '../i18n';
import { createFaunaModel } from '../models/fauna';
import type { FaunaId } from '../models/fauna';
import { WILD, WILDLIFE, isWild, wildPick, scared, provoke, temperAfter, type WildKind } from '../gen/wildlife';
import { wildOk } from './threat';
import type { BiomeHere } from '../gen/biomes';

type State = 'roam' | 'hunt' | 'dash' | 'retreat' | 'threat' | 'charge' | 'recover' | 'stalk' | 'dive' | 'climb' | 'investigate' | 'feed'
  // (0.226, stage W2) the telegraphs and the weak moments, seen on the other players' copies too
  | 'howl' | 'stun' | 'screech' | 'grounded' | 'scatter'
  // (0.228, stage W6) giving up the chase at the edge of its ground; broken, running for its den
  | 'leash' | 'rout'
  // (0.240) a wild animal running from you
  | 'flee';

export interface Creature extends CondFoe {
  /** (0.227) how far down on its side it is drawn (eased) */
  down?: number;
  /** (0.237.2) the body's lean along the slope under it, eased: pitch and roll (rad) */
  slope?: [number, number];
  /** (0.228, stage W6) Its den (where it was born: it never moves), its morale (pack beasts and the Leechwing),
   *  knocked once by its own wound; seconds since anything hurt it. */
  den?: THREE.Vector3; morale?: number; wounded?: boolean; calm?: number;
  /** Fixed city post; transmitted to prevent duplicate garrisons on another client. */
  cityPost?: string;
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
  /** (0.235) On its way from where it turned up to meet you (world/spawnring.ts): its den moves with it. */
  coming?: boolean;
  /** (0.225) A Bramble enraged by a noise charges at it, not at you; a beast feeding (state 'feed') eats this bait. */
  rageAt?: THREE.Vector3 | null; bait?: Bait | null;
  /** Seconds it will not go for a bait after being hurt or startled at one. */
  spooked?: number;
  /** (0.226) A Ravager's dash that is only a feint (seconds until it breaks off). */
  feint?: number;
  /** Leechwing flight: orbit angle, banking into turns, the creature it is hunting (null = the player), spotted you yet. */
  orbit: number; bank: number; prey: Creature | null; spotted: boolean;
  /** (0.240) A wild animal's temper (0..1.2: it attacks at 1), how long it stays roused (s), its legs' gait (+1 / −1
   *  per leg), the fauna model's own clean-up, and whether it has warned you yet. */
  anger?: number; roused?: number; gait?: number[]; free?: () => void; warned?: boolean;
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

/** Skitterwing: a small beaked flier, wings beating fast. */
function skitterModel(c: Creature) {
  const pb = new PropBatch(), m = c.mat, K = 0;
  box8(pb, [[-0.08, -0.07, -0.18], [0.08, -0.07, -0.18], [0.06, -0.05, 0.14], [-0.06, -0.05, 0.14]], [[-0.07, 0.07, -0.18], [0.07, 0.07, -0.18], [0.05, 0.06, 0.14], [-0.05, 0.06, 0.14]], K);
  spike(pb, [0, 0, 0.14], [0, -0.15, 1], 0.16, 0.035, K); // the beak
  for (const s of [-1, 1]) pb.line(K, [s * 0.04, 0.04, 0.12], [s * 0.05, 0.05, 0.15]); // eyes
  pb.face([0, 0.02, -0.18], [-0.12, 0.02, -0.4], [0.12, 0.02, -0.4]); pb.line(K, [0, 0.02, -0.18], [-0.12, 0.02, -0.4], [0.12, 0.02, -0.4], [0, 0.02, -0.18]); // tail fan
  c.g.add(finish(pb, m));
  for (const s of [-1, 1]) {
    const wb = new PropBatch(), pts: P[] = [[0, 0, 0.08], [0.35 * s, 0.05, 0.02], [0.5 * s, 0.02, -0.12], [0.1 * s, 0, -0.14]];
    wb.face(pts[0], pts[1], pts[2]); wb.face(pts[0], pts[2], pts[3]); wb.line(K, ...pts, pts[0]); wb.line(K, pts[0], pts[2]);
    const wing = new THREE.Group(); wing.add(finish(wb, m)); wing.position.set(s * 0.07, 0.04, 0); c.g.add(wing); c.wings.push(wing);
  }
}
/** Sea Lurker: a long finned eel, its dorsal fin cutting the surface; the tail half on a pivot so it can sweep. */
function lurkerModel(c: Creature) {
  const pb = new PropBatch(), m = c.mat, K = 0;
  const body: [number, number][] = [[1.3, 0.12], [0.9, 0.28], [0.3, 0.32], [-0.3, 0.3]];
  for (let i = 0; i + 1 < body.length; i++) { const [z0, w0] = body[i], [z1, w1] = body[i + 1]; box8(pb, [[-w0, -w0, z0], [w0, -w0, z0], [w1, -w1, z1], [-w1, -w1, z1]], [[-w0 * 0.8, w0, z0], [w0 * 0.8, w0, z0], [w1 * 0.8, w1, z1], [-w1 * 0.8, w1, z1]], K); }
  for (const s of [-1, 1]) { pb.line(K, [s * 0.14, 0.12, 1.05], [s * 0.18, 0.14, 1.12]); spike(pb, [s * 0.28, -0.1, 0.5], [s, -0.4, -0.6], 0.45, 0.06, K); } // eyes, side fins
  const fin: P[] = [[0, 0.3, 0.55], [0, 1.05, -0.05], [0, 0.3, -0.3]]; pb.face(fin[0], fin[1], fin[2]); pb.line(K, ...fin, fin[0]); // the dorsal fin
  for (let i = 0; i < 6; i++) pb.line(K, [0.1 - (i % 2) * 0.2, -0.12, 1.25 - i * 0.07], [0, -0.02, 1.22 - i * 0.07]); // teeth
  c.g.add(finish(pb, m));
  const tb = new PropBatch(), tail: [number, number][] = [[0, 0.3], [-0.6, 0.22], [-1.2, 0.14], [-1.7, 0.06]];
  for (let i = 0; i + 1 < tail.length; i++) { const [z0, w0] = tail[i], [z1, w1] = tail[i + 1]; box8(tb, [[-w0, -w0, z0], [w0, -w0, z0], [w1, -w1, z1], [-w1, -w1, z1]], [[-w0 * 0.8, w0, z0], [w0 * 0.8, w0, z0], [w1 * 0.8, w1, z1], [-w1 * 0.8, w1, z1]], K); }
  const fluke: P[] = [[0, 0, -1.7], [0, 0.45, -2.2], [0, -0.45, -2.2]]; tb.face(fluke[0], fluke[1], fluke[2]); tb.line(K, ...fluke, fluke[0]);
  c.tail = new THREE.Group(); c.tail.add(finish(tb, m)); c.tail.position.z = -0.3; c.g.add(c.tail);
}
/** Silverfin: a small sea fish with a forked tail. */
function silverfinModel(c: Creature) {
  const pb = new PropBatch(), m = c.mat, K = 0;
  box8(pb, [[-0.05, -0.1, -0.2], [0.05, -0.1, -0.2], [0.03, -0.05, 0.22], [-0.03, -0.05, 0.22]], [[-0.05, 0.1, -0.2], [0.05, 0.1, -0.2], [0.03, 0.05, 0.22], [-0.03, 0.05, 0.22]], K);
  const t: P[] = [[0, 0, -0.2], [0, 0.12, -0.38], [0, 0, -0.3], [0, -0.12, -0.38]]; pb.face(t[0], t[1], t[2]); pb.face(t[0], t[2], t[3]); pb.line(K, ...t, t[0]);
  c.g.add(finish(pb, m));
}
/** (0.240) A wild animal drawn from its fauna model (src/models/fauna): the model stands on the ground, the creature's
 *  origin is its body centre, so the model is lowered by the lift. Its ink lines take the creature's own material (so
 *  it flashes and turns colour with its temper), the faces the shared dark fill. */
const FAUNA_SHIFT: Partial<Record<WildKind, number>> = { serpent: -6.5 }; // the snake's raised fore-body is what you hit
function faunaModel(c: Creature) {
  const k = c.kind as WildKind, m = createFaunaModel(WILD[k].model as FaunaId), parts = m.parts;
  m.root.position.set(0, -CREATURES[k].lift, FAUNA_SHIFT[k] ?? 0);
  m.root.traverse((o) => {
    if ((o as THREE.LineSegments).isLineSegments) { const l = o as THREE.LineSegments; if ((l.material as THREE.LineBasicMaterial).color.getHex() === HOSTILE) l.material = c.mat; }
    else if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = sharedFill();
  });
  c.g.add(m.root); c.free = () => m.dispose();
  c.head = parts.neck ?? null; c.jaw = parts.jaw ?? null; c.tail = parts.tail ?? null;
  // legs in a walking order: the diagonal pairs of a quadruped, the two tripods of a six-legged one
  const order: [string, number][] = [['front.left', 1], ['front.right', -1], ['rear.left', -1], ['rear.right', 1], ['middle.left', -1], ['middle.right', 1]];
  c.gait = [];
  for (const [n, g] of order) { const l = parts['leg.' + n]; if (l) { c.legs.push(l); c.gait.push(g); } }
}
/** The colour a creature is drawn in: amber when hostile, olive for a calm Bramble, silver for the shoal fish. */
const FISH = 0xa8d8e8;
const baseColor = (c: Creature) => (c.kind === 'silverfin' ? FISH : c.kind === 'bramble' && c.state === 'roam' ? CALM : isWild(c.kind) ? (calmBeast(c.kind, c.state) ? CALM : HOSTILE) : HOSTILE);

// ---------- spawning ----------
/** A display-only creature, kept out of gameplay state and combat. */
export const showcaseCreature = (kind: CreatureKind) => make(kind, V(0, CREATURES[kind].lift, 0), 1, true);

function make(kind: CreatureKind, p: THREE.Vector3, level: number, showcase = false): Creature {
  const s = CREATURES[kind], mat = lineMat(kind === 'bramble' || isWild(kind) ? CALM : kind === 'silverfin' ? FISH : HOSTILE), g = new THREE.Group();
  const hp = Math.round(s.hp * (1 + level * 0.35));
  const c: Creature = {
    kind, g, mat, p: p.clone(), heading: Math.random() * 6.28, speed: 0, hp, maxHp: hp, r: s.r, flash: 0,
    state: kind === 'leechwing' ? 'roam' : 'roam', timer: 0, anim: Math.random() * 10, legs: [], wings: [], head: null, jaw: null, tail: null,
    pack: null, flank: 0, home: p.clone(), dir: V(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(), level, hurt: false, dmgMul: 1,
    noiseAt: null, orbit: Math.random() * 6.283, bank: 0, prey: null, spotted: false,
    den: p.clone(), morale: MORALE.start[kind], calm: 99,
  };
  if (isWild(kind)) { faunaModel(c); c.anger = 0; c.roused = 0; }
  else if (kind === 'ravager') ravagerModel(c); else if (kind === 'bramble') brambleModel(c); else if (kind === 'gnawer') gnawerModel(c);
  else if (kind === 'skitter') skitterModel(c); else if (kind === 'lurker') lurkerModel(c); else if (kind === 'silverfin') silverfinModel(c); else leechwingModel(c);
  g.position.copy(p); g.rotation.order = 'YXZ';
  if (!showcase) { scene.add(g); W.creatures.push(c); }
  return c;
}
export interface SpawnEnv {
  ground(x: number, z: number): number;
  /** (0.240) The biome at a point (where the wildlife lives). */
  biome?(x: number, z: number): BiomeHere;
  /** 0 near the start, growing with distance (see overworld danger()). */
  danger(x: number, z: number): number;
  nearRuin(x: number, z: number): boolean;
  /** Too close to the village or inside a structure. */
  forbidden(x: number, z: number): boolean;
  /** The water at a point (Terrain.water): the sea creatures keep to 'sea' deep enough for them. */
  water(x: number, z: number): { level: number; depth: number; kind: string } | null;
}
let env: SpawnEnv | null = null, spawnT = 2;
/**
 * How much noise there has been lately (gunfire): it makes creatures turn up faster and in greater numbers,
 * coming from all around the place the shooting was heard. It fades over half a minute or so.
 */
let heat = 0, heard = false;
/** (0.226, stage W2) The telegraphs and weak moments (s): a pack leader's howl, the share of Ravager dashes that are
 *  only feints, a Bramble pawing the ground before it charges and reeling after it hits something, a Leechwing's
 *  shriek before it dives and its time on the ground after a missed dive. */
const HOWL = 1.3, FEINT = 0.3, PAW = 1.4, STUN = 2, SCREECH = 0.8, GROUNDED = 2.6;
/** (0.225) A grazing Bramble charges at a noise this close (m). */
const BRAMBLE_EAR = 28;
/** (0.225) After a hit, or startled at a bait, a beast leaves baits alone this long (s). */
const SPOOKED = 25;
const lastNoise = new THREE.Vector3();
onNoise((at, r, decoy) => {
  if (!decoy) { heat = Math.min(4, heat + r / 55); lastNoise.copy(at); heard = true; } // a thrown stone or flare does not stir up the wilds
  for (const c of W.creatures) {
    if (c.kind === 'bramble') { // (0.225, stage W4) a noise close by enrages a grazing Bramble: it charges at the sound
      if (c.state === 'roam' && Math.hypot(c.p.x - at.x, c.p.z - at.z) < Math.min(r, BRAMBLE_EAR)) {
        c.state = 'threat'; c.timer = PAW; c.rageAt = at.clone(); c.mat.color.setHex(HOSTILE);
        if (decoy) logLine(tl('A Bramble charges at the noise!'));
      }
      continue;
    }
    if (isWild(c.kind)) { // (0.240) a shot startles the timid ones into a run; the rest only lift their heads
      if (WILD[c.kind].temper === 'timid' && !decoy && c.state !== 'flee' && Math.hypot(c.p.x - at.x, c.p.z - at.z) < r * 0.8) bolt(c.pack ?? [c], at.x, at.z);
      continue;
    }
    if (c.kind === 'skitter' || SWIMMERS.includes(c.kind)) continue; // fliers and the fish do not care about a bang in the distance
    if (c.state === 'feed') continue; // busy eating
    const reach = hears(c.kind, r); // (0.236) each kind's ears (gen/senses.ts): leechwings far, brambles hardly
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
  const pos = G.pos;
  if (Math.random() > 0.55 + heat * 0.12) return;
  const drawn = heard && heat > 0.4 && Math.random() < 0.75, before = W.creatures.length; // the shooting draws them in
  // (0.235, stage L1) out past the fog, ahead of you or off to a side (the shooting: from the side it was heard on),
  // out of everyone's sight; then they make for where you are heading
  const toward = drawn ? Math.atan2(lastNoise.x - pos.x, lastNoise.z - pos.z) : heading(), spread = drawn ? 2.4 : 3.4;
  for (let tries = 0; tries < 12; tries++) {
    const { x, z } = ringSpot(toward + (Math.random() - 0.5) * spread, Math.random());
    if (!farFromPlayers(x, z)) continue;
    const w = env.water(x, z);
    if (w?.kind === 'sea') { // out at sea: a Sea Lurker hunting, or a shoal of Silverfin
      if (w.depth < 2.5 || !hiddenFrom(x, w.level - 1, z, 1.5)) continue;
      spawnSea(x, z, w.level, env.danger(x, z));
      return;
    }
    if (env.forbidden(x, z)) continue;
    const h = env.ground(x, z), lv = env.danger(x, z), roll = Math.random();
    if (!hiddenFrom(x, h, z, 2) || (!drawn && !wayClear(x, z, env.forbidden))) continue; // (0.236) a way to you, not across a river
    if (lv >= 0.6 && lv < 2.2 && Math.random() < 0.12) { // now and then a flock of Skitterwings in the near wilds
      const n = 3 + Math.floor(Math.random() * 3);
      if (!mayspawn(n * 0.3, lv, heat)) return;
      const flock: Creature[] = [];
      for (let i = 0; i < n; i++) { const c = make('skitter', V(x + (Math.random() - 0.5) * 6, h + 5 + Math.random() * 3, z + (Math.random() - 0.5) * 6), lv); c.pack = flock; c.flank = Math.random() * 6.283; flock.push(c); }
    } else if (Math.random() < 0.35) { // gnawers turn up anywhere: fields, woods, ruins, hills, lakesides, even the ice
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
    comeOver(W.creatures.slice(before), drawn ? { x: lastNoise.x, z: lastNoise.z } : meetPoint(), drawn);
    return;
  }
}

/**
 * (0.235, stage L1) Newcomers make for the meeting point: ground beasts walk there (their den goes with them until
 * they settle or start a hunt), fliers move their range there; a grazing Bramble stays where it is.
 */
function comeOver(group: Creature[], at: { x: number; z: number }, drawn: boolean) {
  const noses = group.filter((c) => c.kind === 'ravager' || c.kind === 'gnawer');
  for (const c of group) {
    if (noses.includes(c)) { c.state = 'investigate'; c.noiseAt = V(at.x + (c.p.x - group[0].p.x), c.p.y, at.z + (c.p.z - group[0].p.z)); c.timer = SPAWN.march; c.coming = true; }
    else if (c.kind === 'leechwing' || c.kind === 'skitter') c.home.set(at.x, c.home.y, at.z);
  }
  // (0.236, stage L2) packs of noses go along your track (gen/senses.ts, world/intents.ts); drawn by a shot, they make for the shot
  if (noses.length && !drawn) addIntent('track', noses, BEAST_OPS, noses[0].p.x, noses[0].p.z);
}
/** How world/intents.ts moves a beast on its way: sniffing after a point, until it is after you. */
const BEAST_OPS: IntentOps<Creature> = {
  goto(c, x, z) { if (c.state !== 'roam' && c.state !== 'investigate') return; c.state = 'investigate'; (c.noiseAt ?? (c.noiseAt = V(x, c.p.y, z))).set(x, c.p.y, z); c.timer = 30; c.coming = true; },
  engaged: (c) => c.state !== 'roam' && c.state !== 'investigate',
  alive: (c) => c.hp > 0 && W.creatures.includes(c),
  settle(c) { if (c.state === 'investigate') c.state = 'roam'; c.home.set(c.p.x, c.home.y, c.p.z); c.coming = false; c.den?.copy(c.p); },
  drop: (c) => removeCreature(c),
  at: (c) => c.p,
};

/** A sea spawn at (x, z): a Sea Lurker (from danger 1; two further out) or a shoal of Silverfin. */
function spawnSea(x: number, z: number, level: number, lv: number) {
  if (lv >= 1 && Math.random() < 0.45) {
    const n = lv > 4 && Math.random() < 0.35 ? 2 : 1;
    if (!mayspawn(1.2 * n, lv, heat)) return;
    for (let i = 0; i < n; i++) make('lurker', V(x + i * 6, level - LURK_DEPTH, z), lv);
    return;
  }
  if (!mayspawn(0.1, lv, heat)) return;
  const shoal: Creature[] = [], n = 5 + Math.floor(Math.random() * 5);
  for (let i = 0; i < n; i++) { const c = make('silverfin', V(x + (Math.random() - 0.5) * 5, level - FIN_DEPTH, z + (Math.random() - 0.5) * 5), lv); c.pack = shoal; c.flank = Math.random() * 6.283; shoal.push(c); }
}

// ---------- behaviour ----------
function blockedAt(c: Creature, x: number, z: number): boolean {
  if (!env) return true;
  if (foeRules.blocked(V(x, c.p.y, z)) || env.forbidden(x, z)) return true;
  const gy = env.ground(x, z);
  return !G.space.empty(Math.floor(x), Math.floor(gy + 0.5), Math.floor(z)) || foeRules.body(x, gy, z, bodyR(c));
}
/** How wide a creature is to walls and trunks (less than its reach, so packs still squeeze between trees). */
const bodyR = (c: Creature) => Math.min(0.8, CREATURES[c.kind].r * 0.6);
const inside = (c: Creature) => !!env && foeRules.body(c.p.x, env.ground(c.p.x, c.p.z), c.p.z, bodyR(c));
/** Walk over the ground towards a direction; slides along obstacles. */
function walk(c: Creature, dx: number, dz: number, speed: number, dt: number) {
  const L = Math.hypot(dx, dz);
  c.speed = 0;
  if (L < 1e-3 || !env) return;
  const sx = dx / L * speed * dt, sz = dz / L * speed * dt;
  const to = footStep(c.p.x, c.p.z, sx, sz, (x, z) => blockedAt(c, x, z), inside(c), (x, z) => env!.forbidden(x, z));
  if (!to) return;
  c.p.x = to[0]; c.p.z = to[1];
  c.speed = speed;
  let dh = Math.atan2(dx, dz) - c.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
  c.heading += dh * Math.min(1, dt * 8);
  c.p.y = env.ground(c.p.x, c.p.z) + CREATURES[c.kind].lift;
}
/** A bite or a blow that reaches you; (0.227, stage W5) a heavy one staggers you, some open a wound (`bleeds`: the
 *  chance) and a Bramble's charge throws you down. */
function bite(dmg: number, bleeds = 0, fell = false) {
  if (hurtPlayer(dmg * FOE_HIT, true, .4)) return; // a vehicle took it
  if (fell) knockDown(); else heavyHit(dmg * FOE_HIT);
  if (bleeds && Math.random() < bleeds) bleed();
}
const alerted = new WeakSet<Creature[]>();
const cEye = new THREE.Vector3();
/** Whether a ground beast has made you out (sight `sight` m before crouching, darkness and the like). */
function spots(c: Creature, sight: number, dt: number): boolean {
  cEye.set(c.p.x, c.p.y + 0.3, c.p.z);
  sense(c, cEye, c.heading, sight, dt, false, c.kind);
  if (mindOf(c).aware < STEALTH.spotted) return false;
  if (!proxied() && !targetingFoe()) spottedBy(c);
  return true;
}
/** A hunting beast keeps track of you by sight (and scent up close); out of sight long enough, it goes to sniff where you were. */
function track(c: Creature, dt: number, dist: number) {
  cEye.set(c.p.x, c.p.y + 0.3, c.p.z);
  const sight = c.kind === 'gnawer' ? 18 : c.kind === 'skitter' ? 28 : 22;
  if (sense(c, cEye, c.heading, sight, dt, true, c.kind)) { share(c.pack ?? [c], c); return; }
  const m = mindOf(c);
  if (m.lost > loseOf(c, c.kind) && dist > 8 && m.last) { // (0.236) a tracker with your scent keeps on while your track holds
    if (c.kind === 'skitter') { c.state = 'roam'; c.home.set(m.last.x, c.home.y, m.last.z); return; }
    c.state = 'investigate'; c.noiseAt = m.last.clone(); c.timer = 12;
  }
}

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
      if (!safe && spots(c, 22, dt)) {
        const pack = c.pack ?? [c], lead = pack.find((m) => m.alpha) ?? pack[0];
        share(pack, c);
        for (const m of pack) { m.state = 'hunt'; m.timer = 3 + Math.random() * 2 + HOWL; }
        if (pack.length > 1) { // (0.226, stage W2) the leader rears and howls: the pack gathers, lone ones near come running
          lead.state = 'howl'; lead.timer = HOWL;
          play('growl_ravager', { at: lead.p, vol: 1, rate: 0.55, far: 150, share: 150 });
          for (const o of W.creatures) if (o.kind === 'ravager' && !pack.includes(o) && (o.state === 'roam' || o.state === 'investigate') && o.p.distanceTo(lead.p) < 70) { o.state = 'hunt'; o.timer = 2; }
        }
        if (c.pack && !alerted.has(c.pack)) { alerted.add(c.pack); logLine(tl('Ravagers are hunting you!')); }
      }
      break;
    }
    case 'howl': // head up, standing: the pack holds back until the call is done
      c.speed = 0;
      if (c.timer <= 0) { c.state = 'hunt'; c.timer = 1.5; }
      break;
    case 'hunt': { // circle to its own place round you (0.229: the pack spreads out, or waits its turn where walls leave no room), then go in
      const pack = (c.pack ?? [c]).filter((m) => m.state === 'hunt' || m.state === 'dash' || m.state === 'retreat' || m === c);
      const sl = slotFor(c, pack, c.pack ?? c), fx = sl.x, fz = sl.z;
      walk(c, fx - c.p.x, fz - c.p.z, speed * (sl.wait ? 0.6 : 1), dt);
      if (sl.wait) { if (c.timer <= 0) c.timer = 0.5; break; } // no room on your open side: it paces, waiting its turn
      if (Math.hypot(fx - c.p.x, fz - c.p.z) < 1.5 || c.timer <= -3) { c.state = 'dash'; c.timer = 1.6; c.feint = Math.random() < FEINT ? 0.45 : 0; } // (0.229) given time to get round to its side
      break;
    }
    case 'dash':
      walk(c, to.x, to.z, speed * 1.25, dt);
      if (c.feint && (c.feint -= dt) <= 0) { c.feint = 0; c.state = 'retreat'; c.timer = 0.6; break; } // (0.226) only a feint: it breaks off and comes again
      if (dist < 1.5) { bite((s.damage + 2 * c.level) * c.dmgMul, 0.3); c.state = 'retreat'; c.timer = 0.8; }
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
  const angry = c.state === 'threat' || c.state === 'charge' || c.state === 'recover' || c.state === 'stun';
  if (!angry && c.state !== 'stun' && !safe && (dist < 11 * Math.min(1, targetVis()) + 2 || c.hurt)) { c.state = 'threat'; c.timer = PAW; c.mat.color.setHex(HOSTILE); showToast(tl('A Bramble charges!')); }
  switch (c.state) {
    case 'roam': // graze: amble a little, then stand
      if (c.timer <= 0) { c.dir.set(Math.random() - 0.5, 0, Math.random() - 0.5); c.timer = 3 + Math.random() * 4; }
      if (c.timer > 2) walk(c, c.dir.x, c.dir.z, 0.8, dt); else c.speed = 0;
      break;
    case 'threat': { // face the intruder (or the noise that enraged it), head down, paw the ground, then go
      const ax = c.rageAt ? c.rageAt.x - c.p.x : to.x, az = c.rageAt ? c.rageAt.z - c.p.z : to.z;
      let dh = Math.atan2(ax, az) - c.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); c.heading += dh * Math.min(1, dt * 5);
      if (c.timer <= 0) { c.state = 'charge'; c.timer = c.rageAt ? Math.min(3.5, Math.hypot(ax, az) / s.speed + 0.6) : 2.2; c.dir.set(ax, 0, az).normalize(); }
      break;
    }
    case 'charge': {
      const before = c.p.clone();
      walk(c, c.dir.x, c.dir.z, s.speed, dt);
      if (dist < 2.4 && c.speed > 0) {
        bite((s.damage + 4 * c.level) * c.dmgMul, 0, true);
        if (!foeRules.shielded()) { G.vel.x += c.dir.x * 10; G.vel.z += c.dir.z * 10; G.vel.y = 5; G.onGround = false; }
        c.state = 'recover'; c.timer = 1.6;
      } else if (before.distanceTo(c.p) < 1e-3 && c.timer < 2.2 - 0.25) { // (0.226) head first into a trunk, a stone or a wall: stunned
        c.state = 'stun'; c.timer = STUN; c.rageAt = null;
        burst(c.p.clone().addScaledVector(c.dir, 1.4), 0xffd060, 14, 0.8); play('thud', { at: c.p, vol: 1, rate: 0.6, far: 60 });
        if (dist < 40) logLine(tl('The Bramble slams into it and reels, stunned!'));
      } else if (c.timer <= 0 || before.distanceTo(c.p) < 1e-3) { c.state = 'recover'; c.timer = 1.4; }
      break;
    }
    case 'stun': // reeling: easy to hit, harmless for a moment
      c.speed = 0;
      if (c.timer <= 0) { c.state = 'recover'; c.timer = 0.4; }
      break;
    case 'recover':
      c.speed = 0; c.rageAt = null;
      if (c.timer <= 0) {
        if (!safe && dist < 26) { c.state = 'threat'; c.timer = 1.0; }
        else { c.state = 'roam'; c.hurt = false; c.mat.color.setHex(CALM); }
      }
      break;
  }
  if (c.head) c.head.rotation.x += ((c.state === 'charge' || c.state === 'threat' ? 0.45 : c.state === 'stun' ? 0.7 : 0) - c.head.rotation.x) * Math.min(1, dt * 6);
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
  // from above a crouched figure stands out less, but never as little as on the ground
  const seesPlayer = () => !safe && hd < SIGHT * Math.max(0.6, Math.min(1.3, targetVis())) && rayWorld(c.p, to.clone().normalize(), dist) >= dist - 1;
  if (c.prey && !W.creatures.includes(c.prey)) c.prey = null; // someone else got it
  const target = c.prey ? c.prey.p : V(G.pos.x, G.pos.y + 1.1, G.pos.z);
  if (safe && !c.prey && (c.state === 'stalk' || c.state === 'dive')) { c.state = 'climb'; c.timer = 2; }
  const lookAround = () => {
    if (c.timer > 0) return;
    c.timer = 0.6;
    if (seesPlayer()) {
      c.prey = null; c.state = 'stalk'; c.timer = 6 + Math.random() * 4; c.orbit = Math.atan2(c.p.x - G.pos.x, c.p.z - G.pos.z);
      if (!c.spotted) { c.spotted = true; logLine(tl('A Leechwing has spotted you from above.')); }
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
      if (c.timer <= 0) {
        if (c.prey) { c.state = 'dive'; c.timer = 3.5; }
        else { c.state = 'screech'; c.timer = SCREECH; play('screech_leechwing', { at: c.p, vol: 1, rate: 1.25, far: 120, share: 120 }); } // (0.226) a shriek before it drops
      }
      if (!c.prey && (hd > SIGHT * 1.25 || safe)) { c.state = 'roam'; c.home.copy(c.p); c.timer = 2; }
      break;
    }
    case 'screech': // hangs in the air, wings spread, and shrieks: dodge now
      c.orbit += dt * 0.1;
      steer(c.p.x + c.dir.x * 2, c.p.y + 0.5, c.p.z + c.dir.z * 2, 3, 0.8);
      if (c.timer <= 0) { c.state = 'dive'; c.timer = 3.5; }
      break;
    case 'grounded': { // missed: down on the ground for a moment, wings spread, before it can take off
      c.speed = 0; c.bank *= 0.9;
      c.p.y += (g + 0.35 - c.p.y) * Math.min(1, dt * 6);
      if (c.timer <= 0) { c.state = 'climb'; c.timer = 2.5; c.dir.set(c.dir.x, 0.6, c.dir.z).normalize(); }
      break;
    }
    case 'dive': {
      steer(target.x, target.y, target.z, s.speed, 2.6);
      const d = c.p.distanceTo(target);
      if (c.prey && d < 1.6) { // caught one
        const p = c.prey; p.hp = 0; c.prey = null; burst(p.p.clone(), HOSTILE, 12, 0.8); removeCreature(p);
        c.state = 'climb'; c.timer = 3;
      } else if (!c.prey && dist < 1.8) { bite((s.damage + 3 * c.level) * c.dmgMul); c.state = 'climb'; c.timer = 3; }
      else if (c.timer <= 0) {
        if (!c.prey && c.p.y - g < 5) { c.state = 'grounded'; c.timer = GROUNDED; if (dist < 40) logLine(tl('The Leechwing misses and lands hard: hit it now!')); } // (0.226) a missed dive leaves it on the ground
        else { c.state = 'climb'; c.timer = 2.5; }
      }
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
/**
 * (0.225, stage W4) A hungry beast at a bait: it trots over and feeds, head down, turned from the world. Something
 * that hurts it, or you right on top of it, ends the meal; so does the bait running out.
 */
function feed(c: Creature, dt: number, dist: number, safe: boolean) {
  const b = c.bait;
  if (!b || !baitAlive(b)) { c.state = 'roam'; c.bait = null; c.home.set(c.p.x, c.home.y, c.p.z); c.timer = 0; return; }
  const dx = b.p.x - c.p.x, dz = b.p.z - c.p.z, d = Math.hypot(dx, dz);
  if (d > THROW.bait.eat) { walk(c, dx, dz, CREATURES[c.kind].speed * 0.9, dt); return; }
  c.speed = 0;
  let dh = Math.atan2(dx, dz) - c.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); c.heading += dh * Math.min(1, dt * 4);
  if (!safe && dist < (G.crouch ? 2.5 : 4.5)) { // you walked right up: it turns on you
    for (const m of c.pack ?? [c]) { m.spooked = SPOOKED; if (m.state === 'feed' || m.state === 'roam') { m.state = 'hunt'; m.timer = 0.5; m.bait = null; } }
  }
}
/** Whether a beast leaves what it is doing for a bait: a roaming one smells it from afar, a hunting one only close by. */
function lured(c: Creature, dist: number): Bait | null {
  if ((c.kind !== 'ravager' && c.kind !== 'gnawer') || (c.spooked ?? 0) > 0) return null;
  if (c.state === 'roam' || c.state === 'investigate') return baitNear(c.p.x, c.p.z, THROW.bait.reach);
  if ((c.state === 'hunt' || c.state === 'retreat') && dist > THROW.bait.away) return baitNear(c.p.x, c.p.z, THROW.bait.hunt);
  return null;
}
function investigate(c: Creature, dt: number, safe: boolean) {
  const n = c.noiseAt ?? c.home, s = CREATURES[c.kind];
  c.timer -= dt;
  walk(c, n.x - c.p.x, n.z - c.p.z, s.speed * 0.7, dt);
  const sight = c.kind === 'gnawer' ? 18 : 24;
  if (!safe && spots(c, sight * 1.2, dt)) {
    share(c.pack ?? [c], c);
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
      if (!safe && spots(c, 18, dt)) {
        share(nest, c);
        for (const m of nest) { m.state = 'hunt'; m.timer = 0.2 + Math.random() * 0.8; }
        if (c.pack && !alerted.has(c.pack)) { alerted.add(c.pack); logLine(tl('Gnawers! A whole nest of them!')); }
      }
      break;
    }
    case 'hunt': { // zig-zag in
      if (nest.length <= 2 && c.hurt) { c.state = 'retreat'; c.timer = 4; break; }
      // (0.229) each comes from its own side; with no room left it waits a few metres off
      const sl = slotFor(c, nest.filter((m) => m.state === 'hunt' || m.state === 'retreat' || m === c), nest, 2.5);
      if (sl.wait) { const wx = sl.x - c.p.x, wz = sl.z - c.p.z; if (Math.hypot(wx, wz) > 1) walk(c, wx, wz, speed * 0.6, dt); else c.speed = 0; break; }
      const close = dist < 3 || Math.hypot(sl.x - c.p.x, sl.z - c.p.z) < 1.5, gx = close ? to.x : sl.x - c.p.x, gz = close ? to.z : sl.z - c.p.z, gd = Math.hypot(gx, gz);
      const side = Math.sin(c.anim * 0.35 + c.flank) * 0.9, sx = -gz, sz = gx, L = Math.hypot(sx, sz) || 1;
      walk(c, gx + sx / L * side * Math.min(4, gd), gz + sz / L * side * Math.min(4, gd), speed, dt);
      if (dist < 1.25) { bite((s.damage + c.level) * c.dmgMul, 0.12); c.state = 'retreat'; c.timer = 0.5 + Math.random() * 0.6; }
      break;
    }
    case 'retreat':
      walk(c, -to.x + (Math.random() - 0.5) * 2, -to.z + (Math.random() - 0.5) * 2, speed, dt);
      if (c.timer <= 0) { c.state = nest.length <= 2 && c.hurt ? 'retreat' : 'hunt'; c.timer = nest.length <= 2 && c.hurt ? 3 : 0; }
      break;
    case 'scatter': // (0.226) one of the nest fell: the rest break every way and go to ground in the grass, then come from all sides
      walk(c, c.dir.x, c.dir.z, speed * 1.1, dt);
      if (c.timer <= 0) { c.state = 'hunt'; c.timer = 0; c.flank = Math.random() * 6.283; }
      break;
  }
}

/**
 * Skitterwings: a flock flutters in jittery loops a few metres up round where it settled. Once one sees you (within
 * ~28 m) the flock follows you and, one or two at a time, they swoop down, peck and flap back up. Harmless alone,
 * a nuisance in numbers; a single blow or shot brings one down.
 */
function skitter(c: Creature, dt: number, to: THREE.Vector3, dist: number, safe: boolean) {
  const s = CREATURES.skitter, g = env!.ground(c.p.x, c.p.z), flock = c.pack ?? [c];
  c.timer -= dt;
  const fly = (tx: number, ty: number, tz: number, speed: number, turn: number) => {
    const want = V(tx - c.p.x, ty - c.p.y, tz - c.p.z), L = want.length();
    if (L > 0.01) want.divideScalar(L);
    want.x += (Math.random() - 0.5) * 0.6; want.y += (Math.random() - 0.5) * 0.4; want.z += (Math.random() - 0.5) * 0.6; // the flutter
    c.dir.lerp(want.normalize(), Math.min(1, turn * dt)).normalize();
    c.p.addScaledVector(c.dir, speed * dt);
    const floor = env!.ground(c.p.x, c.p.z) + 0.8;
    if (c.p.y < floor) { c.p.y = floor; if (c.dir.y < 0) c.dir.y = 0.2; }
    c.heading = Math.atan2(c.dir.x, c.dir.z); c.speed = speed;
  };
  const sees = () => !safe && spots(c, 28, 0.5);
  if (safe && c.state !== 'roam') { c.state = 'roam'; c.home.set(c.p.x, c.home.y, c.p.z); }
  switch (c.state) {
    case 'roam': {
      c.orbit += dt * (1.2 + (c.flank % 1));
      fly(c.home.x + Math.cos(c.orbit) * 5, g + 5 + Math.sin(c.orbit * 1.7) * 1.5, c.home.z + Math.sin(c.orbit * 1.3) * 5, 5, 3);
      if (c.timer <= 0) { c.timer = 0.5; if (sees()) for (const m of flock) { m.state = 'hunt'; m.timer = 1 + Math.random() * 3; } }
      break;
    }
    case 'hunt': { // follow above you, then swoop, one or two at a time
      c.orbit += dt * 1.6;
      fly(G.pos.x + Math.cos(c.orbit + c.flank) * 6, G.pos.y + 5 + Math.sin(c.orbit * 2) * 1.2, G.pos.z + Math.sin(c.orbit + c.flank) * 6, 9, 3);
      if (c.timer <= 0 && flock.filter((m) => m.state === 'dive').length < 2) { c.state = 'dive'; c.timer = 2.5; }
      if (dist > 60) { c.state = 'roam'; c.home.set(c.p.x, c.home.y, c.p.z); }
      break;
    }
    case 'dive':
      fly(G.pos.x, G.pos.y + 1.4, G.pos.z, s.speed, 6);
      if (dist < 1.2) { bite((s.damage + c.level * 0.5) * c.dmgMul); c.state = 'climb'; c.timer = 1.4; }
      else if (c.timer <= 0) { c.state = 'climb'; c.timer = 1; }
      break;
    case 'climb':
      fly(c.p.x - to.x, G.pos.y + 7, c.p.z - to.z, 9, 4);
      if (c.timer <= 0) { c.state = 'hunt'; c.timer = 2 + Math.random() * 4; }
      break;
    default: c.state = 'roam';
  }
}

/** Depth of the sea creatures' bodies under the surface (the Lurker's fin and the fish's backs just break it). */
const LURK_DEPTH = 0.55, FIN_DEPTH = 0.35;
/** Swim over the sea towards a direction, keeping to water at least `min` deep (turning along the shore). */
function swim(c: Creature, dx: number, dz: number, speed: number, dt: number, depth: number, min: number) {
  const L = Math.hypot(dx, dz);
  c.speed = 0;
  if (L < 1e-3 || !env) return;
  const ok = (x: number, z: number) => { const w = env!.water(x, z); return !!w && w.kind === 'sea' && w.depth >= min; };
  let hx = dx / L, hz = dz / L;
  if (!ok(c.p.x + hx * 3, c.p.z + hz * 3)) { // the shallows ahead: turn along them
    let found = false;
    for (const a of [0.6, -0.6, 1.2, -1.2, 2, -2, 3]) { const cx = hx * Math.cos(a) - hz * Math.sin(a), cz = hx * Math.sin(a) + hz * Math.cos(a); if (ok(c.p.x + cx * 3, c.p.z + cz * 3)) { hx = cx; hz = cz; found = true; break; } }
    if (!found) return;
  }
  c.p.x += hx * speed * dt; c.p.z += hz * speed * dt;
  const w = env.water(c.p.x, c.p.z);
  if (w) c.p.y += (w.level - depth - c.p.y) * Math.min(1, dt * 4);
  let dh = Math.atan2(hx, hz) - c.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
  c.heading += dh * Math.min(1, dt * 3);
  c.speed = speed;
}
/** Is the player in the sea (swimming or wading), not dry aboard a boat or on a pier? */
function playerInSea(): boolean {
  const w = env!.water(G.pos.x, G.pos.z);
  return !!w && w.kind === 'sea' && G.pos.y < w.level + 0.3;
}
/**
 * Sea Lurkers roam the open sea with the dorsal fin just out of the water. Someone swimming within ~45 m is hunted:
 * the Lurker circles in, then lunges and bites, and pulls away to come again. A boat it only circles, showing its fin.
 */
function lurker(c: Creature, dt: number, to: THREE.Vector3, _dist: number, safe: boolean) {
  const s = CREATURES.lurker, speed = s.speed + Math.min(2, c.level * 0.3), flat = Math.hypot(to.x, to.z), prey = !safe && playerInSea();
  c.timer -= dt;
  switch (c.state) {
    case 'roam': {
      if (c.timer <= 0) { c.dir.set(Math.random() - 0.5, 0, Math.random() - 0.5); c.timer = 4 + Math.random() * 5; }
      const back = c.home.clone().sub(c.p); back.y = 0;
      if (back.length() > 40) c.dir.copy(back);
      swim(c, c.dir.x, c.dir.z, 2.5, dt, LURK_DEPTH, 1.6);
      if (flat < 45 && !safe) { c.state = 'stalk'; c.timer = prey ? 3 + Math.random() * 3 : 8; if (prey) logLine(tl('A fin cuts the water near you!')); }
      break;
    }
    case 'stalk': { // circle the swimmer (or the boat), closing in
      c.orbit += dt * 0.5;
      const R = prey ? 4 + Math.max(0, c.timer) * 2 : 9;
      swim(c, G.pos.x + Math.cos(c.orbit) * R - c.p.x, G.pos.z + Math.sin(c.orbit) * R - c.p.z, speed * 0.8, dt, LURK_DEPTH, 1.6);
      if (prey && c.timer <= 0) { c.state = 'dash'; c.timer = 2.5; }
      if (!prey && c.timer <= 0) { c.state = 'roam'; c.home.set(c.p.x, c.home.y, c.p.z); c.timer = 3; }
      if (flat > 70) { c.state = 'roam'; c.home.set(c.p.x, c.home.y, c.p.z); }
      break;
    }
    case 'dash':
      swim(c, to.x, to.z, speed * 1.5, dt, LURK_DEPTH * 0.5, 1.2);
      if (prey && flat < 1.9) { bite((s.damage + 3 * c.level) * c.dmgMul, 0.45); c.state = 'retreat'; c.timer = 2; }
      else if (c.timer <= 0 || !prey) { c.state = 'stalk'; c.timer = 3; }
      break;
    case 'retreat':
      swim(c, -to.x, -to.z, speed, dt, LURK_DEPTH, 1.6);
      if (c.timer <= 0) { c.state = 'stalk'; c.timer = 2 + Math.random() * 3; }
      break;
    default: c.state = 'roam';
  }
  if (c.tail) c.tail.rotation.y = Math.sin(c.anim * 1.2) * (0.25 + c.speed * 0.03);
}
/** Silverfin: a shoal drifts and turns together; anyone close sends it darting away. Now and then one leaps. */
function silverfin(c: Creature, dt: number, to: THREE.Vector3) {
  const shoal = c.pack ?? [c], lead = shoal[0];
  c.timer -= dt;
  if (c === lead && c.timer <= 0) { c.dir.set(Math.random() - 0.5, 0, Math.random() - 0.5); c.timer = 3 + Math.random() * 4; }
  const scared = Math.hypot(to.x, to.z) < 12 || c.hurt;
  const dx = scared ? -to.x : lead.dir.x + (lead.p.x - c.p.x) * 0.3 + Math.cos(c.flank) * 0.2, dz = scared ? -to.z : lead.dir.z + (lead.p.z - c.p.z) * 0.3 + Math.sin(c.flank) * 0.2;
  if (c.state === 'climb') { // a leap: out of the water in a little arc
    c.orbit += dt * 1.8;
    const w = env!.water(c.p.x, c.p.z), k = Math.min(1, c.orbit);
    c.p.x += Math.sin(c.heading) * 3 * dt; c.p.z += Math.cos(c.heading) * 3 * dt;
    if (w) c.p.y = w.level - FIN_DEPTH + Math.sin(k * Math.PI) * 1.2;
    if (k >= 1) c.state = 'roam';
    return;
  }
  swim(c, dx, dz, scared ? CREATURES.silverfin.speed : 1.8, dt, FIN_DEPTH, 1.2);
  if (Math.random() < dt * 0.05) { c.state = 'climb'; c.orbit = 0; }
}

// ---------- wildlife (0.240, gen/wildlife.ts) ----------
/** A timid herd bolts away from a point (you, a shot), each a little to its own side. */
function bolt(herd: Creature[], x: number, z: number) {
  for (const m of herd) {
    if (remoteOf(m)) continue;
    const a = Math.atan2(m.p.x - x, m.p.z - z) + (Math.random() - 0.5) * 0.9;
    m.dir.set(Math.sin(a), 0, Math.cos(a)); m.state = 'flee'; m.timer = 5 + Math.random() * 3;
  }
}
/** Rouse a wild animal against whoever it is facing: it charges (the giant comes to stamp). */
function rouse(c: Creature, why: 'temper' | 'hurt') {
  const w = WILD[c.kind as WildKind];
  c.anger = 1.2; c.roused = w.chase; c.state = 'charge'; c.timer = 2.5;
  if (why === 'temper' && !c.warned && !proxied()) logLine(TL`The ${CREATURES[c.kind].name} attacks!`);
  c.warned = true;
}
/** How you come at it (gen/wildlife.ts `Approach`): the turn's target, how much it stands out, how fast, at its face. */
function approach(c: Creature, to: THREE.Vector3) {
  const flat = Math.hypot(to.x, to.z) || 1e-3;
  const speed = proxied() || targetingFoe() ? 2 : Math.hypot(G.vel.x, G.vel.z);
  return { d: flat, vis: targetVis(), speed, front: (Math.sin(c.heading) * to.x + Math.cos(c.heading) * to.z) / flat };
}
/** Turn to face a direction (rad a second, eased). */
function face(c: Creature, x: number, z: number, dt: number, rate = 5) {
  let dh = Math.atan2(x, z) - c.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); c.heading += dh * Math.min(1, dt * rate);
}
const WARN_SOUND: Partial<Record<WildKind, [string, number]>> = { ridgeback: ['growl_ravager', 0.6], serpent: ['hiss', 0.55], scorpid: ['hiss', 1.3], crestjaw: ['hiss', 0.8], tusker: ['growl_ravager', 1.4] };
/**
 * A wild animal's turn. It grazes about its ground (a herd keeps near its first), and how it takes you is its temper:
 * a timid one bolts, a wary one rears and growls and then charges if you keep coming, a touchy one rises the more
 * carelessly you come (upright, running, at its face) and strikes, an ambusher strikes from close without a word, a
 * defensive one only answers a blow. Roused, it goes at you for a while, backs off after a blow and comes again,
 * then calms down. The Crown Titan stamps the ground round it instead of biting.
 */
function wild(c: Creature, dt: number, to: THREE.Vector3, dist: number, safe: boolean) {
  const k = c.kind as WildKind, w = WILD[k], s = CREATURES[k], herd = c.pack ?? [c], lead = herd[0];
  c.timer -= dt;
  const a = approach(c, to), flat = a.d;
  if (safe && c.state !== 'flee') { c.anger = 0; c.roused = 0; if (c.state !== 'roam') { c.state = 'roam'; c.timer = 0; } }
  if (c.state === 'hunt') c.state = 'charge'; // back on its ground after the edge of it (beastMorale)
  const grazeTo = () => { // amble about its ground; the herd keeps to its lead
    if (c !== lead && lead.p.distanceTo(c.p) > 7) { walk(c, lead.p.x + Math.cos(c.flank) * 4 - c.p.x, lead.p.z + Math.sin(c.flank) * 4 - c.p.z, s.speed * 0.25, dt); return; }
    if (c.timer <= 0) { c.dir.set(Math.random() - 0.5, 0, Math.random() - 0.5); c.timer = 3 + Math.random() * 6; }
    const back = c.home.clone().sub(c.p); back.y = 0;
    if (back.length() > (k === 'titan' ? 40 : 14)) c.dir.copy(back);
    const still = k === 'crestjaw' || k === 'serpent' ? 0.85 : 0.45; // the basking ones hardly move
    if (c.timer > 6 * still) walk(c, c.dir.x, c.dir.z, k === 'titan' ? s.speed * 0.6 : s.speed * 0.12, dt); else c.speed = 0;
  };
  switch (c.state) {
    case 'roam': case 'investigate': case 'recover': {
      if (c.state === 'recover') { c.speed = 0; if (c.timer > 0) break; c.state = 'roam'; c.hurt = false; }
      if (c.state === 'investigate') c.state = 'roam';
      grazeTo();
      if (safe || flat > w.notice * 1.5) { c.anger = Math.max(0, (c.anger ?? 0) - dt * 0.3); break; }
      if (w.temper === 'timid') { if (scared(w, a)) bolt(herd, c.p.x + to.x, c.p.z + to.z); break; }
      c.anger = temperAfter(c.anger ?? 0, provoke(w, a), dt);
      if (c.anger >= 1) { rouse(c, 'temper'); break; }
      if ((w.temper === 'wary' && c.anger > 0.05) || (w.temper === 'touchy' && c.anger > 0.3)) { // the warning: stand, face you, call
        c.state = 'threat'; c.timer = 1;
        const snd = WARN_SOUND[k]; if (snd) play(snd[0] as never, { at: c.p, vol: 1, rate: snd[1], far: 120, share: 120 });
        if (!c.warned && !proxied() && dist < 60) { c.warned = true; logLine(w.temper === 'wary' ? TL`A ${s.name} rears up and warns you off. Back away!` : TL`A ${s.name} stirs: keep low and go slowly.`); }
      }
      break;
    }
    case 'threat': // facing you, warning; back away and it settles, keep coming and it goes for you
      c.speed = 0; face(c, to.x, to.z, dt);
      c.anger = temperAfter(c.anger ?? 0, safe ? -1 : provoke(w, a), dt);
      if (c.anger >= 1) rouse(c, 'temper');
      else if (c.anger <= 0 && c.timer <= 0) { c.state = 'roam'; c.timer = 0; }
      break;
    case 'charge': {
      c.roused = (c.roused ?? 0) - dt;
      if (k === 'titan') { // walks up, rears and brings its forefeet down: everything near is thrown
        if (flat > w.strike) { walk(c, to.x, to.z, s.speed * 1.4, dt); break; }
        c.speed = 0;
        const hit = Math.max(0, 1 - flat / (w.strike + 2));
        burst(V(c.p.x + Math.sin(c.heading) * 4, c.p.y - s.lift + 0.3, c.p.z + Math.cos(c.heading) * 4), 0x8a7a4a, 30, 3);
        play('thud', { at: c.p, vol: 1, rate: 0.35, far: 220, share: 220 });
        if (hit > 0 && !safe) { bite(s.damage * hit * c.dmgMul, 0, true); if (!foeRules.shielded() && !proxied()) { G.vel.x += to.x / flat * 9; G.vel.z += to.z / flat * 9; G.vel.y = 6; G.onGround = false; } }
        c.state = 'retreat'; c.timer = 2.6;
        break;
      }
      walk(c, to.x, to.z, s.speed * (k === 'serpent' ? 2.2 : 1.15), dt);
      if (flat < s.r + 1.3) {
        bite((s.damage + 2 * c.level) * c.dmgMul, k === 'scorpid' ? 0.6 : k === 'crestjaw' || k === 'ridgeback' ? 0.35 : 0, k === 'ridgeback' || k === 'tusker');
        c.state = 'retreat'; c.timer = k === 'crestjaw' ? 3 : 1 + Math.random();
      } else if (c.timer <= 0) { c.state = 'retreat'; c.timer = 0.8; }
      break;
    }
    case 'retreat': { // after a blow: back off (an ambusher slips back to its spot), then again while still roused
      c.roused = (c.roused ?? 0) - dt;
      if (k === 'crestjaw') walk(c, c.home.x - c.p.x, c.home.z - c.p.z, s.speed * 0.6, dt);
      else if (k === 'titan') { c.speed = 0; face(c, to.x, to.z, dt, 1); }
      else walk(c, -to.x, -to.z, s.speed * 0.7, dt);
      if (c.timer > 0) break;
      if ((c.roused ?? 0) > 0 && !safe && flat < w.ground + 10) { c.state = 'charge'; c.timer = 2.5; }
      else { c.state = 'recover'; c.timer = 1.5; c.anger = 0; c.roused = 0; c.warned = false; c.home.set(c.p.x, c.home.y, c.p.z); }
      break;
    }
    case 'flee': { // run from where the fright came from, then graze where it ended up
      walk(c, c.dir.x, c.dir.z, s.speed, dt);
      if (c.timer <= 0) { c.state = 'roam'; c.timer = 0; c.home.set(c.p.x, c.home.y, c.p.z); c.den?.copy(c.p); }
      break;
    }
    default: c.state = 'roam';
  }
}
/** (0.240) The wildlife's spawner, paced apart from the encounters (WILDLIFE in gen/wildlife.ts): a herd of what
 *  lives in this land turns up out of sight round you, at most `groups` of them about at once. */
let wildT = 3;
function tryWild() {
  if (!env?.biome || !wildOk()) return;
  const pos = G.pos, herds = new Set<unknown>(), crowd: Partial<Record<WildKind, number>> = {};
  for (const c of W.creatures) {
    if (!isWild(c.kind)) continue;
    const d = Math.hypot(c.p.x - pos.x, c.p.z - pos.z);
    if (d < WILDLIFE.reach) herds.add(c.pack ?? c);
    if (d < WILDLIFE.giantReach) crowd[c.kind] = (crowd[c.kind] ?? 0) + 1;
  }
  if (herds.size >= WILDLIFE.groups) return;
  for (let tries = 0; tries < 8; tries++) {
    let { x, z } = ringSpot(Math.random() * 6.283, Math.random());
    if (!farFromPlayers(x, z) || env.forbidden(x, z)) continue;
    const biome = env.biome(x, z);
    if (biome === 'sea' || biome === 'ice') continue;
    const shore = shoreNear(x, z);
    const k = wildPick(biome, env.danger(x, z), Math.random(), !!shore, crowd);
    if (!k) continue;
    if (WILD[k].shore && shore) { x = shore[0]; z = shore[1]; }
    if (!hiddenFrom(x, env.ground(x, z), z, Math.min(6, CREATURES[k].lift * 2 + 1))) continue;
    const [lo, hi] = WILD[k].herd, n = lo + Math.floor(Math.random() * (hi - lo + 1)), herd: Creature[] = [], lv = env.danger(x, z);
    const spread = k === 'titan' ? 18 : k === 'hexastrider' ? 9 : 5;
    for (let i = 0; i < n; i++) {
      const px = x + (i ? (Math.random() - 0.5) * spread : 0), pz = z + (i ? (Math.random() - 0.5) * spread : 0);
      if (i && env.forbidden(px, pz)) continue;
      const c = make(k, V(px, env.ground(px, pz) + CREATURES[k].lift, pz), lv);
      c.pack = herd; c.flank = Math.random() * 6.283; herd.push(c);
    }
    return;
  }
}
/** A dry spot at the edge of fresh or murky water within ~30 m (where a Crestjaw lies), or null. */
function shoreNear(x: number, z: number): [number, number] | null {
  if (!env) return null;
  for (let a = 0; a < 6.283; a += 0.785) {
    let dry: [number, number] = [x, z];
    for (let r = 4; r <= 32; r += 4) {
      const px = x + Math.sin(a) * r, pz = z + Math.cos(a) * r, w = env.water(px, pz);
      if (w && w.kind !== 'sea' && w.kind !== 'toxic' && w.depth > 0.4) return r > 4 ? dry : null;
      dry = [px, pz];
    }
  }
  return null;
}

// ---------- its ground and its nerve (0.228, PLAN_WALKI.md stage W6) ----------
const packSize = new WeakMap<Creature[], number>(), packHalf = new WeakSet<Creature[]>(), leashTold = new WeakSet<object>();
/** The states in which it is after someone. */
const CHASING = new Set<State>(['hunt', 'dash', 'threat', 'charge', 'stalk', 'dive', 'screech', 'howl', 'scatter']);
const GROUND_KINDS = new Set<CreatureKind>(['ravager', 'gnawer', 'bramble', 'ridgeback', 'serpent', 'crestjaw', 'titan', 'tusker', 'scorpid']);
/** How it takes up the chase again when you come back onto its ground. */
const RESUME: Partial<Record<CreatureKind, State>> = { ravager: 'hunt', gnawer: 'hunt', bramble: 'threat' };
/**
 * Its ground and its nerve, before the kind's own turn: it heals at its den when left alone, takes heart again,
 * fears fire; a beast after you past the edge of its ground gives up (a ground beast stops and calls first), a broken
 * one runs for its den (by its den it fights on). True = this turn is taken.
 */
function beastMorale(c: Creature, dt: number, dist: number, safe: boolean): boolean {
  const den = c.den ?? (c.den = c.p.clone());
  if (c.pack && !packSize.has(c.pack)) packSize.set(c.pack, c.pack.length);
  c.calm = (c.calm ?? 99) + dt;
  const fromDen = Math.hypot(c.p.x - den.x, c.p.z - den.z), tgtDen = Math.hypot(G.pos.x - den.x, G.pos.z - den.z), R = TERRITORY[c.kind];
  if (fromDen < DEN.at && c.calm > DEN.calm && c.hp < c.maxHp) c.hp = Math.min(c.maxHp, c.hp + c.maxHp * DEN.heal * dt); // licking its wounds
  if (c.morale !== undefined) {
    const top = c.alpha ? MORALE.start.alpha : MORALE.start[c.kind] ?? 0.6;
    if (c.calm > MORALE.calm && c.morale < top) c.morale = Math.min(top, c.morale + MORALE.regain * dt);
    for (const f of fires) if (Math.hypot(f.x - c.p.x, f.z - c.p.z) < MORALE.fire.r) { c.morale = Math.max(0, c.morale - MORALE.fire.rate * dt); break; } // fire!
    if (CHASING.has(c.state) && breaks(effective(c.morale, { atDen: fromDen < DEN.r }))) {
      if (GROUND_KINDS.has(c.kind)) { c.state = 'rout'; c.timer = 12; }
      else { c.state = c.kind === 'leechwing' ? 'climb' : 'roam'; c.timer = 4; c.home.copy(den); c.prey = null; }
      if (!proxied() && dist < 60) logLine(TL`The ${CREATURES[c.kind].name} breaks off and flees!`);
      return true;
    }
  }
  if (c.state === 'rout') { // to its den as fast as it can; there it holds on
    const s = CREATURES[c.kind];
    if (fromDen < 3 || c.timer <= 0) { c.state = 'roam'; c.home.copy(den); c.timer = 0; return true; }
    c.timer -= dt; walk(c, den.x - c.p.x, den.z - c.p.z, s.speed * 0.9, dt);
    return true;
  }
  if (c.state === 'leash') { // at the edge: it stops and calls, then goes home; back on its ground and it comes again
    c.timer -= dt;
    if (!safe && tgtDen < R * 0.85 && c.timer < 0) { c.state = RESUME[c.kind] ?? 'hunt'; c.timer = 1; return true; }
    if (c.timer > 0) { c.speed = 0; const dh = Math.atan2(G.pos.x - c.p.x, G.pos.z - c.p.z) - c.heading; c.heading += Math.atan2(Math.sin(dh), Math.cos(dh)) * Math.min(1, dt * 5); return true; }
    if (fromDen < 3) { c.state = 'roam'; c.home.copy(den); c.timer = 0; return true; }
    walk(c, den.x - c.p.x, den.z - c.p.z, CREATURES[c.kind].speed * 0.45, dt);
    return true;
  }
  if (CHASING.has(c.state) && pastEdge(c.kind, tgtDen) && fromDen > R * 0.5) { // you are off its ground: the chase ends
    const key = c.pack ?? c;
    if (!leashTold.has(key) && !proxied() && dist < 90) { leashTold.add(key); logLine(c.pack ? tl('The pack gives up the chase at the edge of its ground.') : TL`The ${CREATURES[c.kind].name} gives up the chase at the edge of its ground.`); }
    if (GROUND_KINDS.has(c.kind)) { c.state = 'leash'; c.timer = LEASH_POSE; c.rageAt = null; }
    else { c.state = c.kind === 'leechwing' ? 'climb' : 'roam'; c.timer = 3; c.home.copy(den); c.prey = null; }
    return true;
  }
  return false;
}

/** Spawning, behaviour and animation of every creature (open world only). */
export function updateCreatures(dt: number, time: number) {
  if (!env) return;
  heat *= Math.exp(-dt / 25);
  if ((spawnT -= dt) <= 0) { spawnT = 4.5 / (1 + heat); trySpawn(); }
  if ((wildT -= dt) <= 0) { wildT = WILDLIFE.every; tryWild(); }
  for (let i = W.creatures.length - 1; i >= 0; i--) {
    const c = W.creatures[i];
    if (stepRemote(c, dt)) { animate(c, dt, time); continue; } // another player's: it does what its owner says
    if (!c.cityPost && (c.questId ? nearestPlayer(c.p.x, c.p.z) > 240 : mayDrop(c, c.p.x, c.p.y, c.p.z))) { removeCreature(c); continue; } // (0.235) far off and out of everyone's sight
    if (c.coming) { if (c.state === 'investigate') (c.den ?? (c.den = c.p.clone())).copy(c.p); else c.coming = false; } // on its way: its ground goes with it
    const held = tickCond(c, dt, (d, cr) => hurtCreature(c, d, cr)); // (0.227, stage W5) bleeding; down or reeling
    if (c.hp <= 0 || !W.creatures.includes(c)) continue; // bled out
    if (held) { c.speed = 0; animate(c, dt, time); continue; }
    withFoeTarget(c, () => {
      const to = V(G.pos.x, G.pos.y + 1.2, G.pos.z).sub(c.p), dist = to.length(), safe = !targetingFoe() && foeRules.playerSafe();
      if (c.spooked) c.spooked = Math.max(0, c.spooked - dt);
      if (beastMorale(c, dt, dist, safe)) return; // (0.228, stage W6) its ground, its nerve
      if (baits.length && c.state !== 'feed') { const b = lured(c, dist); if (b) { c.state = 'feed'; c.bait = b; } }
      if (c.state === 'feed') { feed(c, dt, dist, safe); return; }
      if (!safe && (c.kind === 'ravager' || c.kind === 'gnawer' || c.kind === 'skitter') && (c.state === 'hunt' || c.state === 'dash' || c.state === 'retreat')) track(c, dt, dist);
      if (isWild(c.kind)) wild(c, dt, to, dist, safe); // (0.240) the wildlife
      else if (c.state === 'investigate' && (c.kind === 'ravager' || c.kind === 'bramble' || c.kind === 'gnawer')) investigate(c, dt, safe);
      else if (c.kind === 'skitter') skitter(c, dt, to, dist, safe);
      else if (c.kind === 'lurker') lurker(c, dt, to, dist, safe);
      else if (c.kind === 'silverfin') silverfin(c, dt, to);
      else if (c.kind === 'ravager') ravager(c, dt, to, dist, safe);
      else if (c.kind === 'bramble') bramble(c, dt, to, dist, safe);
      else if (c.kind === 'gnawer') gnawer(c, dt, to, dist, safe);
      else leechwing(c, dt, to, dist, safe);
    });
    animate(c, dt, time);
  }
  updateDead(dt);
}
function animate(c: Creature, dt: number, time: number) {
  c.g.position.copy(c.p); c.g.rotation.y = c.heading;
  if (c.slope) { c.g.rotation.x -= c.slope[0]; c.g.rotation.z -= c.slope[1]; } // the poses below ease from their own angles
  c.anim += dt * (1 + c.speed * 1.4);
  const sw = c.speed > 0.1 ? Math.sin(c.anim * 1.6) * Math.min(0.7, 0.2 + c.speed * 0.06) : 0;
  c.legs.forEach((l, i) => { l.rotation.x = (c.gait ? c.gait[i] : i === 0 || i === 3 ? 1 : -1) * sw * (c.kind === 'titan' ? 0.45 : 1); });
  if (c.kind === 'ravager' || c.kind === 'gnawer') { // (0.225) nose down, tearing at the bait; (0.226) reared up howling
    const eating = c.state === 'feed' && c.speed < 0.1, howl = c.state === 'howl' || (c.state === 'leash' && c.speed < 0.1); // (0.228) it stops at the edge of its ground and calls
    c.g.rotation.x += ((eating ? 0.24 + Math.sin(time * 9 + c.flank) * 0.07 : howl ? -0.45 : 0) - c.g.rotation.x) * Math.min(1, dt * 8);
    if (eating && c.jaw) c.jaw.rotation.x = 0.05 + Math.max(0, Math.sin(time * 9 + c.flank)) * 0.4;
    if (howl && c.jaw) c.jaw.rotation.x = 0.6;
    if (c.state === 'scatter') c.g.position.y -= 0.14; // low in the grass
  }
  if (isWild(c.kind)) wildLook(c, dt, time);
  if (c.kind === 'bramble') { // (0.226) pawing the ground before a charge; reeling with sparks when stunned
    if (c.state === 'threat') { c.g.rotation.z = Math.sin(time * 14) * 0.05; if (Math.random() < dt * 8) burst(c.p.clone().setY(c.p.y - CREATURES.bramble.lift + 0.1).addScaledVector(V(Math.sin(c.heading), 0, Math.cos(c.heading)), 1), 0x8a7a4a, 2, 0.35); }
    else if (c.state === 'stun') { c.g.rotation.z = Math.sin(time * 5) * 0.12; if (Math.random() < dt * 10) burst(c.p.clone().setY(c.p.y + 1), 0xffd060, 1, 0.5); }
    else c.g.rotation.z = 0;
  }
  if (c.tail) c.tail.rotation.y = Math.sin(time * (c.state === 'hunt' ? 12 : 4) + c.flank) * (c.state === 'hunt' ? 0.45 : 0.25);
  if (c.kind === 'skitter') { // fast beating wings, nose along the flight path
    const beat = 0.2 + Math.sin(time * 30 + c.flank) * 0.7;
    c.wings[0].rotation.z = -beat; c.wings[1].rotation.z = beat;
    c.g.rotation.x = -Math.asin(Math.max(-1, Math.min(1, c.dir.y))) * 0.6;
  } else if (c.kind === 'silverfin') c.g.rotation.x = c.state === 'climb' ? -Math.cos(Math.min(1, c.orbit) * Math.PI) * 0.7 : 0;
  else if (c.wings.length) {
    // gliding on outstretched wings, beating hard when climbing, folded back in a dive; nose follows the flight path
    const beat = c.state === 'climb' ? 0.5 + Math.sin(time * 11) * 0.45 : c.state === 'stalk' ? 0.25 + Math.sin(time * 5) * 0.2 : c.state === 'screech' ? 0.7 + Math.sin(time * 16) * 0.5 : c.state === 'grounded' ? -0.15 : 0.12 + Math.sin(time * 2.2) * 0.1;
    const lift = c.state === 'dive' ? 0.95 : beat;
    c.wings[0].rotation.z = -lift; c.wings[1].rotation.z = lift;
    c.g.rotation.x = c.state === 'grounded' ? 0 : c.state === 'screech' ? -0.5 : -Math.asin(Math.max(-1, Math.min(1, c.dir.y))); c.g.rotation.z = c.state === 'grounded' ? 0 : c.bank;
  }
  condLook(c, dt, time);
  onSlope(c, dt);
  c.flash -= dt;
  if (c.flash > 0) c.mat.color.setHex(0xffffff);
  else c.mat.color.setHex(baseColor(c));
}
/** (0.240) A wild animal's head and jaw: the head down grazing, up and the jaw open when it warns or strikes; a
 *  hopling hops, a serpent's neck sways. */
function wildLook(c: Creature, dt: number, time: number) {
  const k = c.kind as WildKind, angry = c.state === 'threat' || c.state === 'charge', e = Math.min(1, dt * 6);
  if (c.head) c.head.rotation.x += ((angry ? -0.25 : c.speed < 0.1 && c.state === 'roam' && k !== 'serpent' && k !== 'crestjaw' ? 0.35 + Math.sin(time * 1.3 + c.flank) * 0.1 : 0) - c.head.rotation.x) * e;
  if (c.head && k === 'serpent') c.head.rotation.y = Math.sin(time * 0.9 + c.flank) * (angry ? 0.25 : 0.12);
  if (c.jaw) c.jaw.rotation.x += ((angry ? 0.45 + (c.state === 'threat' ? Math.sin(time * 9) * 0.1 : 0) : 0.02) - c.jaw.rotation.x) * e;
  if (k === 'hopling' && c.speed > 0.1) c.g.position.y += Math.abs(Math.sin(c.anim * 2.2)) * 0.35;
  if (k === 'ridgeback' && c.state === 'threat') c.g.rotation.x += (-0.35 - c.g.rotation.x) * e; // up on its hind legs
  else if (k === 'ridgeback') c.g.rotation.x += (0 - c.g.rotation.x) * e;
}
/** (0.237.2, the owner's report) A beast walking a hillside lies along it: pitched up or down the slope it faces and
 *  rolled across it, sampled from the ground half a body ahead, behind and to each side and eased, on top of its pose. */
const SLOPE = { reach: 0.5, max: 0.5, ease: 6 };
function onSlope(c: Creature, dt: number) {
  if (!env || FLYERS.includes(c.kind) || SWIMMERS.includes(c.kind)) return;
  const L = Math.max(0.4, c.r * SLOPE.reach * 2), s = Math.sin(c.heading), k = Math.cos(c.heading), { x, z } = c.p;
  const f = env.ground(x + s * L, z + k * L), b = env.ground(x - s * L, z - k * L);
  const r = env.ground(x + k * L, z - s * L), l = env.ground(x - k * L, z + s * L); // local +x = (cos h, −sin h)
  const ok = [f, b, r, l].every(Number.isFinite), cap = (v: number) => Math.max(-SLOPE.max, Math.min(SLOPE.max, v));
  const want: [number, number] = ok ? [cap(-Math.atan((f - b) / (2 * L))), cap(Math.atan((r - l) / (2 * L)))] : [0, 0];
  const now = c.slope ?? want, e = Math.min(1, dt * SLOPE.ease);
  now[0] += (want[0] - now[0]) * e; now[1] += (want[1] - now[1]) * e; c.slope = now;
  c.g.rotation.x += now[0]; c.g.rotation.z += now[1];
}
/** (0.227, stage W5) A beast knocked down lies on its side kicking; a staggered one reels; a bleeding one drips. */
function condLook(c: Creature, dt: number, time: number) {
  if (c.kind !== 'bramble' && !c.wings.length) c.g.rotation.z = 0; // (the others set their own roll every frame)
  const down = c.cond === 'down' ? 1 : 0;
  c.down = (c.down ?? 0) + (down - (c.down ?? 0)) * Math.min(1, dt * 9);
  if (c.down > 0.01) {
    c.g.rotation.z = 1.35 * c.down; c.g.position.y -= CREATURES[c.kind].lift * 0.45 * c.down;
    c.legs.forEach((l, i) => { l.rotation.x = Math.sin(time * 18 + i) * 0.5 * c.down!; });
  }
  if (c.cond === 'stagger') c.g.rotation.z += Math.sin(time * 30) * 0.12;
  if ((c.bleed ?? 0) > 0 && Math.random() < dt * 5) burst(V(c.p.x, c.p.y - CREATURES[c.kind].lift * 0.6, c.p.z), 0xd84a2a, 1, 0.25);
}

// ---------- damage ----------
export function hurtCreature(c: Creature, dmg: number, credit = true) {
  // (0.223) the Bramble's plated front, like every foe's strong and weak sides, is reckoned by the attacker (gen/tactics.ts)
  c.hp -= dmg; c.flash = 0.12; c.hurt = true; G.hitFlash = 0.15; c.calm = 0;
  if (!c.wounded && c.morale !== undefined && c.hp > 0 && c.hp < c.maxHp * 0.3) { c.wounded = true; c.morale = shocked(c.morale, 'wound'); } // (0.228)
  for (const m of c.pack ?? [c]) { m.spooked = SPOOKED; if (m.state === 'feed') { m.state = 'roam'; m.bait = null; } } // a hit ends the meal (then the pack turns on you below)
  if (c.kind === 'ravager' && c.state === 'roam') for (const m of c.pack ?? [c]) { m.state = 'hunt'; m.timer = 2; }
  if (c.kind === 'leechwing' && (c.state === 'roam' || c.state === 'investigate')) { c.prey = null; c.spotted = true; c.state = 'stalk'; c.timer = 2; }
  if (c.kind === 'gnawer') for (const m of c.pack ?? [c]) { m.hurt = true; if (m.state === 'roam') { m.state = 'hunt'; m.timer = 0; } }
  if (c.kind === 'skitter') for (const m of c.pack ?? [c]) if (m.state === 'roam') { m.state = 'hunt'; m.timer = Math.random() * 2; }
  if (c.kind === 'lurker' && (c.state === 'roam' || c.state === 'stalk')) { c.state = 'stalk'; c.timer = 1; }
  if (c.kind === 'silverfin') for (const m of c.pack ?? [c]) m.hurt = true;
  if (isWild(c.kind) && c.hp > 0) { // (0.240) a timid one bolts; any other turns on you, a defensive herd all together
    const w = WILD[c.kind];
    if (w.temper === 'timid') bolt(c.pack ?? [c], G.pos.x, G.pos.z);
    else for (const m of w.temper === 'defensive' ? c.pack ?? [c] : [c]) if (!remoteOf(m)) rouse(m, 'hurt');
  }
  if (c.hp > 0) return;
  const at = c.p.clone(), s = CREATURES[c.kind];
  const sea = SWIMMERS.includes(c.kind) ? env?.water(at.x, at.z) : null;
  if (sea) at.y = sea.level + 0.47; // what a sea creature leaves floats on the surface
  burst(at, baseColor(c), 12, 1.1);
  for (let i = 0; i < s.crystals; i++) dropCrystal(at);
  if (c.kind !== 'silverfin' && Math.random() < 0.15) dropPickup(at, 'medkit');
  for (const [k, chance, lo, hi] of DROPS[c.kind]) if (Math.random() < chance) {
    const n = lo + Math.floor(Math.random() * (hi - lo + 1));
    for (let i = 0; i < n; i++) dropPickup(V(at.x + (Math.random() - 0.5) * 1.2, at.y, at.z + (Math.random() - 0.5) * 1.2), k);
  }
  logLine((c.alpha ? ALPHA[c.kind] : s.name) + ' killed');
  const qid = c.questId, alpha = !!c.alpha;
  fallCreature(c);
  if (credit) onKill(c.kind, qid, alpha);
}

// ---------- dying ----------
// The dead are out of W.creatures at once but lie a while: runners stumble, slide on and roll onto their side with
// their legs kicking, a Bramble's legs fold under its weight, a Gnawer flips onto its back, a Leechwing drops out of
// the sky tumbling and lands with its wings spread. The colour drains, and after a few seconds they sink away.
interface Dead { c: Creature; t: number; side: 1 | -1; land: number; vy: number; spin: THREE.Vector3; slide: THREE.Vector3; y0: number }
const dead: Dead[] = [];
const LIE_C = 5, SINK_C = 1.5, DRAINED = 0x8a6a3a;
export function fallCreature(c: Creature) {
  play('die_creature', { at: c.p, vol: 0.8, far: 60, rate: c.kind === 'bramble' ? 0.6 : c.kind === 'gnawer' || c.kind === 'skitter' ? 1.8 : c.kind === 'silverfin' ? 2.2 : 1 });
  const i = W.creatures.indexOf(c); if (i >= 0) W.creatures.splice(i, 1);
  if (c.pack) { const j = c.pack.indexOf(c); if (j >= 0) c.pack.splice(j, 1); }
  if (c.pack && !remoteOf(c)) { // (0.228) the pack's nerve: a fallen member, the leader worst, and half of them gone
    for (const m of c.pack) if (m.morale !== undefined && m.p.distanceTo(c.p) < MORALE.near) m.morale = shocked(m.morale, c.alpha ? 'leader' : 'ally');
    const size = packSize.get(c.pack) ?? 0;
    if (size >= 3 && !packHalf.has(c.pack) && c.pack.length <= size / 2) { packHalf.add(c.pack); for (const m of c.pack) if (m.morale !== undefined) m.morale = shocked(m.morale, 'half'); }
  }
  if (c.kind === 'gnawer' && c.pack && c.pack.length >= 2 && !remoteOf(c)) for (const m of c.pack) { // (0.226, stage W2) the nest scatters
    if (remoteOf(m) || (m.state !== 'hunt' && m.state !== 'retreat')) continue;
    const a = Math.atan2(m.p.x - G.pos.x, m.p.z - G.pos.z) + (Math.random() - 0.5) * 2;
    m.dir.set(Math.sin(a), 0, Math.cos(a)); m.state = 'scatter'; m.timer = 2 + Math.random();
  }
  const away = V(c.p.x - G.pos.x, 0, c.p.z - G.pos.z).normalize();
  const slide = away.multiplyScalar(c.kind === 'bramble' ? 0.8 : 1.6 + c.speed * 0.25);
  c.mat.color.setHex(0xffffff);
  dead.push({ c, t: 0, side: Math.random() < 0.5 ? 1 : -1, land: -1, vy: FLYERS.includes(c.kind) ? c.dir.y * CREATURES[c.kind].speed * 0.3 : 0,
    spin: V((Math.random() - 0.5) * 7, 0, (Math.random() - 0.5) * 9), slide, y0: c.p.y });
}
const ease = (t: number) => t * t * (3 - 2 * t);
function updateDead(dt: number) {
  for (let i = dead.length - 1; i >= 0; i--) {
    const d = dead[i], c = d.c;
    d.t += dt;
    const t = d.t, gy = env ? env.ground(c.p.x, c.p.z) : d.y0 - CREATURES[c.kind].lift;
    if (SWIMMERS.includes(c.kind)) { // belly up, floating to the surface, then down to the bottom
      const w = env?.water(c.p.x, c.p.z), k = ease(Math.min(1, t / 0.8));
      c.g.rotation.z = d.side * Math.PI * k;
      if (w && d.land < 0) c.p.y += (w.level - 0.1 - c.p.y) * Math.min(1, dt * 2);
      if (d.land < 0 && k >= 1) d.land = t;
      if (c.tail) c.tail.rotation.y = Math.sin(t * 8) * 0.3 * Math.exp(-t * 2);
    } else if (FLYERS.includes(c.kind)) {
      if (d.land < 0) { // falling, tumbling, the wings flapping weakly
        d.vy -= 20 * dt; c.p.y += d.vy * dt; c.p.addScaledVector(d.slide, dt * 3);
        c.g.rotation.x += d.spin.x * dt; c.g.rotation.z += d.spin.z * dt;
        const fl = Math.sin(t * 16) * 0.6 * Math.exp(-t);
        if (c.wings.length) { c.wings[0].rotation.z = -fl; c.wings[1].rotation.z = fl; }
        if (c.p.y <= gy + 0.25) { c.p.y = gy + 0.25; d.land = t; burst(c.p.clone(), DRAINED, 10, 0.9); }
      } else { // crumpled on the ground, wings spread flat
        const k = Math.min(1, (t - d.land) / 0.3);
        c.g.rotation.x *= 1 - k; c.g.rotation.z = c.g.rotation.z * (1 - k) + d.side * 0.25 * k;
        if (c.wings.length) { c.wings[0].rotation.z = 0.1 * k; c.wings[1].rotation.z = -0.1 * k; }
      }
    } else {
      // stumble on (sliding to a stop), drop and roll: onto the side, or a Gnawer onto its back
      const fall = ease(Math.min(1, t / (c.kind === 'bramble' ? 0.9 : 0.55))), roll = c.kind === 'gnawer' ? Math.PI * 0.95 : c.kind === 'bramble' ? 0.25 : 1.45;
      const slow = Math.max(0, 1 - t / 0.5);
      c.p.addScaledVector(d.slide, dt * slow * 2);
      const rest = c.kind === 'bramble' ? CREATURES.bramble.lift * 0.45 : c.kind === 'gnawer' ? 0.14 : c.r * 0.45;
      c.p.y = d.y0 + (gy + rest - d.y0) * fall;
      c.g.rotation.z = d.side * roll * fall;
      if (c.kind === 'bramble') c.g.rotation.x = 0.12 * fall; // down on its knees, nose first
      // legs: a Bramble's fold under it, the others kick (fast at first, then a twitch now and then)
      c.legs.forEach((l, k) => {
        if (c.kind === 'bramble') l.rotation.x = (k < 2 ? -1 : 1) * 1.1 * fall;
        else l.rotation.x = Math.sin(t * (c.kind === 'gnawer' ? 38 : 24) + k * 1.7) * 0.7 * Math.exp(-t * 1.6) + (t > 1.5 && Math.sin(t * 3 + k) > 0.97 ? 0.3 : 0);
      });
      if (c.head) c.head.rotation.x = 0.45 * fall;
      if (c.jaw) c.jaw.rotation.x = 0.35 * fall;
      if (c.tail) c.tail.rotation.y = Math.sin(t * 9) * 0.3 * Math.exp(-t * 2);
      if (d.land < 0 && fall >= 1) d.land = t;
    }
    c.mat.color.setHex(t < 0.2 ? 0xffffff : DRAINED);
    const lie = d.land < 0 ? 0 : t - d.land;
    if (lie > LIE_C) c.p.y -= dt * (SWIMMERS.includes(c.kind) ? 0.5 : 0.8); // sinking
    c.g.position.copy(c.p);
    if (lie > LIE_C + SINK_C || t > 20) { removeCreature(c); dead.splice(i, 1); }
  }
}
export function removeCreature(c: Creature) {
  scene.remove(c.g); c.free?.(); c.free = undefined;
  c.g.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); });
  c.mat.dispose();
  const i = W.creatures.indexOf(c); if (i >= 0) W.creatures.splice(i, 1);
  if (c.pack) { const j = c.pack.indexOf(c); if (j >= 0) c.pack.splice(j, 1); }
}
export function clearCreatures() { for (const c of [...W.creatures]) removeCreature(c); for (const d of dead) removeCreature(d.c); dead.length = 0; }
/** Debug / console: put a creature near the player. */
export function spawnCreatureNear(kind: CreatureKind, d = 18) {
  if (!env) return false;
  const x = G.pos.x - Math.sin(G.yaw) * d, z = G.pos.z - Math.cos(G.yaw) * d;
  const lv = env.danger(x, z);
  if (kind === 'skitter') { const flock: Creature[] = []; for (let i = 0; i < 4; i++) { const c = make(kind, V(x + (Math.random() - 0.5) * 5, env.ground(x, z) + 5, z + (Math.random() - 0.5) * 5), lv); c.pack = flock; c.flank = Math.random() * 6.283; flock.push(c); } return true; }
  if (SWIMMERS.includes(kind)) { // the nearest deep sea round you
    for (let r = 10; r <= 80; r += 10) for (let a = 0; a < 6.283; a += 0.5) {
      const sx = G.pos.x + Math.sin(a) * r, sz = G.pos.z + Math.cos(a) * r, w = env.water(sx, sz);
      if (w?.kind !== 'sea' || w.depth < 2.5) continue;
      if (kind === 'lurker') make('lurker', V(sx, w.level - LURK_DEPTH, sz), lv);
      else { const shoal: Creature[] = []; for (let i = 0; i < 7; i++) { const c = make('silverfin', V(sx + (Math.random() - 0.5) * 4, w.level - FIN_DEPTH, sz + (Math.random() - 0.5) * 4), lv); c.pack = shoal; c.flank = Math.random() * 6.283; shoal.push(c); } }
      return true;
    }
    return false;
  }
  if (isWild(kind)) { // (0.240) a herd of it, as it would turn up
    const herd: Creature[] = [], n = WILD[kind].herd[1], sp = kind === 'titan' ? 30 : 6;
    for (let i = 0; i < n; i++) { const px = x + (Math.random() - 0.5) * sp, pz = z + (Math.random() - 0.5) * sp, c = make(kind, V(px, env.ground(px, pz) + CREATURES[kind].lift, pz), lv); c.pack = herd; c.flank = Math.random() * 6.283; herd.push(c); }
    return true;
  }
  if (kind === 'gnawer') { const nest: Creature[] = []; for (let i = 0; i < 5; i++) { const px = x + (Math.random() - 0.5) * 4, pz = z + (Math.random() - 0.5) * 4, c = make(kind, V(px, env.ground(px, pz) + CREATURES.gnawer.lift, pz), lv); c.pack = nest; c.flank = Math.random() * 6.283; nest.push(c); } return true; }
  if (kind === 'ravager') { const pack: Creature[] = []; for (let i = 0; i < 3; i++) { const c = make(kind, V(x + i * 1.5, env.ground(x + i * 1.5, z) + CREATURES.ravager.lift, z), lv); c.flank = (i - 1) * 1.1; c.pack = pack; pack.push(c); } }
  else make(kind, V(x, env.ground(x, z) + (kind === 'leechwing' ? 12 : CREATURES[kind].lift), z), lv);
  return true;
}

/** A copy of another player's creature (world/foesync.ts). */
export function spawnRemoteCreature(kind: CreatureKind, p: THREE.Vector3, level: number): Creature { return make(kind, p, level); }
/** A gnawer nest of n at (x, z) (a city's rubble: world/citygarrisons.ts). */
export function spawnNest(x: number, z: number, lv: number, n: number): Creature[] {
  if (!env) return [];
  const nest: Creature[] = [];
  for (let i = 0; i < n; i++) {
    const px = x + (Math.random() - 0.5) * 6, pz = z + (Math.random() - 0.5) * 6;
    if (env.forbidden(px, pz)) continue;
    const c = make('gnawer', V(px, env.ground(px, pz) + CREATURES.gnawer.lift, pz), lv); c.pack = nest; c.flank = Math.random() * 6.283; nest.push(c);
  }
  return nest;
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
    c.alpha = true; c.morale = MORALE.start.alpha; c.hp = c.maxHp = c.maxHp * 3; c.dmgMul = 1.5; c.r *= 1.35; c.g.scale.setScalar(1.35);
    const tag = textSprite(alpha, '#ffb347', 2.4); tag.position.y = kind === 'bramble' ? 1.9 : 1.3; c.g.add(tag);
    members.push(c);
  }
  for (let i = 0; i < left; i++) members.push(make(kind, at(i + 1), lv));
  members.forEach((c, i) => { c.questId = q.id; c.home.set(ax, c.home.y, q.at!.z); if (kind === 'ravager') { c.pack = pack; c.flank = (i - (members.length - 1) / 2) * 1.1; pack.push(c); } });
}
