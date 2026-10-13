// (0.195) The look of a dead city's metro (gen/metro.ts) over its voxels: rails on sleepers along every tunnel and
// through the stations, cables along the tunnel walls, the platforms' edges, station name boards on the hall walls,
// a wrecked train or a fall of rubble where a tunnel is blocked, rubble where a dead-end tunnel stops. Collision stays
// on the voxels (the train and the rubble are solid blocks there).
import * as THREE from 'three';
import { PropBatch } from './props';
import { signTexture } from './doors';
import { rng } from '../core/rng';
import type { DungeonMap } from '../gen/dungeon';
import { METRO } from '../gen/metro';
import { tl } from '../i18n';

const RAIL = 0xd8f0e8, SLEEPER = 0x4a7a5a, EDGE = 0xe0e070, CABLE = 0x3f8f6a, TRAIN = 0x8fd0c0, RUBBLE = 0x6f8f70, SIGN = '#e0e070';

export function drawMetro(map: DungeonMap): THREE.Group {
  const m = map.metro!, pb = new PropBatch(), R = rng(map.seed ^ 0x3e7a2), g = new THREE.Group();
  // track: two rails 1.44 m apart on sleepers
  for (const [x0, z0, x1, z1] of m.rails) {
    const alongX = z0 === z1, len = Math.abs(x1 - x0) + Math.abs(z1 - z0), sg = Math.sign(x1 - x0 + z1 - z0) || 1;
    const P = (t: number, side: number, y: number) => (alongX ? [x0 + sg * t, y, z0 + side] : [x0 + side, y, z0 + sg * t]);
    // (0.205) solid steel rails and timber sleepers, so the track reads clearly down in its trench
    const B = (t0: number, t1: number, v0: number, v1: number, y0: number, y1: number, c: number) => {
      const a = P(t0, v0, y0), b = P(t1, v1, y1);
      pb.box(Math.min(a[0], b[0]), y0, Math.min(a[2], b[2]), Math.max(a[0], b[0]), y1, Math.max(a[2], b[2]), c);
    };
    for (let t = 0.75; t < len; t += 1.5) B(t - 0.13, t + 0.13, -1.15, 1.15, 0, 0.1, SLEEPER);
    for (const side of [-0.72, 0.72]) B(0, len, side - 0.05, side + 0.05, 0.1, 0.24, RAIL);
  }
  // tunnels: cables along both walls
  for (const b of map.boxes) {
    if (!b.tunnel) continue;
    const alongX = b.w > b.d;
    for (const y of [2.3, 2.6]) {
      if (alongX) { pb.seg(CABLE, [b.x, y, b.z + 0.05], [b.x + b.w, y, b.z + 0.05]); pb.seg(CABLE, [b.x, y, b.z + b.d - 0.05], [b.x + b.w, y, b.z + b.d - 0.05]); }
      else { pb.seg(CABLE, [b.x + 0.05, y, b.z], [b.x + 0.05, y, b.z + b.d]); pb.seg(CABLE, [b.x + b.w - 0.05, y, b.z], [b.x + b.w - 0.05, y, b.z + b.d]); }
    }
  }
  // stations: the platforms' edges and the name boards
  // (0.205) the platforms stand a step above the track's trench: a yellow safety strip along the top of the edge,
  // the edge's face lit down to the trench floor, and the half steps up out of it
  const hl = METRO.hall.len / 2, th = METRO.trench / 2, top = METRO.platform + 0.03;
  for (const s of m.stations) {
    const A = (t: number, v: number, y: number) => (s.alongX ? [s.x + t, y, s.z + v] : [s.x + v, y, s.z + t]);
    for (const sd of [-1, 1]) {
      for (const v of [th + 0.2, th + 0.5]) pb.seg(EDGE, A(-hl, top, sd * v), A(hl, top, sd * v));
      pb.seg(EDGE, A(-hl, METRO.platform - 0.12, sd * (th - 0.02)), A(hl, METRO.platform - 0.12, sd * (th - 0.02)));
    }
  }
  for (const b of m.steps) {
    pb.box(b.x, b.y, b.z, b.x + b.w, b.y + b.h, b.z + b.d, SLEEPER);
  }
  for (const s of m.stations) {
    const tex = signTexture(s.name.toUpperCase(), SIGN, 60), mat = new THREE.MeshBasicMaterial({ map: tex });
    for (const t of [-9, 9]) for (const wall of [0, 1]) {
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.75), mat), h = s.hall;
      if (s.alongX) { sign.position.set(s.x + t, 4.4, wall ? h.z + h.d - 0.06 : h.z + 0.06); sign.rotation.y = wall ? Math.PI : 0; }
      else { sign.position.set(wall ? h.x + h.w - 0.06 : h.x + 0.06, 4.4, s.z + t); sign.rotation.y = wall ? -Math.PI / 2 : Math.PI / 2; }
      g.add(sign);
    }
    if (s.entrance < 0) { // no stairs up here: the way out is caved in
      const tex2 = signTexture(tl('✕ NO EXIT'), '#ff5a3c', 56), sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.45), new THREE.MeshBasicMaterial({ map: tex2 })), h = s.hall;
      if (s.alongX) { sign.position.set(s.x, 3.4, h.z + 0.06); } else { sign.position.set(h.x + 0.06, 3.4, s.z); sign.rotation.y = Math.PI / 2; }
      g.add(sign);
    }
  }
  // blocked tunnels
  const heap = (x: number, z: number, n: number, spread: number) => {
    for (let i = 0; i < n; i++) pb.rock(x + (R() - 0.5) * spread, 0, z + (R() - 0.5) * spread, 0.4 + R() * 0.8, 0.3 + R() * 0.9, 5 + Math.floor(R() * 3), R() * 6, RUBBLE);
  };
  for (const b of m.blocks) {
    const hw = b.len / 2, P = (t: number, v: number, y: number) => (b.alongX ? [b.x + t, y, b.z + v] : [b.x + v, y, b.z + t]);
    if (b.kind === 'train') {
      // a carriage jammed in the tunnel, tipped against one wall: body, roof, windows and doors, a crumpled end
      // (drawn just outside its solid block so the voxel faces do not hide it)
      const lean = (R() - 0.5) * 0.3, top = 5.15, ex = hw + 0.15;
      pb.solid8([P(-ex, -1.99, 0), P(ex, -1.99, 0), P(ex, 1.99, 0), P(-ex, 1.99, 0)],
        [P(-ex, -1.99, top), P(ex, -1.99, top), P(ex, 1.99, top), P(-ex, 1.99, top)], TRAIN);
      // the roof's curve and the buckled front
      for (const e of [-ex - 0.02, ex + 0.02]) pb.line(TRAIN, P(e, -1.9, 4.4), P(e, -1.2, 5.0), P(e, 1.2, 5.0), P(e, 1.9, 4.4));
      for (const v of [-1.97, 1.97]) {
        for (let t = -hw + 1.2; t < hw - 2; t += 2.4) pb.line(TRAIN, P(t, v, 2.2), P(t + 1.6, v, 2.2), P(t + 1.6, v, 3.4), P(t, v, 3.4), P(t, v, 2.2));
        pb.line(TRAIN, P(-1, v, 0.4), P(-1, v, 3.9), P(1, v, 3.9), P(1, v, 0.4));
      }
      for (const e of [-ex - 0.03, ex + 0.03]) {
        pb.line(TRAIN, P(e, -1.2, 2.4), P(e, 1.2, 2.4), P(e, 1.2 + lean * 0.7, 3.8), P(e, -1.2 + lean * 0.7, 3.8), P(e, -1.2, 2.4));
        for (const v of [-1.2, 1.2]) { const ring: number[][] = []; for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI * 2; ring.push(P(e, v + Math.cos(a) * 0.28, 1.3 + Math.sin(a) * 0.28)); } pb.line(TRAIN, ...ring); }
        pb.line(TRAIN, P(e, -0.5, 0.3), P(e, -0.5, 2.0), P(e, 0.5, 2.0), P(e, 0.5, 0.3));
      }
      for (const e of [-hw - 1.2, hw + 1.2]) { const q = P(e, 0, 0); heap(q[0], q[2], 4, 2.6); }
    } else {
      const a = P(-hw - 0.8, 0, 0), c = P(hw + 0.8, 0, 0);
      heap(a[0], a[2], 9, 3.4); heap(c[0], c[2], 9, 3.4);
      // the face of the fall: slabs leaning on it
      for (const e of [-hw, hw]) pb.line(RUBBLE, P(e, -2, 0), P(e, -0.6, 5.5), P(e, 0.8, 3.2), P(e, 2, 6.8));
    }
  }
  for (const e of m.ends) { // a dead end: the tunnel stops in a fall of rubble
    heap(e.x - e.dx * 1.2, e.z - e.dz * 1.2, 10, 3.2);
    pb.line(RUBBLE, [e.x - 2 * Math.abs(e.dz) + e.dx * 1.9, 0, e.z - 2 * Math.abs(e.dx) + e.dz * 1.9], [e.x + e.dx * 1.9, 6.5, e.z + e.dz * 1.9], [e.x + 2 * Math.abs(e.dz) + e.dx * 1.9, 0, e.z + 2 * Math.abs(e.dx) + e.dz * 1.9]);
  }
  g.add(pb.build());
  return g;
}
