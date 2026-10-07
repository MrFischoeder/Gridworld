// Village resources use their own seeded stream; changing scenery never moves villages or other POIs.
import { hash } from '../core/rng';
import { GRIDHOLM_ID } from './regions';
import type { ItemKey } from '../data/items';

export type DepositOre = 'iron' | 'copper' | 'lead' | 'nickel' | 'coal';
/** `grove`: a great grove of giant trees by the village (0.165): only a lumber camp works it, and it never runs out. */
export interface Deposits { ore?: DepositOre; oil: boolean; grove?: boolean; kind?: YardKind }
/** (0.168, the owner's rule) Every village digs one thing of its own: stone at a quarry, timber in a great grove, ore in
 *  a mine, or crude at an oil well. Processing (the refinery, sawmills, smelters) is open to every village. */
export type YardKind = 'quarry' | 'lumber' | 'mine' | 'oil';
export const YARD_KINDS: YardKind[] = ['quarry', 'lumber', 'mine', 'oil'];
/** The village's own resource (Gridholm: the great grove; the others by hash: quarry 35%, grove 30%, mine 22%, oil 13%). */
export function yardKind(world: number, vid: number): YardKind {
  if (vid === GRIDHOLM_ID) return 'lumber';
  const r = hash(world, vid, 0xde9055) % 100;
  return r < 35 ? 'quarry' : r < 65 ? 'lumber' : r < 87 ? 'mine' : 'oil';
}
export const ORES: Record<DepositOre, { name: string; symbol: string; color: number; good: ItemKey; lump?: ItemKey }> = {
  iron: { name: 'Iron ore', symbol: 'Fe', color: 0xd0703c, good: 'ore', lump: 'ironO' },
  copper: { name: 'Copper ore', symbol: 'Cu', color: 0x38d0b8, good: 'copper', lump: 'copperO' },
  lead: { name: 'Lead ore', symbol: 'Pb', color: 0xa8a9db, good: 'lead' },
  nickel: { name: 'Nickel ore', symbol: 'Ni', color: 0xa5c852, good: 'nickel' },
  coal: { name: 'Coal seam', symbol: 'C', color: 0x687e98, good: 'coal' },
};
export function villageDeposits(world: number, vid: number): Deposits {
  const kind = yardKind(world, vid), kinds: DepositOre[] = ['iron', 'iron', 'iron', 'copper', 'copper', 'copper', 'lead', 'lead', 'nickel', 'coal'];
  return { kind, ...(kind === 'mine' ? { ore: kinds[hash(world, vid, 0xde9052) % kinds.length] } : {}), oil: kind === 'oil', grove: kind === 'lumber' };
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

/** Whether a village has a great grove (0.168: the villages whose own resource is timber). */
export const groveRoll = (world: number, vid: number) => yardKind(world, vid) === 'lumber';
/** The giant trees of a village's great grove, round its lumber camp's yard (plaza-local, `RESOURCE_PLOTS.lumber` + u, v):
 *  trunk radius `r`, height `h`. The side towards the village stays open for the track. */
export interface Giant { u: number; v: number; r: number; h: number; seed: number }
const giantCache = new Map<string, Giant[]>();
export function groveTrees(world: number, vid: number): Giant[] {
  const key = world + ':' + vid, old = giantCache.get(key); if (old) return old;
  const out: Giant[] = [];
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (-0.72 + i / 8 * 1.44) + ((hash(world, vid, i, 0x9e07) % 100) / 100 - 0.5) * 0.25; // round the east side, away from the village (west)
    const d = 24 + (hash(world, vid, i, 0x9e08) % 80) / 10;
    out.push({ u: Math.cos(a) * d, v: Math.sin(a) * d * 0.9, r: 1.6 + (hash(world, vid, i, 0x9e09) % 9) / 10, h: 26 + (hash(world, vid, i, 0x9e0a) % 12), seed: hash(world, vid, i, 0x9e0b) });
  }
  if (giantCache.size > 500) giantCache.clear();
  giantCache.set(key, out); return out;
}
/** How far the grove reaches round the lumber plot's middle (for the fields and the wild trees to keep off). */
export const GROVE_REACH = 36;
