// The village hall (pure): a storage hall outside every village's north wall, with a terminal inside. Whatever you
// store there (from your backpack, your vehicles parked by it, or crates set down on its floor) becomes the village's
// own stock: its builds will draw on it (the next step), and you can take it back out at the terminal. The hold is
// limited by volume (BULK litres). Beside it, the terminal shows the village's own goods in its industry storehouse
// (gen/store.ts), which belong to the same stock.
import { BULK, type ItemKey } from '../data/items';
import type { TownState } from './town';

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
