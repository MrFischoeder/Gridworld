// (0.254, PLAN_LOTNICTWA.md stage F1) A warehouse's drone pad and air line in its window (a village's warehouse
// terminal, ui/hall.ts; a port's or a wild warehouse's board, ui/port.ts, where the pad is built as a part of the
// outpost): build the pad (a village, from its stock), open a line to a warehouse with a pad on the radio network,
// set a Cargo Drone from your kit on it, pick what it carries, take it back. The windows run the clicks under the home
// warehouse's lock; `attr` makes their own button attribute. (0.255, stage F2) A village's pad is staked out with a
// Survey Stake once its materials are in (world/fields.ts), and a pad serves up to `DRONE.lines` air lines, each to
// a different warehouse with its own drone: the actions name the line (`<action>:<line id>[:<good>]`).
import { G } from '../game';
import { ITEMS, type ItemKey } from '../data/items';
import { gainXp, hasItem, takeOne, addItem } from '../character';
import { findPoi, worldDist } from '../gen/regions';
import { hubs, type Hub } from '../gen/warehouses';
import { linkedHubs } from '../gen/radio';
import { jobOf } from '../gen/construction';
import { PAD, DRONE } from '../gen/dronepad';
import { padPlan, handOverPad, padWhy, hasPad, newAirLine, airLinesFor, ownAirLines, alLeg, alPeriod, alLose, alAt, alWaiting, alKey, dropAirWay, type AirLine } from '../gen/airlines';
import { stockHas, stockTake, hallNote, lacking, buildButton } from './stock';
import { jobHTML } from './jobs';
import { itemName } from './icons';
import { tl, TL } from '../i18n';

const hrs = (m: number) => (m >= 60 ? TL`${Math.floor(m / 60)} h ${Math.round(m % 60)} min` : `${Math.round(m)} min`);
const hubOf = (id: string): Hub | undefined => hubs(G.char.world, G.char.towns, G.char.outposts).find((h) => h.id === id);
const btn = (attr: (v: string) => string, v: string, t: string) => `<button class="opt" ${attr(v)}>${t}</button>`;
const holdOf = (id: string) => (id.startsWith('v:') ? G.char.towns[id.slice(2)]?.hold : G.char.outposts[id]?.hold) ?? {};
/** Warehouse `id`'s list of lines to change (under its lock; a 0.254 line moved in). */
function linesOf(id: string): AirLine[] | null {
  const c = G.char, st = id.startsWith('v:') ? (c.towns[id.slice(2)] ??= {}) : c.outposts[id];
  return st ? ownAirLines(st) : null;
}
function dropLine(id: string, l: AirLine) {
  const c = G.char, st = id.startsWith('v:') ? c.towns[id.slice(2)] : c.outposts[id], list = st && ownAirLines(st);
  if (!st || !list) return;
  const i = list.indexOf(l); if (i >= 0) list.splice(i, 1);
  if (!list.length) delete st.alines;
  dropAirWay(st, l);
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
  if (s?.dpWait) return TL`<div class="say"><b>${PAD.name}</b>: the materials are in. Now choose where it stands: take a Survey Stake out beside the warehouse (within ${DRONE.near} m of it, outside the wall), use it and click. Level open ground, off the roads and the ground kept for other work.</div>` +
    (hasItem('fieldstake') ? tl('<div class="say" style="opacity:.8">You have a Survey Stake.</div>') : TL`<button class="opt" data-hpad="stake">Give me a Survey Stake</button>`);
  const has = stockHas(vid), rows = padPlan(s), miss = lacking(rows, has);
  return TL`<div class="say"><b>${PAD.name}</b> <span style="opacity:.8">(${PAD.hours} h to build, ${PAD.kw} kW, one hand to tend it)</span>: ${PAD.text} Cargo drones fly from it to other warehouses with a pad on the radio, up to ${DRONE.reach / 1000} km.<br>` +
    rows.map((r) => `${itemName(r.k)} ${r.given}/${r.n}${hallNote(has(r.k), r.given, r.n)}`).join('<br>') + '</div>' +
    (miss ? `<div class="say" style="opacity:.7">${miss}</div>` : '') + buildButton('data-hpad="1"', PAD.name.toLowerCase(), rows.some((r) => r.given < r.n && has(r.k) > 0));
}
/** The pad's build button (inside the village's stock lock). Returns the message. */
export function villagePadClick(vid: number, what = ''): string {
  const c = G.char, s = (c.towns[vid] ??= {});
  if (what === 'stake') {
    if (!s.dpWait) return tl('The pad does not wait for its ground.');
    return hasItem('fieldstake') ? tl('You have one already.') : addItem('fieldstake') ? tl('The storekeeper hands you a Survey Stake. Walk out and mark where the drone pad should go.') : tl('No room for the stake in your backpack.');
  }
  const r = handOverPad(s, stockHas(vid), c.time);
  stockTake(vid, r.taken);
  if (r.wait) { gainXp(PAD.xp); return tl('All the materials are in. Now stake out where the pad goes: ask for a Survey Stake here.'); }
  if (r.started) { gainXp(PAD.xp); return TL`The builders start on the drone pad of ${findPoi(c.world, vid)?.name ?? ''}.`; }
  return r.taken.length ? TL`Handed over ${r.taken.map(([k, n]) => `${ITEMS[k].name} ×${n}`).join(', ')}.` : tl('The village hall has nothing more for it.');
}

