// (0.280, PLAN_DROG.md stage D1) Roads the players build: a dirt track between two points of the infrastructure (a
// village gate, an outpost, a warehouse, a port, a road already there). Surveyed with the Surveyor's Poles: the way is
// staked out point by point (or laid out by the surveyors to a place you name), checked for water, steep ground,
// places and villages; then the materials and the diggers' wages are brought to its sign, and the diggers work the
// track from its start to its end over game hours. A finished track lies in the land: the ground is graded flat across
// it (following the land along its middle, kept dry over swamp pools), trees, rocks and plants keep off it.
//
// Pure: the state is the shared `Char.proads` (id → PlayerRoad); every game derives the same work front and the same
// moment the track is done from the game clock, so nothing more is sent.
//
// (0.281, stage D2) The front and the crews: a track staked out from now on (`v` 2) is dug by a crew from its home
// (the nearest village or outpost with free hands within `hire` m of either end; the work starts from that end), as
// many diggers as are free there when the work starts (`crew`). The materials and the wages come bit by bit: the front
// only goes as far as they cover (`coverOf`), and without a road camp (`CAMP`, bunks at the front) only `walk` m from
// home. Heavy machines (`MACHINE`, from the Heavy Engineering Works) dig faster. The front is one anchor `fr` [metres,
// game minute] moved on by every hand-over (`settleFront`), so its place and the moment the track is done stay closed
// forms of the clock. Stone for the swamp fill (`wet` m), logs felled on the way (`logs`, taken at the sign as the
// front passes them). A river is crossed only on a built bridge (the survey's own concern, world/playerroads.ts).
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
  /** (0.281, D2) The crews: at most `crew` diggers, at least `minCrew`; each digs `dig` m a game minute; `setup` game
   *  minutes to pitch the camp before the front moves; a home within `hire` m of an end; the front goes `walk` m from
   *  home without a road camp; the work starts once `first` m (or the whole track) is covered. */
  crew: 8, minCrew: 2, dig: 0.45, setup: 90, hire: 2500, walk: 2200, first: 120,
  /** A stone per `wetStone` m of swamp fill; logs from a tree felled on the way (a big one ×3). */
  wetStone: 4, perTree: 2,
};
/** (0.281) The road camp (bunks and a cookhouse at the front): the diggers sleep there, so the front goes on past `walk`. */
export const CAMP: Partial<Record<ItemKey, number>> = { planks: 16, nails: 12, rope: 4, hide: 2 };
/** (0.281) A steam grader and a dump cart from the Heavy Engineering Works: the front moves `MACHINE_X` times as fast. */
export const MACHINE: Partial<Record<ItemKey, number>> = { engine: 2, gears: 2, steel: 2 };
export const MACHINE_X = 1.8;
export type RoadPart = 'camp' | 'mach';
export const PART_NEEDS: Record<RoadPart, Partial<Record<ItemKey, number>>> = { camp: CAMP, mach: MACHINE };
/** (0.281) Where a track's crew comes from: a village or an outpost, `d` m from the track's start. */
export interface RoadHome { id: string; k: 'village' | 'outpost'; name: string; x: number; z: number; d: number }

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
  /** (0.281, D2) 2 = dug by a crew from `home` along a supplied front; unset = a D1 track (all in, then `h` hours). */
  v?: 2;
  home?: RoadHome;
  /** The diggers (set when the work starts). */
  crew?: number;
  /** The front's anchor: [metres dug, game minute]. */
  fr?: [number, number];
  /** The camp and the machines: handed over, and built. */
  parts?: Partial<Record<RoadPart, Partial<Record<ItemKey, number>>>>;
  has?: Partial<Record<RoadPart, number>>;
  /** Metres of swamp to fill, logs to fell on the way, logs taken. */
  wet?: number; logs?: number; took?: number;
  /** (0.282, D3) The surface laid for its whole length (0 dirt, 1 gravel, 2 paved; unset = 0) and the upgrade under way. */
  cls?: number;
  up?: RoadUp;
}
/** (0.282, D3) Laying a better surface over a finished track: like the track's own work, a crew along a supplied front. */
export interface RoadUp {
  to: 1 | 2;
  given: Partial<Record<ItemKey, number>>; paid: number;
  t0?: number; fr?: [number, number]; crew?: number;
}
/**
 * (0.282, D3) The surfaces. `per`: a piece of each material per so many metres; `wage` gold a metre; `pace` the
 * crew's speed against digging the track; `speed` / `fuel` what driving on it does to a vehicle (data/vehicles.ts
 * reads `SURFACE` through the world's hook). Off the roads a vehicle goes slower and burns more.
 */
