// (0.224, PLAN_WALKI.md stage W3: cover) Bandit gunners, their leaders and Guardian drones fight from cover: they
// look over the ground round them for a spot where something solid (a stone, a trunk, a ruin's block, a wall, a
// vehicle, a crystal, a crest of the ground) stands between them and their target, run there, crouch behind it,
// then rise (or lean out to a side) for a burst and drop back. The spot is weighed again every few seconds and given
// up when the target has come round it (it no longer hides them) or comes close.
//
// Run by the foe's owner game (the one that runs its mind); the crouch goes to the other games with the foe's
// position (world/foesync.ts, entry 12), so a crouched copy is drawn and hit low there too.
import * as THREE from 'three';
import { rayWorld } from './player';
import { vehicles, driving, rayVehicle } from './vehicles';
import { COVER, coverSpots } from '../gen/cover';

export interface CoverOpts {
  /** Ground height at (x, z), and whether a body of radius r with feet at y fits there. */
  ground: (x: number, z: number) => number;
  body: (x: number, y: number, z: number) => boolean;
  /** Height above the ground that must be hidden while crouched, and the eye when it rises to shoot. */
  low: number; stand: number;
  /** No spot further than this from the target. */
  far: number;
}
export interface CoverSpot { x: number; z: number; px: number; pz: number }
type Mode = 'go' | 'hide' | 'peek';
interface Plan { s: CoverSpot; mode: Mode; t: number; check: number }
interface Ctl { plan: Plan | null; next: number }
const ctls = new WeakMap<object, Ctl>();
const P = new THREE.Vector3(), D = new THREE.Vector3();
/** How far a straight line from (ax, ay, az) to (bx, by, bz) goes before something solid; and its length. */
function sight(ax: number, ay: number, az: number, bx: number, by: number, bz: number): [number, number] {
  const L = Math.hypot(bx - ax, by - ay, bz - az) || 1e-6;
  P.x = ax; P.y = ay; P.z = az; D.x = (bx - ax) / L; D.y = (by - ay) / L; D.z = (bz - az) / L;
  let t = rayWorld(P, D, L);
  for (const v of vehicles) if (v !== driving.v && !v.ai) { const h = rayVehicle(v, P, D, t); if (h) t = h.t; } // a parked vehicle is cover too
  return [t, L];
}
/** Something stands within `COVER.within` m of the low point towards the target's chest. */
function hides(x: number, z: number, gy: number, o: CoverOpts, tx: number, ty: number, tz: number): boolean {
  const [t, L] = sight(x, gy + o.low, z, tx, ty + 1.1, tz);
  return t < Math.min(COVER.within, L - 1);
}
/** A clear line from the eye at (x, z) to the target's chest. */
const clear = (x: number, z: number, gy: number, o: CoverOpts, tx: number, ty: number, tz: number) => { const [t, L] = sight(x, gy + o.stand, z, tx, ty + 1.2, tz); return t >= L - 0.6; };

/** The best cover spot near (x, z) from a target at (tx, ty, tz) (feet), with where to rise or lean out; null if none. */
export function findCover(x: number, z: number, tx: number, ty: number, tz: number, o: CoverOpts, tries = 18): CoverSpot | null {
  for (const [sx, sz] of coverSpots(x, z, tx, tz, o.far)) {
    if (tries-- <= 0) break;
    const gy = o.ground(sx, sz);
    if (!Number.isFinite(gy) || o.body(sx, gy, sz) || !hides(sx, sz, gy, o, tx, ty, tz)) continue;
    const peek = peekFrom(sx, sz, gy, o, tx, ty, tz);
    if (peek) return { x: sx, z: sz, px: peek[0], pz: peek[1] };
  }
  return null;
}
/** Where it shoots from: standing up at the spot, or a step to a side when the cover is taller than the eye. */
function peekFrom(sx: number, sz: number, gy: number, o: CoverOpts, tx: number, ty: number, tz: number): [number, number] | null {
  if (clear(sx, sz, gy, o, tx, ty, tz)) return [sx, sz];
  const L = Math.hypot(tx - sx, tz - sz) || 1, nx = -(tz - sz) / L, nz = (tx - sx) / L;
  for (const k of [1, -1]) {
    const px = sx + nx * COVER.lean * k, pz = sz + nz * COVER.lean * k, py = o.ground(px, pz);
    if (Number.isFinite(py) && !o.body(px, py, pz) && clear(px, pz, py, o, tx, ty, tz)) return [px, pz];
  }
  return null;
}
const rand = ([a, b]: [number, number]) => a + Math.random() * (b - a);

/** What the cover asks of a foe this frame: where to go (or null to stay), whether to crouch and whether it may fire. */
export interface CoverStep { to: [number, number] | null; duck: boolean; fire: boolean }
/**
 * A foe (`self`, at (x, z)) fighting a target at (tx, ty, tz): finds and keeps a cover spot and says what to
 * do. null = no cover (or the target is close): the foe fights in the open as before.
 */
export function coverStep(self: object, x: number, z: number, tx: number, ty: number, tz: number, dt: number, o: CoverOpts): CoverStep | null {
  let c = ctls.get(self);
  if (!c) ctls.set(self, (c = { plan: null, next: Math.random() * 0.8 }));
  const dist = Math.hypot(tx - x, tz - z);
  if (dist < COVER.near - 1.5) { c.plan = null; return null; } // too close for cover: fight it out
  let p = c.plan;
  if (p && (p.check -= dt) <= 0) { // still a good spot? the target may have come round it
    p.check = COVER.recheck;
    const gy = o.ground(p.s.x, p.s.z), d = Math.hypot(tx - p.s.x, tz - p.s.z);
    if (d < COVER.near - 1 || d > o.far + 8 || !hides(p.s.x, p.s.z, gy, o, tx, ty, tz)) { c.plan = p = null; c.next = 0.4; }
    else { const k = peekFrom(p.s.x, p.s.z, gy, o, tx, ty, tz); if (k) { p.s.px = k[0]; p.s.pz = k[1]; } }
  }
  if (!p) {
    if ((c.next -= dt) > 0) return null;
    const s = findCover(x, z, tx, ty, tz, o);
    c.next = s ? 0 : 2 + Math.random();
    if (!s) return null;
    c.plan = p = { s, mode: 'go', t: 0, check: COVER.recheck };
  }
  const at = (ax: number, az: number) => Math.hypot(ax - x, az - z) < 0.45;
  switch (p.mode) {
    case 'go':
      if (at(p.s.x, p.s.z)) { p.mode = 'hide'; p.t = rand(COVER.hide); }
      return { to: [p.s.x, p.s.z], duck: false, fire: true };
    case 'hide':
      if ((p.t -= dt) <= 0) { p.mode = 'peek'; p.t = rand(COVER.peek); }
      return { to: at(p.s.x, p.s.z) ? null : [p.s.x, p.s.z], duck: true, fire: false };
    case 'peek':
      if ((p.t -= dt) <= 0) { p.mode = 'hide'; p.t = rand(COVER.hide); }
      return { to: at(p.s.px, p.s.pz) ? null : [p.s.px, p.s.pz], duck: false, fire: at(p.s.px, p.s.pz) };
  }
}
/** Forget a foe's cover (it left the fight). */
export const dropCover = (self: object) => { const c = ctls.get(self); if (c) c.plan = null; };
/** Whether a foe holds a cover spot (crouched out of sight it does not count as having lost its target). */
export const inCover = (self: object) => !!ctls.get(self)?.plan;
