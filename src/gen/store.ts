// A village's storehouse by its industry site: what the site makes piles up in it, crate by crate, and goes out
// from it (caravans, local use, the goods you buy at the market). While it is full the site stands still: nothing
// more fits. The elder commissions a bigger one (a warehouse, then a depot) from the materials you bring.
//
// State: only an anchor per village (`TownState.store`: n crates at time t) and the tier; the fill at any other
// time follows from the site's output and the steady shipments, so an unvisited village needs no state at all
// (it starts from a hashed fill). Pure.
import { hash } from '../core/rng';
import type { TownState } from './town';
import type { ItemKey } from '../data/items';

export interface StoreTier { name: string; cap: number; needs: [ItemKey, number][]; gold: number; xp: number }
/** The tiers: capacity (crates) and what it takes to build the next one (index = the tier you have). */
export const STORE = {
  tiers: [
    { name: 'Storage Shed', cap: 40, needs: [['planks', 30], ['log', 12], ['nails', 25]], gold: 250, xp: 90 },
    { name: 'Warehouse', cap: 100, needs: [['planks', 40], ['stone', 40], ['scrap', 20], ['nails', 30]], gold: 600, xp: 200 },
    { name: 'Depot', cap: 220, needs: [], gold: 0, xp: 0 },
  ] as StoreTier[],
  /** Crates a game hour the site adds at full work, and how many go out every hour whatever happens. */
  rate: 1.2, ship: 0.7,
};
export const storeTier = (s: TownState | undefined) => Math.min(STORE.tiers.length - 1, s?.storeTier ?? 0);
export const storeCap = (s: TownState | undefined) => STORE.tiers[storeTier(s)].cap;
/** Crates in the storehouse at `now`, the site working at `prod` (0..1; gen/industry.ts production). */
export function storeAt(seed: number, s: TownState | undefined, now: number, prod: number): number {
  const cap = storeCap(s), a = s?.store ?? { n: cap * (0.3 + (hash(seed, 0x5707) % 600) / 1000), t: 0 };
  return Math.max(0, Math.min(cap, a.n + (STORE.rate * prod - STORE.ship) * (now - a.t) / 60));
}
/** Full: the site stands still until there is room again. */
export const storeFull = (seed: number, s: TownState | undefined, now: number, prod: number) => storeAt(seed, s, now, prod) >= storeCap(s) - 0.5;
/** Take n crates out (you bought them); returns how many there were. Re-anchors the state. */
export function takeStore(s: TownState, seed: number, n: number, now: number, prod: number): number {
  const have = storeAt(seed, s, now, prod), got = Math.min(n, Math.floor(have));
  s.store = { n: have - got, t: now };
  return got;
}
/** The next storehouse: what is still missing, or null at the biggest. */
export function storePlan(s: TownState | undefined) {
  const t = storeTier(s), f = STORE.tiers[t];
  if (t >= STORE.tiers.length - 1) return null;
  const rows = f.needs.map(([k, n]) => ({ k, n, given: Math.min(n, s?.sgiven?.[k] ?? 0) }));
  return { from: t, to: t + 1, rows, done: rows.every((r) => r.given >= r.n), gold: f.gold, xp: f.xp };
}
/** Hand over materials for the next storehouse (bit by bit); builds it once complete, keeping what is stored. */
export function handOverStore(s: TownState, seed: number, now: number, prod: number, have: (k: ItemKey) => number): { taken: [ItemKey, number][]; built: boolean } {
  const plan = storePlan(s);
  if (!plan) return { taken: [], built: false };
  s.sgiven ??= {};
  const taken: [ItemKey, number][] = [];
  for (const r of plan.rows) { const n = Math.min(r.n - r.given, have(r.k)); if (n > 0) { s.sgiven[r.k] = r.given + n; taken.push([r.k, n]); } }
  if (storePlan(s)!.done) {
    s.store = { n: storeAt(seed, s, now, prod), t: now }; // what is in the old one moves across
    s.storeTier = plan.to; s.sgiven = {};
    return { taken, built: true };
  }
  return { taken, built: false };
}