export const SURFACE_CLS = [
  { k: 'dirt', name: tl('Dirt track'), per: {}, wage: 0, pace: 1 },
  { k: 'gravel', name: tl('Gravel road'), per: { stone: 5, sand: 60 } as Partial<Record<ItemKey, number>>, wage: 0.2, pace: 1.6 },
  { k: 'paved', name: tl('Paved road'), per: { cutstone: 10, cement: 20, stone: 8 } as Partial<Record<ItemKey, number>>, wage: 0.3, pace: 0.8 },
] as const;
/** The surface of the whole track (what was laid before the upgrade under way). */
export const clsOf = (r: PlayerRoad) => r.cls ?? 0;

export const roadLength = (pts: [number, number][]) => { let s = 0; for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return s; };
export const roadHours = (len: number) => Math.round((PROAD.hours0 + len / 1000 * PROAD.perKm) * 10) / 10;
export const roadWage = (len: number) => Math.round(len * PROAD.wage);
export const roadXp = (len: number) => Math.round(len * PROAD.xp);
/** What a track takes; (0.281) `wet` m of swamp take a stone per `wetStone` m more. */
export function roadNeeds(len: number, wet = 0): [ItemKey, number][] {
  return (Object.entries(PROAD.per) as [ItemKey, number][]).map(([k, m]) => [k, Math.max(1, Math.ceil(len / m)) + (k === 'stone' && wet > 0 ? Math.ceil(wet / PROAD.wetStone) : 0)]);
}
export function roadRows(r: PlayerRoad): { k: ItemKey; n: number; given: number }[] {
  return roadNeeds(r.len, r.wet).map(([k, n]) => ({ k, n, given: Math.min(n, r.given[k] ?? 0) }));
}
/** Everything in and paid? */
export const roadReady = (r: PlayerRoad) => roadRows(r).every((w) => w.given >= w.n) && r.paid >= roadWage(r.len);
const isV2 = (r: PlayerRoad) => r.v === 2;
/** (0.281) How many metres the materials and the wages handed over so far cover (a D1 track: all or nothing). */
export function coverOf(r: PlayerRoad): number {
  let share = Math.min(1, r.paid / Math.max(1, roadWage(r.len)));
  for (const w of roadRows(r)) share = Math.min(share, w.given / w.n);
  return share >= 1 ? r.len : Math.floor(share * r.len);
}
/** Does the track want a road camp (its far end more than `walk` m from home)? */
export const campWanted = (r: PlayerRoad) => isV2(r) && !!r.home && r.home.d + r.len > PROAD.walk;
/** How far from the start the diggers go: the whole track with a camp (or when it is near home), else `walk` m from home. */
export const reachOf = (r: PlayerRoad) => (!campWanted(r) || r.has?.camp ? r.len : Math.max(0, Math.min(r.len, PROAD.walk - (r.home?.d ?? 0))));
/** The furthest the front may go now: what is supplied, and the camp's reach. */
export const capOf = (r: PlayerRoad) => Math.min(coverOf(r), reachOf(r));
/** Metres a game minute. */
export const paceOf = (r: PlayerRoad) => Math.max(1, r.crew ?? PROAD.minCrew) * PROAD.dig * (r.has?.mach ? MACHINE_X : 1);
/** The front (metres dug from the start) at `now`. */
export function frontAt(r: PlayerRoad, now: number): number {
  if (r.t0 === undefined) return 0;
  if (!isV2(r)) return Math.max(0, Math.min(1, (now - r.t0) / (r.h * 60))) * r.len;
  const [p, t] = r.fr ?? [0, r.t0];
  if (now >= doneAt(r)) return r.len;
  return now <= t ? p : Math.max(p, Math.min(capOf(r), p + paceOf(r) * (now - t)));
}
/** When the front reaches the end (Infinity while the supplies or the camp hold it back, or before the start). */
export function doneAt(r: PlayerRoad): number {
  if (r.t0 === undefined) return Infinity;
  if (!isV2(r)) return r.t0 + r.h * 60;
  const [p, t] = r.fr ?? [0, r.t0];
  return p >= r.len ? t : capOf(r) >= r.len ? t + (r.len - p) / paceOf(r) : Infinity;
}
/** Why the front stands still at `now` ('' = it moves or is done): 'supply' (materials or wages), 'camp'. */
export function stalled(r: PlayerRoad, now: number): '' | 'supply' | 'camp' {
  if (!isV2(r) || r.t0 === undefined || roadBuilt(r, now)) return '';
  const f = frontAt(r, now);
  if (f < capOf(r) - 0.01) return '';
  return coverOf(r) <= reachOf(r) ? 'supply' : 'camp';
}
/** Move the front's anchor to `now` (before anything that changes its pace or its cap). */
export function settleFront(r: PlayerRoad, now: number) {
  if (!isV2(r) || r.t0 === undefined) return;
  const t = (r.fr ?? [0, r.t0])[1];
  r.fr = [Math.round(frontAt(r, now) * 100) / 100, Math.max(now, t)];
}
/** (0.281) What the crew's home can send (the free hands, at most `crew`), worked out by the game (world/playerroads.ts). */
export type FreeHands = (home: RoadHome, now: number) => number;
/**
 * Hand over what you have (`have`) and up to `gold` of the wages. A D1 track: the diggers start at `now` once
 * everything is in. A D2 track: whatever is brought moves the front on; the work starts once `first` m are covered
 * and the home has `minCrew` free hands (`free`), the crew being as many as it has then.
 */
