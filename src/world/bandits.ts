// Bandits: human enemies with guns and blades. They live in camps and patrol the wilds.
// Unsaved (like drones and creatures) except that a cleared camp stays empty for a while (char.camps).
import { hurtPlayer } from './damage';
import { play } from './sound';
import { targetingFoe, actingFoe, combatFoes, factionOf, hitCombatFoe, type CombatFoe, stepRemote, withFoeTarget, proxied, otherPlayers, hurtOther, boltOut, spawnAuthority, nearestPlayer, remoteOf, spareOwner } from './remote';
import { tickCond, heavyHit, bleed, type CondFoe } from './conditions';
import { mindOf, sense, heard, share, spottedBy, aimHeight } from './stealth';
import { STEALTH, LOSE } from '../gen/stealth';
import { hostile, shotSphere } from '../core/factions';
import * as THREE from 'three';
import { onNoise } from './noise';
import { scene, V, add as addMat } from './render';
import { G, W } from '../game';
import { makeFigure, textSprite, type Figure } from './npc';
import { poseRig, muzzleLocal, type Kit } from './rig';
import { footStep } from '../core/footstep';
import { foeRules } from './enemies';
import { emptyAt } from './player';
import { burst } from './fx';
import { dropCrystal, dropPickup, rollAmmo, LOOT_GUNS } from './loot';
import { saveChar, gainXp } from '../character';
import { logLine, showToast } from '../ui/hud';
import { onKill, onCampCleared } from './quests';
import { driving, vehicles, damageVehicle, rayVehicle, seatPoint } from './vehicles';
import type { SpawnEnv } from './creatures';
import { mayspawn, BANDIT_COST } from './threat';
import { campWay, type BanditRole, type CampMap } from '../gen/camps';
import { tl } from '../i18n';
import { coverStep, dropCover, inCover } from './cover';
import { throwGrenade } from './throwing';
import { GRENADE } from '../gen/throwing';
import { peekK } from './weapons';
import { COVER } from '../gen/cover';
import { MORALE, BROKEN, FATE, DRIVEN_XP, fateOf, shocked, effective, breaks, clamp01, type Fate } from '../gen/morale';
import { askLead } from './datacarriers';
import { slotFor } from './surround';
import { upSpread } from '../gen/surround';
import type { ItemKey } from '../data/items';

export const BANDIT = 0xffb347, BOSS_COLOR = 0xff6a4a;
/** How long a cleared camp stays empty (real time). */
export const CAMP_RESPAWN_MS = 30 * 60 * 1000;

export interface Bandit extends CondFoe {
  /** (0.227) how far down on his back he is drawn (eased) */
  down?: number;
  /** Fixed city post; transmitted to prevent duplicate garrisons on another client. */
  cityPost?: string;
  kind: 'bandit'; boss?: false; role: BanditRole;
  g: THREE.Group; fig: Figure; mat: THREE.LineBasicMaterial;
  p: THREE.Vector3; heading: number; speed: number; r: number;
  hp: number; maxHp: number; flash: number;
  state: 'idle' | 'fight' | 'flee' | 'return' | 'search'; timer: number; fireT: number; burst: number; strafe: number; hitT: number;
  home: THREE.Vector3; campId?: number; group: Bandit[]; level: number; fled: boolean;
  /** How far they notice the player while waiting (ambushers lie low and wait until you are close). */
  sight: number;
  /** Set for roadside ambushers. */
  ambush?: number;
  /** Recoil of the last shot (1 → 0), and a sword stroke on its way (the blow lands mid-swing). */
  recoil: number; blow: boolean;
  /** (0.224) Crouched behind cover (1) or not, as its mind wants it; `duck` eases the figure down. */
  cover?: number; duck?: number;
  /** (0.226) 'flank' while it works round you (the rest pin you down); '' otherwise. Synced with the copies. */
  mode?: string; grenadeT?: number;
  /** Where a flanker is going, how long it keeps at it, and the wait before it flanks again. */
  flankAt?: THREE.Vector3; flankT?: number;
  /** (0.228, stage W6) Morale (gen/morale.ts), knocked once by its own wound; broken: its fate and the time left in
   *  it (a surrender's wait); `came` = it already came back once with help. The copies see `mode` 'give' / 'rout'. */
  morale?: number; wounded?: boolean; fate?: Fate; fateT?: number; came?: boolean;
}
interface Bolt { m: THREE.Line; p: THREE.Vector3; v: THREE.Vector3; dmg: number; life: number; ghost?: boolean; source?: CombatFoe }
const bolts: Bolt[] = [];
let env: SpawnEnv | null = null, patrolT = 10;
export function setBanditEnv(e: SpawnEnv | null) { env = e; }

// ---------- model ----------
/** What a bandit carries: gunners a rifle (both hands) or a pistol (one), bruisers a sword and maybe a shield, the boss a scoped rifle. */
function kitOf(role: BanditRole): { kit: Kit; shield: boolean } {
  if (role === 'bruiser') return { kit: 'sword', shield: Math.random() < 0.5 };
  if (role === 'leader') return { kit: 'rifle', shield: false };
  return { kit: Math.random() < 0.35 ? 'pistol' : 'rifle', shield: false };
}
export function spawnBandit(role: BanditRole, at: THREE.Vector3, level: number, group: Bandit[], campId?: number): Bandit {
  const color = role === 'leader' ? BOSS_COLOR : BANDIT, k = kitOf(role), fig = makeFigure(color, k.kit, k.shield, role === 'leader'), mat = fig.mat;
  const g = new THREE.Group();
  g.add(fig.g); fig.g.position.y = -0.9;
  if (role === 'leader') {
    fig.g.scale.setScalar(1.15);
    const tag = textSprite(tl('Bandit Boss'), '#ff6a4a', 2.2); tag.position.y = 1.55; g.add(tag);
  }
  scene.add(g);
  const hp = Math.round((role === 'leader' ? 16 : role === 'bruiser' ? 6 : 4) * (1 + level * 0.35));
  const b: Bandit = {
    kind: 'bandit', role, g, fig, mat, p: at.clone(), heading: Math.random() * 6.28, speed: 0, r: 0.55,
    hp, maxHp: hp, flash: 0, state: 'idle', timer: Math.random() * 3, fireT: 1 + Math.random(), burst: 0, strafe: Math.random() < 0.5 ? 1 : -1, hitT: 0,
    home: at.clone(), campId, group, level, fled: false, sight: 40, recoil: 0, blow: false,
    morale: role === 'leader' ? MORALE.start.leader : MORALE.start.bandit,
  };
  group.push(b); W.bandits.push(b); groupSize.set(group, (groupSize.get(group) ?? 0) + 1);
  return b;
}

