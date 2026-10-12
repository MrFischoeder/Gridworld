// (0.187, PLAN_PLACOWEK.md stage O6) The outposts' convoy trucks in the world: each route's truck drawn where its
// timetable puts it (gen/routes.ts convoyAt): loading by the outpost, driving the straight way to the village and back,
// unloading by the village, parked at the outpost when its tank is low or it lies wrecked. Runtime only: every game
// draws the same from the shared `outposts`; nothing here writes the save.
import * as THREE from 'three';
import { G } from '../game';
import { scene } from './render';
import { OW } from './overworld';
import { convoyModel } from './vehicles';
import { convoyAt, wrecked, type Route } from '../gen/routes';
import { nearX } from '../gen/regions';
import type { OutpostState } from '../gen/outposts';

const DRAW_R = 600;
interface Truck { g: THREE.Group; key: string }
const trucks = new Map<string, Truck>();
/** The two ends of the way: the outpost's edge towards the village, and a spot 45 m out of the village towards it. */
export function routeEnds(o: OutpostState, r: Route, px: number): [number, number, number, number] {
  const ox = nearX(o.x, px), vx = nearX(r.vx, ox), dx = vx - ox, dz = r.vz - o.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d;
  return [ox + ux * 30, o.z + uz * 30, vx - ux * 45, r.vz - uz * 45];
}
/** Where the route's truck is now: x, z, heading (or null when there is none). */
export function truckAt(o: OutpostState, r: Route, now: number, px: number): [number, number, number] | null {
  if (!r.truck) return null;
  const [ax, az, bx, bz] = routeEnds(o, r, px), yaw = Math.atan2(bx - ax, bz - az), cv = convoyAt(r, now);
  if (cv.at === 'parked' || cv.at === 'outpost') return [ax - Math.cos(yaw) * 4, az + Math.sin(yaw) * 4, yaw];
  if (cv.at === 'village') return [bx, bz, yaw + Math.PI];
  const p = cv.at === 'out' ? cv.p : 1 - cv.p;
  return [ax + (bx - ax) * p + Math.cos(yaw) * (cv.at === 'out' ? -1.5 : 1.5), az + (bz - az) * p - Math.sin(yaw) * (cv.at === 'out' ? -1.5 : 1.5), cv.at === 'out' ? yaw : yaw + Math.PI];
}
function drop(id: string) { const t = trucks.get(id); if (t) { scene.remove(t.g); t.g.traverse((o) => (o as THREE.Mesh).geometry?.dispose?.()); trucks.delete(id); } }
export function updateRouteTrucks() {
  const T = OW.terrain, c = G.char;
  if (!T || c.loc !== 'overworld') { for (const id of [...trucks.keys()]) drop(id); return; }
  const seen = new Set<string>();
  for (const [id, o] of Object.entries(c.outposts)) {
    const r = o?.route, at = r ? truckAt(o, r, c.time, G.pos.x) : null;
    if (!r?.truck || !at || Math.hypot(at[0] - G.pos.x, at[1] - G.pos.z) > DRAW_R) continue;
    seen.add(id);
    const key = r.truck.model + (r.truck.parts.gun ? 'g' : '') + (wrecked(r) ? 'w' : '');
    let t = trucks.get(id);
    if (t && t.key !== key) { drop(id); t = undefined; }
    if (!t) { const m = convoyModel(r.truck.model, r.truck.parts.gun, wrecked(r) ? undefined : 0xdce8ff), g = new THREE.Group(); g.add(m.g); scene.add(g); t = { g, key }; trucks.set(id, t); }
    const [x, z, yaw] = at, fx = Math.sin(yaw), fz = Math.cos(yaw), hf = T.heightAt(x + fx * 2.5, z + fz * 2.5), hb = T.heightAt(x - fx * 2.5, z - fz * 2.5);
    t.g.position.set(x, (hf + hb) / 2, z); t.g.rotation.set(0, 0, 0); t.g.rotateY(yaw); t.g.rotateX(-Math.atan2(hf - hb, 5));
    if (wrecked(r)) t.g.rotateZ(0.25);
  }
  for (const id of [...trucks.keys()]) if (!seen.has(id)) drop(id);
}
export function clearRouteTrucks() { for (const id of [...trucks.keys()]) drop(id); }
