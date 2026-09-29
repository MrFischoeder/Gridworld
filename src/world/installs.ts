// The great installations in the world (gen/installs.ts): drawn when you come within reach, dropped when you leave.
// The chip foundry (`drawChips`) is described at its function.
// The uranium enrichment plant: a broken perimeter fence with a gate and a warning sign, the centrifuge hall (walls
// with a doorway, a collapsed corner, bare roof trusses, rows of centrifuges inside, some toppled), two hyperboloid
// cooling towers (one snapped off), a tall stack and pipes on trestles. Every solid has a dark fill. The hall's walls,
// the towers and the stack collide (`installHit`). The restoration (gen/installs.ts, `char.installs`) shows: cleared
// (rubble, toppled centrifuges and fallen trusses gone, the fence mended), the hall rebuilt (walls whole, trusses and a
// roof, every centrifuge standing), restored (the centrifuges glow). The control desk inside the gate opens the
// restoration window (`nearInstallDesk`, ui/install.ts).
import * as THREE from 'three';
import { scene } from './render';
import { PropBatch } from './props';
import { G } from '../game';
import { OW } from './overworld';
import { installSites, INSTALL_STAGES, type InstallSite, type InstallKind } from '../gen/installs';
import { nearX, worldDist } from '../gen/regions';
import type { Terrain } from '../gen/terrain';

const METAL = 0xa8c8b8, RUST = 0x9aa870, CONC = 0x7fa08c, GLOW = 0xb6ff3a;
interface Live { s: InstallSite; g: THREE.Group; cos: number; sin: number; stage: number; spin?: THREE.Object3D | null; walls: [number, number, number, number][]; rings: [number, number, number][] }
/** The control desk in each installation's frame (inside the gate, west of the way in). */
export const DESKS: Record<InstallKind, { x: number; z: number }> = { uranium: { x: -6, z: -25 }, chips: { x: -6, z: -23 }, radar: { x: -6, z: -21 } };
const live = new Map<string, Live>();

