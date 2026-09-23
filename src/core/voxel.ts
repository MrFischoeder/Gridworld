// Voxel CSG maps: an ordered list of box operations on 1x1x1 m cells.
//  room  -> carves empty space,  solid -> fills. Later operations override earlier ones.
// This op list is also the format the future map editor will save.

export type OpKind = 'room' | 'solid';
export interface Op { op: OpKind; x: number; y: number; z: number; w: number; h: number; d: number }

export interface Vec3Like { x: number; y: number; z: number }

/** Anything that answers "is this cell free to move through" (a grid, or several grids plus terrain). */
export interface Space {
  empty(x: number, y: number, z: number): boolean;
  setCell(x: number, y: number, z: number, v: 0 | 1): void;
}

export class VoxelGrid implements Space {
  cells: Uint8Array;
  constructor(
    public ox: number, public oy: number, public oz: number,
    public nx: number, public ny: number, public nz: number,
    /** Value reported for cells outside the grid: dungeons are solid rock, surface structures stand in open air. */
    public outsideEmpty = false,
  ) { this.cells = new Uint8Array(nx * ny * nz); }

  /**
   * Build a grid from ops. Dungeon grids are bounded by their room ops (everything else is rock);
   * surface structures pass outsideEmpty and are bounded by all ops.
   */
  static fromOps(ops: Op[], outsideEmpty = false): VoxelGrid {
    const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    for (const o of ops) {
      if (!outsideEmpty && o.op !== 'room') continue;
      mn[0] = Math.min(mn[0], o.x); mn[1] = Math.min(mn[1], o.y); mn[2] = Math.min(mn[2], o.z);
      mx[0] = Math.max(mx[0], o.x + o.w); mx[1] = Math.max(mx[1], o.y + o.h); mx[2] = Math.max(mx[2], o.z + o.d);
    }
    const g = new VoxelGrid(mn[0] - 1, mn[1] - 1, mn[2] - 1, mx[0] - mn[0] + 2, mx[1] - mn[1] + 2, mx[2] - mn[2] + 2, outsideEmpty);
    if (outsideEmpty) g.cells.fill(1);
    for (const o of ops) {
      const v = o.op === 'room' ? 1 : 0;
      for (let x = o.x; x < o.x + o.w; x++) for (let y = o.y; y < o.y + o.h; y++) for (let z = o.z; z < o.z + o.d; z++) g.setCell(x, y, z, v);
    }
    return g;
  }

  inside(x: number, y: number, z: number): boolean {
    const i = x - this.ox, j = y - this.oy, k = z - this.oz;
    return i >= 0 && j >= 0 && k >= 0 && i < this.nx && j < this.ny && k < this.nz;
  }
  /** Horizontal footprint test (any height). */
  covers(x: number, z: number): boolean {
    const i = x - this.ox, k = z - this.oz;
    return i >= 0 && k >= 0 && i < this.nx && k < this.nz;
  }
  setCell(x: number, y: number, z: number, v: 0 | 1): void {
    const i = x - this.ox, j = y - this.oy, k = z - this.oz;
    if (i < 0 || j < 0 || k < 0 || i >= this.nx || j >= this.ny || k >= this.nz) return;
    this.cells[i + this.nx * (j + this.ny * k)] = v;
  }
  empty(x: number, y: number, z: number): boolean {
    const i = x - this.ox, j = y - this.oy, k = z - this.oz;
    if (i < 0 || j < 0 || k < 0 || i >= this.nx || j >= this.ny || k >= this.nz) return this.outsideEmpty;
    return this.cells[i + this.nx * (j + this.ny * k)] === 1;
  }
}

export const emptyAt = (s: Space, p: Vec3Like): boolean => s.empty(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z));

/** Amanatides-Woo walk through cells; returns distance to the first non-empty cell, or maxT. */
export function rayVoxel(s: Space, o: Vec3Like, d: Vec3Like, maxT: number): number {
  let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
  const sx = Math.sign(d.x), sy = Math.sign(d.y), sz = Math.sign(d.z);
  const tdx = sx ? Math.abs(1 / d.x) : Infinity, tdy = sy ? Math.abs(1 / d.y) : Infinity, tdz = sz ? Math.abs(1 / d.z) : Infinity;
  let tmx = sx > 0 ? (x + 1 - o.x) / d.x : sx < 0 ? (o.x - x) / -d.x : Infinity;
  let tmy = sy > 0 ? (y + 1 - o.y) / d.y : sy < 0 ? (o.y - y) / -d.y : Infinity;
  let tmz = sz > 0 ? (z + 1 - o.z) / d.z : sz < 0 ? (o.z - z) / -d.z : Infinity;
  let t = 0;
  while (t < maxT) {
    if (tmx < tmy && tmx < tmz) { x += sx; t = tmx; tmx += tdx; }
    else if (tmy < tmz) { y += sy; t = tmy; tmy += tdy; }
    else { z += sz; t = tmz; tmz += tdz; }
    if (!s.empty(x, y, z)) return t;
  }
  return maxT;
}

/** Nearest standing cell (floor below, two free cells) around column x,z, searching rings up to radius 3. */
export function floorAt(s: Space, x: number, z: number, y0: number, y1: number): [number, number, number] | null {
  for (let r = 0; r < 4; r++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
    for (let y = y0; y < y1; y++) if (s.empty(x + dx, y, z + dz) && s.empty(x + dx, y + 1, z + dz) && !s.empty(x + dx, y - 1, z + dz)) return [x + dx, y, z + dz];
  }
  return null;
}

export function translateOps(ops: Op[], dx: number, dy: number, dz: number): Op[] {
  return ops.map((o) => ({ ...o, x: o.x + dx, y: o.y + dy, z: o.z + dz }));
}

/**
 * Like floorAt, but prefers standing cells on the given floor level (so objects do not end up
 * on top of crates the player cannot climb), falling back to any floor.
 */
export function floorNear(s: Space, x: number, z: number, level: number, y0: number, y1: number): [number, number, number] | null {
  return floorAt(s, x, z, level, level + 1) ?? floorAt(s, x, z, y0, y1);
}
