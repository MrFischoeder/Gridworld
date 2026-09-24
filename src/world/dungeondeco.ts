// Angled shapes over the voxel dungeons, so not every wall and ceiling meets at a right angle. All of it is above
// head height (collision stays on the voxels): chamfered ceilings (slanted panels along the walls), pointed vaults
// over the big halls, raking struts from the walls up to the ceiling, diagonal squinches across upper corners.
// A crashed ship gets chamfered corridors and rooms (an octagonal cross-section) with hull ribs every few metres.
// Deterministic from the map's seed; drawn as PropBatch solids with dark fills and 1 m grid lines like the walls.
import * as THREE from 'three';
import { GRID } from './render';
import { PropBatch } from './props';
import { rng } from '../core/rng';
import type { DungeonMap, DecoBox } from '../gen/dungeon';

const RIB = 0x7dffc8;
type P = number[];

/** A quad panel with grid lines: `rungs` lines across it between the a-b and d-c edges. */
function panel(pb: PropBatch, a: P, b: P, c: P, d: P, rungs: number, color = GRID) {
  pb.face(a, b, c, d);
  pb.line(color, a, b, c, d, a);
  for (let i = 1; i < rungs; i++) {
    const t = i / rungs, p = a.map((v, k) => v + (b[k] - v) * t), q = d.map((v, k) => v + (c[k] - v) * t);
    pb.seg(color, p, q);
  }
}
/**
 * Slanted panels along all four walls of a box, from `c` below the ceiling at the wall to `c` in from the wall at the
 * ceiling, mitred at the corners. `skip(side, t)` leaves gaps (door frames in ship corridors).
 */
function chamfer(pb: PropBatch, b: DecoBox, c: number, sides: ('W' | 'E' | 'N' | 'S')[], skip?: (side: string, t: number) => boolean) {
  const x0 = b.x, x1 = b.x + b.w, z0 = b.z, z1 = b.z + b.d, lo = b.h - c, hi = b.h - 0.02;
  const has = (s: string) => sides.includes(s as 'W');
  const seg = (side: string, from: number, to: number) => {
    // pieces of a wall's panel between t = from..to along it (1 m rungs)
    const n = Math.max(1, Math.round(to - from));
    if (side === 'W' || side === 'E') {
      const xw = side === 'W' ? x0 + 0.01 : x1 - 0.01, xi = side === 'W' ? x0 + c : x1 - c;
      const za = (t: number, top: boolean) => (top ? Math.min(Math.max(t, z0 + (has('N') ? c : 0)), z1 - (has('S') ? c : 0)) : t);
      panel(pb, [xw, lo, from], [xw, lo, to], [xi, hi, za(to, true)], [xi, hi, za(from, true)], n);
    } else {
      const zw = side === 'N' ? z0 + 0.01 : z1 - 0.01, zi = side === 'N' ? z0 + c : z1 - c;
      const xa = (t: number, top: boolean) => (top ? Math.min(Math.max(t, x0 + (has('W') ? c : 0)), x1 - (has('E') ? c : 0)) : t);
      panel(pb, [from, lo, zw], [to, lo, zw], [xa(to, true), hi, zi], [xa(from, true), hi, zi], n);
    }
  };
  for (const side of sides) {
    const a = side === 'W' || side === 'E' ? z0 : x0, e = side === 'W' || side === 'E' ? z1 : x1;
    if (!skip) { seg(side, a, e); continue; }
    let s0: number | null = null;
    for (let t = a; t < e; t++) {
      const off = skip(side, t + 0.5);
      if (!off && s0 === null) s0 = t;
      if ((off || t === e - 1) && s0 !== null) { seg(side, s0, off ? t : e); s0 = null; }
    }
  }
}
/** A pointed vault over a big hall: two panels rising from the long walls to a ridge along the middle. */
function vault(pb: PropBatch, b: DecoBox, drop: number) {
  const alongX = b.w >= b.d, lo = b.h - drop, hi = b.h - 0.02, x0 = b.x, x1 = b.x + b.w, z0 = b.z, z1 = b.z + b.d;
  if (alongX) {
    const zm = (z0 + z1) / 2, n = Math.round(b.w);
    panel(pb, [x0, lo, z0 + 0.01], [x1, lo, z0 + 0.01], [x1, hi, zm], [x0, hi, zm], n);
    panel(pb, [x0, lo, z1 - 0.01], [x1, lo, z1 - 0.01], [x1, hi, zm], [x0, hi, zm], n);
    for (const x of [x0 + 0.01, x1 - 0.01]) { pb.face([x, lo, z0], [x, hi, zm], [x, lo, z1]); pb.line(GRID, [x, lo, z0], [x, hi, zm], [x, lo, z1]); }
  } else {
    const xm = (x0 + x1) / 2, n = Math.round(b.d);
    panel(pb, [x0 + 0.01, lo, z0], [x0 + 0.01, lo, z1], [xm, hi, z1], [xm, hi, z0], n);
    panel(pb, [x1 - 0.01, lo, z0], [x1 - 0.01, lo, z1], [xm, hi, z1], [xm, hi, z0], n);
    for (const z of [z0 + 0.01, z1 - 0.01]) { pb.face([x0, lo, z], [xm, hi, z], [x1, lo, z]); pb.line(GRID, [x0, lo, z], [xm, hi, z], [x1, lo, z]); }
  }
}
/** Raking struts: square beams leaning from the long walls (at 2.6 m) up to the ceiling. */
function struts(pb: PropBatch, b: DecoBox, R: () => number) {
  const alongX = b.w >= b.d, len = alongX ? b.w : b.d, reach = Math.min(1.6, (alongX ? b.d : b.w) * 0.2), t = 0.18;
  for (let s = 2.5 + R(); s < len - 1.5; s += 3 + R()) {
    for (const side of [0, 1]) {
      const along = (alongX ? b.x : b.z) + s, wall = alongX ? (side ? b.z + b.d : b.z) : (side ? b.x + b.w : b.x), dir = side ? -1 : 1;
      const p = (a: number, off: number, h: number): P => (alongX ? [a, h, wall + dir * off] : [wall + dir * off, h, a]);
      const lo = Math.min(2.6, b.h - 1.5), hi = b.h - 0.02;
      pb.solid8([p(along - t, 0.01, lo), p(along + t, 0.01, lo), p(along + t, 0.01, lo + t * 2), p(along - t, 0.01, lo + t * 2)],
        [p(along - t, reach, hi), p(along + t, reach, hi), p(along + t, reach - t * 2, hi), p(along - t, reach - t * 2, hi)], GRID);
    }
  }
}
/** Diagonal panels across the upper corners of a room (squinches). */
function squinches(pb: PropBatch, b: DecoBox, size: number) {
  const s = Math.min(size, (b.h - 3) / 1.3); // never lower than 3 m in the corner
  if (s < 0.6) return;
  const x0 = b.x, x1 = b.x + b.w, z0 = b.z, z1 = b.z + b.d, lo = b.h - s * 1.3, hi = b.h - 0.02;
  for (const [cx, cz, dx, dz] of [[x0, z0, 1, 1], [x1, z0, -1, 1], [x0, z1, 1, -1], [x1, z1, -1, -1]]) {
    const a = [cx + dx * s, hi, cz + 0.01 * dz], b2 = [cx + 0.01 * dx, hi, cz + dz * s], c = [cx + 0.01 * dx, lo, cz + 0.01 * dz];
    pb.face(a, b2, c); pb.line(GRID, a, b2, c, a);
  }
}
/** Hull ribs in the ship's corridors: a frame round the octagonal cross-section every few metres. */
function ribs(pb: PropBatch, b: DecoBox, c: number, doors: (t: number) => boolean) {
  const alongX = b.w > b.d, len = alongX ? b.w : b.d, wid = alongX ? b.d : b.w;
  for (let t = 1.5; t < len - 1; t += 3) {
    const a = (alongX ? b.x : b.z) + t;
    if (doors(a)) continue;
    const lat = alongX ? b.z : b.x, P = (u: number, h: number): P => (alongX ? [a, h, lat + u] : [lat + u, h, a]), e = 0.03;
    pb.line(RIB, P(e, 0), P(e, b.h - c), P(c, b.h - e), P(wid - c, b.h - e), P(wid - e, b.h - c), P(wid - e, 0));
  }
}

