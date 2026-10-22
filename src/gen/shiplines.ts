// (0.217, PLAN_PRAD_I_LUDZIE.md stage Z3) Cargo lines between ports: a port (gen/ports.ts) opens a line to another port
// and hands a ship over to it (a Sailing Ship or a Motor Ship from your dock). The ship then sails on a timetable worked
// out from the line alone (like the outposts' convoy routes, gen/routes.ts): a round voyage every `period` minutes from
// the moment it was handed over. Each voyage loads what the home port's hold has (all goods, or only the ones chosen),
// up to the ship's load, and carries it to the other port. A voyage sails only when both ports have their crane's crew
// and power at its departure; a Motor Ship burns diesel from its tank (a dry tank misses voyages until canisters are
// poured in), a Sailing Ship burns nothing but now and then lies becalmed. Pirates come later.
//
// Two cumulative counters, each written by one side under its own port's lock: the line (on the home port) counts what
// its voyages delivered (`sent`), the other port counts what its crane took off into its hold (`rcv[home port id]`). A
// late or stale write can delay a delivery but never double or lose one. Pure.
import { hash } from '../core/rng';
import { worldDist } from './regions';
import { BOATS, type BoatKind } from './boats';
import type { OutpostState } from './outposts';
import { portPut, portTake, portWorks } from './ports';
import type { ItemKey } from '../data/items';
import { tl } from '../i18n';
import { noteArrival, takeTransit } from './transit';

