// Level ground under a village's building sites (pure). Every works, power station, plant and store round a village
// stands on a flat pad, so a building fits wherever it is put up; the terrain takes them as settlement pads.
import { villageSeed, type Poi, type Rect } from './regions';
import type { Pad } from './terrain';
import { powerSite } from './town';
import { industrySite, industryOf, type Industry } from './industry';
import { plantSite, PLANT_SLOTS } from './plants';
import { stationSite, STATION_SLOTS } from './energy';
import { HALL } from './hall';

/** Plaza-local rects of the building sites round every village: its power plant, its industry site, both works plots,
 *  both station plots and the village hall. The same for every player (from the village's seed and industry). */
export function buildSites(seed: number, k: Industry): Rect[] {
  const box = (s: { x: number; z: number; w: number; d: number }): Rect => ({ x0: s.x - s.w / 2, x1: s.x + s.w / 2, z0: s.z - s.d / 2, z1: s.z + s.d / 2 });
  const out: Rect[] = [box(powerSite(seed)), box(industrySite(seed, k))];
  for (let i = 0; i < PLANT_SLOTS; i++) out.push(box(plantSite(seed, k, i)));
  for (let i = 0; i < STATION_SLOTS; i++) out.push(box(stationSite(seed, k, i)));
  out.push({ x0: HALL.x0, x1: HALL.x1, z0: HALL.z0, z1: HALL.z1 });
  return out;
}
/** How far round a site the ground lies level (m) and how far it then eases back into the land. */
export const SITE_PAD = { flat: 2, blend: 10 };
/** The terrain pads of village v's building sites, level at the village's height y. */
export function sitePads(world: number, v: Poi, y: number): Pad[] {
  const ox = v.x - 36, oz = v.z - 36, seed = villageSeed(world, v);
  return buildSites(seed, industryOf(world, v, seed)).map((r, i) => ({ y, surface: true,
    poi: { ...v, id: -v.id * 64 - 32 - i, rect: { x0: ox + r.x0, x1: ox + r.x1, z0: oz + r.z0, z1: oz + r.z1 }, flat: SITE_PAD.flat, blend: SITE_PAD.blend } }));
}
