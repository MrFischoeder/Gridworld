// (0.249, PLAN_MAGAZYNOW.md stage M1) Staking out a warehouse in the wilds with the Warehouse Plans: the mouse picks
// its spot and its doors face you; a hologram shows the shed, its doors and the hex it will serve (red with the reason
// when it cannot stand there: one warehouse to a hex, dry and fairly level ground, away from the villages, places,
// roads and deposits). Confirmed, it becomes an entry of the shared `outposts` ('wh:<hex>', kind 'store'), built and
// worked like a port's warehouse (world/ports.ts, ui/port.ts).
import * as THREE from 'three';
import { G } from '../game';
import { OW } from './overworld';
import { driving } from './vehicles';
import { scene } from './render';
import { allVillages, nearX, worldDist, poisNear, wrapDx } from '../gen/regions';
import { rectDist } from '../gen/terrain';
import { lodesNear } from '../gen/lodes';
import { inCity } from '../gen/cities';
import { nearestOnRoad } from '../gen/roads';
import { portSpots, wildFrame, frameOf } from '../gen/ports';
import { hubs, hexOf, hexCorners, hexProblem, wildId, wildName } from '../gen/warehouses';
import { takeOne, hasItem, saveChar } from '../character';
import { withOutpost } from '../ui/stock';
import { myOwner } from './rivals';
import { dryAt, redrawPorts } from './ports';
import { logLine, showToast } from '../ui/hud';
import { tl, TL } from '../i18n';

/** How far the spot is kept from a village's middle, other places, roads and deposits; the relief allowed under the shed. */
const KEEP = { village: 260, place: 40, road: 14, lode: 25, steep: 4 };
let placing = false, spot: { x: number; z: number; y: number; dx: number; dz: number } | null = null, problem: string | null = null, preview: THREE.Group | null = null;
const holo = new THREE.LineBasicMaterial({ color: 0xb6ff3a, depthTest: false, transparent: true, opacity: 0.9 });
export const isWhPlacing = () => placing;
export function startWhPlacing(): boolean {
  if (G.char.loc !== 'overworld' || !OW.terrain) { logLine(tl('A warehouse stands in the open.')); return false; }
  if (driving.v) { logLine(tl('Get out of the vehicle first.')); return false; }
  placing = true; spot = null; problem = null;
  logLine(tl('Look where the warehouse should stand (dry, fairly level ground, best by the deposits it is to serve): its doors face you. Click to stake it out, right mouse button or Esc to cancel. It serves the hex drawn round it.'));
  return true;
}
export function cancelWhPlacing(quiet = false) {
  if (!placing) return;
  placing = false; spot = null;
  if (preview) { scene.remove(preview); preview.traverse((o) => (o as THREE.Line).geometry?.dispose()); preview = null; }
  if (!quiet) logLine(tl('You put the warehouse plans away.'));
}
export const whPlacingHint = () => (!placing ? null : problem ?? tl('Click — stake the warehouse out here · right mouse / Esc — cancel'));
export const whPlacingOk = () => !!spot && !problem;

