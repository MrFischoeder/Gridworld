// (0.252, PLAN_MAGAZYNOW.md stage M4) Convoys between warehouses. A warehouse linked by radio (gen/radio.ts) opens a
// convoy line to another warehouse on its radio network within `HLINE.reach`, and the players hand a truck over to it
// (like the outposts' routes, gen/routes.ts: the same pace, loads, fuel and robbery). On a timetable from the moment
// the truck came, a round trip every `hlPeriod`: at each departure the truck loads what the home warehouse's hold
// holds (only the goods picked, or anything stored) up to its load, burns its diesel (an electric truck charges full
// at home while the home warehouse works), and may be robbed half way. It leaves only while the two warehouses can
// talk over the radio (else the trip is 'silent': it stays home) and only with something to carry.
//
// The line lives on its home warehouse (`TownState.hline` for a village's, `OutpostState.hline` for a port's or a wild
// one) and counts what it delivered (`sent`, cumulative, written under the home's lock); the other warehouse counts
// what it took in (`rcv['hl:<home>:<line id>']`, under its own lock, only while its storekeepers work), so a stale
// write delays a delivery but never doubles it. Pure.
import { hash } from '../core/rng';
import { dangerAt } from './danger';
import { worldDist, nearX } from './regions';
import { ROUTE, type RouteTruck } from './routes';
import { VEHICLES, FUEL, EV, evCap } from '../data/vehicles';
import type { ItemKey } from '../data/items';
import type { TownState } from './town';
import type { OutpostState } from './outposts';
import type { Hub } from './warehouses';
import { noteArrival, takeTransit, type Transit } from './transit';

export const HLINE = { reach: 25000 };
export type HubTrip = 'ok' | 'dry' | 'robbed' | 'wrecked' | 'silent' | 'empty';
export interface HubLine {
  /** When it was opened (its id), the warehouse it serves, its name and place, the way's length (km). */
  id: number; to: string; toName: string; tx: number; tz: number; km: number;
  /** The truck on it (absent: the line waits for one) and the start of its timetable; the next trip to settle. */
  truck?: RouteTruck; t0?: number; k: number;
  /** Only these goods (absent: anything in the hold); delivered so far (cumulative). */
  only?: ItemKey[]; sent: Partial<Record<ItemKey, number>>;
  /** The last trip's fate, trips robbed, trips done. */
  last?: [number, HubTrip]; robbed?: number; trips?: number;
}
/** The other warehouse's counter key for a line. */
export const hlKey = (home: string, l: HubLine) => 'hl:' + home + ':' + l.id;
/** A new line from warehouse `a` to warehouse `b`. */
export function newHubLine(a: Hub, b: Hub, now: number): HubLine {
  const km = Math.round(worldDist(a.x, a.z, b.x, b.z) * ROUTE.detour / 100) / 10;
  return { id: Math.round(now), to: b.id, toName: b.name, tx: Math.round(b.x), tz: Math.round(b.z), km, k: 0, sent: {} };
}
/** Minutes one way, a whole round trip with loading at both ends. */
export const hlLeg = (l: HubLine) => Math.ceil(l.km * 1000 / ROUTE.speed);
export const hlPeriod = (l: HubLine) => 2 * (hlLeg(l) + ROUTE.load);
const isEV = (t: RouteTruck | undefined) => t?.parts.ev !== undefined;
/** The truck's energy now and what a round trip takes ('L' diesel, 'kWh' battery). */
export function hlEnergy(l: HubLine): [number, number, 'L' | 'kWh'] {
  const t = l.truck, f = FUEL.cruise + (1 - FUEL.cruise) * 0.5;
  if (!t) return [0, 0, 'L'];
  return isEV(t) ? [t.parts.ev ?? 0, Math.round(2 * l.km * EV[t.model].use * f * 10) / 10, 'kWh'] : [t.parts.fuel ?? 0, Math.round(2 * l.km * VEHICLES[t.model].fuelUse * f * 10) / 10, 'L'];
}
/** The chance a trip is robbed (the danger half way; a roof cannon helps). */
export function hlRob(world: number, home: { x: number; z: number }, l: HubLine): number {
  const d = dangerAt(world, (home.x + nearX(l.tx, home.x)) / 2, (home.z + l.tz) / 2);
  return Math.min(ROUTE.robMax, ROUTE.rob + ROUTE.robPer * d) * (l.truck?.parts.gun ? ROUTE.cannon : 1);
}
export const hlWrecked = (l: HubLine) => !!l.truck && (l.truck.parts.hull ?? 1) <= 0;
/** Pour up to n canisters into the line's truck; how many went in. */
export function hlFuel(l: HubLine, n: number): number {
  const t = l.truck;
  if (!t || isEV(t)) return 0;
  const tank = VEHICLES[t.model].tank, room = Math.floor((tank - (t.parts.fuel ?? 0)) / FUEL.can + 1e-6), m = Math.max(0, Math.min(n, room));
  if (m) t.parts.fuel = Math.min(tank, (t.parts.fuel ?? 0) + m * FUEL.can);
  return m;
}
/** Where the convoy is at `now`: loading at home or there, driving out / back (0..1), or parked. */
export function hlAt(l: HubLine, now: number): { at: 'home' | 'out' | 'there' | 'back' | 'parked'; p: number } {
  if (!l.truck || l.t0 === undefined || hlWrecked(l)) return { at: 'parked', p: 0 };
  if (l.last && (l.last[1] === 'dry' || l.last[1] === 'silent' || l.last[1] === 'empty') && now - (l.t0 + l.last[0] * hlPeriod(l)) < hlPeriod(l)) return { at: 'parked', p: 0 };
  const P = hlPeriod(l), leg = hlLeg(l), ph = ((now - l.t0) % P + P) % P;
  if (ph < ROUTE.load) return { at: 'home', p: 0 };
  if (ph < ROUTE.load + leg) return { at: 'out', p: (ph - ROUTE.load) / leg };
  if (ph < 2 * ROUTE.load + leg) return { at: 'there', p: 1 };
  return { at: 'back', p: (ph - 2 * ROUTE.load - leg) / leg };
}
/** The trips due by `now` (their departures have passed). */
export const hlDue = (l: HubLine, now: number) => !!l.truck && l.t0 !== undefined && Math.floor((now - l.t0 - ROUTE.load - hlLeg(l)) / hlPeriod(l)) >= l.k;
/**
 * Settle the trips that reached the other warehouse by `now`, in order (under the home's lock): `linked` = the two can
 * talk over the radio now, `charge` = an electric truck charges at home, `take(cap, only)` loads from the home's hold
 * (returns what it took).
 */