/** One line's block (its actions carry its id). */
function lineHTML(id: string, me: Hub, l: AirLine, attr: (v: string) => string): string {
  const c = G.char, L = (a: string, x = '') => attr(a + ':' + l.id + (x ? ':' + x : ''));
  const other = l.to.startsWith('v:') ? c.towns[l.to.slice(2)]?.rcv : c.outposts[l.to]?.rcv;
  let s = TL`<div class="say"><b>To ${l.toName}</b>: ${l.km} km in a straight line, ${hrs(alLeg(l))} each way, a round flight every ${hrs(alPeriod(l))}. ${(alLose(c.world, me, l) * 100).toFixed(1)}% of the flights may come down over the wilds.`;
  const sent = Object.entries(l.sent).filter(([, n]) => n).map(([g, n]) => `${n} × ${ITEMS[g as ItemKey].name}`).join(', ');
  if (sent) s += TL`<br>Delivered so far: ${sent}.`;
  const wait = alWaiting(l.to, c.towns, c.outposts, other).filter(([k]) => k === alKey(id, l)).reduce((a, [, , n]) => a + n, 0);
  if (wait) s += TL` ${wait} crates wait at ${l.toName} until its pad takes them in.`;
  if (l.lost) s += TL` Drones lost: ${l.lost}.`;
  if (!l.drone) {
    s += (l.last?.[1] === 'lost' ? TL`<br>Its drone came down in the wilds.` : '') + TL`<br>No drone on it. Bring a Cargo Drone and set it on the pad.</div>`;
    return s + (hasItem('cargodrone') ? `<button class="opt" ${L('drone')}>${tl('Set your Cargo Drone on the pad')}</button>` : '') + `<button class="opt" ${L('drop')}>${tl('Give up the line')}</button>`;
  }
  const cv = alAt(l, c.time);
  const where = cv.at === 'parked' || cv.at === 'home' ? tl('on the pad here') : cv.at === 'out' ? TL`flying to ${l.toName} (${Math.round(cv.p * 100)}%)` : cv.at === 'back' ? TL`flying back (${Math.round(cv.p * 100)}%)` : TL`on the pad at ${l.toName}`;
  s += TL`<br>Drone: set on it by ${l.drone.by}, now ${where}.`;
  if (l.last) s += TL`<br>Last flight: ${FATE[l.last[1]]}.`;
  const kinds = [...new Set([...(Object.keys(holdOf(id)) as ItemKey[]), ...(l.only ?? [])])].sort((a, b) => ITEMS[a].name.localeCompare(ITEMS[b].name));
  s += TL`<br>It carries: ${l.only?.length ? l.only.map((k) => ITEMS[k].name).join(', ') : tl('anything in the hold, most first')}.</div>`;
  if (kinds.length) s += `<div class="say">${tl('Pick what it carries:')} ` + kinds.map((k) => `<button class="buy${l.only?.includes(k) ? '' : ' off'}" style="display:inline-block;width:auto;margin:2px" ${L('only', k)}>${itemName(k)}</button>`).join('') + (l.only?.length ? ' ' + `<button class="buy" style="display:inline-block;width:auto;margin:2px" ${L('all')}>${tl('Anything')}</button>` : '') + '</div>';
  return s + `<button class="opt" ${L('recall')}>${tl('Take the drone off the line')}</button>`;
}
/** The air lines of warehouse `id` (nothing until its pad stands): every line, then the warehouses a new one could go to. */
export function airLineHTML(id: string, attr: (v: string) => string): string {
  const c = G.char, me = hubOf(id);
  if (!me || !hasPad(me, c.towns, c.outposts)) return '';
  const lines = airLinesFor(id, c.towns, c.outposts), why = padWhy(c.world, me, c.towns, c.outposts, c.time);
  let s = TL`<div class="say"><b>${PAD.name} ✓</b> · <b>Air lines</b> ${lines.length}/${DRONE.lines}: each a cargo drone that flies ${DRONE.cap} crates a time straight to another warehouse with a pad on the radio network, over sea and mountains.`;
  if (why) s += ` <span style="color:#ff6a4a">${WHY[why]}</span>`;
  s += '</div>' + lines.map((l) => lineHTML(id, me, l, attr)).join('');
  if (lines.length >= DRONE.lines) return s;
  const to = linkedHubs(c.world, c.towns, c.outposts, id, c.time).filter((h) => !lines.some((l) => l.to === h.id) && hasPad(h, c.towns, c.outposts) && worldDist(h.x, h.z, me.x, me.z) <= DRONE.reach).sort((a, b) => worldDist(a.x, a.z, me.x, me.z) - worldDist(b.x, b.z, me.x, me.z));
  return s + (to.length ? to.slice(0, 6).map((h) => btn(attr, 'new:' + h.id, TL`Open an air line to ${h.name} (${(worldDist(h.x, h.z, me.x, me.z) / 1000).toFixed(1)} km)`)).join('') : TL`<div class="say" style="opacity:.7">No other warehouse with a pad on the radio within ${DRONE.reach / 1000} km.</div>`);
}
/** A click on warehouse `id`'s air lines (under its lock, after the lines were settled). Returns the message. */
export function airLineClick(id: string, what: string): string {
  const c = G.char, me = hubOf(id);
  if (!me || !hasPad(me, c.towns, c.outposts)) return '';
  const [a, x = '', k = ''] = what.split(':'), list = linesOf(id);
  if (!list) return '';
  if (a === 'new') {
    const hid = what.slice(4), to = linkedHubs(c.world, c.towns, c.outposts, id, c.time).find((h) => h.id === hid);
    if (list.length >= DRONE.lines) return TL`The pad serves ${DRONE.lines} lines already.`;
    if (list.some((l) => l.to === hid)) return tl('A line to that warehouse is open already.');
    if (!to || !hasPad(to, c.towns, c.outposts) || worldDist(to.x, to.z, me.x, me.z) > DRONE.reach) return tl('That warehouse has no pad on the radio within reach.');
    const l = newAirLine(me, to, c.time);
    while (list.some((q) => q.id === l.id)) l.id++;
    list.push(l); return TL`An air line to ${to.name} is open. Set a Cargo Drone on the pad to fly it.`;
  }
  const l = list.find((q) => String(q.id) === x);
  if (!l) return '';
  if (a === 'drop' && !l.drone) { dropLine(id, l); return tl('You give up the line.'); }
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
  if (a === 'only') { const g = k as ItemKey, on = l.only ?? []; l.only = on.includes(g) ? on.filter((q) => q !== g) : [...on, g]; if (!l.only.length) delete l.only; return ''; }
  if (a === 'all') { delete l.only; return ''; }
  return '';
}
