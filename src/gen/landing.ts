// Where the hero's ship came down (pure, deterministic from the world seed): a spot a few hundred metres out of
// Gridholm on open, gentle, dry ground, clear of places, roads, trees and big rocks, so the wreck and the furrow it
// ploughed lie in the open. The ship cleared its own scar: trees, rocks and plants inside `inScar` are not generated
// (gen/trees.ts, gen/flora.ts). Every new character starts there.
import { hash } from '../core/rng';
import { CHUNK } from './regions';
import { nearestOnRoad } from './roads';
import { rectDist, type Terrain } from './terrain';

export interface Landing {
  /** The ship's middle, the ground height there, and its heading (the nose points along (sin, cos) of `yaw`). */
  x: number; z: number; y: number; yaw: number;
}
/** How far from Gridholm the ship may lie (m), how long the furrow behind it is. */
export const LANDING = { near: 260, far: 430, furrow: 46 };

/** Why a candidate does not fit (null: it does): the ship and its furrow must lie on dry, gentle ground away from places and roads. */
export function misfit(t: Terrain, x: number, z: number, yaw: number): string | null {
  const fx = Math.sin(yaw), fz = Math.cos(yaw), y0 = t.heightAt(x, z);
  // the hull (+-9 m), the wing span, and the furrow ploughed behind it
  const pts: [number, number][] = [];
  for (let a = -LANDING.furrow; a <= 10; a += 4) for (const s of [-7, 0, 7]) pts.push([x + fx * a + fz * s, z + fz * a - fx * s]);
  for (const [px, pz] of pts) {
    if (t.water(px, pz)) return 'water';
    const f = t.chunkFeatures(Math.floor(px / CHUNK), Math.floor(pz / CHUNK));
    if (f.lakes.some((l) => Math.hypot(l.x - px, l.z - pz) < 60)) return 'lake';
    if (f.pads.some((p) => rectDist(p.poi.rect, px, pz) < p.poi.flat + 45)) return 'place';
    if (f.roads.some((r) => nearestOnRoad(r, px, pz)[0] < r.half + 18)) return 'road';
  }
  // gentle ground under the hull
  for (const [dx, dz] of [[-6, -6], [6, -6], [-6, 6], [6, 6], [0, 10], [0, -10]]) if (Math.abs(t.heightAt(x + dx, z + dz) - y0) > 1.8) return 'slope';
  return null;
}

const cache = new Map<number, Landing>();
/** The crash site of a world: the first of a hashed list of candidates that fits (the first candidate if none does). */
export function landingSite(t: Terrain): Landing {
  const hit = cache.get(t.world); if (hit) return hit;
  let best: Landing | null = null;
  for (let k = 0; k < 160; k++) {
    const a = (hash(t.world, k, 0x1a4d) % 3600) / 3600 * Math.PI * 2, r = LANDING.near + (hash(t.world, k, 0x1a4e) % 1000) / 1000 * (LANDING.far - LANDING.near);
    const x = Math.cos(a) * r, z = Math.sin(a) * r; // round Gridholm (at the origin)
    const yaw = (hash(t.world, k, 0x1a4f) % 3600) / 3600 * Math.PI * 2;
    const c = { x, z, y: t.heightAt(x, z), yaw };
    if (!best) best = c;
    if (!misfit(t, x, z, yaw)) { best = c; break; }
  }
  cache.set(t.world, best!);
  return best!;
}

/** Inside the scar the ship tore: a capsule from the furrow's start to just past the nose, `m` metres wide either side (6 m more by the ship). */
export function inScar(t: Terrain, x: number, z: number, m = 9): boolean {
  if (Math.abs(x) > LANDING.far + 80 || Math.abs(z) > LANDING.far + 80) return false;
  const s = landingSite(t), fx = Math.sin(s.yaw), fz = Math.cos(s.yaw), dx = x - s.x, dz = z - s.z;
  const a = Math.max(-LANDING.furrow, Math.min(11, dx * fx + dz * fz)), px = s.x + fx * a, pz = s.z + fz * a;
  return Math.hypot(x - px, z - pz) < m + (a > -14 ? 6 : 0); // a wider clearing round the ship itself
}
