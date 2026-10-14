// (0.207) The map editor's files (editor.html, src/editor/): what the owner draws by hand, kept as plain JSON so the
// big game can read them later. Three kinds:
//  - 'dungeon': a hand-made underground level in one of the game's three styles (ancient ruin, crashed ship, metro),
//    built from kit pieces (rooms, halls, corridors, station halls, tunnels, blockages...) and markers (the way in and
//    out, chests, crystals, a boss, guards, doors). `expandDungeon` turns it into the game's own DungeonMap (the
//    ordered voxel op list and the rest), which the game can load and play (world/custommaps.ts).
//  - 'world': a planet drawn by hand: a height grid (land, sea, mountains), rivers, deposits and places. Kept for the
//    game to grow into (stage E2 of PLAN_EDYTORA.md); the editor can start one from a real seed's land.
//  - 'village': a village's layout: its wall and every building the game knows, placed by hand (stage E3).
// Pure: no three.js, no DOM; the editor and the game share it.
import { VoxelGrid, type Op } from '../core/voxel';
import { DIRV, hash, type Dir } from '../core/rng';
import type { RobotKind } from '../data/robots';
import type { DungeonMap, DecoBox, DoorCand, BossSpec } from './dungeon';
import { stairOpsFor, type PortalSpec } from './stairs';
import { METRO, stationParts, type MetroInfo, type MetroBlock, type MetroStation } from './metro';
import type { StepBox } from '../core/steps';
import type { LodeKind } from './lodes';

export const MAP_FORMAT = 1;
/** Where the editor keeps its files (one JSON object of name → file per kind; the game reads the dungeons). */
export const EDITOR_KEY = { dungeon: 'gridWorld.editor.dungeon', world: 'gridWorld.editor.world', village: 'gridWorld.editor.village' } as const;
export type MapKind = keyof typeof EDITOR_KEY;

// ---------- dungeons ----------
export type DStyle = 'temple' | 'ship' | 'metro';
export const STYLES: DStyle[] = ['temple', 'ship', 'metro'];
export type PieceKind = 'room' | 'hall' | 'corridor' | 'solid' | 'bay' | 'engine' | 'shipcorr' | 'station' | 'tunnel' | 'train' | 'rubble' | 'niche';
/** A kit piece: a box of cells [x, x+w) × [z, z+d) from floor y up h metres. */
export interface Piece { k: PieceKind; x: number; z: number; w: number; d: number; y?: number; h?: number; name?: string }
export type MarkKind = 'spawn' | 'exit' | 'chest' | 'crystal' | 'boss' | 'guard' | 'door';
/** A marker on a cell (x, z); guards carry their robot's kind. */
export interface Mark { k: MarkKind; x: number; z: number; kind?: RobotKind }
export interface DungeonFile {
  kind: 'dungeon'; format: number; name: string; style: DStyle;
  /** How hard its robots are (the game's danger scale, 1–8) and how many stray drones roam it. */
  danger: number; drones: number;
  pieces: Piece[]; marks: Mark[];
  /** The expanded voxel op list (written on save for other tools; the game expands the pieces again). */
  ops?: Op[];
}
export interface PieceSpec {
  /** Which kits offer it; carves a room or lays a solid; drawn as a passage (deco); fixed footprint; default size. */
  styles: DStyle[]; solid: boolean; tunnel: boolean; fixed?: [number, number]; w: number; d: number; h: number;
  /** A passage drawn as a line: its width across is fixed. */
  across?: number;
}
export const PIECES: Record<PieceKind, PieceSpec> = {
  room: { styles: ['temple', 'ship', 'metro'], solid: false, tunnel: false, w: 8, d: 8, h: 5 },
  hall: { styles: ['temple'], solid: false, tunnel: false, w: 16, d: 14, h: 9 },
  corridor: { styles: ['temple'], solid: false, tunnel: true, w: 12, d: 3, h: 4, across: 3 },
  solid: { styles: ['temple', 'ship', 'metro'], solid: true, tunnel: false, w: 2, d: 2, h: 9 },
  bay: { styles: ['ship'], solid: false, tunnel: false, w: 8, d: 6, h: 4 },
  engine: { styles: ['ship'], solid: false, tunnel: false, w: 14, d: 10, h: 7 },
  shipcorr: { styles: ['ship'], solid: false, tunnel: true, w: 12, d: 3, h: 4, across: 3 },
  station: { styles: ['metro'], solid: false, tunnel: false, fixed: [METRO.hall.len, METRO.hall.wid], w: METRO.hall.len, d: METRO.hall.wid, h: METRO.hall.h },
  tunnel: { styles: ['metro'], solid: false, tunnel: true, w: 20, d: METRO.tunnel.wid, h: METRO.tunnel.h, across: METRO.tunnel.wid },
  train: { styles: ['metro'], solid: true, tunnel: false, fixed: [14, METRO.tunnel.wid], w: 14, d: METRO.tunnel.wid, h: 5 },
  rubble: { styles: ['metro', 'temple', 'ship'], solid: true, tunnel: false, fixed: [3, METRO.tunnel.wid], w: 3, d: METRO.tunnel.wid, h: 7 },
  niche: { styles: ['metro', 'temple', 'ship'], solid: false, tunnel: false, fixed: [3, 3], w: 3, d: 3, h: 3 },
};
export const PIECE_KINDS = Object.keys(PIECES) as PieceKind[];
export const MARK_KINDS: MarkKind[] = ['spawn', 'exit', 'chest', 'crystal', 'boss', 'guard', 'door'];

