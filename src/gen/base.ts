// A player's base on a claim: parts on a grid round the flag, storey by storey. Walls and doors stand on the cell
// edges, floor slabs (the roof below, the floor above) cover cells on top of the walls, stairs take two cells and
// climb one storey. Pure: the parts are player changes (saved with the claim); everything here works in claim-local
// metres (u = east of the flag, v = south of it, h = height above the levelled pad). world/building.ts draws them,
// runs the build mode and hands the collision, floors and rays below to the player and the enemies.
import { PIECES, BUILD, type PieceKind, type Shape } from '../data/building';
import { CLAIM } from './claims';

/** A code lock on a door: its 4-digit code, whether it is locked, and who has entered the code (player ids). */
export interface Lock { code: string; on: boolean; auth: string[] }
/**
 * A built part on storey `lv`. Edges: d = 0 runs along u on the line v = gz·cell (from gx·cell), d = 1 along v on
 * u = gx·cell. Slabs cover the cell (gx, gz) at the top of storey lv - 1. Stairs start in cell (gx, gz) and climb
 * towards d (0 +u, 1 +v, 2 -u, 3 -v) through the next cell.
 */
/** `off`: a turret switched off. */
export interface Part { k: PieceKind; gx: number; gz: number; d: number; lv?: number; open?: boolean; lock?: Lock; off?: boolean }
const C = BUILD.cell, S = BUILD.storey, H = BUILD.wallH, T = BUILD.thick / 2;
const STEP = [[1, 0], [0, 1], [-1, 0], [0, -1]];

export const shapeOf = (p: Pick<Part, 'k'>): Shape => PIECES[p.k].shape;
/** The storey a part is on (old saves: roofs sat on top of the ground floor). */
export const lvOf = (p: Part) => p.lv ?? (shapeOf(p) === 'roof' ? 1 : 0);
/** Height of the floor of storey lv above the pad. */
export const floorH = (lv: number) => lv * S;

