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
import { makeColumn, stepColumn, placeFar, clearView, dropColumn, CAMPFIRE, type Column } from './smokecolumn';

interface Smoke { x: number; y: number; z: number; left: number; seen: boolean; g: THREE.Group; near: THREE.Group; flames: THREE.LineSegments; column: Column }
const smokes: Smoke[] = [];

function make(x: number, z: number): Smoke | null {
  const y = groundAt(x, z);
  if (!isFinite(y) || OW.terrain?.water(x, z)) return null;
  const g = new THREE.Group(), near = new THREE.Group();
  const pb = new PropBatch();
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; pb.rock(x + Math.cos(a) * 0.55, y - 0.05, z + Math.sin(a) * 0.55, 0.18, 0.16, 4, a, GRID); }
  for (let i = 0; i < 3; i++) { const a = i / 3 * 3.14; pb.line(0xb8b060, [x + Math.cos(a) * 0.4, y + 0.05, z + Math.sin(a) * 0.4], [x - Math.cos(a) * 0.4, y + 0.05, z - Math.sin(a) * 0.4]); }
  near.add(pb.build());
  const flames = new THREE.LineSegments(new THREE.BufferGeometry(), addMat(0xffb347));
  flames.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(10 * 6), 3));
  flames.frustumCulled = false; flames.position.set(x, y, z); near.add(flames);
  const column = makeColumn(CAMPFIRE);
  g.add(near, column.g); scene.add(g);
  return { x, y, z, left: SMOKE.linger, seen: true, g, near, flames, column };
}
function drop(s: Smoke) {
  scene.remove(s.g); dropColumn(s.column);
  s.near.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
  smokes.splice(smokes.indexOf(s), 1);
}
/** Forget every fire (another place). */
export function clearRestSmoke() { for (const s of [...smokes]) drop(s); }
/** The fires burning now (the light map, the body's warmth). */
export const restFires = () => smokes.map((s) => ({ x: s.x, y: s.y + 0.8, z: s.z }));
addLights((out) => { for (const s of smokes) out.push({ x: s.x, y: s.y + 0.8, z: s.z, r: LIGHT.fire, k: 'fire' }); });
addGlows((out) => { for (const s of smokes) out.push({ x: s.x, y: s.y + 0.6, z: s.z, c: 0xffa850, s: 0.05, a: 0.8, far: SMOKE.glow }); });

let scanT = 0;
/** Every frame on the surface. */
export function updateRestSmoke(dt: number, time: number) {
  if (G.char.loc !== 'overworld' || !OW.terrain) { if (smokes.length) clearRestSmoke(); return; }
  if ((scanT -= dt) <= 0) {
    scanT = 0.5;
    const resting = W.bandits.filter((b) => b.mode === 'rest' && b.hp > 0);
    for (const s of smokes) s.left = resting.some((b) => Math.hypot(b.p.x - s.x, b.p.z - s.z) < SMOKE.join) ? SMOKE.linger : s.left - 0.5;
    for (const s of [...smokes]) if (s.left <= 0 || Math.hypot(s.x - G.pos.x, s.z - G.pos.z) > SMOKE.far + 200) drop(s);
    for (const s of smokes) s.seen = clearView(camera.position, s.x, s.y, s.z, 20, (x, z) => OW.terrain!.heightAt(x, z));
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
    s.near.visible = Math.hypot(s.x - p.x, s.y - p.y, s.z - p.z) < 160;
    const k = placeFar(s.column, s.x, s.y + 1, s.z, camera, edge);
    s.column.g.visible = k >= 1 || s.seen;
    stepColumn(s.column, dt, wx, wz, Math.min(1, s.left / SMOKE.linger * 1.5) * day * (1 - seen.fog * 0.4));
  }
}
