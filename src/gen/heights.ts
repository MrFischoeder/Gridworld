// The natural lie of the land, before anything is flattened or carved into it: gentle hills in 0..25 m (rougher in
// some regions), the mountains (gen/mountains.ts), the sea bed under the seas (gen/seas.ts), towards the poles an
// ice sheet and then the ice wall. Pure; `Terrain.base` is this, and gen/rivers.ts reads it to lay out the rivers
// (so it lives apart from gen/terrain.ts, which carves the rivers in: no import loop).
import { fbm } from '../core/noise';
import { hash } from '../core/rng';
import { regionClimate, REGION, WORLD_W, POLAR_Z, POLE_Z } from './regions';
import { mountainMask, mountainLift } from './mountains';
import { seaMask, seaSink, isleHeight } from './seas';

const smooth = (t: number) => t * t * (3 - 2 * t);
/**
 * Noise scale s adjusted so a whole number of lattice cells fits round the planet: returns [scale, cells].
 * The adjustment is tiny (e.g. 170 m -> 169.94 m), so the land near Gridholm is practically unchanged.
 */
const wrapScale = (s: number): [number, number] => { const n = Math.round(WORLD_W / s); return [WORLD_W / n, n]; };
let SC: { S170: number; P170: number; S48: number; P48: number; S60: number; P60: number } | null = null;
/** Computed on first use: gen/regions.ts (WORLD_W) and the modules round it import each other. */
const sc = () => { if (!SC) { const [S170, P170] = wrapScale(170), [S48, P48] = wrapScale(48), [S60, P60] = wrapScale(60); SC = { S170, P170, S48, P48, S60, P60 }; } return SC; };
/** Ice sheet height and the ice wall at the poles. */
const ICE_Y = 16, WALL_H = 70;
const seeds = new Map<number, [number, number]>();
const seedsOf = (world: number) => { let s = seeds.get(world); if (!s) seeds.set(world, s = [hash(world, 0x7e11) * 7919, hash(world, 0x7e12) * 7919]); return s; };

/** Region roughness, blended smoothly between region centres so there are no seams. */
function rough(world: number, x: number, z: number): number {
  const fx = x / REGION, fz = z / REGION, x0 = Math.floor(fx), z0 = Math.floor(fz), tx = smooth(fx - x0), tz = smooth(fz - z0);
  const v = (rx: number, rz: number) => regionClimate(world, rx, rz).rough;
  const a = v(x0, z0), b = v(x0 + 1, z0), c = v(x0, z0 + 1), d = v(x0 + 1, z0 + 1);
  return a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz;
}
/** Height of the natural land at (x, z). */
export function naturalHeight(world: number, x: number, z: number): number {
  const { S170, P170, S48, P48, S60, P60 } = sc(), [s1, s2] = seedsOf(world), amp = 0.55 + 0.8 * rough(world, x, z);
  const raw = 12.5 + amp * (46 * (fbm(s1, x / S170, z / 170, 4, P170) - 0.5) + 8 * (fbm(s2, x / S48, z / 48, 3, P48) - 0.5));
  let h = 12.5 + 12.5 * Math.tanh((raw - 12.5) / 12.5);
  h += mountainLift(world, x, z, mountainMask(world, x, z));
  const m = seaMask(world, x, z);
  h = seaSink(h, m); // the seas: the land goes down under the water
  if (m > 0.3) h = Math.max(h, isleHeight(world, x, z)); // islands out in the open sea
  const az = Math.abs(z);
  if (az > POLAR_Z) {
    const ice = ICE_Y + 3 * (fbm(s2 + 5, x / S60, z / 60, 2, P60) - 0.5);
    h += (ice - h) * smooth(Math.min(1, (az - POLAR_Z) / 2500));
    if (az > POLE_Z - 120) h += WALL_H * smooth(Math.min(1, (az - (POLE_Z - 120)) / 70)); // a sheer cliff of ice
  }
  return h;
}
