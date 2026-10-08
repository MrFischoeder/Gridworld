// (0.184, PLAN_PLACOWEK.md stage O3) Power with a reach, no cables: a power source built at an outpost (a diesel
// generator, a wind turbine, solar panels, a coal boiler) powers everything within its radius, and sources whose
// circles touch (or that cover the same outpost) form one grid. A grid shares its power out: every extraction on it
// draws its kW, and when the grid makes less than they draw all of them get the same share. An outpost works at
// `GRID.unpowered` without power and at full rate with all it needs; between, in proportion.
//
// Pure and deterministic from the shared `outposts` and the game time: the share is the mean over the last day,
// sampled on whole two-hour marks, so it changes only every two hours and every game agrees.
import { hash } from '../core/rng';
import { daylight, sunTilt } from '../core/time';
import { latitude, worldDist } from './regions';
import { windAt } from './energy';
import type { ItemKey } from '../data/items';
import { digOf, settle, type OutpostState, type DigKind } from './outposts';
import type { Lode } from './lodes';

export type PowerKind = 'generator' | 'wind' | 'solar' | 'coal';
export interface PowerSpec {
  name: string; text: string;
  needs: [ItemKey, number][];
  /** Reach (m), output (kW at full wind / sun / fuel). */
  r: number; kw: number;
  /** What it burns, minutes a crate, how many crates its bunker holds. */
  fuel?: ItemKey; burn?: number; bunker?: number;
}
export const POWER_SRC: Record<PowerKind, PowerSpec> = {
  generator: { name: 'Diesel generator', text: 'A generator set in a steel box: steady power while it has fuel.', needs: [['scrap', 16], ['parts', 2], ['wire', 6], ['planks', 8]], r: 350, kw: 40, fuel: 'fuel', burn: 180, bunker: 20 },
  wind: { name: 'Wind turbine', text: 'A lattice mast with three blades: free power, as much as the wind gives.', needs: [['planks', 20], ['scrap', 10], ['wire', 8], ['gears', 2]], r: 500, kw: 60 },
  solar: { name: 'Solar panels', text: 'Rows of old panels on frames: power by day, none at night.', needs: [['glass', 6], ['wire', 8], ['scrap', 6], ['circuit', 2]], r: 250, kw: 45 },
  coal: { name: 'Coal boiler', text: 'A brick boiler house with a stack, burning coal: strong, steady power with a long reach.', needs: [['stone', 20], ['scrap', 20], ['pipes', 4], ['parts', 2]], r: 700, kw: 90, fuel: 'coal', burn: 120, bunker: 20 },
};
export const POWER_KINDS = Object.keys(POWER_SRC) as PowerKind[];
/** What each extraction draws (kW). */
export const DIG_KW: Record<DigKind, number> = { quarry: 8, logging: 6, mine: 12, pump: 10, shaft: 25 };
export const GRID = { unpowered: 0.5, step: 120, samples: 12, hours: 12 };

/** Crates of fuel in a source's bunker at `now` (it burns while it has any). */
export function fuelLeft(o: OutpostState, now: number): number {
  const s = o.pk ? POWER_SRC[o.pk] : null;
  if (!s?.burn || !o.fuel) return 0;
  return Math.max(0, o.fuel.n - Math.max(0, now - o.fuel.t) / s.burn);
}
/** Load up to `n` crates into the bunker; how many went in. */
export function loadFuel(o: OutpostState, n: number, now: number): number {
  const s = o.pk ? POWER_SRC[o.pk] : null;
  if (!s?.burn || !o.done?.power) return 0;
  const left = fuelLeft(o, now), m = Math.max(0, Math.min(n, Math.floor((s.bunker ?? 0) - left)));
  if (m) o.fuel = { n: left + m, t: now };
  return m;
}
/** A source's output at time t (kW). */
export function supplyAt(world: number, id: string, o: OutpostState, t: number): number {
  if (!o.done?.power || !o.pk) return 0;
  const s = POWER_SRC[o.pk];
  if (o.pk === 'wind') return s.kw * windAt(hash(world, id.length, o.x | 0, o.z | 0), t);
  if (o.pk === 'solar') return s.kw * daylight(t, sunTilt(latitude(o.z)));
  return fuelLeft(o, t) > 0 ? s.kw : 0;
}
export const demandOf = (o: OutpostState) => (o.done?.dig ? DIG_KW[digOf(o.k)] : 0);
const isSource = (o: OutpostState) => !!(o.done?.power && o.pk);
export const reachOf = (o: OutpostState) => (o.pk ? POWER_SRC[o.pk].r : 0);

