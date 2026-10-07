// Construction time (pure): a village build no longer stands the moment its last materials are in. The builders get to
// work then, and it takes game hours (most of a game day for the big ones) before it stands. A job is saved in the
// village's shared state (`TownState.jobs`), so every player sees the same site with the same builders, and whoever has
// the game running finishes it when its time is up (gen/jobs.ts; the same change on every game).
import type { TownState } from './town';

export type JobKind = 'farm' | 'plough' | 'wall' | 'work' | 'refinery' | 'improve' | 'plantup' | 'plant' | 'project';
/** A build under way: what (`k` and its sub-kind `a`), since when (game minutes) and for how many game hours. */
export interface Job { k: JobKind; a?: string; t: number; h: number }

/** How long each build takes, in game hours (a game hour is a real minute). */
export const BUILD_HOURS: Record<JobKind, number> = { farm: 14, plough: 8, wall: 16, work: 8, refinery: 18, improve: 12, plantup: 10, plant: 16, project: 12 };
/** Sub-kinds that take longer or shorter than their kind. */
const MORE: Record<string, number> = {
  'wall:2': 24, 'work:siteGuard': 6, 'work:plantGuard': 6,
  'project:warehouse': 14, 'project:power': 12, 'project:comms': 10, 'project:refinery': 16, 'project:relay': 10, 'project:foodworks': 14, 'project:sawmill': 10, 'project:sawmill2': 8, 'project:sawmill3': 8,
};
export const jobKey = (k: JobKind, a?: string) => (a ? k + ':' + a : k);
export const hoursOf = (k: JobKind, a?: string) => MORE[jobKey(k, a)] ?? BUILD_HOURS[k];
export const jobOf = (s: TownState | undefined, k: JobKind, a?: string): Job | undefined => s?.jobs?.[jobKey(k, a)];
/** The builders start on k (once: a job already under way keeps its start). */
export function startJob(s: TownState, k: JobKind, a: string | undefined, now: number, h = hoursOf(k, a)): Job {
  const key = jobKey(k, a);
  return ((s.jobs ??= {})[key] ??= a === undefined ? { k, t: now, h } : { k, a, t: now, h });
}
export const jobEnd = (j: Job) => j.t + j.h * 60;
/** How far along a job is, 0..1. */
export const jobShare = (j: Job, now: number) => Math.max(0, Math.min(1, (now - j.t) / (j.h * 60)));
/** The jobs whose time is up. */
export const dueJobs = (s: TownState | undefined, now: number): Job[] => Object.values(s?.jobs ?? {}).filter((j) => now >= jobEnd(j));
export function dropJob(s: TownState, j: Job) { if (s.jobs) { delete s.jobs[jobKey(j.k, j.a)]; if (!Object.keys(s.jobs).length) delete s.jobs; } }
/** "about 6 h" / "about 40 min": how long the builders still need. */
export function jobLeft(j: Job, now: number): string {
  const m = Math.max(1, Math.ceil(jobEnd(j) - now));
  return m >= 90 ? `about ${Math.round(m / 60)} h` : `about ${m} min`;
}
