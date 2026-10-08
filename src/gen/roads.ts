// Roads: a network between the villages. Every village is joined to its one to three nearest neighbours (how many
// comes from its seed), so some towns sit at a crossroads and some at the end of a single road, but every road runs
// from a town to a town. The way is found over the land (A* on a coarse grid): it keeps off the mountains and gives
// the ruins, camps and crash sites a wide berth, so those are found by exploring, not by following a road.
// Pure and deterministic; each road is worked out once when first needed and cached.
import { hash, DIRV, type Dir } from '../core/rng';
import { allVillages, villageGap, SETTLED, regionInfo, GRIDHOLM_ID, villageSeed, wrapDx, REGION, POLAR_Z, wrapR, type Poi, type Rect } from './regions';
import { villageGates, VILLAGE_OFFSET } from './village';
import { mountainMask } from './mountains';
import { seaMask } from './seas';
import { nearRiver } from './rivers';
import { inCity } from './cities';
import { townsWorld } from './worldrules';

/** A road between places, or a mountain trail (gen/trails.ts: `gate` 'trail', its height profile `h` per point, the summit's `name`). */
export interface Road { id: string; from: number; to: number; gate: string; pts: [number, number][]; half: number; h?: number[]; name?: string }

const GATE_POINT = { N: [36, -2], S: [41, 74], E: [74, 37], W: [-2, 39] } as const;
/** Where the road of a gate starts (just outside the wall apron), for a village centred at its POI. */
export function gatePoint(v: Poi, dir: keyof typeof GATE_POINT): [number, number] {
  const p = GATE_POINT[dir];
  return [p[0] + VILLAGE_OFFSET.x + v.x, p[1] + VILLAGE_OFFSET.z + v.z];
}
/** Longest road between two neighbouring villages near Gridholm (m, longer further out: `linkAt`), and the road's half width. */
export const ROAD = { link: 7000, half: 2.3, cell: 32, margin: 1000 };

/** Longest road from village v: out where the villages stand further apart (gen/regions.ts), the roads run longer. */
const linkAt = (v: Poi) => ROAD.link + (villageGap(Math.hypot(wrapDx(v.x), v.z)) - SETTLED.gap[0]) * 2.4;
export interface Edge { a: Poi; b: Poi; key: string }
const edgeCache = new Map<number, Edge[]>();
/** The village network: each village joined to its 1-3 nearest neighbours (union, so a road is never doubled). */
export function network(world: number): Edge[] {
  let out = edgeCache.get(world);
  if (out) return out;
  out = [];
  const vs = allVillages(world), seen = new Set<string>();
  if (townsWorld(world)) { edgeCache.set(world, out = townNetwork(world, vs)); return out; }
  for (const v of vs) {
    const k = v.id === GRIDHOLM_ID ? 3 : 1 + (hash(world, v.id, 0x40ad) % 3); // the start village is a crossroads
    const near = vs.filter((w) => w !== v).map((w) => ({ w, d: Math.hypot(wrapDx(w.x - v.x), w.z - v.z) })).filter((o) => o.d < linkAt(v)).sort((p, q) => p.d - q.d).slice(0, k);
    for (const { w } of near) {
      const [a, b] = v.id < w.id ? [v, w] : [w, v], key = a.id + ':' + b.id;
      if (!seen.has(key)) { seen.add(key); out.push({ a, b, key }); }
    }
  }
  edgeCache.set(world, out);
  return out;
}
/** (0.182) Towns world roads: a tree joining every town by the shortest links (so none is cut off), plus each town's
 *  nearest neighbour or two (by hash) within `TOWN_ROAD.link` for a few loops. Gridholm is joined to its 3 nearest. */
