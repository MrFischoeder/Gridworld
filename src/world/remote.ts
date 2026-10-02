// Shared foes, the small part every foe module uses (world/foesync.ts runs the rest, without import loops).
// Every foe is run by one game, its owner: the player who was here first (a lower id, `spawnAuthority`). The others
// see it as a copy (`markRemote`) that only follows its owner's word (`stepRemote`); their shots go to the owner.
// The owner's foes go for the nearest player (`withTarget`): for a turn the foe sees that player where you are, and
// whatever it does to "you" in that turn is sent to them instead.
import * as THREE from 'three';
import { G } from '../game';

export interface RemoteFoe { owner: number; nid: number; x: number; y: number; z: number; h: number; hp: number; maxHp: number }
const remote = new WeakMap<object, RemoteFoe>();
/** A copy of another player's foe (its owner and id there, and where its owner last saw it). */
export const remoteOf = (o: object): RemoteFoe | undefined => remote.get(o);
export function markRemote(o: object, r: RemoteFoe) { remote.set(o, r); }
export function unmarkRemote(o: object) { remote.delete(o); }

/** Ease a copy towards where its owner last saw it; false if it is not a copy (run its own mind then). */
export function stepRemote(o: { p: THREE.Vector3; heading: number; speed: number; hp: number; maxHp: number }, dt: number): boolean {
  const r = remote.get(o);
  if (!r) return false;
  const k = Math.min(1, dt * 7), dx = r.x - o.p.x, dz = r.z - o.p.z;
  if (Math.hypot(dx, dz) > 30) o.p.set(r.x, r.y, r.z); // far behind (a jump, or just made): there at once
  else { o.p.x += dx * k; o.p.y += (r.y - o.p.y) * k; o.p.z += dz * k; }
  o.speed += (Math.hypot(dx, dz) * 7 - o.speed) * Math.min(1, dt * 4);
  let dh = r.h - o.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); o.heading += dh * k;
  o.hp = r.hp; o.maxHp = r.maxHp;
  return true;
}

// ---------- the players a foe can go for ----------
export interface Target { id: number; x: number; y: number; z: number }
let others: () => Target[] = () => [];
let hurtPeer: (id: number, dmg: number, armour: boolean) => void = () => {};
let authority: () => boolean = () => true;
let hit: (o: object, dmg: number) => void = () => {};
let bolt: (p: THREE.Vector3, v: THREE.Vector3, color: number) => void = () => {};
/** world/foesync.ts: who else is here, how to hurt them, whether your game spawns the foes here. */
export function setRemoteHooks(h: { others: () => Target[]; hurt: (id: number, dmg: number, armour: boolean) => void; authority: () => boolean; hit: (o: object, dmg: number) => void; bolt: (p: THREE.Vector3, v: THREE.Vector3, color: number) => void }) {
  others = h.others; hurtPeer = h.hurt; authority = h.authority; hit = h.hit; bolt = h.bolt;
}
/** Whether your game spawns the foes where you are (alone, or the first player here): the others see yours. */
export const spawnAuthority = () => authority();
/** The other players here (same place, in the game), for bolts and blasts that may hit them. */
export const otherPlayers = () => others();
/** You hit another player's foe: tell its owner. */
export const hitOwner = (o: object, dmg: number) => hit(o, dmg);
/** One of your foes fired a bolt (the others draw it). */
export const boltOut = (p: THREE.Vector3, v: THREE.Vector3, color: number) => bolt(p, v, color);
export const hurtOther = (id: number, dmg: number, armour = true) => hurtPeer(id, dmg, armour);

const saved = new THREE.Vector3(), savedVel = new THREE.Vector3();
let proxy = false;
/** True during a foe's turn against another player: your armour and your vehicle's cab do not count then. */
export const proxied = () => proxy;
/**
 * Run one foe's turn (`fn`) against the nearest player to (x, z). If that is another player, the foe sees them where
 * you stand for the turn, and the harm it does there goes to them (their armour reckoned there).
 */
export function withTarget(x: number, z: number, fn: () => void) {
  const ps = others();
  if (!ps.length) { fn(); return; }
  let best: Target | null = null, bd = Math.hypot(G.pos.x - x, G.pos.z - z);
  for (const p of ps) { const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = p; } }
  if (!best) { fn(); return; }
  saved.copy(G.pos); savedVel.copy(G.vel);
  const hp = G.hp, flash = G.dmgFlash;
  G.pos.set(best.x, best.y, best.z); proxy = true;
  try { fn(); } finally {
    const dmg = hp - G.hp;
    proxy = false;
    G.pos.copy(saved); G.vel.copy(savedVel); G.hp = hp; G.dmgFlash = flash;
    if (dmg > 0) hurtPeer(best.id, dmg, true); // their own armour is reckoned on their side
  }
}
