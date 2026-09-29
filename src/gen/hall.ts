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
import { hash } from '../core/rng';
import { BULK, type ItemKey } from '../data/items';
import type { TownState } from './town';
import type { Poi } from './regions';
import { profileOf, type Good } from './market';
import { production } from './industry';

/** The hall: plaza-local rect on the north side (outside the wall, west of the north gate; the door faces the wall), its height, and how much the hold takes (litres). */
export const HALL = { x0: 2, x1: 14, z0: -19, z1: -11, h: 4.2, door: 1.6, vol: 6000 };
/** The terminal inside, against the back wall (plaza-local), and where you stand to use it. */
export const HALL_TERMINAL = { x: 8, z: -17.9, stand: { x: 8, z: -16.6 } };

const vol = (k: ItemKey) => BULK[k]?.[1] ?? 1;
/** Litres in the hold. */
export const holdVol = (s: TownState | undefined) => Object.entries(s?.hold ?? {}).reduce((a, [k, n]) => a + vol(k as ItemKey) * (n ?? 0), 0);
/** How many of k still fit. */
export const holdRoom = (s: TownState | undefined, k: ItemKey) => Math.max(0, Math.floor((HALL.vol - holdVol(s) + 1e-6) / vol(k)));
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

// ---------- the village's own goods ----------
export const OWN = { rate: 1.2, use: 0.7, cap: 60 };
function anchor(seed: number, s: TownState | undefined, g: Good, i: number, m: number): { n: number; t: number } {
  return s?.own?.[g] ?? (s?.store ? { n: s.store.n / m, t: s.store.t } : { n: OWN.cap * (0.15 + (hash(seed, 0x5707, i) % 400) / 1000), t: 0 });
}
/** Crates of its own good g (the i-th of m it makes) at `now`, the site working at `prod` (0..1). */
export function ownAt(seed: number, s: TownState | undefined, g: Good, i: number, m: number, now: number, prod: number): number {
  const a = anchor(seed, s, g, i, m), net = (OWN.rate * prod - OWN.use) / m / 60;
  return Math.max(0, Math.min(OWN.cap, a.n + net * (now - a.t)));
}
/** The village's stock: how many of k it has (hold + own goods, whole crates), taking some, its own goods. */
export interface Stock { own: Good[]; prod: number; has(k: ItemKey): number; ownOf(g: Good): number; take(k: ItemKey, n: number): number; takeOwn(g: Good, n: number): number; full: boolean }
export function stockOf(world: number, v: Poi, seed: number, s: TownState | undefined, now: number): Stock {
  const own = profileOf(world, v, seed).makes, prod = production(world, v, seed, s, now), m = Math.max(1, own.length);
  const ownOf = (g: Good) => { const i = own.indexOf(g); return i < 0 ? 0 : ownAt(seed, s, g, i, m, now, prod); };
  const st: Stock = {
    own, prod, ownOf,
    has: (k) => Math.floor(holdOf(s, k) + 1e-9) + Math.floor(ownOf(k as Good) + 1e-9),
    take: (k, n) => {
      if (!s) return 0;
      const got = withdraw(s, k, Math.min(n, Math.floor(holdOf(s, k) + 1e-9)));
      return got + (got < n ? st.takeOwn(k as Good, n - got) : 0);
    },
    // (the market, the share and hauls sell only the village's own goods, never what you stored)
    takeOwn: (g, n) => {
      if (!s || !own.includes(g)) return 0;
      const have = ownOf(g), more = Math.max(0, Math.min(n, Math.floor(have + 1e-9)));
      if (more) (s.own ??= {})[g] = { n: have - more, t: now };
      return more;
    },
    // the site stands still once every good it makes is at the cap
    full: own.length > 0 && own.every((g) => ownOf(g) >= OWN.cap - 0.5),
  };
  return st;
}
/** Settle the own goods' anchors at `now` (call before the site's production changes: a raid, a repair, a farm). */
export function settleOwn(world: number, v: Poi, seed: number, s: TownState, now: number) {
  const st = stockOf(world, v, seed, s, now);
  for (const g of st.own) (s.own ??= {})[g] = { n: st.ownOf(g), t: now };
}
