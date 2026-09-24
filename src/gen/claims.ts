// Land claims: a player raises a Flagpole and the land around it becomes theirs, a base site. The ground under
// the flag is levelled to one height (`flat` radius), then blends back to the natural slope (`blend`), and the
// trees, rocks and plants on it are cleared. The claim itself reaches further (`r`): later only its owner will
// open the doors and take things apart there without explosives. Pure: claims are player changes (saved in
// char.claims), and the terrain takes them as input like places and roads.
import { wrapDx, POLAR_Z, villageDist, poisNear } from './regions';
import { nearestOnRoad } from './roads';
import type { Terrain } from './terrain';

export interface Claim { x: number; z: number; y: number }
/** Claimed radius, levelled radius, blend back to the natural ground (m). */
export const CLAIM = { r: 30, flat: 12, blend: 12 };
/** Everything within this radius stands on changed ground: trees, rocks and plants there are cleared. */
export const CLEAR_R = CLAIM.flat + CLAIM.blend;
/** A site this far out of level is too steep to flatten (the pad would be a pit or a mound). */
const MAX_CUT = 5;

const rectD = (r: { x0: number; z0: number; x1: number; z1: number }, x: number, z: number) => Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.z0 - z, 0, z - r.z1));
const smooth = (t: number) => t * t * (3 - 2 * t);
/** Ground height h at (x, z) after the claim has levelled it. */
export function claimFlatten(c: Claim, x: number, z: number, h: number): number {
  const d = Math.hypot(wrapDx(x - c.x), z - c.z);
  if (d <= CLAIM.flat) return c.y;
  if (d < CLEAR_R) return h + (c.y - h) * (1 - smooth((d - CLAIM.flat) / CLAIM.blend));
  return h;
}
export const claimDist = (c: Claim, x: number, z: number) => Math.hypot(wrapDx(x - c.x), z - c.z);

/** The height a flag raised at (x, z) would level its ground to: the mean of the natural ground, to 0.5 m. */
export function padHeight(t: Terrain, x: number, z: number): number {
  let s = 0, n = 0;
  for (let u = -CLAIM.flat; u <= CLAIM.flat; u += 3) for (let v = -CLAIM.flat; v <= CLAIM.flat; v += 3) {
    if (Math.hypot(u, v) > CLAIM.flat) continue;
    s += t.heightAt(x + u, z + v); n++;
  }
  return Math.round(s / n * 2) / 2;
}

/** Why a flag cannot be raised at (x, z), or null when it can. `others` are the claims already standing. */
export function claimProblem(t: Terrain, x: number, z: number, others: Claim[]): string | null {
  if (Math.abs(z) > POLAR_Z - 500) return 'The ice is no place for a base.';
  if (villageDist(t.world, x, z) < 150) return 'Too close to a village.';
  for (const c of others) if (claimDist(c, x, z) < 2 * CLAIM.r) return 'Too close to your other claim.';
  const reach = CLEAR_R + 4, f = t.featuresIn({ x0: x - reach, z0: z - reach, x1: x + reach, z1: z + reach });
  const place = poisNear(t.world, x, z, CLEAR_R + 120).find((p) => rectD(p.rect, x, z) < CLEAR_R + p.flat + p.blend);
  if (place) return 'Too close to ' + place.name + '.';
  if (f.roads.some((r) => nearestOnRoad(r, x, z)[0] < CLEAR_R + r.half + 6)) return 'Too close to a road.';
  for (let u = -reach; u <= reach; u += 4) for (let v = -reach; v <= reach; v += 4) {
    if (Math.hypot(u, v) <= reach && t.water(x + u, z + v)) return 'Too close to the water.';
  }
  const y = padHeight(t, x, z);
  for (let a = 0; a < 6.28; a += 0.5) for (const d of [0, CLAIM.flat * 0.5, CLAIM.flat]) {
    if (Math.abs(t.heightAt(x + Math.cos(a) * d, z + Math.sin(a) * d) - y) > MAX_CUT) return 'The ground here is too steep to level.';
  }
  return null;
}
