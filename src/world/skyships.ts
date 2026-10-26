// (0.258, PLAN_LOTNICTWA.md stage F4) The airships on the sky lines (gen/skylines.ts), drawn where their timetable puts
// them: moored at the home mast while they load, flying the straight way (climbing from the mast, cruising 40 m over the
// ground, descending to the other mast), moored there while they unload. Not solid, nobody rides them: every game draws
// the same from the shared state. The line's settling is world/hublines.ts.
import * as THREE from 'three';
import { G } from '../game';
import { scene } from './render';
import { OW } from './overworld';
import { showcaseAirship } from './airships';
import { nearX, worldDist } from '../gen/regions';
import { SEA } from '../gen/seas';
import { AIRSHIP } from '../gen/airmast';
import { hubs, type Hub } from '../gen/warehouses';
import { mastAt, moorPose } from '../gen/airships';
import { allSkyLines, skAt, type SkyLine } from '../gen/skylines';

const DRAW_R = 1500;
/** The metres from a mast over which the airship climbs to (or comes down from) its cruise. */
const CLIMB = 350;
const CRUISE = 40;
const ships = new Map<string, THREE.Group>();
function drop(id: string) { const g = ships.get(id); if (g) { scene.remove(g); g.traverse((o) => (o as THREE.Mesh).geometry?.dispose?.()); ships.delete(id); } }
const groundAt = (x: number, z: number) => Math.max(OW.terrain!.heightAt(x, z), SEA.level);
/** Where line l's airship from warehouse `home` is now: its middle x, y, z and heading, or null (no ship). */
export function skyShipAt(home: Hub, there: Hub | undefined, l: SkyLine, now: number, px: number): [number, number, number, number] | null {
  if (!l.ship || !there || !OW.terrain) return null;
  const c = G.char, hm = mastAt(c.world, home, c.towns), tm = mastAt(c.world, there, c.towns);
  const hx = nearX(hm.x, px), tx = nearX(tm.x, hx), hp = moorPose({ x: hx, z: hm.z, a: hm.a }, groundAt(hx, hm.z)), tp = moorPose({ x: tx, z: tm.z, a: tm.a }, groundAt(tx, tm.z));
  const cv = skAt(l, now);
  if (cv.at === 'parked' || cv.at === 'home') return [hp.x, hp.y, hp.z, hp.yaw];
  if (cv.at === 'there') return [tp.x, tp.y, tp.z, tp.yaw];
  const p = cv.at === 'out' ? cv.p : 1 - cv.p, x = hp.x + (tp.x - hp.x) * p, z = hp.z + (tp.z - hp.z) * p, d = Math.hypot(tp.x - hp.x, tp.z - hp.z) || 1;
  const yaw = Math.atan2((tp.x - hp.x) * (cv.at === 'out' ? 1 : -1), (tp.z - hp.z) * (cv.at === 'out' ? 1 : -1));
  const fromA = p * d, fromB = (1 - p) * d, k = Math.min(1, Math.min(fromA, fromB) / CLIMB), end = fromA < fromB ? hp.y : tp.y;
  const y = end + (groundAt(x, z) + AIRSHIP.below + CRUISE - end) * k * k * (3 - 2 * k);
  return [x, Math.max(y, groundAt(x, z) + AIRSHIP.below + AIRSHIP.min), z, yaw];
}
export function updateSkyShips() {
  const T = OW.terrain, c = G.char;
  if (!T || c.loc !== 'overworld') { clearSkyShips(); return; }
  const seen = new Set<string>(), list = hubs(c.world, c.towns, c.outposts);
  for (const [home, l] of allSkyLines(c.towns, c.outposts)) {
    const h = list.find((q) => q.id === home), at = h ? skyShipAt(h, list.find((q) => q.id === l.to), l, c.time, G.pos.x) : null;
    if (!l.ship || !at || worldDist(at[0], at[2], G.pos.x, G.pos.z) > DRAW_R) continue;
    seen.add(home);
    let g = ships.get(home);
    if (!g) { g = showcaseAirship(); scene.add(g); ships.set(home, g); }
    g.position.set(at[0], at[1], at[2]); g.rotation.set(0, at[3], 0);
  }
  for (const id of [...ships.keys()]) if (!seen.has(id)) drop(id);
}
export function clearSkyShips() { for (const id of [...ships.keys()]) drop(id); }
/** For the maps: every line's airship place and heading. */
export function skyShipsForMap(): [number, number, number][] {
  const c = G.char, list = hubs(c.world, c.towns, c.outposts), out: [number, number, number][] = [];
  for (const [home, l] of allSkyLines(c.towns, c.outposts)) {
    const h = list.find((q) => q.id === home), at = h ? skyShipAt(h, list.find((q) => q.id === l.to), l, c.time, G.pos.x) : null;
    if (at) out.push([at[0], at[2], at[3]]);
  }
  return out;
}
