// (0.287, the owner's request) The jungle stands apart: its trees grow huge, like the giants of a village's great
// grove, and thorny lianas hang between them low enough to catch whoever runs into them. Pure and deterministic from
// the world seed and the generated trees, so every player sees the same giants and the same thorns.
// A jungle tree becomes a giant when its own hash beats every other jungle tree within `JUNGLE.gap` m (also across
// chunk borders); the small trees within `clear` m of a giant give way to it. Lianas hang between two giants
// `swag` m apart (sagging to `low` m over the ground at their lowest) or drape from a giant's limbs down to the ground.
import { hash, rng } from '../core/rng';
import { CHUNK, wrapC } from './regions';
import { biomeOfCell } from './biomes';
import { chunkTrees, TREE_SPAN, type Tree } from './trees';
import type { Terrain } from './terrain';

export const JUNGLE = {
  /** a giant beats every jungle tree within this many m */
  gap: 13,
  /** its trunk's radius and height (the grove's giants are 1.6–2.4 and 26–37) */
  r: [1.3, 2.1] as [number, number], h: [24, 34] as [number, number],
  /** small trees within this many m of a giant's trunk give way */
  clear: 4.5,
};
/**
 * The thorny lianas: a pair of giants `swag` m apart is joined at `chance`; a giant drapes one down to the ground at
 * `drape`; the lowest part hangs `low` m over the ground. Touching one cuts: `hurt` HP and `perMs` more for every m/s
 * you come in at (slower than `still` m/s it only scratches the clothes: nothing), at most once every `cool` s,
 * thrown back `push` m/s; a strand reaches you within `reach` m of your body's middle line.
 */
export const THORN = { swag: [8, 26] as [number, number], chance: 0.55, drape: 0.6, low: [0.5, 1.1] as [number, number], hurt: 3, perMs: 1.5, cool: 0.8, push: 3.5, still: 0.7, reach: 0.4, pts: 12 };

export interface Giant { x: number; y: number; z: number; r: number; h: number; seed: number; i: number; cx: number; cz: number }
/** A liana: its points [x, y, z] (y over the sea level, not the ground). */
export type Thorn = [number, number, number][];

const isJungleTree = (world: number, t: Tree) => TREE_SPAN[t.kind] === 0 && biomeOfCell(world, t.x, t.z) === 'jungle';
const touchesJungle = (world: number, cx: number, cz: number) => {
  for (const [u, v] of [[0, 0], [1, 0], [0, 1], [1, 1], [0.5, 0.5]]) if (biomeOfCell(world, (cx + u) * CHUNK, (cz + v) * CHUNK) === 'jungle') return true;
  return false;
};

const candCache = new Map<string, { t: Tree; i: number; s: number }[]>();
/** The jungle trees of a chunk with their scores (cached; canonical chunk). */
function candidates(T: Terrain, cx: number, cz: number) {
  const k = T.world + ':' + cx + ':' + cz;
  let c = candCache.get(k);
  if (c) return c;
  c = [];
  if (touchesJungle(T.world, cx, cz)) chunkTrees(T, cx, cz).forEach((t, i) => { if (isJungleTree(T.world, t)) c!.push({ t, i, s: hash(t.seed, 0x6a17) >>> 0 }); });
  if (candCache.size > 600) candCache.delete(candCache.keys().next().value!);
  candCache.set(k, c);
  return c;
}
const giantCache = new Map<string, Giant[]>();
/** The giants standing in chunk (cx, cz). */
export function chunkGiants(T: Terrain, cx: number, cz: number): Giant[] {
  const k = T.world + ':' + cx + ':' + cz;
  let g = giantCache.get(k);
  if (g) return g;
  g = [];
  const own = candidates(T, cx, cz);
  if (own.length) {
    const near: { t: Tree; s: number }[] = [];
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) near.push(...candidates(T, cx + i, cz + j));
    for (const c of own) {
      if (near.some((o) => o.t.seed !== c.t.seed && Math.hypot(o.t.x - c.t.x, o.t.z - c.t.z) < JUNGLE.gap && (o.s > c.s || (o.s === c.s && o.t.seed > c.t.seed)))) continue;
      const R = rng(hash(c.t.seed, 0x91a7));
      g.push({ x: c.t.x, y: c.t.y, z: c.t.z, r: JUNGLE.r[0] + R() * (JUNGLE.r[1] - JUNGLE.r[0]), h: JUNGLE.h[0] + R() * (JUNGLE.h[1] - JUNGLE.h[0]), seed: c.t.seed, i: c.i, cx, cz });
    }
  }
  if (giantCache.size > 600) giantCache.delete(giantCache.keys().next().value!);
  giantCache.set(k, g);
  return g;
}