// ---------- camps ----------
const campClearedRecently = (id: number) => { const t = G.char.camps[id]; return !!t && Date.now() - t < CAMP_RESPAWN_MS; };
/** (0.211.2) The camps' maps, for finding the way out through a gate (`campWay`). */
const campMaps = new Map<number, CampMap>();
export function spawnCamp(c: CampMap) {
  campMaps.set(c.id, c);
  if (!env || campClearedRecently(c.id) || W.bandits.some((b) => b.campId === c.id) || !spawnAuthority()) return; // another player here holds the camp's bandits
  const lv = env.danger(c.fire.x, c.fire.z), group: Bandit[] = [];
  for (const s of c.spawns) spawnBandit(s.role, V(s.x, c.y + 0.9, s.z), lv, group, c.id);
}
export function despawnCamp(id: number) { for (const b of [...W.bandits]) if (b.campId === id) removeBandit(b); }
export const campAlive = (id: number) => W.bandits.some((b) => b.campId === id);

// ---------- behaviour ----------
function blocked(b: Bandit, x: number, z: number) {
  if (!env || foeRules.blocked(V(x, b.p.y, z))) return true;
  const gy = env.ground(x, z);
  const ground = Number.isFinite(gy) ? gy : b.p.y - 0.9;
  return !G.space.empty(Math.floor(x), Math.floor(ground + 0.3), Math.floor(z)) || !G.space.empty(Math.floor(x), Math.floor(ground + 1.2), Math.floor(z)) || foeRules.body(x, ground, z, BODY_R);
}
/** (0.211.1) A bandit's width to walls, trunks and stones. */
const BODY_R = 0.4;
function stuckIn(b: Bandit) {
  if (!env) return false;
  const gy = env.ground(b.p.x, b.p.z);
  return foeRules.body(b.p.x, Number.isFinite(gy) ? gy : b.p.y - 0.9, b.p.z, BODY_R);
}
function walk(b: Bandit, dx: number, dz: number, speed: number, dt: number) {
  let L = Math.hypot(dx, dz);
  b.speed = 0;
  if (L < 1e-3 || !env) return;
  // (0.211.2) a camp's own folk go out and in through its gates, not into the palisade
  const cm = b.campId !== undefined ? campMaps.get(b.campId) : undefined;
  if (cm) {
    const k = Math.max(1, 3 / L), w = campWay(cm, b.p.x, b.p.z, b.p.x + dx * k, b.p.z + dz * k);
    if (w) { dx = w[0] - b.p.x; dz = w[1] - b.p.z; L = Math.hypot(dx, dz); if (L < 1e-3) return; }
  }
  const sx = dx / L * speed * dt, sz = dz / L * speed * dt;
  const to = footStep(b.p.x, b.p.z, sx, sz, (x, z) => blocked(b, x, z), stuckIn(b));
  if (to) { b.p.x = to[0]; b.p.z = to[1]; }
  else {
    // blocked straight ahead: slide sideways along the obstacle (round a fence, a wall, a rock)
    const px = -sz * b.strafe, pz = sx * b.strafe;
    if (!blocked(b, b.p.x + px, b.p.z + pz)) { b.p.x += px; b.p.z += pz; }
    else { b.strafe = -b.strafe; return; }
  }
  b.speed = speed;
  // stand on the terrain, or on a structure floor (camps have their own voxel floor at the pad height)
  const gy = env.ground(b.p.x, b.p.z);
  if (Number.isFinite(gy)) b.p.y = gy + 0.9;
}
function face(b: Bandit, dx: number, dz: number, dt: number) {
  let dh = Math.atan2(dx, dz) - b.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); b.heading += dh * Math.min(1, dt * 8);
}
/** The whole group goes for the target: they call out where it is (`at`, else where this one last saw it, else here). */
export function alert(b: Bandit, at?: THREE.Vector3) {
  const m0 = mindOf(b);
  if (at || !m0.last) heard(b, at ?? G.pos, 1);
  m0.aware = Math.max(m0.aware, 1);
  share(b.group, b);
  for (const m of b.group) if (m.state === 'idle' || m.state === 'return' || m.state === 'search') { m.state = 'fight'; m.timer = 0; }
}
/** Something worth a look at `at`: they go there carefully and search (not straight for you). */
function search(b: Bandit, at: THREE.Vector3, how = 0.6) {
  heard(b, at, how);
  if (b.state === 'idle' || b.state === 'return' || b.state === 'search') { b.state = 'search'; b.timer = LOSE.bandit; }
}
// gunfire nearby: bandits (who know what a shot sounds like) come to see where it came from; ambushers keep lying low.
// Already fighting, they now know where you shot from. A suppressed gun is heard only close by.
onNoise((at, r) => {
  for (const b of W.bandits) {
    if (b.sight <= 20 || b.p.distanceTo(at) >= r * 0.8) continue;
    if (b.state === 'fight' || b.state === 'flee') heard(b, at, 1); else search(b, at, 0.7);
  }
});
function fire(b: Bandit) {
  b.recoil = 1;
  b.fig.g.updateMatrixWorld(true);
  const muzzle = b.fig.g.localToWorld(muzzleLocal(b.fig.rig));
  fireBolt(muzzle, (b.role === 'leader' ? 9 : 5) * (1 + b.level * 0.2), b.role === 'leader' ? BOSS_COLOR : BANDIT);
}
/** A bolt from `muzzle` at the player (with spread for distance and the player's speed). */
export function fireBolt(muzzle: THREE.Vector3, dmg: number, color = BANDIT, at?: THREE.Vector3) {
  // at you: at the driver's seat when you are driving (the whole vehicle absorbs it, updateBolts); (0.226) or at a spot (suppressing fire)
  const target = at ? at.clone() : driving.v && !proxied() ? seatPoint(driving.v, driving.seat) : V(G.pos.x, G.pos.y + aimHeight(), G.pos.z), dist = target.distanceTo(muzzle);
  const spread = 0.035 * dist + Math.hypot(G.vel.x, G.vel.z) * 0.1 + upSpread(target.y - muzzle.y) * dist; // (0.229) uphill at you is harder
  target.x += (Math.random() - 0.5) * spread; target.y += (Math.random() - 0.5) * spread * 0.5; target.z += (Math.random() - 0.5) * spread;
  const v = target.sub(muzzle).normalize().multiplyScalar(30);
  const m = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(0, 0, 0), v.clone().normalize().multiplyScalar(-0.9)]), addMat(color));
  m.position.copy(muzzle); scene.add(m);
  bolts.push({ m, p: muzzle.clone(), v, dmg, life: 3, source: actingFoe() ?? undefined });
  play(color === 0xff9a3a ? 'robot_shot' : 'enemy_shot', { at: muzzle, vol: 0.8, far: 110 });
  boltOut(muzzle, v, color);
}
/** Another player's foe fired: the bolt is drawn here, but its harm is reckoned in the owner's game (world/foesync.ts). */
export function ghostBolt(p: THREE.Vector3, v: THREE.Vector3, color: number) {
  const m = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(0, 0, 0), v.clone().normalize().multiplyScalar(-0.9)]), addMat(color));
  m.position.copy(p); scene.add(m);
  bolts.push({ m, p: p.clone(), v: v.clone(), dmg: 0, life: 3, ghost: true });
  play(color === 0xff9a3a || color === 0xff6a4a || color === 0xff5a3c ? 'robot_shot' : 'enemy_shot', { at: p, vol: 0.8, far: 110 });
}
export function updateBolts(dt: number) {
  const body0 = V(G.pos.x, G.pos.y + 0.3, G.pos.z), body1 = V(G.pos.x, G.pos.y + (G.crouch ? 1.05 + 0.45 * peekK() : 1.6), G.pos.z); // crouched behind cover, less of you to hit (rising to shoot shows more)
  for (let i = bolts.length - 1; i >= 0; i--) {
    const o = bolts[i]; o.life -= dt;
    const step = o.v.length() * dt, dir = o.v.clone().normalize(), walled = !!G.rayBlock && G.rayBlock(o.p, dir, step) < step; // fast bolts skip thin walls otherwise
    const prev = o.p.clone();
    o.p.addScaledVector(o.v, dt); o.m.position.copy(o.p);
    let dead = o.life <= 0 || walled || !emptyAt(o.p);
    if (!dead && !o.ghost && o.source) {
      let target: CombatFoe | null = null, nearest = step;
      for (const f of combatFoes()) {
        if (f === o.source || f.hp <= 0 || !hostile(factionOf(o.source), factionOf(f))) continue;
        const h = shotSphere(prev.x, prev.y, prev.z, dir.x, dir.y, dir.z, step, f.p.x, f.p.y, f.p.z, Math.max(0.45, f.r));
        if (h !== null && h <= nearest) { nearest = h; target = f; }
      }
      if (target) { dead = true; o.p.copy(prev).addScaledVector(dir, nearest); hitCombatFoe(target, o.dmg, o.source); }
    }
    let struck: { v: typeof vehicles[number]; t: number } | null = null;
    if (!dead && !o.ghost) for (const candidate of vehicles) {
      if (candidate.ai) continue;
      const h = rayVehicle(candidate, prev, dir, struck?.t ?? step);
      if (h) struck = { v: candidate, t: h.t };
    }
    if (struck) { dead = true; o.p.copy(prev).addScaledVector(dir, struck.t); damageVehicle(struck.v, o.dmg); }
    if (!dead) for (const t of o.ghost ? [] : otherPlayers()) { // the other players here, as upright bodies
      const cy = Math.max(t.y + 0.3, Math.min(t.y + 1.6, o.p.y));
      if (Math.hypot(o.p.x - t.x, o.p.y - cy, o.p.z - t.z) < 0.5) { dead = true; hurtOther(t.id, o.dmg); break; }
    }
    if (dead || o.ghost) { /* a drawn bolt only meets walls and the others; its owner's game decides whom it hurts */ }
    else if (!dead && !foeRules.playerSafe()) {
      // on foot: distance from the bolt to the player's body (a vertical segment)
      const cy = Math.max(body0.y, Math.min(body1.y, o.p.y)), hitD = Math.hypot(o.p.x - G.pos.x, o.p.y - cy, o.p.z - G.pos.z);
      if (hitD < 0.45) { dead = true; if (!hurtPlayer(o.dmg)) heavyHit(o.dmg); }
    }
    if (dead) { burst(o.p, BANDIT, 6, 0.35); scene.remove(o.m); o.m.geometry.dispose(); bolts.splice(i, 1); }
  }
}

