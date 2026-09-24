// The inside of a cave system: an organic labyrinth, not a voxel maze. Chambers (lobed, of different sizes) are
// joined by winding tunnels: a spanning tree over the chambers, a few extra links that make loops, and some dead-end
// branches with pockets at their ends. Every point has a smooth floor and a smooth ceiling: across a tunnel the floor
// is flat in the middle and curls up at the sides while the vault comes down to meet it, so walls are rounded; where
// they meet there is rock. A cave has one or two entrances (a linked system runs right through the mountain).
// Pure and deterministic: the same seed gives the same cave; world/cavelevel.ts builds meshes and collision from it.
import { rng, rangeInt } from '../core/rng';
import { fbm } from '../core/noise';

export interface CaveNode { x: number; z: number; y: number; r: number; h: number; lobes: number[]; kind: 'entrance' | 'chamber' | 'pocket' }
export interface CaveLink { a: number; b: number; pts: [number, number][]; r: number[]; y: number[]; h: number; bb: [number, number, number, number] }
export interface CaveMap {
  seed: number;
  /** Grid of samples every metre: origin and size (x, z). */
  ox: number; oz: number; nx: number; nz: number;
  /** Floor and ceiling heights per sample (row-major along x); the ceiling at or below the floor is rock. */
  floor: Float32Array; ceil: Float32Array;
  nodes: CaveNode[]; links: CaveLink[];
  /** Entrance i: where you stand when you come in (and the way in), and the spot that leads out. */
  exits: { x: number; z: number; y: number; yaw: number; ox: number; oz: number }[];
  chests: { x: number; z: number }[]; crystals: { x: number; z: number }[];
  /** Stalagmites (up from the floor) and stalactites (down from the ceiling): position, radius, length. */
  spikes: { x: number; z: number; r: number; len: number; up: boolean }[];
}
const smooth = (t: number) => t * t * (3 - 2 * t);

