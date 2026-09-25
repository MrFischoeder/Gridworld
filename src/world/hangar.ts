// The old hangar by Gridholm and the shuttle in it, the Chariot of the Ancients (gen/shuttle.ts). A long arched shed with timber-and-steel ribs and
// a skin of sheet panels, open to the south; inside, the shuttle sits on its cradle between scaffold towers, nose to
// the door. It shows how far the repair has come: the hull is bare ribs until it is plated, the engine sockets are
// empty until the engines go in, the cockpit windows light up with the avionics, the belly gets its tiles, and the
// fuel lines glow once the tanks are full. The desk by the door (E) shows the stages (ui/shuttle.ts).
import * as THREE from 'three';
import { G } from '../game';
import { PropBatch } from './props';
import { stageDone } from '../gen/shuttle';
import type { Poi } from '../gen/regions';
import type { Op } from '../core/voxel';

const RIB = 0x9dffb4, SKIN = 0x2fe060, HULL = 0xe8fff0, TILE = 0x8fb89a, ENGINE = 0xb8c4cc, GLOW = 0x5cc8ff, WOOD = 0xb8b060, WARN = 0xffd060;
const WALL_H = 7, RISE = 9;

/** The hangar's solid parts (world ops on its pad): the two side walls, the back wall, the cradle under the shuttle. */
export function hangarOps(p: Poi, y: number): Op[] {
  const r = p.rect, cx = Math.round((r.x0 + r.x1) / 2);
  return [
    { op: 'solid', x: r.x0, y, z: r.z0, w: 1, h: WALL_H, d: r.z1 - r.z0 },
    { op: 'solid', x: r.x1 - 1, y, z: r.z0, w: 1, h: WALL_H, d: r.z1 - r.z0 },
    { op: 'solid', x: r.x0, y, z: r.z0, w: r.x1 - r.x0, h: WALL_H, d: 1 },
    { op: 'solid', x: cx - 2, y, z: r.z0 + 6, w: 4, h: 3, d: 22 }, // the cradle's plinth under the fuselage
  ];
}
/** Where the project desk stands (world), just inside the door on the west side. */
export const deskOf = (p: Poi) => ({ x: p.rect.x0 + 6, z: p.rect.z1 - 4 });

export function drawHangar(p: Poi, y: number): THREE.Group {
  const pb = new PropBatch(), r = p.rect, x0 = r.x0, x1 = r.x1, z0 = r.z0, z1 = r.z1, cx = (x0 + x1) / 2, span = (x1 - x0) / 2;
  const arch = (t: number) => [cx - span * Math.cos(t * Math.PI), y + WALL_H + RISE * Math.sin(t * Math.PI)];
  // ribs every 4 m and the sheet skin between them (fill), purlins along
  const N = 16;
  for (let z = z0; z <= z1 + 0.01; z += 4) {
    for (let i = 0; i < N; i++) { const [ax, ay] = arch(i / N), [bx, by] = arch((i + 1) / N); pb.seg(RIB, [ax, ay, z], [bx, by, z]); pb.seg(RIB, [ax, ay - 0.35, z], [bx, by - 0.35, z]); }
    if (z + 4 <= z1 + 0.01) for (let i = 0; i < N; i++) {
      const [ax, ay] = arch(i / N), [bx, by] = arch((i + 1) / N);
      pb.face([ax, ay, z], [bx, by, z], [bx, by, z + 4], [ax, ay, z + 4]);
      if (i % 2 === 0) pb.seg(SKIN, [ax, ay, z], [ax, ay, z + 4]);
    }
  }
  // the back gable: the arch closed with sheet panels
  for (let i = 0; i < N; i++) { const [ax, ay] = arch(i / N), [bx, by] = arch((i + 1) / N); pb.face([ax, y + WALL_H, z0], [ax, ay, z0], [bx, by, z0], [bx, y + WALL_H, z0]); }
  // the door: two huge leaves slid aside, standing outside the walls
  for (const s of [-1, 1]) {
    const dx = s < 0 ? x0 - 0.6 : x1 + 0.1;
    pb.box(dx, y, z1 - 10, dx + 0.5, y + WALL_H + 3, z1, SKIN);
    for (let yy = y + 1.5; yy < y + WALL_H + 3; yy += 1.5) pb.seg(RIB, [s < 0 ? dx - 0.01 : dx + 0.51, yy, z1 - 10], [s < 0 ? dx - 0.01 : dx + 0.51, yy, z1]);
  }
  // a gantry crane along the roof, lamps, crates and the project desk
  pb.box(cx - 12, y + WALL_H + 5, z0 + 2, cx + 12, y + WALL_H + 5.4, z0 + 2.4, WARN);
  pb.box(cx - 0.4, y + WALL_H + 1, z0 + 1.8, cx + 0.4, y + WALL_H + 5, z0 + 2.6, WARN);
  for (let z = z0 + 6; z < z1; z += 8) for (const x of [x0 + 2, x1 - 2]) { pb.box(x - 0.2, y + WALL_H - 0.6, z - 0.2, x + 0.2, y + WALL_H - 0.3, z + 0.2, WARN); }
  for (const [x, z, n] of [[x0 + 3, z0 + 4, 3], [x1 - 5, z0 + 3, 4], [x1 - 4, z1 - 8, 2]]) for (let k = 0; k < n; k++) pb.box(x + (k % 2) * 1.3, y + Math.floor(k / 2) * 1.1, z, x + 1.1 + (k % 2) * 1.3, y + 1.1 + Math.floor(k / 2) * 1.1, z + 1.1, WOOD);
  const d = deskOf(p);
  pb.box(d.x - 1.2, y, d.z - 0.5, d.x + 1.2, y + 0.95, d.z + 0.5, WOOD);
  pb.box(d.x - 1.1, y + 0.95, d.z - 0.1, d.x + 1.1, y + 2.3, d.z + 0.05, WOOD); // a board of drawings behind it
  for (let k = 0; k < 4; k++) pb.seg(WARN, [d.x - 0.9 + k * 0.5, y + 1.2, d.z + 0.06], [d.x - 0.6 + k * 0.5, y + 2, d.z + 0.06]);
  drawShuttle(pb, cx, y, z0 + 5);
  const g = new THREE.Group(); g.add(pb.build());
  return g;
}

