// Robotic enemies of the open world (data/robots.ts, the RD-01..06 sheet): faceted amber machines with dark fills,
// built from PropBatch parts with the origin at the body centre (weapons hit a sphere of radius `r` around it).
//   scout      RD-03: a small, fast four-legged hunter with two blade arms; packs flank you and slash
//   guardian   RD-01: four spider legs, a sensor head and an energy cannon; keeps its distance and shoots
//   repair     RD-05: a hovering dome with dangling arms; stays back, mends hurt machines, drops defence drones
//   sentinel   RD-02: a heavy biped with two arm cannons; bursts at range, a crushing blow up close
//   artillery  RD-04: a slow four-legged gun platform; shells your position from far away (a ring marks where)
//   assault    RD-06: a hunched heavy biped with a hammer arm; charges and smashes you off your feet
// Like the creatures they are not saved. Where they turn up, and how many, is set by the danger level and the
// shared threat budget (world/threat.ts): near the villages you meet none, further out ever heavier machines.
import * as THREE from 'three';
import { scene, V, lineMat, add as addMat } from './render';
import { G, W } from '../game';
import { PropBatch, sharedFill } from './props';
import { ROBOTS, ROBOT_COLOR, BEAM_COLOR, SHELL, type RobotKind } from '../data/robots';
import { foeRules, makeDrone, type Drone } from './enemies';
import { rayWorld } from './player';
import { burst, addFx } from './fx';
import { dropCrystal, dropPickup } from './loot';
import { fireBolt } from './bandits';
import { onNoise } from './noise';
import { onKill } from './quests';
import { logLine } from '../ui/hud';
import { mayspawn } from './threat';
import type { SpawnEnv } from './creatures';

type State = 'patrol' | 'hunt' | 'return';
export interface Robot {
  kind: 'robot'; model: RobotKind; boss?: false;
  g: THREE.Group; mat: THREE.LineBasicMaterial;
  p: THREE.Vector3; heading: number; speed: number;
  hp: number; maxHp: number; r: number; flash: number; level: number;
  state: State; timer: number; atkT: number; anim: number; home: THREE.Vector3;
  legs: THREE.Group[]; arms: THREE.Group[]; biped: boolean;
  group: Robot[]; flank: number; swing: number;
  /** Repair drone: its defence drones; assault construct: charging. */
  drones: Drone[]; charge: number;
}