/** Build the cave. `entrances`: 1, or 2 for a system with a way in on each side of the mountain. */
export function generateCave(seed: number, entrances: 1 | 2): CaveMap {
  const R = rng(seed), ri = rangeInt(R);
  const W = entrances === 2 ? 200 : 140, D = 130, M = 8; // size and margin
  const nodes: CaveNode[] = [];
  const lobes = () => Array.from({ length: 5 }, () => 0.7 + R() * 0.55);
  // entrances on the west (and east) edge
  nodes.push({ x: M + 4, z: D / 2 + ri(-20, 20), y: 0, r: 3.2, h: 4, lobes: lobes(), kind: 'entrance' });
  if (entrances === 2) nodes.push({ x: W - M - 4, z: D / 2 + ri(-20, 20), y: 0, r: 3.2, h: 4, lobes: lobes(), kind: 'entrance' });
  // chambers: spread out with a minimum spacing
  const want = entrances === 2 ? ri(8, 11) : ri(6, 8);
  for (let t = 0; t < 400 && nodes.length < want + entrances; t++) {
    const r = 5 + R() * 7, x = M + r + 6 + R() * (W - 2 * (M + r + 6)), z = M + r + 4 + R() * (D - 2 * (M + r + 4));
    if (nodes.some((n) => Math.hypot(n.x - x, n.z - z) < n.r + r + 10)) continue;
    nodes.push({ x, z, y: 0, r, h: 5 + r * 0.45 + R() * 3, lobes: lobes(), kind: 'chamber' });
  }
  // links: a spanning tree (Prim, by distance), then a few extra links for loops
  const links: [number, number][] = [], inTree = [0];
  const dist = (a: number, b: number) => Math.hypot(nodes[a].x - nodes[b].x, nodes[a].z - nodes[b].z);
  while (inTree.length < nodes.length) {
    let best: [number, number] | null = null, bd = Infinity;
    for (const a of inTree) for (let b = 0; b < nodes.length; b++) if (!inTree.includes(b) && dist(a, b) < bd) { bd = dist(a, b); best = [a, b]; }
    links.push(best!); inTree.push(best![1]);
  }
  const extra = ri(1, entrances === 2 ? 4 : 3);
  for (let t = 0; t < 60 && links.length < nodes.length - 1 + extra; t++) {
    const a = ri(0, nodes.length - 1), b = ri(0, nodes.length - 1);
    if (a === b || links.some(([p, q]) => (p === a && q === b) || (p === b && q === a)) || dist(a, b) > 70) continue;
    links.push([a, b]);
  }
  // dead-end branches: side tunnels from chambers ending in a small pocket
  const pockets = ri(2, 4);
  for (let t = 0; t < 80 && nodes.filter((n) => n.kind === 'pocket').length < pockets; t++) {
    const from = ri(entrances, nodes.length - 1), a = R() * 6.283, L = 14 + R() * 16, f = nodes[from];
    const x = f.x + Math.cos(a) * (f.r + L), z = f.z + Math.sin(a) * (f.r + L), r = 2.5 + R() * 1.5;
    if (x < M + r + 2 || x > W - M - r - 2 || z < M + r + 2 || z > D - M - r - 2) continue;
    if (nodes.some((n) => Math.hypot(n.x - x, n.z - z) < n.r + r + 6)) continue;
    nodes.push({ x, z, y: 0, r, h: 3.2, lobes: lobes(), kind: 'pocket' });
    links.push([from, nodes.length - 1]);
  }
  // floor heights: a gentle walk over the whole system, each node within reach of its neighbours
  for (const n of nodes) n.y = (R() - 0.5) * 4;
  for (let pass = 0; pass < 4; pass++) for (const [a, b] of links) {
    const d = Math.max(4, dist(a, b) - nodes[a].r - nodes[b].r), max = d * 0.22;
    if (nodes[b].y - nodes[a].y > max) nodes[b].y = nodes[a].y + max; else if (nodes[a].y - nodes[b].y > max) nodes[a].y = nodes[b].y + max;
  }
  // tunnels: from rim to rim, winding (midpoint displacement), radius varying along the way
  const caveLinks: CaveLink[] = links.map(([a, b]) => {
    const A = nodes[a], B = nodes[b], dx = B.x - A.x, dz = B.z - A.z, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
    let pts: [number, number][] = [[A.x + ux * A.r * 0.6, A.z + uz * A.r * 0.6], [B.x - ux * B.r * 0.6, B.z - uz * B.r * 0.6]];
    let amp = L * 0.18;
    for (let lvl = 0; lvl < 4; lvl++) {
      const out: [number, number][] = [pts[0]];
      for (let i = 0; i + 1 < pts.length; i++) {
        const [px, pz] = pts[i], [qx, qz] = pts[i + 1], sx = qx - px, sz = qz - pz, sl = Math.hypot(sx, sz) || 1, off = (R() - 0.5) * 2 * amp;
        const mx = Math.max(M, Math.min(W - M, (px + qx) / 2 - sz / sl * off)), mz = Math.max(M, Math.min(D - M, (pz + qz) / 2 + sx / sl * off));
        out.push([mx, mz], pts[i + 1]);
      }
      pts = out; amp *= 0.5;
    }
    const r = pts.map((_, i) => 1.9 + 0.8 * Math.sin(i * 0.9 + R() * 6) * 0.5 + R() * 0.5);
    const y = pts.map((_, i) => A.y + (B.y - A.y) * (i / (pts.length - 1)));
    const m = 4 * Math.max(...r); // reach of the soft blend (q < 1.6) plus a margin
    const bb: [number, number, number, number] = [Math.min(...pts.map((p) => p[0])) - m, Math.min(...pts.map((p) => p[1])) - m, Math.max(...pts.map((p) => p[0])) + m, Math.max(...pts.map((p) => p[1])) + m];
    return { a, b, pts, r, y, h: 3.4 + R() * 1.2, bb };
  });

  // ---------- the fields ----------
  const nx = W + 1, nz = D + 1, floor = new Float32Array(nx * nz), ceil = new Float32Array(nx * nz);
  const s1 = seed ^ 0x51f1, s2 = seed ^ 0x51f2;
  for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) {
    const x = i, z = k;
    // q = 0 on an element's middle line, 1 at its rim; the most open element gives the shape, and the floor height and
    // vault are a soft blend of every element near (so where tunnels and chambers meet at different heights the floor
    // ramps instead of stepping)
    let q = 2, wsum = 0, bsum = 0, hsum = 0;
    const add = (qq: number, b: number, h: number) => { if (qq < q) q = qq; const w = qq < 1.6 ? Math.pow(1.6 - qq, 4) : 0; wsum += w; bsum += w * b; hsum += w * h; };
    for (const n of nodes) {
      const a = Math.atan2(z - n.z, x - n.x), l = n.lobes, t = ((a / 6.283) * l.length + l.length) % l.length, i0 = Math.floor(t), f = smooth(t - i0);
      const rr = n.r * (l[i0] + (l[(i0 + 1) % l.length] - l[i0]) * f);
      add(Math.hypot(x - n.x, z - n.z) / rr, n.y, n.h);
    }
    for (const c of caveLinks) {
      if (x < c.bb[0] || x > c.bb[2] || z < c.bb[1] || z > c.bb[3]) continue; // too far to matter
      let bq = 9, bb = 0;
      for (let j = 0; j + 1 < c.pts.length; j++) {
        const [ax, az] = c.pts[j], [bx, bz] = c.pts[j + 1], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
        const u = L2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)) : 0;
        const r = c.r[j] + (c.r[j + 1] - c.r[j]) * u, qq = Math.hypot(x - ax - dx * u, z - az - dz * u) / r;
        if (qq < bq) { bq = qq; bb = c.y[j] + (c.y[j + 1] - c.y[j]) * u; }
      }
      add(bq, bb, c.h);
    }
    const base = wsum ? bsum / wsum : 0, hc = wsum ? hsum / wsum : 3;
    const bump = (fbm(s1, x / 4, z / 4, 2) - 0.5) * 0.5, drip = (fbm(s2, x / 3, z / 3, 3) - 0.5) * 1.6;
    const fq = Math.min(1.5, q);
    // a flat floor in the middle curling up at the sides; the vault coming down to meet it
    floor[i + nx * k] = base + bump + 1.4 * Math.pow(Math.min(1, fq), 4) + Math.max(0, fq - 1) * 3;
    ceil[i + nx * k] = base + (q < 1 ? hc * Math.sqrt(1 - q * q) + drip * (1 - q) : -1) + 0.2;
  }
  // the entrances: where you arrive, facing in, and the way out behind you
  const exits = nodes.filter((n) => n.kind === 'entrance').map((n) => {
    const out = n.x < W / 2 ? -1 : 1;
    return { x: n.x - out * 1.5, z: n.z, y: sample(floor, nx, nz, n.x - out * 1.5, n.z), yaw: out < 0 ? -Math.PI / 2 : Math.PI / 2, ox: n.x + out * 2.2, oz: n.z };
  });
  // the way out: carve the tunnel on to the edge so the daylight end is open
  for (const e of exits) for (let d = 0; d < 8; d++) for (let w = -2; w <= 2; w++) {
    const i = Math.round(e.ox + Math.sign(e.ox - e.x) * d), k = Math.round(e.oz + w);
    if (i < 0 || k < 0 || i >= nx || k >= nz) continue;
    const o = i + nx * k, f = e.y + (Math.abs(w) === 2 ? 0.8 : 0);
    floor[o] = Math.min(floor[o], f); ceil[o] = Math.max(ceil[o], e.y + (Math.abs(w) === 2 ? 2.4 : 3.4));
  }
  // things in the cave: chests in the pockets (and one in a big chamber), crystals by chamber walls, spikes
  const chests: { x: number; z: number }[] = [], crystals: { x: number; z: number }[] = [], spikes: CaveMap['spikes'] = [];
  const P = rng(seed ^ 0x7a3c);
  for (const n of nodes) {
    if (n.kind === 'pocket' && P() < 0.7) chests.push({ x: n.x, z: n.z });
    if (n.kind !== 'chamber') continue;
    if (P() < 0.45) { const a = P() * 6.283; crystals.push({ x: n.x + Math.cos(a) * n.r * 0.6, z: n.z + Math.sin(a) * n.r * 0.6 }); }
    const k = 3 + Math.floor(P() * 6);
    for (let j = 0; j < k; j++) {
      const a = P() * 6.283, d = n.r * (0.35 + P() * 0.45), x = n.x + Math.cos(a) * d, z = n.z + Math.sin(a) * d;
      spikes.push({ x, z, r: 0.25 + P() * 0.45, len: 0.8 + P() * 2.2, up: P() < 0.45 });
    }
  }
  const big = nodes.filter((n) => n.kind === 'chamber').sort((a, b) => b.r - a.r)[0];
  if (big) chests.push({ x: big.x + big.r * 0.4, z: big.z });
  return { seed, ox: 0, oz: 0, nx, nz, floor, ceil, nodes, links: caveLinks, exits, chests, crystals, spikes };
}
/** Bilinear sample of a field at (x, z) (clamped to the grid). */
export function sample(a: Float32Array, nx: number, nz: number, x: number, z: number): number {
  const fx = Math.max(0, Math.min(nx - 1.001, x)), fz = Math.max(0, Math.min(nz - 1.001, z)), i = Math.floor(fx), k = Math.floor(fz), u = fx - i, v = fz - k;
  const a00 = a[i + nx * k], a10 = a[i + 1 + nx * k], a01 = a[i + nx * (k + 1)], a11 = a[i + 1 + nx * (k + 1)];
  return a00 + (a10 - a00) * u + (a01 - a00) * v + (a00 - a10 - a01 + a11) * u * v;
}
/** Headroom at (x, z): ceiling minus floor (≤ 0 in the rock). */
export const headroom = (m: CaveMap, x: number, z: number) => sample(m.ceil, m.nx, m.nz, x - m.ox, z - m.oz) - sample(m.floor, m.nx, m.nz, x - m.ox, z - m.oz);
export const floorAtCave = (m: CaveMap, x: number, z: number) => sample(m.floor, m.nx, m.nz, x - m.ox, z - m.oz);
export const ceilAtCave = (m: CaveMap, x: number, z: number) => sample(m.ceil, m.nx, m.nz, x - m.ox, z - m.oz);
