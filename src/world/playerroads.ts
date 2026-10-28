// (0.280, PLAN_DROG.md stage D1) The tracks the heroes build (gen/playerroads.ts) in the world: the survey with the
// Surveyor's Poles (a hologram of the staked way, each stretch checked as you aim, R lays out the way to a place, the
// right mouse button takes the last stake back), the building sites (stakes and tape along the way, a sign at each
// end, the diggers' camp moving along the front of the work with the graded earth behind it), and the finished tracks
// handed to the terrain (graded, trees kept off, an earthy strip) the moment the work is done, on every game alike.
// MP: the tracks are the shared `Char.proads`; the work's front and its end come from the game clock, so every game
// draws the same and changes the land at the same moment; nothing else is sent.
import * as THREE from 'three';
import { scene } from './render';
import { PropBatch } from './props';
import { textSprite, makeFigure, type Figure } from './npc';
import { poseRig } from './rig';
import { G } from '../game';
import { OW, rebuildChunksAlong } from './overworld';
import { driving } from './vehicles';
import { play } from './sound';
import { saveChar } from '../character';
import { logLine, showToast } from '../ui/hud';
import { allVillages, poisNear, nearX, worldDist, villageSeed, GRIDHOLM_ID, POLAR_Z, CHUNK } from '../gen/regions';
import { villageGates } from '../gen/village';
import { gatePoint, nearestOnRoad } from '../gen/roads';
import { rectDist } from '../gen/terrain';
import { inCity } from '../gen/cities';
import { nearRiver } from '../gen/rivers';
import { seaMask, SEA } from '../gen/seas';
import { lakesIn, shoreR } from '../gen/water';
import { megalithsNear } from '../gen/megaliths';
import { hubs } from '../gen/warehouses';
import { PROAD, along, smoothPts, terrainWays, waysKey, roadBuilt, roadShare, roadLength, stretchProblem, proposeWay, newRoadProblem, newRoad, roadRows, startFrom, stalled, logsReady, type PlayerRoad, type RoadEnd, type RoadGround, type RoadHome } from '../gen/playerroads';
import { regionFords, deckAt, type Ford } from '../gen/bridges';
import { regionOf, wrapDx } from '../gen/regions';
import { chunkTrees, TREE_SPAN } from '../gen/trees';
import { treeIn, biomeOfCell } from '../gen/biomes';
import { hash } from '../core/rng';
import { progressive } from '../gen/settlement';
import { assign } from '../gen/workforce';
import { workersAt } from '../gen/people';
import { lifeNow, crews } from '../gen/outpostlife';
import { tl, TL, DIR8 } from '../i18n';

const STAKE = 0xffd060, EARTH = 0xb8a060, POST = 0x1f9a44, WORKER = 0xdce8ff;
/** Tracks are drawn within this distance (m) of their way, dropped past `DROP`. */
const NEAR = 650, DROP = 800;

// ---------- the land as the survey sees it ----------
const DIR_WORD: Record<string, string> = { N: DIR8[0], E: DIR8[2], S: DIR8[4], W: DIR8[6] };
/** What the survey asks of the land here (gen/playerroads.ts RoadGround). */
export function roadGround(): RoadGround | null {
  const T = OW.terrain;
  if (!T) return null;
  const w = T.world;
  return {
    h: (x, z) => (nearRiver(w, x, z, 3) ? builtDeck(x, z) ?? T.dry(x, z) : T.dry(x, z)),
    bad(x, z) {
      if (Math.abs(z) > POLAR_Z) return tl('The ice: no track holds there.');
      if (inCity(w, x, z, 8)) return tl('A dead city: its streets are blocked with rubble.');
      for (const p of poisNear(w, x, z, 120)) {
        if (p.type === 'village') { const r = p.rect; if (x > r.x0 + 1 && x < r.x1 - 1 && z > r.z0 + 1 && z < r.z1 - 1) return TL`${p.name}: a track leads to its gate, not through the village.`; continue; }
        if (rectDist(p.rect, x, z) < 6) return TL`${p.name} stands in the way: go round it.`;
      }
      if (megalithsNear(w, x, z, 6).length) return tl('Old stones stand in the way.');
      if (seaMask(w, x, z) > 0 && T.base(x, z) < SEA.level + 0.4) return tl('The sea.');
      if (nearRiver(w, x, z, 3) && builtDeck(x, z) === null) return tl('A river: a track crosses only on a bridge. Build one first (a Bridge Kit, or at a ford), then stake the track over it.');
      for (const l of lakesIn(T, { x0: x - 1, z0: z - 1, x1: x + 1, z1: z + 1 })) if (Math.hypot(x - l.x, z - l.z) < shoreR(l, Math.atan2(z - l.z, x - l.x)) + 3) return tl('A lake.');
      return '';
    },
  };
}

