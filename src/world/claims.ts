// Land claims at runtime: raising a Flagpole (placement preview, the flag itself) and taking it down again.
// Using a Flagpole from the backpack starts placing: a hologram shows where the flag goes, the levelled pad, how the
// ground blends back to the land, how much will be dug out or filled (the ticks) and the claimed border. A click
// (or E) raises it, the right mouse button or Esc cancels. The ground is levelled by the terrain itself
// (gen/claims.ts); here the loaded chunks are rebuilt and the flags drawn.
import * as THREE from 'three';
import { scene } from './render';
import { G } from '../game';
import { PropBatch } from './props';
import { takeOne, addItem, saveChar } from '../character';
import { logLine } from '../ui/hud';
import { OW, rebuildChunksNear } from './overworld';
import { driving } from './vehicles';
import { nearX } from '../gen/regions';
import { CLAIM, CLEAR_R, claimFlatten, claimProblem, padHeight, claimDist, type Claim } from '../gen/claims';
import { EYE } from './player';
import type { Char } from '../save';

export type SavedClaim = Char['claims'][number];
const POLE_H = 8, OK = 0xe8fff0, BAD = 0xff5a3c, CLOTH = 0x3dff6e, POLE = 0xc4ffd2;

// ---------- the flags ----------
const drawn = new Map<SavedClaim, THREE.Group>();
function flagModel(c: SavedClaim, x: number): THREE.Group {
  const pb = new PropBatch(), y = c.y;
  pb.box(x - 0.6, y, c.z - 0.6, x + 0.6, y + 0.35, c.z + 0.6, POLE); // a footing
  pb.box(x - 0.09, y + 0.35, c.z - 0.09, x + 0.09, y + POLE_H, c.z + 0.09, POLE);
  pb.line(CLOTH, [x + 0.1, y + POLE_H - 0.1, c.z], [x + 2.6, y + POLE_H - 0.8, c.z + 0.15], [x + 0.1, y + POLE_H - 1.7, c.z]);
  pb.line(CLOTH, [x + 0.1, y + POLE_H - 0.9, c.z], [x + 1.8, y + POLE_H - 0.85, c.z + 0.1]);
  pb.line(POLE, [x, y + POLE_H, c.z], [x, y + POLE_H + 0.3, c.z]);
  return pb.build();
}
/** Draw the flags within sight, drop far ones (called now and then, and after a change). */
export function syncFlags() {
  const p = G.pos, want = new Set<SavedClaim>();
  if (G.char.loc === 'overworld') for (const c of G.char.claims) if (Math.hypot(nearX(c.x, p.x) - p.x, c.z - p.z) < 260) want.add(c);
  for (const [c, g] of drawn) if (!want.has(c) || Math.abs(g.userData.x - nearX(c.x, p.x)) > 1) { scene.remove(g); g.traverse((o) => (o as THREE.Mesh).geometry?.dispose()); drawn.delete(c); }
  for (const c of want) if (!drawn.has(c)) { const x = nearX(c.x, p.x), g = flagModel(c, x); g.userData.x = x; scene.add(g); drawn.set(c, g); }
}
export function clearFlags() { for (const g of drawn.values()) scene.remove(g); drawn.clear(); }

/** Hand the claims to the terrain and rebuild the ground around `at` (a flag raised or taken down there). */
function applyClaims(at?: Claim) {
  const T = OW.terrain; if (!T) return;
  T.setClaims(G.char.claims);
  if (at) rebuildChunksNear(nearX(at.x, G.pos.x), at.z, CLEAR_R + 2);
  // what stands on the changed ground follows it
  for (const b of G.char.benches) if (claimDist(at ?? b, b.x, b.z) < CLEAR_R) b.y = T.heightAt(nearX(b.x, G.pos.x), b.z);
  const g = T.heightAt(G.pos.x, G.pos.z); if (G.pos.y < g) G.pos.y = g;
  syncFlags();
}

/** The claim whose land covers (x, z). */
export const claimHere = (x: number, z: number) => G.char.claims.find((c) => claimDist(c, x, z) < CLAIM.r);
/** Your flag within reach (for E). */
export function nearFlag(): SavedClaim | null {
  if (G.char.loc !== 'overworld') return null;
  return G.char.claims.find((c) => claimDist(c, G.pos.x, G.pos.z) < 2.2) ?? null;
}
/** Take the flag down: the land goes back to how it was. Returns an error message or ''. */
export function takeDownFlag(c: SavedClaim): string {
  if (!addItem('flagpole')) return 'No room in your backpack for the Flagpole (14 L).';
  G.char.claims.splice(G.char.claims.indexOf(c), 1); saveChar();
  applyClaims(c);
  return '';
}

// ---------- placing ----------
let placing = false, preview: THREE.Group | null = null, last = { x: NaN, z: NaN, t: 0 }, spot: { x: number; z: number; y: number; problem: string | null } | null = null;
const matLine = new THREE.LineBasicMaterial({ color: OK, transparent: true, opacity: 0.9, depthTest: false, fog: false });
const matDim = new THREE.LineBasicMaterial({ color: OK, transparent: true, opacity: 0.5, depthTest: false, fog: false });

