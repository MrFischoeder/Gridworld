// Ruins: an alien temple of an unknown civilisation, long fallen. Seen from above it is a cross: a round inner
// chamber (the crypt with the stairwell down into the dungeon) with four arms; the entrance arm is an avenue of
// obelisks leading to a stepped portal between two leaning pylons that once carried a great ring.
// Collision and the way down are voxels (ops); the alien shapes on top of them (pylons, portal frames, obelisks,
// the ring, fallen pieces) are described in `temple` and drawn by world/temple.ts, always enclosing the voxels.
import { rng, hash, rangeInt, DIRV, type Dir } from '../core/rng';
import type { Op } from '../core/voxel';
import { stairOpsFor, SL, type PortalSpec } from './stairs';
import type { Poi, Rect } from './regions';

/**
 * Temple-local coordinates: u runs from the portal's face into the temple (the entrance avenue is at u < 0),
 * v runs sideways (0 = middle of the doorway), y is height above the floor.
 */
export interface TempleFrame { axis: 'x' | 'z'; o: number; m: number; c: number; y: number }
/** World x/z of temple-local (u, v). */
export function templeXZ(f: TempleFrame, u: number, v: number): [number, number] {
  const a = (f.o > 0 ? f.m : f.m + 1) + f.o * u, b = f.c + 0.5 + v;
  return f.axis === 'x' ? [a, b] : [b, a];
}
export interface Obelisk { u: number; v: number; h: number; w: number; /** how far its top leans (m, in u and v) */ lu: number; lv: number; /** 0 = whole; else how much of it still stands (0..1) */ broken: number; /** fallen top lies this way (radians in u/v) */ fall: number }
export interface TempleDeco {
  frame: TempleFrame;
  /** Main body: half width at the base, height, and how ragged its top edge is (per corner). */
  bodyW: number; bodyH: number; jag: number[];
  /** The two portal pylons (v < 0 and v > 0): height left standing, and whether it snapped. */
  pylons: { h: number; snapped: boolean }[];
  /** The ring between the pylon tops: still up, fallen in front of the portal, or gone. */
  ring: 'up' | 'fallen' | 'gone';
  /** Stepped frames of the portal still standing (0..3). */
  frames: number;
  obelisks: Obelisk[];
  /** Smaller pylons at the ends of the side and back arms. */
  armPylons: Obelisk[];
  /** Rubble: rocks and broken blocks lying about. */
  rubble: { u: number; v: number; r: number; h: number; rot: number }[];
}
export interface RuinMap {
  id: number; name: string; y: number; rect: Rect;
  ops: Op[];
  portal: PortalSpec;
  /** Decorative floor fragments (brighter tiles), in world x/z. */
  tiles: { x: number; z: number }[];
  temple: TempleDeco;
}

