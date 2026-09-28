// Rare deposits (pure, deterministic from the world seed): some villages further out stand by a deposit of a rare
// material the old industries needed, besides what their land makes. Near Gridholm there is none; the rarer the
// material, the further out it first turns up and the scarcer it stays, so the player's range grows with what they
// need. A village's deposit joins what it can spare the player (gen/standing.ts share, ui/share.ts).
import { hash } from '../core/rng';
import { worldDist, GRIDHOLM_ID, type Poi } from './regions';
import type { ItemKey } from '../data/items';

export type Rare = 'bauxite' | 'sulfur' | 'lithium' | 'rareearth' | 'uranium';
/** From how far out (m) each can be found, and how often a village past that distance has it (grows a little further out). */
export const RARES: { k: Rare; from: number; chance: number }[] = [
  { k: 'uranium', from: 15000, chance: 0.06 },
  { k: 'rareearth', from: 11000, chance: 0.08 },
  { k: 'lithium', from: 8000, chance: 0.11 },
  { k: 'sulfur', from: 5000, chance: 0.18 },
  { k: 'bauxite', from: 3000, chance: 0.3 },
];
/** The rare deposit by a village (at most one, the rarest that rolls), or null. */
export function depositOf(world: number, v: Poi): Rare | null {
  if (v.id === GRIDHOLM_ID) return null;
  const d = worldDist(v.x, v.z, 0, 0);
  for (const [i, r] of RARES.entries()) {
    if (d < r.from) continue;
    const odds = Math.min(0.4, r.chance * (1 + (d - r.from) / 20000)); // a little likelier further out
    if (hash(world, v.id, i, 0xde90) % 10000 < odds * 10000) return r.k;
  }
  return null;
}
export const RARE_NAME: Record<Rare, string> = { bauxite: 'bauxite', sulfur: 'sulfur', lithium: 'lithium brine', rareearth: 'rare earths', uranium: 'uranium' };
/** Crates of the deposit's material a village can spare a day, by the trust tier (none to a stranger). */
export const RARE_SHARE = [0, 1, 2, 3];
export const rareItem = (r: Rare) => r as ItemKey;
