// Staking out a new farm's field (gen/fields.ts): with a Survey Stake from the elder you walk out of the village,
// use the stake and look where the field should go. A hologram shows the 12 m field, its fence line and how the
// ground will be levelled (lime: fine; red with the reason: not there). A click stakes it out: the village is
// reserved first (ui/stock.ts withTownStock), the spot is saved (`TownState.fplots`), the ground is levelled for
// everyone (world/claims.ts fieldsChanged) and the builders start (world/jobsites.ts). Right mouse or Esc puts the
// stake away. Multiplayer: the spot and the job are shared; if two heroes stake out the same farm, the reservation
// lets only the first through.
// (0.197) The same stake marks out a settlement's warehouse once its materials are in (`SettlementState.whWait`):
// anywhere outside the wall within `WAREHOUSE.reach`, its wide doors facing you, with a clear apron before them for
// the vehicles and convoys (gen/fields.ts warehouseProblem); saved as `SettlementState.wh` (shared), then the builders.
// (0.255) And a village's drone pad once its materials are in (`TownState.dpWait`): within `DRONE.near` of the
// warehouse (gen/fields.ts padProblem); saved as `TownState.dpspot` (shared), then the builders (gen/airlines.ts placePad).
// (0.257) And a village's mooring mast once its materials are in (`TownState.amWait`): within `AIRMAST.near` of the
// warehouse, its moored airship lying away from you (gen/fields.ts mastProblem); saved as `TownState.amspot` (shared,
// with the airship's heading), then the builders (gen/airships.ts placeMast).
import * as THREE from 'three';
import { G } from '../game';
import { OW, reloadStruct } from './overworld';
import { driving } from './vehicles';
import { scene } from './render';
import { allVillages, worldDist, findPoi, villageSeed, wrapDx } from '../gen/regions';
import { FIELD, fieldProblem, fieldPad, warehouseProblem, padProblem, PAD_HALF, mastProblem, mastClaims } from '../gen/fields';
import { placeMast } from '../gen/airships';
import { AIRMAST, AIRSHIP } from '../gen/airmast';
import { placePad } from '../gen/airlines';
import { DRONE } from '../gen/dronepad';
import { hubs, villageHub } from '../gen/warehouses';
import { placeFarm, FARM } from '../gen/farms';
import { placeWarehouse } from '../gen/settlement';
import { WAREHOUSE, warehouseAt, apronOf, hallPoint, type HallSpot } from '../gen/hall';
import { meanGround } from '../gen/buildpads';
import { VILLAGE_OFFSET } from '../gen/village';
import { takeOne, saveChar, calcStats, gainXp } from '../character';
import { withTownStock } from '../ui/stock';
import { allClaims, fieldsChanged } from './claims';
import { earnTrust } from './standing';
import { logLine, showToast } from '../ui/hud';
import { tl, TL } from '../i18n';

let placing = false, preview: THREE.Group | null = null, problem: string | null = null, at: { x: number; z: number; y: number } | null = null, vid = -1;
/** (0.197) What the stake marks out: a farm's field or the settlement's warehouse (`hall` = its plaza-local spot). */
let mode: 'field' | 'warehouse' | 'pad' | 'mast' = 'field', hall: HallSpot | null = null, heading = 0;
let last = { x: NaN, z: NaN, t: 0 };
const OK = 0xb6ff3a, BAD = 0xff5a3c;
const matA = new THREE.LineBasicMaterial({ color: OK, depthTest: false, transparent: true, opacity: 0.95 });
const matB = new THREE.LineBasicMaterial({ color: OK, depthTest: false, transparent: true, opacity: 0.45 });

