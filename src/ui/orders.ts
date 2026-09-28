// The blacksmith's orders (data/orders.ts): "Make something for me." Every piece of work he knows from the plans you
// recovered; you hand over the materials from your backpack and it is done on the spot.
import { G } from '../game';
import { ITEMS, PACK } from '../data/items';
import { ORDERS, orderState, placeOrder, known as knows } from '../data/orders';
import { count } from '../data/crafting';
import { TECH_BY_ID } from '../gen/tech';
import { saveChar, calcStats, handsChanged } from '../character';

/** The order list, as dialogue panel HTML (after `head`). */
export function ordersHTML(head: string, msg = ''): string {
  const c = G.char, known = ORDERS.filter((o) => knows(o, c.tech)), lost = ORDERS.filter((o) => !knows(o, c.tech));
  const rows = known.map((o) => {
    const i = ORDERS.indexOf(o), st = orderState(o, c.tech, c.inv);
    const needs = o.needs.map(([k, n]) => { const h = count(c.inv, k); return `<span style="color:${h >= n ? 'var(--xp)' : '#ff9a7a'}">${ITEMS[k].name} ${Math.min(h, n)}/${n}</span>`; }).join(' · ');
    return `<div class="shoprow"><div><b>${ITEMS[o.out].name}${o.n > 1 ? ' ×' + o.n : ''}</b> <span class="tag" style="opacity:.7">${o.tech ? TECH_BY_ID[o.tech].name : 'basic'}</span><br><span>${needs}</span></div>
      <button class="buy" data-make="${i}" ${st ? 'disabled' : ''}>Make</button></div>`;
  }).join('');
  const plans = [...new Set(lost.map((o) => o.tech))].map((t) => TECH_BY_ID[t].name);
  return head + `<div class="say">${msg ? msg + '<br><br>' : ''}${known.some((o) => o.tech) ? 'Bring me the materials and I will make it. The finer work I know only from the old plans you found.' : 'Simple tools I can make you from wood and stone. The finer work of the old days is lost: find me the old plans (ask around about old machines) and bring me the materials, and I will make what they show.'}</div>` +
    rows + (plans.length ? `<div class="say" style="opacity:.75">Still lost: ${plans.join(', ')}.</div>` : '') + `<button class="opt" data-o="back">Back</button>`;
}
/** A click on "Make": the message to show, or null when it was not an order button. */
export function ordersClick(t: HTMLElement): string | null {
  const b = t.closest<HTMLElement>('[data-make]');
  if (!b) return null;
  const o = ORDERS[Number(b.dataset.make)], c = G.char;
  if (!o) return '';
  const why = placeOrder(o, c.tech, c.inv, PACK.vol, c.hands);
  if (why === 'plans') return 'I do not know that work.';
  if (why === 'missing') return 'You do not have all the materials with you.';
  if (why === 'room') return 'You have no room for it in your backpack.';
  if (why === 'hands') return 'That one is too big for a backpack: empty your hands first.';
  calcStats(); handsChanged(); saveChar();
  return `The forge roars and the hammer rings. (${ITEMS[o.out].name}${o.n > 1 ? ' ×' + o.n : ''})`;
}
