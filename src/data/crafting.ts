// Crafting: recipes and the pure rules for making things out of what you carry. world/gather.ts gets the raw
// materials (wood, stone), ui/craft.ts is the workbench window.
import type { ItemKey } from './items';
import { putItems, roomFor } from '../inventory';
import type { Slot } from '../save';

/**
 * Where a recipe can be made: 'bench' = any workbench (your own Workbench Kit set up in the wilds, or a village
 * blacksmith's); 'forge' = only at a village blacksmith's (metalwork needs the forge).
 */
export type Station = 'bench' | 'forge';
export interface Recipe { out: ItemKey; n: number; needs: [ItemKey, number][]; at: Station }

export const RECIPES: Recipe[] = [
  { out: 'firekit', n: 1, needs: [['log', 2]], at: 'bench' },
  { out: 'hatchet', n: 1, needs: [['log', 1], ['stone', 2]], at: 'bench' },
  { out: 'pickaxe', n: 1, needs: [['log', 1], ['stone', 3]], at: 'bench' },
  { out: 'flask', n: 1, needs: [['hide', 1]], at: 'bench' },
  { out: 'medkit', n: 1, needs: [['membrane', 1], ['cap', 3]], at: 'bench' },
  { out: 'benchkit', n: 1, needs: [['log', 6], ['stone', 4]], at: 'bench' },
  { out: 'plating', n: 1, needs: [['scrap', 3], ['plate', 2]], at: 'forge' },
  { out: 'engine', n: 1, needs: [['scrap', 5]], at: 'forge' },
  { out: 'emp', n: 1, needs: [['scrap', 3], ['ncrys', 1]], at: 'forge' },
  { out: 'barS', n: 1, needs: [['scrap', 2], ['membrane', 2]], at: 'forge' },
  { out: 'edge', n: 1, needs: [['fang', 6], ['incisor', 4], ['scrap', 2]], at: 'forge' },
  { out: 'shield', n: 1, needs: [['plate', 4], ['hide', 2], ['scrap', 4]], at: 'forge' },
];
/** A forge can make everything; a plain workbench only the 'bench' recipes. */
export const canUseAt = (r: Recipe, st: Station) => r.at === 'bench' || st === 'forge';

export const count = (inv: (Slot | null)[], k: ItemKey) => inv.reduce((a, s) => a + (s && s.k === k ? s.n : 0), 0);
/** Everything the recipe needs is in the backpack. */
export const hasAll = (inv: (Slot | null)[], r: Recipe) => r.needs.every(([k, n]) => count(inv, k) >= n);

/** Takes n of k out of the slots (smallest stacks first, so partial stacks get used up). */
function take(inv: (Slot | null)[], k: ItemKey, n: number) {
  const idx = inv.map((_, i) => i).filter((i) => inv[i]?.k === k).sort((a, b) => inv[a]!.n - inv[b]!.n);
  for (const i of idx) { if (n <= 0) break; const s = inv[i]!, m = Math.min(n, s.n); s.n -= m; n -= m; if (!s.n) inv[i] = null; }
}
/**
 * Crafts one batch of the recipe from the backpack. Returns '' when done, else why not (missing materials, or no
 * room for the result once the materials are used). The backpack is left untouched on failure.
 */
export function craft(inv: (Slot | null)[], r: Recipe, cap?: number): '' | 'missing' | 'room' {
  if (!hasAll(inv, r)) return 'missing';
  const copy = inv.map((s) => (s ? { ...s } : null));
  for (const [k, n] of r.needs) take(copy, k, n);
  if (roomFor(copy, r.out, cap) < r.n || putItems(copy, r.out, r.n) > 0) return 'room';
  inv.splice(0, inv.length, ...copy);
  return '';
}

/**
 * Gathering: how many blows it takes and what falls out. Trees are felled and grow back; rocks are broken up and
 * weather out again. Regrowth in game minutes (a game day = 1440).
 */
export const GATHER = {
  tree: { hits: 4, bigHits: 10, logs: 3, bigLogs: 8, regrow: 3 * 1440, stamina: 16, kcal: 12, noise: 22 },
  rock: { hits: 3, bigHits: 6, stones: 2, bigStones: 5, regrow: 2 * 1440, stamina: 18, kcal: 14, noise: 18 },
};
/** Only rocks this big (radius, m) can be worked; the pebbles are left alone. */
export const ROCK_MIN_R = 0.55;
