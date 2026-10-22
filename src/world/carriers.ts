// (0.250, PLAN_MAGAZYNOW.md stage M2) The carriers on their routes (gen/carriers.ts), drawn near you: a figure with a
// crate in its arms, a sack on its shoulder or a barrel it rolls along the ground ahead of it, walking to the warehouse
// loaded and back empty. Where they are comes from the game clock, so every player sees the same; nothing is sent.
// Routes over water are left undrawn.
import * as THREE from 'three';
import { G } from '../game';
import { OW } from './overworld';
import { scene } from './render';
import { PropBatch } from './props';
import { makeFigure, type Figure } from './npc';
import { poseRig } from './rig';
import { nearX } from '../gen/regions';
import { lodeById } from '../gen/lodes';
import { carrierRoutes, carrierAt, type CarrierRoute, type Load } from '../gen/carriers';

const REACH = 450, MAX = 24, LOOK = 2, C = 0xdce8ff, SACK = 0xd8c890, WOOD = 0xc8a060;
interface Walker { f: Figure; r: CarrierRoute; i: number; load: THREE.Object3D | null; phase: number }
const walkers = new Map<string, Walker>();
let routes: CarrierRoute[] = [], scan = 0;

/** A sack on the shoulder (figure-local) or a barrel to roll (its own group, turned about x as it goes). */
function loadModel(k: Load): THREE.Object3D | null {
  if (k === 'crate') return null; // the 'carry' kit holds its crate
  const pb = new PropBatch();
  if (k === 'sack') {
    const r = 0.22, P = (a: number, y: number, rr = r) => [Math.cos(a) * rr, y, Math.sin(a) * rr * 0.8];
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283, b = (i + 1) / 8 * 6.283; pb.face(P(a, -0.28, r * 0.7), P(b, -0.28, r * 0.7), P(b, 0.28, r * 0.6), P(a, 0.28, r * 0.6)); pb.seg(SACK, P(a, -0.28, r * 0.7), P(b, -0.28, r * 0.7)); pb.seg(SACK, P(a, 0.28, r * 0.6), P(b, 0.28, r * 0.6)); }
    pb.seg(SACK, [0, 0.28, 0], [0, 0.38, 0]);
    const g = pb.build(); g.rotation.z = Math.PI / 2.3; g.position.set(0.22, 1.5, -0.05); return g;
  }
  const r = 0.3, h = 0.4, P = (a: number, x: number) => [x, Math.cos(a) * r, Math.sin(a) * r];
  for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283, b = (i + 1) / 10 * 6.283; pb.face(P(a, -h), P(b, -h), P(b, h), P(a, h)); for (const x of [-h, 0, h]) pb.seg(WOOD, P(a, x), P(b, x)); }
  pb.seg(WOOD, P(0, -h), P(0, h));
  const g = pb.build(), outer = new THREE.Group(); outer.add(g); outer.position.set(0, r, 0.65); outer.userData.roll = g; return outer;
}
function drop(w: Walker) { scene.remove(w.f.g); w.f.g.traverse((o) => (o as THREE.Mesh).geometry?.dispose()); }
export function clearCarriers() { for (const w of walkers.values()) drop(w); walkers.clear(); routes = []; }

/** Every frame on the surface: the routes near you are looked up twice a second, their carriers walk. */
export function updateCarriers(dt: number) {
  const T = OW.terrain, c = G.char;
  if (!T || c.loc !== 'overworld') { if (walkers.size) clearCarriers(); return; }
  if ((scan -= dt) <= 0) {
    scan = LOOK;
    const px = nearX(G.pos.x, 0), wet = (r: CarrierRoute) => { for (let k = 1; k < 12; k++) { const x = nearX(r.ax + (r.bx - r.ax) * k / 12, G.pos.x), z = r.az + (r.bz - r.az) * k / 12; if ((T.water(x, z)?.depth ?? 0) > 0.4) return true; } return false; };
    routes = carrierRoutes(c.world, c.towns, c.outposts, (id) => lodeById(c.world, id), px, G.pos.z, REACH, c.time).filter((r) => !wet(r));
    const want = new Set<string>();
    let n = 0;
    for (const r of routes) for (let i = 0; i < r.n && n < MAX; i++, n++) {
      const key = r.id + '#' + i; want.add(key);
      const w = walkers.get(key);
      if (w) { w.r = r; continue; }
      const f = makeFigure(C, r.load === 'crate' ? 'carry' : 'none'), load = loadModel(r.load);
      if (load) f.g.add(load);
      walkers.set(key, { f, r, i, load, phase: i * 1.7 });
    }
    for (const [k, w] of walkers) if (!want.has(k)) { drop(w); walkers.delete(k); }
  }
  for (const w of walkers.values()) {
    const p = carrierAt(w.r, w.i, c.time), x = nearX(p.x, G.pos.x);
    w.f.g.position.set(x, T.heightAt(x, p.z), p.z); w.f.g.rotation.y = p.face;
    if (p.moving) w.phase += dt * 7;
    const sw = p.moving ? Math.sin(w.phase) * 0.5 : 0;
    w.f.legL.rotation.x = sw; w.f.legR.rotation.x = -sw;
    poseRig(w.f.rig, { swing: sw });
    const crate = w.f.g.getObjectByName('crate'); if (crate) crate.visible = p.loaded;
    if (w.load) {
      w.load.visible = p.loaded;
      const roll = w.load.userData.roll as THREE.Object3D | undefined;
      if (roll) roll.rotation.x = p.walk / 0.3; // a barrel rolls on its side ahead of him
    }
  }
}
