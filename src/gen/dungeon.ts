// Dungeon sector generator. Pure and deterministic: same seed + opts => identical output.
import { rng, rangeInt, DIRV, type Dir } from '../core/rng';
import type { Op } from '../core/voxel';
import { sbox, stairOpsFor, SL, type PortalSpec } from './stairs';

export interface DoorCand { axis: 'x' | 'z'; m: number; c: number; locked?: boolean }
export interface BossSpec { x: number; z: number; room: { x: number; z: number; w: number; d: number; h: number }; guard: boolean; gate?: number }
/** A room or corridor box, for the angled decoration (world/dungeondeco.ts): cells [x, x+w) x [z, z+d), floor 0, ceiling h. */
export interface DecoBox { x: number; z: number; w: number; d: number; h: number; tunnel: boolean }
export interface DungeonMap {
  seed: number;
  spawn: [number, number, number];
  ops: Op[];
  rooms: number;
  chests: { x: number; z: number }[];
  /** Nutrient Crystal clusters (edible, grow back) in some rooms. */
  crystals: { x: number; z: number }[];
  /** The way down to the next depth (a crashed ship has none). */
  hatch: { x: number; z: number } | null;
  portals: PortalSpec[];
  doorCands: DoorCand[];
  bosses: BossSpec[];
  gates: number[];
  /** Rooms and corridors, for the angled ceilings and struts drawn over the voxels. */
  boxes: DecoBox[];
  /** Temple maze or ship corridors (different decoration and loot). */
  style: 'temple' | 'ship';
}
export interface DungeonOpts { surfaceExit?: boolean }

interface Room {
  x: number; y: number; z: number; w: number; h: number; d: number; cx: number; cz: number;
  zone: number; big: boolean; dead: boolean; boss?: boolean; gateX?: number; op?: Op;
}
interface Link { a: Room; b: Room; kind: 'fwd' | 'lat' }
type Box = { x: number; z: number; w: number; d: number };

