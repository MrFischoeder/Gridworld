// Staking out a new farm's field (gen/fields.ts): with a Survey Stake from the elder you walk out of the village,
// use the stake and look where the field should go. A hologram shows the 12 m field, its fence line and how the
// ground will be levelled (lime: fine; red with the reason: not there). A click stakes it out: the village is
// reserved first (ui/stock.ts withTownStock), the spot is saved (`TownState.fplots`), the ground is levelled for
// everyone (world/claims.ts fieldsChanged) and the builders start (world/jobsites.ts). Right mouse or Esc puts the
// stake away. Multiplayer: the spot and the job are shared; if two heroes stake out the same farm, the reservation
// lets only the first through.
import * as THREE from 'three';
import { G } from '../game';
import { OW, reloadStruct } from './overworld';
import { driving } from './vehicles';
import { scene } from './render';
import { allVillages, worldDist, findPoi, villageSeed } from '../gen/regions';
import { FIELD, fieldProblem, fieldPad } from '../gen/fields';
import { placeFarm, FARM } from '../gen/farms';
import { takeOne, saveChar, calcStats, gainXp } from '../character';
import { withTownStock } from '../ui/stock';
import { allClaims, fieldsChanged } from './claims';
import { earnTrust } from './standing';
import { logLine, showToast } from '../ui/hud';

let placing = false, preview: THREE.Group | null = null, problem: string | null = null, at: { x: number; z: number; y: number } | null = null, vid = -1;
let last = { x: NaN, z: NaN, t: 0 };
const OK = 0xb6ff3a, BAD = 0xff5a3c;
const matA = new THREE.LineBasicMaterial({ color: OK, depthTest: false, transparent: true, opacity: 0.95 });
const matB = new THREE.LineBasicMaterial({ color: OK, depthTest: false, transparent: true, opacity: 0.45 });

/** The village whose farm waits for its field, nearest to you within reach. */
function waiting(): number {
  const c = G.char, out = allVillages(c.world).filter((v) => c.towns[v.id]?.fwait && worldDist(v.x, v.z, G.pos.x, G.pos.z) < FIELD.reach + 150);
  out.sort((a, b) => worldDist(a.x, a.z, G.pos.x, G.pos.z) - worldDist(b.x, b.z, G.pos.x, G.pos.z));
  return out[0]?.id ?? -1;
}
export const isFieldPlacing = () => placing;
/** Use a Survey Stake: start choosing the field. */
export function startFieldPlacing(): boolean {
  if (G.char.loc !== 'overworld' || !OW.terrain) { logLine('A field is staked out in the open, near its village.'); return false; }
  if (driving.v) { logLine('Get out of the vehicle first.'); return false; }
  vid = waiting();
  if (vid < 0) { logLine('No farm waits for its field near here. The elder gives a stake once a new farm\'s materials are in.'); return false; }
  placing = true; at = null; problem = null; last = { x: NaN, z: NaN, t: 0 };
  logLine(`Look where the new field of ${findPoi(G.char.world, vid)?.name ?? 'the village'} should go (within ${FIELD.reach} m): click to stake it out, right mouse button or Esc to cancel.`);
  return true;
}
export function cancelFieldPlacing(quiet = false) {
  if (!placing) return;
  placing = false; at = null;
  if (preview) { scene.remove(preview); preview.traverse((o) => (o as THREE.Line).geometry?.dispose()); preview = null; }
  if (!quiet) logLine('You put the Survey Stake away.');
}
export const fieldPlacingHint = () => (!placing ? null : problem ?? 'Click — stake out the field here · right mouse / Esc — cancel');
export const fieldPlacingOk = () => !!at && !problem;

/** The ground point you look at (up to 60 m away). */
function aim(): [number, number] {
  const T = OW.terrain!, cp = Math.cos(G.pitch), dx = -Math.sin(G.yaw) * cp, dy = Math.sin(G.pitch), dz = -Math.cos(G.yaw) * cp, y0 = G.pos.y + 1.6;
  for (let t = 2; t <= 60; t += 0.5) { const x = G.pos.x + dx * t, z = G.pos.z + dz * t; if (y0 + dy * t <= T.heightAt(x, z)) return [x, z]; }
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
  if (!poi || !G.char.towns[vid]?.fwait) { cancelFieldPlacing(true); logLine('That farm\'s field has been staked out already.'); return; }
  problem = fieldProblem(T, poi, villageSeed(G.char.world, poi), G.char.towns[vid], x, z, allClaims()) || null;
  const y = fieldPad(T, x, z); at = { x, z, y };
  if (!preview) { preview = new THREE.Group(); preview.renderOrder = 10; scene.add(preview); }
  preview.traverse((o) => (o as THREE.Line).geometry?.dispose()); preview.clear();
  const a: number[] = [], b: number[] = [], r = FIELD.half;
  // the field at its levelled height, its stakes down to the ground, the furrows, and the ring where it blends back
  const c = [[-r, -r], [r, -r], [r, r], [-r, r]];
  for (let k = 0; k < 4; k++) { const [u0, v0] = c[k], [u1, v1] = c[(k + 1) % 4]; a.push(x + u0, y + 0.08, z + v0, x + u1, y + 0.08, z + v1); a.push(x + u0, T.heightAt(x + u0, z + v0), z + v0, x + u0, y + 1.2, z + v0); }
  for (let u = -r + 1.5; u < r; u += 1.5) b.push(x + u, y + 0.05, z - r + 0.8, x + u, y + 0.05, z + r - 0.8);
  const R = FIELD.flat + FIELD.blend;
  for (let k = 0; k < 32; k++) { const p0 = k / 32 * 6.283, p1 = (k + 1) / 32 * 6.283; b.push(x + Math.cos(p0) * R, T.heightAt(x + Math.cos(p0) * R, z + Math.sin(p0) * R) + 0.1, z + Math.sin(p0) * R, x + Math.cos(p1) * R, T.heightAt(x + Math.cos(p1) * R, z + Math.sin(p1) * R) + 0.1, z + Math.sin(p1) * R); }
  for (const [pts, m] of [[a, matA], [b, matB]] as const) {
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const l = new THREE.LineSegments(geo, m); l.renderOrder = 10; l.frustumCulled = false; preview.add(l);
  }
  matA.color.setHex(problem ? BAD : OK); matB.color.setHex(problem ? BAD : OK);
}
/** Stake out the field where the hologram stands: the builders start there. */
export async function confirmFieldPlacing() {
  if (!placing) return;
  if (!at || problem) { logLine(problem ?? 'Look at the ground where the field should go.'); return; }
  const spot = at, id = vid, c = G.char;
  let ok = false;
  await withTownStock(id, () => { const s = (c.towns[id] ??= {}); ok = placeFarm(s, spot, c.time); });
  if (!ok) { cancelFieldPlacing(true); logLine('Someone else has staked out that farm\'s field already.'); return; }
  takeOne('fieldstake');
  c.gold += FARM.gold; gainXp(FARM.xp); earnTrust(id, 'farm'); calcStats(); saveChar(); // the builders take over: you are paid now
  cancelFieldPlacing(true);
  fieldsChanged(spot); reloadStruct(id);
  showToast('Field staked out');
  logLine(`The villagers come out with their tools: the ground is levelled and the new farm goes up there. They pay you ${FARM.gold} gold.`);
}
