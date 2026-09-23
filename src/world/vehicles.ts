// Vehicles: wireframe bodies, arcade driving over the terrain, seats, and trunks for storing items.
import * as THREE from 'three';
import { scene, camera, V, GRID } from './render';
import { G } from '../game';
import { PropBatch } from './props';
import { VEHICLES, vehicleTitle, freshParts, upgradeParts, immobile, partPerformance, resaleValue, FUEL_BURN, hurtEngine, engineBoost, type VehicleSpec, type VehicleModel } from '../data/vehicles';
import { PART_PRICE, PART_BUYBACK } from '../data/items';
import { rayWorld } from './player';
import { foes, damageFoe } from './enemies';
import { addFx, burst } from './fx';
import { makeNoise } from './noise';
import { add as addMat, edgesOf, lineMat } from './render';
import { regionVehicle, YARD, type Parking } from '../gen/vehicles';
import type { Terrain } from '../gen/terrain';
import { regionOf, nearX } from '../gen/regions';
import { RELIC_KEYS } from '../data/items';
import { putItems } from '../inventory';
import { villageDist } from '../gen/regions';
import type { VehicleState } from '../save';
import { saveChar } from '../character';
import { collides } from './player';
import { openTransfer } from '../ui/transfer';
import { openService } from '../ui/service';
import { showToast, logLine, el } from '../ui/hud';

const BODY = 0x5cff8a, DETAIL = GRID, GLASS = 0x2a9a50;

export interface Vehicle {
  st: VehicleState; spec: VehicleSpec; group: THREE.Group;
  /** Abandoned vehicles out in the wilds belong to nobody until someone gets in or opens the trunk. */
  claimed: boolean;
  wheels: { g: THREE.Group; front: boolean }[];
  /** Roof cannon (present when one is fitted). */
  turret: THREE.Group | null;
  /** Metres driven since the last wear tick. */
  odo: number;
  /** Driven by bandits (world/raiders.ts): not claimable until they are beaten. */
  ai?: boolean;
  speed: number; spin: number; steer: number; y: number; pitch: number; roll: number;
}
export interface WorldHooks {
  height(x: number, z: number): number;
  /** Depth of standing water at a point (0 on dry land). */
  water(x: number, z: number): number;
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

function makeVehicle(st: VehicleState, claimed = true): Vehicle {
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
  st.parts ??= freshParts(st.model); // saves from before vehicles had parts
  upgradeParts(st.model, st.parts);
  scene.add(group);
  const v: Vehicle = { st, spec, group, claimed, wheels, turret: null, odo: 0, speed: 0, spin: 0, steer: 0, y: 0, pitch: 0, roll: 0 };
  refreshParts(v);
  pose(v);
  return v;
}

// ---------- parts ----------
const turretMat = lineMat(0xffb347);
function turretModel(): THREE.Group {
  const g = new THREE.Group(), pb = new PropBatch();
  pb.solid8([[-0.35, 0, -0.35], [0.35, 0, -0.35], [0.35, 0, 0.35], [-0.35, 0, 0.35]], [[-0.28, 0.32, -0.28], [0.28, 0.32, -0.28], [0.28, 0.32, 0.28], [-0.28, 0.32, 0.28]], 0xffb347);
  pb.solid8([[-0.07, 0.12, 0.2], [0.07, 0.12, 0.2], [0.07, 0.12, 1.25], [-0.07, 0.12, 1.25]], [[-0.07, 0.24, 0.2], [0.07, 0.24, 0.2], [0.07, 0.24, 1.25], [-0.07, 0.24, 1.25]], 0xffb347);
  g.add(pb.build());
  g.add(edgesOf(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 10), turretMat));
  return g;
}
/** Show fitted parts: missing wheels are not drawn, a cannon sits on the roof. */
export function refreshParts(v: Vehicle) {
  v.wheels.forEach((w, i) => { ((w.g as THREE.Object3D).userData.pivot as THREE.Group).visible = v.st.parts.wheels[i] >= 0; });
  if (v.st.parts.gun && !v.turret) {
    v.turret = turretModel(); v.turret.position.set(...v.spec.mount); v.group.add(v.turret);
  } else if (!v.st.parts.gun && v.turret) {
    v.group.remove(v.turret); v.turret.traverse((o) => (o as THREE.Mesh).geometry?.dispose()); v.turret = null;
  }
}
/** Wear from driving and knocks from crashes. */
function wear(v: Vehicle, metres: number, crash: number) {
  const p = v.st.parts;
  v.odo += metres;
  if (FUEL_BURN) p.fuel = Math.max(0, p.fuel - metres / 1000 * v.spec.fuelUse * FUEL_BURN);
  while (v.odo >= 100) { v.odo -= 100; p.wheels = p.wheels.map((w) => (w > 0 ? Math.max(1, w - 0.6) : w)); }
  if (crash > 6) {
    const i = (Math.random() * p.wheels.length) | 0, hit = Math.min(35, (crash - 6) * 3);
    if (p.wheels[i] > 0) p.wheels[i] = Math.max(0, Math.round(p.wheels[i] - hit));
    hurtEngine(p, hit * 0.4);
    damageVehicle(v, (crash - 6) * 2.5 * v.spec.hull / 120);
    const why = immobile(p);
    if (why) { showToast('Breakdown! ' + why); v.speed = 0; }
  }
}

