// Village resources use their own seeded stream; changing scenery never moves villages or other POIs.
import { hash } from '../core/rng';
import { GRIDHOLM_ID, allVillages, worldDist } from './regions';
import type { ItemKey } from '../data/items';
import { depositsOf as rareDeposits, type Rare } from './deposits';

export type DepositOre = 'iron' | 'copper' | 'lead' | 'nickel' | 'coal';
/** `grove`: a great grove of giant trees by the village (0.165): only a lumber camp works it, and it never runs out. */
/** `kinds` (0.171): the village's own two resources, the first as before 0.171; `kind` is the one of older saves (v 2). */
/** `rares` (0.175): the deep rare deposits under the village (gen/deposits.ts), worked by a deep mine with a drill rig. */
export interface Deposits { ore?: DepositOre; oil: boolean; grove?: boolean; kinds?: YardKind[]; kind?: YardKind; mineral?: QuarryMineral; salt?: boolean; rares?: Rare[]; v?: 2 | 3 }
/** (0.169) A quarry digs one mineral besides its stone; an oil field may bring up brine for salt. */
export type QuarryMineral = 'limestone' | 'clay' | 'sand';
export const MINERAL_NAME: Record<QuarryMineral, string> = { limestone: 'limestone', clay: 'clay', sand: 'quartz sand' };
/** (0.168, the owner's rule; 0.171 two of them) Every village digs two things of its own, picked at random: stone at a
 *  quarry, timber in a great grove, ore in a mine, or crude at an oil well. Processing (the refinery, sawmills, smelters)
 *  is open to every village. */
export type YardKind = 'quarry' | 'lumber' | 'mine' | 'oil';
export const YARD_KINDS: YardKind[] = ['quarry', 'lumber', 'mine', 'oil'];
export const ORES: Record<DepositOre, { name: string; symbol: string; color: number; good: ItemKey; lump?: ItemKey }> = {
  iron: { name: 'Iron ore', symbol: 'Fe', color: 0xd0703c, good: 'ore', lump: 'ironO' },
  copper: { name: 'Copper ore', symbol: 'Cu', color: 0x38d0b8, good: 'copper', lump: 'copperO' },
  lead: { name: 'Lead ore', symbol: 'Pb', color: 0xa8a9db, good: 'lead' },
  nickel: { name: 'Nickel ore', symbol: 'Ni', color: 0xa5c852, good: 'nickel' },
  coal: { name: 'Coal seam', symbol: 'C', color: 0x687e98, good: 'coal' },
};
/** (0.169) The villages nearest Gridholm that always get the basics, in order: a coal mine, an iron mine, a limestone
 *  quarry, so the first smelting and building never wait on luck. */
const NEAR_START: [YardKind, DepositOre | QuarryMineral][] = [['mine', 'coal'], ['mine', 'iron'], ['quarry', 'limestone']];
const nearCache = new Map<number, number[]>();
function nearStart(world: number): number[] {
  let ids = nearCache.get(world);
  if (!ids) {
    ids = allVillages(world).filter((v) => v.id !== GRIDHOLM_ID).sort((a, b) => worldDist(a.x, a.z, 0, 0) - worldDist(b.x, b.z, 0, 0) || a.id - b.id).slice(0, NEAR_START.length).map((v) => v.id);
    if (nearCache.size > 20) nearCache.clear();
    nearCache.set(world, ids);
  }
  return ids;
}
/** The village's own resource (Gridholm: the great grove; the three nearest: coal, iron, limestone; the others by hash:
 *  quarry 30%, grove 25%, mine 30%, oil 15%). */