export function generateRuin(world: number, poi: Poi, y: number): RuinMap {
  const R = rng(hash(world, poi.id, 0x2a1)), ri = rangeInt(R);
  const { x0, z0, x1, z1 } = poi.rect, cx = (x0 + x1) >> 1, cz = (z0 + z1) >> 1;
  const ops: Op[] = [];

  // The crypt (the round inner chamber) sits a little behind the middle; its portal faces the entrance arm.
  const dir = (['N', 'E', 'S', 'W'] as Dir[])[ri(0, 3)], o = DIRV[dir], along = o[0] !== 0, oo = along ? o[0] : o[1];
  const m = along ? cx - o[0] * 4 : cz - o[1] * 4, c = along ? cz : cx;
  const f: TempleFrame = { axis: along ? 'x' : 'z', o: oo, m, c, y };
  /** A voxel box in temple-local cells: u0..u1 along the axis (0 = the portal cell), v0..v1 sideways. */
  const cell = (u: number, v: number): [number, number] => { const a = m + oo * u, b = c + v; return along ? [a, b] : [b, a]; };
  const box = (op: 'solid' | 'room', u0: number, u1: number, v0: number, v1: number, yy: number, h: number): Op => {
    const [ax, az] = cell(u0, v0), [bx, bz] = cell(u1, v1);
    return { op, x: Math.min(ax, bx), y: yy, z: Math.min(az, bz), w: Math.abs(bx - ax) + 1, h, d: Math.abs(bz - az) + 1 };
  };
  const inRect = (u: number, v: number) => { const [x, z] = cell(u, v); return x >= x0 + 1 && x < x1 - 1 && z >= z0 + 1 && z < z1 - 1; };
  const avenue = (u: number, v: number) => u < 0 && Math.abs(v) <= 3; // kept clear all the way to the edge

  // Body of the temple around the crypt: the solid core the stairwell is cut into, then the side masses.
  ops.push(box('solid', 0, SL + 1, -2, 2, y - 8, 12));
  ops.push(box('solid', 0, 9, -5, -2, y, 3), box('solid', 0, 9, 2, 5, y, 3));
  ops.push(...stairOpsFor(dir, m, c, false).map((op) => ({ ...op, y: op.y + y })));

  // The round inner wall and the four arms, broken: gaps, ragged heights, fallen stretches.
  const occupied = new Set<string>(), put = (u: number, v: number, h: number) => {
    if (h <= 0 || avenue(u, v) || !inRect(u, v) || (u >= -1 && u <= 10 && Math.abs(v) <= 6)) return;
    const k = u + ',' + v; if (occupied.has(k)) return; occupied.add(k);
    const [x, z] = cell(u, v); ops.push({ op: 'solid', x, y, z, w: 1, h, d: 1 });
  };
  let hgt = 2;
  const ragged = () => { hgt = Math.max(0, Math.min(4, hgt + ri(-1, 1))); if (R() < 0.22) return 0; return hgt; };
  const ringR = 9, rc = 4.5;
  for (let i = 0; i < 64; i++) { const a = i / 64 * 6.283; put(Math.round(rc + Math.cos(a) * ringR), Math.round(Math.sin(a) * ringR), ragged()); }
  for (const side of [-1, 1]) for (let k = 0; k < 8; k++) { // side arms: two low walls each
    put(3 + 0, side * (ringR + 1 + k), ragged()); put(7, side * (ringR + 1 + k), ragged());
  }
  for (let k = 0; k < 6; k++) { put(rc + ringR + 1 + k, -2, ragged()); put(rc + ringR + 1 + k, 2, ragged()); } // back arm

  // Alien dressing (drawn in world/temple.ts). Everything is weathered: things snapped, toppled, gone.
  const jag = Array.from({ length: 6 }, () => (R() < 0.5 ? R() * 3.5 : R() * 1));
  const pylons = [0, 1].map(() => { const snapped = R() < 0.65; return { h: snapped ? 7 + R() * 9 : 19 + R() * 7, snapped }; });
  const ring = pylons.some((p) => p.snapped) ? (R() < 0.65 ? 'fallen' : 'gone') : R() < 0.4 ? 'fallen' : 'up';
  const obelisks: Obelisk[] = [];
  for (let u = -6; inRect(u, 5) || inRect(u, -5); u -= 4) for (const s of [-1, 1]) {
    if (!inRect(u, s * 5) || R() < 0.2) continue; // some are simply gone
    const broken = R() < 0.6 ? 0.25 + R() * 0.5 : 0;
    obelisks.push({ u: u + (R() - 0.5), v: s * (5 + R() * 0.8), h: 6 + R() * 6, w: 1.1 + R() * 0.3, broken, fall: R() * 6.283, lu: (R() - 0.5) * 1.6, lv: (R() - 0.5) * 1.6 });
    put(Math.round(u), s * 5, 3);
  }
  const armPylons: Obelisk[] = [];
  for (const [u, v] of [[5, -(ringR + 9)], [5, ringR + 9], [rc + ringR + 8, 0]] as [number, number][]) {
    if (!inRect(Math.round(u), Math.round(v)) || R() < 0.2) continue;
    armPylons.push({ u, v, h: 8 + R() * 7, w: 2 + R() * 0.6, broken: R() < 0.65 ? 0.25 + R() * 0.4 : 0, fall: R() * 6.283, lu: (R() - 0.5) * 1.2, lv: (R() - 0.5) * 1.2 });
    put(Math.round(u), Math.round(v), 3); put(Math.round(u) + 1, Math.round(v), 3);
  }
  const rubble: TempleDeco['rubble'] = [];
  for (let i = 0; i < 26; i++) {
    const u = ri(-16, 20), v = ri(-17, 17);
    if (avenue(u, v) && Math.abs(v) < 2.5) continue;
    if (!inRect(u, v) || (u >= -1 && u <= 10 && Math.abs(v) <= 6)) continue;
    rubble.push({ u, v, r: 0.5 + R() * 1.3, h: 0.4 + R() * 1.2, rot: R() * 6.283 });
  }

  // Fragments of the old paving along the avenue and in the chamber (drawn brighter on top of the floor).
  const tiles: { x: number; z: number }[] = [];
  for (let u = -16; u < 0; u++) for (let v = -2; v <= 2; v++) if (R() < 0.55 && inRect(u, v)) { const [x, z] = cell(u, v); tiles.push({ x, z }); }
  const portal: PortalSpec = { key: 'D', dir, m, c, up: false, axis: along ? 'x' : 'z', y0: y };
  return {
    id: poi.id, name: poi.name, y, rect: poi.rect, ops, portal, tiles,
    temple: { frame: f, bodyW: 6.2, bodyH: 10 + R() * 4, jag, pylons, ring, frames: ri(1, 3), obelisks, armPylons, rubble },
  };
}
