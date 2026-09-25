// Bandits on wheels (raider vehicles) and roadside ambushes with a roadblock. Unsaved, like other enemies.
import * as THREE from 'three';
import { scene, V } from './render';
import { G, W } from '../game';
import { PropBatch } from './props';
import { foeRules } from './enemies';
import { rayWorld } from './player';
import { burst } from './fx';
import { dropCrystal } from './loot';
import { spawnBandit, alert, fireBolt, BANDIT, type Bandit } from './bandits';
import { spawnAIVehicle, releaseAI, removeVehicle, steerVehicle, bodyToWorld, driving, refreshParts, damageVehicle, seatRider, unseat, seatPoint, rayVehicle, type Vehicle } from './vehicles';
import { VEHICLES, SEATS, freshParts, wheelCount, hurtEngine, type VehicleModel } from '../data/vehicles';
import { RELIC_KEYS } from '../data/items';
import { putItems } from '../inventory';
import { clearSpot } from '../gen/vehicles';
import { nearestOnRoad } from '../gen/roads';
import { CHUNK } from '../gen/regions';
import type { Terrain } from '../gen/terrain';
import { gainXp, armoured } from '../character';
import { logLine, showToast } from '../ui/hud';
import { onKill } from './quests';
import { mayspawn } from './threat';

export interface RaiderEnv { terrain: Terrain; danger(x: number, z: number): number; forbidden(x: number, z: number): boolean }
let env: RaiderEnv | null = null;
export function setRaiderEnv(e: RaiderEnv | null) { env = e; }

// ---------- raider vehicles ----------
export interface Raider {
  kind: 'raider'; boss?: false;
  v: Vehicle; g: THREE.Group; p: THREE.Vector3; r: number;
  hp: number; maxHp: number; level: number;
  fireT: number; burst: number; orbit: number; ramT: number; plan: 'chase' | 'circle' | 'ram' | 'back' | 'unstuck'; planT: number;
  /** Hit points of whoever sits in each seat (0: empty or dead). Shots through the windows hit them (`rayRaider`). */
  crewHp: number[];
}
export const raiders: Raider[] = [];
let raidT = 25;

