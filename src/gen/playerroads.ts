// (0.280, PLAN_DROG.md stage D1) Roads the players build: a dirt track between two points of the infrastructure (a
// village gate, an outpost, a warehouse, a port, a road already there). Surveyed with the Surveyor's Poles: the way is
// staked out point by point (or laid out by the surveyors to a place you name), checked for water, steep ground,
// places and villages; then the materials and the diggers' wages are brought to its sign, and the diggers work the
// track from its start to its end over game hours. A finished track lies in the land: the ground is graded flat across
// it (following the land along its middle, kept dry over swamp pools), trees, rocks and plants keep off it.
//
// Pure: the state is the shared `Char.proads` (id → PlayerRoad); every game derives the same work front and the same
// moment the track is done from the game clock, so nothing more is sent.
import type { ItemKey } from '../data/items';
import type { Road } from './roads';
import { tl, TL } from '../i18n';

export const PROAD = {
  /** Half the track's width (m); the seed's roads are 2.3. */
  half: 2.1,
  /** A staked stretch: at most and at least this long (m). */
  seg: 70, minSeg: 6,
  /** The steepest a track climbs (rise / run over `sample` m). */
  grade: 0.2,
  /** How finely the way is checked (m). */
  sample: 4,
  /** The longest track a survey stakes out (m) and the most stakes. */
  len: 8000, pts: 240,
  /** How near the aim an end snaps to a point of the infrastructure (m), and to a road (m). */
  snap: 22, snapRoad: 10,
  /** The ends at least this far apart (m). */
  apart: 60,
  /** What a metre of track takes: a stone per `stone` m (culverts, the wet spots), a plank per `planks` m (pegs,
   *  culverts); the diggers' wages a metre (gold); hours of work: `hours0` + `perKm` a km; xp a metre. */
  per: { stone: 16, planks: 22 } as Partial<Record<ItemKey, number>>,
  wage: 0.35, hours0: 2, perKm: 6, xp: 0.15,
  /** Unfinished sites one hero may have staked out at once. */
  open: 2,
  /** The surveyors' search: the finest grid (m; coarser for a long way so it stays within `cells`), the margin round the two ends (m). */
  grid: 12, margin: 360, cells: 70000,
};

/** What an end of a track meets. */
export interface RoadEnd { kind: 'gate' | 'outpost' | 'warehouse' | 'road' | 'track'; id: string; name: string; x: number; z: number; /** a gate's side: N / E / S / W */ dir?: string }
/** A track the players build (`Char.proads[id]`). x as staked (drawn on the player's copy of the planet). */
export interface PlayerRoad {
  id: string; name: string;
  pts: [number, number][];
  a: RoadEnd; b: RoadEnd;
  /** Its length (m), its hours of work. */
  len: number; h: number;
  /** Materials handed over, wages paid (gold). */
  given: Partial<Record<ItemKey, number>>; paid: number;
  /** When the diggers started (game minutes): set once everything is in. */
  t0?: number;
  /** Who staked it out (name, pid) and when. */
  by: string; pid: string; t: number;
}

