// (0.234, PLAN_BIOMOW.md stage B4a) Temperature and clothing. Every biome has its own day and night air (°C), blended
// across the biomes' cells and between night and day by the daylight; height, rain, storms, clouds and the wind's
// chill take some off. What you feel adds your clothes (warm ones against the cold, airy ones against the heat), a
// fire or a torch, and a roof or walls over you; your body follows what you feel slowly (`balance`, −100 freezing ..
// 100 overheating). The owner's rule: cold and heat only weaken (more calories or water, slower stamina, a slower
// step), they never take health. Pure; world/bodyheat.ts runs it.
import { BIOME_CELL, biomeCell, type BiomeHere } from './biomes';
import { SEA } from './seas';
import type { ItemKey } from '../data/items';

/** The air over each biome by day and by night (°C). */
export const BIOME_TEMP: Record<BiomeHere, [day: number, night: number]> = {
  plains: [18, 8], forest: [16, 8], taiga: [2, -10], tundra: [-8, -22], desert: [40, 6], savanna: [32, 18],
  swamp: [24, 16], jungle: [31, 23], mountain: [8, -4], coast: [20, 12], crystal: [14, 0], sea: [15, 10], ice: [-20, -32],
};
export const TEMP = {
  /** °C less per metre above the sea. */
  lapse: 0.006,
  /** Weather: rain and a storm cool the air, clouds take the edge off the sun; below `chillBelow` °C the wind bites. */
  rain: 4, storm: 6, cloud: 3, chill: 6, chillBelow: 10,
  /** Under the ground the air hardly changes. */
  under: { dungeon: 12, cave: 8 },
  /** What the body takes in its stride (felt °C). */
  comfort: [10, 28] as [number, number],
  /** Felt °C beyond the comfort band that take the body to the end of its scale: cold, heat. */
  span: { cold: 30, heat: 15 },
  /** How fast the body follows what it feels (s to get ~63% of the way). */
  tau: 90,
  /** A fire warms within `r` m (up to `add` °C at its side); a torch in your hand, an oil lamp. */
  fire: { r: 6, add: 15 }, torch: 3, lamp: 1,
  /** A roof and walls pull the air towards `room` °C: inside a house, inside a village's wall, in a closed cab. */
  room: 18, house: 0.85, village: 0.5, cab: 0.8,
  /** Swimming: the water is colder than the air and soaks your clothes. */
  swim: 4, soaked: 0.3,
};

/** What each piece of clothing does: `warm` °C against the cold, `cool` °C against the heat. */
export const CLOTH_TEMP: Partial<Record<ItemKey, { warm?: number; cool?: number }>> = {
  hideCap: { warm: 2 }, hideCoat: { warm: 4 }, hideGloves: { warm: 1 }, hideLegs: { warm: 2 }, hideBoots: { warm: 1 },
  wovenHood: { warm: 1, cool: 1 }, wovenJacket: { warm: 1, cool: 1 }, wovenGloves: { warm: 1, cool: 1 }, wovenLegs: { warm: 1, cool: 1 }, wovenBoots: { warm: 1, cool: 1 },
  compHelm: { warm: 1 }, compVest: { warm: 1 }, compGloves: { warm: 1 }, compLegs: { warm: 1 }, compBoots: { warm: 1 },
  helmet: { warm: 1 }, vest: { warm: 1 }, armour: { warm: 2 }, gloves: { warm: 1 }, trousers: { warm: 1 }, boots: { warm: 1 },
  furHood: { warm: 4 }, furCoat: { warm: 9 }, furMitts: { warm: 3 }, furTrousers: { warm: 4 }, furBoots: { warm: 3 },
  desertRobe: { warm: 1, cool: 8 }, shemagh: { cool: 4 },
};
/** The clothes' warmth and coolness added up. */
export function clothing(worn: (ItemKey | null | undefined)[]) {
  let warm = 0, cool = 0;
  for (const k of worn) { const c = k ? CLOTH_TEMP[k] : undefined; if (c) { warm += c.warm ?? 0; cool += c.cool ?? 0; } }
  return { warm, cool };
}