export function settleHubLine(world: number, home: { x: number; z: number }, l: HubLine, linked: boolean, charge: boolean, take: (cap: number, only?: ItemKey[]) => [ItemKey, number][], now: number): HubTrip[] {
  const tr = l.truck, out: HubTrip[] = [];
  if (!tr || l.t0 === undefined) return out;
  const P = hlPeriod(l), last = Math.floor((now - l.t0 - ROUTE.load - hlLeg(l)) / P);
  if (last - l.k > ROUTE.catchup) l.k = last - ROUTE.catchup;
  for (; l.k <= last; l.k++) {
    if ((tr.parts.hull ?? 1) <= 0) { l.last = [l.k, 'wrecked']; break; }
    if (!linked) { l.last = [l.k, 'silent']; continue; }
    const [, need] = hlEnergy(l);
    if (isEV(tr)) { if (charge) tr.parts.ev = evCap(tr.model, tr.parts); if ((tr.parts.ev ?? 0) < need) { l.last = [l.k, 'dry']; continue; } }
    else if ((tr.parts.fuel ?? 0) < need) { l.last = [l.k, 'dry']; continue; }
    const cargo = take(ROUTE.cap[tr.model], l.only);
    if (!cargo.length) { l.last = [l.k, 'empty']; continue; }
    if (isEV(tr)) tr.parts.ev = Math.round(((tr.parts.ev ?? 0) - need) * 10) / 10; else tr.parts.fuel = Math.round(((tr.parts.fuel ?? 0) - need) * 10) / 10;
    l.trips = (l.trips ?? 0) + 1;
    if ((hash(world, l.id, l.k, l.to.length, 0x4b17) % 1000) / 1000 < hlRob(world, home, l)) {
      tr.parts.hull = Math.max(0, Math.round((tr.parts.hull ?? VEHICLES[tr.model].hull) - ROUTE.hurt * VEHICLES[tr.model].hull));
      l.robbed = (l.robbed ?? 0) + 1;
      const w: HubTrip = tr.parts.hull <= 0 ? 'wrecked' : 'robbed';
      l.last = [l.k, w]; out.push(w);
      if (w === 'wrecked') { l.k++; break; }
      continue;
    }
    for (const [g, n] of cargo) l.sent[g] = (l.sent[g] ?? 0) + n;
    l.last = [l.k, 'ok']; out.push('ok');
  }
  return out;
}
/** Every line: [its home warehouse's id, the line]. */
export function allHubLines(towns: Record<string, TownState | undefined>, outposts: Record<string, OutpostState | undefined>): [string, HubLine][] {
  const out: [string, HubLine][] = [];
  for (const [id, s] of Object.entries(towns)) if (s?.hline) out.push(['v:' + id, s.hline]);
  for (const [id, o] of Object.entries(outposts)) if (o?.hline) out.push([id, o.hline]);
  return out;
}
/** The line of warehouse `id`, if it has one. */
export const hubLineOf = (id: string, towns: Record<string, TownState | undefined>, outposts: Record<string, OutpostState | undefined>) =>
  id.startsWith('v:') ? towns[id.slice(2)]?.hline : outposts[id]?.hline;
