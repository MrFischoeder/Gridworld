// Rivers: fresh water running from the uplands down to the seas. Pure and deterministic, computed once per world.
//
// The planet between the ice caps is laid out as a grid of `RIVER.cell` cells. Every land cell drains to the sea
// along the cheapest way there (Dijkstra from the sea cells; the cost of a cell grows with a slow noise, so the
// ways wind, and with the mountains, so rivers leave them early; the land round Gridholm and every village is
// all but closed). Water gathers downstream: a cell that drains at least `RIVER.acc` cells carries a river. Each
// river mouth is followed upstream along its biggest arm (the main stem); every other arm starts a tributary that
// ends where it joins. The coarse cell chains are rounded (Chaikin) and given meanders (midpoint displacement),
// widened with the water they carry, and given a water level that only ever goes down: mostly the lowest ground
// met so far on the way down, a little of a straight fall from the head to the mouth, smoothed; a tributary ends
// at the level of the river it joins, a main stem at the sea.
//
// The terrain carves each river in `Terrain.exact` (`riverCarve`): a channel below the level, banks just above it
// (raising dips into low levees), and a valley cut into higher ground on either side. Where a road crosses, the
// channel is a shallow ford. `Terrain.water` reports river water ('fresh', with the current's `flow`).
import { fbm } from '../core/noise';
import { hash, rng } from '../core/rng';
import { WORLD_W, X_MIN, POLAR_Z, REGION, wrapDx, wrapX, allVillages, ruinName } from './regions';
import { seaMask, SEA } from './seas';
import { mountainMask } from './mountains';
import { naturalHeight } from './heights';

export const RIVER = {
  /** Grid cell of the drainage map (m). */
  cell: 250,
  /** Cells a river must drain before it shows (its catchment: acc × cell²). */
  acc: 90,
  /** Shortest river kept (cells). */
  minCells: 6,
  /** No rivers within this distance of Gridholm, nor within `village` of any other village (m). */
  clear: 2600, village: 600,
  /** Ice: no rivers this close to the polar caps (m). */
  pole: 1500,
  /** Spacing of the river's points after rounding and meanders (m). */
  step: 16,
  /** The valley: how far past the bank the land is cut down towards the river (m), and its side slope. */
  valley: 45, side: 0.35,
  /** Bank height above the water, and its width (m). */
  bank: 0.35, bankW: 1.2,
  /** Widest half-width and deepest channel (m). */
  maxHalf: 16, maxDepth: 4,
  /** Depth of a ford where a road crosses (m): shallow enough for the Scout. */
  ford: 0.45,
  /** How fast the water runs (m/s): a base and more on steeper reaches. */
  flow: 0.9, flowMax: 2.2,
};

export interface River {
  id: number; name: string;
  /** Points from the head (0) to the end (the sea or the river it joins), world metres (x unwrapped along the way). */
  x: number[]; z: number[];
  /** Water level, half-width of the channel and its depth at every point. */
  lv: number[]; half: number[]; depth: number[];
  /** The river it flows into (-1: the sea). */
  into: number;
}
/** One stretch of a river between two of its points, with what the terrain needs to carve it. */
export interface RiverSeg { r: number; i: number; ax: number; az: number; bx: number; bz: number; la: number; lb: number; ha: number; hb: number; da: number; db: number }
export interface RiverHere { d: number; level: number; half: number; depth: number; fx: number; fz: number; speed: number; seg: RiverSeg }

const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const wrapS = (s: number): [number, number] => { const n = Math.round(WORLD_W / s); return [WORLD_W / n, n]; };

// ---------- the drainage map ----------
interface Grid { nc: number; nr: number; c: number; z0: number; land: Uint8Array; closed: Uint8Array; par: Int32Array; acc: Float32Array }
function cellXZ(g: Grid, k: number): [number, number] { const i = k % g.nc, j = (k - i) / g.nc; return [X_MIN + (i + 0.5) * g.c, g.z0 + (j + 0.5) * g.c]; }