/** What chunk (cx, cz) of the jungle holds: its giants by tree index, the small trees that give way, its lianas. */
/** `thorns[k].i` is the tree index of the giant it hangs from (felled, its lianas go with it). */
export interface JungleChunk { giants: Map<number, Giant>; skip: Set<number>; thorns: { i: number; p: Thorn }[] }
const EMPTY: JungleChunk = { giants: new Map(), skip: new Set(), thorns: [] };
export function jungleChunk(T: Terrain, cx: number, cz: number): JungleChunk {
  const c = wrapC(cx), dx = (cx - c) * CHUNK;
  if (!touchesJungle(T.world, c, cz)) return EMPTY;
  const own = chunkGiants(T, c, cz), near: Giant[] = [];
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) near.push(...chunkGiants(T, c + i, cz + j));
  const giants = new Map<number, Giant>(), skip = new Set<number>();
  for (const g of own) giants.set(g.i, { ...g, x: g.x + dx });
  for (const t of candidates(T, c, cz)) if (!giants.has(t.i) && near.some((g) => Math.hypot(g.x - t.t.x, g.z - t.t.z) < g.r + JUNGLE.clear)) skip.add(t.i);
  const thorns: { i: number; p: Thorn }[] = [];
  const ground = (x: number, z: number) => T.heightAt(x, z);
  for (const a of own) {
    const R = rng(hash(a.seed, 0x7409));
    // swags to the other giants nearby (each pair once: from the one with the smaller seed)
    for (const b of near) {
      if (b.seed <= a.seed) continue;
      const d = Math.hypot(b.x - a.x, b.z - a.z);
      if (d < THORN.swag[0] || d > THORN.swag[1] || R() > THORN.chance) continue;
      const pts = hang(a.x, a.z, a.y + 6 + R() * 5, b.x, b.z, b.y + 6 + R() * 5, THORN.low[0] + R() * (THORN.low[1] - THORN.low[0]), ground, a.r, b.r);
      if (pts && !pts.some(([x, , z]) => T.water(x, z))) thorns.push({ i: a.i, p: pts.map(([x, y, z]) => [x + dx, y, z]) });
    }
    // a drape from a limb down to the forest floor
    if (R() < THORN.drape) {
      const ang = R() * 6.283, out = 5 + R() * 5, ex = a.x + Math.cos(ang) * out, ez = a.z + Math.sin(ang) * out;
      if (!T.water(ex, ez)) {
        const pts = hang(a.x, a.z, a.y + 7 + R() * 4, ex, ez, ground(ex, ez) + 0.1, 0.1, ground, a.r, 0);
        if (pts) thorns.push({ i: a.i, p: pts.map(([x, y, z]) => [x + dx, y, z]) });
      }
    }
  }
  return { giants, skip, thorns };
}
/**
 * A liana hung from (ax, ay, az) to (bx, by, bz), starting at the trunks' bark (ra, rb), sagging so its lowest point
 * hangs `low` m over the ground, never under it.
 */
function hang(ax: number, az: number, ay: number, bx: number, bz: number, by: number, low: number, ground: (x: number, z: number) => number, ra: number, rb: number): Thorn | null {
  const d = Math.hypot(bx - ax, bz - az);
  if (d < 1) return null;
  const ux = (bx - ax) / d, uz = (bz - az) / d, x0 = ax + ux * ra, z0 = az + uz * ra, x1 = bx - ux * rb, z1 = bz - uz * rb;
  const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, sag = Math.max(0, (ay + by) / 2 - (ground(mx, mz) + low)), out: Thorn = [];
  for (let k = 0; k <= THORN.pts; k++) {
    const s = k / THORN.pts, x = x0 + (x1 - x0) * s, z = z0 + (z1 - z0) * s;
    out.push([x, Math.max(ground(x, z) + 0.12, ay + (by - ay) * s - sag * 4 * s * (1 - s)), z]);
  }
  return out;
}
/** What running into thorns at `speed` m/s costs (HP); 0 when you only brush them slowly. */
export const thornHurt = (speed: number) => (speed < THORN.still ? 0 : THORN.hurt + THORN.perMs * speed);
/**
 * Where a body (feet at y, 1.8 m tall, `r` wide) touches a liana, within `reach` more: the nearest point [x, z], or
 * null. `thorns` are the strands near it.
 */
export function thornContact(thorns: Thorn[], x: number, y: number, z: number, r: number, reach = THORN.reach): [number, number] | null {
  let best: [number, number] | null = null, bd = r + reach;
  for (const p of thorns) for (let k = 1; k < p.length; k++) {
    const [ax, ay, az] = p[k - 1], [bx, by, bz] = p[k], ex = bx - ax, ez = bz - az, L = ex * ex + ez * ez;
    const s = L > 0 ? Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / L)) : 0, px = ax + ex * s, pz = az + ez * s, py = ay + (by - ay) * s;
    if (py < y - 0.1 || py > y + 1.8) continue;
    const dd = Math.hypot(px - x, pz - z);
    if (dd < bd) { bd = dd; best = [px, pz]; }
  }
  return best;
}
