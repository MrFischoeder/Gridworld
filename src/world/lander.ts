// The hero's ship, the survey vessel Kestrel: a small human craft from the future, drawn in the game's line style
// (pale cyan lines over dark fills). The same model flies whole through the opening (ui/intro.ts) and lies broken at
// the crash site by Gridholm (world/crashpod.ts). Ship-local metres: x to starboard, y up from the deck, z to the nose.
import { PropBatch } from './props';

export const SHIP_NAME = 'SV-9 Kestrel';
export const HULL_C = 0xa8e8ff, GLASS_C = 0xe8fdff, ENGINE_C = 0x5cc8ff, SCORCH_C = 0x3f5a50, WARN_C = 0xff5a3c;

/** Hull stations: z, half-width, bottom, top. The hatch is on the starboard side between the 4th and 5th. */
const ST: [number, number, number, number][] = [
  [-7.5, 1.4, 0.6, 2.6], [-5.5, 2.2, 0, 3], [-2.5, 2.2, 0, 3], [-0.6, 2.2, 0, 3], [0.9, 2.2, 0, 3], [3.5, 2.2, 0, 3], [6, 1.6, 0.3, 2.2], [8, 0.7, 0.8, 1.5],
];
export const NOSE: [number, number, number] = [0, 1.1, 9.2];
/** The doorway in the starboard side (ship-local z range, height). */
export const HATCH = { z0: -0.6, z1: 0.9, h: 2.25 };
/** The locker by the port wall and the flight console in the nose (ship-local, for interaction). */
export const LOCKER = { x: -1.7, z: -3.2 }, CONSOLE = { x: 0, z: 3.6 };

function ring(z: number, w: number, y0: number, y1: number): number[][] {
  const c = 0.35 * Math.min(w, (y1 - y0) / 2);
  return [[w, y0 + c, z], [w, y1 - c, z], [w - c, y1, z], [-w + c, y1, z], [-w, y1 - c, z], [-w, y0 + c, z], [-w + c, y0, z], [w - c, y0, z]];
}

export interface LanderOpts {
  /** Broken: the starboard wing snapped off, a gash in the roof, the fin bent, the engine crumpled. */
  broken: boolean;
  /** Down on the ground: the hatch open with its door lying outside, the cabin fitted out (default: as broken). */
  landed?: boolean;
  /** Shifts a ship-local point to where it is drawn (identity when omitted; no rotation: rotate the group instead). */
  at?: (p: number[]) => number[];
}

