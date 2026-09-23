// Bandit camps: a campfire ringed by tents, crates and low barricades to fight from, and a stash.
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
  fire: { x: number; z: number };
  stash: { x: number; z: number };
  spawns: { x: number; z: number; role: BanditRole }[];
}

export function generateCamp(world: number, poi: Poi, y: number): CampMap {
  const R = rng(hash(world, poi.id, 0xba7d)), ri = rangeInt(R);
  const { x0, z0, x1, z1 } = poi.rect, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const ops: Op[] = [], used: Rect[] = [];
  const hits = (a: Rect) => used.some((b) => a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0);
  const fire = { x: cx, z: cz };
  used.push({ x0: cx - 2, z0: cz - 2, x1: cx + 2, z1: cz + 2 });
  // tents on a ring around the fire, their openings facing it
  const tents: Rect[] = [], nT = ri(2, 3), a0 = R() * 6.28;
  for (let i = 0; i < nT; i++) {
    const a = a0 + i / nT * 6.283, tx = Math.round(cx + Math.cos(a) * 6), tz = Math.round(cz + Math.sin(a) * 6);
    const along = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)), w = along ? 4 : 3, d = along ? 3 : 4;
    const t = { x0: tx - Math.floor(w / 2), z0: tz - Math.floor(d / 2), x1: tx - Math.floor(w / 2) + w, z1: tz - Math.floor(d / 2) + d };
    if (t.x0 < x0 + 2 || t.x1 > x1 - 2 || t.z0 < z0 + 2 || t.z1 > z1 - 2 || hits(t)) continue;
    tents.push(t); used.push({ x0: t.x0 - 1, z0: t.z0 - 1, x1: t.x1 + 1, z1: t.z1 + 1 });
  }
  // crates to hide behind, some stacked
  for (let n = 0, placed = 0; n < 40 && placed < 8; n++) {
    const w = R() < 0.35 ? 2 : 1, x = ri(x0 + 2, x1 - 2 - w), z = ri(z0 + 2, z1 - 3), r = { x0: x, z0: z, x1: x + w, z1: z + 1 };
    if (hits({ x0: x - 1, z0: z - 1, x1: x + w + 1, z1: z + 2 })) continue;
    ops.push({ op: 'solid', x, y, z, w, h: R() < 0.3 ? 2 : 1, d: 1 }); used.push(r); placed++;
  }
  // low barricades along the edge, with gaps to walk through
  const edge: [number, number][] = [];
  for (let x = x0 + 1; x < x1 - 1; x++) edge.push([x, z0], [x, z1 - 1]);
  for (let z = z0 + 1; z < z1 - 1; z++) edge.push([x0, z], [x1 - 1, z]);
  let run = 0;
  for (const [x, z] of edge) {
    if (run <= 0) run = R() < 0.55 ? ri(2, 5) : -ri(2, 4);
    if (run > 0) { ops.push({ op: 'solid', x, y, z, w: 1, h: R() < 0.2 ? 2 : 1, d: 1 }); run--; } else run++;
  }
  // the stash sits by the first tent
  const t0 = tents[0] ?? { x0: cx + 3, z0: cz, x1: cx + 4, z1: cz + 1 };
  const stash = { x: t0.x1 + 0.5, z: (t0.z0 + t0.z1) / 2 };
  const solidAt = (x: number, z: number) => ops.some((o) => x >= o.x && x < o.x + o.w && z >= o.z && z < o.z + o.d);
  // who lives here
  const roles: BanditRole[] = ['leader', ...Array(ri(2, 4)).fill('gunner'), ...Array(ri(1, 2)).fill('bruiser')];
  const spawns: CampMap['spawns'] = [];
  for (const role of roles) {
    for (let n = 0; n < 30; n++) {
      const a = R() * 6.283, d = role === 'leader' ? 2.5 : 3 + R() * 5, x = Math.floor(cx + Math.cos(a) * d) + 0.5, z = Math.floor(cz + Math.sin(a) * d) + 0.5;
      if (solidAt(Math.floor(x), Math.floor(z)) || spawns.some((s) => Math.hypot(s.x - x, s.z - z) < 1.5)) continue;
      if (Math.hypot(x - fire.x, z - fire.z) < 1.6) continue;
      spawns.push({ x, z, role }); break;
    }
  }
  return { id: poi.id, name: poi.name, y, rect: poi.rect, ops, tents, fire, stash, spawns };
}
