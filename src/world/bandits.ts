// Bandits: human enemies with guns and blades. They live in camps and patrol the wilds.
// Unsaved (like drones and creatures) except that a cleared camp stays empty for a while (char.camps).
import * as THREE from 'three';
import { scene, V, add as addMat, fillMat } from './render';
import { G, W } from '../game';
import { makeFigure, textSprite, type Figure } from './npc';
import { foeRules } from './enemies';
import { rayWorld, emptyAt } from './player';
import { burst } from './fx';
import { dropCrystal, dropPickup } from './loot';
import { saveChar, gainXp } from '../character';
import { logLine, showToast } from '../ui/hud';
import { onKill, onCampCleared } from './quests';
import { driving, refreshParts as refreshPartsOf } from './vehicles';
import type { SpawnEnv } from './creatures';
import type { BanditRole, CampMap } from '../gen/camps';

export const BANDIT = 0xffb347, BOSS_COLOR = 0xff6a4a;
/** How long a cleared camp stays empty (real time). */
export const CAMP_RESPAWN_MS = 30 * 60 * 1000;

export interface Bandit {
  kind: 'bandit'; boss?: false; role: BanditRole;
  g: THREE.Group; fig: Figure; mat: THREE.LineBasicMaterial;
  p: THREE.Vector3; heading: number; speed: number; r: number;
  hp: number; maxHp: number; flash: number;
  state: 'idle' | 'fight' | 'flee' | 'return'; timer: number; fireT: number; burst: number; strafe: number; hitT: number;
  home: THREE.Vector3; campId?: number; group: Bandit[]; level: number; fled: boolean;
}
interface Bolt { m: THREE.Line; p: THREE.Vector3; v: THREE.Vector3; dmg: number; life: number }
const bolts: Bolt[] = [];
let env: SpawnEnv | null = null, patrolT = 10;
export function setBanditEnv(e: SpawnEnv | null) { env = e; }

// ---------- model ----------
const gunGeo = new THREE.BoxGeometry(0.06, 0.08, 0.7), bladeGeo = new THREE.BoxGeometry(0.03, 0.06, 0.75), gunFill = fillMat();
function armed(fig: Figure, role: BanditRole, mat: THREE.LineBasicMaterial) {
  const w = new THREE.Group(), geo = role === 'bruiser' ? bladeGeo : gunGeo;
  w.add(new THREE.Mesh(geo, gunFill), new THREE.LineSegments(new THREE.EdgesGeometry(geo), mat));
  w.position.set(0, -0.5, 0.25);
  fig.armR.add(w);
  fig.armR.rotation.x = role === 'bruiser' ? -0.4 : -1.35;
  fig.armL.rotation.x = role === 'bruiser' ? 0 : -1.1;
}
function make(role: BanditRole, at: THREE.Vector3, level: number, group: Bandit[], campId?: number): Bandit {
  const color = role === 'leader' ? BOSS_COLOR : BANDIT, fig = makeFigure(color), mat = (fig.legL as THREE.Line).material as THREE.LineBasicMaterial;
  const g = new THREE.Group();
  g.add(fig.g); fig.g.position.y = -0.9;
  armed(fig, role, mat);
  if (role === 'leader') {
    fig.g.scale.setScalar(1.15);
    const tag = textSprite('Bandit Boss', '#ff6a4a', 2.2); tag.position.y = 1.55; g.add(tag);
  }
  scene.add(g);
  const hp = Math.round((role === 'leader' ? 16 : role === 'bruiser' ? 6 : 4) * (1 + level * 0.35));
  const b: Bandit = {
    kind: 'bandit', role, g, fig, mat, p: at.clone(), heading: Math.random() * 6.28, speed: 0, r: 0.55,
    hp, maxHp: hp, flash: 0, state: 'idle', timer: Math.random() * 3, fireT: 1 + Math.random(), burst: 0, strafe: Math.random() < 0.5 ? 1 : -1, hitT: 0,
    home: at.clone(), campId, group, level, fled: false,
  };
  group.push(b); W.bandits.push(b);
  return b;
}