/** Draws the ship into a batch. */
export function drawLander(pb: PropBatch, o: LanderOpts) {
  const T = o.at ?? ((p: number[]) => p), br = o.broken, down = o.landed ?? o.broken;
  const seg = (c: number, a: number[], b: number[]) => pb.seg(c, T(a), T(b));
  const face = (...p: number[][]) => pb.face(...p.map(T));
  const rings = ST.map(([z, w, y0, y1]) => ring(z, w, y0, y1));
  // ---- the hull: panels between stations (no floor: the deck is whatever it lies on)
  for (let i = 0; i + 1 < rings.length; i++) {
    const a = rings[i], b = rings[i + 1], z0 = ST[i][0];
    const hatch = down && z0 === HATCH.z0, gash = br && z0 === -2.5;
    for (let k = 0; k < 8; k++) {
      const k1 = (k + 1) % 8;
      if (k === 6 && down && !ST[i][2] && !ST[i + 1][2]) continue; // no belly where the deck lies on the ground (raised at tail and nose)
      if (hatch && (k === 0 || k === 7)) continue;
      if (gash && (k === 2 || k === 1)) { // torn open: jagged edges
        const m = (p: number[], q: number[], t: number, j: number) => p.map((v, n) => v + (q[n] - v) * t + (n === 1 ? j : 0));
        seg(HULL_C, a[k], m(a[k], b[k], 0.35, -0.25)); seg(HULL_C, m(a[k], b[k], 0.35, -0.25), m(a[k1], b[k1], 0.6, -0.4)); seg(HULL_C, m(a[k1], b[k1], 0.6, -0.4), b[k1]);
        continue;
      }
      face(a[k], a[k1], b[k1], b[k]);
      seg(HULL_C, a[k], b[k]);
    }
    for (let k = 0; k < 8; k++) if (k !== 6 || !down || i === 0) seg(HULL_C, a[k], a[(k + 1) % 8]);
  }
  const last = rings[rings.length - 1];
  for (let k = 0; k < 8; k++) { face(last[k], last[(k + 1) % 8], NOSE); seg(HULL_C, last[k], NOSE); }
  seg(HULL_C, last[6], last[7]);
  // the tail plate with a hatch outline, and the last bulkhead's edge
  const tail = rings[0];
  face(...tail); for (let k = 0; k < 8; k++) seg(HULL_C, tail[k], tail[(k + 1) % 8]);
  // a stripe along both sides
  for (const s of [1, -1]) seg(ENGINE_C, [2.21 * s, 2.05, -5.5], [2.21 * s, 2.05, 3.5]);
  seg(ENGINE_C, [1.61, 1.6, 6], [2.21, 2.05, 3.5]); seg(ENGINE_C, [-1.61, 1.6, 6], [-2.21, 2.05, 3.5]);
  // ---- the canopy: window frames over the cockpit
  const c5 = rings[5], c6 = rings[6];
  for (const k of [1, 2, 3]) {
    const p = [c5[k], c5[k + 1], c6[k + 1], c6[k]].map((v) => [v[0] * 0.92, v[1] + 0.02, v[2]]);
    const q = p.map((v, n) => [v[0], v[1], v[2] + (n < 2 ? 0.25 : -0.25)]);
    for (let n = 0; n < 4; n++) seg(GLASS_C, q[n], q[(n + 1) % 4]);
    if (!br || k !== 2) seg(GLASS_C, q[0], q[2]); // a cracked pane lacks its reflection line
  }
  // ---- side hatch: the frame (open and the door lying on the ground when broken)
  const hx = 2.23, H = HATCH;
  const frame = [[hx, 0.05, H.z0], [hx, H.h, H.z0], [hx, H.h, H.z1], [hx, 0.05, H.z1]];
  for (let n = 0; n < 3; n++) seg(GLASS_C, frame[n], frame[n + 1]);
  if (down) {
    const d = [[3.1, -0.05, H.z0 - 0.3], [5.2, 0.15, H.z0 - 0.1], [5.1, 0.15, H.z1 + 0.35], [3.0, -0.05, H.z1 + 0.1]];
    face(...d); for (let n = 0; n < 4; n++) seg(HULL_C, d[n], d[(n + 1) % 4]);
    seg(HULL_C, [3.5, 0.03, H.z0], [4.8, 0.13, H.z0 + 0.1]);
  } else seg(HULL_C, frame[3], frame[0]);
  // ---- wings: swept, low on the hull; the starboard one snapped short when broken
  for (const s of [1, -1]) {
    const tipX = br && s === 1 ? 3.4 : 7.6;
    const root0 = [2.2 * s, 0.95, -6], root1 = [2.2 * s, 0.95, -2], t0 = [tipX * s, 0.85, br && s === 1 ? -6.2 : -7.2], t1 = [tipX * s, 0.85, br && s === 1 ? -3.3 : -5.6];
    const lo = (p: number[]) => [p[0], p[1] - 0.2, p[2]];
    face(root0, t0, t1, root1); face(lo(root0), lo(t0), lo(t1), lo(root1));
    face(t0, t1, lo(t1), lo(t0)); face(root0, t0, lo(t0), lo(root0)); face(root1, t1, lo(t1), lo(root1));
    seg(HULL_C, root0, t0); seg(HULL_C, root1, t1); seg(HULL_C, lo(root0), lo(t0)); seg(HULL_C, lo(root1), lo(t1));
    if (br && s === 1) { seg(HULL_C, t0, [3.6, 0.95, -5.4]); seg(HULL_C, [3.6, 0.95, -5.4], [3.3, 0.8, -4.5]); seg(HULL_C, [3.3, 0.8, -4.5], t1); }
    else { seg(HULL_C, t0, t1); seg(HULL_C, lo(t0), lo(t1)); seg(WARN_C, [t0[0], 0.87, t0[2] + 0.2], [t1[0], 0.87, t1[2] - 0.2]); }
  }
  // ---- twin engines: octagonal nacelles with bells behind the tail
  for (const s of [1, -1]) {
    const cx = 1.5 * s, cy = 2.5, r = 0.72, z0 = -9.6, z1 = -6;
    const oct = (z: number, rr: number) => Array.from({ length: 8 }, (_, k) => [cx + Math.cos((k + 0.5) / 8 * 6.283) * rr, cy + Math.sin((k + 0.5) / 8 * 6.283) * rr, z]);
    const a = oct(z0, r), b = oct(z1, r), bell = oct(z0 - 0.9, r * 1.18);
    for (let k = 0; k < 8; k++) {
      const k1 = (k + 1) % 8;
      face(a[k], a[k1], b[k1], b[k]); seg(HULL_C, a[k], b[k]); seg(HULL_C, a[k], a[k1]); seg(HULL_C, b[k], b[k1]);
      face(a[k], a[k1], bell[k1], bell[k]); seg(ENGINE_C, bell[k], bell[k1]); seg(HULL_C, a[k], bell[k]);
    }
    face(...b);
    const bent = br && s === 1; // the starboard engine took the hit: its bell is crumpled
    if (bent) seg(WARN_C, bell[1], bell[5]);
  }
  // ---- the fin, bent over when broken
  const lean = br ? 0.9 : 0;
  const f0 = [0, 3, -7.2], f1 = [0, 3, -4.6], f2 = [lean, 5.1, -7.6], f3 = [lean * 0.7, 4.8, -6.4];
  face(f0, f1, f3, f2); seg(HULL_C, f0, f2); seg(HULL_C, f2, f3); seg(HULL_C, f3, f1); seg(ENGINE_C, [lean * 0.5, 4.2, -7.3], [lean * 0.35, 4.0, -6.1]);
  // ---- inside: the flight console and seats in the nose, lockers along the port wall, a lamp
  if (down) {
    const cz = CONSOLE.z;
    const b0 = T([-1.3, 0, cz + 0.2]), b1 = T([1.3, 0.95, cz + 0.9]); // (an axis-aligned box: `at` may only shift)
    pb.box(b0[0], b0[1], b0[2], b1[0], b1[1], b1[2], HULL_C);
    seg(GLASS_C, [-0.9, 1.0, cz + 0.4], [0.9, 1.0, cz + 0.4]); seg(GLASS_C, [-0.9, 1.25, cz + 0.8], [0.9, 1.25, cz + 0.8]);
    seg(WARN_C, [-0.3, 0.97, cz + 0.55], [0.3, 0.97, cz + 0.55]);
    for (const s of [-0.7, 0.7]) { const q = [[s - 0.3, 0.5, cz - 0.9], [s + 0.3, 0.5, cz - 0.9], [s + 0.3, 1.2, cz - 1.1], [s - 0.3, 1.2, cz - 1.1]]; for (let n = 0; n < 4; n++) seg(HULL_C, q[n], q[(n + 1) % 4]); seg(HULL_C, [s, 0, cz - 0.8], [s, 0.5, cz - 0.9]); }
    const L = LOCKER;
    for (let n = 0; n < 3; n++) {
      const z0 = L.z - 1.1 + n * 0.75, q = [[L.x - 0.35, 0.02, z0], [L.x - 0.35, 2.1, z0], [L.x - 0.35, 2.1, z0 + 0.7], [L.x - 0.35, 0.02, z0 + 0.7]];
      for (let m = 0; m < 4; m++) seg(n === 1 ? GLASS_C : HULL_C, q[m], q[(m + 1) % 4]);
    }
  }
}
/**
 * The hull's outline in plan (ship-local x, z) for collisions: wall segments, with the hatch left open when broken,
 * plus the wings, the engines and, inside, the console.
 */
