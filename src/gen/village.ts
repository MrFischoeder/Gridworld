// Village generator (Gridholm). Pure and deterministic from the world seed.
import { rng, rangeInt, DIRV, type Dir } from '../core/rng';
import type { Op } from '../core/voxel';
import { stairOpsFor, type PortalSpec } from './stairs';

export type Role = 'innkeeper' | 'elder' | 'blacksmith' | 'merchant' | 'grocer' | 'house';
export interface P3 { x: number; y: number; z: number }
export interface Building {
  name: string; role: Role; x: number; z: number; w: number; d: number; h: number;
  side: Dir; out: [number, number]; door: P3; home?: P3;
}
export interface VillageMap {
  seed: number; village: true; name: string;
  spawn: [number, number, number];
  ops: Op[];
  portals: PortalSpec[];
  buildings: Building[];
  trees: { x: number; z: number; h: number }[];
  lamps: { x: number; z: number }[];
  well: { x: number; z: number };
}

export function generateVillage(seed: number): VillageMap {
  const R = rng(seed ^ 0x51ab7), ri = rangeInt(R);
  const PW = 72, PD = 72, ops: Op[] = [{ op: 'room', x: 0, y: 0, z: 0, w: PW, h: 30, d: PD }], late: Op[] = [];
  const buildings: Building[] = [], trees: { x: number; z: number; h: number }[] = [], lamps: { x: number; z: number }[] = [];
  const B = (name: string, role: Role, x: number, z: number, w: number, d: number, side: Dir, h = 6) => {
    const cxm = x + (w >> 1), czm = z + (d >> 1);
    ops.push({ op: 'solid', x, y: 0, z, w, h, d }, { op: 'room', x: x + 1, y: 0, z: z + 1, w: w - 2, h: h - 1, d: d - 2 });
    const dr = side === 'E' ? { x: x + w - 1, z: czm - 1, w: 1, d: 3 } : side === 'W' ? { x, z: czm - 1, w: 1, d: 3 }
      : side === 'N' ? { x: cxm - 1, z, w: 3, d: 1 } : { x: cxm - 1, z: z + d - 1, w: 3, d: 1 };
    ops.push({ op: 'room', x: dr.x, y: 0, z: dr.z, w: dr.w, h: 3, d: dr.d });
    const b: Building = { name, role, x, z, w, d, h, side, out: DIRV[side], door: { x: dr.x + dr.w / 2, y: 0, z: dr.z + dr.d / 2 } };
    // counter and the keeper's spot by the back wall
    const ix0 = x + 1, ix1 = x + w - 2, iz0 = z + 1, iz1 = z + d - 2;
    if (role !== 'house') {
      if (side === 'E') { b.home = { x: ix0 + 1.5, y: 0, z: czm + 0.5 }; if (role !== 'elder') late.push({ op: 'solid', x: ix0 + 2, y: 0, z: iz0 + 1, w: 1, h: 1, d: iz1 - iz0 - 1 }); }
      if (side === 'W') { b.home = { x: ix1 - 0.5, y: 0, z: czm + 0.5 }; if (role !== 'elder') late.push({ op: 'solid', x: ix1 - 2, y: 0, z: iz0 + 1, w: 1, h: 1, d: iz1 - iz0 - 1 }); }
      if (side === 'N') { b.home = { x: cxm + 0.5, y: 0, z: iz1 - 0.5 }; if (role !== 'elder') late.push({ op: 'solid', x: ix0 + 1, y: 0, z: iz1 - 2, w: ix1 - ix0 - 1, h: 1, d: 1 }); }
      if (side === 'S') { b.home = { x: cxm + 0.5, y: 0, z: iz0 + 1.5 }; if (role !== 'elder') late.push({ op: 'solid', x: ix0 + 1, y: 0, z: iz0 + 2, w: ix1 - ix0 - 1, h: 1, d: 1 }); }
    }
    if (role === 'innkeeper') { // tables in the tavern, away from the counter and the entrance
      for (let i = 0; i < 5; i++) {
        const tz = ri(iz0 + 1, iz1 - 1); if (Math.abs(tz - czm) <= 1) continue;
        late.push({ op: 'solid', x: ri(ix0 + 4, ix1 - 2), y: 0, z: tz, w: 1, h: 1, d: 1 });
      }
    }
    buildings.push(b); return b;
  };
  const j = () => ri(-1, 1);
  B('TAVERN', 'innkeeper', 2, 6 + j(), 15, 12, 'E');
  B("ELDER'S HALL", 'elder', 2, 25 + j(), 12, 10, 'E');
  B('', 'house', 3, 43 + j(), 9, 8, 'E');
  B('BLACKSMITH', 'blacksmith', 57, 6 + j(), 13, 10, 'W');
  B('GENERAL STORE', 'merchant', 57, 23 + j(), 13, 10, 'W');
  B('FOOD & PROVISIONS', 'grocer', 59, 40 + j(), 11, 9, 'W');
  for (const hx of [12, 28, 44]) B('', 'house', hx + j(), 60 + j(), 9, 8, 'N', 5);
  // well, trees, lamps
  late.push({ op: 'solid', x: 35, y: 0, z: 36, w: 2, h: 1, d: 2 });
  const blocked = (x: number, z: number, m: number) => buildings.some((b) => x >= b.x - m && x < b.x + b.w + m && z >= b.z - m && z < b.z + b.d + m)
    || (Math.abs(x - 36) < 5 && z < 10) || (Math.abs(x - 36) < 4 && Math.abs(z - 37) < 4) || (Math.abs(x - 36) < 3 && Math.abs(z - 50) < 3);
  for (let n = 0; n < 200 && trees.length < 12; n++) {
    const x = ri(2, 69), z = ri(2, 69);
    if (blocked(x, z, 3) || trees.some((t) => Math.abs(t.x - x) + Math.abs(t.z - z) < 5)) continue;
    trees.push({ x, z, h: ri(4, 6) }); late.push({ op: 'solid', x, y: 0, z, w: 1, h: 2, d: 1 });
  }
  for (const [x, z] of [[24, 20], [48, 20], [24, 48], [48, 48], [30, 8], [42, 8]]) lamps.push({ x, z });
  const gate: PortalSpec = { key: 'D', dir: 'N', m: -1, c: 36, up: false, axis: 'z' };
  return {
    seed, village: true, name: 'Gridholm', spawn: [36.5, 0, 50.5], ops: [...ops, ...late, ...stairOpsFor('N', -1, 36, false)],
    portals: [gate], buildings, trees, lamps, well: { x: 36, z: 37 },
  };
}