export const LINE = {
  /** The furthest port a line may reach (m, straight); the sea way winds: this much longer. */
  reach: 40000, detour: 1.25,
  /** Kinds of ship that take a line; their pace (m a game minute), crates a slot of the hold, loading at each end (min). */
  ships: ['ship', 'steamer'] as BoatKind[], pace: { ship: 6, steamer: 9 } as Partial<Record<BoatKind, number>>, perSlot: 2, load: 40,
  /** A Motor Ship's diesel a km; a Sailing Ship's chance a voyage lies becalmed (missed). */
  lpkm: 2, calm: 0.15,
  /** How far behind the settling may fall before old voyages are skipped. */
  catchup: 200,
};
export interface LineShip { id: string; k: BoatKind; fuel?: number; by: string }
export type VoyageFate = 'ok' | 'idle' | 'dry' | 'calm';
export interface ShipLine {
  /** When it was opened (with the home port's id, the other port's counter key: `rcvKey`). */
  id: number;
  /** The other port: its id, name and middle (for the maps), and the sea way's length (km). */
  to: string; toName: string; tx: number; tz: number; km: number;
  /** The ship on the line (absent: the line waits for one) and the start of its timetable. */
  ship?: LineShip; t0?: number;
  /** The next voyage to settle; crates delivered so far (cumulative); only these goods (absent: everything). */
  k: number; sent: Partial<Record<ItemKey, number>>; only?: ItemKey[];
  /** The last voyage's fate and how many sailed. */
  last?: [number, VoyageFate]; trips?: number;
}
/** The other port's counter of what it took off a line (home port id + the line's opening time, so a new line starts at 0). */
export const rcvKey = (from: string, l: ShipLine) => from + '|' + l.id;
/** A new line from port `o` to port `to` (id `toId`). */
export function newLine(o: OutpostState, toId: string, to: OutpostState, now: number): ShipLine {
  const km = Math.round(worldDist(o.x, o.z, to.x, to.z) * LINE.detour / 100) / 10;
  return { id: Math.round(now), to: toId, toName: to.name, tx: to.x, tz: to.z, km, k: 0, sent: {} };
}
export const isLineShip = (k: BoatKind) => LINE.ships.includes(k);
/** Crates a ship carries a voyage. */
export const shipCap = (k: BoatKind) => BOATS[k].hold * LINE.perSlot;
/** Minutes one way, and a whole round voyage with loading at both ends. */
export const voyageOf = (l: ShipLine, k: BoatKind) => Math.ceil(l.km * 1000 / (LINE.pace[k] ?? 6));
export const periodOf = (l: ShipLine, k: BoatKind) => 2 * (voyageOf(l, k) + LINE.load);
/** Litres a round voyage burns (a Motor Ship; 0 under sail). */
export const voyageFuel = (l: ShipLine, k: BoatKind) => (BOATS[k].motor ? Math.round(2 * l.km * LINE.lpkm * 10) / 10 : 0);
/** Hand a ship over to the line; its timetable starts now. */
export function assignShip(l: ShipLine, s: LineShip, now: number) { l.ship = s; l.t0 = now; l.k = 0; delete l.last; }
/** Take the ship off the line (it comes back as it is). */
export function recallShip(l: ShipLine): LineShip | undefined { const s = l.ship; delete l.ship; delete l.t0; l.k = 0; return s; }
/** Pour up to n canisters into a Motor Ship's tank; how many went in. */
export function fuelShip(l: ShipLine, n: number): number {
  const s = l.ship, m0 = s ? BOATS[s.k].motor : undefined;
  if (!s || !m0) return 0;
  const room = Math.floor((m0.tank - (s.fuel ?? 0)) / m0.can + 1e-6), m = Math.max(0, Math.min(n, room));
  if (m) s.fuel = Math.min(m0.tank, (s.fuel ?? 0) + m * m0.can);
  return m;
}
/** Why a ship cannot take a line ('' = it can). */
export const shipProblem = (k: BoatKind) => (isLineShip(k) ? '' : tl('Only a Sailing Ship or a Motor Ship sails a cargo line.'));
/** Where the ship is at `now`: loading at home ('home'), sailing out ('out', 0..1), unloading there ('there'), back ('back'). */
export function shipAt(l: ShipLine, now: number): { at: 'home' | 'out' | 'there' | 'back' | 'none'; p: number } {
  const s = l.ship;
  if (!s || l.t0 === undefined) return { at: 'none', p: 0 };
  const P = periodOf(l, s.k), leg = voyageOf(l, s.k), ph = ((now - l.t0) % P + P) % P;
  if (ph < LINE.load) return { at: 'home', p: 0 };
  if (ph < LINE.load + leg) return { at: 'out', p: (ph - LINE.load) / leg };
  if (ph < 2 * LINE.load + leg) return { at: 'there', p: 1 };
  return { at: 'back', p: (ph - 2 * LINE.load - leg) / leg };
}
/** Will voyage k sail (read only: for the drawing and the maps; the settling decides for good)? */
const sailsMemo = new Map<string, boolean>();
export function voyageSails(world: number, outposts: Record<string, OutpostState>, id: string, k: number): boolean {
  const o = outposts[id], l = o?.line, s = l?.ship;
  if (!l || !s || l.t0 === undefined || !outposts[l.to]?.done?.port) return false;
  const key = `${world}|${id}|${l.t0}|${k}|${s.fuel ?? ''}|${l.k}`, had = sailsMemo.get(key);
  if (had !== undefined) return had;
  if (sailsMemo.size > 500) sailsMemo.clear();
  const v = sailsNow(world, outposts, id, k);
  sailsMemo.set(key, v);
  return v;
}
function sailsNow(world: number, outposts: Record<string, OutpostState>, id: string, k: number): boolean {
  const o = outposts[id], l = o.line!, s = l.ship!;
  const dep = l.t0! + k * periodOf(l, s.k) + LINE.load;
  if (portWorks(world, outposts, id, dep).why || portWorks(world, outposts, l.to, dep).why) return false;
  if (BOATS[s.k].motor) return k < l.k || (s.fuel ?? 0) >= voyageFuel(l, s.k);
  return (hash(world, o.x | 0, o.z | 0, k, 0x5a11) % 1000) / 1000 >= LINE.calm;
}
/** Where the line's ship is drawn at `now`: 0 at home, 1 at the other port (it waits at home when the voyage does not sail). */
export function shipPos(world: number, outposts: Record<string, OutpostState>, id: string, now: number): number | null {
  const l = outposts[id]?.line, s = l?.ship;
  if (!l || !s || l.t0 === undefined) return null;
  const k = Math.floor((now - l.t0) / periodOf(l, s.k)), at = shipAt(l, now);
  if (!voyageSails(world, outposts, id, k)) return 0;
  return at.at === 'home' ? 0 : at.at === 'out' ? at.p : at.at === 'there' ? 1 : 1 - at.p;
}
/** Voyages that have reached the other port by `now` and are not settled yet. */
export function dueVoyages(l: ShipLine, now: number): number {
  const s = l.ship;
  if (!s || l.t0 === undefined) return 0;
  return Math.max(0, Math.floor((now - l.t0 - LINE.load - voyageOf(l, s.k)) / periodOf(l, s.k)) - l.k + 1);
}
/** Settle the line of port `id` (under its lock): every voyage that has reached the other port by `now`, in order. A
 *  voyage sails when both ports' cranes worked at its departure, a Motor Ship had the diesel and a Sailing Ship the
 *  wind; it carries what the home hold has (the chosen goods, up to the ship's load). */
