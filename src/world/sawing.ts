// Sawing by hand (0.165): logs from the trees are only raw timber; every building wants planks. With a Saw in your
// kit (backpack or hands) the backpack's Log offers "Saw into planks": a log gives `HAND_PLANKS` (a village's
// Sawmill gets more out of it, gen/plants.ts). It takes effort: stamina and calories for each log. Personal: nothing shared.
import { hasItem, takeOne, addItem, saveChar } from '../character';
import { spendStamina, burn } from './survival';

/** Planks a log gives sawn by hand, and what each log costs you. */
export const HAND_PLANKS = 3;
const COST = { stamina: 18, kcal: 35 };

/** Saw one log (or every log you carry) into planks; the message for the backpack. */
export function sawLogs(all: boolean): string {
  if (!hasItem('saw')) return 'You need a Saw to cut logs into planks (the blacksmith makes one, or the Sawmill does it for the village).';
  let n = 0;
  while (hasItem('log') && (all || n === 0)) {
    if (!spendStamina(COST.stamina)) { if (!n) return 'Too tired to saw. Catch your breath.'; break; }
    if (!takeOne('log')) break;
    if (!addItem('planks', HAND_PLANKS, true)) { addItem('log', 1, true); if (!n) return 'No room in your backpack for the planks.'; break; }
    burn(COST.kcal); n++;
  }
  if (!n) return 'You have no logs to saw.';
  saveChar();
  return `You saw ${n} ${n > 1 ? 'logs' : 'log'} into ${n * HAND_PLANKS} planks.`;
}
