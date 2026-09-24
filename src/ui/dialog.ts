// Conversations and shops. New options (quests) plug in through OPT_TEXT and the switch below.
import { G, W } from '../game';
import { ITEMS, HANDS_ONLY } from '../data/items';
import { NPC_INFO, VILLAGER_LINES, RUMOURS, OPT_TEXT, LORE, BUYS, COOK_PRICE, stockFor, type OptId } from '../data/npcs';
import { putItems } from '../inventory';
import { craftClick, showForge } from './craft';
import { buildClick } from './build';
import { addItem, calcStats, saveChar, listOf, handsChanged } from '../character';
import { $ } from './hud';
import { lockPointer } from './input';
import type { Npc } from '../world/npc';
import { VEHICLES, vehicleTitle, health, type VehicleModel } from '../data/vehicles';
import { buyVehicle, vehiclesForSale, sellVehicle } from '../world/vehicles';
import { questOptions, questTalk } from '../world/quests';
import { PART_PRICE, PART_BUYBACK, type ItemKey } from '../data/items';
import type { Slot } from '../save';
import { fortifyPlan, handOver, powerKind, powerCondition, powerSite, POWER, POWER_DOWN, POWER_LOW } from '../gen/town';
import { WALL_TIERS } from '../gen/village';
import { count } from '../data/crafting';
import { loadedVillage, reloadStruct } from '../world/overworld';
import { gainXp } from '../character';
import { showToast, logLine } from './hud';
import { openMarket, renderMarket, marketClick } from './market';
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
  renderTalk(n.role === 'villager' ? (n.name + ' nods. "' + VILLAGER_LINES[(Math.random() * VILLAGER_LINES.length) | 0] + '"') : here(info.hello!));
  dlgEl.style.display = 'flex'; if (document.pointerLockElement) document.exitPointerLock();
}
export function closeDialog() { if (!G.dlgOpen) return; G.dlgOpen = false; W.talkNpc = null; dlgEl.style.display = 'none'; if (!G.isTouch) lockPointer(); }
/** The talking resident's village (texts are written for Gridholm). */
const town = () => W.talkNpc?.town ?? 'Gridholm';
const inGridholm = () => town() === 'Gridholm';
const here = (s: string) => s.replace(/Gridholm/g, town());
const dlgHead = () => { const n = W.talkNpc!; return `<h2>${n.name}</h2><div class="role">${n.title}</div>`; };
function renderTalk(text: string) {
  const info = NPC_INFO[W.talkNpc!.role];
  panel().classList.remove('wide');
  panel().innerHTML = dlgHead() + `<div class="say">${text}</div>` +
    (inGridholm() ? questOptions(W.talkNpc!.role) : []).map((q) => `<button class="opt" data-q="${q.id}" style="color:var(--gold)">${q.label}</button>`).join('') +
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
/** Jan and Radek buy what you bring from the wilds (data/npcs BUYS). */
function renderTrade(msg?: string) {
  const buys = BUYS[W.talkNpc!.role] ?? {}, rows = G.char.inv.map((s, i) => ({ s, i })).filter(({ s }) => s && buys[s.k]);
  panel().innerHTML = dlgHead() + `<div class="say">Your gold: <b>${G.char.gold}</b>${msg ? '<br>' + msg : ''}</div>` +
    (rows.length ? rows.map(({ s, i }) => `<div class="shoprow"><div><b>${ITEMS[s!.k].name} ×${s!.n}</b><br><span>${buys[s!.k]} g each</span></div>
      <button class="buy" data-trade="${i}">+${buys[s!.k]} g</button><button class="buy" data-tradeall="${i}">all +${buys[s!.k]! * s!.n} g</button></div>`).join('')
      : `<div class="say" style="opacity:.7">You have nothing I would buy. I pay for ${Object.keys(buys).map((k) => ITEMS[k as ItemKey].name).join(', ')}.</div>`) +
    `<button class="opt" data-o="back">${OPT_TEXT.back}</button>`;
}
/** Mirek buys vehicles back at half price (less for wrecks) and parts for a fifth of what he charges. */
function renderSell(msg?: string) {
  if (W.talkNpc!.role !== 'dealer') { renderTrade(msg); return; }
  const offers = vehiclesForSale(), parts = [...G.char.hands.map((s, i) => ({ s, i: 'h:' + i })), ...G.char.inv.map((s, i) => ({ s, i: 'p:' + i }))].filter(({ s }) => s && PART_PRICE[s.k]);
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
const SIDE_NAME = { W: 'west', E: 'east', S: 'south', N: 'north' } as const;
/** The elder's commissions: raise the fence to the next tier (materials handed over bit by bit), and the power plant. */
function renderFortify(msg?: string) {
  const v = loadedVillage(town()), c = G.char;
  if (!v) { renderTalk('Hm?'); return; }
  const st = c.towns[v.id], plan = fortifyPlan(st), wall = WALL_TIERS[plan ? plan.from : WALL_TIERS.length - 1];
  const k = powerKind(v.vm.seed), pc = Math.round(powerCondition(v.vm.seed, st, c.time)), side = SIDE_NAME[powerSite(v.vm.seed).side];
  const power = `Our power comes from the <b>${POWER[k].name}</b> outside the ${side} fence: ${pc < POWER_DOWN ? '<span style="color:var(--red,#ff5a3c)">it is down</span>' : pc < POWER_LOW ? 'it is failing' : 'it runs'} (${pc}%). ` +
    (pc < 90 ? `Mend it with ${POWER[k].fix.map(([i, n]) => `${n} ${ITEMS[i].name}`).join(', ')} and we will pay you.` : 'Keep an eye on it for us.');
  const rows = plan ? plan.rows.map((r) => {
    const have = count(c.inv, r.k), left = r.n - r.given;
    return `<div class="shoprow"><div><b>${ITEMS[r.k].name}</b><br><span>${r.given} / ${r.n} handed over${left > 0 ? ` · you carry ${have}` : ' · done'}</span></div></div>`;
  }).join('') : '';
  const canGive = !!plan && plan.rows.some((r) => r.given < r.n && count(c.inv, r.k) > 0);
  panel().innerHTML = dlgHead() + `<div class="say">${msg ? msg + '<br><br>' : ''}` +
    (plan ? `Our wall is a <b>${wall.name}</b>. Help us raise a <b>${WALL_TIERS[plan.to].name}</b> (${WALL_TIERS[plan.to].h} m) and the village will pay you <b>${plan.gold} gold</b>. Bring the materials a load at a time: we keep count.`
      : `Our wall is a <b>${wall.name}</b>, as strong as we can make it. Thank you.`) + `<br><br>${power}</div>` + rows +
    (plan ? `<button class="opt" data-fort="give" ${canGive ? '' : 'disabled'}>Hand over what I carry</button>` : '') +
    `<button class="opt" data-o="back">${OPT_TEXT.back}</button>`;
}
function giveFortify() {
  const v = loadedVillage(town()), c = G.char;
  if (!v) return;
  const st = (c.towns[v.id] ??= {}), plan = fortifyPlan(st)!;
  const { taken, raised } = handOver(st, (k) => count(c.inv, k));
  for (const [k, n] of taken) { let left = n; for (let i = 0; i < c.inv.length && left; i++) { const s = c.inv[i]; if (s?.k === k) { const m = Math.min(left, s.n); s.n -= m; left -= m; if (s.n <= 0) c.inv[i] = null; } } }
  if (!raised) { saveChar(); renderFortify(taken.length ? 'Handed over: ' + taken.map(([k, n]) => `${ITEMS[k].name} ×${n}`).join(', ') + '.' : 'You carry nothing we still need.'); return; }
  c.gold += plan.gold; gainXp(plan.xp); calcStats(); saveChar();
  closeDialog();
  reloadStruct(v.id);
  showToast(`${v.vm.name} raises a ${WALL_TIERS[plan.to].name}`);
  logLine(`The villagers work through the night and the new wall stands. They pay you ${plan.gold} gold.`);
}
dlgEl.addEventListener('click', (e) => {
  if (craftClick(e.target as HTMLElement) || buildClick(e.target as HTMLElement)) return;
  const mm = marketClick(e.target as HTMLElement);
  if (mm !== null) { renderMarket(panel(), dlgHead(), mm); return; }
  const t = e.target as HTMLElement, o = t.closest<HTMLElement>('[data-o]'), b = t.closest<HTMLElement>('.buy'), c = G.char;
  if (b && b.dataset.v) { renderVehicleShop(buyVehicle(b.dataset.v as VehicleModel)); return; }
  if (b && b.dataset.sellv) { renderSell(sellVehicle(b.dataset.sellv)); return; }
  if (b && b.dataset.sells) {
    const [w, i] = b.dataset.sells.split(':'), L = listOf(w), s = L[+i];
    if (s && PART_PRICE[s.k]) { c.gold += partBuyback(s); if (--s.n <= 0) L[+i] = null; handsChanged(); saveChar(); renderSell('Sold: ' + ITEMS[s.k].name + '.'); }
    return;
  }
  if (b && (b.dataset.trade || b.dataset.tradeall)) {
    const i = +(b.dataset.trade ?? b.dataset.tradeall!), s = c.inv[i], price = s && BUYS[W.talkNpc!.role]?.[s.k];
    if (s && price) {
      const n = b.dataset.tradeall ? s.n : 1;
      c.gold += price * n; s.n -= n; if (s.n <= 0) c.inv[i] = null; saveChar();
      renderTrade(`Sold: ${ITEMS[s.k].name}${n > 1 ? ' ×' + n : ''}.`);
    }
    return;
  }
  if (b) {
    const k = b.dataset.k as keyof typeof ITEMS, p = +b.dataset.p!;
    if (c.gold < p) return renderShop('Not enough gold.');
    if (!addItem(k)) return renderShop(HANDS_ONLY.has(k) ? 'You carry that in your hands, and they are full: put what you hold away first.' : 'No room in your backpack (slots or bulk).');
    c.gold -= p; calcStats(); saveChar(); return renderShop('Bought: ' + ITEMS[k].name + '.');
  }
  if (t.closest('[data-fort]')) { giveFortify(); return; }
  const qb = t.closest<HTMLElement>('[data-q]');
  if (qb) { renderTalk(questTalk(qb.dataset.q!) || 'Hm?'); return; }
  if (!o) return;
  const r = W.talkNpc!.role;
  switch (o.dataset.o as OptId | 'back') {
    case 'bye': closeDialog(); break;
    case 'back': renderTalk('Anything else?'); break;
    case 'shop': renderShop(); break;
    case 'sell': renderSell(); break;
    case 'craft': showForge(); break;
    case 'cook': {
      let n = 0; for (const s of c.inv) if (s?.k === 'meatR') n += s.n;
      if (!n) { renderTalk('Raw meat, friend. Bring me some from a Bramble and I will roast it.'); break; }
      n = Math.min(n, Math.floor(c.gold / COOK_PRICE));
      if (!n) { renderTalk(`${COOK_PRICE} gold a piece, and you have not got it.`); break; }
      let left = n;
      for (let i = 0; i < c.inv.length && left; i++) { const s = c.inv[i]; if (s?.k === 'meatR') { const m = Math.min(left, s.n); s.n -= m; left -= m; if (s.n <= 0) c.inv[i] = null; } }
      const lost = putItems(c.inv, 'meatC', n); // the raw pieces made room, so this fits
      c.gold -= COOK_PRICE * (n - lost); if (lost) putItems(c.inv, 'meatR', lost);
      saveChar(); renderTalk(`Jan takes your meat to the kitchen and comes back with it sizzling. (Roasted Meat ×${n - lost}, -${COOK_PRICE * (n - lost)} gold)`);
      break;
    }
    case 'rest':
      if (G.hp >= G.S.maxHp && c.kcal >= 2100 && c.water >= 70) renderTalk('You look well rested already. Save your coin.');
      else if (c.gold < 10) renderTalk('Ten gold for a bed, love. Come back when you have it.');
      else { c.gold -= 10; G.hp = G.S.maxHp; c.kcal = Math.max(c.kcal, 2100); c.stomach = Math.max(c.stomach, 1); c.water = Math.max(c.water, 70); saveChar(); renderTalk('A bowl of soup, a jug of water, and you sleep like a stone. (HP restored, fed and watered)'); }
      break;
    case 'rumour': renderTalk(RUMOURS[(Math.random() * RUMOURS.length) | 0]); break;
    case 'chat': renderTalk(VILLAGER_LINES[(Math.random() * VILLAGER_LINES.length) | 0]); break;
    case 'lore': renderTalk(here(loreText())); break;
    case 'fortify': renderFortify(); break;
    case 'trade': if (openMarket(town())) renderMarket(panel(), dlgHead()); else renderTalk('Hm?'); break;
    case 'work':
      if (!inGridholm()) { renderTalk(`We are too small a place for a notice board. Gridholm posts work on its plaza; that is where the paying jobs are.`); break; }
      renderTalk(r === 'elder' ? 'Read the notice board on the plaza. Folk post their troubles there, and when my name is on a notice, come and see me.'
        : 'Have a look at the notice board on the plaza. If I need something, you will find it there.');
      break;
  }
});
