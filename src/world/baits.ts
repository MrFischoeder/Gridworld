// (0.225, stage W4) Meat thrown on the ground: the hungry beasts (Ravagers and Gnawers) smell it, go to it and feed
// with their heads down, their backs to the world, until it is gone or something hurts or startles them. Runtime only:
// every game that saw the throw lays its own bait for the same time (world/throwing.ts), so each game's own beasts
// go to it.
import * as THREE from 'three';
import { scene } from './render';
import { THROW } from '../gen/throwing';

export interface Bait { p: THREE.Vector3; t: number; m: THREE.Object3D }
export const baits: Bait[] = [];
export function addBait(p: THREE.Vector3, m: THREE.Object3D) { baits.push({ p: p.clone(), t: THROW.bait.life, m }); }
/** The nearest bait within r of (x, z), if any. */
export function baitNear(x: number, z: number, r: number): Bait | null {
  let best: Bait | null = null, bd = r;
  for (const b of baits) { const d = Math.hypot(b.p.x - x, b.p.z - z); if (d < bd) { bd = d; best = b; } }
  return best;
}
export const baitAlive = (b: Bait) => baits.includes(b);
export function updateBaits(dt: number) {
  for (let i = baits.length - 1; i >= 0; i--) {
    const b = baits[i];
    if ((b.t -= dt) > 0) continue;
    scene.remove(b.m); baits.splice(i, 1);
  }
}
export function clearBaits() { for (const b of baits) scene.remove(b.m); baits.length = 0; }
/** (0.228, stage W6) Where fire burns this frame (flares lying lit, torches in the players' hands): the beasts fear it. */
export const fires: THREE.Vector3[] = [];
