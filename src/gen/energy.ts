import { WALL_LO, WALL_HI } from './village';
import { projectDone, progressive, sawLevel, SAW, DEEP, furnaceLevel, FURNACE } from './settlement';
// Electricity. Every village has its own small plant (gen/town.ts POWER: a diesel generator, a solar array or wind
// turbines) and it only just keeps the village's lamps and homes going. The works (gen/plants.ts) draw far more, and
// a works without power stands still. So power stations come first: you commission them from the elder like works
// (materials and a fee; `STATION_SLOTS` per village) and run them: a solar farm makes power by day only, a wind farm
// as the wind blows, a coal power station and a diesel generator bank as long as their bunkers hold coal or fuel,
// which they burn at a steady rate while switched on, and a small reactor (the plans for Uranium Enrichment, and fuel
// rods from the Old Enrichment Plant: gen/installs.ts) as long as its core holds rods.
//
// The balance is pure and follows the game time: what the village's plant and its stations make at time t, what the
// village itself takes, and which works that leaves power for (in the order they were built).
import { hash, type Dir } from '../core/rng';
import { daylight, sunTilt } from '../core/time';
import { latitude, GRIDHOLM_ID, type Poi } from './regions';
import { assign, type Post } from './workforce';
import { workersAt } from './people';
import { powerKind, powerCondition, powerSite, lastFix, POWER_DOWN, type TownState } from './town';
import { industrySite, industryOf, industryProject, siteBuilt, type Industry } from './industry';
import { raidHurt } from './raids';
import type { ItemKey } from '../data/items';
import { running, type PlantState } from './plants';
import { farmsKw } from './farms';
import { plantMult } from './plantup';
import { bankKw, villageKw, VILLAGE_BASE_KW } from './improve';
import { streetKw } from './streetlamps';
import { tl } from '../i18n';
import { RADIO } from './radiomast';

export type StationKind = 'solarfarm' | 'windfarm' | 'coalplant' | 'dieselbank' | 'reactor';
export const STATION_KINDS: StationKind[] = ['solarfarm', 'windfarm', 'coalplant', 'dieselbank', 'reactor'];
export interface StationSpec {
  name: string; blurb: string;
  /** Rated output (kW), and what it burns: a crate of `fuel` every `burn` game minutes while it runs (at most `bunker` loaded, else BUNKER). */
  kw: number; fuel?: ItemKey; burn?: number; bunker?: number;
  /** The technology whose plans it needs before it can be built. */
  tech?: string;
  needs: [ItemKey, number][]; fee: number; xp: number;
}
export const STATIONS: Record<StationKind, StationSpec> = {
  solarfarm: { name: tl('Solar Farm'), blurb: tl('rows of panels: power by day, none at night'), kw: 70, needs: [['scrap', 12], ['wire', 12], ['circuit', 6], ['planks', 10]], fee: 500, xp: 120 },
  windfarm: { name: tl('Wind Farm'), blurb: tl('three turbines: power as the wind blows'), kw: 80, needs: [['scrap', 20], ['wire', 10], ['planks', 20], ['engine', 1], ['gears', 2]], fee: 650, xp: 140 },
  coalplant: { name: tl('Coal Power Station'), blurb: tl('a boiler and a turbine: steady power while it has coal'), kw: 140, fuel: 'coal', burn: 120, needs: [['stone', 10], ['bricks', 20], ['cement', 8], ['scrap', 20], ['planks', 16], ['engine', 1], ['generator', 1], ['pump', 1], ['cutstone', 10]], fee: 900, xp: 200 },
  dieselbank: { name: tl('Diesel Generator Bank'), blurb: tl('four big generators: steady power while it has fuel'), kw: 110, fuel: 'fuel', burn: 150, needs: [['scrap', 16], ['engine', 2], ['wire', 6], ['generator', 2]], fee: 800, xp: 180 },
  reactor: { name: tl('Small Reactor'), blurb: tl('a sealed reactor under a concrete dome: a great deal of steady power while its core holds fuel rods'), kw: 250, fuel: 'nfuel', burn: 5760, bunker: 4, tech: 'enrichment', needs: [['steel', 12], ['alloy', 6], ['cable', 8], ['circuit', 10], ['pcore', 2], ['cement', 20], ['pcm', 2]], fee: 2000, xp: 500 },
};
/** Stations per village; the most crates a bunker holds. */
export const STATION_SLOTS = 2, BUNKER = 30;
/** What the village's own plant makes at full condition (kW), and what the village itself takes. */
export const BASE_KW: Record<ReturnType<typeof powerKind>, number> = { generator: 55, solar: 55, wind: 52 };
/** What the village takes before any improvement (gen/improve.ts villageKw: less with battery lamps). */
export const VILLAGE_KW = VILLAGE_BASE_KW;
/** What each works draws while it works (kW). */
export const DRAW: Record<PlantState['k'], number> = { smelter: 60, refinery: 50, glassworks: 45, wiremill: 30, electronics: 35, machineshop: 40, foundry: 80, chemworks: 40,
  sawmill: 15, brickworks: 25, cementworks: 35, textile: 15, steelworks: 70, polymer: 45, alworks: 120, batteryworks: 35, electrical: 50, stoneworks: 15, metallurgy: 140, siliconworks: 110, advelec: 90, avionworks: 70, lifeworks: 60, heavyworks: 100 };

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
/** The most a station's bunker (or core) holds. */
export const bunkerOf = (k: StationKind) => STATIONS[k].bunker ?? BUNKER;
/** What a station burns, in words: [one, many, short]. */
export function fuelWords(k: StationKind): [string, string, string] {
  const f = STATIONS[k].fuel;
  return f === 'coal' ? [tl('crate of coal'), tl('crates of coal'), 'coal'] : f === 'nfuel' ? [tl('crate of fuel rods'), tl('crates of fuel rods'), tl('fuel rods')] : [tl('canister of fuel'), tl('canisters of fuel'), 'fuel'];
}
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
  const left = fuelAt(st, now), k = Math.max(0, Math.min(n, Math.floor(bunkerOf(st.k) - left)));
  st.fuel = left + k; st.t = now;
  return k;
}
export function switchStation(st: StationState, on: boolean, now: number) { st.fuel = fuelAt(st, now); st.t = now; st.on = on; }

