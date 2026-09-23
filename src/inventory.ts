// Moving item stacks between slot lists (backpack, chest, trunk). Pure: no UI, no game state.
import { item, type ItemKey } from './data/items';
import type { Slot } from './save';

/** Puts n of k into the slots (topping up stacks first, then empty slots). Returns how many did not fit. */
export function putItems(slots: (Slot | null)[], k: ItemKey, n: number): number {
  const max = item(k).stack ?? 1;
  for (const s of slots) {
    if (n <= 0) break;
    if (s && s.k === k && s.n < max) { const m = Math.min(n, max - s.n); s.n += m; n -= m; }
  }
  for (let i = 0; i < slots.length && n > 0; i++) {
    if (slots[i]) continue;
    const m = Math.min(n, max); slots[i] = { k, n: m }; n -= m;
  }
  return n;
}

/** Moves the stack in from[i] into `to`. Whatever does not fit stays where it was. Returns how many moved. */
export function moveStack(from: (Slot | null)[], i: number, to: (Slot | null)[]): number {
  const s = from[i];
  if (!s) return 0;
  const left = putItems(to, s.k, s.n), moved = s.n - left;
  if (left > 0) s.n = left; else from[i] = null;
  return moved;
}

export const countFree = (slots: (Slot | null)[]) => slots.filter((s) => !s).length;
