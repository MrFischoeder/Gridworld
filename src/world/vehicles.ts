// Vehicles: wireframe bodies, arcade driving over the terrain, seats, and trunks for storing items.
import * as THREE from 'three';
import { scene, V, GRID } from './render';
import { G } from '../game';
import { PropBatch } from './props';
import { VEHICLES, vehicleTitle, type VehicleSpec, type VehicleModel } from '../data/vehicles';
import { startingVehicles } from '../gen/vehicles';
import { VILLAGE_RECT } from '../gen/regions';
import { rectDist } from '../gen/terrain';
import type { VehicleState } from '../save';
import { saveChar } from '../character';
import { collides } from './player';
import { openTransfer } from '../ui/transfer';
import { showToast, el } from '../ui/hud';

const BODY = 0x5cff8a, DETAIL = GRID, GLASS = 0x2a9a50;

export interface Vehicle {
  st: VehicleState; spec: VehicleSpec; group: THREE.Group;
  wheels: { g: THREE.Group; front: boolean }[];
  speed: number; spin: number; steer: number; y: number; pitch: number; roll: number;
}
export interface WorldHooks {
  height(x: number, z: number): number;
  /** True where a vehicle may not go (places, trees, rocks...). r = clearance radius around the point. */
  blocked(x: number, z: number, r: number): boolean;
}
let hooks: WorldHooks | null = null;
export const vehicles: Vehicle[] = [];
export const driving = { v: null as Vehicle | null, cockpit: false, since: 0 };

// ---------- models ----------
const wheelCache = new Map<VehicleModel, THREE.Group>();
function wheelModel(m: VehicleModel): THREE.Group {
  let w = wheelCache.get(m);
  if (w) return w;
  const s = VEHICLES[m], r = s.wheelR, hw = s.wheelW / 2, n = 14, pb = new PropBatch();
  const P = (x: number, a: number, rr = r) => [x, Math.sin(a) * rr, Math.cos(a) * rr];
  for (let i = 0; i < n; i++) {
    const a = i / n * 6.283, b = (i + 1) / n * 6.283, mid = (a + b) / 2;
    pb.face(P(-hw, a), P(hw, a), P(hw, b), P(-hw, b));
    pb.seg(DETAIL, P(-hw, a), P(-hw, b)); pb.seg(DETAIL, P(hw, a), P(hw, b));
    // chevron tread
    pb.line(DETAIL, P(-hw, a), P(0, mid, r * 1.03), P(hw, a));
    // hub on both faces
    pb.seg(DETAIL, P(-hw - 0.01, a, r * 0.45), P(-hw - 0.01, b, r * 0.45)); pb.seg(DETAIL, P(hw + 0.01, a, r * 0.45), P(hw + 0.01, b, r * 0.45));
    pb.face([-hw, 0, 0], P(-hw, a), P(-hw, b)); pb.face([hw, 0, 0], P(hw, b), P(hw, a));
  }
  for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283; pb.seg(DETAIL, P(hw + 0.01, a, r * 0.45), [hw + 0.01, 0, 0]); }
  w = pb.build(); wheelCache.set(m, w); return w;
}
const box = (pb: PropBatch, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c = BODY) =>
  pb.solid8([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], c);