/** The cells a part covers (slabs one, stairs two). */
export function cellsOf(p: Part): [number, number][] {
  if (shapeOf(p) === 'stairs') { const [a, b] = STEP[p.d & 3]; return [[p.gx, p.gz], [p.gx + a, p.gz + b]]; }
  return [[p.gx, p.gz]];
}
/** Where the part lies on the ground plan: its two ends (edges) or its corners (slabs, stairs), claim-local. */
export function partEnds(p: Part): [number, number][] {
  const u = p.gx * C, v = p.gz * C, s = shapeOf(p);
  if (s === 'wall' || s === 'door') return p.d === 0 ? [[u, v], [u + C, v]] : [[u, v], [u, v + C]];
  const cs = cellsOf(p), u0 = Math.min(...cs.map((c) => c[0])) * C, v0 = Math.min(...cs.map((c) => c[1])) * C;
  const u1 = (Math.max(...cs.map((c) => c[0])) + 1) * C, v1 = (Math.max(...cs.map((c) => c[1])) + 1) * C;
  return [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
}
/** The slots a part takes on its storey: edges for walls and doors, cells for slabs and stairs (separately). */
export function slotKeys(p: Part): string[] {
  const s = shapeOf(p), lv = lvOf(p);
  if (s === 'wall' || s === 'door') return [`e:${lv}:${p.gx}:${p.gz}:${p.d}`];
  return cellsOf(p).map(([x, z]) => `${s === 'roof' ? 'r' : 's'}:${lv}:${x}:${z}`); // stairs and turrets share the cells
}

/** The slot for a part of this shape nearest to the claim-local point (u, v): the closest cell edge, or the cell. */
export function snap(shape: Shape, u: number, v: number): Pick<Part, 'gx' | 'gz' | 'd'> {
  const fu = u / C, fv = v / C, gx = Math.floor(fu), gz = Math.floor(fv), a = fu - gx, b = fv - gz;
  if (shape === 'roof' || shape === 'stairs' || shape === 'turret') return { gx, gz, d: 0 };
  const best = Math.min(a, 1 - a, b, 1 - b);
  if (best === b) return { gx, gz, d: 0 };
  if (best === 1 - b) return { gx, gz: gz + 1, d: 0 };
  if (best === a) return { gx, gz, d: 1 };
  return { gx: gx + 1, gz, d: 1 };
}
/** Stairs climb the way you face: yaw (radians, 0 = north = -v) to a direction 0..3. */
export const stairDir = (yaw: number) => { const fu = -Math.sin(yaw), fv = -Math.cos(yaw); return Math.abs(fu) > Math.abs(fv) ? (fu > 0 ? 0 : 2) : (fv > 0 ? 1 : 3); };

/** Why the part cannot go there, or null. Upper storeys need something to stand on. */
export function partProblem(parts: Part[], p: Part): string | null {
  const s = shapeOf(p), lv = lvOf(p), ends = partEnds(p);
  if (ends.some(([u, v]) => Math.hypot(u, v) > CLAIM.flat - 0.3)) return 'Build on the levelled ground round your flag.';
  if (s === 'roof' || s === 'turret' ? lv < (s === 'roof' ? 1 : 0) || lv > BUILD.levels : lv < 0 || lv > BUILD.levels - 1) return s === 'roof' ? 'Floors and roofs go on top of the walls: look up.' : 'That is as high as you can build.';
  if ((s === 'wall' || s === 'door') && ends.some(([u, v]) => u === 0 && v === 0)) return 'The flagpole is in the way.';
  if (s !== 'roof' && s !== 'wall' && s !== 'door' && cellsOf(p).some(([x, z]) => (x === 0 || x === -1) && (z === 0 || z === -1))) return 'The flagpole is in the way.';
  const mine = new Set(slotKeys(p));
  if (parts.some((q) => slotKeys(q).some((k) => mine.has(k)))) return 'Something is already built there.';
  const has = (f: (q: Part) => boolean) => parts.some(f);
  const edge = (q: Part, gx: number, gz: number, d: number, l: number) => (shapeOf(q) === 'wall' || shapeOf(q) === 'door') && q.gx === gx && q.gz === gz && q.d === d && lvOf(q) === l;
  const slabAt = (x: number, z: number, l: number) => has((q) => shapeOf(q) === 'roof' && lvOf(q) === l && q.gx === x && q.gz === z);
  const stairsUnder = (x: number, z: number, l: number) => has((q) => shapeOf(q) === 'stairs' && lvOf(q) === l && cellsOf(q).some(([a, b]) => a === x && b === z));
  if (s === 'roof') {
    if (stairsUnder(p.gx, p.gz, lv - 1)) return 'Leave the stairwell open.';
    const walls = [[p.gx, p.gz, 0], [p.gx, p.gz + 1, 0], [p.gx, p.gz, 1], [p.gx + 1, p.gz, 1]].some(([x, z, d]) => has((q) => edge(q, x, z, d, lv - 1)));
    const next = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => slabAt(p.gx + a, p.gz + b, lv));
    if (!walls && !next) return 'A floor needs a wall under one of its sides, or a floor next to it.';
  } else if (s === 'stairs') {
    if (cellsOf(p).some(([x, z]) => slabAt(x, z, lv + 1))) return 'There is a floor over it: the stairs need headroom.';
    if (lv > 0 && cellsOf(p).some(([x, z]) => !slabAt(x, z, lv))) return 'Stairs up here need a floor under them.';
  } else if (s === 'turret') {
    if (lv > 0 && !slabAt(p.gx, p.gz, lv)) return 'A turret up here needs a floor or a roof under it.';
  } else if (lv > 0) {
    const [a, b] = p.d === 0 ? [[p.gx, p.gz - 1], [p.gx, p.gz]] : [[p.gx - 1, p.gz], [p.gx, p.gz]];
    if (!has((q) => edge(q, p.gx, p.gz, p.d, lv - 1)) && !slabAt(a[0], a[1], lv) && !slabAt(b[0], b[1], lv)) return 'Up here a wall needs a floor beside it or a wall under it.';
  }
  return null;
}

