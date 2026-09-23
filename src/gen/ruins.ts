// Ruins: broken walls, columns and floor fragments around a small crypt with a stairwell down into a dungeon.
import { rng, hash, rangeInt, DIRV, type Dir } from '../core/rng';
import type { Op } from '../core/voxel';
import { sbox, stairOpsFor, SL, type PortalSpec } from './stairs';
import type { Poi, Rect } from './regions';

export interface RuinMap {
  id: number; name: string; y: number; rect: Rect;
  ops: Op[];
  portal: PortalSpec;
  /** Decorative floor fragments (brighter tiles), in world x/z. */
  tiles: { x: number; z: number }[];
}

export function generateRuin(world: number, poi: Poi, y: number): RuinMap {
  const R = rng(hash(world, poi.id, 0x2a1)), ri = rangeInt(R);
  const { x0, z0, x1, z1 } = poi.rect, cx = (x0 + x1) >> 1, cz = (z0 + z1) >> 1;
  const ops: Op[] = [];
  const blocked: Rect[] = [];
  const free = (x: number, z: number, w = 1, d = 1) => !blocked.some((b) => x < b.x1 && x + w > b.x0 && z < b.z1 && z + d > b.z0);

  // Crypt with the stairwell in the middle; its door opens to one side and the shaft runs back under the crypt.
  const dir = (['N', 'E', 'S', 'W'] as Dir[])[ri(0, 3)], o = DIRV[dir];
  const along = o[0] !== 0;
  const m = along ? cx - o[0] * 4 : cz - o[1] * 4, c = along ? cz + ri(-2, 2) : cx + ri(-2, 2);
  const hut = sbox(dir, m, c, 0, SL + 1, y - 8, 12, 'solid', 2) as Op;
  ops.push(hut);
  ops.push(...stairOpsFor(dir, m, c, false).map((op) => ({ ...op, y: op.y + y })));
  blocked.push({ x0: hut.x - 1, z0: hut.z - 1, x1: hut.x + hut.w + 1, z1: hut.z + hut.d + 1 });
  // keep the approach to the door clear, right out through the perimeter wall
  const ap = sbox(dir, m, c, -14, -1, y, 1, 'x', 2);
  blocked.push({ x0: ap.x, z0: ap.z, x1: ap.x + ap.w, z1: ap.z + ap.d });

  // Broken perimeter wall, one cell in from the edge, with gaps and ragged heights.
  const edge: [number, number][] = [];
  for (let x = x0 + 1; x < x1 - 1; x++) edge.push([x, z0 + 1], [x, z1 - 2]);
  for (let z = z0 + 2; z < z1 - 2; z++) edge.push([x0 + 1, z], [x1 - 2, z]);
  let hgt = ri(1, 3);
  for (const [x, z] of edge) {
    hgt = Math.max(0, Math.min(4, hgt + ri(-1, 1)));
    if (R() < 0.18) hgt = 0;
    if (hgt > 0 && free(x, z)) ops.push({ op: 'solid', x, y, z, w: 1, h: hgt, d: 1 });
  }
  // Columns on a ring, some standing tall, some snapped off; one fallen shaft on the floor.
  const nCol = ri(5, 8), rr = ri(6, 8), a0 = R() * 6.28;
  for (let i = 0; i < nCol; i++) {
    const a = a0 + i / nCol * 6.283, px = Math.round(cx + Math.cos(a) * rr), pz = Math.round(cz + Math.sin(a) * rr);
    if (!free(px, pz)) continue;
    ops.push({ op: 'solid', x: px, y, z: pz, w: 1, h: R() < 0.4 ? ri(1, 2) : ri(4, 6), d: 1 });
    blocked.push({ x0: px, z0: pz, x1: px + 1, z1: pz + 1 });
  }
  for (let t = 0; t < 10; t++) {
    const len = ri(3, 5), horiz = R() < 0.5, px = ri(x0 + 3, x1 - 4 - (horiz ? len : 0)), pz = ri(z0 + 3, z1 - 4 - (horiz ? 0 : len));
    const w = horiz ? len : 1, d = horiz ? 1 : len;
    if (!free(px, pz, w, d)) continue;
    ops.push({ op: 'solid', x: px, y, z: pz, w, h: 1, d });
    blocked.push({ x0: px, z0: pz, x1: px + w, z1: pz + d });
    break;
  }
  // Fragments of the old paving (drawn brighter on top of the floor).
  const tiles: { x: number; z: number }[] = [];
  for (let p = 0; p < 5; p++) {
    const tx = ri(x0 + 2, x1 - 6), tz = ri(z0 + 2, z1 - 6), w = ri(2, 4), d = ri(2, 4);
    for (let x = tx; x < tx + w; x++) for (let z = tz; z < tz + d; z++) if (R() < 0.8 && !tiles.some((q) => q.x === x && q.z === z)) tiles.push({ x, z });
  }
  const portal: PortalSpec = { key: 'D', dir, m, c, up: false, axis: along ? 'x' : 'z', y0: y };
  return { id: poi.id, name: poi.name, y, rect: poi.rect, ops, portal, tiles };
}