const gunSeat = (m: VehicleModel) => SEATS[m].findIndex((s) => s.gun);
function spawnRaider(model: VehicleModel, x: number, z: number, heading: number, level: number): Raider {
  const parts = freshParts(model); parts.gun = true;
  const v = spawnAIVehicle({ id: 'raider-' + Math.random().toString(36).slice(2, 8), model, x, z, heading, parts, trunk: { items: Array(VEHICLES[model].trunk).fill(null), gold: 0 } });
  const s = v.spec, crewHp = SEATS[model].map(() => 0);
  // a driver and a gunner; a Mastodon carries a third man beside the driver
  for (const i of [0, gunSeat(model), ...(model === 'mastodon' ? [1] : [])]) { seatRider(v, i, 'raider', BANDIT); crewHp[i] = Math.round(5 * (1 + level * 0.35)); }
  const g = new THREE.Group(); scene.add(g);
  const hp = Math.round((model === 'mastodon' ? 60 : 30) * (1 + level * 0.3));
  const r: Raider = { kind: 'raider', v, g, p: new THREE.Vector3(), r: Math.max(s.length, s.width) * 0.45, hp, maxHp: hp, level,
    fireT: 2, burst: 0, orbit: Math.random() < 0.5 ? 1 : -1, ramT: 0, plan: 'chase', planT: 0, crewHp };
  raiders.push(r);
  logLine('Engines behind you...');
  return r;
}
function spawnRaidersMaybe(dt: number) {
  if (!env || (raidT -= dt) > 0) return;
  raidT = 20;
  const lv = env.danger(G.pos.x, G.pos.z);
  if (lv < 3 || raiders.length >= (lv > 5 ? 2 : 1) || Math.random() > (driving.v ? 0.5 : 0.25) || !mayspawn(3, lv)) return;
  const back = driving.v ? driving.v.st.heading + Math.PI : G.yaw;   // G.yaw looks along -forward: + sin/cos is behind
  for (let i = 0; i < 8; i++) {
    const a = back + (Math.random() - 0.5) * 1.2, d = 95 + Math.random() * 30;
    const x = G.pos.x + Math.sin(a) * d, z = G.pos.z + Math.cos(a) * d, model: VehicleModel = Math.random() < 0.2 ? 'mastodon' : 'scout';
    if (env.forbidden(x, z) || !clearSpot(env.terrain, model, x, z, a + Math.PI)) continue;
    spawnRaider(model, x, z, a + Math.PI, lv);
    return;
  }
}
function driveRaider(r: Raider, dt: number) {
  const v = r.v, dx = G.pos.x - v.st.x, dz = G.pos.z - v.st.z, d = Math.hypot(dx, dz), safe = foeRules.playerSafe(), fast = v.spec.maxSpeed;
  r.planT -= dt; r.ramT -= dt; r.fireT -= dt;
  if (safe) r.plan = 'back';
  else if (r.plan === 'unstuck' && r.planT > 0) { /* keep backing out */ }
  else if (r.planT <= 0) {
    r.plan = d > 35 ? 'chase' : !driving.v && Math.random() < 0.35 ? 'ram' : 'circle';
    r.planT = r.plan === 'ram' ? 2.5 : 3 + Math.random() * 3;
    if (Math.random() < 0.3) r.orbit = -r.orbit;
  }
  let tx = G.pos.x, tz = G.pos.z, want = fast * 0.9;
  if (r.plan === 'circle') {
    const a = Math.atan2(-dx, -dz) + r.orbit * 0.9, R = 16;
    tx = G.pos.x + Math.sin(a) * R; tz = G.pos.z + Math.cos(a) * R; want = fast * 0.6;
  } else if (r.plan === 'back') { tx = v.st.x - dx; tz = v.st.z - dz; want = fast * 0.7; }
  else if (r.plan === 'ram') want = fast;
  else if (r.plan === 'unstuck') { // back away diagonally from whatever we hit
    const f = V(Math.sin(v.st.heading), 0, Math.cos(v.st.heading));
    tx = v.st.x - f.x * 10 + f.z * 6 * r.orbit; tz = v.st.z - f.z * 10 - f.x * 6 * r.orbit; want = -fast * 0.4;
  }
  if (!steerVehicle(v, tx, tz, want, dt) && r.plan !== 'unstuck') { r.plan = 'unstuck'; r.planT = 1.3; r.orbit = -r.orbit; }
  // body centre for weapons and the hit sphere
  r.p.set(v.st.x, v.y + v.spec.height * 0.5, v.st.z); r.g.position.copy(r.p);
  // the gunner swings the turret round and fires in bursts
  if (v.turret && r.crewHp[gunSeat(v.st.model)] > 0) {
    v.turret.rotation.y = Math.atan2(dx, dz) - v.st.heading;
    const muzzle = V(0, 0.18, 1.3); v.turret.localToWorld(muzzle);
    const to = V(G.pos.x, G.pos.y + 1.1, G.pos.z).sub(muzzle), dist = to.length();
    if (!safe && r.fireT <= 0 && dist < 50 && rayWorld(muzzle, to.clone().normalize(), dist) >= dist - 1) {
      if (r.burst <= 0) r.burst = 4;
      fireBolt(muzzle, 4 * (1 + r.level * 0.2)); r.burst--;
      r.fireT = r.burst > 0 ? 0.12 : 1.8 + Math.random() * 1.2;
    }
  }
  // ramming someone on foot (or another vehicle)
  if (!safe && d < v.spec.length * 0.55 + 0.6 && Math.abs(v.speed) > 5 && r.ramT <= 0) {
    r.ramT = 1.5;
    if (driving.v) {
      const p = driving.v.st.parts, k = (Math.random() * p.wheels.length) | 0;
      if (p.wheels[k] > 0) p.wheels[k] = Math.max(0, p.wheels[k] - 12); hurtEngine(p, 6); refreshParts(driving.v);
      logLine('Rammed!');
      damageVehicle(driving.v, 20 * (1 + r.level * 0.2));
    } else {
      G.hp -= armoured(16 * (1 + r.level * 0.2)); G.dmgFlash = 0.5;
      const [fx, fz] = [Math.sin(v.st.heading), Math.cos(v.st.heading)];
      G.vel.x += fx * 12; G.vel.z += fz * 12; G.vel.y = 6; G.onGround = false;
    }
  }
}
/** Shot to pieces: the crew bails out and fights on foot; the vehicle is left behind as a claimable wreck. */
function wreckRaider(r: Raider) {
  const v = r.v;
  burst(r.p, BANDIT, 50, 2.5);
  showToast('Raider vehicle disabled!');
  bailOut(r);
  // what is left: a battered engine, a wrecked wheel or two, maybe still the gun; some loot in the back
  const p = v.st.parts;
  p.engine = 5 + Math.floor(Math.random() * 25);
  for (let i = 0; i < wheelCount(v.st.model); i++) if (Math.random() < 0.3) p.wheels[i] = 0; else p.wheels[i] = 30 + Math.floor(Math.random() * 50);
  p.gun = Math.random() < 0.5;
  p.hull = Math.round(v.spec.hull * (0.15 + Math.random() * 0.3)); p.fuel = Math.round(v.spec.tank * (0.2 + Math.random() * 0.5));
  const t = v.st.trunk; t.gold = 20 + Math.floor(Math.random() * 60);
  if (Math.random() < 0.5) putItems(t.items, 'medkit', 1);
  putItems(t.items, 'scrap', 2 + Math.floor(Math.random() * 3));
  if (Math.random() < 0.3) putItems(t.items, 'wheelL', 1);
  if (Math.random() < 0.15) putItems(t.items, RELIC_KEYS[(Math.random() * RELIC_KEYS.length) | 0], 1);
  releaseAI(v);
  for (let i = 0; i < 4; i++) dropCrystal(r.p);
  gainXp(30);
  onKill('bandit');
  scene.remove(r.g); raiders.splice(raiders.indexOf(r), 1);
}
/** Whoever is still alive in the vehicle jumps out and fights on foot. */
function bailOut(r: Raider) {
  const v = r.v, group: Bandit[] = [];
  let n = 0;
  r.crewHp.forEach((hp, i) => {
    unseat(v, i);
    if (hp <= 0) return;
    const [x, z] = bodyToWorld(v, (n % 2 ? 1 : -1) * (v.spec.width / 2 + 1.2), -n);
    const b = spawnBandit(n === 1 ? 'bruiser' : 'gunner', V(x, env ? env.terrain.heightAt(x, z) + 0.9 : r.p.y, z), r.level, group);
    b.sight = 60; alert(b); n++;
  });
  r.crewHp.fill(0);
}
/** Where a shot from o along d meets this raider: its body (seat -1) or one of the crew through a window. */
export const rayRaider = (r: Raider, o: THREE.Vector3, d: THREE.Vector3, max: number) => rayVehicle(r.v, o, d, max);
/**
 * A shot hit one of the crew. A dead gunner leaves the cannon silent; a dead driver lets the vehicle roll to a stop
 * and the rest of the crew bail out: the vehicle is left whole (with the damage it had) for you to claim.
 */
