// Stairwells: a doorway in a room wall (t=0), a landing (t=1), then steps going up or down along DIRV[dir].
import { DIRV, type Dir } from '../core/rng';
import type { Op, OpKind } from '../core/voxel';

export const SL = 8;

/** Box spanning t0..t1 along dir from wall coordinate m, centred on lateral coordinate c (half width lw). */
export function sbox(dir: Dir, m: number, c: number, t0: number, t1: number, y: number, h: number, op: OpKind | 'x', lw = 1) {
  const o = DIRV[dir]; let x: number, z: number, w: number, d: number;
  if (o[0]) { const a = m + o[0] * t0, b = m + o[0] * t1; x = Math.min(a, b); w = Math.abs(b - a) + 1; z = c - lw; d = 2 * lw + 1; }
  else { const a = m + o[1] * t0, b = m + o[1] * t1; z = Math.min(a, b); d = Math.abs(b - a) + 1; x = c - lw; w = 2 * lw + 1; }
  return { op, x, y, z, w, h, d };
}

export function stairOpsFor(dir: Dir, m: number, c: number, up: boolean): Op[] {
  const out = [sbox(dir, m, c, -3, 0, 0, 3, 'room'), sbox(dir, m, c, 1, SL, up ? 0 : -7, 10, 'room')] as Op[];
  for (let k = 1; k <= SL; k++) {
    const h = up ? (k <= 1 ? 0 : Math.min(k - 1, 6)) : (k <= 1 ? 7 : Math.max(1, 8 - k));
    if (h > 0) out.push(sbox(dir, m, c, k, k, up ? 0 : -7, h, 'solid') as Op);
  }
  return out;
}

/** A stair doorway placed by a generator. key: N/E/S/W = neighbour sector, V = surface exit, D = way down into a dungeon. */
export interface PortalSpec { key: string; dir: Dir; m: number; c: number; up: boolean; axis: 'x' | 'z'; y0?: number }
