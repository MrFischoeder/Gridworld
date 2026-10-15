// (0.220, PLAN_PRAD_I_LUDZIE.md stage Z6) Commuters: an outpost, a port or a crew camp near a settlement (within
// `COMMUTE.reach` of its middle) can ask the village for its free people to walk out to work there, without bunkhouses
// of their own. The ask is the village's (`TownState.commute[outpost id]` = the post's crew, written under the village's
// lock); the village's workforce (gen/workforce.ts) mans it last of all, with whoever is free once its own posts are
// filled. The commuters work the outpost's post first (the dig, a port's crane, an old plant); its own settlers do the rest
// and the fields. Further out the place needs its own people (bunkhouses and fields).
//
// Pure: from the shared `towns`, the village's people and the time; every game works it out the same.
import { allVillages, villageSeed, worldDist, GRIDHOLM_ID, type Poi } from './regions';
import { progressive } from './settlement';
import { assign } from './workforce';
import { workersAt } from './people';
import { workCap } from './outpostlife';
import type { OutpostState } from './outposts';
import type { TownState } from './town';

export const COMMUTE = { reach: 2000 };
/** The settlements within walking reach of the outpost, nearest first. */
export function commuteVillages(world: number, towns: Record<string, TownState>, o: OutpostState): { v: Poi; d: number }[] {
  return allVillages(world).filter((v) => progressive(towns[v.id])).map((v) => ({ v, d: worldDist(o.x, o.z, v.x, v.z) })).filter((q) => q.d <= COMMUTE.reach).sort((a, b) => a.d - b.d);
}
/** The village outpost `id` asked for commuters (its id), if any. */
export function commuteFrom(towns: Record<string, TownState>, id: string): number | null {
  for (const [vid, s] of Object.entries(towns)) if ((s?.commute?.[id] ?? 0) > 0) return +vid;
  return null;
}
/** Ask (or stop asking) village s for the outpost's post's crew. */
export function setCommute(s: TownState, id: string, o: OutpostState | null) {
  if (o && workCap(o) > 0) (s.commute ??= {})[id] = workCap(o);
  else if (s.commute) { delete s.commute[id]; if (!Object.keys(s.commute).length) delete s.commute; }
}
/** How many commuters reach outpost `id` at time t: the village's free workers on its post, and how many it asked for. */
export function commutersAt(world: number, towns: Record<string, TownState>, id: string, t: number): { got: number; want: number; v: number | null } {
  const vid = commuteFrom(towns, id);
  if (vid === null) return { got: 0, want: 0, v: null };
  const s = towns[vid], v = allVillages(world).find((q) => q.id === vid);
  if (!v || !progressive(s)) return { got: 0, want: s?.commute?.[id] ?? 0, v: vid };
  const p = assign(s, workersAt(villageSeed(world, v), v.id === GRIDHOLM_ID, s, t)).posts.find((q) => q.id === 'commute:' + id);
  return { got: p?.got ?? 0, want: s.commute![id], v: vid };
}
