// The hero's house in Gridholm (gen/village.ts `VillageMap.house`; yours once bought from the elder, `char.houses`): a chest that keeps whatever you store in it
// (saved as the container 'home:chest') and a bed. Lying down at night you sleep until morning and wake fully
// healed; by day you nap for a couple of hours. The body goes on burning calories and drying out while you sleep.
import { G } from '../game';
import { GRIDHOLM_ID } from '../gen/regions';
import { OW } from './overworld';
import { saveChar } from '../character';
import { openTransfer } from '../ui/transfer';
import { showToast, logLine } from '../ui/hud';
import { fmtTime } from '../core/time';
import { SLEEP, STAMINA, DRAIN, sleepSpan, burnPerMin, STOMACH } from '../data/survival';
import type { Container } from '../save';

/** Slots in the home chest (a good deal more than a chest in the wilds). */
export const HOME_CHEST_SLOTS = 24;
/** Your house's furniture, while you are in its village and own it (the elder sells it: ui/dialog.ts). */
const house = () => (G.char.loc === 'overworld' && OW.village?.home && G.char.houses.includes(GRIDHOLM_ID) ? OW.village.house : null);

/** What of your house you stand at: the chest, the bed, or nothing. */
export function nearHome(): 'chest' | 'bed' | null {
  const h = house(), p = G.pos;
  if (!h || Math.abs(p.y - OW.village!.y) > 1.5) return null;
  if (Math.hypot(h.chest.x - p.x, h.chest.z - p.z) < 1.6) return 'chest';
  const b = h.bed, d = Math.hypot(Math.max(b.x0 - p.x, 0, p.x - b.x1), Math.max(b.z0 - p.z, 0, p.z - b.z1));
  return d < 1.3 ? 'bed' : null;
}
export function homePrompt(what: 'chest' | 'bed'): string {
  if (what === 'chest') return 'E — open your chest';
  const s = sleepSpan(G.char.time);
  return s.night ? `E — sleep until ${String(SLEEP.wake).padStart(2, '0')}:00` : 'E — take a nap (2 hours)';
}
export function homeChest(): Container {
  const c = G.char.containers;
  const box = (c['home:chest'] ??= { items: Array(HOME_CHEST_SLOTS).fill(null), gold: 0 });
  while (box.items.length < HOME_CHEST_SLOTS) box.items.push(null);
  return box;
}
export function useHome(what: 'chest' | 'bed') {
  if (what === 'chest') { openTransfer({ title: 'Your chest', subtitle: 'Your house, Gridholm', boxLabel: 'Chest', box: homeChest() }); return; }
  sleep();
}
/** Lie down: the clock moves on, the body burns and dries out at the sleeping rate, and you wake rested. */
export function sleep() {
  const c = G.char, s = sleepSpan(c.time);
  c.time = s.night ? Math.round(c.time + s.min) : c.time + s.min; // wake on the hour
  if (!G.god) {
    c.kcal = Math.max(0, c.kcal - burnPerMin(1, 0) * SLEEP.burn * s.min);
    c.water = Math.max(0, c.water - DRAIN.water * SLEEP.water * s.min);
  }
  c.stomach = Math.max(0, c.stomach - STOMACH.digest / 60 * s.min);
  const max = G.S.maxHp;
  G.hp = s.night ? max : Math.min(max, G.hp + max * SLEEP.napHeal);
  G.stamina = STAMINA.max; G.exhausted = false;
  saveChar();
  showToast(s.night ? 'You sleep through the night.' : 'You doze for a while.');
  logLine(`You wake at ${fmtTime(c.time)}, rested.` + (c.water < 30 ? ' Your mouth is dry.' : '') + (c.kcal < 700 ? ' You wake up hungry.' : ''));
}
