import { smithAllows, starterRecipe, progressive } from '../gen/settlement';
// The blacksmith's orders (data/orders.ts): "Make something for me." Every piece of work he knows from the plans you
// recovered; he takes the materials from the village hall's stock (ui/stock.ts) when you order it, and the work takes
// game hours (`forgeHours`): go about your business and come back to collect it (`char.forge`, yours alone).
import { G } from '../game';
import { ITEMS } from '../data/items';
import { ORDERS, known as knows } from '../data/orders';
import { TECH_BY_ID } from '../gen/tech';
import { saveChar, calcStats, handsChanged, addItem } from '../character';
import { showToast, logLine } from './hud';
import type { Order } from '../data/orders';
import { stockHas, stockTake } from './stock';

/** The order list, as dialogue panel HTML (after `head`). */
export function ordersHTML(head: string, vid: number | null, msg = ''): string {
  const c = G.char, st = vid === null ? undefined : c.towns[vid], has = vid !== null ? stockHas(vid) : () => 0;
  const allowed = ORDERS.filter((o) => smithAllows(st, o.out));
  const known = allowed.filter((o) => knows(o, c.tech) || starterRecipe(st, o.out));
  const lost = allowed.filter((o) => !(knows(o, c.tech) || starterRecipe(st, o.out)));

  const jobs = vid === null ? [] : forgeJobs(vid), full = (c.forge?.length ?? 0) >= FORGE.max;
  const queue = jobs.map(({ j, at }) => {
    const o = ORDERS[j.i], left = j.done - c.time;
    return `<div class="shoprow"><div><b>${ITEMS[o.out].name}${j.n > 1 ? ' ×' + j.n : ''}</b><br><span>${left > 0 ? 'in the forge · ready in ' + span(left) : '<span style="color:var(--xp)">ready</span>'}</span></div>
      <button class="buy" data-forge="${at}" ${left > 0 ? 'disabled' : ''}>Collect</button></div>`;
  }).join('');
  const rows = known.map((o) => {
    const i = ORDERS.indexOf(o), missing = o.needs.every(([k, n]) => has(k) >= n) && !full ? '' : 'missing';
    const needs = o.needs.map(([k, n]) => { const h = has(k); return `<span style="color:${h >= n ? 'var(--xp)' : '#ff9a7a'}">${ITEMS[k].name} ${Math.min(h, n)}/${n}</span>`; }).join(' · ');
    return `<div class="shoprow"><div><b>${ITEMS[o.out].name}${o.n > 1 ? ' ×' + o.n : ''}</b> <span class="tag" style="opacity:.7">${o.tech && !starterRecipe(st, o.out) ? TECH_BY_ID[o.tech].name : 'basic'}</span><br><span>${needs}</span></div>
      <button class="buy" data-make="${i}" ${missing ? 'disabled' : ''}>Order · ${forgeHours(o)} h</button></div>`;
  }).join('');
  const plans = [...new Set(lost.map((o) => o.tech))].map((t) => TECH_BY_ID[t].name);
  return head + `<div class="say">${msg ? msg + '<br><br>' : ''}${progressive(st) ? 'Our forge expands as the village grows. ' : ''}${known.some((o) => o.tech) ? 'I take the materials from the village hall when you order: bring them to the village stores. Good work takes time: come back in a few hours to collect it. The finer work I know only from the old plans you found.' : 'Simple tools I can make you from wood and stone. The finer work of the old days is lost: find me the old plans (ask around about old machines) and store the materials in the village hall, and I will make what they show.'}</div>` +
    (queue ? '<h3>In the forge</h3>' + queue : '') + (full ? `<div class="say" style="opacity:.8">You have ${FORGE.max} pieces of work waiting already: collect one before you order more.</div>` : '') + rows + (plans.length ? `<div class="say" style="opacity:.75">Still lost: ${plans.join(', ')}.</div>` : '') + `<button class="opt" data-o="back">Back</button>`;
}
/** At most this many pieces of work ordered at once (across the villages). */
export const FORGE = { max: 3 };
/** Game hours a piece of work takes: an hour for the basics, more for the work of older, harder plans. */
export const forgeHours = (o: Order) => (o.tech ? 1 + (TECH_BY_ID[o.tech]?.tier ?? 1) : 1);
const span = (min: number) => { const h = Math.floor(min / 60), m = Math.ceil(min % 60); return h ? `${h} h${m ? ' ' + m + ' min' : ''}` : `${m} min`; };
/** Your work at village vid's forge, with its index in `char.forge`. */
function forgeJobs(vid: number) {
  const c = G.char; return (c.forge ?? []).map((j, at) => ({ j, at })).filter(({ j }) => j.w === c.world && j.v === vid);
}
/** Collect finished work (into your hands or backpack; what does not fit waits at the forge). */
function collect(at: number): string {
  const c = G.char, j = c.forge?.[at];
  if (!j || j.done > c.time) return 'It is not ready yet.';
  const o = ORDERS[j.i]; let made = 0;
  while (made < j.n && addItem(o.out)) made++;
  if (!made) return c.hands[0] ? 'That one is too big for a backpack: empty your hands first.' : 'You have no room for it in your backpack.';
  j.n -= made; if (j.n <= 0) c.forge!.splice(at, 1);
  calcStats(); handsChanged(); saveChar();
  return `You take your ${ITEMS[o.out].name}${made > 1 ? ' ×' + made : ''} from the forge.` + (j.n > 0 ? ` ${j.n} more wait${j.n > 1 ? '' : 's'} for room in your pack.` : '');
}
let told = 0;
/** Main loop: tells you once when a piece of work is ready (checked every few seconds). */
export function updateForge(dt: number) {
  if ((told -= dt) > 0) return;
  told = 5;
  for (const j of G.char.forge ?? []) if (j.done <= G.char.time && !j.told) {
    j.told = 1;
    const o = ORDERS[j.i]; showToast(`Your ${ITEMS[o.out].name} is ready at the forge`); logLine(`The smith has finished your ${ITEMS[o.out].name}${j.n > 1 ? ' ×' + j.n : ''}: collect it at the forge.`);
  }
}
/** A click on "Order" or "Collect": the message to show, or null when it was not one of those buttons. */
export function ordersClick(t: HTMLElement, vid: number | null): string | null {
  const fb = t.closest<HTMLElement>('[data-forge]');
  if (fb) return collect(Number(fb.dataset.forge));
  const b = t.closest<HTMLElement>('[data-make]');
  if (!b) return null;
  const o = ORDERS[Number(b.dataset.make)], c = G.char;
  if (!o || vid === null) return '';
  const st = c.towns[vid];
  if (!smithAllows(st, o.out) || !(knows(o, c.tech) || starterRecipe(st, o.out))) return 'This work needs more village development or its old plans.';
  const has = stockHas(vid);
  if (!o.needs.every(([k, n]) => has(k) >= n)) return 'The village stores do not have all the materials. Bring them there first.';
  if ((c.forge?.length ?? 0) >= FORGE.max) return `You have ${FORGE.max} pieces of work waiting already: collect one first.`;
  stockTake(vid, o.needs);
  const h = forgeHours(o);
  (c.forge ??= []).push({ w: c.world, v: vid, i: ORDERS.indexOf(o), n: o.n, done: c.time + h * 60 });
  saveChar();
  return `The forge roars and the hammer rings. "Give me ${h} hour${h > 1 ? 's' : ''}, and your ${ITEMS[o.out].name}${o.n > 1 ? ' ×' + o.n : ''} will be ready. Go about your business."`;
}
