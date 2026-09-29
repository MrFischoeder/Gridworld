// Boats, built by the players at their piers (gen/piers.ts). Pure: the kinds, what they take, building one bit by
// bit, and where one floats. The runtime (world/boats.ts) rows, sails and draws them.
//
// Stage 1: the rowboat. Stage 2 adds a sailboat (wind from gen/weather.ts), stage 3 a motor boat.
import type { ItemKey } from '../data/items';

export type BoatKind = 'row';
export interface BoatSpec {
  name: string;
  /** Length, beam and draught (m): it needs `draft` + `keel` of water under it. */
  len: number; beam: number; draft: number;
  /** Top speed through the water (m/s), backing speed as a share of it, turning (rad/s). */
  speed: number; back: number; turn: number;
  /** Slots of its hold. */
  hold: number;
  /** What building one takes, and the experience for it. */
  needs: [ItemKey, number][]; xp: number;
  blurb: string;
}
export const BOATS: Record<BoatKind, BoatSpec> = {
  row: {
    name: 'Rowboat', len: 4.2, beam: 1.5, draft: 0.35, speed: 3.6, back: 0.5, turn: 0.9, hold: 10,
    needs: [['log', 10], ['nails', 14], ['rope', 4]], xp: 120,
    blurb: 'a clinker-built rowboat with a pair of oars: slow and tiring on a long pull, but it goes wherever there is water enough, sea, river or lake, and carries ten loads in its bottom',
  },
};
/** Water a boat needs under its keel besides its draught (m). */
export const KEEL = 0.15;

/** A boat of yours, where it lies (saved in `char.boats`; the hold is `char.containers[id]`). */
export interface Boat { id: string; k: BoatKind; x: number; z: number; yaw: number; t: number }
/** A boat going up at a pier (saved on the pier). */
export interface BoatBuild { k: BoatKind; given: Partial<Record<ItemKey, number>> }

export interface BoatRow { k: ItemKey; n: number; given: number }
export const boatRows = (b: BoatBuild): BoatRow[] => BOATS[b.k].needs.map(([k, n]) => ({ k, n, given: b.given[k] ?? 0 }));
/** Hand over what you have (`have`); true once the boat is complete. */
export function handOverBoat(b: BoatBuild, have: (k: ItemKey) => number): { taken: [ItemKey, number][]; built: boolean } {
  const taken: [ItemKey, number][] = [];
  for (const r of boatRows(b)) { const n = Math.min(r.n - r.given, have(r.k)); if (n > 0) { b.given[r.k] = r.given + n; taken.push([r.k, n]); } }
  return { taken, built: boatRows(b).every((r) => r.given >= r.n) };
}
/** Can a boat of this kind float over water this deep? */
export const floats = (k: BoatKind, depth: number) => depth >= BOATS[k].draft + KEEL;