const eye = new THREE.Vector3();
/** (0.226, stage W2) When each group last threw a grenade (game seconds of the loop's clock), and the flanking rule:
 *  the side angle from the group (rad), the distance from you (m), how long it tries (s), the wait before the next. */
const groupNade = new WeakMap<Bandit[], number>();
const FLANK = { angle: 1.75, r: 13, time: 9, again: 22, pin: 0.55 };
/** A gunner who has lost sight of you lobs a grenade at the spot now and then (its group not too often). */
function tryGrenade(b: Bandit, at: THREE.Vector3 | null | undefined, time: number) {
  if (b.role === 'bruiser' || !at || targetingFoe()) return;
  if (b.grenadeT === undefined) b.grenadeT = 3 + Math.random() * 3;
  if (b.grenadeT > 0 || time - (groupNade.get(b.group) ?? -99) < GRENADE.group) return;
  const d = Math.hypot(at.x - b.p.x, at.z - b.p.z);
  if (d < GRENADE.min || d > GRENADE.max) return;
  throwGrenade(V(b.p.x, b.p.y + 0.7, b.p.z), V(at.x, at.y, at.z), GRENADE.dmg * (1 + b.level * 0.15));
  b.grenadeT = GRENADE.cool + Math.random() * 6; groupNade.set(b.group, time);
}
function think(b: Bandit, dt: number, time: number) {
  const to = V(G.pos.x - b.p.x, G.pos.y + 1.1 - b.p.y, G.pos.z - b.p.z), dist = to.length(), safe = !targetingFoe() && foeRules.playerSafe();
  b.timer -= dt; b.fireT -= dt; b.hitT -= dt;
  if (b.fate) { brokenTurn(b, dt, to, dist); return; } // (0.228, stage W6) broken: running, or hands up
  if (b.state !== 'return' && (safe || dist > 75)) { b.state = 'return'; }
  // what it makes of you: crouched, still, in the dark or the fog it takes longer, and from behind much longer
  const m = mindOf(b), fighting = b.state === 'fight' || b.state === 'flee';
  eye.set(b.p.x, b.p.y + 0.65, b.p.z);
  const seen = !safe && sense(b, eye, b.heading, b.sight * (b.state === 'search' ? 1.25 : b.state === 'return' ? 0.75 : 1), dt, fighting);
  const sees = () => seen;
  if (!fighting && !safe && m.aware >= STEALTH.spotted) { alert(b); if (!proxied() && !targetingFoe()) spottedBy(b); }
  if (b.state !== 'fight' && b.cover) { b.cover = 0; dropCover(b); }
  if (b.state !== 'fight' && b.mode) b.mode = '';
  if (b.grenadeT !== undefined) b.grenadeT -= dt;
  switch (b.state) {
    case 'idle':
      b.speed = 0; calmDown(b, dt);
      if (m.aware >= STEALTH.suspicious && m.last) { // "huh?": turn to look, and go and see if it does not go away
        face(b, m.last.x - b.p.x, m.last.z - b.p.z, dt * 0.6);
        if (m.aware >= 0.6) search(b, m.last, m.aware);
      } else b.heading += Math.sin(time * 0.4 + b.home.x) * dt * 0.4;
      break;
    case 'return': {
      const h = b.home.clone().sub(b.p); h.y = 0;
      if (h.length() > 1) { walk(b, h.x, h.z, 3, dt); face(b, h.x, h.z, dt); } else b.state = 'idle';
      if (m.aware >= 0.6 && m.last && !safe) search(b, m.last, m.aware);
      break;
    }
    case 'search': { // careful steps to where it saw or heard you, then a look round; gives up after a while
      const l = m.last;
      if (!l || b.timer <= 0) { b.state = 'return'; break; }
      if (moraleBreaks(b, dist)) return;
      if (b.grenadeT !== undefined) tryGrenade(b, l, time); // (0.226) one that fought you lobs a grenade where you went to ground
      const hx = l.x - b.p.x, hz = l.z - b.p.z;
      if (Math.hypot(hx, hz) > 2) { walk(b, hx, hz, 2.8, dt); face(b, hx, hz, dt); }
      else { b.speed = 0; b.heading += Math.sin(time * 0.9 + b.home.z) * dt * 1.4; }
      break;
    }
    case 'flee':
      walk(b, -to.x, -to.z, 5.5, dt); face(b, -to.x, -to.z, dt);
      if (b.timer <= 0) b.state = 'fight';
      break;
    case 'fight': {
      if (moraleBreaks(b, dist)) return; // (0.228) too many down round him: he breaks
      if (seen) share(b.group, b); // they call out where you are
      else if (m.lost > (inCover(b) ? 7 : 1.5)) { // lost you (behind cover it waits longer: you are hidden by its own rock): to where you were last seen, and search there
        b.state = 'search'; b.timer = LOSE.bandit;
        break;
      }
      if (!seen && m.last) to.set(m.last.x - b.p.x, m.last.y + 1.1 - b.p.y, m.last.z - b.p.z); // where they think you are
      face(b, to.x, to.z, dt);
      if (b.role === 'bruiser') {
        // (0.229, stage W7) blades come from different sides; with your back to a wall the rest wait their turn
        const blades = b.group.filter((o) => o.role === 'bruiser' && o.state === 'fight' && !o.fate && W.bandits.includes(o));
        const sl = blades.length > 1 ? slotFor(b, blades, blades[0].group, 1.6) : null;
        if (sl?.wait) { const wx = sl.x - b.p.x, wz = sl.z - b.p.z; if (Math.hypot(wx, wz) > 1) walk(b, wx, wz, 3.5, dt); else b.speed = 0; break; }
        if (sl && dist > 3 && Math.hypot(sl.x - b.p.x, sl.z - b.p.z) > 1.2) walk(b, sl.x - b.p.x, sl.z - b.p.z, 6.2, dt);
        else if (dist > 1.5) walk(b, to.x, to.z, 6.2, dt);
        if (dist < 1.8 && b.hitT <= 0) { b.hitT = 0.9; b.blow = true; } // wind up...
        if (b.blow && b.hitT < 0.55) { // ...and the blade comes down
          b.blow = false;
          if (dist > 2.4) break;
          const dmg = 10 * (1 + b.level * 0.2);
          if (!hurtPlayer(dmg)) { heavyHit(dmg); if (Math.random() < 0.35) bleed(); } // (0.227) a blade opens a wound
        }
        break;
      }
      const want = b.role === 'leader' ? 12 : 15;
      if (!seen) tryGrenade(b, m.last, time); // (0.226, stage W2) gone to ground behind something: a grenade at where you were
      // (0.226) three guns or more: the last works round your side while the others pin you down
      const guns = b.group.filter((o) => o.role !== 'bruiser' && o.state === 'fight' && W.bandits.includes(o));
      b.flankT = (b.flankT ?? 6) - dt;
      if (b.mode !== 'flank' && guns.length >= 3 && b === guns[guns.length - 1] && b.flankT <= 0 && dist < 40) {
        const cx = guns.reduce((a, o) => a + o.p.x, 0) / guns.length, cz = guns.reduce((a, o) => a + o.p.z, 0) / guns.length;
        const a0 = Math.atan2(cx - G.pos.x, cz - G.pos.z) + (Math.random() < 0.5 ? 1 : -1) * FLANK.angle;
        b.flankAt = V(G.pos.x + Math.sin(a0) * FLANK.r, 0, G.pos.z + Math.cos(a0) * FLANK.r); b.mode = 'flank'; b.flankT = FLANK.time;
      }
      if (b.mode === 'flank') {
        const fa = b.flankAt!, fx = fa.x - b.p.x, fz = fa.z - b.p.z;
        if (Math.hypot(fx, fz) < 1.5 || b.flankT <= 0) { b.mode = ''; b.flankT = FLANK.again; }
        else { walk(b, fx, fz, 5, dt); b.cover = 0; break; }
      }
      const pinning = guns.some((o) => o.mode === 'flank');
      // (0.224, stage W3) from cover when there is any: run to it, crouch, rise for a burst, drop back
      const tg = seen || !m.last ? G.pos : m.last;
      const cv = env ? coverStep(b, b.p.x, b.p.z, tg.x, tg.y, tg.z, dt, { ground: env.ground, body: (x, y, z) => foeRules.body(x, y, z, BODY_R), low: COVER.low, stand: COVER.stand, far: want + 12 }) : null;
      b.cover = cv?.duck ? 1 : 0;
      if (cv) {
        if (cv.to) walk(b, cv.to[0] - b.p.x, cv.to[1] - b.p.z, cv.duck ? 3.4 : 4.8, dt); else b.speed = 0;
      } else {
        if (b.timer <= 0) { b.strafe = Math.random() < 0.5 ? 1 : -1; b.timer = 1.5 + Math.random() * 1.5; }
        const side = V(-to.z, 0, to.x).normalize().multiplyScalar(b.strafe);
        if (dist > want + 7) walk(b, to.x, to.z, 4.2, dt);
        else if (dist < want - 5) walk(b, -to.x + side.x, -to.z + side.z, 3.6, dt);
        else walk(b, side.x, side.z, 2.6, dt);
      }
      if (b.fireT <= 0 && dist < 45 && sees() && (!cv || cv.fire)) {
        if (b.burst <= 0) b.burst = b.role === 'leader' ? 4 : 3;
        fire(b); b.burst--;
        b.fireT = b.burst > 0 ? 0.13 : ((b.role === 'leader' ? 1.1 : 1.8) + Math.random()) * (pinning ? FLANK.pin : 1); // pinning you down: faster
      }
      break;
    }
  }
}
function animate(b: Bandit, dt: number) {
  // crouched behind cover: the body sinks (so does the hit sphere, at b.g), the legs fold into a kneel
  const dk = (b.duck = (b.duck ?? 0) + ((b.cover ?? 0) - (b.duck ?? 0)) * Math.min(1, dt * 8));
  b.g.position.copy(b.p); b.g.position.y -= COVER.duck * dk; b.g.rotation.y = b.heading;
  const f = b.fig, ph = performance.now() / 1000 * (4 + b.speed * 1.2), sw = (b.speed > 0.2 ? Math.sin(ph) * 0.55 : 0) * (1 - dk);
  f.legL.rotation.x = sw - 1.16 * dk; f.legR.rotation.x = -sw + 1.16 * dk;
  // weapons up while fighting, lowered otherwise; the sword follows its stroke, guns kick when they fire
  const r = f.rig; r.aim += ((b.state === 'fight' ? 1 : 0) - r.aim) * Math.min(1, dt * 5);
  b.recoil = Math.max(0, b.recoil - dt * 8);
  poseRig(r, { swing: sw, aim: b.mode === 'rout' ? 0 : r.aim, recoil: b.recoil, strike: b.hitT > 0 ? 1 - b.hitT / 0.9 : -1, hands: b.mode === 'give' }); // (0.228) hands up when he gives up
  // (0.227, stage W5) knocked flat on his back, or rocked back on his heels
  b.down = (b.down ?? 0) + ((b.cond === 'down' ? 1 : 0) - (b.down ?? 0)) * Math.min(1, dt * 9);
  b.g.rotation.x = -1.4 * b.down + (b.cond === 'stagger' ? -0.25 + Math.sin(performance.now() / 40) * 0.05 : 0);
  if (b.down > 0.01) b.g.position.y -= 0.65 * b.down;
  b.flash -= dt;
  b.mat.color.setHex(b.flash > 0 ? 0xffffff : b.role === 'leader' ? BOSS_COLOR : BANDIT);
}

