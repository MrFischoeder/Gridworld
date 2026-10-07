// The hero's house (gen/homes.ts: one of the houses every village sells, `VillageMap.homes`; yours once bought from
// the elder, `char.houses` / `homeOf`): a chest that keeps whatever you store in it (your own container, `chestKey`:
// 'home:chest' for Gridholm's first house as before) and a bed. Lying down at night you sleep until morning and wake fully
// healed; by day you nap for a couple of hours. The body goes on burning calories and drying out while you sleep.
import { G } from '../game';
import { OW, villageHere, reloadStruct } from './overworld';
import { HOUSE_PRICE } from '../data/npcs';
import { myHome, chestKey } from '../gen/homes';
import { saveChar } from '../character';
import { openTransfer } from '../ui/transfer';
import { showToast, logLine } from '../ui/hud';
import { fmtTime } from '../core/time';
import { SLEEP, STAMINA, DRAIN, sleepSpan, burnPerMin, STOMACH } from '../data/survival';
import type { Container } from '../save';

/** Slots in the home chest (a good deal more than a chest in the wilds). */
export const HOME_CHEST_SLOTS = 24;
/** Your house in the village you are in (its bed and chest, the village's id, name and height), if you own one there. */
function house() {
  if (G.char.loc !== 'overworld') return null;
  const v = villageHere(G.pos.x, G.pos.z), vm = v ? OW.structs.get(v.id)?.village : undefined, i = v ? myHome(G.char, v.id) : -1;
  return v && vm && i >= 0 && vm.homes[i] ? { ...vm.homes[i], vid: v.id, i, name: v.name, y: vm.y } : null;
}

/** What of your house you stand at: the chest, the bed, or nothing. */
export function nearHome(): 'chest' | 'bed' | null {
  const h = house(), p = G.pos;
  if (!h || Math.abs(p.y - h.y) > 1.5) return null;
  if (Math.hypot(h.chest.x - p.x, h.chest.z - p.z) < 1.6) return 'chest';
  const b = h.bed, d = Math.hypot(Math.max(b.x0 - p.x, 0, p.x - b.x1), Math.max(b.z0 - p.z, 0, p.z - b.z1));
  return d < 1.3 ? 'bed' : null;
}
export function homePrompt(what: 'chest' | 'bed'): string {
  if (what === 'chest') return 'E — open your chest';
  const s = sleepSpan(G.char.time);
  return s.night ? `E — sleep until ${String(SLEEP.wake).padStart(2, '0')}:00` : 'E — take a nap (2 hours)';
}
export function homeChest(key = 'home:chest'): Container {
  const c = G.char.containers;
  const box = (c[key] ??= { items: Array(HOME_CHEST_SLOTS).fill(null), gold: 0 });
  while (box.items.length < HOME_CHEST_SLOTS) box.items.push(null);
  return box;
}
export function useHome(what: 'chest' | 'bed') {
  const h = house();
  if (what === 'chest') { if (h) openTransfer({ title: 'Your chest', subtitle: `Your house, ${h.name}`, boxLabel: 'Chest', box: homeChest(chestKey(h.vid, h.i)) }); return; }
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

let checkT = 0;
/**
 * Every few seconds: the houses you own against the world's record (`TownState.homes`, shared on a server). A house
 * you hold that the record does not know yet (a save from before, Gridholm's first house) is written down as yours;
 * one the record gives to someone else (two bought it at once and the server kept their word) goes back, and so does
 * your gold. Your name on it follows a rename.
 */
export function updateHomes(dt: number) {
  if ((checkT -= dt) > 0) return;
  checkT = 3;
  const c = G.char;
  for (const vid of [...c.houses]) {
    const i = myHome(c, vid), s = (c.towns[vid] ??= {}), o = s.homes?.[i];
    if (!o) { (s.homes ??= {})[i] = { p: c.pid, n: c.name }; continue; }
    if (o.p === c.pid) { if (o.n !== c.name && c.name) o.n = c.name; continue; }
    c.houses = c.houses.filter((h) => h !== vid); if (c.homeOf) delete c.homeOf[vid];
    c.gold += HOUSE_PRICE; saveChar();
    showToast(`${o.n} got the house first`); logLine(`${o.n} bought that house before you: the elder gives you back your ${HOUSE_PRICE} gold.`);
    reloadStruct(vid);
  }
}
