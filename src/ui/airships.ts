// (0.256, PLAN_LOTNICTWA.md stage F3) A warehouse's mooring mast and the airships built at it, in its window (a
// village's warehouse terminal, ui/hall.ts; a port's or a wild warehouse's board, ui/port.ts, where the mast is a part
// of the outpost): build the mast (a village, from its stock, with the plans Aviation), lay an airship's keel with the
// drive you pick, hand its materials over from the warehouse's stock, take it apart again. A finished airship goes into
// the shared list moored at the mast. The windows run the clicks under the warehouse's lock; `attr` makes their own
// button attribute.
import { G } from '../game';
import { ITEMS, type ItemKey } from '../data/items';
import { gainXp } from '../character';
import { findPoi } from '../gen/regions';
import { SEA } from '../gen/seas';
import { hubs, type Hub } from '../gen/warehouses';
import { jobOf } from '../gen/construction';
import { portTake } from '../gen/ports';
import { AIRMAST, AIRSHIP, type AirDrive } from '../gen/airmast';
import { amastPlan, handOverAmast, hasAmast, amastWhy, mastAt, moorPose, airRows, handOverAir, newAirship, airEnergy, airRangeKm } from '../gen/airships';
import { OW } from '../world/overworld';
import { redrawAirships } from '../world/airships';
import { stockHas, stockTake, hallNote, lacking, buildButton } from './stock';
import { jobHTML } from './jobs';
import { itemName } from './icons';
import { tl, TL } from '../i18n';

const hubOf = (id: string): Hub | undefined => hubs(G.char.world, G.char.towns, G.char.outposts).find((h) => h.id === id);
const btn = (attr: (v: string) => string, v: string, t: string) => `<button class="opt" ${attr(v)}>${t}</button>`;
const known = () => G.char.tech.aviation !== undefined;
const DRIVE: Record<AirDrive, string> = { fuel: tl('diesel engines'), cell: tl('electric motors on power cells') };
const WHY: Record<string, string> = {
  idle: tl('The mast stands idle: the warehouse has no storekeepers or no power. It still holds a ship, but charges none.'),
  hands: tl('The mast stands idle: nobody is free to tend it.'), power: tl('The mast stands idle: too little power to charge a ship.'),
};

/** A village warehouse's mast row: build it from the stock (with the plans), the builders at it, or nothing once it stands. */
export function villageMastHTML(vid: number): string {
  const c = G.char, s = c.towns[vid];
  if (s?.amast) return '';
  const job = jobHTML(s, 'airmast', undefined, AIRMAST.name.toLowerCase());
  if (job || jobOf(s, 'airmast')) return job;
  if (!known()) return TL`<div class="say" style="opacity:.7"><b>${AIRMAST.name}</b>: the plans for it are lost (Aviation, on an old data carrier).</div>`;
  const has = stockHas(vid), rows = amastPlan(s), miss = lacking(rows, has);
  return TL`<div class="say"><b>${AIRMAST.name}</b> <span style="opacity:.8">(${AIRMAST.hours} h to build, ${AIRMAST.kw} kW, one hand to tend it)</span>: ${AIRMAST.text}<br>` +
    rows.map((r) => `${itemName(r.k)} ${r.given}/${r.n}${hallNote(has(r.k), r.given, r.n)}`).join('<br>') + '</div>' +
    (miss ? `<div class="say" style="opacity:.7">${miss}</div>` : '') + buildButton('data-hamast="1"', AIRMAST.name.toLowerCase(), rows.some((r) => r.given < r.n && has(r.k) > 0));
}
/** The mast's build button (inside the village's stock lock). Returns the message. */
export function villageMastClick(vid: number): string {
  const c = G.char, s = (c.towns[vid] ??= {});
  if (!known()) return tl('The plans for it are lost.');
  const r = handOverAmast(s, stockHas(vid), c.time);
  stockTake(vid, r.taken);
  if (r.started) { gainXp(AIRMAST.xp); return TL`The builders start on the mooring mast of ${findPoi(c.world, vid)?.name ?? ''}.`; }
  return r.taken.length ? TL`Handed over ${r.taken.map(([k, n]) => `${ITEMS[k].name} ×${n}`).join(', ')}.` : tl('The village hall has nothing more for it.');
}

/** The warehouse's stock: what it has and taking from it (a village's stock, a port's or a wild warehouse's hold). */
function store(id: string) {
  if (id.startsWith('v:')) { const vid = +id.slice(2); return { has: stockHas(vid), take: (t: [ItemKey, number][]) => stockTake(vid, t) }; }
  const o = G.char.outposts[id];
  return { has: (k: ItemKey) => o?.hold?.[k] ?? 0, take: (t: [ItemKey, number][]) => { for (const [k, n] of t) if (o) portTake(o, k, n); } };
}
const buildOf = (id: string) => (id.startsWith('v:') ? G.char.towns[id.slice(2)]?.abuild : G.char.outposts[id]?.abuild);

