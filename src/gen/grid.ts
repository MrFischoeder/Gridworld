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
import { latitude, worldDist, wrapDx } from './regions';
import { windAt, type Balance } from './energy';
import type { ItemKey } from '../data/items';
import { digOf, settle, PORT, turretsOf, type OutpostState, type DigKind } from './outposts';
import type { Lode } from './lodes';
import { crewFactor, settleLife, crews } from './outpostlife';
import { settleRaids } from './outpostraids';
import { procKw, runProc } from './outpostproc';
import { settleRoute, takeFood, routeKey } from './routes';
import type { TownState } from './town';
import { tl } from '../i18n';
import { RADIO } from './radiomast';

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
  generator: { name: tl('Diesel generator'), text: tl('A generator set in a steel box: steady power while it has fuel.'), needs: [['scrap', 16], ['parts', 2], ['wire', 6], ['planks', 8]], r: 350, kw: 40, fuel: 'fuel', burn: 180, bunker: 20 },
  wind: { name: tl('Wind turbine'), text: tl('A lattice mast with three blades: free power, as much as the wind gives.'), needs: [['planks', 20], ['scrap', 10], ['wire', 8], ['gears', 2]], r: 500, kw: 60 },
  solar: { name: tl('Solar panels'), text: tl('Rows of old panels on frames: power by day, none at night.'), needs: [['glass', 6], ['wire', 8], ['scrap', 6], ['circuit', 2]], r: 250, kw: 45 },
  coal: { name: tl('Coal boiler'), text: tl('A brick boiler house with a stack, burning coal: strong, steady power with a long reach.'), needs: [['stone', 20], ['scrap', 20], ['pipes', 4], ['parts', 2]], r: 700, kw: 90, fuel: 'coal', burn: 120, bunker: 20 },
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
export const demandOf = (o: OutpostState) => (o.done?.dig ? DIG_KW[digOf(o.k)] : 0) + (o.done?.port ? PORT.kw : 0) + procKw(o) + (o.route?.truck?.parts.ev !== undefined ? CHARGE_KW : 0) + turretsOf(o) * OUT_GUN_KW + (o.done?.radio ? RADIO.kw : 0);
/** (0.188) What a route's electric truck draws while it charges at its outpost (kW, counted all the time). */
export const CHARGE_KW = 15;
const isSource = (o: OutpostState) => !!(o.done?.power && o.pk);
/** (0.219, stage Z5) An outpost whose power line to a village stands. */
export const lined = (o: OutpostState | undefined) => !!(o?.k && o.done?.pline && o.pl);
export const reachOf = (o: OutpostState) => (o.pk ? POWER_SRC[o.pk].r : 0);

