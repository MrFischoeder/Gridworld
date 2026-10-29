// (0.252, PLAN_MAGAZYNOW.md stage M4) A warehouse's convoy line in its window (a village's warehouse terminal,
// ui/hall.ts; a port's or a wild warehouse's board, ui/port.ts): open a line to a warehouse on the radio network,
// hand a parked truck over to it, keep its tank full, pick what it carries, recall it. The windows run the clicks
// under the home warehouse's lock; `attr` makes their own button attribute.
import { G } from '../game';
import { ITEMS, type ItemKey } from '../data/items';
import { VEHICLES, vehicleTitle, type VehicleModel } from '../data/vehicles';
import { vehicles, takeVehicle, parkVehicle, trunkOf } from '../world/vehicles';
import { runHub } from '../world/hublines';
import { worldDist } from '../gen/regions';
import { hubs, type Hub } from '../gen/warehouses';
import { mastWhy, linkedHubs } from '../gen/radio';
import { ROUTE, truckProblem } from '../gen/routes';
import { HLINE, newHubLine, hubLineOf, hlLeg, hlPeriod, hlRob, hlEnergy, hlAt, hlWrecked, hlFuel, hlWaiting, hlKey, type HubLine } from '../gen/hublines';
import { carried, takeFrom } from './market';
import { dropWay } from '../gen/transit';
import { itemName } from './icons';
import { tl, TL } from '../i18n';
import { roadBetween, wayWords } from '../world/roadnet';

