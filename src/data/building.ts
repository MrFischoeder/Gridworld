// Building parts for a base on a claim (gen/claims.ts): what each one is made of, which tools it takes (they stay in
// the backpack), and which tool takes it down again. Pure data; gen/base.ts places them, world/building.ts draws them.
import type { ItemKey } from './items';

export type PieceKind = 'wallW' | 'doorW' | 'roofW' | 'stairsW' | 'wallM' | 'doorM' | 'roofM' | 'stairsM';
/** 'roof' is a floor slab: the roof of the storey below and the floor of the one above. */
export type Shape = 'wall' | 'door' | 'roof' | 'stairs';
export interface PieceSpec {
  name: string; shape: Shape; mat: 'wood' | 'metal';
  needs: [ItemKey, number][]; tools: ItemKey[];
  /** The tool that takes it down (you get half the materials back). */
  cut: ItemKey;
}
export const PIECES: Record<PieceKind, PieceSpec> = {
  wallW: { name: 'Wooden Wall', shape: 'wall', mat: 'wood', needs: [['planks', 4], ['nails', 2]], tools: ['hammer', 'saw'], cut: 'hammer' },
  doorW: { name: 'Wooden Door', shape: 'door', mat: 'wood', needs: [['planks', 3], ['nails', 2], ['wire', 1]], tools: ['hammer', 'saw', 'screwdriver'], cut: 'hammer' },
  roofW: { name: 'Wooden Floor / Roof', shape: 'roof', mat: 'wood', needs: [['planks', 4], ['nails', 2], ['rope', 1]], tools: ['hammer', 'saw'], cut: 'hammer' },
  stairsW: { name: 'Wooden Stairs', shape: 'stairs', mat: 'wood', needs: [['planks', 6], ['nails', 3]], tools: ['hammer', 'saw'], cut: 'hammer' },
  wallM: { name: 'Metal Wall', shape: 'wall', mat: 'metal', needs: [['scrap', 4], ['wire', 1]], tools: ['welder', 'pliers'], cut: 'torch' },
  doorM: { name: 'Metal Door', shape: 'door', mat: 'metal', needs: [['scrap', 3], ['wire', 2]], tools: ['welder', 'pliers', 'screwdriver'], cut: 'torch' },
  roofM: { name: 'Metal Floor / Roof', shape: 'roof', mat: 'metal', needs: [['scrap', 3], ['wire', 1]], tools: ['welder'], cut: 'torch' },
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