// ---------- models (local +z forward, origin at the body centre) ----------
type P = number[];
const K = 0;
/** A tapered box centred at (x, y, z): w x h x d at the bottom, the top scaled by `t` and pushed forward by `fz`. */
function boxAt(pb: PropBatch, x: number, y: number, z: number, w: number, h: number, d: number, t = 1, fz = 0) {
  const a = w / 2, b = d / 2, y0 = y - h / 2, y1 = y + h / 2;
  pb.solid8([[x - a, y0, z - b], [x + a, y0, z - b], [x + a, y0, z + b], [x - a, y0, z + b]],
    [[x - a * t, y1, z - b * t + fz], [x + a * t, y1, z - b * t + fz], [x + a * t, y1, z + b * t + fz], [x - a * t, y1, z + b * t + fz]], K);
}
/** A square strut from a to b, `w` thick (limbs, barrels). */
function limb(pb: PropBatch, a: P, b: P, w: number, w2 = w) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(d[0], d[1], d[2]) || 1, n = d.map((v) => v / L);
  const up = Math.abs(n[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u0 = [n[1] * up[2] - n[2] * up[1], n[2] * up[0] - n[0] * up[2], n[0] * up[1] - n[1] * up[0]], ul = Math.hypot(u0[0], u0[1], u0[2]), u = u0.map((v) => v / ul);
  const v = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
  const ring = (c: P, r: number) => [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([s, t]) => c.map((q, i) => q + (u[i] * s + v[i] * t) * r));
  pb.solid8(ring(a, w), ring(b, w2), K);
}
/** An eye: a ring of lines facing +z with a dot of a pupil. */
function eye(pb: PropBatch, x: number, y: number, z: number, r: number) {
  const pts: P[] = [];
  for (let i = 0; i <= 10; i++) { const a = i / 10 * 6.283; pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r, z]); }
  pb.line(K, ...pts);
  pb.line(K, [x - r * 0.3, y, z + 0.01], [x + r * 0.3, y, z + 0.01]); pb.line(K, [x, y - r * 0.3, z + 0.01], [x, y + r * 0.3, z + 0.01]);
}
function finish(pb: PropBatch, mat: THREE.LineBasicMaterial): THREE.Group {
  const g = pb.build();
  g.traverse((o) => { if ((o as THREE.LineSegments).isLineSegments) (o as THREE.LineSegments).material = mat; else if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = sharedFill(); });
  return g;
}
/** A leg or arm pivoting at `at` (the hip, the shoulder): struts through the given points (relative to the pivot). */
function jointed(r: Robot, at: P, pts: P[], w: number, extra?: (pb: PropBatch) => void): THREE.Group {
  const pb = new PropBatch();
  for (let i = 0; i + 1 < pts.length; i++) limb(pb, pts[i], pts[i + 1], w * (1 - i * 0.18), w * (1 - (i + 1) * 0.18));
  extra?.(pb);
  const pivot = new THREE.Group(); pivot.add(finish(pb, r.mat)); pivot.position.set(at[0], at[1], at[2]); r.g.add(pivot);
  return pivot;
}
/** Four spider legs at the corners: hip, knee out and up, foot out and down to the ground. */
function spiderLegs(r: Robot, hx: number, hz: number, hy: number, kx: number, ky: number, kz: number, fx: number, fz: number, w: number) {
  const drop = -ROBOTS[r.model].lift - hy;
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    r.legs.push(jointed(r, [sx * hx, hy, sz * hz], [[0, 0, 0], [sx * kx, ky, sz * kz], [sx * fx, drop, sz * fz]], w, (pb) => {
      pb.line(K, [sx * fx, drop, sz * fz], [sx * (fx + 0.12), drop - 0.02, sz * (fz + 0.18)]); // a claw toe
    }));
  }
}
function scoutModel(r: Robot) {
  const pb = new PropBatch();
  boxAt(pb, 0, 0, 0, 0.5, 0.34, 0.95, 0.7);
  boxAt(pb, 0, 0.28, 0.52, 0.26, 0.3, 0.42, 0.6, 0.1);
  limb(pb, [0, 0.38, 0.45], [0, 0.72, -0.1], 0.05, 0.01); // the crest
  eye(pb, 0, 0.3, 0.76, 0.07);
  r.g.add(finish(pb, r.mat));
  spiderLegs(r, 0.2, 0.3, 0, 0.55, 0.45, 0.35, 0.85, 0.6, 0.045);
  for (const s of [-1, 1]) {
    r.arms.push(jointed(r, [s * 0.22, 0.12, 0.42], [[0, 0, 0], [s * 0.28, 0.65, 0.35]], 0.05, (pb) => {
      // the blade: a long flat curved edge
      const e: P = [s * 0.28, 0.65, 0.35], m: P = [s * 0.36, 0.3, 1.1], tip: P = [s * 0.3, -0.45, 1.6];
      pb.solid8([e, [e[0], e[1] - 0.1, e[2]], [m[0], m[1] - 0.12, m[2]], m], [[e[0] + s * 0.02, e[1], e[2]], [e[0] + s * 0.02, e[1] - 0.1, e[2]], [m[0] + s * 0.02, m[1] - 0.12, m[2]], [m[0] + s * 0.02, m[1], m[2]]], K);
      pb.face(m, [m[0], m[1] - 0.12, m[2]], tip); pb.line(K, m, tip, [m[0], m[1] - 0.12, m[2]]);
    }));
  }
}
function guardianModel(r: Robot) {
  const pb = new PropBatch();
  boxAt(pb, 0, 0, 0, 1.2, 0.5, 1.4, 0.75);
  boxAt(pb, 0, 0.42, 0.45, 0.5, 0.36, 0.6, 0.8);
  eye(pb, 0, 0.42, 0.76, 0.12);
  boxAt(pb, 0, 0.4, -0.15, 0.45, 0.3, 0.55, 0.8); // the turret
  limb(pb, [0, 0.52, 0.05], [0, 0.6, 1.25], 0.1, 0.08); // the energy cannon
  boxAt(pb, 0, 0.6, 1.25, 0.24, 0.24, 0.2);
  r.g.add(finish(pb, r.mat));
  spiderLegs(r, 0.5, 0.55, -0.1, 0.55, 0.45, 0.4, 1.05, 1.0, 0.09);
}
function repairModel(r: Robot) {
  const pb = new PropBatch(), n = 10;
  const ring = (y: number, rr: number): P[] => Array.from({ length: n }, (_, i) => [Math.cos(i / n * 6.283) * rr, y, Math.sin(i / n * 6.283) * rr]);
  const rs = [ring(-0.35, 0.3), ring(-0.2, 0.85), ring(0.15, 0.9), ring(0.45, 0.7), ring(0.68, 0.35)], top: P = [0, 0.76, 0];
  for (let j = 0; j + 1 < rs.length; j++) for (let i = 0; i < n; i++) { const i1 = (i + 1) % n; pb.face(rs[j][i], rs[j][i1], rs[j + 1][i1], rs[j + 1][i]); pb.seg(K, rs[j][i], rs[j + 1][i]); pb.seg(K, rs[j + 1][i], rs[j + 1][i1]); }
  for (let i = 0; i < n; i++) { pb.face(rs[4][i], rs[4][(i + 1) % n], top); pb.seg(K, rs[0][i], rs[0][(i + 1) % n]); }
  pb.face(...rs[0]);
  eye(pb, 0, 0.15, 0.91, 0.16);
  r.g.add(finish(pb, r.mat));
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    r.arms.push(jointed(r, [sx * 0.45, -0.25, sz * 0.45], [[0, 0, 0], [sx * 0.35, -0.55, sz * 0.35], [sx * 0.15, -1.25, sz * 0.15]], 0.05, (pb) => {
      const c: P = [sx * 0.15, -1.25, sz * 0.15];
      for (let k = 0; k < 3; k++) { const a = k / 3 * 6.283; pb.line(K, c, [c[0] + Math.cos(a) * 0.12, c[1] - 0.18, c[2] + Math.sin(a) * 0.12]); }
    }));
  }
}
/** Two thick legs for the heavy bipeds: hip, knee a little forward, foot with a flat plate. */
function bipedLegs(r: Robot, hx: number, hy: number, w: number) {
  const drop = -ROBOTS[r.model].lift - hy;
  for (const s of [-1, 1]) r.legs.push(jointed(r, [s * hx, hy, 0], [[0, 0, 0], [s * 0.05, drop * 0.5, 0.25], [0, drop + 0.15, -0.05]], w, (pb) => boxAt(pb, 0, drop + 0.07, 0.1, w * 3.2, 0.14, w * 4.5)));
  r.biped = true;
}
function sentinelModel(r: Robot) {
  const pb = new PropBatch();
  boxAt(pb, 0, 0.35, 0, 1.8, 1.3, 1.4, 0.8);
  boxAt(pb, 0, -0.5, 0, 1.0, 0.4, 0.8, 0.9);
  eye(pb, 0, 0.45, 0.71, 0.24);
  boxAt(pb, 0, 1.12, 0.1, 0.6, 0.3, 0.6, 0.7); // sensor hood
  r.g.add(finish(pb, r.mat));
  bipedLegs(r, 0.55, -0.65, 0.2);
  for (const s of [-1, 1]) r.arms.push(jointed(r, [s * 1.05, 0.7, 0], [[0, 0, 0], [s * 0.2, -0.65, 0.15], [s * 0.15, -0.9, 0.95]], 0.2, (pb) => {
    limb(pb, [s * 0.15, -0.9, 0.95], [s * 0.15, -0.9, 1.45], 0.12, 0.1); boxAt(pb, s * 0.15, -0.9, 1.45, 0.3, 0.3, 0.15);
  }));
}
function artilleryModel(r: Robot) {
  const pb = new PropBatch();
  boxAt(pb, 0, 0, 0, 2.3, 0.9, 2.7, 0.8);
  boxAt(pb, 0, 0.75, -0.1, 1.4, 0.6, 1.6, 0.8);
  limb(pb, [0, 0.85, 0.5], [0, 1.25, 4.4], 0.16, 0.13); // the long gun
  boxAt(pb, 0, 1.25, 4.45, 0.4, 0.4, 0.3);
  eye(pb, 0.45, 0.8, 0.66, 0.1);
  r.g.add(finish(pb, r.mat));
  spiderLegs(r, 0.95, 0.95, -0.3, 0.5, 0.45, 0.3, 1.5, 1.35, 0.2);
}
function assaultModel(r: Robot) {
  const pb = new PropBatch();
  boxAt(pb, 0, 0.45, 0.1, 1.6, 1.2, 1.1, 0.85, 0.25);
  boxAt(pb, 0, -0.35, 0, 0.9, 0.4, 0.7, 0.9);
  boxAt(pb, 0, 1.2, 0.5, 0.5, 0.42, 0.55, 0.7); // the head, low and forward
  eye(pb, 0, 1.2, 0.78, 0.1);
  for (const s of [-1, 1]) boxAt(pb, s * 0.85, 1.05, 0.1, 0.55, 0.3, 0.8, 0.7); // shoulder plates
  r.g.add(finish(pb, r.mat));
  bipedLegs(r, 0.45, -0.5, 0.22);
  // the hammer arm (right) and the claw (left)
  r.arms.push(jointed(r, [0.95, 0.85, 0.1], [[0, 0, 0], [0.15, -0.8, 0.25], [0.1, -1.4, 0.85]], 0.2, (pb) => boxAt(pb, 0.1, -1.55, 1.05, 0.65, 0.55, 0.95)));
  r.arms.push(jointed(r, [-0.95, 0.85, 0.1], [[0, 0, 0], [-0.15, -0.8, 0.25], [-0.1, -1.3, 0.8]], 0.16, (pb) => {
    for (let k = 0; k < 3; k++) pb.line(K, [-0.1, -1.3, 0.8], [-0.1 + (k - 1) * 0.15, -1.55, 1.05]);
  }));
}
const MODELS: Record<RobotKind, (r: Robot) => void> = { scout: scoutModel, guardian: guardianModel, repair: repairModel, sentinel: sentinelModel, artillery: artilleryModel, assault: assaultModel };