export function generateDungeon(seed: number, opts: DungeonOpts = {}): DungeonMap {
  // The dungeon runs forward along +z: consecutive zones, each with 1–3 rooms side by side.
  // Every room is entered from the previous zone, so there are always several routes deeper.
  // Some rooms are dead ends with chests, and winding tunnels cross each other.
  const R = rng(seed), ri = rangeInt(R);
  const W = 64, ZD = 34, NZ_ = ri(8, 10);
  const rooms: Room[] = [], zones: Room[][] = [];
  for (let zi = 0; zi < NZ_; zi++) {
    const first = zi === 0, lastZ = zi === NZ_ - 1, k = (first || lastZ) ? 1 : ri(2, 3), lane = Math.floor(W / k), list: Room[] = [];
    for (let l = 0; l < k; l++) {
      const big = lastZ || (!first && k < 3 && R() < 0.3);
      const w = Math.min(lane - 4, big ? ri(16, 24) : ri(9, 16)), d = big ? ri(14, 20) : ri(9, 16), h = big ? ri(7, 10) : ri(5, 8);
      const x = l * lane + 2 + ri(0, Math.max(0, lane - 4 - w)), z = zi * ZD + ri(0, ZD - d - 10);
      const r: Room = { x, y: 0, z, w, h, d, cx: x + (w >> 1), cz: z + (d >> 1), zone: zi, big, dead: false };
      rooms.push(r); list.push(r);
    }
    zones.push(list);
  }
  for (let zi = 1; zi < NZ_ - 1; zi++) if (zones[zi].length >= 2 && R() < 0.5) zones[zi][ri(0, zones[zi].length - 1)].dead = true;

  const links: Link[] = [], hasLink = (a: Room, b: Room) => links.some((L) => (L.a === a && L.b === b) || (L.a === b && L.b === a));
  const near = (r: Room, list: Room[]) => list.reduce((m, o) => (Math.abs(o.cx - r.cx) < Math.abs(m.cx - r.cx) ? o : m));
  for (let zi = 0; zi < NZ_ - 1; zi++) {
    const cur = zones[zi].filter((r) => !r.dead), nxt = zones[zi + 1], used = new Set<Room>();
    for (const b of nxt) { const a = near(b, cur); links.push({ a, b, kind: 'fwd' }); used.add(a); }
    for (const a of cur) if (!used.has(a)) { const b = near(a, nxt); if (!hasLink(a, b)) links.push({ a, b, kind: 'fwd' }); }
    if (cur.length * nxt.length > 1 && R() < 0.45) { const a = cur[ri(0, cur.length - 1)], b = nxt[ri(0, nxt.length - 1)]; if (!hasLink(a, b)) links.push({ a, b, kind: 'fwd' }); }
    const zs = zones[zi].slice().sort((p, q) => p.cx - q.cx);
    for (let i = 0; i + 1 < zs.length; i++) if (R() < 0.3) links.push({ a: zs[i], b: zs[i + 1], kind: 'lat' });
  }

  // Gates: every entrance into a gate zone has a locked door; the key comes from the guardian in the zone before it.
  const gates = [...new Set([Math.round(NZ_ * 0.4), Math.round(NZ_ * 0.75)])].filter((g) => g >= 2 && g <= NZ_ - 1);
  const bosses: BossSpec[] = [];
  for (const g of gates) {
    const cand = zones[g - 1].slice().sort((p, q) => (Number(q.big) - Number(p.big)) || (q.w * q.d - p.w * p.d)); const r = cand[0];
    bosses.push({ x: r.cx, z: r.cz, room: { x: r.x, z: r.z, w: r.w, d: r.d, h: r.h }, guard: true, gate: g }); r.boss = true;
  }
  if (R() < 0.45) {
    const el = rooms.filter((r) => r.zone >= NZ_ / 2 && r.zone < NZ_ - 1 && !r.boss);
    if (el.length) { const r = el[ri(0, el.length - 1)]; bosses.push({ x: r.cx, z: r.cz, room: { x: r.x, z: r.z, w: r.w, d: r.d, h: r.h }, guard: false }); r.boss = true; }
  }
  const lockedCands: DoorCand[] = [];

  const ops: Op[] = [], solids: Op[] = [], corridors: Op[] = [], doorCands: DoorCand[] = [];
  rooms.forEach((r, i) => {
    r.op = { op: 'room', x: r.x, y: 0, z: r.z, w: r.w, h: r.h, d: r.d }; ops.push(r.op);
    if (i === 0) return;
    if (r.big) { // hall with rows of pillars
      for (let px = r.x + 3; px <= r.x + r.w - 5; px += 5) for (let pz = r.z + 3; pz <= r.z + r.d - 5; pz += 5)
        if (R() < 0.75) solids.push({ op: 'solid', x: px, y: 0, z: pz, w: 2, h: r.h, d: 2 });
      return;
    }
    const k = R();
    if (k < 0.3 && r.w >= 9 && r.d >= 9) {
      for (const [px, pz] of [[r.x + 2, r.z + 2], [r.x + r.w - 4, r.z + 2], [r.x + 2, r.z + r.d - 4], [r.x + r.w - 4, r.z + r.d - 4]])
        solids.push({ op: 'solid', x: px, y: 0, z: pz, w: 2, h: r.h, d: 2 });
    } else if (k < 0.55) {
      const n = ri(2, 4);
      for (let c = 0; c < n; c++) { const s = ri(1, 2); solids.push({ op: 'solid', x: ri(r.x + 1, r.x + r.w - s - 1), y: 0, z: ri(r.z + 1, r.z + r.d - s - 1), w: s, h: ri(1, 2), d: s }); }
    } else if (k < 0.8) {
      const ph = ri(1, 2); solids.push({ op: 'solid', x: r.x, y: 0, z: r.z, w: r.w, h: ph, d: 3 });
      if (ph === 2) solids.push({ op: 'solid', x: r.cx - 1, y: 0, z: r.z + 3, w: 3, h: 1, d: 1 });
    }
  });
  const clampX = (x: number) => Math.max(3, Math.min(W - 4, x));
  const seg = (x0: number, z0: number, x1: number, z1: number, wd: number, h: number) => {
    const hw = wd >> 1;
    corridors.push({ op: 'room', x: Math.min(x0, x1) - hw, y: 0, z: Math.min(z0, z1) - hw, w: Math.abs(x1 - x0) + wd, h, d: Math.abs(z1 - z0) + wd });
    if (wd !== 3 || R() > 0.55) return; // sliding doors only in some narrow tunnels
    if (z0 === z1 && Math.abs(x1 - x0) >= 4) doorCands.push({ axis: 'x', m: (x0 + x1) >> 1, c: z0 });
    if (x0 === x1 && Math.abs(z1 - z0) >= 4) doorCands.push({ axis: 'z', m: (z0 + z1) >> 1, c: x0 });
  };
  const path = (pts: number[][], wd: number, h: number) => {
    for (let i = 0; i + 1 < pts.length; i++) { const [x0, z0] = pts[i], [x1, z1] = pts[i + 1]; seg(x0, z0, x1, z0, wd, h); seg(x1, z0, x1, z1, wd, h); }
  };
  for (const L of links) {
    const a = L.a, b = L.b, gated = L.kind === 'fwd' && gates.includes(b.zone), wide = !gated && R() < 0.22, wd = wide ? 5 : 3, h = wide ? 4 : 3;
    if (L.kind === 'lat') { path([[a.cx, a.cz], [b.cx, a.cz], [b.cx, b.cz]], 3, 3); continue; }
    if (gated && b.gateX === undefined) b.gateX = ri(b.x + 2, b.x + b.w - 3); // a single entrance into the gate room
    const ex = ri(a.x + 2, a.x + a.w - 3), ez = a.z + a.d - 1, bx = gated ? b.gateX! : ri(b.x + 2, b.x + b.w - 3), bz = b.z;
    const pts = [[ex, ez], [ex, ez + ri(2, 4)]];
    const z0 = ez + 5, z1 = gated ? bz - 10 : bz - 3, n = z1 - z0 >= 6 ? ri(1, 3) : 0;
    for (let j = 1; j <= n; j++) { const t = j / (n + 1); pts.push([clampX(Math.round(ex + (bx - ex) * t) + ri(-14, 14)), Math.round(z0 + (z1 - z0) * t)]); }
    if (gated) {
      pts.push([bx, bz - 7], [bx, Math.min(bz + 4, b.z + b.d - 2)]);
      if (!lockedCands.some((q) => q.m === bz - 3 && q.c === bx)) lockedCands.push({ axis: 'z', m: bz - 3, c: bx, locked: true });
    } else pts.push([bx, bz - 2], [bx, Math.min(bz + 4, b.z + b.d - 2)]); // drive into the room: cuts through a wall-side platform if any
    path(pts, wd, h);
  }

  const last = zones[NZ_ - 1][0];
  const hatch = { x: last.cx, z: last.cz };
  const inside = (r: Room, m = 1) => ({ x: ri(r.x + m, r.x + r.w - 1 - m), z: ri(r.z + m, r.z + r.d - 1 - m) });
  const chests: { x: number; z: number }[] = [], chestRooms = new Set<Room>();
  for (const r of rooms) if (r.dead) { chests.push(inside(r)); chestRooms.add(r); }
  const later = rooms.filter((r) => r.zone >= NZ_ / 2 && r !== last && !chestRooms.has(r));
  for (let i = 0; i < 2 && later.length; i++) { const r = later.splice(ri(0, later.length - 1), 1)[0]; chests.push(inside(r)); chestRooms.add(r); }
  const mid = rooms.filter((r) => r.zone > 0 && r.zone < NZ_ - 1).sort((p, q) => p.zone - q.zone || p.cx - q.cx);
  const pool = mid.filter((r) => !chestRooms.has(r)).length >= 4 ? mid.filter((r) => !chestRooms.has(r)) : mid;
  // Stairwells to neighbouring sectors: a door in a room wall with stairs behind it (N/E up, S/W down).
  const stairOps: Op[] = [], stairBoxes: Box[] = [], portals: PortalSpec[] = [];
  const hits = (A: Box, B: Box) => A.x < B.x + B.w && A.x + A.w > B.x && A.z < B.z + B.d && A.z + A.d > B.z;
  const free = (bx: Box, host: Room) => [...ops, ...corridors].every((o) => o === host.op || !hits(bx, o)) && stairBoxes.every((o) => !hits(bx, o));
  const wallOf = (r: Room, dir: Dir) => dir === 'W' ? { m: r.x - 1, lo: r.z + 2, hi: r.z + r.d - 3 } : dir === 'E' ? { m: r.x + r.w, lo: r.z + 2, hi: r.z + r.d - 3 }
    : dir === 'N' ? { m: r.z - 1, lo: r.x + 2, hi: r.x + r.w - 3 } : { m: r.z + r.d, lo: r.x + 2, hi: r.x + r.w - 3 };
  if (opts.surfaceExit) { // way back up to the surface from the start room
    const r = rooms[0]; let done = false;
    for (const dir of ['N', 'W', 'E', 'S'] as Dir[]) {
      if (done) break; const wl = wallOf(r, dir); if (wl.hi < wl.lo) continue;
      for (let t = 0; t < 8 && !done; t++) {
        const c = ri(wl.lo, wl.hi), probe = sbox(dir, wl.m, c, 0, SL + 1, 0, 1, 'x', 2);
        if (!free(probe, r)) continue;
        stairBoxes.push(probe); stairOps.push(...stairOpsFor(dir, wl.m, c, true));
        portals.push({ key: 'V', dir, m: wl.m, c, up: true, axis: DIRV[dir][0] ? 'x' : 'z' }); done = true;
      }
    }
  }
  const order: Record<Dir, (p: Room, q: Room) => number> = {
    W: (p, q) => p.x - q.x, E: (p, q) => (q.x + q.w) - (p.x + p.w), N: (p, q) => p.zone - q.zone, S: (p, q) => q.zone - p.zone,
  };
  for (const dir of ['N', 'W', 'E', 'S'] as Dir[]) {
    const cands = pool.slice().sort(order[dir]).concat(rooms.filter((r) => r !== last && r !== rooms[0]));
    let done = false;
    for (const r of cands) {
      if (done) break;
      const wl = wallOf(r, dir); if (wl.hi < wl.lo) continue;
      for (let t = 0; t < 6 && !done; t++) {
        const c = ri(wl.lo, wl.hi), probe = sbox(dir, wl.m, c, 0, SL + 1, 0, 1, 'x', 2);
        if (!free(probe, r)) continue;
        const up = dir === 'N' || dir === 'E';
        stairBoxes.push(probe); stairOps.push(...stairOpsFor(dir, wl.m, c, up));
        portals.push({ key: dir, dir, m: wl.m, c, up, axis: DIRV[dir][0] ? 'x' : 'z' }); done = true;
      }
    }
  }

  // Nutrient Crystals grow in the corners of some rooms (own RNG stream: the layout above stays as it was)
  const C = rng(seed ^ 0x6c5a31), crystals: { x: number; z: number }[] = [];
  for (const r of rooms) if (r !== rooms[0] && !chestRooms.has(r) && C() < 0.3) {
    crystals.push({ x: C() < 0.5 ? r.x + 1 : r.x + r.w - 2, z: C() < 0.5 ? r.z + 1 : r.z + r.d - 2 });
  }
  return {
    seed, spawn: [rooms[0].cx + 0.5, 0, rooms[0].cz + 0.5], ops: [...ops, ...solids, ...corridors, ...stairOps], rooms: rooms.length,
    chests, crystals, hatch, portals, boxes: rooms.map((r) => ({ x: r.x, z: r.z, w: r.w, d: r.d, h: r.h, tunnel: false })), style: 'temple', doorCands: [...lockedCands, ...doorCands], bosses, gates,
  };
}
