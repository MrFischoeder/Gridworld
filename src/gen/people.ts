// Village population (pure, deterministic): the few villagers you see stand for a bigger number of people who live and
// work there. Every village has a base number from its seed (what its land feeds now); the count eases towards the
// target (the base, later raised by farms) over days, and losses (villagers killed in raids, a village overrun) set
// it back. Only one anchor is saved per village (`TownState.people`), so nothing needs stepping: the count at any
// time is worked out from the anchor, like the storehouse. Workers are a share of the people; the industry site's
// output scales with how many there are against the base (`staffing`, 1 at the base).
import { hash } from '../core/rng';
import type { TownState } from './town';

export const PEOPLE = {
  /** Base population: min + a hashed part of span; Gridholm's is fixed. */
  min: 40, span: 50, home: 70,
  /** Share of the people who work. */
  work: 0.6,
  /** Game minutes for the count to close ~63% of the gap to its target. */
  tau: 3 * 1440,
  /** Output bounds of the staffing factor. */
  low: 0.3, high: 2,
  /** A village overrun in a raid loses this share of its people. */
  overrun: 0.12,
};
export const basePeople = (seed: number, home: boolean) => (home ? PEOPLE.home : PEOPLE.min + (hash(seed, 0x9e0) % (PEOPLE.span + 1)));
/** What the village's food supports: the base plus what its farms feed (gen/farms.ts `farmPeople`, repeated here to keep the imports one way). */
export const peopleTarget = (seed: number, home: boolean, s: TownState | undefined) => basePeople(seed, home) + (s?.farms ?? 0) * Math.round(15 * (0.7 + (hash(seed, 0xf42) % 61) / 100));
/** People living there at game time `now` (a fraction: shown rounded). */
export function peopleAt(seed: number, home: boolean, s: TownState | undefined, now: number): number {
  const target = peopleTarget(seed, home, s), a = s?.people;
  if (!a) return target;
  return target - (target - a.n) * Math.exp(-Math.max(0, now - a.t) / PEOPLE.tau);
}
/** Sets the count now to `n` (a loss or a gain), re-anchoring the curve. */
export function setPeople(s: TownState, seed: number, home: boolean, now: number, n: number) { s.people = { n: Math.max(5, n), t: now }; void seed; void home; }
/** Loses `k` people now (killed), or a share (`share` of the count). */
export function losePeople(s: TownState, seed: number, home: boolean, now: number, k: number, share = 0) {
  const n = peopleAt(seed, home, s, now);
  setPeople(s, seed, home, now, n - k - n * share);
}
export const workersAt = (seed: number, home: boolean, s: TownState | undefined, now: number) => Math.floor(peopleAt(seed, home, s, now) * PEOPLE.work);
/** How well manned the industry site is: workers now against the base's (1 at the base). */
export function staffing(seed: number, home: boolean, s: TownState | undefined, now: number): number {
  const base = basePeople(seed, home) * PEOPLE.work;
  return Math.max(PEOPLE.low, Math.min(PEOPLE.high, (peopleAt(seed, home, s, now) * PEOPLE.work) / base));
}
