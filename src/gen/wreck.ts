// Crash sites: a freighter that came down nose first and lies half buried. Its hull is an octagonal tube (drawn by
// world/wreck.ts) around voxel slices that give it collision; a hatch in its side opens on a short vestibule and a
// stairwell going down into the wreck's corridors (gen/ship.ts). Pure and deterministic, like gen/ruins.ts.
import { rng, hash, type Dir } from '../core/rng';
import type { Op } from '../core/voxel';
import { stairOpsFor, type PortalSpec } from './stairs';
import type { Poi, Rect } from './regions';

/**
 * Hull-local coordinates: u runs along the ship (the nose at u > 0), v across it (0 = the keel line), h is the
 * height above the ground the wreck lies on.
 */
export interface WreckFrame { axis: 'x' | 'z'; s: 1 | -1; a0: number; b0: number; y: number }
/** World x/z of hull-local (u, v). */
export function wreckXZ(f: WreckFrame, u: number, v: number): [number, number] {
  const a = f.a0 + f.s * u, b = f.b0 + 0.5 + v;
  return f.axis === 'x' ? [a, b] : [b, a];
}
/** The hull: its radius and the height of its centre line along u (the nose is buried, the tail sticks up). */
export const HULL = { tail: -24, nose: 22, r: 5, tailR: 4.2, noseR: 1.4 };
/**
 * (0.241, the owner's request: not every wreck alike) How this one came down: `pitch` how steeply its nose went in
 * (0.03 slid in on its belly .. 0.13 stood on its nose, the tail high), `scale` its size, a broken-backed bow bent
 * `kink` rad sideways from `kinkU` on (always ahead of the hatch), one or two engines, one or two fins.
 * The hatch (u −2) stays at the ground whatever the pitch.
 */
export interface WreckShape { pitch: number; scale: number; kink: number; kinkU: number; engines: 1 | 2; fins: 1 | 2 }
export const PLAIN_SHAPE: WreckShape = { pitch: 0.075, scale: 1, kink: 0, kinkU: 8, engines: 1, fins: 1 };
export function hullR(u: number, sh: WreckShape = PLAIN_SHAPE) {
  if (u < -18) return HULL.tailR * sh.scale;
  if (u > 8) return (HULL.r - (u - 8) / (HULL.nose - 8) * (HULL.r - HULL.noseR)) * sh.scale;
  return HULL.r * sh.scale;
}
export const hullY = (u: number, sh: WreckShape = PLAIN_SHAPE) => 2.55 - (u + 2) * sh.pitch;
/** How far the bent bow has swung sideways at u (0 behind the break). */
export const bendV = (u: number, sh: WreckShape = PLAIN_SHAPE) => (u > sh.kinkU ? (u - sh.kinkU) * Math.tan(sh.kink) : 0);
/** Its shape from its own hash stream (the other rolls of the place stay as they were). */
export function wreckShape(world: number, id: number): WreckShape {
  const R = rng(hash(world, id, 0x3ec7)), roll = R();
  const pitch = roll < 0.25 ? 0.025 + R() * 0.02 : roll < 0.7 ? 0.06 + R() * 0.03 : 0.1 + R() * 0.03;
  const kink = R() < 0.4 ? (R() < 0.5 ? -1 : 1) * (0.1 + R() * 0.08) : 0;
  return { pitch, scale: 0.85 + R() * 0.3, kink, kinkU: 6 + R() * 5, engines: R() < 0.35 ? 2 : 1, fins: R() < 0.3 ? 2 : 1 };
}
/** Half width of the octagonal cross-section at height dy above the centre line (0 outside it). */
export function octHalf(r: number, dy: number) {
  const a = Math.abs(dy) / r;
  if (a <= 0.383) return 0.924 * r;
  if (a <= 0.924) return (0.924 - (a - 0.383)) * r;
  return 0;
}

export interface WreckDeco {
  frame: WreckFrame;
  /** The hatch: at u = hatchU on side hatchS (+1 / -1), the vestibule spans u in [hatchU + 1, hatchU + 4). */
  hatchU: number; hatchS: 1 | -1;
  /** The fin is snapped off (and lies beside the ship)? Where the hull cracked open, rubble around it. */
  finBroken: boolean; crackU: number;
  /** (0.241) How it came down (gen/wreck.ts WreckShape). */
  shape: WreckShape;
  debris: { u: number; v: number; r: number; h: number; rot: number }[];
  plates: { u: number; v: number; l: number; w: number; rot: number }[];
}
export interface WreckMap { id: number; name: string; y: number; rect: Rect; ops: Op[]; portal: PortalSpec; deco: WreckDeco }