export function handOverRoad(r: PlayerRoad, have: (k: ItemKey) => number, gold: number, now: number, free?: FreeHands): { taken: [ItemKey, number][]; paid: number; started: boolean; noCrew?: boolean } {
  if (r.t0 !== undefined && (!isV2(r) || roadBuilt(r, now))) return { taken: [], paid: 0, started: false };
  settleFront(r, now);
  const taken: [ItemKey, number][] = [];
  for (const w of roadRows(r)) {
    const n = Math.min(w.n - w.given, have(w.k));
    if (n > 0) { r.given[w.k] = (r.given[w.k] ?? 0) + n; taken.push([w.k, n]); }
  }
  const paid = Math.max(0, Math.min(Math.floor(gold), roadWage(r.len) - r.paid));
  r.paid += paid;
  if (r.t0 !== undefined) return { taken, paid, started: false };
  if (!isV2(r)) {
    const started = roadReady(r);
    if (started) r.t0 = now;
    return { taken, paid, started };
  }
  if (coverOf(r) < Math.min(r.len, PROAD.first)) return { taken, paid, started: false };
  const crew = Math.min(PROAD.crew, Math.floor(r.home && free ? free(r.home, now) : PROAD.crew));
  if (crew < PROAD.minCrew) return { taken, paid, started: false, noCrew: true };
  r.t0 = now; r.crew = crew; r.fr = [0, now + PROAD.setup];
  return { taken, paid, started: true };
}
/** The camp's or the machines' rows. */
export function partRows(r: PlayerRoad, k: RoadPart): { k: ItemKey; n: number; given: number }[] {
  return (Object.entries(PART_NEEDS[k]) as [ItemKey, number][]).map(([i, n]) => ({ k: i, n, given: Math.min(n, r.parts?.[k]?.[i] ?? 0) }));
}
/** Hand over to the camp or the machines; built once everything is in (the front settled first: its pace or reach changes). */
export function handOverPart(r: PlayerRoad, k: RoadPart, have: (k: ItemKey) => number, now: number): { taken: [ItemKey, number][]; built: boolean } {
  if (!isV2(r) || r.has?.[k] || (roadBuilt(r, now) && !(r.up && !upDone(r, now)))) return { taken: [], built: false };
  const taken: [ItemKey, number][] = [];
  const got = ((r.parts ??= {})[k] ??= {});
  for (const w of partRows(r, k)) {
    const n = Math.min(w.n - w.given, have(w.k));
    if (n > 0) { got[w.k] = (got[w.k] ?? 0) + n; taken.push([w.k, n]); }
  }
  const built = partRows(r, k).every((w) => w.given >= w.n);
  if (built) { settleFront(r, now); settleUp(r, now); (r.has ??= {})[k] = now; }
  return { taken, built };
}
// ---------- (0.282, D3) a better surface ----------
export const upNeeds = (len: number, to: 1 | 2): [ItemKey, number][] => (Object.entries(SURFACE_CLS[to].per) as [ItemKey, number][]).map(([k, m]) => [k, Math.max(1, Math.ceil(len / m))]);
export const upWage = (len: number, to: 1 | 2) => Math.round(len * SURFACE_CLS[to].wage);
export const upXp = (len: number, to: 1 | 2) => Math.round(len * PROAD.xp * (to === 2 ? 1 : 0.6));
export function upRows(r: PlayerRoad): { k: ItemKey; n: number; given: number }[] {
  const u = r.up; if (!u) return [];
  return upNeeds(r.len, u.to).map(([k, n]) => ({ k, n, given: Math.min(n, u.given[k] ?? 0) }));
}
/** Metres of the upgrade the materials and wages cover. */
export function upCover(r: PlayerRoad): number {
  const u = r.up; if (!u) return 0;
  let share = Math.min(1, u.paid / Math.max(1, upWage(r.len, u.to)));
  for (const w of upRows(r)) share = Math.min(share, w.given / w.n);
  return share >= 1 ? r.len : Math.floor(share * r.len);
}
const upCap = (r: PlayerRoad) => Math.min(upCover(r), reachOf(r));
export const upPace = (r: PlayerRoad) => Math.max(1, r.up?.crew ?? PROAD.minCrew) * PROAD.dig * SURFACE_CLS[r.up?.to ?? 1].pace * (r.has?.mach ? MACHINE_X : 1);
/** When the upgrade's front reaches the end (Infinity while supplies or the camp hold it, or before it starts). */
export function upDoneAt(r: PlayerRoad): number {
  const u = r.up; if (!u || u.t0 === undefined) return Infinity;
  const [p, t] = u.fr ?? [0, u.t0];
  return p >= r.len ? t : upCap(r) >= r.len ? t + (r.len - p) / upPace(r) : Infinity;
}
/** The upgrade's front (metres from the start) at `now`. */
export function upFrontAt(r: PlayerRoad, now: number): number {
  const u = r.up; if (!u || u.t0 === undefined) return 0;
  if (now >= upDoneAt(r)) return r.len;
  const [p, t] = u.fr ?? [0, u.t0];
  return now <= t ? p : Math.max(p, Math.min(upCap(r), p + upPace(r) * (now - t)));
}
export const upDone = (r: PlayerRoad, now: number) => now >= upDoneAt(r);
/** Why the upgrade's front stands ('' = it moves, is done or not started). */
export function upStalled(r: PlayerRoad, now: number): '' | 'supply' | 'camp' {
  const u = r.up; if (!u || u.t0 === undefined || upDone(r, now)) return '';
  if (upFrontAt(r, now) < upCap(r) - 0.01) return '';
  return upCover(r) <= reachOf(r) ? 'supply' : 'camp';
}
function settleUp(r: PlayerRoad, now: number) {
  const u = r.up; if (!u || u.t0 === undefined) return;
  u.fr = [Math.round(upFrontAt(r, now) * 100) / 100, Math.max(now, (u.fr ?? [0, u.t0])[1])];
}
/** The surface `metres` from the start at `now`. */
export const clsAt = (r: PlayerRoad, metres: number, now: number) => (r.up && metres < upFrontAt(r, now) ? r.up.to : clsOf(r));
/** The surface the track can be upgraded to next (null at the best, or while an upgrade is still under way). */
export function nextCls(r: PlayerRoad, now: number): 1 | 2 | null {
  if (!roadBuilt(r, now)) return null;
  if (r.up && !upDone(r, now)) return null;
  const c = r.up ? r.up.to : clsOf(r);
  return c >= 2 ? null : ((c + 1) as 1 | 2);
}
/** Begin laying the next surface: a finished upgrade is folded into `cls` first. */
export function startUpgrade(r: PlayerRoad, now: number): boolean {
  const to = nextCls(r, now);
  if (!to) return false;
  if (r.up) r.cls = r.up.to;
  r.up = { to, given: {}, paid: 0 };
  return true;
}
/** Hand over to the upgrade; it starts like the track's own work (`first` m covered, `minCrew` free hands). */
export function handOverUp(r: PlayerRoad, have: (k: ItemKey) => number, gold: number, now: number, free?: FreeHands): { taken: [ItemKey, number][]; paid: number; started: boolean; noCrew?: boolean } {
  const u = r.up;
  if (!u || upDone(r, now)) return { taken: [], paid: 0, started: false };
  settleUp(r, now);
  const taken: [ItemKey, number][] = [];
  for (const w of upRows(r)) {
    const n = Math.min(w.n - w.given, have(w.k));
    if (n > 0) { u.given[w.k] = (u.given[w.k] ?? 0) + n; taken.push([w.k, n]); }
  }
  const paid = Math.max(0, Math.min(Math.floor(gold), upWage(r.len, u.to) - u.paid));
  u.paid += paid;
  if (u.t0 !== undefined) return { taken, paid, started: false };
  if (upCover(r) < Math.min(r.len, PROAD.first)) return { taken, paid, started: false };
  const crew = Math.min(PROAD.crew, Math.floor(r.home && free ? free(r.home, now) : PROAD.crew));
  if (crew < PROAD.minCrew) return { taken, paid, started: false, noCrew: true };
  u.t0 = now; u.crew = crew; u.fr = [0, now + PROAD.setup];
  return { taken, paid, started: true };
}
/** The work going on at the track now: the track's own, or a surface being laid; null when nothing is. */
export function workNow(r: PlayerRoad, now: number): { front: number; share: number; idle: '' | 'supply' | 'camp' | 'setup'; up: boolean } | null {
  if (!roadBuilt(r, now)) {
    if (r.t0 === undefined) return null;
    return { front: frontAt(r, now), share: roadShare(r, now), idle: now < (r.fr?.[1] ?? 0) ? 'setup' : stalled(r, now), up: false };
  }
  const u = r.up;
  if (!u || u.t0 === undefined || upDone(r, now)) return null;
  const f = upFrontAt(r, now);
  return { front: f, share: f / r.len, idle: now < (u.fr?.[1] ?? 0) ? 'setup' : upStalled(r, now), up: true };
}