export function settleLine(world: number, outposts: Record<string, OutpostState>, id: string, now: number): { k: number; fate: VoyageFate; n: number }[] {
  const o = outposts[id], l = o?.line, out: { k: number; fate: VoyageFate; n: number }[] = [];
  const s = l?.ship;
  if (!l || !s || l.t0 === undefined) return out;
  const P = periodOf(l, s.k), leg = voyageOf(l, s.k), last = Math.floor((now - l.t0 - LINE.load - leg) / P);
  if (last - l.k > LINE.catchup) l.k = last - LINE.catchup;
  for (; l.k <= last; l.k++) {
    const dep = l.t0 + l.k * P + LINE.load;
    const fate = ((): VoyageFate => {
      if (!outposts[l.to]?.done?.port || portWorks(world, outposts, id, dep).why || portWorks(world, outposts, l.to, dep).why) return 'idle';
      if (BOATS[s.k].motor) { const need = voyageFuel(l, s.k); if ((s.fuel ?? 0) < need) return 'dry'; s.fuel = Math.round(((s.fuel ?? 0) - need) * 10) / 10; }
      else if ((hash(world, o.x | 0, o.z | 0, l.k, 0x5a11) % 1000) / 1000 < LINE.calm) return 'calm';
      return 'ok';
    })();
    let n = 0;
    if (fate === 'ok') {
      let room = shipCap(s.k);
      for (const [g, m] of takeTransit(o, 'sl', o.hold, room, (k, q) => portTake(o, k, q))) { l.sent[g] = (l.sent[g] ?? 0) + m; room -= m; n += m; } // (0.253) the goods sent on first
      for (const [g, have] of Object.entries(o.hold ?? {}) as [ItemKey, number][]) {
        if (room <= 0) break;
        if (l.only && !l.only.includes(g)) continue;
        const m = portTake(o, g, Math.min(room, have));
        if (m) { l.sent[g] = (l.sent[g] ?? 0) + m; room -= m; n += m; }
      }
      l.trips = (l.trips ?? 0) + 1;
    }
    l.last = [l.k, fate];
    out.push({ k: l.k, fate, n });
  }
  return out;
}
/** Crates the lines to port `id` delivered that its crane has not taken off yet (from each home port). */
export function arriving(outposts: Record<string, OutpostState>, id: string): { from: string; name: string; n: number }[] {
  const out: { from: string; name: string; n: number }[] = [], rcv = outposts[id]?.rcv ?? {};
  for (const [from, o] of Object.entries(outposts)) {
    const l = o?.line;
    if (!l || l.to !== id) continue;
    const got = rcv[rcvKey(from, l)], n = Object.entries(l.sent).reduce((a, [g, m]) => a + Math.max(0, (m ?? 0) - (got?.[g as ItemKey] ?? 0)), 0);
    out.push({ from, name: o.name, n });
  }
  return out;
}
/** At port `id`, under its lock and while its crane works: take what the lines delivered off into the hold (as much as
 *  fits); what was taken. */
export function unloadLines(world: number, outposts: Record<string, OutpostState>, id: string, now: number): [ItemKey, number][] {
  const p = outposts[id], got: [ItemKey, number][] = [];
  if (!p?.done?.port || portWorks(world, outposts, id, now).why) return got;
  for (const [from, o] of Object.entries(outposts)) {
    const l = o?.line;
    if (!l || l.to !== id) continue;
    const rcv = ((p.rcv ??= {})[rcvKey(from, l)] ??= {});
    for (const [g, n] of Object.entries(l.sent) as [ItemKey, number][]) {
      const m = portPut(p, g, Math.max(0, n - (rcv[g] ?? 0)));
      if (m) { rcv[g] = (rcv[g] ?? 0) + m; got.push([g, m]); noteArrival(p, rcvKey(from, l), g, m); }
    }
  }
  return got;
}
/** Other ports a line from `o` may reach, nearest first. */
export function lineTargets(outposts: Record<string, OutpostState>, id: string): { id: string; o: OutpostState; d: number }[] {
  const o = outposts[id];
  if (!o) return [];
  return Object.entries(outposts).filter(([q, p]) => q !== id && p?.k === 'port' && !!p.pier).map(([q, p]) => ({ id: q, o: p, d: worldDist(o.x, o.z, p.x, p.z) }))
    .filter((q) => q.d <= LINE.reach).sort((a, b) => a.d - b.d);
}