export function generateWreck(world: number, poi: Poi, y: number): WreckMap {
  const R = rng(hash(world, poi.id, 0x3ec8));
  const { x0, z0, x1, z1 } = poi.rect, axis: 'x' | 'z' = x1 - x0 >= z1 - z0 ? 'x' : 'z';
  const s: 1 | -1 = R() < 0.5 ? 1 : -1, hatchS: 1 | -1 = R() < 0.5 ? 1 : -1, hatchU = -2;
  const a0 = axis === 'x' ? poi.x : poi.z, b0 = axis === 'x' ? poi.z : poi.x;
  const frame: WreckFrame = { axis, s, a0, b0, y }, sh = wreckShape(world, poi.id);
  /** A voxel box over hull-local cells u in [ua, ub), v in [va, vb], heights [h0, h1). */
  const box = (op: 'solid' | 'room', ua: number, ub: number, va: number, vb: number, h0: number, h1: number): Op => {
    const a = s > 0 ? a0 + ua : a0 - ub, w = ub - ua, b = b0 + va, d = vb - va + 1;
    return axis === 'x' ? { op, x: a, y: y + h0, z: b, w, h: h1 - h0, d } : { op, x: b, y: y + h0, z: a, w: d, h: h1 - h0, d: w };
  };
  const ops: Op[] = [];
  // The hull in 2 m slices: the biggest box that fits inside the octagon from its lowest point above ground up
  for (let u = HULL.tail; u < HULL.nose; u += 2) {
    const r = Math.min(hullR(u, sh), hullR(u + 2, sh)), cy = Math.min(hullY(u, sh), hullY(u + 2, sh));
    const bot = Math.max(0, Math.ceil(cy - 0.8 * r)), top = Math.floor(cy + 0.5 * r);
    if (top - bot < 1) continue;
    const bend = Math.abs(bendV(u + 2, sh) - bendV(u, sh)); // a bent stretch: the slice narrows so it stays inside
    const hw = Math.min(octHalf(r, bot - cy), octHalf(r, top - cy)) - 0.25 - bend / 2, k = Math.floor(hw - 0.5), off = Math.round(bendV(u + 1, sh));
    if (k < 0) continue;
    ops.push(box('solid', u, u + 2, -k + off, k + off, bot, top));
  }
  // The hatch: a vestibule from the side of the hull to a door, the stairwell behind it going down towards the tail
  const dir: Dir = axis === 'x' ? (-s > 0 ? 'E' : 'W') : (-s > 0 ? 'S' : 'N');
  const m = s > 0 ? a0 + hatchU : a0 - hatchU - 1, c = b0;
  ops.push(...stairOpsFor(dir, m, c, false).map((o) => ({ ...o, y: o.y + y })));
  ops.push(hatchS > 0 ? box('room', hatchU + 1, hatchU + 4, 1, 8, 0, 3) : box('room', hatchU + 1, hatchU + 4, -8, -1, 0, 3));
  const portal: PortalSpec = { key: 'D', dir, m, c, up: false, axis, y0: y };

  const debris: WreckDeco['debris'] = [], plates: WreckDeco['plates'] = [];
  for (let i = 0; i < 22; i++) {
    const u = HULL.tail + R() * (HULL.nose - HULL.tail), side = R() < 0.5 ? -1 : 1, v = bendV(u, sh) + side * (hullR(u, sh) * 0.95 + 0.4 + R() * 2.5);
    if (u > hatchU - 1 && u < hatchU + 6 && side === hatchS) continue; // keep the way to the hatch clear
    debris.push({ u, v, r: 0.4 + R() * 1.1, h: 0.3 + R() * 1, rot: R() * 6.283 });
  }
  for (let i = 0; i < 7; i++) {
    const u = HULL.tail + R() * 50, v = (R() < 0.5 ? -1 : 1) * (6 + R() * 5);
    plates.push({ u, v, l: 1.5 + R() * 2.5, w: 0.8 + R() * 1.2, rot: R() * 6.283 });
  }
  return {
    id: poi.id, name: poi.name, y, rect: poi.rect, ops, portal,
    deco: { frame, hatchU, hatchS, finBroken: R() < 0.5, crackU: -12 + R() * 6, debris, plates, shape: sh },
  };
}
