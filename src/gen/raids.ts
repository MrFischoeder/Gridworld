// Bandit raids on villages. A village with a bandit camp within `RAID.reach` is raided from it now and then: every
// village has its own timetable (a raid every 2-5 game days, from the world seed), so like the caravans there is no
// state to keep, and on the future server it costs nothing where nobody is. Only where a player is at the village
// does a raid really happen (world/villageraid.ts: waves of bandits march on the gates and the power plant); anywhere
// else its outcome is rolled from the seed and the village's wall (a better wall holds more often), and a lost raid
// wrecks part of the power plant (`raidHurt`, until it is mended). Pure.
import { hash } from '../core/rng';
import { poisNear, worldDist, type Poi } from './regions';
import { dangerAt } from './danger';
import type { TownState } from './town';

export const RAID = {
  /** Camps further than this from a village do not raid it (m). */
  reach: 3500,
  /** Game minutes between raids on one village, before the hashed spread. */
  period: [2 * 1440, 5 * 1440] as const,
  /** How long a raid lasts, and how long before it the scouts see it coming (game minutes). */
  duration: 150, warn: 90,
  /** Chance the village holds without you, by wall tier, and how much a lost raid hurts the power plant. */
  hold: [0.45, 0.7, 0.9], loss: 35,
};
export interface Raid { village: number; k: number; t0: number; camp: Poi; strength: number }
const campCache = new Map<string, Poi | null>();
/** The camp that raids village v (the nearest within reach), or null. */
export function raidSource(world: number, v: Poi): Poi | null {
  const key = world + ':' + v.id;
  if (campCache.has(key)) return campCache.get(key)!;
  let best: Poi | null = null, bd = RAID.reach;
  for (const p of poisNear(world, v.x, v.z, RAID.reach)) if (p.type === 'camp') { const d = worldDist(p.x, p.z, v.x, v.z); if (d < bd) { bd = d; best = p; } }
  if (campCache.size > 2000) campCache.clear();
  campCache.set(key, best);
  return best;
}
const periodOf = (world: number, v: Poi) => RAID.period[0] + (hash(world, v.id, 0x4a1d) % (RAID.period[1] - RAID.period[0]));
/** Raid k on village v (a raid happens every period; its time wobbles within it). */
export function raidOf(world: number, v: Poi, k: number): Raid | null {
  const camp = raidSource(world, v);
  if (!camp || k < 1) return null; // no raid in the first period: a new game starts in peace
  const P = periodOf(world, v), t0 = k * P + (hash(world, v.id, k, 0x4a1e) % Math.floor(P * 0.6));
  return { village: v.id, k, t0, camp, strength: Math.max(1, Math.min(8, dangerAt(world, camp.x, camp.z))) };
}
/** Raids on village v that start in [t1, t2]. */
export function raidsBetween(world: number, v: Poi, t1: number, t2: number): Raid[] {
  if (!raidSource(world, v)) return [];
  const P = periodOf(world, v), out: Raid[] = [];
  for (let k = Math.max(1, Math.floor(t1 / P) - 1); k * P <= t2; k++) { const r = raidOf(world, v, k); if (r && r.t0 >= t1 && r.t0 <= t2) out.push(r); }
  return out;
}
/** How raid r ended: as fought with you there (saved), or else as rolled from the seed and the wall. */
export function raidOutcome(world: number, r: Raid, s: TownState | undefined): 'won' | 'lost' {
  const seen = s?.raids?.[r.k];
  if (seen) return seen;
  const wall = Math.min(RAID.hold.length - 1, s?.wall ?? 0), hold = RAID.hold[wall] - (r.strength - 2) * 0.04;
  return (hash(world, r.village, r.k, 0x4a1f) % 1000) / 1000 < hold ? 'won' : 'lost';
}
/** Damage lost raids have done to the village's power plant since `since` (its last mending), up to `now`. */
export function raidHurt(world: number, v: Poi, s: TownState | undefined, since: number, now: number): number {
  let h = 0;
  for (const r of raidsBetween(world, v, since - RAID.duration, now)) if (r.t0 + RAID.duration > since && r.t0 + RAID.duration <= now && raidOutcome(world, r, s) === 'lost') h += RAID.loss;
  return h;
}
/** The next raid on v after `now` (for the elder's warning), and the last one before it. */
export const nextRaid = (world: number, v: Poi, now: number) => raidsBetween(world, v, now, now + 6 * 1440)[0] ?? null;
export const lastRaid = (world: number, v: Poi, now: number) => raidsBetween(world, v, now - 8 * 1440, now - RAID.duration).pop() ?? null;
