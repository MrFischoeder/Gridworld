// Electricity. Every village has its own small plant (gen/town.ts POWER: a diesel generator, a solar array or wind
// turbines) and it only just keeps the village's lamps and homes going. The works (gen/plants.ts) draw far more, and
// a works without power stands still. So power stations come first: you commission them from the elder like works
// (materials and a fee; `STATION_SLOTS` per village) and run them: a solar farm makes power by day only, a wind farm
// as the wind blows, a coal power station and a diesel generator bank as long as their bunkers hold coal or fuel,
// which they burn at a steady rate while switched on.
//
// The balance is pure and follows the game time: what the village's plant and its stations make at time t, what the
// village itself takes, and which works that leaves power for (in the order they were built).
import { hash, type Dir } from '../core/rng';
import { daylight, sunTilt } from '../core/time';
import { latitude, type Poi } from './regions';
import { powerKind, powerCondition, powerSite, lastFix, POWER_DOWN, type TownState } from './town';
import { industrySite, type Industry } from './industry';
import { raidHurt } from './raids';
import type { Good } from './market';
import type { ItemKey } from '../data/items';
import { running, type PlantState } from './plants';

export type StationKind = 'solarfarm' | 'windfarm' | 'coalplant' | 'dieselbank';
export const STATION_KINDS: StationKind[] = ['solarfarm', 'windfarm', 'coalplant', 'dieselbank'];
export interface StationSpec {
  name: string; blurb: string;
  /** Rated output (kW), and what it burns: a crate of `fuel` every `burn` game minutes while it runs. */
  kw: number; fuel?: Good; burn?: number;
  needs: [ItemKey, number][]; fee: number; xp: number;
}
export const STATIONS: Record<StationKind, StationSpec> = {
  solarfarm: { name: 'Solar Farm', blurb: 'rows of panels: power by day, none at night', kw: 70, needs: [['scrap', 12], ['wire', 12], ['circuit', 6], ['planks', 10]], fee: 500, xp: 120 },
  windfarm: { name: 'Wind Farm', blurb: 'three turbines: power as the wind blows', kw: 80, needs: [['scrap', 20], ['wire', 10], ['planks', 20], ['engine', 1]], fee: 650, xp: 140 },
  coalplant: { name: 'Coal Power Station', blurb: 'a boiler and a turbine: steady power while it has coal', kw: 140, fuel: 'coal', burn: 120, needs: [['stone', 40], ['scrap', 20], ['planks', 16], ['engine', 1]], fee: 900, xp: 200 },
  dieselbank: { name: 'Diesel Generator Bank', blurb: 'four big generators: steady power while it has fuel', kw: 110, fuel: 'fuel', burn: 150, needs: [['scrap', 16], ['engine', 2], ['wire', 6]], fee: 800, xp: 180 },
};
/** Stations per village; the most crates a bunker holds. */
export const STATION_SLOTS = 2, BUNKER = 30;
/** What the village's own plant makes at full condition (kW), and what the village itself takes. */
export const BASE_KW: Record<ReturnType<typeof powerKind>, number> = { generator: 40, solar: 34, wind: 36 };
export const VILLAGE_KW = 25;
/** What each works draws while it works (kW). */
export const DRAW: Record<PlantState['k'], number> = { smelter: 60, refinery: 50, glassworks: 45, wiremill: 30, electronics: 35, machineshop: 40, foundry: 80, chemworks: 40 };

export interface StationState {
  k: StationKind; on: boolean;
  /** Crates in the bunker at time `t` (it burns down from there while on). */
  fuel: number; t: number;
}

// ---------- weather ----------
/** The wind at a village, 0..1, changing smoothly from hour to hour (pure: the same for everyone). */
export function windAt(seed: number, t: number): number {
  const h = t / 60, i = Math.floor(h), f = h - i, s = f * f * (3 - 2 * f);
  const at = (k: number) => (hash(seed, k, 0x3171d) % 1000) / 1000;
  return 0.15 + 0.85 * (at(i) * (1 - s) + at(i + 1) * s);
}
const sunAt = (v: Poi, t: number) => daylight(t, sunTilt(latitude(v.z)));

