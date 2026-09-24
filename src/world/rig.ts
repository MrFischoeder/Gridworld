// Arms and weapons for the human figures (villagers, guards, bandits, raider crews). Each arm is two segments,
// shoulder → elbow → hand, solved every frame by a small two-bone IK so the hands land on the weapon: a rifle is held
// with both hands (grip and fore-grip) and shouldered to fire, a pistol is raised in one hand, a sword swings in an
// arc (wind-up over the shoulder, slash, recover) with a shield held up on the other arm, a guard carries his spear
// upright. Unarmed folk swing their arms as they walk. Figure-local frame: y up, +z forward, shoulders at y 1.4.
import * as THREE from 'three';
import { fillMat, V } from './render';

export type Kit = 'none' | 'rifle' | 'pistol' | 'sword' | 'spear' | 'drive';
export interface Arm { line: THREE.Line; pos: THREE.BufferAttribute; s: THREE.Vector3; side: 1 | -1; hand: THREE.Group }
export interface Rig { armL: Arm; armR: Arm; kit: Kit; shield: boolean; aim: number }
/** What the figure is doing this frame. */
export interface Pose {
  /** Walk cycle swing (-1..1, 0 standing). */
  swing?: number;
  /** 0 = weapon lowered, 1 = aimed / raised (eased by the caller or here). */
  aim?: number;
  /** Sword stroke: 0..1 through wind-up, slash and recovery; negative = none. */
  strike?: number;
  /** Recoil kick 0..1 (just fired). */
  recoil?: number;
}

const UPPER = 0.29, FORE = 0.28, fill = fillMat();
function arm(g: THREE.Group, mat: THREE.LineBasicMaterial, side: 1 | -1): Arm {
  const geo = new THREE.BufferGeometry(), pos = new THREE.BufferAttribute(new Float32Array(9), 3);
  geo.setAttribute('position', pos);
  const line = new THREE.Line(geo, mat); line.frustumCulled = false;
  const hand = new THREE.Group();
  const fist = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.07, 0.07, 0.08)), mat); hand.add(fist);
  g.add(line, hand);
  return { line, pos, s: V(0.27 * side, 1.4, 0), side, hand };
}

// ---------- weapon models (fill + edges in the figure's colour) ----------
function part(grp: THREE.Group, mat: THREE.LineBasicMaterial, w: number, h: number, d: number, x: number, y: number, z: number, rx = 0) {
  const geo = new THREE.BoxGeometry(w, h, d), m = new THREE.Mesh(geo, fill), e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), mat);
  for (const o of [m, e]) { o.position.set(x, y, z); o.rotation.x = rx; grp.add(o); }
}
/** Rifle: origin at the pistol grip, barrel along +z, stock back along -z. */
function rifle(mat: THREE.LineBasicMaterial, big: boolean) {
  const g = new THREE.Group(), L = big ? 1.15 : 1;
  part(g, mat, 0.05, 0.1, 0.3, 0, 0.03, -0.2);            // stock
  part(g, mat, 0.06, 0.09, 0.26 * L, 0, 0.05, 0.08);      // receiver
  part(g, mat, 0.03, 0.03, 0.42 * L, 0, 0.07, 0.4 * L);   // barrel
  part(g, mat, 0.04, 0.06, 0.18, 0, 0.04, 0.3 * L);       // fore-grip
  part(g, mat, 0.04, 0.14, 0.05, 0, -0.06, 0.13, 0.3);    // magazine
  part(g, mat, 0.04, 0.09, 0.04, 0, -0.03, 0, -0.3);      // grip
  if (big) part(g, mat, 0.03, 0.05, 0.14, 0, 0.13, 0.06); // a scope on the boss's rifle
  return g;
}
function pistol(mat: THREE.LineBasicMaterial) {
  const g = new THREE.Group();
  part(g, mat, 0.04, 0.11, 0.05, 0, -0.02, 0, -0.25); part(g, mat, 0.045, 0.05, 0.22, 0, 0.05, 0.07);
  return g;
}
/** Sword: grip at the origin, blade along +z. */
function sword(mat: THREE.LineBasicMaterial) {
  const g = new THREE.Group();
  part(g, mat, 0.035, 0.035, 0.16, 0, 0, -0.02);  // grip
  part(g, mat, 0.2, 0.03, 0.04, 0, 0, 0.08);       // cross-guard
  part(g, mat, 0.065, 0.012, 0.7, 0, 0, 0.45);     // blade
  g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(-0.033, 0, 0.8), V(0, 0, 0.92), V(0.033, 0, 0.8)]), mat)); // point
  return g;
}
function spear(mat: THREE.LineBasicMaterial) {
  const g = new THREE.Group();
  g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(0, 0, -1.0), V(0, 0, 1.25)]), mat));
  g.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([V(0, 0, 1.25), V(0.06, 0, 1.1), V(0, 0, 1.52), V(-0.06, 0, 1.1)]), mat));
  return g;
}
function shield(mat: THREE.LineBasicMaterial) {
  const g = new THREE.Group(), pts = Array.from({ length: 10 }, (_, i) => new THREE.Vector2(Math.cos(i / 10 * 6.283) * 0.27, Math.sin(i / 10 * 6.283) * 0.27));
  const geo = new THREE.ShapeGeometry(new THREE.Shape(pts));
  g.add(new THREE.Mesh(geo, fill), new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts.map((p) => V(p.x, p.y, 0))), mat));
  g.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts.map((p) => V(p.x * 0.3, p.y * 0.3, 0.02))), mat)); // the boss
  g.position.z = 0.06; return g;
}

