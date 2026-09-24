// Player movement: AABB against voxels, gravity and jumping.
import * as THREE from 'three';
import { G } from '../game';
import { rayVoxel, emptyAt as spaceEmptyAt, type Vec3Like } from '../core/voxel';
import { V } from './render';
import { STAMINA, BURN } from '../data/survival';
import { drainStamina, spendStamina, load, loadSpeed, burn } from './survival';

export const R = 0.3, H = 1.7, EYE = 1.55, EPS = 1e-4, GRAV = 20, JUMP = 7.2;
/** Log hook for water messages (set by the HUD owner; keeps this module free of UI imports). */
export let onWaterNote: (s: string) => void = () => {};
export const setWaterNote = (f: (s: string) => void) => { onWaterNote = f; };

export const MAX_SLOPE = 0.85, STEP_UP = 0.6;

/** Free point: no voxel there and above the terrain. */
export const emptyAt = (p: Vec3Like) => spaceEmptyAt(G.space, p) && !(G.ground && p.y < G.ground(p.x, p.z));

/** Distance along a (unit) ray to the terrain surface, marching in half-metre steps. */
function rayTerrain(o: Vec3Like, d: Vec3Like, maxT: number): number {
  const ground = G.ground!;
  for (let t = 0.5; t < maxT; t += 0.5) if (o.y + d.y * t < ground(o.x + d.x * t, o.z + d.z * t)) return t - 0.25;
  return maxT;
}
/** Distance along a ray to the first solid thing in the current location. */
export const rayWorld = (o: Vec3Like, d: Vec3Like, maxT: number) => {
  const v = rayVoxel(G.space, o, d, maxT);
  return G.ground ? Math.min(v, rayTerrain(o, d, v)) : v;
};

export function collides(p: THREE.Vector3): boolean {
  const x0 = Math.floor(p.x - R + EPS), x1 = Math.floor(p.x + R - EPS);
  const y0 = Math.floor(p.y + EPS), y1 = Math.floor(p.y + H - EPS);
  const z0 = Math.floor(p.z - R + EPS), z1 = Math.floor(p.z + R - EPS);
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) if (!G.space.empty(x, y, z)) return true;
  return !!G.obstacle && G.obstacle(p.x, p.y, p.z, R);
}
function moveAxis(ax: 'x' | 'y' | 'z', amt: number): boolean {
  if (!amt) return false;
  const pos = G.pos, n = Math.ceil(Math.abs(amt) / 0.2), s = amt / n, ground = ax !== 'y' ? G.ground : null;
  for (let i = 0; i < n; i++) {
    const g0 = ground ? ground(pos.x, pos.z) : 0, y0 = pos.y;
    pos[ax] += s;
    if (ground) {
      // walking on terrain: step up gentle slopes, refuse cliffs and very steep ground
      const g1 = ground(pos.x, pos.z);
      if (g1 > pos.y + 0.02) {
        if (g1 - pos.y > STEP_UP || (g1 - Math.max(g0, pos.y - 0.3)) / Math.abs(s) > MAX_SLOPE) { pos[ax] -= s; return true; }
        pos.y = g1;
      }
    }
    if (collides(pos)) { pos[ax] -= s; pos.y = y0; return true; }
  }
  return false;
}
/** Keeps the feet on the terrain: no sinking in, and no hopping off when walking downhill. */
function settleOnGround(wasOnGround: boolean) {
  const ground = G.ground, pos = G.pos, vel = G.vel;
  if (!ground) return;
  const gh = ground(pos.x, pos.z);
  if (pos.y < gh || (wasOnGround && vel.y <= 0 && pos.y - gh < 0.45)) {
    const y0 = pos.y; pos.y = gh;
    if (collides(pos)) { pos.y = y0; return; }
    if (vel.y < 0) vel.y = 0;
    G.onGround = true;
  }
}

/** Water deeper than this over the feet lifts the player off the bottom: swimming. */
export const SWIM_DEPTH = 1.2;
let toxicWarn = 0;
/** One physics step from input. Returns whether the player is walking (for view bob). */
export function updatePlayer(dt: number): boolean {
  const { keys, stick, vel, pos } = G;
  let f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0) - stick.dy, s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + stick.dx;
  const m = Math.hypot(f, s); if (m > 1) { f /= m; s /= m; }
  const moving = m > 0.1 && G.onGround;
  // water: wading slows you down, deeper water makes you swim (at the surface; diving comes later)
  const w = G.water ? G.water(pos.x, pos.z) : null, wet = w ? w.level - pos.y : 0;
  G.swimming = !!w && wet > SWIM_DEPTH;
  if (w && w.kind === 'toxic' && wet > 0.15 && !G.god) {
    G.hp -= 6 * dt; G.dmgFlash = Math.max(G.dmgFlash, 0.2);
    if ((toxicWarn -= dt) <= 0) { toxicWarn = 4; onWaterNote('The water burns your skin! Get out!'); }
  }
  // sprinting and swimming cost stamina; out of breath you can only walk (and swim slowly)
  // a heavy pack slows you down (and burns more); overloaded you cannot run or jump
  const L = load(), over = L.state === 'over';
  const wantSprint = (keys.ShiftLeft || keys.ShiftRight) && m > 0.1 && !G.swimming && !over;
  const sprint = wantSprint && drainStamina(STAMINA.sprint * (L.state === 'heavy' ? 1.4 : 1), dt);
  const swimTired = G.swimming && m > 0.1 && !drainStamina(STAMINA.swim, dt);
  const speed = (sprint ? 9 : 6) * G.S.speed * loadSpeed(L.kg) * (G.swimming ? (swimTired ? 0.25 : 0.45) : wet > 0.45 ? 0.65 : 1);
  G.activity = m < 0.1 || G.trans ? 1 : sprint ? BURN.sprint : G.swimming ? BURN.swim : BURN.walk;
  const fw = V(-Math.sin(G.yaw), 0, -Math.cos(G.yaw)), rt = V(Math.cos(G.yaw), 0, -Math.sin(G.yaw));
  const want = fw.multiplyScalar(f * speed).addScaledVector(rt, s * speed);
  const k = G.swimming ? 5 : G.onGround ? 14 : 3;
  vel.x += (want.x - vel.x) * Math.min(1, k * dt); vel.z += (want.z - vel.z) * Math.min(1, k * dt);
  if (G.swimming && w) {
    // float with the head above the surface
    const target = w.level - SWIM_DEPTH - 0.05;
    vel.y += ((target - pos.y) * 5 - vel.y) * Math.min(1, dt * 6);
  } else {
    if ((keys.Space || G.touchJump) && G.onGround && !over && spendStamina(STAMINA.jump)) { vel.y = JUMP * (wet > 0.45 ? 0.6 : 1); G.onGround = false; burn(BURN.jump); }
    vel.y -= GRAV * dt;
  }
  const was = G.onGround;
  if (moveAxis('x', vel.x * dt)) vel.x = 0;
  if (moveAxis('z', vel.z * dt)) vel.z = 0;
  G.onGround = false;
  if (moveAxis('y', vel.y * dt)) { if (vel.y < 0) { G.onGround = true; pos.y = Math.floor(pos.y + 0.001); } vel.y = 0; }
  if (!G.swimming) settleOnGround(was && vel.y <= 0);
  return moving;
}
