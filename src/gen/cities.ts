// The ruined cities of the old world (pure, deterministic from the world seed): `CITY.n` great dead cities, each
// a kilometre or more across, standing on fairly level dry land well out from Gridholm. Nothing else is placed in
// them (villages, temples, crash sites, camps, lakes, wells, trees, rocks, plants, fog sites, installations keep
// off, rivers and roads go round), and they are dangerous (gen/danger.ts adds `CITY.danger`).
// Each city has its own pattern (`CityPattern`: a plain grid, a warped old town, a radial city of rings and spokes,
// a grid cut by diagonal boulevards) and its own numbers (block sizes, how tall its core grows, where the core is,
// how much of it has fallen). The layout is in the city's own frame (u, v), turned by `yaw`:
//   world x = cx + u·cos(yaw) + v·sin(yaw), world z = cz − u·sin(yaw) + v·cos(yaw)  (three.js rotation.y = yaw)
// Streets are straight stretches with a width; buildings are rectangles along them (each at its own angle `a` in the
// city's frame), with a number of floors and a state (standing with a broken crown, gutted to the frame, or fallen
// into a heap); wrecked cars lie in the streets.
// Dependencies: only the natural land (heights, sea, mountains) and the planet's numbers, so gen/regions.ts can ask
// `inCity` while placing villages and temples without an import loop at evaluation time.
import { hash, rng } from '../core/rng';
import { POLAR_Z, worldDist, wrapDx, ruinName } from './regions';
import { mountainMask } from './mountains';
import { seaMask } from './seas';
import { naturalHeight } from './heights';

export type CityPattern = 'grid' | 'warped' | 'radial' | 'diagonal';
export const CITY = {
  /** How many cities a world has (fewer when the land has no room), their radius (m). */
  n: 10, r: [520, 820] as [number, number],
  /** Distance bands from Gridholm (m): the first two cities lie nearer, the rest anywhere in the wide band. */
  near: [3800, 8000] as [number, number], band: [7000, 26000] as [number, number],
  /** Least distance between two cities' edges (m), and from the poles' ice. */
  apart: 4500, ice: 1500,
  /** How far other things keep off a city's edge (m): villages, places. */
  village: 450, place: 80,
  /** Danger added in a city (faded in over `fade` m round its edge). */
  danger: 2, fade: 250,
  /** Floor height (m). */
  floor: 3.4,
};
export const PATTERNS: CityPattern[] = ['grid', 'warped', 'radial', 'diagonal'];
export interface CitySite {
  i: number; id: string; name: string; x: number; z: number; r: number; yaw: number; pattern: CityPattern;
  /** Mean ground height at the site (for maps and tests). */
  y: number;
}

/** Why a spot does not fit a city of radius r (null: it does). */
function misfit(world: number, x: number, z: number, r: number): string | null {
  if (Math.abs(z) > POLAR_Z - CITY.ice - r) return 'ice';
  let lo = Infinity, hi = -Infinity;
  for (const k of [0, 0.5, 1, 1.3]) for (let a = 0; a < 6.28; a += k > 1 ? 0.524 : 0.785) {
    const px = x + Math.cos(a) * r * k, pz = z + Math.sin(a) * r * k;
    if (seaMask(world, px, pz) > 0.01) return 'sea';
    if (mountainMask(world, px, pz) > (k > 1 ? 0.2 : 0.04)) return 'mountain';
    if (k <= 1) { const h = naturalHeight(world, px, pz); lo = Math.min(lo, h); hi = Math.max(hi, h); }
    if (!k) break;
  }
  if (hi - lo > 20) return 'slope';
  return null;
}