/** Logs the diggers have felled on the way and stacked by the start's sign, not yet taken. */
export const logsReady = (r: PlayerRoad, now: number) => Math.max(0, Math.floor((r.logs ?? 0) * roadShare(r, now)) - (r.took ?? 0));
/** How far the work has come (0..1); 0 before the diggers start. */
export const roadShare = (r: PlayerRoad, now: number) => (r.len ? Math.max(0, Math.min(1, frontAt(r, now) / r.len)) : 0);
export const roadBuilt = (r: PlayerRoad, now: number) => now >= doneAt(r);
/** Game minutes until it is done (Infinity before the work starts or while it stands). */
export const roadLeft = (r: PlayerRoad, now: number) => Math.max(0, doneAt(r) - now);

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
/** (0.282) The surface changes on the land in steps of this many metres (each step redraws the ground along it). */
export const UP_STEP = 50;
/** How far the upgrade's surface is shown on the land (whole steps; the whole track once it is done). */
export const upShown = (r: PlayerRoad, now: number) => (!r.up || r.up.t0 === undefined ? 0 : upDone(r, now) ? r.len : Math.floor(upFrontAt(r, now) / UP_STEP) * UP_STEP);
/** The part of a polyline from `a` to `b` metres along it. */
export function slicePts(pts: [number, number][], a: number, b: number): [number, number][] {
  const out: [number, number][] = [];
  let d = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i], L = Math.hypot(bx - ax, bz - az), e = d + L;
    if (e >= a && d <= b && L > 0) {
      const t0 = Math.max(0, (a - d) / L), t1 = Math.min(1, (b - d) / L);
      if (!out.length) out.push([ax + (bx - ax) * t0, az + (bz - az) * t0]);
      out.push([ax + (bx - ax) * t1, az + (bz - az) * t1]);
    }
    d = e;
  }
  return out;
}
/** The finished tracks as roads for the terrain (gen/terrain.ts `setWays`): graded, trees kept off; (0.282) a track
 *  being surfaced comes in two pieces, the laid part with the new surface (`Road.cls`). */
