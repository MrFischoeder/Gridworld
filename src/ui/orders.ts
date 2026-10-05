import { smithAllows, starterRecipe, progressive } from '../gen/settlement';
// The blacksmith's orders (data/orders.ts): "Make something for me." Every piece of work he knows from the plans you
// recovered; he takes the materials from the village hall's stock (ui/stock.ts) and it is done on the spot.
import { G } from '../game';
import { ITEMS } from '../data/items';
import { ORDERS, known as knows } from '../data/orders';
import { TECH_BY_ID } from '../gen/tech';
import { saveChar, calcStats, handsChanged, addItem } from '../character';
import { stockHas, stockTake } from './stock';

/** The order list, as dialogue panel HTML (after `head`). */
export function ordersHTML(head: string, vid: number | null, msg = ''): string {
  const c = G.char, st = vid === null ? undefined : c.towns[vid], has = vid !== null ? stockHas(vid) : () => 0;
  const allowed = ORDERS.filter((o) => smithAllows(st, o.out));
  const known = allowed.filter((o) => knows(o, c.tech) || starterRecipe(st, o.out));
  const lost = allowed.filter((o) => !(knows(o, c.tech) || starterRecipe(st, o.out)));

  const rows = known.map((o) => {
    const i = ORDERS.indexOf(o), missing = o.needs.every(([k, n]) => has(k) >= n) ? '' : 'missing';
    const needs = o.needs.map(([k, n]) => { const h = has(k); return `<span style="color:${h >= n ? 'var(--xp)' : '#ff9a7a'}">${ITEMS[k].name} ${Math.min(h, n)}/${n}</span>`; }).join(' · ');
    return `<div class="shoprow"><div><b>${ITEMS[o.out].name}${o.n > 1 ? ' ×' + o.n : ''}</b> <span class="tag" style="opacity:.7">${o.tech && !starterRecipe(st, o.out) ? TECH_BY_ID[o.tech].name : 'basic'}</span><br><span>${needs}</span></div>
      <button class="buy" data-make="${i}" ${missing ? 'disabled' : ''}>Make</button></div>`;
  }).join('');
  const plans = [...new Set(lost.map((o) => o.tech))].map((t) => TECH_BY_ID[t].name);
  return head + `<div class="say">${msg ? msg + '<br><br>' : ''}${progressive(st) ? 'Our forge expands as the village grows. ' : ''}${known.some((o) => o.tech) ? 'I take the materials from the village hall: store them at its terminal (outside the north gate) and I will make it. The finer work I know only from the old plans you found.' : 'Simple tools I can make you from wood and stone. The finer work of the old days is lost: find me the old plans (ask around about old machines) and store the materials in the village hall, and I will make what they show.'}</div>` +
    rows + (plans.length ? `<div class="say" style="opacity:.75">Still lost: ${plans.join(', ')}.</div>` : '') + `<button class="opt" data-o="back">Back</button>`;
}
/** A click on "Make": the message to show, or null when it was not an order button. */
export function ordersClick(t: HTMLElement, vid: number | null): string | null {
  const b = t.closest<HTMLElement>('[data-make]');
  if (!b) return null;
  const o = ORDERS[Number(b.dataset.make)], c = G.char;
  if (!o || vid === null) return '';
  const st = c.towns[vid];
  if (!smithAllows(st, o.out) || !(knows(o, c.tech) || starterRecipe(st, o.out))) return 'This work needs more village development or its old plans.';
  const has = stockHas(vid);
  if (!o.needs.every(([k, n]) => has(k) >= n)) return 'The village hall does not have all the materials. Store them at its terminal.';
  let made = 0;
  for (let i = 0; i < o.n; i++) if (addItem(o.out)) made++; else break;
  if (!made) return c.hands[0] ? 'That one is too big for a backpack: empty your hands first.' : 'You have no room for it in your backpack.';
  stockTake(vid, o.needs);
  calcStats(); handsChanged(); saveChar();
  return `The forge roars and the hammer rings. (${ITEMS[o.out].name}${o.n > 1 ? ' ×' + o.n : ''})`;
}