/** The grids: each outpost id → its grid number (only outposts a source reaches; the others are off-grid). */
export function grids(outposts: Record<string, OutpostState>): Map<string, number> {
  const ids = Object.keys(outposts).filter((id) => outposts[id]?.k), src = ids.filter((id) => isSource(outposts[id]));
  const up = new Map<string, string>([...src, ...ids.filter((id) => lined(outposts[id]))].map((s) => [s, s])); // (0.219) a lined outpost is a grid of its own when no source reaches it
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
    if (s && lined(o)) join(s, id);
  }
  for (const id of ids) {
    const o = outposts[id], s = src.find((q) => d(outposts[q], o) <= reachOf(outposts[q])) ?? (lined(o) ? id : undefined);
    if (!s) continue;
    const root = find(s);
    if (!num.has(root)) num.set(root, num.size);
    out.set(id, num.get(root)!);
  }
  return out;
}
/** Each grid's supply and demand at time t, and the share of its demand it meets (1 with no demand). */
export function gridState(world: number, outposts: Record<string, OutpostState>, g: Map<string, number>, t: number, raw = false) {
  const supply: number[] = [], demand: number[] = [];
  for (const [id, n] of g) { const o = outposts[id]; supply[n] = (supply[n] ?? 0) + supplyAt(world, id, o, t); demand[n] = (demand[n] ?? 0) + demandOf(o); }
  if (!raw) for (const [id, f] of lineFlows(world, outposts, t, g)) { const n = g.get(id); if (n === undefined) continue; if (f > 0) demand[n] += f; else supply[n] -= f; } // (0.219) what the lines carry
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
/**
 * (0.221, PLAN_PRAD_I_LUDZIE.md stage Z7) An outpost's turrets: each draws `OUT_GUN_KW` from its grid (in `demandOf`)
 * and wants a guard from the settlers (gen/outpostlife.ts crews: after the fields, before the dig). A turret fires
 * only with its guard and while the outpost has at least `OUT_GUN_POWER` of its power over the day; off the grid or
 * below that none fires. Pure: the raids settle with it at their end, the game fires by it.
 */
export const OUT_GUN_KW = 3, OUT_GUN_POWER = 0.25;
export interface OutGuns { n: number; work: number; guards: number; power: number; why: '' | 'hands' | 'power' }
export function outGunsAt(world: number, outposts: Record<string, OutpostState>, id: string, t: number): OutGuns {
  const o = outposts[id], n = o ? turretsOf(o) : 0;
  if (!n) return { n, work: 0, guards: 0, power: 1, why: '' };
  const guards = crews(o, o.life?.n ?? 0).guard, power = powerShare(world, outposts, id, t), work = power < OUT_GUN_POWER ? 0 : guards;
  return { n, work, guards, power, why: power < OUT_GUN_POWER ? 'power' : guards < n ? 'hands' : '' };
}
/** What the share does to the outpost's digging: `unpowered` with none, full rate with all it needs. */
export const powerFactor = (share: number) => GRID.unpowered + (1 - GRID.unpowered) * share;
/** Bring every working outpost's stock forward at its present factor (before the grid or the people change, and every
 *  two hours), then its people (0.185, stage O4: gen/outpostlife.ts). */
export function settleAll(world: number, outposts: Record<string, OutpostState>, lodeOf: (id: string) => Lode | null, now: number, towns?: Record<string, TownState>) {
  const raided: { id: string; k: number; won: boolean; road?: string }[] = [];
  for (const [id, o] of Object.entries(outposts)) {
    if (!o?.k) continue;
    const l = o.done?.dig ? lodeOf(id) : null, pw = () => powerFactor(powerShare(world, outposts, id, now)) * crewFactor(o);
    for (const r of settleRaids(world, id, o, l, now, l ? pw() : 1, (t) => outGunsAt(world, outposts, id, t).work)) raided.push({ id, ...r }); // (0.186) the raids whose time is over, in order
    if (o.route) { // (0.187) the convoys: trips that reached the village, then food the village shipped back
      for (const r of settleRoute(world, o, l, now, l ? pw() : 1, grids(outposts).has(id))) raided.push({ id, k: r.k, won: false, road: r.what });
      const shipped = towns?.[o.route.v]?.ship?.[routeKey(id)];
      if (shipped) takeFood(world, o, shipped, now);
    }
    if (l) { settle(o, l, now, pw()); runProc(o, l, now, powerFactor(powerShare(world, outposts, id, now))); } // (0.188) the works on site
    settleLife(world, o, now);
  }
  return raided;
}
/** The factor an outpost digs at now: power × its dig crew (1 for one that does not dig yet). */
export const pwOf = (world: number, outposts: Record<string, OutpostState>, id: string, now: number) =>
  outposts[id]?.done?.dig ? powerFactor(powerShare(world, outposts, id, now)) * crewFactor(outposts[id]) : 1;

// ---------- (0.219, PLAN_PRAD_I_LUDZIE.md stage Z5) power lines ----------
/** A line of poles and cable from an outpost (or a port) to a village within `reach` m: whichever side has power to
 *  spare feeds the other's shortfall, at most `cap` kW. Materials per km of line (poles, wire, insulators) and the
 *  transformers at its ends; hours and xp by its length. One line an outpost, one a village. */
export const PLINE = {
  reach: 6000, cap: 60, gap: 40, end: 62, start: 18,
  perKm: [['planks', 12], ['wire', 10], ['scrap', 3]] as [ItemKey, number][],
  ends: [['cable', 2], ['parts', 1]] as [ItemKey, number][],
  hours: (km: number) => Math.round(4 + 2 * km), xp: (km: number) => Math.round(40 + 20 * km),
};
/** The line's far end: the village it runs to (its middle, canonical x) and its length. */
export interface PowerLine { v: number; name: string; x: number; z: number; km: number }
export const newLine = (o: OutpostState, v: { id: number; name: string; x: number; z: number }): PowerLine =>
  ({ v: v.id, name: v.name, x: v.x, z: v.z, km: Math.round(Math.max(0.2, (worldDist(o.x, o.z, v.x, v.z) - PLINE.end - PLINE.start) / 1000) * 100) / 100 });
export function plineNeeds(km: number): [ItemKey, number][] {
  const k = Math.max(0.5, km), out = new Map<ItemKey, number>();
  for (const [i, n] of PLINE.perKm) out.set(i, Math.ceil(n * k));
  for (const [i, n] of PLINE.ends) out.set(i, (out.get(i) ?? 0) + n);
  return [...out];
}
/** Why outpost `id` cannot run a line to village `vid` ('' = it can). */
export function plineProblem(outposts: Record<string, OutpostState>, id: string, v: { id: number; x: number; z: number }): string {
  const o = outposts[id];
  if (!o || o.k === 'camp') return tl('Not here.');
  if (o.pl && (o.done?.pline || o.job?.p === 'pline' || Object.values(o.given?.pline ?? {}).some((n) => (n ?? 0) > 0))) return tl('A line is staked out here already.');
  if (worldDist(o.x, o.z, v.x, v.z) > PLINE.reach) return tl('Too far.');
  for (const [q, p] of Object.entries(outposts)) if (q !== id && p?.pl?.v === v.id) return tl('Another line runs to that village already.');
  return '';
}
/** The poles along a line (world x, z, canonical at the outpost's side): every `gap` m from `start` past the outpost to `end` short of the village. */
export function linePoles(o: OutpostState, l: PowerLine): [number, number][] {
  const dx = wrapDx(l.x - o.x), dz = l.z - o.z, d = Math.hypot(dx, dz) || 1, len = Math.max(0, d - PLINE.end - PLINE.start), n = Math.max(1, Math.round(len / PLINE.gap));
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i++) { const s = (PLINE.start + len * i / n) / d; out.push([o.x + dx * s, o.z + dz * s]); }
  return out;
}
/** A village's raw balance (without its line), as the game sees it (world/powerlines.ts); unset: no line carries anything. */
let lineBal: ((vid: number, t: number) => Balance | null) | null = null;
const flowMemo = new Map<string, Map<string, number>>();
export const setLineBalance = (f: typeof lineBal) => { lineBal = f; flowMemo.clear(); };
/** Forget the worked-out flows (the shared state changed). */
export const clearLineMemo = () => flowMemo.clear();
/**
 * What each standing line carries at time t: outpost id → kW into its village (negative: out of the village into the
 * grid). Worked out from the grids and the villages without the lines, in the lines' order: a village with power left
 * over feeds its grid's shortfall, a grid with power left over feeds the village's; never more than `PLINE.cap`.
 */