export function newDungeon(name: string, style: DStyle): DungeonFile {
  return { kind: 'dungeon', format: MAP_FORMAT, name, style, danger: 2, drones: 2, pieces: [], marks: [] };
}
const inBox = (p: { x: number; z: number; w: number; d: number }, x: number, z: number) => x >= p.x && x < p.x + p.w && z >= p.z && z < p.z + p.d;
/** The topmost room-like piece over cell (x, z) (the last one placed), or null. */
export function roomAt(f: DungeonFile, x: number, z: number): Piece | null {
  for (let i = f.pieces.length - 1; i >= 0; i--) { const p = f.pieces[i]; if (!PIECES[p.k].solid && inBox(p, x, z)) return p; }
  return null;
}
const along = (p: Piece) => p.w >= p.d;
const hOf = (p: Piece) => p.h ?? PIECES[p.k].h;
const yOf = (p: Piece) => p.y ?? 0;
/** Where an exit marker's stairs leave its room: the nearest side of the room it stands in. */
export function exitStairs(f: DungeonFile, m: Mark): { dir: Dir; m: number; c: number; y0: number } | null {
  const r = roomAt(f, m.x, m.z);
  if (!r) return null;
  const sides: [Dir, number][] = [['N', m.z - r.z], ['S', r.z + r.d - 1 - m.z], ['W', m.x - r.x], ['E', r.x + r.w - 1 - m.x]];
  const [dir] = sides.sort((a, b) => a[1] - b[1])[0];
  const wall = dir === 'N' ? r.z - 1 : dir === 'S' ? r.z + r.d : dir === 'W' ? r.x - 1 : r.x + r.w;
  const c = dir === 'N' || dir === 'S' ? m.x : m.z;
  // a station's long walls rise from the platform
  const y0 = yOf(r) + (r.k === 'station' && (along(r) ? dir === 'N' || dir === 'S' : dir === 'W' || dir === 'E') ? METRO.platform : 0);
  return { dir, m: wall, c, y0 };
}
const shift = (o: Op, y: number): Op => ({ ...o, y: o.y + y });

/** The game's level from a dungeon file: voxel ops in order (rooms, the stations' platforms, solids and blockages, the
 *  stairs out), decoration boxes, the metro's track and stations, chests, crystals, a boss, guards, doors, the way out. */