// ---------- hull ----------
let hullWarnAt = 0;
/**
 * Hull damage from gunfire, rams and crashes. At 0 the vehicle is wrecked: it stops, smokes, and the driver
 * is thrown out (hurt if the cab is open). Hull Plating fitted at the front brings it back.
 * Returns true when this hit wrecked it.
 */
export function damageVehicle(v: Vehicle, dmg: number): boolean {
  const p = v.st.parts;
  if (p.hull <= 0 || dmg <= 0) return false;
  p.hull = Math.max(0, p.hull - dmg);
  if (v === driving.v) {
    G.dmgFlash = Math.max(G.dmgFlash, 0.12);
    if (p.hull < v.spec.hull * 0.25 && performance.now() > hullWarnAt) { hullWarnAt = performance.now() + 6000; logLine('Hull critical!'); }
  }
  if (p.hull > 0) return false;
  burst(V(v.st.x, v.y + v.spec.height * 0.6, v.st.z), 0xffb347, 60, v.spec.length * 0.5);
  if (v === driving.v) {
    showToast(vehicleTitle(v.st.model) + ' wrecked!');
    logLine('The hull gave out. Patch it with Hull Plating at the front of the vehicle.');
    leave();
    if (!v.spec.enclosed) G.hp -= 15;
    G.dmgFlash = 0.6;
  }
  if (v.claimed) saveChar();
  return true;
}
/** Wrecked vehicles smoulder: a few sparks rise from them now and then. */
let smokeT = 0;
export function smokeWrecks(dt: number) {
  if ((smokeT -= dt) > 0) return;
  smokeT = 0.35;
  for (const v of vehicles) if (v.st.parts.hull <= 0 && v.claimed && Math.hypot(v.st.x - G.pos.x, v.st.z - G.pos.z) < 90)
    burst(V(v.st.x + (Math.random() - 0.5) * v.spec.width, v.y + v.spec.height, v.st.z + (Math.random() - 0.5) * v.spec.length * 0.5), 0x3a8a50, 3, 0.4);
}