export const roadLength = (pts: [number, number][]) => { let s = 0; for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return s; };
export const roadHours = (len: number) => Math.round((PROAD.hours0 + len / 1000 * PROAD.perKm) * 10) / 10;
export const roadWage = (len: number) => Math.round(len * PROAD.wage);
export const roadXp = (len: number) => Math.round(len * PROAD.xp);
export function roadNeeds(len: number): [ItemKey, number][] {
  return (Object.entries(PROAD.per) as [ItemKey, number][]).map(([k, m]) => [k, Math.max(1, Math.ceil(len / m))]);
}
export function roadRows(r: PlayerRoad): { k: ItemKey; n: number; given: number }[] {
  return roadNeeds(r.len).map(([k, n]) => ({ k, n, given: Math.min(n, r.given[k] ?? 0) }));
}
/** Everything in and paid? */
export const roadReady = (r: PlayerRoad) => roadRows(r).every((w) => w.given >= w.n) && r.paid >= roadWage(r.len);
/** Hand over what you have (`have`) and up to `gold` of the wages; the diggers start at `now` once everything is in. */
export function handOverRoad(r: PlayerRoad, have: (k: ItemKey) => number, gold: number, now: number): { taken: [ItemKey, number][]; paid: number; started: boolean } {
  if (r.t0 !== undefined) return { taken: [], paid: 0, started: false };
  const taken: [ItemKey, number][] = [];
  for (const w of roadRows(r)) {
    const n = Math.min(w.n - w.given, have(w.k));
    if (n > 0) { r.given[w.k] = (r.given[w.k] ?? 0) + n; taken.push([w.k, n]); }
  }
  const paid = Math.max(0, Math.min(Math.floor(gold), roadWage(r.len) - r.paid));
  r.paid += paid;
  const started = roadReady(r);
  if (started) r.t0 = now;
  return { taken, paid, started };
}
/** How far the work has come (0..1); 0 before the diggers start. */
export const roadShare = (r: PlayerRoad, now: number) => (r.t0 === undefined ? 0 : Math.max(0, Math.min(1, (now - r.t0) / (r.h * 60))));
export const roadBuilt = (r: PlayerRoad, now: number) => r.t0 !== undefined && now >= r.t0 + r.h * 60;
/** Game minutes until it is done (Infinity before the work starts). */
export const roadLeft = (r: PlayerRoad, now: number) => (r.t0 === undefined ? Infinity : Math.max(0, r.t0 + r.h * 60 - now));

/** The point `d` metres along a polyline, and the direction there. */
export function along(pts: [number, number][], d: number): { x: number; z: number; dx: number; dz: number; i: number } {
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i], L = Math.hypot(bx - ax, bz - az);
    if (d <= L || i === pts.length - 1) { const t = L ? Math.max(0, Math.min(1, d / L)) : 0; return { x: ax + (bx - ax) * t, z: az + (bz - az) * t, dx: L ? (bx - ax) / L : 1, dz: L ? (bz - az) / L : 0, i }; }
    d -= L;
  }
  const [x, z] = pts[0]; return { x, z, dx: 1, dz: 0, i: 0 };
}
/** The staked points rounded off (Chaikin twice, the ends kept) for the land and the drawing. */
export function smoothPts(pts: [number, number][]): [number, number][] {
  let p = pts;
  for (let k = 0; k < 2 && p.length > 2; k++) {
    const q: [number, number][] = [p[0]];
    for (let i = 0; i + 1 < p.length; i++) {
      const [ax, az] = p[i], [bx, bz] = p[i + 1];
      q.push([ax * 0.75 + bx * 0.25, az * 0.75 + bz * 0.25], [ax * 0.25 + bx * 0.75, az * 0.25 + bz * 0.75]);
    }
    q.push(p[p.length - 1]); p = q;
  }
  return p;
}
/** The finished tracks as roads for the terrain (gen/terrain.ts `setWays`): graded, trees kept off. */
export function terrainWays(roads: Record<string, PlayerRoad | undefined>, now: number): Road[] {
  return Object.values(roads).filter((r): r is PlayerRoad => !!r && roadBuilt(r, now)).sort((a, b) => (a.id < b.id ? -1 : 1))
    .map((r) => ({ id: 'proad:' + r.id, from: -1, to: -1, gate: 'player', pts: smoothPts(r.pts), half: PROAD.half, name: r.name }));
}
/** A key of which tracks are finished: when it changes the land changes. */
export const waysKey = (roads: Record<string, PlayerRoad | undefined>, now: number) => Object.values(roads).filter((r) => r && roadBuilt(r, now)).map((r) => r!.id).sort().join(',');

