// What the village craftsmen make for you once you have recovered the plans (gen/tech.ts). Not crafting of your own:
// you bring the materials, the blacksmith knows the work only if the technology is yours. Pure data and rules.
import type { ItemKey } from './items';
import { craft, count, type Recipe } from './crafting';
import type { Slot } from '../save';

/** An order: the technology it needs, what comes out, and what you hand over. */
export interface Order { tech: string; out: ItemKey; n: number; needs: [ItemKey, number][] }
export const ORDERS: Order[] = [
  { tech: 'forging', out: 'hatchet', n: 1, needs: [['log', 1], ['scrap', 1]] },
  { tech: 'forging', out: 'pickaxe', n: 1, needs: [['log', 1], ['scrap', 2]] },
  { tech: 'forging', out: 'hammer', n: 1, needs: [['log', 1], ['scrap', 2]] },
  { tech: 'forging', out: 'saw', n: 1, needs: [['log', 1], ['scrap', 2]] },
  { tech: 'framing', out: 'planks', n: 6, needs: [['log', 2]] },
  { tech: 'framing', out: 'nails', n: 10, needs: [['scrap', 1]] },
  { tech: 'furnace', out: 'scrap', n: 3, needs: [['ironO', 2], ['log', 1]] },
  { tech: 'furnace', out: 'wire', n: 4, needs: [['ironO', 1]] },
  { tech: 'circuits', out: 'circuit', n: 1, needs: [['copperO', 2], ['scrap', 1]] },
  { tech: 'circuits', out: 'compass', n: 1, needs: [['scrap', 1], ['circuit', 1]] },
  { tech: 'wagons', out: 'wheelL', n: 1, needs: [['log', 2], ['scrap', 2]] },
  { tech: 'wagons', out: 'plating', n: 1, needs: [['scrap', 3], ['log', 2]] },
  { tech: 'engines', out: 'engine', n: 1, needs: [['scrap', 4], ['circuit', 1]] },
  { tech: 'engines', out: 'turbo', n: 1, needs: [['scrap', 6], ['circuit', 3], ['pcore', 1]] },
];
/** Technologies that are for the villages themselves (farms, power, works), not for the craftsmen's bench. */
export const VILLAGE_TECHS = ['fields', 'plough', 'rotor', 'solar', 'chips', 'radio', 'chemistry', 'enrichment', 'propellant', 'rail'];

/** Can it be ordered: 'plans' (the technology is not yours), 'missing' (not all materials with you), or ''. */
export function orderState(o: Order, tech: Record<string, number>, inv: (Slot | null)[]): '' | 'plans' | 'missing' {
  if (tech[o.tech] === undefined) return 'plans';
  return o.needs.every(([k, n]) => count(inv, k) >= n) ? '' : 'missing';
}
/** Hands the materials over and takes the work: '' when done, else why not (as `craft`). */
export function placeOrder(o: Order, tech: Record<string, number>, inv: (Slot | null)[], cap: number, hands: (Slot | null)[]): '' | 'plans' | 'missing' | 'room' | 'hands' {
  if (tech[o.tech] === undefined) return 'plans';
  const r: Recipe = { out: o.out, n: o.n, needs: o.needs, at: 'forge' };
  return craft(inv, r, cap, hands);
}