/** The perimeter fence (half-size F): posts every 4 m and two wires, with gaps and leaning posts until cleared; the gate on the -z side. */
function drawFence(pb: PropBatch, H: (x: number, z: number) => number, F: number, cleared: boolean) {
  const at = (x: number, z: number, dy = 0) => [x, H(x, z) + dy, z];
  const side = (ax: number, az: number, bx: number, bz: number, seed: number) => {
    const L = Math.hypot(bx - ax, bz - az), n = Math.round(L / 4);
    let prev: number[][] | null = null;
    for (let i = 0; i <= n; i++) {
      const x = ax + (bx - ax) * i / n, z = az + (bz - az) * i / n, broken = !cleared && (i * 7 + seed) % 11 === 0, gate = az === -F && bz === -F && Math.abs(x) < 3.5;
      if (gate) { prev = null; continue; }
      const lean = !cleared && (i * 13 + seed) % 7 === 0 ? 0.7 : 0, top = at(x + lean, z, broken ? 0.9 : 2.4);
      pb.seg(RUST, at(x, z), top);
      if (prev && !broken) { pb.seg(RUST, prev[0], at(x, z, 1.2)); pb.seg(RUST, prev[1], top); }
      prev = broken ? null : [at(x, z, 1.2), top];
    }
  };
  side(-F, -F, F, -F, 1); side(F, -F, F, F, 3); side(F, F, -F, F, 5); side(-F, F, -F, -F, 7);
  // the gate posts and the warning sign: a trefoil glowing on a board
  for (const gx of [-3.5, 3.5]) pb.box(gx - 0.2, H(gx, -F) - 0.2, -F - 0.2, gx + 0.2, H(gx, -F) + 3, -F + 0.2, CONC);
}
/** The control desk: a steel kiosk with a slanted console, its screen lit once work has begun, a lamp once restored. */
function drawDesk(pb: PropBatch, H: (x: number, z: number) => number, at: { x: number; z: number }, stage: number, done: boolean, rings: Live['rings']) {
  { const { x, z } = at, y = H(x, z);
    pb.box(x - 0.8, y - 0.2, z - 0.4, x + 0.8, y + 1, z + 0.4, METAL);
    pb.face([x - 0.8, y + 1, z - 0.4], [x + 0.8, y + 1, z - 0.4], [x + 0.8, y + 1.25, z + 0.3], [x - 0.8, y + 1.25, z + 0.3]);
    pb.line(METAL, [x - 0.8, y + 1, z - 0.4], [x + 0.8, y + 1, z - 0.4], [x + 0.8, y + 1.25, z + 0.3], [x - 0.8, y + 1.25, z + 0.3], [x - 0.8, y + 1, z - 0.4]);
    pb.box(x - 0.6, y + 1.25, z + 0.25, x + 0.6, y + 2.1, z + 0.4, METAL);
    const sc = stage >= 1 ? GLOW : RUST;
    pb.line(sc, [x - 0.5, y + 1.35, z + 0.24], [x + 0.5, y + 1.35, z + 0.24], [x + 0.5, y + 2, z + 0.24], [x - 0.5, y + 2, z + 0.24], [x - 0.5, y + 1.35, z + 0.24]);
    for (let i = 0; i < Math.min(4, stage + 1); i++) pb.seg(sc, [x - 0.4, y + 1.85 - i * 0.14, z + 0.23], [x - 0.4 + 0.2 + ((i * 37) % 5) * 0.12, y + 1.85 - i * 0.14, z + 0.23]);
    pb.seg(RUST, [x + 0.7, y + 2.1, z + 0.3], [x + 0.7, y + 3.2, z + 0.3]); // a lamp post
    if (done) pb.box(x + 0.55, y + 3.2, z + 0.15, x + 0.85, y + 3.5, z + 0.45, GLOW);
    rings.push([x, z, 0.85]);
  }
}
/** The plant in its own frame (x across, z along; y up from the site's ground height), as far restored as `stage`. */
function drawUranium(T: Terrain, s: InstallSite, cos: number, sin: number, stage: number): { g: THREE.Group; walls: Live['walls']; rings: Live['rings'] } {
  const pb = new PropBatch(), walls: Live['walls'] = [], rings: Live['rings'] = [];
  const cleared = stage >= 1, roofed = stage >= 2, done = stage >= INSTALL_STAGES.uranium.length;
  const H = (x: number, z: number) => T.heightAt(s.x + x * cos + z * sin, s.z - x * sin + z * cos) - s.y;
  const F = 30;
  drawFence(pb, H, F, cleared);
  { const sx = 6, sz = -F - 1.5, y = H(sx, sz); pb.seg(RUST, [sx - 0.8, y, sz], [sx - 0.8, y + 1.6, sz]); pb.seg(RUST, [sx + 0.8, y, sz], [sx + 0.8, y + 1.6, sz]);
    pb.box(sx - 1, y + 1.6, sz - 0.05, sx + 1, y + 3.2, sz + 0.05, RUST);
    const cy = y + 2.4, c = [sx, cy, sz - 0.07];
    for (let k = 0; k < 3; k++) { const a0 = k * 2.094 - 0.5, a1 = a0 + 1.05; pb.line(GLOW, c, [sx + Math.cos(a0) * 0.6, cy + Math.sin(a0) * 0.6, sz - 0.07], [sx + Math.cos((a0 + a1) / 2) * 0.62, cy + Math.sin((a0 + a1) / 2) * 0.62, sz - 0.07], [sx + Math.cos(a1) * 0.6, cy + Math.sin(a1) * 0.6, sz - 0.07], c); }
  }
  // ---- the centrifuge hall: x -8..14, z -6..10, walls 7 m, a doorway in the -z wall, the far corner fallen in
  const X0 = -8, X1 = 14, Z0 = -6, Z1 = 10, WH = 7, g0 = Math.min(H(X0, Z0), H(X1, Z0), H(X0, Z1), H(X1, Z1)) - 0.3;
  const wall = (ax: number, az: number, bx: number, bz: number, h0: (t: number) => number) => {
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / 2));
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n, x0 = ax + (bx - ax) * t0, z0 = az + (bz - az) * t0, x1 = ax + (bx - ax) * t1, z1 = az + (bz - az) * t1;
      const h0v = h0(t0), h1v = h0(t1);
      pb.face([x0, g0, z0], [x1, g0, z1], [x1, g0 + h1v, z1], [x0, g0 + h0v, z0]);
      pb.seg(CONC, [x0, g0 + h0v, z0], [x1, g0 + h1v, z1]); pb.seg(CONC, [x0, g0, z0], [x0, g0 + h0v, z0]);
    }
    pb.seg(CONC, [bx, g0, bz], [bx, g0 + h0(1), bz]);
    walls.push([ax, az, bx, bz]);
  };
  const full = () => WH, ragged = (t: number) => WH * (1 - 0.75 * t) + Math.sin(t * 17) * 0.4; // falls away towards the fallen corner
  wall(X0, Z0, -2, Z0, full); wall(2, Z0, X1, Z0, full); // the doorway in between
  pb.face([-2, g0 + 4, Z0], [2, g0 + 4, Z0], [2, g0 + WH, Z0], [-2, g0 + WH, Z0]); pb.line(CONC, [-2, g0, Z0], [-2, g0 + 4, Z0], [2, g0 + 4, Z0], [2, g0, Z0]);
  if (roofed) { wall(X1, Z0, X1, Z1, full); wall(X1, Z1, X0, Z1, full); } // rebuilt
  else { wall(X1, Z0, X1, Z1, (t) => WH * (1 - 0.55 * Math.max(0, t - 0.5) * 2)); wall(X1, Z1, X0, Z1, (t) => ragged(1 - t)); }
  wall(X0, Z1, X0, Z0, full);
  // roof trusses: bare triangles, the ones by the fallen corner gone or hanging
  for (let x = X0 + 2; x < X1; x += 4) {
    const fallen = !roofed && x > 8, hang = !roofed && x > 4 && x <= 8;
    if (fallen && cleared) continue; // carted off
    if (fallen) { pb.line(METAL, [x, g0 + 0.3, Z1 - 3], [x + 1.5, g0 + 3.5, (Z0 + Z1) / 2], [x - 1, g0 + 0.3, Z0 + 4]); continue; }
    const top = [x, g0 + WH + 2.5, (Z0 + Z1) / 2], a = [x, g0 + WH, Z0], b = hang ? [x, g0 + WH - 2.5, Z1 - 1.5] : [x, g0 + WH, Z1];
    pb.line(METAL, a, top, b, a); pb.seg(METAL, top, [x, g0 + WH, (Z0 + Z1) / 2]);
  }
  const ZM = (Z0 + Z1) / 2, RY = g0 + WH + 2.5;
  if (!roofed) pb.seg(METAL, [X0 + 2, RY, ZM], [X0 + 10, RY, ZM]); // the ridge, broken off
  else {
    // the new roof: two sheeted slopes with seams, gables closed
    pb.seg(done ? GLOW : METAL, [X0, RY, ZM], [X1, RY, ZM]);
    if (done) for (const ze of [Z0 - 0.03, Z1 + 0.03]) for (let x = X0 + 1; x < X1 - 1; x += 2) pb.line(GLOW, [x, g0 + WH - 1.6, ze], [x + 1.2, g0 + WH - 1.6, ze], [x + 1.2, g0 + WH - 0.8, ze], [x, g0 + WH - 0.8, ze], [x, g0 + WH - 1.6, ze]); // lit clerestory windows
    for (const ze of [Z0, Z1]) {
      pb.face([X0, g0 + WH, ze], [X1, g0 + WH, ze], [X1, RY, ZM], [X0, RY, ZM]);
      pb.seg(METAL, [X0, g0 + WH, ze], [X1, g0 + WH, ze]);
      for (let x = X0; x <= X1 + 0.01; x += 2) pb.seg(METAL, [x, g0 + WH, ze], [x, RY, ZM]);
    }
    for (const xe of [X0, X1]) { pb.face([xe, g0 + WH, Z0], [xe, g0 + WH, Z1], [xe, RY, ZM]); pb.line(CONC, [xe, g0 + WH, Z0], [xe, RY, ZM], [xe, g0 + WH, Z1]); }
  }
  // centrifuges: rows of tall cylinders on the hall floor, a few toppled
  const cyl = (x: number, z: number, r: number, h: number, y0: number, c: number, n = 8) => {
    const P = (i: number, yy: number) => [x + Math.cos(i / n * 6.283) * r, yy, z + Math.sin(i / n * 6.283) * r];
    for (let i = 0; i < n; i++) { pb.face(P(i, y0), P(i + 1, y0), P(i + 1, y0 + h), P(i, y0 + h)); pb.seg(c, P(i, y0 + h), P(i + 1, y0 + h)); if (i % 2 === 0) pb.seg(c, P(i, y0), P(i, y0 + h)); }
    const top: number[][] = []; for (let i = 0; i < n; i++) top.push(P(i, y0 + h)); pb.face(...top);
  };
  let k = 0;
  for (let x = X0 + 2; x <= X1 - 3; x += 2.2) for (let z = Z0 + 3; z <= Z1 - 2; z += 2.6) {
    k++;
    if (k % 5 === 3 && !roofed) { if (cleared) continue; const y = g0 + 0.35; pb.line(METAL, [x - 1.8, y, z], [x + 1.8, y + 0.1, z + 0.4]); pb.line(METAL, [x - 1.8, y + 0.6, z], [x + 1.8, y + 0.7, z + 0.4]); continue; } // toppled
    if (x > 9 && z > 5 && !roofed) continue; // under the rubble
    cyl(x, z, 0.35, 3.6, g0, done ? GLOW : METAL, 6);
  }
  // rubble of the fallen corner
  if (!cleared) for (let i = 0; i < 9; i++) { const x = X1 - 2 - (i % 3) * 1.6, z = Z1 - 1.5 - Math.floor(i / 3) * 1.5, y = H(x, z); pb.box(x - 0.6, y - 0.1, z - 0.5, x + 0.5, y + 0.5 + (i % 2) * 0.4, z + 0.6, CONC); }
  // ---- two cooling towers (hyperboloids of lines over a fill); the second snapped off
  const tower = (cx: number, cz: number, R: number, Ht: number, cut: number) => {
    const y0 = H(cx, cz) - 0.4, N = 16, ringAt = (f: number) => R * (0.58 + 0.42 * ((f - 0.72) / 0.72) ** 2); // waisted at 72% of the height, flaring a little at the top
    const levels = 9, rs: number[][][] = [];
    for (let l = 0; l <= levels; l++) {
      const f = l / levels; if (f * Ht > cut + 0.01) break;
      const r = ringAt(f); rs.push(Array.from({ length: N }, (_, i) => [cx + Math.cos(i / N * 6.283) * r, y0 + f * Ht, cz + Math.sin(i / N * 6.283) * r]));
    }
    for (let l = 0; l + 1 < rs.length; l++) for (let i = 0; i < N; i++) {
      const a = rs[l][i], b = rs[l][(i + 1) % N], c = rs[l + 1][(i + 1) % N], d = rs[l + 1][i];
      pb.face(a, b, c, d); pb.seg(CONC, a, c); pb.seg(CONC, b, d);
    }
    for (const r of rs) for (let i = 0; i < N; i++) pb.seg(CONC, r[i], r[(i + 1) % N]);
    if (cut < Ht) { const top = rs[rs.length - 1]; for (let i = 0; i < N; i += 2) pb.seg(CONC, top[i], [top[i][0], top[i][1] + 1.2 + (i % 4), top[i][2]]); } // jagged break
    rings.push([cx, cz, R * 0.95]);
  };
  tower(-19, 13, 7, 20, 20); tower(-19, -12, 7, 20, 11);
  // ---- the stack
  { const cx = 20, cz = 18; cyl(cx, cz, 1.3, 32, H(cx, cz) - 0.2, CONC, 10); for (const h of [8, 16, 24]) { const y = H(cx, cz) + h; for (let i = 0; i < 10; i++) pb.seg(RUST, [cx + Math.cos(i / 10 * 6.283) * 1.35, y, cz + Math.sin(i / 10 * 6.283) * 1.35], [cx + Math.cos((i + 1) / 10 * 6.283) * 1.35, y, cz + Math.sin((i + 1) / 10 * 6.283) * 1.35]); } rings.push([cx, cz, 1.4]); }
  // ---- pipes on trestles, hall to towers
  for (const tz of [13, -12]) {
    let prev: number[] | null = null;
    for (let x = X0; x >= -13; x -= 2.5) { const z = tz * 0.4 + (x - X0) / (-13 - X0) * tz * 0.6, y = H(x, z); pb.seg(RUST, [x, y, z], [x, y + 3, z]); const p = [x, y + 3.1, z]; if (prev) pb.seg(METAL, prev, p); prev = p; }
  }
  drawDesk(pb, H, DESKS.uranium, stage, done, rings);
  const g = pb.build();
  return { g, walls, rings };
}

