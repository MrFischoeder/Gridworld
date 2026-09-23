// Conversations and shops. New options (quests) plug in through OPT_TEXT and the switch below.
import { G, W } from '../game';
import { ITEMS } from '../data/items';
import { NPC_INFO, VILLAGER_LINES, RUMOURS, OPT_TEXT, LORE, stockFor, type OptId } from '../data/npcs';
import { addItem, calcStats, saveChar } from '../character';
import { $ } from './hud';
import { lockPointer } from './input';
import type { Npc } from '../world/npc';
import { VEHICLES, vehicleTitle, health, type VehicleModel } from '../data/vehicles';
import { buyVehicle, vehiclesForSale, sellVehicle } from '../world/vehicles';
import { questOptions, questTalk } from '../world/quests';
import { PART_PRICE, PART_BUYBACK, type ItemKey } from '../data/items';
import type { Slot } from '../save';
/** Mirek pays a fifth of the price for a part, less for a worn one. */
const partBuyback = (s: Slot) => Math.floor(PART_PRICE[s.k]! * PART_BUYBACK * (s.c ?? 100) / 100);

const dlgEl = $('dlg'), panel = () => dlgEl.querySelector('.panel') as HTMLElement;
/** Elder's lore line; the open world replaces it. */
export let loreText = (): string => LORE;

export function setLoreText(f: () => string) { loreText = f; }

