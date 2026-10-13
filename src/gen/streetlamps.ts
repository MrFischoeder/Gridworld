// (0.203, the owner's direction) Street lamps the heroes build for a village, one at a time: each lamp is a kit from
// the blacksmith, put up where you want it in or round the village. Two kinds: an electric lamp (it needs the village's
// power plant standing and draws a little power at night, nothing to tend) and an oil lamp (no power needed, but its
// tank has to be filled with Lamp Oil or a fuel canister; it burns only by night). Pure: the lamps live in the shared
// `TownState.lamps` (village-relative x, z = metres from the village's middle), and an oil lamp's tank is an anchor
// {oil, t}: what is left now is worked out in closed form from the night hours since `t`, the same on every game.
import type { TownState } from './town';

export type StreetKind = 'electric' | 'oil';
export interface StreetLamp { k: StreetKind; x: number; z: number; oil?: number; t?: number }
/**
 * `reach` how far from the village's middle a lamp may stand (m), `apart` the least distance between lamps, `max`
 * lamps a village; `kw` an electric lamp's draw at night; `cap` an oil lamp's tank (game minutes of burning), what a
 * flask of Lamp Oil and a fuel canister put in; `h` the lamp's height, `r` / `ro` the light's reach (electric / oil).
 */
export const STREET = { reach: 110, apart: 4, max: 30, kw: 0.5, cap: 2400, flask: 360, can: 1440, h: 3.6, r: 16, ro: 12 };
/** Night for the street lamps: from 20:00 to 06:00. */
export const isNight = (t: number) => { const m = ((t % 1440) + 1440) % 1440; return m < 360 || m >= 1200; };
/** Night minutes from 0 to t. */
const nightTo = (t: number) => { const d = Math.floor(t / 1440), m = t - d * 1440; return d * 600 + Math.min(m, 360) + Math.max(0, m - 1200); };
/** Night minutes in [a, b). */
export const nightBetween = (a: number, b: number) => (b <= a ? 0 : nightTo(b) - nightTo(a));
/** The oil left in a lamp's tank now (game minutes of burning). */
export const oilLeft = (l: StreetLamp, now: number) => (l.k !== 'oil' ? 0 : Math.max(0, (l.oil ?? 0) - nightBetween(l.t ?? now, now)));
/** Pour `add` minutes of oil into the lamp (up to the tank); returns what went in. */
export function fillLamp(l: StreetLamp, now: number, add: number): number {
  const had = oilLeft(l, now), put = Math.max(0, Math.min(add, STREET.cap - had));
  l.oil = had + put; l.t = now;
  return put;
}
/** Whether a lamp burns now: by night, an oil lamp with oil left, an electric one while the village has power. */
export const lampLit = (l: StreetLamp, now: number, power: boolean) => isNight(now) && (l.k === 'oil' ? oilLeft(l, now) > 0 : power);
/** What the village's electric street lamps draw now (kW; gen/energy.ts adds it to the village's own needs). */
export const streetKw = (s: TownState | undefined, now: number) => (isNight(now) ? (s?.lamps ?? []).filter((l) => l.k === 'electric').length * STREET.kw : 0);
/** Why a lamp cannot stand at (x, z) (village-relative), or ''. */
export function lampProblem(s: TownState | undefined, x: number, z: number): string {
  if (Math.hypot(x, z) > STREET.reach) return 'too far';
  if ((s?.lamps ?? []).length >= STREET.max) return 'full';
  if ((s?.lamps ?? []).some((l) => Math.hypot(l.x - x, l.z - z) < STREET.apart)) return 'close';
  return '';
}