function drainage(world: number): Grid {
  const nc = Math.round(WORLD_W / RIVER.cell), c = WORLD_W / nc, zl = POLAR_Z - RIVER.pole, nr = Math.ceil(2 * zl / c), z0 = -nr * c / 2, n = nc * nr;
  const land = new Uint8Array(n), closed = new Uint8Array(n), cost = new Float32Array(n);
  const [ns, np] = wrapS(3600), [fs, fp] = wrapS(1100), seed = hash(world, 0x21e5);
  const vs = allVillages(world);
  for (let k = 0; k < n; k++) {
    const [x, z] = cellXZ({ nc, nr, c, z0 } as Grid, k);
    if (seaMask(world, x, z) > 0.5) continue;
    land[k] = 1;
    // winding low ways (the water follows the troughs of the noise) and the mountains, which it leaves early
    const a = fbm(seed, x / ns, z / ns, 3, np), b = fbm(seed + 7, x / fs, z / fs, 2, fp);
    cost[k] = 0.15 + 14 * a * a * a + 3 * b * b + 14 * mountainMask(world, x, z);
  }
  // the land round Gridholm and the villages: water goes round it
  const close = (x: number, z: number, r: number) => {
    const j0 = Math.floor((z - r - z0) / c), j1 = Math.floor((z + r - z0) / c), m = Math.ceil(r / c) + 1, ic = Math.floor((wrapX(x) - X_MIN) / c);
    for (let j = Math.max(0, j0); j <= Math.min(nr - 1, j1); j++) for (let di = -m; di <= m; di++) {
      const i = ((ic + di) % nc + nc) % nc, k = i + nc * j, [cx, cz] = cellXZ({ nc, nr, c, z0 } as Grid, k);
      if (Math.hypot(wrapDx(cx - x), cz - z) < r + c * 0.72) closed[k] = 1;
    }
  };
  close(0, 0, RIVER.clear);
  for (const v of vs) close(v.x, v.z, RIVER.village);
  for (let k = 0; k < n; k++) if (closed[k]) cost[k] += 400;
  // Dijkstra from every sea cell outwards: par[k] = where cell k drains to
  const dist = new Float32Array(n).fill(Infinity), par = new Int32Array(n).fill(-1), heap: number[] = [], hk: number[] = [];
  const push = (k: number, d: number) => {
    let i = heap.length; heap.push(d); hk.push(k);
    while (i) { const p = (i - 1) >> 1; if (heap[p] <= d) break; heap[i] = heap[p]; hk[i] = hk[p]; i = p; }
    heap[i] = d; hk[i] = k;
  };
  const pop = (): number => {
    const top = hk[0], d = heap.pop()!, k = hk.pop()!;
    if (heap.length) {
      let i = 0;
      for (;;) { let m = 2 * i + 1; if (m >= heap.length) break; if (m + 1 < heap.length && heap[m + 1] < heap[m]) m++; if (heap[m] >= d) break; heap[i] = heap[m]; hk[i] = hk[m]; i = m; }
      heap[i] = d; hk[i] = k;
    }
    return top;
  };
  for (let k = 0; k < n; k++) if (!land[k]) { dist[k] = 0; push(k, 0); }
  const done = new Uint8Array(n);
  while (hk.length) {
    const k = pop();
    if (done[k]) continue;
    done[k] = 1;
    const i = k % nc, j = (k - i) / nc;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const jj = j + dj; if (jj < 0 || jj >= nr) continue;
      const q = ((i + di) % nc + nc) % nc + nc * jj;
      if (!land[q] || done[q]) continue;
      const d = dist[k] + (cost[q] + (land[k] ? cost[k] : cost[q])) * 0.5 * (di && dj ? 1.414 : 1);
      if (d < dist[q]) { dist[q] = d; par[q] = k; push(q, d); }
    }
  }
  // water gathers downstream
  const order = Array.from({ length: n }, (_, k) => k).filter((k) => land[k] && dist[k] < Infinity).sort((a, b) => dist[b] - dist[a]);
  const acc = new Float32Array(n);
  for (const k of order) { acc[k] += 1; if (par[k] >= 0 && land[par[k]]) acc[par[k]] += acc[k]; }
  return { nc, nr, c, z0, land, closed, par, acc };
}

// ---------- rivers from the map ----------
type P = [number, number, number]; // x, z, water carried (cells)
/** Round a chain (Chaikin), keeping its ends. */
function chaikin(p: P[], times: number): P[] {
  for (let t = 0; t < times && p.length > 2; t++) {
    const q: P[] = [p[0]];
    for (let i = 0; i + 1 < p.length; i++) {
      const a = p[i], b = p[i + 1];
      q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25, a[2] * 0.75 + b[2] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75, a[2] * 0.25 + b[2] * 0.75]);
    }
    q.push(p[p.length - 1]); p = q;
  }
  return p;
}
/** Meanders: split every stretch in the middle and push the middle sideways (by hash), down to `RIVER.step`. */
function meander(p: P[], seed: number): P[] {
  const out: P[] = [p[0]];
  const split = (a: P, b: P, depth: number) => {
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
    if (L <= RIVER.step || depth > 12) { out.push(b); return; }
    const h = hash(seed, Math.round(a[0] * 4), Math.round(a[1] * 4), depth) / 1e6 - 0.5, off = h * L * (L > 60 ? 0.32 : 0.12);
    const m: P = [(a[0] + b[0]) / 2 - dz / L * off, (a[1] + b[1]) / 2 + dx / L * off, (a[2] + b[2]) / 2];
    split(a, m, depth + 1); split(m, b, depth + 1);
  };
  for (let i = 0; i + 1 < p.length; i++) split(p[i], p[i + 1], 0);
  return out;
}

