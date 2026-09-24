// A player's base on a claim: parts on a grid round the flag (walls and doors on the cell edges, roofs over the
// cells). Pure: the parts are player changes (saved with the claim), everything here works in claim-local metres
// (u = east of the flag, v = south of it). world/building.ts draws them and runs the build mode.
import { PIECES, BUILD, type PieceKind, type Shape } from '../data/building';
import { CLAIM } from './claims';

/** A built part. Edges: d = 0 runs along u on the line v = gz·cell (from gx·cell), d = 1 along v on u = gx·cell. */
export interface Part { k: PieceKind; gx: number; gz: number; d: 0 | 1; open?: boolean }
const C = BUILD.cell;

/** Where the part lies, as its two ends (edges) or its corners (roofs), claim-local. */
export function partEnds(p: Pick<Part, 'gx' | 'gz' | 'd'>, shape: Shape): [number, number][] {
  const u = p.gx * C, v = p.gz * C;
  if (shape === 'roof') return [[u, v], [u + C, v], [u + C, v + C], [u, v + C]];
  return p.d === 0 ? [[u, v], [u + C, v]] : [[u, v], [u, v + C]];
}
/** The slot a part takes: walls and doors share the edges, roofs have the cells. */
export const slotKey = (p: Pick<Part, 'gx' | 'gz' | 'd'>, shape: Shape) => (shape === 'roof' ? `r:${p.gx}:${p.gz}` : `e:${p.gx}:${p.gz}:${p.d}`);

/** The slot for a part of this shape nearest to the claim-local point (u, v): the closest cell edge, or the cell. */
export function snap(shape: Shape, u: number, v: number): Pick<Part, 'gx' | 'gz' | 'd'> {
  const fu = u / C, fv = v / C, gx = Math.floor(fu), gz = Math.floor(fv), a = fu - gx, b = fv - gz;
  if (shape === 'roof') return { gx, gz, d: 0 };
  const best = Math.min(a, 1 - a, b, 1 - b);
  if (best === b) return { gx, gz, d: 0 };
  if (best === 1 - b) return { gx, gz: gz + 1, d: 0 };
  if (best === a) return { gx, gz, d: 1 };
  return { gx: gx + 1, gz, d: 1 };
}

/** Why the part cannot go there, or null. */
export function partProblem(parts: Part[], p: Part): string | null {
  const shape = PIECES[p.k].shape, ends = partEnds(p, shape);
  if (ends.some(([u, v]) => Math.hypot(u, v) > CLAIM.flat - 0.3)) return 'Build on the levelled ground round your flag.';
  if (shape !== 'roof' && ends.some(([u, v]) => u === 0 && v === 0)) return 'The flagpole is in the way.';
  const key = slotKey(p, shape);
  if (parts.some((q) => slotKey(q, PIECES[q.k].shape) === key)) return 'Something is already built there.';
  return null;
}

/**
 * The solid stretches of the walls and doors, claim-local: [u0, v0, u1, v1] along one axis. A door is solid at its
 * jambs, and in the middle too while it is shut.
 */
export function solidSegs(parts: Part[]): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  const j = (C - BUILD.doorW) / 2;
  for (const p of parts) {
    const shape = PIECES[p.k].shape;
    if (shape === 'roof') continue;
    const [[u0, v0]] = partEnds(p, shape), du = p.d === 0 ? 1 : 0, dv = 1 - du;
    const piece = (s0: number, s1: number) => out.push([u0 + du * s0, v0 + dv * s0, u0 + du * s1, v0 + dv * s1]);
    if (shape === 'wall' || !p.open) piece(0, C);
    else { piece(0, j); piece(C - j, C); }
  }
  return out;
}
/** Does a circle of radius r at (u, v) touch a wall or a shut door? (Heights are the caller's business.) */
export function baseHitLocal(parts: Part[], u: number, v: number, r: number): boolean {
  const t = BUILD.thick / 2 + r;
  for (const [u0, v0, u1, v1] of solidSegs(parts)) {
    const cu = Math.max(Math.min(u0, u1), Math.min(Math.max(u0, u1), u)), cv = Math.max(Math.min(v0, v1), Math.min(Math.max(v0, v1), v));
    if (Math.hypot(u - cu, v - cv) < t) return true;
  }
  return false;
}
/** Half of what a part took, given back when it is taken down. */
export const refund = (k: PieceKind) => PIECES[k].needs.map(([m, n]) => [m, Math.floor(n / 2)] as const).filter(([, n]) => n > 0);