/** The village nearest to you whose warehouse waits for its spot (first) or whose farm waits for its field, within reach. */
function waiting(): { id: number; mode: 'field' | 'warehouse' | 'pad' | 'mast' } | null {
  const c = G.char, d = (v: { x: number; z: number }) => worldDist(v.x, v.z, G.pos.x, G.pos.z);
  const by = (f: (id: number) => unknown, reach: number) => allVillages(c.world).filter((v) => f(v.id) && d(v) < reach + 150).sort((a, b) => d(a) - d(b))[0];
  const w = by((id) => c.towns[id]?.settlement?.whWait, WAREHOUSE.reach);
  if (w) return { id: w.id, mode: 'warehouse' };
  const p = by((id) => c.towns[id]?.dpWait, DRONE.near + 150); // (0.255) the drone pad (near the village: its warehouse is)
  if (p) return { id: p.id, mode: 'pad' };
  const m = by((id) => c.towns[id]?.amWait, AIRMAST.near + 150); // (0.257) the mooring mast
  if (m) return { id: m.id, mode: 'mast' };
  const f = by((id) => c.towns[id]?.fwait, FIELD.reach);
  return f ? { id: f.id, mode: 'field' } : null;
}
export const isFieldPlacing = () => placing;
/** Use a Survey Stake: start choosing the field. */
export function startFieldPlacing(): boolean {
  if (G.char.loc !== 'overworld' || !OW.terrain) { logLine(tl('A field is staked out in the open, near its village.')); return false; }
  if (driving.v) { logLine(tl('Get out of the vehicle first.')); return false; }
  const w = waiting();
  if (!w) { logLine(tl('Nothing waits for its ground near here. The elder gives a stake once the materials of a new farm or of the warehouse are in, the storekeeper once those of a drone pad or a mooring mast are.')); return false; }
  vid = w.id; mode = w.mode;
  placing = true; at = null; hall = null; problem = null; last = { x: NaN, z: NaN, t: 0 };
  if (mode === 'mast') { logLine(TL`Look where the mooring mast of ${findPoi(G.char.world, vid)?.name ?? tl('the village')} should stand, beside its warehouse (within ${AIRMAST.near} m of it). Its airship will lie on beyond it, away from you: walk round to turn it. Click to stake it out, right mouse button or Esc to cancel.`); return true; }
  if (mode === 'pad') { logLine(TL`Look where the drone pad of ${findPoi(G.char.world, vid)?.name ?? tl('the village')} should go, beside its warehouse (within ${DRONE.near} m of it). Click to stake it out, right mouse button or Esc to cancel.`); return true; }
  if (mode === 'warehouse') { logLine(TL`Look where the warehouse of ${findPoi(G.char.world, vid)?.name ?? tl('the village')} should stand, outside its wall (within ${WAREHOUSE.reach} m). Its doors face you: walk round it to turn them. Click to stake it out, right mouse button or Esc to cancel.`); return true; }
  logLine(TL`Look where the new field of ${findPoi(G.char.world, vid)?.name ?? tl('the village')} should go (within ${FIELD.reach} m): click to stake it out, right mouse button or Esc to cancel.`);
  return true;
}
export function cancelFieldPlacing(quiet = false) {
  if (!placing) return;
  placing = false; at = null;
  if (preview) { scene.remove(preview); preview.traverse((o) => (o as THREE.Line).geometry?.dispose()); preview = null; }
  if (!quiet) logLine(tl('You put the Survey Stake away.'));
}
export const fieldPlacingHint = () => (!placing ? null : problem ?? (mode === 'mast' ? tl('Click — stake out the mooring mast here (its airship lies away from you) · right mouse / Esc — cancel') : mode === 'pad' ? tl('Click — stake out the drone pad here · right mouse / Esc — cancel') : mode === 'warehouse' ? tl('Click — stake out the warehouse here (its doors face you) · right mouse / Esc — cancel') : tl('Click — stake out the field here · right mouse / Esc — cancel')));
export const fieldPlacingOk = () => !!at && !problem;