// ---------- the survey ----------
/** What the survey asks of the land: the ground a track would lie on, and why a spot is no place for it ('' = fine). */
export interface RoadGround { h(x: number, z: number): number; bad(x: number, z: number): string }
/** How near an end of the infrastructure the land's objections are let off (m). */
const END_FREE = 8;
/** Why the stretch a → b cannot be a track ('' = it can): every `sample` m the land must allow it, and no climb
 *  steeper than `grade`. `freeA` / `freeB`: that end meets a place of the infrastructure, so the land's objections
 *  within `END_FREE` m of it do not count (a gate stands at the village's edge). */
export function stretchProblem(g: RoadGround, a: [number, number], b: [number, number], freeA = false, freeB = false): string {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / PROAD.sample));
  let prev = g.h(a[0], a[1]);
  for (let i = 1; i <= n; i++) {
    const t = i / n, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
    if (!(freeA && t * L < END_FREE) && !(freeB && (1 - t) * L < END_FREE)) { const why = g.bad(x, z); if (why) return why; }
    const h = g.h(x, z), rise = Math.abs(h - prev) / (L / n);
    if (rise > PROAD.grade) return TL`Too steep: the track would climb ${Math.round(rise * 100)}% here (at most ${Math.round(PROAD.grade * 100)}%).`;
    prev = h;
  }
  return '';
}
/** Why a staked way cannot be built ('' = it can). */
export function routeProblem(g: RoadGround, pts: [number, number][]): string {
  if (pts.length < 2) return tl('Stake out the way first.');
  if (pts.length > PROAD.pts) return TL`Too many stakes (at most ${PROAD.pts}).`;
  const len = roadLength(pts);
  if (len > PROAD.len) return TL`Too long: ${Math.round(len)} m (a survey stakes out at most ${PROAD.len} m).`;
  for (let i = 1; i < pts.length; i++) { const w = stretchProblem(g, pts[i - 1], pts[i], i === 1, i === pts.length - 1); if (w) return w; }
  return '';
}

/**
 * The surveyors lay out a way from `from` to `to` over the land: an A* on a `grid` m lattice (eight ways), each step
 * costing its length, more for a climb, nothing where the land forbids it or the climb is too steep; then the way is
 * pulled straight wherever a stretch of at most `seg` m still passes (`stretchProblem`). The ends are always allowed.
 * Null when there is no way within `margin` of the two ends.
 */
