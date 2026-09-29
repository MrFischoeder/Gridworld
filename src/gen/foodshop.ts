// The village food shop (pure): the grocer cooks from the village's stock (gen/hall.ts: its farms' harvest, its own
// goods and what you stored). A crate of an input makes `per` portions of a dish; the shop keeps the portions it has
// cooked (`TownState.pantry`) and opens the next crate from the hall when they run out. What the village has not got,
// the shop has not got, but for bread: without grain in the hall the grocer still bakes a little from bought flour, dearer.
import type { ItemKey } from '../data/items';
import type { TownState } from './town';

export interface Dish { k: ItemKey; price: number; from: ItemKey[]; per: number; fallback?: number }
export const MENU: Dish[] = [
  { k: 'bread', price: 8, from: ['grain'], per: 10, fallback: 16 },
  { k: 'stew', price: 18, from: ['potatoes', 'carrots'], per: 8 },
  { k: 'eggsB', price: 5, from: ['eggs'], per: 12 },
  { k: 'milkC', price: 4, from: ['milk'], per: 10 },
  { k: 'cheese', price: 14, from: ['milk'], per: 5 },
];
/** The village's stock as the shop sees it. */
export interface Larder { has(k: ItemKey): number; take(k: ItemKey, n: number): number }
/** Portions of dish d the shop can sell now (cooked, and from the crates in the hall); Infinity when it falls back on bought flour. */
export function portions(d: Dish, s: TownState | undefined, l: Larder): number {
  const n = (s?.pantry?.[d.k] ?? 0) + d.from.reduce((a, i) => a + l.has(i) * d.per, 0);
  return n > 0 ? n : d.fallback ? Infinity : 0;
}
/** Today's price of dish d (dearer when it comes from bought flour). */
export const priceOf = (d: Dish, s: TownState | undefined, l: Larder) => ((s?.pantry?.[d.k] ?? 0) + d.from.reduce((a, i) => a + l.has(i), 0) > 0 ? d.price : d.fallback ?? d.price);
/** Sell one portion: from the pantry, else a crate from the hall is opened; false when there is none. */
export function sellPortion(d: Dish, s: TownState, l: Larder): boolean {
  s.pantry ??= {};
  if ((s.pantry[d.k] ?? 0) > 0) { s.pantry[d.k]! -= 1; return true; }
  const i = d.from.find((x) => l.has(x) > 0);
  if (i && l.take(i, 1)) { s.pantry[d.k] = d.per - 1; return true; }
  return !!d.fallback;
}