/**
 * The chip foundry in its own frame: the long clean-room block (x -14..14, z -8..6, sealed, never entered) with an air
 * lock on the -z side, a band of windows, roof units; a tank farm to the west, a water tower to the east. Before it is
 * opened rubble lies banked against the block, a corner of its roof has fallen in, the lock is slabbed shut, a tank has
 * toppled and the water tower has lost its roof; then the rubble goes and the lock opens (stage 1), the air handlers
 * and the water plant run (2: fans on the roof, a whole tower), and once restored the windows glow.
 */
function drawChips(T: Terrain, s: InstallSite, cos: number, sin: number, stage: number): { g: THREE.Group; walls: Live['walls']; rings: Live['rings'] } {
  const pb = new PropBatch(), walls: Live['walls'] = [], rings: Live['rings'] = [];
  const cleared = stage >= 1, aired = stage >= 2, done = stage >= INSTALL_STAGES.chips.length;
  const H = (x: number, z: number) => T.heightAt(s.x + x * cos + z * sin, s.z - x * sin + z * cos) - s.y;
  const F = 28;
  drawFence(pb, H, F, cleared);
  // ---- the clean-room block
  const X0 = -14, X1 = 14, Z0 = -8, Z1 = 6, BH = 6, g0 = Math.min(H(X0, Z0), H(X1, Z0), H(X0, Z1), H(X1, Z1)) - 0.3, top = g0 + BH;
  const wall = (ax: number, az: number, bx: number, bz: number, h: (t: number) => number) => {
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / 2));
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n, x0 = ax + (bx - ax) * t0, z0 = az + (bz - az) * t0, x1 = ax + (bx - ax) * t1, z1 = az + (bz - az) * t1;
      pb.face([x0, g0, z0], [x1, g0, z1], [x1, g0 + h(t1), z1], [x0, g0 + h(t0), z0]);
      pb.seg(CONC, [x0, g0 + h(t0), z0], [x1, g0 + h(t1), z1]); if (i % 2 === 0) pb.seg(CONC, [x0, g0, z0], [x0, g0 + h(t0), z0]);
    }
    pb.seg(CONC, [bx, g0, bz], [bx, g0 + h(1), bz]);
    walls.push([ax, az, bx, bz]);
  };
  const full = () => BH, broken = (t: number) => BH - (t > 0.7 ? (t - 0.7) / 0.3 * 2.2 : 0); // the NE corner fallen in
  wall(X0, Z0, X1, Z0, full); wall(X1, Z0, X1, Z1, cleared ? full : broken); wall(X1, Z1, X0, Z1, cleared ? full : (t) => broken(1 - t)); wall(X0, Z1, X0, Z0, full);
  // the flat roof (a gap over the fallen corner until it is opened) and its parapet line
  const rx1 = cleared ? X1 : X1 - 5;
  pb.face([X0, top, Z0], [rx1, top, Z0], [rx1, top, Z1], [X0, top, Z1]);
  if (!cleared) { pb.face([rx1, top, Z0], [X1, top, Z0], [X1, top, Z1 - 5], [rx1, top, Z1 - 5]); pb.line(CONC, [rx1, top, Z1], [rx1, top, Z1 - 5], [X1, top, Z1 - 5]); pb.line(METAL, [rx1 + 0.5, top - 0.2, Z1 - 1], [X1 - 1, g0 + 1, Z1 - 3]); }
  for (let x = X0 + 4; x < rx1; x += 4) pb.seg(CONC, [x, top, Z0], [x, top, Z1]);
  // the band of windows along both long sides: dark, then glowing once the line runs
  for (const ze of [Z0 - 0.03, Z1 + 0.03]) for (let x = X0 + 1.5; x < X1 - 1.5; x += 2.5) {
    if (!cleared && ze > 0 && x > X1 - 6) continue;
    pb.line(done ? GLOW : METAL, [x, g0 + 3.4, ze], [x + 1.5, g0 + 3.4, ze], [x + 1.5, g0 + 4.4, ze], [x, g0 + 4.4, ze], [x, g0 + 3.4, ze]);
  }
  // the air lock: a porch on the -z side; slabbed shut, then an open doorway with a lit frame
  pb.box(-2.5, g0, Z0 - 3, 2.5, g0 + 3.2, Z0, METAL); walls.push([-2.5, Z0 - 3, -2.5, Z0], [2.5, Z0 - 3, 2.5, Z0], [-2.5, Z0 - 3, 2.5, Z0 - 3]);
  if (!cleared) pb.box(-1.6, g0, Z0 - 3.35, 1.6, g0 + 2.6, Z0 - 3.05, CONC);
  else pb.line(done ? GLOW : METAL, [-1.1, g0, Z0 - 3.03], [-1.1, g0 + 2.3, Z0 - 3.03], [1.1, g0 + 2.3, Z0 - 3.03], [1.1, g0, Z0 - 3.03]);
  // roof units: dead boxes, then air handlers with fan rings
  for (let i = 0; i < (aired ? 4 : 2); i++) {
    const x = X0 + 3 + i * 5, z = -1;
    pb.box(x - 1.3, top, z - 1.3, x + 1.3, top + 1.2, z + 1.3, METAL);
    if (aired) for (let k = 0; k < 8; k++) pb.seg(done ? GLOW : METAL, [x + Math.cos(k / 8 * 6.283) * 0.9, top + 1.22, z + Math.sin(k / 8 * 6.283) * 0.9], [x + Math.cos((k + 1) / 8 * 6.283) * 0.9, top + 1.22, z + Math.sin((k + 1) / 8 * 6.283) * 0.9]);
  }
  // rubble banked against the block
  if (!cleared) for (let i = 0; i < 12; i++) {
    const along = i < 6, x = along ? X0 + 2 + i * 4.5 : X1 + 1.2, z = along ? Z1 + 1.2 : Z1 - (i - 6) * 2.2, y = H(x, z);
    pb.box(x - 0.9, y - 0.1, z - 0.7, x + 0.8, y + 0.6 + (i % 3) * 0.35, z + 0.8, CONC);
  }
  // ---- the tank farm: three tanks on plinths (one toppled until cleared), a pipe run to the block
  const cyl = (x: number, z: number, r: number, h: number, y0: number, c: number, n = 10) => {
    const P = (i: number, yy: number) => [x + Math.cos(i / n * 6.283) * r, yy, z + Math.sin(i / n * 6.283) * r];
    for (let i = 0; i < n; i++) { pb.face(P(i, y0), P(i + 1, y0), P(i + 1, y0 + h), P(i, y0 + h)); pb.seg(c, P(i, y0 + h), P(i + 1, y0 + h)); pb.seg(c, P(i, y0), P(i + 1, y0)); if (i % 2 === 0) pb.seg(c, P(i, y0), P(i, y0 + h)); }
    const cap: number[][] = []; for (let i = 0; i < n; i++) cap.push(P(i, y0 + h)); pb.face(...cap);
  };
  const tanks: [number, number][] = [[-21, 9], [-21, 15], [-15, 15]];
  tanks.forEach(([x, z], i) => {
    const y = H(x, z);
    if (i === 2 && !cleared) { const a = [x - 2.5, y + 1, z], b = [x + 2.5, y + 1.4, z + 1]; pb.line(RUST, a, b); pb.line(RUST, [a[0], a[1] + 1.6, a[2]], [b[0], b[1] + 1.6, b[2]]); pb.seg(RUST, a, [a[0], a[1] + 1.6, a[2]]); pb.seg(RUST, b, [b[0], b[1] + 1.6, b[2]]); rings.push([x, z, 1.8]); return; }
    cyl(x, z, 1.8, 5.5, y - 0.1, aired ? METAL : RUST); rings.push([x, z, 1.9]);
  });
  { let prev: number[] | null = null; for (let x = -19; x <= X0; x += 1.7) { const z = 9, y = H(x, z); pb.seg(RUST, [x, y, z], [x, y + 2.6, z]); const p = [x, y + 2.7, z]; if (prev) pb.seg(METAL, prev, p); prev = p; } }
  // ---- the water tower: four legs with braces and a tank (its roof gone until the water plant runs)
  { const cx = 20, cz = 13, y = H(cx, cz), lh = 9;
    for (const [dx, dz] of [[-1.6, -1.6], [1.6, -1.6], [1.6, 1.6], [-1.6, 1.6]]) { pb.seg(METAL, [cx + dx * 1.3, H(cx + dx * 1.3, cz + dz * 1.3), cz + dz * 1.3], [cx + dx, y + lh, cz + dz]); rings.push([cx + dx * 1.3, cz + dz * 1.3, 0.3]); }
    for (const h of [3, 6]) pb.line(RUST, [cx - 1.9, y + h, cz - 1.9], [cx + 1.9, y + h, cz - 1.9], [cx + 1.9, y + h, cz + 1.9], [cx - 1.9, y + h, cz + 1.9], [cx - 1.9, y + h, cz - 1.9]);
    cyl(cx, cz, 2.4, 3, y + lh, aired ? METAL : RUST, 12);
    if (aired) pb.pyramid(cx - 2.4, cz - 2.4, cx + 2.4, cz + 2.4, y + lh + 3, 1, METAL);
  }
  drawDesk(pb, H, DESKS.chips, stage, done, rings);
  const g = pb.build();
  return { g, walls, rings };
}

