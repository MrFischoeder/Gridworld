// Sawing by hand (0.165, slow since 0.170): logs from the trees are only raw timber; every building wants planks. With
// a Saw in your kit (backpack or hands) the backpack's Log offers "Saw into planks": the work takes `HAND.secs` a log
// and gives `HAND_PLANKS` (4); a village's powered sawmill gets 6 to 8 out of one (gen/settlement.ts `SAW`). Each log
// costs stamina and calories; walking off or running out of breath stops the work. Personal: nothing shared.
import { G } from '../game';
import { hasItem, takeOne, addItem, saveChar } from '../character';
import { spendStamina, burn } from './survival';
import { HAND_PLANKS } from '../gen/settlement';
import { logLine, showToast } from '../ui/hud';

export { HAND_PLANKS };
/** What a log costs you by hand: the seconds of work, stamina and calories. */
export const HAND = { secs: 15, stamina: 18, kcal: 35 };
let job: { left: number; t: number; x: number; z: number; done: number } | null = null;

/** Start sawing one log (or every log you carry) into planks; the message for the backpack. */
export function sawLogs(all: boolean): string {
  if (!hasItem('saw')) return 'You need a Saw to cut logs into planks (the blacksmith makes one, or a village sawmill does it far better).';
  const logs = G.char.inv.reduce((n, x) => n + (x?.k === 'log' ? x.n : 0), 0) + (G.char.hands[0]?.k === 'log' ? G.char.hands[0].n : 0);
  if (!logs) return 'You have no logs to saw.';
  job = { left: all ? logs : 1, t: 0, x: G.pos.x, z: G.pos.z, done: 0 };
  return `You start sawing ${job.left > 1 ? job.left + ' logs' : 'a log'} by hand: about ${HAND.secs} s a log, ${HAND_PLANKS} planks from each. Stay where you are; walking off stops the work.`;
}
const stop = (why: string) => { if (job?.done) saveChar(); logLine(why + (job?.done ? ` ${job.done} ${job.done > 1 ? 'logs' : 'log'} sawn into ${job.done * HAND_PLANKS} planks.` : '')); job = null; };
/** Main loop: the work goes on while you stay put. */
export function updateSawing(dt: number) {
  if (!job) return;
  if (Math.hypot(G.pos.x - job.x, G.pos.z - job.z) > 1.5) { stop('You stop sawing.'); return; }
  if ((job.t += dt) < HAND.secs) return;
  job.t = 0;
  if (!hasItem('saw')) { stop('Your saw is gone.'); return; }
  if (!spendStamina(HAND.stamina)) { stop('Too tired to saw on. Catch your breath.'); return; }
  if (!takeOne('log')) { stop('No logs left.'); return; }
  if (!addItem('planks', HAND_PLANKS, true)) { addItem('log', 1, true); stop('No room in your backpack for more planks.'); return; }
  burn(HAND.kcal); job.done++;
  if (--job.left <= 0) { const n = job.done; saveChar(); job = null; showToast(`${n * HAND_PLANKS} planks sawn`); logLine(`You saw ${n} ${n > 1 ? 'logs' : 'log'} into ${n * HAND_PLANKS} planks.`); }
}
/** The prompt line while sawing. */
export const sawingHint = () => (job ? `Sawing by hand: ${Math.round(job.t / HAND.secs * 100)}% · ${job.left} ${job.left > 1 ? 'logs' : 'log'} to go · walk off to stop` : null);
export const cancelSawing = () => { if (job) stop('You stop sawing.'); };