/** Arms (and the kit's weapons) for a figure group `g`, drawn with `mat`. */
export function makeRig(g: THREE.Group, mat: THREE.LineBasicMaterial, kit: Kit, withShield = false, big = false): Rig {
  const armL = arm(g, mat, -1), armR = arm(g, mat, 1);
  if (kit === 'rifle') armR.hand.add(rifle(mat, big));
  if (kit === 'pistol') armR.hand.add(pistol(mat));
  if (kit === 'sword') armR.hand.add(sword(mat));
  if (kit === 'spear') armR.hand.add(spear(mat));
  if (withShield) armL.hand.add(shield(mat));
  const r: Rig = { armL, armR, kit, shield: withShield, aim: 0 };
  poseRig(r, {});
  return r;
}

// ---------- solving ----------
const tmp = { d: V(0, 0, 0), p: V(0, 0, 0), e: V(0, 0, 0), h: V(0, 0, 0) }, Z = V(0, 0, 1);
/** Two-bone IK: put the hand at `t` (clamped to reach), the elbow bent towards `pole`. */
function reach(a: Arm, t: THREE.Vector3, pole: THREE.Vector3) {
  const { d, p, e, h } = tmp;
  d.copy(t).sub(a.s); let L = d.length();
  if (L < 1e-4) { d.set(0, -1, 0); L = 0.01; }
  d.divideScalar(L); L = Math.min(L, UPPER + FORE - 0.002);
  h.copy(a.s).addScaledVector(d, L);
  const x = (UPPER * UPPER - FORE * FORE + L * L) / (2 * L), y = Math.sqrt(Math.max(0, UPPER * UPPER - x * x));
  p.copy(pole).addScaledVector(d, -pole.dot(d)); if (p.lengthSq() < 1e-6) p.set(0, 0, -1); p.normalize();
  e.copy(a.s).addScaledVector(d, x).addScaledVector(p, y);
  const arr = a.pos.array as Float32Array;
  arr.set([a.s.x, a.s.y, a.s.z, e.x, e.y, e.z, h.x, h.y, h.z]); a.pos.needsUpdate = true;
  a.hand.position.copy(h);
}
/** Point the hand's +z along `dir`. */
const aimHand = (a: Arm, dir: THREE.Vector3) => a.hand.quaternion.setFromUnitVectors(Z, tmp.d.copy(dir).normalize());
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const L3 = (a: number[], b: number[], t: number) => V(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t));
const ease = (t: number) => t * t * (3 - 2 * t);

