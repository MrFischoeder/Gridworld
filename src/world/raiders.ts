// Bandits on wheels (raider vehicles) and roadside ambushes with a roadblock. Unsaved, like other enemies.
import * as THREE from 'three';
import { scene, V } from './render';
import { G, W } from '../game';
import { makeFigure } from './npc';
import { PropBatch } from './props';
import { foeRules } from './enemies';
import { rayWorld } from './player';
import { burst } from './fx';
import { dropCrystal } from './loot';
import { spawnBandit, alert, fireBolt, BANDIT, type Bandit } from './bandits';
import { spawnAIVehicle, releaseAI, removeVehicle, steerVehicle, bodyToWorld, driving, refreshParts, damageVehicle, type Vehicle } from './vehicles';
import { VEHICLES, freshParts, wheelCount, hurtEngine, type VehicleModel } from '../data/vehicles';
import { RELIC_KEYS } from '../data/items';
import { putItems } from '../inventory';
import { clearSpot } from '../gen/vehicles';
import { nearestOnRoad } from '../gen/roads';
import { CHUNK } from '../gen/regions';
import type { Terrain } from '../gen/terrain';
import { gainXp } from '../character';
import { logLine, showToast } from '../ui/hud';
import { onKill } from './quests';

export interface RaiderEnv { terrain: Terrain; danger(x: number, z: number): number; forbidden(x: number, z: number): boolean }
let env: RaiderEnv | null = null;
export function setRaiderEnv(e: RaiderEnv | null) { env = e; }

// ---------- raider vehicles ----------
export interface Raider {
  kind: 'raider'; boss?: false;
  v: Vehicle; g: THREE.Group; p: THREE.Vector3; r: number;
  hp: number; maxHp: number; level: number;
  fireT: number; burst: number; orbit: number; ramT: number; plan: 'chase' | 'circle' | 'ram' | 'back' | 'unstuck'; planT: number;
  crew: THREE.Group[];
}
export const raiders: Raider[] = [];
let raidT = 25;