export function hurtCrew(r: Raider, seat: number, dmg: number) {
  if (r.crewHp[seat] <= 0) { hurtRaider(r, dmg); return; }
  const at = seatPoint(r.v, seat);
  r.crewHp[seat] -= dmg; G.hitFlash = 0.15;
  burst(at, BANDIT, 8, 0.5);
  if (r.plan === 'back' || r.plan === 'chase') { r.plan = 'circle'; r.planT = 2; }
  if (r.crewHp[seat] > 0) return;
  r.crewHp[seat] = 0; unseat(r.v, seat);
  burst(at, BANDIT, 24, 0.9); dropCrystal(at); gainXp(8); onKill('bandit');
  if (seat === 0 || r.crewHp.every((h) => h <= 0)) abandonRaider(r);
  else logLine('The gunner is down.');
}
/** The driver is dead: the others bail out, and the vehicle is yours to take, barely scratched. */
function abandonRaider(r: Raider) {
  showToast(r.crewHp.some((h) => h > 0) ? 'Driver down! The crew bails out.' : 'The crew is dead.');
  bailOut(r);
  const t = r.v.st.trunk; t.gold = 10 + Math.floor(Math.random() * 40);
  putItems(t.items, 'scrap', 1 + Math.floor(Math.random() * 3));
  if (Math.random() < 0.4) putItems(t.items, 'medkit', 1);
  releaseAI(r.v); gainXp(15);
  scene.remove(r.g); raiders.splice(raiders.indexOf(r), 1);
}
export function hurtRaider(r: Raider, dmg: number) {
  r.hp -= dmg; G.hitFlash = 0.15;
  burst(r.p.clone().add(V(0, 0.5, 0)), BANDIT, 6, 0.6);
  if (r.plan === 'back' || r.plan === 'chase') { r.plan = 'circle'; r.planT = 2; }
  if (r.hp <= 0) wreckRaider(r);
}
function dropRaider(r: Raider) {
  removeVehicle(r.v); scene.remove(r.g);
  const i = raiders.indexOf(r); if (i >= 0) raiders.splice(i, 1);
}