/** (0.281, D2) The deck of a finished bridge under (x, z) (at a ford or placed with a Bridge Kit), or null: a track may cross a river there. */
export function builtDeck(x: number, z: number): number | null {
  const T = OW.terrain, c = G.char;
  if (!T) return null;
  const [rx, rz] = regionOf(x, z), all: Ford[] = [];
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) all.push(...regionFords(T.world, rx + i, rz + j, (px, pz) => T.heightAt(px, pz)));
  for (const f of c.bridgeSites) all.push({ ...f, x: x + wrapDx(f.x - x) });
  for (const f of all) if (c.bridges[f.id]?.done && Math.abs(f.x - x) < 60 && Math.abs(f.z - z) < 60) { const y = deckAt(f, x, z); if (y !== null) return y; }
  return null;
}

// ---------- the crews (0.281, D2) ----------
/** The free hands a home can send now: a settlement's people not at a post, any other village hires diggers, an outpost's idle settlers. */
export function freeHands(home: RoadHome, now: number): number {
  const c = G.char, w = c.world;
  if (home.k === 'village') {
    const vid = Number(home.id), v = allVillages(w).find((p) => p.id === vid);
    if (!v) return 0;
    const s = c.towns[vid];
    if (!progressive(s)) return PROAD.crew;
    return assign(s, workersAt(villageSeed(w, v), vid === GRIDHOLM_ID, s, now)).free;
  }
  const o = c.outposts[home.id];
  return o?.life ? crews(o, lifeNow(w, o, now).n).idle : 0;
}
/** The crew's home for a way from a to b: the nearest village or outpost with people within `hire` m of either end
 *  (one with free hands now first); null when none. `d` is set from the end nearer to it. */
export function findHome(a: RoadEnd, b: RoadEnd): RoadHome | null {
  const c = G.char, w = c.world, now = c.time, cand: RoadHome[] = [];
  const dEnd = (x: number, z: number) => Math.min(worldDist(x, z, a.x, a.z), worldDist(x, z, b.x, b.z));
  for (const v of allVillages(w)) { const d = dEnd(v.x, v.z); if (d < PROAD.hire) cand.push({ id: String(v.id), k: 'village', name: v.name, x: nearX(v.x, a.x), z: v.z, d }); }
  for (const [id, o] of Object.entries(c.outposts)) if (o?.life && typeof o.x === 'number') { const d = dEnd(o.x, o.z); if (d < PROAD.hire) cand.push({ id, k: 'outpost', name: o.name, x: nearX(o.x, a.x), z: o.z, d }); }
  if (!cand.length) return null;
  cand.sort((p, q) => (freeHands(q, now) >= PROAD.minCrew ? 1 : 0) - (freeHands(p, now) >= PROAD.minCrew ? 1 : 0) || p.d - q.d);
  return { ...cand[0], d: Math.round(cand[0].d) };
}
/** Metres of swamp along a way and the trees standing on it (big ones count `3`), for the fill and the logs. */
function alongWay(pts: [number, number][]): { wet: number; logs: number } {
  const T = OW.terrain!, sp = smoothPts(pts), L = roadLength(sp);
  let wet = 0;
  const chunks = new Set<string>();
  for (let d = 0; d <= L; d += 4) {
    const p = along(sp, d), l = T.swampLevel(p.x, p.z);
    if (l !== null && T.base(p.x, p.z) < l) wet += 4;
    for (const s of [-1, 1]) chunks.add(Math.floor((p.x - p.dz * 4 * s) / CHUNK) + ',' + Math.floor((p.z + p.dx * 4 * s) / CHUNK));
  }
  let logs = 0;
  const way = { id: '', from: 0, to: 0, gate: '', half: 0, pts: sp };
  for (const k of chunks) {
    const [cx, cz] = k.split(',').map(Number);
    for (const t of chunkTrees(T, cx, cz)) {
      if (Math.abs(t.z) > POLAR_Z) continue;
      const big = TREE_SPAN[t.kind] > 0;
      if (!treeIn(biomeOfCell(T.world, t.x, t.z), hash(t.seed, 0xb10e), big)) continue;
      if (nearestOnRoad(way, t.x, t.z)[0] < PROAD.half + 1.5 + (big ? TREE_SPAN[t.kind] * 0.5 : 0)) logs += PROAD.perTree * (big ? 3 : 1);
    }
  }
  return { wet, logs };
}