const cache = new Map<number, CitySite[]>();
/** The cities of a world (canonical coordinates), in the order they were placed. */
export function citySites(world: number): CitySite[] {
  const hit = cache.get(world); if (hit) return hit;
  const out: CitySite[] = [];
  cache.set(world, out); // (set first: a nested call while searching sees no cities rather than recursing)
  for (let i = 0; i < CITY.n; i++) {
    const [d0, d1] = i < 2 ? CITY.near : CITY.band;
    for (let k = 0; k < 400; k++) {
      const h = (s: number) => (hash(world, i, k, s) % 100000) / 100000;
      const a = h(0xc171) * Math.PI * 2, d = d0 + h(0xc172) * (d1 - d0), r = CITY.r[0] + h(0xc173) * (CITY.r[1] - CITY.r[0]);
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (out.some((o) => worldDist(o.x, o.z, x, z) < o.r + r + CITY.apart)) continue;
      if (misfit(world, x, z, r)) continue;
      const R = rng(hash(world, i, k, 0xc174));
      out.push({ i, id: 'city:' + i, name: ruinName(R) + ' ' + ['Metropolis', 'City', 'Sprawl', 'Megacity'][Math.floor(R() * 4)], x, z, r, yaw: R() * Math.PI, pattern: PATTERNS[(hash(world, i, 0xc175) + i) % PATTERNS.length], y: naturalHeight(world, x, z) });
      break;
    }
  }
  return out;
}
/** The city whose ground (its radius plus m) holds (x, z), if any. */
export function cityAt(world: number, x: number, z: number, m = 0): CitySite | null {
  if (Math.hypot(wrapDx(x), z) < CITY.near[0] - CITY.r[1] - m - 50) return null; // none near home: a cheap early out
  for (const c of citySites(world)) if (worldDist(c.x, c.z, x, z) < c.r + m) return c;
  return null;
}
export const inCity = (world: number, x: number, z: number, m = 0) => cityAt(world, x, z, m) !== null;
/** Extra danger at (x, z) from a city (0 outside, CITY.danger inside, faded over CITY.fade round the edge). */
export function cityDanger(world: number, x: number, z: number): number {
  const c = cityAt(world, x, z, CITY.fade);
  if (!c) return 0;
  const t = Math.max(0, Math.min(1, (c.r + CITY.fade - worldDist(c.x, c.z, x, z)) / CITY.fade));
  return CITY.danger * t * t * (3 - 2 * t);
}
/** World position of a point (u, v) in a city's frame (on the city's canonical copy). */
export function cityToWorld(c: CitySite, u: number, v: number): [number, number] {
  const co = Math.cos(c.yaw), si = Math.sin(c.yaw);
  return [c.x + u * co + v * si, c.z - u * si + v * co];
}
/** A world position (any copy of the planet) in a city's frame. */
export function worldToCity(c: CitySite, x: number, z: number): [number, number] {
  const dx = wrapDx(x - c.x), dz = z - c.z, co = Math.cos(c.yaw), si = Math.sin(c.yaw);
  return [dx * co - dz * si, dx * si + dz * co];
}

// ---------- the layout ----------
export interface Street { ax: number; az: number; bx: number; bz: number; w: number }
/** State: 0 standing with a broken crown, 1 gutted (the upper floors only a frame), 2 fallen into a heap. */
export interface Bld { x: number; z: number; w: number; d: number; a: number; f: number; st: 0 | 1 | 2; s: number }
export interface Car { x: number; z: number; a: number; s: number }
export interface CityLayout {
  c: CitySite; streets: Street[]; blds: Bld[]; cars: Car[];
  /** Spatial index: cell size, half extent; buildings, streets and cars by cell. */
  cell: number; half: number; n: number; bIdx: number[][]; sIdx: number[][]; cIdx: number[][];
  /** The core (tallest part) in the city's frame. */
  core: [number, number];
}
export const CELL = 32;

