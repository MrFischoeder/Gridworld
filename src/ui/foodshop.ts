// The grocer's shop (gen/foodshop.ts): the dishes cooked from the village hall's stock, with how many portions there
// are and what they come from; a flask of water always. Buying takes a portion (a crate from the hall when the pantry
// runs out). Opened from the grocer's 'shop' option (ui/dialog.ts renderShop).
import { G } from '../game';
import { ITEMS } from '../data/items';
import { MENU, portions, priceOf, sellPortion } from '../gen/foodshop';
import { stockAt } from './stock';
import { stockFor } from '../data/npcs';
import { addItem, calcStats, saveChar } from '../character';
import { itemName } from './icons';

const larder = (vid: number) => { const s = stockAt(vid); return { has: (k: Parameters<NonNullable<typeof s>['has']>[0]) => s?.has(k) ?? 0, take: (k: Parameters<NonNullable<typeof s>['has']>[0], n: number) => s?.take(k, n) ?? 0 }; };

export function foodHTML(head: string, vid: number | null, msg = ''): string {
  const c = G.char, st = vid !== null ? c.towns[vid] : undefined, l = vid !== null ? larder(vid) : { has: () => 0, take: () => 0 };
  const rows = MENU.map((d) => {
    const n = portions(d, st, l), p = priceOf(d, st, l), from = d.from.map((i) => ITEMS[i].name.replace(/^(Sack|Basket|Churn) of /, '').toLowerCase()).join(' or ');
    const note = n === Infinity ? `no ${from} in the village hall: baked from bought flour` : n > 0 ? `${n} ready · from the village's ${from}` : `none: the village hall has no ${from}`;
    return `<div class="shoprow"><div>${itemName(d.k)}<br><span>${ITEMS[d.k].desc}</span><br><span style="opacity:.75">${note}</span></div>
      <button class="buy" data-food="${d.k}" ${n > 0 && c.gold >= p ? '' : 'disabled'}>${p} g</button></div>`;
  }).join('');
  const always = stockFor('grocer', c.world).map(([k, p]) => `<div class="shoprow"><div>${itemName(k)}<br><span>${ITEMS[k].desc}</span></div>
      <button class="buy" data-k="${k}" data-p="${p}" ${c.gold < p ? 'disabled' : ''}>${p} g</button></div>`).join('');
  return head + `<div class="say">Your gold: <b>${c.gold}</b>${msg ? '<br>' + msg : ''}<br><span style="opacity:.8">I cook with what the village has in its hall: its fields, its hens and cows, and whatever you have stored there.</span></div>` + rows + always + `<button class="opt" data-o="back">Back</button>`;
}
/** A click on a dish: the message, or null when it was not a dish button. */
export function foodClick(t: HTMLElement, vid: number | null): string | null {
  const b = t.closest<HTMLElement>('[data-food]');
  if (!b) return null;
  const d = MENU.find((x) => x.k === b.dataset.food), c = G.char;
  if (!d || vid === null) return '';
  const st = (c.towns[vid] ??= {}), l = larder(vid), p = priceOf(d, st, l);
  if (c.gold < p) return 'Not enough gold.';
  if (portions(d, st, l) <= 0) return 'There is none left.';
  if (!addItem(d.k)) return 'No room in your backpack.';
  sellPortion(d, st, l);
  c.gold -= p; calcStats(); saveChar();
  return `Bought: ${ITEMS[d.k].name}.`;
}