export function proposeWay(g: RoadGround, from: [number, number], to: [number, number]): [number, number][] | null {
  const M = PROAD.margin, x0 = Math.min(from[0], to[0]) - M, z0 = Math.min(from[1], to[1]) - M;
  const spanX = Math.max(from[0], to[0]) + M - x0, spanZ = Math.max(from[1], to[1]) + M - z0;
  const S = Math.max(PROAD.grid, Math.ceil(Math.sqrt(spanX * spanZ / PROAD.cells))); // a coarser lattice for a longer way
  const W = Math.ceil(spanX / S) + 1, H = Math.ceil(spanZ / S) + 1;
  const cell = (x: number, z: number) => Math.round((x - x0) / S) + W * Math.round((z - z0) / S);
  const cx = (i: number) => x0 + (i % W) * S, cz = (i: number) => z0 + Math.floor(i / W) * S;
  const start = cell(...from), goal = cell(...to);
  const hs = new Float32Array(W * H).fill(NaN), ok = new Int8Array(W * H); // 0 unknown, 1 fine, -1 forbidden
  const hAt = (i: number) => { if (Number.isNaN(hs[i])) hs[i] = g.h(cx(i), cz(i)); return hs[i]; };
  const fine = (i: number) => { if (!ok[i]) ok[i] = i === start || i === goal || !g.bad(cx(i), cz(i)) ? 1 : -1; return ok[i] > 0; };
  const mids = new Map<number, boolean>();
  const gs = new Float32Array(W * H).fill(Infinity), came = new Int32Array(W * H).fill(-1), shut = new Uint8Array(W * H);
  const heap: [number, number][] = [];
  const push = (f: number, i: number) => { heap.push([f, i]); let k = heap.length - 1; while (k) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop()!; if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  const hx = cx(goal), hz = cz(goal), est = (i: number) => Math.hypot(cx(i) - hx, cz(i) - hz);
  gs[start] = 0; push(est(start), start);
  const steps = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  let found = false;
  while (heap.length) {
    const [, i] = pop();
    if (shut[i]) continue;
    if (i === goal) { found = true; break; }
    shut[i] = 1;
    const ix = i % W, iz = Math.floor(i / W);
    for (const [dx, dz] of steps) {
      const jx = ix + dx, jz = iz + dz;
      if (jx < 0 || jz < 0 || jx >= W || jz >= H) continue;
      const j = jx + W * jz;
      if (shut[j] || !fine(j)) continue;
      const lo = Math.min(i, j), gap = Math.abs(j - i), mk = lo * 4 + (gap === 1 ? 0 : gap === W ? 1 : gap === W + 1 ? 2 : 3); // the step's middle must allow it too (a thin wall between two fine cells)
      let mid = mids.get(mk);
      if (mid === undefined) { mid = !g.bad((cx(i) + cx(j)) / 2, (cz(i) + cz(j)) / 2); mids.set(mk, mid); }
      if (!mid) continue;
      const d = Math.hypot(dx, dz) * S, rise = Math.abs(hAt(j) - hAt(i)) / d;
      if (rise > PROAD.grade * 0.9) continue;
      const cost = gs[i] + d * (1 + 30 * rise * rise);
      if (cost < gs[j]) { gs[j] = cost; came[j] = i; push(cost + est(j), j); }
    }
  }
  if (!found) return null;
  const raw: [number, number][] = [];
  for (let i = goal; i >= 0; i = came[i]) raw.push([cx(i), cz(i)]);
  raw.reverse(); raw[0] = [from[0], from[1]]; raw[raw.length - 1] = [to[0], to[1]];
  // pulled straight: from each stake the furthest point a valid stretch reaches
  const out: [number, number][] = [raw[0]];
  let k = 0;
  while (k < raw.length - 1) {
    let best = k + 1;
    for (let j = k + 2; j < raw.length; j++) {
      if (Math.hypot(raw[j][0] - raw[k][0], raw[j][1] - raw[k][1]) > PROAD.seg) break;
      if (!stretchProblem(g, raw[k], raw[j], k === 0, j === raw.length - 1)) best = j;
    }
    out.push(raw[best]); k = best;
  }
  return out;
}

/** The track's name from its ends. */
export const roadName = (a: RoadEnd, b: RoadEnd) => `${a.name} – ${b.name}`;
/** Why a new track cannot be staked from a to b with these points ('' = it can). */
export function newRoadProblem(g: RoadGround, a: RoadEnd, b: RoadEnd, pts: [number, number][], mine: number): string {
  if (a.id === b.id) return tl('Both ends meet the same place: lead the track somewhere else.');
  if (Math.hypot(a.x - b.x, a.z - b.z) < PROAD.apart) return TL`The ends are too close: at least ${PROAD.apart} m apart.`;
  if (mine >= PROAD.open) return TL`You have ${mine} tracks staked out and not yet built: finish or pull one up first.`;
  return routeProblem(g, pts);
}
/** A new track's record (the work not yet started). */
export function newRoad(id: string, a: RoadEnd, b: RoadEnd, pts: [number, number][], by: string, pid: string, now: number): PlayerRoad {
  const len = Math.round(roadLength(pts));
  return { id, name: roadName(a, b), pts: pts.map(([x, z]) => [Math.round(x * 10) / 10, Math.round(z * 10) / 10]), a, b, len, h: roadHours(len), given: {}, paid: 0, by, pid, t: now };
}