/** Distance from point (px, pz) to segment a-b. */
function segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const ex = bx - ax, ez = bz - az, L = ex * ex + ez * ez, t = L ? Math.max(0, Math.min(1, ((px - ax) * ex + (pz - az) * ez) / L)) : 0;
  return Math.hypot(px - ax - ex * t, pz - az - ez * t);
}
/** The four corners of a building (city frame). */
export function corners(b: { x: number; z: number; w: number; d: number; a: number }, grow = 0): [number, number][] {
  const co = Math.cos(b.a), si = Math.sin(b.a), hw = b.w / 2 + grow, hd = b.d / 2 + grow;
  return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([u, v]) => [b.x + u * co - v * si, b.z + u * si + v * co] as [number, number]);
}
/** Does segment a-b come within `m` of rectangle b (exact in 2D)? */
function segNearRect(b: Bld | { x: number; z: number; w: number; d: number; a: number }, s: Street, m: number): boolean {
  const co = Math.cos(b.a), si = Math.sin(b.a), hw = b.w / 2 + m, hd = b.d / 2 + m;
  // the segment in the rectangle's frame
  const L = (x: number, z: number): [number, number] => { const dx = x - b.x, dz = z - b.z; return [dx * co + dz * si, -dx * si + dz * co]; };
  const [ax, az] = L(s.ax, s.az), [bx, bz] = L(s.bx, s.bz);
  // Liang-Barsky clip against the grown box
  let t0 = 0, t1 = 1; const dx = bx - ax, dz = bz - az;
  for (const [p, q] of [[-dx, ax + hw], [dx, hw - ax], [-dz, az + hd], [dz, hd - az]]) {
    if (p === 0) { if (q < 0) return false; continue; }
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
  }
  return true;
}
/** Do two rectangles overlap (with a gap of g between them)? Separating axes. */
function rectsOverlap(p: Bld, q: Bld, g: number): boolean {
  const A = corners(p, g / 2), B = corners(q, g / 2);
  for (const poly of [A, B]) for (let i = 0; i < 4; i++) {
    const [x0, z0] = poly[i], [x1, z1] = poly[(i + 1) % 4], nx = z1 - z0, nz = x0 - x1;
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (const [x, z] of A) { const t = x * nx + z * nz; a0 = Math.min(a0, t); a1 = Math.max(a1, t); }
    for (const [x, z] of B) { const t = x * nx + z * nz; b0 = Math.min(b0, t); b1 = Math.max(b1, t); }
    if (a1 < b0 || b1 < a0) return false;
  }
  return true;
}

/** The streets of a pattern, before they are clipped to the city's circle. */
function streetsOf(c: CitySite, R: () => number): Street[] {
  const r = c.r, out: Street[] = [];
  const add = (ax: number, az: number, bx: number, bz: number, w: number) => out.push({ ax, az, bx, bz, w });
  if (c.pattern === 'radial') {
    const ring = 95 + R() * 40, spokes = 9 + Math.floor(R() * 5), plaza = 45 + R() * 20, rot = R() * 6.283;
    const rings: number[] = []; for (let q = plaza; q < r - 30; q += ring) rings.push(q);
    rings.forEach((q, k) => { // each ring as chords, a few broken through
      const n = Math.max(10, Math.round(q * 6.283 / 34));
      for (let i = 0; i < n; i++) {
        if (k > 0 && R() < 0.06) continue;
        const a0 = rot + i / n * 6.283, a1 = rot + (i + 1) / n * 6.283;
        add(Math.cos(a0) * q, Math.sin(a0) * q, Math.cos(a1) * q, Math.sin(a1) * q, k === 0 ? 14 : k % 2 ? 9 : 11);
      }
    });
    for (let i = 0; i < spokes; i++) { const a = rot + i / spokes * 6.283; add(Math.cos(a) * plaza, Math.sin(a) * plaza, Math.cos(a) * r, Math.sin(a) * r, 15); }
    // further out the sectors widen: more spokes from the second ring on, then the fourth
    for (const [from, mul] of [[1, 2], [3, 4]] as [number, number][]) if (rings[from]) for (let i = 0; i < spokes * mul; i++) {
      if (i % mul === 0) continue;
      const a = rot + i / (spokes * mul) * 6.283; add(Math.cos(a) * rings[from], Math.sin(a) * rings[from], Math.cos(a) * r, Math.sin(a) * r, 9);
    }
    return out;
  }
  const bu = 70 + R() * 50, bv = 50 + R() * 45, ou = R() * bu, ov = R() * bv, warp = c.pattern === 'warped' ? 0.22 + R() * 0.12 : 0;
  const ni = Math.ceil(r / bu) + 1, nj = Math.ceil(r / bv) + 1;
  const node = (i: number, j: number): [number, number] => {
    const jit = (s: number) => warp ? ((hash(c.i, i + 64, j + 64, s) % 1000) / 1000 - 0.5) * 2 * warp : 0;
    return [i * bu + ou + jit(1) * bu, j * bv + ov + jit(2) * bv];
  };
  const avenue = (k: number, every: number) => ((k % every) + every) % every === 0;
  for (let i = -ni; i <= ni; i++) for (let j = -nj; j <= nj; j++) {
    const [x, z] = node(i, j);
    if (Math.hypot(x, z) > r + bu) continue;
    if (R() > 0.07) { const [x2, z2] = node(i + 1, j); add(x, z, x2, z2, avenue(j, 3) ? 16 : 10); }
    if (R() > 0.07) { const [x2, z2] = node(i, j + 1); add(x, z, x2, z2, avenue(i, 4) ? 16 : 10); }
  }
  if (c.pattern === 'diagonal') { // two boulevards across the grid, through the middle
    const a = Math.PI / 4 + (R() - 0.5) * 0.3, b = -Math.PI / 4 + (R() - 0.5) * 0.3;
    for (const t of [a, b]) for (let s = -r; s < r; s += 40) add(Math.cos(t) * s, Math.sin(t) * s, Math.cos(t) * (s + 40), Math.sin(t) * (s + 40), 20);
  }
  return out;
}