export function openDialog(n: Npc) {
  if (!G.playing || G.dlgOpen || G.packOpen || G.xferOpen) return;
  G.dlgOpen = true; W.talkNpc = n; G.firing = false; for (const k in G.keys) G.keys[k] = false;
  const info = NPC_INFO[n.role];
  renderTalk(n.role === 'villager' ? (n.name + ' nods. "' + VILLAGER_LINES[(Math.random() * VILLAGER_LINES.length) | 0] + '"') : info.hello!);
  dlgEl.style.display = 'flex'; if (document.pointerLockElement) document.exitPointerLock();
}
export function closeDialog() { if (!G.dlgOpen) return; G.dlgOpen = false; W.talkNpc = null; dlgEl.style.display = 'none'; if (!G.isTouch) lockPointer(); }
const dlgHead = () => { const n = W.talkNpc!; return `<h2>${n.name}</h2><div class="role">${n.title}</div>`; };
function renderTalk(text: string) {
  const info = NPC_INFO[W.talkNpc!.role];
  panel().innerHTML = dlgHead() + `<div class="say">${text}</div>` +
    questOptions(W.talkNpc!.role).map((q) => `<button class="opt" data-q="${q.id}" style="color:var(--gold)">${q.label}</button>`).join('') +
    info.opts.map((o) => `<button class="opt" data-o="${o}">${OPT_TEXT[o]}</button>`).join('');
}
const PARTS = Object.keys(PART_PRICE) as ItemKey[];
function renderVehicleShop(msg?: string) {
  panel().innerHTML = dlgHead() + `<div class="say">Your gold: <b>${G.char.gold}</b>${msg ? '<br>' + msg : ''}</div>` +
    (Object.keys(VEHICLES) as VehicleModel[]).map((m) => {
      const s = VEHICLES[m];
      return `<div class="shoprow"><div><b>${vehicleTitle(m)}</b><br><span>${s.role} · ${s.seats} seats · trunk ${s.trunk} · ${Math.round(s.maxSpeed * 3.6)} km/h${s.enclosed ? ' · closed cab' : ' · open top'}</span></div>
      <button class="buy" data-v="${m}" ${G.char.gold < s.price ? 'disabled' : ''}>${s.price} g</button></div>`;
    }).join('') +
    PARTS.map((k) => `<div class="shoprow"><div><b>${ITEMS[k].name}</b><br><span>${ITEMS[k].desc}</span></div>
      <button class="buy" data-k="${k}" data-p="${PART_PRICE[k]}" ${G.char.gold < PART_PRICE[k]! ? 'disabled' : ''}>${PART_PRICE[k]} g</button></div>`).join('') +
    `<button class="opt" data-o="back">${OPT_TEXT.back}</button>`;
}
/** Mirek buys vehicles back at half price (less for wrecks) and parts for a fifth of what he charges. */
function renderSell(msg?: string) {
  const offers = vehiclesForSale(), parts = G.char.inv.map((s, i) => ({ s, i })).filter(({ s }) => s && PART_PRICE[s.k]);
  panel().innerHTML = dlgHead() + `<div class="say">Your gold: <b>${G.char.gold}</b>${msg ? '<br>' + msg : ''}</div>` +
    (offers.length ? offers.map((o) => `<div class="shoprow"><div><b>${vehicleTitle(o.v.st.model)}</b><br><span>${o.why ?? 'parked in the yard · condition ' + Math.round(health(o.v.st.model, o.v.st.parts) * 100) + '%'}</span></div>
      <button class="buy" data-sellv="${o.v.st.id}" ${o.why ? 'disabled' : ''}>+${o.price} g</button></div>`).join('')
      : '<div class="say" style="opacity:.7">Park a vehicle in my yard and I will make you an offer.</div>') +
    parts.map(({ s, i }) => `<div class="shoprow"><div><b>${ITEMS[s!.k].name}${s!.n > 1 ? ' ×' + s!.n : ''}</b><br><span>used part${s!.c !== undefined ? ', ' + Math.round(s!.c) + '% worn in' : ''}</span></div>
      <button class="buy" data-sells="${i}">+${partBuyback(s!)} g</button></div>`).join('') +
    `<button class="opt" data-o="back">${OPT_TEXT.back}</button>`;
}
function renderShop(msg?: string) {
  if (W.talkNpc!.role === 'dealer') { renderVehicleShop(msg); return; }
  const stock = stockFor(W.talkNpc!.role, G.char.world);
  panel().innerHTML = dlgHead() + `<div class="say">Your gold: <b>${G.char.gold}</b>${msg ? '<br>' + msg : ''}</div>` +
    stock.map(([k, p]) => `<div class="shoprow"><div><b>${ITEMS[k].name}</b><br><span>${ITEMS[k].desc}</span></div>
      <button class="buy" data-k="${k}" data-p="${p}" ${G.char.gold < p ? 'disabled' : ''}>${p} g</button></div>`).join('') +
    `<button class="opt" data-o="back">${OPT_TEXT.back}</button>`;
}
dlgEl.addEventListener('click', (e) => {
  const t = e.target as HTMLElement, o = t.closest<HTMLElement>('[data-o]'), b = t.closest<HTMLElement>('.buy'), c = G.char;
  if (b && b.dataset.v) { renderVehicleShop(buyVehicle(b.dataset.v as VehicleModel)); return; }
  if (b && b.dataset.sellv) { renderSell(sellVehicle(b.dataset.sellv)); return; }
  if (b && b.dataset.sells) {
    const i = +b.dataset.sells, s = c.inv[i];
    if (s && PART_PRICE[s.k]) { c.gold += partBuyback(s); if (--s.n <= 0) c.inv[i] = null; saveChar(); renderSell('Sold: ' + ITEMS[s.k].name + '.'); }
    return;
  }
  if (b) {
    const k = b.dataset.k as keyof typeof ITEMS, p = +b.dataset.p!;
    if (c.gold < p) return renderShop('Not enough gold.');
    if (!addItem(k)) return renderShop('Your backpack is full.');
    c.gold -= p; calcStats(); saveChar(); return renderShop('Bought: ' + ITEMS[k].name + '.');
  }
  const qb = t.closest<HTMLElement>('[data-q]');
  if (qb) { renderTalk(questTalk(qb.dataset.q!) || 'Hm?'); return; }
  if (!o) return;
  const r = W.talkNpc!.role;
  switch (o.dataset.o as OptId | 'back') {
    case 'bye': closeDialog(); break;
    case 'back': renderTalk('Anything else?'); break;
    case 'shop': renderShop(); break;
    case 'sell': renderSell(); break;
    case 'rest':
      if (G.hp >= G.S.maxHp) renderTalk('You look well rested already. Save your coin.');
      else if (c.gold < 10) renderTalk('Ten gold for a bed, love. Come back when you have it.');
      else { c.gold -= 10; G.hp = G.S.maxHp; saveChar(); renderTalk('You sleep like a stone. (HP fully restored)'); }
      break;
    case 'rumour': renderTalk(RUMOURS[(Math.random() * RUMOURS.length) | 0]); break;
    case 'chat': renderTalk(VILLAGER_LINES[(Math.random() * VILLAGER_LINES.length) | 0]); break;
    case 'lore': renderTalk(loreText()); break;
    case 'work':
      renderTalk(r === 'elder' ? 'Read the notice board on the plaza. Folk post their troubles there, and when my name is on a notice, come and see me.'
        : 'Have a look at the notice board on the plaza. If I need something, you will find it there.');
      break;
  }
});
