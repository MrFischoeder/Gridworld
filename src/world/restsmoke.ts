// (0.237, PLAN_SPAWNOW.md stage L4) Bandits lying in wait by a road (world/intents.ts 'wait': `mode` 'rest') sit at
// a small fire: its smoke rises in a column seen from far off (drawn nearer at the same angle when it is past the
// camera's reach, like the far lights of world/glows.ts) and by night its glow shows. The fire smokes on a minute
// after they have gone. Every game finds the resting bandits in its own lists (the owner's and the copies, whose
// `mode` the owner sends), so every player sees the same smoke and nothing new is sent.
import * as THREE from 'three';
import { G, W } from '../game';
import { scene, camera, add as addMat, GRID } from './render';
import { OW, groundAt } from './overworld';
import { flicker } from './cooking';
import { addLights, addGlows } from './light';
import { seen } from './weather';
import { PropBatch } from './props';
import { daylight, sunTilt } from '../core/time';
import { latitude } from '../gen/regions';
import { LIGHT } from '../gen/darkness';
import { SMOKE } from '../gen/warnings';

interface Smoke { x: number; y: number; z: number; left: number; seen: boolean; g: THREE.Group; near: THREE.Group; puffs: THREE.Sprite[]; age: number[]; flames: THREE.LineSegments; column: THREE.Group }
const smokes: Smoke[] = [];
const tex = (() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d')!, r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,0.9)'); r.addColorStop(0.5, 'rgba(255,255,255,0.45)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
})();
const puffMat = () => new THREE.SpriteMaterial({ map: tex, color: 0x5f6a5c, transparent: true, depthWrite: false, fog: false, opacity: 0.5 });

function make(x: number, z: number): Smoke | null {
  const y = groundAt(x, z);
  if (!isFinite(y) || OW.terrain?.water(x, z)) return null;
  const g = new THREE.Group(), near = new THREE.Group(), column = new THREE.Group();
  const pb = new PropBatch();
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; pb.rock(x + Math.cos(a) * 0.55, y - 0.05, z + Math.sin(a) * 0.55, 0.18, 0.16, 4, a, GRID); }
  for (let i = 0; i < 3; i++) { const a = i / 3 * 3.14; pb.line(0xb8b060, [x + Math.cos(a) * 0.4, y + 0.05, z + Math.sin(a) * 0.4], [x - Math.cos(a) * 0.4, y + 0.05, z - Math.sin(a) * 0.4]); }
  near.add(pb.build());
  const flames = new THREE.LineSegments(new THREE.BufferGeometry(), addMat(0xffb347));
  flames.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(10 * 6), 3));
  flames.frustumCulled = false; flames.position.set(x, y, z); near.add(flames);
  const puffs: THREE.Sprite[] = [], age: number[] = [];
  for (let i = 0; i < SMOKE.puffs; i++) { const s = new THREE.Sprite(puffMat()); column.add(s); puffs.push(s); age.push(i / SMOKE.puffs * SMOKE.life); }
  g.add(near, column); scene.add(g);
  return { x, y, z, left: SMOKE.linger, seen: true, g, near, puffs, age, flames, column };
}
function drop(s: Smoke) {
  scene.remove(s.g);
  s.g.traverse((o) => { (o as THREE.Mesh).geometry?.dispose(); const m = (o as THREE.Sprite).material as THREE.Material | undefined; if (o instanceof THREE.Sprite) m?.dispose(); });
  smokes.splice(smokes.indexOf(s), 1);
}
/** Forget every fire (another place). */
export function clearRestSmoke() { for (const s of [...smokes]) drop(s); }
/** The fires burning now (the light map, the body's warmth). */
export const restFires = () => smokes.map((s) => ({ x: s.x, y: s.y + 0.8, z: s.z }));
addLights((out) => { for (const s of smokes) out.push({ x: s.x, y: s.y + 0.8, z: s.z, r: LIGHT.fire, k: 'fire' }); });
addGlows((out) => { for (const s of smokes) out.push({ x: s.x, y: s.y + 0.6, z: s.z, c: 0xffa850, s: 0.05, a: 0.8, far: SMOKE.glow }); });

