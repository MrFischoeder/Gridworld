// Sneaking at runtime: crouching, how visible you are now, and what every foe has made out of you. Each foe keeps an
// awareness (gen/stealth.ts) that climbs while you are in its sight and sinks when you are out of it, with the spot it
// last saw you. The minds of bandits, robots, creatures and drones ask `sense` instead of a bare line of sight: they
// notice you later when you crouch, keep still, stay in the dark or the fog, and once they have lost you they go to
// where they saw you last, look round and give up. Multiplayer: a foe is run by one game (its owner); when its turn
// is against another player it reads that player's visibility from their `PeerState.vis` (world/remote.ts targetPeer).
import * as THREE from 'three';
import { G } from '../game';
import { daylight, sunTilt } from '../core/time';
import { latitude } from '../gen/regions';
import { visibility, reach, awareness, atOnce, STEALTH, SNEAK } from '../gen/stealth';
import { seen as sky } from './weather';
import { rayWorld } from './player';
import { proxied, targetingFoe, targetPeer } from './remote';
import { net } from '../net/client';
import { showToast } from '../ui/hud';

export interface Mind {
  /** 0 nothing there .. 1 spotted. */
  aware: number;
  /** Where it last saw (or heard) you, and how long ago it last saw you (s). */
  last: THREE.Vector3 | null; lost: number;
  /** Whether it saw you this turn. */
  sees: boolean;
}
const minds = new WeakMap<object, Mind>();
export function mindOf(f: object): Mind {
  let m = minds.get(f);
  if (!m) { m = { aware: 0, last: null, lost: Infinity, sees: false }; minds.set(f, m); }
  return m;
}

// ---------- you ----------
let shotT = Infinity, vis = 1;
/** A shot: muzzle flashes give you away for a moment. */
export function noteShot() { shotT = 0; }
/** C or Ctrl toggles crouching (it stays until pressed again). Not while flying, driving, riding, boating, swimming or climbing. */
export function toggleCrouch() { G.crouch = !G.crouch; }
/** How visible you are now (1 = walking upright in daylight). */
export const myVis = () => vis;
function work(): number {
  const under = G.char.loc !== 'overworld', light = under ? 0 : daylight(G.char.time, sunTilt(latitude(G.pos.z)));
  const speed = Math.hypot(G.vel.x, G.vel.z);
  return visibility({ crouch: G.crouch, speed, sprint: speed > 7.5, light, under, fog: under ? 0 : sky.fog, rain: under ? 0 : sky.rain, shot: shotT });
}
/** The visibility of whoever the current foe's turn is against: you, another player (as they last told), or a foe (fully). */
export function targetVis(): number {
  if (targetingFoe()) return 1;
  if (proxied()) { const st = net.peers.get(targetPeer())?.st; return typeof st?.vis === 'number' ? st.vis : 1; }
  return vis;
}
/** Where to aim at the current target's chest (lower when they crouch). */
export const aimHeight = () => (targetCrouched() ? 0.7 : 1.1);
/** Whether the target is making noise moving (upright and walking). */
function targetLoud(): boolean {
  if (targetingFoe()) return true;
  if (proxied()) { const st = net.peers.get(targetPeer())?.st; return !!st?.mv && !st.cr; }
  return !G.crouch && Math.hypot(G.vel.x, G.vel.z) > 0.5;
}
const targetCrouched = () => (targetingFoe() ? false : proxied() ? !!net.peers.get(targetPeer())?.st?.cr : G.crouch);

// what the foes running in your game make of you this frame (for the HUD)
let peak = 0, spotted = false, peakNext = 0, spottedNext = false;

/**
 * One foe looks for its target (G.pos during its turn). `eye` = where it looks from, `heading` = where it faces
 * (0 = +z, as three.js rotation.y), `sight` its plain range, `hunting` whether it is already after you.
 * Returns whether it sees the target now; its mind keeps the awareness and the last spot.
 */
