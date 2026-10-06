// Drones, bosses (gate guardians and rare elites) and their projectiles.
import { hurtPlayer } from './damage';
import { remoteOf, hitOwner, setCombatHooks, stepRemoteP, withTarget, proxied, otherPlayers, hurtOther, boltOut, type CombatFoe } from './remote';
import * as THREE from 'three';
import { hash } from '../core/rng';
import { onNoise } from './noise';
import { scene, lineMat, add, V, circlePts, edgesOf } from './render';
import { G, W } from '../game';
import { floorAt } from '../core/voxel';
import { emptyAt, rayWorld } from './player';
import { burst } from './fx';
import { dropCrystal, dropPickup, lootQuiet } from './loot';
import { droneHp, droneDps, gainXp, saveChar, progress, progressHas, depth as depthNow } from '../character';
import { showToast, logLine, el } from '../ui/hud';
import type { BossSpec } from '../gen/dungeon';
import { hurtCreature, type Creature } from './creatures';
import { hurtRobot, type Robot } from './robots';
import { hurtBandit, type Bandit } from './bandits';
import { hurtRaider, raiders, type Raider } from './raiders';
import { onKill } from './quests';

export interface Drone {
  boss?: false; g: THREE.Group; inner: THREE.LineSegments; mat: THREE.LineBasicMaterial; p: THREE.Vector3;
  phase: number; hp: number; flash: number; chasing: boolean; r?: number;
  /** A dungeon drone's index in its sector (gen/repopulate.ts): once killed it stays dead. */
  idx?: number;
  /** Field scouts carry their own (weaker) stats; dungeon drones use the depth-based defaults. */
  scout?: { speed: number; dps: number; detect: number; lose: number };
}
export interface Boss {
  boss: true; idx: number; g: THREE.Group; core: THREE.LineSegments; cage: THREE.LineSegments; eye: THREE.LineLoop; shards: THREE.LineSegments[];
  mat: THREE.LineBasicMaterial; home: THREE.Vector3; p: THREE.Vector3; room: BossSpec['room']; guard: boolean; r: number;
  hp: number; maxHp: number; flash: number; engaged: boolean; fireT: number; name: string;
}
export interface Orb { m: THREE.LineSegments; p: THREE.Vector3; v: THREE.Vector3; dmg: number; life: number }
export type Foe = Drone | Boss | Creature | Bandit | Raider | Robot;

// ---------- drones ----------
export function makeDrone(): Drone {
  const mat = lineMat(0xffb347);
  const g = new THREE.Group();
  g.add(edgesOf(new THREE.OctahedronGeometry(0.5), mat));
  const inner = edgesOf(new THREE.BoxGeometry(0.3, 0.3, 0.3), mat);
  g.add(inner); scene.add(g);
  return { g, inner, mat, p: new THREE.Vector3(), phase: Math.random() * 6, hp: 2, flash: 0, chasing: false };
}
export function placeDrone(t: Drone) {
  const cells = W.spawnCells;
  for (let n = 0; n < 300; n++) {
    const c = cells[(Math.random() * cells.length) | 0];
    const p = V(c[0] + 0.5, c[1] + 1.4, c[2] + 0.5);
    if (p.distanceTo(G.pos) > 12) { t.p.copy(p); t.hp = droneHp(); t.chasing = false; return; }
  }
}
/** A dungeon drone's own spot: a hashed spawn cell (the same every time you come), the next free one if you stand there. */
export function placeDroneAt(t: Drone, i: number, seed: number) {
  const cells = W.spawnCells;
  if (!cells.length) return;
  const s = hash(seed, i, 0xd70e) % cells.length;
  for (let n = 0; n < cells.length; n += 7) {
    const c = cells[(s + n) % cells.length], p = V(c[0] + 0.5, c[1] + 1.4, c[2] + 0.5);
    if (p.distanceTo(G.pos) > 12 || n + 7 >= cells.length) { t.p.copy(p); t.hp = droneHp(); t.chasing = false; return; }
  }
}
/** Rules of the current place: where drones may not fly, and whether the player is out of reach (safe zone). */
export const foeRules = {
  blocked: (_p: THREE.Vector3) => false,
  playerSafe: () => false,
  /** The player is out of reach of contact damage (aboard a vehicle). */
  shielded: () => false,
  /** Damage absorbed by the occupied vehicle. */
  shieldHit: (_dmg: number) => {},
  /** Hover height above the ground for field drones. */
  ground: null as ((x: number, z: number) => number) | null,
};
function droneMove(t: Drone, d: THREE.Vector3) {
  for (const ax of ['x', 'y', 'z'] as const) {
    if (!d[ax]) continue;
    const np = t.p.clone(); np[ax] += d[ax];
    const probe = np.clone(); probe[ax] += Math.sign(d[ax]) * 0.4;
    if (emptyAt(probe) && !foeRules.blocked(probe)) t.p[ax] = np[ax];
  }
}
export function updateDrones(dt: number) {
  for (const t of W.drones) {
    if (stepRemoteP(t, dt)) continue; // another player's (shared foes): it does what its owner says
    withTarget(t.p.x, t.p.z, () => droneTurn(t, dt));
  }
}
function droneTurn(t: Drone, dt: number) {
  {
    const head = V(G.pos.x, G.pos.y + 1.2, G.pos.z), safe = foeRules.playerSafe();
    const to = head.clone().sub(t.p), dist = to.length(), sc = t.scout;
    if (safe) t.chasing = false; // the village: pursuers give up at the gate
    else if (dist < (sc ? sc.detect : 16)) { const dir = to.clone().normalize(); if (rayWorld(t.p, dir, dist) >= dist - 0.01) t.chasing = true; }
    if (t.chasing && dist > 1.1) droneMove(t, to.normalize().multiplyScalar(Math.min((sc ? sc.speed : 3.4) * dt, dist - 1.1)));
    else if (sc && foeRules.ground) { // idle scouts drift back to hovering height
      const want = foeRules.ground(t.p.x, t.p.z) + 1.8;
      droneMove(t, V(0, Math.max(-dt, Math.min(dt, want - t.p.y)), 0));
    }
    if (t.chasing && dist > (sc ? sc.lose : 28)) t.chasing = false;
    if (dist < 1.5 && !safe) {
      const dmg = (sc ? sc.dps : droneDps()) * dt;
      hurtPlayer(dmg, true, .25);
    }
  }
}

