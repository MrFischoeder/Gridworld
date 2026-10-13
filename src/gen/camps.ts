// Bandit camps: tents, cover crates, a fire and a stash inside a timber palisade (since 0.198 a polygon of 6 to 8 sides,
// never a square, with openings north and south).
import { rng, hash, rangeInt } from '../core/rng';
import type { Op } from '../core/voxel';
import type { Poi, Rect } from './regions';

export type BanditRole = 'gunner' | 'bruiser' | 'leader';
export interface CampMap {
  id: number; name: string; y: number; rect: Rect;
  /** Voxel crates and barricades (collision and cover). */
  ops: Op[];
  /** A-frame tents (drawn only; you can walk into them). */
  tents: Rect[];
  /** Solid palisade cells (one per cell, along the polygon `ring`), with four-metre north/south entrances. */
  palisade: Op[];
  /** The palisade's corners (world), on its middle line. */
  ring: [number, number][];
  fire: { x: number; z: number };
  stash: { x: number; z: number };
  spawns: { x: number; z: number; role: BanditRole }[];
}

export function generateCamp(world: number, poi: Poi, y: number): CampMap {
  const R = rng(hash(world, poi.id, 0xba7d)), ri = rangeInt(R);
  const { x0, z0, x1, z1 } = poi.rect, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const ops: Op[] = [], used: Rect[] = [];
  const hits = (a: Rect) => used.some((b) => a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0);
  // the palisade's shape: 6–8 sides (own hash, so the other draws keep their order), a flat side to the north
  const sides = 6 + hash(world, poi.id, 0xca9b) % 3, RR = Math.min(x1 - x0, z1 - z0) / 2 - 0.6, ring: [number, number][] = [];
  for (let k = 0; k < sides; k++) { const th = -Math.PI / sides + (2 * Math.PI * k) / sides; ring.push([cx + RR * Math.sin(th), cz - RR * Math.cos(th)]); }
  const inside = (x: number, z: number, m: number) => inPoly(ring, cx, cz, x, z, m);
  const fire = { x: cx, z: cz };
  used.push({ x0: cx - 2, z0: cz - 2, x1: cx + 2, z1: cz + 2 });
  // tents on a ring around the fire, their openings facing it
  const tents: Rect[] = [], nT = ri(2, 3), a0 = R() * 6.28;
  for (let i = 0; i < nT; i++) {
    const a = a0 + i / nT * 6.283, along = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)), w = along ? 4 : 3, d = along ? 3 : 4;
    for (const r of [6, 5.5, 5, 4.5]) { // as far out as the palisade lets it
      const tx = Math.round(cx + Math.cos(a) * r), tz = Math.round(cz + Math.sin(a) * r);
      const t = { x0: tx - Math.floor(w / 2), z0: tz - Math.floor(d / 2), x1: tx - Math.floor(w / 2) + w, z1: tz - Math.floor(d / 2) + d };
      if (![[t.x0, t.z0], [t.x1, t.z0], [t.x0, t.z1], [t.x1, t.z1]].every(([px, pz]) => inside(px, pz, 0.8)) || hits(t)) continue;
      tents.push(t); used.push({ x0: t.x0 - 1, z0: t.z0 - 1, x1: t.x1 + 1, z1: t.z1 + 1 }); break;
    }
  }
  // crates to hide behind, some stacked
  for (let n = 0, placed = 0; n < 90 && placed < 8; n++) {
    const w = R() < 0.35 ? 2 : 1, x = ri(x0 + 2, x1 - 2 - w), z = ri(z0 + 2, z1 - 3), r = { x0: x, z0: z, x1: x + w, z1: z + 1 };
    if (hits({ x0: x - 1, z0: z - 1, x1: x + w + 1, z1: z + 2 }) || ![[x, z], [x + w, z], [x, z + 1], [x + w, z + 1]].every(([px, pz]) => inside(px, pz, 1.1))) continue;
    ops.push({ op: 'solid', x, y, z, w, h: R() < 0.3 ? 2 : 1, d: 1 }); used.push(r); placed++;
  }
  // Consume the former barricade draws to preserve the seeded stash/spawn sequence.
  const crateCount = ops.length;
  // low barricades along the edge, with gaps to walk through
  const edge: [number, number][] = [];
  for (let x = x0 + 1; x < x1 - 1; x++) edge.push([x, z0], [x, z1 - 1]);
  for (let z = z0 + 1; z < z1 - 1; z++) edge.push([x0, z], [x1 - 1, z]);
  let run = 0;
  for (const [x, z] of edge) {
    if (run <= 0) run = R() < 0.55 ? ri(2, 5) : -ri(2, 4);
    if (run > 0) { ops.push({ op: 'solid', x, y, z, w: 1, h: R() < 0.2 ? 2 : 1, d: 1 }); run--; } else run++;
  }
  ops.splice(crateCount);
  const palisade: Op[] = [];
  const gate0 = Math.floor(cx) - 2;
  for (const [x, z] of ringCells(ring)) if (x < gate0 || x >= gate0 + 4) palisade.push({ op: 'solid', x, y, z, w: 1, h: 3, d: 1 });
  ops.push(...palisade);
  // the stash sits by the first tent
  const t0 = tents[0] ?? { x0: cx + 3, z0: cz, x1: cx + 4, z1: cz + 1 };
  const stash = { x: t0.x1 + 0.5, z: (t0.z0 + t0.z1) / 2 };
  const solidAt = (x: number, z: number) => ops.some((o) => x >= o.x && x < o.x + o.w && z >= o.z && z < o.z + o.d);
  // who lives here
  const roles: BanditRole[] = ['leader', ...Array(ri(2, 4)).fill('gunner'), ...Array(ri(1, 2)).fill('bruiser')];
  const spawns: CampMap['spawns'] = [];
  for (const role of roles) {
    for (let n = 0; n < 30; n++) {
      const a = R() * 6.283, d = role === 'leader' ? 2.5 : 3 + R() * 3.5, x = Math.floor(cx + Math.cos(a) * d) + 0.5, z = Math.floor(cz + Math.sin(a) * d) + 0.5;
      if (solidAt(Math.floor(x), Math.floor(z)) || !inside(x, z, 1) || spawns.some((s) => Math.hypot(s.x - x, s.z - z) < 1.5)) continue;
      if (Math.hypot(x - fire.x, z - fire.z) < 1.6) continue;
      spawns.push({ x, z, role }); break;
    }
  }
  return { id: poi.id, name: poi.name, y, rect: poi.rect, ops, tents, palisade, ring, fire, stash, spawns };
}

