// The village hall (pure): the village's one store, a hall outside its north wall with a terminal inside. Two things
// make up the village's stock there:
// - the hold: whatever you store (from your backpack, your vehicles parked by it, or crates set down on its floor),
//   limited by volume (BULK litres); you can take it back out at the terminal;
// - the village's own goods: what its industry makes piles up here, `OWN.rate` crates a game hour at full work split
//   over the goods it makes, while `OWN.use` an hour go out whatever happens (the villagers' own use, their caravans);
//   each good stops at `OWN.cap` and the site stands still. Only an anchor per good is saved (`TownState.own`), so an
//   unvisited village needs no state (it starts from a hashed fill); old saves' industry storehouse carries over.
// Every build of the village (farms, the power plant, works, walls, the blacksmith's orders) draws on the stock
// (`stockOf`): the hold first, then its own goods.
import { progressive, projectDone, resourceYield } from './settlement';
import { hash } from '../core/rng';
import { ITEMS, BULK, type ItemKey } from '../data/items';
import type { TownState } from './town';
import type { Poi } from './regions';
import { profileOf, type Good } from './market';
import { production, industryOf, industryProject } from './industry';
import { farmYield } from './farms';
import { sitePower } from './energy';
import { staffing } from './people';
import { GRIDHOLM_ID } from './regions';

/** The hall: plaza-local rect on the north side (outside the wall, west of the north gate; the door faces the wall), its height, and how much the hold takes (litres). */
export const HALL = { x0: 2, x1: 14, z0: -19, z1: -11, h: 4.2, door: 1.6, vol: 6000 };
/** The terminal inside, against the back wall (plaza-local), and where you stand to use it. */
export const HALL_TERMINAL = { x: 8, z: -17.9, stand: { x: 8, z: -16.6 } };

export const SMALL_HALL = { x0: 5, x1: 11, z0: -17, z1: -12, h: 3, door: 1.6, vol: 800 };
export const VEHICLE_HALL = { x0: 2, x1: 26, z0: -53, z1: -29, h: 6, door: 6, vol: 24000 };
export function hallSpec(s: TownState | undefined) { return progressive(s) ? (projectDone(s, 'warehouse') ? VEHICLE_HALL : SMALL_HALL) : HALL; }
export function hallTerminal(s: TownState | undefined) {
  const h = hallSpec(s); return { x: (h.x0 + h.x1) / 2, z: h.z0 + 1.1, stand: { x: (h.x0 + h.x1) / 2, z: h.z0 + 2.4 } };
}
const vol = (k: ItemKey) => BULK[k]?.[1] ?? 1;
/** Litres in the hold. */
export const holdVol = (s: TownState | undefined) => Object.entries(s?.hold ?? {}).reduce((a, [k, n]) => a + vol(k as ItemKey) * (n ?? 0), 0);
/** How many of k still fit. */
export const holdRoom = (s: TownState | undefined, k: ItemKey) => Math.max(0, Math.floor((hallSpec(s).vol - holdVol(s) + 1e-6) / vol(k)));
export const holdOf = (s: TownState | undefined, k: ItemKey) => s?.hold?.[k] ?? 0;
/** Store up to n of k (as much as fits); returns how many went in. */
export function deposit(s: TownState, k: ItemKey, n: number): number {
  const m = Math.max(0, Math.min(n, holdRoom(s, k)));
  if (m) (s.hold ??= {})[k] = holdOf(s, k) + m;
  return m;
}
/** Take up to n of k out of the hold; returns how many came out. */
export function withdraw(s: TownState, k: ItemKey, n: number): number {
  const m = Math.max(0, Math.min(n, holdOf(s, k)));
  if (m) { s.hold![k] = holdOf(s, k) - m; if (!s.hold![k]) delete s.hold![k]; }
  return m;
}