export function sense(f: object, eye: THREE.Vector3, heading: number, sight: number, dt: number, hunting: boolean): boolean {
  const m = mindOf(f), crouched = targetCrouched();
  const tx = G.pos.x, ty = G.pos.y + (crouched ? 0.7 : 1.1), tz = G.pos.z;
  const dx = tx - eye.x, dy = ty - eye.y, dz = tz - eye.z, dist = Math.hypot(dx, dy, dz), flat = Math.hypot(dx, dz) || 1;
  const facing = (Math.sin(heading) * dx + Math.cos(heading) * dz) / flat;
  const range = reach(sight, targetVis(), facing, hunting), close = atOnce(dist, facing, hunting, targetLoud());
  let sees = false;
  if (dist < range || close) {
    const d = new THREE.Vector3(dx / dist, dy / dist, dz / dist);
    sees = rayWorld(eye, d, dist) >= dist - 0.5;
  }
  m.aware = awareness(m.aware, dt, sees, dist, range, hunting, close);
  m.sees = sees;
  if (sees) { m.last = (m.last ?? new THREE.Vector3()).set(tx, G.pos.y, tz); m.lost = 0; } else m.lost += dt;
  if (!proxied() && !targetingFoe()) { peakNext = Math.max(peakNext, Math.min(1, m.aware)); if (sees && hunting) spottedNext = true; }
  return sees;
}
/** The foe heard something at `at` (a shot, a fight): it now knows where to look. */
export function heard(f: object, at: THREE.Vector3, how = 0.6) {
  const m = mindOf(f);
  m.last = (m.last ?? new THREE.Vector3()).copy(at); m.lost = Math.min(m.lost, 0.5); m.aware = Math.max(m.aware, how);
}
/** Tell a whole group where the target is (they call out to each other). */
export function share(group: readonly object[], from: object) {
  const src = mindOf(from);
  if (!src.last) return;
  for (const g of group) if (g !== from) { const m = mindOf(g); m.last = (m.last ?? new THREE.Vector3()).copy(src.last); m.lost = Math.min(m.lost, src.lost); m.aware = Math.max(m.aware, src.aware); }
}
let toldAt = -1e9;
/** A foe has just made you out (in your own game, against you): say so, now and then. */
export function spottedBy(_f: object) {
  const now = performance.now();
  if (now - toldAt > 8000) { toldAt = now; showToast('Spotted!'); }
}
/** Whether a foe has not made you out: a blow or shot on it then is a sneak attack. */
export const unaware = (f: object, engaged: boolean) => !engaged && mindOf(f).aware < STEALTH.spotted;
export const sneakBonus = (melee: boolean) => (melee ? SNEAK.melee : SNEAK.gun);

// ---------- the HUD ----------
const box = document.getElementById('stealth');
let shown = '';
/** Every frame: your visibility, the crouch lock, and the meter of how much the foes around have made out. */
export function updateStealth(dt: number, free: boolean) {
  shotT += dt;
  if (!free && G.crouch) G.crouch = false; // in a vehicle, a boat, the water or on a ladder you stand
  vis = work();
  peak = peakNext; spotted = spottedNext; peakNext = 0; spottedNext = false;
  if (!box) return;
  const state = spotted ? 'spotted' : peak >= STEALTH.suspicious ? 'suspicious' : peak > 0.02 ? 'noticed' : 'hidden';
  const show = G.playing && (G.crouch || state !== 'hidden');
  const text = !show ? '' : `${G.crouch ? 'CROUCHED · ' : ''}seen ${Math.round(vis * 100)}% · ${state === 'spotted' ? '! SPOTTED' : state === 'suspicious' ? '? SUSPICIOUS' : state === 'noticed' ? '… something stirs' : 'unseen'}`;
  if (text !== shown) { shown = text; box.textContent = text; box.className = state; box.style.display = text ? 'block' : 'none'; }
  const bar = Math.round(Math.min(1, peak) * 100);
  box.style.setProperty('--aware', bar + '%');
}
