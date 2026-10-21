// Crates and barrels (0.247, the owner's design): big things for moving bulk in vehicles. They do not go in the
// backpack (HANDS_ONLY): you carry one in your hands, and a vehicle carries them in its cargo bays, one a bay (a jeep
// 2, a van 6, the heavy truck 16; data/vehicles.ts `bays`). A crate holds building stuff (planks, stone, logs, ore,
// scrap...), a barrel holds a liquid (diesel, lamp oil, milk). Each holds one kind of thing at a time, kept on its
// slot as `Slot.b`. A steel one holds more than a wooden one but takes the same bay. Pure: no UI, no game state.
import { item, BULK, HANDS_ONLY, type ItemKey } from './items';
import type { Slot } from '../save';

export type CargoKind = 'crate' | 'barrel';
/** What each holds, in litres. */
export const CARGO: Partial<Record<ItemKey, { kind: CargoKind; cap: number }>> = {
  crateW: { kind: 'crate', cap: 60 }, crateM: { kind: 'crate', cap: 100 },
  barrelW: { kind: 'barrel', cap: 60 }, barrelM: { kind: 'barrel', cap: 100 },
};
/** Liquids a barrel takes, and how many litres one of the item is (a Fuel Canister is 20 L of diesel). */
export const LIQUID: Partial<Record<ItemKey, number>> = { fuel: 20, lampoil: 0.5, milk: 20 };
export const isCargo = (k: ItemKey | undefined | null) => !!k && CARGO[k] !== undefined;

/** Whether a crate / barrel of kind `box` takes item k. */
export function holds(box: ItemKey, k: ItemKey): boolean {
  const c = CARGO[box];
  if (!c || isCargo(k)) return false;
  if (c.kind === 'barrel') return LIQUID[k] !== undefined;
  return item(k).type === 'mat' && !HANDS_ONLY.has(k);
}
/** How many of k a full one holds. */
export const boxCap = (box: ItemKey, k: ItemKey) =>
  holds(box, k) ? Math.floor(CARGO[box]!.cap / (CARGO[box]!.kind === 'barrel' ? LIQUID[k]! : BULK[k][1]) + 1e-6) : 0;
/** How many more of k the crate / barrel in slot s takes (0 when it holds something else). */
export function boxRoom(s: Slot, k: ItemKey): number {
  if (s.b && s.b.k !== k) return 0;
  return Math.max(0, boxCap(s.k, k) - (s.b?.n ?? 0));
}
/** Moves up to `max` of the stack from[i] into the crate / barrel s. Returns how many went in. */
export function packFrom(s: Slot, from: (Slot | null)[], i: number, max = Infinity): number {
  const a = from[i];
  if (!a || a.c !== undefined || a.b) return 0;
  const m = Math.min(a.n, boxRoom(s, a.k), max);
  if (m <= 0) return 0;
  s.b = { k: a.k, n: (s.b?.n ?? 0) + m };
  if ((a.n -= m) <= 0) from[i] = null;
  return m;
}
/** Takes n of what s holds out of it (all by default). Returns how many came out. */
export function takeOut(s: Slot, n = Infinity): number {
  if (!s.b) return 0;
  const m = Math.min(n, s.b.n);
  if ((s.b.n -= m) <= 0) delete s.b;
  return m;
}
/** Weight of a slot, with what its crate or barrel holds (kg). */
export const slotKg = (s: Slot) => BULK[s.k][0] * s.n + (s.b ? BULK[s.b.k][0] * s.b.n : 0);
/** How full it is, 0..1. */
export const fill = (s: Slot) => (s.b ? s.b.n / Math.max(1, boxCap(s.k, s.b.k)) : 0);
