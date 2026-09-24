// NPC caravans on the roads near the player (the timetable is gen/caravans.ts): trucks with a canvas-covered bed,
// crates showing at the back, rolling along the road one behind the other. They are only drawn near the player;
// where they are follows from the game time alone, so they are where they should be whenever you look. Solid to
// walk into; E at a wagon talks to the caravan master (ui/caravan.ts).
import * as THREE from 'three';
import { G } from '../game';
import { scene } from './render';
import { PropBatch } from './props';
import { OW } from './overworld';
import { network, regionRoads, type Road, type Edge } from '../gen/roads';
import { regionOf } from '../gen/regions';
import { onRoad, caravanS, type Caravan } from '../gen/caravans';

const BODY = 0xc8e0ff, CANVAS = 0x9dffb4, CRATE = 0xe8e0c0, DRAW_R = 420;
/** Half length and half width of a wagon (for bumping into it). */
const HL = 3.1, HW = 1.25;
let model: THREE.Group | null = null;
function wagonModel(): THREE.Group {
  if (model) return model;
  const pb = new PropBatch(), b = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c = BODY) => pb.box(x0, y0, z0, x1, y1, z1, c);
  b(-1.1, 0.55, -3, 1.1, 0.85, 3);                       // chassis
  b(-1.05, 0.85, 1.6, 1.05, 2.4, 3.05);                  // cab
  pb.line(CANVAS, [-0.9, 1.6, 3.06], [0.9, 1.6, 3.06], [0.9, 2.2, 3.06], [-0.9, 2.2, 3.06], [-0.9, 1.6, 3.06]); // windscreen
  // the canvas cover over the bed: hoops and a ridge
  const hoop = (z: number) => { const pts: number[][] = []; for (let i = 0; i <= 8; i++) { const a = Math.PI * i / 8; pts.push([-Math.cos(a) * 1.1, 1.0 + Math.sin(a) * 1.35 + 0.55, z]); } return pts; };
  const zs = [-2.9, -1.95, -1, 0, 1.0, 1.5];
  for (const z of zs) pb.line(CANVAS, ...hoop(z));
  for (let i = 0; i + 1 < zs.length; i++) { const a = hoop(zs[i]), c = hoop(zs[i + 1]); for (let j = 0; j + 1 < a.length; j++) pb.face(a[j], a[j + 1], c[j + 1], c[j]); }
  pb.line(CANVAS, [0, 2.9, -2.9], [0, 2.9, 1.5]);
  b(-1.1, 0.85, -3, 1.1, 1.55, 1.5);                     // bed sides
  for (const [x, y] of [[-0.55, 1.55], [0.35, 1.55], [-0.1, 2.15]]) b(x - 0.4, y, -3.25, x + 0.4, y + 0.6, -2.65, CRATE); // crates at the tail
  for (const z of [-2, 2]) for (const s of [-1, 1]) { pb.box(s * 1.0, 0.05, z - 0.45, s * 1.3, 0.95, z + 0.45, BODY); }  // wheels
  model = pb.build();
  return model;
}
interface Wagon { c: Caravan; w: number; road: Road; g: THREE.Group; x: number; z: number; yaw: number }
const wagons = new Map<string, Wagon>();
let scanT = 0;
const edgeByKey = new Map<string, Edge>();
let edgeWorld = -1;
/** Point and heading at arc length s along a polyline. */
function along(pts: [number, number][], s: number): [number, number, number] {
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az);
    if (s <= L || i + 2 === pts.length) { const t = L ? Math.min(1, s / L) : 0; return [ax + (bx - ax) * t, az + (bz - az) * t, Math.atan2(bx - ax, bz - az)]; }
    s -= L;
  }
  return [pts[0][0], pts[0][1], 0];
}
const lengthOf = (pts: [number, number][]) => { let L = 0; for (let i = 0; i + 1 < pts.length; i++) L += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); return L; };

