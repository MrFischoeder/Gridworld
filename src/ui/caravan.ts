// Talking to a caravan master on the road: where the caravan comes from and goes to, what it carries, when it
// arrives, and you may buy crates off the wagons at a price between the two markets (dearer than where they were
// made, cheaper than where they are going). What you bought off a caravan is remembered (char.caravans).
import { G, W } from '../game';
import { ITEMS, PACK, type ItemKey } from '../data/items';
import { putItems } from '../inventory';
import { calcStats, saveChar } from '../character';
import { quote } from '../gen/market';
import { findPoi, villageSeed } from '../gen/regions';
import { fmtTime } from '../core/time';
import { vehicles } from '../world/vehicles';
import type { Caravan } from '../gen/caravans';
import { $ } from './hud';
import { lockPointer } from './input';

const dlgEl = $('dlg'), panel = () => dlgEl.querySelector('.panel') as HTMLElement;
let open: Caravan | null = null;

/** What the caravan master asks per crate: halfway between the price at home and the price at the destination. */
function price(c: Caravan): number {
  const w = G.char.world, a = findPoi(w, c.from), b = findPoi(w, c.to);
  if (!a || !b) return 50;
  const buy = quote(a, villageSeed(w, a), w, c.good, G.char.market, G.char.time).buy, sell = quote(b, villageSeed(w, b), w, c.good, G.char.market, G.char.time).sell;
  return Math.round((buy + sell) / 2);
}
const left = (c: Caravan) => Math.max(0, c.n - (G.char.caravans[c.id] ?? 0));
function render(msg = '') {
  const c = open!, p = price(c), n = left(c), name = ITEMS[c.good].name, eta = c.t0 + c.T;
  panel().classList.remove('wide');
  panel().innerHTML = `<h2>Caravan</h2><div class="role">${c.fromName} → ${c.toName}</div>` +
    `<div class="say">${msg ? msg + '<br><br>' : ''}"We carry ${name} from ${c.fromName} to ${c.toName}: ${n} crate${n === 1 ? '' : 's'} left on ${c.wagons > 1 ? 'the wagons' : 'the wagon'}. We should roll in about ${fmtTime(eta)}${eta - G.char.time > 1440 ? ' tomorrow' : ''}. If you want some here and now, ${p} gold a crate. Saves you the walk."</div>` +
    `<div class="shoprow"><div><b>${name}</b><br><span>${n} left · your gold ${G.char.gold}</span></div>
      <button class="opt" style="width:auto" data-cvb="1" ${n < 1 || G.char.gold < p ? 'disabled' : ''}>buy 1 (${p} g)</button>
      <button class="opt" style="width:auto" data-cvb="5" ${n < 5 || G.char.gold < p * 5 ? 'disabled' : ''}>buy 5</button></div>` +
    `<button class="opt" data-cvclose="1">Safe travels.</button>`;
}
export function openCaravan(c: Caravan) {
  if (!G.playing || G.dlgOpen || G.packOpen || G.xferOpen) return;
  open = c; G.dlgOpen = true; W.talkNpc = null; G.firing = false; for (const k in G.keys) G.keys[k] = false;
  render();
  dlgEl.style.display = 'flex'; if (document.pointerLockElement) document.exitPointerLock();
}
function close() { open = null; G.dlgOpen = false; dlgEl.style.display = 'none'; if (!G.isTouch) lockPointer(); }
/** Clicks in the caravan panel; true when handled. */
export function caravanClick(t: HTMLElement): boolean {
  if (!open) return false;
  if (t.closest('[data-cvclose]')) { close(); return true; }
  const b = t.closest<HTMLElement>('[data-cvb]');
  if (!b) return false;
  const c = open, want = +b.dataset.cvb!, p = price(c), ch = G.char;
  // your backpack first, then a vehicle you are standing by
  const stores = [{ s: ch.inv, cap: PACK.vol as number | undefined }, ...vehicles.filter((v) => v.claimed && !v.ai && Math.hypot(v.st.x - G.pos.x, v.st.z - G.pos.z) < 25).map((v) => ({ s: v.st.trunk.items, cap: undefined }))];
  let got = 0;
  for (let i = 0; i < want && left(c) > 0 && ch.gold >= p; i++) {
    let rest = 1; for (const st of stores) if (rest) rest = putItems(st.s, c.good as ItemKey, 1, st.cap);
    if (rest) break;
    ch.gold -= p; got++; ch.caravans[c.id] = (ch.caravans[c.id] ?? 0) + 1;
  }
  // forget old caravans (keep the save small)
  const ids = Object.keys(ch.caravans); if (ids.length > 40) for (const id of ids.slice(0, ids.length - 40)) delete ch.caravans[id];
  calcStats(); saveChar();
  render(got ? `The drover hands down ${got} crate${got > 1 ? 's' : ''} of ${ITEMS[c.good].name}. (-${got * p} gold)` : 'No room for a crate in your backpack or a vehicle beside you.');
  return true;
}
