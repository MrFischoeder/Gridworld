// Working things up where they lie (0.263, the owner's request): with the right tool in your hands, hold E by a lying item
// (a log, with a Saw) and the hero works it: a bar fills, the tool moves in front of the view, stamina and calories go,
// and the result (planks) comes into your kit or lies at your feet. A tap of E still picks the item up. Table in
// data/handwork.ts. One unit at a time out of a pile. MP: the lying item is a shared drop; it is claimed from the server
// first (`consumeDrop`), the product is made on your game only if you were first, so nothing doubles.
import { G } from '../game';
import { addItem, saveChar, inHands } from '../character';
import { ITEMS } from '../data/items';
import { handworkOf, HANDWORK_TAP, type Handwork } from '../data/handwork';
import { W } from '../game';
import { spendStamina, burn } from './survival';
import { setHandWork } from './gather';
import { consumeDrop, dropAtFeet, takeDrop } from './drops';
import { play } from './sound';
import { workedBy } from './worklocks';
import type { Pickup } from './loot';
import type { ToolKey } from './toolmodels';
import { logLine, showToast } from '../ui/hud';
import { tl, TL } from '../i18n';
tl('saw the log into planks'); // (the table's words, data/handwork.ts)

export interface HandTarget { p: Pickup; w: Handwork }
const REACH = 2.2;
let held = 0, t = 0, beat = 0, cur: Pickup | null = null;

/** The lying item in reach that the tool in your hands can work. */
export function handworkTarget(): HandTarget | null {
  const tool = G.char.hands[0]?.k;
  if (!tool || !G.playing || (G.char.loc !== 'overworld' && G.char.loc !== 'dungeon')) return null;
  let best: HandTarget | null = null, bd = REACH;
  for (const p of W.pickups) {
    const w = handworkOf(tool, p.k);
    if (!w || !ITEMS[p.k] || workedBy(p.drop)) continue;
    const d = Math.hypot(p.p.x - G.pos.x, p.p.z - G.pos.z);
    if (d < bd && Math.abs(p.p.y - (G.pos.y + 0.9)) < 2.5) { bd = d; best = { p, w }; }
  }
  return best;
}
export function handworkPrompt(h: HandTarget): string {
  const more = h.p.n && h.p.n > 1 ? ` ×${h.p.n}` : '';
  if (held >= HANDWORK_TAP) { const k = Math.round(Math.min(1, t / h.w.secs) * 10); return `${tl('Working')} ${'▮'.repeat(k)}${'▯'.repeat(10 - k)} ${Math.round(Math.min(1, t / h.w.secs) * 100)}%`; }
  return TL`Hold E — ${tl(h.w.verb)}${more} · tap E — pick it up`;
}
const stop = () => { held = 0; t = 0; cur = null; setHandWork(null); };
/** Every frame (world/interact.ts): E held by a workable item works it, a quick tap picks it up. */
export function updateHandwork(dt: number, h: HandTarget | null) {
  const down = !!G.keys.KeyE && G.playing && !G.dlgOpen;
  if (!h || !inHands(h.w.tool)) { if (held) stop(); return; }
  if (cur !== h.p) { cur = h.p; t = 0; }
  if (!down) {
    if (held > 0 && held < HANDWORK_TAP) takeDrop(h.p);
    stop(); return;
  }
  held += dt;
  if (held < HANDWORK_TAP) return;
  t += dt; beat += dt;
  setHandWork(h.w.tool as ToolKey, t * 2.5);
  if (beat > 0.8) { beat = 0; play('chop', { vol: 0.35, far: 30, share: 25 }); }
  if (t < h.w.secs) return;
  if (!spendStamina(h.w.stamina)) { logLine(tl('Too tired to work on. Catch your breath.')); stop(); return; }
  const w = h.w;
  t = 0; cur = null;
  const ok = consumeDrop(h.p, (n) => {
    burn(w.kcal);
    if (n > 1) dropAtFeet({ k: w.from, n: n - 1 });
    if (!addItem(w.to, w.n, true)) dropAtFeet({ k: w.to, n: w.n });
    saveChar();
    showToast(`+${w.n} ${ITEMS[w.to].name}`);
  });
  if (!ok) stop();
}