/** The airship yard of warehouse `id` (nothing until its mast stands): the ships moored here, the one going up. */
export function airYardHTML(id: string, attr: (v: string) => string): string {
  const c = G.char, me = hubOf(id);
  if (!me || !hasAmast(me, c.towns, c.outposts)) return '';
  const why = amastWhy(c.world, me, c.towns, c.outposts, c.time), here = (c.airships ?? []).filter((a) => a.moor === id);
  let s = TL`<div class="say"><b>${AIRMAST.name} ✓</b> · <b>Airships</b>: built here from the warehouse's stock and flown by you (E at the gondola). A ship on cells charges while it is moored here.`;
  if (why) s += ` <span style="color:#ff6a4a">${WHY[why]}</span>`;
  for (const a of here) { const [n, f, u] = airEnergy(a); s += TL`<br>Moored here: an airship on ${DRIVE[a.drive]}, ${Math.round(n)}/${f} ${u} (~${airRangeKm(a).toFixed(0)} km), built by ${a.by}.`; }
  const b = buildOf(id);
  if (b) {
    const has = store(id).has, rows = airRows(b);
    s += TL`<br><b>Going up on the slip</b>: an airship on ${DRIVE[b.drive]}.<br>` + rows.map((r) => `${itemName(r.k)} ${r.given}/${r.n}${hallNote(has(r.k), r.given, r.n)}`).join('<br>') + '</div>';
    return s + btn(attr, 'give', tl('Hand over from the warehouse\'s stock')) + (Object.values(b.given).some((n) => n) ? '' : btn(attr, 'drop', tl('Take the keel down')));
  }
  s += '</div>';
  if (!known()) return s + tl('<div class="say" style="opacity:.7">The plans for an airship are lost (Aviation, on an old data carrier).</div>');
  if ((c.airships ?? []).length >= AIRSHIP.max) return s + TL`<div class="say" style="opacity:.7">This world has ${AIRSHIP.max} airships already: as many as there is lifting gas for.</div>`;
  return s + TL`<div class="say" style="opacity:.8">An airship: an envelope filled with lifting gas at the build, a gondola with ${AIRSHIP.seats} seats and a hold of ${AIRSHIP.hold} slots. Diesel goes ${AIRSHIP.speed.fuel} m/s and is filled from canisters; cells go ${AIRSHIP.speed.cell} m/s and charge at a mast.</div>` +
    btn(attr, 'keel:fuel', tl('Lay the keel of a diesel airship')) + btn(attr, 'keel:cell', tl('Lay the keel of an electric airship'));
}
/** A click in the yard (under the warehouse's lock). Returns the message. */
export function airYardClick(id: string, what: string): string {
  const c = G.char, me = hubOf(id), st = id.startsWith('v:') ? (c.towns[id.slice(2)] ??= {}) : c.outposts[id];
  if (!me || !st || !hasAmast(me, c.towns, c.outposts)) return '';
  if (what.startsWith('keel:') && !st.abuild) {
    if (!known()) return tl('The plans for an airship are lost.');
    if ((c.airships ?? []).length >= AIRSHIP.max) return tl('No more airships can be built on this world.');
    const d = what.slice(5) as AirDrive;
    if (d !== 'fuel' && d !== 'cell') return '';
    st.abuild = { drive: d, given: {} }; return tl('The keel is laid on the slip beside the mast.');
  }
  const b = st.abuild;
  if (!b) return '';
  if (what === 'drop' && !Object.values(b.given).some((n) => n)) { delete st.abuild; return tl('You take the keel down.'); }
  if (what !== 'give') return '';
  const sto = store(id), r = handOverAir(b, sto.has);
  sto.take(r.taken);
  if (!r.built) return r.taken.length ? TL`Handed over ${r.taken.map(([k, n]) => `${ITEMS[k].name} ×${n}`).join(', ')}.` : tl('The warehouse has nothing more for it.');
  const T = OW.terrain, m = mastAt(c.world, me), g = T ? Math.max(T.heightAt(m.x, m.z), SEA.level) : SEA.level;
  (c.airships ??= []).push(newAirship(b, id, moorPose(m, g), c.name || tl('You'), c.pid, c.time));
  delete st.abuild; gainXp(AIRSHIP.xp); redrawAirships();
  return tl('The envelope fills with gas and rises: the airship rides at the mast. Climb into its gondola to fly it.');
}