// ---------- camps ----------
const campClearedRecently = (id: number) => { const t = G.char.camps[id]; return !!t && Date.now() - t < CAMP_RESPAWN_MS; };
export function spawnCamp(c: CampMap) {
  if (!env || campClearedRecently(c.id) || W.bandits.some((b) => b.campId === c.id)) return;
  const lv = env.danger(c.fire.x, c.fire.z), group: Bandit[] = [];
  for (const s of c.spawns) make(s.role, V(s.x, c.y + 0.9, s.z), lv, group, c.id);
}
export function despawnCamp(id: number) { for (const b of [...W.bandits]) if (b.campId === id) removeBandit(b); }
export const campAlive = (id: number) => W.bandits.some((b) => b.campId === id);

// ---------- behaviour ----------
function blocked(b: Bandit, x: number, z: number) {
  if (!env || foeRules.blocked(V(x, b.p.y, z))) return true;
  const gy = env.ground(x, z);
  const ground = Number.isFinite(gy) ? gy : b.p.y - 0.9;
  return !G.space.empty(Math.floor(x), Math.floor(ground + 0.3), Math.floor(z)) || !G.space.empty(Math.floor(x), Math.floor(ground + 1.2), Math.floor(z));
}
function walk(b: Bandit, dx: number, dz: number, speed: number, dt: number) {
  const L = Math.hypot(dx, dz);
  b.speed = 0;
  if (L < 1e-3 || !env) return;
  const sx = dx / L * speed * dt, sz = dz / L * speed * dt;
  if (!blocked(b, b.p.x + sx, b.p.z + sz)) { b.p.x += sx; b.p.z += sz; }
  else if (!blocked(b, b.p.x + sx, b.p.z)) b.p.x += sx;
  else if (!blocked(b, b.p.x, b.p.z + sz)) b.p.z += sz;
  else { b.strafe = -b.strafe; return; }
  b.speed = speed;
  // stand on the terrain, or on a structure floor (camps have their own voxel floor at the pad height)
  const gy = env.ground(b.p.x, b.p.z);
  if (Number.isFinite(gy)) b.p.y = gy + 0.9;
}
function face(b: Bandit, dx: number, dz: number, dt: number) {
  let dh = Math.atan2(dx, dz) - b.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); b.heading += dh * Math.min(1, dt * 8);
}
function alert(b: Bandit) {
  for (const m of b.group) if (m.state === 'idle' || m.state === 'return') { m.state = 'fight'; m.timer = 0; }
}
function fire(b: Bandit) {
  const muzzle = V(b.p.x + Math.sin(b.heading) * 0.5, b.p.y + 0.45, b.p.z + Math.cos(b.heading) * 0.5);
  const target = V(G.pos.x, G.pos.y + 1.1, G.pos.z), dist = target.distanceTo(muzzle);
  const spread = 0.035 * dist + Math.hypot(G.vel.x, G.vel.z) * 0.1;
  target.x += (Math.random() - 0.5) * spread; target.y += (Math.random() - 0.5) * spread * 0.5; target.z += (Math.random() - 0.5) * spread;
  const v = target.sub(muzzle).normalize().multiplyScalar(30);
  const m = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(0, 0, 0), v.clone().normalize().multiplyScalar(-0.9)]), addMat(b.role === 'leader' ? BOSS_COLOR : BANDIT));
  m.position.copy(muzzle); scene.add(m);
  bolts.push({ m, p: muzzle, v, dmg: (b.role === 'leader' ? 9 : 5) * (1 + b.level * 0.2), life: 3 });
}
let vehicleWarnT = 0;
function updateBolts(dt: number) {
  vehicleWarnT -= dt;
  const body0 = V(G.pos.x, G.pos.y + 0.3, G.pos.z), body1 = V(G.pos.x, G.pos.y + 1.6, G.pos.z);
  for (let i = bolts.length - 1; i >= 0; i--) {
    const o = bolts[i]; o.life -= dt;
    o.p.addScaledVector(o.v, dt); o.m.position.copy(o.p);
    let dead = o.life <= 0 || !emptyAt(o.p);
    // distance from the bolt to the player's body (a vertical segment)
    const cy = Math.max(body0.y, Math.min(body1.y, o.p.y)), hitD = Math.hypot(o.p.x - G.pos.x, o.p.y - cy, o.p.z - G.pos.z);
    const v = driving.v, hitR = v ? Math.max(v.spec.width, v.spec.height) * 0.6 : 0.45;
    if (!dead && hitD < hitR && !foeRules.playerSafe()) {
      dead = true;
      if (v && v.spec.enclosed) { // the cab stops the bolt; the truck takes the damage
        const p = v.st.parts;
        if (Math.random() < 0.5) p.engine = Math.max(0, p.engine - 3);
        else { const k = (Math.random() * p.wheels.length) | 0; if (p.wheels[k] > 0) p.wheels[k] = Math.max(0, p.wheels[k] - 4); }
        refreshPartsOf(v);
        if (vehicleWarnT <= 0) { logLine('Your vehicle is taking fire!'); vehicleWarnT = 4; }
      } else { G.hp -= o.dmg; G.dmgFlash = 0.35; }
    }
    if (dead) { burst(o.p, BANDIT, 6, 0.35); scene.remove(o.m); o.m.geometry.dispose(); bolts.splice(i, 1); }
  }
}