/** Hanging arm swinging with the walk (angle θ forward). */
function hang(a: Arm, th: number, fwd = 0.04) {
  const L = UPPER + FORE - 0.04;
  reach(a, V(a.s.x + a.side * 0.03, a.s.y - L * Math.cos(th), a.s.z + L * Math.sin(th) + fwd), V(a.side * 0.2, 0, -1));
  aimHand(a, V(0, -1, Math.sin(th)));
}
export function poseRig(r: Rig, ps: Pose) {
  const sw = ps.swing ?? 0, aim = ps.aim ?? 0, rec = ps.recoil ?? 0, { armL, armR } = r;
  const outL = V(-0.6, -0.4, -0.6), outR = V(0.6, -0.4, -0.6);
  switch (r.kit) {
    case 'none': hang(armL, -sw * 0.7); hang(armR, sw * 0.7); break;
    case 'drive': { // both hands on the wheel
      reach(armL, V(-0.17, 1.12, 0.42), outL); reach(armR, V(0.17, 1.12, 0.42), outR); aimHand(armL, V(0, 0, 1)); aimHand(armR, V(0, 0, 1)); break;
    }
    case 'rifle': {
      // low ready (muzzle down across the body) → shouldered (butt in the shoulder, sights at the eye)
      const k = ease(aim), grip = L3([0.13, 1.02 + sw * 0.02, 0.24], [0.11, 1.3, 0.26], k), dir = L3([-0.25, -0.5, 1], [0, 0.02, 1], k).normalize();
      if (rec > 0) { grip.addScaledVector(dir, -0.07 * rec); dir.y += 0.12 * rec; dir.normalize(); }
      reach(armR, grip, outR); aimHand(armR, dir);
      const fore = grip.clone().addScaledVector(dir, 0.3); fore.y -= 0.02;
      reach(armL, fore, outL); aimHand(armL, dir);
      break;
    }
    case 'pistol': {
      const k = ease(aim), hand = L3([0.29, 0.9 + sw * 0.03, 0.1], [0.13, 1.37, 0.6], k), dir = L3([0, -1, 0.35], [0, 0, 1], k).normalize();
      if (rec > 0) { dir.y += 0.35 * rec; dir.normalize(); hand.z -= 0.04 * rec; }
      reach(armR, hand, V(0.7, -0.5, -0.4)); aimHand(armR, dir);
      hang(armL, -sw * 0.7 * (1 - k));
      break;
    }
    case 'sword': {
      // guard: blade forward and up; a stroke winds up over the right shoulder, slashes down across, recovers
      const t = ps.strike ?? -1;
      const guard = { h: [0.24, 1.02 + sw * 0.03, 0.32], d: [0, 0.65, 1] }, up = { h: [0.34, 1.72, -0.02], d: [0.1, 0.8, -0.6] }, down = { h: [-0.12, 0.95, 0.52], d: [-0.5, -0.45, 0.75] };
      let hand: THREE.Vector3, dir: THREE.Vector3;
      if (t < 0 || t >= 1) { hand = V(...guard.h as [number, number, number]); dir = V(...guard.d as [number, number, number]); }
      else if (t < 0.35) { const k = ease(t / 0.35); hand = L3(guard.h, up.h, k); dir = L3(guard.d, up.d, k); }
      else if (t < 0.6) { const k = ease((t - 0.35) / 0.25); hand = L3(up.h, down.h, k); dir = L3(up.d, down.d, k); }
      else { const k = ease((t - 0.6) / 0.4); hand = L3(down.h, guard.h, k); dir = L3(down.d, guard.d, k); }
      reach(armR, hand, outR); aimHand(armR, dir.normalize());
      if (r.shield) { reach(armL, V(-0.22, 1.14, 0.3), outL); aimHand(armL, V(0.15, 0, 1)); } else hang(armL, -sw * 0.7);
      break;
    }
    case 'spear': {
      // the spear upright at his side, butt on the ground as he walks; shield on the left arm
      reach(armR, V(0.3, 1.02 + sw * 0.02, 0.12), outR); aimHand(armR, V(0.02, 1, 0.05 + sw * 0.05));
      if (r.shield) { reach(armL, V(-0.25, 1.1, 0.24), outL); aimHand(armL, V(0.1, 0, 1)); } else hang(armL, -sw * 0.7);
      break;
    }
  }
}
/** Where the muzzle of a held gun is, in the figure's local frame (for the bolt). */
export function muzzleLocal(r: Rig): THREE.Vector3 {
  const d = V(0, 0, 1).applyQuaternion(r.armR.hand.quaternion);
  return r.armR.hand.position.clone().addScaledVector(d, r.kit === 'rifle' ? 0.62 : 0.2).add(V(0, 0.06, 0));
}