// ---------- the village's own goods: what its industry makes and what its farms grow ----------
export const OWN = { rate: 1.2, use: 0.7, cap: 60 };
function anchor(seed: number, s: TownState | undefined, g: ItemKey, i: number, m: number, now: number): { n: number; t: number } {
  const a = s?.own?.[g];
  if (a) return a;
  if (progressive(s)) return { n: 0, t: now };
  if (i < 0) return { n: 0, t: now }; // a farm crop not yet anchored (anchorNew sets it when the farm starts on it)
  return s?.store ? { n: s.store.n / m, t: s.store.t } : { n: OWN.cap * (0.15 + (hash(seed, 0x5707, i) % 400) / 1000), t: 0 };
}
/** Crates of own good g at `now`: the industry's share (the i-th of m goods it makes, at `prod`) plus the farms' `farm` crates a game hour; capped. */
export function ownAt(seed: number, s: TownState | undefined, g: ItemKey, i: number, m: number, now: number, prod: number, farm = 0): number {
  const a = anchor(seed, s, g, i, m, now), net = (i >= 0 ? (OWN.rate * prod - (progressive(s) ? 0 : OWN.use)) / m / 60 : 0) + farm / 60;
  return Math.max(0, Math.min(OWN.cap, a.n + net * (now - a.t)));
}
/** The village's stock: how many of k it has (hold + own goods, whole crates), taking some, its own goods. */
export interface Stock {
  /** Every own good (the industry's and the farms'), and those the industry makes. */
  own: ItemKey[]; makes: Good[]; prod: number;
  has(k: ItemKey): number; ownOf(g: ItemKey): number; take(k: ItemKey, n: number): number; takeOwn(g: ItemKey, n: number): number;
  /** The industry site stands still: every good it makes is at the cap. */
  full: boolean;
}
export function stockOf(world: number, v: Poi, seed: number, s: TownState | undefined, now: number): Stock {
  const makes = progressive(s) && industryProject(industryOf(world, v, seed)) ? [] : profileOf(world, v, seed).makes, prod = production(world, v, seed, s, now), m = Math.max(1, makes.length), fy = farmYield(seed, s);
  const resourcePower = progressive(s) ? .5 + .5 * sitePower(world, v, seed, s, now) : 1;
  for (const [k, n] of Object.entries(resourceYield(s))) {
    if (prod > 0 && industryProject(industryOf(world, v, seed)) && makes.includes(k as Good)) continue;
    fy[k as ItemKey] = (fy[k as ItemKey] ?? 0) + n! * resourcePower * staffing(seed, v.id === GRIDHOLM_ID, s, now);
  }
  const own = [...new Set<ItemKey>([...makes, ...(Object.keys(fy) as ItemKey[]), ...(progressive(s) ? Object.keys(s?.own ?? {}) as ItemKey[] : [])])];
  const ownOf = (g: ItemKey) => (own.includes(g) ? ownAt(seed, s, g, makes.indexOf(g as Good), m, now, prod, fy[g] ?? 0) : 0);
  const st: Stock = {
    own, makes, prod, ownOf,
    has: (k) => Math.floor(holdOf(s, k) + 1e-9) + Math.floor(ownOf(k) + 1e-9),
    take: (k, n) => {
      if (!s) return 0;
      const got = withdraw(s, k, Math.min(n, Math.floor(holdOf(s, k) + 1e-9)));
      return got + (got < n ? st.takeOwn(k, n - got) : 0);
    },
    // (the market, the share and hauls sell only the village's own goods, never what you stored)
    takeOwn: (g, n) => {
      if (!s || !own.includes(g)) return 0;
      const have = ownOf(g), more = Math.max(0, Math.min(n, Math.floor(have + 1e-9)));
      if (more) (s.own ??= {})[g] = { n: have - more, t: now };
      return more;
    },
    full: makes.length > 0 && makes.every((g) => ownOf(g) >= OWN.cap - 0.5),
  };
  return st;
}
/** Settle every own good's anchor at `now`: call before the farms or the site change (what they made so far is kept). */
export function settleOwn(world: number, v: Poi, seed: number, s: TownState, now: number) {
  const st = stockOf(world, v, seed, s, now);
  for (const g of st.own) (s.own ??= {})[g] = { n: st.ownOf(g), t: now };
}
/** After a change: goods newly grown start from nothing now. */
export function anchorNew(world: number, v: Poi, seed: number, s: TownState, now: number) {
  for (const g of stockOf(world, v, seed, s, now).own) if (!s.own?.[g]) (s.own ??= {})[g] = { n: 0, t: now };
}

/** Transfer only what fits, preserving unaccepted cargo. Used by the drive-in warehouse terminal. */
export function unloadCargo(s: TownState, slots: ({ k: ItemKey; n: number } | null)[]): number {
  let total = 0;
  for (let i = 0; i < slots.length; i++) {
    const a = slots[i]; if (!a || ['weapon', 'relic', 'quest'].includes(ITEMS[a.k].type) || a.k === 'key') continue;
    const n = deposit(s, a.k, a.n); a.n -= n; total += n; if (!a.n) slots[i] = null;
  }
  return total;
}
/** Whole vehicle footprint, including sideways parking, must fit inside the warehouse walls. */
export function cargoVehicleInside(rect: { x0: number; x1: number; z0: number; z1: number }, at: { x: number; z: number; heading: number }, spec: { width: number; length: number }): boolean {
  const sn = Math.abs(Math.sin(at.heading)), cs = Math.abs(Math.cos(at.heading));
  const hx = (sn * spec.length + cs * spec.width) / 2, hz = (cs * spec.length + sn * spec.width) / 2;
  return at.x - hx > rect.x0 + .15 && at.x + hx < rect.x1 - .15 && at.z - hz > rect.z0 + .15 && at.z + hz < rect.z1 - .15;
}

/** New settlement refineries consume actual stock, including crude produced while the village was unloaded. */
export function refineStock(world: number, v: Poi, seed: number, s: TownState, now: number): number {
  if (!progressive(s) || !projectDone(s, 'refinery')) return 0;
  const prev = s.settlement!.refinedAt ?? now;
  // Keep the fractional processing interval; pausing/reopening the UI cannot create extra batches.
  const batches = Math.max(0, Math.floor((now - prev) / 120));
  if (!batches) return 0;
  s.settlement!.refinedAt = prev + batches * 120;
  const st = stockOf(world, v, seed, s, now);
  const n = Math.min(batches, Math.floor(st.ownOf('fuel') < OWN.cap ? OWN.cap - st.ownOf('fuel') : 0), st.has('crude'));
  if (!n) return 0;
  const got = st.take('crude', n);
  (s.own ??= {}).fuel = { n: st.ownOf('fuel') + got, t: now };
  return got;
}