export function yardKind(world: number, vid: number): YardKind {
  if (vid === GRIDHOLM_ID) return 'lumber';
  const near = nearStart(world).indexOf(vid);
  if (near >= 0) return NEAR_START[near][0];
  const r = hash(world, vid, 0xde9055) % 100;
  return r < 30 ? 'quarry' : r < 55 ? 'lumber' : r < 85 ? 'mine' : 'oil';
}
const WEIGHT: Record<YardKind, number> = { quarry: 30, lumber: 25, mine: 30, oil: 15 };
/** (0.171) The village's second resource: another kind than the first, by the same weights (its own hash stream). */
export function secondKind(world: number, vid: number, first = yardKind(world, vid)): YardKind {
  const rest = YARD_KINDS.filter((k) => k !== first), sum = rest.reduce((a, k) => a + WEIGHT[k], 0);
  let r = hash(world, vid, 0xde905a) % sum;
  for (const k of rest) { if (r < WEIGHT[k]) return k; r -= WEIGHT[k]; }
  return rest[0];
}
/** Both of the village's own resources (the first is the one it had before 0.171). */
export const yardKinds = (world: number, vid: number): YardKind[] => { const a = yardKind(world, vid); return [a, secondKind(world, vid, a)]; };
/** A quarry's mineral and an oil field's brine, by the village's own hash (also for yards kept from older saves). */
export const quarryMineral = (world: number, vid: number): QuarryMineral => (['limestone', 'clay', 'sand'] as const)[hash(world, vid, 0xde9056) % 3];
export const brine = (world: number, vid: number) => hash(world, vid, 0xde9057) % 2 === 0;
export function villageDeposits(world: number, vid: number): Deposits {
  const kinds = yardKinds(world, vid), near = nearStart(world).indexOf(vid), forced = near >= 0 ? NEAR_START[near][1] : undefined;
  // a mine: coal 30%, iron 30%, copper 25%, lead 15% (nickel is a rare deposit only)
  const ores: DepositOre[] = ['coal', 'coal', 'coal', 'coal', 'coal', 'coal', 'iron', 'iron', 'iron', 'iron', 'iron', 'iron', 'copper', 'copper', 'copper', 'copper', 'copper', 'lead', 'lead', 'lead'];
  // the forced basic belongs to the first kind (the second never repeats it)
  return {
    kinds, v: 3,
    ...(kinds.includes('mine') ? { ore: (kinds[0] === 'mine' ? forced as DepositOre : undefined) ?? ores[hash(world, vid, 0xde9052) % ores.length] } : {}),
    ...(kinds.includes('quarry') ? { mineral: (kinds[0] === 'quarry' ? forced as QuarryMineral : undefined) ?? quarryMineral(world, vid) } : {}),
    ...(kinds.includes('oil') ? { salt: brine(world, vid) } : {}),
    oil: kinds.includes('oil'), grove: kinds.includes('lumber'),
    rares: rareDepositsOf(world, vid),
  };
}
/** The rare deposits under village vid (none at Gridholm). */
export function rareDepositsOf(world: number, vid: number): Rare[] {
  const v = allVillages(world).find((p) => p.id === vid);
  return v ? rareDeposits(world, v) : [];
}
/** Centres ~105 m beyond the 72 m village fence. Separate work yards leave room for later buildings. */
export const RESOURCE_PLOTS = {
  quarry: { x: -105, z: 36 }, lumber: { x: 177, z: 36 }, mine: { x: 36, z: 177 },
  oil: { x: 36, z: -105 }, refinery: { x: 72, z: -116 },
  // (0.142) south-west, clear of the quarry, the farm corners and the side sites
  foodworks: { x: -80, z: 140 },
  // (0.170) north-west, the powered sawmill
  sawmill: { x: -80, z: -80 },
  // (0.175) south-east, the deep mine over a rare deposit (clear of Gridholm's hangar, north-east)
  raremine: { x: 152, z: 140 },
} as const;
export type ResourceProject = keyof typeof RESOURCE_PLOTS;
export const RESOURCE_YARD = { halfX: 18, halfZ: 14 };
/** Gentle walkable bowl: the exact same profile is used by terrain rendering and player ground queries. */
export function depositDepth(x: number, z: number, radius = 8, depth = 1.6): number {
  const t = Math.max(0, 1 - Math.hypot(x, z) / radius);
  return depth * t * t * (3 - 2 * t);
}

/** Whether a village has a great grove (the villages one of whose own resources is timber). */
export const groveRoll = (world: number, vid: number) => yardKinds(world, vid).includes('lumber');
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