// a shot close by sets field drones on the hunt
onNoise((at, r) => { for (const t of W.drones) if (t.p.distanceTo(at) < (t.scout ? Math.min(r * 0.5, t.scout.lose) : r * 0.3)) t.chasing = true; });

// ---------- bosses ----------
const BOSS_NAMES = ['WARDEN', 'GATEKEEPER', 'OVERSEER', 'SENTINEL PRIME'];
export function makeBoss(b: BossSpec, i: number): Boss | null {
  if (progressHas('killed', i)) return null;
  const f = floorAt(G.space, b.x, b.z, G.grid.oy + 1, G.grid.oy + G.grid.ny - 1); if (!f) return null;
  const mat = lineMat(0xff6a4a);
  const g = new THREE.Group();
  const core = edgesOf(new THREE.IcosahedronGeometry(1.1, 0), mat);
  const cage = edgesOf(new THREE.OctahedronGeometry(1.6), lineMat(0xffb347));
  const eye = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(circlePts(0.35, 12)), lineMat(0xffffff));
  g.add(core, cage, eye); scene.add(g);
  const shards: THREE.LineSegments[] = [];
  for (let k = 0; k < 5; k++) { const s = edgesOf(new THREE.TetrahedronGeometry(0.25), mat); g.add(s); shards.push(s); }
  const hp0 = 40 + 15 * (depthNow() - 1) * (b.guard ? 1 : 1.2);
  return {
    boss: true, idx: i, g, core, cage, eye, shards, mat, home: V(f[0] + 0.5, f[1] + 2.4, f[2] + 0.5), p: V(f[0] + 0.5, f[1] + 2.4, f[2] + 0.5),
    room: b.room, guard: b.guard, r: 1.3, hp: hp0, maxHp: hp0, flash: 0, engaged: false, fireT: 1.5,
    name: b.guard ? BOSS_NAMES[i % BOSS_NAMES.length] : 'ELITE ' + BOSS_NAMES[(i + 1) % BOSS_NAMES.length],
  };
}
const inRoom = (b: Boss, x: number, z: number, m = 0) => x >= b.room.x - m && x <= b.room.x + b.room.w + m && z >= b.room.z - m && z <= b.room.z + b.room.d + m;
function fireOrb(from: THREE.Vector3, dir: THREE.Vector3, dmg: number) {
  const m = edgesOf(new THREE.OctahedronGeometry(0.22), add(0xff6a4a));
  scene.add(m); W.orbs.push({ m, p: from.clone(), v: dir.clone().multiplyScalar(9), dmg, life: 6 });
  boltOut(from, dir.clone().multiplyScalar(9), 0xff6a4a); // the other players see it fly (their game draws it harmless)
}
export function updateBosses(dt: number, time: number): Boss | null {
  let shown: Boss | null = null;
  const depth = depthNow();
  for (const b of W.bosses) {
    if (stepRemoteP(b, dt)) { if (b.engaged && inRoom(b, G.pos.x, G.pos.z, 6)) shown = b; continue; } // another player's
    let mine = false;
    withTarget(b.p.x, b.p.z, () => { mine = !proxied(); if (bossTurn(b, dt, time, depth) && mine) shown = b; });
  }
  return shown;
}
/** One boss's turn against the player nearest to it (`withTarget`); true while it fights. */
function bossTurn(b: Boss, dt: number, time: number, depth: number): boolean {
  const head = V(G.pos.x, G.pos.y + 1.2, G.pos.z);
  let fighting = false;
  {
    const inside = inRoom(b, G.pos.x, G.pos.z, 1);
    if (inside) b.engaged = true; else if (!inRoom(b, G.pos.x, G.pos.z, 6)) b.engaged = false;
    const to = head.clone().sub(b.p), dist = to.length();
    let target = b.home;
    if (b.engaged) {
      const side = V(-to.z, 0, to.x).normalize().multiplyScalar(Math.sin(time * 0.7 + b.idx) * 4);
      target = head.clone().addScaledVector(to.clone().normalize(), -6).add(side); target.y = b.home.y + Math.sin(time * 1.3) * 0.6;
      target.x = Math.max(b.room.x + 1.5, Math.min(b.room.x + b.room.w - 1.5, target.x));
      target.z = Math.max(b.room.z + 1.5, Math.min(b.room.z + b.room.d - 1.5, target.z));
      b.fireT -= dt;
      if (b.fireT <= 0 && dist < 30 && rayWorld(b.p, to.clone().normalize(), dist) >= dist - 0.05) {
        const dmg = 12 + 3 * (depth - 1), dir = to.clone().normalize();
        fireOrb(b.p, dir, dmg);
        if (depth >= 2 || b.hp < b.maxHp * 0.5) {
          const sd = V(-dir.z, 0, dir.x).multiplyScalar(0.22);
          fireOrb(b.p, dir.clone().add(sd).normalize(), dmg); fireOrb(b.p, dir.clone().sub(sd).normalize(), dmg);
        }
        b.fireT = Math.max(0.7, 1.5 - (depth - 1) * 0.1) * (b.hp < b.maxHp * 0.5 ? 0.7 : 1);
      }
      if (dist < 2.2) { hurtPlayer(droneDps() * 1.5 * dt, true, .25); }
      fighting = true;
    }
    const mv = target.clone().sub(b.p), ml = mv.length(); if (ml > 0.05) b.p.addScaledVector(mv.normalize(), Math.min(ml, (b.engaged ? 3 : 2) * dt));
  }
  return fighting;
}
export function updateOrbs(dt: number) {
  const body = V(G.pos.x, G.pos.y + 0.9, G.pos.z);
  for (let i = W.orbs.length - 1; i >= 0; i--) {
    const o = W.orbs[i]; o.life -= dt;
    const step = o.v.length() * dt, walled = !!G.rayBlock && G.rayBlock(o.p, o.v.clone().normalize(), step) < step;
    o.p.addScaledVector(o.v, dt); o.m.position.copy(o.p); o.m.rotation.x += dt * 6; o.m.rotation.y += dt * 4;
    let dead = o.life <= 0 || walled || !emptyAt(o.p);
    if (!dead && o.p.distanceTo(body) < 0.75) { hurtPlayer(o.dmg); dead = true; }
    if (!dead) for (const t of otherPlayers()) if (o.p.distanceTo(V(t.x, t.y + 0.9, t.z)) < 0.75) { hurtOther(t.id, o.dmg); dead = true; break; }
    if (dead) { burst(o.p, 0xff6a4a, 8, 0.5); scene.remove(o.m); o.m.geometry.dispose(); W.orbs.splice(i, 1); }
  }
}
function killBoss(b: Boss) {
  const at = b.g.position.clone(), depth = depthNow();
  burst(at, 0xff6a4a, 60, 3); burst(at, 0xffd060, 30, 2);
  for (let i = 0; i < 10; i++) dropCrystal(at);
  dropPickup(at, 'key');
  if (!b.guard || Math.random() < 0.5) dropPickup(at.clone().add(V(0.6, 0, 0)), 'relic');
  if (Math.random() < 0.6) dropPickup(at.clone().add(V(-0.6, 0, 0)), 'medkit');
  for (let i = 0; i < 3; i++) dropPickup(at.clone().add(V(0, 0, 0.5 + i * 0.4)), 'scrap');
  progress('killed').push(b.idx);
  if (!lootQuiet()) { G.char.gold += 40 * depth; logLine('+' + (40 * depth) + ' gold'); gainXp(60 * depth); } // another player's kill: theirs
  saveChar();
  scene.remove(b.g); W.bosses.splice(W.bosses.indexOf(b), 1);
  showToast(b.name + ' destroyed');
}
export const foes = (): Foe[] => (W.drones as Foe[]).concat(W.bosses, W.creatures, W.bandits, raiders, W.robots);