/** Once a frame in the open world: find the caravans on the roads nearby (twice a second) and move their wagons. */
export function updateCaravans(dt: number) {
  const T = OW.terrain;
  if (!T || G.char.loc !== 'overworld') { clearCaravans(); return; }
  const world = T.world, now = G.char.time;
  if (edgeWorld !== world) { edgeByKey.clear(); for (const e of network(world)) edgeByKey.set('road:' + e.key, e); edgeWorld = world; }
  if ((scanT -= dt) <= 0) {
    scanT = 0.5;
    const [rx, rz] = regionOf(G.pos.x, G.pos.z), seen = new Set<string>();
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) for (const road of regionRoads(world, rx + i, rz + j)) {
      const e = edgeByKey.get(road.id);
      if (!e) continue;
      for (const c of onRoad(world, e, now)) for (let w = 0; w < c.wagons; w++) {
        const key = c.id + ':' + w;
        if (seen.has(key)) continue;
        seen.add(key);
        if (!wagons.has(key)) { const g = new THREE.Group(); g.add(wagonModel().clone()); g.visible = false; scene.add(g); wagons.set(key, { c, w, road, g, x: 0, z: 0, yaw: 0 }); }
      }
    }
    for (const [k, wg] of wagons) if (!seen.has(k)) { scene.remove(wg.g); wagons.delete(k); }
  }
  for (const wg of wagons.values()) {
    const pts = wg.road.pts, L = lengthOf(pts), s = Math.min(L, caravanS(wg.c, now, wg.w));
    let [x, z, yaw] = along(pts, wg.c.back ? L - s : s);
    if (wg.c.back) yaw += Math.PI;
    // keep to the right of the road
    x += Math.cos(yaw) * -1.2; z += -Math.sin(yaw) * -1.2;
    wg.x = x; wg.z = z; wg.yaw = yaw;
    const near = Math.hypot(x - G.pos.x, z - G.pos.z) < DRAW_R;
    wg.g.visible = near;
    if (!near) continue;
    const fx = Math.sin(yaw), fz = Math.cos(yaw), hf = T.heightAt(x + fx * 2.5, z + fz * 2.5), hb = T.heightAt(x - fx * 2.5, z - fz * 2.5);
    // a wagon rolling into you shoves you aside
    const dx = G.pos.x - x, dz = G.pos.z - z, u = dx * fx + dz * fz, v = dx * fz - dz * fx;
    if (Math.abs(u) < HL + 0.3 && Math.abs(v) < HW + 0.3 && G.pos.y < (hf + hb) / 2 + 3) { const push = (v < 0 ? -1 : 1) * (HW + 0.35) - v; G.pos.x += fz * push; G.pos.z -= fx * push; }
    wg.g.position.set(x, (hf + hb) / 2, z); wg.g.rotation.set(0, 0, 0); wg.g.rotateY(yaw); wg.g.rotateX(-Math.atan2(hf - hb, 5));
  }
}
export function clearCaravans() { for (const wg of wagons.values()) scene.remove(wg.g); wagons.clear(); }
/** Solid: the wagons (an oriented box each). */
export function caravanHit(x: number, y: number, z: number, r: number): boolean {
  for (const wg of wagons.values()) {
    if (!wg.g.visible || Math.abs(x - wg.x) > 6 || Math.abs(z - wg.z) > 6) continue;
    const dx = x - wg.x, dz = z - wg.z, fx = Math.sin(wg.yaw), fz = Math.cos(wg.yaw);
    const u = dx * fx + dz * fz, v = dx * fz - dz * fx;
    if (Math.abs(u) < HL + r && Math.abs(v) < HW + r && y < wg.g.position.y + 3) return true;
  }
  return false;
}
/** The caravan whose wagon you stand next to. */
export function nearCaravan(): Caravan | null {
  for (const wg of wagons.values()) {
    if (!wg.g.visible) continue;
    const dx = G.pos.x - wg.x, dz = G.pos.z - wg.z, fx = Math.sin(wg.yaw), fz = Math.cos(wg.yaw);
    if (Math.abs(dx * fx + dz * fz) < HL + 3 && Math.abs(dx * fz - dz * fx) < HW + 3.5) return wg.c;
  }
  return null;
}
/** Where the wagons near the player are (for debugging and the maps). */
export const wagonSpots = () => [...wagons.values()].filter((w) => w.g.visible).map((w) => ({ x: w.x, z: w.z, c: w.c }));