export function expandDungeon(f: DungeonFile): DungeonMap {
  const rooms: Op[] = [], details: Op[] = [], plugs: Op[] = [], stairs: Op[] = [], boxes: DecoBox[] = [];
  const rails: MetroInfo['rails'] = [], blocks: MetroBlock[] = [], stations: MetroStation[] = [], steps: StepBox[] = [], decks: StepBox[] = [];
  const portals: PortalSpec[] = [];
  const exits = f.marks.filter((m) => m.k === 'exit');
  f.pieces.forEach((p, i) => {
    const s = PIECES[p.k], y = yOf(p), h = hOf(p);
    if (p.k === 'station') {
      const ax = along(p), cx = Math.round(p.x + p.w / 2), cz = Math.round(p.z + p.d / 2), sp = stationParts(cx, cz, ax);
      rooms.push(shift(sp.hall, y)); details.push(...sp.solids.map((o) => shift(o, y)));
      const up = (b: StepBox) => ({ ...b, y: b.y + y });
      decks.push(...sp.decks.map(up)); steps.push(...sp.steps.map(up)); rails.push(sp.rail);
      const hall: DecoBox = { x: sp.hall.x, z: sp.hall.z, w: sp.hall.w, d: sp.hall.d, h: sp.hall.h, tunnel: false };
      if (y === 0) boxes.push(hall);
      const out = exits.some((m) => inBox(hall, m.x, m.z));
      stations.push({ k: stations.length, entrance: out ? 0 : -1, name: p.name || 'Station ' + (stations.length + 1), x: cx, z: cz, alongX: ax, hall });
      return;
    }
    const op: Op = { op: s.solid ? 'solid' : 'room', x: p.x, y, z: p.z, w: p.w, h, d: p.d };
    if (s.solid) {
      plugs.push(op);
      if (p.k === 'train' || p.k === 'rubble') blocks.push({ kind: p.k, x: Math.floor(p.x + p.w / 2), z: Math.floor(p.z + p.d / 2), alongX: along(p), len: along(p) ? p.w : p.d });
      return;
    }
    rooms.push(op);
    if (y === 0) boxes.push({ x: p.x, z: p.z, w: p.w, d: p.d, h, tunnel: s.tunnel });
    if (p.k === 'tunnel') rails.push(along(p) ? [p.x, p.z + p.d / 2, p.x + p.w, p.z + p.d / 2] : [p.x + p.w / 2, p.z, p.x + p.w / 2, p.z + p.d]);
    void i;
  });
  exits.forEach((m, n) => {
    const e = exitStairs(f, m);
    if (!e) return;
    stairs.push(...stairOpsFor(e.dir, e.m, e.c, true).map((o) => shift(o, e.y0)));
    portals.push({ key: 'V' + n, dir: e.dir, m: e.m, c: e.c, up: true, axis: DIRV[e.dir][0] ? 'x' : 'z', y0: e.y0 });
  });
  const ops = [...rooms, ...details, ...plugs, ...stairs];
  const grid = VoxelGrid.fromOps(ops.length ? ops : [{ op: 'room', x: 0, y: 0, z: 0, w: 1, h: 2, d: 1 }]);
  const floor = (x: number, z: number, y0: number) => standY(grid, x, z, y0);
  const pick = (k: MarkKind) => f.marks.filter((m) => m.k === k);
  const sp = pick('spawn')[0] ?? exits[0] ?? { x: rooms[0]?.x ?? 0, z: rooms[0]?.z ?? 0 };
  const sy = floor(sp.x, sp.z, yOf(roomAt(f, sp.x, sp.z) ?? ({ y: 0 } as Piece)));
  const bosses: BossSpec[] = pick('boss').map((m) => {
    const r = roomAt(f, m.x, m.z);
    return { x: m.x + 0.5, z: m.z + 0.5, room: r ? { x: r.x, z: r.z, w: r.w, d: r.d, h: hOf(r) } : { x: m.x - 3, z: m.z - 3, w: 7, d: 7, h: 5 }, guard: false };
  });
  const doorCands: DoorCand[] = pick('door').map((m) => {
    const r = roomAt(f, m.x, m.z), ax = !r || along(r);
    return ax ? { axis: 'x', m: m.x, c: m.z } : { axis: 'z', m: m.z, c: m.x };
  });
  const metro: MetroInfo | undefined = f.style === 'metro' ? { city: -1, name: f.name, stations, rails, blocks, ends: [], steps, decks } : undefined;
  return {
    seed: hash(0xed17, ...[...f.name].map((ch) => ch.charCodeAt(0))), spawn: [sp.x + 0.5, sy ?? 0, sp.z + 0.5], ops,
    rooms: f.pieces.filter((p) => !PIECES[p.k].solid).length,
    chests: pick('chest').map(({ x, z }) => ({ x, z })), crystals: pick('crystal').map(({ x, z }) => ({ x, z })),
    hatch: null, portals, doorCands, bosses, gates: [], boxes, style: f.style,
    guards: pick('guard').map((m) => ({ kind: m.kind ?? 'scout', x: m.x, z: m.z })),
    ...(metro ? { metro } : {}),
  };
}
/** The lowest standing height at or above y0 in column (x, z) (free for 2 m, a floor under it), or null. */
export function standY(g: VoxelGrid, x: number, z: number, y0 = 0): number | null {
  for (let y = y0 - 1; y <= y0 + 12; y++) if (g.empty(x, y, z) && g.empty(x, y + 1, z) && !g.empty(x, y - 1, z)) return y;
  return null;
}

