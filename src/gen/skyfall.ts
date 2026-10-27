// (0.266, shared since 0.267) Now and then something falls out of orbit: a container comes down like a meteor, the
// ground booms, and it lies wrecked for everyone in the place to follow and open. One fall is one shared record
// (`SkyFall`, Char.skyfalls): a player entering a new area rolls for it (world/skyfall.ts), the record carries where it
// lands and when, and every game animates the same streak, flare and boom from the game clock.
import { hash } from '../core/rng';

/** One fall, shared by the whole room. */
export interface SkyFall { id: string; slot: number; x: number; z: number; t: number; by: string }

export const FALL = {
  /** game minutes in a slot; at most one fall begins in a slot (1 real second = 1 game minute) */
  period: 720,
  /** the chance, when a player enters a new area, that a fall begins (at most one a slot) */
  chance: 0.12,
  /** the area a roll belongs to, metres a side */
  cell: 1000,
  /** a streak is seen, and a boom heard, by everyone this near the impact, metres */
  hear: 4500,
  /** the fall itself, real seconds from the first streak to the impact */
  secs: 11,
  /** the container lands this far from the player, metres */
  near: 380, far: 820,
  /** the sound of an impact is heard at this speed (m/s), at most `lag` seconds late */
  sound: 340, lag: 3,
  /** a container lies this many game minutes (two days), then the land takes it */
  life: 2880,
  /** E reach, metres */
  reach: 2.6,
  /** the streak starts this far off and up, metres */
  off: 900, high: 1100,
};

const unit = (...v: number[]) => hash(...v) / 1e6;
export const fallSlot = (t: number) => Math.floor(t / FALL.period);

/** The area (cell) a position belongs to; a change of it is a new location. */
export const fallCell = (x: number, z: number) => Math.floor(x / FALL.cell) + ':' + Math.floor(z / FALL.cell);
export const fallId = (slot: number) => 'sky:' + slot;
/** Whether a new area rolls a fall: `r` is a random 0..1. */
export const fallRolls = (r: number) => r < FALL.chance;

/** Candidate k for the landing, round (px, pz): bearing and distance. */
export function fallSpot(world: number, s: number, px: number, pz: number, k: number, near = FALL.near, far = FALL.far) {
  const a = unit(world, s, k, 0xfa13) * Math.PI * 2, d = near + unit(world, s, k, 0xfa14) * (far - near);
  return { x: px + Math.cos(a) * d, z: pz + Math.sin(a) * d };
}
/** The bearing (radians) the streak comes from. */
export const fallFrom = (world: number, s: number) => unit(world, s, 0xfa15) * Math.PI * 2;

/** What the container holds: always a good from the old world, and some salvage. */
export function fallLoot(world: number, s: number): [string, number][] {
  const rare = ['microchip', 'sensor', 'powercell', 'pcore', 'precision', 'ancalloy'];
  const r = unit(world, s, 0xfa16), out: [string, number][] = [];
  out.push([rare[Math.floor(r * rare.length)], 1 + Math.floor(unit(world, s, 0xfa17) * 3)]);
  out.push(['scrap', 6 + Math.floor(unit(world, s, 0xfa18) * 10)]);
  out.push(['circuit', 2 + Math.floor(unit(world, s, 0xfa19) * 5)]);
  if (unit(world, s, 0xfa1a) < 0.6) out.push(['parts', 1 + Math.floor(unit(world, s, 0xfa1b) * 3)]);
  if (unit(world, s, 0xfa1c) < 0.5) out.push(['medkit', 1 + Math.floor(unit(world, s, 0xfa1d) * 2)]);
  if (unit(world, s, 0xfa1e) < 0.35) out.push(['battery', 2 + Math.floor(unit(world, s, 0xfa1f) * 4)]);
  return out;
}
export const fallGold = (world: number, s: number) => 60 + Math.floor(unit(world, s, 0xfa20) * 240);

/** The streak's position at u (0 start .. 1 impact): from high up and far off, steepening. */
export function fallPath(to: { x: number; y: number; z: number }, from: number, u: number) {
  const k = 1 - u, h = FALL.high * k * (0.45 + 0.55 * k), o = FALL.off * k;
  return { x: to.x + Math.cos(from) * o, y: to.y + h, z: to.z + Math.sin(from) * o };
}
