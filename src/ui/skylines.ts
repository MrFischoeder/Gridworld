// (0.258, PLAN_LOTNICTWA.md stage F4) A warehouse's airship line in its window (a village's warehouse terminal,
// ui/hall.ts; a port's or a wild warehouse's board, ui/port.ts): open a line to another warehouse with a mooring mast,
// hand an airship moored here over to it, keep its tank full, pick what it carries, recall it (it moors here again).
// The windows run the clicks under the home warehouse's lock; `attr` makes their own button attribute.
import { G } from '../game';
import { ITEMS, type ItemKey } from '../data/items';
import { worldDist } from '../gen/regions';
import { SEA } from '../gen/seas';
import { hubs, type Hub } from '../gen/warehouses';
import { AIRSHIP } from '../gen/airmast';
import { hasAmast, mastAt, moorPose } from '../gen/airships';
import { SKY, newSkyLine, skyLineOf, skLeg, skPeriod, skCap, skEnergy, skAt, skFuel, skAssign, skRecall, skWaiting, skKey, type SkyLine, type SkyTrip } from '../gen/skylines';
import { dropWay } from '../gen/transit';
import { runHub } from '../world/hublines';
import { airOccupied, redrawAirships } from '../world/airships';
import { OW } from '../world/overworld';
import { carried, takeFrom } from './market';
import { itemName } from './icons';
import { tl, TL } from '../i18n';

