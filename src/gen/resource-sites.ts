// Village resources use their own seeded stream; changing scenery never moves villages or other POIs.
import { hash } from '../core/rng';
import { GRIDHOLM_ID } from './regions';
import type { ItemKey } from '../data/items';

export type DepositOre = 'iron' | 'copper' | 'lead' | 'nickel' | 'coal';
export interface Deposits { ore?: DepositOre; oil: boolean }
export const ORES: Record<DepositOre, { name: string; symbol: string; color: number; good: ItemKey; lump?: ItemKey }> = {
  iron: { name: 'Iron ore', symbol: 'Fe', color: 0xd0703c, good: 'ore', lump: 'ironO' },
  copper: { name: 'Copper ore', symbol: 'Cu', color: 0x38d0b8, good: 'copper', lump: 'copperO' },
  lead: { name: 'Lead ore', symbol: 'Pb', color: 0xa8a9db, good: 'lead' },
  nickel: { name: 'Nickel ore', symbol: 'Ni', color: 0xa5c852, good: 'nickel' },
  coal: { name: 'Coal seam', symbol: 'C', color: 0x687e98, good: 'coal' },
};
export function villageDeposits(world: number, vid: number): Deposits {
  const oreRoll = hash(world, vid, 0xde9051) % 100;
  const kinds: DepositOre[] = ['iron', 'iron', 'iron', 'copper', 'copper', 'copper', 'lead', 'lead', 'nickel', 'coal'];
  return { ...(vid === GRIDHOLM_ID ? { ore: 'iron' as const } : oreRoll < 35 ? { ore: kinds[hash(world, vid, 0xde9052) % kinds.length] } : {}), oil: hash(world, vid, 0xde9053) % 100 < 22 };
}
/** Centres ~105 m beyond the 72 m village fence. Separate work yards leave room for later buildings. */
export const RESOURCE_PLOTS = {
  quarry: { x: -105, z: 36 }, lumber: { x: 177, z: 36 }, mine: { x: 36, z: 177 },
  oil: { x: 36, z: -105 }, refinery: { x: 72, z: -116 },
  // (0.142) south-west, clear of the quarry, the farm corners and the side sites
  foodworks: { x: -80, z: 140 },
} as const;
export type ResourceProject = keyof typeof RESOURCE_PLOTS;
export const RESOURCE_YARD = { halfX: 18, halfZ: 14 };
/** Gentle walkable bowl: the exact same profile is used by terrain rendering and player ground queries. */
export function depositDepth(x: number, z: number, radius = 8, depth = 1.6): number {
  const t = Math.max(0, 1 - Math.hypot(x, z) / radius);
  return depth * t * t * (3 - 2 * t);
}
