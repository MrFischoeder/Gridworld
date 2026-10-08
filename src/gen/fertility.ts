// (0.182, PLAN_PLACOWEK.md stage O1) How fertile the land is: every spot on the planet has a fertility of 0.4 .. 1.8
// (a farm there will grow that many times its plain yield; stage O4). Flat, low land by the rivers is the richest; the
// mountains, the coast's sand and salt, the cold towards the ice and steep ground are poor. Broad patches come from
// slow noise, so the land falls into farming belts and barren tracts, and food has to travel between them.
// Pure and deterministic from the world seed; read by the map's fertility layer (ui/worldmap.ts) and later the farms.
import { fbm } from '../core/noise';
import { hash } from '../core/rng';
import { WORLD_W, POLAR_Z } from './regions';
import { naturalHeight } from './heights';
import { mountainMask } from './mountains';
import { seaMask } from './seas';
import { nearRiver } from './rivers';

export const FERTILITY = { min: 0.4, max: 1.8, scale: 2600, river: [180, 600] as [number, number], coast: 450, cold: 16000 };
const wrap = (s: number): [number, number] => { const n = Math.round(WORLD_W / s); return [WORLD_W / n, n]; };
let sc: [number, number] | null = null;
const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** The fertility at (x, z): 0.4 (barren) .. 1.8 (the richest bottom land); 0 on the sea and the ice. */
export function fertility(world: number, x: number, z: number): number {
  if (Math.abs(z) > POLAR_Z || seaMask(world, x, z) > 0) return 0;
  const [s, p] = (sc ??= wrap(FERTILITY.scale));
  const n = fbm(hash(world, 0xfe71), x / s, z / s, 3, p); // the broad belts
  const h = naturalHeight(world, x, z), low = clamp((45 - h) / 40);
  const slope = Math.abs(naturalHeight(world, x + 12, z) - h) + Math.abs(naturalHeight(world, x, z + 12) - h); // m over 12 m
  const wet = nearRiver(world, x, z, FERTILITY.river[0]) ? 1 : nearRiver(world, x, z, FERTILITY.river[1]) ? 0.5 : 0;
  const coast = [0, 1.57, 3.14, 4.71].some((a) => seaMask(world, x + Math.cos(a) * FERTILITY.coast, z + Math.sin(a) * FERTILITY.coast) > 0) ? 1 : 0;
  const cold = clamp((Math.abs(z) - FERTILITY.cold) / (POLAR_Z - FERTILITY.cold));
  const v = -0.2 + 1.05 * n + 0.22 * low + 0.25 * wet - 1.2 * mountainMask(world, x, z) - 0.2 * coast - 0.5 * cold - 0.05 * Math.max(0, slope - 1.5);
  return Math.round((FERTILITY.min + (FERTILITY.max - FERTILITY.min) * clamp(v)) * 100) / 100;
}
/** In words, for the map and the hint at a spot. */
export const fertilityWord = (f: number) => (f <= 0 ? 'no soil' : f < 0.7 ? 'barren' : f < 1 ? 'poor' : f < 1.3 ? 'fair' : f < 1.55 ? 'rich' : 'very rich');
/** Map colour of a fertility (rust for barren .. bright green for rich). */
export function fertilityColor(f: number): [number, number, number] {
  const t = clamp((f - FERTILITY.min) / (FERTILITY.max - FERTILITY.min));
  return [Math.round(150 * (1 - t) + 40 * t), Math.round(70 + 170 * t), Math.round(30 + 40 * t)];
}