const hrs = (m: number) => (m >= 60 ? TL`${Math.floor(m / 60)} h ${Math.round(m % 60)} min` : `${Math.round(m)} min`);
const hubOf = (id: string): Hub | undefined => hubs(G.char.world, G.char.towns, G.char.outposts).find((h) => h.id === id);
const btn = (attr: (v: string) => string, v: string, t: string) => `<button class="opt" ${attr(v)}>${t}</button>`;
const holdOf = (id: string) => (id.startsWith('v:') ? G.char.towns[id.slice(2)]?.hold : G.char.outposts[id]?.hold) ?? {};
/** The airships moored at warehouse `id`'s mast. */
const mooredAt = (id: string) => (G.char.airships ?? []).filter((a) => a.moor === id);
function setLine(id: string, l: SkyLine | undefined) {
  const c = G.char;
  if (id.startsWith('v:')) { const s = (c.towns[id.slice(2)] ??= {}); if (l) s.zline = l; else { delete s.zline; dropWay(s, 'sk'); } }
  else { const o = c.outposts[id]; if (o) { if (l) o.zline = l; else { delete o.zline; dropWay(o, 'sk'); } } }
}
const FATE: Record<SkyTrip, string> = {
  ok: tl('delivered'), dry: tl('stayed at the mast for want of fuel or charge'), storm: tl('stayed at the mast: a storm'),
  empty: tl('stayed at the mast: nothing to carry'), nomast: tl('stayed at the mast: no mast at the other end'),
};
const DRIVE = { fuel: tl('diesel'), cell: tl('electric') };
/** The warehouses with a mast within reach of `me`, nearest first. */
function targets(me: Hub): Hub[] {
  const c = G.char;
  return hubs(c.world, c.towns, c.outposts).filter((h) => h.id !== me.id && hasAmast(h, c.towns, c.outposts) && worldDist(h.x, h.z, me.x, me.z) <= SKY.reach).sort((a, b) => worldDist(a.x, a.z, me.x, me.z) - worldDist(b.x, b.z, me.x, me.z));
}
/** The sky line row of warehouse `id` (nothing until its mast stands). */
export function skyLineHTML(id: string, attr: (v: string) => string): string {
  const c = G.char, me = hubOf(id);
  if (!me || !hasAmast(me, c.towns, c.outposts)) return '';
  const l = skyLineOf(id, c.towns, c.outposts);
  let s = TL`<div class="say"><b>Airship line</b>: an airship that carries this warehouse's goods to another warehouse with a mooring mast, on a timetable, straight over land and sea, in up to ${skCap()} crates a trip. A storm over this warehouse keeps it at the mast.`;
  if (!l) {
    const to = targets(me);
    return s + '</div>' + (to.length ? to.slice(0, 6).map((h) => btn(attr, 'new:' + h.id, TL`Open a line to ${h.name} (${(worldDist(h.x, h.z, me.x, me.z) / 1000).toFixed(1)} km)`)).join('') : TL`<div class="say" style="opacity:.7">No warehouse with a mooring mast within ${SKY.reach / 1000} km.</div>`);
  }
  const a = l.ship, other = l.to.startsWith('v:') ? c.towns[l.to.slice(2)]?.rcv : c.outposts[l.to]?.rcv;
  s += TL`<br>To ${l.toName}: ${l.km} km in a straight line, ${hrs(skLeg(l))} each way, a round trip every ${hrs(skPeriod(l))}.`;
  const sent = Object.entries(l.sent).filter(([, n]) => n).map(([g, n]) => `${n} × ${ITEMS[g as ItemKey].name}`).join(', ');
  if (sent) s += TL`<br>Delivered so far: ${sent}.`;
  const wait = skWaiting(l.to, c.towns, c.outposts, other).filter(([k]) => k === skKey(id, l)).reduce((n, [, , m]) => n + m, 0);
  if (wait) s += TL` ${wait} crates wait at ${l.toName} until its storekeepers take them in.`;
  if (!a) {
    s += TL`<br>No airship on it. Moor one at this mast and hand it over (nobody aboard).</div>`;
    const free = mooredAt(id);
    s += free.length ? free.map((q) => (airOccupied(q.id) ? `<div class="say" style="opacity:.7">${TL`The ${DRIVE[q.drive]} airship built by ${q.by}: someone is aboard.`}</div>` : btn(attr, 'ship:' + q.id, TL`Hand over the ${DRIVE[q.drive]} airship (built by ${q.by})`))).join('') : TL`<div class="say" style="opacity:.7">No airship is moored at this mast.</div>`;
    return s + btn(attr, 'drop', tl('Give up the line'));
  }
  const [now, need, unit] = skEnergy(l), cv = skAt(l, c.time);
  const where = cv.at === 'parked' ? tl('standing at the mast') : cv.at === 'out' ? TL`on its way to ${l.toName} (${Math.round(cv.p * 100)}%)` : cv.at === 'back' ? TL`on its way back (${Math.round(cv.p * 100)}%)` : cv.at === 'there' ? TL`unloading at ${l.toName}` : tl('loading here');
  s += TL`<br>Airship: ${DRIVE[a.drive]}, built by ${a.by}, ${skCap()} crates a trip, ${where}.`;
  s += unit === 'kWh' ? TL`<br>Cells: ${Math.round(now)} of ${AIRSHIP.cell.cap} kWh, ${need} kWh a round trip; they charge full here while the mast works.`
    : TL`<br>Tank: ${Math.round(now)} of ${AIRSHIP.fuel.tank} L, ${need} L a round trip. With you: ${carried('fuel', me)} canisters.`;
  if (l.last) s += TL`<br>Last trip: ${FATE[l.last[1]]}.`;
  const kinds = [...new Set([...(Object.keys(holdOf(id)) as ItemKey[]), ...(l.only ?? [])])].sort((x, y) => ITEMS[x].name.localeCompare(ITEMS[y].name));
  s += TL`<br>It carries: ${l.only?.length ? l.only.map((k) => ITEMS[k].name).join(', ') : tl('anything in the hold, most first')}.</div>`;
  if (kinds.length) s += `<div class="say">${tl('Pick what it carries:')} ` + kinds.map((k) => `<button class="buy${l.only?.includes(k) ? '' : ' off'}" style="display:inline-block;width:auto;margin:2px" ${attr('only:' + k)}>${itemName(k)}</button>`).join('') + (l.only?.length ? ' ' + `<button class="buy" style="display:inline-block;width:auto;margin:2px" ${attr('all')}>${tl('Anything')}</button>` : '') + '</div>';
  return s + (unit === 'kWh' ? '' : btn(attr, 'fuel', tl('Pour fuel canisters into the airship'))) + btn(attr, 'recall', tl('Recall the airship (it moors here)'));
}
/** A click on warehouse `id`'s sky line row (under its lock). Returns the message. */
export function skyLineClick(id: string, what: string): string {
  const c = G.char, me = hubOf(id);
  if (!me || !hasAmast(me, c.towns, c.outposts)) return '';
  runHub(id);
  const l = skyLineOf(id, c.towns, c.outposts), i = what.indexOf(':'), a = i < 0 ? what : what.slice(0, i), x = i < 0 ? '' : what.slice(i + 1);
  if (a === 'new' && !l) {
    const to = targets(me).find((h) => h.id === x);
    if (!to) return tl('That warehouse has no mooring mast within reach.');
    setLine(id, newSkyLine(me, to, c.time)); return TL`An airship line to ${to.name} is open. Moor an airship here and hand it over to run it.`;
  }
  if (!l) return '';
  if (a === 'drop' && !l.ship) { setLine(id, undefined); return tl('You give up the line.'); }
  if (a === 'ship' && !l.ship) {
    const q = mooredAt(id).find((z) => z.id === x);
    if (!q) return tl('Moor it at this mast first.');
    if (airOccupied(q.id)) return tl('Someone is aboard.');
    skAssign(l, q, c.time, c.name || tl('You'));
    c.airships.splice(c.airships.indexOf(q), 1); redrawAirships();
    return TL`The airship takes the line to ${l.toName}. The first flight leaves in three quarters of an hour.`;
  }
  if (a === 'recall' && l.ship) {
    if (mooredAt(id).length) return tl('Another airship is moored at the mast: free it first.');
    const m = mastAt(c.world, me, c.towns), T = OW.terrain, g = T ? Math.max(T.heightAt(m.x, m.z), SEA.level) : SEA.level;
    (c.airships ??= []).push(skRecall(l, id, moorPose(m, g))); redrawAirships();
    return tl('The airship is back and moored at the mast.');
  }
  if (a === 'fuel' && l.ship) {
    const n = skFuel(l, carried('fuel', me));
    if (n) takeFrom('fuel', n, me);
    return n ? TL`Poured ${n} canisters into the airship.` : tl('No canisters with you, or the tank is full.');
  }
  if (a === 'only') { const k = x as ItemKey, on = l.only ?? []; l.only = on.includes(k) ? on.filter((q) => q !== k) : [...on, k]; if (!l.only.length) delete l.only; return ''; }
  if (a === 'all') { delete l.only; return ''; }
  return '';
}