/**
 * The radar station in its own frame: the bunker (x -12..-2, z -6..2) with its door on the -z side, a lattice tower
 * (x 8, z 4) that carries the dish, a guyed mast (x -16, z 14), a generator shed (x 2, z 14). Before it is cleared the
 * dish lies on its back in the grass, rubble buries the bunker door and the mast has snapped; cleared, the rubble is
 * gone; with power and cable (stage 2) the mast stands whole, the shed has a roof and cables run to the bunker and the
 * tower; restored, the dish sits on the tower and turns (a group named 'spin'), its feed horn and the lamps lit.
 */
function drawRadar(T: Terrain, s: InstallSite, cos: number, sin: number, stage: number): { g: THREE.Group; walls: Live['walls']; rings: Live['rings'] } {
  const pb = new PropBatch(), walls: Live['walls'] = [], rings: Live['rings'] = [];
  const cleared = stage >= 1, wired = stage >= 2, done = stage >= INSTALL_STAGES.radar.length;
  const H = (x: number, z: number) => T.heightAt(s.x + x * cos + z * sin, s.z - x * sin + z * cos) - s.y;
  drawFence(pb, H, 26, cleared);
  // ---- the bunker: low concrete walls, a flat roof, the door on the -z side
  const X0 = -12, X1 = -2, Z0 = -6, Z1 = 2, BH = 3, g0 = Math.min(H(X0, Z0), H(X1, Z0), H(X0, Z1), H(X1, Z1)) - 0.3;
  pb.box(X0, g0, Z0, X1, g0 + BH, Z1, CONC); walls.push([X0, Z0, X1, Z0], [X1, Z0, X1, Z1], [X1, Z1, X0, Z1], [X0, Z1, X0, Z0]);
  pb.line(done ? GLOW : METAL, [-8.2, g0, Z0 - 0.03], [-8.2, g0 + 2.2, Z0 - 0.03], [-6.8, g0 + 2.2, Z0 - 0.03], [-6.8, g0, Z0 - 0.03]); // the door
  if (!cleared) for (let i = 0; i < 7; i++) { const x = -9.5 + i * 0.6, z = Z0 - 1 - (i % 3) * 0.5, y = H(x, z); pb.box(x - 0.7, y - 0.1, z - 0.6, x + 0.6, y + 0.9 + (i % 2) * 0.5, z + 0.6, CONC); }
  for (let x = X0 + 1; x < X1; x += 2.5) pb.seg(CONC, [x, g0 + BH, Z0], [x, g0 + BH, Z1]);
  // ---- the lattice tower: four legs tapering to a platform at 13 m
  const TX = 8, TZ = 4, ty = H(TX, TZ), TH = 13;
  const leg = (i: number, t: number) => { const c = [[-1.8, -1.8], [1.8, -1.8], [1.8, 1.8], [-1.8, 1.8]][i], k = 1 - 0.6 * t; return [TX + c[0] * k, ty + t * TH, TZ + c[1] * k]; };
  for (let i = 0; i < 4; i++) {
    pb.seg(METAL, leg(i, 0), leg(i, 1)); rings.push([leg(i, 0)[0], leg(i, 0)[2], 0.3]);
    for (let k = 0; k < 5; k++) { const a = k / 5, b = (k + 1) / 5; pb.seg(RUST, leg(i, a), leg((i + 1) % 4, b)); pb.seg(RUST, leg((i + 1) % 4, a), leg(i, b)); }
  }
  pb.box(TX - 1.3, ty + TH, TZ - 1.3, TX + 1.3, ty + TH + 0.3, TZ + 1.3, METAL);
  // ---- the dish: a shallow bowl of rings and ribs, lying in the grass or turning on the tower
  const db = new PropBatch(), R = 5, ring = (r: number) => r * r / 14;
  for (let k = 0; k < 16; k++) {
    const a0 = k / 16 * 6.283, a1 = (k + 1) / 16 * 6.283;
    for (let j = 0; j < 4; j++) {
      const r0 = R * j / 4, r1 = R * (j + 1) / 4, P = (r: number, a: number) => [Math.cos(a) * r, ring(r), Math.sin(a) * r];
      db.face(P(r0, a0), P(r1, a0), P(r1, a1), P(r0, a1));
      db.seg(done ? GLOW : METAL, P(r1, a0), P(r1, a1));
    }
    db.seg(METAL, [0, 0, 0], [Math.cos(a0) * R, ring(R), Math.sin(a0) * R]);
  }
  for (const a of [0, 2.094, 4.189]) db.seg(METAL, [Math.cos(a) * R * 0.9, ring(R * 0.9), Math.sin(a) * R * 0.9], [0, 3.2, 0]); // the feed horn's struts
  db.box(-0.25, 3.1, -0.25, 0.25, 3.6, 0.25, done ? GLOW : METAL);
  const dish = db.build();
  let spin: THREE.Group | null = null;
  if (done) { spin = new THREE.Group(); spin.name = 'spin'; spin.position.set(TX, ty + TH + 0.6, TZ); dish.rotation.x = -0.55; spin.add(dish); }
  else { const dx = 15, dz = -9; dish.position.set(dx, H(dx, dz) + 1.4, dz); dish.rotation.set(2.7, 0.4, 0.2); rings.push([dx, dz, 4.5]); } // on its back, rim dug in
  // ---- the mast on guy wires: snapped until the power comes back
  { const mx = -16, mz = 14, my = H(mx, mz), MH = wired ? 22 : 9;
    pb.seg(METAL, [mx, my, mz], [mx, my + MH, mz]); rings.push([mx, mz, 0.3]);
    for (let y = 3; y < MH; y += 3) pb.line(RUST, [mx - 0.3, my + y, mz], [mx, my + y + 0.3, mz], [mx + 0.3, my + y, mz]);
    for (const a of [0.3, 2.4, 4.5]) { const ax = mx + Math.cos(a) * 9, az = mz + Math.sin(a) * 9; pb.seg(RUST, [ax, H(ax, az), az], [mx, my + (wired ? 16 : 8), mz]); }
    if (!wired) pb.seg(METAL, [mx + 1, H(mx + 1, mz + 1), mz + 1], [mx + 11, H(mx + 11, mz + 6), mz + 6]); // the top, lying in the grass
    else if (done) pb.box(mx - 0.2, my + MH, mz - 0.2, mx + 0.2, my + MH + 0.4, mz + 0.2, GLOW);
  }
  // ---- the generator shed and, once wired, the cable runs
  { const sx0 = -1, sx1 = 5, sz0 = 12, sz1 = 16, y = Math.min(H(sx0, sz0), H(sx1, sz1)) - 0.2;
    pb.box(sx0, y, sz0, sx1, y + 2.6, sz1, METAL); walls.push([sx0, sz0, sx1, sz0], [sx1, sz0, sx1, sz1], [sx1, sz1, sx0, sz1], [sx0, sz1, sx0, sz0]);
    if (wired) pb.gableRoof(sx0 - 0.3, sz0 - 0.3, sx1 + 0.3, sz1 + 0.3, y + 2.6, 0.8, METAL);
    if (wired) for (const [tx, tz] of [[-2, 0], [TX - 1.8, TZ + 1.8]]) {
      let prev: number[] | null = null;
      for (let t = 0; t <= 1.001; t += 0.25) { const x = 2 + (tx - 2) * t, z = 12 + (tz - 12) * t, yy = H(x, z); pb.seg(RUST, [x, yy, z], [x, yy + 2.4, z]); const p = [x, yy + 2.4, z]; if (prev) pb.seg(METAL, prev, p); prev = p; }
    }
  }
  drawDesk(pb, H, DESKS.radar, stage, done, rings);
  const g = pb.build();
  g.add(spin ?? dish);
  return { g, walls, rings };
}
const DRAW: Record<InstallKind, typeof drawUranium> = { uranium: drawUranium, chips: drawChips, radar: drawRadar };

