// (0.260, PLAN_LOTNICTWA.md stage F6) The dangers of the air. Every airship and rotorcraft has a hull (`hull`, percent,
// absent = whole). What hurts the people aboard hurts the hull instead (world/damage.ts: a Leechwing's bite, a bandit's
// bolt, a flak burst), lightning in a storm strikes a machine in flight, a bandit camp may keep an anti-air gun
// (`hasFlak`), and a sky line's trip may be damaged (gen/skylines.ts). A hull at 0 gives no lift: the machine settles
// to the ground (an airship slowly, a rotorcraft at its fall rate) and flies again once mended with a Vehicle Repair
// Kit (+`HULL.kit` percent each, used beside it or aboard). A hull below `HULL.worn` flies slower. Pure.
import { hash } from '../core/rng';

export type CraftKind = 'airship' | 'copter';
/**
 * `armour` scales a hit on the people aboard into hull percent (the envelope is big and takes little of each bite, the
 * rotorcraft's skin is thin), `strike` the percent a lightning bolt takes, `flak` a flak burst's, `kit` what a repair
 * kit mends. A hull below `worn` percent slows the machine (`slow` at 0), `sink` m/s is how fast a dead airship
 * settles. Lightning: from `storm` strength over the machine in the air, a bolt about every `every` seconds at full storm.
 */
export const HULL = {
  armour: { airship: 0.45, copter: 1.1 } as Record<CraftKind, number>,
  strike: { airship: 14, copter: 22 } as Record<CraftKind, number>,
  flak: { airship: 9, copter: 16 } as Record<CraftKind, number>,
  kit: 40, worn: 50, slow: 0.6, sink: 2.2,
  storm: 0.55, every: 35, min: 12,
};
/** A machine's hull now (percent; absent = whole). */
export const hullOf = (o: { hull?: number }) => o.hull ?? 100;
/** Take damage `dmg` (what the occupants would have taken) off the hull; the percent lost. */
export function hullHit(o: { hull?: number }, kind: CraftKind, dmg: number): number {
  const lost = Math.min(hullOf(o), Math.max(0, dmg * HULL.armour[kind]));
  o.hull = Math.round((hullOf(o) - lost) * 10) / 10;
  return lost;
}
/** A fixed percent off the hull (lightning, flak, a damaged trip); the percent lost. */
export function hullDamage(o: { hull?: number }, pct: number): number {
  const lost = Math.min(hullOf(o), Math.max(0, pct));
  o.hull = Math.round((hullOf(o) - lost) * 10) / 10;
  return lost;
}
/** Mend with a kit; the percent mended (0 = nothing to mend). */
export function hullMend(o: { hull?: number }): number {
  const was = hullOf(o), now = Math.min(100, was + HULL.kit);
  if (now <= was) return 0;
  if (now >= 100) delete o.hull; else o.hull = now;
  return now - was;
}
/** The speed share a hull allows: 1 while it is above `worn`, falling to `slow` at 0. */
export const hullSpeed = (h: number) => (h >= HULL.worn ? 1 : HULL.slow + (1 - HULL.slow) * (h / HULL.worn));
/** Seconds to the next lightning bolt (on average) over a machine in the air under a storm of strength `storm`; 0 = none. */
export const strikeEvery = (storm: number) => (storm >= HULL.storm ? HULL.every * (1.2 - 0.6 * Math.min(1, (storm - HULL.storm) / (1 - HULL.storm))) : 0);

/**
 * (0.260) A bandit camp keeps an anti-air gun: some camps (`FLAK.chance` of those where the danger is at least
 * `FLAK.from`) by a hash of the world and the camp. It fires at a machine in the air within `range` m every `every`
 * seconds while the camp is not cleared; a burst hits with `hit` odds at point blank, falling with the distance.
 */
export const FLAK = { chance: 0.35, from: 2, range: 170, every: 3.2, hit: 0.7, high: 8 };
export const hasFlak = (world: number, campId: number, danger: number) => danger >= FLAK.from && (hash(world, campId, 0xf1a4) % 1000) / 1000 < FLAK.chance;
/** The odds a burst from `d` m hits a machine flying at `speed` m/s. */
export const flakHit = (d: number, speed: number) => Math.max(0, FLAK.hit * (1 - d / FLAK.range) * (1 - Math.min(0.5, speed / 80)));

/**
 * A sky line's trip may be damaged on the way (gen/skylines.ts): `base` plus `per` for each point of danger half way and
 * `storm` for a storm over the route at the departure (strength above 0.3), at most `max`; a damaged trip takes `dmg`
 * percent off the hull and brings no cargo; at 0 the line stops until the airship is recalled and mended.
 */
export const RISK = { base: 0.015, per: 0.014, storm: 0.12, max: 0.3, dmg: 35 };
export const tripRisk = (danger: number, storm: number) => Math.min(RISK.max, RISK.base + RISK.per * danger + RISK.storm * Math.max(0, storm - 0.3));
