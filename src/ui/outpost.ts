// (0.183, PLAN_PLACOWEK.md stage O2) The outpost window, opened with E at a deposit in the wilds (gen/lodes.ts): drive
// the stake in, hand over what the extraction and the storage shed need (from the backpack and the vehicles parked by
// it), see what it digs, and take the crates away (trunks first). Every change runs under the outpost's lock online.
import { G, W } from '../game';
import { ITEMS, type ItemKey } from '../data/items';
import { calcStats, saveChar, gainXp } from '../character';
import { LODES, type Lode } from '../gen/lodes';
import { newOutpost, outputs, stockNow, takeCrates, partPlan, partProblem, partName, handOver, hoursOf, xpOf, jobEnd, capOf, bare, mayUse, choosePower, DIG, digOf, STORE, PORT, BUNKS, FIELD, WALL, TURRET, wallOf, turretsOf, countOf, maxOf, isMany, type OutpostState, type OutpostPart } from '../gen/outposts';
import { LIFE, lifeNow, crews, foodMade, foodEaten, bedsOf, pantryOf, loadFood, crewFactor, isHamlet } from '../gen/outpostlife';
import { fertility, fertilityWord } from '../gen/fertility';
import { strengthAt, nextRaid, holdChance, worthRobbing } from '../gen/outpostraids';
import { PESTS } from '../gen/outpostlife';
import { fmtTime } from '../core/time';
import { hash } from '../core/rng';
import { tellRaids } from '../world/lodes';
import { ROUTE, newRoute, legOf, periodOf, truckEnergy, robChance, truckProblem, assignTruck, recallTruck, fuelTruck, wrecked, convoyAt, waiting } from '../gen/routes';
import { allVillages, worldDist as wdist } from '../gen/regions';
import { VEHICLES, vehicleTitle, type VehicleModel } from '../data/vehicles';
import { vehicles, takeVehicle, parkVehicle, trunkOf } from '../world/vehicles';
import { FOOD } from '../gen/farms';
import { POWER_SRC, POWER_KINDS, grids, gridState, powerShare, powerFactor, pwOf, fuelLeft, loadFuel, settleAll, demandOf, PLINE, newLine, plineProblem, lineFlows, outGunsAt, OUT_GUN_KW, OUT_GUN_POWER, type PowerKind } from '../gen/grid';
import { balance } from '../gen/energy';
import { villageSeed } from '../gen/regions';
import { lodeById } from '../gen/lodes';
import { nearX } from '../gen/regions';
import { itemName } from './icons';
import { carried, takeFrom, putAway } from './market';
import { withOutpost } from './stock';
import { $, showToast, logLine } from './hud';
import { lockPointer } from './input';
import { givesText } from '../world/lodes';
import { procOf } from '../gen/outpostproc';
import { addPartner, dropPartner } from '../gen/rivals';
import { rivalsOn, myOwner, ownerName, seats } from '../world/rivals';
import { commuteHTML, commuteClick } from './commute';
import { tl, TL } from '../i18n';

const dlgEl = $('dlg'), panel = () => dlgEl.querySelector('.panel') as HTMLElement;
let lode: Lode | null = null;
const at = () => (lode ? { x: nearX(lode.x, G.pos.x), z: lode.z } : null);
const state = (): OutpostState | undefined => (lode ? G.char.outposts[lode.id] : undefined);
const hrs = (m: number) => (m >= 60 ? TL`${Math.floor(m / 60)} h ${Math.round(m % 60)} min` : `${Math.round(m)} min`);