/** Every second: draw the installations within reach, drop those far behind. */
let tick = 0;
export function updateInstalls(dt: number) {
  for (const l of live.values()) if (l.spin) l.spin.rotation.y += dt * 0.35; // a working radar dish turns
  if ((tick -= dt) > 0) return;
  tick = 1;
  const T = OW.terrain;
  if (!T || G.char.loc !== 'overworld') { dropInstalls(); return; }
  for (const s of installSites(T)) {
    const key = s.k + ':' + T.world, d = worldDist(s.x, s.z, G.pos.x, G.pos.z), have = live.get(key), stage = G.char.installs[s.k]?.stage ?? 0;
    if (have && (d > 1100 || have.stage !== stage)) { scene.remove(have.g); have.g.traverse((o) => (o as THREE.Mesh).geometry?.dispose()); live.delete(key); }
    if (d < 900 && !live.has(key)) {
      const cos = Math.cos(s.yaw), sin = Math.sin(s.yaw), m = DRAW[s.k](T, s, cos, sin, stage);
      m.g.position.set(nearX(s.x, G.pos.x), s.y, s.z); m.g.rotation.y = s.yaw; scene.add(m.g);
      live.set(key, { s, g: m.g, cos, sin, stage, spin: m.g.getObjectByName('spin') ?? null, walls: m.walls, rings: m.rings });
    }
  }
}
/** Redraw at once (after a stage is finished). */
export function redrawInstalls() { tick = 0; updateInstalls(0); }
export function dropInstalls() { for (const l of live.values()) { scene.remove(l.g); l.g.traverse((o) => (o as THREE.Mesh).geometry?.dispose()); } live.clear(); }

