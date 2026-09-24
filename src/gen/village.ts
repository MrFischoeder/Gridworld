// Village generator (Gridholm and the other villages of the planet). Pure and deterministic from a seed.
import { rng, rangeInt, DIRV, type Dir } from '../core/rng';
import { translateOps, type Op } from '../core/voxel';
import { VILLAGE_RECT, type Rect } from './regions';

export type Role = 'innkeeper' | 'elder' | 'blacksmith' | 'merchant' | 'grocer' | 'house';
export interface P3 { x: number; y: number; z: number }
export interface Building {
  name: string; role: Role; x: number; z: number; w: number; d: number; h: number;
  side: Dir; out: [number, number]; door: P3; home?: P3;
}
/** A gap in the village wall. (x, z) is the point just outside, where the road starts. */
export interface Gate { dir: Dir; x: number; z: number; w: number; /** First cell of the opening along the wall, and the wall cell across it. */ a: number; m: number }
/** Guard tower footprint (world), standing on the plaza floor. */
export interface Tower { x: number; z: number; w: number; d: number; h: number }
export interface VillageMap {
  seed: number; village: true; name: string;
  /** Gridholm, the starting village: the only one with the notice board and Mirek's vehicle yard (for now). */
  home: boolean;
  /** World offset of the local layout, and the plaza floor height. */
  ox: number; oz: number; y: number;
  rect: Rect;
  spawn: [number, number, number];
  ops: Op[];
  gates: Gate[];
  towers: Tower[];
  /** The map board on the plaza (every village): a map of the surroundings (world x/z; faces south). */
  mapBoard: { x: number; z: number };
  /** The notice board on the plaza (world x/z; it faces south, towards the spawn). */
  board: { x: number; z: number };
  buildings: Building[];
  trees: { x: number; z: number; h: number }[];
  lamps: { x: number; z: number }[];
  well: { x: number; z: number };
  /** Walkable plaza cells for strolling villagers (world x, z). */
  walk: [number, number][];
}

/** The plaza is 72 x 72 m inside a 7 m wall; the footprint (with a 1 m apron) is VILLAGE_RECT around the origin. */
export const VILLAGE_OFFSET = { x: -36, z: -36 };
const WALL_H = 7, GATE_H = 4, TOWER_H = 10;
/** Gate openings in local plaza coordinates: [dir, first cell, width]. Each lines up with a gap between buildings. */
const GATE_SLOTS: Record<Dir, number> = { N: 34, S: 39, E: 35, W: 37 };

/** Which gates a village has: always the north one, plus 1–3 more chosen from the seed. */
export function villageGates(seed: number): Dir[] {
  const R = rng(seed ^ 0x6a7e5), n = 2 + Math.floor(R() * 3), rest: Dir[] = ['E', 'S', 'W'];
  for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
  return ['N', ...rest.slice(0, n - 1)];
}