/** (0.216) Also the port window's (ui/port.ts): `pos` is where the materials are counted (the backpack and trunks there). */
export function partHTML(o: OutpostState, p: OutpostPart, pos = at()): string {
  const tier = countOf(o, p), name = partName(o.k, p, o.pk, tier), text = p === 'dig' ? DIG[digOf(o.k)].text : p === 'power' ? (o.pk ? POWER_SRC[o.pk].text : '') : p === 'bunks' ? BUNKS.text : p === 'field' ? FIELD.text : p === 'wall' ? WALL[Math.min(WALL.length - 1, tier)].text : p === 'turret' ? TURRET.text : p === 'proc' ? procOf(o.k)?.text ?? '' : p === 'port' ? PORT.text : STORE.text;
  if (p === 'power' && !o.done?.power && !o.job && !Object.values(o.given?.power ?? {}).some((n) => (n ?? 0) > 0)) { // pick (or change) the source while nothing is handed over
    const pick = POWER_KINDS.filter((k) => k !== o.pk).map((k) => { const q = POWER_SRC[k]; return TL`<button class="opt" data-op="pk:${k}">${o.pk ? tl('Build a ') : ''}${q.name}: ${q.kw} kW${k === 'wind' ? tl(' at full wind') : k === 'solar' ? tl(' in full sun') : ''}, reach ${q.r} m${q.fuel ? TL`, burns ${ITEMS[q.fuel].name} (1 every ${q.burn! / 60} h)` : ''}</button>`; }).join('');
    if (!o.pk) return (o.k === 'port' ? TL`<div class="say"><b>Power</b>: the port's crane stands still without power. A power source here powers every outpost and port within its reach, and sources whose reach meets form one grid.</div>` : TL`<div class="say"><b>Power</b>: an extraction works at half pace without power. A power source here powers every outpost within its reach, and sources whose reach meets form one grid.</div>`) + pick;
    return partBody(o, p, name, text, pos) + TL`<div class="say" style="opacity:.7">Or choose another source:</div>` + pick;
  }
  return partBody(o, p, name, text, pos);
}
function partBody(o: OutpostState, p: OutpostPart, name: string, text: string, pos: { x: number; z: number } | null): string {
  const have = countOf(o, p), wall = p === 'wall', many = isMany(p) && !wall, tally = many ? ` ${have}/${maxOf(p)}` : wall && have ? ` (now: ${WALL[have - 1].name.toLowerCase()})` : '';
  if (have >= maxOf(p)) return `<div class="say"><b style="color:var(--xp)">${wall ? WALL[WALL.length - 1].name : name}${many ? TL`s ${have}/${maxOf(p)}` : ''} ✓</b></div>`;
  if (o.job?.p === p) return TL`<div class="say"><b>${name}${tally}</b>: the builders are at ${many && have ? tl('another') : tl('it')}, ${hrs(jobEnd(o) - G.char.time)} left.</div>`;
  const rows = partPlan(o, p).map((r) => `${itemName(r.k)} ${r.given}/${r.n}${r.given >= r.n ? ' ✓' : TL` · with you: ${carried(r.k, pos)}`}`).join('<br>');
  const why = partProblem(o, p);
  return TL`<div class="say"><b>${name}${tally}</b> <span style="opacity:.8">(${hoursOf(o, p)} h to build${many && have ? tl(' another') : ''})</span>: ${text}<br>${rows}</div>` +
    (why ? `<div class="say" style="opacity:.7">${why}</div>` : TL`<button class="opt" data-op="give:${p}">Hand over materials for the ${many && have ? tl('next ') : ''}${name.toLowerCase()}</button>`);
}
/** (0.187, stage O6) The convoy route: pick a village, hand over a truck, keep its tank full, bring food back. */
const nearVillages = (o: OutpostState) => allVillages(G.char.world).map((v) => ({ v, d: wdist(o.x, o.z, v.x, v.z) })).filter((q) => q.d < ROUTE.reach).sort((a, b) => a.d - b.d).slice(0, 4);
/** (0.248) The vehicles parked by the outpost (anyone's to hand over). */
const myTrucks = (o: OutpostState) => vehicles.filter((v) => v.claimed && !v.ai && !v.held && wdist(v.st.x, v.st.z, o.x, o.z) < 80);
const trunkFull = (v: (typeof vehicles)[number]) => { const t = trunkOf(v.st); return t.items.some(Boolean) || !!t.bays?.some(Boolean) || t.gold > 0; };
function routeHTML(id: string, o: OutpostState): string {
  const c = G.char, r = o.route;
  if (!r) {
    const vs = nearVillages(o);
    return TL`<div class="say"><b>Convoy route</b>: a truck of yours can haul this outpost's crates to a village's hall on a timetable, and bring food back for the pantry.</div>` +
      (vs.length ? vs.map(({ v, d }) => TL`<button class="opt" data-op="route:${v.id}">Set up a route to ${v.name} (${(d * ROUTE.detour / 1000).toFixed(1)} km by road)</button>`).join('') : TL`<div class="say" style="opacity:.7">No village within ${ROUTE.reach / 1000} km.</div>`);
  }
  const P = periodOf(r), t = r.truck, s0 = c.towns[r.v];
  let s = TL`<div class="say"><b>Convoy route</b> to ${r.vname}: ${r.km} km by road, ${hrs(legOf(r))} each way, a round trip every ${hrs(P)}. Bandits rob ${Math.round(robChance(c.world, o, r) * 100)}% of the trips${t?.parts.gun ? tl(' (the roof cannon helps)') : ''}.`;
  const sent = Object.entries(r.sent).filter(([, n]) => n).map(([g, n]) => `${n} × ${ITEMS[g as ItemKey].name}`).join(', ');
  if (sent) s += TL`<br>Delivered so far: ${sent}.`;
  const wait = waiting(r, s0, id);
  if (wait) s += TL` ${wait} crate${wait === 1 ? '' : 's'} wait at ${r.vname} until its stores are opened.`;
  if (r.robbed) s += TL` Robbed ${r.robbed} time${r.robbed === 1 ? '' : 's'}.`;
  if (!t) {
    const mine = myTrucks(o);
    s += TL`<br>No truck on it. Park a vehicle by the outpost and hand it over (its trunk empty).</div>`;
    s += mine.map((v) => { const why = truckProblem(v.st.parts, v.st.model) || (trunkFull(v) ? tl('Empty its trunk first.') : ''); return why ? `<div class="say" style="opacity:.7">${vehicleTitle(v.st.model)}: ${why}</div>` : TL`<button class="opt" data-op="truck:${v.st.id}">Hand over the ${vehicleTitle(v.st.model)} (${ROUTE.cap[v.st.model]} crates a trip)</button>`; }).join('');
    return s + TL`<button class="opt" data-op="unroute">Give up the route</button>`;
  }
  const [fuel, need, unit] = truckEnergy(r), ev = unit === 'kWh', cv = convoyAt(r, c.time), hull = Math.round((t.parts.hull ?? 0) / VEHICLES[t.model].hull * 100);
  const where = wrecked(r) ? tl('<span style="color:#ff6a4a">wrecked on the road: recall it and mend its hull</span>') : cv.at === 'parked' ? TL`<span style="color:#ff6a4a">standing at the outpost, its ${unit === 'kWh' ? tl('battery') : tl('tank')} too low for a trip</span>` : cv.at === 'out' ? TL`on its way to ${r.vname} (${Math.round(cv.p * 100)}%)` : cv.at === 'back' ? TL`on its way back (${Math.round(cv.p * 100)}%)` : cv.at === 'village' ? TL`unloading at ${r.vname}` : tl('loading here');
  s += TL`<br>Truck: a ${vehicleTitle(t.model)} (handed over by ${t.by}), ${ROUTE.cap[t.model]} crates a trip, hull ${hull}%, ${where}.`;
  s += ev ? TL`<br>Battery: ${Math.round(fuel)} kWh, ${need} kWh a round trip. ${r.grid ? tl('It charges full at the outpost before every trip.') : tl('<span style="color:#ff6a4a">No grid reaches this outpost: it cannot charge here.</span>')}`
    : TL`<br>Tank: ${Math.round(fuel)} of ${VEHICLES[t.model].tank} L, ${need} L a round trip: ${Math.floor(fuel / need)} more trip${Math.floor(fuel / need) === 1 ? '' : 's'}. With you: ${carried('fuel', at())} canisters.`;
  if (r.last) s += TL`<br>Last trip: ${r.last[1] === 'ok' ? tl('delivered') : r.last[1] === 'dry' ? tl('missed for want of fuel') : r.last[1] === 'robbed' ? tl('<span style="color:#ff6a4a">robbed on the way</span>') : '<span style="color:#ff6a4a">wrecked</span>'}.`;
  s += TL`<br>Food back for the pantry: ${r.food ? tl('yes, as much as the pantry has room for') : 'no'}.</div>`;
  return s + (ev ? '' : TL`<button class="opt" data-op="rfuel">Pour fuel canisters into the truck</button>`) + TL`<button class="opt" data-op="rfood">${r.food ? tl('Stop bringing food back') : tl('Bring food back from ') + r.vname}</button><button class="opt" data-op="recall">Recall the truck (it parks here)</button>`;
}
/** (0.186, stage O5) Defence: the wall and turrets, the bandits' strength here, the chance to hold without you, the
 *  next raid, the last one, the animals. */