interface Rivers { list: River[]; buckets: Map<number, RiverSeg[]> }
const cache = new Map<number, Rivers>();
const bkey = (rx: number, rz: number) => (rx + 32768) * 65536 + (rz + 32768);
/** Bucket of canonical region column: regions fold like gen/regions.ts wrapR (by index within the planet). */
const bcol = (x: number) => Math.floor((wrapX(x) - X_MIN) / REGION);

/** Every river of the world (computed once, ~0.5 s). */
export function riversOf(world: number): Rivers {
  let rv = cache.get(world);
  if (rv) return rv;
  const g = drainage(world), A = RIVER.acc, n = g.nc * g.nr;
  const isRiver = (k: number) => k >= 0 && g.land[k] === 1 && !g.closed[k] && g.acc[k] >= A;
  // upstream arms of every river cell
  const ups = new Map<number, number[]>();
  for (let k = 0; k < n; k++) if (isRiver(k)) { const p = g.par[k]; if (isRiver(p)) { let l = ups.get(p); if (!l) ups.set(p, l = []); l.push(k); } }
  for (const l of ups.values()) l.sort((a, b) => g.acc[b] - g.acc[a] || a - b);
  const list: River[] = [];
  // from every mouth: the main stem up its biggest arm, the other arms queued as tributaries
  const queue: { head: number; into: number; end: number }[] = [];
  for (let k = 0; k < n; k++) if (isRiver(k) && g.par[k] >= 0 && !g.land[g.par[k]]) queue.push({ head: k, into: -1, end: g.par[k] });
  queue.sort((a, b) => g.acc[b.head] - g.acc[a.head] || a.head - b.head);
  while (queue.length) {
    const { head: mouth, into, end } = queue.shift()!;
    // walk up from the mouth cell to the head; the smaller arms met on the way are tributaries
    const chain = [mouth], arms: [number, number][] = [];
    for (let k = mouth; ;) {
      const l = ups.get(k);
      if (!l) break;
      for (const o of l.slice(1)) arms.push([o, k]);
      k = l[0]; chain.push(k);
    }
    if (chain.length < RIVER.minCells) continue;
    for (const [o, k] of arms) queue.push({ head: o, into: list.length, end: k });
    chain.reverse(); // head first
    // coarse points (x unwrapped along the chain), then the end: the sea cell or the joint on the parent river
    const pts: P[] = [], wet = g.acc[chain[chain.length - 1]];
    let px = 0;
    for (const k of [...chain, end]) {
      const [x, z] = cellXZ(g, k), ux = pts.length ? px + wrapDx(x - px) : x;
      pts.push([ux, z, k === end ? wet : g.acc[k]]); px = ux;
    }
    const id = list.length, seed = hash(world, 0x21e6, chain[0]);
    let p = meander(chaikin(pts, 3), seed);
    const parent = into >= 0 ? list[into] : null;
    let endLv = SEA.level;
    if (parent) {
      // end exactly on the parent's nearest point, where its level is known
      const [ex, ez] = [p[p.length - 1][0], p[p.length - 1][1]];
      let bi = 0, bd = Infinity;
      for (let i = 0; i < parent.x.length; i++) { const d = Math.hypot(wrapDx(parent.x[i] - ex), parent.z[i] - ez); if (d < bd) { bd = d; bi = i; } }
      const jx = ex + wrapDx(parent.x[bi] - ex), jz = parent.z[bi];
      p = p.filter((q, i) => i === 0 || Math.hypot(q[0] - jx, q[1] - jz) > parent.half[bi] + 4 || i === p.length - 1);
      p[p.length - 1] = [jx, jz, p[p.length - 1][2]];
      endLv = parent.lv[bi];
    }
    const half = p.map((q) => Math.min(RIVER.maxHalf, 2 + 2.2 * Math.sqrt(q[2] / A)));
    const depth = p.map((q) => Math.min(RIVER.maxDepth, 1 + 0.6 * Math.sqrt(q[2] / A)));
    // the level: mostly the lowest ground met so far, a little of a straight fall, smoothed; never rising
    const s = [0]; for (let i = 1; i < p.length; i++) s.push(s[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
    const S = s[s.length - 1] || 1, run: number[] = [];
    // the ground every third point (the rest in between: the level is smoothed anyway)
    const gnd: number[] = new Array(p.length);
    for (let i = 0; i < p.length; i += 3) gnd[i] = naturalHeight(world, p[i][0], p[i][1]);
    gnd[p.length - 1] ??= naturalHeight(world, p[p.length - 1][0], p[p.length - 1][1]);
    for (let i = 0; i < p.length; i++) if (gnd[i] === undefined) { const a = i - (i % 3), b = Math.min(a + 3, p.length - 1), w = (i - a) / (b - a); gnd[i] = gnd[a] + (gnd[b] - gnd[a]) * w; }
    for (let i = 0; i < p.length; i++) run.push(Math.min(i ? run[i - 1] - 0.0005 * (s[i] - s[i - 1]) : Infinity, gnd[i] - 0.8));
    let lv = run.map((m, i) => Math.max(endLv, 0.8 * m + 0.2 * (run[0] + (endLv - run[0]) * s[i] / S)));
    for (let pass = 0; pass < 2; pass++) lv = lv.map((_, i) => { let a = 0, c = 0; for (let j = Math.max(0, i - 3); j <= Math.min(lv.length - 1, i + 3); j++) { a += lv[j]; c++; } return a / c; });
    // join the parent (or the sea) at its level over the last stretch
    const tail = Math.min(10, lv.length - 1);
    for (let i = lv.length - 1 - tail; i < lv.length; i++) { const w = (i - (lv.length - 1 - tail)) / tail; lv[i] = Math.max(endLv, lv[i] + (endLv - lv[i]) * w); }
    for (let i = 1; i < lv.length; i++) lv[i] = Math.min(lv[i], lv[i - 1]);
    const R = rng(seed);
    list.push({ id, name: ruinName(R) + ' River', x: p.map((q) => q[0]), z: p.map((q) => q[1]), lv, half, depth, into });
  }
  // buckets by region (canonical column) holding every stretch whose valley reaches in
  const buckets = new Map<number, RiverSeg[]>();
  for (const r of list) for (let i = 0; i + 1 < r.x.length; i++) {
    const seg: RiverSeg = { r: r.id, i, ax: r.x[i], az: r.z[i], bx: r.x[i + 1], bz: r.z[i + 1], la: r.lv[i], lb: r.lv[i + 1], ha: r.half[i], hb: r.half[i + 1], da: r.depth[i], db: r.depth[i + 1] };
    const m = Math.max(seg.ha, seg.hb) + RIVER.valley + 8;
    const x0 = Math.min(seg.ax, seg.bx) - m, x1 = Math.max(seg.ax, seg.bx) + m, z0 = Math.min(seg.az, seg.bz) - m, z1 = Math.max(seg.az, seg.bz) + m;
    const c0 = Math.floor((x0 + REGION / 2) / REGION), c1 = Math.floor((x1 + REGION / 2) / REGION);
    for (let cx = c0; cx <= c1; cx++) for (let cz = Math.floor((z0 + REGION / 2) / REGION); cz <= Math.floor((z1 + REGION / 2) / REGION); cz++) {
      const k = bkey(bcol(cx * REGION), cz);
      let l = buckets.get(k); if (!l) buckets.set(k, l = []); l.push(seg);
    }
  }
  rv = { list, buckets };
  cache.set(world, rv);
  return rv;
}

/** River stretches whose valley may reach the rect, moved to the copy of the planet the rect lies in. */
export function riverSegsIn(world: number, x0: number, z0: number, x1: number, z1: number): RiverSeg[] {
  // round Gridholm there are none (see nearRiver)
  const far = Math.hypot(Math.max(Math.abs(wrapDx(x0)), Math.abs(wrapDx(x1))), Math.max(Math.abs(z0), Math.abs(z1)));
  if (far + RIVER.maxHalf + RIVER.valley + 8 < RIVER.clear - RIVER.cell) return [];
  const { buckets } = riversOf(world), out: RiverSeg[] = [], seen = new Set<RiverSeg>();
  for (let cx = Math.floor((x0 + REGION / 2) / REGION); cx <= Math.floor((x1 + REGION / 2) / REGION); cx++)
    for (let cz = Math.floor((z0 + REGION / 2) / REGION); cz <= Math.floor((z1 + REGION / 2) / REGION); cz++) {
      const l = buckets.get(bkey(bcol(cx * REGION), cz));
      if (!l) continue;
      for (const s of l) {
        if (seen.has(s)) continue;
        seen.add(s);
        const dx = cx * REGION + wrapDx(s.ax - cx * REGION) - s.ax; // shift to this copy
        out.push(dx ? { ...s, ax: s.ax + dx, bx: s.bx + dx } : s);
      }
    }
  return out;
}

/** The nearest river stretch at (x, z) among `segs`, with the water there. */
export function riverNear(segs: RiverSeg[], x: number, z: number): RiverHere | null {
  let best: RiverHere | null = null;
  for (const s of segs) { const r = segHere(s, x, z, best ? best.d : Infinity); if (r) best = r; }
  return best;
}
/** The water of one stretch at (x, z), or null when it is no nearer than `than`. */
function segHere(s: RiverSeg, x: number, z: number, than = Infinity): RiverHere | null {
  const dx = s.bx - s.ax, dz = s.bz - s.az, L2 = dx * dx + dz * dz;
  const u = L2 ? Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / L2)) : 0;
  const d = Math.hypot(x - s.ax - dx * u, z - s.az - dz * u);
  if (d >= than) return null;
  const L = Math.sqrt(L2) || 1, drop = s.la - s.lb;
  return { d, level: s.la + (s.lb - s.la) * u, half: s.ha + (s.hb - s.ha) * u, depth: s.da + (s.db - s.da) * u, fx: dx / L, fz: dz / L,
    speed: Math.min(RIVER.flowMax, RIVER.flow + drop / L * 60), seg: s };
}
/** Is (x, z) within `margin` of a river's water (for keeping places, lakes and roads off rivers)? */
export function nearRiver(world: number, x: number, z: number, margin = 0): boolean {
  // no river comes this close to Gridholm (the drainage map closes the land round it): no need to work them out
  if (Math.hypot(wrapDx(x), z) + margin + RIVER.maxHalf < RIVER.clear - RIVER.cell) return false;
  const { buckets } = riversOf(world), m = margin + RIVER.maxHalf;
  for (let cx = Math.floor((x - m + REGION / 2) / REGION); cx <= Math.floor((x + m + REGION / 2) / REGION); cx++)
    for (let cz = Math.floor((z - m + REGION / 2) / REGION); cz <= Math.floor((z + m + REGION / 2) / REGION); cz++) {
      const l = buckets.get(bkey(bcol(cx * REGION), cz));
      if (l) for (const sg of l) {
        const sx = x + wrapDx(sg.ax - x) - sg.ax; // this copy of the planet
        const ax = sg.ax + sx, bx = sg.bx + sx, dx = bx - ax, dz = sg.bz - sg.az, L2 = dx * dx + dz * dz;
        const u = L2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - sg.az) * dz) / L2)) : 0;
        if (Math.hypot(x - ax - dx * u, z - sg.az - dz * u) < sg.ha + (sg.hb - sg.ha) * u + margin) return true;
      }
    }
  return false;
}