// ---------- the places a track may start and end at ----------
/** The ends near (x, z): village gates, outposts, warehouses and ports (points), the roads and tracks (their nearest point). */
export function anchorsNear(x: number, z: number): RoadEnd[] {
  const T = OW.terrain, c = G.char;
  if (!T) return [];
  const w = T.world, out: RoadEnd[] = [];
  for (const v of allVillages(w)) {
    if (worldDist(v.x, v.z, x, z) > 400) continue;
    for (const d of villageGates(villageSeed(w, v), v.id === GRIDHOLM_ID)) {
      const [gx, gz] = gatePoint(v, d as 'N' | 'E' | 'S' | 'W');
      out.push({ kind: 'gate', id: `g:${v.id}:${d}`, name: v.name, x: nearX(gx, x), z: gz, dir: d }); // the track takes the village's name; the hints name the gate
    }
  }
  for (const h of hubs(w, c.towns, c.outposts)) if (h.kind === 'village' && worldDist(h.x, h.z, x, z) < 400) out.push({ kind: 'warehouse', id: 'h:' + h.id, name: h.name, x: nearX(h.x, x), z: h.z });
  for (const [id, o] of Object.entries(c.outposts)) {
    if (!o || typeof o.x !== 'number' || worldDist(o.x, o.z, x, z) > 400) continue;
    out.push({ kind: o.k === 'port' || o.k === 'store' ? 'warehouse' : 'outpost', id: 'o:' + id, name: o.name, x: nearX(o.x, x), z: o.z });
  }
  // a road or a track: where it passes nearest the aim
  const f = T.chunkFeatures(Math.floor(x / CHUNK), Math.floor(z / CHUNK));
  for (const r of f.roads) {
    if (r.h) continue;
    const [d, px, pz] = nearestOnRoad(r, x, z);
    if (d < PROAD.snapRoad) out.push({ kind: 'road', id: 'r:' + r.id, name: roadWord(r.from, r.to), x: px, z: pz });
  }
  for (const r of Object.values(c.proads)) {
    if (!r) continue;
    const sx = nearX(r.pts[0][0], x) - r.pts[0][0];
    const [d, px, pz] = nearestOnRoad({ id: '', from: 0, to: 0, gate: '', half: 0, pts: r.pts.map(([a, b]) => [a + sx, b] as [number, number]) }, x, z);
    if (d < PROAD.snapRoad) out.push({ kind: 'track', id: 't:' + r.id, name: r.name, x: px, z: pz });
  }
  return out;
}
function roadWord(a: number, b: number): string {
  const vs = allVillages(G.char.world), A = vs.find((v) => v.id === a)?.name, B = vs.find((v) => v.id === b)?.name;
  return A && B ? TL`the ${A}–${B} road` : tl('the road');
}
/** How an end reads in the hints. */
export function endWord(e: RoadEnd): string {
  if (e.kind === 'gate') return e.dir ? TL`the ${DIR_WORD[e.dir] ?? e.dir} gate of ${e.name}` : TL`a gate of ${e.name}`;
  if (e.kind === 'track') return TL`the track ${e.name}`;
  return e.name;
}
/** The end nearest (x, z) within the snap. */
function snapAt(x: number, z: number, not?: string): RoadEnd | null {
  let best: RoadEnd | null = null, bd = Infinity;
  for (const a of anchorsNear(x, z)) {
    if (a.id === not) continue;
    const way = a.kind === 'road' || a.kind === 'track', d = Math.hypot(a.x - x, a.z - z) + (way ? 1000 : 0); // a gate, an outpost or a warehouse wins over the road passing it
    if (d - (way ? 1000 : 0) < (way ? PROAD.snapRoad : PROAD.snap) && d < bd) { bd = d; best = a; }
  }
  return best;
}