/** The ground point you look at (up to 60 m away). */
function aim(): [number, number] {
  const T = OW.terrain!, cp = Math.cos(G.pitch), dx = -Math.sin(G.yaw) * cp, dy = Math.sin(G.pitch), dz = -Math.cos(G.yaw) * cp, y0 = G.pos.y + 1.6;
  for (let t = 2; t <= (mode === 'warehouse' ? 90 : 60); t += 0.5) { const x = G.pos.x + dx * t, z = G.pos.z + dz * t; if (y0 + dy * t <= T.heightAt(x, z)) return [x, z]; }
  const h = Math.hypot(dx, dz) || 1; return [G.pos.x + dx / h * 20, G.pos.z + dz / h * 20];
}
/** Every frame while staking out: follow the view, check the spot, redraw the hologram when it moved. */
export function updateFieldPlacing() {
  if (!placing) return;
  const T = OW.terrain;
  if (G.char.loc !== 'overworld' || driving.v || !T) { cancelFieldPlacing(true); return; }
  const now = performance.now(); let [x, z] = aim();
  x = Math.round(x); z = Math.round(z); // on the metre: the hologram does not swim
  if ((x === last.x && z === last.z) || now - last.t < 100) return;
  last = { x, z, t: now };
  const poi = findPoi(G.char.world, vid);
  if (mode === 'warehouse') { warehouseHologram(T, poi, x, z); return; }
  if (mode === 'pad') { padHologram(T, poi, x, z); return; }
  if (mode === 'mast') { mastHologram(T, poi, x, z); return; }
  if (!poi || !G.char.towns[vid]?.fwait) { cancelFieldPlacing(true); logLine(tl('That farm\'s field has been staked out already.')); return; }
  problem = fieldProblem(T, poi, villageSeed(G.char.world, poi), G.char.towns[vid], x, z, allClaims()) || null;
  const y = fieldPad(T, x, z); at = { x, z, y };
  const a: number[] = [], b: number[] = [], r = FIELD.half;
  // the field at its levelled height, its stakes down to the ground, the furrows, and the ring where it blends back
  const c = [[-r, -r], [r, -r], [r, r], [-r, r]];
  for (let k = 0; k < 4; k++) { const [u0, v0] = c[k], [u1, v1] = c[(k + 1) % 4]; a.push(x + u0, y + 0.08, z + v0, x + u1, y + 0.08, z + v1); a.push(x + u0, T.heightAt(x + u0, z + v0), z + v0, x + u0, y + 1.2, z + v0); }
  for (let u = -r + 1.5; u < r; u += 1.5) b.push(x + u, y + 0.05, z - r + 0.8, x + u, y + 0.05, z + r - 0.8);
  const R = FIELD.flat + FIELD.blend;
  for (let k = 0; k < 32; k++) { const p0 = k / 32 * 6.283, p1 = (k + 1) / 32 * 6.283; b.push(x + Math.cos(p0) * R, T.heightAt(x + Math.cos(p0) * R, z + Math.sin(p0) * R) + 0.1, z + Math.sin(p0) * R, x + Math.cos(p1) * R, T.heightAt(x + Math.cos(p1) * R, z + Math.sin(p1) * R) + 0.1, z + Math.sin(p1) * R); }
  lines(a, b);
}
function lines(a: number[], b: number[]) {
  if (!preview) { preview = new THREE.Group(); preview.renderOrder = 10; scene.add(preview); }
  preview.traverse((o) => (o as THREE.Line).geometry?.dispose()); preview.clear();
  for (const [pts, m] of [[a, matA], [b, matB]] as const) {
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const l = new THREE.LineSegments(geo, m); l.renderOrder = 10; l.frustumCulled = false; preview.add(l);
  }
  matA.color.setHex(problem ? BAD : OK); matB.color.setHex(problem ? BAD : OK);
}
/** (0.197) The warehouse's hologram: the barn's footprint at the height its ground is levelled to, corner posts, the
 *  doorway marked with tall posts, and the apron before the doors the vehicles drive over. Its doors face you. */