// ---------- patrols ----------
function patrols(dt: number) {
  if (!env || (patrolT -= dt) > 0) return;
  patrolT = 18;
  const pos = G.pos, lv = env.danger(pos.x, pos.z);
  if (lv < 2 || W.bandits.filter((b) => b.campId === undefined && b.ambush === undefined).length >= 3 || Math.random() > 0.35) return;
  const a = G.yaw + Math.PI + (Math.random() - 0.5) * 3, d = 70 + Math.random() * 20;   // ahead or to a side
  const x = pos.x + Math.sin(a) * d, z = pos.z + Math.cos(a) * d;
  if (env.forbidden(x, z)) return;
  const group: Bandit[] = [], n = 2 + (lv > 3.5 && Math.random() < 0.4 ? 1 : 0);
  if (!mayspawn(n * BANDIT_COST, lv)) return;
  for (let i = 0; i < n; i++) {
    const px = x + i * 1.6, pz = z + (i % 2) * 1.4;
    spawnBandit(i === 0 && Math.random() < 0.3 ? 'bruiser' : 'gunner', V(px, env.ground(px, pz) + 0.9, pz), lv, group);
  }
}

export function updateBandits(dt: number, time: number) {
  if (env) patrols(dt);
  for (let i = W.bandits.length - 1; i >= 0; i--) {
    const b = W.bandits[i];
    if (stepRemote(b, dt)) { animate(b, dt); continue; } // another player's: it does what its owner says
    if (!b.cityPost && b.campId === undefined && nearestPlayer(b.p.x, b.p.z) > (b.ambush !== undefined ? 240 : 160)) { removeBandit(b); continue; }
    if (tickCond(b, dt, (d, cr) => hurtBandit(b, d, cr))) { b.speed = 0; animate(b, dt); continue; } // (0.227, stage W5) knocked down or reeling
    withFoeTarget(b, () => think(b, dt, time)); animate(b, dt);
  }
  updateBolts(dt);
  updateCorpses(dt);
  updateComebacks(dt);
}