// ---------- spawning ----------
let env: SpawnEnv | null = null, spawnT = 8;
export function setRobotEnv(e: SpawnEnv | null) { env = e; }

function make(model: RobotKind, x: number, z: number, level: number, group: Robot[]): Robot | null {
  if (!env || env.forbidden(x, z)) return null;
  const s = ROBOTS[model], mat = lineMat(ROBOT_COLOR), g = new THREE.Group(), hp = Math.round(s.hp * (1 + level * 0.2));
  const p = V(x, env.ground(x, z) + s.lift, z);
  const r: Robot = {
    kind: 'robot', model, g, mat, p, heading: Math.random() * 6.283, speed: 0, hp, maxHp: hp, r: s.r, flash: 0, level,
    state: 'patrol', timer: Math.random() * 2, atkT: 1 + Math.random(), anim: Math.random() * 10, home: p.clone(),
    legs: [], arms: [], biped: false, group, flank: (Math.random() - 0.5) * 2.4, swing: 0, drones: [], charge: 0,
  };
  MODELS[model](r);
  g.position.copy(p); g.rotation.order = 'YXZ'; scene.add(g);
  group.push(r); W.robots.push(r);
  return r;
}
/** What turns up at this danger: a pack of scouts, a guardian patrol (maybe with a repair drone), a sentinel, an artillery walker, an assault construct. */
function pickGroup(lv: number, ruin: boolean): RobotKind[] {
  const opts: [number, RobotKind[]][] = [];
  if (lv >= ROBOTS.scout.min) opts.push([3, lv < 3 ? ['scout', 'scout'] : ['scout', 'scout', 'scout', ...(lv > 5 ? ['scout'] as RobotKind[] : [])]]);
  if (lv >= ROBOTS.guardian.min) opts.push([ruin ? 6 : 3, lv < 3 ? ['guardian'] : lv < 4.5 ? ['guardian', 'guardian'] : ['guardian', 'guardian', 'guardian']]);
  if (lv >= ROBOTS.repair.min) opts.push([2, ['repair', 'guardian', 'guardian']]);
  if (lv >= ROBOTS.sentinel.min) opts.push([2, lv < 6 ? ['sentinel'] : ['sentinel', 'repair']]);
  if (lv >= ROBOTS.artillery.min) opts.push([1.5, lv < 6.5 ? ['artillery'] : ['artillery', 'guardian', 'guardian']]);
  if (lv >= ROBOTS.assault.min) opts.push([1.5, ['assault', 'scout', 'scout']]);
  if (!opts.length) return [];
  let roll = Math.random() * opts.reduce((a, o) => a + o[0], 0);
  for (const [w, g] of opts) { if ((roll -= w) <= 0) return g; }
  return opts[0][1];
}
function trySpawn() {
  if (!env) return;
  const pos = G.pos, lv = env.danger(pos.x, pos.z);
  if (lv < ROBOTS.scout.min) return;
  const fwx = -Math.sin(G.yaw), fwz = -Math.cos(G.yaw);
  for (let tries = 0; tries < 8; tries++) {
    const a = Math.atan2(-fwx, -fwz) + (Math.random() - 0.5) * 2.6, d = 55 + Math.random() * 30;
    const x = pos.x + Math.sin(a) * d, z = pos.z + Math.cos(a) * d;
    if (env.forbidden(x, z)) continue;
    const lvHere = env.danger(x, z), kinds = pickGroup(lvHere, env.nearRuin(x, z));
    if (!kinds.length) return;
    const cost = kinds.reduce((c, k) => c + ROBOTS[k].cost, 0);
    if (!mayspawn(cost, lvHere)) return;
    // artillery stands off far away; everyone else comes in a loose group
    const far = kinds[0] === 'artillery' ? 1.5 : 1, gx = pos.x + Math.sin(a) * d * far, gz = pos.z + Math.cos(a) * d * far;
    const group: Robot[] = [];
    kinds.forEach((k, i) => make(k, gx + (i % 2 ? 1 : -1) * (i * 2.2), gz + (i > 1 ? 3 : 0), lvHere, group));
    return;
  }
}
/** Console / testing: put a robot (with its usual company) in front of the player. */
export function spawnRobotNear(model: RobotKind, d = 25) {
  if (!env) return false;
  const x = G.pos.x - Math.sin(G.yaw) * d, z = G.pos.z - Math.cos(G.yaw) * d;
  return !!make(model, x, z, Math.max(1, env.danger(x, z)), []);
}