function crewFigure(v: Vehicle, x: number, y: number, z: number, standing: boolean) {
  const f = makeFigure(BANDIT);
  v.group.add(f.g); f.g.position.set(x, y - (standing ? 0 : 0.55), z);
  if (!standing) { f.legL.rotation.x = f.legR.rotation.x = -1.4; }
  f.armR.rotation.x = f.armL.rotation.x = standing ? -1.2 : -0.9;
  return f.g;
}
function spawnRaider(model: VehicleModel, x: number, z: number, heading: number, level: number): Raider {
  const parts = freshParts(model); parts.gun = true;
  const v = spawnAIVehicle({ id: 'raider-' + Math.random().toString(36).slice(2, 8), model, x, z, heading, parts, trunk: { items: Array(VEHICLES[model].trunk).fill(null), gold: 0 } });
  const s = v.spec, crew = [crewFigure(v, s.eye[0], s.eye[1] - 1.55, s.eye[2], false), crewFigure(v, s.mount[0], s.mount[1], s.mount[2] - 0.7, true)];
  const g = new THREE.Group(); scene.add(g);
  const hp = Math.round((model === 'mastodon' ? 60 : 30) * (1 + level * 0.3));
  const r: Raider = { kind: 'raider', v, g, p: new THREE.Vector3(), r: Math.max(s.length, s.width) * 0.45, hp, maxHp: hp, level,
    fireT: 2, burst: 0, orbit: Math.random() < 0.5 ? 1 : -1, ramT: 0, plan: 'chase', planT: 0, crew };
  raiders.push(r);
  logLine('Engines behind you...');
  return r;
}
function spawnRaidersMaybe(dt: number) {
  if (!env || (raidT -= dt) > 0) return;
  raidT = 20;
  const lv = env.danger(G.pos.x, G.pos.z);
  if (lv < 3 || raiders.length >= (lv > 5 ? 2 : 1) || Math.random() > (driving.v ? 0.5 : 0.25)) return;
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
  if (v.turret) {
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
      G.hp -= 16 * (1 + r.level * 0.2); G.dmgFlash = 0.5;
      const [fx, fz] = [Math.sin(v.st.heading), Math.cos(v.st.heading)];
      G.vel.x += fx * 12; G.vel.z += fz * 12; G.vel.y = 6; G.onGround = false;
    }
  }
}
/** Shot to pieces: the crew bails out and fights on foot; the vehicle is left behind as a claimable wreck. */
function wreckRaider(r: Raider) {
  const v = r.v, group: Bandit[] = [];
  burst(r.p, BANDIT, 50, 2.5);
  showToast('Raider vehicle disabled!');
  for (const c of r.crew) v.group.remove(c);
  const lv = r.level;
  for (let i = 0; i < (v.st.model === 'mastodon' ? 3 : 2); i++) {
    const [x, z] = bodyToWorld(v, (i % 2 ? 1 : -1) * (v.spec.width / 2 + 1.2), -i);
    const b = spawnBandit(i === 1 ? 'bruiser' : 'gunner', V(x, env ? env.terrain.heightAt(x, z) + 0.9 : r.p.y, z), lv, group);
    b.sight = 60; alert(b);
  }
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
interface Ambush { id: number; block: THREE.Group; obstacles: { x: number; z: number; r: number }[]; x: number; z: number; sprung: boolean }
const ambushes: Ambush[] = [];
let ambushT = 30, ambushId = 0, lastAmbushAt = -1e9;
/** Roadblocks stop the player and vehicles like trees do. */
export function ambushHit(x: number, _y: number, z: number, r: number): boolean {
  for (const a of ambushes) for (const o of a.obstacles) if (Math.hypot(o.x - x, o.z - z) < o.r + r) return true;
  return false;
}
function tryAmbush(dt: number, force = false) {
  if (!env || (!force && (ambushT -= dt) > 0)) return false;
  ambushT = 4;
  const T = env.terrain, px = G.pos.x, pz = G.pos.z;
  if (!force && (env.danger(px, pz) < 2.5 || ambushes.length || performance.now() - lastAmbushAt < 150000 || Math.random() > 0.2)) return false;
  const f = T.chunkFeatures(Math.floor(px / CHUNK), Math.floor(pz / CHUNK));
  const road = f.roads.find((rd) => nearestOnRoad(rd, px, pz)[0] < 8);
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
  const y = T.heightAt(bx, bz), pb = new PropBatch(), obstacles: Ambush['obstacles'] = [];
  for (const k of [-2.2, 0, 2.2]) {
    const ox = bx + side.x * k, oz = bz + side.z * k, oy = T.heightAt(ox, oz);
    pb.box(ox - 0.6, oy - 0.1, oz - 0.6, ox + 0.6, oy + (k === 0 ? 1.4 : 1.0), oz + 0.6, 0xb8b060);
    obstacles.push({ x: ox, z: oz, r: 0.9 });
  }
  // a spiked log across the whole road
  pb.line(0xb8b060, [bx - side.x * 3.4, y + 0.5, bz - side.z * 3.4], [bx + side.x * 3.4, y + 0.5, bz + side.z * 3.4]);
  const block = pb.build(); scene.add(block);
  const lv = env.danger(bx, bz), group: Bandit[] = [], id = ++ambushId, n = 3 + (Math.random() < 0.5 ? 1 : 0) + (lv > 2 ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const s = (i % 2 ? 1 : -1) * (9 + Math.random() * 5), back = -4 + Math.random() * 12;
    const x = bx + side.x * s + dir.x * back, z = bz + side.z * s + dir.z * back;
    const b = spawnBandit(i === 0 && Math.random() < 0.5 ? 'bruiser' : 'gunner', V(x, T.heightAt(x, z) + 0.9, z), lv, group);
    b.sight = 18; b.ambush = id; b.heading = Math.atan2(bx - x, bz - z);
  }
  ambushes.push({ id, block, obstacles, x: bx, z: bz, sprung: false });
  lastAmbushAt = performance.now();
  return true;
}
function updateAmbushes() {
  for (let i = ambushes.length - 1; i >= 0; i--) {
    const a = ambushes[i], left = W.bandits.filter((b) => b.ambush === a.id);
    if (!a.sprung && left.some((b) => b.state === 'fight')) { a.sprung = true; showToast('Ambush!'); }
    if (!left.length || Math.hypot(a.x - G.pos.x, a.z - G.pos.z) > 230) {
      if (!left.length && a.sprung) logLine('The ambush is broken.');
      scene.remove(a.block); a.block.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
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
  for (const a of ambushes) scene.remove(a.block);
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