// ---------- the survey ----------
interface Survey { pts: [number, number][]; a: RoadEnd | null; b: RoadEnd | null; aim: [number, number]; snap: RoadEnd | null; problem: string; last: { x: number; z: number; t: number; n: number } }
let sv: Survey | null = null, preview: THREE.Group | null = null;
const OK = 0xe8fff0, BAD = 0xff5a3c, END = 0xffd060;
const mat = (c: number, o: number) => new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: o, depthTest: false, fog: false });
const matOk = mat(OK, 0.9), matDim = mat(OK, 0.4), matBad = mat(BAD, 0.9), matEnd = mat(END, 0.95);
export const isRoadSurvey = () => !!sv;
/** Use the Surveyor's Poles: start staking out a track. */
export function startRoadSurvey(): boolean {
  if (G.char.loc !== 'overworld' || !OW.terrain) { logLine(tl('Tracks are laid out outdoors.')); return false; }
  if (driving.v) { logLine(tl('Get out of the vehicle first.')); return false; }
  sv = { pts: [], a: null, b: null, aim: [G.pos.x, G.pos.z], snap: null, problem: '', last: { x: NaN, z: NaN, t: 0, n: -1 } };
  logLine(tl('The survey: look at a village gate, an outpost, a warehouse or a road and click to start the track there. Click on to set each stake, R lets the surveyors lay out the way to the place you look at (or your map\'s waypoint), the right mouse button takes the last stake back, Esc gives up.'));
  return true;
}
export function cancelRoadSurvey(quiet = false) {
  if (!sv) return;
  sv = null;
  if (preview) { scene.remove(preview); preview.traverse((o) => (o as THREE.Line).geometry?.dispose()); preview = null; }
  if (!quiet) logLine(tl('You fold the poles away.'));
}
/** The right mouse button: the last stake back (none left: the survey ends). */
export function undoRoadStake() {
  if (!sv) return;
  if (!sv.pts.length) { cancelRoadSurvey(); return; }
  sv.pts.pop(); sv.b = null;
  if (!sv.pts.length) sv.a = null;
  sv.last.n = -1;
}
const lenNow = () => (sv ? roadLength(sv.pts) : 0);
export function roadSurveyHint(): string | null {
  if (!sv) return null;
  if (sv.problem) return sv.problem;
  if (!sv.a) return sv.snap ? TL`Click — start the track at ${endWord(sv.snap)} · Esc — give up` : tl('Look at a village gate, an outpost, a warehouse or a road to start the track there · Esc — give up');
  const len = Math.round(lenNow() + Math.hypot(sv.aim[0] - sv.pts[sv.pts.length - 1][0], sv.aim[1] - sv.pts[sv.pts.length - 1][1]));
  if (sv.b) return TL`${Math.round(lenNow())} m to ${endWord(sv.b)}: click to stake out the track · right mouse — take the last stake back`;
  if (sv.snap) return TL`Click — end the track at ${endWord(sv.snap)} (${len} m) · R — let the surveyors lay out the way`;
  return TL`Click — set a stake (${len} m so far) · R — the surveyors lay out the way to what you look at · right mouse — back · Esc — give up`;
}
export const roadSurveyOk = () => !!sv && !sv.problem && (!!sv.a || !!sv.snap);
/** The ground point the player looks at (up to 140 m away). */
function aim(): [number, number] {
  const T = OW.terrain!, cp = Math.cos(G.pitch), dx = -Math.sin(G.yaw) * cp, dy = Math.sin(G.pitch), dz = -Math.cos(G.yaw) * cp, y0 = G.pos.y + 1.6;
  for (let t = 2; t <= 140; t += 0.75) { const x = G.pos.x + dx * t, z = G.pos.z + dz * t; if (y0 + dy * t <= Math.max(T.heightAt(x, z), T.water(x, z)?.level ?? -Infinity)) return [x, z]; }
  const h = Math.hypot(dx, dz) || 1; return [G.pos.x + dx / h * 40, G.pos.z + dz / h * 40];
}
const mine = () => Object.values(G.char.proads).filter((r) => r && r.pid === G.char.pid && r.t0 === undefined).length;
/** Click (or E): start, set a stake, or finish. */
export function confirmRoadSurvey() {
  if (!sv) return;
  const g = roadGround(); if (!g) return;
  if (!sv.a) {
    if (!sv.snap) { logLine(tl('Start by a village gate, an outpost, a warehouse or a road.')); return; }
    sv.a = sv.snap; sv.pts = [[sv.snap.x, sv.snap.z]]; sv.last.n = -1;
    logLine(TL`The first pole stands at ${endWord(sv.a)}.`); return;
  }
  if (sv.b) { finish(g, sv.b); return; }
  if (sv.problem) { logLine(sv.problem); return; }
  const end = sv.snap && sv.snap.id !== sv.a.id ? sv.snap : null, p: [number, number] = end ? [end.x, end.z] : sv.aim;
  const prev = sv.pts[sv.pts.length - 1];
  if (Math.hypot(p[0] - prev[0], p[1] - prev[1]) < PROAD.minSeg) { if (!end) return; }
  sv.pts.push(p); sv.last.n = -1;
  if (end) finish(g, end);
}
function finish(g: RoadGround, b: RoadEnd) {
  if (!sv?.a) return;
  const why = newRoadProblem(g, sv.a, b, sv.pts, mine());
  if (why) { logLine(why); showToast(tl('The track cannot be staked out')); sv.b = null; return; }
  const home = findHome(sv.a, b);
  if (!home) { logLine(TL`No village or outpost with people lies within ${PROAD.hire / 1000} km of either end: nobody could dig this track.`); showToast(tl('The track cannot be staked out')); sv.b = null; return; }
  const c = G.char, id = `${c.pid}:${Math.round(c.time)}`, way = startFrom({ pts: sv.pts, a: { ...sv.a }, b: { ...b } }, home);
  const r = newRoad(id, way.a, way.b, way.pts, c.name || tl('a castaway'), c.pid, c.time, { home: { ...home, d: Math.round(worldDist(home.x, home.z, way.a.x, way.a.z)) }, ...alongWay(way.pts) });
  c.proads[id] = r; saveChar();
  cancelRoadSurvey(true); scanT = 0;
  showToast(tl('Track staked out'));
  logLine(TL`The track ${r.name} is staked out: ${r.len} m. The diggers will come from ${home.name} and work from ${endWord(r.a)}. Bring the materials and the wages to its sign (or to the diggers at the front), bit by bit: the front goes as far as they cover.`);
}
/** R: the surveyors lay out the way from the last stake to the place you look at, or your map's waypoint. */
export function proposeRoad(): boolean {
  if (!sv) return false;
  const g = roadGround(); if (!g) return true;
  if (!sv.a) { logLine(tl('Start the track first: click by a gate, an outpost, a warehouse or a road.')); return true; }
  const wp = G.char.waypoint, look = sv.aim;
  let target: RoadEnd | null = null;
  if (wp) { let bd = 500; for (const a of anchorsNear(nearX(wp[0], G.pos.x), wp[1])) { const d = Math.hypot(a.x - nearX(wp[0], G.pos.x), a.z - wp[1]); if (a.id !== sv.a.id && d < bd) { bd = d; target = a; } } }
  if (!target) { let bd = 350; for (const a of anchorsNear(look[0], look[1])) { const d = Math.hypot(a.x - look[0], a.z - look[1]); if (a.id !== sv.a.id && d < bd) { bd = d; target = a; } } }
  if (!target) { logLine(tl('Look at a gate, an outpost, a warehouse or a road (or set a waypoint on the map) for the surveyors to aim at.')); return true; }
  const from = sv.pts[sv.pts.length - 1], far = Math.hypot(target.x - from[0], target.z - from[1]);
  if (lenNow() + far > PROAD.len) { logLine(TL`${endWord(target)} is ${Math.round(far)} m away: a survey stakes out at most ${PROAD.len} m. Lead the track to a nearer place, or to a road or track on the way.`); return true; }
  const way = proposeWay(g, from, [target.x, target.z]);
  if (!way) { logLine(TL`The surveyors find no way to ${endWord(target)} from here: too far, or water and steep ground in between.`); return true; }
  sv.pts.push(...way.slice(1)); sv.b = target; sv.last.n = -1;
  logLine(TL`The surveyors lay out ${Math.round(roadLength(way))} m to ${endWord(target)}: ${way.length - 1} stakes. Click to stake out the track, or take stakes back with the right mouse button.`);
  return true;
}
/** Every frame while surveying: follow the aim, check the stretch, redraw the hologram when anything moved. */
export function updateRoadSurvey() {
  if (!sv) return;
  const T = OW.terrain;
  if (G.char.loc !== 'overworld' || driving.v || !T) { cancelRoadSurvey(true); return; }
  const now = performance.now(), [x, z] = aim();
  if ((Math.hypot(x - sv.last.x, z - sv.last.z) < 0.75 || now - sv.last.t < 120) && sv.last.n === sv.pts.length) return;
  sv.last = { x, z, t: now, n: sv.pts.length }; sv.aim = [x, z];
  const g = roadGround()!;
  sv.snap = snapAt(x, z, sv.a?.id);
  if (sv.snap) sv.aim = [sv.snap.x, sv.snap.z];
  sv.problem = '';
  if (sv.a && !sv.b) {
    const prev = sv.pts[sv.pts.length - 1], d = Math.hypot(sv.aim[0] - prev[0], sv.aim[1] - prev[1]);
    if (d > PROAD.seg) sv.problem = TL`A stake at most ${PROAD.seg} m from the last (${Math.round(d)} m): set one nearer, or press R.`;
    else if (lenNow() + d > PROAD.len) sv.problem = TL`A survey stakes out at most ${PROAD.len} m.`;
    else sv.problem = stretchProblem(g, prev, sv.aim, sv.pts.length === 1, !!sv.snap);
  }
  draw(g);
}
function draw(g: RoadGround) {
  if (!sv) return;
  if (!preview) { preview = new THREE.Group(); preview.renderOrder = 10; scene.add(preview); }
  preview.traverse((o) => (o as THREE.Line).geometry?.dispose()); preview.clear();
  const ok: number[] = [], dim: number[] = [], bad: number[] = [], end: number[] = [], y = (x: number, z: number) => g.h(x, z) + 0.15;
  const edges = (out: number[], a: [number, number], b: [number, number]) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.01) return;
    const nx = -(b[1] - a[1]) / L * PROAD.half, nz = (b[0] - a[0]) / L * PROAD.half, n = Math.ceil(L / 4);
    for (let i = 0; i < n; i++) for (const s of [-1, 1]) {
      const t0 = i / n, t1 = (i + 1) / n, ax = a[0] + (b[0] - a[0]) * t0 + nx * s, az = a[1] + (b[1] - a[1]) * t0 + nz * s, bx = a[0] + (b[0] - a[0]) * t1 + nx * s, bz = a[1] + (b[1] - a[1]) * t1 + nz * s;
      out.push(ax, y(ax, az), az, bx, y(bx, bz), bz);
    }
  };
  for (let i = 1; i < sv.pts.length; i++) edges(ok, sv.pts[i - 1], sv.pts[i]);
  for (const [px, pz] of sv.pts) { const h = g.h(px, pz); dim.push(px, h, pz, px, h + 1.8, pz); }
  if (sv.a && !sv.b) { const prev = sv.pts[sv.pts.length - 1]; edges(sv.problem ? bad : dim, prev, sv.aim); }
  const ring = (e: { x: number; z: number }) => { const h = g.h(e.x, e.z); for (let k = 0; k < 16; k++) { const a0 = k / 16 * 6.283, a1 = (k + 1) / 16 * 6.283; end.push(e.x + Math.cos(a0) * 3, h + 0.2, e.z + Math.sin(a0) * 3, e.x + Math.cos(a1) * 3, h + 0.2, e.z + Math.sin(a1) * 3); } end.push(e.x, h, e.z, e.x, h + 3, e.z); };
  for (const e of [sv.a, sv.b, sv.snap]) if (e) ring(e);
  for (const [pts, m] of [[ok, matOk], [dim, matDim], [bad, matBad], [end, matEnd]] as const) {
    if (!pts.length) continue;
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const l = new THREE.LineSegments(geo, m); l.renderOrder = 10; l.frustumCulled = false; preview.add(l);
  }
}

