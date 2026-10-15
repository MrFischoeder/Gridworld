// (0.225, PLAN_WALKI.md stage W4: decoys and distractions) Throwing things to draw a foe's eye: a stone clatters where
// it lands, a flare burns and hisses there for most of a minute, a piece of meat lures the hungry beasts. Pure: what can
// be thrown, how hard (held longer, thrown further), the flight (a simple ballistic step) and what each does on
// landing. world/throwing.ts flies them and world/baits.ts keeps the meat on the ground.
import type { ItemKey } from '../data/items';

export type ThrowKind = 'stone' | 'flare' | 'meat' | 'grenade';
/** The items that can be thrown, in the order the throw key picks them when none is chosen. */
export const THROWABLES: ItemKey[] = ['stone', 'flare', 'meatR', 'fishR'];
export const throwKind = (k: ItemKey | 'grenade'): ThrowKind => (k === 'grenade' ? 'grenade' : k === 'flare' ? 'flare' : k === 'stone' ? 'stone' : 'meat');

export const THROW = {
  /** Release speed (m/s) from a tap to a full swing, and the hold that reaches it (s). */
  min: 8, max: 22, charge: 0.9,
  /** A little up from the view, so a level throw arcs. */
  up: 0.16, gravity: 9.8,
  /** The noise where it lands (m): a stone's clatter, a flare's hiss (again every `every` s while it burns). */
  noise: { stone: 24, flare: 30, meat: 0, grenade: 0 } as Record<ThrowKind, number>,
  flare: { burn: 50, every: 5, r: 14 },
  /** Meat on the ground: how long it lies there (s), how far a roaming predator smells it, how near one already
   *  hunting must be to break off for it (and the hunted player at least `away` m off), how close it feeds. */
  bait: { life: 60, reach: 35, hunt: 14, away: 9, eat: 1.4 },
  /** A flight ends after this long whatever happens (s). */
  life: 6,
};
/** How fast a throw leaves the hand after holding the key `held` seconds. */
export const throwSpeed = (held: number) => THROW.min + (THROW.max - THROW.min) * Math.max(0, Math.min(1, held / THROW.charge));
/** The share of a full swing the hold gives (0..1), for the hint. */
export const throwShare = (held: number) => Math.max(0, Math.min(1, held / THROW.charge));

export interface Flight { p: [number, number, number]; v: [number, number, number] }
/** One step of a flight (in place); returns the segment's start for the hit test. */
export function stepFlight(f: Flight, dt: number): [number, number, number] {
  const a: [number, number, number] = [f.p[0], f.p[1], f.p[2]];
  f.p[0] += f.v[0] * dt; f.p[2] += f.v[2] * dt;
  f.p[1] += f.v[1] * dt - 0.5 * THROW.gravity * dt * dt;
  f.v[1] -= THROW.gravity * dt;
  return a;
}
/** Where a throw from `p` with velocity `v` lands on ground `ground(x, z)` (no obstacles), stepping `dt`; for the tests and the hint. */
export function landing(p: [number, number, number], v: [number, number, number], ground: (x: number, z: number) => number, dt = 1 / 60): [number, number, number] {
  const f: Flight = { p: [...p], v: [...v] };
  for (let t = 0; t < THROW.life; t += dt) {
    stepFlight(f, dt);
    if (f.p[1] <= ground(f.p[0], f.p[2])) { f.p[1] = ground(f.p[0], f.p[2]); break; }
  }
  return f.p;
}
/** The velocity of a throw along the view (yaw / pitch as the camera's) at `speed`. */
export function throwVelocity(yaw: number, pitch: number, speed: number): [number, number, number] {
  const p = pitch + THROW.up, c = Math.cos(p);
  return [-Math.sin(yaw) * c * speed, Math.sin(p) * speed, -Math.cos(yaw) * c * speed];
}

/**
 * (0.226, stage W2) Bandits' grenades, thrown at where they last saw you when you have gone to ground: they blink and
 * beep for `fuse` s where they land (a red ring marks the blast) and then go off, hurting within `r` m. A gunner
 * throws one now and then (`cool` s), its group not more often than every `group` s, from `min` to `max` m away.
 */
export const GRENADE = { fuse: 2.2, r: 4.5, dmg: 22, push: 7, cool: 14, group: 7, min: 6, max: 24, fell: 0.45 };
/** The velocity that lobs from `p` to `at` in about the right time for the distance. */
export function lobVelocity(p: [number, number, number], at: [number, number, number]): [number, number, number] {
  const d = Math.hypot(at[0] - p[0], at[2] - p[2]), T = 0.8 + d / 30;
  return [(at[0] - p[0]) / T, (at[1] - p[1] + 0.5 * THROW.gravity * T * T) / T, (at[2] - p[2]) / T];
}
/** A blast's harm at distance d (full at the middle, 40% at the edge, none beyond). */
export const grenadeHarm = (d: number, dmg = GRENADE.dmg) => (d >= GRENADE.r ? 0 : dmg * (1 - (d / GRENADE.r) * 0.6));
