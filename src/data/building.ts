// Building parts for a base on a claim (gen/claims.ts): what each one is made of, which tools it takes (they stay in
// the backpack), and which tool takes it down again. Pure data; gen/base.ts places them, world/building.ts draws them.
import type { ItemKey } from './items';

export type PieceKind = 'wallW' | 'doorW' | 'roofW' | 'wallM' | 'doorM' | 'roofM';
export type Shape = 'wall' | 'door' | 'roof';
export interface PieceSpec {
  name: string; shape: Shape; mat: 'wood' | 'metal';
  needs: [ItemKey, number][]; tools: ItemKey[];
  /** The tool that takes it down (you get half the materials back). */
  cut: ItemKey;
}
export const PIECES: Record<PieceKind, PieceSpec> = {
  wallW: { name: 'Wooden Wall', shape: 'wall', mat: 'wood', needs: [['planks', 4], ['nails', 2]], tools: ['hammer', 'saw'], cut: 'hammer' },
  doorW: { name: 'Wooden Door', shape: 'door', mat: 'wood', needs: [['planks', 3], ['nails', 2], ['wire', 1]], tools: ['hammer', 'saw', 'screwdriver'], cut: 'hammer' },
  roofW: { name: 'Wooden Roof', shape: 'roof', mat: 'wood', needs: [['planks', 4], ['nails', 2], ['rope', 1]], tools: ['hammer', 'saw'], cut: 'hammer' },
  wallM: { name: 'Metal Wall', shape: 'wall', mat: 'metal', needs: [['scrap', 4], ['wire', 1]], tools: ['welder', 'pliers'], cut: 'torch' },
  doorM: { name: 'Metal Door', shape: 'door', mat: 'metal', needs: [['scrap', 3], ['wire', 2]], tools: ['welder', 'pliers', 'screwdriver'], cut: 'torch' },
  roofM: { name: 'Metal Roof', shape: 'roof', mat: 'metal', needs: [['scrap', 3], ['wire', 1]], tools: ['welder'], cut: 'torch' },
};
export const PIECE_KINDS = Object.keys(PIECES) as PieceKind[];
/**
 * The building grid (m): cells of `cell` metres round the flag; walls and doors stand on the cell edges, `thick`
 * thick and `wallH` high; a door leaves a `doorW` x `doorH` opening in the middle of its edge; roofs cover a cell
 * at the top of the walls.
 */
export const BUILD = { cell: 2, wallH: 2.8, thick: 0.2, doorW: 1.1, doorH: 2.2, roofT: 0.15 };
