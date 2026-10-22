// (0.254, PLAN_LOTNICTWA.md stage F1) Cargo drones between warehouses. A warehouse with a drone pad (`PAD`: a
// village's `TownState.dpad`, built from its stock as the timed job 'dronepad'; a port's or a wild warehouse's part
// 'pad') opens an air line to another warehouse with a pad on its radio network within `DRONE.reach`, and a cargo drone
// (the item 'cargodrone', made by the blacksmith with the plans 'aviation') is set on it. On a timetable from that
// moment it flies straight there and back, over sea and mountains alike: at each departure it loads a few crates from
// the home hold (the goods sent on through it first, gen/transit.ts way 'al', then the goods picked or anything), and
// charges at home while the home warehouse works. A storm at the home warehouse keeps it down, so does a silent radio
// or a missing pad at the other end; over dangerous land a flight may be lost, the drone and its load with it.
//
// Like the convoy lines (gen/hublines.ts): the line lives on its home warehouse and counts what it delivered
// (`sent`, under the home's lock); the other warehouse counts what it took in (`rcv['al:<home>:<id>']`, under its own
// lock, only while it works), so a stale write delays a delivery but never doubles it. Pure.
//
// (0.255, stage F2) A pad serves up to `DRONE.lines` air lines (`alines`), each to a different warehouse with a drone
// of its own; a 0.254 save's single `aline` is read as the first and moved into the list by the first write under the
// home's lock (`ownAirLines`). A village's pad is staked out with a Survey Stake once its materials are in (`dpWait`,
// `placePad`, world/fields.ts): `dpspot` (world, canonical x) is where `padAt` puts it, and it keeps trees off
// (gen/fields.ts `padClaim`, a claim that levels nothing).
import { hash } from '../core/rng';
import { dangerAt } from './danger';
import { allVillages, villageSeed, worldDist, nearX } from './regions';
import { weatherAt } from './weather';
import { hubWorks, type Hub } from './warehouses';
import { padOf } from './energy';
import { startJob, jobOf } from './construction';
import { takeHold } from './hublines';
import { noteArrival, takeTransit, dropWay, renameWay, type Transit, type Way } from './transit';
import { PAD, DRONE } from './dronepad';
import type { ItemKey } from '../data/items';
import type { TownState } from './town';
import type { OutpostState } from './outposts';

export type AirTrip = 'ok' | 'silent' | 'storm' | 'nopad' | 'flat' | 'empty' | 'lost';
export interface AirLine {
  /** When it was opened (its id), the warehouse it serves, its name and place, the way's length (km, straight). */
  id: number; to: string; toName: string; tx: number; tz: number; km: number;
  /** The drone on it (who set it there; absent: the line waits for one) and the start of its timetable; the next trip. */
  drone?: { by: string }; t0?: number; k: number;
  /** Only these goods (absent: anything in the hold); delivered so far (cumulative); drones lost. */
  only?: ItemKey[]; sent: Partial<Record<ItemKey, number>>; lost?: number;
  /** The last flight's fate, flights flown. */
  last?: [number, AirTrip]; trips?: number;
}

// ---------- the pad ----------
/** A village pad's materials with what was handed over. */
export const padPlan = (s: TownState | undefined) => PAD.needs.map(([k, n]) => ({ k, n, given: Math.min(n, s?.dgiven?.[k] ?? 0) }));
/** Hand over what the village's pad still needs (from the stock); with all of it in, the builders start. */
export function handOverPad(s: TownState, have: (k: ItemKey) => number, at: number): { taken: [ItemKey, number][]; started: boolean; wait?: boolean } {
  const taken: [ItemKey, number][] = [];
  if (s.dpad || s.dpWait || jobOf(s, 'dronepad')) return { taken, started: false };
  const g = (s.dgiven ??= {});
  for (const r of padPlan(s)) { const n = Math.max(0, Math.min(r.n - r.given, Math.floor(have(r.k)))); if (n) { g[r.k] = r.given + n; taken.push([r.k, n]); } }
  if (!padPlan(s).every((r) => r.given >= r.n)) return { taken, started: false };
  if (!s.dpspot) { s.dpWait = true; return { taken, started: false, wait: true }; } // (0.255) the hero stakes out where it goes, then the builders start: placePad
  startJob(s, 'dronepad', undefined, at, PAD.hours);
  return { taken, started: true };
}
/** (0.255) The pad's spot is staked out (`spot` world, canonical x): the builders start. False when nothing waits for it. */
export function placePad(s: TownState, spot: { x: number; z: number }, now: number): boolean {
  if (!s.dpWait || s.dpad || jobOf(s, 'dronepad')) return false;
  s.dpspot = { x: Math.round(spot.x), z: Math.round(spot.z) }; delete s.dpWait;
  startJob(s, 'dronepad', undefined, now, PAD.hours);
  return true;
}
/** The builders are done (gen/jobs.ts). */
export function completePad(s: TownState, now: number) { s.dpad = now; delete s.dgiven; }
/** Where warehouse h's pad lies: where it was staked out (a village's, `towns`), else 18 m out from the warehouse, away from its village's middle (else by hash). */
export function padAt(world: number, h: Hub, towns?: Record<string, TownState | undefined>): { x: number; z: number; a: number } {
  const v = h.kind === 'village' ? allVillages(world).find((q) => q.id === h.vid) : undefined;
  const sp = v && towns?.[v.id]?.dpspot;
  if (v && sp) { const a = Math.atan2(sp.z - v.z, sp.x - v.x); return { x: sp.x, z: sp.z, a: Number.isFinite(a) ? a : 0 }; }
  let a = v ? Math.atan2(h.z - v.z, nearX(h.x, v.x) - v.x) : ((hash(h.x | 0, h.z | 0, 0x9ad) % 628) / 100);
  if (!Number.isFinite(a)) a = 0;
  return { x: h.x + Math.cos(a) * 18, z: h.z + Math.sin(a) * 18, a };
}
/** Whether warehouse h has a pad. */
export const hasPad = (h: Hub, towns: Record<string, TownState | undefined>, outposts: Record<string, OutpostState | undefined>) =>
  h.kind === 'village' ? !!towns[h.vid!]?.dpad : !!outposts[h.id]?.done?.pad;