// ---------- roadside ambushes ----------
/**
 * A roadblock is a few barricades across the road (crates, a spiked frame, a tyre), each solid and each with
 * hit points: shots from your Blaster or a vehicle cannon wear it down (`rayBarrier`, `hurtBarrier`), and once it
 * is shot to pieces the way is open. It stays when its bandits are dead; it goes when you are far away.
 */
export interface Barricade { x: number; y: number; z: number; r: number; hp: number; max: number; g: THREE.Group }
interface Ambush { id: number; pieces: Barricade[]; x: number; z: number; sprung: boolean; done?: boolean }
const ambushes: Ambush[] = [];
/** Hit points of one barricade (a Blaster shot does about 1, a vehicle cannon shell 3). */
export const BARRICADE_HP = 14;
const WOOD = 0xb8b060, SPIKE = 0xffb347;
function barricadeModel(x: number, y: number, z: number, dir: THREE.Vector3, side: THREE.Vector3, big: boolean): THREE.Group {
  const pb = new PropBatch(), P = (u: number, v: number, h: number) => [x + side.x * u + dir.x * v, y + h, z + side.z * u + dir.z * v];
  const crate = (u: number, v: number, h: number, s: number) => pb.solid8([P(u - s, v - s, h), P(u + s, v - s, h), P(u + s, v + s, h), P(u - s, v + s, h)], [P(u - s, v - s, h + s * 1.7), P(u + s, v - s, h + s * 1.7), P(u + s, v + s, h + s * 1.7), P(u - s, v + s, h + s * 1.7)], WOOD);
  crate(-0.3, 0, -0.1, 0.55); crate(0.35, 0.1, -0.1, 0.45);
  if (big) crate(0, 0.05, 0.85, 0.42);
  // a spiked frame leaning against the crates, points towards the road
  for (const [a, b] of [[[-0.9, -0.9, 0], [0.9, -0.6, 1.3]], [[0.9, -0.9, 0], [-0.9, -0.6, 1.3]], [[0, -1.2, 0.1], [0, -0.4, 1.6]]] as number[][][])
    pb.solid8([P(a[0] - 0.06, a[1], a[2]), P(a[0] + 0.06, a[1], a[2]), P(a[0] + 0.06, a[1] + 0.1, a[2]), P(a[0] - 0.06, a[1] + 0.1, a[2])],
      [P(b[0] - 0.06, b[1], b[2]), P(b[0] + 0.06, b[1], b[2]), P(b[0] + 0.06, b[1] + 0.1, b[2]), P(b[0] - 0.06, b[1] + 0.1, b[2])], SPIKE);
  return pb.build();
}
/** Put a roadblock across the road at (bx, bz), `dir` along the road; returns its id. */
export function placeRoadblock(T: Terrain, bx: number, bz: number, dir: THREE.Vector3): number {
  const side = V(-dir.z, 0, dir.x), pieces: Barricade[] = [], id = ++ambushId;
  for (const k of [-2.3, 0, 2.3]) {
    const ox = bx + side.x * k, oz = bz + side.z * k, oy = T.heightAt(ox, oz), g = barricadeModel(ox, oy, oz, dir, side, k === 0);
    scene.add(g);
    pieces.push({ x: ox, y: oy, z: oz, r: 1.0, hp: BARRICADE_HP, max: BARRICADE_HP, g });
  }
  ambushes.push({ id, pieces, x: bx, z: bz, sprung: false });
  return id;
}
/** The nearest barricade a shot from o along d meets within `max`, and how far. */
export function rayBarrier(o: THREE.Vector3, d: THREE.Vector3, max: number): { t: number; p: Barricade } | null {
  let best: { t: number; p: Barricade } | null = null;
  for (const a of ambushes) for (const p of a.pieces) {
    const cx = p.x, cy = p.y + 0.7, cz = p.z, ox = o.x - cx, oy = o.y - cy, oz = o.z - cz;
    const b = ox * d.x + oy * d.y + oz * d.z, c = ox * ox + oy * oy + oz * oz - p.r * p.r, disc = b * b - c;
    if (disc < 0) continue;
    const t = -b - Math.sqrt(disc);
    if (t > 0 && t < max && (!best || t < best.t)) best = { t, p };
  }
  return best;
}
/** Damage a barricade; shot to pieces it falls apart and the road opens there. */
export function hurtBarrier(p: Barricade, dmg: number) {
  p.hp -= dmg;
  burst(V(p.x, p.y + 0.8, p.z), 0xb8b060, 6, 0.6);
  if (p.hp > 0) return;
  burst(V(p.x, p.y + 0.8, p.z), 0xffb347, 26, 1.6);
  scene.remove(p.g); p.g.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
  for (const a of ambushes) { const i = a.pieces.indexOf(p); if (i >= 0) { a.pieces.splice(i, 1); if (!a.pieces.length) logLine('The roadblock is down.'); } }
}
/** Barricades still standing within r of (x, z) (a caravan waits for the road to be clear). */
export const barriersNear = (x: number, z: number, r: number) => ambushes.flatMap((a) => a.pieces).filter((p) => Math.hypot(p.x - x, p.z - z) < r);
let ambushT = 30, ambushId = 0, lastAmbushAt = -1e9;
/** Roadblocks stop the player and vehicles like trees do. */
export function ambushHit(x: number, _y: number, z: number, r: number): boolean {
  for (const a of ambushes) for (const o of a.pieces) if (Math.hypot(o.x - x, o.z - z) < o.r + r) return true;
  return false;
}
/** On (or right by) a road here? (Checked before the pacing, so an ambush does not use up an encounter off-road.) */
const nearRoadHere = (T: Terrain, px: number, pz: number) => T.chunkFeatures(Math.floor(px / CHUNK), Math.floor(pz / CHUNK)).roads.some((rd) => !rd.h && nearestOnRoad(rd, px, pz)[0] < 8);
function tryAmbush(dt: number, force = false) {
  if (!env || (!force && (ambushT -= dt) > 0)) return false;
  ambushT = 4;
  const T = env.terrain, px = G.pos.x, pz = G.pos.z;
  if (!force && (env.danger(px, pz) < 2.5 || ambushes.length || performance.now() - lastAmbushAt < 150000 || Math.random() > 0.2)) return false;
  if (!force && !nearRoadHere(T, px, pz)) return false;
  if (!force && !mayspawn(3, env.danger(px, pz))) return false;
  const f = T.chunkFeatures(Math.floor(px / CHUNK), Math.floor(pz / CHUNK));
  const road = f.roads.find((rd) => !rd.h && nearestOnRoad(rd, px, pz)[0] < 8); // real roads, not mountain trails
  if (!road) return false;
  // which way along the road is the player heading?
  const mv = driving.v ? V(Math.sin(driving.v.st.heading), 0, Math.cos(driving.v.st.heading)) : V(G.vel.x, 0, G.vel.z);
  if (mv.length() < 0.5) mv.set(-Math.sin(G.yaw), 0, -Math.cos(G.yaw));
  mv.normalize();
  const [, cx, cz] = nearestOnRoad(road, px, pz);
  // walk 45 m along the road in that direction by sampling points on it
  let bx = cx, bz = cz;
  for (let s = 5; s <= 45; s += 5) {
    const [, qx, qz] = nearestOnRoad(road, cx + mv.x * s, cz + mv.z * s);
    bx = qx; bz = qz;
  }
  if (Math.hypot(bx - px, bz - pz) < 25 || env.forbidden(bx, bz)) return false;
  // the road's direction at the block, and across it
  const [, ax, az] = nearestOnRoad(road, bx + mv.x * 3, bz + mv.z * 3), dir = V(ax - bx, 0, az - bz).normalize(), side = V(-dir.z, 0, dir.x);
  const id = placeRoadblock(T, bx, bz, dir);
  const lv = env.danger(bx, bz), group: Bandit[] = [], n = 3 + (Math.random() < 0.5 ? 1 : 0) + (lv > 2 ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const s = (i % 2 ? 1 : -1) * (9 + Math.random() * 5), back = -4 + Math.random() * 12;
    const x = bx + side.x * s + dir.x * back, z = bz + side.z * s + dir.z * back;
    const b = spawnBandit(i === 0 && Math.random() < 0.5 ? 'bruiser' : 'gunner', V(x, T.heightAt(x, z) + 0.9, z), lv, group);
    b.sight = 18; b.ambush = id; b.heading = Math.atan2(bx - x, bz - z);
  }
  lastAmbushAt = performance.now();
  return true;
}
function updateAmbushes() {
  for (let i = ambushes.length - 1; i >= 0; i--) {
    const a = ambushes[i], left = W.bandits.filter((b) => b.ambush === a.id);
    if (!a.sprung && left.some((b) => b.state === 'fight')) { a.sprung = true; showToast('Ambush!'); }
    if (a.sprung && !left.length && !a.done) { a.done = true; logLine(a.pieces.length ? 'The ambush is broken. The roadblock still stands: shoot it apart or go round.' : 'The ambush is broken.'); }
    // the barricades stay until they are shot apart, or until you are far away
    if (!a.pieces.length || Math.hypot(a.x - G.pos.x, a.z - G.pos.z) > 230) {
      for (const p of a.pieces) { scene.remove(p.g); p.g.traverse((o) => (o as THREE.Mesh).geometry?.dispose()); }
      ambushes.splice(i, 1);
    }
  }
}

