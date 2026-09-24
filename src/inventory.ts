// Moving item stacks between slot lists (backpack, chest, trunk). Pure: no UI, no game state.
import { item, BULK, type ItemKey } from './data/items';
import type { Slot } from './save';

/** Worn parts (with a condition) never stack; everything else stacks up to its item's limit. */
export const stackable = (a: Slot, b: Slot) => a.k === b.k && a.c === undefined && b.c === undefined;
const maxOf = (k: ItemKey) => item(k).stack ?? 1;

/** Total weight (kg) and bulk (litres) of what the slots hold. */
export const weightOf = (slots: (Slot | null)[]) => slots.reduce((a, s) => a + (s ? BULK[s.k][0] * s.n : 0), 0);
export const bulkOf = (slots: (Slot | null)[]) => slots.reduce((a, s) => a + (s ? BULK[s.k][1] * s.n : 0), 0);
/** How many more of k fit into a list holding at most `cap` litres (no cap: any number). */
export const roomFor = (slots: (Slot | null)[], k: ItemKey, cap?: number) =>
  cap === undefined ? Infinity : Math.max(0, Math.floor((cap - bulkOf(slots)) / BULK[k][1] + 1e-6));

/**
 * Puts n of k into the slots (topping up stacks first, then empty slots), no more than fits into `cap` litres.
 * Returns how many did not fit.
 */
export function putItems(slots: (Slot | null)[], k: ItemKey, n: number, cap?: number): number {
  const over = Math.max(0, n - roomFor(slots, k, cap));
  n -= over;
  const max = maxOf(k);
  for (const s of slots) {
    if (n <= 0) break;
    if (s && s.k === k && s.c === undefined && s.n < max) { const m = Math.min(n, max - s.n); s.n += m; n -= m; }
  }
  for (let i = 0; i < slots.length && n > 0; i++) {
    if (slots[i]) continue;
    const m = Math.min(n, max); slots[i] = { k, n: m }; n -= m;
  }
  return n + over;
}
/** Puts a whole slot (e.g. a worn tire with its condition) somewhere in the list. Returns how many did not fit. */
export function putSlot(slots: (Slot | null)[], s: Slot, cap?: number): number {
  if (s.c === undefined) return putItems(slots, s.k, s.n, cap);
  const f = slots.indexOf(null);
  if (f < 0 || roomFor(slots, s.k, cap) < 1) return s.n;
  slots[f] = { ...s }; return 0;
}

/** Moves the stack in from[i] into `to`. Whatever does not fit stays where it was. Returns how many moved. */
export function moveStack(from: (Slot | null)[], i: number, to: (Slot | null)[], cap?: number): number {
  const s = from[i];
  if (!s) return 0;
  const left = putSlot(to, s, cap), moved = s.n - left;
  if (left > 0) s.n = left; else from[i] = null;
  return moved;
}

/**
 * Drag and drop: the stack in from[i] lands on to[j]. An empty target takes it, a matching stack is topped up
 * (the rest stays behind), anything else swaps places. from and to may be the same list. `capTo` / `capFrom` limit
 * the bulk (litres) the lists may end up holding (the backpack has one, containers do not): only as many items as
 * fit are moved, and a swap that would overfill either side is refused. Returns whether anything moved.
 */
export function dropStack(from: (Slot | null)[], i: number, to: (Slot | null)[], j: number, capTo?: number, capFrom?: number): boolean {
  const a = from[i], b = to[j];
  if (!a || (from === to && i === j)) return false;
  const room = from === to ? Infinity : roomFor(to, a.k, capTo);
  if (!b) {
    const m = Math.min(a.n, room);
    if (m <= 0) return false;
    if (m === a.n) { to[j] = a; from[i] = null; } else { to[j] = { ...a, n: m }; a.n -= m; }
    return true;
  }
  if (stackable(a, b)) {
    const m = Math.min(a.n, maxOf(b.k) - b.n, room);
    if (m <= 0) return false;
    b.n += m; a.n -= m;
    if (a.n <= 0) from[i] = null;
    return true;
  }
  if (from !== to) {
    const va = BULK[a.k][1] * a.n, vb = BULK[b.k][1] * b.n;
    if (capTo !== undefined && bulkOf(to) - vb + va > capTo + 1e-6) return false;
    if (capFrom !== undefined && bulkOf(from) - va + vb > capFrom + 1e-6) return false;
  }
  to[j] = a; from[i] = b;
  return true;
}

export const countFree = (slots: (Slot | null)[]) => slots.filter((s) => !s).length;