const smooth = (v: number) => { const t = v < 0 ? 0 : v > 1 ? 1 : v; return t * t * (3 - 2 * t); };
/** The biomes' air at (x, z) by day and by night, blended across the cells' borders. */
export function biomeAir(world: number, x: number, z: number): [number, number] {
  const u = x / BIOME_CELL - 0.5, v = z / BIOME_CELL - 0.5, i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
  const at = (a: number, b: number) => BIOME_TEMP[biomeCell(world, a, b)];
  const A = at(i, j), B = at(i + 1, j), C = at(i, j + 1), D = at(i + 1, j + 1);
  const mix = (n: 0 | 1) => (A[n] * (1 - fu) + B[n] * fu) * (1 - fv) + (C[n] * (1 - fu) + D[n] * fu) * fv;
  return [mix(0), mix(1)];
}
export interface Sky { day: number; rain?: number; storm?: number; cloud?: number; wind?: number }
/** The air (°C) at (x, z) on ground `h` m high, with the daylight 0..1 and the weather. */
export function airTemp(world: number, x: number, z: number, h: number, sky: Sky): number {
  const [d, n] = biomeAir(world, x, z);
  let t = n + (d - n) * sky.day - Math.max(0, h - SEA.level) * TEMP.lapse;
  t -= (sky.rain ?? 0) * TEMP.rain + (sky.storm ?? 0) * TEMP.storm + (sky.cloud ?? 0) * TEMP.cloud * sky.day;
  if (t < TEMP.chillBelow) t -= (sky.wind ?? 0) * TEMP.chill;
  return t;
}
export interface Feel {
  air: number; warm: number; cool: number;
  /** °C a fire, a torch or a lamp adds. */ heat?: number;
  /** 0..1: how much a roof pulls the air towards TEMP.room. */ shelter?: number;
  swimming?: boolean;
}
/** What the body feels (°C): the air, the clothes (warm ones count less in the heat, airy ones only there), a fire, a roof. */
export function feltTemp(f: Feel): number {
  const wet = f.swimming ? TEMP.soaked : 1, air = f.air - (f.swimming ? TEMP.swim : 0);
  const hot = smooth((air - 12) / 14); // 0 in the cold .. 1 in the heat
  let t = air + f.warm * wet * (1 - 0.5 * hot) - f.cool * wet * hot + (f.heat ?? 0);
  const s = f.shelter ?? 0;
  if (s > 0) t += (TEMP.room - t) * s;
  return t;
}
/** Where the body heads (−100 .. 100) at a felt temperature. */
export function bodyTarget(felt: number): number {
  const [lo, hi] = TEMP.comfort;
  if (felt < lo) return Math.max(-100, -(lo - felt) / TEMP.span.cold * 100);
  if (felt > hi) return Math.min(100, (felt - hi) / TEMP.span.heat * 100);
  return 0;
}
/** One step of the body's balance towards the target. */
export const stepBody = (b: number, target: number, dt: number) => b + (target - b) * (1 - Math.exp(-dt / TEMP.tau));

export type BodyState = 'freezing' | 'cold' | 'ok' | 'hot' | 'overheated';
export const BODY = { mild: 30, severe: 70 };
export const bodyState = (b: number): BodyState => (b <= -BODY.severe ? 'freezing' : b <= -BODY.mild ? 'cold' : b >= BODY.severe ? 'overheated' : b >= BODY.mild ? 'hot' : 'ok');
/**
 * What the balance does to you: calories burnt, water lost, stamina back, stamina spent, the step's speed (each a
 * multiplier, 1 = nothing). Eases in round the thresholds; never any health.
 */
export function bodyEffects(b: number) {
  const a = Math.abs(b), m = smooth((a - BODY.mild + 10) / 20), s = smooth((a - BODY.severe + 10) / 20);
  if (b < 0) return { kcal: 1 + 0.5 * m + 0.7 * s, water: 1, regen: 1 - 0.2 * m - 0.3 * s, effort: 1 + 0.2 * s, speed: 1 - 0.1 * s };
  return { kcal: 1, water: 1 + 0.7 * m + 0.9 * s, regen: 1 - 0.4 * s, effort: 1 + 0.25 * m + 0.35 * s, speed: 1 - 0.08 * s };
}
