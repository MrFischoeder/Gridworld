// (0.204, the owner's rule) Lights are seen from afar. A light lights the ground only within its own small reach
// (world/light.ts and the shaders), but the light itself, a lamp, a fire, another player's torch or headlights, a
// lighthouse's flash, shows as a bright point from far off in the dark. The points are fog-free sprites of a fixed size
// on the screen; one further than `GLOW.edge` (inside the far peaks' ring and the camera's reach) is drawn at that
// distance in its true direction, so the view's limit does not hide it (hills and walls nearer than that still do). Shown once it is dark enough (or below
// ground). Purely what you see: nothing is sent or saved.
import * as THREE from 'three';
import { camera, scene } from './render';

/** A point of light: where, its colour, its size on the screen (fraction of the view's height) and brightness. */
export interface Glow { x: number; y: number; z: number; c: number; s: number; a: number; /** seen this far (m; default `GLOW.far`) */ far?: number }
/** How far a light is seen at most (m), how many points at once, the nearest a point is drawn (the lamp's own head shows nearer), and where the far ones are drawn. */
export const GLOW = { far: 2500, max: 64, near: 6, edge: 130 };

const tex = (() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d')!, r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.18, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,0.45)'); r.addColorStop(0.65, 'rgba(255,255,255,0.1)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const pool: THREE.Sprite[] = [];
const tmp = new THREE.Vector3();
function sprite(i: number): THREE.Sprite {
  let s = pool[i];
  if (!s) {
    s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, fog: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: false }));
    s.renderOrder = 5; s.frustumCulled = false; pool[i] = s; scene.add(s);
  }
  return s;
}
/** Once a frame (world/light.ts): draw the given points, nearest first; `show` 0..1 fades them all (daylight). */
export function drawGlows(list: Glow[], show: number) {
  const p = camera.position, edge = Math.min(camera.far * 0.9, GLOW.edge);
  const near = show > 0.02 ? list.map((g) => ({ g, d: Math.hypot(g.x - p.x, g.y - p.y, g.z - p.z) })).filter((e) => e.d > GLOW.near && e.d < (e.g.far ?? GLOW.far) && e.g.a > 0.01).sort((a, b) => a.d - b.d).slice(0, GLOW.max) : [];
  near.forEach(({ g, d }, i) => {
    const s = sprite(i), k = d > edge ? edge / d : 1;
    tmp.set(g.x - p.x, g.y - p.y, g.z - p.z).multiplyScalar(k).add(p);
    s.position.copy(tmp);
    const size = g.s * Math.max(0.55, Math.min(1, 1.25 - d / 3000));
    s.scale.set(size, size, 1);
    const m = s.material; m.color.setHex(g.c); m.opacity = Math.min(1, g.a * show);
    s.visible = true;
  });
  for (let i = near.length; i < pool.length; i++) pool[i].visible = false;
}
export function hideGlows() { for (const s of pool) s.visible = false; }
