// NPC caravans on the roads between villages. There is no state at all: every road has a timetable that follows
// from the world seed. Caravans set out from one end and then the other in turn, every `period` game hours (some
// departures are skipped), and roll along the road at `speed`; so where every caravan is at any game time is a pure
// function, and on the future server every player sees the same ones. A caravan carries the goods its home makes,
// preferably one its destination wants (gen/market.ts); its setting out empties its home's stock of that good a
// little and its arrival fills the destination's, which moves the prices there (`caravanShift`, used by `quote`).
import { hash } from '../core/rng';
import { network, edgePath, type Edge } from './roads';
import { villageSeed } from './regions';
import { profileOf, type Good } from './market';

/** Speed (metres per game minute = per real second), the time between departures on a road (game minutes), the share skipped, and the market weight of a delivery. */
export const CARAVAN = { speed: 7, period: [360, 960] as const, skip: 0.25, weight: 0.25 };
/**
 * A caravan is a convoy: a heavy truck with the cargo between two gun jeeps. `back` is how far behind the lead
 * each vehicle rolls (metres, centre to centre).
 */
export const CONVOY = [{ model: 'scout', back: 0, gun: true }, { model: 'mastodon', back: 8.5, gun: false }, { model: 'scout', back: 17, gun: true }] as const;
export interface Caravan {
  id: string; road: string; k: number;
  /** Village ids and names it travels between (from → to). */
  from: number; to: number; fromName: string; toName: string;
  /** Departure time and travel time (game minutes). */
  t0: number; T: number;
  good: Good; n: number;
  /** Vehicles in the convoy (CONVOY). */
  wagons: number;
  /** Travels the road's points backwards (from its `to` end). */
  back: boolean;
}
const lenCache = new Map<string, number>();
function roadLength(world: number, e: Edge): number {
  const key = world + ':' + e.key;
  let L = lenCache.get(key);
  if (L === undefined) {
    const p = edgePath(world, e)?.pts ?? [];
    L = 0; for (let i = 0; i + 1 < p.length; i++) L += Math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]);
    lenCache.set(key, L);
  }
  return L;
}
const periodOf = (world: number, e: Edge) => CARAVAN.period[0] + (hash(world, e.a.id, e.b.id, 0xca7a) % (CARAVAN.period[1] - CARAVAN.period[0]));
const offsetOf = (world: number, e: Edge) => hash(world, e.a.id, e.b.id, 0xca7b) % periodOf(world, e);
/** Departure k on road e, or null when it is skipped (or the road has no way). */
export function caravanOf(world: number, e: Edge, k: number): Caravan | null {
  const h = hash(world, e.a.id, e.b.id, k, 0xca7c);
  if ((h % 1000) / 1000 < CARAVAN.skip) return null;
  const L = roadLength(world, e);
  if (L <= 0) return null;
  const back = (k & 1) === 1, [o, d] = back ? [e.b, e.a] : [e.a, e.b];
  const po = profileOf(world, o, villageSeed(world, o)), pd = profileOf(world, d, villageSeed(world, d));
  const good = po.makes.find((g) => pd.wants.includes(g)) ?? po.makes[(h >> 10) & 1];
  const wagons = CONVOY.length;
  return {
    id: e.key + ':' + k, road: 'road:' + e.key, k, from: o.id, to: d.id, fromName: o.name, toName: d.name,
    t0: k * periodOf(world, e) + offsetOf(world, e), T: L / CARAVAN.speed, good, n: 12 + ((h >> 16) % 19), wagons, back,
  };
}
/** Departures on road e with t0 in [t1, t2]. */
export function departures(world: number, e: Edge, t1: number, t2: number): Caravan[] {
  const P = periodOf(world, e), off = offsetOf(world, e), out: Caravan[] = [];
  for (let k = Math.max(0, Math.ceil((t1 - off) / P)); k * P + off <= t2; k++) { const c = caravanOf(world, e, k); if (c) out.push(c); }
  return out;
}
/** The caravans on road e at game time t. */
export function onRoad(world: number, e: Edge, t: number): Caravan[] {
  const L = roadLength(world, e);
  return departures(world, e, t - L / CARAVAN.speed, t).filter((c) => t < c.t0 + c.T);
}
/** How far along the road (metres from its start) vehicle w of caravan c is at time t. */
export const caravanS = (c: Caravan, t: number, w = 0) => Math.max(0, (t - c.t0) * CARAVAN.speed - CONVOY[w].back);

const byVillage = new Map<string, Edge[]>();
/** The roads that end at village vid. */
export function roadsOf(world: number, vid: number): Edge[] {
  const key = world + ':' + vid;
  let r = byVillage.get(key);
  if (!r) { r = network(world).filter((e) => e.a.id === vid || e.b.id === vid); byVillage.set(key, r); }
  return r;
}
/** How much caravans have shifted village vid's stock of each good by time `now` (decaying with `half` game minutes). */
export function caravanShift(world: number, vid: number, now: number, half: number): Partial<Record<Good, number>> {
  const out: Partial<Record<Good, number>> = {}, span = half * 5;
  for (const e of roadsOf(world, vid)) {
    for (const c of departures(world, e, now - span - roadLength(world, e) / CARAVAN.speed, now)) {
      const add = (at: number, n: number) => { if (at <= now) out[c.good] = (out[c.good] ?? 0) + n * CARAVAN.weight * Math.pow(0.5, (now - at) / half); };
      if (c.from === vid) add(c.t0, -c.n);
      if (c.to === vid) add(c.t0 + c.T, c.n);
    }
  }
  return out;
}
/** The most recent caravan to reach village vid (for the merchant's news). */
export function lastArrival(world: number, vid: number, now: number): Caravan | null {
  let best: Caravan | null = null;
  for (const e of roadsOf(world, vid)) for (const c of departures(world, e, now - 2 * 1440 - roadLength(world, e) / CARAVAN.speed, now))
    if (c.to === vid && c.t0 + c.T <= now && (!best || c.t0 + c.T > best.t0 + best.T)) best = c;
  return best;
}
/** Where caravan c's lead wagon is at time t (road coordinates round the road's first village), and its heading. */
export function caravanPos(world: number, e: Edge, c: Caravan, t: number, delay = 0): { x: number; z: number; yaw: number; s: number; L: number } | null {
  const pts = edgePath(world, e)?.pts;
  if (!pts) return null;
  const L = roadLength(world, e), s = Math.min(L, Math.max(0, (t - c.t0 - delay) * CARAVAN.speed)), at = c.back ? L - s : s;
  let rest = at;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], l = Math.hypot(bx - ax, bz - az);
    if (rest <= l || i + 2 === pts.length) { const f = l ? Math.min(1, rest / l) : 0; return { x: ax + (bx - ax) * f, z: az + (bz - az) * f, yaw: Math.atan2(bx - ax, bz - az) + (c.back ? Math.PI : 0), s, L }; }
    rest -= l;
  }
  return null;
}
/** Pay for escorting caravan c safely to its destination: more for longer roads and more dangerous land. */
export const escortPay = (c: Caravan, danger: number) => Math.round((40 + c.T * CARAVAN.speed / 1000 * 30) * (1 + danger * 0.25) / 5) * 5;
export { roadLength };