/** What is wrong with a dungeon (the editor lists it; the game still loads what it can). Keys are English texts. */
export type Problem = { k: 'noRooms' | 'noExit' | 'badExit' | 'unreached' | 'outside'; x?: number; z?: number; what?: MarkKind };
export function dungeonProblems(f: DungeonFile): Problem[] {
  const out: Problem[] = [];
  if (!f.pieces.some((p) => !PIECES[p.k].solid)) return [{ k: 'noRooms' }];
  const exits = f.marks.filter((m) => m.k === 'exit');
  if (!exits.length) out.push({ k: 'noExit' });
  for (const m of f.marks) if (m.k !== 'door' && !roomAt(f, m.x, m.z)) out.push({ k: 'outside', x: m.x, z: m.z, what: m.k });
  for (const m of exits) if (roomAt(f, m.x, m.z) && !exitStairs(f, m)) out.push({ k: 'badExit', x: m.x, z: m.z });
  const map = expandDungeon(f), g = VoxelGrid.fromOps(map.ops);
  const start = f.marks.find((m) => m.k === 'spawn') ?? exits[0];
  if (start) {
    const got = reachable(g, start.x, start.z, Math.floor(map.spawn[1]));
    for (const m of f.marks) if (['chest', 'boss', 'exit', 'crystal'].includes(m.k) && roomAt(f, m.x, m.z) && !got.has(m.x + ',' + m.z)) out.push({ k: 'unreached', x: m.x, z: m.z, what: m.k });
  }
  return out;
}
/** Cells reachable on foot from (x, z) at height y: a metre up or down at a time (steps and jumps). */
export function reachable(g: VoxelGrid, sx: number, sz: number, sy: number): Set<string> {
  const seen = new Set<string>(), q: [number, number, number][] = [];
  const stand = (x: number, y: number, z: number) => g.empty(x, y, z) && g.empty(x, y + 1, z) && !g.empty(x, y - 1, z);
  if (!stand(sx, sy, sz)) return seen;
  seen.add(sx + ',' + sz); q.push([sx, sy, sz]);
  const at = new Set<string>([sx + ',' + sy + ',' + sz]);
  while (q.length) {
    const [x, y, z] = q.pop()!;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (const dy of [0, 1, -1]) {
      const nx = x + dx, nz = z + dz, ny = y + dy, k = nx + ',' + ny + ',' + nz;
      if (at.has(k) || !stand(nx, ny, nz) || !g.empty(x, Math.max(y, ny) + 1, z) || !g.empty(nx, Math.max(y, ny) + 1, nz)) continue;
      at.add(k); seen.add(nx + ',' + nz); q.push([nx, ny, nz]);
      break;
    }
  }
  return seen;
}

