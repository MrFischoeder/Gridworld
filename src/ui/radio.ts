// (0.251, PLAN_MAGAZYNOW.md stage M3) The radio link in the warehouses' windows: the mast (built here at a village's
// warehouse from its stock; at a port or a wild warehouse as a part of the outpost, ui/port.ts), whether it works,
// and the stocks of the warehouses it is linked to. The village computers show the same (ui/terminal.ts).
import { G } from '../game';
import { ITEMS, type ItemKey } from '../data/items';
import { gainXp } from '../character';
import { findPoi, worldDist } from '../gen/regions';
import { hubs, type Hub } from '../gen/warehouses';
import { RADIO } from '../gen/radiomast';
import { mastPlan, handOverMast, mastWhy, linkedHubs, hubStock } from '../gen/radio';
import { jobOf } from '../gen/construction';
import { stockHas, stockTake, hallNote, lacking, buildButton } from './stock';
import { jobHTML } from './jobs';
import { itemName } from './icons';
import { fmtDist } from './compass';
import { tl, TL } from '../i18n';

const WHY: Record<string, string> = {
  none: '', idle: tl('The mast is silent: the warehouse stands idle (no storekeepers or no power).'),
  hands: tl('The mast is silent: nobody is free to sit at the radio.'), power: tl('The mast is silent: too little power.'),
};
/** A stock in one line: the most of what it holds. */
export const stockLine = (st: [ItemKey, number][], max = 8) => (st.length ? st.slice(0, max).map(([k, n]) => `${ITEMS[k].name} ${n}`).join(' · ') + (st.length > max ? ' …' : '') : tl('empty'));
/** The warehouses `id` is linked to, with their stocks (for the windows and the computers). */
export function linkedHTML(id: string, compact = false): string {
  const c = G.char, me = hubs(c.world, c.towns, c.outposts).find((h) => h.id === id);
  if (!me) return '';
  const why = mastWhy(c.world, me, c.towns, c.outposts, c.time);
  if (why === 'none') return '';
  if (why) return `<div class="say" style="color:var(--warn,#ff5a3c)">${WHY[why]}</div>`;
  const list = linkedHubs(c.world, c.towns, c.outposts, id, c.time).sort((a, b) => worldDist(a.x, a.z, me.x, me.z) - worldDist(b.x, b.z, me.x, me.z));
  if (!list.length) return TL`<div class="say">The radio is on, but no other warehouse with a working mast lies within ${RADIO.reach / 1000} km.</div>`;
  return TL`<div class="say"><b>On the radio</b> (${list.length}):</div>` + list.map((h: Hub) =>
    `<div class="say"${compact ? ' style="margin:2px 0"' : ''}><b>${h.name}</b> <span style="opacity:.7">${fmtDist(worldDist(h.x, h.z, me.x, me.z))}</span><br><span style="opacity:.85">${stockLine(hubStock(c.world, h, c.towns, c.outposts, c.time))}</span></div>`).join('');
}
/** A village warehouse's mast row: build it from the stock, the builders at it, or what it hears. */
export function villageRadioHTML(vid: number): string {
  const c = G.char, s = c.towns[vid], id = 'v:' + vid;
  if (s?.mast) return TL`<div class="say"><b style="color:var(--xp)">${RADIO.name} ✓</b> · links to masts within ${RADIO.reach / 1000} km.</div>` + linkedHTML(id);
  const job = jobHTML(s, 'radio', undefined, RADIO.name.toLowerCase());
  if (job || jobOf(s, 'radio')) return job;
  const has = stockHas(vid), rows = mastPlan(s), miss = lacking(rows, has);
  return TL`<div class="say"><b>${RADIO.name}</b> <span style="opacity:.8">(${RADIO.hours} h to build, ${RADIO.kw} kW, one radio operator)</span>: ${RADIO.text} Masts within ${RADIO.reach / 1000} km link, and on through each other.<br>` +
    rows.map((r) => `${itemName(r.k)} ${r.given}/${r.n}${hallNote(has(r.k), r.given, r.n)}`).join('<br>') + '</div>' +
    (miss ? `<div class="say" style="opacity:.7">${miss}</div>` : '') + buildButton('data-hradio="1"', RADIO.name.toLowerCase(), rows.some((r) => r.given < r.n && has(r.k) > 0));
}
/** The build button (inside the village's stock lock). Returns the message. */
export function villageRadioClick(vid: number): string {
  const c = G.char, s = (c.towns[vid] ??= {});
  const r = handOverMast(s, stockHas(vid), c.time);
  stockTake(vid, r.taken);
  if (r.started) { gainXp(RADIO.xp); return TL`The builders start on the radio mast of ${findPoi(c.world, vid)?.name ?? ''}.`; }
  return r.taken.length ? TL`Handed over ${r.taken.map(([k, n]) => `${ITEMS[k].name} ×${n}`).join(', ')}.` : tl('The village hall has nothing more for it.');
}
