// Campfires and cooking: a Fire Kit lights a fire at your feet for a few minutes; at any fire (yours or a bandit
// camp's) E roasts all the raw meat in your backpack. Fires are effects: they are not saved.
import * as THREE from 'three';
import { scene, V, GRID } from './render';
import { add as addMat } from './render';
import { G } from '../game';
import { PropBatch } from './props';
import { FIRE_LIFE } from '../data/survival';
import { takeOne, saveChar } from '../character';
import { putItems } from '../inventory';
import { logLine, showToast } from '../ui/hud';
import { OW, groundAt, campFires } from './overworld';
import { makeNoise } from './noise';

interface Fire { x: number; y: number; z: number; t: number; g: THREE.Group; flames: THREE.LineSegments }
const fires: Fire[] = [];

function flamesObj() {
  const f = new THREE.LineSegments(new THREE.BufferGeometry(), addMat(0xffb347));
  f.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(10 * 6), 3));
  f.frustumCulled = false;
  return f;
}
/** The flickering tongues of a fire (shared with the bandit camps' fires). */
export function flicker(f: THREE.LineSegments, time: number, scale = 1) {
  const a = f.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < 10; i++) {
    const ang = i / 10 * 6.283 + time * 0.7, r = (0.25 + 0.2 * Math.sin(time * 5 + i)) * scale, h = (0.6 + 0.5 * Math.abs(Math.sin(time * 7 + i * 1.7))) * scale;
    a.setXYZ(i * 2, Math.cos(ang) * r, 0.05, Math.sin(ang) * r);
    a.setXYZ(i * 2 + 1, Math.cos(ang + 0.6) * r * 0.2, h, Math.sin(ang + 0.6) * r * 0.2);
  }
  a.needsUpdate = true;
}

/** Use a Fire Kit: a small fire of sticks and stones a step ahead of you. */
export function lightFire(): boolean {
  if (G.char.loc !== 'overworld' || !OW.terrain) { logLine('You need open sky to light a fire.'); return false; }
  if (OW.terrain.water(G.pos.x, G.pos.z)) { logLine('Not in the water.'); return false; }
  const x = G.pos.x - Math.sin(G.yaw) * 1.4, z = G.pos.z - Math.cos(G.yaw) * 1.4, y = groundAt(x, z);
  if (!isFinite(y) || Math.abs(y - G.pos.y) > 1.2 || OW.terrain.water(x, z)) { logLine('No good spot for a fire here.'); return false; }
  if (!takeOne('firekit')) return false;
  const pb = new PropBatch();
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; pb.rock(x + Math.cos(a) * 0.6, y - 0.05, z + Math.sin(a) * 0.6, 0.2, 0.18, 4, a, GRID); }
  for (let i = 0; i < 3; i++) { const a = i / 3 * 3.14; pb.line(0xb8b060, [x + Math.cos(a) * 0.45, y + 0.05, z + Math.sin(a) * 0.45], [x - Math.cos(a) * 0.45, y + 0.05, z - Math.sin(a) * 0.45]); }
  const g = pb.build(), flames = flamesObj();
  flames.position.set(x, y, z); g.add(flames); scene.add(g);
  if (fires.length >= 3) dropFire(fires[0]);
  fires.push({ x, y, z, t: FIRE_LIFE, g, flames });
  makeNoise(V(x, y, z), 8);
  logLine('You light a campfire. E at the fire roasts your raw meat.');
  return true;
}
function dropFire(f: Fire) {
  scene.remove(f.g); f.g.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
  fires.splice(fires.indexOf(f), 1);
}
export function clearFires() { for (const f of [...fires]) dropFire(f); }

/** Every frame: fires flicker and burn down. */
export function updateFires(dt: number, time: number) {
  for (const f of [...fires]) {
    f.t -= dt;
    flicker(f.flames, time, Math.min(1, f.t / 20 + 0.3));
    if (f.t <= 0) dropFire(f);
  }
}

/** A fire (yours or a camp's) within reach, if any. */
export function nearFire(): { x: number; z: number } | null {
  const p = G.pos, all = [...fires, ...campFires()];
  return all.find((f) => Math.hypot(f.x - p.x, f.z - p.z) < 2.2 && Math.abs(f.y - p.y) < 1.5) ?? null;
}
export const fireHasWork = () => G.char.inv.some((s) => s && s.k === 'meatR');

/** Roast all the raw meat in the backpack. */
export function cookAll(): number {
  const inv = G.char.inv;
  let n = 0;
  for (let i = 0; i < inv.length; i++) if (inv[i]?.k === 'meatR') { n += inv[i]!.n; inv[i] = null; }
  if (!n) { logLine('You have no raw meat to roast.'); return 0; }
  const left = putItems(inv, 'meatC', n); // raw stacks freed their slots, so this always fits
  if (left) putItems(inv, 'meatR', left);
  saveChar();
  showToast('Roasted ×' + (n - left));
  logLine(`You roast ${n - left} piece${n - left === 1 ? '' : 's'} of meat over the fire.`);
  return n - left;
}