// ---------- cannon ----------
let gunCool = 0;
/** Fire the roof cannon where the camera looks. */
export function fireCannon(dt: number) {
  const v = driving.v;
  gunCool -= dt;
  if (!v || !v.turret || !G.firing || gunCool > 0) return;
  gunCool = 0.55;
  const muzzle = V(0, 0.18, 1.3); v.turret.localToWorld(muzzle);
  const d = new THREE.Vector3(); camera.getWorldDirection(d);
  let tHit = rayWorld(muzzle, d, 90), hit = null;
  for (const t of foes()) {
    const rr = (t.r || 0.6) + 0.3, oc = muzzle.clone().sub(t.g.position), b = oc.dot(d), c = oc.lengthSq() - rr * rr, disc = b * b - c;
    if (disc < 0) continue; const tt = -b - Math.sqrt(disc);
    if (tt > 0 && tt < tHit) { tHit = tt; hit = t; }
  }
  const end = muzzle.clone().addScaledVector(d, tHit);
  addFx(new THREE.Line(new THREE.BufferGeometry().setFromPoints([muzzle, end]), addMat(0xffb347)), 0.15);
  burst(end, 0xffb347, hit ? 16 : 8, hit ? 1.1 : 0.5);
  if (hit) damageFoe(hit, 3 * G.S.bm);
  makeNoise(muzzle, 95); // the cannon is heard far and wide
}
/** The turret follows the camera. */
function aimTurret(v: Vehicle) {
  if (!v.turret) return;
  v.turret.rotation.y = v === driving.v ? G.yaw + Math.PI - v.st.heading : 0;
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
  for (const st of G.char.vehicles) { st.x = nearX(st.x, G.pos.x); vehicles.push(makeVehicle(st)); }
}
const emptyTrunk = (m: VehicleModel) => ({ items: Array(VEHICLES[m].trunk).fill(null), gold: 0 });
const stateOf = (p: Parking): VehicleState => ({ ...p, parts: structuredClone(p.parts), trunk: emptyTrunk(p.model) });

// ---------- abandoned vehicles ----------
const foundCache = new Map<string, Parking | null>();
/** Show the abandoned vehicles of the regions around (x, z) that nobody has claimed yet; drop far ones. */
export function syncFound(t: Terrain, x: number, z: number) {
  const [rx, rz] = regionOf(x, z), owned = new Set(G.char.vehicles.map((s) => s.id));
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const key = t.world + ':' + (rx + i) + ':' + (rz + j);
    if (!foundCache.has(key)) foundCache.set(key, regionVehicle(t, rx + i, rz + j));
    const p = foundCache.get(key);
    if (!p || owned.has(p.id) || vehicles.some((v) => v.st.id === p.id)) continue;
    vehicles.push(makeVehicle(stateOf(p), false));
  }
  for (let i = vehicles.length - 1; i >= 0; i--) {
    const v = vehicles[i];
    if (!v.claimed && Math.hypot(v.st.x - x, v.st.z - z) > 420) { dropVehicle(v); vehicles.splice(i, 1); }
  }
}
/** Taking an abandoned vehicle: it becomes yours, with whatever its last owner left in the trunk. */
function claim(v: Vehicle) {
  if (v.claimed) return;
  v.claimed = true;
  const t = v.st.trunk;
  t.gold = 10 + Math.floor(Math.random() * 60);
  if (Math.random() < 0.6) putItems(t.items, 'medkit', 1 + Math.floor(Math.random() * 2));
  if (Math.random() < 0.3) putItems(t.items, 'emp', 1);
  if (Math.random() < 0.2) putItems(t.items, RELIC_KEYS[(Math.random() * RELIC_KEYS.length) | 0], 1);
  G.char.vehicles.push(v.st); saveChar();
  showToast('Found: ' + vehicleTitle(v.st.model));
}

