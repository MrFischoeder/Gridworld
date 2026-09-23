// Door placement on a voxel space (pure logic, no rendering).
// Placed doors start closed: their 3x3 cells are filled so they block movement until opened.
import type { Space } from '../core/voxel';

export interface DoorSpec { axis: 'x' | 'z'; m: number; c: number; locked?: boolean; stair?: boolean; y0?: number }
export interface PlacedDoor {
  axis: 'x' | 'z'; m: number; c: number; y0: number;
  cx: number; cz: number;
  locked: boolean; stair: boolean;
  cells: [number, number, number][];
}

/** A slice across a straight 3-wide, 3-high tunnel with rock on both sides, above and below. */
export function isTunnelSlice(s: Space, axis: 'x' | 'z', m: number, c: number): boolean {
  const at = (o: number): [number, number] => (axis === 'x' ? [m, c + o] : [c + o, m]);
  for (let y = 0; y < 3; y++) for (let o = -1; o <= 1; o++) { const [x, z] = at(o); if (!s.empty(x, y, z)) return false; }
  for (let y = -1; y <= 3; y++) for (const o of [-2, 2]) { const [x, z] = at(o); if (s.empty(x, y, z)) return false; }
  for (let o = -1; o <= 1; o++) { const [x, z] = at(o); if (s.empty(x, 3, z) || s.empty(x, -1, z)) return false; }
  return true;
}

export function doorCells(axis: 'x' | 'z', m: number, c: number, y0 = 0): [number, number, number][] {
  const dc: [number, number, number][] = [];
  for (let y = 0; y < 3; y++) for (let o = -1; o <= 1; o++) dc.push(axis === 'x' ? [m, y0 + y, c + o] : [c + o, y0 + y, m]);
  return dc;
}

export function setDoorCells(s: Space, cells: [number, number, number][], blocked: boolean): void {
  for (const c of cells) s.setCell(c[0], c[1], c[2], blocked ? 0 : 1);
}

/** Try to place one door; on success its cells are filled in the space and it is appended to `placed`. */
export function tryPlaceDoor(s: Space, d: DoorSpec, placed: PlacedDoor[]): PlacedDoor | null {
  const y0 = d.y0 ?? 0;
  if (!d.stair && ![-1, 0, 1].every((o) => isTunnelSlice(s, d.axis, d.m + o, d.c))) return null;
  const cx = d.axis === 'x' ? d.m + 0.5 : d.c + 0.5, cz = d.axis === 'x' ? d.c + 0.5 : d.m + 0.5;
  if (!d.locked && !d.stair && placed.some((o) => Math.hypot(o.cx - cx, o.cz - cz) < 5)) return null;
  const door: PlacedDoor = { axis: d.axis, m: d.m, c: d.c, y0, cx, cz, locked: !!d.locked, stair: !!d.stair, cells: doorCells(d.axis, d.m, d.c, y0) };
  setDoorCells(s, door.cells, true);
  placed.push(door);
  return door;
}

/** Tunnel doors of a dungeon; locked gate doors may slide back a few cells to find a clean tunnel slice. */
export function placeTunnelDoors(s: Space, cands: DoorSpec[], placed: PlacedDoor[] = []): PlacedDoor[] {
  for (const d of cands) {
    for (const off of d.locked ? [0, -1, -2, 1, -3, -4] : [0]) if (tryPlaceDoor(s, { ...d, m: d.m + off }, placed)) break;
  }
  return placed;
}
