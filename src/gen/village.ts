// Village generator (Gridholm and the other villages of the planet). Pure and deterministic from a seed.
import { rng, rangeInt, hash, DIRV, type Dir } from '../core/rng';
import { translateOps, type Op } from '../core/voxel';
import { VILLAGE_RECT, type Rect } from './regions';

export type Role = 'innkeeper' | 'elder' | 'blacksmith' | 'merchant' | 'grocer' | 'house';
export interface P3 { x: number; y: number; z: number }
export interface Building {
  name: string; role: Role; x: number; z: number; w: number; d: number; h: number;
  side: Dir; out: [number, number]; door: P3; home?: P3;
  /** Timber walls (world boxes [x0, y0, z0, x1, y1, z1]): thin walls on the footprint's edge, a doorway in the door
   *  side. They collide through world/houses.ts, not as voxels (voxels are 1 m thick). */
  walls: number[][];
  /** Furniture inside (world x/z, standing on the floor; drawn and collided by world/houses.ts). */
  furniture: Furn[];
  /** The hero's own house (Gridholm only). */
  mine?: boolean;
}
/** Inside the hero's house: the bed (its head end against the wall, `yaw` the way you face stepping out of it) and the chest. */
export interface HomeFurniture { bed: { x0: number; z0: number; x1: number; z1: number; side: { x: number; z: number } }; chest: { x: number; z: number } }
/** A gap in the village wall. (x, z) is the point just outside, where the road starts. */
export interface Gate { dir: Dir; x: number; z: number; w: number; /** First cell of the opening along the wall, and the wall cell across it. */ a: number; m: number }
/** Guard tower footprint (world), standing on the plaza floor (a stone tower, or a watch platform on stilts). */
export interface Tower { x: number; z: number; w: number; d: number; h: number; ladder?: Ladder }
/**
 * The ladder up a tower: its foot on the face towards the plaza (world x/z, on the face's plane), the face's
 * outward normal (nx, nz: axis-aligned, pointing at the climber), and the height of the floor at the top above the
 * plaza (`top`); `deck` is the rect you stand on up there and `stilts` marks a watch platform (no voxels under it).
 */
export interface Ladder { x: number; z: number; nx: number; nz: number; top: number; deck: Rect; stilts: boolean }
/** A straight run of fence along the wall line (world, the line's middle), between corners and gates. */
export interface FenceRun { x0: number; z0: number; x1: number; z1: number }
/**
 * How well a village is walled. Every village starts at tier 0: a makeshift stake fence, low and flimsy, with watch
 * platforms on stilts at the corners. Fortifying the villages will raise it (a timber palisade, then a stone wall
 * with towers and battlements). `h` is the height of the wall (m), `gate` the top of the gate frame.
 */
export const WALL_TIERS = [
  { name: 'Stake Fence', h: 2, gate: 3.6, tower: 4.5 },
  { name: 'Timber Palisade', h: 4, gate: 5, tower: 6.5 },
  { name: 'Stone Wall', h: 7, gate: 4, tower: 10 },
] as const;
/** The first tier built of stone (voxel walls drawn as they are); below it the wall is a fence drawn by world/level.ts. */
export const STONE_TIER = 2;
export interface VillageMap {
  seed: number; village: true; name: string;
  /** Gridholm, the starting village: the only one with the notice board and Kuba's vehicle yard (for now). */
  home: boolean;
  /** World offset of the local layout, and the plaza floor height. */
  ox: number; oz: number; y: number;
  rect: Rect;
  spawn: [number, number, number];
  ops: Op[];
  gates: Gate[];
  towers: Tower[];
  /** The wall's tier (WALL_TIERS) and height; below STONE_TIER its voxels only collide (`shown` leaves them out)
   *  and the fence is drawn along `fence`. */
  tier: number; wallH: number; fence: FenceRun[];
  /** The ops to draw as voxels (all of `ops` but the fence). */
  shown: Op[];
  /** The map board on the plaza (every village): a map of the surroundings (world x/z; faces south). */
  mapBoard: { x: number; z: number };
  /** The notice board on the plaza (world x/z; it faces south, towards the spawn). */
  board: { x: number; z: number };
  buildings: Building[];
  /** The hero's house furniture (world), in Gridholm only. */
  house: HomeFurniture | null;
  trees: { x: number; z: number; h: number }[];
  lamps: { x: number; z: number }[];
  well: { x: number; z: number };
  /** Walkable plaza cells for strolling villagers (world x, z). */
  walk: [number, number][];
}