// ---------- the balance ----------
/** What the village's own plant makes at time t (nothing once it is down), times its upgrade level (gen/plantup.ts). */
export function baseKw(world: number, v: Poi, seed: number, s: TownState | undefined, t: number): number {
  const kind = powerKind(seed), c = powerCondition(seed, s, t, raidHurt(world, v, s, lastFix(seed, s), t));
  if (c < POWER_DOWN) return 0;
  const k = kind === 'solar' ? sunAt(v, t) * 1.3 : kind === 'wind' ? 0.4 + windAt(seed, t) * 0.8 : 1;
  return BASE_KW[kind] * Math.min(1, k) * (0.5 + 0.5 * c / 100) * plantMult(s) * crewFill(crew(seed, v, s, t), 'power');
}
/** A new settlement's posts at time t (gen/workforce.ts): who works the power plant, the stations and the works. */
function crew(seed: number, v: Poi, s: TownState | undefined, t: number): Post[] | null {
  return progressive(s) ? assign(s, workersAt(seed, v.id === GRIDHOLM_ID, s, t)).posts : null;
}
const crewFill = (posts: Post[] | null, id: string) => posts?.find((p) => p.id === id)?.fill ?? 1;
/**
 * What the village's industry site draws (kW): pumps, winches, saws, lamps. Small enough that a village's own plant in
 * good repair runs a small site; a refinery, or a neglected plant, wants a power station. Without power the site
 * makes only `SITE_UNPOWERED` of what it could (gen/industry.ts production).
 */
export const SITE_KW: Record<Industry, number> = { farm: 3, fishery: 3, lumber: 8, oil: 10, salvage: 10, mine: 12, workshop: 12, refinery: 30 };
export const SITE_UNPOWERED = 0.5;
/** What the site draws now (nothing while a refinery is not built). */
export function siteKw(world: number, v: Poi, seed: number, s: TownState | undefined): number {
  const k = industryOf(world, v, seed);
  return (siteBuilt(k, s) && !(progressive(s) && industryProject(k)) ? SITE_KW[k] : 0) + (progressive(s) ? (projectDone(s, 'quarry') ? 6 : 0) + (projectDone(s, 'mine') ? 12 : 0) + (projectDone(s, 'lumber') ? 8 : 0) + (projectDone(s, 'oil') ? 10 : 0) + (projectDone(s, 'refinery') ? 30 : 0) + (projectDone(s, 'foodworks') ? 8 : 0) + (projectDone(s, 'raremine') ? DEEP.kw : 0) + FURNACE.kw[furnaceLevel(s)] + SAW.kw[sawLevel(s)] + (Object.keys(SERVICE_KW) as Service[]).reduce((a, k) => a + (projectDone(s, k) ? SERVICE_KW[k] : 0), 0) + (s?.works?.turret ?? 0) * GUN_KW + (s?.mast ? RADIO.kw : 0) : 0);
}
/** The renewables' rating and their output now (kW): the own plant if solar or wind, the solar and wind farms that are on (for the battery bank). */
function renewables(world: number, v: Poi, seed: number, s: TownState | undefined, t: number): [number, number] {
  let rated = 0, now = 0;
  const kind = powerKind(seed);
  if (kind !== 'generator') {
    const c = powerCondition(seed, s, t, raidHurt(world, v, s, lastFix(seed, s), t));
    if (c >= POWER_DOWN) { rated += BASE_KW[kind] * (0.5 + 0.5 * c / 100) * plantMult(s); now += baseKw(world, v, seed, s, t); }
  }
  for (const st of s?.stations ?? []) if (st.on && (st.k === 'solarfarm' || st.k === 'windfarm')) { rated += STATIONS[st.k].kw; now += stationKw(v, seed, st, t); }
  return [rated, now];
}
export interface Balance {
  /** Of `made`: what the battery bank gave back (gen/improve.ts). */
  bank: number;
  made: number; village: number; free: number; draw: number; powered: boolean[]; farms: number; farmsPowered: number;
  /** The industry site's draw and the share of it it got. */
  site: number; sitePowered: number;
  /** (0.219, stage Z5) What its power line brings in (kW; negative: sends out), and what the village still lacks
   *  (the village, the farms, the site and the works that stand for want of power). */
  line: number; short: number;
}
/** (0.219, PLAN_PRAD_I_LUDZIE.md stage Z5) A power line to an outposts' grid: what it brings into village `vid` at time t
 *  (kW, negative when the village sends power out). Set by the game (world/powerlines.ts, from the shared `outposts`);
 *  unset (tests, workers, old worlds) nothing flows. */
