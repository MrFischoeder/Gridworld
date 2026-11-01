// The natural lie of the land, before anything is flattened or carved into it: gentle hills in 0..25 m (rougher in
// some regions), the mountains (gen/mountains.ts), the sea bed under the seas (gen/seas.ts), towards the poles an
// ice sheet and then the polar mountains. Pure; `Terrain.base` is this, and gen/rivers.ts reads it to lay out the rivers
// (so it lives apart from gen/terrain.ts, which carves the rivers in: no import loop).
import { fbm } from '../core/noise';
import { hash } from '../core/rng';
import { regionClimate, REGION, WORLD_W, POLAR_Z, POLE_Z } from './regions';
import { mountainMask, mountainLift } from './mountains';
import { seaMask, seaSink, isleHeight, SEA } from './seas';
import { customWorld, fileHeight, customMountainMask } from './customworld';
import { shapeLand } from './biomeshape';
import { shapedWorld } from './worldrules';

const smooth = (t: number) => t * t * (3 - 2 * t);
/**
 * Noise scale s adjusted so a whole number of lattice cells fits round the planet: returns [scale, cells].
 * The adjustment is tiny (e.g. 170 m -> 169.94 m), so the land near Gridholm is practically unchanged.
 */
const wrapScale = (s: number): [number, number] => { const n = Math.round(WORLD_W / s); return [WORLD_W / n, n]; };
let SC: { S170: number; P170: number; S48: number; P48: number; S60: number; P60: number; S120: number; P120: number; S380: number; P380: number; S1100: number; P1100: number; S2600: number; P2600: number } | null = null;
/** Computed on first use: gen/regions.ts (WORLD_W) and the modules round it import each other. */
const sc = () => {
  if (!SC) {
    const [S170, P170] = wrapScale(170), [S48, P48] = wrapScale(48), [S60, P60] = wrapScale(60), [S120, P120] = wrapScale(120), [S380, P380] = wrapScale(380), [S1100, P1100] = wrapScale(1100), [S2600, P2600] = wrapScale(2600);
    SC = { S170, P170, S48, P48, S60, P60, S120, P120, S380, P380, S1100, P1100, S2600, P2600 };
  }
  return SC;
};
/** Ice sheet height at the poles. */
const ICE_Y = 16;
/**
 * (0.288, the owner's report: the ice wall looked like a wall, not mountains) The polar range: from a ragged front
 * `band` × 0.6..1.2 short of the pole's edge the ice rises into ridged peaks and saddles, `top` m at their highest
 * (× 0.3..1.2 along the range: massifs and saddles), and over its last `edge` m it climbs a further `floor` m, so the end of the world is a mountain
 * range seen from afar, not a cliff.
 */
export const POLAR_RANGE = { band: 2800, top: 240, floor: 95, edge: 500 };
const seeds = new Map<number, [number, number]>();
const seedsOf = (world: number) => { let s = seeds.get(world); if (!s) seeds.set(world, s = [hash(world, 0x7e11) * 7919, hash(world, 0x7e12) * 7919]); return s; };