// ---------- the sites, the work and the finished tracks ----------
interface Hand { f: Figure; off: number; side: number; phase: number }
interface Live { r: PlayerRoad; g: THREE.Group; key: string; sx: number; hands: Hand[]; y: number }
const live = new Map<string, Live>();
let scanT = 0, waysAt = '', first = true;
const told = new Set<string>();
/** Distance from (x, z) to a track's way on this copy of the planet. */
const distTo = (r: PlayerRoad, sx: number, x: number, z: number) => nearestOnRoad({ id: '', from: 0, to: 0, gate: '', half: 0, pts: r.pts.map(([a, b]) => [a + sx, b] as [number, number]) }, x, z)[0];
const keyOf = (r: PlayerRoad, now: number) => (roadBuilt(r, now) ? 'd' : r.t0 !== undefined ? 'w' + Math.floor(roadShare(r, now) * r.len / 8) + stalled(r, now) + (r.has?.camp ? 'c' : '') + (r.has?.mach ? 'm' : '') + (logsReady(r, now) > 0 ? 'l' : '') : 's' + roadRows(r).map((w) => Math.floor(w.given / w.n * 10)).join('.'));
/** The diggers' camp beside the front (on this copy of the planet), or null before the work starts. */
function campAt(r: PlayerRoad, sx: number, now: number) {
  if (r.t0 === undefined || roadBuilt(r, now)) return null;
  const pts = smoothPts(r.pts), p = along(pts, roadShare(r, now) * roadLength(pts));
  return { x: p.x + sx - p.dz * (PROAD.half + 3.5), z: p.z + p.dx * (PROAD.half + 3.5), p };
}
function drawRoad(r: PlayerRoad, sx: number, now: number): Live {
  const T = OW.terrain!, pts = smoothPts(r.pts).map(([x, z]) => [x + sx, z] as [number, number]), ox = pts[0][0], oz = pts[0][1];
  const pb = new PropBatch(), h = (x: number, z: number) => T.heightAt(x, z), L = roadLength(pts);
  const P = (x: number, y: number, z: number) => [x - ox, y, z - oz];
  const built = roadBuilt(r, now), share = roadShare(r, now), front = share * L, hw = PROAD.half;
  const g = new THREE.Group(), hands: Hand[] = [];
  if (!built) {
    // the stakes and the tape ahead of the work (all of it before it starts)
    let prev: [number[], number[]] | null = null;
    for (let d = Math.max(0, front - 1); d <= L + 0.01; d += 15) {
      const p = along(pts, Math.min(d, L)), nx = -p.dz * (hw + 0.3), nz = p.dx * (hw + 0.3), cur: [number[], number[]] = [[], []];
      for (const [k, s] of [[0, -1], [1, 1]] as const) {
        const x = p.x + nx * s, z = p.z + nz * s, y = h(x, z);
        pb.box(x - ox - 0.05, y - 0.1, z - oz - 0.05, x - ox + 0.05, y + 0.95, z - oz + 0.05, STAKE);
        cur[k] = P(x, y + 0.8, z);
        if (prev) pb.seg(STAKE, prev[k], cur[k]);
      }
      prev = cur;
    }
    // behind the front the graded earth: edges and a cross line every 4 m
    for (let d = 0; d + 4 <= front; d += 4) {
      const a = along(pts, d), b = along(pts, d + 4);
      for (const s of [-1, 1]) { const ax = a.x - a.dz * hw * s, az = a.z + a.dx * hw * s, bx = b.x - b.dz * hw * s, bz = b.z + b.dx * hw * s; pb.seg(EARTH, P(ax, h(ax, az) + 0.05, az), P(bx, h(bx, bz) + 0.05, bz)); }
      const cx0 = a.x - a.dz * hw, cz0 = a.z + a.dx * hw, cx1 = a.x + a.dz * hw, cz1 = a.z - a.dx * hw;
      pb.seg(EARTH, P(cx0, h(cx0, cz0) + 0.05, cz0), P(cx1, h(cx1, cz1) + 0.05, cz1));
    }
    if (r.t0 !== undefined) { // the diggers' camp at the front: a tent, a barrow, a heap of stone and planks
      const p = along(pts, front), sxp = -p.dz * (hw + 3.5), szp = p.dx * (hw + 3.5), tx = p.x + sxp, tz = p.z + szp, ty = h(tx, tz);
      const T0 = P(tx - p.dx * 1.6, ty, tz - p.dz * 1.6), T1 = P(tx + p.dx * 1.6, ty, tz + p.dz * 1.6), ridge0 = P(tx - p.dx * 1.6, ty + 1.7, tz - p.dz * 1.6), ridge1 = P(tx + p.dx * 1.6, ty + 1.7, tz + p.dz * 1.6);
      const w = (q: number[], s: number) => [q[0] - p.dz * 1.3 * s, q[1], q[2] + p.dx * 1.3 * s];
      for (const s of [-1, 1]) { pb.seg(EARTH, w(T0, s), ridge0); pb.seg(EARTH, w(T1, s), ridge1); pb.seg(EARTH, w(T0, s), w(T1, s)); }
      pb.seg(EARTH, ridge0, ridge1);
      const hx = p.x + p.dx * 4 + sxp * 0.7, hz = p.z + p.dz * 4 + szp * 0.7, hy = h(hx, hz);
      for (let i = 0; i < 3; i++) pb.box(hx - ox - 0.6 + i * 0.4, hy, hz - oz - 0.5, hx - ox - 0.25 + i * 0.4, hy + 0.35, hz - oz + 0.5, 0xb2b2a3);
      pb.box(hx - ox - 0.8, hy + 0.35, hz - oz - 0.6, hx - ox + 0.8, hy + 0.55, hz - oz + 0.6, 0xd8c890);
      if (r.has?.camp) { // (0.281) the road camp: a bunkhouse behind the tent, a stove pipe
        const bx = tx + sxp * 0.9, bz = tz + szp * 0.9, by = h(bx, bz), u = [p.dx * 3, p.dz * 3], v = [-p.dz * 1.8, p.dx * 1.8];
        const C = (a: number, b: number, y: number) => P(bx + u[0] * a + v[0] * b, by + y, bz + u[1] * a + v[1] * b);
        for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) pb.seg(EARTH, C(a, b, 0), C(a, b, 2));
        for (const y of [0, 2]) { pb.seg(EARTH, C(-1, -1, y), C(1, -1, y)); pb.seg(EARTH, C(1, -1, y), C(1, 1, y)); pb.seg(EARTH, C(1, 1, y), C(-1, 1, y)); pb.seg(EARTH, C(-1, 1, y), C(-1, -1, y)); }
        pb.seg(EARTH, C(-1, 0, 2.8), C(1, 0, 2.8));
        for (const a of [-1, 1]) for (const b of [-1, 1]) pb.seg(EARTH, C(a, b, 2), C(a, 0, 2.8));
        pb.seg(0x9a9a9a, C(0.6, 0.5, 2.4), C(0.6, 0.5, 3.6));
      }
      if (r.has?.mach) { // (0.281) the steam grader behind the front: a boiler on wheels, a blade, a stack
        const gx = p.x - p.dx * 6 - p.dz * 0.3, gz = p.z - p.dz * 6 + p.dx * 0.3, gy = h(gx, gz);
        pb.box(gx - ox - 1, gy + 0.5, gz - oz - 1, gx - ox + 1, gy + 1.6, gz - oz + 1, 0x8a8a7a);
        pb.box(gx - ox - 0.2, gy + 1.6, gz - oz - 0.2, gx - ox + 0.2, gy + 2.8, gz - oz + 0.2, 0x5a5a50);
        pb.seg(0xd8c890, P(gx + p.dx * 1.5 - p.dz * 1.6, gy + 0.2, gz + p.dz * 1.5 + p.dx * 1.6), P(gx + p.dx * 1.5 + p.dz * 1.6, gy + 0.2, gz + p.dz * 1.5 - p.dx * 1.6));
      }
      const stop = stalled(r, now);
      if (stop) { const wl = textSprite(stop === 'camp' ? tl('WAITING FOR A ROAD CAMP') : tl('WAITING FOR SUPPLIES'), '#ff9a7a', 2.6); wl.position.set(tx - ox, ty + 3.4, tz - oz); g.add(wl); }
      for (const [off, side, kit] of [[1.5, -0.5, 'pick'], [3, 0.6, 'hoe'], [0, 0.2, 'pick']] as const) {
        const f = makeFigure(WORKER, kit); g.add(f.g); hands.push({ f, off, side, phase: hands.length * 0.37 });
      }
    }
  }
  if (logsReady(r, now) > 0) { // (0.281) the felled logs stacked by the start's sign
    const q = along(pts, 6), x = q.x + q.dz * (hw + 2.5), z = q.z - q.dx * (hw + 2.5), y = h(x, z);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3 - i; j++) {
      const cx = x - q.dz * (j - 1 + i * 0.5) * 0.45, cz = z + q.dx * (j - 1 + i * 0.5) * 0.45, cy = y + 0.2 + i * 0.38;
      pb.seg(0xb08850, P(cx - q.dx * 1.6, cy, cz - q.dz * 1.6), P(cx + q.dx * 1.6, cy, cz + q.dz * 1.6));
    }
  }
  // a sign at each end
  for (const k of [0, 1]) {
    const q = along(pts, k ? L - 3 : 3), x = q.x - q.dz * (hw + 1.6), z = q.z + q.dx * (hw + 1.6), y = h(x, z);
    pb.box(x - ox - 0.07, y - 0.1, z - oz - 0.07, x - ox + 0.07, y + 2.2, z - oz + 0.07, POST);
    pb.box(x - ox - 0.5, y + 1.6, z - oz - 0.06, x - ox + 0.5, y + 2.1, z - oz + 0.06, POST);
    const label = textSprite(built ? r.name.toUpperCase() : (r.t0 !== undefined ? TL`TRACK WORKS · ${Math.floor(share * 100)}%` : tl('TRACK SITE')) + ' · ' + r.name.toUpperCase(), built ? '#d8c890' : '#ffd060', 3.2);
    label.position.set(x - ox, y + 2.6, z - oz); g.add(label);
  }
  g.add(pb.build());
  g.position.set(ox, 0, oz);
  scene.add(g);
  return { r, g, key: keyOf(r, now), sx, hands, y: 0 };
}
function dropLive(l: Live) { scene.remove(l.g); l.g.traverse((o) => { (o as THREE.Mesh).geometry?.dispose(); }); }
const dig = new THREE.Vector3();
/** Main loop: the land follows the finished tracks (on every game alike), the sites near you are drawn, the diggers work. */
export function updateRoads(dt: number) {
  const T = OW.terrain, c = G.char;
  if (!T || c.loc !== 'overworld') { clearRoads(); return; }
  if ((scanT -= dt) <= 0) {
    scanT = 1;
    const key = waysKey(c.proads, c.time);
    if (first) waysAt = key; // openWorld handed the land the tracks finished by then
    if (key !== waysAt) { // a track finished (or was given up): the land changes
      const was = new Set(waysAt ? waysAt.split(',') : []), now = new Set(key ? key.split(',') : []);
      waysAt = key; T.setWays(terrainWays(c.proads, c.time));
      for (const id of new Set([...was, ...now])) {
        if (was.has(id) === now.has(id)) continue;
        const r = c.proads[id];
        if (r) rebuildChunksAlong(r.pts, 12);
        if (r && now.has(id) && !first && !told.has(id)) { told.add(id); showToast(tl('A track is finished')); logLine(TL`The diggers finish the track ${r.name}: ${r.len} m of graded earth.`); }
      }
      const gy = T.heightAt(G.pos.x, G.pos.z); if (G.pos.y < gy) G.pos.y = gy;
    }
    first = false;
    const seen = new Set<string>();
    for (const r of Object.values(c.proads)) {
      if (!r) continue;
      const sx = nearX(r.pts[0][0], G.pos.x) - r.pts[0][0], d = distTo(r, sx, G.pos.x, G.pos.z);
      const l = live.get(r.id);
      if (d > (l ? DROP : NEAR)) continue;
      seen.add(r.id);
      const k = keyOf(r, c.time);
      if (l && l.key === k && l.sx === sx) continue;
      if (l) dropLive(l);
      live.set(r.id, drawRoad(r, sx, c.time));
    }
    for (const [id, l] of live) if (!seen.has(id)) { dropLive(l); live.delete(id); }
  }
  // the diggers at the front: picks and hoes, the front moving on with the clock
  for (const l of live.values()) {
    if (!l.hands.length || l.r.t0 === undefined) continue;
    const pts = smoothPts(l.r.pts), L = roadLength(pts), front = roadShare(l.r, c.time) * L, idle = !!stalled(l.r, c.time) || c.time < (l.r.fr?.[1] ?? 0);
    for (const hd of l.hands) {
      hd.phase += dt;
      const p = along(pts, Math.max(0, front - hd.off)), x = p.x + l.sx - p.dz * PROAD.half * hd.side, z = p.z + p.dx * PROAD.half * hd.side;
      hd.f.g.position.set(x - l.g.position.x, T.heightAt(x, z), z - l.g.position.z); hd.f.g.rotation.y = Math.atan2(p.dx, p.dz);
      const s = idle ? 0 : (hd.phase * 0.8) % 1;
      poseRig(hd.f.rig, { swing: 0, strike: s });
      if (!idle && ((hd.phase - dt) * 0.8) % 1 < 0.5 && s >= 0.5) play('mine', { at: hd.f.g.getWorldPosition(dig), vol: 0.35, far: 40, jitter: 0.15 });
    }
  }
}
export function clearRoads() { for (const l of live.values()) dropLive(l); live.clear(); }
/** Redraw now (a hand-over moved a site on). */
export function redrawRoads() { scanT = 0; }
/** The sign of a track (either end) you stand by, (0.281) or its diggers' camp at the front. */
export function nearRoadSign(): PlayerRoad | null {
  if (G.char.loc !== 'overworld') return null;
  for (const l of live.values()) {
    const cp = campAt(l.r, l.sx, G.char.time);
    if (cp && Math.hypot(G.pos.x - cp.x, G.pos.z - cp.z) < 7) return l.r;
    const pts = smoothPts(l.r.pts), L = roadLength(pts);
    for (const k of [0, 1]) {
      const q = along(pts, k ? L - 3 : 3), x = q.x + l.sx - q.dz * (PROAD.half + 1.6), z = q.z + q.dx * (PROAD.half + 1.6);
      if (Math.hypot(G.pos.x - x, G.pos.z - z) < 2.2) return l.r;
    }
  }
  return null;
}
export const roadSignPrompt = (r: PlayerRoad) => (roadBuilt(r, G.char.time) ? TL`E — the track ${r.name}` : r.t0 !== undefined ? TL`E — the track works ${r.name}${stalled(r, G.char.time) ? tl(' (the diggers wait)') : ''}` : TL`E — the track site ${r.name} (bring the materials and the wages)`);
/** (0.281) The front's point (the diggers' camp) on this copy of the planet, for handing over from vehicles parked there. */
export function roadFront(r: PlayerRoad): { x: number; z: number } | null {
  const sx = nearX(r.pts[0][0], G.pos.x) - r.pts[0][0], cp = campAt(r, sx, G.char.time);
  return cp ? { x: cp.x, z: cp.z } : null;
}
