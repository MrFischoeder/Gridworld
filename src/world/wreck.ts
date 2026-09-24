// Draws a crashed freighter (gen/wreck.ts WreckDeco): an octagonal hull that tapers into a buried nose, an engine
// nacelle with its rings at the tail, a fin (maybe snapped off), cockpit windows, a crack across the hull, the open
// side hatch with a framed collar and a ramp, and debris strewn around. Every solid has a dark fill and encloses the
// collision voxels, so their lines stay hidden inside.
import * as THREE from 'three';
import { GRID } from './render';
import { PropBatch } from './props';
import { rng } from '../core/rng';
import { wreckXZ, hullR, hullY, HULL, type WreckDeco } from '../gen/wreck';

const HULL_C = GRID, TRIM = 0x7dffc8, HATCH = 0x5cc8ff;
type P = number[];

export function drawWreck(d: WreckDeco, seed: number): THREE.Group {
  const pb = new PropBatch(), f = d.frame, R = rng(seed ^ 0x3ec9);
  const P = (u: number, v: number, h: number): P => { const [x, z] = wreckXZ(f, u, v); return [x, f.y + h, z]; };
  const ANG = Array.from({ length: 8 }, (_, k) => (k + 0.5) / 8 * 6.283);
  const ring = (u: number, r = hullR(u), cy = hullY(u)) => ANG.map((a) => P(u, Math.cos(a) * r, cy + Math.sin(a) * r));
  // faces facing the hatch side (and the one below it) stay open over the vestibule
  const open = d.hatchS > 0 ? [6, 7] : [3, 4];
  const hu0 = d.hatchU + 1, hu1 = d.hatchU + 4;
  const us = [HULL.tail + 2, -20, -18, -15, d.crackU - 0.6, d.crackU + 0.6, -6, hu0, hu1, 5, 8, 12, 16, 19, HULL.nose].filter((u, i, a) => a.indexOf(u) === i).sort((a, b) => a - b);

  // ---- the hull: rings joined by panels; the crack shifts one ring a little so the plating breaks
  const rings = us.map((u) => { const rr = ring(u); if (Math.abs(u - d.crackU - 0.6) < 0.01) return rr.map((p) => [p[0] + 0.15, p[1] - 0.25, p[2] + 0.1]); return rr; });
  for (let i = 0; i + 1 < rings.length; i++) {
    const a = rings[i], b = rings[i + 1], hatchSpan = us[i] >= hu0 - 0.01 && us[i + 1] <= hu1 + 0.01, crack = Math.abs(us[i] - (d.crackU - 0.6)) < 0.01;
    for (let k = 0; k < 8; k++) {
      const k1 = (k + 1) % 8;
      if (hatchSpan && open.includes(k)) continue;
      if (crack && (k === 1 || k === 2)) { pb.line(HULL_C, a[k], [(a[k][0] + b[k1][0]) / 2, (a[k][1] + b[k1][1]) / 2 + 0.3, (a[k][2] + b[k1][2]) / 2], b[k1]); continue; } // torn open on top
      pb.face(a[k], a[k1], b[k1], b[k]);
      pb.seg(HULL_C, a[k], b[k]);
    }
    for (let k = 0; k < 8; k++) pb.seg(HULL_C, a[k], a[(k + 1) % 8]);
    // plating seams: a lighter line along the middle of the side faces
    if (!hatchSpan) for (const k of [0, 3]) { const m0 = a[k].map((v, j) => (v + a[(k + 1) % 8][j]) / 2), m1 = b[k].map((v, j) => (v + b[(k + 1) % 8][j]) / 2); pb.seg(HULL_C, m0, m1); }
  }
  // the nose: a blunt cap buried in the ground
  const tip = P(HULL.nose + 1.2, 0, hullY(HULL.nose) - 0.3), last = rings[rings.length - 1];
  for (let k = 0; k < 8; k++) { pb.face(last[k], last[(k + 1) % 8], tip); pb.seg(HULL_C, last[k], tip); }
  // cockpit windows on the upper faces near the nose
  for (const [u0, u1] of [[13, 15.5], [16, 18.3]]) for (const k of [1, 2]) {
    const q = (u: number, t: number) => { const r = hullR(u) + 0.03, a0 = ANG[k], a1 = ANG[(k + 1) % 8], cy = hullY(u), ax = Math.cos(a0) * (1 - t) + Math.cos(a1) * t, ay = Math.sin(a0) * (1 - t) + Math.sin(a1) * t; return P(u, ax * r, cy + ay * r); };
    pb.line(TRIM, q(u0, 0.2), q(u1, 0.2), q(u1, 0.8), q(u0, 0.8), q(u0, 0.2));
  }

  // ---- the engine nacelle at the tail: a wider 12-sided drum with rings inside its open end
  const n = 12, er = HULL.tailR + 0.7, ecy = hullY(HULL.tail) + 0.2, eu0 = HULL.tail - 1.5, eu1 = HULL.tail + 3;
  const eRing = (u: number, r: number) => Array.from({ length: n }, (_, k) => { const a = k / n * 6.283; return P(u, Math.cos(a) * r, ecy + Math.sin(a) * r); });
  const e0 = eRing(eu0, er), e1 = eRing(eu1, er * 0.95);
  for (let k = 0; k < n; k++) { const k1 = (k + 1) % n; pb.face(e0[k], e0[k1], e1[k1], e1[k]); pb.seg(HULL_C, e0[k], e0[k1]); pb.seg(HULL_C, e1[k], e1[k1]); pb.seg(HULL_C, e0[k], e1[k]); }
  for (const [t, rr] of [[0, 0.72], [0.4, 0.45], [0.8, 0.22]] as [number, number][]) {
    const c = eRing(eu0 + t, er * rr);
    for (let k = 0; k < n; k++) pb.seg(TRIM, c[k], c[(k + 1) % n]);
  }
  const back = eRing(eu0 + 1, er * 0.98); pb.face(...back); // the dark disc behind the rings

  // ---- the fin: a swept plate on the top of the tail (or snapped off and lying beside the ship)
  const finTop = hullY(-18) + hullR(-18) * 0.92;
  if (!d.finBroken) {
    pb.solid8([P(-19, -0.15, finTop), P(-9, -0.15, hullY(-9) + 4.4), P(-9, 0.15, hullY(-9) + 4.4), P(-19, 0.15, finTop)],
      [P(-21.5, -0.1, finTop + 6.5), P(-17, -0.1, finTop + 6.5), P(-17, 0.1, finTop + 6.5), P(-21.5, 0.1, finTop + 6.5)], HULL_C);
  } else {
    pb.solid8([P(-19, -0.15, finTop), P(-12, -0.15, hullY(-12) + 4.3), P(-12, 0.15, hullY(-12) + 4.3), P(-19, 0.15, finTop)],
      [P(-19.5, -0.12, finTop + 2.2), P(-15, -0.12, finTop + 1.6), P(-15, 0.12, finTop + 1.6), P(-19.5, 0.12, finTop + 2.2)], HULL_C);
    const s = -d.hatchS, v0 = s * 7;
    pb.solid8([P(-16, v0, 0), P(-9, v0 + s * 1, 0), P(-9, v0 + s * 1.3, 0), P(-16, v0 + s * 0.3, 0)], [P(-15.5, v0, 0.6), P(-9.5, v0 + s * 1, 0.4), P(-9.5, v0 + s * 1.3, 0.4), P(-15.5, v0 + s * 0.3, 0.6)], HULL_C);
  }

  // ---- the hatch: a framed collar from the hull skin to the vestibule, a ramp down to the ground
  const hs = d.hatchS, vIn = hs * 3.5, vOut = hs * hullR(d.hatchU) * 0.93, top = 3;
  for (const u of [hu0, hu1]) pb.solid8([P(u, vIn, 0), P(u, vOut, 0), P(u, vOut, 0.3), P(u, vIn, 0.3)].map((p) => p), [P(u, vIn, top), P(u, vOut, top), P(u, vOut, top + 0.3), P(u, vIn, top + 0.3)], HATCH);
  pb.face(P(hu0, vIn, top), P(hu1, vIn, top), P(hu1, vOut, top), P(hu0, vOut, top));
  pb.line(HATCH, P(hu0, vOut, 0), P(hu0, vOut, top), P(hu1, vOut, top), P(hu1, vOut, 0));
  pb.line(HATCH, P(hu0 + 0.8, vOut + hs * 0.02, top - 0.4), P(hu1 - 0.8, vOut + hs * 0.02, top - 0.4)); // the name plate over the door
  // the ramp: a grated plate from the door sill out onto the ground
  const r0 = vOut, r1 = vOut + hs * 3;
  pb.face(P(hu0 + 0.2, r0, 0.12), P(hu1 - 0.2, r0, 0.12), P(hu1 - 0.2, r1, 0.02), P(hu0 + 0.2, r1, 0.02));
  for (let t = 0; t <= 6; t++) { const v = r0 + (r1 - r0) * t / 6; pb.seg(HATCH, P(hu0 + 0.2, v, 0.12 - 0.1 * t / 6), P(hu1 - 0.2, v, 0.12 - 0.1 * t / 6)); }
  pb.seg(HATCH, P(hu0 + 0.2, r0, 0.12), P(hu0 + 0.2, r1, 0.02)); pb.seg(HATCH, P(hu1 - 0.2, r0, 0.12), P(hu1 - 0.2, r1, 0.02));

  // ---- debris: rocks and torn plates around the hull, the ground torn up where it slid
  for (const k of d.debris) { const [x, z] = wreckXZ(f, k.u, k.v); pb.rock(x, f.y - 0.1, z, k.r, k.h, 4 + ((k.rot * 10) | 0) % 3, k.rot, HULL_C); }
  for (const p of d.plates) {
    const c = Math.cos(p.rot), s = Math.sin(p.rot), q = (a: number, b: number, h: number) => P(p.u + a * c - b * s, p.v + a * s + b * c, h);
    pb.solid8([q(-p.l / 2, -p.w / 2, 0), q(p.l / 2, -p.w / 2, 0), q(p.l / 2, p.w / 2, 0), q(-p.l / 2, p.w / 2, 0)], [q(-p.l / 2, -p.w / 2, 0.12), q(p.l / 2, -p.w / 2, 0.25), q(p.l / 2, p.w / 2, 0.2), q(-p.l / 2, p.w / 2, 0.1)], HULL_C);
  }
  for (let i = 0; i < 3; i++) { const v = (i - 1) * 3 + (R() - 0.5); pb.line(HULL_C, P(HULL.nose + 1, v, 0.05), P(HULL.nose + 5 + R() * 3, v * 1.3, 0.05)); }
  return pb.build();
}
