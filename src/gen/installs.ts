// The great installations of the old world (pure, deterministic from the world seed): huge ruined plants standing in
// fixed places far out on the continent, which the player can one day bring back to life (the uranium enrichment
// plant first; the chip foundry, the radar station and the rocket fuel complex will follow the same pattern). Each
// lies in its own distance band from Gridholm on dry, fairly level ground away from villages, places, roads, lakes and
// the mountains. The ground round it is bare: trees, rocks and plants inside `inInstall` are not generated.
import { hash } from '../core/rng';
import { CHUNK, worldDist } from './regions';
import { nearestOnRoad } from './roads';
import { mountainMask } from './mountains';
import { rectDist, type Terrain } from './terrain';

export type InstallKind = 'uranium';
export interface InstallSpec { k: InstallKind; name: string; blurb: string; band: [number, number]; r: number }
export const INSTALLS: InstallSpec[] = [
  { k: 'uranium', name: 'Old Enrichment Plant', blurb: 'a ruined plant of the old world where ore was once made into reactor fuel: a centrifuge hall, two cooling towers and a stack', band: [15000, 25000], r: 34 },
];
export interface InstallSite { k: InstallKind; name: string; x: number; z: number; y: number; yaw: number; r: number }

/** Why a spot does not fit (null: it does). */
export function installMisfit(t: Terrain, x: number, z: number, r: number): string | null {
  const y0 = t.heightAt(x, z);
  if (mountainMask(t.world, x, z) > 0.12) return 'mountain';
  for (let a = 0; a < 6.28; a += 0.785) for (const d of [0, r * 0.5, r]) {
    const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
    if (t.water(px, pz)) return 'water';
    if (Math.abs(t.heightAt(px, pz) - y0) > 4) return 'slope';
    const f = t.chunkFeatures(Math.floor(px / CHUNK), Math.floor(pz / CHUNK));
    if (f.lakes.some((l) => Math.hypot(l.x - px, l.z - pz) < 70)) return 'lake';
    if (f.pads.some((p) => rectDist(p.poi.rect, px, pz) < p.poi.flat + 60)) return 'place';
    if (f.roads.some((rd) => nearestOnRoad(rd, px, pz)[0] < rd.half + 25)) return 'road';
  }
  return null;
}

const cache = new Map<number, InstallSite[]>();
/** Every installation of a world: for each, the first of a hashed list of spots in its band that fits (the first spot if none does). */
export function installSites(t: Terrain): InstallSite[] {
  const hit = cache.get(t.world); if (hit) return hit;
  const out: InstallSite[] = [];
  cache.set(t.world, out); // (filled below; set first so a nested call during the search sees no sites rather than recursing)
  INSTALLS.forEach((spec, i) => {
    let best: InstallSite | null = null;
    for (let k = 0; k < 120; k++) {
      const a = (hash(t.world, i, k, 0x1e57) % 3600) / 3600 * Math.PI * 2, [d0, d1] = spec.band;
      const d = d0 + (hash(t.world, i, k, 0x1e58) % 1000) / 1000 * (d1 - d0), x = Math.cos(a) * d, z = Math.sin(a) * d;
      const c: InstallSite = { k: spec.k, name: spec.name, x, z, y: t.heightAt(x, z), yaw: (hash(t.world, i, k, 0x1e59) % 4) * Math.PI / 2, r: spec.r };
      if (!best) best = c;
      if (!installMisfit(t, x, z, spec.r)) { best = c; break; }
    }
    out.push(best!);
  });
  return out;
}
/** Is (x, z) on the bare ground of an installation (within its radius plus m)? */
export function inInstall(t: Terrain, x: number, z: number, m = 0): boolean {
  if (Math.hypot(x, z) < 12000) return false; // all of them lie far out: a cheap early out near home
  for (const s of installSites(t)) if (worldDist(s.x, s.z, x, z) < s.r + m) return true;
  return false;
}
export const installAt = (t: Terrain, x: number, z: number, m = 0) => installSites(t).find((s) => worldDist(s.x, s.z, x, z) < s.r + m) ?? null;