/** What the lines brought to warehouse `dest` that it has not taken in: [counter key, good, how many]. */
export function hlWaiting(dest: string, towns: Record<string, TownState | undefined>, outposts: Record<string, OutpostState | undefined>, rcv: Record<string, Partial<Record<ItemKey, number>>> | undefined): [string, ItemKey, number][] {
  const out: [string, ItemKey, number][] = [];
  for (const [home, l] of allHubLines(towns, outposts)) {
    if (l.to !== dest) continue;
    const key = hlKey(home, l), got = rcv?.[key] ?? {};
    for (const [g, n] of Object.entries(l.sent) as [ItemKey, number][]) { const m = n - (got[g] ?? 0); if (m > 0) out.push([key, g, m]); }
  }
  return out;
}
/** The other warehouse takes in what the lines brought (under its lock): `put` stores as much as fits. */
export function hlDrain(dest: string, towns: Record<string, TownState | undefined>, outposts: Record<string, OutpostState | undefined>, rcvOwner: { rcv?: Record<string, Partial<Record<ItemKey, number>>> } & Transit, put: (k: ItemKey, n: number) => number): [ItemKey, number][] {
  const got: [ItemKey, number][] = [];
  for (const [key, g, n] of hlWaiting(dest, towns, outposts, rcvOwner.rcv)) {
    const m = put(g, n);
    if (m) { const r = ((rcvOwner.rcv ??= {})[key] ??= {}); r[g] = (r[g] ?? 0) + m; got.push([g, m]); noteArrival(rcvOwner, key, g, m); } // (0.253) and maybe on
  }
  return got;
}
/** Take up to `cap` crates from a hold (only the goods asked, else anything kept there; most first). */
export function takeHold(hold: Partial<Record<ItemKey, number>> | undefined, cap: number, only: ItemKey[] | undefined, takeOne: (k: ItemKey, n: number) => number): [ItemKey, number][] {
  const out: [ItemKey, number][] = [];
  const ks = (Object.entries(hold ?? {}) as [ItemKey, number][]).filter(([k, n]) => n > 0 && (!only || only.includes(k))).sort((a, b) => b[1] - a[1]);
  for (const [k, n] of ks) { if (cap <= 0) break; const m = takeOne(k, Math.min(cap, n)); if (m) { out.push([k, m]); cap -= m; } }
  return out;
}
/** (0.253) What a warehouse's own convoy line loads: the goods waiting to go on by it first, then from the hold as set. */
export function lineLoad(st: Transit, hold: Partial<Record<ItemKey, number>> | undefined, cap: number, only: ItemKey[] | undefined, takeOne: (k: ItemKey, n: number) => number): [ItemKey, number][] {
  const first = takeTransit(st, 'hl', hold, cap, takeOne), left = cap - first.reduce((a, [, n]) => a + n, 0);
  return [...first, ...takeHold(hold, left, only, takeOne)];
}