// ---------- the dealer ----------
/** Buys a vehicle and parks it in the first free bay of the yard. Returns a message for the shop window. */
export function buyVehicle(model: VehicleModel): string {
  const spec = VEHICLES[model], c = G.char;
  if (c.gold < spec.price) return 'Not enough gold.';
  const bay = YARD.bays.find((b) => !vehicles.some((v) => Math.hypot(v.st.x - b.x, v.st.z - b.z) < 7));
  if (!bay) return 'The yard is full. Drive one of your vehicles away first.';
  c.gold -= spec.price;
  const st = stateOf({ id: model + '-' + Date.now().toString(36), model, x: bay.x, z: bay.z, heading: YARD.heading, parts: freshParts(model) });
  c.vehicles.push(st); vehicles.push(makeVehicle(st)); saveChar();
  return `Your ${vehicleTitle(model)} is waiting in the yard outside the north gate.`;
}
/** Drones cannot reach the driver of a vehicle with a closed cab. */
export const shielded = () => !!driving.v && driving.v.spec.enclosed;
export function clearVehicles() {
  if (driving.v) leave(false);
  for (const v of vehicles) dropVehicle(v);
  vehicles.length = 0;
}
/** The body batch is per vehicle; wheel geometry is shared between clones and stays cached. */
function dropVehicle(v: Vehicle) { scene.remove(v.group); v.group.children[0].traverse((o) => (o as THREE.Mesh).geometry?.dispose()); }

// ---------- interaction ----------
export interface VehicleSpot { v: Vehicle; kind: 'drive' | 'trunk' | 'service'; label: string }
/** What the player on foot could do with a vehicle right here. */
export function vehicleSpot(): VehicleSpot | null {
  let best: VehicleSpot | null = null, bd = 2.4;
  for (const v of vehicles) {
    if (v.ai || Math.abs(G.pos.y - v.y) > 2.5) continue;
    for (const side of [-1, 1]) {
      const [x, z] = toWorld(v, side * v.spec.door[0], v.spec.door[1]), d = Math.hypot(x - G.pos.x, z - G.pos.z);
      if (d < bd) { bd = d; best = { v, kind: 'drive', label: (v.claimed ? 'drive the ' : 'take the abandoned ') + vehicleTitle(v.st.model) + (v.st.parts.hull <= 0 ? ' (wrecked)' : '') }; }
    }
    const [x, z] = toWorld(v, v.spec.rear[0], v.spec.rear[1]), d = Math.hypot(x - G.pos.x, z - G.pos.z);
    if (d < bd) { bd = d; best = { v, kind: 'trunk', label: v.claimed ? 'open the trunk' : 'search the abandoned ' + vehicleTitle(v.st.model) }; }
    const [fx2, fz2] = toWorld(v, v.spec.front[0], v.spec.front[1]), df = Math.hypot(fx2 - G.pos.x, fz2 - G.pos.z);
    if (df < bd) { bd = df; best = { v, kind: 'service', label: 'service the ' + vehicleTitle(v.st.model) }; }
  }
  return best;
}
export function useVehicle(s: VehicleSpot) {
  claim(s.v);
  if (s.kind === 'service') { openService(s.v); return; }
  if (s.kind === 'trunk') {
    const v = s.v;
    openTransfer({ title: vehicleTitle(v.st.model), subtitle: v.spec.role + ' · ' + v.spec.seats + ' seats', boxLabel: 'Trunk', box: v.st.trunk });
    return;
  }
  const why = immobile(s.v.st.parts);
  if (why) { showToast("It won't move"); logLine(why + ' Service it at the front of the vehicle.'); return; }
  driving.v = s.v; s.v.speed = 0; driving.since = performance.now(); setSeeThrough(s.v, driving.cockpit);
  G.vel.set(0, 0, 0); G.firing = false;
  G.yaw = s.v.st.heading + Math.PI; G.pitch = -0.12;
  showToast(vehicleTitle(s.v.st.model));
}
/** Get out on the driver's side (or wherever there is room). */
export function leave(save = true) {
  const v = driving.v;
  if (!v) return;
  driving.v = null; v.speed = 0; v.steer = 0; aimTurret(v); setSeeThrough(v, false);
  const spots: [number, number][] = [[v.spec.door[0], v.spec.door[1]], [-v.spec.door[0], v.spec.door[1]], [v.spec.rear[0], v.spec.rear[1]], [v.spec.door[0] + 1, v.spec.door[1]]];
  for (const [lx, lz] of spots) {
    const [x, z] = toWorld(v, lx, lz), y = hooks ? hooks.height(x, z) : v.y;
    G.pos.set(x, y, z);
    if (!collides(G.pos) && !(hooks && hooks.blocked(x, z, 0.3))) break;
  }
  G.vel.set(0, 0, 0); G.yaw = v.st.heading + Math.PI; G.pitch = 0;
  el.veh.innerHTML = '';
  if (save) saveChar();
}