/** Is (x, z) inside the convex polygon `poly` round (cx, cz), at least `m` in from its edges? */
export function inPoly(poly: [number, number][], cx: number, cz: number, x: number, z: number, m = 0): boolean {
  for (let i = 0; i < poly.length; i++) {
    const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % poly.length];
    let nx = bz - az, nz = -(bx - ax); const L = Math.hypot(nx, nz); nx /= L; nz /= L;
    if (nx * (ax - cx) + nz * (az - cz) < 0) { nx = -nx; nz = -nz; } // point outward
    if (nx * (x - ax) + nz * (z - az) > -m) return false;
  }
  return true;
}
/** The 1 m cells along a polygon's edges, 4-connected (no diagonal gaps). */
export function ringCells(poly: [number, number][]): [number, number][] {
  const cells = new Map<string, [number, number]>();
  for (let i = 0; i < poly.length; i++) {
    const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % poly.length], L = Math.hypot(bx - ax, bz - az);
    let px = Math.floor(ax), pz = Math.floor(az);
    for (let t = 0; t <= L; t += 0.2) {
      const x = Math.floor(ax + (bx - ax) * t / L), z = Math.floor(az + (bz - az) * t / L);
      if (x !== px && z !== pz) cells.set(x + ',' + pz, [x, pz]);
      cells.set(x + ',' + z, [x, z]); px = x; pz = z;
    }
  }
  return [...cells.values()].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}