const hrs = (m: number) => (m >= 60 ? TL`${Math.floor(m / 60)} h ${Math.round(m % 60)} min` : `${Math.round(m)} min`);
const hubOf = (id: string): Hub | undefined => hubs(G.char.world, G.char.towns, G.char.outposts).find((h) => h.id === id);
const btn = (attr: (v: string) => string, v: string, t: string) => `<button class="opt" ${attr(v)}>${t}</button>`;
const trucksBy = (h: Hub) => vehicles.filter((v) => v.claimed && !v.ai && !v.held && worldDist(v.st.x, v.st.z, h.x, h.z) < 80);
const trunkFull = (v: (typeof vehicles)[number]) => { const t = trunkOf(v.st); return t.items.some(Boolean) || !!t.bays?.some(Boolean) || t.gold > 0; };
function setLine(id: string, l: HubLine | undefined) {
  const c = G.char;
  if (id.startsWith('v:')) { const s = (c.towns[id.slice(2)] ??= {}); if (l) s.hline = l; else { delete s.hline; dropWay(s, 'hl'); } }
  else { const o = c.outposts[id]; if (o) { if (l) o.hline = l; else { delete o.hline; dropWay(o, 'hl'); } } }
}
const holdOf = (id: string) => (id.startsWith('v:') ? G.char.towns[id.slice(2)]?.hold : G.char.outposts[id]?.hold) ?? {};
const FATE: Record<string, string> = {
  ok: tl('delivered'), dry: tl('missed for want of fuel'), silent: tl('stayed home: no radio link to the other warehouse'),
  empty: tl('stayed home: nothing to carry'), robbed: tl('<span style="color:#ff6a4a">robbed on the way</span>'), wrecked: tl('<span style="color:#ff6a4a">wrecked</span>'),
};
/** The convoy line row of warehouse `id`. */
export function hubLineHTML(id: string, attr: (v: string) => string): string {
  const c = G.char, me = hubOf(id);
  if (!me) return '';
  const l = hubLineOf(id, c.towns, c.outposts), why = mastWhy(c.world, me, c.towns, c.outposts, c.time);
  let s = TL`<div class="say"><b>Convoy line</b>: a truck that drives this warehouse's goods to another warehouse on its radio network, on a timetable.`;
  if (!l) {
    if (why) return s + TL` It needs the radio link: a working radio mast here and at the other warehouse.</div>`;
    const to = linkedHubs(c.world, c.towns, c.outposts, id, c.time).filter((h) => worldDist(h.x, h.z, me.x, me.z) <= HLINE.reach).sort((a, b) => worldDist(a.x, a.z, me.x, me.z) - worldDist(b.x, b.z, me.x, me.z));
    s += TL` The convoys drive the roads: only a warehouse joined to this one by road (the old roads between the villages, or a track the players built) can be served.</div>`;
    return s + (to.length ? to.slice(0, 6).map((h) => { const w = roadBetween(id, h.id, me.x); return w ? btn(attr, 'new:' + h.id, TL`Open a line to ${h.name} (${wayWords(w)})`) : TL`<div class="say" style="opacity:.7">${h.name}: no road joins it to this warehouse. Build a track (the Surveyor's Poles).</div>`; }).join('') : TL`<div class="say" style="opacity:.7">No warehouse on the radio within ${HLINE.reach / 1000} km.</div>`);
  }
  const t = l.truck, other = l.to.startsWith('v:') ? c.towns[l.to.slice(2)]?.rcv : c.outposts[l.to]?.rcv;
  s += l.way ? TL`<br>To ${l.toName}: ${wayWords(l.way)}, ${hrs(hlLeg(l))} each way` : TL`<br>To ${l.toName}: ${l.km} km across country (opened before the convoys kept to the roads), ${hrs(hlLeg(l))} each way`;
  s += TL`, a round trip every ${hrs(hlPeriod(l))}. Bandits rob ${Math.round(hlRob(c.world, me, l) * 100)}% of the trips${t?.parts.gun ? tl(' (the roof cannon helps)') : ''}.`;
  if (why) s += TL` <span style="color:#ff6a4a">The radio here is silent: the convoy stays home.</span>`;
  const sent = Object.entries(l.sent).filter(([, n]) => n).map(([g, n]) => `${n} × ${ITEMS[g as ItemKey].name}`).join(', ');
  if (sent) s += TL`<br>Delivered so far: ${sent}.`;
  const wait = hlWaiting(l.to, c.towns, c.outposts, other).filter(([k]) => k === hlKey(id, l)).reduce((a, [, , n]) => a + n, 0);
  if (wait) s += TL` ${wait} crates wait at ${l.toName} until its storekeepers take them in.`;
  if (l.robbed) s += TL` Robbed ${l.robbed} times.`;
  if (!t) {
    s += TL`<br>No truck on it. Park a vehicle by the warehouse and hand it over (its trunk empty).</div>`;
    s += trucksBy(me).map((v) => { const w = truckProblem(v.st.parts, v.st.model) || (trunkFull(v) ? tl('Empty its trunk first.') : ''); return w ? `<div class="say" style="opacity:.7">${vehicleTitle(v.st.model)}: ${w}</div>` : btn(attr, 'truck:' + v.st.id, TL`Hand over the ${vehicleTitle(v.st.model)} (${ROUTE.cap[v.st.model]} crates a trip)`); }).join('');
    return s + btn(attr, 'drop', tl('Give up the line'));
  }
  const [fuel, need, unit] = hlEnergy(l), cv = hlAt(l, c.time), hull = Math.round((t.parts.hull ?? 0) / VEHICLES[t.model].hull * 100);
  const where = hlWrecked(l) ? tl('<span style="color:#ff6a4a">wrecked on the road: recall it and mend its hull</span>') : cv.at === 'parked' ? tl('standing at the warehouse') : cv.at === 'out' ? TL`on its way to ${l.toName} (${Math.round(cv.p * 100)}%)` : cv.at === 'back' ? TL`on its way back (${Math.round(cv.p * 100)}%)` : cv.at === 'there' ? TL`unloading at ${l.toName}` : tl('loading here');
  s += TL`<br>Truck: a ${vehicleTitle(t.model)} (handed over by ${t.by}), ${ROUTE.cap[t.model]} crates a trip, hull ${hull}%, ${where}.`;
  s += unit === 'kWh' ? TL`<br>Battery: ${Math.round(fuel)} kWh, ${need} kWh a round trip; it charges full here while the warehouse has power.`
    : TL`<br>Tank: ${Math.round(fuel)} of ${VEHICLES[t.model].tank} L, ${need} L a round trip. With you: ${carried('fuel', me)} canisters.`;
  if (l.last) s += TL`<br>Last trip: ${FATE[l.last[1]]}.`;
  const kinds = [...new Set([...(Object.keys(holdOf(id)) as ItemKey[]), ...(l.only ?? [])])].sort((a, b) => ITEMS[a].name.localeCompare(ITEMS[b].name));
  s += TL`<br>It carries: ${l.only?.length ? l.only.map((k) => ITEMS[k].name).join(', ') : tl('anything in the hold, most first')}.</div>`;
  if (kinds.length) s += `<div class="say">${tl('Pick what it carries:')} ` + kinds.map((k) => `<button class="buy${l.only?.includes(k) ? '' : ' off'}" style="display:inline-block;width:auto;margin:2px" ${attr('only:' + k)}>${itemName(k)}</button>`).join('') + (l.only?.length ? ' ' + `<button class="buy" style="display:inline-block;width:auto;margin:2px" ${attr('all')}>${tl('Anything')}</button>` : '') + '</div>';
  const better = roadBetween(id, l.to, me.x), quicker = better && (!l.way || better.t < l.way.t * 0.98);
  return s + (unit === 'kWh' ? '' : btn(attr, 'fuel', tl('Pour fuel canisters into the truck'))) + btn(attr, 'recall', tl('Recall the truck (it parks here)')) +
    (quicker ? btn(attr, 'reroute', TL`Send it by the quicker road now (${wayWords(better!)})`) : '');
}
/** A click on warehouse `id`'s line row (under its lock). Returns the message. */
export function hubLineClick(id: string, what: string): string {
  const c = G.char, me = hubOf(id);
  if (!me) return '';
  runHub(id);
  const l = hubLineOf(id, c.towns, c.outposts), i = what.indexOf(':'), a = i < 0 ? what : what.slice(0, i), x = i < 0 ? '' : what.slice(i + 1);
  if (a === 'new' && !l) {
    const to = linkedHubs(c.world, c.towns, c.outposts, id, c.time).find((h) => h.id === x);
    if (!to || worldDist(to.x, to.z, me.x, me.z) > HLINE.reach) return tl('That warehouse is not on the radio within reach.');
    const way = roadBetween(id, to.id, me.x);
    if (!way) return TL`No road joins ${to.name} to this warehouse: build a track first.`;
    setLine(id, newHubLine(me, to, c.time, way)); return TL`A convoy line to ${to.name} is open, ${wayWords(way)}. Hand a truck over to run it.`;
  }
  if (!l) return '';
  if (a === 'drop' && !l.truck) { setLine(id, undefined); return tl('You give up the line.'); }
  if (a === 'truck' && !l.truck) {
    const v = trucksBy(me).find((q) => q.st.id === x);
    if (!v) return tl('Park it by the warehouse first.');
    const w = truckProblem(v.st.parts, v.st.model) || (trunkFull(v) ? tl('Empty its trunk first.') : '');
    if (w) return w;
    l.truck = { id: v.st.id, model: v.st.model as VehicleModel, parts: structuredClone(v.st.parts), by: c.name || tl('You') }; l.t0 = c.time; l.k = 0; delete l.last;
    takeVehicle(v);
    return TL`The ${vehicleTitle(v.st.model)} takes the line to ${l.toName}. The first convoy leaves in half an hour.`;
  }
  if (a === 'recall' && l.truck) {
    const t = l.truck, ang = (l.id % 628) / 100;
    delete l.truck; delete l.t0; l.k = 0;
    parkVehicle(t.id, t.model, t.parts, me.x + Math.cos(ang) * 16, me.z + Math.sin(ang) * 16, ang);
    return TL`The ${vehicleTitle(t.model)} is back and parked by the warehouse${(t.parts.hull ?? 1) <= 0 ? tl(': a wreck, mend its hull') : ''}.`;
  }
  if (a === 'fuel' && l.truck) {
    const n = hlFuel(l, carried('fuel', me));
    if (n) takeFrom('fuel', n, me);
    return n ? TL`Poured ${n} canisters into the truck.` : tl('No canisters with you, or the tank is full.');
  }
  if (a === 'reroute') { // (0.283) the trips due are settled above; the timetable starts again on the new way
    const way = roadBetween(id, l.to, me.x);
    if (!way) return '';
    l.way = way; l.km = way.km;
    if (l.truck) { l.t0 = c.time; l.k = 0; delete l.last; }
    return TL`The convoy takes the new way: ${wayWords(way)}.`;
  }
  if (a === 'only') { const k = x as ItemKey, on = l.only ?? []; l.only = on.includes(k) ? on.filter((q) => q !== k) : [...on, k]; if (!l.only.length) delete l.only; return ''; }
  if (a === 'all') { delete l.only; return ''; }
  return '';
}