/** (0.288) Could the polar range stand at this z (the far silhouettes look for it there)? */
export const nearPolarRange = (z: number) => Math.abs(z) > POLE_Z - POLAR_RANGE.band * 1.25;
/** (0.288) How much the polar range lifts the ice at (x, z) (0 short of its front). */
function polarRange(x: number, z: number, s2: number): number {
  const { S120, P120, S380, P380, S1100, P1100, S2600, P2600 } = sc(), side = z < 0 ? 11 : 17, d = POLE_Z - Math.abs(z);
  const stretch = (v: number) => Math.max(0, Math.min(1, (v - 0.3) / 0.4)); // fbm keeps near 0.5: spread it over 0..1
  const front = POLAR_RANGE.band * (0.6 + 0.6 * stretch(fbm(s2 + side, x / S2600, side, 2, P2600)));
  if (d >= front) return 0;
  const t = smooth(Math.min(1, (front - d) / front)); // 0 at the front, 1 at the edge
  const ridge = 1 - Math.abs(2 * fbm(s2 + side + 1, x / S380, z / 380, 4, P380) - 1); // sharp ridge lines
  const peak = 0.3 + 0.9 * stretch(fbm(s2 + side + 2, x / S1100, z / 1100, 2, P1100)); // high massifs and low saddles
  const crag = 1 - Math.abs(2 * fbm(s2 + side + 3, x / S120, z / 120, 2, P120) - 1); // crags on the ridges
  const lift = POLAR_RANGE.top * peak * t * (0.3 + 0.55 * ridge * ridge * ridge + 0.15 * crag * ridge);
  const edge = Math.min(1, Math.max(0, 1 - d / POLAR_RANGE.edge)); // the last stretch never sinks under the floor
  return lift + POLAR_RANGE.floor * smooth(edge) * (0.8 + 0.4 * ridge); // the last stretch climbs on: no pass at the edge
}
/** Region roughness, blended smoothly between region centres so there are no seams. */
function rough(world: number, x: number, z: number): number {
  const fx = x / REGION, fz = z / REGION, x0 = Math.floor(fx), z0 = Math.floor(fz), tx = smooth(fx - x0), tz = smooth(fz - z0);
  const v = (rx: number, rz: number) => regionClimate(world, rx, rz).rough;
  const a = v(x0, z0), b = v(x0 + 1, z0), c = v(x0, z0 + 1), d = v(x0 + 1, z0 + 1);
  return a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz;
}
/** Height of the natural land at (x, z): the base land, then (new worlds) shaped by its biome (gen/biomeshape.ts). */
export function naturalHeight(world: number, x: number, z: number): number {
  const h = baseHeight(world, x, z);
  return shapedWorld(world) && Math.abs(z) < POLAR_Z ? shapeLand(world, x, z, h) : h;
}
/** The land before the biomes shape it (the climate and the biomes read this). */
export function baseHeight(world: number, x: number, z: number): number {
  const { S170, P170, S48, P48 } = sc(), [s1, s2] = seedsOf(world), amp = 0.55 + 0.8 * rough(world, x, z);
  const raw = 12.5 + amp * (46 * (fbm(s1, x / S170, z / 170, 4, P170) - 0.5) + 8 * (fbm(s2, x / S48, z / 48, 3, P48) - 0.5));
  let h = 12.5 + 12.5 * Math.tanh((raw - 12.5) / 12.5);
  const cw = customWorld(world);
  if (cw) {
    // (0.208) a world drawn in the editor: its heights, the seed's hills laid lightly over the land (none on the coast)
    // and its ridges over what was drawn high
    const f = fileHeight(cw, x, z), m = customMountainMask(cw, x, z);
    h = SEA.level + f;
    if (f > 1) h = Math.max(SEA.level + 0.4, h + (raw - 12.5) * 0.4 * smooth(Math.min(1, (f - 1) / 10)) * (1 - m) + 0.3 * mountainLift(world, x, z, m));
    return ice(x, z, h, s2);
  }
  h += mountainLift(world, x, z, mountainMask(world, x, z));
  const m = seaMask(world, x, z);
  h = seaSink(h, m); // the seas: the land goes down under the water
  if (m > 0.3) h = Math.max(h, isleHeight(world, x, z)); // islands out in the open sea
  return ice(x, z, h, s2);
}
/** Towards the poles the ice sheet, then the polar mountains. */
function ice(x: number, z: number, h: number, s2: number): number {
  const { S60, P60 } = sc(), az = Math.abs(z);
  if (az > POLAR_Z) {
    const sheet = ICE_Y + 3 * (fbm(s2 + 5, x / S60, z / 60, 2, P60) - 0.5);
    h += (sheet - h) * smooth(Math.min(1, (az - POLAR_Z) / 2500));
    if (az > POLE_Z - POLAR_RANGE.band * 1.25) h += polarRange(x, z, s2);
  }
  return h;
}
