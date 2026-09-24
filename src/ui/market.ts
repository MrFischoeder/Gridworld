// The trade window at a village's general store (the merchant's option 'trade'): the goods of gen/market.ts with
// what the store asks and pays, its stock, what you carry, and the best price you have seen elsewhere for each.
// Crates come from and go to your backpack and the trunks of your vehicles parked by the village, so a vehicle
// makes a caravan. Every visit writes the prices into your ledger; the merchant passes on word of nearby markets.
import { G } from '../game';
import { ITEMS, PACK, type ItemKey } from '../data/items';
import { count } from '../data/crafting';
import { putItems } from '../inventory';
import { calcStats, saveChar } from '../character';
import { GOODS, quote, trade, tidyMarket, profileOf, type Good } from '../gen/market';
import { allVillages, findPoi, villageSeed, worldDist, type Poi } from '../gen/regions';
import { loadedVillage } from '../world/overworld';
import { vehicles } from '../world/vehicles';
import { bearingTo, point8, fmtDist } from './compass';
import type { Slot } from '../save';
import { lastArrival } from '../gen/caravans';

const TRUNK_REACH = 90; // metres from the village middle: vehicles parked by the gates count
let here: { poi: Poi; seed: number } | null = null;

const ago = (t: number) => { const h = (G.char.time - t) / 60; return h < 1 ? 'just now' : h < 24 ? Math.round(h) + ' h ago' : Math.round(h / 24) + ' d ago'; };
/** Your backpack, then the trunks of your vehicles parked by the village. */
function stores(): { name: string; slots: (Slot | null)[]; cap?: number }[] {
  const out: { name: string; slots: (Slot | null)[]; cap?: number }[] = [{ name: 'backpack', slots: G.char.inv, cap: PACK.vol }];
  if (here) for (const v of vehicles) if (v.claimed && !v.ai && worldDist(v.st.x, v.st.z, here.poi.x, here.poi.z) < TRUNK_REACH) out.push({ name: 'trunk', slots: v.st.trunk.items });
  return out;
}
const carried = (g: Good) => stores().reduce((a, s) => a + count(s.slots, g), 0);
function takeFrom(g: Good, n: number) {
  for (const s of stores()) for (let i = 0; i < s.slots.length && n > 0; i++) { const x = s.slots[i]; if (x?.k === g) { const m = Math.min(n, x.n); x.n -= m; n -= m; if (x.n <= 0) s.slots[i] = null; } }
}
/** Put n crates away; returns how many found no room. */
function putAway(g: Good, n: number): number { for (const s of stores()) if (n > 0) n = putItems(s.slots, g as ItemKey, n, s.cap); return n; }

function record() {
  if (!here) return;
  const c = G.char, q: Record<string, [number, number]> = {};
  for (const g of GOODS) { const o = quote(here.poi, here.seed, c.world, g, c.market, c.time); q[g] = [o.buy, o.sell]; }
  c.ledger[here.poi.id] = { t: c.time, name: here.poi.name, x: here.poi.x, z: here.poi.z, q };
}
/** The best price paid for `g` elsewhere, from what you have seen. */
function bestElsewhere(g: Good) {
  let best: { name: string; p: number; x: number; z: number; t: number } | null = null;
  for (const [id, e] of Object.entries(G.char.ledger)) if (+id !== here?.poi.id && e.q[g] && (!best || e.q[g][1] > best.p)) best = { name: e.name, p: e.q[g][1], x: e.x, z: e.z, t: e.t };
  return best;
}
/** Word from the road: what the nearest markets you have not seen yet are said to want. */
function hearsay(): string {
  if (!here) return '';
  const car = lastArrival(G.char.world, here.poi.id, G.char.time);
  const news = car ? `A caravan from <b>${car.fromName}</b> came in ${ago(car.t0 + car.T)} with ${car.n} crates of ${ITEMS[car.good].name}.<br>` : '';
  return news + rumours();
}
function rumours(): string {
  if (!here) return '';
  const c = G.char, vs = allVillages(c.world).filter((v) => v.id !== here!.poi.id && !c.ledger[v.id]).map((v) => ({ v, d: worldDist(v.x, v.z, here!.poi.x, here!.poi.z) })).filter((o) => o.d < 9000).sort((a, b) => a.d - b.d).slice(0, 2);
  return vs.map(({ v, d }) => { const p = profileOf(c.world, v, villageSeed(c.world, v)); return `Traders say <b>${v.name}</b> (${fmtDist(d)} ${point8(bearingTo(v.x, v.z))}) pays well for ${p.wants.map((g) => ITEMS[g].name).join(' and ')}.`; }).join('<br>');
}

