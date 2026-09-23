// Moving item stacks between slot lists (backpack, chest, trunk). Pure: no UI, no game state.
import { item, type ItemKey } from './data/items';
import type { Slot } from './save';

/** Worn parts (with a condition) never stack; everything else stacks up to its item's limit. */
export const stackable = (a: Slot, b: Slot) => a.k === b.k && a.c === undefined && b.c === undefined;
const maxOf = (k: ItemKey) => item(k).stack ?? 1;

/** Puts n of k into the slots (topping up stacks first, then empty slots). Returns how many did not fit. */
export function putItems(slots: (Slot | null)[], k: ItemKey, n: number): number {
  const max = maxOf(k);
  for (const s of slots) {
    if (n <= 0) break;
    if (s && s.k === k && s.c === undefined && s.n < max) { const m = Math.min(n, max - s.n); s.n += m; n -= m; }
  }
  for (let i = 0; i < slots.length && n > 0; i++) {
    if (slots[i]) continue;
    const m = Math.min(n, max); slots[i] = { k, n: m }; n -= m;
  }
  return n;
}
/** Puts a whole slot (e.g. a worn tire with its condition) somewhere in the list. Returns how many did not fit. */
export function putSlot(slots: (Slot | null)[], s: Slot): number {
  if (s.c === undefined) return putItems(slots, s.k, s.n);
  const f = slots.indexOf(null);
  if (f < 0) return s.n;
  slots[f] = { ...s }; return 0;
}

/** Moves the stack in from[i] into `to`. Whatever does not fit stays where it was. Returns how many moved. */
export function moveStack(from: (Slot | null)[], i: number, to: (Slot | null)[]): number {
  const s = from[i];
  if (!s) return 0;
  const left = putSlot(to, s), moved = s.n - left;
  if (left > 0) s.n = left; else from[i] = null;
  return moved;
}

/**
 * Drag and drop: the stack in from[i] lands on to[j]. An empty target takes it, a matching stack is topped up
 * (the rest stays behind), anything else swaps places. from and to may be the same list.
 */
export function dropStack(from: (Slot | null)[], i: number, to: (Slot | null)[], j: number): void {
  const a = from[i], b = to[j];
  if (!a || (from === to && i === j)) return;
  if (!b) { to[j] = a; from[i] = null; return; }
  if (stackable(a, b)) {
    const m = Math.min(a.n, maxOf(b.k) - b.n);
    b.n += m; a.n -= m;
    if (a.n <= 0) from[i] = null;
    return;
  }
  to[j] = a; from[i] = b;
}

export const countFree = (slots: (Slot | null)[]) => slots.filter((s) => !s).length;
