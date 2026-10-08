// (0.183, PLAN_PLACOWEK.md stage O2) Outposts at the deposits in the wilds (gen/lodes.ts): a player drives a stake in
// by a deposit, then builds its extraction (a quarry crane, a logging camp, a mine head, a pumpjack or a deep shaft)
// and a storage shed from materials brought there. Once the extraction stands the deposit is worked by a fixed rate
// (its richness × the kind's rate, nothing simulated), the crates pile up on site (a few without a shed, many in one)
// and are hauled away by hand or by truck. Nobody pays for the deposit; power, people and defence come in O3–O5.
//
// Pure: the state is `Char.outposts[lode id]`, shared in multiplayer like the villages' (`towns`): whoever looks first
// settles it, the same way on every game. Every outpost has an owner from the start ('crew' in co-op; a player's pid
// in the rivals mode of stage O8).
import type { ItemKey } from '../data/items';
import { lodeGives, type Lode, type LodeKind } from './lodes';
import { isRare } from './deposits';
import { POWER_SRC, type PowerKind } from './grid';

export type OutpostPart = 'dig' | 'store' | 'power';
export interface OutpostState {
  /** Owner: 'crew' (co-op: everyone) or a player's pid (the rivals mode, stage O8). */
  o: string;
  /** Who drove the stake in, when; the deposit's kind, place and name (for the maps, without the generator). */
  by: string; t: number; k: LodeKind; x: number; z: number; name: string;
  done?: Partial<Record<OutpostPart, true>>;
  given?: Partial<Record<OutpostPart, Partial<Record<ItemKey, number>>>>;
  /** The one build going up: the part, its start and hours. */
  job?: { p: OutpostPart; t: number; h: number };
  /** The crates on site at game time `t` (settled forward by the rate). */
  stock?: { t: number; n: Partial<Record<ItemKey, number>> };
  /** (0.184, stage O3) The power source built (or going up) here, and its fuel bunker (crates at game time t). */
  pk?: PowerKind; fuel?: { n: number; t: number };
}
export type DigKind = 'quarry' | 'logging' | 'mine' | 'pump' | 'shaft';
export const digOf = (k: LodeKind): DigKind => (k === 'stone' ? 'quarry' : k === 'grove' ? 'logging' : k === 'oil' ? 'pump' : isRare(k) ? 'shaft' : 'mine');
export const DIG: Record<DigKind, { name: string; needs: [ItemKey, number][]; text: string }> = {
  quarry: { name: 'Quarry crane', needs: [['planks', 16], ['nails', 10], ['rope', 6], ['scrap', 6]], text: 'A timber derrick and a cutting floor: the crew splits the face into blocks.' },
  logging: { name: 'Logging camp', needs: [['planks', 12], ['nails', 8], ['rope', 4], ['scrap', 8]], text: 'A saw pit and a skid road: the giants are felled limb by limb and the trunks cut to length.' },
  mine: { name: 'Mine head', needs: [['planks', 24], ['nails', 12], ['rope', 6], ['scrap', 10]], text: 'A headframe over a shaft, a winch and an ore cart.' },
  pump: { name: 'Pumpjack', needs: [['scrap', 20], ['pipes', 4], ['parts', 2], ['planks', 8]], text: 'An old nodding pump over the seep, a tank and a drum filler.' },
  shaft: { name: 'Deep shaft', needs: [['steel', 4], ['cable', 4], ['parts', 2], ['planks', 20], ['nails', 10]], text: 'A steel headframe and a cage down to the rare ore.' },
};
export const STORE = { name: 'Storage shed', needs: [['planks', 20], ['nails', 12], ['stone', 8]] as [ItemKey, number][], text: 'A plank shed with racks: the crates keep there instead of piling in the open.' };
export const OUTPOST = {
  /** Crates an hour of the main good at richness 1 (common deposits, rare ones); the second good's share. */
  rate: 0.5, rare: 0.12, second: 0.4,
  /** Crates of each good on site: piled in the open, or in the shed. */
  pile: 6, cap: 60,
  /** Game hours to build; xp. */
  hours: { dig: 10, store: 8, power: 8 } as Record<OutpostPart, number>, xp: { dig: 80, store: 40, power: 60 } as Record<OutpostPart, number>,
};
export const partName = (k: LodeKind, p: OutpostPart, pk?: PowerKind) => (p === 'dig' ? DIG[digOf(k)].name : p === 'power' ? (pk ? POWER_SRC[pk].name : 'Power source') : STORE.name);
export const partNeeds = (k: LodeKind, p: OutpostPart, pk?: PowerKind): [ItemKey, number][] => (p === 'dig' ? DIG[digOf(k)].needs : p === 'power' ? (pk ? POWER_SRC[pk].needs : []) : STORE.needs);
/** Choose the power source to build here (only before anything is handed over for it). */
export function choosePower(o: OutpostState, pk: PowerKind): boolean {
  if (o.done?.power || o.job?.p === 'power' || Object.values(o.given?.power ?? {}).some((n) => (n ?? 0) > 0)) return false;
  o.pk = pk; return true;
}
/** A new outpost at deposit l. */
export const newOutpost = (l: Lode, by: string, now: number, owner = 'crew'): OutpostState => ({ o: owner, by, t: now, k: l.k, x: Math.round(l.x), z: Math.round(l.z), name: l.name });
/** May player `pid` work the outpost (co-op: everyone; the rivals mode: its owner). */
export const mayUse = (o: OutpostState, pid: string) => o.o === 'crew' || o.o === pid;
/** What the outpost digs an hour, per good. */
export function outputs(l: Lode): [ItemKey, number][] {
  const base = (isRare(l.k) ? OUTPOST.rare : OUTPOST.rate) * l.rich;
  return lodeGives(l).map((g, i) => [g, Math.round(base * (i ? OUTPOST.second : 1) * 1000) / 1000]);
}
export const capOf = (o: OutpostState) => (o.done?.store ? OUTPOST.cap : OUTPOST.pile);
/** The crates on site at `now`, without writing. */
export function stockNow(o: OutpostState, l: Lode, now: number, pw = 1): Partial<Record<ItemKey, number>> {
  if (!o.done?.dig || !o.stock) return { ...(o.stock?.n ?? {}) };
  const h = Math.max(0, now - o.stock.t) / 60 * pw, cap = capOf(o), out: Partial<Record<ItemKey, number>> = {};
  for (const [g, r] of outputs(l)) { const was = o.stock.n[g] ?? 0; out[g] = was >= cap ? was : Math.min(cap, was + r * h); }
  for (const g in o.stock.n) if (out[g as ItemKey] === undefined) out[g as ItemKey] = o.stock.n[g as ItemKey];
  return out;
}
/** Bring the stock forward to `now`. */
export function settle(o: OutpostState, l: Lode, now: number, pw = 1) {
  if (!o.done?.dig) return;
  o.stock = { t: Math.max(now, o.stock?.t ?? now), n: stockNow(o, l, now, pw) };
}
/** Take up to n whole crates of g; how many were taken. */
export function takeCrates(o: OutpostState, l: Lode, g: ItemKey, n: number, now: number, pw = 1): number {
  settle(o, l, now, pw);
  const have = Math.floor(o.stock?.n[g] ?? 0), m = Math.max(0, Math.min(n, have));
  if (m) o.stock!.n[g] = (o.stock!.n[g] ?? 0) - m;
  return m;
}
/** A part's materials with what was handed over. */
export function partPlan(o: OutpostState, p: OutpostPart) {
  return partNeeds(o.k, p, o.pk).map(([k, n]) => ({ k, n, given: Math.min(n, o.given?.[p]?.[k] ?? 0) }));
}
/** Why part p cannot be worked on now ('' = it can). */
export function partProblem(o: OutpostState, p: OutpostPart): string {
  if (o.done?.[p]) return 'It stands.';
  if (p === 'power' && !o.pk) return 'Choose a power source first.';
  if (o.job) return o.job.p === p ? 'The builders are at it.' : 'The builders are busy with the ' + partName(o.k, o.job.p, o.pk).toLowerCase() + '.';
  return '';
}
/** Hand over what part p still needs (bit by bit); with everything in, the builders start. */
export function handOver(o: OutpostState, p: OutpostPart, have: (k: ItemKey) => number, now: number) {
  const taken: [ItemKey, number][] = [];
  if (partProblem(o, p)) return { taken, started: false };
  const g = ((o.given ??= {})[p] ??= {});
  for (const r of partPlan(o, p)) {
    const n = Math.max(0, Math.min(r.n - r.given, Math.floor(have(r.k))));
    if (n) { g[r.k] = r.given + n; taken.push([r.k, n]); }
  }
  if (!partPlan(o, p).every((r) => r.given >= r.n)) return { taken, started: false };
  o.job = { p, t: now, h: OUTPOST.hours[p] };
  return { taken, started: true };
}
export const jobEnd = (o: OutpostState) => (o.job ? o.job.t + o.job.h * 60 : Infinity);
/** Finish the build if its time has come; the part finished, or null. */
export function finishDue(o: OutpostState, l: Lode, now: number, pw = 1): OutpostPart | null {
  if (!o.job || now < jobEnd(o)) return null;
  const p = o.job.p, end = jobEnd(o);
  settle(o, l, end, pw); // the stock up to the moment it stands (the old cap)
  (o.done ??= {})[p] = true; delete o.given?.[p]; delete o.job;
  if (p === 'dig') o.stock = { t: end, n: o.stock?.n ?? {} };
  return p;
}
/** Nothing built or handed over yet: the stake can be pulled up. */
export const bare = (o: OutpostState) => !o.done?.dig && !o.done?.store && !o.done?.power && !o.job && !Object.values(o.given ?? {}).some((g) => Object.values(g ?? {}).some((n) => (n ?? 0) > 0));