export const TOWN_ROAD = { link: 24000, wet: 0.06 };
function townNetwork(world: number, vs: Poi[]): Edge[] {
  const out: Edge[] = [], seen = new Set<string>();
  // the straight line's share over the sea (a road cannot cross it): such links cost more, so the tree goes round by
  // land wherever it can, and a link mostly over the sea is left out (towns over the water are reached by boat)
  const sea = new Map<string, number>(), wet = (a: Poi, b: Poi) => {
    const k = Math.min(a.id, b.id) + ':' + Math.max(a.id, b.id); let n = sea.get(k);
    if (n === undefined) { n = 0; const bx = a.x + wrapDx(b.x - a.x); for (let i = 1; i < 40; i++) if (seaMask(world, a.x + (bx - a.x) * i / 40, a.z + (b.z - a.z) * i / 40) > 0.08) n++; sea.set(k, n /= 39); }
    return n;
  };
  const d = (a: Poi, b: Poi) => Math.hypot(wrapDx(b.x - a.x), b.z - a.z) * (1 + 12 * wet(a, b));
  const add = (v: Poi, w: Poi) => { if (wet(v, w) > TOWN_ROAD.wet) return; const [a, b] = v.id < w.id ? [v, w] : [w, v], key = a.id + ':' + b.id; if (!seen.has(key)) { seen.add(key); out.push({ a, b, key }); } };
  // Prim's tree from Gridholm
  const inTree = [vs[0]], left = vs.slice(1);
  while (left.length) {
    let best = Infinity, bi = 0, bv = vs[0];
    for (let i = 0; i < left.length; i++) for (const t of inTree) { const e = d(t, left[i]); if (e < best) { best = e; bi = i; bv = t; } }
    add(bv, left[bi]); inTree.push(left[bi]); left.splice(bi, 1);
  }
  for (const v of vs) {
    const k = v.id === GRIDHOLM_ID ? 3 : 1 + (hash(world, v.id, 0x40ad) % 2);
    for (const { w } of vs.filter((w) => w !== v).map((w) => ({ w, e: d(v, w) })).filter((o) => o.e < TOWN_ROAD.link).sort((p, q) => p.e - q.e).slice(0, k)) add(v, w);
  }
  return out;
}
/** The gate of village v facing (tx, tz) best. */
export function gateToward(world: number, v: Poi, tx: number, tz: number): Dir {
  const dx = tx - v.x, dz = tz - v.z, d = Math.hypot(dx, dz) || 1;
  return villageGates(villageSeed(world, v), v.id === GRIDHOLM_ID).map((g) => ({ g, s: (DIRV[g][0] * dx + DIRV[g][1] * dz) / d })).sort((p, q) => q.s - p.s)[0].g;
}

const pathCache = new Map<string, { pts: [number, number][]; gate: Dir } | null>();
/** Whether the way of edge e has been worked out already (it takes a few milliseconds the first time). */
export const pathKnown = (world: number, e: Edge) => pathCache.has(world + ':' + e.key);
/** The way between the two villages of an edge (in coordinates round village a), or null when there is none. */
export function edgePath(world: number, e: Edge): { pts: [number, number][]; gate: Dir } | null {
  const key = world + ':' + e.key;
  if (pathCache.has(key)) return pathCache.get(key)!;
  if (pathCache.size > 4000) pathCache.clear();
  const a = e.a, b = { ...e.b, x: a.x + wrapDx(e.b.x - a.x) };
  b.rect = { x0: e.b.rect.x0 + (b.x - e.b.x), z0: e.b.rect.z0, x1: e.b.rect.x1 + (b.x - e.b.x), z1: e.b.rect.z1 };
  const ga = gateToward(world, a, b.x, b.z), gb = gateToward(world, b, a.x, a.z);
  const [sx, sz] = gatePoint(a, ga), [tx, tz] = gatePoint(b, gb), oa = DIRV[ga], ob = DIRV[gb];
  const s1: [number, number] = [sx + oa[0] * 16, sz + oa[1] * 16], t1: [number, number] = [tx + ob[0] * 16, tz + ob[1] * 16];
  // round the far side of a mountain if need be: a wider search when the first one finds no way
  const way = findWay(world, s1, t1, [a.id, e.b.id]) ?? findWay(world, s1, t1, [a.id, e.b.id], ROAD.margin * 2.8);
  const out = way ? { pts: [[sx, sz], ...way, [tx, tz]] as [number, number][], gate: ga } : null;
  pathCache.set(key, out);
  return out;
}

