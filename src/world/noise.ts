// Noise: gunfire and other loud things are heard by whatever lives around. There is no audio yet, but the world
// reacts as if there were: creatures come to see what made the sound, bandits and drones take up the hunt, and a
// long fight draws more creatures in from the wilds. A suppressor keeps the circle small.
import * as THREE from 'three';

type Listener = (at: THREE.Vector3, radius: number, decoy: boolean) => void;
const listeners: Listener[] = [];
/** Something that reacts to noise (creatures, bandits, drones). */
export const onNoise = (f: Listener) => { listeners.push(f); };
/** A sound heard up to `radius` metres away from `at`; `decoy` = a thrown stone or flare (world/throwing.ts): foes go to
 *  look, but it does not stir up the wilds the way gunfire does. */
export function makeNoise(at: THREE.Vector3, radius: number, decoy = false) {
  if (radius <= 0) return;
  for (const f of listeners) f(at, radius, decoy);
}
