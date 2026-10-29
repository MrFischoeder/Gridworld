// (0.283, PLAN_DROG.md stage D4) The road network the convoys drive on: the old roads between the villages (gen/roads.ts
// `network`, the generated land) and the tracks the players built (gen/playerroads.ts, finished ones only). Its nodes are
// the places the convoys load and unload at: a village (`v:<id>`, the same id as its warehouse in gen/warehouses.ts)
// and an outpost, a port, a wild warehouse or an old plant's crew camp (their `outposts` id); a track that ends on a
// road or on another track joins it at a junction (`j:<track id>:a|b`) that splits that road in two.
//
// `findRoad` is a shortest way by driving time (a better surface is quicker), its polyline, its length and what it
// does to a truck: `t` the km it costs in time (km at the pace of a dirt track) and `f` the fuel against a dirt track.
// The convoy lines (gen/hublines.ts) and the outposts' routes (gen/routes.ts) keep the way they were opened on and run
// their timetables from it, and their trucks are drawn along it. Pure: from the world seed and the shared `proads`.
import { network, edgePath, type Edge } from './roads';
import { wrapDx } from './regions';
import { roadBuilt, clsOf, upDone, smoothPts, roadLength, slicePts, SURFACE_CLS, type PlayerRoad, type RoadEnd } from './playerroads';
import { SURFACE } from '../data/vehicles';

/** A way by road: km driven, km of time (at a dirt track's pace), the fuel against a dirt track, the polyline (m). */
export interface RoadWay { km: number; t: number; f: number; pts: [number, number][]; /** the roads it takes */ via: string[] }
interface NetEdge { a: string; b: string; len: number; s: number; f: number; key: string; name: string; pts: () => [number, number][] | null }

