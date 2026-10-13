// (0.195) The metro under a dead city: one level for the whole city. Its stations are the city's entrances (each with
// stairs up to its own street, so you can go down in one part of the city and come up in another) and a few stations
// that lie underground only. Tall, narrow tunnels (4 m wide, 7 m high) zigzag between them along a spanning tree, so
// every station can be reached; a few extra tunnels are blocked half way by a wrecked train or a fall of rubble, and
// some stations have a short dead-end tunnel. Few side passages: now and then a maintenance niche with a chest.
// Pure and deterministic from the world seed and the city; the city's plan is squeezed (`METRO.span`) so the level
// stays small. Builds an ordinary DungeonMap (voxel ops, chests, guards, boss, portals) with `metro` for the drawing.
import { hash, rng, rangeInt, DIRV, type Dir } from '../core/rng';
import type { Op } from '../core/voxel';
import type { RobotKind } from '../data/robots';
import type { DungeonMap, DecoBox, BossSpec } from './dungeon';
import { sbox, stairOpsFor, SL, type PortalSpec } from './stairs';
import { citySites, type CitySite } from './cities';
import { cityEntrances, cityEntrance, stationName, CITY_VAULTS } from './citydungeons';
import type { StepBox } from '../core/steps';

export const METRO = {
  /** The squeezed plan: the city's radius becomes this many metres underground. */
  span: 165,
  /** Station hall: length along the track, width, height. Tunnels: width, height. */
  hall: { len: 34, wid: 12, h: 9 }, tunnel: { wid: 4, h: 7 },
  /** Underground-only stations: 2..2+extra. */
  inner: 2, innerExtra: 3,
  /** Chance a station gets an extra tunnel to its nearest unlinked neighbour, and that such a tunnel is blocked. */
  loop: 0.45, blocked: 0.6,
  /** Chance of a dead-end tunnel at a station, of a niche on a long stretch. */
  stub: 0.35, niche: 0.22,
  /** (0.205) The track lies in a trench `trench` wide; the platforms either side stand `platform` m higher, with a half
   *  step (`step` m high, `stepLen` long, `stepOut` into the trench) at `stepsAt` metres either side of the middle. */
  trench: 4, platform: 1, step: 0.5, stepLen: 2, stepOut: 0.6, stepsAt: [-9, 9],
};
export interface MetroStation {
  /** Index; `entrance` = the city entrance it comes up at (-1 underground only). */
  k: number; entrance: number; name: string;
  /** Hall centre (level coordinates) and its track's direction. */
  x: number; z: number; alongX: boolean; hall: DecoBox;
}
export interface MetroBlock { kind: 'train' | 'rubble'; x: number; z: number; alongX: boolean; len: number }
export interface MetroInfo {
  city: number; name: string; stations: MetroStation[];
  /** Track centrelines [x0, z0, x1, z1] (axis-aligned pieces). */
  rails: [number, number, number, number][];
  blocks: MetroBlock[];
  /** Dead ends: where a tunnel stops in rubble (the end of the piece and its direction). */
  ends: { x: number; z: number; dx: number; dz: number }[];
  /** (0.205) Half steps from the trench up onto the platforms (walked on through `G.floor`, world/level.ts). */
  steps: StepBox[];
  /** (0.205) The platforms' tops as boxes, so a half step leads on up onto them (voxels alone do not step up). */
  decks: StepBox[];
}

/** The metro a dungeon id belongs to: any of the city's entrance ids. */
export function metroCity(world: number, id: number): CitySite | null {
  const e = cityEntrance(world, id);
  return e ? citySites(world).find((c) => c.i === e.city) ?? null : null;
}
/** The id the metro is saved under: its first entrance's. */
export const metroId = (world: number, city: CitySite) => cityEntrances(world, city)[0].id;

