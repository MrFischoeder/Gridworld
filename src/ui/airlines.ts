// (0.254, PLAN_LOTNICTWA.md stage F1) A warehouse's drone pad and air line in its window (a village's warehouse
// terminal, ui/hall.ts; a port's or a wild warehouse's board, ui/port.ts, where the pad is built as a part of the
// outpost): build the pad (a village, from its stock), open a line to a warehouse with a pad on the radio network,
// set a Cargo Drone from your kit on it, pick what it carries, take it back. The windows run the clicks under the home
// warehouse's lock; `attr` makes their own button attribute.
import { G } from '../game';
import { ITEMS, type ItemKey } from '../data/items';
import { gainXp, hasItem, takeOne, addItem } from '../character';
import { findPoi, worldDist } from '../gen/regions';
import { hubs, type Hub } from '../gen/warehouses';
import { linkedHubs } from '../gen/radio';
import { jobOf } from '../gen/construction';
import { PAD, DRONE } from '../gen/dronepad';
import { padPlan, handOverPad, padWhy, hasPad, newAirLine, airLineOf, alLeg, alPeriod, alLose, alAt, alWaiting, alKey, dropAirWay, type AirLine } from '../gen/airlines';
import { stockHas, stockTake, hallNote, lacking, buildButton } from './stock';
import { jobHTML } from './jobs';
import { itemName } from './icons';
import { tl, TL } from '../i18n';

const hrs = (m: number) => (m >= 60 ? TL`${Math.floor(m / 60)} h ${Math.round(m % 60)} min` : `${Math.round(m)} min`);
const hubOf = (id: string): Hub | undefined => hubs(G.char.world, G.char.towns, G.char.outposts).find((h) => h.id === id);
const btn = (attr: (v: string) => string, v: string, t: string) => `<button class="opt" ${attr(v)}>${t}</button>`;
const holdOf = (id: string) => (id.startsWith('v:') ? G.char.towns[id.slice(2)]?.hold : G.char.outposts[id]?.hold) ?? {};
function setLine(id: string, l: AirLine | undefined) {
  const c = G.char, st = id.startsWith('v:') ? (c.towns[id.slice(2)] ??= {}) : c.outposts[id];
  if (!st) return;
  if (l) st.aline = l; else { delete st.aline; dropAirWay(st); }
}
const WHY: Record<string, string> = {
  idle: tl('The pad stands idle: the warehouse has no storekeepers or no power.'),
  hands: tl('The pad stands idle: nobody is free to tend it.'), power: tl('The pad stands idle: too little power to charge the drones.'),
};
const FATE: Record<string, string> = {
  ok: tl('delivered'), silent: tl('stayed down: no radio link to the other warehouse'), storm: tl('stayed down: a storm'),
  nopad: tl('stayed down: the other pad does not work'), flat: tl('stayed down: no power here to charge it'),
  empty: tl('stayed down: nothing to carry'), lost: tl('<span style="color:#ff6a4a">came down in the wilds</span>'),
};

/** A village warehouse's pad row: build it from the stock, the builders at it, or that it stands. */
export function villagePadHTML(vid: number): string {
  const c = G.char, s = c.towns[vid];
  if (s?.dpad) return '';
  const job = jobHTML(s, 'dronepad', undefined, PAD.name.toLowerCase());
  if (job || jobOf(s, 'dronepad')) return job;
  const has = stockHas(vid), rows = padPlan(s), miss = lacking(rows, has);
  return TL`<div class="say"><b>${PAD.name}</b> <span style="opacity:.8">(${PAD.hours} h to build, ${PAD.kw} kW, one hand to tend it)</span>: ${PAD.text} Cargo drones fly from it to other warehouses with a pad on the radio, up to ${DRONE.reach / 1000} km.<br>` +
    rows.map((r) => `${itemName(r.k)} ${r.given}/${r.n}${hallNote(has(r.k), r.given, r.n)}`).join('<br>') + '</div>' +
    (miss ? `<div class="say" style="opacity:.7">${miss}</div>` : '') + buildButton('data-hpad="1"', PAD.name.toLowerCase(), rows.some((r) => r.given < r.n && has(r.k) > 0));
}
/** The pad's build button (inside the village's stock lock). Returns the message. */
export function villagePadClick(vid: number): string {
  const c = G.char, s = (c.towns[vid] ??= {});
  const r = handOverPad(s, stockHas(vid), c.time);
  stockTake(vid, r.taken);
  if (r.started) { gainXp(PAD.xp); return TL`The builders start on the drone pad of ${findPoi(c.world, vid)?.name ?? ''}.`; }
  return r.taken.length ? TL`Handed over ${r.taken.map(([k, n]) => `${ITEMS[k].name} ×${n}`).join(', ')}.` : tl('The village hall has nothing more for it.');
}

