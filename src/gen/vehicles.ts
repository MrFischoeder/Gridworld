// Where vehicles stand: the dealer's yard outside Gridholm, and abandoned vehicles out in the wilds.
import { rng, hash } from '../core/rng';
import { VEHICLES, freshParts, wheelCount, ENGINE_MODS, type VehicleModel, type VehicleParts } from '../data/vehicles';
import { REGION, CHUNK, poisNear } from './regions';
import { rectDist, type Terrain } from './terrain';
import { treeTrunks, chunkRocks } from './trees';

export interface Parking { id: string; model: VehicleModel; x: number; z: number; heading: number; parts: VehicleParts }

/**
 * The vehicle yard just outside the north gate of the starting village (world coordinates; the village is centred
 * on the origin). Heading Math.PI faces north, down the road. Bought vehicles take the first free bay.
 */
export const YARD = {
  dealer: { x: 5.5, z: -41.5 },
  sign: { x: 5.5, z: -40 },
  bays: [{ x: 10, z: -47 }, { x: 16, z: -47 }, { x: 22, z: -47 }, { x: -10, z: -47 }, { x: -16, z: -47 }],
  heading: Math.PI,
};

/** Vehicles a character had before vehicles were sold (kept in old saves). */
export function startingVehicles(): Parking[] {
  return [
    { id: 'scout-1', model: 'scout', x: 7, z: -45, heading: Math.PI, parts: freshParts('scout') },
    { id: 'mastodon-1', model: 'mastodon', x: -9, z: -46, heading: Math.PI, parts: freshParts('mastodon') },
  ];
}

/** Is this footprint clear of places, trees and rocks, and flat enough to park on? */
export function clearSpot(t: Terrain, model: VehicleModel, x: number, z: number, heading: number): boolean {
  const s = VEHICLES[model], fx = Math.sin(heading), fz = Math.cos(heading), hl = s.length / 2 + 1, r = Math.max(s.length, s.width) / 2 + 1.5;
  if (poisNear(t.world, x, z, 80).some((p) => rectDist(p.rect, x, z) < r + 2)) return false;
  if (Math.abs(t.heightAt(x + fx * hl, z + fz * hl) - t.heightAt(x - fx * hl, z - fz * hl)) > s.length * 0.25) return false;
  const cx0 = Math.floor((x - r) / CHUNK), cx1 = Math.floor((x + r) / CHUNK), cz0 = Math.floor((z - r) / CHUNK), cz1 = Math.floor((z + r) / CHUNK);
  for (let cx = cx0; cx <= cx1; cx++) for (let cz = cz0; cz <= cz1; cz++) {
    if (treeTrunks(t, cx, cz).some((tr) => Math.hypot(tr.x - x, tr.z - z) < r + 1)) return false;
    if (chunkRocks(t, cx, cz).some((k) => Math.hypot(k.x - x, k.z - z) < r + k.r)) return false;
  }
  return true;
}

/** An abandoned vehicle somewhere in region (rx, rz), or none. Deterministic from the world seed. */
export function regionVehicle(t: Terrain, rx: number, rz: number): Parking | null {
  if (rx === 0 && rz === 0) return null;
  const R = rng(hash(t.world, rx, rz, 0x7e41)), near = Math.abs(rx) <= 1 && Math.abs(rz) <= 1;
  if (R() > (near ? 0.5 : 0.3)) return null;
  const model: VehicleModel = R() < 0.75 ? 'scout' : 'mastodon';
  for (let i = 0; i < 8; i++) {
    const x = rx * REGION + (R() - 0.5) * 180, z = rz * REGION + (R() - 0.5) * 180, heading = R() * 6.283;
    if (!clearSpot(t, model, x, z, heading)) continue;
    // abandoned for a reason: worn or missing wheels and a tired engine, sometimes beyond driving
    const wheels = Array.from({ length: wheelCount(model) }, () => (R() < 0.22 ? -1 : 15 + Math.floor(R() * 70)));
    const engine = R() < 0.2 ? 0 : 10 + Math.floor(R() * 60);
    // rolled after the older fields so the wheels and engine of existing worlds stay the same
    const hull = Math.round(VEHICLES[model].hull * (0.2 + R() * 0.6)), fuel = Math.round(VEHICLES[model].tank * (0.1 + R() * 0.5));
    return { id: `found:${rx}:${rz}`, model, x, z, heading, parts: { wheels, engine, gun: false, hull, fuel, mods: Array(ENGINE_MODS).fill(null) } };
  }
  return null;
}