// ---------- dying ----------
// A killed bandit is no longer a foe (out of W.bandits at once), but the body stays a while: the weapon flies from
// his hand, his knees give, he topples away from the blow (backwards when hit from the front), bounces once, lies
// still for a few seconds and then sinks into the ground.
interface Corpse { b: Bandit; t: number; dir: 1 | -1; lie: number; drop: { o: THREE.Object3D; v: THREE.Vector3; spin: THREE.Vector3; rest: boolean }[]; feet: number; slow: number }
const corpses: Corpse[] = [];
const FALL = 0.85, LIE = 6, SINK = 1.6;
const groundUnder = (x: number, z: number, fallback: number) => { const g = G.ground ? G.ground(x, z) : -Infinity; return Number.isFinite(g) && g > fallback - 3 ? Math.max(g, fallback - 0.2) : fallback; };
/** Take `b` out of the fight and let him fall (away from `from`, when given). */
export function fallBandit(b: Bandit, from?: THREE.Vector3) {
  play('die_bandit', { at: b.p, vol: 0.8, far: 50, jitter: 0.12 });
  const i = W.bandits.indexOf(b); if (i >= 0) W.bandits.splice(i, 1);
  const j = b.group.indexOf(b); if (j >= 0) b.group.splice(j, 1);
  // falls backwards if the blow came from in front of him, else forwards
  const front = from ? Math.cos(Math.atan2(from.x - b.p.x, from.z - b.p.z) - b.heading) > 0 : Math.random() < 0.5;
  const drop: Corpse['drop'] = [];
  b.g.position.copy(b.p); b.g.rotation.y = b.heading; b.g.updateMatrixWorld(true);
  for (const o of [...b.fig.rig.armR.hand.children.slice(1), ...b.fig.rig.armL.hand.children.slice(1)]) { // the weapon (and the shield) fly loose
    scene.attach(o);
    const out = V(Math.sin(b.heading), 0, Math.cos(b.heading)).multiplyScalar(front ? 1.2 : -1.2);
    drop.push({ o, v: V(out.x + (Math.random() - 0.5) * 1.5, 2.2 + Math.random(), out.z + (Math.random() - 0.5) * 1.5), spin: V((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 9), rest: false });
  }
  b.fig.rig.kit = 'none';
  b.mat.color.setHex(0xffffff);
  for (const o of b.g.children) if (o instanceof THREE.Sprite) o.visible = false; // the boss's name tag
  // lie along the ground where the head comes down: stop short of flat on a rise, a little past it on a slope down
  const dir = front ? -1 : 1, feet = b.p.y - 0.9, hx = b.p.x + Math.sin(b.heading) * dir * 1.6, hz = b.p.z + Math.cos(b.heading) * dir * 1.6;
  const slope = Math.max(-0.35, Math.min(0.6, Math.atan2(groundUnder(hx, hz, feet) - feet, 1.6)));
  corpses.push({ b, t: 0, dir, lie: Math.PI / 2 - 0.06 - slope, drop, feet, slow: b.role === 'leader' ? 1.3 : 1 });
}
function updateCorpses(dt: number) {
  for (let i = corpses.length - 1; i >= 0; i--) {
    const c = corpses[i], b = c.b, f = b.fig;
    c.t += dt / c.slow;
    const t = c.t;
    // knees buckle (0–0.3 s), then the body topples about the feet with gravity's ease-in, a small bounce on landing
    const buckle = Math.min(1, t / 0.3), fall = Math.max(0, Math.min(1, (t - 0.15) / (FALL - 0.15)));
    let th = fall * fall * c.lie;
    if (t > FALL) { const k = t - FALL; th = c.lie - Math.abs(Math.sin(k * 14)) * Math.exp(-k * 9) * 0.22; }
    f.g.rotation.x = c.dir * th;
    // knees give, then the body comes to rest on its side of the torso and head (not half in the ground)
    f.g.position.y = -0.9 - 0.25 * buckle * (1 - fall) + 0.18 * fall;
    f.legL.rotation.x = -0.9 * buckle * (1 - fall * 0.7); f.legR.rotation.x = -0.5 * buckle * (1 - fall * 0.7);
    poseRig(f.rig, { swing: t < FALL + 0.3 ? Math.sin(t * 13) * 0.6 * (1 - Math.min(1, t / (FALL + 0.3))) + c.dir * 0.8 * fall : c.dir * 0.8 });
    if (t < 0.25) b.mat.color.setHex(0xffffff); else b.mat.color.setHex(b.role === 'leader' ? 0xa84a36 : 0xa87a3a); // the colour drains away
    if (t > FALL + LIE) b.g.position.y = b.p.y - (t - FALL - LIE) / SINK * 1.2; // sinking
    for (const d of c.drop) {
      if (d.rest) { if (t > FALL + LIE) d.o.position.y -= dt * 0.75; continue; }
      d.v.y -= 20 * dt; d.o.position.addScaledVector(d.v, dt);
      d.o.rotation.x += d.spin.x * dt; d.o.rotation.y += d.spin.y * dt; d.o.rotation.z += d.spin.z * dt;
      const gy = groundUnder(d.o.position.x, d.o.position.z, c.feet) + 0.04;
      if (d.o.position.y <= gy && d.v.y < 0) {
        d.o.position.y = gy;
        if (d.v.y < -3) { d.v.y *= -0.3; d.v.x *= 0.5; d.v.z *= 0.5; d.spin.multiplyScalar(0.4); } // one clatter
        else { d.rest = true; d.o.rotation.x = Math.round(d.o.rotation.x / Math.PI) * Math.PI; d.o.rotation.z = Math.PI / 2 * Math.round(d.o.rotation.z / (Math.PI / 2)); }
      }
    }
    if (t > FALL + LIE + SINK) { for (const d of c.drop) { scene.remove(d.o); d.o.traverse((o) => (o as THREE.Mesh).geometry?.dispose()); } removeBandit(b); corpses.splice(i, 1); }
  }
}

// ---------- damage ----------
export function hurtBandit(b: Bandit, dmg: number, credit = true) {
  if (b.mode === 'give') credit = false; // (0.228) one who had given himself up: no bounty for him
  // a raised shield takes half of what comes from the front
  if (b.fig.rig.shield && Math.cos(Math.atan2(G.pos.x - b.p.x, G.pos.z - b.p.z) - b.heading) > 0.5) dmg *= 0.5;
  b.hp -= dmg; b.flash = 0.12; G.hitFlash = 0.15;
  if (b.hp > 0) alert(b, G.pos);
  else for (const o of b.group) { // a silent kill: those near enough to see it fall come to look, they do not know where you are
    if (o !== b && o.p.distanceTo(b.p) < 25 && o.state !== 'fight' && o.state !== 'flee') search(o, b.p, 0.75);
  }
  if (b.hp > 0) {
    if (!b.wounded && b.hp < b.maxHp * 0.3) { b.wounded = true; b.morale = shocked(b.morale ?? MORALE.start.bandit, 'wound'); } // (0.228) the wound shakes him
    if (b.fate === 'give') { b.fate = 'run'; b.mode = 'rout'; } // shot at with his hands up: he runs
    return;
  }
  const at = b.p.clone(), lead = b.role === 'leader';
  burst(at, lead ? BOSS_COLOR : BANDIT, 14, 0.9);
  const gold = Math.round((6 + Math.random() * 14) * (1 + b.level * 0.5) * (lead ? 4 : 1));
  if (credit) { G.char.gold += gold; logLine(`+${gold} gold`); }
  for (let i = 0; i < (lead ? 6 : 2); i++) dropCrystal(at);
  if (Math.random() < 0.2) dropPickup(at, 'medkit');
  if (Math.random() < (lead ? 1 : 0.3)) dropPickup(at.clone().add(V(0.3, 0, 0.4)), 'scrap');
  if (lead && Math.random() < 0.3) dropPickup(at.clone().add(V(0.6, 0, 0)), 'key');
  if (lead && Math.random() < 0.2) dropPickup(at.clone().add(V(-0.6, 0, 0)), 'relic');
  if (Math.random() < (lead ? 1 : 0.35)) { const [k, n] = rollAmmo(lead ? 1.5 : 0.5); dropPickup(at.clone().add(V(-0.3, 0, -0.4)), k, n); } // their rounds
  if (Math.random() < (lead ? 0.3 : 0.04)) dropPickup(at.clone().add(V(0, 0, -0.7)), LOOT_GUNS[(Math.random() * LOOT_GUNS.length) | 0]);
  if (lead && credit) gainXp(40);
  const camp = b.campId, group = b.group;
  for (const o of group) if (o !== b && !o.fate && o.p.distanceTo(b.p) < MORALE.near) o.morale = shocked(o.morale ?? MORALE.start.bandit, lead ? 'leader' : 'ally'); // (0.228) a comrade falls
  fallBandit(b, G.pos);
  if (credit) onKill('bandit');
  const size = groupSize.get(group) ?? 0;
  if (size >= 3 && !halfDown.has(group) && group.length <= size / 2) { halfDown.add(group); for (const o of group) o.morale = shocked(o.morale ?? MORALE.start.bandit, 'half'); }
  campCheck(camp);
}
/** A camp with nobody left to fight for it (dead, or broken and gone) is cleared (0.228: routing it counts). */
function campCheck(camp: number | undefined) {
  if (camp === undefined || campAlive(camp)) return;
  G.char.camps[camp] = Date.now(); saveChar();
  showToast(tl('Camp cleared')); onCampCleared(camp);
}

// ---------- morale (0.228, PLAN_WALKI.md stage W6) ----------
const groupSize = new WeakMap<Bandit[], number>(), halfDown = new WeakSet<Bandit[]>(), rallied = new WeakSet<Bandit[]>();
/** The group's boss, alive, not broken and within reach of b. */
const bossNear = (b: Bandit) => b.group.find((o) => o !== b && o.role === 'leader' && !o.fate && W.bandits.includes(o) && o.p.distanceTo(b.p) < MORALE.near);
/** Nothing doing: the nerve comes back. */
function calmDown(b: Bandit, dt: number) {
  const top = b.role === 'leader' ? MORALE.start.leader : MORALE.start.bandit;
  if ((b.morale ?? top) < top) b.morale = Math.min(top, (b.morale ?? top) + MORALE.regain * dt);
}
/** Whether he breaks now (and what he does then). */
function moraleBreaks(b: Bandit, dist: number): boolean {
  const weak = !proxied() && !targetingFoe() && G.hp < G.S.maxHp * MORALE.winning.hp;
  if (!breaks(effective(b.morale ?? MORALE.start.bandit, { leader: !!bossNear(b), weakTarget: weak }))) return false;
  const boss = bossNear(b);
  if (boss && !rallied.has(b.group)) { // the boss shouts them back into line, once a fight
    rallied.add(b.group);
    for (const o of b.group) if (o.p.distanceTo(boss.p) < MORALE.near) { o.morale = clamp01((o.morale ?? 0) + MORALE.rally); if (o.fate && o.fate !== 'give') { o.fate = undefined; o.mode = ''; o.state = 'fight'; } }
    if (!proxied() && boss.p.distanceTo(G.pos) < 60) logLine(tl('"Hold the line, you dogs!" the bandit boss roars.'));
    return false;
  }
  breakBandit(b, fateOf(Math.random(), dist < FATE.cornered), dist);
  return true;
}
/** He breaks: out of the fight and out of his camp's count (a routed camp is a cleared camp). */
function breakBandit(b: Bandit, fate: Fate, dist: number) {
  if (fate === 'back' && b.came) fate = 'run'; // he fetched help once already
  b.fate = fate; b.mode = fate === 'give' ? 'give' : 'rout'; b.state = 'flee'; b.cover = 0; dropCover(b);
  b.fateT = fate === 'give' ? BROKEN.wait : 0; b.burst = 0; b.blow = false;
  const camp = b.campId; b.campId = undefined;
  if (!proxied() && dist < 70) logLine(fate === 'give' ? tl('A bandit throws down his arms and raises his hands!') : fate === 'back' ? tl('"I\'ll be back with the others!" A bandit runs.') : tl('A bandit breaks and runs!'));
  if (!proxied()) gainXp(Math.round((b.role === 'leader' ? 40 : 10) * DRIVEN_XP)); // driving him off is worth half a kill
  campCheck(camp);
}
const away = V(0, 0, 0);
/** A broken bandit's turn: runners make off (gone once far from everyone; one fetching help comes back with more),
 *  one who gave up stands with his hands up and runs if nobody comes to him. */
function brokenTurn(b: Bandit, dt: number, to: THREE.Vector3, dist: number) {
  if (b.fate === 'give') {
    b.speed = 0; face(b, to.x, to.z, dt);
    if (dist > 12 && (b.fateT = (b.fateT ?? BROKEN.wait) - dt) <= 0) { b.fate = 'run'; b.mode = 'rout'; }
    return;
  }
  away.set(-to.x, 0, -to.z);
  walk(b, away.x, away.z, 5.8, dt); face(b, away.x, away.z, dt);
  if (nearestPlayer(b.p.x, b.p.z) < BROKEN.gone) return;
  if (b.fate === 'back') comebacks.push({ x: b.p.x, z: b.p.z, y: b.p.y, t: BROKEN.help[0] + Math.random() * (BROKEN.help[1] - BROKEN.help[0]), level: b.level, role: b.role, n: BROKEN.extra[0] + Math.floor(Math.random() * (BROKEN.extra[1] - BROKEN.extra[0] + 1)) });
  removeBandit(b);
}
/** Runners who went for help: after a while they come back with more (only if a player is still about). */
interface Comeback { x: number; z: number; y: number; t: number; level: number; role: BanditRole; n: number }
const comebacks: Comeback[] = [];
function updateComebacks(dt: number) {
  for (let i = comebacks.length - 1; i >= 0; i--) {
    const c = comebacks[i];
    if ((c.t -= dt) > 0) continue;
    comebacks.splice(i, 1);
    const d = nearestPlayer(c.x, c.z);
    if (!env || d > 320 || !spawnAuthority()) continue; // nobody to come back for
    // they come from the side they ran to, at most 80 m off
    const k = Math.min(1, 80 / Math.max(1, d)), x = G.pos.x + (c.x - G.pos.x) * k, z = G.pos.z + (c.z - G.pos.z) * k;
    if (env.forbidden(x, z)) continue;
    const group: Bandit[] = [], lv = c.level;
    for (let j = 0; j <= c.n; j++) {
      const px = x + (j % 3) * 1.8, pz = z + Math.floor(j / 3) * 1.8;
      const nb = spawnBandit(j === 0 ? c.role : Math.random() < 0.3 ? 'bruiser' : 'gunner', V(px, env.ground(px, pz) + 0.9, pz), lv, group);
      nb.came = true; nb.morale = BROKEN.helpMorale; nb.sight = 70; alert(nb, G.pos.clone());
    }
    logLine(tl('The bandit who ran is back, and he brought friends!'));
  }
}
/** E by a bandit who gave himself up: he hands over his gun and what he carries, maybe talks, and goes. On another
 *  player's copy the word goes to the game that runs him (`spareOwner`). */
export function spareBandit(b: Bandit, local = true) {
  if (b.mode !== 'give') return;
  if (remoteOf(b)) { spareOwner(b); b.mode = 'rout'; }
  else {
    const at = b.p.clone(); at.y -= 0.6;
    const gun: ItemKey = b.role === 'bruiser' ? 'machete' : b.fig.rig.kit === 'pistol' ? 'pistol' : 'rifle';
    dropPickup(at.clone().add(V(0.4, 0, 0.2)), gun);
    if (Math.random() < 0.8) { const [k, n] = rollAmmo(0.7); dropPickup(at.clone().add(V(-0.3, 0, 0.3)), k, n); }
    if (Math.random() < 0.35) dropPickup(at.clone().add(V(0, 0, -0.4)), 'medkit');
    if (Math.random() < 0.4) dropPickup(at.clone().add(V(0.3, 0, -0.3)), 'scrap');
    b.fate = 'run'; b.mode = 'rout'; b.fig.rig.armR.hand.visible = false; // unarmed now
  }
  if (!local) return;
  logLine(tl('He drops his gun and what he carries at your feet.'));
  if (Math.random() < 0.3) logLine(tl('"Don\'t shoot! I know something..." ') + askLead(b.p.x, b.p.z));
}
/** The nearest bandit with his hands up within reach (for the prompt and E). */
export function nearSurrendered(): Bandit | null {
  let best: Bandit | null = null, bd = BROKEN.reach;
  for (const b of W.bandits) if (b.mode === 'give') { const d = Math.hypot(b.p.x - G.pos.x, b.p.z - G.pos.z); if (d < bd) { bd = d; best = b; } }
  return best;
}
export function removeBandit(b: Bandit) {
  scene.remove(b.g);
  b.g.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); });
  const i = W.bandits.indexOf(b); if (i >= 0) W.bandits.splice(i, 1);
  const j = b.group.indexOf(b); if (j >= 0) b.group.splice(j, 1);
}
export function clearBandits() {
  for (const b of [...W.bandits]) removeBandit(b);
  comebacks.length = 0;
  for (const c of corpses) { for (const d of c.drop) scene.remove(d.o); removeBandit(c.b); }
  corpses.length = 0;
  for (const o of bolts) { scene.remove(o.m); o.m.geometry.dispose(); }
  bolts.length = 0;
}
/** Console / testing: a small patrol right in front of the player. */
export function spawnBanditsNear(n = 3) {
  if (!env) return false;
  const x = G.pos.x - Math.sin(G.yaw) * 20, z = G.pos.z - Math.cos(G.yaw) * 20, group: Bandit[] = [];
  for (let i = 0; i < n; i++) spawnBandit(i === 0 ? 'leader' : i === 1 ? 'bruiser' : 'gunner', V(x + i * 2, env.ground(x + i * 2, z) + 0.9, z), env.danger(x, z), group);
  return true;
}