/** The target of the land beside a river at distance d from its middle: the bank, then the valley side. */
const side = (h: RiverHere, d: number) => h.level + Math.min(RIVER.bank, Math.max(0, d - h.half) * RIVER.bank / RIVER.bankW) + Math.max(0, d - h.half - RIVER.bankW) * RIVER.side;
/**
 * The land at (x, z) with the rivers carved in: first the banks everywhere (dips raised into low levees), then
 * the valleys cut into higher ground and the channels below the water. `ford(x, z)` says a road crosses there.
 */
export function riverCarve(segs: RiverSeg[], x: number, z: number, h: number, ford: (x: number, z: number) => boolean): number {
  if (!segs.length) return h;
  const here: RiverHere[] = [];
  for (const s of segs) { const r = segHere(s, x, z, Math.max(s.ha, s.hb) + RIVER.valley); if (r && r.d < r.half + RIVER.valley) here.push(r); }
  if (!here.length) return h;
  for (const r of here) if (r.d < r.half + 6 && r.level > SEA.level + 0.05) { // no levees out in the sea
    const t = side(r, r.d);
    if (h < t) h += (t - h) * (r.d <= r.half + 2 ? 1 : 1 - smooth((r.d - r.half - 2) / 4));
  }
  for (const r of here) {
    const t = side(r, r.d);
    if (h > t) h += (t - h) * (1 - smooth(Math.max(0, r.d - r.half) / RIVER.valley));
    if (r.d < r.half) {
      const dp = ford(x, z) ? Math.min(r.depth, RIVER.ford) : r.depth, q = r.d / r.half;
      h = Math.min(h, r.level - dp * (1 - q * q));
    }
  }
  return h;
}