// ---------- per frame ----------
export function updateRaiders(dt: number) {
  if (!env) return;
  spawnRaidersMaybe(dt); tryAmbush(dt); updateAmbushes();
  for (const r of [...raiders]) {
    if (Math.hypot(r.v.st.x - G.pos.x, r.v.st.z - G.pos.z) > 260) { dropRaider(r); continue; }
    driveRaider(r, dt);
  }
}
export function clearRaiders() {
  for (const r of [...raiders]) dropRaider(r);
  for (const a of ambushes) for (const p of a.pieces) scene.remove(p.g);
  ambushes.length = 0;
}
/** Console / testing. */
export function spawnRaiderNear(model: VehicleModel = 'scout') {
  if (!env) return false;
  for (let i = 0; i < 16; i++) {
    const a = G.yaw + (i % 2 ? 1 : -1) * i * 0.25, x = G.pos.x + Math.sin(a) * 60, z = G.pos.z + Math.cos(a) * 60;
    if (env.forbidden(x, z) || !clearSpot(env.terrain, model, x, z, a + Math.PI)) continue;
    spawnRaider(model, x, z, a + Math.PI, env.danger(x, z));
    return true;
  }
  return false;
}
/** Console / testing: set up an ambush ahead on the road you are on. */
export const forceAmbush = () => tryAmbush(0, true);