function scoutBody(pb: PropBatch) {
  // tub, hood and grille
  box(pb, -0.82, 0.55, -1.95, 0.82, 1.0, 1.0);
  pb.solid8([[-0.85, 0.6, 1.0], [0.85, 0.6, 1.0], [0.85, 0.6, 2.08], [-0.85, 0.6, 2.08]], [[-0.8, 1.2, 1.0], [0.8, 1.2, 1.0], [0.8, 1.02, 2.05], [-0.8, 1.02, 2.05]], BODY);
  for (let x = -0.5; x <= 0.5; x += 0.25) pb.line(DETAIL, [x, 0.68, 2.09], [x, 0.95, 2.07]);
  for (const x of [-0.62, 0.62]) pb.line(DETAIL, [x - 0.1, 0.9, 2.08], [x + 0.1, 0.9, 2.08], [x + 0.1, 0.98, 2.07], [x - 0.1, 0.98, 2.07], [x - 0.1, 0.9, 2.08]);
  // fenders over the wheels
  for (const z of VEHICLES.scout.axles) for (const sx of [-1, 1]) box(pb, sx * 0.78, 0.98, z - 0.58, sx * 1.08, 1.1, z + 0.58);
  // seats
  for (const x of [-0.42, 0.42]) { box(pb, x - 0.26, 1.0, -0.45, x + 0.26, 1.18, 0.1, DETAIL); box(pb, x - 0.26, 1.0, -0.6, x + 0.26, 1.62, -0.45, DETAIL); }
  // roll cage and windshield frame (tubes are lines)
  const cz0 = 0.72, cz1 = -1.25, top = 1.82;
  for (const x of [-0.8, 0.8]) { pb.line(BODY, [x, 1.0, cz0], [x, top, cz0 - 0.15], [x, top, cz1 + 0.1], [x, 1.0, cz1]); pb.line(BODY, [x, 1.2, 1.0], [x, 1.55, 0.8]); }
  pb.line(BODY, [-0.8, top, cz0 - 0.15], [0.8, top, cz0 - 0.15]); pb.line(BODY, [-0.8, top, cz1 + 0.1], [0.8, top, cz1 + 0.1]);
  pb.line(BODY, [-0.8, top, cz1 + 0.1], [0.8, top, cz0 - 0.15]);
  pb.line(GLASS, [-0.8, 1.2, 1.0], [0.8, 1.2, 1.0], [0.8, 1.55, 0.8], [-0.8, 1.55, 0.8], [-0.8, 1.2, 1.0]);
  // cargo bed walls (the trunk) and a spare wheel mount
  box(pb, -0.82, 1.0, -1.95, 0.82, 1.28, -1.85); box(pb, -0.82, 1.0, -1.95, -0.72, 1.28, -0.75); box(pb, 0.72, 1.0, -1.95, 0.82, 1.28, -0.75);
  box(pb, -0.3, 0.7, -2.12, 0.3, 1.3, -1.95, DETAIL);
}
function mastodonBody(pb: PropBatch) {
  // chassis beam
  box(pb, -0.65, 0.95, -4.8, 0.65, 1.35, 4.4, DETAIL);
  // cab with a raked windscreen
  pb.solid8([[-1.72, 1.25, 2.1], [1.72, 1.25, 2.1], [1.72, 1.25, 4.75], [-1.72, 1.25, 4.75]], [[-1.65, 3.25, 2.1], [1.65, 3.25, 2.1], [1.65, 3.25, 4.15], [-1.65, 3.25, 4.15]], BODY);
  // windows: split windscreen and side windows
  for (const [a, b] of [[-1.5, -0.08], [0.08, 1.5]]) pb.line(GLASS, [a, 2.35, 4.58], [b, 2.35, 4.58], [b, 3.08, 4.2], [a, 3.08, 4.2], [a, 2.35, 4.58]);
  for (const x of [-1.73, 1.73]) pb.line(GLASS, [x, 2.3, 2.4], [x, 2.3, 3.9], [x, 3.0, 3.9], [x, 3.0, 2.4], [x, 2.3, 2.4]);
  for (const x of [-1.73, 1.73]) pb.line(DETAIL, [x, 1.4, 2.35], [x, 2.2, 2.35], [x, 2.2, 3.95]);
  // grille, bumper and brush guard
  for (let x = -1.2; x <= 1.2; x += 0.3) pb.line(DETAIL, [x, 1.45, 4.76], [x, 2.05, 4.76]);
  box(pb, -1.8, 0.95, 4.75, 1.8, 1.35, 5.0);
  for (const x of [-1.1, 1.1]) pb.line(BODY, [x, 1.35, 4.98], [x * 1.05, 2.6, 5.05], [x * 1.05, 2.6, 4.72]);
  pb.line(BODY, [-1.15, 2.6, 5.05], [1.15, 2.6, 5.05]);
  // exhaust stack
  box(pb, 1.45, 1.4, 1.75, 1.7, 4.3, 2.0, DETAIL);
  // cargo box with panel seams (the trunk)
  box(pb, -1.78, 1.45, -4.95, 1.78, 3.4, 1.8);
  for (let z = -3.65; z < 1.8; z += 1.3) for (const x of [-1.79, 1.79]) pb.line(DETAIL, [x, 1.45, z], [x, 3.4, z]);
  for (const x of [-1.79, 1.79]) pb.line(DETAIL, [x, 2.7, -4.95], [x, 2.7, 1.8]);
  pb.line(DETAIL, [-1.3, 1.6, -4.96], [1.3, 1.6, -4.96], [1.3, 3.2, -4.96], [-1.3, 3.2, -4.96], [-1.3, 1.6, -4.96]);
  pb.line(DETAIL, [0, 1.6, -4.96], [0, 3.2, -4.96]);
  // mudguards
  for (const z of VEHICLES.mastodon.axles) for (const sx of [-1, 1]) box(pb, sx * 1.15, 1.6, z - 0.95, sx * 1.8, 1.72, z + 0.95, DETAIL);
}

