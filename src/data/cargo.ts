// Crates and barrels (0.247, the owner's design): big things for moving bulk in vehicles. They do not go in the
// backpack (HANDS_ONLY): you carry one in your hands, and a vehicle carries them in its cargo bays, one a bay (a jeep
// 2, a van 6, the heavy truck 16; data/vehicles.ts `bays`). A crate holds building stuff (planks, stone, logs, ore,
// scrap...), a barrel holds a liquid (diesel, lamp oil, milk). Each holds one kind of thing at a time, kept on its
// slot as `Slot.b`. Pure: no UI, no game state.
//
// (0.251, the owner's rule) Nobody builds them for now: there is one crate and one barrel (`crateW`, `barrelW`; the old
// steel ones turn into them, `ONE_KIND`), and they come and go on their own. A crate is not a thing in itself but room
// for a heap: a few of a material fit in your pockets (`pocketOf`: 10 stones, more of small things), one more and the
// heap is a crate you carry in your hands (character.ts `settleCrates`); a stack dropped into an empty cargo bay is a
// crate there; and a crate or barrel emptied is gone (`dropEmpty`). Bigger crates built from materials come later.
import { item, BULK, HANDS_ONLY, type ItemKey } from './items';
import type { Slot } from '../save';

export type CargoKind = 'crate' | 'barrel';
/** What each holds, in litres. */
export const CARGO: Partial<Record<ItemKey, { kind: CargoKind; cap: number }>> = {
  crateW: { kind: 'crate', cap: 100 }, crateM: { kind: 'crate', cap: 100 },
  barrelW: { kind: 'barrel', cap: 100 }, barrelM: { kind: 'barrel', cap: 100 },
};
/** (0.251) One crate and one barrel: the old steel ones become them. */
export const ONE_KIND: Partial<Record<ItemKey, ItemKey>> = { crateM: 'crateW', barrelM: 'barrelW' };
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

// ---------- (0.251) crates that come and go ----------
/** Litres of a material your pockets (the backpack) keep loose; at least `POCKET.min` of anything. */
export const POCKET = { litres: 20, min: 10 };
/** How many of k you carry loose before the heap becomes a crate (10 stones, 13 planks, 40 wire...). */
export const pocketOf = (k: ItemKey) => Math.max(POCKET.min, Math.floor(POCKET.litres / Math.max(0.01, BULK[k][1]) + 1e-6));
/** The crate or barrel a heap of k goes into on its own, or null when k is not packed (goods, tools, weapons...). */
export const autoBox = (k: ItemKey): ItemKey | null => (holds('crateW', k) ? 'crateW' : holds('barrelW', k) ? 'barrelW' : null);
/** A crate / barrel with its load as a new slot (k into `autoBox(k)`). */
export const boxOf = (k: ItemKey, n: number): Slot | null => { const b = autoBox(k); return b && n > 0 ? { k: b, n: 1, b: { k, n } } : null; };
/** Empty crates and barrels in a list vanish, old steel ones become the one kind. Returns whether anything changed. */
export function dropEmpty(list: (Slot | null)[] | undefined): boolean {
  let ch = false;
  for (let i = 0; list && i < list.length; i++) {
    const s = list[i];
    if (!s || !isCargo(s.k)) continue;
    if (!s.b || s.b.n <= 0) { list[i] = null; ch = true; continue; }
    const one = ONE_KIND[s.k]; if (one) { s.k = one; ch = true; }
  }
  return ch;
}