/**
 * Village houses are timber-framed, like a player's base (data/building.ts): walls `thick` m on the edge of the
 * footprint, `wall` m high (the building's h), a doorway `doorW` x `doorH` in the middle of the door side, and a
 * gabled roof `rise` m high over the longer side with an `eave` overhang (drawn by world/houses.ts).
 */
export const HOUSE = { thick: 0.25, doorW: 1.4, doorH: 2.3, eave: 0.55, rise: 0.42 };
/** Furniture of the village houses: `n` is the way into the room from the back wall (the side the piece faces). */
export type FurnKind = 'counter' | 'table' | 'bench' | 'stool' | 'shelf' | 'barrel' | 'crate' | 'sack' | 'anvil' | 'hearth' | 'bed' | 'desk';
export interface Furn { k: FurnKind; x0: number; z0: number; x1: number; z1: number; h: number; n: [number, number] }
/** Pieces you walk round (stools you walk past; they are small). */
export const furnSolid = (k: FurnKind) => k !== 'stool';
/** The plaza is 72 x 72 m inside a 7 m wall; the footprint (with a 1 m apron) is VILLAGE_RECT around the origin. */
export const VILLAGE_OFFSET = { x: -36, z: -36 };
const GATE_H = 4;
/** Gate openings in local plaza coordinates: [dir, first cell, width]. Each lines up with a gap between buildings. */
const GATE_SLOTS: Record<Dir, number> = { N: 34, S: 39, E: 35, W: 37 };

/**
 * The shape of a village's wall: a square, a hexagon, an octagon or a dodecagon (Gridholm stays square). All fit the
 * same footprint: the octagon and the dodecagon keep the square's flat sides north, east, south and west (so their
 * gates are where a square village has them) and cut its corners; the hexagon has flat sides only to the north and
 * south, so it only has gates there.
 */
export type Sides = 4 | 6 | 8 | 12;
export const villageSides = (seed: number, home = false): Sides => (home ? 4 : ([4, 6, 8, 12] as const)[hash(seed, 0x5ade) % 4]);
const PC = 36;
/** The wall's corners (plaza coordinates, clockwise from the north-west), on its middle line. */
export function wallPolygon(sides: Sides): [number, number][] {
  const R = sides === 6 ? 36.5 : 36.5 / Math.cos(Math.PI / sides), out: [number, number][] = [];
  for (let k = 0; k < sides; k++) { const th = -Math.PI / sides + (2 * Math.PI * k) / sides; out.push([PC + R * Math.sin(th), PC - R * Math.cos(th)]); }
  return out;
}
/** Distance from the flat north (south) side to the plaza's middle. */
const apothem = (sides: Sides) => (sides === 6 ? 36.5 * Math.cos(Math.PI / 6) : 36.5);
/** Is (x, z) inside the wall polygon, at least `m` metres in from its middle line? */
export function insideWall(poly: [number, number][], x: number, z: number, m = 0): boolean {
  for (let i = 0; i < poly.length; i++) {
    const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % poly.length];
    let nx = bz - az, nz = -(bx - ax); const L = Math.hypot(nx, nz); nx /= L; nz /= L;
    if (nx * (ax - PC) + nz * (az - PC) < 0) { nx = -nx; nz = -nz; } // point outward
    if (nx * (x - ax) + nz * (z - az) > -m) return false;
  }
  return true;
}
/** Which gates a village has: always the north one, plus 1–3 more chosen from the seed (a hexagon: north and south). */
export function villageGates(seed: number, home = false): Dir[] {
  const R = rng(seed ^ 0x6a7e5), n = 2 + Math.floor(R() * 3), rest: Dir[] = ['E', 'S', 'W'];
  for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
  const g: Dir[] = ['N', ...rest.slice(0, n - 1)];
  return villageSides(seed, home) === 6 ? ['N', 'S'] : g;
}

