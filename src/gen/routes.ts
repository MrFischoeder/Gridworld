// (0.187, PLAN_PLACOWEK.md stage O6) Convoy routes set by the players: an outpost's crates driven to a village by a
// truck the players hand over to the route, and (if asked) food brought back for the outpost's pantry. The convoy
// runs to a timetable worked out from the route alone (like the caravans): a round trip every `period` minutes from the
// moment the truck was assigned; each trip takes what the outpost has on site (up to the truck's load), burns diesel
// from the truck's tank (a dry tank misses the trip until someone pours in canisters), and may be robbed on the way
// (the danger half way; a roof cannon helps): the cargo is lost and the hull takes a beating, and a wrecked truck stops
// the route until it is recalled and mended.
//
// Two shared records meet here without one game writing both at once: the outpost's route counts what its convoys
// delivered (`sent`, cumulative, written only by the outpost's deterministic settling), and the village counts what it
// put into its hall (`TownState.rcv`, cumulative, written only under the village's lock when its stock is opened:
// `drainRoutes`). The same for food the other way (`TownState.ship` against the route's `fed`). So a late or stale
// write can delay a delivery but never doubles or loses one. Pure.
import { hash } from '../core/rng';
import { dangerAt } from './danger';
import { worldDist, nearX, type Poi } from './regions';
import { settle, outputs, type OutpostState } from './outposts';
import { settleLife, foodValue, pantryOf } from './outpostlife';
import { deposit } from './hall';
import { FOOD } from './farms';
import type { Lode } from './lodes';
import type { TownState } from './town';
import type { ItemKey } from '../data/items';
import { VEHICLES, FUEL, EV, evCap, type VehicleModel, type VehicleParts } from '../data/vehicles';
import { cargoGoods } from './outpostproc';
import { tl } from '../i18n';
import type { RoadWay } from './roadnet';