/** A* over a coarse grid from s to t: mountains cost more and their hearts are closed, places are kept well clear. */
export function findWay(world: number, s: [number, number], t: [number, number], ends: number[], M = ROAD.margin): [number, number][] | null {
  const C = ROAD.cell;
  const x0 = Math.min(s[0], t[0]) - M, z0 = Math.min(s[1], t[1]) - M, nx = Math.ceil((Math.max(s[0], t[0]) + M - x0) / C) + 1, nz = Math.ceil((Math.max(s[1], t[1]) + M - z0) / C) + 1;
  // the cost of a cell, worked out when the search first reaches it: mountains cost more and their hearts are closed;
  // places are closed close round their footprint and costly for a good way further out (ruins, camps and crash
  // sites are for finding; other villages are gone round), so a road gives them a wide berth wherever it can
  const cost = new Float32Array(nx * nz).fill(NaN), regionPois = new Map<string, Poi[]>();
  const poisAt = (x: number, z: number) => {
    const rx = Math.floor((x + REGION / 2) / REGION), rz = Math.floor((z + REGION / 2) / REGION), k = rx + ',' + rz;
    let l = regionPois.get(k);
    if (!l) { l = []; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) l.push(...regionInfo(world, rx + a, rz + b).pois); regionPois.set(k, l); }
    return l;
  };
  const costAt = (n: number) => {
    let c = cost[n];
    if (c === c) return c; // already known (NaN is not equal to itself)
    const x = x0 + (n % nx) * C, z = z0 + Math.floor(n / nx) * C, m = mountainMask(world, x, z);
    const w = m > 0.3 ? 0 : seaMask(world, x, z);
    c = m > 0.3 || w > 0.08 || Math.abs(z) > POLAR_Z - 300 ? Infinity : 1 + m * 60 + w * 120; // the foothills are costly but passable, the heights and the sea are not
    if (c < Infinity && nearRiver(world, x, z, 20)) c += 30; // a river is crossed only where it must be (at a ford)
    if (c < Infinity && inCity(world, x, z, 40)) c = Infinity; // the dead cities are gone round
    for (const p of c === Infinity ? [] : poisAt(x, z)) {
      const end = ends.includes(p.id), hard = end ? 6 : 15, soft = end ? 6 : p.type === 'village' ? 30 : 80;
      const d = Math.hypot(Math.max(p.rect.x0 - x, 0, x - p.rect.x1), Math.max(p.rect.z0 - z, 0, z - p.rect.z1));
      if (d < hard) { c = Infinity; break; }
      if (d < soft) c += 12 * (1 - (d - hard) / (soft - hard));
    }
    cost[n] = c;
    return c;
  };
  const cell = (x: number, z: number) => [Math.max(0, Math.min(nx - 1, Math.round((x - x0) / C))), Math.max(0, Math.min(nz - 1, Math.round((z - z0) / C)))];
  const [si, sk] = cell(...s), [ti, tk] = cell(...t), start = si + nx * sk, goal = ti + nx * tk;
  cost[start] = 1; cost[goal] = 1; // the ends are open even right by the village walls
  const g = new Float32Array(nx * nz).fill(Infinity), from = new Int32Array(nx * nz).fill(-1), done = new Uint8Array(nx * nz);
  // a binary heap of (f, index) pairs, stored flat
  const heap: number[] = [];
  const swap = (a: number, b: number) => { for (const o of [0, 1]) { const t = heap[2 * a + o]; heap[2 * a + o] = heap[2 * b + o]; heap[2 * b + o] = t; } };
  const push = (f: number, i: number) => { heap.push(f, i); let c = heap.length / 2 - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[2 * p] <= heap[2 * c]) break; swap(p, c); c = p; } };
  const pop = (): number => {
    const i = heap[1], li = heap.pop()!, lf = heap.pop()!;
    if (heap.length) {
      heap[0] = lf; heap[1] = li;
      for (let c = 0; ;) { const l = 2 * c + 1, r = l + 1, n = heap.length / 2; let m = c; if (l < n && heap[2 * l] < heap[2 * m]) m = l; if (r < n && heap[2 * r] < heap[2 * m]) m = r; if (m === c) break; swap(m, c); c = m; }
    }
    return i;
  };
  const h = (i: number) => Math.hypot((i % nx) - ti, Math.floor(i / nx) - tk);
  g[start] = 0; push(1.3 * h(start), start);
  const steps = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  while (heap.length) {
    const cur = pop();
    if (done[cur]) continue;
    done[cur] = 1;
    if (cur === goal) break;
    const ci = cur % nx, ck = (cur - ci) / nx;
    for (const [di, dk, len] of steps) {
      const ni = ci + di, nk = ck + dk;
      if (ni < 0 || nk < 0 || ni >= nx || nk >= nz) continue;
      const n = ni + nx * nk;
      if (done[n]) continue;
      const c = costAt(n);
      if (c === Infinity) continue;
      const ng = g[cur] + len * (c + costAt(cur)) / 2;
      if (ng < g[n]) { g[n] = ng; from[n] = cur; push(ng + 1.3 * h(n), n); } // a little greedy: fewer cells to look at
    }
  }
  if (from[goal] < 0) return null;
  const cells: [number, number][] = [];
  for (let i = goal; i >= 0; i = from[i]) cells.push([x0 + (i % nx) * C, z0 + Math.floor(i / nx) * C]);
  cells.reverse();
  // straighten: skip ahead while the straight line stays on open, cheap ground
  const clear = (p: [number, number], q: [number, number]) => {
    const n = Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / (C / 2));
    for (let j = 0; j <= n; j++) { const x = p[0] + (q[0] - p[0]) * j / n, z = p[1] + (q[1] - p[1]) * j / n, [i, k] = cell(x, z); if (costAt(i + nx * k) > 3) return false; }
    return true;
  };
  const simple: [number, number][] = [s];
  let i = 0;
  while (i < cells.length - 1) { let j = Math.min(cells.length - 1, i + 12); while (j > i + 1 && !clear(cells[i], cells[j])) j--; simple.push(cells[j]); i = j; }
  simple.push(t);
  // round the corners (Chaikin), keeping the ends
  let pts = simple;
  for (let r = 0; r < 2; r++) {
    const o: [number, number][] = [pts[0]];
    for (let j = 0; j + 1 < pts.length; j++) { const [ax, az] = pts[j], [bx, bz] = pts[j + 1]; o.push([ax * 0.75 + bx * 0.25, az * 0.75 + bz * 0.25], [ax * 0.25 + bx * 0.75, az * 0.25 + bz * 0.75]); }
    o.push(pts[pts.length - 1]); pts = o;
  }
  return pts;
}