function defenceHTML(id: string, o: OutpostState): string {
  const c = G.char, str = strengthAt(c.world, o), tier = wallOf(o);
  const guns = outGunsAt(c.world, c.outposts, id, c.time); // (0.221, stage Z7) power from the grid and a guard each
  let s = TL`<div class="say"><b>Defence</b>: ${tier ? WALL[tier - 1].name.toLowerCase() : tl('no wall')}, ${turretsOf(o)} turret${turretsOf(o) === 1 ? '' : 's'}.`;
  if (guns.why === 'power') s += TL` <span style="color:#ff6a4a">The turrets have no power: they need ${OUT_GUN_KW} kW each from the grid and the outpost got only ${Math.round(guns.power * 100)}% of its power over the day (at least ${Math.round(OUT_GUN_POWER * 100)}%). None fires.</span>`;
  else if (guns.why === 'hands') s += TL` <span style="color:#ff6a4a">Only ${guns.guards} of ${guns.n} turrets have a guard: a settler each, after the fields' crews. Build bunkhouses and feed them.</span>`;
  else if (guns.n) s += TL` Every turret has power and a guard.`;
  if (!str) s += tl(' This near Gridholm no bandits raid it.');
  else {
    const r = nextRaid(c.world, id, o, c.time);
    s += TL` Bandits here are of strength ${str.toFixed(1)}; without you it holds a raid ${Math.round(holdChance(o, str, guns.work) * 100)}% of the time.`;
    if (!worthRobbing(o)) s += tl(' Nothing here is worth robbing yet.');
    else if (r) s += r.t0 <= c.time ? TL` <b style="color:#ff6a4a">A raid is on now!</b>` : TL` The next raid comes in about ${hrs(r.t0 - c.time)} (day ${Math.floor(r.t0 / 1440) + 1}, ${fmtTime(r.t0)}); be here to fight it.`;
  }
  if (o.rlast) s += TL`<br>Last raid: ${o.rlast[1] === 'won' ? tl('driven off') : tl('<span style="color:#ff6a4a">lost: the crates, half the pantry and some people went</span>')}.`;
  if (!tier && (o.n?.field || o.life)) s += TL`<br><span style="opacity:.8">Without a fence the animals trample ${Math.round(PESTS.trample * 100)}% of the fields and now and then get into the pantry.</span>`;
  return s + '</div>';
}
/** (0.185, stage O4) The people: beds, the pantry, the fields' food by the land's fertility, who works where. */
export function peopleHTML(o: OutpostState, pos = at()): string {
  const c = G.char, L = lifeNow(c.world, o, c.time), f = fertility(c.world, o.x, o.z), n = Math.floor(L.n), beds = bedsOf(o), w = crews(o, L.n);
  const made = foodMade(o, L.n, f), eat = foodEaten(L.n), net = made - eat;
  let s = TL`<div class="say"><b>People</b>${isHamlet(o) ? tl(' <b style="color:var(--gold)">· a hamlet now</b>') : ''}: ${n} of ${beds} beds${beds ? '' : tl(' (build a bunkhouse and settlers will come)')}` +
    (n ? TL` · ${w.farm} on the fields, ${w.dig} at the ${o.k === 'port' ? PORT.name.toLowerCase() : o.k === 'camp' ? tl('plant') : o.done?.dig ? DIG[digOf(o.k)].name.toLowerCase() : 'dig'}${w.guard ? TL`, ${w.guard} on guard at the turrets` : ''}${w.idle ? `, ${w.idle} idle` : ''}` : '') +
    TL`<br>Land: ${fertilityWord(f)} (fertility ${Math.round(f * 100)}%) · ${o.n?.field ?? 0} field${o.n?.field === 1 ? '' : 's'} grow ${made.toFixed(1)} food a day, the people eat ${eat.toFixed(1)}` +
    TL`<br>Pantry: ${L.food.toFixed(1)} of ${pantryOf(o)} food${eat > 0 ? ` (${net >= 0 ? tl('growing') : TL`${(L.food / (eat - made)).toFixed(1)} days left`})` : ''}` +
    (L.fed < 1 ? TL` · <span style="color:#ff6a4a">hungry: settlers are leaving</span>` : '') +
    (w.dig && o.done?.dig ? TL`<br>The dig crew of ${w.dig} digs ${Math.round((crewFactor(o) - 1) * 100)}% faster.` : '') + `</div>`;
  if (beds && n < beds && L.fed >= 1) s += TL`<div class="say" style="opacity:.8">Settlers come while there are free beds and food to spare: ${LIFE.reserve} days of it in the pantry, or fields that grow it.</div>`;
  if (!isHamlet(o)) s += TL`<div class="say" style="opacity:.7">With ${LIFE.hamlet.bunks} bunkhouses, ${LIFE.hamlet.field} fields, power and ${LIFE.hamlet.people} people it becomes a hamlet.</div>`;
  const foods = (Object.keys(FOOD.value) as ItemKey[]).filter((k) => carried(k, pos) > 0);
  s += foods.length ? TL`<div class="say">Food with you: ${foods.map((k) => `${itemName(k)} ×${carried(k, pos)}`).join(', ')}</div><button class="opt" data-op="food">Load food into the pantry</button>`
    : TL`<div class="say" style="opacity:.7">Bring crates of grain, potatoes, carrots, eggs, milk or meat for the pantry.</div>`;
  return s;
}
/** The grid this outpost is on: its supply and demand now, the share over the day, the fuel here. */
export function powerHTML(id: string, o: OutpostState, pos = at()): string {
  const c = G.char, g = grids(c.outposts), n = g.get(id);
  let s = '';
  if (o.done?.power && o.pk) {
    const q = POWER_SRC[o.pk];
    if (q.fuel) {
      const left = fuelLeft(o, c.time);
      s += TL`<div class="say"><b>${q.name}</b>: ${left > 0 ? TL`${left.toFixed(1)} of ${q.bunker} ${ITEMS[q.fuel].name.replace(/^Crate of /, '').toLowerCase()} in the bunker, ${Math.floor(left * q.burn! / 60)} h of running` : TL`<span style="color:#ff6a4a">out of ${ITEMS[q.fuel].name.toLowerCase()}: it stands still</span>`} · with you: ${carried(q.fuel, pos)}</div>` +
        TL`<button class="opt" data-op="fuel">Load ${ITEMS[q.fuel].name}</button>`;
    }
  }
  if (n === undefined) return s + (o.done?.dig ? TL`<div class="say" style="opacity:.8">No power reaches here: the crew digs at ${Math.round(powerFactor(0) * 100)}% pace.</div>` : '') + (o.done?.port ? tl('<div class="say" style="opacity:.8">No power reaches here: the crane stands still.</div>') : '');
  const st = gridState(c.world, c.outposts, g, c.time), share = powerShare(c.world, c.outposts, id, c.time), members = [...g.values()].filter((m) => m === n).length;
  return s + TL`<div class="say"><b>Grid</b> (${members} outpost${members === 1 ? '' : 's'}): making ${Math.round(st.supply[n] ?? 0)} kW now, the outposts draw ${Math.round(st.demand[n] ?? 0)} kW${demandOf(o) ? TL` (this one ${demandOf(o)} kW)` : ''}. Over the last day it met ${Math.round(share * 100)}% of the demand${o.done?.dig ? TL`: the crew digs at ${Math.round(powerFactor(share) * 100)}% pace` : ''}.</div>`;
}
/** (0.219, stage Z5) The power line to a village: choose the village, hand over the poles and cable, then what it carries. */
export function plineHTML(id: string, o: OutpostState, pos = at()): string {
  const c = G.char, l = o.pl;
  if (o.k === 'camp') return '';
  if (!l) {
    const vs = allVillages(c.world).map((v) => ({ v, d: wdist(o.x, o.z, v.x, v.z) })).filter((q) => q.d <= PLINE.reach).sort((a, b) => a.d - b.d).slice(0, 3);
    return TL`<div class="say"><b>Power line</b>: poles and cable to a village within ${PLINE.reach / 1000} km. Whichever side has power to spare feeds the other's shortfall, up to ${PLINE.cap} kW.</div>` +
      (vs.length ? vs.map(({ v }) => { const why = plineProblem(c.outposts, id, v), k = newLine(o, v).km; return why ? `<div class="say" style="opacity:.7">${v.name}: ${why}</div>` : TL`<button class="opt" data-op="pl:${v.id}">Stake out a line to ${v.name} (${k.toFixed(1)} km)</button>`; }).join('') : TL`<div class="say" style="opacity:.7">No village within ${PLINE.reach / 1000} km.</div>`);
  }
  if (!o.done?.pline) {
    const loose = !o.job && !Object.values(o.given?.pline ?? {}).some((n) => (n ?? 0) > 0);
    return partHTML(o, 'pline', pos).replace('</b>', TL` to ${l.name}, ${l.km.toFixed(1)} km</b>`) + (loose ? TL`<button class="opt" data-op="unpl">Pull up the line's stakes</button>` : '');
  }
  const f = lineFlows(c.world, c.outposts, c.time).get(id) ?? 0, v = allVillages(c.world).find((q) => q.id === l.v);
  const b = v ? balance(c.world, v, villageSeed(c.world, v), c.towns[v.id], c.time, true) : null;
  return TL`<div class="say"><b style="color:var(--xp)">Power line to ${l.name} ✓</b> (${l.km.toFixed(1)} km, up to ${PLINE.cap} kW): ` +
    (f > 0 ? TL`it carries <b>${Math.round(f)} kW</b> from this grid to ${l.name}.` : f < 0 ? TL`it carries <b>${Math.round(-f)} kW</b> from ${l.name} into this grid.` : tl('nothing flows now: neither side has power to spare for the other.')) +
    (b ? TL` ${l.name} has ${Math.round(b.free)} kW to spare and lacks ${Math.round(b.short)} kW.` : '') + `</div>`;
}
/** (0.219) The line's clicks (from this window and the port's): choose the village, give up an empty line. */
export function plineClick(id: string, o: OutpostState, a: string, x: string): string | null {
  const c = G.char;
  if (a === 'pl') {
    const v = allVillages(c.world).find((q) => q.id === +x);
    const why = v ? plineProblem(c.outposts, id, v) : tl('Not here.');
    if (why) return why;
    o.pl = newLine(o, v!); return TL`You stake out a line of poles to ${v!.name}, ${o.pl.km.toFixed(1)} km. Bring the poles and the cable.`;
  }
  if (a === 'unpl' && o.pl && !o.done?.pline && !o.job && !Object.values(o.given?.pline ?? {}).some((n) => (n ?? 0) > 0)) { delete o.pl; delete o.given?.pline; return tl('You pull up the line\'s stakes.'); }
  return null;
}
/** (0.189, stage O8) A rivals game: the owner lets the other seats in, or shuts them out again. */
function partnersHTML(o: OutpostState): string {
  if (!rivalsOn() || o.o !== myOwner()) return '';
  const btn = (op: string, t: string) => `<button class="opt" style="display:inline-block;width:auto;margin:2px 4px" data-op="${op}">${t}</button>`;
  const out = seats([o.o, ...(o.pp ?? [])]), inn = o.pp ?? [];
  if (!out.length && !inn.length) return tl('<div class="say" style="opacity:.7">No other player has a seat in this world yet. When one comes, you can make them a partner here.</div>');
  return TL`<div class="say"><b>Partners</b>: they may build here, take the crates and run the convoy as you do.<br>` +
    inn.map((p) => btn('pout:' + p, TL`Shut ${ownerName(p)} out`)).join('') + out.map(([p, v]) => btn('pin:' + p, TL`Let ${v.n || tl('a rival')} in`)).join('') + '</div>';
}
function render(msg = '') {
  if (!lode) return;
  const c = G.char, l = lode, spec = LODES[l.k], o = state();
  let s = TL`<h2>${l.name}</h2><div class="role">${spec.name} · gives ${givesText(l)} · richness ${Math.round(l.rich * 100)}%</div>`;
  if (msg) s += `<div class="say">${msg}</div>`;
  if (!o) {
    s += TL`<div class="say">${spec.blurb[0].toUpperCase() + spec.blurb.slice(1)}. Nobody works it. Drive a stake in and it is yours to work: build its ${DIG[digOf(l.k)].name.toLowerCase()} and a storage shed from materials you bring here, and it digs ${outputs(l).map(([g, r]) => `${(r * 24).toFixed(1)} ${ITEMS[g].name.replace(/^Crate of /, '').toLowerCase()}`).join(tl(' and '))} a day.</div>` +
      TL`<button class="opt" data-op="stake" style="color:var(--gold)">Drive in the stake (found an outpost)</button>`;
  } else if (!mayUse(o, myOwner())) {
    s += TL`<div class="say">Staked by ${o.by}${o.o !== 'crew' && ownerName(o.o) !== o.by ? TL` for ${ownerName(o.o)}` : ''}. Only they and the partners they let in work it: ask them to make you a partner.</div>`;
  } else {
    s += TL`<div class="say" style="opacity:.85">Outpost staked by ${o.by}. Owner: ${ownerName(o.o)}.${o.pp?.length ? TL` Partners: ${o.pp.map(ownerName).join(', ')}.` : ''}</div>` + partnersHTML(o);
    s += partHTML(o, 'dig') + partHTML(o, 'store') + (procOf(o.k) ? partHTML(o, 'proc') : '') + partHTML(o, 'power') + powerHTML(l.id, o) + plineHTML(l.id, o) + partHTML(o, 'bunks') + partHTML(o, 'field') + peopleHTML(o) + commuteHTML(l.id, o) + partHTML(o, 'wall') + partHTML(o, 'turret') + defenceHTML(l.id, o) + routeHTML(l.id, o);
    if (o.done?.dig) {
      const pw = pwOf(c.world, c.outposts, l.id, c.time), now = stockNow(o, l, c.time, pw), cap = capOf(o);
      s += TL`<div class="say"><b>On site</b> (${o.done.store ? tl('in the shed') : tl('piled in the open')}, up to ${cap} of each):<br>` + outputs(l).map(([g, r]) => {
        const n = Math.floor(now[g] ?? 0);
        return TL`${itemName(g)} ${n}/${cap} · ${(r * 24 * pw).toFixed(1)} a day${n >= cap ? tl(' · full: the crew stands idle') : ''} ` +
          (n ? TL`<button class="opt" style="display:inline-block;width:auto;margin:2px 4px" data-op="take:${g}:1">Take 1</button><button class="opt" style="display:inline-block;width:auto;margin:2px 4px" data-op="take:${g}:${n}">Take all</button>` : '');
      }).join('<br>');
      const p = o.done.proc ? procOf(o.k) : null;
      if (p) { // (0.188) the works' output
        const n = Math.floor(now[p.out] ?? 0), f = powerFactor(powerShare(c.world, c.outposts, l.id, c.time));
        s += TL`<br>${itemName(p.out)} ${n}/${cap} · the ${p.name.toLowerCase()} makes ${p.m} from ${p.n} ${ITEMS[p.inp].name.replace(/^Crate of /, '').toLowerCase()} every ${hrs(p.batch / f)} (${p.kw} kW)${n >= cap ? tl(' · full: it stands idle') : ''} ` +
          (n ? TL`<button class="opt" style="display:inline-block;width:auto;margin:2px 4px" data-op="take:${p.out}:1">Take 1</button><button class="opt" style="display:inline-block;width:auto;margin:2px 4px" data-op="take:${p.out}:${n}">Take all</button>` : '');
      }
      s += `</div>`;
    } else s += TL`<div class="say" style="opacity:.7">Nothing is dug until the ${DIG[digOf(l.k)].name.toLowerCase()} stands.</div>`;
    if (bare(o) && (o.o === 'crew' || o.o === myOwner())) s += TL`<button class="opt" data-op="drop">Pull up the stake</button>`;
  }
  panel().classList.add('wide');
  panel().innerHTML = s + TL`<button class="opt" data-op="close">Close</button>`;
}
export function openOutpost(l: Lode) {
  if (!G.playing || G.dlgOpen || G.packOpen || G.xferOpen) return;
  lode = l; G.dlgOpen = true; W.talkNpc = null; G.firing = false; for (const k in G.keys) G.keys[k] = false;
  render();
  dlgEl.style.display = 'flex'; if (document.pointerLockElement) document.exitPointerLock();
}
function close() { lode = null; G.dlgOpen = false; dlgEl.style.display = 'none'; if (!G.isTouch) lockPointer(); }
/** Clicks in the outpost window; true when handled. */
export function outpostClick(t: HTMLElement): boolean {
  if (!lode) return false;
  const b = t.closest('[data-op]') as HTMLElement | null;
  if (!b) return false;
  const c = G.char, l = lode, [a, x, y] = b.dataset.op!.split(':');
  if (a === 'close') { close(); return true; }
  if (a === 'commute') { commuteClick(l.id, x, (m) => { if (lode === l) render(m); }); return true; } // (0.220) the village's lock, not the outpost's
  let msg = '';
  void withOutpost(l.id, () => {
    const o = c.outposts[l.id], byId = (id: string) => lodeById(c.world, id);
    if (a === 'stake') {
      if (o) { msg = TL`${o.by} has staked it already.`; return; }
      c.outposts[l.id] = newOutpost(l, c.name || tl('You'), c.time, myOwner()); // (0.189) a rival's own, else the crew's
      msg = tl('The stake goes in. This is an outpost now: bring the materials and the builders will put up what you choose.');
      logLine(TL`You staked an outpost at ${l.name}.`); showToast(tl('Outpost staked'));
    } else if (!o || !mayUse(o, myOwner())) { msg = tl('Not yours to work.'); return; }
    else if ((a === 'pin' || a === 'pout') && o.o === myOwner() && o.o !== 'crew') { // (0.189) the owner's partners
      const who = x;
      if (a === 'pin' ? addPartner(o, who) : dropPartner(o, who)) { msg = a === 'pin' ? TL`${ownerName(who)} may work ${o.name} with you now.` : TL`${ownerName(who)} may no longer work ${o.name}.`; logLine(msg); }
    }
    else if (a === 'pl' || a === 'unpl') msg = plineClick(l.id, o, a, x) ?? '';
    else if (a === 'pk') {
      msg = choosePower(o, x as PowerKind) ? TL`You mark out the ground for a ${POWER_SRC[x as PowerKind].name.toLowerCase()}.` : tl('The builders have started on another source already.');
    } else if (a === 'fuel' && o.pk && POWER_SRC[o.pk].fuel) {
      const f = POWER_SRC[o.pk].fuel!;
      tellRaids(settleAll(c.world, c.outposts, byId, c.time, c.towns)); // the grid changes: count what was dug so far first
      const n = loadFuel(o, carried(f, at()), c.time);
      if (n) takeFrom(f, n, at());
      msg = n ? TL`Loaded ${n} × ${ITEMS[f].name} into the bunker.` : TL`No ${ITEMS[f].name} with you, or the bunker is full.`;
    } else if (a === 'route' && !o.route) { // (0.187) the convoy route
      const v = allVillages(c.world).find((q) => q.id === +x);
      if (!v || wdist(o.x, o.z, v.x, v.z) > ROUTE.reach) { msg = tl('Too far.'); return; }
      o.route = newRoute(o, v, v.name); msg = TL`A route to ${v.name} is staked out. Hand over a truck to run it.`;
    } else if (a === 'unroute' && o.route && !o.route.truck) {
      delete o.route; msg = tl('You give up the route.');
    } else if (a === 'truck' && o.route && !o.route.truck) {
      const v = myTrucks(o).find((q) => q.st.id === x);
      if (!v) { msg = tl('Park it by the outpost first.'); return; }
      const why = truckProblem(v.st.parts, v.st.model) || (trunkFull(v) ? tl('Empty its trunk first.') : '');
      if (why) { msg = why; return; }
      tellRaids(settleAll(c.world, c.outposts, byId, c.time, c.towns));
      assignTruck(o.route, { id: v.st.id, model: v.st.model as VehicleModel, parts: structuredClone(v.st.parts), by: c.name || tl('You') }, c.time);
      takeVehicle(v);
      msg = TL`The crew takes the ${vehicleTitle(v.st.model)} on the route to ${o.route.vname}. The first convoy leaves in half an hour.`;
    } else if (a === 'recall' && o.route?.truck) {
      tellRaids(settleAll(c.world, c.outposts, byId, c.time, c.towns));
      const t = recallTruck(o.route)!, sp = at()!, ang = (hash(c.world, t.id.length, 0x0a71) % 628) / 100;
      parkVehicle(t.id, t.model, t.parts, sp.x + Math.cos(ang) * (l.r + 8), sp.z + Math.sin(ang) * (l.r + 8), ang);
      msg = TL`Your ${vehicleTitle(t.model)} is back and parked by the outpost${(t.parts.hull ?? 1) <= 0 ? tl(': a wreck, mend its hull') : ''}.`;
    } else if (a === 'rfuel' && o.route?.truck) {
      const n = fuelTruck(o.route, carried('fuel', at()));
      if (n) takeFrom('fuel', n, at());
      msg = n ? TL`Poured ${n} canister${n === 1 ? '' : 's'} into the truck.` : tl('No canisters with you, or the tank is full.');
    } else if (a === 'rfood' && o.route) {
      o.route.food = !o.route.food; msg = o.route.food ? TL`The convoy will bring food back from ${o.route.vname} when its stores have it.` : tl('No more food on the way back.');
    } else if (a === 'food') {
      tellRaids(settleAll(c.world, c.outposts, byId, c.time, c.towns)); // the people change: count what was dug so far first
      const got: string[] = [];
      for (const k of Object.keys(FOOD.value) as ItemKey[]) {
        const n = loadFood(c.world, o, k, carried(k, at()), c.time);
        if (n) { takeFrom(k, n, at()); got.push(`${ITEMS[k].name} ×${n}`); }
      }
      msg = got.length ? TL`Into the pantry: ${got.join(', ')}.` : tl('No food with you, or the pantry is full.');
    } else if (a === 'give') {
      const p = x as OutpostPart, { taken, started } = handOver(o, p, (k) => carried(k, at()), c.time);
      for (const [k, n] of taken) takeFrom(k, n, at());
      msg = taken.length ? tl('Handed over: ') + taken.map(([k, n]) => `${ITEMS[k].name} ×${n}`).join(', ') + '.' : tl('You carry nothing it still needs.');
      if (started) { msg += TL` <b>Everything is here: the builders start on the ${partName(o.k, p, o.pk, countOf(o, p)).toLowerCase()} (${hoursOf(o, p)} h).</b>`; gainXp(xpOf(o, p)); }
    } else if (a === 'take') {
      tellRaids(settleAll(c.world, c.outposts, byId, c.time, c.towns)); // (0.186) a raid over since: count it first
      const g = x as ItemKey, want = Math.max(1, +y || 1), n = takeCrates(o, l, g, want, c.time, pwOf(c.world, c.outposts, l.id, c.time));
      if (!n) { msg = tl('Nothing to take.'); return; }
      const left = putAway(g, n, at(), true);
      if (left) o.stock!.n[g] = (o.stock!.n[g] ?? 0) + left; // what finds no room stays on site
      msg = n - left ? TL`Loaded ${n - left} × ${ITEMS[g].name}${left ? TL`; ${left} had no room and stay here` : ''}.` : tl('No room in your backpack or the trunks here.');
    } else if (a === 'drop' && bare(o) && (o.o === 'crew' || o.o === myOwner())) {
      delete c.outposts[l.id]; msg = tl('You pull up the stake. The deposit is free again.');
    }
  }).then((ok) => { if (!ok) return; calcStats(); saveChar(); if (lode === l) render(msg); });
  return true;
}
