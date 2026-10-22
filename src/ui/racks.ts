// (0.250, PLAN_MAGAZYNOW.md stage M2) The racks row of a warehouse window (the village hall or warehouse, ui/hall.ts; a
// port's or a wild warehouse, ui/port.ts): what stands on the racks and the room it adds, the crate or barrel in your
// hands put on them (an empty one) or emptied into the hold (a loaded one), one taken back off. The windows run the
// clicks under their warehouse's lock and pass `attr` (their own button attribute) and the hold's numbers.
import { G } from '../game';
import { ITEMS, type ItemKey } from '../data/items';
import { CARGO, isCargo, takeOut } from '../data/cargo';
import { RACK, rackCount, rackVol, rackGain, rackProblem, putRack, takeRack, type Racks } from '../gen/racks';
import { settleCrates } from '../character';
import { handsChanged } from '../character';
import { itemName } from './icons';
import { tl, TL } from '../i18n';

const btn = (attr: string, v: string, t: string) => `<button class="opt" style="display:inline-block;width:auto;margin:2px 4px" ${attr}="${v}">${t}</button>`;
/** The racks row; `attr` makes the buttons ('data-hrack', or 'data-port' with values prefixed 'rack:'). */
export function racksHTML(r: Racks | undefined, attr: string, pre = ''): string {
  const n = rackCount(r), h = G.char.hands[0];
  let s = '';
  if (n) { // (0.251) crates come and go on their own now: the racks already standing keep their room
    s += TL`<div class="say"><b>Racks</b>: ${n} crates and barrels stacked tidily, +${Math.round(rackVol(r))} L of room.`;
    const on = (Object.entries(r ?? {}) as [ItemKey, number][]).filter(([, m]) => m > 0);
    if (on.length) s += '<br>' + on.map(([k, m]) => `${itemName(k)} ×${m}`).join(', ');
    s += '</div>';
  }
  if (h && isCargo(h.k) && h.b) s += btn(attr, pre + 'empty', TL`Unload the ${ITEMS[h.k].name.toLowerCase()} of ${ITEMS[h.b.k].name} in your hands into the hold`);
  return s;
}
/**
 * A racks click (`what` = 'put', 'empty' or 'take:<item>'): `put(k, n)` stores into the hold (returns how many went in),
 * `used` / `cap` are the hold's litres now. Returns the message.
 */
export function rackClick(r: Racks, what: string, put: (k: ItemKey, n: number) => number, used: number, cap: number): string {
  const h = G.char.hands[0];
  if (what === 'put') {
    if (!h || !isCargo(h.k)) return tl('Carry an empty crate or barrel in your hands.');
    const why = rackProblem(r, h.k, !!h.b);
    if (why === 'loaded') return tl('Empty it first.');
    if (why === 'full') return TL`The racks hold ${RACK.max} at most.`;
    putRack(r, h.k);
    if (--h.n <= 0) G.char.hands[0] = null;
    handsChanged();
    return TL`The ${ITEMS[h.k].name.toLowerCase()} goes on the racks: +${Math.round(rackGain(h.k))} L of room.`;
  }
  if (what === 'empty') {
    if (!h?.b) return tl('It is empty.');
    const k = h.b.k, m = put(k, h.b.n);
    takeOut(h, m);
    const name = ITEMS[h.k].name.toLowerCase(), rest = !!h.b; settleCrates(); // (0.251) emptied, the crate is gone
    return m ? TL`${ITEMS[k].name} ×${m} out of the ${name} into the hold${rest ? tl(' (the rest stays: the hold is full)') : ''}.` : tl('The hold is full.');
  }
  if (what.startsWith('take:')) {
    const k = what.slice(5) as ItemKey;
    if (!CARGO[k]) return '';
    if (h) return tl('Your hands are full.');
    if (!takeRack(r, k, used, cap)) return (r[k] ?? 0) ? tl('The hold would not fit what is stored without it.') : '';
    G.char.hands[0] = { k, n: 1 }; handsChanged();
    return TL`You take a ${ITEMS[k].name.toLowerCase()} off the racks.`;
  }
  return '';
}
