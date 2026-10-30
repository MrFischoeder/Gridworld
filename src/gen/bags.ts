// (0.285, the owner's request) The backpack taken off: carried in both hands with everything in it, put down on the
// ground and picked up again, by you or anyone. Its contents (and the bigger pack you wore, if any) are the shared
// container `containers[id]`; a backpack lying on the ground is a record in the shared `Char.bags`. `held` on the
// container names the hero carrying it, so two players cannot both pick it up (the container's lock decides). Pure.
import type { Container, Slot } from '../save';
import type { ItemKey } from '../data/items';
import { INV_SIZE } from '../data/items';

export interface Bag {
  id: string;
  /** Who put it down (shown on the ground), and their pid. */
  by: string; pid: string;
  /** Where it lies (feet), the way it faces, and the place (`myLoc`). */
  x: number; y: number; z: number; yaw: number; loc: string;
  /** Game minute it was put down. */
  t: number;
}
/** The backpack's container: the backpack's slots, the pack worn with it, who carries it now. */
export type BagBox = Container;
export const BAG = { reach: 1.9, show: 160 };
export const bagId = (pid: string | number, t: number, n: number) => `bag:${pid}:${Math.round(t)}:${n}`;
export const isBagId = (k: string) => k.startsWith('bag:');
/** The container of a backpack just taken off: its slots (padded to the backpack's size), the pack worn with it. */
export function bagBox(inv: (Slot | null)[], pack: ItemKey | null | undefined, held: string): BagBox {
  const items = inv.map((s) => (s ? { ...s } : null));
  while (items.length < INV_SIZE) items.push(null);
  return { items, gold: 0, pack: pack ?? null, held };
}
/** Whether a lying backpack may be picked up (nobody carries it). */
export const bagFree = (box: BagBox | undefined) => !!box && !box.held;