export function lineFlows(world: number, outposts: Record<string, OutpostState>, t: number, g = grids(outposts)): Map<string, number> {
  const out = new Map<string, number>();
  if (!lineBal) return out;
  const ids = Object.keys(outposts).filter((id) => lined(outposts[id])).sort();
  if (!ids.length) return out;
  const key = `${world}|${t}`, hit = flowMemo.get(key);
  if (hit) return hit;
  const st = gridState(world, outposts, g, t, true), spare = st.supply.map((s, n) => (s ?? 0) - (st.demand[n] ?? 0));
  for (const id of ids) {
    const o = outposts[id], n = g.get(id), b = n === undefined ? null : lineBal(o.pl!.v, t);
    if (!b || n === undefined) continue;
    let f = 0;
    if (b.free > 0 && (spare[n] ?? 0) < 0) f = -Math.min(PLINE.cap, b.free, -spare[n]);
    else if (b.short > 0 && (spare[n] ?? 0) > 0) f = Math.min(PLINE.cap, b.short, spare[n]);
    spare[n] = (spare[n] ?? 0) - f;
    if (f) out.set(id, Math.round(f * 10) / 10);
  }
  if (flowMemo.size > 400) flowMemo.clear();
  flowMemo.set(key, out);
  return out;
}
/** What village `vid`'s line carries into it at t (kW; negative: out of it). */
export function lineInto(world: number, outposts: Record<string, OutpostState>, vid: number, t: number): number {
  for (const [id, o] of Object.entries(outposts)) if (lined(o) && o.pl!.v === vid) return lineFlows(world, outposts, t).get(id) ?? 0;
  return 0;
}
/** The outpost whose line runs to village `vid` (built or going up). */
export const lineOfVillage = (outposts: Record<string, OutpostState>, vid: number): [string, OutpostState] | null =>
  Object.entries(outposts).find(([, o]) => o?.pl?.v === vid && (o.done?.pline || o.job?.p === 'pline')) ?? null;