export const ROUTE = {
  /** Villages further than this from the outpost cannot be served (m); roads wind: the way is this much longer. */
  reach: 25000, detour: 1.3,
  /** The convoy's pace (m a game minute) and the time to load or unload at each end (min). */
  speed: 12, load: 30,
  /** Crates a truck carries. */
  cap: { scout: 8, van: 18, mastodon: 30 } as Record<VehicleModel, number>,
  /** A robbery on a trip: base chance, more with the danger half way, less with a roof cannon; the hull's share lost. */
  rob: 0.03, robPer: 0.025, robMax: 0.35, cannon: 0.6, hurt: 0.3,
  /** How far behind the settling may fall before old trips are skipped. */
  catchup: 200,
};
export interface RouteTruck { id: string; model: VehicleModel; parts: VehicleParts; by: string }
export interface Route {
  /** The village served, its name and middle (for the maps and the drawing), the way's length (km). */
  v: number; vname: string; vx: number; vz: number; km: number;
  /** The truck on the route (absent: the route waits for one) and the start of its timetable. */
  truck?: RouteTruck; t0?: number;
  /** The next trip to settle; bring food back; crates delivered so far (cumulative); food units taken in so far. */
  k: number; food?: boolean; sent: Partial<Record<ItemKey, number>>; fed: number;
  /** The last trip's fate, trips robbed. */
  last?: [number, 'ok' | 'dry' | 'robbed' | 'wrecked']; robbed?: number;
  /** (0.188) The outpost was on a grid at the last settling (an electric truck charges there). */
  grid?: boolean;
  /** (0.283, D4) The way by road (gen/roadnet.ts); absent on a route set up before 0.283 (straight across country). */
  way?: RoadWay;
}
/** The route's id in the village's counters. */
export const routeKey = (outpostId: string) => outpostId;
/** A new route from outpost `o` to village `v`. */
export function newRoute(o: OutpostState, v: Poi, name: string, way?: RoadWay): Route {
  const km = way ? way.km : Math.round(worldDist(o.x, o.z, v.x, v.z) * ROUTE.detour / 100) / 10;
  const r: Route = { v: v.id, vname: name, vx: Math.round(v.x), vz: Math.round(v.z), km, k: 0, sent: {}, fed: 0 };
  if (way) r.way = way;
  return r;
}
/** Minutes one way, and a whole round trip with loading at both ends. */
export const legOf = (r: Route) => Math.ceil((r.way ? r.way.t : r.km) * 1000 / ROUTE.speed);
export const periodOf = (r: Route) => 2 * (legOf(r) + ROUTE.load);
/** Litres a round trip burns. */
export const tripFuel = (r: Route, m: VehicleModel) => Math.round(2 * r.km * (r.way?.f ?? 1) * VEHICLES[m].fuelUse * (FUEL.cruise + (1 - FUEL.cruise) * 0.5) * 10) / 10;
/** (0.188, stage O7) kWh a round trip takes from an electric truck's battery. */
export const tripKwh = (r: Route, m: VehicleModel) => Math.round(2 * r.km * (r.way?.f ?? 1) * EV[m].use * (FUEL.cruise + (1 - FUEL.cruise) * 0.5) * 10) / 10;
export const isElectric = (t: RouteTruck | undefined) => t?.parts.ev !== undefined;
/** The truck's energy now and what a round trip takes, with the unit ('L' diesel, 'kWh' battery). */
export function truckEnergy(r: Route): [number, number, 'L' | 'kWh'] {
  const t = r.truck;
  if (!t) return [0, 0, 'L'];
  return isElectric(t) ? [t.parts.ev ?? 0, tripKwh(r, t.model), 'kWh'] : [t.parts.fuel ?? 0, tripFuel(r, t.model), 'L'];
}
/** Can the convoy leave on its next trip (an electric truck charges at an outpost on a grid)? */
const ready = (r: Route) => { const [have, need] = truckEnergy(r); return have >= need || (isElectric(r.truck) && !!r.grid); };
/** The chance a trip is robbed. */
export function robChance(world: number, o: OutpostState, r: Route): number {
  const mx = (o.x + nearX(r.vx, o.x)) / 2, mz = (o.z + r.vz) / 2, d = dangerAt(world, mx, mz);
  return Math.min(ROUTE.robMax, ROUTE.rob + ROUTE.robPer * d) * (r.truck?.parts.gun ? ROUTE.cannon : 1);
}
/** Why a truck cannot take the route ('' = it can). */
export function truckProblem(parts: VehicleParts, model: VehicleModel): string {
  if ((parts.hull ?? 1) <= 0) return tl('It is a wreck: mend its hull first.');
  if (parts.engine <= 0 || parts.wheels.some((w) => w <= 0)) return tl('It cannot drive: mend it first.');
  return VEHICLES[model] ? '' : tl('Not a vehicle for hauling.');
}
/** Hand a truck over to the route; its timetable starts now. */
export function assignTruck(r: Route, truck: RouteTruck, now: number) { r.truck = truck; r.t0 = now; r.k = 0; delete r.last; }
/** Take the truck off the route (it comes back as it is). */
export function recallTruck(r: Route): RouteTruck | undefined { const t = r.truck; delete r.truck; delete r.t0; r.k = 0; return t; }
/** Pour up to n canisters into the route's truck; how many went in. */
export function fuelTruck(r: Route, n: number): number {
  const t = r.truck;
  if (!t || isElectric(t)) return 0;
  const tank = VEHICLES[t.model].tank, room = Math.floor((tank - (t.parts.fuel ?? 0)) / FUEL.can + 1e-6), m = Math.max(0, Math.min(n, room));
  if (m) t.parts.fuel = Math.min(tank, (t.parts.fuel ?? 0) + m * FUEL.can);
  return m;
}
export const wrecked = (r: Route) => !!r.truck && (r.truck.parts.hull ?? 1) <= 0;
/** Where the convoy is at `now`: 'out' / 'back' (driving, 0..1 along the way), 'outpost' / 'village' (loading), 'parked'. */
export function convoyAt(r: Route, now: number): { at: 'out' | 'back' | 'outpost' | 'village' | 'parked'; p: number } {
  if (!r.truck || r.t0 === undefined || wrecked(r) || !ready(r)) return { at: 'parked', p: 0 };
  const P = periodOf(r), leg = legOf(r), ph = ((now - r.t0) % P + P) % P;
  if (ph < ROUTE.load) return { at: 'outpost', p: 0 };
  if (ph < ROUTE.load + leg) return { at: 'out', p: (ph - ROUTE.load) / leg };
  if (ph < 2 * ROUTE.load + leg) return { at: 'village', p: 1 };
  return { at: 'back', p: (ph - 2 * ROUTE.load - leg) / leg };
}
/** Settle the trips that reached the village by `now`, in order: load at departure, burn the fuel, roll the road. */
export function settleRoute(world: number, o: OutpostState, l: Lode | null, now: number, pw = 1, onGrid = false): { k: number; what: string }[] {
  const r = o.route, out: { k: number; what: string }[] = [];
  if (!r) return out;
  r.grid = onGrid || undefined;
  const tr = r.truck;
  if (!tr || r.t0 === undefined) return out;
  const P = periodOf(r), leg = legOf(r), last = Math.floor((now - r.t0 - ROUTE.load - leg) / P);
  if (last - r.k > ROUTE.catchup) r.k = last - ROUTE.catchup;
  for (; r.k <= last; r.k++) {
    const dep = r.t0 + r.k * P + ROUTE.load;
    if ((tr.parts.hull ?? 1) <= 0) { r.last = [r.k, 'wrecked']; break; }
    if (isElectric(tr)) { // (0.188) an electric truck charges full at its outpost when the grid reaches it
      if (onGrid) tr.parts.ev = evCap(tr.model, tr.parts);
      const need = tripKwh(r, tr.model);
      if ((tr.parts.ev ?? 0) < need) { r.last = [r.k, 'dry']; continue; }
      tr.parts.ev = Math.round(((tr.parts.ev ?? 0) - need) * 10) / 10;
    } else {
      const need = tripFuel(r, tr.model);
      if ((tr.parts.fuel ?? 0) < need) { r.last = [r.k, 'dry']; continue; }
      tr.parts.fuel = Math.round(((tr.parts.fuel ?? 0) - need) * 10) / 10;
    }
    let room = ROUTE.cap[tr.model];
    const cargo: [ItemKey, number][] = [];
    if (l && o.stock) {
      settle(o, l, dep, pw);
      for (const g of cargoGoods(o, outputs(l).map(([g]) => g))) { const n = Math.min(room, Math.floor(o.stock.n[g] ?? 0)); if (n) { o.stock.n[g] = (o.stock.n[g] ?? 0) - n; room -= n; cargo.push([g, n]); } }
    }
    if ((hash(world, o.x | 0, o.z | 0, r.k, 0x0a70) % 1000) / 1000 < robChance(world, o, r)) {
      tr.parts.hull = Math.max(0, Math.round((tr.parts.hull ?? VEHICLES[tr.model].hull) - ROUTE.hurt * VEHICLES[tr.model].hull));
      r.robbed = (r.robbed ?? 0) + 1;
      r.last = [r.k, tr.parts.hull <= 0 ? 'wrecked' : 'robbed'];
      out.push({ k: r.k, what: tr.parts.hull <= 0 ? 'wrecked' : 'robbed' });
      if (tr.parts.hull <= 0) { r.k++; break; }
      continue;
    }
    for (const [g, n] of cargo) r.sent[g] = (r.sent[g] ?? 0) + n;
    r.last = [r.k, 'ok'];
  }
  return out;
}
/** Food the village has shipped to the route that the pantry has not taken yet goes in (as much as fits). */
export function takeFood(world: number, o: OutpostState, shipped: number, now: number): number {
  const r = o.route;
  if (!r || shipped <= r.fed) return 0;
  settleLife(world, o, now);
  const L = (o.life ??= { t: Math.floor(now / 120) * 120, n: 0, food: 0, fed: 1 }), m = Math.max(0, Math.min(shipped - r.fed, pantryOf(o) - L.food));
  L.food += m; r.fed += m;
  return m;
}
/** At the village, under its lock: put what the routes delivered into the hall (as much as fits) and send food back to
 *  the routes that ask for it (from the stock, up to the truck's load and the outpost's pantry room). */
