// (0.258, PLAN_LOTNICTWA.md stage F4) Airship lines between warehouses with mooring masts. A warehouse with a mast opens
// one sky line to another warehouse with a mast within `SKY.reach`, and the players hand an airship moored at its mast
// over to it (it leaves the shared list `Char.airships` and sails on the line; recalled, it moors at the mast again, its
// hold and name as before). On a timetable from the moment the airship came, a round trip every `skPeriod`: at each
// departure it loads what the home warehouse's hold holds (only the goods picked, or anything stored) up to its hold
// (`AIRSHIP.hold` slots × `SKY.perSlot` crates), burns its diesel (a cell ship charges full at home while the home mast
// works), and flies the straight way (over land and sea alike) at an economical cruise. A storm over the home warehouse
// at the departure keeps it at the mast ('storm'); it leaves only while both masts stand. Robbery and the wild's
// dangers are for a later stage (F6).
//
// Like the convoy lines (gen/hublines.ts) the line lives on its home warehouse (`TownState.zline` / `OutpostState.zline`)
// and counts what it delivered (`sent`, cumulative, under the home's lock); the other warehouse counts what it took in
// (`rcv['sk:<home>:<line id>']`, under its own lock, only while its storekeepers work), so a stale write delays a
// delivery but never doubles it. What arrives can go on by this warehouse's own line (gen/transit.ts way 'sk'). Pure.
import type { ItemKey } from '../data/items';
import type { TownState } from './town';
import type { OutpostState } from './outposts';
import type { Hub } from './warehouses';
import { worldDist } from './regions';
import { weatherAt } from './weather';
import { AIRSHIP, type AirDrive } from './airmast';
import type { Airship } from './airships';
import { noteArrival, takeTransit, type Transit } from './transit';
import { takeHold } from './hublines';

/**
 * `reach` m between the two masts, `pace` m per game minute at the economical cruise (half throttle: slower than the
 * airship flown by hand), `load` minutes of loading at each end, `perSlot` crates a hold slot, `lpkm` litres of diesel
 * and `kwhpkm` kWh a km at that cruise (a round trip must fit the tank or the cells), `storm` the storm strength at the
 * home warehouse over which it stays at the mast.
 */