function think(b: Bandit, dt: number, time: number) {
  const to = V(G.pos.x - b.p.x, G.pos.y + 1.1 - b.p.y, G.pos.z - b.p.z), dist = to.length(), safe = foeRules.playerSafe();
  const sees = () => rayWorld(b.p, to.clone().normalize(), dist) >= dist - 0.4;
  b.timer -= dt; b.fireT -= dt; b.hitT -= dt;
  if (b.state !== 'return' && (safe || dist > 75)) { b.state = 'return'; }
  switch (b.state) {
    case 'idle':
      b.speed = 0; b.heading += Math.sin(time * 0.4 + b.home.x) * dt * 0.4;
      if (!safe && dist < 34 && sees()) alert(b);
      break;
    case 'return': {
      const h = b.home.clone().sub(b.p); h.y = 0;
      if (h.length() > 1) { walk(b, h.x, h.z, 3, dt); face(b, h.x, h.z, dt); } else b.state = 'idle';
      if (!safe && dist < 25 && sees()) alert(b);
      break;
    }
    case 'flee':
      walk(b, -to.x, -to.z, 5.5, dt); face(b, -to.x, -to.z, dt);
      if (b.timer <= 0) b.state = 'fight';
      break;
    case 'fight': {
      face(b, to.x, to.z, dt);
      if (b.role === 'bruiser') {
        if (dist > 1.5) walk(b, to.x, to.z, 6.2, dt);
        if (dist < 1.8 && b.hitT <= 0) {
          b.hitT = 0.9;
          if (!(driving.v && driving.v.spec.enclosed)) { G.hp -= 10 * (1 + b.level * 0.2); G.dmgFlash = 0.35; }
        }
        break;
      }
      const want = b.role === 'leader' ? 12 : 15;
      if (b.timer <= 0) { b.strafe = Math.random() < 0.5 ? 1 : -1; b.timer = 1.5 + Math.random() * 1.5; }
      const side = V(-to.z, 0, to.x).normalize().multiplyScalar(b.strafe);
      if (dist > want + 7) walk(b, to.x, to.z, 4.2, dt);
      else if (dist < want - 5) walk(b, -to.x + side.x, -to.z + side.z, 3.6, dt);
      else walk(b, side.x, side.z, 2.6, dt);
      if (b.fireT <= 0 && dist < 45 && sees()) {
        if (b.burst <= 0) b.burst = b.role === 'leader' ? 4 : 3;
        fire(b); b.burst--;
        b.fireT = b.burst > 0 ? 0.13 : (b.role === 'leader' ? 1.1 : 1.8) + Math.random();
      }
      break;
    }
  }
}
function animate(b: Bandit, dt: number) {
  b.g.position.copy(b.p); b.g.rotation.y = b.heading;
  const f = b.fig, ph = performance.now() / 1000 * (4 + b.speed * 1.2), sw = b.speed > 0.2 ? Math.sin(ph) * 0.55 : 0;
  f.legL.rotation.x = sw; f.legR.rotation.x = -sw;
  if (b.role === 'bruiser') { f.armR.rotation.x = b.hitT > 0.6 ? -1.9 : -0.4 + sw * 0.4; f.armL.rotation.x = -sw * 0.7; }
  b.flash -= dt;
  b.mat.color.setHex(b.flash > 0 ? 0xffffff : b.role === 'leader' ? BOSS_COLOR : BANDIT);
}

