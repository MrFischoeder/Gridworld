// (0.254, PLAN_LOTNICTWA.md stage F1) The drone pads and the cargo drones at runtime: the pads drawn beside their
// warehouses (a concrete slab with a painted ring, a windsock mast, a charging cabinet; a drone resting on it while the
// line's drone is at home), and every drone in flight drawn where its timetable puts it on the straight way between the
// two pads, `DRONE.alt` over the ground or the sea, its rotors spinning and its lights blinking. Every game draws the same
// from the shared state; the lines are settled with the convoy lines (world/hublines.ts `runHub`).
import * as THREE from 'three';
import { G } from '../game';
import { scene } from './render';
import { OW } from './overworld';
import { PropBatch } from './props';
import { nearX, worldDist } from '../gen/regions';
import { SEA } from '../gen/seas';
import { hubs, type Hub } from '../gen/warehouses';
import { allAirLines, hasPad, padAt, alAt, type AirLine } from '../gen/airlines';
import { DRONE } from '../gen/dronepad';

const PAD_R = 500, DRONE_R = 700;
const CONC = 0x9fd8b0, RING = 0xffd060, SOCK = 0xff8a3c, BODY = 0xdce8ff, LIGHT = 0xff5a3c;
const dispose = (g: THREE.Object3D) => { scene.remove(g); g.traverse((o) => (o as THREE.Mesh).geometry?.dispose?.()); };

// ---------- the pads ----------
interface Pad { g: THREE.Group; sig: string }
const pads = new Map<string, Pad>();
function drawPad(withDrone: boolean): THREE.Group {
  const pb = new PropBatch(), R = 4;
  pb.box(-R, -0.3, -R, R, 0.15, R, CONC);
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, b = (i + 1) / 16 * Math.PI * 2; pb.seg(RING, [Math.cos(a) * 2.6, 0.17, Math.sin(a) * 2.6], [Math.cos(b) * 2.6, 0.17, Math.sin(b) * 2.6]); }
  pb.seg(RING, [-1, 0.17, -1.2], [-1, 0.17, 1.2]); pb.seg(RING, [1, 0.17, -1.2], [1, 0.17, 1.2]); pb.seg(RING, [-1, 0.17, 0], [1, 0.17, 0]); // an H
  pb.seg(CONC, [R + 0.8, 0, -R], [R + 0.8, 5, -R]); // the windsock mast
  pb.cone(R + 1.6, 4.6, -R, 0.25, 1.4, SOCK, 6);
  pb.box(-R - 1.4, 0, R - 1.2, -R - 0.4, 1.6, R, CONC); // the charging cabinet
  pb.box(-R - 1.42, 1.1, R - 0.9, -R - 1.38, 1.4, R - 0.3, RING);
  if (withDrone) droneShape(pb, 0, 0.6, 0);
  return pb.build();
}
function droneShape(pb: PropBatch, x: number, y: number, z: number) {
  pb.box(x - 0.55, y - 0.2, z - 0.55, x + 0.55, y + 0.25, z + 0.55, BODY);
  pb.box(x - 0.4, y - 0.55, z - 0.4, x + 0.4, y - 0.2, z + 0.4, RING); // the cargo pod
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const ax = x + sx * 1.3, az = z + sz * 1.3;
    pb.seg(BODY, [x + sx * 0.5, y + 0.1, z + sz * 0.5], [ax, y + 0.25, az]);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, b = (i + 1) / 8 * Math.PI * 2; pb.seg(BODY, [ax + Math.cos(a) * 0.6, y + 0.3, az + Math.sin(a) * 0.6], [ax + Math.cos(b) * 0.6, y + 0.3, az + Math.sin(b) * 0.6]); }
  }
}
function updatePads(list: Hub[], atHome: Set<string>) {
  const c = G.char, T = OW.terrain!, seen = new Set<string>();
  for (const h of list) {
    if (!hasPad(h, c.towns, c.outposts)) continue;
    const p = padAt(c.world, h), x = nearX(p.x, G.pos.x);
    if (worldDist(x, p.z, G.pos.x, G.pos.z) > PAD_R) continue;
    seen.add(h.id);
    const sig = (atHome.has(h.id) ? 'd' : '') + Math.round(x);
    const was = pads.get(h.id);
    if (was && was.sig === sig) continue;
    if (was) dispose(was.g);
    const g = drawPad(atHome.has(h.id));
    g.position.set(x, Math.max(T.heightAt(x, p.z), SEA.level) + 0.1, p.z); g.rotation.y = -p.a;
    scene.add(g); pads.set(h.id, { g, sig });
  }
  for (const [id, p] of pads) if (!seen.has(id)) { dispose(p.g); pads.delete(id); }
}