/** A village centred at (cx, cz) (even whole metres) on a plaza at height y. */
export function generateVillage(seed: number, y = 0, cx = 0, cz = 0, name = 'Gridholm', home = true, tier = 0): VillageMap {
  const R = rng(seed ^ 0x51ab7), ri = rangeInt(R);
  const PW = 72, PD = 72, ops: Op[] = [], late: Op[] = [];
  const T = WALL_TIERS[Math.max(0, Math.min(WALL_TIERS.length - 1, tier))], stone = tier >= STONE_TIER, WALL_H = T.h, TOWER_H = T.tower;
  const sides = villageSides(seed, home), poly = wallPolygon(sides), square = sides === 4;
  // wall ring around the plaza (a square: four straight runs; any other shape: the polygon's edges as cells), then the gate openings
  if (square) ops.push({ op: 'solid', x: -1, y: 0, z: -1, w: PW + 2, h: WALL_H, d: 1 }, { op: 'solid', x: -1, y: 0, z: PD, w: PW + 2, h: WALL_H, d: 1 },
    { op: 'solid', x: -1, y: 0, z: 0, w: 1, h: WALL_H, d: PD }, { op: 'solid', x: PW, y: 0, z: 0, w: 1, h: WALL_H, d: PD });
  else ops.push(...ringOps(poly, WALL_H));
  const gateDirs = villageGates(seed, home), GW = 4, gates: Gate[] = [];
  const zN = Math.floor(PC - apothem(sides)), zS = Math.floor(PC + apothem(sides)); // the rows of the north and south walls
  for (const dir of gateDirs) {
    const s = GATE_SLOTS[dir];
    if (dir === 'N') { ops.push({ op: 'room', x: s, y: 0, z: zN, w: GW, h: GATE_H, d: 1 }); gates.push({ dir, x: s + GW / 2, z: zN - 1, w: GW, a: s, m: zN }); }
    if (dir === 'S') { ops.push({ op: 'room', x: s, y: 0, z: zS, w: GW, h: GATE_H, d: 1 }); gates.push({ dir, x: s + GW / 2, z: zS + 2, w: GW, a: s, m: zS }); }
    if (dir === 'W') { ops.push({ op: 'room', x: -1, y: 0, z: s, w: 1, h: GATE_H, d: GW }); gates.push({ dir, x: -2, z: s + GW / 2, w: GW, a: s, m: -1 }); }
    if (dir === 'E') { ops.push({ op: 'room', x: PW, y: 0, z: s, w: 1, h: GATE_H, d: GW }); gates.push({ dir, x: PW + 2, z: s + GW / 2, w: GW, a: s, m: PW }); }
  }
  const fenceOps = new Set(ops);
  // Guard towers: one on every corner of the wall and a pair flanking each gate (a fence has watch platforms on the
  // corners only, standing on stilts inside the corner: drawn, not solid)
  // the corners that carry a tower: every corner, but only every other one of a dodecagon, none right by a gate
  const corners = poly.filter((_, k) => sides !== 12 || k % 2 === 1).filter(([vx, vz]) => !gates.some((g) => Math.hypot(g.x - vx, g.z - vz) < 8));
  if (!stone) {
    const towers: Tower[] = square ? [{ x: 0, z: 0, w: 3, d: 3, h: TOWER_H }, { x: PW - 3, z: 0, w: 3, d: 3, h: TOWER_H }, { x: 0, z: PD - 3, w: 3, d: 3, h: TOWER_H }, { x: PW - 3, z: PD - 3, w: 3, d: 3, h: TOWER_H }]
      : corners.map(([vx, vz]) => { const d = Math.hypot(PC - vx, PC - vz), cx = vx + (PC - vx) / d * 3.6, cz = vz + (PC - vz) / d * 3.6; return { x: Math.round(cx - 1.5), z: Math.round(cz - 1.5), w: 3, d: 3, h: TOWER_H }; });
    return finish(towers);
  }
  const towers: Tower[] = square ? [
    { x: -2, z: -2, w: 4, d: 4, h: TOWER_H }, { x: PW - 2, z: -2, w: 4, d: 4, h: TOWER_H },
    { x: -2, z: PD - 2, w: 4, d: 4, h: TOWER_H }, { x: PW - 2, z: PD - 2, w: 4, d: 4, h: TOWER_H },
  ] : corners.map(([vx, vz]) => ({ x: Math.round(vx - 2), z: Math.round(vz - 2), w: 4, d: 4, h: TOWER_H }));
  for (const g of gates) {
    const along = g.dir === 'N' || g.dir === 'S', m0 = g.m - 1;
    for (const a0 of [g.a - 3, g.a + GW]) towers.push(along ? { x: a0, z: m0, w: 3, d: 3, h: TOWER_H - 1 } : { x: m0, z: a0, w: 3, d: 3, h: TOWER_H - 1 });
  }
  // Battlements every 4 m along the top of the wall, and buttresses on its outer face every 12 m (a square wall);
  // a polygon's wall gets merlons on every other pair of cells
  if (!square) {
    for (const o of ringOps(poly, 1)) for (let x = o.x; x < o.x + o.w; x++) if ((x + o.z) % 4 < 2 && !gates.some((g) => Math.hypot(g.x - x, g.z - o.z) < 4)) ops.push({ op: 'solid', x, y: WALL_H, z: o.z, w: 1, h: 1, d: 1 });
    for (const t of towers) ops.push({ op: 'solid', x: t.x, y: 0, z: t.z, w: t.w, h: t.h, d: t.d });
    return finish(towers);
  }
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
  return finish(towers);

  function finish(towers: Tower[]): VillageMap {
  const buildings: Building[] = [], trees: { x: number; z: number; h: number }[] = [], lamps: { x: number; z: number }[] = [];
  const B = (name: string, role: Role, x: number, z: number, w: number, d: number, side: Dir, h = 3.2) => {
    const cxm = x + (w >> 1), czm = z + (d >> 1), t = HOUSE.thick, dh = HOUSE.doorW / 2;
    // four thin walls on the footprint's edge; the door side is two pieces and a lintel over the doorway
    const walls: number[][] = [], dc = side === 'E' || side === 'W' ? czm + 0.5 : cxm + 0.5;
    const wall = (x0: number, z0: number, x1: number, z1: number, door: boolean) => {
      if (!door) { walls.push([x0, 0, z0, x1, h, z1]); return; }
      if (x1 - x0 > z1 - z0) walls.push([x0, 0, z0, dc - dh, h, z1], [dc + dh, 0, z0, x1, h, z1], [dc - dh, HOUSE.doorH, z0, dc + dh, h, z1]);
      else walls.push([x0, 0, z0, x1, h, dc - dh], [x0, 0, dc + dh, x1, h, z1], [x0, HOUSE.doorH, dc - dh, x1, h, dc + dh]);
    };
    wall(x, z, x + w, z + t, side === 'N'); wall(x, z + d - t, x + w, z + d, side === 'S');
    wall(x, z + t, x + t, z + d - t, side === 'W'); wall(x + w - t, z + t, x + w, z + d - t, side === 'E');
    const door = side === 'E' ? { x: x + w - t / 2, y: 0, z: dc } : side === 'W' ? { x: x + t / 2, y: 0, z: dc } : side === 'N' ? { x: dc, y: 0, z: z + t / 2 } : { x: dc, y: 0, z: z + d - t / 2 };
    // furniture, laid out in the building's own frame: u from the back wall towards the door, v across it
    const D = side === 'E' || side === 'W' ? w : d, V = side === 'E' || side === 'W' ? d : w, vd = side === 'E' || side === 'W' ? dc - z : dc - x;
    const n: [number, number] = side === 'E' ? [1, 0] : side === 'W' ? [-1, 0] : side === 'N' ? [0, -1] : [0, 1];
    const at = (u: number, v: number): [number, number] => (side === 'E' ? [x + u, z + v] : side === 'W' ? [x + w - u, z + v] : side === 'N' ? [x + v, z + d - u] : [x + v, z + u]);
    const F = (k: FurnKind, u0: number, v0: number, u1: number, v1: number, h: number) => {
      const [ax, az] = at(u0, v0), [bx, bz] = at(u1, v1);
      b.furniture.push({ k, x0: Math.min(ax, bx), z0: Math.min(az, bz), x1: Math.max(ax, bx), z1: Math.max(az, bz), h, n });
    };
    const b: Building = { name, role, x, z, w, d, h, side, out: DIRV[side], door, walls, furniture: [] };
    if (role !== 'house') {
      const [hx, hz] = at(2.5, vd); b.home = { x: hx, y: 0, z: hz }; // the keeper, behind the counter (or the Elder's desk)
      if (role !== 'elder') { F('counter', 3.1, 1.6, 3.75, V - 1.6, 1.05); F('shelf', 0.25, 1.2, 0.6, V - 1.2, 2.1); }
    }
    if (role === 'innkeeper') { // tables with a bench either side, away from the counter and the way in; barrels behind the bar
      const skip = ri(0, 4);
      [[6, 2.3], [9.5, 2.3], [6, V - 2.3], [9.5, V - 2.3]].forEach(([u, v], i) => {
        if (i === skip || u + 0.9 > D - 0.5) return;
        F('table', u - 0.7, v - 0.45, u + 0.7, v + 0.45, 0.78); F('bench', u - 0.7, v - 1.2, u + 0.7, v - 0.85, 0.45); F('bench', u - 0.7, v + 0.85, u + 0.7, v + 1.2, 0.45);
      });
      F('barrel', 0.8, 0.35, 1.45, 1.0, 1.0); F('barrel', 0.8, V - 1.0, 1.45, V - 0.35, 1.0);
    }
    if (role === 'blacksmith') { // the hearth in the back corner, an anvil and a quenching barrel on the customers' side
      F('hearth', 0.25, 0.25, 1.6, 1.5, 1.0); F('anvil', 5.4, 1.1, 6.2, 1.5, 0.8); F('barrel', 5.2, V - 1.3, 5.9, V - 0.6, 0.8); F('crate', 7.2, 0.35, 8.1, 1.2, 0.8);
    }
    if (role === 'merchant') { F('crate', 5, 0.35, 5.9, 1.25, 0.9); F('crate', 6.1, 0.35, 6.9, 1.15, 0.7); F('barrel', 5.2, V - 1.1, 5.9, V - 0.4, 0.95); }
    if (role === 'grocer') { F('sack', 4.6, 0.35, 5.3, 0.95, 0.7); F('sack', 5.5, 0.35, 6.2, 0.95, 0.6); F('barrel', 4.8, V - 1.1, 5.5, V - 0.4, 0.9); }
    if (role === 'elder') { // a desk before him, two chairs for visitors, benches along the walls, books behind
      F('desk', 3.2, vd - 1, 4.1, vd + 1, 0.8); F('stool', 4.5, vd - 0.75, 4.95, vd - 0.3, 0.46); F('stool', 4.5, vd + 0.3, 4.95, vd + 0.75, 0.46);
      F('bench', 5.2, 0.3, D - 1.8, 0.65, 0.45); F('bench', 5.2, V - 0.65, D - 1.8, V - 0.3, 0.45); F('shelf', 0.25, 0.9, 0.6, vd - 1, 2.2); F('shelf', 0.25, vd + 1, 0.6, V - 0.9, 2.2);
    }
    if (role === 'house') { // a bed by the back wall, a table with two stools, a shelf
      F('bed', 0.3, 0.4, 1.3, 2.4, 0.5); F('shelf', 0.25, 3.2, 0.55, 4.8, 1.8);
      F('table', 2.5, V - 2.6, 3.4, V - 1.6, 0.76); F('stool', 1.9, V - 2.35, 2.3, V - 1.95, 0.45); F('stool', 3.6, V - 2.35, 4.0, V - 1.95, 0.45);
    }
    buildings.push(b); return b;
  };
  const j = () => ri(-1, 1);
  let house: HomeFurniture | null = null;
  if (!square) ringLayout(); else {
  B('TAVERN', 'innkeeper', 3, 6 + j(), 13, 10, 'E', 3.6);
  B("ELDER'S HALL", 'elder', 3, 24 + j(), 11, 9, 'E', 3.4);
  const hz = 42 + j(), mine = B(home ? 'YOUR HOUSE' : '', 'house', 4, hz, 8, 7, 'E');
  // in Gridholm that house is the hero's: a bed along the back wall in the far corner and a chest in the near one
  if (home) {
    mine.mine = true;
    const x0 = 4 + HOUSE.thick, z0 = hz + HOUSE.thick, z1 = hz + 7 - HOUSE.thick; // the inside
    // the hero's house: your own bed and chest, a table by the window instead of the usual furniture
    mine.furniture = [
      { k: 'table', x0: x0 + 4.4, z0: z0 + 0.25, x1: x0 + 5.3, z1: z0 + 1.1, h: 0.76, n: [0, 1] },
      { k: 'stool', x0: x0 + 4.65, z0: z0 + 1.4, x1: x0 + 5.05, z1: z0 + 1.8, h: 0.45, n: [0, 1] },
      { k: 'shelf', x0: x0 + 2.3, z0, x1: x0 + 3.8, z1: z0 + 0.3, h: 1.8, n: [0, 1] },
    ];
    house = { bed: { x0: x0 + 0.25, z0: z0 + 0.1, x1: x0 + 1.45, z1: z0 + 2.3, side: { x: x0 + 2.4, z: z0 + 1.2 } }, chest: { x: x0 + 0.85, z: z1 - 0.5 } };
  }
  B('BLACKSMITH', 'blacksmith', 58, 6 + j(), 11, 9, 'W', 3.4);
  B('GENERAL STORE', 'merchant', 58, 23 + j(), 11, 9, 'W', 3.4);
  B('FOOD & PROVISIONS', 'grocer', 60, 40 + j(), 9, 8, 'W');
  for (const hx of [4, 15, 26, 47, 58]) B('', 'house', hx + j(), 61 + j(), 8, 6, 'N', 3);
  }
  /**
   * The buildings of a village that is not square: round the plaza, each facing its middle, pushed out as far as
   * the wall allows, clear of the middle (well, boards) and of the lanes from the gates.
   */
  function ringLayout() {
    const lanes = gates.map((g) => g.dir === 'N' ? [32, 0, 40, 36] : g.dir === 'S' ? [37, 36, 45, 72] : g.dir === 'W' ? [0, 35, 36, 43] : [36, 33, 72, 41]);
    const angles = Array.from({ length: 36 }, (_, i) => i * 10 + ri(-3, 3)).sort(() => R() - 0.5);
    const place = (name: string, role: Role, depth: number, width: number, h: number) => {
      for (const deg of angles) {
        const a = deg * Math.PI / 180, dx = Math.cos(a), dz = Math.sin(a), ew = Math.abs(dx) >= Math.abs(dz);
        const side: Dir = ew ? (dx > 0 ? 'W' : 'E') : (dz > 0 ? 'N' : 'S'), w = ew ? depth : width, d = ew ? width : depth;
        for (let r = 42; r >= 14; r--) {
          const x = Math.round(PC + dx * r - w / 2), z = Math.round(PC + dz * r - d / 2);
          if (![[x, z], [x + w, z], [x, z + d], [x + w, z + d]].every(([px, pz]) => insideWall(poly, px, pz, 2.5))) continue;
          const near = Math.hypot(Math.max(x - PC, 0, PC - x - w), Math.max(z - 41, 0, 41 - z - d)); // the middle: well, boards, spawn
          if (near < 12) break;
          if (lanes.some(([a0, b0, a1, b1]) => x < a1 && x + w > a0 && z < b1 && z + d > b0)) continue;
          if (buildings.some((o) => x < o.x + o.w + 2 && x + w + 2 > o.x && z < o.z + o.d + 2 && z + d + 2 > o.z)) continue;
          if (towers.some((t) => x < t.x + t.w + 3 && x + w + 3 > t.x && z < t.z + t.d + 3 && z + d + 3 > t.z)) continue; // room to reach the ladders
          return B(name, role, x, z, w, d, side, h);
        }
      }
      return null;
    };
    place('TAVERN', 'innkeeper', 13, 10, 3.6); place("ELDER'S HALL", 'elder', 11, 9, 3.4);
    place('BLACKSMITH', 'blacksmith', 11, 9, 3.4); place('GENERAL STORE', 'merchant', 11, 9, 3.4); place('FOOD & PROVISIONS', 'grocer', 9, 8, 3.2);
    for (let i = 0; i < 6; i++) place('', 'house', 6, 8, 3);
  }
  // well, trees, lamps
  late.push({ op: 'solid', x: 35, y: 0, z: 36, w: 2, h: 1, d: 2 });
  const blocked = (x: number, z: number, m: number) => !insideWall(poly, x + 0.5, z + 0.5, m + 1) || towers.some((t) => x >= t.x - 3 && x < t.x + t.w + 3 && z >= t.z - 3 && z < t.z + t.d + 3) || buildings.some((b) => x >= b.x - m && x < b.x + b.w + m && z >= b.z - m && z < b.z + b.d + m)
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
    if (!insideWall(poly, x + 0.5, z + 0.5, 2)) continue;
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
    towers: towers.map((t) => {
      const l = square ? ladderOf(t, stone, PW, PD) : ladderIn(t, stone);
      return { ...t, x: t.x + ox, z: t.z + oz, ladder: { ...l, x: l.x + ox, z: l.z + oz, deck: { x0: l.deck.x0 + ox, z0: l.deck.z0 + oz, x1: l.deck.x1 + ox, z1: l.deck.z1 + oz } } };
    }),
    board: { x: 41 + ox, z: 45 + oz }, mapBoard: { x: 31 + ox, z: 45 + oz },
    buildings: buildings.map((b) => ({ ...b, x: b.x + ox, z: b.z + oz, door: P(b.door), home: b.home && P(b.home),
      walls: b.walls.map(([x0, y0, z0, x1, y1, z1]) => [x0 + ox, y0 + y, z0 + oz, x1 + ox, y1 + y, z1 + oz]),
      furniture: b.furniture.map((f) => ({ ...f, x0: f.x0 + ox, z0: f.z0 + oz, x1: f.x1 + ox, z1: f.z1 + oz })) })),
    house: house && { bed: { x0: house.bed.x0 + ox, z0: house.bed.z0 + oz, x1: house.bed.x1 + ox, z1: house.bed.z1 + oz, side: { x: house.bed.side.x + ox, z: house.bed.side.z + oz } },
      chest: { x: house.chest.x + ox, z: house.chest.z + oz } },
    trees: trees.map((t) => ({ ...t, x: t.x + ox, z: t.z + oz })), lamps: lamps.map((l) => ({ x: l.x + ox, z: l.z + oz })),
    well: { x: 36 + ox, z: 37 + oz }, walk: walk.map(([x, z]) => [x + ox, z + oz]),
    tier, wallH: WALL_H, fence: stone ? [] : fenceRuns().map((r) => ({ x0: r.x0 + ox, z0: r.z0 + oz, x1: r.x1 + ox, z1: r.z1 + oz })),
    shown: translateOps(stone ? all : all.filter((o) => !fenceOps.has(o)), ox, y, oz),
  };
  }
  /** The fence along the wall's middle line, broken at the gates (plaza coordinates). */
  function fenceRuns(): FenceRun[] {
    if (!square) { // along the polygon's edges, broken at the gates on the flat north / south / east / west sides
      const out: FenceRun[] = [];
      for (let i = 0; i < poly.length; i++) {
        const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % poly.length];
        const horiz = Math.abs(az - bz) < 0.01, vert = Math.abs(ax - bx) < 0.01;
        const cuts = gates.filter((g) => (horiz && (g.dir === 'N' || g.dir === 'S') && Math.abs(g.m + 0.5 - az) < 1.5) || (vert && (g.dir === 'E' || g.dir === 'W') && Math.abs(g.m + 0.5 - ax) < 1.5))
          .map((g) => [g.a, g.a + GW]);
        if (!cuts.length) { out.push({ x0: ax, z0: az, x1: bx, z1: bz }); continue; }
        // walk the edge from a to b, skipping the openings
        const along = horiz ? [ax, bx] : [az, bz], dir = Math.sign(along[1] - along[0]), P = (t: number): [number, number] => (horiz ? [t, az] : [ax, t]);
        const cs = cuts.map(([c0, c1]) => (dir > 0 ? [c0, c1] : [c1, c0])).sort((p, q) => dir * (p[0] - q[0]));
        let t = along[0];
        for (const [c0, c1] of [...cs, [along[1], along[1]]]) {
          if (dir * (c0 - t) > 0) { const [x0, z0] = P(t), [x1, z1] = P(c0); out.push({ x0, z0, x1, z1 }); }
          t = c1;
        }
      }
      return out;
    }
    const out: FenceRun[] = [], lo = -1, hi = PW + 1, sides: [Dir, (a: number) => [number, number]][] = [
      ['N', (a) => [a, -0.5]], ['S', (a) => [a, PD + 0.5]], ['W', (a) => [-0.5, a]], ['E', (a) => [PW + 0.5, a]]];
    for (const [dir, P] of sides) {
      const cuts = gates.filter((g) => g.dir === dir).map((g) => [g.a, g.a + GW]).sort((p, q) => p[0] - q[0]);
      let a = dir === 'N' || dir === 'S' ? lo : 0;
      const end = dir === 'N' || dir === 'S' ? hi : PD;
      for (const [c0, c1] of [...cuts, [end, end]]) {
        if (c0 > a) { const [x0, z0] = P(a), [x1, z1] = P(c0); out.push({ x0, z0, x1, z1 }); }
        a = c1;
      }
    }
    return out;
  }
}