// ---------- stations ----------
/** Crates left in a station's bunker at time t. */
export function fuelAt(st: StationState, t: number): number {
  const spec = STATIONS[st.k];
  if (!spec.fuel || !st.on) return st.fuel;
  return Math.max(0, st.fuel - Math.max(0, t - st.t) / spec.burn!);
}
/** What a station makes at time t (kW). */
export function stationKw(v: Poi, seed: number, st: StationState, t: number): number {
  const spec = STATIONS[st.k];
  if (!st.on) return 0;
  if (st.k === 'solarfarm') return spec.kw * sunAt(v, t);
  if (st.k === 'windfarm') return spec.kw * windAt(seed ^ 0x77, t);
  return fuelAt(st, t) > 0 ? spec.kw : 0;
}
/** Load n crates into a station's bunker (settling what burnt so far); returns how many went in. */
export function loadBunker(st: StationState, n: number, now: number): number {
  const left = fuelAt(st, now), k = Math.max(0, Math.min(n, Math.floor(BUNKER - left)));
  st.fuel = left + k; st.t = now;
  return k;
}
export function switchStation(st: StationState, on: boolean, now: number) { st.fuel = fuelAt(st, now); st.t = now; st.on = on; }

// ---------- the balance ----------
/** What the village's own plant makes at time t (nothing once it is down). */
export function baseKw(world: number, v: Poi, seed: number, s: TownState | undefined, t: number): number {
  const kind = powerKind(seed), c = powerCondition(seed, s, t, raidHurt(world, v, s, lastFix(seed, s), t));
  if (c < POWER_DOWN) return 0;
  const k = kind === 'solar' ? sunAt(v, t) * 1.3 : kind === 'wind' ? 0.4 + windAt(seed, t) * 0.8 : 1;
  return BASE_KW[kind] * Math.min(1, k) * (0.5 + 0.5 * c / 100);
}
export interface Balance { made: number; village: number; free: number; draw: number; powered: boolean[] }
/**
 * The village's power at time t: made (its plant and stations), taken by the village, and which works get power: in
 * the order they were built, each that has work to do takes its draw while enough is left.
 */
export function balance(world: number, v: Poi, seed: number, s: TownState | undefined, t: number): Balance {
  const made = baseKw(world, v, seed, s, t) + (s?.stations ?? []).reduce((a, st) => a + stationKw(v, seed, st, t), 0);
  let free = Math.max(0, made - VILLAGE_KW), draw = 0;
  const powered = (s?.plants ?? []).map((p) => {
    if (!running(p)) return false;
    const d = DRAW[p.k];
    draw += d;
    if (free >= d) { free -= d; return true; }
    return false;
  });
  return { made, village: Math.min(made, VILLAGE_KW), free, draw, powered };
}
/** Is works i of the village powered at time t? (For gen/plants.ts runPlant.) */
export const poweredAt = (world: number, v: Poi, seed: number, s: TownState | undefined, i: number) => (t: number) => balance(world, v, seed, s, t).powered[i] ?? false;

/**
 * Where station i stands, in plaza-local metres: at the far end of the power plant's side (0), or of the industry
 * site's side (1), 11 m + half its depth out.
 */
export function stationSite(seed: number, k: Industry, i: number): { x: number; z: number; w: number; d: number; side: Dir; face: [number, number] } {
  const base = i === 0 ? powerSite(seed) : industrySite(seed, k), side = base.side;
  const was = side === 'S' ? base.x : base.z, along = was < 36 ? 57 : 15, w = 16, d = 12, off = 11 + d / 2;
  if (side === 'W') return { x: -off, z: along, w: d, d: w, side, face: [-1, 0] };
  if (side === 'E') return { x: 72 + off, z: along, w: d, d: w, side, face: [1, 0] };
  return { x: along, z: 72 + off, w, d, side, face: [0, 1] };
}