/** Clip a street to the disc of radius r (null when it lies outside), then cut it into pieces of at most `max` m. */
function clipCut(s: Street, r: number, max: number): Street[] {
  const dx = s.bx - s.ax, dz = s.bz - s.az, A = dx * dx + dz * dz, B = 2 * (s.ax * dx + s.az * dz), C = s.ax * s.ax + s.az * s.az - r * r, D = B * B - 4 * A * C;
  if (D <= 0 || !A) return [];
  const t0 = Math.max(0, (-B - Math.sqrt(D)) / (2 * A)), t1 = Math.min(1, (-B + Math.sqrt(D)) / (2 * A));
  if (t1 <= t0) return [];
  const L = Math.sqrt(A) * (t1 - t0), n = Math.max(1, Math.ceil(L / max)), out: Street[] = [];
  for (let k = 0; k < n; k++) {
    const p = t0 + (t1 - t0) * k / n, q = t0 + (t1 - t0) * (k + 1) / n;
    out.push({ ax: s.ax + dx * p, az: s.az + dz * p, bx: s.ax + dx * q, bz: s.az + dz * q, w: s.w });
  }
  return out;
}

const layouts = new Map<string, CityLayout>();
/** A city's streets, buildings and cars (cached). */
export function cityLayout(world: number, c: CitySite): CityLayout {
  const key = world + ':' + c.i;
  const hit = layouts.get(key); if (hit) return hit;
  const R = rng(hash(world, c.i, 0xc1a7)), r = c.r;
  // the city's own numbers: where its core stands, how tall it grows, how much has fallen
  const core: [number, number] = [(R() - 0.5) * r * 0.5, (R() - 0.5) * r * 0.5];
  const maxF = 18 + Math.floor(R() * 28), spread = 0.28 + R() * 0.16, fallen = 0.08 + R() * 0.12, gutted = 0.35 + R() * 0.3, density = 0.85 + R() * 0.15;
  const streets: Street[] = [];
  for (const s of streetsOf(c, R)) streets.push(...clipCut(s, r, 48));
  const half = r + 40, n = Math.ceil(2 * half / CELL);
  const cellOf = (x: number, z: number) => Math.max(0, Math.min(n - 1, Math.floor((x + half) / CELL))) + n * Math.max(0, Math.min(n - 1, Math.floor((z + half) / CELL)));
  const sIdx: number[][] = Array.from({ length: n * n }, () => []), bIdx: number[][] = Array.from({ length: n * n }, () => []), cIdx: number[][] = Array.from({ length: n * n }, () => []);
  const cellsOfBox = (x0: number, z0: number, x1: number, z1: number) => {
    const out: number[] = [];
    const i0 = Math.max(0, Math.floor((x0 + half) / CELL)), i1 = Math.min(n - 1, Math.floor((x1 + half) / CELL)), j0 = Math.max(0, Math.floor((z0 + half) / CELL)), j1 = Math.min(n - 1, Math.floor((z1 + half) / CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) out.push(i + n * j);
    return out;
  };
  streets.forEach((s, k) => { const m = s.w / 2 + 4; for (const q of cellsOfBox(Math.min(s.ax, s.bx) - m, Math.min(s.az, s.bz) - m, Math.max(s.ax, s.bx) + m, Math.max(s.az, s.bz) + m)) sIdx[q].push(k); });
  const blds: Bld[] = [];
  const boxOf = (b: Bld) => { const cs = corners(b); return cellsOfBox(Math.min(...cs.map((p) => p[0])), Math.min(...cs.map((p) => p[1])), Math.max(...cs.map((p) => p[0])), Math.max(...cs.map((p) => p[1]))); };
  const fits = (b: Bld) => {
    if (corners(b).some(([x, z]) => Math.hypot(x, z) > r - 4)) return false;
    const cells = boxOf(b), seen = new Set<number>();
    for (const q of cells) for (const k of sIdx[q]) { if (seen.has(k)) continue; seen.add(k); const s = streets[k]; if (segNearRect(b, s, s.w / 2 + 3)) return false; }
    const seenB = new Set<number>();
    for (const q of cells) for (const k of bIdx[q]) { if (seenB.has(k)) continue; seenB.add(k); if (rectsOverlap(b, blds[k], 2)) return false; }
    return true;
  };
  const place = (b: Bld) => { const k = blds.length; blds.push(b); for (const q of boxOf(b)) bIdx[q].push(k); };
  // how tall a building at (x, z) grows: the core rises, the edge is low
  const floors = (x: number, z: number, roll: number) => {
    const q = Math.hypot(x - core[0], z - core[1]) / r, edge = Math.hypot(x, z) / r;
    const tall = maxF * Math.exp(-(q / spread) * (q / spread));
    let f = 2 + Math.floor(roll * 4) + Math.round(tall * (0.35 + 0.65 * ((roll * 7.3) % 1)));
    if (q < spread * 0.6 && roll > 0.93) f = Math.round(maxF * (0.9 + roll * 0.5)); // a landmark tower
    if (edge > 0.85) f = Math.min(f, 3);
    return Math.max(1, f);
  };
  // lots along every street, both sides
  for (const s of streets) {
    const dx = s.bx - s.ax, dz = s.bz - s.az, L = Math.hypot(dx, dz);
    if (L < 8) continue;
    const ux = dx / L, uz = dz / L, a = Math.atan2(uz, ux);
    for (const side of [-1, 1]) {
      let t = 2 + R() * 4;
      while (t < L - 6) {
        const mx = s.ax + ux * t, mz = s.az + uz * t, q = Math.hypot(mx - core[0], mz - core[1]) / r;
        const big = q < spread ? 1 : 0;
        const fw = 12 + R() * (14 + 12 * big), d = 12 + R() * (12 + 14 * big);
        if (t + fw > L + 4) break;
        const off = s.w / 2 + 3.5 + d / 2, cx = mx + ux * fw / 2 - uz * side * off, cz = mz + uz * fw / 2 + ux * side * off;
        const roll = R();
        const b: Bld = { x: cx, z: cz, w: fw, d, a, f: floors(cx, cz, roll), st: 0, s: hash(world, c.i, blds.length, 0xb1d) };
        if (R() < density && fits(b)) place(b);
        t += fw + 1.5 + R() * 3;
      }
    }
  }
  // infill: the backs of the blocks (towers set back from the street, yards between)
  for (let k = 0, tries = Math.round(r * r / 120); k < tries; k++) {
    const a = R() * 6.283, q = Math.sqrt(R()) * r * 0.95, x = Math.cos(a) * q, z = Math.sin(a) * q;
    const near = bIdx[cellOf(x, z)];
    const ang = near.length ? blds[near[0]].a : c.pattern === 'radial' ? Math.atan2(z, x) : 0;
    const b: Bld = { x, z, w: 10 + R() * 20, d: 10 + R() * 20, a: ang, f: floors(x, z, R()), st: 0, s: hash(world, c.i, blds.length, 0xb1d) };
    if (fits(b)) place(b);
  }
  // their state
  for (const b of blds) {
    const roll = (b.s % 1000) / 1000;
    b.st = roll < fallen ? 2 : b.f >= 4 && roll < fallen + gutted ? 1 : 0;
  }
  // wrecked cars in the streets
  const cars: Car[] = [];
  for (const s of streets) {
    const L = Math.hypot(s.bx - s.ax, s.bz - s.az);
    if (R() > 0.45 || L < 10) continue;
    const t = 0.15 + R() * 0.7, side = (R() - 0.5) * (s.w - 3), ux = (s.bx - s.ax) / L, uz = (s.bz - s.az) / L;
    const car: Car = { x: s.ax + (s.bx - s.ax) * t - uz * side, z: s.az + (s.bz - s.az) * t + ux * side, a: Math.atan2(uz, ux) + (R() - 0.5) * 0.9, s: hash(world, c.i, cars.length, 0xca2) };
    cars.push(car); cIdx[cellOf(car.x, car.z)].push(cars.length - 1);
  }
  const out: CityLayout = { c, streets, blds, cars, cell: CELL, half, n, bIdx, sIdx, cIdx, core };
  layouts.set(key, out);
  return out;
}
/** Indices of the buildings in the cells round a point of the city's frame (within m). */
export function bldsNear(L: CityLayout, u: number, v: number, m: number): number[] {
  const out = new Set<number>();
  const i0 = Math.max(0, Math.floor((u - m + L.half) / L.cell)), i1 = Math.min(L.n - 1, Math.floor((u + m + L.half) / L.cell));
  const j0 = Math.max(0, Math.floor((v - m + L.half) / L.cell)), j1 = Math.min(L.n - 1, Math.floor((v + m + L.half) / L.cell));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) for (const k of L.bIdx[i + L.n * j]) out.add(k);
  return [...out];
}
/** Indices of the cars in the cells round a point of the city's frame. */
export function carsNear(L: CityLayout, u: number, v: number, m: number): number[] {
  const out: number[] = [];
  const i0 = Math.max(0, Math.floor((u - m + L.half) / L.cell)), i1 = Math.min(L.n - 1, Math.floor((u + m + L.half) / L.cell));
  const j0 = Math.max(0, Math.floor((v - m + L.half) / L.cell)), j1 = Math.min(L.n - 1, Math.floor((v + m + L.half) / L.cell));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) out.push(...L.cIdx[i + L.n * j]);
  return out;
}
/** Is (u, v) inside building b grown by m (city frame)? */
export function inBld(b: Bld, u: number, v: number, m: number): boolean {
  const co = Math.cos(b.a), si = Math.sin(b.a), dx = u - b.x, dz = v - b.z;
  return Math.abs(dx * co + dz * si) < b.w / 2 + m && Math.abs(-dx * si + dz * co) < b.d / 2 + m;
}
/** How tall a building stands (m), and how tall its fallen heap is. */
export const bldTop = (b: Bld) => (b.st === 2 ? Math.min(4.5, 1.8 + b.f * 0.2) : b.f * CITY.floor);
export { segDist };
