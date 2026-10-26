// Work on things lying about (0.263): with the right tool in your hands you process what lies within reach on the
// ground, no bench and no backpack needed. Hold E by the item; a tap of E still picks it up. Pure data.
import type { ItemKey } from './items';
import { HAND_PLANKS } from '../gen/settlement';

export interface Handwork {
  /** The tool that must be in your hands. */
  tool: ItemKey;
  /** The lying item it works on (one at a time out of a pile) and what comes of it. */
  from: ItemKey; to: ItemKey; n: number;
  /** Seconds of work, and what it costs you. */
  secs: number; stamina: number; kcal: number;
  /** For the prompt: 'saw the log into planks'. */
  verb: string;
}
export const HANDWORK: Handwork[] = [
  { tool: 'saw', from: 'log', to: 'planks', n: HAND_PLANKS, secs: 10, stamina: 12, kcal: 25, verb: 'saw the log into planks' },
];
/** The work a tool in the hands does on a lying item, if any. */
export const handworkOf = (tool: ItemKey | undefined, from: ItemKey): Handwork | undefined => (tool ? HANDWORK.find((w) => w.tool === tool && w.from === from) : undefined);
export const HANDWORK_TAP = 0.3;