// ---------- behaviour ----------
onNoise((at, rad) => { for (const r of W.robots) if (r.state !== 'hunt' && r.p.distanceTo(at) < rad * 0.7) alert(r); });
function alert(r: Robot) { for (const m of r.group.length ? r.group : [r]) if (m.state !== 'hunt') { m.state = 'hunt'; m.timer = 0; } }

function blocked(x: number, z: number) { return !env || env.forbidden(x, z) || foeRules.blocked(V(x, 0, z)); }
function walk(r: Robot, dx: number, dz: number, speed: number, dt: number) {
  const L = Math.hypot(dx, dz); r.speed = 0;
  if (L < 1e-3 || !env) return;
  const sx = dx / L * speed * dt, sz = dz / L * speed * dt;
  if (!blocked(r.p.x + sx, r.p.z + sz)) { r.p.x += sx; r.p.z += sz; } else if (!blocked(r.p.x + sx, r.p.z)) r.p.x += sx; else if (!blocked(r.p.x, r.p.z + sz)) r.p.z += sz; else return;
  r.speed = speed;
}
function face(r: Robot, dx: number, dz: number, dt: number, rate = 5) {
  let dh = Math.atan2(dx, dz) - r.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
  r.heading += dh * Math.min(1, dt * rate);
}
/** A blow that reaches the player (a closed cab takes it instead). */
function hit(dmg: number, push = 0, from?: THREE.Vector3) {
  if (foeRules.shielded()) { foeRules.shieldHit(dmg * 0.6); return; }
  G.hp -= dmg; G.dmgFlash = 0.45;
  if (push && from) { const d = V(G.pos.x - from.x, 0, G.pos.z - from.z).normalize(); G.vel.x += d.x * push; G.vel.z += d.z * push; G.vel.y += push * 0.4; }
}