// ---------- the drones in flight ----------
interface Drone { g: THREE.Group; light: THREE.Mesh }
const drones = new Map<string, Drone>();
function makeDrone(): Drone {
  const pb = new PropBatch(); droneShape(pb, 0, 0, 0);
  const g = pb.build(), light = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 4), new THREE.MeshBasicMaterial({ color: LIGHT, fog: false }));
  light.position.set(0, -0.2, 0.6); g.add(light); scene.add(g);
  return { g, light };
}
/** Where line l's drone from warehouse `home` is now (x, y, z, heading), or null while it rests on a pad. */
export function droneAt(home: Hub, to: Hub | undefined, l: AirLine, now: number, px: number): [number, number, number, number] | null {
  const T = OW.terrain, c = G.char, cv = alAt(l, now);
  if (!T || !to || cv.at === 'parked' || cv.at === 'home' || cv.at === 'there') return null;
  const a = padAt(c.world, home), b = padAt(c.world, to), ax = nearX(a.x, px), bx = nearX(b.x, ax);
  const p = cv.at === 'out' ? cv.p : 1 - cv.p, x = ax + (bx - ax) * p, z = a.z + (b.z - a.z) * p;
  const lift = Math.min(1, p / 0.06, (1 - p) / 0.06), ground = Math.max(T.heightAt(x, z), SEA.level);
  const yaw = cv.at === 'out' ? Math.atan2(bx - ax, b.z - a.z) : Math.atan2(ax - bx, a.z - b.z);
  return [x, ground + 0.6 + (DRONE.alt - 0.6) * Math.max(0, lift), z, yaw];
}
/** Where line l's drone is, for the maps (x, z), or null while on a pad. */
export function droneMapAt(home: Hub, to: Hub | undefined, l: AirLine, now: number, px: number): [number, number] | null {
  const cv = alAt(l, now);
  if (!to || cv.at === 'parked' || cv.at === 'home' || cv.at === 'there') return null;
  const c = G.char, a = padAt(c.world, home), b = padAt(c.world, to), ax = nearX(a.x, px), bx = nearX(b.x, ax), p = cv.at === 'out' ? cv.p : 1 - cv.p;
  return [ax + (bx - ax) * p, a.z + (b.z - a.z) * p];
}
let spin = 0;
export function updateCargoDrones(dt: number) {
  const c = G.char;
  if (!OW.terrain || c.loc !== 'overworld') { clearCargoDrones(); return; }
  const list = hubs(c.world, c.towns, c.outposts), byId = new Map(list.map((h) => [h.id, h])), atHome = new Set<string>(), seen = new Set<string>();
  spin += dt;
  for (const [home, l] of allAirLines(c.towns, c.outposts)) {
    const h = byId.get(home);
    if (!h || !l.drone) continue;
    const at = droneAt(h, byId.get(l.to), l, c.time, G.pos.x);
    if (!at) { const cv = alAt(l, c.time); if (cv.at === 'there') atHome.add(l.to); else atHome.add(home); continue; }
    if (worldDist(at[0], at[2], G.pos.x, G.pos.z) > DRONE_R) continue;
    seen.add(home);
    let d = drones.get(home);
    if (!d) { d = makeDrone(); drones.set(home, d); }
    d.g.position.set(at[0], at[1], at[2]); d.g.rotation.set(0.12, at[3], 0);
    d.light.visible = Math.floor(spin * 2) % 2 === 0;
  }
  for (const [id, d] of drones) if (!seen.has(id)) { dispose(d.g); drones.delete(id); }
  updatePads(list, atHome);
}
export function clearCargoDrones() {
  for (const d of drones.values()) dispose(d.g);
  drones.clear();
  for (const p of pads.values()) dispose(p.g);
  pads.clear();
}