let lineHook: ((world: number, vid: number, t: number) => number) | null = null;
export const setLineHook = (f: typeof lineHook) => { lineHook = f; };
/**
 * The village's power at time t: made (its plant and stations), taken by the village, then the farms (pumps and
 * lamps), then the industry site, then the works in the order they were built (each that has work to do takes its
 * draw while enough is left).
 */
export function balance(world: number, v: Poi, seed: number, s: TownState | undefined, t: number, noLine = false): Balance {
  const bank = s?.imp?.bank ? bankKw(s, ...renewables(world, v, seed, s, t)) : 0;
  const posts = crew(seed, v, s, t), line = !noLine && lineHook ? lineHook(world, v.id, t) : 0; // (0.219) an export never exceeds what was left over, an import fills what was short
  const made = Math.max(0, baseKw(world, v, seed, s, t) + (s?.stations ?? []).reduce((a, st, i) => a + stationKw(v, seed, st, t) * crewFill(posts, 'station:' + i), 0) + bank + line), vkw = villageKw(s) + streetKw(s, t); // (0.203) the street lamps by night
  let free = Math.max(0, made - vkw), draw = 0, short = Math.max(0, vkw - made);
  // the farms come first (gen/farms.ts): pumps and lamps before the works
  const farms = farmsKw(s), farmsGot = Math.min(free, farms);
  free -= farmsGot; short += farms - farmsGot;
  // then the industry site (a share of its draw is a share of its power)
  const site = siteKw(world, v, seed, s), siteGot = Math.min(free, site);
  free -= siteGot; short += site - siteGot;
  const powered = (s?.plants ?? []).map((p, i) => {
    if (!running(p) || crewFill(posts, 'works:' + i) < 1) return false; // a works short of hands stands still and draws nothing
    const d = DRAW[p.k];
    draw += d;
    if (free >= d) { free -= d; return true; }
    short += d;
    return false;
  });
  return { bank, made, village: Math.min(made, vkw), free, draw, powered, farms, farmsPowered: farms ? farmsGot / farms : 1, site, sitePowered: site ? siteGot / site : 1, line, short };
}
const siteCache = new Map<string, number>();
/**
 * The share of its power the industry site got over the day before t (12 samples, 2 h apart), so solar nights and
 * wind lulls average out. Cached per game hour and per state of the village's power (stations, repairs, levels).
 */