/** Moves every vehicle to the copy of the world nearest to x (after going round the planet). */
export function vehiclesNear(x: number) {
  for (const v of vehicles) { const nx = nearX(v.st.x, x); if (nx !== v.st.x) { v.st.x = nx; pose(v); } }
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
let deepWarnAt = 0, blockedByWater = false;
function deepWarn(v: Vehicle) {
  if (performance.now() < deepWarnAt) return;
  deepWarnAt = performance.now() + 4000;
  showToast('Too deep'); logLine(`The water is too deep for the ${vehicleTitle(v.st.model)} (it can ford ${v.spec.wade} m).`);
}
function hullBlocked(v: Vehicle, x: number, z: number, h: number): boolean {
  blockedByWater = false;
  if (!hooks) return false;
  const probe = { st: { x, z, heading: h } }, s = v.spec, hl = s.length / 2, hw = s.width / 2;
  for (const [lx, lz] of [[-hw, hl], [hw, hl], [-hw, -hl], [hw, -hl], [0, hl], [0, -hl], [-hw, 0], [hw, 0]]) {
    const [px, pz] = toWorld(probe, lx, lz);
    if (hooks.water(px, pz) > s.wade) { blockedByWater = true; if (v === driving.v) deepWarn(v); return true; } // too deep to ford
    if (villageDist(G.char.world, px, pz, 60) < 1 || hooks.blocked(px, pz, 0.4)) return true;
  }
  for (const o of vehicles) if (o !== v && Math.hypot(o.st.x - x, o.st.z - z) < (o.spec.length + s.length) / 2 * 0.8) {
    const [lx, lz] = toLocal(o, x, z);
    if (Math.abs(lx) < (o.spec.width + s.width) / 2 && Math.abs(lz) < (o.spec.length + s.length) / 2) return true;
  }
  return false;
}
export function updateDriving(dt: number) {
  const v = driving.v!, s = v.spec, k = G.keys, stick = G.stick, boost = engineBoost(v.st.parts), perf = partPerformance(v.st.parts), maxSpeed = s.maxSpeed * perf * boost.speed;
  const thr = Math.max(-1, Math.min(1, (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0) - stick.dy));
  const steer = Math.max(-1, Math.min(1, (k.KeyA ? 1 : 0) - (k.KeyD ? 1 : 0) - stick.dx));
  const brake = k.Space || G.touchJump;
  // throttle, rolling drag, brakes, and gravity along the slope
  v.speed += thr * s.accel * perf * boost.accel * dt * (thr * v.speed < 0 ? 2 : 1);
  v.speed -= v.speed * (thr ? 0.15 : 0.9) * dt;
  if (brake) v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), 18 * dt);
  v.speed -= 9.8 * Math.sin(v.pitch) * dt * 0.6;
  v.speed = Math.max(-maxSpeed * 0.35, Math.min(maxSpeed, v.speed));
  v.steer += (steer - v.steer) * Math.min(1, 6 * dt);
  const dh = v.steer * s.turn * dt * Math.max(-1, Math.min(1, v.speed / 6));
  const nh = v.st.heading + dh, [fx, fz] = fwd(nh), nx = v.st.x + fx * v.speed * dt, nz = v.st.z + fz * v.speed * dt;
  // too steep to climb?
  const H = hooks!.height, ahead = H(nx + fx * s.length / 2, nz + fz * s.length / 2), behind = H(nx - fx * s.length / 2, nz - fz * s.length / 2);
  const climb = (ahead - behind) / s.length * Math.sign(v.speed || 1);
  if (hullBlocked(v, nx, nz, nh) && blockedByWater) v.speed = 0; // the water is too deep: it just won't go on
  else if (hullBlocked(v, nx, nz, nh) || climb > 0.8) {
    const impact = Math.abs(v.speed);
    if (impact > 6) showToast('Crash!');
    v.speed = -v.speed * 0.25;
    wear(v, 0, impact);
    if (driving.v !== v) return; // the crash wrecked it
  } else {
    wear(v, Math.abs(v.speed) * dt, 0);
    v.st.x = nx; v.st.z = nz; v.st.heading = nh;
    if (!driving.cockpit) G.yaw += dh * 0.9; // the chase camera swings with the vehicle
    else G.yaw += dh;
  }
  v.spin += v.speed / s.wheelR * dt;
  pose(v); aimTurret(v);
  if (immobile(v.st.parts)) { leave(); return; }
  G.pos.set(v.st.x, v.y, v.st.z);
  G.vel.set(0, 0, 0);
  const p = v.st.parts, worst = Math.min(...p.wheels);
  el.veh.innerHTML = `${vehicleTitle(v.st.model)} · ${Math.round(Math.abs(v.speed) * 3.6)} km/h · seats 1/${s.seats}${s.enclosed ? ' · cab closed' : ''}` +
    `<br><span${p.hull < s.hull * 0.25 ? ' class="warn"' : ''}>hull ${Math.ceil(p.hull)}/${s.hull}</span> · engine ${Math.round(p.engine)}% · wheels ${Math.round(worst)}%` +
    ` · fuel ${Math.round(p.fuel / s.tank * 100)}%${v.turret ? ' · cannon' : ''}`;
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
/**
 * In the cockpit the camera sits inside the body, so the driven vehicle's dark fill would block the view:
 * hide it and keep only its lines (you look out through the frame and windows).
 */