/** Why h's pad does not work ('' = it works): none, the warehouse stands idle, no hand, no power. */
export function padWhy(world: number, h: Hub, towns: Record<string, TownState | undefined>, outposts: Record<string, OutpostState>, t: number): '' | 'none' | 'idle' | 'hands' | 'power' {
  if (!hasPad(h, towns, outposts)) return 'none';
  if (!hubWorks(world, h, towns, outposts, t)) return 'idle';
  if (h.kind === 'village') { const v = allVillages(world).find((q) => q.id === h.vid); if (v) return padOf(world, v, villageSeed(world, v), towns[v.id], t).why; }
  return '';
}

// ---------- the line ----------
/** The other warehouse's counter key for an air line. */
export const alKey = (home: string, l: AirLine) => 'al:' + home + ':' + l.id;
export function newAirLine(a: Hub, b: Hub, now: number): AirLine {
  const km = Math.round(worldDist(a.x, a.z, b.x, b.z) / 100) / 10;
  return { id: Math.round(now), to: b.id, toName: b.name, tx: Math.round(b.x), tz: Math.round(b.z), km, k: 0, sent: {} };
}
/** Minutes one way; a whole round trip with loading at both ends. */
export const alLeg = (l: AirLine) => Math.max(1, Math.ceil(l.km * 1000 / DRONE.pace));
export const alPeriod = (l: AirLine) => 2 * (alLeg(l) + DRONE.load);
/** The chance a flight is lost (the danger half way). */
export function alLose(world: number, home: { x: number; z: number }, l: AirLine): number {
  return Math.min(DRONE.loseMax, DRONE.lose + DRONE.losePer * dangerAt(world, (home.x + nearX(l.tx, home.x)) / 2, (home.z + l.tz) / 2));
}
/** Where the drone is at `now`: on the pad, flying out / back (0..1), at the other end, or parked. */
export function alAt(l: AirLine, now: number): { at: 'home' | 'out' | 'there' | 'back' | 'parked'; p: number } {
  if (!l.drone || l.t0 === undefined) return { at: 'parked', p: 0 };
  if (l.last && l.last[1] !== 'ok' && now - (l.t0 + l.last[0] * alPeriod(l)) < alPeriod(l)) return { at: 'parked', p: 0 };
  const P = alPeriod(l), leg = alLeg(l), ph = ((now - l.t0) % P + P) % P;
  if (ph < DRONE.load) return { at: 'home', p: 0 };
  if (ph < DRONE.load + leg) return { at: 'out', p: (ph - DRONE.load) / leg };
  if (ph < 2 * DRONE.load + leg) return { at: 'there', p: 1 };
  return { at: 'back', p: (ph - 2 * DRONE.load - leg) / leg };
}
/** A flight due by `now` (its arrival has passed). */
export const alDue = (l: AirLine, now: number) => !!l.drone && l.t0 !== undefined && Math.floor((now - l.t0 - DRONE.load - alLeg(l)) / alPeriod(l)) >= l.k;
/**
 * Settle the flights that reached the other warehouse by `now`, in order (under the home's lock): `linked` = the two
 * talk over the radio now, `padThere` = the other warehouse's pad works now, `charge` = the drone charges at home (its
 * warehouse works), `take(cap)` loads from the home hold (returns what it took).
 */