/** A village centred at (cx, cz) (even whole metres) on a plaza at height y. */
export function generateVillage(seed: number, y = 0, cx = 0, cz = 0, name = 'Gridholm', home = true): VillageMap {
  const R = rng(seed ^ 0x51ab7), ri = rangeInt(R);
  const PW = 72, PD = 72, ops: Op[] = [], late: Op[] = [];
  // wall ring around the plaza, then the gate openings
  ops.push({ op: 'solid', x: -1, y: 0, z: -1, w: PW + 2, h: WALL_H, d: 1 }, { op: 'solid', x: -1, y: 0, z: PD, w: PW + 2, h: WALL_H, d: 1 },
    { op: 'solid', x: -1, y: 0, z: 0, w: 1, h: WALL_H, d: PD }, { op: 'solid', x: PW, y: 0, z: 0, w: 1, h: WALL_H, d: PD });
  const gateDirs = villageGates(seed), GW = 4, gates: Gate[] = [];
  for (const dir of gateDirs) {
    const s = GATE_SLOTS[dir];
    if (dir === 'N') { ops.push({ op: 'room', x: s, y: 0, z: -1, w: GW, h: GATE_H, d: 1 }); gates.push({ dir, x: s + GW / 2, z: -2, w: GW, a: s, m: -1 }); }
    if (dir === 'S') { ops.push({ op: 'room', x: s, y: 0, z: PD, w: GW, h: GATE_H, d: 1 }); gates.push({ dir, x: s + GW / 2, z: PD + 2, w: GW, a: s, m: PD }); }
    if (dir === 'W') { ops.push({ op: 'room', x: -1, y: 0, z: s, w: 1, h: GATE_H, d: GW }); gates.push({ dir, x: -2, z: s + GW / 2, w: GW, a: s, m: -1 }); }
    if (dir === 'E') { ops.push({ op: 'room', x: PW, y: 0, z: s, w: 1, h: GATE_H, d: GW }); gates.push({ dir, x: PW + 2, z: s + GW / 2, w: GW, a: s, m: PW }); }
  }
  // Guard towers: one on every corner of the wall and a pair flanking each gate.
  const towers: Tower[] = [
    { x: -2, z: -2, w: 4, d: 4, h: TOWER_H }, { x: PW - 2, z: -2, w: 4, d: 4, h: TOWER_H },
    { x: -2, z: PD - 2, w: 4, d: 4, h: TOWER_H }, { x: PW - 2, z: PD - 2, w: 4, d: 4, h: TOWER_H },
  ];
  for (const g of gates) {
    const along = g.dir === 'N' || g.dir === 'S', m0 = g.m === -1 ? -2 : g.m - 1;
    for (const a0 of [g.a - 3, g.a + GW]) towers.push(along ? { x: a0, z: m0, w: 3, d: 3, h: TOWER_H - 1 } : { x: m0, z: a0, w: 3, d: 3, h: TOWER_H - 1 });
  }
  // Battlements every 4 m along the top of the wall, and buttresses on its outer face every 12 m.
  for (let a = 1; a < PW - 1; a += 4) {
    ops.push({ op: 'solid', x: a, y: WALL_H, z: -1, w: 2, h: 1, d: 1 }, { op: 'solid', x: a, y: WALL_H, z: PD, w: 2, h: 1, d: 1 });
    ops.push({ op: 'solid', x: -1, y: WALL_H, z: a, w: 1, h: 1, d: 2 }, { op: 'solid', x: PW, y: WALL_H, z: a, w: 1, h: 1, d: 2 });
  }
  const nearGate = (dir: Dir, a: number) => gates.some((g) => g.dir === dir && a > g.a - 5 && a < g.a + GW + 4);
  for (let a = 6; a < PW - 4; a += 12) {
    if (!nearGate('N', a)) ops.push({ op: 'solid', x: a, y: 0, z: -2, w: 1, h: WALL_H - 2, d: 1 });
    if (!nearGate('S', a)) ops.push({ op: 'solid', x: a, y: 0, z: PD + 1, w: 1, h: WALL_H - 2, d: 1 });
    if (!nearGate('W', a)) ops.push({ op: 'solid', x: -2, y: 0, z: a, w: 1, h: WALL_H - 2, d: 1 });
    if (!nearGate('E', a)) ops.push({ op: 'solid', x: PW + 1, y: 0, z: a, w: 1, h: WALL_H - 2, d: 1 });
  }
  for (const t of towers) ops.push({ op: 'solid', x: t.x, y: 0, z: t.z, w: t.w, h: t.h, d: t.d });
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
    || (Math.abs(x - 41) < 4 && Math.abs(z - 45) < 3) || (Math.abs(x - 31) < 4 && Math.abs(z - 45) < 3)
    || (Math.abs(x - 36) < 5 && z < 10) || (Math.abs(x - 36) < 4 && Math.abs(z - 37) < 4) || (Math.abs(x - 36) < 3 && Math.abs(z - 50) < 3)
    || gates.some((g) => Math.abs(x - Math.min(Math.max(g.x, 1), PW - 2)) < 5 && Math.abs(z - Math.min(Math.max(g.z, 1), PD - 2)) < 5);
  for (let n = 0; n < 200 && trees.length < 12; n++) {
    const x = ri(2, 69), z = ri(2, 69);
    if (blocked(x, z, 3) || trees.some((t) => Math.abs(t.x - x) + Math.abs(t.z - z) < 5)) continue;
    trees.push({ x, z, h: ri(4, 6) }); late.push({ op: 'solid', x, y: 0, z, w: 1, h: 2, d: 1 });
  }
  for (const [x, z] of [[24, 20], [48, 20], [24, 48], [48, 48], [30, 8], [42, 8]]) lamps.push({ x, z });
  const all = [...ops, ...late];
  const walk: [number, number][] = [];
  const solidAt = (x: number, z: number) => all.some((o) => o.op === 'solid' && o.y === 0 && x >= o.x && x < o.x + o.w && z >= o.z && z < o.z + o.d);
  for (let x = 2; x < 70; x++) for (let z = 4; z < 70; z++) {
    if (buildings.some((b) => x >= b.x - 1 && x < b.x + b.w + 1 && z >= b.z - 1 && z < b.z + b.d + 1)) continue;
    if (!solidAt(x, z)) walk.push([x, z]);
  }
  // Everything above was laid out in plaza coordinates; move it into the world.
  const ox = VILLAGE_OFFSET.x + cx, oz = VILLAGE_OFFSET.z + cz, P = (p: P3): P3 => ({ x: p.x + ox, y: p.y + y, z: p.z + oz });
  return {
    seed, village: true, name, home, ox, oz, y, rect: { x0: VILLAGE_RECT.x0 + cx, z0: VILLAGE_RECT.z0 + cz, x1: VILLAGE_RECT.x1 + cx, z1: VILLAGE_RECT.z1 + cz },
    spawn: [36.5 + ox, y, 50.5 + oz], ops: translateOps(all, ox, y, oz),
    gates: gates.map((g) => (g.dir === 'N' || g.dir === 'S'
      ? { ...g, x: g.x + ox, z: g.z + oz, a: g.a + ox, m: g.m + oz } : { ...g, x: g.x + ox, z: g.z + oz, a: g.a + oz, m: g.m + ox })),
    towers: towers.map((t) => ({ ...t, x: t.x + ox, z: t.z + oz })),
    board: { x: 41 + ox, z: 45 + oz }, mapBoard: { x: 31 + ox, z: 45 + oz },
    buildings: buildings.map((b) => ({ ...b, x: b.x + ox, z: b.z + oz, door: P(b.door), home: b.home && P(b.home) })),
    trees: trees.map((t) => ({ ...t, x: t.x + ox, z: t.z + oz })), lamps: lamps.map((l) => ({ x: l.x + ox, z: l.z + oz })),
    well: { x: 36 + ox, z: 37 + oz }, walk: walk.map(([x, z]) => [x + ox, z + oz]),
  };
}