/** The hall's walls, the towers and the stack (for G.obstacle). */
export function installHit(px: number, py: number, pz: number, r: number): boolean {
  for (const l of live.values()) {
    const dx = px - l.g.position.x, dz = pz - l.s.z;
    if (Math.abs(dx) > 45 || Math.abs(dz) > 45 || py > l.s.y + 40) continue;
    const x = dx * l.cos - dz * l.sin, z = dx * l.sin + dz * l.cos; // into the plant's frame
    for (const [cx, cz, cr] of l.rings) if (Math.hypot(x - cx, z - cz) < cr + r) return true;
    for (const [ax, az, bx, bz] of l.walls) {
      const ex = bx - ax, ez = bz - az, L = ex * ex + ez * ez, t = L ? Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / L)) : 0;
      if (Math.hypot(x - ax - ex * t, z - az - ez * t) < r + 0.2) return true;
    }
  }
  return false;
}

/** Standing at an installation's control desk (on the gate side of it). */
export function nearInstallDesk(): InstallSite | null {
  if (G.char.loc !== 'overworld') return null;
  for (const l of live.values()) {
    const dx = G.pos.x - l.g.position.x, dz = G.pos.z - l.s.z;
    const x = dx * l.cos - dz * l.sin, z = dx * l.sin + dz * l.cos;
    const d = DESKS[l.s.k];
    if (Math.hypot(x - d.x, z - (d.z - 1)) < 1.4) return l.s;
  }
  return null;
}
