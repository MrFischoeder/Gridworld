// (0.270) The workshop in the backpack window: six cells for materials and three for tools. What you put in a cell is
// only a shadow of the thing (it stays in your backpack or on the ground until the work is done); a lying thing in a
// cell is claimed so nobody else works or picks it up meanwhile. Pure data and rules.
import type { ItemKey } from '../data/items';
import { HAND_PLANKS } from './settlement';

export const CELLS = { inputs: 6, tools: 3 };
/** One thing that can be made: the materials it uses up, the tools it needs (not used up), the work it takes. */
export interface Make { id: string; out: [ItemKey, number]; inputs: [ItemKey, number][]; tools: ItemKey[]; secs: number; stamina: number; kcal: number }
const M = (out: ItemKey, n: number, inputs: [ItemKey, number][], tools: ItemKey[], secs: number, stamina = 8, kcal = 15): Make => ({ id: out, out: [out, n], inputs, tools, secs, stamina, kcal });
export const MAKES: Make[] = [
  M('planks', HAND_PLANKS, [['log', 1]], ['saw'], 8, 12, 25),
  M('firekit', 1, [['log', 2]], [], 3),
  M('hatchet', 1, [['log', 1], ['stone', 2]], ['hammer'], 6),
  M('pickaxe', 1, [['log', 1], ['stone', 3]], ['hammer'], 6),
  M('flask', 1, [['hide', 1]], [], 3),
  M('medkit', 1, [['membrane', 1], ['cap', 3]], [], 4),
  M('ore', 1, [['ironO', 8], ['planks', 2]], ['hammer'], 7),
  M('copper', 1, [['copperO', 8], ['planks', 2]], ['hammer'], 7),
  M('wire', 3, [['ironO', 1]], ['hammer', 'pliers'], 5),
  M('scrap', 2, [['ironO', 2], ['log', 1]], ['torch'], 8),
  M('circuit', 1, [['copperO', 2], ['scrap', 1]], ['pliers', 'screwdriver'], 8),
  M('plating', 1, [['scrap', 3], ['plate', 2]], ['hammer', 'welder'], 8),
  M('engine', 1, [['scrap', 4], ['circuit', 1]], ['screwdriver', 'pliers', 'welder'], 10),
  M('emp', 1, [['scrap', 2], ['circuit', 1]], ['screwdriver'], 6),
];
/** Every item that is some recipe's tool (what the tool cells accept). */
export const TOOLS = new Set<ItemKey>(MAKES.flatMap((m) => m.tools));

export interface Put { k: ItemKey; n: number }
/** How much of each kind the material cells hold together. */
export function totals(cells: (Put | null)[]): Map<ItemKey, number> {
  const t = new Map<ItemKey, number>();
  for (const c of cells) if (c) t.set(c.k, (t.get(c.k) ?? 0) + c.n);
  return t;
}
/** The recipes the cells fit: every material cell's kind is one the recipe uses, with enough of each, and its tools are there. */
export function matching(inputs: (Put | null)[], tools: (Put | null)[]): Make[] {
  const have = totals(inputs), tl = new Set(tools.filter((c): c is Put => !!c).map((c) => c.k));
  if (!have.size) return [];
  return MAKES.filter((m) => [...have.keys()].every((k) => m.inputs.some(([i]) => i === k)) && m.inputs.every(([k, n]) => (have.get(k) ?? 0) >= n) && m.tools.every((k) => tl.has(k)));
}
/** How many batches of m the materials make. */
export const batches = (m: Make, inputs: (Put | null)[]) => { const have = totals(inputs); return Math.min(...m.inputs.map(([k, n]) => Math.floor((have.get(k) ?? 0) / n))); };

/** A lying thing in a cell is claimed by whoever put it there. Shared in `Char.workclaims`, keyed by the drop's id. */
export interface WorkClaim { by: string; n: string; t: number }
/** A claim lives this many game minutes (real seconds) unless its owner renews it, which they do every `beat`. */
export const CLAIM = { life: 15, beat: 4 };
export const claimFresh = (c: WorkClaim | undefined, now: number): c is WorkClaim => !!c && now - c.t < CLAIM.life;
/** Whether another hero is working this lying thing (so you may not touch it). */
export const claimedByOther = (claims: Record<string, WorkClaim>, id: string | undefined, pid: string, now: number) => {
  const c = id ? claims[id] : undefined;
  return claimFresh(c, now) && c.by !== pid ? c : null;
};