function warehouseHologram(T: NonNullable<typeof OW.terrain>, poi: ReturnType<typeof findPoi>, x: number, z: number) {
  const s = poi && G.char.towns[vid];
  if (!poi || !s?.settlement?.whWait) { cancelFieldPlacing(true); logLine(tl('That warehouse has been staked out already.')); return; }
  const ox = x - wrapDx(x - poi.x) + VILLAGE_OFFSET.x, oz = poi.z + VILLAGE_OFFSET.z; // the village's frame on your copy of the planet
  const px = G.pos.x - x, pz = G.pos.z - z, d = Math.abs(px) > Math.abs(pz) ? (px > 0 ? 1 : 3) : (pz > 0 ? 0 : 2);
  const spot: HallSpot = { x: Math.round(x - ox), z: Math.round(z - oz), d };
  const at0 = hall && at; if (at0 && hall!.x === spot.x && hall!.z === spot.z && hall!.d === spot.d) return;
  hall = spot;
  problem = warehouseProblem(T, poi, villageSeed(G.char.world, poi), s, spot, allClaims(), hubs(G.char.world, G.char.towns, G.char.outposts)) || null;
  const h = warehouseAt(spot), wr = { x0: ox + h.x0, z0: oz + h.z0, x1: ox + h.x1, z1: oz + h.z1 }, y = meanGround(G.char.world, wr);
  at = { x: ox + spot.x, z: oz + spot.z, y };
  const a: number[] = [], b: number[] = [], P = (u: number, v: number) => { const [hx, hz] = hallPoint(h, u, v); return [ox + hx, oz + hz]; };
  const hw = (h.x1 - h.x0) / 2, hd = (h.z1 - h.z0) / 2, c = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]];
  for (let k = 0; k < 4; k++) {
    const [p0x, p0z] = P(c[k][0], c[k][1]), [p1x, p1z] = P(c[(k + 1) % 4][0], c[(k + 1) % 4][1]);
    a.push(p0x, y + 0.08, p0z, p1x, y + 0.08, p1z, p0x, T.heightAt(p0x, p0z), p0z, p0x, y + 2.2, p0z);
  }
  for (const u of [-h.door / 2, h.door / 2]) { const [qx, qz] = P(u, hd); a.push(qx, Math.min(y, T.heightAt(qx, qz)), qz, qx, y + 4.8, qz); }
  { const [qx, qz] = P(-h.door / 2, hd), [rx, rz] = P(h.door / 2, hd); a.push(qx, y + 4.8, qz, rx, y + 4.8, rz); }
  const ap = apronOf(h), [ax0, az0] = [ox + ap.x0, oz + ap.z0], [ax1, az1] = [ox + ap.x1, oz + ap.z1];
  const ring = [[ax0, az0], [ax1, az0], [ax1, az1], [ax0, az1]];
  for (let k = 0; k < 4; k++) { const [p0x, p0z] = ring[k], [p1x, p1z] = ring[(k + 1) % 4]; b.push(p0x, T.heightAt(p0x, p0z) + 0.1, p0z, p1x, T.heightAt(p1x, p1z) + 0.1, p1z); }
  // an arrow on the apron pointing in at the doors
  { const [t0x, t0z] = P(0, hd + WAREHOUSE.apron - 2), [t1x, t1z] = P(0, hd + 2), [l1x, l1z] = P(-2, hd + 4.5), [r1x, r1z] = P(2, hd + 4.5);
    const Y = (px: number, pz: number) => T.heightAt(px, pz) + 0.15;
    b.push(t0x, Y(t0x, t0z), t0z, t1x, Y(t1x, t1z), t1z, t1x, Y(t1x, t1z), t1z, l1x, Y(l1x, l1z), l1z, t1x, Y(t1x, t1z), t1z, r1x, Y(r1x, r1z), r1z); }
  for (let u = -hw + 3; u < hw; u += 3) { const [p0x, p0z] = P(u, -hd), [p1x, p1z] = P(u, hd); b.push(p0x, y + 0.05, p0z, p1x, y + 0.05, p1z); }
  lines(a, b);
}
/** (0.255) The drone pad's hologram: its slab with the ring and the H, corner stakes down to the ground. */
function padHologram(T: NonNullable<typeof OW.terrain>, poi: ReturnType<typeof findPoi>, x: number, z: number) {
  const c = G.char, s = poi && c.towns[vid];
  if (!poi || !s?.dpWait) { cancelFieldPlacing(true); logLine(tl('That drone pad has been staked out already.')); return; }
  const me = hubs(c.world, c.towns, c.outposts).find((h) => h.id === villageHub(vid));
  if (!me) { cancelFieldPlacing(true); return; }
  problem = padProblem(T, poi, villageSeed(c.world, poi), s, x, z, allClaims(), me) || null;
  const y = T.heightAt(x, z); at = { x, z, y };
  const a: number[] = [], b: number[] = [], R = 4, Y = (px: number, pz: number) => T.heightAt(px, pz) + 0.12;
  const cs = [[-R, -R], [R, -R], [R, R], [-R, R]];
  for (let k = 0; k < 4; k++) { const [u0, v0] = cs[k], [u1, v1] = cs[(k + 1) % 4]; a.push(x + u0, Y(x + u0, z + v0), z + v0, x + u1, Y(x + u1, z + v1), z + v1, x + u0, Y(x + u0, z + v0) - 0.1, z + v0, x + u0, Y(x + u0, z + v0) + 1.2, z + v0); }
  for (let k = 0; k < 24; k++) { const p0 = k / 24 * 6.283, p1 = (k + 1) / 24 * 6.283; a.push(x + Math.cos(p0) * 2.6, Y(x + Math.cos(p0) * 2.6, z + Math.sin(p0) * 2.6), z + Math.sin(p0) * 2.6, x + Math.cos(p1) * 2.6, Y(x + Math.cos(p1) * 2.6, z + Math.sin(p1) * 2.6), z + Math.sin(p1) * 2.6); }
  for (const u of [-1, 1]) a.push(x + u, Y(x + u, z - 1.2), z - 1.2, x + u, Y(x + u, z + 1.2), z + 1.2);
  a.push(x - 1, Y(x - 1, z), z, x + 1, Y(x + 1, z), z);
  const H = PAD_HALF, ring = [[-H, -H], [H, -H], [H, H], [-H, H]];
  for (let k = 0; k < 4; k++) { const [u0, v0] = ring[k], [u1, v1] = ring[(k + 1) % 4]; b.push(x + u0, Y(x + u0, z + v0), z + v0, x + u1, Y(x + u1, z + v1), z + v1); }
  const wx = x + wrapDx(me.x - x);
  b.push(x, Y(x, z), z, wx, T.heightAt(wx, me.z) + 0.2, me.z); // a line back to the warehouse
  lines(a, b);
}
/** (0.257) The mooring mast's hologram: its foot, the mast up to its head, the airship moored there lying away from you
 *  (its outline at the mast's height) and the ground kept clear under it. */
