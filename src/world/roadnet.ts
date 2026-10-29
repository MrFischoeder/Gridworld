// (0.283, PLAN_DROG.md stage D4) The road network as the windows ask it (gen/roadnet.ts): the way by road between two
// places, its words, and the rule that flying machines wait for roads to the works.
import { G } from '../game';
import { findRoad, roadToWorks, type RoadWay } from '../gen/roadnet';
import { townsWorld } from '../gen/worldrules';
import { tl, TL } from '../i18n';

/** The quickest way by road between two places (a village `v:<id>`, an outpost's id), or null. */
export const roadBetween = (from: string, to: string, fx: number): RoadWay | null => findRoad(G.char.world, G.char.proads, G.char.time, from, to, fx);
/** "12.4 km by road (the X–Y road, the track A – B)". */
export function wayWords(w: RoadWay): string {
  const via = w.via.slice(0, 3).join(', ') + (w.via.length > 3 ? '…' : '');
  return TL`${w.km} km by road (${via})`;
}
/** Why place `id` cannot build flying machines yet ('' = it can): in a towns world, only once a road joins it to an
 *  outpost, a quarry, a well, a port or an old plant's camp. Machines built before stay. */
export function airRoadWhy(id: string): string {
  const c = G.char;
  if (!townsWorld(c.world)) return '';
  if (roadToWorks(c.world, c.proads, c.time, id, c.outposts)) return '';
  return tl('No road joins this warehouse to the works yet: build a track to an outpost, a quarry, a well or an old plant first (the Surveyor\'s Poles). Flying comes after the roads.');
}
