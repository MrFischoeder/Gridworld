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
    /**
     * null: a dungeon, everything outside the grid is solid rock.
     * A number: a surface structure standing on the ground at that height. Its footprint is the grid's x/z extent;
     * inside it, cells below the grid are rock and cells above are air; outside the footprint is open air.
     */
    public groundY: number | null = null,
  ) { this.cells = new Uint8Array(nx * ny * nz); }

  /** Dungeon grid: bounded by its room ops (plus a 1-cell rim); everything else is rock. */
  static fromOps(ops: Op[]): VoxelGrid {
    const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    for (const o of ops) {
      if (o.op !== 'room') continue;
      mn[0] = Math.min(mn[0], o.x); mn[1] = Math.min(mn[1], o.y); mn[2] = Math.min(mn[2], o.z);
      mx[0] = Math.max(mx[0], o.x + o.w); mx[1] = Math.max(mx[1], o.y + o.h); mx[2] = Math.max(mx[2], o.z + o.d);
    }
    const g = new VoxelGrid(mn[0] - 1, mn[1] - 1, mn[2] - 1, mx[0] - mn[0] + 2, mx[1] - mn[1] + 2, mx[2] - mn[2] + 2);
    g.apply(ops);
    return g;
  }

  /**
   * Surface structure on a footprint [x0, x1) x [z0, z1): the ground below groundY is solid (a floor with 1 m grid lines),
   * the ops then add walls and carve shafts.
   */
  static surface(ops: Op[], fp: { x0: number; z0: number; x1: number; z1: number }, groundY: number): VoxelGrid {
    let y0 = groundY - 1, y1 = groundY + 1;
    for (const o of ops) { y0 = Math.min(y0, o.y - 1); y1 = Math.max(y1, o.y + o.h); }
    const g = new VoxelGrid(fp.x0, y0, fp.z0, fp.x1 - fp.x0, y1 - y0, fp.z1 - fp.z0, groundY);
    const nxz = g.nx;
    for (let k = 0; k < g.nz; k++) for (let j = 0; j < g.ny; j++) g.cells.fill(j + y0 < groundY ? 0 : 1, nxz * (j + g.ny * k), nxz * (j + g.ny * k) + nxz);
    g.apply(ops);
    return g;
  }

  apply(ops: Op[]) {
    for (const o of ops) {
      const v = o.op === 'room' ? 1 : 0;
      for (let x = o.x; x < o.x + o.w; x++) for (let y = o.y; y < o.y + o.h; y++) for (let z = o.z; z < o.z + o.d; z++) this.setCell(x, y, z, v);
    }
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
    if (i < 0 || j < 0 || k < 0 || i >= this.nx || j >= this.ny || k >= this.nz) {
      if (this.groundY === null) return false;
      if (i < 0 || k < 0 || i >= this.nx || k >= this.nz) return true;
      return j >= this.ny;
    }
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