// artillery shells: a ring marks where it will land, then the blast
interface Shell { at: THREE.Vector3; t: number; dmg: number; ring: THREE.LineLoop }
const shells: Shell[] = [];
function lob(r: Robot) {
  const lead = V(G.vel.x, 0, G.vel.z).multiplyScalar(SHELL.flight * 0.6);
  const at = V(G.pos.x + lead.x + (Math.random() - 0.5) * 3, 0, G.pos.z + lead.z + (Math.random() - 0.5) * 3);
  at.y = env ? env.ground(at.x, at.z) + 0.1 : G.pos.y;
  const pts: THREE.Vector3[] = []; for (let i = 0; i < 24; i++) { const a = i / 24 * 6.283; pts.push(V(Math.cos(a) * SHELL.radius, 0, Math.sin(a) * SHELL.radius)); }
  const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), addMat(0xff6a4a)); ring.position.copy(at); scene.add(ring);
  shells.push({ at, t: SHELL.flight, dmg: ROBOTS.artillery.dmg * (1 + r.level * 0.1), ring });
  const muzzle = r.g.localToWorld(V(0, 1.25, 4.5)); burst(muzzle, 0xff6a4a, 14, 1);
}
function updateShells(dt: number, time: number) {
  for (let i = shells.length - 1; i >= 0; i--) {
    const s = shells[i]; s.t -= dt;
    s.ring.scale.setScalar(0.4 + 0.6 * (1 - s.t / SHELL.flight)); ((s.ring.material as THREE.LineBasicMaterial).opacity = 0.5 + 0.5 * Math.sin(time * 20));
    if (s.t > 0) continue;
    burst(s.at.clone().add(V(0, 0.5, 0)), 0xff6a4a, 40, 2.2);
    const d = Math.hypot(G.pos.x - s.at.x, G.pos.z - s.at.z);
    if (d < SHELL.radius && Math.abs(G.pos.y - s.at.y) < 3 && !foeRules.playerSafe()) hit(s.dmg * (1 - d / SHELL.radius * 0.6), 6, s.at);
    scene.remove(s.ring); s.ring.geometry.dispose(); shells.splice(i, 1);
  }
}