// ---------- worlds ----------
export type PlaceKind = 'start' | 'village' | 'ruin' | 'camp' | 'wreck' | 'city' | 'install' | 'megalith' | 'cave';
export const PLACE_KINDS: PlaceKind[] = ['start', 'village', 'ruin', 'camp', 'wreck', 'city', 'install', 'megalith', 'cave'];
export interface WorldPlace { k: PlaceKind; x: number; z: number; name?: string; r?: number; layout?: string; install?: string; /** (0.210) a ruin's, wreck's or dead city's level drawn in the editor (a dungeon file's name) */ dungeon?: string }
export interface WorldRiver { pts: [number, number][]; w: number; name?: string }
export interface WorldLode { k: LodeKind; x: number; z: number; rich: number }
export interface WorldFile {
  kind: 'world'; format: number; name: string;
  /** Metres a cell; cells across (east-west, the planet wraps) and down (north to south). */
  cell: number; w: number; h: number;
  /** Ground height of every cell in metres, row by row from the north-west (the sea level is 0). */
  land: number[];
  rivers: WorldRiver[]; lodes: WorldLode[]; places: WorldPlace[];
}
export const WORLD_LIMITS = { cell: 500, w: [40, 240] as [number, number], h: [20, 120] as [number, number], low: -40, high: 220 };
export function newWorld(name: string, w = 120, h = 60): WorldFile {
  return { kind: 'world', format: MAP_FORMAT, name, cell: WORLD_LIMITS.cell, w, h, land: new Array(w * h).fill(-20), rivers: [], lodes: [], places: [] };
}

// ---------- villages ----------
export interface VillageItem { k: string; x: number; z: number; w: number; d: number; rot: number; label?: string }
export interface VillageFile { kind: 'village'; format: number; name: string; sides: 6 | 8 | 12; wall: number; items: VillageItem[] }
export function newVillage(name: string): VillageFile {
  return { kind: 'village', format: MAP_FORMAT, name, sides: 8, wall: 0, items: [] };
}

export type MapFile = DungeonFile | WorldFile | VillageFile;
/** A file read back from JSON (an import, the browser's store): the right kind and the fields it needs, else null. */
export function readMapFile(v: unknown): MapFile | null {
  if (!v || typeof v !== 'object') return null;
  const f = v as Partial<MapFile> & { kind?: string };
  if (typeof f.name !== 'string' || typeof f.format !== 'number' || f.format > MAP_FORMAT) return null;
  if (f.kind === 'dungeon') {
    const d = f as Partial<DungeonFile>;
    if (!STYLES.includes(d.style as DStyle) || !Array.isArray(d.pieces) || !Array.isArray(d.marks)) return null;
    if (d.pieces.some((p) => !PIECES[p?.k as PieceKind] || ![p.x, p.z, p.w, p.d].every(Number.isFinite))) return null;
    return { danger: 2, drones: 2, ...d } as DungeonFile;
  }
  if (f.kind === 'world') {
    const w = f as Partial<WorldFile>;
    if (!Number.isInteger(w.w) || !Number.isInteger(w.h) || !Array.isArray(w.land) || w.land.length !== w.w! * w.h!) return null;
    return { rivers: [], lodes: [], places: [], cell: WORLD_LIMITS.cell, ...w } as WorldFile;
  }
  if (f.kind === 'village') {
    const g = f as Partial<VillageFile>;
    if (!Array.isArray(g.items)) return null;
    return { sides: 8, wall: 0, ...g } as VillageFile;
  }
  return null;
}
/** The files of one kind kept in the browser by the editor (name → file). */
export function storedMaps<K extends MapKind>(kind: K, store: { getItem(k: string): string | null } | undefined): Record<string, MapFile> {
  try {
    const raw = JSON.parse(store?.getItem(EDITOR_KEY[kind]) ?? '{}') as Record<string, unknown>, out: Record<string, MapFile> = {};
    for (const [n, v] of Object.entries(raw)) { const f = readMapFile(v); if (f && f.kind === kind) out[n] = f; }
    return out;
  } catch { return {}; }
}