const cache = new Map<string, Road[]>();
/** Roads passing through region (rx, rz). */
export function regionRoads(world: number, rx: number, rz: number): Road[] {
  const c = wrapR(rx);
  if (c !== rx) return regionRoads(world, c, rz).map((r) => ({ ...r, pts: r.pts.map(([x, z]) => [x + (rx - c) * REGION, z] as [number, number]) }));
  const key = world + ':' + rx + ':' + rz;
  let out = cache.get(key);
  if (out) return out;
  if (cache.size > 2048) cache.clear();
  out = [];
  const cx = rx * REGION, cz = rz * REGION, H = REGION / 2 + 20;
  for (const e of network(world)) {
    // a quick look at the pair first: the road stays within ROAD.margin of the straight line's box
    const bx = e.a.x + wrapDx(e.b.x - e.a.x), mx = (e.a.x + bx) / 2, mz = (e.a.z + e.b.z) / 2;
    const hw = Math.abs(bx - e.a.x) / 2 + ROAD.margin, hd = Math.abs(e.b.z - e.a.z) / 2 + ROAD.margin;
    if (Math.abs(wrapDx(cx - mx)) > hw + H || Math.abs(cz - mz) > hd + H) continue;
    const p = edgePath(world, e);
    if (!p) continue;
    const shift = (cx - mx) - wrapDx(cx - mx), pts = p.pts.map(([x, z]) => [x + shift, z] as [number, number]);
    const b = roadBounds({ pts } as Road);
    if (b.x1 < cx - H || b.x0 > cx + H || b.z1 < cz - H || b.z0 > cz + H) continue;
    out.push({ id: 'road:' + e.key, from: e.a.id, to: e.b.id, gate: p.gate, pts, half: ROAD.half });
  }
  cache.set(key, out);
  return out;
}
/** The village network, for maps and tests: pairs of village ids joined by a road (when a way was found). */
export const villageLinks = (world: number) => network(world).filter((e) => edgePath(world, e)).map((e) => [e.a.id, e.b.id] as [number, number]);