function makeVehicle(st: VehicleState): Vehicle {
  const spec = VEHICLES[st.model], group = new THREE.Group(), pb = new PropBatch();
  if (st.model === 'scout') scoutBody(pb); else mastodonBody(pb);
  group.add(pb.build());
  const wheels: Vehicle['wheels'] = [];
  spec.axles.forEach((z, ai) => {
    for (const sx of [-1, 1]) {
      const g = new THREE.Group(), w = wheelModel(st.model).clone();
      g.add(w); g.position.set(sx * spec.track, spec.wheelR, z); group.add(g);
      wheels.push({ g: w as unknown as THREE.Group, front: ai === 0 });
      (w as THREE.Object3D).userData.pivot = g;
    }
  });
  scene.add(group);
  const v: Vehicle = { st, spec, group, wheels, speed: 0, spin: 0, steer: 0, y: 0, pitch: 0, roll: 0 };
  pose(v);
  return v;
}

// ---------- geometry helpers ----------
const fwd = (h: number): [number, number] => [Math.sin(h), Math.cos(h)];
/** Body point (x right, z forward) to world x/z. */
function toWorld(v: { st: { x: number; z: number; heading: number } }, lx: number, lz: number): [number, number] {
  const h = v.st.heading, c = Math.cos(h), s = Math.sin(h);
  return [v.st.x + lx * c + lz * s, v.st.z - lx * s + lz * c];
}
function toLocal(v: Vehicle, x: number, z: number): [number, number] {
  const h = v.st.heading, c = Math.cos(h), s = Math.sin(h), dx = x - v.st.x, dz = z - v.st.z;
  return [dx * c - dz * s, dx * s + dz * c];
}
/** Rest the body on its wheels: height from the wheel contact points, pitch and roll from their differences. */
function pose(v: Vehicle) {
  const s = v.spec, H = hooks ? hooks.height : () => 0, zf = s.axles[0], zr = s.axles[s.axles.length - 1];
  const g = (lx: number, lz: number) => { const [x, z] = toWorld(v, lx, lz); return H(x, z); };
  const fl = g(-s.track, zf), fr = g(s.track, zf), rl = g(-s.track, zr), rr = g(s.track, zr);
  v.y = (fl + fr + rl + rr) / 4;
  v.pitch = Math.atan2((fl + fr) / 2 - (rl + rr) / 2, zf - zr);
  v.roll = Math.atan2((fr + rr) / 2 - (fl + rl) / 2, 2 * s.track);
  v.group.position.set(v.st.x, v.y - 0.05, v.st.z);
  v.group.rotation.set(-v.pitch, v.st.heading, v.roll, 'YXZ');
  for (const w of v.wheels) {
    w.g.rotation.x = v.spin;
    const pivot = (w.g as THREE.Object3D).userData.pivot as THREE.Group;
    pivot.rotation.y = w.front ? v.steer * 0.45 : 0;
  }
}