export function drainRoutes(s: TownState, vid: number, outposts: Record<string, OutpostState>, take?: (k: ItemKey, n: number) => number): { got: [ItemKey, number][]; food: number } {
  const got: [ItemKey, number][] = []; let food = 0;
  for (const [id, o] of Object.entries(outposts)) {
    const r = o?.route;
    if (!r || r.v !== vid) continue;
    const key = routeKey(id), rcv = ((s.rcv ??= {})[key] ??= {});
    for (const [g, n] of Object.entries(r.sent) as [ItemKey, number][]) {
      const m = deposit(s, g, Math.max(0, n - (rcv[g] ?? 0)));
      if (m) { rcv[g] = (rcv[g] ?? 0) + m; got.push([g, m]); }
    }
    if (r.food && r.truck && take) { // food for the pantry: what it lacks less what is on its way already
      const ship = (s.ship ??= {}), on = (ship[key] ?? 0) - r.fed;
      let want = Math.min(ROUTE.cap[r.truck.model], pantryOf(o) - (o.life?.food ?? 0) - Math.max(0, on));
      for (const k of Object.keys(FOOD.value) as ItemKey[]) {
        if (want < foodValue(k)) break;
        const n = take(k, Math.floor(want / foodValue(k)));
        if (n) { ship[key] = (ship[key] ?? 0) + n * foodValue(k); want -= n * foodValue(k); food += n * foodValue(k); }
      }
    }
  }
  return { got, food };
}
/** Crates delivered that wait at the village (its hall was full, or nobody has opened its stock since). */
export function waiting(r: Route, s: TownState | undefined, id: string): number {
  const rcv = s?.rcv?.[routeKey(id)] ?? {};
  return Object.entries(r.sent).reduce((a, [g, n]) => a + Math.max(0, (n ?? 0) - (rcv[g as ItemKey] ?? 0)), 0);
}
