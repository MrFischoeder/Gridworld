// The great installations in the world (gen/installs.ts): drawn when you come within reach, dropped when you leave.
// The uranium enrichment plant: a broken perimeter fence with a gate and a warning sign, the centrifuge hall (walls
// with a doorway, a collapsed corner, bare roof trusses, rows of centrifuges inside, some toppled), two hyperboloid
// cooling towers (one snapped off), a tall stack and pipes on trestles. Every solid has a dark fill. The hall's walls,
// the towers and the stack collide (`installHit`).
import * as THREE from 'three';
import { scene } from './render';
import { PropBatch } from './props';
import { G } from '../game';
import { OW } from './overworld';
import { installSites, type InstallSite } from '../gen/installs';
import { nearX, worldDist } from '../gen/regions';
import type { Terrain } from '../gen/terrain';

const METAL = 0xa8c8b8, RUST = 0x9aa870, CONC = 0x7fa08c, GLOW = 0xb6ff3a;
interface Live { s: InstallSite; g: THREE.Group; cos: number; sin: number; walls: [number, number, number, number][]; rings: [number, number, number][] }
const live = new Map<string, Live>();

/** The plant in its own frame (x across, z along; y up from the site's ground height). */
function drawUranium(T: Terrain, s: InstallSite, cos: number, sin: number): { g: THREE.Group; walls: Live['walls']; rings: Live['rings'] } {
  const pb = new PropBatch(), walls: Live['walls'] = [], rings: Live['rings'] = [];
  const H = (x: number, z: number) => T.heightAt(s.x + x * cos + z * sin, s.z - x * sin + z * cos) - s.y;
  const at = (x: number, z: number, dy = 0) => [x, H(x, z) + dy, z];
  // ---- the perimeter fence: posts every 4 m and two wires, with gaps and leaning posts; the gate on the -z side
  const F = 30;
  const side = (ax: number, az: number, bx: number, bz: number, seed: number) => {
    const L = Math.hypot(bx - ax, bz - az), n = Math.round(L / 4);
    let prev: number[][] | null = null;
    for (let i = 0; i <= n; i++) {
      const x = ax + (bx - ax) * i / n, z = az + (bz - az) * i / n, broken = (i * 7 + seed) % 11 === 0, gate = az === -F && bz === -F && Math.abs(x) < 3.5;
      if (gate) { prev = null; continue; }
      const lean = (i * 13 + seed) % 7 === 0 ? 0.7 : 0, top = at(x + lean, z, broken ? 0.9 : 2.4);
      pb.seg(RUST, at(x, z), top);
      if (prev && !broken) { pb.seg(RUST, prev[0], at(x, z, 1.2)); pb.seg(RUST, prev[1], top); }
      prev = broken ? null : [at(x, z, 1.2), top];
    }
  };
  side(-F, -F, F, -F, 1); side(F, -F, F, F, 3); side(F, F, -F, F, 5); side(-F, F, -F, -F, 7);
  // the gate posts and the warning sign: a trefoil glowing on a board
  for (const gx of [-3.5, 3.5]) pb.box(gx - 0.2, H(gx, -F) - 0.2, -F - 0.2, gx + 0.2, H(gx, -F) + 3, -F + 0.2, CONC);
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
  wall(X1, Z0, X1, Z1, (t) => WH * (1 - 0.55 * Math.max(0, t - 0.5) * 2)); wall(X1, Z1, X0, Z1, (t) => ragged(1 - t)); wall(X0, Z1, X0, Z0, full);
  // roof trusses: bare triangles, the ones by the fallen corner gone or hanging
  for (let x = X0 + 2; x < X1; x += 4) {
    const fallen = x > 8, hang = x > 4 && x <= 8;
    if (fallen) { pb.line(METAL, [x, g0 + 0.3, Z1 - 3], [x + 1.5, g0 + 3.5, (Z0 + Z1) / 2], [x - 1, g0 + 0.3, Z0 + 4]); continue; }
    const top = [x, g0 + WH + 2.5, (Z0 + Z1) / 2], a = [x, g0 + WH, Z0], b = hang ? [x, g0 + WH - 2.5, Z1 - 1.5] : [x, g0 + WH, Z1];
    pb.line(METAL, a, top, b, a); pb.seg(METAL, top, [x, g0 + WH, (Z0 + Z1) / 2]);
  }
  pb.seg(METAL, [X0 + 2, g0 + WH + 2.5, (Z0 + Z1) / 2], [X0 + 10, g0 + WH + 2.5, (Z0 + Z1) / 2]); // the ridge, broken off
  // centrifuges: rows of tall cylinders on the hall floor, a few toppled
  const cyl = (x: number, z: number, r: number, h: number, y0: number, c: number, n = 8) => {
    const P = (i: number, yy: number) => [x + Math.cos(i / n * 6.283) * r, yy, z + Math.sin(i / n * 6.283) * r];
    for (let i = 0; i < n; i++) { pb.face(P(i, y0), P(i + 1, y0), P(i + 1, y0 + h), P(i, y0 + h)); pb.seg(c, P(i, y0 + h), P(i + 1, y0 + h)); if (i % 2 === 0) pb.seg(c, P(i, y0), P(i, y0 + h)); }
    const top: number[][] = []; for (let i = 0; i < n; i++) top.push(P(i, y0 + h)); pb.face(...top);
  };
  let k = 0;
  for (let x = X0 + 2; x <= X1 - 3; x += 2.2) for (let z = Z0 + 3; z <= Z1 - 2; z += 2.6) {
    k++;
    if (k % 5 === 3) { const y = g0 + 0.35; pb.line(METAL, [x - 1.8, y, z], [x + 1.8, y + 0.1, z + 0.4]); pb.line(METAL, [x - 1.8, y + 0.6, z], [x + 1.8, y + 0.7, z + 0.4]); continue; } // toppled
    if (x > 9 && z > 5) continue; // under the rubble
    cyl(x, z, 0.35, 3.6, g0, METAL, 6);
  }
  // rubble of the fallen corner
  for (let i = 0; i < 9; i++) { const x = X1 - 2 - (i % 3) * 1.6, z = Z1 - 1.5 - Math.floor(i / 3) * 1.5, y = H(x, z); pb.box(x - 0.6, y - 0.1, z - 0.5, x + 0.5, y + 0.5 + (i % 2) * 0.4, z + 0.6, CONC); }
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
  const g = pb.build();
  return { g, walls, rings };
}

/** Every second: draw the installations within reach, drop those far behind. */
let tick = 0;
export function updateInstalls(dt: number) {
  if ((tick -= dt) > 0) return;
  tick = 1;
  const T = OW.terrain;
  if (!T || G.char.loc !== 'overworld') { dropInstalls(); return; }
  for (const s of installSites(T)) {
    const key = s.k + ':' + T.world, d = worldDist(s.x, s.z, G.pos.x, G.pos.z), have = live.get(key);
    if (d < 900 && !have) {
      const cos = Math.cos(s.yaw), sin = Math.sin(s.yaw), m = drawUranium(T, s, cos, sin);
      m.g.position.set(nearX(s.x, G.pos.x), s.y, s.z); m.g.rotation.y = s.yaw; scene.add(m.g);
      live.set(key, { s, g: m.g, cos, sin, walls: m.walls, rings: m.rings });
    } else if (have && d > 1100) { scene.remove(have.g); have.g.traverse((o) => (o as THREE.Mesh).geometry?.dispose()); live.delete(key); }
  }
}
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