/** Nearest point on a polyline: returns [distance, x, z]. */
export function nearestOnRoad(r: Road, x: number, z: number): [number, number, number] {
  let best = Infinity, bx = 0, bz = 0;
  for (let i = 0; i + 1 < r.pts.length; i++) {
    const [ax, az] = r.pts[i], [cx, cz] = r.pts[i + 1], dx = cx - ax, dz = cz - az, L = dx * dx + dz * dz;
    const t = L ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L)) : 0;
    const px = ax + dx * t, pz = az + dz * t, d = Math.hypot(x - px, z - pz);
    if (d < best) { best = d; bx = px; bz = pz; }
  }
  return [best, bx, bz];
}
const bounds = new WeakMap<[number, number][], Rect>();
export function roadBounds(r: Road): Rect {
  let b = bounds.get(r.pts);
  if (!b) {
    b = { x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity };
    for (const [x, z] of r.pts) { b.x0 = Math.min(b.x0, x); b.z0 = Math.min(b.z0, z); b.x1 = Math.max(b.x1, x); b.z1 = Math.max(b.z1, z); }
    bounds.set(r.pts, b);
  }
  return b;
}

/**
 * A route by road (document 04 stage D3, the glove's route planner): from the village nearest (sx, sz) to the village
 * nearest (tx, tz) over the road network, shortest by the villages' straight distances (Dijkstra), every edge's way
 * worked out only for the edges the route takes (an edge with no way is struck out and the search runs again).
 * Returns the polyline from (sx, sz) through the roads to (tx, tz) and the villages passed, or null with no route.
 */
export function planRoute(world: number, sx: number, sz: number, tx: number, tz: number): { pts: [number, number][]; via: Poi[] } | null {
  const vs = allVillages(world), near = (x: number, z: number) => vs.reduce((b, v) => (Math.hypot(wrapDx(v.x - x), v.z - z) < Math.hypot(wrapDx(b.x - x), b.z - z) ? v : b));
  const from = near(sx, sz), to = near(tx, tz), dead = new Set<string>();
  for (let tries = 0; tries < 12; tries++) {
    const adj = new Map<number, { o: Poi; e: Edge; w: number }[]>();
    for (const e of network(world)) {
      if (dead.has(e.key)) continue;
      const w = Math.hypot(wrapDx(e.b.x - e.a.x), e.b.z - e.a.z);
      (adj.get(e.a.id) ?? adj.set(e.a.id, []).get(e.a.id)!).push({ o: e.b, e, w });
      (adj.get(e.b.id) ?? adj.set(e.b.id, []).get(e.b.id)!).push({ o: e.a, e, w });
    }
    const dist = new Map<number, number>([[from.id, 0]]), prev = new Map<number, { v: Poi; e: Edge }>(), done = new Set<number>();
    const open: Poi[] = [from];
    while (open.length) {
      open.sort((a, b) => dist.get(a.id)! - dist.get(b.id)!);
      const v = open.shift()!;
      if (done.has(v.id)) continue;
      done.add(v.id);
      if (v.id === to.id) break;
      for (const { o, e, w } of adj.get(v.id) ?? []) {
        const d = dist.get(v.id)! + w;
        if (d < (dist.get(o.id) ?? Infinity)) { dist.set(o.id, d); prev.set(o.id, { v, e }); open.push(o); }
      }
    }
    if (from.id !== to.id && !prev.has(to.id)) return null; // no road joins them
    const legs: { v: Poi; e: Edge }[] = [];
    for (let id = to.id; id !== from.id; id = legs[legs.length - 1].v.id) legs.push(prev.get(id)!);
    legs.reverse();
    const pts: [number, number][] = [[sx, sz]], via: Poi[] = [from];
    let ok = true;
    for (const { v, e } of legs) {
      const p = edgePath(world, e);
      if (!p) { dead.add(e.key); ok = false; break; }
      // the way runs from e.a in coordinates round it: shift it next to where we are and turn it round if we go b → a
      const last = pts[pts.length - 1][0], endX = v.id === e.a.id ? p.pts[0][0] : p.pts[p.pts.length - 1][0], shift = last + wrapDx(endX - last) - endX;
      let way = p.pts.map(([x, z]) => [x + shift, z] as [number, number]);
      if (v.id !== e.a.id) way = way.reverse();
      pts.push(...way);
      via.push(v.id === e.a.id ? e.b : e.a);
    }
    if (!ok) continue;
    pts.push([pts[pts.length - 1][0] + wrapDx(tx - pts[pts.length - 1][0]), tz]);
    return { pts, via };
  }
  return null;
}