export function sitePower(world: number, v: Poi, seed: number, s: TownState | undefined, t: number): number {
  if (!siteKw(world, v, seed, s)) return 1;
  const key = `${world}:${v.id}:${Math.floor(t / 60)}:${s ? JSON.stringify([s.stations, s.fixed, s.hurt, s.pup, s.farms, s.fup, s.built, s.imp, s.settlement?.done, s.works?.turret]) : ''}`;
  let p = siteCache.get(key);
  if (p === undefined) {
    p = 0; for (let k = 0; k < 12; k++) p += balance(world, v, seed, s, t - k * 120).sitePowered;
    p /= 12;
    if (siteCache.size > 2000) siteCache.clear();
    siteCache.set(key, p);
  }
  return p;
}
/** The share of their power the farms got over the day before t (12 samples, 2 h apart): solar nights and wind lulls average out. */
const farmCache = new Map<string, number>();
export function farmPower(world: number, v: Poi, seed: number, s: TownState | undefined, t: number): number {
  if (!farmsKw(s)) return 1;
  // cached like sitePower: per game hour and per state of the village's power and farms
  const key = `${world}:${v.id}:${Math.floor(t / 60)}:${s ? JSON.stringify([s.stations, s.fixed, s.hurt, s.pup, s.farms, s.fup, s.built, s.imp, s.settlement?.done, s.plants?.length, s.people]) : ''}`;
  let p = farmCache.get(key);
  if (p === undefined) {
    p = 0; for (let k = 0; k < 12; k++) p += balance(world, v, seed, s, t - k * 120).farmsPowered;
    p /= 12;
    if (farmCache.size > 2000) farmCache.clear();
    farmCache.set(key, p);
  }
  return p;
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
  if (side === 'W') return { x: WALL_LO + 1 - off, z: along, w: d, d: w, side, face: [-1, 0] };
  if (side === 'E') return { x: WALL_HI + off, z: along, w: d, d: w, side, face: [1, 0] };
  return { x: along, z: WALL_HI + off, w, d, side, face: [0, 1] };
}

/**
 * (0.215, the owner's rule: everything needs power and people) A settlement's services: the warehouse (its lights and
 * storekeepers), the fuel pump, the charging post and the convoy depot. Each draws from the site's power (`SERVICE_KW`,
 * in `siteKw`) and has its crew (gen/workforce.ts `JOBS`, a whole crew or none). A service works only with its whole
 * crew and at least `SERVICE_POWER` (a quarter) of the site's power over the day (`sitePower`, so a solar night does not stop it).
 * Established villages and services not built: always on.
 */
export type Service = 'warehouse' | 'fuelpump' | 'charger' | 'depot';
export const SERVICE_KW: Record<Service, number> = { warehouse: 3, fuelpump: 2, charger: 0, depot: 6 };
export const SERVICE_POWER = 0.25;
export interface ServiceState { hands: number; power: number; why: '' | 'hands' | 'power' }
export function serviceOf(world: number, v: Poi, seed: number, s: TownState | undefined, k: Service, t: number): ServiceState {
  if (!progressive(s) || !projectDone(s, k)) return { hands: 1, power: 1, why: '' };
  const p = assign(s, workersAt(seed, v.id === GRIDHOLM_ID, s, t)).posts.find((q) => q.id === k);
  const hands = p?.fill ?? 1, power = SERVICE_KW[k] ? sitePower(world, v, seed, s, t) : 1;
  return { hands, power, why: hands < 1 ? 'hands' : power < SERVICE_POWER ? 'power' : '' };
}

/** (0.251, stage M3) A settlement's radio mast: its operator (gen/workforce.ts 'radio') and `SERVICE_POWER` of the site's power over the day, like a service. Old villages: always. */
export function mastOf(world: number, v: Poi, seed: number, s: TownState | undefined, t: number): ServiceState {
  if (!progressive(s) || !s?.mast) return { hands: 1, power: 1, why: '' };
  const p = assign(s, workersAt(seed, v.id === GRIDHOLM_ID, s, t)).posts.find((q) => q.id === 'radio');
  const hands = p?.fill ?? 1, power = sitePower(world, v, seed, s, t);
  return { hands, power, why: hands < 1 ? 'hands' : power < SERVICE_POWER ? 'power' : '' };
}

/**
 * (0.221, PLAN_PRAD_I_LUDZIE.md stage Z7) A settlement's wall turrets: each draws `GUN_KW` from the site's power (in
 * `siteKw`) and wants a guard (gen/workforce.ts 'guard:i', one man, manned after the services). A turret fires only
 * with its guard and at least `SERVICE_POWER` of the site's power over the day; without power none fires. Established
 * villages: every turret fires, as before.
 */
export const GUN_KW = 4;
export interface GunsState { n: number; work: number; manned: number; power: number; why: '' | 'hands' | 'power' }
export function wallGunsAt(world: number, v: Poi, seed: number, s: TownState | undefined, t: number): GunsState {
  const n = s?.works?.turret ?? 0;
  if (!n || !progressive(s)) return { n, work: n, manned: n, power: 1, why: '' };
  const manned = assign(s, workersAt(seed, v.id === GRIDHOLM_ID, s, t)).posts.filter((p) => p.kind === 'guard' && p.fill >= 1).length;
  const power = sitePower(world, v, seed, s, t), work = power < SERVICE_POWER ? 0 : manned;
  return { n, work, manned, power, why: power < SERVICE_POWER ? 'power' : manned < n ? 'hands' : '' };
}