/** The surface a finished track lies under now (an upgrade done counts). */
const surfOf = (r: PlayerRoad, now: number) => (r.up && upDone(r, now) ? r.up.to : clsOf(r));
const SURF_KEY = ['dirt', 'gravel', 'paved'] as const;
/** The node a track's end stands at (a junction for an end on a road or a track). */
export function endNode(r: PlayerRoad, which: 'a' | 'b'): string {
  const e = r[which];
  if (e.kind === 'gate') return 'v:' + e.id.split(':')[1];
  if (e.kind === 'warehouse' || e.kind === 'outpost') return e.id.slice(2); // 'h:v:5' → 'v:5', 'o:<outpost id>' → its id
  return 'j:' + r.id + ':' + which;
}
const near = (p: [number, number], x: number, z: number) => Math.hypot(wrapDx(p[0] - x), p[1] - z);
/** The index of the polyline's point nearest (x, z). */
function nearestIdx(pts: [number, number][], x: number, z: number): number {
  let bi = 0, bd = Infinity;
  for (let i = 0; i < pts.length; i++) { const d = near(pts[i], x, z); if (d < bd) { bd = d; bi = i; } }
  return bi;
}
/** The graph: the old roads and the finished tracks (with their junctions). */
export function roadGraph(world: number, proads: Record<string, PlayerRoad | undefined>, now: number): NetEdge[] {
  const out: NetEdge[] = [], road = SURFACE.road;
  const seed = new Map<string, Edge>();
  for (const e of network(world)) {
    seed.set('road:' + e.a.id + ':' + e.b.id, e); seed.set('road:' + e.b.id + ':' + e.a.id, e);
    out.push({ a: 'v:' + e.a.id, b: 'v:' + e.b.id, len: Math.hypot(wrapDx(e.b.x - e.a.x), e.b.z - e.a.z) * 1.25, s: road.speed, f: road.fuel, key: e.key, name: e.a.name + '–' + e.b.name, pts: () => edgePath(world, e)?.pts ?? null });
  }
  const built = Object.values(proads).filter((r): r is PlayerRoad => !!r && roadBuilt(r, now)).sort((p, q) => (p.id < q.id ? -1 : 1));
  const byId = new Map(built.map((r) => [r.id, r]));
  for (const r of built) {
    const S = SURFACE[SURF_KEY[surfOf(r, now)]], pts = smoothPts(r.pts), L = roadLength(pts);
    out.push({ a: endNode(r, 'a'), b: endNode(r, 'b'), len: L, s: S.speed, f: S.fuel, key: 'proad:' + r.id, name: r.name, pts: () => pts });
    for (const which of ['a', 'b'] as const) { // a junction splits the road or track it ends on
      const e = r[which], j = 'j:' + r.id + ':' + which;
      if (e.kind === 'road') {
        const se = seed.get(e.id.slice(2));
        if (!se) continue;
        for (const [v, end] of [[se.a, 0], [se.b, 1]] as const) {
          out.push({ a: j, b: 'v:' + v.id, len: Math.hypot(wrapDx(v.x - e.x), v.z - e.z) * 1.15, s: road.speed, f: road.fuel, key: j + '>' + v.id, name: se.a.name + '–' + se.b.name, pts: () => {
            const p = edgePath(world, se)?.pts; if (!p) return null;
            const i = nearestIdx(p, e.x, e.z), sx = e.x - p[i][0] - wrapDx(e.x - p[i][0]); // the path in the junction's copy of the planet
            const part = end === 0 ? p.slice(0, i + 1).reverse() : p.slice(i);
            return [[e.x, e.z], ...part.map(([x, z]) => [x + sx, z] as [number, number])];
          } });
        }
      } else if (e.kind === 'track') {
        const t = byId.get(e.id.slice(2));
        if (!t) continue; // it ends on a track still being dug: no junction yet
        const tp = smoothPts(t.pts), TS = SURFACE[SURF_KEY[surfOf(t, now)]], sx = e.x - wrapDx(e.x - tp[0][0]) - tp[0][0];
        const tps = tp.map(([x, z]) => [x + sx, z] as [number, number]), i = nearestIdx(tps, e.x, e.z), cut = roadLength(tps.slice(0, i + 1)), TL = roadLength(tps);
        out.push({ a: j, b: endNode(t, 'a'), len: Math.max(1, cut), s: TS.speed, f: TS.fuel, key: j + '>a', name: t.name, pts: () => [[e.x, e.z], ...slicePts(tps, 0, cut).reverse()] });
        out.push({ a: j, b: endNode(t, 'b'), len: Math.max(1, TL - cut), s: TS.speed, f: TS.fuel, key: j + '>b', name: t.name, pts: () => [[e.x, e.z], ...slicePts(tps, cut, TL)] });
      }
    }
  }
  return out;
}
/** A key of the finished tracks and their surfaces: the network changes when it does. */
export const netKey = (proads: Record<string, PlayerRoad | undefined>, now: number) => Object.values(proads).filter((r) => r && roadBuilt(r, now)).map((r) => r!.id + '|' + surfOf(r!, now)).sort().join(',');
const graphs = new Map<string, NetEdge[]>();
function graphOf(world: number, proads: Record<string, PlayerRoad | undefined>, now: number): NetEdge[] {
  const k = world + '#' + netKey(proads, now);
  let g = graphs.get(k);
  if (!g) { if (graphs.size > 8) graphs.clear(); g = roadGraph(world, proads, now); graphs.set(k, g); }
  return g;
}
/** The nodes reachable by road from `from` (itself included). */
export function reachable(world: number, proads: Record<string, PlayerRoad | undefined>, now: number, from: string): Set<string> {
  const adj = new Map<string, string[]>();
  for (const e of graphOf(world, proads, now)) { (adj.get(e.a) ?? adj.set(e.a, []).get(e.a)!).push(e.b); (adj.get(e.b) ?? adj.set(e.b, []).get(e.b)!).push(e.a); }
  const seen = new Set([from]), todo = [from];
  while (todo.length) for (const n of adj.get(todo.pop()!) ?? []) if (!seen.has(n)) { seen.add(n); todo.push(n); }
  return seen;
}
/** Is the place `id` joined by road to an outpost, a port, a wild warehouse or an old plant's camp (any but itself)? */
export function roadToWorks(world: number, proads: Record<string, PlayerRoad | undefined>, now: number, id: string, outposts: Record<string, unknown>): boolean {
  for (const n of reachable(world, proads, now, id)) if (n !== id && outposts[n]) return true;
  return false;
}
/** At most this many points kept of a way (they go into the shared state with the line). */
const KEEP = 240, STEP = 12;
const ways = new Map<string, RoadWay | null>();
/**
 * The quickest way by road from node `from` to node `to` (null: no road joins them). `fx, fz` puts the way on the
 * copy of the planet round that point. An old road whose path cannot be found is struck out and the search runs again.
 */