/** Why the warehouse cannot stand at (x, z) with its doors facing (dx, dz) ('' = it can). */
function whyNot(x: number, z: number, dx: number, dz: number): string {
  const T = OW.terrain!, w = G.char.world, hs: number[] = [];
  const taken = hexProblem(hubs(w, G.char.towns, G.char.outposts), x, z);
  if (taken) return taken;
  for (const a of [-7, 0, 7]) for (const b of [-9, 0, 9]) {
    const px = x + dx * a - dz * b, pz = z + dz * a + dx * b;
    if (!dryAt(px, pz)) return tl('There is water there.');
    hs.push(T.heightAt(px, pz));
  }
  if (Math.max(...hs) - Math.min(...hs) > KEEP.steep) return tl('Too steep here.');
  if (inCity(w, x, z, 40)) return tl('Not among the ruins of a city.');
  for (const v of allVillages(w)) if (worldDist(v.x, v.z, x, z) < KEEP.village) return TL`Too close to ${v.name}: a village keeps its own warehouse.`;
  for (const q of poisNear(w, x, z, 200)) if (q.type !== 'village' && rectDist(q.rect, wrapDx(x - q.x) + q.x, z) < KEEP.place + q.flat) return tl('Too close to ') + q.name + '.';
  for (const l of lodesNear(w, x, z, 80)) if (worldDist(l.x, l.z, x, z) < l.r + KEEP.lode) return TL`Too close to the ${l.name}: leave its ground for the dig.`;
  const f = T.featuresIn({ x0: x - 40, z0: z - 40, x1: x + 40, z1: z + 40 });
  for (const road of f.roads) if (nearestOnRoad(road, x, z)[0] < road.half + KEEP.road) return road.h ? tl('A trail runs there.') : tl('A road runs there: build the warehouse beside it, not on it.');
  if (f.megaliths.length || f.gates.length) return tl('The old stones there are not to be built over.');
  for (const o of Object.values(G.char.outposts)) if (o && worldDist(o.x, o.z, x, z) < 60) return TL`Too close to ${o.name}.`;
  return '';
}
export function updateWhPlacing() {
  if (!placing) return;
  const T = OW.terrain;
  if (G.char.loc !== 'overworld' || driving.v || !T) { cancelWhPlacing(true); return; }
  const cp = Math.cos(G.pitch), lx = -Math.sin(G.yaw) * cp, ly = Math.sin(G.pitch), lz = -Math.cos(G.yaw) * cp, y0 = G.pos.y + 1.6;
  let x = G.pos.x + lx * 22, z = G.pos.z + lz * 22;
  for (let t = 6; t <= 60; t += 0.5) { const px = G.pos.x + lx * t, pz = G.pos.z + lz * t; if (y0 + ly * t <= T.heightAt(px, pz)) { x = px; z = pz; break; } }
  x = Math.round(x); z = Math.round(z);
  const d = Math.hypot(G.pos.x - x, G.pos.z - z) || 1, dx = (G.pos.x - x) / d, dz = (G.pos.z - z) / d; // its doors face you
  problem = whyNot(x, z, dx, dz) || null;
  const y = T.heightAt(x, z);
  spot = { x, z, y, dx, dz };
  // the shed's outline, its doorway, and the hex it would serve
  const pts: number[] = [], P = (a: number, b: number, h = 0.15): [number, number, number] => { const px = x + dx * a - dz * b, pz = z + dz * a + dx * b; return [px, T.heightAt(px, pz) + h, pz]; };
  const seg = (p: number[], q: number[]) => pts.push(p[0], p[1], p[2], q[0], q[1], q[2]);
  const c = [P(-6, -8), P(6, -8), P(6, 8), P(-6, 8)];
  for (let i = 0; i < 4; i++) { seg(c[i], c[(i + 1) % 4]); const top = [c[i][0], c[i][1] + 4.5, c[i][2]]; seg(c[i], top); }
  seg(P(6, -2.6, 0.2), P(14, 0, 0.2)); seg(P(6, 2.6, 0.2), P(14, 0, 0.2)); // the way in
  const hx = hexCorners(hexOf(x, z), x);
  for (let i = 0; i < 6; i++) {
    const [ax, az] = hx[i], [bx, bz] = hx[(i + 1) % 6];
    for (let k = 0; k < 12; k++) { const t0 = k / 12, t1 = (k + 1) / 12, p0x = ax + (bx - ax) * t0, p0z = az + (bz - az) * t0, p1x = ax + (bx - ax) * t1, p1z = az + (bz - az) * t1; seg([p0x, T.heightAt(p0x, p0z) + 1, p0z], [p1x, T.heightAt(p1x, p1z) + 1, p1z]); }
  }
  if (!preview) { preview = new THREE.Group(); scene.add(preview); }
  preview.traverse((o) => (o as THREE.Line).geometry?.dispose()); preview.clear();
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const ln = new THREE.LineSegments(geo, holo); ln.renderOrder = 10; ln.frustumCulled = false; preview.add(ln);
  holo.color.setHex(problem ? 0xff5a3c : 0xb6ff3a);
}
export async function confirmWhPlacing() {
  if (!placing || !spot) return;
  if (problem) { logLine(problem); return; }
  if (!hasItem('whkit')) { cancelWhPlacing(true); return; }
  const c = G.char, s = spot, key = hexOf(s.x, s.z).key, id = wildId(key);
  cancelWhPlacing(true);
  let why = '';
  const ok = await withOutpost(id, () => {
    why = whyNot(s.x, s.z, s.dx, s.dz);
    if (why || c.outposts[id] || !takeOne('whkit')) { why ||= tl('Someone staked a warehouse out in this area just now.'); return; }
    const x = Math.round(nearX(s.x, 0)), fr = wildFrame(x, s.z, s.dx, s.dz), o = { o: myOwner(), by: c.name || tl('You'), t: c.time, k: 'store' as const, x, z: s.z, name: wildName(c.world, key), fr };
    c.outposts[id] = { ...o, ps: portSpots(frameOf(o as never, [])!, dryAt) };
  });
  if (!ok) return;
  if (why) { showToast(why); return; }
  saveChar(); redrawPorts();
  showToast(tl('Warehouse staked out'));
  logLine(TL`${c.outposts[id].name} is staked out. Bring the materials to its board (E), then a power source, bunkhouses and fields: it needs its own people. Once it works, what the deposits of its area dig comes to it on its own.`);
}