export const SKY = { reach: 30000, pace: 10, load: 45, perSlot: 4, lpkm: 2.2, kwhpkm: 2.4, storm: 0.45 };
export type SkyTrip = 'ok' | 'dry' | 'storm' | 'empty' | 'nomast';
/** An airship on a line: what it was in the list, minus its place. */
export interface SkyShip { id: string; drive: AirDrive; fuel: number; kwh: number; by: string; t: number }
export interface SkyLine {
  /** When it was opened (its id), the warehouse it serves, its name and place, the straight way's length (km). */
  id: number; to: string; toName: string; tx: number; tz: number; km: number;
  /** The airship on it (absent: the line waits for one) and the start of its timetable; the next trip to settle. */
  ship?: SkyShip; t0?: number; k: number;
  /** Only these goods (absent: anything in the hold); delivered so far (cumulative). */
  only?: ItemKey[]; sent: Partial<Record<ItemKey, number>>;
  /** The last trip's fate, trips done. */
  last?: [number, SkyTrip]; trips?: number;
}
/** The other warehouse's counter key for a line. */
export const skKey = (home: string, l: SkyLine) => 'sk:' + home + ':' + l.id;
/** A new line from warehouse `a` to warehouse `b`. */
export function newSkyLine(a: Hub, b: Hub, now: number): SkyLine {
  const km = Math.round(worldDist(a.x, a.z, b.x, b.z) / 100) / 10;
  return { id: Math.round(now), to: b.id, toName: b.name, tx: Math.round(b.x), tz: Math.round(b.z), km, k: 0, sent: {} };
}
/** Crates a trip. */
export const skCap = () => AIRSHIP.hold * SKY.perSlot;
/** Minutes one way, a whole round trip with loading at both ends. */
export const skLeg = (l: SkyLine) => Math.ceil(l.km * 1000 / SKY.pace);
export const skPeriod = (l: SkyLine) => 2 * (skLeg(l) + SKY.load);
/** The ship's energy now, what a round trip takes, and the unit ('L' diesel, 'kWh' cells). */
export function skEnergy(l: SkyLine): [number, number, 'L' | 'kWh'] {
  const s = l.ship;
  if (!s) return [0, 0, 'L'];
  return s.drive === 'fuel' ? [s.fuel, Math.round(2 * l.km * SKY.lpkm * 10) / 10, 'L'] : [s.kwh, Math.round(2 * l.km * SKY.kwhpkm * 10) / 10, 'kWh'];
}
/** Pour up to n canisters into the line's ship; how many went in. */
export function skFuel(l: SkyLine, n: number): number {
  const s = l.ship;
  if (!s || s.drive !== 'fuel') return 0;
  const room = Math.floor((AIRSHIP.fuel.tank - s.fuel) / AIRSHIP.fuel.can + 1e-6), m = Math.max(0, Math.min(n, room));
  if (m) s.fuel = Math.min(AIRSHIP.fuel.tank, s.fuel + m * AIRSHIP.fuel.can);
  return m;
}
/** The airship leaves the list for the line (`now` starts the timetable). */
export function skAssign(l: SkyLine, a: Airship, now: number, by: string) {
  l.ship = { id: a.id, drive: a.drive, fuel: a.fuel, kwh: a.kwh, by: a.by || by, t: a.t }; l.t0 = now; l.k = 0; delete l.last;
}
/** The line's airship as a list entry moored at a mast (the caller places it: `pose`). */
export function skRecall(l: SkyLine, hub: string, pose: { x: number; y: number; z: number; yaw: number }): Airship {
  const s = l.ship!;
  const a: Airship = { id: s.id, ...pose, drive: s.drive, fuel: s.fuel, kwh: s.kwh, moor: hub, by: s.by, t: s.t };
  delete l.ship; delete l.t0; l.k = 0;
  return a;
}
/** Where the airship is at `now`: at the home mast loading, flying out / back (0..1), at the other mast, or standing. */
export function skAt(l: SkyLine, now: number): { at: 'home' | 'out' | 'there' | 'back' | 'parked'; p: number } {
  if (!l.ship || l.t0 === undefined) return { at: 'parked', p: 0 };
  if (l.last && (l.last[1] === 'dry' || l.last[1] === 'storm' || l.last[1] === 'empty' || l.last[1] === 'nomast') && now - (l.t0 + l.last[0] * skPeriod(l)) < skPeriod(l)) return { at: 'parked', p: 0 };
  const P = skPeriod(l), leg = skLeg(l), ph = ((now - l.t0) % P + P) % P;
  if (ph < SKY.load) return { at: 'home', p: 0 };
  if (ph < SKY.load + leg) return { at: 'out', p: (ph - SKY.load) / leg };
  if (ph < 2 * SKY.load + leg) return { at: 'there', p: 1 };
  return { at: 'back', p: (ph - 2 * SKY.load - leg) / leg };
}
/** The trips due by `now` (their departures have passed). */
export const skDue = (l: SkyLine, now: number) => !!l.ship && l.t0 !== undefined && Math.floor((now - l.t0 - SKY.load - skLeg(l)) / skPeriod(l)) >= l.k;
/**
 * Settle the trips that reached the other warehouse by `now`, in order (under the home's lock): `masts` = both
 * warehouses have a mast now, `charge` = a cell ship charges at home (the home mast works), `take(cap, only)` loads
 * from the home's hold (returns what it took).
 */
