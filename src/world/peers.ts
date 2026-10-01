// The other players (multiplayer stage 1): a figure with a name label for everyone online who is in the same place
// as you (the open world, or the same dungeon sector), eased between the snapshots the server sends ten times a
// second, legs walking while they move, holding what they hold. Runtime only: nothing here is saved.
import * as THREE from 'three';
import { G } from '../game';
import { scene } from './render';
import { makeFigure, textSprite, type Figure } from './npc';
import { poseRig, type Kit } from './rig';
import { net, sendState, isHost, SEND_EVERY, type PeerState, type PeerCar, peerAt, PEER_DELAY } from '../net/client';
import { convoyModel, seatFigure, myCars, toLocalOf } from './vehicles';
import { VEHICLES, type VehicleModel } from '../data/vehicles';
import { nearX } from '../gen/regions';
import { dungeonKey } from '../character';
import { WEAPON_KIND, type ItemKey } from '../data/items';
import { gunOf } from '../data/weapons';

/** Each player's colour, by id (castaways' suits: none of them amber, red or gold, which mean danger or loot). */
const COLORS = [0x7dd3ff, 0xd8a8ff, 0xffffff, 0x9dffe0, 0xff9ad8, 0xa8c8ff, 0xc8ff9d, 0xffc8a8];
export const peerColor = (id: number) => COLORS[(id - 1) % COLORS.length];

/** Where you are, as the server hears it: 'o' for the open world, else the dungeon sector's key. */
export function myLoc(): string {
  return G.char.loc === 'overworld' ? 'o' : 'd:' + dungeonKey();
}
const kitOf = (held: string): Kit => {
  const k = held as ItemKey;
  if (WEAPON_KIND[k] === 0) return gunOf(k)?.look === 'pistol' ? 'pistol' : 'rifle';
  if (WEAPON_KIND[k] === 1) return k === 'spear' ? 'spear' : 'sword';
  if (k === 'pickaxe') return 'pick';
  if (k === 'hatchet' || k === 'hammer') return 'hammer';
  return 'none';
};

interface Avatar { f: Figure; kit: Kit; away: boolean; label: THREE.Sprite; phase: number; seated: boolean }
const avatars = new Map<number, Avatar>();
function drop(id: number) {
  const a = avatars.get(id);
  if (!a) return;
  scene.remove(a.f.g); (a.label.material as THREE.SpriteMaterial).map?.dispose(); a.label.material.dispose();
  avatars.delete(id);
}
function avatar(id: number, name: string, kit: Kit, away: boolean): Avatar {
  const old = avatars.get(id);
  if (old && old.kit === kit && old.away === away) return old;
  if (old) drop(id);
  // a player in the menu stays in the world (the others see them standing there), marked as away
  const c = peerColor(id), f = makeFigure(c, kit), label = textSprite(away ? name + ' (in menu)' : name, '#' + c.toString(16).padStart(6, '0'));
  label.position.y = 2.2; f.g.add(label);
  const a: Avatar = { f, kit, away, label, phase: Math.random() * 6, seated: false };
  avatars.set(id, a);
  return a;
}

let sendT = 0;
/** Every frame: send where you are now and then, and draw the others. */
export function updatePeers(dt: number, moving: boolean) {
  if (!net.id) { for (const id of [...avatars.keys()]) drop(id); return; }
  if ((sendT -= dt) <= 0) {
    sendT = SEND_EVERY;
    const s: PeerState = { p: [G.pos.x, G.pos.y, G.pos.z], yaw: G.yaw, pitch: G.pitch, loc: myLoc(), held: G.char.hands[0]?.k ?? '', mv: moving && G.playing, away: !G.playing, cars: myCars() };
    sendState(s, isHost() ? G.char.time : undefined);
  }
  const here = myLoc(), now = performance.now();
  for (const id of [...avatars.keys()]) if (!net.peers.has(id)) drop(id);
  syncCars(here, now);
  for (const p of net.peers.values()) {
    const s = p.st;
    if (!s || s.loc !== here) { drop(p.id); continue; }
    const a = avatar(p.id, p.name, kitOf(s.held), !!s.away);
    // drawn a little in the past, between the two snapshots round that moment, so the motion stays smooth when packets
    // come unevenly
    const at = peerAt(p, now - PEER_DELAY)!, k = at.k, q = at.a.loc === here ? at.a : s, e = at.b.loc === here ? at.b : s;
    const x = q.p[0] + (e.p[0] - q.p[0]) * k, y = q.p[1] + (e.p[1] - q.p[1]) * k, z = q.p[2] + (e.p[2] - q.p[2]) * k;
    a.f.g.position.set(here === 'o' ? nearX(x, G.pos.x) : x, y, z);
    let dy = e.yaw - q.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    a.f.g.rotation.y = q.yaw + dy * k + Math.PI; // the figure faces +z, the player looks along -z
    // driving: their figure sits in their car (drawn with the car below), only the name stays over it
    const seated = here === 'o' && !!e.cars?.some((c) => c[8]);
    if (seated !== a.seated) { a.seated = seated; for (const o of a.f.g.children) if (o !== a.label) o.visible = !seated; }
    if (seated) continue;
    a.phase += dt * (s.mv ? 9 : 0);
    const sw = s.mv ? Math.sin(a.phase) * 0.5 : 0;
    a.f.legL.rotation.x = sw; a.f.legR.rotation.x = -sw;
    poseRig(a.f.rig, { swing: sw, aim: a.kit === 'rifle' || a.kit === 'pistol' ? Math.max(0, Math.min(1, 0.5 - s.pitch)) : 0 });
  }
}
/** Forget every figure (leaving the game, loading another place). */
export function clearPeers() { for (const id of [...avatars.keys()]) drop(id); for (const k of [...ghosts.keys()]) dropGhost(k); }

