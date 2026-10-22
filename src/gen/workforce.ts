// Workers (pure, new-world settlements only): every facility of a settlement has its posts (`JOBS`) and the village's
// workers (a share of its people, gen/people.ts) fill them by a fixed priority: food first (the farms), then power,
// the food processing house, the extraction yards, the refinery, the processing works in build order and the power
// stations. A post short of hands works at the share it has (farms, yards, the power plant, the food processing
// house); a processing works or a station needs its whole crew or stands still. Nothing is saved: the assignment follows from the village's state and its people, so every
// player in a world works it out the same.
import { progressive, projectDone, type Project } from './settlement';
import type { TownState } from './town';

/** Posts per facility. */
export const JOBS = { farm: 4, power: 2, sawmill: 3, quarry: 3, lumber: 4, mine: 4, oil: 2, refinery: 3, foodworks: 3, raremine: 4, furnace: 3, works: 3, station: 1, warehouse: 2, fuelpump: 1, charger: 1, depot: 4, guard: 1, radio: 1, dronepad: 1, commute: 0 };
/** Facilities that need their whole crew to run at all (a share of a crew does nothing). */
const WHOLE = new Set(['works', 'station', 'warehouse', 'fuelpump', 'charger', 'depot', 'guard', 'radio', 'dronepad']);
/** (0.215, the owner's rule: everything needs power and people) The settlement's services: storekeepers, a pump attendant, a charging hand, the depot's drivers and mechanic. Manned after the works and stations, except the warehouse (after the power plant). */
const SERVICES: Project[] = ['fuelpump', 'charger', 'depot'];
export type PostKind = keyof typeof JOBS;
export interface Post {
  /** 'farm:i', 'power', 'quarry', ..., 'works:i' (index in `TownState.plants`), 'station:i', (0.221) 'guard:i' (wall turret i), (0.220) 'commute:<outpost id>'. */
  id: string; kind: PostKind; i: number; jobs: number;
  /** Workers on it. */
  got: number;
  /** How well it works: got / jobs, or 0 / 1 for the facilities that need a whole crew. */
  fill: number;
}
const YARDS: Project[] = ['power', 'warehouse', 'sawmill', 'foodworks', 'quarry', 'lumber', 'mine', 'oil', 'refinery', 'raremine', 'furnace'];

/** The settlement's posts in the order they are manned. Established villages have none (their old staffing rule applies). */
export function postsOf(s: TownState | undefined): Omit<Post, 'got' | 'fill'>[] {
  if (!progressive(s)) return [];
  const out: Omit<Post, 'got' | 'fill'>[] = [];
  for (let i = 0; i < (s?.farms ?? 0); i++) out.push({ id: 'farm:' + i, kind: 'farm', i, jobs: JOBS.farm });
  for (const k of YARDS) if (projectDone(s, k)) out.push({ id: k, kind: k as PostKind, i: 0, jobs: JOBS[k as PostKind] });
  (s?.plants ?? []).forEach((_, i) => out.push({ id: 'works:' + i, kind: 'works', i, jobs: JOBS.works }));
  (s?.stations ?? []).forEach((_, i) => out.push({ id: 'station:' + i, kind: 'station', i, jobs: JOBS.station }));
  for (const k of SERVICES) if (projectDone(s, k)) out.push({ id: k, kind: k as PostKind, i: 0, jobs: JOBS[k as PostKind] });
  if (s?.mast) out.push({ id: 'radio', kind: 'radio', i: 0, jobs: JOBS.radio }); // (0.251, stage M3) the radio operator
  if (s?.dpad) out.push({ id: 'dronepad', kind: 'dronepad', i: 0, jobs: JOBS.dronepad }); // (0.254, stage F1) the pad's hand
  // (0.221, stage Z7) a guard at every wall turret: one turret that has its man fires, one without stands
  for (let i = 0; i < (s?.works?.turret ?? 0); i++) out.push({ id: 'guard:' + i, kind: 'guard', i, jobs: JOBS.guard });
  // (0.220, stage Z6) last of all: the people asked to walk out to nearby outposts (gen/commute.ts), as many as are free
  for (const id of Object.keys(s?.commute ?? {}).sort()) { const n = Math.floor(s!.commute![id] ?? 0); if (n > 0) out.push({ id: 'commute:' + id, kind: 'commute', i: 0, jobs: n }); }
  return out;
}
/** Hands everyone `workers` to the posts in order. */
export function assign(s: TownState | undefined, workers: number): { posts: Post[]; used: number; free: number; jobs: number } {
  let left = Math.max(0, Math.floor(workers)), used = 0, jobs = 0;
  const posts = postsOf(s).map((p) => {
    jobs += p.jobs;
    // a whole-crew facility takes no one unless its whole crew is there
    const got = WHOLE.has(p.kind) ? (left >= p.jobs ? p.jobs : 0) : Math.min(p.jobs, left);
    left -= got; used += got;
    return { ...p, got, fill: got / p.jobs };
  });
  return { posts, used, free: left, jobs };
}
/** How well post `id` works with `workers` in the village (1 for anything that is not a settlement's post). */
export function fillOf(s: TownState | undefined, workers: number, id: string): number {
  if (!progressive(s)) return 1;
  return assign(s, workers).posts.find((p) => p.id === id)?.fill ?? 1;
}