function setSeeThrough(v: Vehicle, on: boolean) {
  v.group.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.visible = !on; });
}
export const toggleCockpit = () => { driving.cockpit = !driving.cockpit; if (driving.v) setSeeThrough(driving.v, driving.cockpit); };

// ---------- selling back to the dealer ----------
/** Own vehicles parked near the dealer's yard, with what Mirek would pay for each. */
export function vehiclesForSale(): { v: Vehicle; price: number; why: string | null }[] {
  return vehicles.filter((v) => v.claimed && Math.hypot(v.st.x - YARD.dealer.x, v.st.z - YARD.dealer.z) < 45).map((v) => ({
    v, price: resaleValue(v.st.model, v.st.parts, PART_PRICE.cannon ?? 0, PART_BUYBACK),
    why: v === driving.v ? 'You are sitting in it.' : v.st.trunk.items.some(Boolean) || v.st.trunk.gold > 0 ? 'Empty the trunk first.' : null,
  }));
}
export function sellVehicle(id: string): string {
  const offer = vehiclesForSale().find((o) => o.v.st.id === id);
  if (!offer) return 'Bring it to the yard first.';
  if (offer.why) return offer.why;
  const c = G.char;
  c.gold += offer.price;
  c.vehicles = c.vehicles.filter((s) => s.id !== id);
  dropVehicle(offer.v); vehicles.splice(vehicles.indexOf(offer.v), 1);
  saveChar();
  return `Sold the ${vehicleTitle(offer.v.st.model)} for ${offer.price} gold.`;
}