export function landerWalls(broken: boolean): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  const poly = (pts: number[][], closed = false) => { for (let i = 0; i + 1 < pts.length; i++) out.push([pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]]); if (closed) out.push([pts[pts.length - 1][0], pts[pts.length - 1][1], pts[0][0], pts[0][1]]); };
  poly([[2.2, HATCH.z1], [2.2, 3.5], [1.6, 6], [0.7, 8], [0, 9.2], [-0.7, 8], [-1.6, 6], [-2.2, 3.5], [-2.2, -5.5], [-2.3, -9.8], [2.3, -9.8], [2.2, -5.5], [2.2, HATCH.z0]]);
  if (!broken) out.push([2.2, HATCH.z0, 2.2, HATCH.z1]);
  poly([[-2.2, -6], [-7.6, -7.2], [-7.6, -5.6], [-2.2, -2]]);
  poly(broken ? [[2.2, -6], [3.4, -6.2], [3.6, -5.4], [3.4, -3.3], [2.2, -2]] : [[2.2, -6], [7.6, -7.2], [7.6, -5.6], [2.2, -2]]);
  if (broken) { poly([[-1.3, CONSOLE.z + 0.2], [1.3, CONSOLE.z + 0.2], [1.3, CONSOLE.z + 0.9], [-1.3, CONSOLE.z + 0.9]], true); poly([[LOCKER.x - 0.35, LOCKER.z - 1.1], [LOCKER.x - 0.35, LOCKER.z + 1.15]]); }
  return out;
}