export const isPlacing = () => placing;
/** Use a Flagpole: start choosing the spot. */
export function startPlacing(): boolean {
  if (G.char.loc !== 'overworld' || !OW.terrain) { logLine('Raise the flag outdoors.'); return false; }
  if (driving.v) { logLine('Get out of the vehicle first.'); return false; }
  placing = true; last = { x: NaN, z: NaN, t: 0 };
  logLine('Look at the spot for your flag: click to raise it, right mouse button or Esc to cancel.');
  return true;
}
export function cancelPlacing(quiet = false) {
  if (!placing) return;
  placing = false; spot = null;
  if (preview) { scene.remove(preview); preview.traverse((o) => (o as THREE.Line).geometry?.dispose()); preview = null; }
  if (!quiet) logLine('You put the Flagpole away.');
}
/** Raise the flag at the chosen spot. */
export function confirmPlacing() {
  if (!placing || !spot) return;
  if (spot.problem) { logLine(spot.problem); return; }
  if (!takeOne('flagpole')) { cancelPlacing(true); return; }
  const c: SavedClaim = { x: spot.x, z: spot.z, y: spot.y, t: G.char.time };
  G.char.claims.push(c); saveChar();
  cancelPlacing(true);
  applyClaims(c);
  logLine(`The flag is up: the land ${CLAIM.r} m around it is yours, and the ground is levelled for building.`);
}
/** The hint shown while placing (null when not placing). */
export const placingHint = () => (!placing ? null : !spot ? '' : spot.problem ? spot.problem : 'Click — raise the flag here · right mouse / Esc — cancel');
export const placingOk = () => !!spot && !spot.problem;

/** Where the player looks: the first point of the ground along the view, or a spot ahead. */
function aimPoint(): [number, number] {
  const T = OW.terrain!, cp = Math.cos(G.pitch), dx = -Math.sin(G.yaw) * cp, dy = Math.sin(G.pitch), dz = -Math.cos(G.yaw) * cp;
  const x0 = G.pos.x, y0 = G.pos.y + EYE, z0 = G.pos.z;
  const h = Math.hypot(dx, dz) || 1, MIN = CLAIM.flat + 3; // never closer than that: the whole pad stays in view
  for (let t = 2; t <= 60; t += 0.5) {
    const x = x0 + dx * t, z = z0 + dz * t;
    if (y0 + dy * t <= T.heightAt(x, z)) { const d = Math.max(MIN, t * h); return [x0 + dx / h * d, z0 + dz / h * d]; }
  }
  return [x0 + dx / h * 24, z0 + dz / h * 24];
}
/** Placing, every frame: follow the view, check the spot, redraw the hologram when it moved. */
export function updatePlacing() {
  if (!placing) return;
  if (G.char.loc !== 'overworld' || driving.v || !OW.terrain) { cancelPlacing(true); return; }
  const now = performance.now(), [x, z] = aimPoint();
  if (Math.hypot(x - last.x, z - last.z) < 0.75 || now - last.t < 120) return;
  last = { x, z, t: now };
  const T = OW.terrain, y = padHeight(T, x, z), problem = claimProblem(T, x, z, G.char.claims);
  spot = { x, z, y, problem };
  const c = { x, z, y }, bright: number[] = [], dim: number[] = [];
  const after = (px: number, pz: number) => claimFlatten(c, px, pz, T.heightAt(px, pz));
  // the flag
  const fy = problem ? T.heightAt(x, z) : y;
  bright.push(x, fy, z, x, fy + POLE_H, z, x, fy + POLE_H - 0.1, z, x + 2.6, fy + POLE_H - 0.8, z, x + 2.6, fy + POLE_H - 0.8, z, x, fy + POLE_H - 1.7, z);
  // the levelled pad and the edge of the changed ground, each point where the ground will be
  const ring = (r: number, out: number[], lift: number, dash = false) => {
    const n = Math.max(24, Math.round(r * 2.5));
    for (let i = 0; i < n; i++) {
      if (dash && i % 2) continue;
      const a0 = i / n * 6.2832, a1 = (i + 1) / n * 6.2832, ax = x + Math.cos(a0) * r, az = z + Math.sin(a0) * r, bx = x + Math.cos(a1) * r, bz = z + Math.sin(a1) * r;
      out.push(ax, after(ax, az) + lift, az, bx, after(bx, bz) + lift, bz);
    }
  };
  ring(CLAIM.flat, bright, 0.08);
  ring(CLEAR_R, dim, 0.1);
  ring(CLAIM.r, bright, 0.25, true); // the claimed border
  // the slopes back to the land: spokes following the new ground
  for (let a = 0; a < 6.28; a += Math.PI / 12) {
    const cx = Math.cos(a), sz = Math.sin(a);
    for (let r = CLAIM.flat; r < CLEAR_R; r += 2) dim.push(x + cx * r, after(x + cx * r, z + sz * r) + 0.1, z + sz * r, x + cx * (r + 2), after(x + cx * (r + 2), z + sz * (r + 2)) + 0.1, z + sz * (r + 2));
  }
  // the levelled floor: a grid at the pad's height, cut to its circle
  const F = CLAIM.flat;
  for (let k = -F + 2; k < F; k += 2) {
    const h = Math.sqrt(F * F - k * k);
    bright.push(x - h, y + 0.06, z + k, x + h, y + 0.06, z + k, x + k, y + 0.06, z - h, x + k, y + 0.06, z + h);
  }
  // cut and fill: posts from the ground as it is to the floor
  for (let u = -F; u <= F; u += 4) for (let v = -F; v <= F; v += 4) {
    if (Math.hypot(u, v) > F - 0.5) continue;
    const g = T.heightAt(x + u, z + v);
    if (Math.abs(g - y) > 0.15) dim.push(x + u, g, z + v, x + u, y, z + v);
  }
  if (!preview) { preview = new THREE.Group(); preview.renderOrder = 10; scene.add(preview); }
  preview.traverse((o) => (o as THREE.Line).geometry?.dispose()); preview.clear();
  for (const [pts, m] of [[bright, matLine], [dim, matDim]] as const) {
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const l = new THREE.LineSegments(geo, m); l.renderOrder = 10; l.frustumCulled = false; preview.add(l);
  }
  matLine.color.setHex(problem ? BAD : OK); matDim.color.setHex(problem ? BAD : OK);
}