// ---------- vehicles driven by bandits ----------
/** A hostile vehicle: nobody's property until its crew is beaten (then it is an abandoned, claimable wreck). */
export function spawnAIVehicle(st: VehicleState): Vehicle {
  const v = makeVehicle(st, false); v.ai = true; tint(v, true); vehicles.push(v); return v;
}
/** Hostile vehicles are drawn amber while bandits hold them (materials swapped on the body batch only). */
const hostileLine = lineMat(0xffb347), keptMats = new WeakMap<THREE.Object3D, THREE.Material>();
function tint(v: Vehicle, hostile: boolean) {
  v.group.children[0].traverse((o) => {
    const l = o as THREE.LineSegments;
    if (!l.isLineSegments) return;
    if (hostile) { keptMats.set(l, l.material as THREE.Material); l.material = hostileLine; }
    else { const m = keptMats.get(l); if (m) l.material = m; }
  });
}
/** The raiders are beaten: the vehicle stays where it is, a claimable wreck. */
export function releaseAI(v: Vehicle) { v.ai = false; v.speed = 0; v.steer = 0; tint(v, false); refreshParts(v); pose(v); }
export function removeVehicle(v: Vehicle) { const i = vehicles.indexOf(v); if (i >= 0) { dropVehicle(v); vehicles.splice(i, 1); } }
/**
 * Drive an AI vehicle towards a point with the same physics limits as the player's: steering rate, acceleration,
 * obstacles, steep slopes. Returns false when it bumped into something this frame.
 */
export function steerVehicle(v: Vehicle, tx: number, tz: number, want: number, dt: number): boolean {
  const s = v.spec, dx = tx - v.st.x, dz = tz - v.st.z;
  // feelers: if the way towards the target is blocked a few metres ahead, fan out left and right for a clear line
  let aim = Math.atan2(dx, dz);
  if (want > 0) {
    const clear = (a: number) => [3, 7].every((d) => !hullBlocked(v, v.st.x + Math.sin(a) * d, v.st.z + Math.cos(a) * d, a));
    if (!clear(aim)) for (const o of [0.3, -0.3, 0.6, -0.6, 0.9, -0.9, 1.3, -1.3, 1.8, -1.8]) if (clear(aim + o)) { aim += o; break; }
  }
  let dh = aim - v.st.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
  const reverse = want < 0;
  // reversing: the rear points at the target, and the wheel turns the other way
  if (reverse) { dh = Math.atan2(Math.sin(dh - Math.PI), Math.cos(dh - Math.PI)); dh = -dh; }
  v.steer += (Math.max(-1, Math.min(1, dh * 1.6)) - v.steer) * Math.min(1, 5 * dt);
  const target = Math.abs(dh) > 1.4 && !reverse ? want * 0.5 : want;
  v.speed += Math.sign(target - v.speed) * Math.min(Math.abs(target - v.speed), s.accel * dt);
  v.speed -= 9.8 * Math.sin(v.pitch) * dt * 0.6;
  const turn = v.steer * s.turn * dt * Math.max(-1, Math.min(1, v.speed / 6));
  const nh = v.st.heading + turn, [fx, fz] = fwd(nh), nx = v.st.x + fx * v.speed * dt, nz = v.st.z + fz * v.speed * dt;
  const H = hooks!.height, ahead = H(nx + fx * s.length / 2, nz + fz * s.length / 2), behind = H(nx - fx * s.length / 2, nz - fz * s.length / 2);
  let ok = true;
  if (hullBlocked(v, nx, nz, nh) || (ahead - behind) / s.length * Math.sign(v.speed || 1) > 0.8) { v.speed = -v.speed * 0.25; ok = false; }
  else { v.st.x = nx; v.st.z = nz; v.st.heading = nh; }
  v.spin += v.speed / s.wheelR * dt;
  pose(v);
  return ok;
}
/** Point in world x/z from vehicle body coordinates. */
export const bodyToWorld = (v: Vehicle, lx: number, lz: number) => toWorld(v, lx, lz);