function think(r: Robot, dt: number, time: number) {
  const s = ROBOTS[r.model], to = V(G.pos.x - r.p.x, G.pos.y + 1.1 - r.p.y, G.pos.z - r.p.z), dist = Math.hypot(to.x, to.z), safe = foeRules.playerSafe();
  const sees = () => rayWorld(r.p, to.clone().normalize(), to.length()) >= to.length() - 0.5;
  r.timer -= dt; r.atkT -= dt;
  if (r.state === 'hunt' && (safe || dist > s.sight * 2.2)) r.state = 'return';
  if (r.state === 'patrol') {
    if (r.timer <= 0) { r.timer = 3 + Math.random() * 4; r.flank = Math.random() * 6.283; }
    const hx = r.home.x + Math.cos(r.flank) * 10 - r.p.x, hz = r.home.z + Math.sin(r.flank) * 10 - r.p.z;
    if (Math.hypot(hx, hz) > 1.5) { walk(r, hx, hz, s.speed * 0.35, dt); face(r, hx, hz, dt, 2); }
    if (!safe && dist < s.sight && sees()) alert(r);
    return;
  }
  if (r.state === 'return') {
    const hx = r.home.x - r.p.x, hz = r.home.z - r.p.z;
    if (Math.hypot(hx, hz) > 2) { walk(r, hx, hz, s.speed * 0.6, dt); face(r, hx, hz, dt); } else r.state = 'patrol';
    if (!safe && dist < s.sight * 0.6 && sees()) alert(r);
    return;
  }
  // hunting
  const lvl = 1 + r.level * 0.12;
  switch (r.model) {
    case 'scout': { // swing wide round the flank, then dart in and slash; skitter back after a hit
      if (r.charge > 0) { r.charge -= dt; walk(r, -to.x, -to.z, s.speed * 0.8, dt); face(r, to.x, to.z, dt, 8); break; }
      const side = V(-to.z, 0, to.x).normalize().multiplyScalar(dist > 9 ? Math.sin(r.flank) * 7 : 0);
      walk(r, to.x + side.x, to.z + side.z, s.speed, dt); face(r, to.x, to.z, dt, 8);
      if (dist < 1.9 + s.r && r.atkT <= 0) { r.atkT = 1.1; r.swing = 1; hit(s.dmg * lvl); r.charge = 0.6; }
      break;
    }
    case 'guardian': { // keep 12-22 m, strafe, shoot
      const k = dist > 22 ? 1 : dist < 12 ? -1 : 0, side = V(-to.z, 0, to.x).normalize().multiplyScalar(Math.sin(time * 0.6 + r.flank) * 0.8);
      walk(r, to.x * k + side.x * dist, to.z * k + side.z * dist, s.speed, dt); face(r, to.x, to.z, dt);
      if (r.atkT <= 0 && dist < 32 && sees()) { r.atkT = 1.5 + Math.random() * 0.6; fireBolt(r.g.localToWorld(V(0, 0.6, 1.4)), s.dmg * lvl, 0xff9a3a); }
      break;
    }
    case 'repair': { // stay back, mend the most hurt machine near, drop defence drones
      const hurt = W.robots.filter((m) => m !== r && m.hp < m.maxHp && m.p.distanceTo(r.p) < 30).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (hurt) {
        const hx = hurt.p.x - r.p.x, hz = hurt.p.z - r.p.z;
        if (Math.hypot(hx, hz) > 6) walk(r, hx, hz, s.speed, dt); face(r, hx, hz, dt);
        if (Math.hypot(hx, hz) < 9) {
          hurt.hp = Math.min(hurt.maxHp, hurt.hp + 1.2 * dt * lvl);
          if (Math.random() < dt * 8) addFx(new THREE.Line(new THREE.BufferGeometry().setFromPoints([r.p.clone(), hurt.p.clone()]), addMat(BEAM_COLOR)), 0.08);
        }
      } else { const k = dist < 22 ? -1 : dist > 30 ? 1 : 0; walk(r, to.x * k, to.z * k, s.speed, dt); face(r, to.x, to.z, dt); }
      r.drones = r.drones.filter((d) => W.drones.includes(d));
      if (r.atkT <= 0 && r.drones.length < 2 && dist < 40) {
        r.atkT = 12;
        const d = makeDrone(); d.p.set(r.p.x, r.p.y + 0.5, r.p.z); d.hp = 1 + Math.floor(r.level * 0.4); d.g.scale.setScalar(0.6);
        d.scout = { speed: 3.2, dps: 5 + r.level * 1.5, detect: 30, lose: 40 }; d.chasing = true;
        W.drones.push(d); r.drones.push(d);
        burst(r.p, BEAM_COLOR, 12, 0.6);
      }
      break;
    }
    case 'sentinel': { // walk in to ~10 m, bursts of three bolts, a crushing blow up close
      if (dist > 10) walk(r, to.x, to.z, s.speed, dt); face(r, to.x, to.z, dt, 3);
      if (dist < 3.2 + s.r * 0.5 && r.atkT <= 0) { r.atkT = 2; r.swing = 1; hit(22 * lvl, 9, r.p); burst(G.pos.clone(), ROBOT_COLOR, 14, 0.8); break; }
      if (r.atkT <= 0 && dist < 34 && sees()) {
        r.atkT = 3.2;
        for (let i = 0; i < 3; i++) setTimeout(() => { if (W.robots.includes(r)) fireBolt(r.g.localToWorld(V(i % 2 ? 1.2 : -1.2, -0.2, 1.5)), s.dmg * lvl, 0xff9a3a); }, i * 180);
      }
      break;
    }
    case 'artillery': { // barely moves; turns and shells from afar; helpless up close (backs off)
      face(r, to.x, to.z, dt, 0.8);
      if (dist < SHELL.minRange) walk(r, -to.x, -to.z, s.speed, dt);
      else if (dist > SHELL.range * 0.8) walk(r, to.x, to.z, s.speed, dt);
      if (r.atkT <= 0 && dist > SHELL.minRange && dist < SHELL.range) { r.atkT = SHELL.every + Math.random(); lob(r); }
      break;
    }
    case 'assault': { // stomp in, charge the last stretch, smash
      if (r.charge > 0) { r.charge -= dt; walk(r, to.x, to.z, s.speed * 2, dt); face(r, to.x, to.z, dt, 6); }
      else { walk(r, to.x, to.z, s.speed, dt); face(r, to.x, to.z, dt, 3); if (dist < 12 && dist > 5 && r.atkT <= 0) r.charge = 1.2; }
      if (dist < 3 + s.r * 0.5 && r.atkT <= 0) { r.atkT = 1.9; r.swing = 1; r.charge = 0; hit(s.dmg * lvl, 14, r.p); burst(G.pos.clone(), ROBOT_COLOR, 20, 1); }
      break;
    }
  }
}