export function damageFoe(t: Foe, dmg: number, credit = true) {
  if (remoteOf(t)) { (t as { flash: number }).flash = 0.12; G.hitFlash = 0.15; hitOwner(t, dmg, !credit); return; } // another player's foe: their game reckons it
  if ('kind' in t) { if (t.kind === 'bandit') hurtBandit(t, dmg, credit); else if (t.kind === 'raider') hurtRaider(t, dmg); else if (t.kind === 'robot') hurtRobot(t, dmg, credit); else hurtCreature(t, dmg, credit); return; }
  if (t.boss) { t.hp -= dmg; t.flash = 0.1; t.engaged = true; G.hitFlash = 0.15; if (t.hp <= 0) killBoss(t); return; }
  t.hp -= dmg; t.flash = 0.12; t.chasing = true; G.hitFlash = 0.15;
  if (t.hp <= 0) {
    const at = t.g.position.clone(); burst(at, 0xffb347, 26, 1.4);
    const n = 2 + (Math.random() < 0.5 ? 1 : 0); for (let i = 0; i < n; i++) dropCrystal(at);
    const r = Math.random(); if (r < 0.12) dropPickup(at, 'medkit'); else if (r < 0.17) dropPickup(at, 'emp');
    if (Math.random() < 0.35) dropPickup(at.clone().add(V(0.4, 0, 0.3)), 'scrap');
    respawnDrone(t);
    if (!lootQuiet()) onKill('drone');
  }
}
/** What happens to a destroyed drone; dungeons recycle it elsewhere in the level. */
export let respawnDrone = (t: Drone) => placeDrone(t);
export function setDroneRespawn(f: (t: Drone) => void) { respawnDrone = f; }