const cache = new Map<string, DungeonMap>();
export function generateMetro(world: number, city: CitySite): DungeonMap {
  const key = world + ':' + city.i, found = cache.get(key);
  if (found) return found;
  const seed = hash(world, city.i, 0x3e7a0), R = rng(seed), ri = rangeInt(R), K = METRO.span / city.r;
  const H = METRO.hall, T = METRO.tunnel, hl = H.len / 2, hw = H.wid / 2, tw = T.wid / 2;
  // ---- the stations: the entrances, then the underground ones by farthest-point sampling ----
  const ents = cityEntrances(world, city);
  const pts: { x: number; z: number; e: number }[] = ents.map((e) => ({ x: Math.round(e.u * K), z: Math.round(e.v * K), e: e.n }));
  const inner = METRO.inner + hash(world, city.i, 0x3e7a1) % (METRO.innerExtra + 1);
  for (let j = 0; j < inner; j++) {
    let best: { x: number; z: number } | null = null, bd = -1;
    for (let t = 0; t < 40; t++) {
      const a = R() * Math.PI * 2, r = Math.sqrt(R()) * METRO.span * 0.8, x = Math.round(Math.cos(a) * r), z = Math.round(Math.sin(a) * r);
      const d = Math.min(...pts.map((p) => Math.hypot(p.x - x, p.z - z)));
      if (d > bd) { bd = d; best = { x, z }; }
    }
    pts.push({ ...best!, e: -1 });
  }
  // keep halls apart: nudge anything closer than 48 m out along the line between them
  for (let it = 0; it < 6; it++) for (let a = 0; a < pts.length; a++) for (let b = a + 1; b < pts.length; b++) {
    const dx = pts[b].x - pts[a].x, dz = pts[b].z - pts[a].z, d = Math.hypot(dx, dz) || 1;
    if (d < 48) { const m = (48 - d) / 2 + 1; pts[a].x = Math.round(pts[a].x - dx / d * m); pts[a].z = Math.round(pts[a].z - dz / d * m); pts[b].x = Math.round(pts[b].x + dx / d * m); pts[b].z = Math.round(pts[b].z + dz / d * m); }
  }
  const n = pts.length, dist = (a: number, b: number) => Math.hypot(pts[a].x - pts[b].x, pts[a].z - pts[b].z);
  // ---- the lines: a spanning tree (always open), plus a few extra links (mostly blocked) ----
  const edges: { a: number; b: number; open: boolean }[] = [], linked = new Set<string>(), lk = (a: number, b: number) => Math.min(a, b) + ':' + Math.max(a, b);
  const inTree = [0];
  while (inTree.length < n) {
    let ba = -1, bb = -1, bd = Infinity;
    for (const a of inTree) for (let b = 0; b < n; b++) if (!inTree.includes(b) && dist(a, b) < bd) { bd = dist(a, b); ba = a; bb = b; }
    edges.push({ a: ba, b: bb, open: true }); linked.add(lk(ba, bb)); inTree.push(bb);
  }
  for (let a = 0; a < n; a++) {
    if (R() >= METRO.loop) continue;
    let bb = -1, bd = Infinity;
    for (let b = 0; b < n; b++) if (b !== a && !linked.has(lk(a, b)) && dist(a, b) < bd && dist(a, b) < METRO.span * 1.3) { bd = dist(a, b); bb = b; }
    if (bb < 0) continue;
    edges.push({ a, b: bb, open: R() >= METRO.blocked }); linked.add(lk(a, bb));
  }
  // each hall's track points the way most of its tunnels go
  const stations: MetroStation[] = pts.map((p, k) => {
    let sx = 0, sz = 0;
    for (const e of edges) if (e.a === k || e.b === k) { const o = pts[e.a === k ? e.b : e.a]; sx += Math.abs(o.x - p.x); sz += Math.abs(o.z - p.z); }
    const alongX = sx >= sz;
    const hall: DecoBox = alongX ? { x: p.x - hl, z: p.z - hw, w: H.len, d: H.wid, h: H.h, tunnel: false } : { x: p.x - hw, z: p.z - hl, w: H.wid, d: H.len, h: H.h, tunnel: false };
    return { k, entrance: p.e, name: stationName(world, city.i, p.e >= 0 ? p.e : CITY_VAULTS + k), x: p.x, z: p.z, alongX, hall };
  });
  // ---- carving ----
  const halls: Op[] = [], tunnels: Op[] = [], solids: Op[] = [], late: Op[] = [];
  const boxes: DecoBox[] = stations.map((s) => s.hall), rails: MetroInfo['rails'] = [], blocks: MetroBlock[] = [], ends: MetroInfo['ends'] = [];
  const chests: { x: number; z: number }[] = [], crystals: { x: number; z: number }[] = [], guards: { kind: RobotKind; x: number; z: number }[] = [];
  const pieces: { x0: number; z0: number; x1: number; z1: number }[] = [], steps: StepBox[] = [], decks: StepBox[] = [];
  const th = METRO.trench / 2, pd = hw - th, P = METRO.platform;
  for (const s of stations) {
    halls.push({ op: 'room', x: s.hall.x, y: 0, z: s.hall.z, w: s.hall.w, h: s.hall.h, d: s.hall.d });
    rails.push(s.alongX ? [s.x - hl, s.z, s.x + hl, s.z] : [s.x, s.z - hl, s.x, s.z + hl]);
    // (0.205) the platforms: a step higher than the track's trench, which runs on into the tunnels at its level
    for (const v of [-hw, th]) {
      const b = s.alongX ? { x: s.hall.x, y: 0, z: s.z + v, w: H.len, h: P, d: pd } : { x: s.x + v, y: 0, z: s.hall.z, w: pd, h: P, d: H.len };
      solids.push({ op: 'solid', ...b }); decks.push(b);
    }
    for (const t of METRO.stepsAt) for (const v of [-th, th - METRO.stepOut]) {
      const u = (s.alongX ? s.x : s.z) + t - METRO.stepLen / 2;
      steps.push(s.alongX ? { x: u, y: 0, z: s.z + v, w: METRO.stepLen, h: METRO.step, d: METRO.stepOut } : { x: s.x + v, y: 0, z: u, w: METRO.stepOut, h: METRO.step, d: METRO.stepLen });
    }
    // a row of columns down the middle of each platform
    for (let t = -12; t <= 12; t += 6) for (const side of [-5, 4]) solids.push(s.alongX ? { op: 'solid', x: s.x + t, y: 0, z: s.z + side, w: 1, h: H.h, d: 1 } : { op: 'solid', x: s.x + side, y: 0, z: s.z + t, w: 1, h: H.h, d: 1 });
  }
  /** One axis-aligned stretch of tunnel (its centreline from (x0, z0) to (x1, z1)). */
  const piece = (x0: number, z0: number, x1: number, z1: number) => {
    if (x0 === x1 && z0 === z1) return;
    const box = { x: Math.min(x0, x1) - tw, z: Math.min(z0, z1) - tw, w: Math.abs(x1 - x0) + T.wid, d: Math.abs(z1 - z0) + T.wid };
    tunnels.push({ op: 'room', ...box, y: 0, h: T.h });
    boxes.push({ ...box, h: T.h, tunnel: true }); rails.push([x0, z0, x1, z1]); pieces.push({ x0, z0, x1, z1 });
  };
  /** A zigzag from point to point: alternating x and z legs through jittered waypoints. */
  const route = (pts: number[][]) => {
    const out: { x0: number; z0: number; x1: number; z1: number }[] = [];
    for (let i = 0; i + 1 < pts.length; i++) {
      const [x0, z0] = pts[i], [x1, z1] = pts[i + 1], xFirst = i % 2 === 0 ? Math.abs(x1 - x0) >= Math.abs(z1 - z0) : Math.abs(x1 - x0) < Math.abs(z1 - z0);
      const legs = xFirst ? [[x0, z0, x1, z0], [x1, z0, x1, z1]] : [[x0, z0, x0, z1], [x0, z1, x1, z1]];
      for (const [a, b, c, d] of legs) if (a !== c || b !== d) { piece(a, b, c, d); out.push({ x0: a, z0: b, x1: c, z1: d }); }
    }
    return out;
  };
  /** Where a tunnel leaves a hall towards (tx, tz): the track's end on that side, and a point 6 m further out. */
  const mouth = (s: MetroStation, tx: number, tz: number) => {
    const sg = s.alongX ? Math.sign(tx - s.x) || 1 : Math.sign(tz - s.z) || 1;
    return s.alongX ? [[s.x + sg * (hl - 1), s.z], [s.x + sg * (hl + 6), s.z]] : [[s.x, s.z + sg * (hl - 1)], [s.x, s.z + sg * (hl + 6)]];
  };
  const zig = (from: number[], to: number[]) => {
    const dx = to[0] - from[0], dz = to[1] - from[1], L = Math.hypot(dx, dz) || 1, m = Math.max(1, Math.min(4, Math.round(L / 32))), w: number[][] = [];
    for (let j = 1; j <= m; j++) { const t = j / (m + 1), side = (j % 2 ? 1 : -1) * ri(5, 13); w.push([Math.round(from[0] + dx * t - dz / L * side), Math.round(from[1] + dz * t + dx / L * side)]); }
    return w;
  };
  for (const e of edges) {
    const A = stations[e.a], B = stations[e.b], [a0, a1] = mouth(A, B.x, B.z), [b0, b1] = mouth(B, A.x, A.z);
    const legs = route([a0, a1, ...zig(a1, b1), b1, b0]);
    if (e.open) continue;
    // blocked half way: a wrecked train on a long stretch, else a fall of rubble
    const mid = legs.slice(2, -2).sort((p, q) => (Math.abs(q.x1 - q.x0) + Math.abs(q.z1 - q.z0)) - (Math.abs(p.x1 - p.x0) + Math.abs(p.z1 - p.z0)))[0] ?? legs[Math.floor(legs.length / 2)];
    const len = Math.abs(mid.x1 - mid.x0) + Math.abs(mid.z1 - mid.z0), alongX = mid.z0 === mid.z1, cx = Math.round((mid.x0 + mid.x1) / 2), cz = Math.round((mid.z0 + mid.z1) / 2);
    const kind: MetroBlock['kind'] = len >= 20 && R() < 0.65 ? 'train' : 'rubble', bl = kind === 'train' ? 14 : 3, bh = kind === 'train' ? 5 : T.h;
    late.push(alongX ? { op: 'solid', x: cx - Math.floor(bl / 2), y: 0, z: cz - tw, w: bl, h: bh, d: T.wid } : { op: 'solid', x: cx - tw, y: 0, z: cz - Math.floor(bl / 2), w: T.wid, h: bh, d: bl });
    blocks.push({ kind, x: cx, z: cz, alongX, len: bl });
  }
  // dead ends: a short tunnel out of a hall's quieter end, into a fall of rubble
  for (const s of stations) {
    if (R() >= METRO.stub) continue;
    const sg = R() < 0.5 ? 1 : -1, far = ri(18, 30), side = ri(-10, 10);
    const [m0, m1] = mouth(s, s.alongX ? s.x + sg : s.x, s.alongX ? s.z : s.z + sg);
    const end = s.alongX ? [m1[0] + sg * far, m1[1] + side] : [m1[0] + side, m1[1] + sg * far];
    const legs = route([m0, m1, end]), last = legs[legs.length - 1];
    if (last) ends.push({ x: last.x1, z: last.z1, dx: Math.sign(last.x1 - last.x0), dz: Math.sign(last.z1 - last.z0) });
  }
  // maintenance niches off the long stretches, with a chest (sometimes crystals growing)
  const niches: Op[] = [];
  for (const p of pieces) {
    const len = Math.abs(p.x1 - p.x0) + Math.abs(p.z1 - p.z0);
    if (len < 12 || R() >= METRO.niche) continue;
    const alongX = p.z0 === p.z1, cx = Math.round((p.x0 + p.x1) / 2), cz = Math.round((p.z0 + p.z1) / 2), sd = R() < 0.5 ? 1 : -1;
    if (blocks.some((b) => Math.hypot(b.x - cx, b.z - cz) < b.len / 2 + 6)) continue; // not walled in by a blockage
    const box = alongX ? { x: cx - 1, z: sd > 0 ? cz + tw : cz - tw - 3, w: 3, d: 3 } : { x: sd > 0 ? cx + tw : cx - tw - 3, z: cz - 1, w: 3, d: 3 };
    niches.push({ op: 'room', ...box, y: 0, h: 3 }); boxes.push({ ...box, h: 3, tunnel: false });
    chests.push({ x: box.x + 1, z: box.z + 1 });
    if (R() < 0.35) crystals.push({ x: box.x + (R() < 0.5 ? 0 : 2), z: box.z + (R() < 0.5 ? 0 : 2) });
  }
  // ---- stairs up at the entrance stations, on a long wall ----
  const all = [...halls, ...tunnels, ...niches], stairOps: Op[] = [], portals: PortalSpec[] = [];
  const hits = (A: { x: number; z: number; w: number; d: number }, B: { x: number; z: number; w: number; d: number }) => A.x < B.x + B.w && A.x + A.w > B.x && A.z < B.z + B.d && A.z + A.d > B.z;
  const taken: { x: number; z: number; w: number; d: number }[] = [];
  for (const s of stations) {
    if (s.entrance < 0) continue;
    const dirs: Dir[] = s.alongX ? ['N', 'S'] : ['W', 'E'];
    let done = false;
    for (const off of [3, -3, 9, -9, 0, 12, -12]) for (const dir of dirs) {
      if (done) break;
      const m = dir === 'N' ? s.hall.z - 1 : dir === 'S' ? s.hall.z + s.hall.d : dir === 'W' ? s.hall.x - 1 : s.hall.x + s.hall.w;
      const c = (s.alongX ? s.x : s.z) + off, probe = sbox(dir, m, c, 0, SL + 1, 0, 1, 'x', 2);
      if (all.some((o) => o !== halls[s.k] && hits(probe, o)) || taken.some((o) => hits(probe, o))) continue;
      taken.push(probe); stairOps.push(...stairOpsFor(dir, m, c, true));
      portals.push({ key: 'V' + s.entrance, dir, m, c, up: true, axis: DIRV[dir][0] ? 'x' : 'z', y0: P }); done = true;
    }
  }
  // ---- who and what is down here ----
  // the boss waits in the underground station furthest (in stops) from the first entrance
  const hops = new Array(n).fill(Infinity); hops[0] = 0;
  for (let it = 0; it < n; it++) for (const e of edges) if (e.open) { hops[e.b] = Math.min(hops[e.b], hops[e.a] + 1); hops[e.a] = Math.min(hops[e.a], hops[e.b] + 1); }
  const deep = stations.filter((s) => s.entrance < 0).sort((a, b) => hops[b.k] - hops[a.k] || a.k - b.k)[0];
  const bosses: BossSpec[] = deep ? [{ x: deep.x + 0.5, z: deep.z + 0.5, room: deep.hall, guard: false }] : [];
  const G = rng(seed ^ 0x6a7d31), pick = (list: RobotKind[]) => list[Math.floor(G() * list.length)];
  for (const s of stations) {
    if (s === deep) continue;
    const plat = (sd: number) => (s.alongX ? { x: s.x + Math.round((G() - 0.5) * 20), z: s.z + sd } : { x: s.x + sd, z: s.z + Math.round((G() - 0.5) * 20) });
    // the robots keep to the trench (they do not climb onto the platforms); the chests stand on a platform
    if (s.entrance >= 0) { if (G() < 0.45) guards.push({ kind: pick(['scout', 'guardian']), ...plat(-1) }); }
    else {
      guards.push({ kind: pick(['guardian', 'sentinel', 'assault', 'repair']), ...plat(-1) });
      if (G() < 0.6) guards.push({ kind: pick(['sentinel', 'assault', 'guardian']), ...plat(0) });
      chests.push(plat(G() < 0.5 ? -4 : 3));
    }
  }
  for (const p of pieces) {
    const len = Math.abs(p.x1 - p.x0) + Math.abs(p.z1 - p.z0);
    if (len >= 14 && G() < 0.22) guards.push({ kind: pick(['scout', 'scout', 'guardian']), x: Math.round((p.x0 + p.x1) / 2), z: Math.round((p.z0 + p.z1) / 2) });
  }
  const s0 = stations.find((s) => s.entrance === 0) ?? stations[0];
  const map: DungeonMap = {
    seed, spawn: [s0.x + 0.5, 0, s0.z + 0.5], ops: [...halls, ...solids, ...tunnels, ...niches, ...stairOps.map((o) => ({ ...o, y: o.y + P })), ...late],
    rooms: n + niches.length, chests, crystals, hatch: null, portals, doorCands: [], bosses, gates: [], boxes, style: 'metro', guards,
    metro: { city: city.i, name: city.name, stations, rails, blocks, ends, steps, decks },
  };
  cache.set(key, map);
  return map;
}
