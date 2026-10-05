// The village's stock (gen/hall.ts stockOf: the hall's hold and its own goods) for the panels: every build of a
// village draws on it, never on your backpack. Bring things to the village hall and store them at its terminal.
import { G } from '../game';
import { ITEMS, type ItemKey } from '../data/items';
import { findPoi, villageSeed } from '../gen/regions';
import { stockOf, refineStock, type Stock } from '../gen/hall';
import { online, net, lockTown, unlockTown } from '../net/client';
import { showToast } from './hud';
import { initializeSettlements } from '../gen/settlement';

/** No inventory is changed until the shared stock is reserved and refreshed from the server. */
export async function withTownStock(vid: number, action: () => void): Promise<boolean> {
  if (!online()) { action(); return true; }
  const key = String(vid), connection = net.id;
  const locked = await lockTown(key, G.char.towns[key] ?? {});
  if (!locked || net.id !== connection) { if (locked && net.id === connection) unlockTown(key); showToast('The village stock is in use. Try again shortly.'); return false; }
  try {
    // A persisted 0.131 room may return a town before its deposit metadata was migrated locally.
    initializeSettlements(G.char);
    action(); return true;
  }
  finally { unlockTown(key, G.char.towns[key]); }
}

/** The stock of village `vid` now (its state created if need be, so taking works). */
export function stockAt(vid: number): Stock | null {
  const c = G.char, poi = findPoi(c.world, vid);
  if (poi) refineStock(c.world, poi, villageSeed(c.world, poi), (c.towns[vid] ??= {}), c.time);
  return poi ? stockOf(c.world, poi, villageSeed(c.world, poi), (c.towns[vid] ??= {}), c.time) : null;
}
/** How many of k village `vid` has in stock. */
export const stockHas = (vid: number) => { const s = stockAt(vid); return (k: ItemKey) => s?.has(k) ?? 0; };
/** Take what a build used out of the stock. */
export function stockTake(vid: number, taken: [ItemKey, number][]) { const s = stockAt(vid); if (s) for (const [k, n] of taken) s.take(k, n); }
/** "in the hall: n" for a row still short, or "done". */
export const hallNote = (have: number, given: number, n: number) => (given >= n ? ' · done' : ` · in the village hall: ${have}`);
/** What a build still lacks in the stock, in words (empty: nothing). */
export function lacking(rows: { k: ItemKey; n: number; given: number }[], has: (k: ItemKey) => number): string {
  const miss = rows.filter((r) => r.given + has(r.k) < r.n).map((r) => `${r.n - r.given - has(r.k)} ${ITEMS[r.k].name}`);
  return miss.length ? `The village hall still lacks ${miss.join(', ')}: store them at its terminal (outside the north gate).` : '';
}
/** The button every build panel shows. */
export const buildButton = (attr: string, what: string, can: boolean) => `<button class="opt" ${attr} ${can ? '' : 'disabled'}>Build from the village hall's stock (${what})</button>`;
