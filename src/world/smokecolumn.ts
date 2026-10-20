// (0.237.1) A column of smoke made of soft sprites rising, swelling and drifting with the wind: the bandits' fires
// (world/restsmoke.ts), the crashed ship (world/crashpod.ts) and its shot in the opening film (ui/cinematic.ts).
// A far column can be drawn nearer at the same angle (`placeFar`), like the far lights of world/glows.ts, so it shows
// past the camera's reach; `clearView` says whether the land hides it then. Only three.js, no game state.
import * as THREE from 'three';
import { SMOKE } from '../gen/warnings';

export interface ColumnLook {
  /** puffs at once, seconds a puff lives, metres a second it rises, its size at the start and growth a second */
  puffs: number; life: number; rise: number; size: number; grow: number;
  /** colour and the most a puff shows (0..1) */
  c: number; op: number;
}
export const CAMPFIRE: ColumnLook = { puffs: SMOKE.puffs, life: SMOKE.life, rise: SMOKE.rise, size: 3, grow: 0.75, c: 0x5f6a5c, op: 0.85 };
/** The crashed ship's: a big dark column from the gash in the roof, a thinner one from the crumpled engine. */
export const WRECK_SMOKE: ColumnLook = { puffs: 18, life: 26, rise: 2.2, size: 2.4, grow: 0.9, c: 0x4a524a, op: 0.85 };
export const ENGINE_SMOKE: ColumnLook = { puffs: 10, life: 16, rise: 1.6, size: 1.6, grow: 0.6, c: 0x5a6258, op: 0.7 };
/** Where they leave the hull (ship-local x to starboard, y up, z to the nose; world/lander.ts). */
export const WRECK_VENTS: { at: [number, number, number]; look: ColumnLook }[] = [
  { at: [0.9, 3, -1.5], look: WRECK_SMOKE },
  { at: [1.5, 2.6, -10.6], look: ENGINE_SMOKE },
];
export interface Column { g: THREE.Group; puffs: THREE.Sprite[]; age: number[]; look: ColumnLook }

const tex = (() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d')!, r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,0.9)'); r.addColorStop(0.5, 'rgba(255,255,255,0.45)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
})();

/** A new column (its group's origin is where the smoke leaves the ground or the wreck). */
export function makeColumn(look: ColumnLook = CAMPFIRE): Column {
  const g = new THREE.Group(), puffs: THREE.Sprite[] = [], age: number[] = [];
  for (let i = 0; i < look.puffs; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: look.c, transparent: true, depthWrite: false, fog: false, opacity: 0 }));
    s.frustumCulled = false; g.add(s); puffs.push(s); age.push(i / look.puffs * look.life);
  }
  return { g, puffs, age, look };
}
/** Move the puffs on by `dt` s: rising, swelling, carried by the wind (wx, wz m/s), shown at `alpha` (0..1). */
export function stepColumn(c: Column, dt: number, wx: number, wz: number, alpha: number) {
  const L = c.look;
  c.puffs.forEach((pf, i) => {
    let a = c.age[i] + dt; if (a > L.life) a -= L.life; c.age[i] = a;
    const f = a / L.life;
    pf.position.set(wx * a * (0.4 + f), a * L.rise, wz * a * (0.4 + f));
    pf.scale.setScalar(L.size + a * L.grow);
    (pf.material as THREE.SpriteMaterial).opacity = L.op * Math.sin(Math.PI * Math.min(1, f * 1.15)) * alpha;
  });
}
/** Put the column whose foot is at (x, y, z) where `cam` sees it: there when near, nearer and smaller at the same
 *  angle beyond `edge` m (then over the ground: no depth test). Returns the scale used (1 = in place). */
export function placeFar(c: Column, x: number, y: number, z: number, cam: THREE.Camera, edge: number): number {
  const p = cam.position, d = Math.hypot(x - p.x, y - p.y, z - p.z), k = d > edge ? edge / d : 1;
  c.g.position.set(p.x + (x - p.x) * k, p.y + (y - p.y) * k, p.z + (z - p.z) * k);
  c.g.scale.setScalar(k);
  for (const pf of c.puffs) (pf.material as THREE.SpriteMaterial).depthTest = k >= 1;
  return k;
}
/** Whether a column's middle (`top` m up) at (x, y, z) shows over the land between `from` and it (sampled every 15 m
 *  on `ground`): a far column is drawn over everything, so the hills that hide it are checked here. */
export function clearView(from: THREE.Vector3, x: number, y: number, z: number, top: number, ground: (x: number, z: number) => number): boolean {
  const mid = y + top, dx = x - from.x, dz = z - from.z, L = Math.hypot(dx, dz);
  for (let d = 15; d < L - 20; d += 15) { const f = d / L; if (ground(from.x + dx * f, from.z + dz * f) > from.y + (mid - from.y) * f) return false; }
  return true;
}
export function dropColumn(c: Column) {
  c.g.parent?.remove(c.g);
  for (const pf of c.puffs) (pf.material as THREE.Material).dispose();
}