function animate(r: Robot, dt: number, time: number) {
  const s = ROBOTS[r.model], move = Math.min(1, r.speed / Math.max(1, s.speed * 0.5));
  r.anim += dt * (2 + r.speed * (r.biped ? 1.1 : 1.8));
  r.legs.forEach((l, i) => {
    const ph = r.anim + (r.biped ? i * Math.PI : [0, Math.PI, Math.PI, 0][i]);
    l.rotation.x = Math.sin(ph) * (r.biped ? 0.45 : 0.3) * move;
    if (!r.biped) l.rotation.z = Math.max(0, Math.cos(ph)) * 0.15 * move * (i % 2 ? -1 : 1);
  });
  r.swing = Math.max(0, r.swing - dt * 3);
  const sw = Math.sin(r.swing * Math.PI);
  if (r.model === 'scout') r.arms.forEach((a) => (a.rotation.x = -sw * 1.2 + Math.sin(time * 3 + r.flank) * 0.05));
  else if (r.model === 'repair') r.arms.forEach((a, i) => { a.rotation.x = Math.sin(time * 1.3 + i) * 0.25; a.rotation.z = Math.cos(time * 1.1 + i * 2) * 0.2; });
  else if (r.model === 'assault') { r.arms[0].rotation.x = -sw * 1.8 + (r.charge > 0 ? -0.6 : 0); r.arms[1].rotation.x = Math.sin(r.anim) * 0.3 * move; }
  else if (r.model === 'sentinel') r.arms.forEach((a, i) => (a.rotation.x = -sw * 1.2 + Math.sin(r.anim + i * Math.PI) * 0.2 * move));
  const bob = r.model === 'repair' ? Math.sin(time * 2 + r.flank) * 0.15 : Math.abs(Math.sin(r.anim)) * 0.05 * move;
  if (env) r.p.y = env.ground(r.p.x, r.p.z) + s.lift;
  r.g.position.set(r.p.x, r.p.y + bob, r.p.z);
  r.g.rotation.y = r.heading;
  r.flash -= dt;
  r.mat.color.setHex(r.flash > 0 ? 0xffffff : ROBOT_COLOR);
}