export function findRoad(world: number, proads: Record<string, PlayerRoad | undefined>, now: number, from: string, to: string, fx: number): RoadWay | null {
  const ck = world + '#' + netKey(proads, now) + '#' + from + '>' + to + '#' + Math.round(fx / 1e5);
  if (ways.has(ck)) return ways.get(ck)!;
  if (ways.size > 400) ways.clear();
  const all = graphOf(world, proads, now), dead = new Set<string>();
  let res: RoadWay | null = null;
  for (let tries = 0; tries < 8 && from !== to; tries++) {
    const adj = new Map<string, { o: string; e: NetEdge; fwd: boolean }[]>();
    for (const e of all) {
      if (dead.has(e.key)) continue;
      (adj.get(e.a) ?? adj.set(e.a, []).get(e.a)!).push({ o: e.b, e, fwd: true });
      (adj.get(e.b) ?? adj.set(e.b, []).get(e.b)!).push({ o: e.a, e, fwd: false });
    }
    const dist = new Map([[from, 0]]), prev = new Map<string, { n: string; e: NetEdge; fwd: boolean }>(), done = new Set<string>(), open = [from];
    while (open.length) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (dist.get(open[i])! < dist.get(open[bi])!) bi = i;
      const n = open.splice(bi, 1)[0];
      if (done.has(n)) continue;
      done.add(n);
      if (n === to) break;
      for (const { o, e, fwd } of adj.get(n) ?? []) {
        const d = dist.get(n)! + e.len / e.s;
        if (d < (dist.get(o) ?? Infinity)) { dist.set(o, d); prev.set(o, { n, e, fwd }); open.push(o); }
      }
    }
    if (!prev.has(to)) break;
    const legs: { e: NetEdge; fwd: boolean }[] = [];
    for (let n = to; n !== from; ) { const p = prev.get(n)!; legs.push(p); n = p.n; }
    legs.reverse();
    const pts: [number, number][] = [];
    let km = 0, t = 0, f = 0, ok = true;
    for (const { e, fwd } of legs) {
      const p = e.pts();
      if (!p || p.length < 2) { dead.add(e.key); ok = false; break; }
      let q = fwd ? p : [...p].reverse();
      const lx = pts.length ? pts[pts.length - 1][0] : fx, sx = lx + wrapDx(q[0][0] - lx) - q[0][0]; // next to where we are
      q = q.map(([x, z]) => [x + sx, z] as [number, number]);
      const L = roadLength(q) / 1000;
      km += L; t += L / e.s; f += L * e.f;
      pts.push(...(pts.length ? q.slice(1) : q));
    }
    if (!ok) continue;
    const thin: [number, number][] = [pts[0]];
    const step = Math.max(STEP, roadLength(pts) / KEEP);
    for (const p of pts.slice(1, -1)) if (Math.hypot(p[0] - thin[thin.length - 1][0], p[1] - thin[thin.length - 1][1]) >= step) thin.push(p);
    thin.push(pts[pts.length - 1]);
    res = { km: Math.round(km * 10) / 10, t: Math.round(t * 100) / 100, f: km ? Math.round(f / km * 100) / 100 : 1, pts: thin.map(([x, z]) => [Math.round(x * 10) / 10, Math.round(z * 10) / 10]), via: [...new Set(legs.map((l) => l.e.name))] };
    break;
  }
  ways.set(ck, res);
  return res;
}
/** The point `p` (0..1) of the way along its length, and the heading there (atan2 along +z like the vehicles). */
export function wayAt(pts: [number, number][], p: number): [number, number, number] {
  const L = roadLength(pts);
  let d = Math.max(0, Math.min(1, p)) * L;
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i], s = Math.hypot(bx - ax, bz - az);
    if (d <= s || i === pts.length - 1) { const k = s ? Math.min(1, d / s) : 0; return [ax + (bx - ax) * k, az + (bz - az) * k, Math.atan2(bx - ax, bz - az)]; }
    d -= s;
  }
  return [pts[0][0], pts[0][1], 0];
}
/** (0.283) Where a truck on a way is: at its start or its end, or driving out / back (`p` 0..1, keeping to the right),
 *  on the copy of the planet round `px`: x, z, heading. */
export function wayPose(pts: [number, number][], at: 'start' | 'end' | 'out' | 'back', p: number, px: number): [number, number, number] {
  const sx = px + wrapDx(pts[0][0] - px) - pts[0][0];
  if (at === 'start') { const [x, z, y] = wayAt(pts, 0.002); return [x + sx, z, y]; }
  if (at === 'end') { const [x, z, y] = wayAt(pts, 0.998); return [x + sx, z, y + Math.PI]; }
  const [x, z, y] = wayAt(pts, at === 'out' ? p : 1 - p), side = at === 'out' ? -1.5 : 1.5;
  return [x + sx + Math.cos(y) * side, z - Math.sin(y) * side, at === 'out' ? y : y + Math.PI];
}
/** A way shifted onto the copy of the planet round `px`. */
export const wayNear = (pts: [number, number][], px: number): [number, number][] => { const sx = px + wrapDx(pts[0][0] - px) - pts[0][0]; return pts.map(([x, z]) => [x + sx, z]); };
/** Words for a surface key. */
export const surfName = (c: number) => SURFACE_CLS[c].name;
export type { RoadEnd };