/** The wall of a polygon as voxel runs: every cell its middle line passes through (kept 4-connected), `h` high. */
function ringOps(poly: [number, number][], h: number): Op[] {
  const cells = new Set<string>();
  for (let i = 0; i < poly.length; i++) {
    const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % poly.length], L = Math.hypot(bx - ax, bz - az);
    let px = Math.floor(ax), pz = Math.floor(az);
    for (let t = 0; t <= L; t += 0.2) {
      const cx = Math.floor(ax + (bx - ax) * t / L), cz = Math.floor(az + (bz - az) * t / L);
      if (cx !== px && cz !== pz) cells.add(cx + ',' + pz); // no diagonal gaps
      cells.add(cx + ',' + cz); px = cx; pz = cz;
    }
  }
  const rows = new Map<number, number[]>();
  for (const k of cells) { const [x, z] = k.split(',').map(Number); (rows.get(z) ?? rows.set(z, []).get(z)!).push(x); }
  const ops: Op[] = [];
  for (const [z, xs] of rows) {
    xs.sort((a, b) => a - b);
    let s0 = xs[0], prev = xs[0];
    for (const x of [...xs.slice(1), Infinity]) { if (x !== prev + 1) { ops.push({ op: 'solid', x: s0, y: 0, z, w: prev - s0 + 1, h, d: 1 }); s0 = x; } prev = x; }
  }
  return ops;
}
/** A ladder for a tower of a polygon wall: on the face towards the plaza's middle (along the stronger axis). */
function ladderIn(t: Tower, stone: boolean): Ladder {
  const pad = stone ? 0 : 0.3, cx = t.x + t.w / 2, cz = t.z + t.d / 2, top = t.h + (stone ? 0 : 0.2);
  const deck = { x0: t.x - pad, z0: t.z - pad, x1: t.x + t.w + pad, z1: t.z + t.d + pad };
  // towards the inner end of the face: a corner tower straddles the wall, which runs out through its middle
  const off = (d: number, half: number) => Math.sign(d) * Math.max(0, half - 0.75);
  if (Math.abs(PC - cz) >= Math.abs(PC - cx)) { const n = PC > cz ? 1 : -1; return { x: cx + off(PC - cx, t.w / 2), z: n > 0 ? deck.z1 : deck.z0, nx: 0, nz: n, top, deck, stilts: !stone }; }
  const n = PC > cx ? 1 : -1;
  return { x: n > 0 ? deck.x1 : deck.x0, z: cz + off(PC - cz, t.d / 2), nx: n, nz: 0, top, deck, stilts: !stone };
}
/**
 * Where a tower's ladder goes (plaza coordinates): on the face that looks into the village, over the part of it that
 * stands inside the wall. Corner towers and the towers by the north and south gates take it on their north/south
 * face, those by the west and east gates on their west/east face. A watch platform's deck overhangs its stilts by
 * 0.3 m, so its ladder stands at the deck's edge.
 */
export function ladderOf(t: Tower, stone: boolean, PW: number, PD: number): Ladder {
  const pad = stone ? 0 : 0.3, cx = t.x + t.w / 2, cz = t.z + t.d / 2, top = t.h + (stone ? 0 : 0.2);
  const deck = { x0: t.x - pad, z0: t.z - pad, x1: t.x + t.w + pad, z1: t.z + t.d + pad };
  if (cz < 3 || cz > PD - 3) {
    const n = cz < PD / 2 ? 1 : -1, lo = Math.max(t.x, 0), hi = Math.min(t.x + t.w, PW);
    return { x: (lo + hi) / 2, z: n > 0 ? deck.z1 : deck.z0, nx: 0, nz: n, top, deck, stilts: !stone };
  }
  const n = cx < PW / 2 ? 1 : -1, lo = Math.max(t.z, 0), hi = Math.min(t.z + t.d, PD);
  return { x: n > 0 ? deck.x1 : deck.x0, z: (lo + hi) / 2, nx: n, nz: 0, top, deck, stilts: !stone };
}