export function updateRobots(dt: number, time: number) {
  if (!env) return;
  if ((spawnT -= dt) <= 0) { spawnT = 7; trySpawn(); }
  for (const r of [...W.robots]) {
    if (r.state !== 'hunt' && r.p.distanceTo(G.pos) > 150) { removeRobot(r); continue; }
    think(r, dt, time);
    animate(r, dt, time);
  }
  updateShells(dt, time);
}

// ---------- damage ----------
export function hurtRobot(r: Robot, dmg: number) {
  const s = ROBOTS[r.model];
  r.hp -= dmg * s.armour; r.flash = 0.12; G.hitFlash = 0.15;
  if (r.state !== 'hunt') alert(r);
  if (r.hp > 0) return;
  const at = r.p.clone();
  burst(at, ROBOT_COLOR, 40, 1.8); burst(at, BEAM_COLOR, 16, 1);
  for (let i = 0; i < s.crystals; i++) dropCrystal(at);
  for (const [k, chance, lo, hi] of s.loot) if (Math.random() < chance) {
    const n = lo + Math.floor(Math.random() * (hi - lo + 1));
    for (let i = 0; i < n; i++) dropPickup(V(at.x + (Math.random() - 0.5) * 1.6, at.y, at.z + (Math.random() - 0.5) * 1.6), k);
  }
  logLine(s.name + ' destroyed');
  removeRobot(r);
  onKill('drone');
}
export function removeRobot(r: Robot) {
  scene.remove(r.g);
  r.g.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); });
  r.mat.dispose();
  const i = W.robots.indexOf(r); if (i >= 0) W.robots.splice(i, 1);
  const j = r.group.indexOf(r); if (j >= 0) r.group.splice(j, 1);
}
export function clearRobots() {
  for (const r of [...W.robots]) removeRobot(r);
  for (const s of shells) scene.remove(s.ring);
  shells.length = 0;
}