// ---------- lifecycle ----------
export function spawnVehicles(h: WorldHooks) {
  hooks = h;
  clearVehicles();
  const c = G.char;
  if (!c.vehicles.length) {
    c.vehicles = startingVehicles().map((p) => ({ ...p, trunk: { items: Array(VEHICLES[p.model].trunk).fill(null), gold: 0 } }));
    saveChar();
  }
  for (const st of c.vehicles) vehicles.push(makeVehicle(st));
}
export function clearVehicles() {
  if (driving.v) leave(false);
  // the body batch is per vehicle; wheel geometry is shared between clones and stays cached
  for (const v of vehicles) { scene.remove(v.group); v.group.children[0].traverse((o) => (o as THREE.Mesh).geometry?.dispose()); }
  vehicles.length = 0;
}

// ---------- interaction ----------
export interface VehicleSpot { v: Vehicle; kind: 'drive' | 'trunk'; label: string }
/** What the player on foot could do with a vehicle right here. */
export function vehicleSpot(): VehicleSpot | null {
  let best: VehicleSpot | null = null, bd = 2.4;
  for (const v of vehicles) {
    if (Math.abs(G.pos.y - v.y) > 2.5) continue;
    for (const side of [-1, 1]) {
      const [x, z] = toWorld(v, side * v.spec.door[0], v.spec.door[1]), d = Math.hypot(x - G.pos.x, z - G.pos.z);
      if (d < bd) { bd = d; best = { v, kind: 'drive', label: 'drive the ' + vehicleTitle(v.st.model) }; }
    }
    const [x, z] = toWorld(v, v.spec.rear[0], v.spec.rear[1]), d = Math.hypot(x - G.pos.x, z - G.pos.z);
    if (d < bd) { bd = d; best = { v, kind: 'trunk', label: 'open the trunk' }; }
  }
  return best;
}
export function useVehicle(s: VehicleSpot) {
  if (s.kind === 'trunk') {
    const v = s.v;
    openTransfer({ title: vehicleTitle(v.st.model), subtitle: v.spec.role + ' · ' + v.spec.seats + ' seats', boxLabel: 'Trunk', box: v.st.trunk, canStore: true });
    return;
  }
  driving.v = s.v; s.v.speed = 0; driving.since = performance.now();
  G.vel.set(0, 0, 0); G.firing = false;
  G.yaw = s.v.st.heading + Math.PI; G.pitch = -0.12;
  showToast(vehicleTitle(s.v.st.model));
}
/** Get out on the driver's side (or wherever there is room). */
export function leave(save = true) {
  const v = driving.v;
  if (!v) return;
  driving.v = null; v.speed = 0; v.steer = 0;
  const spots: [number, number][] = [[v.spec.door[0], v.spec.door[1]], [-v.spec.door[0], v.spec.door[1]], [v.spec.rear[0], v.spec.rear[1]], [v.spec.door[0] + 1, v.spec.door[1]]];
  for (const [lx, lz] of spots) {
    const [x, z] = toWorld(v, lx, lz), y = hooks ? hooks.height(x, z) : v.y;
    G.pos.set(x, y, z);
    if (!collides(G.pos) && !(hooks && hooks.blocked(x, z, 0.3))) break;
  }
  G.vel.set(0, 0, 0); G.yaw = v.st.heading + Math.PI; G.pitch = 0;
  el.veh.textContent = '';
  if (save) saveChar();
}

/** Player collision with parked vehicles (their body box). */
export function vehicleHit(x: number, y: number, z: number, r: number): boolean {
  for (const v of vehicles) {
    if (v === driving.v || y > v.y + v.spec.height || y + 1.7 < v.y) continue;
    const [lx, lz] = toLocal(v, x, z);
    if (Math.abs(lx) < v.spec.width / 2 + r && Math.abs(lz) < v.spec.length / 2 + r) return true;
  }
  return false;
}