/** Per-frame visuals of foes (runs even while paused so they keep spinning). */
export function animateFoes(dt: number, time: number, camPos: THREE.Vector3) {
  for (const b of W.bosses) {
    b.g.position.copy(b.p); b.core.rotation.y = time * 0.6; b.core.rotation.x = time * 0.3; b.cage.rotation.y = -time * 0.9;
    b.eye.lookAt(camPos);
    b.shards.forEach((s, k) => { const a = time * (b.engaged ? 2.4 : 1) + k * 1.2566; s.position.set(Math.cos(a) * 2.2, Math.sin(a * 1.3) * 0.5, Math.sin(a) * 2.2); s.rotation.x = a * 2; });
    b.flash -= dt; b.mat.color.setHex(b.flash > 0 ? 0xffffff : 0xff6a4a);
  }
  for (const t of W.drones) {
    t.g.position.copy(t.p); t.g.position.y += Math.sin(time * 2 + t.phase) * 0.2;
    t.g.rotation.y = time * (t.chasing ? 3 : 1.3) + t.phase; t.inner.rotation.x = time * 2.4;
    t.flash -= dt; t.mat.color.setHex(t.flash > 0 ? 0xffffff : 0xffb347);
  }
}

export function updateBossBar(boss: Boss | null) {
  el.bossbar.style.display = boss ? 'block' : 'none';
  if (boss) { el.bossName.textContent = boss.name; el.bossFill.style.width = Math.max(0, boss.hp / boss.maxHp * 100) + '%'; }
}

// NPC combat uses the same armour/death paths, with the attacker's position and no player kill credit.
setCombatHooks({
  visible: (from, to) => { const d = to.clone().sub(from), n = d.length(); return n < 0.01 || rayWorld(from, d.divideScalar(n), n) >= n - 0.4; },
  hit: (target: CombatFoe, damage, source) => {
    const position = G.pos.clone(), flash = G.hitFlash;
    G.pos.copy(source.p);
    try { damageFoe(target as Foe, damage, false); } finally { G.pos.copy(position); G.hitFlash = flash; }
  },
});