/** Whether the column's middle shows over the land between you and it (sampled every 15 m on the natural ground):
 *  a far column is drawn nearer and over everything, so the hills that hide it are checked here. */
function clearView(s: Smoke): boolean {
  const p = camera.position, t = OW.terrain!, top = s.y + 20, dx = s.x - p.x, dz = s.z - p.z, L = Math.hypot(dx, dz);
  for (let d = 15; d < L - 20; d += 15) { const f = d / L; if (t.heightAt(p.x + dx * f, p.z + dz * f) > p.y + (top - p.y) * f) return false; }
  return true;
}
let scanT = 0;
const tmp = new THREE.Vector3();
/** Every frame on the surface. */
export function updateRestSmoke(dt: number, time: number) {
  if (G.char.loc !== 'overworld' || !OW.terrain) { if (smokes.length) clearRestSmoke(); return; }
  if ((scanT -= dt) <= 0) {
    scanT = 0.5;
    const resting = W.bandits.filter((b) => b.mode === 'rest' && b.hp > 0);
    for (const s of smokes) s.left = resting.some((b) => Math.hypot(b.p.x - s.x, b.p.z - s.z) < SMOKE.join) ? SMOKE.linger : s.left - 0.5;
    for (const s of [...smokes]) if (s.left <= 0 || Math.hypot(s.x - G.pos.x, s.z - G.pos.z) > SMOKE.far + 200) drop(s);
    for (const s of smokes) s.seen = clearView(s);
    for (const b of resting) {
      if (smokes.some((s) => Math.hypot(b.p.x - s.x, b.p.z - s.z) < SMOKE.join)) continue;
      const a = b.heading, s = make(b.p.x + Math.sin(a) * 1.6, b.p.z + Math.cos(a) * 1.6); // just ahead of the first to sit down
      if (s) smokes.push(s);
    }
  }
  const wx = Math.cos(seen.windDir) * (0.3 + seen.wind), wz = Math.sin(seen.windDir) * (0.3 + seen.wind), p = camera.position;
  const edge = Math.min(camera.far * 0.9, 130), day = Math.min(1, daylight(G.char.time, sunTilt(latitude(G.pos.z))) * 1.6); // grey smoke shows by day; by night the glow does
  for (const s of smokes) {
    flicker(s.flames, time + s.x, Math.min(1, s.left / 20 + 0.3));
    const d = Math.hypot(s.x - p.x, s.y - p.y, s.z - p.z), k = d > edge ? edge / d : 1;
    s.near.visible = d < 160;
    // the column: built round the fire, then drawn nearer and smaller when far (the same angle on the screen)
    tmp.set(s.x - p.x, s.y - p.y, s.z - p.z).multiplyScalar(k).add(p);
    s.column.position.copy(tmp); s.column.scale.setScalar(k);
    s.column.visible = k >= 1 || s.seen;
    for (const pf of s.puffs) (pf.material as THREE.SpriteMaterial).depthTest = k >= 1; // drawn nearer than it is: over the ground
    const fade = Math.min(1, s.left / SMOKE.linger * 1.5);
    s.puffs.forEach((pf, i) => {
      let a = s.age[i] + dt; if (a > SMOKE.life) a -= SMOKE.life; s.age[i] = a;
      const f = a / SMOKE.life;
      pf.position.set(wx * a * (0.4 + f), 1 + a * SMOKE.rise, wz * a * (0.4 + f));
      pf.scale.setScalar(3 + a * 0.75);
      (pf.material as THREE.SpriteMaterial).opacity = 0.85 * Math.sin(Math.PI * Math.min(1, f * 1.15)) * fade * day * (1 - seen.fog * 0.4);
    });
  }
}
