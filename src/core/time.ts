// Game clock. Time is counted in game minutes since the world began; one real second is one game minute,
// so a full day takes 24 real minutes. Pure (no three.js): the sky, the board and later the server read it.

import { tl } from '../i18n';
export const DAY = 1440;
/** Game minutes that pass in one real second. */
export const MIN_PER_SEC = 1;
/** A new character starts on day 1 at 08:00. */
export const START_TIME = 8 * 60;

export interface Clock { day: number; h: number; m: number }
export function clockOf(t: number): Clock {
  const d = Math.floor(t / DAY), r = t - d * DAY;
  return { day: d + 1, h: Math.floor(r / 60), m: Math.floor(r % 60) };
}
const pad = (n: number) => (n < 10 ? '0' : '') + n;
export const fmtTime = (t: number) => { const c = clockOf(t); return pad(c.h) + ':' + pad(c.m); };
export const fmtClock = (t: number) => tl('Day ') + clockOf(t).day + ', ' + fmtTime(t);

/** Angle of the sun around the sky: 0 at 06:00 (rising in the east), PI/2 at noon, PI at 18:00 (setting in the west). */
export const sunAngle = (t: number) => ((t % DAY + DAY) % DAY - 360) / DAY * Math.PI * 2;
/**
 * Sun elevation, -1 (midnight) .. 1 (noon), for a sun path tilted by `tilt` radians from the zenith
 * (0 on the equator; the further towards a pole, the lower the sun stays: see sunTilt).
 */
export const sunHeight = (t: number, tilt = 0) => Math.sin(sunAngle(t)) * Math.cos(tilt);
/** Tilt of the sun's path at a latitude (radians): a little even on the equator, the full latitude towards the poles. */
export const sunTilt = (lat: number) => (lat < 0 ? -1 : 1) * Math.max(0.45, Math.abs(lat));
const smooth = (a: number, b: number, x: number) => { const k = Math.max(0, Math.min(1, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
/** How much daylight there is, 0 (night) .. 1 (full day), with dawn and dusk around sunrise and sunset. */
export const daylight = (t: number, tilt = 0) => smooth(-0.12, 0.25, sunHeight(t, tilt));
/** Dawn / dusk glow, 0..1: strongest while the sun sits on the horizon. */
export const twilight = (t: number, tilt = 0) => Math.exp(-(((sunHeight(t, tilt) + 0.02) / 0.12) ** 2));

/** The notice board posts new notices every BOARD_HOURS game hours; this numbers those postings. */
export const BOARD_HOURS = 6;
export const boardPeriod = (t: number) => Math.floor(t / (BOARD_HOURS * 60));
/** Game time of the next posting. */
export const nextPosting = (t: number) => (boardPeriod(t) + 1) * BOARD_HOURS * 60;

/** The orbital station crosses the sky in about two real minutes and circles in `STATION.period` game minutes
 *  (1 real second = 1 game minute), far quicker than the sun or the moon, against their direction. Its plane is
 *  tilted by `incl` and turned by `node` round the vertical. Angle 0 = at the plane's x end. */
export const STATION = { period: 240, incl: 0.95, node: 0.7, phase: 1.1 };
export const stationAngle = (t: number) => STATION.phase - (t / STATION.period) * Math.PI * 2;
/** Unit direction of the station from the viewer at game time t (x east, y up, z south). */
export function stationDir(t: number): [number, number, number] {
  const a = stationAngle(t), c = Math.cos(a), s = Math.sin(a), ci = Math.cos(STATION.incl), si = Math.sin(STATION.incl);
  const x = c, y = s * ci, z = s * si, n = Math.cos(STATION.node), m = Math.sin(STATION.node);
  return [x * n + z * m, y, -x * m + z * n];
}