export function settleSkyLine(world: number, home: { x: number; z: number }, l: SkyLine, masts: boolean, charge: boolean, take: (cap: number, only?: ItemKey[]) => [ItemKey, number][], now: number): SkyTrip[] {
  const s = l.ship, out: SkyTrip[] = [];
  if (!s || l.t0 === undefined) return out;
  const P = skPeriod(l), last = Math.floor((now - l.t0 - SKY.load - skLeg(l)) / P);
  if (last - l.k > 200) l.k = last - 200;
  for (; l.k <= last; l.k++) {
    if (!masts) { l.last = [l.k, 'nomast']; continue; }
    const [, need] = skEnergy(l), dep = l.t0 + l.k * P + SKY.load;
    if (weatherAt(world, home.x, home.z, dep).storm > SKY.storm) { l.last = [l.k, 'storm']; out.push('storm'); continue; }
    if (s.drive === 'cell' && charge) s.kwh = AIRSHIP.cell.cap;
    if ((s.drive === 'fuel' ? s.fuel : s.kwh) < need) { l.last = [l.k, 'dry']; continue; }
    const cargo = take(skCap(), l.only);
    if (!cargo.length) { l.last = [l.k, 'empty']; continue; }
    if (s.drive === 'fuel') s.fuel = Math.round((s.fuel - need) * 10) / 10; else s.kwh = Math.round((s.kwh - need) * 10) / 10;
    for (const [g, n] of cargo) l.sent[g] = (l.sent[g] ?? 0) + n;
    l.trips = (l.trips ?? 0) + 1;
    l.last = [l.k, 'ok']; out.push('ok');
  }
  return out;
}
/** Every sky line: [its home warehouse's id, the line]. */
export function allSkyLines(towns: Record<string, TownState | undefined>, outposts: Record<string, OutpostState | undefined>): [string, SkyLine][] {
  const out: [string, SkyLine][] = [];
  for (const [id, s] of Object.entries(towns)) if (s?.zline) out.push(['v:' + id, s.zline]);
  for (const [id, o] of Object.entries(outposts)) if (o?.zline) out.push([id, o.zline]);
  return out;
}
/** The sky line of warehouse `id`, if it has one. */
export const skyLineOf = (id: string, towns: Record<string, TownState | undefined>, outposts: Record<string, OutpostState | undefined>) =>
  id.startsWith('v:') ? towns[id.slice(2)]?.zline : outposts[id]?.zline;
/** What the sky lines brought to warehouse `dest` that it has not taken in: [counter key, good, how many]. */
export function skWaiting(dest: string, towns: Record<string, TownState | undefined>, outposts: Record<string, OutpostState | undefined>, rcv: Record<string, Partial<Record<ItemKey, number>>> | undefined): [string, ItemKey, number][] {
  const out: [string, ItemKey, number][] = [];
  for (const [home, l] of allSkyLines(towns, outposts)) {
    if (l.to !== dest) continue;
    const key = skKey(home, l), got = rcv?.[key] ?? {};
    for (const [g, n] of Object.entries(l.sent) as [ItemKey, number][]) { const m = n - (got[g] ?? 0); if (m > 0) out.push([key, g, m]); }
  }
  return out;
}
/** The other warehouse takes in what the lines brought (under its lock): `put` stores as much as fits. */
export function skDrain(dest: string, towns: Record<string, TownState | undefined>, outposts: Record<string, OutpostState | undefined>, rcvOwner: { rcv?: Record<string, Partial<Record<ItemKey, number>>> } & Transit, put: (k: ItemKey, n: number) => number): [ItemKey, number][] {
  const got: [ItemKey, number][] = [];
  for (const [key, g, n] of skWaiting(dest, towns, outposts, rcvOwner.rcv)) {
    const m = put(g, n);
    if (m) { const r = ((rcvOwner.rcv ??= {})[key] ??= {}); r[g] = (r[g] ?? 0) + m; got.push([g, m]); noteArrival(rcvOwner, key, g, m); }
  }
  return got;
}
/** What a warehouse's own sky line loads: the goods waiting to go on by it first, then from the hold as set. */
export function skLoad(st: Transit, hold: Partial<Record<ItemKey, number>> | undefined, cap: number, only: ItemKey[] | undefined, takeOne: (k: ItemKey, n: number) => number): [ItemKey, number][] {
  const first = takeTransit(st, 'sk', hold, cap, takeOne), left = cap - first.reduce((a, [, n]) => a + n, 0);
  return [...first, ...takeHold(hold, left, only, takeOne)];
}