// ---------- patrols ----------
function patrols(dt: number) {
  if (!env || (patrolT -= dt) > 0) return;
  patrolT = 18;
  const pos = G.pos, lv = env.danger(pos.x, pos.z);
  if (lv < 0.8 || W.bandits.filter((b) => b.campId === undefined).length >= 3 || Math.random() > 0.35) return;
  const a = G.yaw + (Math.random() - 0.5) * 1.6, d = 60 + Math.random() * 20;   // behind the player
  const x = pos.x + Math.sin(a) * d, z = pos.z + Math.cos(a) * d;
  if (env.forbidden(x, z)) return;
  const group: Bandit[] = [], n = 2 + (Math.random() < 0.4 ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const px = x + i * 1.6, pz = z + (i % 2) * 1.4;
    make(i === 0 && Math.random() < 0.3 ? 'bruiser' : 'gunner', V(px, env.ground(px, pz) + 0.9, pz), lv, group);
  }
}

export function updateBandits(dt: number, time: number) {
  if (env) patrols(dt);
  for (let i = W.bandits.length - 1; i >= 0; i--) {
    const b = W.bandits[i];
    if (b.campId === undefined && Math.hypot(b.p.x - G.pos.x, b.p.z - G.pos.z) > 160) { removeBandit(b); continue; }
    think(b, dt, time); animate(b, dt);
  }
  updateBolts(dt);
}

// ---------- damage ----------
export function hurtBandit(b: Bandit, dmg: number) {
  b.hp -= dmg; b.flash = 0.12; G.hitFlash = 0.15;
  alert(b);
  if (b.hp > 0) {
    if (!b.fled && b.role !== 'leader' && b.hp < b.maxHp * 0.3 && Math.random() < 0.5) { b.fled = true; b.state = 'flee'; b.timer = 3 + Math.random() * 2; }
    return;
  }
  const at = b.p.clone(), lead = b.role === 'leader';
  burst(at, lead ? BOSS_COLOR : BANDIT, 30, 1.4);
  const gold = Math.round((6 + Math.random() * 14) * (1 + b.level * 0.5) * (lead ? 4 : 1));
  G.char.gold += gold; logLine(`+${gold} gold`);
  for (let i = 0; i < (lead ? 6 : 2); i++) dropCrystal(at);
  if (Math.random() < 0.2) dropPickup(at, 'medkit');
  if (lead && Math.random() < 0.3) dropPickup(at.clone().add(V(0.6, 0, 0)), 'key');
  if (lead && Math.random() < 0.2) dropPickup(at.clone().add(V(-0.6, 0, 0)), 'relic');
  if (lead) gainXp(40);
  const camp = b.campId;
  removeBandit(b);
  onKill('bandit');
  if (camp !== undefined && !campAlive(camp)) {
    G.char.camps[camp] = Date.now(); saveChar();
    showToast('Camp cleared'); onCampCleared(camp);
  }
}
export function removeBandit(b: Bandit) {
  scene.remove(b.g);
  b.g.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry && m.geometry !== gunGeo && m.geometry !== bladeGeo) m.geometry.dispose(); });
  const i = W.bandits.indexOf(b); if (i >= 0) W.bandits.splice(i, 1);
  const j = b.group.indexOf(b); if (j >= 0) b.group.splice(j, 1);
}
export function clearBandits() {
  for (const b of [...W.bandits]) removeBandit(b);
  for (const o of bolts) { scene.remove(o.m); o.m.geometry.dispose(); }
  bolts.length = 0;
}
/** Console / testing: a small patrol right in front of the player. */
export function spawnBanditsNear(n = 3) {
  if (!env) return false;
  const x = G.pos.x - Math.sin(G.yaw) * 20, z = G.pos.z - Math.cos(G.yaw) * 20, group: Bandit[] = [];
  for (let i = 0; i < n; i++) make(i === 0 ? 'leader' : i === 1 ? 'bruiser' : 'gunner', V(x + i * 2, env.ground(x + i * 2, z) + 0.9, z), env.danger(x, z), group);
  return true;
}
