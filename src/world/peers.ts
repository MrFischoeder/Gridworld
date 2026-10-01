// The other players (multiplayer stage 1): a figure with a name label for everyone online who is in the same place
// as you (the open world, or the same dungeon sector), eased between the snapshots the server sends ten times a
// second, legs walking while they move, holding what they hold. Runtime only: nothing here is saved.
import * as THREE from 'three';
import { G } from '../game';
import { scene } from './render';
import { makeFigure, textSprite, type Figure } from './npc';
import { poseRig, type Kit } from './rig';
import { net, sendState, isHost, SEND_EVERY, type PeerState } from '../net/client';
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

interface Avatar { f: Figure; kit: Kit; away: boolean; label: THREE.Sprite; phase: number }
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
  const a: Avatar = { f, kit, away, label, phase: Math.random() * 6 };
  avatars.set(id, a);
  return a;
}

let sendT = 0;
/** Every frame: send where you are now and then, and draw the others. */
export function updatePeers(dt: number, moving: boolean) {
  if (!net.id) { for (const id of [...avatars.keys()]) drop(id); return; }
  if ((sendT -= dt) <= 0) {
    sendT = SEND_EVERY;
    const s: PeerState = { p: [G.pos.x, G.pos.y, G.pos.z], yaw: G.yaw, pitch: G.pitch, loc: myLoc(), held: G.char.hands[0]?.k ?? '', mv: moving && G.playing, away: !G.playing };
    sendState(s, isHost() ? G.char.time : undefined);
  }
  const here = myLoc(), now = performance.now();
  for (const id of [...avatars.keys()]) if (!net.peers.has(id)) drop(id);
  for (const p of net.peers.values()) {
    const s = p.st;
    if (!s || s.loc !== here) { drop(p.id); continue; }
    const a = avatar(p.id, p.name, kitOf(s.held), !!s.away);
    // ease from the previous snapshot to the last one over the time between them
    const k = Math.min(1, (now - p.at) / (SEND_EVERY * 1000)), q = p.prev && p.prev.loc === s.loc ? p.prev : s;
    const x = q.p[0] + (s.p[0] - q.p[0]) * k, y = q.p[1] + (s.p[1] - q.p[1]) * k, z = q.p[2] + (s.p[2] - q.p[2]) * k;
    a.f.g.position.set(here === 'o' ? nearX(x, G.pos.x) : x, y, z);
    let dy = s.yaw - q.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    a.f.g.rotation.y = q.yaw + dy * k + Math.PI; // the figure faces +z, the player looks along -z
    a.phase += dt * (s.mv ? 9 : 0);
    const sw = s.mv ? Math.sin(a.phase) * 0.5 : 0;
    a.f.legL.rotation.x = sw; a.f.legR.rotation.x = -sw;
    poseRig(a.f.rig, { swing: sw, aim: a.kit === 'rifle' || a.kit === 'pistol' ? Math.max(0, Math.min(1, 0.5 - s.pitch)) : 0 });
  }
}
/** Forget every figure (leaving the game, loading another place). */
export function clearPeers() { for (const id of [...avatars.keys()]) drop(id); }