/**
 * The shuttle, tail at z = tz, nose towards +z: a lofted fuselage (octagonal sections) on a cradle, delta wings, the
 * tail fin, three engine sockets, a cockpit; drawn by how far the repair has come.
 */
function drawShuttle(pb: PropBatch, cx: number, y: number, tz: number) {
  const s = G.char.shuttle, hull = stageDone(s, 'hull'), eng = stageDone(s, 'engines'), av = stageDone(s, 'avionics'), shield = stageDone(s, 'shield'), fuel = stageDone(s, 'fuel');
  const by = y + 5.2; // the fuselage axis
  // sections along the fuselage: [z offset, half width, half height]
  const secs: [number, number, number][] = [[0, 2.1, 2.1], [4, 2.3, 2.3], [14, 2.3, 2.3], [18, 2.2, 2.1], [21, 1.8, 1.7], [23, 1.1, 1.1], [24.3, 0.3, 0.35]];
  const ring = (i: number) => { const [dz, rw, rh] = secs[i]; return Array.from({ length: 8 }, (_, k) => { const a = (k + 0.5) / 8 * Math.PI * 2; return [cx + Math.cos(a) * rw, by + Math.sin(a) * rh, tz + dz]; }); };
  for (let i = 0; i < secs.length; i++) {
    const a = ring(i);
    for (let k = 0; k < 8; k++) pb.seg(HULL, a[k], a[(k + 1) % 8]);
    if (i + 1 < secs.length) {
      const b = ring(i + 1), bare = !hull && i >= 1 && i <= 2; // the middle is stripped to its ribs until plated
      for (let k = 0; k < 8; k++) {
        pb.seg(HULL, a[k], b[k]);
        if (!bare || k === 6 || k === 7) pb.face(a[k], a[(k + 1) % 8], b[(k + 1) % 8], b[k]);
      }
      if (bare) for (let dz = secs[i][0] + 1.25; dz < secs[i + 1][0]; dz += 1.25) { // frames showing through
        const [, rw, rh] = secs[i];
        for (let k = 0; k < 8; k++) { const a0 = (k + 0.5) / 8 * Math.PI * 2, a1 = (k + 1.5) / 8 * Math.PI * 2; pb.seg(RIB, [cx + Math.cos(a0) * rw, by + Math.sin(a0) * rh, tz + dz], [cx + Math.cos(a1) * rw, by + Math.sin(a1) * rh, tz + dz]); }
      }
    }
  }
  // the back end closed, three engine sockets (bells once rebuilt)
  const back = ring(0); pb.face(...back);
  for (const [ex, ey] of [[0, 1.0], [-1.1, -0.6], [1.1, -0.6]]) {
    const c = [cx + ex, by + ey, tz], rr = 0.62;
    const pts = Array.from({ length: 10 }, (_, k) => { const a = k / 10 * Math.PI * 2; return [c[0] + Math.cos(a) * rr, c[1] + Math.sin(a) * rr, tz - 0.02]; });
    for (let k = 0; k < 10; k++) pb.seg(eng ? ENGINE : WARN, pts[k], pts[(k + 1) % 10]);
    if (eng) { // the bell, flaring backwards
      const bell = pts.map((q) => [c[0] + (q[0] - c[0]) * 1.5, c[1] + (q[1] - c[1]) * 1.5, tz - 1.8]);
      for (let k = 0; k < 10; k++) { pb.seg(ENGINE, pts[k], bell[k]); pb.seg(ENGINE, bell[k], bell[(k + 1) % 10]); pb.face(pts[k], pts[(k + 1) % 10], bell[(k + 1) % 10], bell[k]); }
    }
  }
  // delta wings (a thin slab), with elevons, and the belly tiles once the shield is on
  for (const sd of [-1, 1]) {
    const root0 = [cx + sd * 2.1, by - 1.3, tz + 0.5], root1 = [cx + sd * 1.9, by - 1.3, tz + 15], tip0 = [cx + sd * 10.5, by - 1.4, tz + 0.8], tip1 = [cx + sd * 10, by - 1.4, tz + 4];
    const top = (q: number[]) => [q[0], q[1] + 0.35, q[2]];
    pb.face(root0, tip0, tip1, root1); pb.face(top(root0), top(tip0), top(tip1), top(root1));
    for (const [a, b] of [[root0, tip0], [tip0, tip1], [tip1, root1]]) { pb.seg(HULL, a, b); pb.seg(HULL, top(a), top(b)); pb.seg(HULL, a, top(a)); pb.face(a, b, top(b), top(a)); }
    pb.seg(HULL, [cx + sd * 3, by - 1.02, tz + 1.4], [cx + sd * 9.8, by - 1.02, tz + 1.5]); // the elevon hinge
    if (shield) for (let k = 1; k < 6; k++) { const t = k / 6; pb.seg(TILE, [root0[0] + (tip0[0] - root0[0]) * t, by - 1.42, root0[2] + (root1[2] - root0[2]) * (1 - t) * 0.9], [root0[0] + (tip0[0] - root0[0]) * t, by - 1.42, tz + 0.8]); }
  }
  if (shield) for (let z = 1; z < 21; z += 1) pb.seg(TILE, [cx - 1.6, by - 2.12, tz + z], [cx + 1.6, by - 2.12, tz + z]);
  // the tail fin
  const f0 = [cx, by + 2.2, tz + 0.3], f1 = [cx, by + 2.2, tz + 6.5], f2 = [cx, by + 7.2, tz + 0.2], f3 = [cx, by + 7.2, tz + 2.3];
  for (const o of [-0.15, 0.15]) { const q = (p: number[]) => [p[0] + o, p[1], p[2]]; pb.face(q(f0), q(f1), q(f3), q(f2)); pb.line(HULL, q(f0), q(f1), q(f3), q(f2), q(f0)); }
  // the cockpit: window frames, lit once the avionics are in
  const wz = tz + 21.3, wy = by + 1.25;
  for (let k = -2; k <= 1; k++) pb.line(av ? GLOW : RIB, [cx + k * 0.42, wy, wz], [cx + (k + 1) * 0.42 - 0.05, wy, wz], [cx + (k + 1) * 0.36 - 0.05, wy + 0.45, wz - 0.7], [cx + k * 0.36, wy + 0.45, wz - 0.7], [cx + k * 0.42, wy, wz]);
  // the cradle, scaffold towers each side, fuel lines to the belly (glowing once filled)
  for (const dz of [3, 11, 19]) pb.box(cx - 1.6, y + 3, tz + dz - 0.4, cx + 1.6, by - 2.1, tz + dz + 0.4, ENGINE); // saddles on the plinth
  for (const sd of [-1, 1]) {
    const sx = cx + sd * 12.5;
    for (let k = 0; k < 3; k++) { const z = tz + 3 + k * 7; pb.box(sx - 1, y, z - 1, sx + 1, y + 0.15, z + 1, WOOD); for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) pb.seg(WOOD, [sx + a, y, z + b], [sx + a, y + 8, z + b]); for (let h = 2; h <= 8; h += 2) pb.box(sx - 1, y + h, z - 1, sx + 1, y + h + 0.1, z + 1, WOOD); }
  }
  pb.line(fuel ? GLOW : ENGINE, [cx + 12.5, y + 0.2, tz + 10], [cx + 5, y + 0.2, tz + 12], [cx + 1.6, by - 2.1, tz + 12]);
  pb.line(fuel ? GLOW : ENGINE, [cx + 12.5, y + 0.3, tz + 10.4], [cx + 5, y + 0.3, tz + 12.4], [cx + 1.6, by - 2.0, tz + 12.4]);
}