function mastHologram(T: NonNullable<typeof OW.terrain>, poi: ReturnType<typeof findPoi>, x: number, z: number) {
  const c = G.char, s = poi && c.towns[vid];
  if (!poi || !s?.amWait) { cancelFieldPlacing(true); logLine(tl('That mooring mast has been staked out already.')); return; }
  const me = hubs(c.world, c.towns, c.outposts).find((h) => h.id === villageHub(vid));
  if (!me) { cancelFieldPlacing(true); return; }
  heading = Math.atan2(z - G.pos.z, x - G.pos.x);
  if (!Number.isFinite(heading)) heading = 0;
  problem = mastProblem(T, poi, villageSeed(c.world, poi), s, x, z, heading, allClaims(), me) || null;
  const y = T.heightAt(x, z); at = { x, z, y };
  const a: number[] = [], b: number[] = [], H = AIRMAST.h, Y = (px: number, pz: number) => T.heightAt(px, pz) + 0.12;
  const ox = Math.cos(heading), oz = Math.sin(heading), px = -oz, pz = ox, P = (d: number, w: number): [number, number] => [x + ox * d + px * w, z + oz * d + pz * w];
  const cs = [[-1.5, -1.5], [1.5, -1.5], [1.5, 1.5], [-1.5, 1.5]];
  for (let k = 0; k < 4; k++) { const [u0, v0] = cs[k], [u1, v1] = cs[(k + 1) % 4]; a.push(x + u0, Y(x + u0, z + v0), z + v0, x + u1, Y(x + u1, z + v1), z + v1, x + u0, Y(x + u0, z + v0), z + v0, x, y + H, z); }
  // the airship lying at its mast: the hull's outline at the mast's head, its nose by the head
  const R = AIRSHIP.r, L = AIRSHIP.len, n0 = 0.6;
  for (const w of [-R, R]) { const [q0x, q0z] = P(n0 + 4, w), [q1x, q1z] = P(n0 + L - 6, w); a.push(q0x, y + H, q0z, q1x, y + H, q1z); }
  for (const [d0, w0, d1, w1] of [[n0, 0, n0 + 4, -R], [n0, 0, n0 + 4, R], [n0 + L - 6, -R, n0 + L, 0], [n0 + L - 6, R, n0 + L, 0]]) { const [q0x, q0z] = P(d0, w0), [q1x, q1z] = P(d1, w1); a.push(q0x, y + H, q0z, q1x, y + H, q1z); }
  { const [gx, gz] = P(n0 + L / 2, 0); a.push(x, y + H, z, gx, y + H, gz); b.push(gx, y + H, gz, gx, Y(gx, gz), gz); }
  // the ground kept clear under it
  for (const w of [-AIRMAST.clear, AIRMAST.clear]) for (let d = 2; d < L + 1; d += 3) { const [q0x, q0z] = P(d, w), [q1x, q1z] = P(d + 3, w); b.push(q0x, Y(q0x, q0z), q0z, q1x, Y(q1x, q1z), q1z); }
  const wx = x + wrapDx(me.x - x);
  b.push(x, Y(x, z), z, wx, T.heightAt(wx, me.z) + 0.2, me.z); // a line back to the warehouse
  lines(a, b);
}
/** Stake out the field (or the warehouse, or the drone pad) where the hologram stands: the builders start there. */
export async function confirmFieldPlacing() {
  if (!placing) return;
  if (mode === 'warehouse') { await confirmWarehouse(); return; }
  if (mode === 'pad') { await confirmPad(); return; }
  if (mode === 'mast') { await confirmMast(); return; }
  if (!at || problem) { logLine(problem ?? tl('Look at the ground where the field should go.')); return; }
  const spot = at, id = vid, c = G.char;
  let ok = false;
  await withTownStock(id, () => { const s = (c.towns[id] ??= {}); ok = placeFarm(s, spot, c.time); });
  if (!ok) { cancelFieldPlacing(true); logLine(tl('Someone else has staked out that farm\'s field already.')); return; }
  takeOne('fieldstake');
  c.gold += FARM.gold; gainXp(FARM.xp); earnTrust(id, 'farm'); calcStats(); saveChar(); // the builders take over: you are paid now
  cancelFieldPlacing(true);
  fieldsChanged(spot); reloadStruct(id);
  showToast(tl('Field staked out'));
  logLine(TL`The villagers come out with their tools: the ground is levelled and the new farm goes up there. They pay you ${FARM.gold} gold.`);
}
/** Stake out the warehouse: its spot is saved in the village (shared), the ground is levelled and the builders start. */
async function confirmWarehouse() {
  if (!hall || problem) { logLine(problem ?? tl('Look at the ground where the warehouse should stand.')); return; }
  const spot = hall, id = vid, c = G.char;
  let ok = false;
  await withTownStock(id, () => { const s = (c.towns[id] ??= {}); ok = placeWarehouse(s, spot, c.time); });
  if (!ok) { cancelFieldPlacing(true); logLine(tl('Someone else has staked out the warehouse already.')); return; }
  takeOne('fieldstake'); saveChar();
  cancelFieldPlacing(true);
  reloadStruct(id); // (the ground under it is eased within a second: world/overworld.ts syncVillagePads)
  showToast(tl('Warehouse staked out'));
  logLine(tl('The builders carry the planks out to your stakes: the ground is levelled and the warehouse goes up there, its wide doors facing the way you came.'));
}
/** (0.255) Stake out the drone pad: its spot is saved in the village (shared) and the builders start. */
async function confirmPad() {
  if (!at || problem) { logLine(problem ?? tl('Look at the ground where the pad should go.')); return; }
  const id = vid, c = G.char, poi = findPoi(c.world, id);
  if (!poi) return;
  const spot = { x: poi.x + wrapDx(at.x - poi.x), z: at.z };
  let ok = false;
  await withTownStock(id, () => { const s = (c.towns[id] ??= {}); ok = placePad(s, spot, c.time); });
  if (!ok) { cancelFieldPlacing(true); logLine(tl('Someone else has staked out the drone pad already.')); return; }
  takeOne('fieldstake'); saveChar();
  cancelFieldPlacing(true);
  fieldsChanged({ ...spot, y: 0 }); // the trees there are cleared
  showToast(tl('Drone pad staked out'));
  logLine(tl('The builders bring the cement out to your stakes: the drone pad goes down there.'));
}
/** (0.257) Stake out the mooring mast: its spot and its airship's heading are saved in the village (shared) and the builders start. */
async function confirmMast() {
  if (!at || problem) { logLine(problem ?? tl('Look at the ground where the mast should stand.')); return; }
  const id = vid, c = G.char, poi = findPoi(c.world, id);
  if (!poi) return;
  const spot = { x: poi.x + wrapDx(at.x - poi.x), z: at.z, a: heading };
  let ok = false;
  await withTownStock(id, () => { const s = (c.towns[id] ??= {}); ok = placeMast(s, spot, c.time); });
  if (!ok) { cancelFieldPlacing(true); logLine(tl('Someone else has staked out the mooring mast already.')); return; }
  takeOne('fieldstake'); saveChar();
  cancelFieldPlacing(true);
  for (const q of mastClaims(spot)) fieldsChanged({ x: q.x, z: q.z, y: 0 }); // the trees there are cleared
  showToast(tl('Mooring mast staked out'));
  logLine(tl('The builders bring the steel out to your stakes: the mast goes up there, and the ground beyond it is kept clear for its airship.'));
}