// ---------- the others' vehicles ----------
// Every player sends where their own vehicles stand (and which one they drive); here each is drawn as a body with
// wheels (and the cannon), the driver in the seat, eased between snapshots while it moves. They block you and your
// vehicle like any other, but only their owner can drive them, open the trunk or service them.
interface Ghost { g: THREE.Group; m: VehicleModel; gun: boolean; driver: Figure | null; x: number; y: number; z: number; h: number; p: number; r: number }
const ghosts = new Map<string, Ghost>();
const MODELS: VehicleModel[] = ['scout', 'mastodon'];
function dropGhost(k: string) {
  const g = ghosts.get(k);
  if (!g) return;
  scene.remove(g.g); ghosts.delete(k);
}
const lerpAng = (a: number, b: number, k: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
function syncCars(here: string, now: number) {
  const seen = new Set<string>();
  if (here === 'o') for (const p of net.peers.values()) {
    const at = peerAt(p, now - PEER_DELAY), cars = at?.b.cars;
    if (!at || !cars) continue;
    const k = at.k, prev = at.a.cars;
    cars.forEach((c: PeerCar, i) => {
      const m = MODELS[c[0]] ?? 'scout', gun = !!c[7], key = p.id + ':' + i;
      seen.add(key);
      let g = ghosts.get(key);
      if (g && (g.m !== m || g.gun !== gun)) { dropGhost(key); g = undefined; }
      if (!g) { g = { g: convoyModel(m, gun).g, m, gun, driver: null, x: c[1], y: c[2], z: c[3], h: c[4], p: c[5], r: c[6] }; scene.add(g.g); ghosts.set(key, g); }
      const q = prev?.[i] && prev[i][0] === c[0] ? prev[i] : c;
      g.x = q[1] + (c[1] - q[1]) * k; g.y = q[2] + (c[2] - q[2]) * k; g.z = q[3] + (c[3] - q[3]) * k;
      g.h = lerpAng(q[4], c[4], k); g.p = q[5] + (c[5] - q[5]) * k; g.r = q[6] + (c[6] - q[6]) * k;
      g.x = nearX(g.x, G.pos.x);
      g.g.position.set(g.x, g.y - 0.05, g.z);
      g.g.rotation.set(-g.p, g.h, g.r, 'YXZ');
      const driven = !!c[8];
      if (driven && !g.driver) { g.driver = seatFigure(m, 0, peerColor(p.id)); g.g.add(g.driver.g); }
      else if (!driven && g.driver) { g.g.remove(g.driver.g); g.driver = null; }
    });
  }
  for (const k of [...ghosts.keys()]) if (!seen.has(k)) dropGhost(k);
}
/** Another player's vehicle in the way (for you on foot and for your vehicle). */
export function peerCarHit(x: number, y: number, z: number, r: number): boolean {
  for (const g of ghosts.values()) {
    const s = VEHICLES[g.m];
    if (y > g.y + s.height || y + 1.7 < g.y) continue;
    const [lx, lz] = toLocalOf(g.h, g.x, g.z, x, z);
    if (Math.abs(lx) < s.width / 2 + r && Math.abs(lz) < s.length / 2 + r) return true;
  }
  return false;
}
