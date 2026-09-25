// Weather: clear skies, overcast, rain, fog and thunderstorms. Pure and deterministic: the same world, place and game
// time give the same weather for everyone (the future server needs nothing more than the seed and the clock).
//
// The planet is cut into `WEATHER.cell` cells; every cell rolls its weather for each `WEATHER.slot` of game time, and
// the numbers (cloud, rain, fog, storm, wind) blend across the four nearest cell centres and fade from one slot into
// the next over `WEATHER.fade`, so fronts drift in rather than switching. For now the weather only changes how the
// world looks (world/weather.ts, world/sky.ts); `weatherAt` is the hook for its later effects: lightning strikes,
// storms tearing roofs off, rain slowing the roads, clouds dimming solar farms.
import { hash } from '../core/rng';
import { POLAR_Z } from './regions';

export type WeatherKind = 'clear' | 'overcast' | 'rain' | 'fog' | 'storm';
export interface Weather {
  /** The kind that rules here now (the strongest in the blend). */
  kind: WeatherKind;
  /** 0..1 each: cloud cover, rain, fog, thunderstorm (lightning), wind. */
  cloud: number; rain: number; fog: number; storm: number; wind: number;
  /** Where the wind blows to (radians, 0 = +x). */
  windDir: number;
}
export const WEATHER = { cell: 3000, slot: 240, fade: 45 };
/** How often each kind comes up, and what it means. Fog likes the early morning. */
const KINDS: { k: WeatherKind; w: number; cloud: number; rain: number; fog: number; storm: number; wind: number }[] = [
  { k: 'clear', w: 40, cloud: 0.08, rain: 0, fog: 0, storm: 0, wind: 0.25 },
  { k: 'overcast', w: 20, cloud: 0.75, rain: 0, fog: 0.1, storm: 0, wind: 0.4 },
  { k: 'rain', w: 18, cloud: 0.9, rain: 0.6, fog: 0.2, storm: 0, wind: 0.55 },
  { k: 'fog', w: 12, cloud: 0.45, rain: 0, fog: 0.9, storm: 0, wind: 0.08 },
  { k: 'storm', w: 10, cloud: 1, rain: 1, fog: 0.25, storm: 1, wind: 1 },
];
/** The weather a cell rolled for slot n (the time `n * slot`). */
function rolled(world: number, cx: number, cz: number, n: number) {
  const hourOf = ((n * WEATHER.slot) / 60) % 24, morning = hourOf >= 3 && hourOf < 10;
  const weights = KINDS.map((k) => k.w * (k.k === 'fog' ? (morning ? 2.2 : 0.6) : 1));
  let r = (hash(world, cx, cz, n, 0x3ea7) % 10000) / 10000 * weights.reduce((a, b) => a + b, 0);
  let i = 0;
  while (i < KINDS.length - 1 && (r -= weights[i]) > 0) i++;
  return KINDS[i];
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** The weather at world point (x, z) at game time t. */
export function weatherAt(world: number, x: number, z: number, t: number): Weather {
  const C = WEATHER.cell, fx = x / C - 0.5, fz = z / C - 0.5, x0 = Math.floor(fx), z0 = Math.floor(fz), ax = fx - x0, az = fz - z0;
  const n = Math.floor(t / WEATHER.slot), into = t - n * WEATHER.slot, fade = Math.min(1, into / WEATHER.fade), f = fade * fade * (3 - 2 * fade);
  const acc = { cloud: 0, rain: 0, fog: 0, storm: 0, wind: 0 }, score: Partial<Record<WeatherKind, number>> = {};
  for (const [dx, dz, w] of [[0, 0, (1 - ax) * (1 - az)], [1, 0, ax * (1 - az)], [0, 1, (1 - ax) * az], [1, 1, ax * az]] as [number, number, number][]) {
    const now = rolled(world, x0 + dx, z0 + dz, n), prev = rolled(world, x0 + dx, z0 + dz, n - 1);
    for (const key of ['cloud', 'rain', 'fog', 'storm', 'wind'] as const) acc[key] += w * lerp(prev[key], now[key], f);
    score[now.k] = (score[now.k] ?? 0) + w * f; score[prev.k] = (score[prev.k] ?? 0) + w * (1 - f);
  }
  // near the poles it is colder, clearer and windier: no thunder over the ice
  const polar = Math.min(1, Math.max(0, (Math.abs(z) - POLAR_Z * 0.8) / (POLAR_Z * 0.2)));
  acc.storm *= 1 - polar; acc.wind = Math.min(1, acc.wind + polar * 0.4);
  const kind = (Object.entries(score) as [WeatherKind, number][]).sort((a, b) => b[1] - a[1])[0][0];
  const windDir = (hash(world, Math.floor(t / (WEATHER.slot * 3)), 0x3ea9) % 6283) / 1000;
  return { kind, ...acc, windDir };
}
export const WEATHER_NAME: Record<WeatherKind, string> = { clear: 'Clear', overcast: 'Overcast', rain: 'Rain', fog: 'Fog', storm: 'Thunderstorm' };