/** The grids: each outpost id → its grid number (only outposts a source reaches; the others are off-grid). */
export function grids(outposts: Record<string, OutpostState>): Map<string, number> {
  const ids = Object.keys(outposts).filter((id) => outposts[id]?.k), src = ids.filter((id) => isSource(outposts[id]));
  const up = new Map<string, string>(src.map((s) => [s, s]));
  const find = (a: string): string => { while (up.get(a) !== a) { const p = up.get(up.get(a)!)!; up.set(a, p); a = p; } return a; };
  const join = (a: string, b: string) => { const x = find(a), y = find(b); if (x !== y) up.set(x < y ? y : x, x < y ? x : y); };
  const d = (a: OutpostState, b: OutpostState) => worldDist(a.x, a.z, b.x, b.z);
  for (let i = 0; i < src.length; i++) for (let j = i + 1; j < src.length; j++) { const a = outposts[src[i]], b = outposts[src[j]]; if (d(a, b) <= reachOf(a) + reachOf(b)) join(src[i], src[j]); }
  const out = new Map<string, number>(), num = new Map<string, number>();
  for (const id of ids) {
    const o = outposts[id], by = src.filter((s) => d(outposts[s], o) <= reachOf(outposts[s]));
    if (!by.length) continue;
    for (const s of by.slice(1)) join(by[0], s); // an outpost two sources reach ties their grids together
  }
  for (const id of ids) {
    const o = outposts[id], s = src.find((q) => d(outposts[q], o) <= reachOf(outposts[q]));
    if (!s) continue;
    const root = find(s);
    if (!num.has(root)) num.set(root, num.size);
    out.set(id, num.get(root)!);
  }
  return out;
}
/** Each grid's supply and demand at time t, and the share of its demand it meets (1 with no demand). */
export function gridState(world: number, outposts: Record<string, OutpostState>, g: Map<string, number>, t: number) {
  const supply: number[] = [], demand: number[] = [];
  for (const [id, n] of g) { const o = outposts[id]; supply[n] = (supply[n] ?? 0) + supplyAt(world, id, o, t); demand[n] = (demand[n] ?? 0) + demandOf(o); }
  return { supply, demand, share: supply.map((s, n) => (demand[n] ? Math.min(1, (s ?? 0) / demand[n]) : 1)) };
}
/** The outpost's share of power, the mean over the last day on whole two-hour marks (0 off the grid). */
export function powerShare(world: number, outposts: Record<string, OutpostState>, id: string, now: number): number {
  const g = grids(outposts), n = g.get(id);
  if (n === undefined) return 0;
  const t0 = Math.floor(now / GRID.step) * GRID.step;
  let sum = 0;
  for (let i = 0; i < GRID.samples; i++) sum += gridState(world, outposts, g, t0 - i * GRID.step).share[n] ?? 0;
  return sum / GRID.samples;
}
/** What the share does to the outpost's digging: `unpowered` with none, full rate with all it needs. */
export const powerFactor = (share: number) => GRID.unpowered + (1 - GRID.unpowered) * share;
/** Bring every working outpost's stock forward at its present factor (before the grid changes, and every two hours). */
export function settleAll(world: number, outposts: Record<string, OutpostState>, lodeOf: (id: string) => Lode | null, now: number) {
  for (const [id, o] of Object.entries(outposts)) {
    if (!o?.done?.dig) continue;
    const l = lodeOf(id);
    if (l) settle(o, l, now, powerFactor(powerShare(world, outposts, id, now)));
  }
}
/** The factor an outpost digs at now (1 for one that does not dig yet). */
export const pwOf = (world: number, outposts: Record<string, OutpostState>, id: string, now: number) =>
  outposts[id]?.done?.dig ? powerFactor(powerShare(world, outposts, id, now)) : 1;