export function renderMarket(panel: HTMLElement, head: string, msg = '') {
  if (!here) return;
  const c = G.char, p = profileOf(c.world, here.poi, here.seed), trunks = stores().length - 1;
  tidyMarket(c.market, c.time); record();
  const rows = GOODS.map((g) => {
    const q = quote(here!.poi, here!.seed, c.world, g, c.market, c.time), have = carried(g), b = bestElsewhere(g);
    const tag = q.role === 'make' ? '<span class="tag" style="color:var(--gold)">made here</span>' : q.role === 'want' ? '<span class="tag" style="color:#9dffe0">wanted here</span>' : '';
    const else_ = b ? `best price seen elsewhere: ${b.p} g at ${b.name} (${fmtDist(worldDist(b.x, b.z, here!.poi.x, here!.poi.z))} ${point8(bearingTo(b.x, b.z))}, ${ago(b.t)})` : '';
    return `<div class="mrow"><div><b>${ITEMS[g].name}</b>${tag}</div><div class="num">${q.stock}</div><div class="num">${have}</div>
      <button class="buy" data-mb="${g}" data-n="1" ${q.stock < 1 || c.gold < q.buy ? 'disabled' : ''}>buy ${q.buy} g</button>
      <button class="buy" data-mb="${g}" data-n="5" ${q.stock < 5 || c.gold < q.buy * 5 ? 'disabled' : ''}>×5</button>
      <button class="buy" data-ms="${g}" data-n="1" ${have < 1 ? 'disabled' : ''}>sell ${q.sell} g</button>
      <button class="buy" data-ms="${g}" data-n="${have}" ${have < 2 ? 'disabled' : ''}>all</button>${else_ ? `<div class="best">${else_}</div>` : ''}</div>`;
  }).join('');
  panel.classList.add('wide');
  panel.innerHTML = head + `<div class="say">${msg ? msg + '<br>' : ''}Gold: <b>${c.gold}</b> · ${here.poi.name} makes ${p.makes.map((g) => ITEMS[g].name).join(' and ')}, and wants ${p.wants.map((g) => ITEMS[g].name).join(' and ')}.<br>
    <span style="opacity:.8">Crates go into your backpack${trunks ? ` and ${trunks > 1 ? 'the trunks of your vehicles' : 'the trunk of your vehicle'} parked by the village` : ' (park a vehicle by the gates to trade by the trunkload)'}. Buy where a good is made, sell where it is wanted; prices move as you trade and settle back over a day or two.</span></div>` +
    `<div class="mkt"><div class="mrow head"><div>good</div><div class="num">stock</div><div class="num">yours</div><div>you pay</div><div></div><div>you get</div><div></div></div>${rows}</div>` + (hearsay() ? `<div class="say" style="opacity:.85">${hearsay()}</div>` : '') + `<button class="opt" data-o="back">Back</button>`;
}
/** Open the market of the village the merchant belongs to. */
export function openMarket(town: string): boolean {
  const v = loadedVillage(town), poi = v && findPoi(G.char.world, v.id);
  if (!v || !poi) return false;
  here = { poi, seed: v.vm.seed };
  return true;
}
/** Clicks in the trade window. Returns a message to show, or null when the click was not ours. */
export function marketClick(t: HTMLElement): string | null {
  const b = t.closest<HTMLElement>('[data-mb],[data-ms]');
  if (!b || !here) return null;
  const c = G.char, buying = !!b.dataset.mb, g = (b.dataset.mb ?? b.dataset.ms) as Good;
  let n = Math.max(1, +b.dataset.n!);
  const name = ITEMS[g].name;
  if (buying) {
    let paid = 0, got = 0;
    for (let i = 0; i < n; i++) { // one at a time: every crate moves the price
      const q = quote(here.poi, here.seed, c.world, g, c.market, c.time);
      if (q.stock < 1 || c.gold < q.buy) break;
      if (putAway(g, 1) > 0) { if (!got) return 'No room for a crate in your backpack or a trunk nearby.'; break; }
      c.gold -= q.buy; paid += q.buy; got++; trade(c.market, here.poi.id, g, -1, c.time);
    }
    calcStats(); saveChar();
    return got ? `Bought ${name} ×${got} for ${paid} gold.` : 'You cannot buy that now.';
  }
  n = Math.min(n, carried(g));
  let earned = 0;
  for (let i = 0; i < n; i++) { const q = quote(here.poi, here.seed, c.world, g, c.market, c.time); takeFrom(g, 1); c.gold += q.sell; earned += q.sell; trade(c.market, here.poi.id, g, 1, c.time); }
  calcStats(); saveChar();
  return n ? `Sold ${name} ×${n} for ${earned} gold.` : 'You have none to sell.';
}
