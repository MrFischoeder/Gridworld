// Walkability analysis on voxel spaces (used by tests and debug tools).
import type { Space } from '../core/voxel';

export const standable = (s: Space, x: number, y: number, z: number): boolean =>
  s.empty(x, y, z) && s.empty(x, y + 1, z) && !s.empty(x, y - 1, z);

const key = (x: number, y: number, z: number) => x + ',' + y + ',' + z;

/**
 * Flood fill over standing cells: horizontal steps, climbing or dropping one cell at a time.
 * Returns the set of reachable standing cells as "x,y,z" keys.
 */
export function reachableCells(s: Space, start: [number, number, number], limit = 2_000_000): Set<string> {
  const seen = new Set<string>();
  if (!standable(s, ...start)) return seen;
  const q: [number, number, number][] = [start];
  seen.add(key(...start));
  while (q.length && seen.size < limit) {
    const [x, y, z] = q.pop()!;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz;
      const tryAdd = (ny: number) => { const k = key(nx, ny, nz); if (!seen.has(k)) { seen.add(k); q.push([nx, ny, nz]); } };
      if (standable(s, nx, y, nz)) tryAdd(y);
      if (s.empty(x, y + 2, z) && standable(s, nx, y + 1, nz)) tryAdd(y + 1);
      if (s.empty(nx, y, nz) && s.empty(nx, y + 1, nz) && standable(s, nx, y - 1, nz)) tryAdd(y - 1);
    }
  }
  return seen;
}

/** True when any standing cell in the given column (any height in [y0, y1)) was reached. */
export function columnReached(seen: Set<string>, x: number, z: number, y0: number, y1: number): boolean {
  for (let y = y0; y < y1; y++) if (seen.has(key(x, y, z))) return true;
  return false;
}