export function settleAirLine(world: number, home: { x: number; z: number }, l: AirLine, linked: boolean, padThere: boolean, charge: boolean, take: (cap: number, only?: ItemKey[]) => [ItemKey, number][], now: number): AirTrip[] {
  const out: AirTrip[] = [];
  if (!l.drone || l.t0 === undefined) return out;
  const P = alPeriod(l), last = Math.floor((now - l.t0 - DRONE.load - alLeg(l)) / P);
  if (last - l.k > DRONE.catchup) l.k = last - DRONE.catchup;
  for (; l.k <= last && l.drone; l.k++) {
    const dep = l.t0 + l.k * P + DRONE.load;
    const fate = ((): AirTrip => {
      if (!linked) return 'silent';
      if (!padThere) return 'nopad';
      if (!charge) return 'flat';
      if (weatherAt(world, home.x, home.z, dep).storm >= DRONE.storm) return 'storm';
      return 'ok';
    })();
    if (fate !== 'ok') { l.last = [l.k, fate]; out.push(fate); continue; }
    const cargo = take(DRONE.cap, l.only);
    if (!cargo.length) { l.last = [l.k, 'empty']; out.push('empty'); continue; }
    l.trips = (l.trips ?? 0) + 1;
    if ((hash(world, l.id, l.k, l.to.length, 0xa1f7) % 10000) / 10000 < alLose(world, home, l)) {
      l.lost = (l.lost ?? 0) + 1; l.last = [l.k, 'lost']; out.push('lost');
      delete l.drone; delete l.t0; l.k++;
      break;
    }
    for (const [g, n] of cargo) l.sent[g] = (l.sent[g] ?? 0) + n;
    l.last = [l.k, 'ok']; out.push('ok');
  }
  return out;
}
/** (0.255) The way line l's cargo goes on by (gen/transit.ts). */
export const alWay = (l: AirLine): Way => `al:${l.id}`;
/** What line l loads: the goods sent on by it first, then the hold as set. */
export function airLoad(st: Transit, l: AirLine, hold: Partial<Record<ItemKey, number>> | undefined, cap: number, takeOne: (k: ItemKey, n: number) => number): [ItemKey, number][] {
  const first = takeTransit(st, alWay(l), hold, cap, takeOne), left = cap - first.reduce((a, [, n]) => a + n, 0);
  return [...first, ...takeHold(hold, left, l.only, takeOne)];
}
type Lined = { aline?: AirLine; alines?: AirLine[] } & Transit;
/** (0.255) A warehouse's air lines (a 0.254 save's single line first). Read only. */
export const airLinesOf = (st: Lined | undefined): AirLine[] => [...(st?.aline ? [st.aline] : []), ...(st?.alines ?? [])];
/** (0.255) The list to change (under the home's lock): a 0.254 line moves into it, its way on 'al' becoming its own. */
export function ownAirLines(st: Lined): AirLine[] {
  const list = (st.alines ??= []);
  if (st.aline) { list.unshift(st.aline); renameWay(st, 'al', alWay(st.aline)); delete st.aline; }
  return list;
}
/** Every air line: [its home warehouse's id, the line]. */
export function allAirLines(towns: Record<string, TownState | undefined>, outposts: Record<string, OutpostState | undefined>): [string, AirLine][] {
  const out: [string, AirLine][] = [];
  for (const [id, s] of Object.entries(towns)) for (const l of airLinesOf(s)) out.push(['v:' + id, l]);
  for (const [id, o] of Object.entries(outposts)) for (const l of airLinesOf(o)) out.push([id, l]);
  return out;
}
/** Warehouse `id`'s air lines. */
export const airLinesFor = (id: string, towns: Record<string, TownState | undefined>, outposts: Record<string, OutpostState | undefined>) =>
  airLinesOf(id.startsWith('v:') ? towns[id.slice(2)] : outposts[id]);
/** What the air lines brought to warehouse `dest` that it has not taken in: [counter key, good, how many]. */
export function alWaiting(dest: string, towns: Record<string, TownState | undefined>, outposts: Record<string, OutpostState | undefined>, rcv: Record<string, Partial<Record<ItemKey, number>>> | undefined): [string, ItemKey, number][] {
  const out: [string, ItemKey, number][] = [];
  for (const [home, l] of allAirLines(towns, outposts)) {
    if (l.to !== dest) continue;
    const key = alKey(home, l), got = rcv?.[key] ?? {};
    for (const [g, n] of Object.entries(l.sent) as [ItemKey, number][]) { const m = n - (got[g] ?? 0); if (m > 0) out.push([key, g, m]); }
  }
  return out;
}
/** The other warehouse takes in what the drones brought (under its lock): `put` stores as much as fits. */
export function alDrain(dest: string, towns: Record<string, TownState | undefined>, outposts: Record<string, OutpostState | undefined>, rcvOwner: { rcv?: Record<string, Partial<Record<ItemKey, number>>> } & Transit, put: (k: ItemKey, n: number) => number): [ItemKey, number][] {
  const got: [ItemKey, number][] = [];
  for (const [key, g, n] of alWaiting(dest, towns, outposts, rcvOwner.rcv)) {
    const m = put(g, n);
    if (m) { const r = ((rcvOwner.rcv ??= {})[key] ??= {}); r[g] = (r[g] ?? 0) + m; got.push([g, m]); noteArrival(rcvOwner, key, g, m); }
  }
  return got;
}
/** A warehouse gives up air line l: the goods waiting to go on by it stay in the hold. */
export const dropAirWay = (st: Transit, l: AirLine) => dropWay(st, alWay(l));