export function terrainWays(roads: Record<string, PlayerRoad | undefined>, now: number): Road[] {
  const out: Road[] = [];
  for (const r of Object.values(roads).filter((r): r is PlayerRoad => !!r && roadBuilt(r, now)).sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const pts = smoothPts(r.pts), L = roadLength(pts), cut = upShown(r, now) / Math.max(1, r.len) * L;
    const base = { from: -1, to: -1, gate: 'player', half: PROAD.half, name: r.name };
    if (cut >= L - 0.01) out.push({ ...base, id: 'proad:' + r.id, pts, cls: r.up!.to });
    else if (cut > 1) out.push({ ...base, id: 'proad:' + r.id + ':up', pts: slicePts(pts, 0, cut), cls: r.up!.to }, { ...base, id: 'proad:' + r.id, pts: slicePts(pts, cut, L), cls: clsOf(r) });
    else out.push({ ...base, id: 'proad:' + r.id, pts, cls: clsOf(r) });
  }
  return out;
}
/** A key of which tracks are finished and how far their surface goes: when it changes the land changes. Each entry is
 *  `id|surface|metres laid of the new one`. */
export const waysKey = (roads: Record<string, PlayerRoad | undefined>, now: number) => Object.values(roads).filter((r) => r && roadBuilt(r, now)).map((r) => `${r!.id}|${clsOf(r!)}|${r!.up ? r!.up.to + ':' + upShown(r!, now) : ''}`).sort().join(',');

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
  // (0.281) the lattice sees the land only at its points: a way whose stretch still climbs too steeply between them
  // is searched again, keeping further from the limit
  for (const strict of [0.9, 0.75, 0.6]) {
    const way = searchWay(g, from, to, strict);
    if (!way) return null;
    if (!routeProblem(g, way)) return way;
  }
  return null;
}
function searchWay(g: RoadGround, from: [number, number], to: [number, number], strict: number): [number, number][] | null {
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
      if (rise > PROAD.grade * strict) continue;
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
/** A new track's record (the work not yet started); (0.281) with a home it is a D2 track, dug from its start. */
export function newRoad(id: string, a: RoadEnd, b: RoadEnd, pts: [number, number][], by: string, pid: string, now: number, d2?: { home: RoadHome; wet: number; logs: number }): PlayerRoad {
  const len = Math.round(roadLength(pts));
  const r: PlayerRoad = { id, name: roadName(a, b), pts: pts.map(([x, z]) => [Math.round(x * 10) / 10, Math.round(z * 10) / 10]), a, b, len, h: roadHours(len), given: {}, paid: 0, by, pid, t: now };
  if (d2) { r.v = 2; r.home = d2.home; r.wet = Math.round(d2.wet); r.logs = d2.logs; r.took = 0; }
  return r;
}
/** The home nearer the end b: the way reversed so the work starts at the home's end. */
export function startFrom<T extends { pts: [number, number][]; a: RoadEnd; b: RoadEnd }>(w: T, home: { x: number; z: number }): T {
  const da = Math.hypot(home.x - w.a.x, home.z - w.a.z), db = Math.hypot(home.x - w.b.x, home.z - w.b.z);
  return db < da ? { ...w, pts: [...w.pts].reverse(), a: w.b, b: w.a } : w;
}