/** The air line row of warehouse `id` (nothing until its pad stands). */
export function airLineHTML(id: string, attr: (v: string) => string): string {
  const c = G.char, me = hubOf(id);
  if (!me || !hasPad(me, c.towns, c.outposts)) return '';
  const l = airLineOf(id, c.towns, c.outposts), why = padWhy(c.world, me, c.towns, c.outposts, c.time);
  let s = TL`<div class="say"><b>${PAD.name} ✓</b> · <b>Air line</b>: a cargo drone that flies ${DRONE.cap} crates a time straight to another warehouse with a pad on the radio network, over sea and mountains.`;
  if (why) s += ` <span style="color:#ff6a4a">${WHY[why]}</span>`;
  if (!l) {
    const to = linkedHubs(c.world, c.towns, c.outposts, id, c.time).filter((h) => hasPad(h, c.towns, c.outposts) && worldDist(h.x, h.z, me.x, me.z) <= DRONE.reach).sort((a, b) => worldDist(a.x, a.z, me.x, me.z) - worldDist(b.x, b.z, me.x, me.z));
    return s + '</div>' + (to.length ? to.slice(0, 6).map((h) => btn(attr, 'new:' + h.id, TL`Open an air line to ${h.name} (${(worldDist(h.x, h.z, me.x, me.z) / 1000).toFixed(1)} km)`)).join('') : TL`<div class="say" style="opacity:.7">No warehouse with a pad on the radio within ${DRONE.reach / 1000} km.</div>`);
  }
  const other = l.to.startsWith('v:') ? c.towns[l.to.slice(2)]?.rcv : c.outposts[l.to]?.rcv;
  s += TL`<br>To ${l.toName}: ${l.km} km in a straight line, ${hrs(alLeg(l))} each way, a round flight every ${hrs(alPeriod(l))}. ${(alLose(c.world, me, l) * 100).toFixed(1)}% of the flights may come down over the wilds.`;
  const sent = Object.entries(l.sent).filter(([, n]) => n).map(([g, n]) => `${n} × ${ITEMS[g as ItemKey].name}`).join(', ');
  if (sent) s += TL`<br>Delivered so far: ${sent}.`;
  const wait = alWaiting(l.to, c.towns, c.outposts, other).filter(([k]) => k === alKey(id, l)).reduce((a, [, , n]) => a + n, 0);
  if (wait) s += TL` ${wait} crates wait at ${l.toName} until its pad takes them in.`;
  if (l.lost) s += TL` Drones lost: ${l.lost}.`;
  if (!l.drone) {
    s += (l.last?.[1] === 'lost' ? TL`<br>Its drone came down in the wilds.` : '') + TL`<br>No drone on it. Bring a Cargo Drone and set it on the pad.</div>`;
    return s + (hasItem('cargodrone') ? btn(attr, 'drone', tl('Set your Cargo Drone on the pad')) : '') + btn(attr, 'drop', tl('Give up the line'));
  }
  const cv = alAt(l, c.time);
  const where = cv.at === 'parked' || cv.at === 'home' ? tl('on the pad here') : cv.at === 'out' ? TL`flying to ${l.toName} (${Math.round(cv.p * 100)}%)` : cv.at === 'back' ? TL`flying back (${Math.round(cv.p * 100)}%)` : TL`on the pad at ${l.toName}`;
  s += TL`<br>Drone: set on it by ${l.drone.by}, now ${where}.`;
  if (l.last) s += TL`<br>Last flight: ${FATE[l.last[1]]}.`;
  const kinds = [...new Set([...(Object.keys(holdOf(id)) as ItemKey[]), ...(l.only ?? [])])].sort((a, b) => ITEMS[a].name.localeCompare(ITEMS[b].name));
  s += TL`<br>It carries: ${l.only?.length ? l.only.map((k) => ITEMS[k].name).join(', ') : tl('anything in the hold, most first')}.</div>`;
  if (kinds.length) s += `<div class="say">${tl('Pick what it carries:')} ` + kinds.map((k) => `<button class="buy${l.only?.includes(k) ? '' : ' off'}" style="display:inline-block;width:auto;margin:2px" ${attr('only:' + k)}>${itemName(k)}</button>`).join('') + (l.only?.length ? ' ' + `<button class="buy" style="display:inline-block;width:auto;margin:2px" ${attr('all')}>${tl('Anything')}</button>` : '') + '</div>';
  return s + btn(attr, 'recall', tl('Take the drone off the line'));
}
/** A click on warehouse `id`'s air line row (under its lock, after the lines were settled). Returns the message. */
export function airLineClick(id: string, what: string): string {
  const c = G.char, me = hubOf(id);
  if (!me || !hasPad(me, c.towns, c.outposts)) return '';
  const l = airLineOf(id, c.towns, c.outposts), i = what.indexOf(':'), a = i < 0 ? what : what.slice(0, i), x = i < 0 ? '' : what.slice(i + 1);
  if (a === 'new' && !l) {
    const to = linkedHubs(c.world, c.towns, c.outposts, id, c.time).find((h) => h.id === x);
    if (!to || !hasPad(to, c.towns, c.outposts) || worldDist(to.x, to.z, me.x, me.z) > DRONE.reach) return tl('That warehouse has no pad on the radio within reach.');
    setLine(id, newAirLine(me, to, c.time)); return TL`An air line to ${to.name} is open. Set a Cargo Drone on the pad to fly it.`;
  }
  if (!l) return '';
  if (a === 'drop' && !l.drone) { setLine(id, undefined); return tl('You give up the line.'); }
  if (a === 'drone' && !l.drone) {
    if (!takeOne('cargodrone')) return tl('You have no Cargo Drone with you.');
    l.drone = { by: c.name || tl('You') }; l.t0 = c.time; l.k = 0; delete l.last;
    return TL`The drone takes the air line to ${l.toName}. It lifts off in a few minutes.`;
  }
  if (a === 'recall' && l.drone) {
    if (alAt(l, c.time).at !== 'parked' && alAt(l, c.time).at !== 'home') return tl('The drone is away. Wait until it is back on the pad.');
    if (!addItem('cargodrone', 1, true)) return tl('No room for it with you.');
    delete l.drone; delete l.t0; l.k = 0;
    return tl('You take the drone off the pad.');
  }
  if (a === 'only') { const k = x as ItemKey, on = l.only ?? []; l.only = on.includes(k) ? on.filter((q) => q !== k) : [...on, k]; if (!l.only.length) delete l.only; return ''; }
  if (a === 'all') { delete l.only; return ''; }
  return '';
}
