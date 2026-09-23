// Surface extraction from voxel grids: dark fill triangles plus 1 m grid lines along face edges.
// Pure data (no three.js) so it can run in a worker or on a server.
import type { VoxelGrid } from './voxel';

/** Edge: start corner + axis (0=x, 1=y, 2=z); always 1 m long. */
export type Edge = [number, number, number, number];

export interface VoxelMesh {
  tri: Float32Array;
  lines: Float32Array;
  edgeSet: Set<string>;
  edgeArr: Edge[];
}

const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
export const edgeKey = (x: number, y: number, z: number, a: number): string => x + ',' + y + ',' + z + ',' + a;

/**
 * Line style. 'grid' (dungeons): a line on every 1 m face edge.
 * Outline: lines only where the surface folds or ends, plus panel seams — floors every `floor` metres,
 * vertical seams on walls every `wall` metres. Far fewer lines, and the shapes read more clearly.
 */
export interface OutlineStyle { floor: number; wall: number }

/** Faces are emitted wherever an empty cell touches a non-empty one. Cells at y >= skyY get no faces (open sky). */
export function meshVoxels(g: VoxelGrid, skyY = Infinity, outline?: OutlineStyle): VoxelMesh {
  const tri: number[] = [];
  const edgeSet = new Set<string>(), edgeArr: Edge[] = [];
  const addEdge = (p: number[], a: number) => {
    const k = edgeKey(p[0], p[1], p[2], a);
    if (!edgeSet.has(k)) { edgeSet.add(k); edgeArr.push([p[0], p[1], p[2], a]); }
  };
  // Surface structures also need faces towards the open air around and above them
  // (but not underground, where the terrain hides their sides).
  const surf = g.groundY !== null, m = surf ? 1 : 0, gy = g.groundY ?? 0;
  for (let k = -m; k < g.nz + m; k++) for (let j = 0; j < g.ny + m; j++) for (let i = -m; i < g.nx + m; i++) {
    const c = [i + g.ox, j + g.oy, k + g.oz];
    if (surf && c[1] < gy && (i < 0 || k < 0 || i >= g.nx || k >= g.nz)) continue;
    if (!g.empty(c[0], c[1], c[2])) continue;
    if (c[1] >= skyY) continue;
    for (const d of DIRS) {
      if (g.empty(c[0] + d[0], c[1] + d[1], c[2] + d[2])) continue;
      const a = d[0] ? 0 : d[1] ? 1 : 2, b = (a + 1) % 3, e = (a + 2) % 3;
      const base = c.slice(); if (d[a] > 0) base[a] += 1;
      const P = (u: number, v: number) => { const p = base.slice(); p[b] += u; p[e] += v; return p; };
      const p00 = P(0, 0), p10 = P(1, 0), p11 = P(1, 1), p01 = P(0, 1);
      tri.push(...p00, ...p10, ...p11, ...p00, ...p11, ...p01);
      if (!outline) { addEdge(p00, b); addEdge(p01, b); addEdge(p00, e); addEdge(p10, e); continue; }
      // Does the same surface continue past this edge? (next empty cell along the plane, facing the same solid)
      const cont = (ax: number, sgn: number) => {
        const n = c.slice(); n[ax] += sgn;
        return g.empty(n[0], n[1], n[2]) && !g.empty(n[0] + d[0], n[1] + d[1], n[2] + d[2]);
      };
      const floor = d[1] < 0, wall = a !== 1;
      // an internal edge along axis `along`, lying at coordinate `at` of the other in-plane axis
      const seam = (along: number, at: number) => floor ? at % outline.floor === 0 : wall && along === 1 && at % outline.wall === 0;
      if (!cont(e, -1) || seam(b, p00[e])) addEdge(p00, b);
      if (!cont(e, 1) || seam(b, p01[e])) addEdge(p01, b);
      if (!cont(b, -1) || seam(e, p00[b])) addEdge(p00, e);
      if (!cont(b, 1) || seam(e, p10[b])) addEdge(p10, e);
    }
  }
  const lines = new Float32Array(edgeArr.length * 6);
  edgeArr.forEach((E, n) => {
    lines[n * 6] = E[0]; lines[n * 6 + 1] = E[1]; lines[n * 6 + 2] = E[2];
    lines[n * 6 + 3] = E[0] + (E[3] === 0 ? 1 : 0); lines[n * 6 + 4] = E[1] + (E[3] === 1 ? 1 : 0); lines[n * 6 + 5] = E[2] + (E[3] === 2 ? 1 : 0);
  });
  return { tri: new Float32Array(tri), lines, edgeSet, edgeArr };
}
