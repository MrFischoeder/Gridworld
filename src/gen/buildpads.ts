// Ground under a village's buildings (pure). Since 0.181 (the owner's rule) nothing round a village is levelled in
// advance: the land stays as it came until something is being built there. A site that stands or is going up gets a
// gentle pad: its own mean natural height, keeping `soft` of the land's relief (the sharp edges go, the ground is
// not made table-flat) and easing back over a wide `blend`, so the terrain never breaks into cliffs.
import { villageSeed, type Poi, type Rect } from './regions';
import type { Pad } from './terrain';
import type { TownState } from './town';
import { powerSite } from './town';
import { industrySite, industryOf, siteBuilt, type Industry } from './industry';
import { plantSite, PLANT_SLOTS, isStation } from './plants';
import { stationSite, STATION_SLOTS } from './energy';
import { HALL } from './hall';
import { progressive, projectDone, type Project } from './settlement';
import { jobOf } from './construction';
import { naturalHeight } from './heights';

const box = (s: { x: number; z: number; w: number; d: number }): Rect => ({ x0: s.x - s.w / 2, x1: s.x + s.w / 2, z0: s.z - s.d / 2, z1: s.z + s.d / 2 });
/** A settlement project that stands or is going up (materials handed over, or its builders at work). */
export const projectBegun = (s: TownState | undefined, k: Project) =>
  projectDone(s, k) || !!jobOf(s, 'project', k) || Object.values(s?.settlement?.given?.[k] ?? {}).some((n) => (n ?? 0) > 0);
/**
 * Plaza-local rects of the village's building sites that stand or are going up: the power plant, the industry site
 * (an old village's), the works and station plots in use and the old villages' hall. The progressive settlements'
 * yards are levelled by the world (world/overworld.ts) the same way, once begun.
 */
export function buildSites(seed: number, k: Industry, s?: TownState): Rect[] {
  const prog = progressive(s), out: Rect[] = [];
  if (!prog || projectBegun(s, 'power')) out.push(box(powerSite(seed)));
  if (!prog && siteBuilt(k, s)) out.push(box(industrySite(seed, k)));
  const pb = s?.pbuild, works = (s?.plants?.length ?? 0) + (pb && !isStation(pb.k) ? 1 : 0), stations = (s?.stations?.length ?? 0) + (pb && isStation(pb.k) ? 1 : 0);
  for (let i = 0; i < Math.min(works, PLANT_SLOTS); i++) out.push(box(plantSite(seed, k, i)));
  for (let i = 0; i < Math.min(stations, STATION_SLOTS); i++) out.push(box(stationSite(seed, k, i)));
  if (!prog) out.push({ x0: HALL.x0, x1: HALL.x1, z0: HALL.z0, z1: HALL.z1 });
  return out;
}
/** How far round a site the ground is eased (m), how wide the easing back is, and the share of the land's relief kept. */
export const SITE_PAD = { flat: 2, blend: 16, soft: 0.3 };
/** The mean natural height over a world rect (sampled every 4 m). */
const means = new Map<string, number>();
export function meanGround(world: number, r: Rect): number {
  const key = `${world}:${r.x0}:${r.z0}:${r.x1}:${r.z1}`, got = means.get(key);
  if (got !== undefined) return got;
  if (means.size > 4000) means.clear();
  const m = meanOf(world, r); means.set(key, m); return m;
}
function meanOf(world: number, r: Rect): number {
  let sum = 0, n = 0;
  for (let x = r.x0; x <= r.x1 + 1e-6; x += Math.max(1, (r.x1 - r.x0) / 6)) for (let z = r.z0; z <= r.z1 + 1e-6; z += Math.max(1, (r.z1 - r.z0) / 6)) { sum += naturalHeight(world, x, z); n++; }
  return n ? sum / n : naturalHeight(world, (r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2);
}
/** The terrain pads of village v's building sites in use (with its shared state s). */
export function sitePads(world: number, v: Poi, s: TownState | undefined): Pad[] {
  const ox = v.x - 36, oz = v.z - 36, seed = villageSeed(world, v);
  return buildSites(seed, industryOf(world, v, seed), s).map((r, i) => {
    const rect = { x0: ox + r.x0, x1: ox + r.x1, z0: oz + r.z0, z1: oz + r.z1 };
    return { y: meanGround(world, rect), surface: true, soft: SITE_PAD.soft, poi: { ...v, id: -v.id * 64 - 32 - i, rect, flat: SITE_PAD.flat, blend: SITE_PAD.blend } };
  });
}