export function decorateDungeon(map: DungeonMap): THREE.Group {
  const pb = new PropBatch(), R = rng(map.seed ^ 0xdec0);
  if (map.style === 'ship') {
    // bulkhead and stub doors: no panels or ribs across their frames
    const doorAt = (x: number, z: number) => map.doorCands.some((d) => (d.axis === 'z' ? Math.abs(d.m + 0.5 - z) < 2 && Math.abs(d.c + 0.5 - x) < 3 : Math.abs(d.m + 0.5 - x) < 2 && Math.abs(d.c + 0.5 - z) < 3));
    for (const b of map.boxes) {
      if (b.tunnel) {
        const alongX = b.w > b.d;
        chamfer(pb, b, 0.6, alongX ? ['N', 'S'] : ['W', 'E'], (side, t) => (side === 'N' || side === 'S' ? doorAt(t, side === 'N' ? b.z : b.z + b.d) : doorAt(side === 'W' ? b.x : b.x + b.w, t)));
        ribs(pb, b, 0.6, (a) => (alongX ? doorAt(a, b.z + 1.5) : doorAt(b.x + 1.5, a)));
      } else chamfer(pb, b, Math.min(1.2, b.h * 0.25), ['W', 'E', 'N', 'S']);
    }
    return pb.build();
  }
  // temple mazes: each room rolls its own shape (many keep plain walls)
  for (const b of map.boxes) {
    if (b.h < 5) continue;
    const roll = R();
    if (b.h >= 7 && Math.min(b.w, b.d) >= 10 && roll < 0.5) vault(pb, b, Math.min(3, b.h * 0.35));
    else if (roll < 0.55) chamfer(pb, b, Math.min(1.6, b.h * 0.25), ['W', 'E', 'N', 'S']);
    else if (roll < 0.8) { struts(pb, b, R); squinches(pb, b, 1.4); }
    else if (roll < 0.9) squinches(pb, b, 2);
  }
  return pb.build();
}