// ---------- driving ----------
function hullBlocked(v: Vehicle, x: number, z: number, h: number): boolean {
  if (!hooks) return false;
  const probe = { st: { x, z, heading: h } }, s = v.spec, hl = s.length / 2, hw = s.width / 2;
  for (const [lx, lz] of [[-hw, hl], [hw, hl], [-hw, -hl], [hw, -hl], [0, hl], [0, -hl], [-hw, 0], [hw, 0]]) {
    const [px, pz] = toWorld(probe, lx, lz);
    if (rectDist(VILLAGE_RECT, px, pz) < 1 || hooks.blocked(px, pz, 0.4)) return true;
  }
  for (const o of vehicles) if (o !== v && Math.hypot(o.st.x - x, o.st.z - z) < (o.spec.length + s.length) / 2 * 0.8) {
    const [lx, lz] = toLocal(o, x, z);
    if (Math.abs(lx) < (o.spec.width + s.width) / 2 && Math.abs(lz) < (o.spec.length + s.length) / 2) return true;
  }
  return false;
}
export function updateDriving(dt: number) {
  const v = driving.v!, s = v.spec, k = G.keys, stick = G.stick;
  const thr = Math.max(-1, Math.min(1, (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0) - stick.dy));
  const steer = Math.max(-1, Math.min(1, (k.KeyA ? 1 : 0) - (k.KeyD ? 1 : 0) - stick.dx));
  const brake = k.Space || G.touchJump;
  // throttle, rolling drag, brakes, and gravity along the slope
  v.speed += thr * s.accel * dt * (thr * v.speed < 0 ? 2 : 1);
  v.speed -= v.speed * (thr ? 0.15 : 0.9) * dt;
  if (brake) v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), 18 * dt);
  v.speed -= 9.8 * Math.sin(v.pitch) * dt * 0.6;
  v.speed = Math.max(-s.maxSpeed * 0.35, Math.min(s.maxSpeed, v.speed));
  v.steer += (steer - v.steer) * Math.min(1, 6 * dt);
  const dh = v.steer * s.turn * dt * Math.max(-1, Math.min(1, v.speed / 6));
  const nh = v.st.heading + dh, [fx, fz] = fwd(nh), nx = v.st.x + fx * v.speed * dt, nz = v.st.z + fz * v.speed * dt;
  // too steep to climb?
  const H = hooks!.height, ahead = H(nx + fx * s.length / 2, nz + fz * s.length / 2), behind = H(nx - fx * s.length / 2, nz - fz * s.length / 2);
  const climb = (ahead - behind) / s.length * Math.sign(v.speed || 1);
  if (hullBlocked(v, nx, nz, nh) || climb > 0.8) {
    if (Math.abs(v.speed) > 6) showToast('Crash!');
    v.speed = -v.speed * 0.25;
  } else {
    v.st.x = nx; v.st.z = nz; v.st.heading = nh;
    if (!driving.cockpit) G.yaw += dh * 0.9; // the chase camera swings with the vehicle
    else G.yaw += dh;
  }
  v.spin += v.speed / s.wheelR * dt;
  pose(v);
  G.pos.set(v.st.x, v.y, v.st.z);
  G.vel.set(0, 0, 0);
  el.veh.textContent = `${vehicleTitle(v.st.model)} · ${Math.round(Math.abs(v.speed) * 3.6)} km/h · seats 1/${s.seats}`;
}
/** Chase camera behind and above the vehicle (or the driver's eye in cockpit view, V). */
export function vehicleCamera(camera: THREE.PerspectiveCamera) {
  const v = driving.v!, s = v.spec;
  if (driving.cockpit) {
    const e = V(s.eye[0], s.eye[1], s.eye[2]).applyEuler(v.group.rotation).add(v.group.position);
    camera.position.copy(e);
    return;
  }
  const dist = s.length * 0.9 + 4, cy = Math.cos(G.pitch), f = V(-Math.sin(G.yaw) * cy, Math.sin(G.pitch), -Math.cos(G.yaw) * cy);
  const target = V(v.st.x, v.y + s.height * 0.85, v.st.z);
  const p = target.clone().addScaledVector(f, -dist); p.y += 1.2;
  if (hooks) p.y = Math.max(p.y, hooks.height(p.x, p.z) + 0.6);
  camera.position.copy(p);
}
export const toggleCockpit = () => { driving.cockpit = !driving.cockpit; };
