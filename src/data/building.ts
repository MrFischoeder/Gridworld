// Building parts for a base on a claim (gen/claims.ts): what each one is made of, which tools it takes (they stay in
// the backpack), and which tool takes it down again. Pure data; gen/base.ts places them, world/building.ts draws them.
import type { ItemKey } from './items';

/**
 * Player bases on claims are closed for now: the game is turning towards helping the villages (fortifying them,
 * a house of your own in town). While false no new flag can be raised and nothing built (B), and the Flagpole,
 * Auto Turret and Code Lock are not sold; claims, parts, doors, locks and turrets already in a save keep working.
 */
export const BASES_OPEN = false;
/** Items that only serve player bases: kept out of the shops while BASES_OPEN is false. */
export const BASE_ITEMS: ItemKey[] = ['flagpole', 'codelock']; // the turret kit is sold: villages mount turrets on their walls
export const BASES_CLOSED_MSG = 'Building outside the villages is closed for now.';

export type PieceKind = 'wallW' | 'doorW' | 'roofW' | 'stairsW' | 'wallM' | 'doorM' | 'roofM' | 'stairsM' | 'turret';
/** 'roof' is a floor slab: the roof of the storey below and the floor of the one above. */
export type Shape = 'wall' | 'door' | 'roof' | 'stairs' | 'turret';
export interface PieceSpec {
  name: string; shape: Shape; mat: 'wood' | 'metal';
  needs: [ItemKey, number][]; tools: ItemKey[];
  /** The tool that takes it down (you get half the materials back, or `refund` when set). */
  cut: ItemKey;
  refund?: [ItemKey, number][];
}
export const PIECES: Record<PieceKind, PieceSpec> = {
  wallW: { name: 'Wooden Wall', shape: 'wall', mat: 'wood', needs: [['planks', 4], ['nails', 2]], tools: ['hammer', 'saw'], cut: 'hammer' },
  doorW: { name: 'Wooden Door', shape: 'door', mat: 'wood', needs: [['planks', 3], ['nails', 2], ['wire', 1]], tools: ['hammer', 'saw', 'screwdriver'], cut: 'hammer' },
  roofW: { name: 'Wooden Floor / Roof', shape: 'roof', mat: 'wood', needs: [['planks', 4], ['nails', 2], ['rope', 1]], tools: ['hammer', 'saw'], cut: 'hammer' },
  stairsW: { name: 'Wooden Stairs', shape: 'stairs', mat: 'wood', needs: [['planks', 6], ['nails', 3]], tools: ['hammer', 'saw'], cut: 'hammer' },
  wallM: { name: 'Metal Wall', shape: 'wall', mat: 'metal', needs: [['scrap', 4], ['wire', 1]], tools: ['welder', 'pliers'], cut: 'torch' },
  doorM: { name: 'Metal Door', shape: 'door', mat: 'metal', needs: [['scrap', 3], ['wire', 2]], tools: ['welder', 'pliers', 'screwdriver'], cut: 'torch' },
  roofM: { name: 'Metal Floor / Roof', shape: 'roof', mat: 'metal', needs: [['scrap', 3], ['wire', 1]], tools: ['welder'], cut: 'torch' },
  turret: { name: 'Auto Turret', shape: 'turret', mat: 'metal', needs: [['turretkit', 1], ['wire', 2]], tools: ['screwdriver', 'pliers'], cut: 'screwdriver', refund: [['turretkit', 1], ['wire', 1]] },
  stairsM: { name: 'Metal Stairs', shape: 'stairs', mat: 'metal', needs: [['scrap', 5], ['wire', 1]], tools: ['welder', 'pliers'], cut: 'torch' },
};
export const PIECE_KINDS = Object.keys(PIECES) as PieceKind[];
/**
 * The building grid (m): cells of `cell` metres round the flag; walls and doors stand on the cell edges, `thick`
 * thick and `wallH` high; a door leaves a `doorW` x `doorH` opening in the middle of its edge. Storeys are `storey`
 * apart: a floor slab (`slab` thick) on top of the walls is the roof below and the floor above. Walls go up to
 * storey `levels` - 1, floors and roofs to `levels`. Stairs take two cells and climb one storey.
 */
export const BUILD = { cell: 2, wallH: 2.8, thick: 0.2, doorW: 1.1, doorH: 2.2, slab: 0.2, storey: 3, levels: 3 };
/**
 * Auto turrets on a base: they shoot anything hostile within `range` they can see (not calm Brambles), turning their
 * head at `turn` rad/s, one shot of `dmg` every `rate` s; each shot makes `noise` (m). The head is `head` m above
 * the floor the turret stands on.
 */
export const TURRET = { range: 32, rate: 0.45, dmg: 1.4, turn: 3.2, noise: 30, head: 1.3 };