// ---------- solids, floors and rays ----------
/** An axis-aligned box, claim-local: [u0, h0, v0, u1, h1, v1]. `slab` boxes only stop you from below. */
export interface Box { b: [number, number, number, number, number, number]; slab: boolean }
/** The solid boxes of the walls, doors (jambs, lintel, the leaf while shut) and floor slabs. */
export function solids(parts: Part[]): Box[] {
  const out: Box[] = [], j = (C - BUILD.doorW) / 2;
  for (const p of parts) {
    const s = shapeOf(p), base = floorH(lvOf(p));
    if (s === 'stairs') continue;
    if (s === 'turret') { const u = p.gx * C + C / 2, v = p.gz * C + C / 2; out.push({ b: [u - 0.4, base, v - 0.4, u + 0.4, base + 1, v + 0.4], slab: false }); continue; }
    if (s === 'roof') { const u = p.gx * C, v = p.gz * C; out.push({ b: [u, base - BUILD.slab, v, u + C, base, v + C], slab: true }); continue; }
    const [[u0, v0]] = partEnds(p), du = p.d === 0 ? 1 : 0, dv = 1 - du;
    const piece = (a0: number, a1: number, h0: number, h1: number) =>
      out.push({ b: [u0 + du * a0 - dv * T, base + h0, v0 + dv * a0 - du * T, u0 + du * a1 + dv * T, base + h1, v0 + dv * a1 + du * T], slab: false });
    if (s === 'wall' || !p.open) piece(0, C, 0, H);
    else { piece(0, j, 0, H); piece(C - j, C, 0, H); piece(j, C - j, BUILD.doorH, H); }
  }
  return out;
}
/**
 * Does a standing figure (radius r, feet at h, `tall` high) at (u, v) run into a wall or a shut door, or bump its
 * head on a slab? Standing on a slab is not a hit.
 */
export function baseHitLocal(parts: Part[], u: number, h: number, v: number, r: number, tall = 1.7, boxes = solids(parts)): boolean {
  for (const { b, slab } of boxes) {
    const cu = Math.max(b[0], Math.min(b[3], u)), cv = Math.max(b[2], Math.min(b[5], v));
    if (Math.hypot(u - cu, v - cv) >= r) continue;
    if (slab ? h < b[1] - 0.01 && h + tall > b[1] : h < b[4] - 0.01 && h + tall > b[1] + 0.01) return true;
  }
  return false;
}
/** The highest floor under (u, v) no higher than hMax: a slab top (with a little overhang for your feet) or stairs. */
export function floorLocal(parts: Part[], u: number, v: number, hMax: number): number {
  let best = -Infinity;
  for (const p of parts) {
    const s = shapeOf(p), base = floorH(lvOf(p));
    if (s === 'roof') {
      const u0 = p.gx * C, v0 = p.gz * C;
      if (u > u0 - 0.25 && u < u0 + C + 0.25 && v > v0 - 0.25 && v < v0 + C + 0.25 && base <= hMax) best = Math.max(best, base);
    } else if (s === 'stairs') {
      const e = partEnds(p);
      if (u < e[0][0] || u > e[2][0] || v < e[0][1] || v > e[2][1]) continue;
      const [a, b] = STEP[p.d & 3], su = a > 0 ? e[0][0] : e[2][0], sv = b > 0 ? e[0][1] : e[2][1];
      const t = Math.max(0, Math.min(1, (a ? (u - su) * a : (v - sv) * b) / (2 * C)));
      const y = base + S * t;
      if (y <= hMax) best = Math.max(best, y);
    }
  }
  return best;
}
/** Distance along a ray (o, unit d; claim-local u/h/v) to the first wall, shut door or slab, or maxT. */
export function rayLocal(o: [number, number, number], d: [number, number, number], maxT: number, boxes: Box[]): number {
  let best = maxT;
  for (const { b } of boxes) {
    let t0 = 0, t1 = best;
    for (let i = 0; i < 3; i++) {
      const lo = b[i], hi = b[i + 3];
      if (Math.abs(d[i]) < 1e-9) { if (o[i] < lo || o[i] > hi) { t0 = Infinity; break; } continue; }
      let a = (lo - o[i]) / d[i], c = (hi - o[i]) / d[i];
      if (a > c) [a, c] = [c, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, c);
      if (t0 > t1) break;
    }
    if (t0 <= t1 && t0 < best) best = t0;
  }
  return best;
}
/** Is the point inside a wall, a shut door or a slab? */
export const solidAt = (u: number, h: number, v: number, boxes: Box[]) => boxes.some(({ b }) => u >= b[0] && u <= b[3] && h >= b[1] && h <= b[4] && v >= b[2] && v <= b[5]);
/** Half of what a part took, given back when it is taken down. */
export const refund = (k: PieceKind) => PIECES[k].refund ?? PIECES[k].needs.map(([m, n]) => [m, Math.floor(n / 2)] as [typeof m, number]).filter(([, n]) => n > 0);
/** A 4-digit code? */
export const validCode = (s: string) => /^\d{4}$/.test(s);
