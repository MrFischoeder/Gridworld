// (0.250, PLAN_MAGAZYNOW.md stage M2) Racks in a warehouse: empty crates and barrels (data/cargo.ts) put on its racks let
// it keep more. Goods packed in crates and liquids in barrels stack tidily on the shelves instead of lying loose, so
// each one adds `RACK.gain` times its own size to the hold: a wooden crate or barrel 150 L, a steel one 250 L, up to
// `RACK.max` of them a warehouse. They come off again while what is stored still fits without them.
//
// Pure: the counts live with the warehouse (`TownState.racks` for a village's hall or warehouse, `OutpostState.racks`
// for a port's or a wild one), shared online and changed only under its lock.
import type { ItemKey } from '../data/items';
import { CARGO, isCargo } from '../data/cargo';

export const RACK = { gain: 2.5, max: 40 };
export type Racks = Partial<Record<ItemKey, number>>;
/** How many crates and barrels stand on the racks. */
export const rackCount = (r: Racks | undefined) => Object.values(r ?? {}).reduce((a: number, n) => a + (n ?? 0), 0);
/** The litres the racks add to the hold. */
export const rackVol = (r: Racks | undefined) => Object.entries(r ?? {}).reduce((a, [k, n]) => a + (CARGO[k as ItemKey]?.cap ?? 0) * RACK.gain * (n ?? 0), 0);
/** What one crate or barrel of kind k adds. */
export const rackGain = (k: ItemKey) => (CARGO[k]?.cap ?? 0) * RACK.gain;
/** Why crate or barrel k cannot go on the racks ('' = it can): only an empty one, and while there is room. */
export function rackProblem(r: Racks | undefined, k: ItemKey, loaded: boolean): string {
  if (!isCargo(k)) return 'not';
  if (loaded) return 'loaded';
  return rackCount(r) >= RACK.max ? 'full' : '';
}
/** Put a crate or barrel of kind k on the racks (check `rackProblem` first). */
export function putRack(r: Racks, k: ItemKey) { r[k] = (r[k] ?? 0) + 1; }
/** Take one of kind k off the racks, if there is one and the hold (`used` of its `cap` litres) still fits without it. */
export function takeRack(r: Racks, k: ItemKey, used: number, cap: number): boolean {
  if (!(r[k] ?? 0) || used > cap - rackGain(k) + 1e-6) return false;
  if (!(r[k] = (r[k] ?? 0) - 1)) delete r[k];
  return true;
}
