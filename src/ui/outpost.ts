// (0.183, PLAN_PLACOWEK.md stage O2) The outpost window, opened with E at a deposit in the wilds (gen/lodes.ts): drive
// the stake in, hand over what the extraction and the storage shed need (from the backpack and the vehicles parked by
// it), see what it digs, and take the crates away (trunks first). Every change runs under the outpost's lock online.
import { G, W } from '../game';
import { ITEMS, type ItemKey } from '../data/items';
import { calcStats, saveChar, gainXp } from '../character';
import { LODES, type Lode } from '../gen/lodes';
import { newOutpost, outputs, stockNow, takeCrates, partPlan, partProblem, partName, handOver, jobEnd, capOf, bare, mayUse, choosePower, DIG, digOf, STORE, OUTPOST, BUNKS, FIELD, WALL, TURRET, wallOf, turretsOf, countOf, maxOf, isMany, type OutpostState, type OutpostPart } from '../gen/outposts';
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
import { myCarList, takeVehicle, parkVehicle } from '../world/vehicles';
import { FOOD } from '../gen/farms';
import { POWER_SRC, POWER_KINDS, grids, gridState, powerShare, powerFactor, pwOf, fuelLeft, loadFuel, settleAll, demandOf, type PowerKind } from '../gen/grid';
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

const dlgEl = $('dlg'), panel = () => dlgEl.querySelector('.panel') as HTMLElement;
let lode: Lode | null = null;
const at = () => (lode ? { x: nearX(lode.x, G.pos.x), z: lode.z } : null);
const state = (): OutpostState | undefined => (lode ? G.char.outposts[lode.id] : undefined);
const hrs = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h ${Math.round(m % 60)} min` : `${Math.round(m)} min`);

function partHTML(o: OutpostState, p: OutpostPart): string {
  const tier = countOf(o, p), name = partName(o.k, p, o.pk, tier), text = p === 'dig' ? DIG[digOf(o.k)].text : p === 'power' ? (o.pk ? POWER_SRC[o.pk].text : '') : p === 'bunks' ? BUNKS.text : p === 'field' ? FIELD.text : p === 'wall' ? WALL[Math.min(WALL.length - 1, tier)].text : p === 'turret' ? TURRET.text : p === 'proc' ? procOf(o.k)?.text ?? '' : STORE.text;
  if (p === 'power' && !o.done?.power && !o.job && !Object.values(o.given?.power ?? {}).some((n) => (n ?? 0) > 0)) { // pick (or change) the source while nothing is handed over
    const pick = POWER_KINDS.filter((k) => k !== o.pk).map((k) => { const q = POWER_SRC[k]; return `<button class="opt" data-op="pk:${k}">${o.pk ? 'Build a ' : ''}${q.name}: ${q.kw} kW${k === 'wind' ? ' at full wind' : k === 'solar' ? ' in full sun' : ''}, reach ${q.r} m${q.fuel ? `, burns ${ITEMS[q.fuel].name} (1 every ${q.burn! / 60} h)` : ''}</button>`; }).join('');
    if (!o.pk) return `<div class="say"><b>Power</b>: an extraction works at half pace without power. A power source here powers every outpost within its reach, and sources whose reach meets form one grid.</div>` + pick;
    return partBody(o, p, name, text) + `<div class="say" style="opacity:.7">Or choose another source:</div>` + pick;
  }
  return partBody(o, p, name, text);
}
function partBody(o: OutpostState, p: OutpostPart, name: string, text: string): string {
  const have = countOf(o, p), wall = p === 'wall', many = isMany(p) && !wall, tally = many ? ` ${have}/${maxOf(p)}` : wall && have ? ` (now: ${WALL[have - 1].name.toLowerCase()})` : '';
  if (have >= maxOf(p)) return `<div class="say"><b style="color:var(--xp)">${wall ? WALL[WALL.length - 1].name : name}${many ? `s ${have}/${maxOf(p)}` : ''} ✓</b></div>`;
  if (o.job?.p === p) return `<div class="say"><b>${name}${tally}</b>: the builders are at ${many && have ? 'another' : 'it'}, ${hrs(jobEnd(o) - G.char.time)} left.</div>`;
  const rows = partPlan(o, p).map((r) => `${itemName(r.k)} ${r.given}/${r.n}${r.given >= r.n ? ' ✓' : ` · with you: ${carried(r.k, at())}`}`).join('<br>');
  const why = partProblem(o, p);
  return `<div class="say"><b>${name}${tally}</b> <span style="opacity:.8">(${OUTPOST.hours[p]} h to build${many && have ? ' another' : ''})</span>: ${text}<br>${rows}</div>` +
    (why ? `<div class="say" style="opacity:.7">${why}</div>` : `<button class="opt" data-op="give:${p}">Hand over materials for the ${many && have ? 'next ' : ''}${name.toLowerCase()}</button>`);
}
/** (0.187, stage O6) The convoy route: pick a village, hand over a truck, keep its tank full, bring food back. */
const nearVillages = (o: OutpostState) => allVillages(G.char.world).map((v) => ({ v, d: wdist(o.x, o.z, v.x, v.z) })).filter((q) => q.d < ROUTE.reach).sort((a, b) => a.d - b.d).slice(0, 4);
const myTrucks = (o: OutpostState) => myCarList().filter((v) => wdist(v.st.x, v.st.z, o.x, o.z) < 80);
function routeHTML(id: string, o: OutpostState): string {
  const c = G.char, r = o.route;
  if (!r) {
    const vs = nearVillages(o);
    return `<div class="say"><b>Convoy route</b>: a truck of yours can haul this outpost's crates to a village's hall on a timetable, and bring food back for the pantry.</div>` +
      (vs.length ? vs.map(({ v, d }) => `<button class="opt" data-op="route:${v.id}">Set up a route to ${v.name} (${(d * ROUTE.detour / 1000).toFixed(1)} km by road)</button>`).join('') : `<div class="say" style="opacity:.7">No village within ${ROUTE.reach / 1000} km.</div>`);
  }
  const P = periodOf(r), t = r.truck, s0 = c.towns[r.v];
  let s = `<div class="say"><b>Convoy route</b> to ${r.vname}: ${r.km} km by road, ${hrs(legOf(r))} each way, a round trip every ${hrs(P)}. Bandits rob ${Math.round(robChance(c.world, o, r) * 100)}% of the trips${t?.parts.gun ? ' (the roof cannon helps)' : ''}.`;
  const sent = Object.entries(r.sent).filter(([, n]) => n).map(([g, n]) => `${n} × ${ITEMS[g as ItemKey].name}`).join(', ');
  if (sent) s += `<br>Delivered so far: ${sent}.`;
  const wait = waiting(r, s0, id);
  if (wait) s += ` ${wait} crate${wait === 1 ? '' : 's'} wait at ${r.vname} until its stores are opened.`;
  if (r.robbed) s += ` Robbed ${r.robbed} time${r.robbed === 1 ? '' : 's'}.`;
  if (!t) {
    const mine = myTrucks(o);
    s += `<br>No truck on it. Park one of your vehicles by the outpost and hand it over (its trunk empty).</div>`;
    s += mine.map((v) => { const why = truckProblem(v.st.parts, v.st.model) || (v.st.trunk.items.some(Boolean) || v.st.trunk.gold > 0 ? 'Empty its trunk first.' : ''); return why ? `<div class="say" style="opacity:.7">${vehicleTitle(v.st.model)}: ${why}</div>` : `<button class="opt" data-op="truck:${v.st.id}">Hand over your ${vehicleTitle(v.st.model)} (${ROUTE.cap[v.st.model]} crates a trip)</button>`; }).join('');
    return s + `<button class="opt" data-op="unroute">Give up the route</button>`;
  }
  const [fuel, need, unit] = truckEnergy(r), ev = unit === 'kWh', cv = convoyAt(r, c.time), hull = Math.round((t.parts.hull ?? 0) / VEHICLES[t.model].hull * 100);
  const where = wrecked(r) ? '<span style="color:#ff6a4a">wrecked on the road: recall it and mend its hull</span>' : cv.at === 'parked' ? `<span style="color:#ff6a4a">standing at the outpost, its ${unit === 'kWh' ? 'battery' : 'tank'} too low for a trip</span>` : cv.at === 'out' ? `on its way to ${r.vname} (${Math.round(cv.p * 100)}%)` : cv.at === 'back' ? `on its way back (${Math.round(cv.p * 100)}%)` : cv.at === 'village' ? `unloading at ${r.vname}` : 'loading here';
  s += `<br>Truck: a ${vehicleTitle(t.model)} (handed over by ${t.by}), ${ROUTE.cap[t.model]} crates a trip, hull ${hull}%, ${where}.`;
  s += ev ? `<br>Battery: ${Math.round(fuel)} kWh, ${need} kWh a round trip. ${r.grid ? 'It charges full at the outpost before every trip.' : '<span style="color:#ff6a4a">No grid reaches this outpost: it cannot charge here.</span>'}`
    : `<br>Tank: ${Math.round(fuel)} of ${VEHICLES[t.model].tank} L, ${need} L a round trip: ${Math.floor(fuel / need)} more trip${Math.floor(fuel / need) === 1 ? '' : 's'}. With you: ${carried('fuel', at())} canisters.`;
  if (r.last) s += `<br>Last trip: ${r.last[1] === 'ok' ? 'delivered' : r.last[1] === 'dry' ? 'missed for want of fuel' : r.last[1] === 'robbed' ? '<span style="color:#ff6a4a">robbed on the way</span>' : '<span style="color:#ff6a4a">wrecked</span>'}.`;
  s += `<br>Food back for the pantry: ${r.food ? 'yes, as much as the pantry has room for' : 'no'}.</div>`;
  return s + (ev ? '' : `<button class="opt" data-op="rfuel">Pour fuel canisters into the truck</button>`) + `<button class="opt" data-op="rfood">${r.food ? 'Stop bringing food back' : 'Bring food back from ' + r.vname}</button><button class="opt" data-op="recall">Recall the truck (it parks here)</button>`;
}
/** (0.186, stage O5) Defence: the wall and turrets, the bandits' strength here, the chance to hold without you, the
 *  next raid, the last one, the animals. */
function defenceHTML(id: string, o: OutpostState): string {
  const c = G.char, str = strengthAt(c.world, o), tier = wallOf(o);
  let s = `<div class="say"><b>Defence</b>: ${tier ? WALL[tier - 1].name.toLowerCase() : 'no wall'}, ${turretsOf(o)} turret${turretsOf(o) === 1 ? '' : 's'}.`;
  if (!str) s += ' This near Gridholm no bandits raid it.';
  else {
    const r = nextRaid(c.world, id, o, c.time);
    s += ` Bandits here are of strength ${str.toFixed(1)}; without you it holds a raid ${Math.round(holdChance(o, str) * 100)}% of the time.`;
    if (!worthRobbing(o)) s += ' Nothing here is worth robbing yet.';
    else if (r) s += r.t0 <= c.time ? ` <b style="color:#ff6a4a">A raid is on now!</b>` : ` The next raid comes in about ${hrs(r.t0 - c.time)} (day ${Math.floor(r.t0 / 1440) + 1}, ${fmtTime(r.t0)}); be here to fight it.`;
  }
  if (o.rlast) s += `<br>Last raid: ${o.rlast[1] === 'won' ? 'driven off' : '<span style="color:#ff6a4a">lost: the crates, half the pantry and some people went</span>'}.`;
  if (!tier && (o.n?.field || o.life)) s += `<br><span style="opacity:.8">Without a fence the animals trample ${Math.round(PESTS.trample * 100)}% of the fields and now and then get into the pantry.</span>`;
  return s + '</div>';
}
/** (0.185, stage O4) The people: beds, the pantry, the fields' food by the land's fertility, who works where. */
function peopleHTML(o: OutpostState): string {
  const c = G.char, L = lifeNow(c.world, o, c.time), f = fertility(c.world, o.x, o.z), n = Math.floor(L.n), beds = bedsOf(o), w = crews(o, L.n);
  const made = foodMade(o, L.n, f), eat = foodEaten(L.n), net = made - eat;
  let s = `<div class="say"><b>People</b>${isHamlet(o) ? ' <b style="color:var(--gold)">· a hamlet now</b>' : ''}: ${n} of ${beds} beds${beds ? '' : ' (build a bunkhouse and settlers will come)'}` +
    (n ? ` · ${w.farm} on the fields, ${w.dig} at the ${o.done?.dig ? DIG[digOf(o.k)].name.toLowerCase() : 'dig'}${w.idle ? `, ${w.idle} idle` : ''}` : '') +
    `<br>Land: ${fertilityWord(f)} (fertility ${Math.round(f * 100)}%) · ${o.n?.field ?? 0} field${o.n?.field === 1 ? '' : 's'} grow ${made.toFixed(1)} food a day, the people eat ${eat.toFixed(1)}` +
    `<br>Pantry: ${L.food.toFixed(1)} of ${pantryOf(o)} food${eat > 0 ? ` (${net >= 0 ? 'growing' : `${(L.food / (eat - made)).toFixed(1)} days left`})` : ''}` +
    (L.fed < 1 ? ` · <span style="color:#ff6a4a">hungry: settlers are leaving</span>` : '') +
    (w.dig ? `<br>The dig crew of ${w.dig} digs ${Math.round((crewFactor(o) - 1) * 100)}% faster.` : '') + `</div>`;
  if (beds && n < beds && L.fed >= 1) s += `<div class="say" style="opacity:.8">Settlers come while there are free beds and food to spare: ${LIFE.reserve} days of it in the pantry, or fields that grow it.</div>`;
  if (!isHamlet(o)) s += `<div class="say" style="opacity:.7">With ${LIFE.hamlet.bunks} bunkhouses, ${LIFE.hamlet.field} fields, power and ${LIFE.hamlet.people} people it becomes a hamlet.</div>`;
  const foods = (Object.keys(FOOD.value) as ItemKey[]).filter((k) => carried(k, at()) > 0);
  s += foods.length ? `<div class="say">Food with you: ${foods.map((k) => `${itemName(k)} ×${carried(k, at())}`).join(', ')}</div><button class="opt" data-op="food">Load food into the pantry</button>`
    : `<div class="say" style="opacity:.7">Bring crates of grain, potatoes, carrots, eggs, milk or meat for the pantry.</div>`;
  return s;
}
/** The grid this outpost is on: its supply and demand now, the share over the day, the fuel here. */
function powerHTML(id: string, o: OutpostState): string {
  const c = G.char, g = grids(c.outposts), n = g.get(id);
  let s = '';
  if (o.done?.power && o.pk) {
    const q = POWER_SRC[o.pk];
    if (q.fuel) {
      const left = fuelLeft(o, c.time);
      s += `<div class="say"><b>${q.name}</b>: ${left > 0 ? `${left.toFixed(1)} of ${q.bunker} ${ITEMS[q.fuel].name.replace(/^Crate of /, '').toLowerCase()} in the bunker, ${Math.floor(left * q.burn! / 60)} h of running` : `<span style="color:#ff6a4a">out of ${ITEMS[q.fuel].name.toLowerCase()}: it stands still</span>`} · with you: ${carried(q.fuel, at())}</div>` +
        `<button class="opt" data-op="fuel">Load ${ITEMS[q.fuel].name}</button>`;
    }
  }
  if (n === undefined) return s + (o.done?.dig ? `<div class="say" style="opacity:.8">No power reaches here: the crew digs at ${Math.round(powerFactor(0) * 100)}% pace.</div>` : '');
  const st = gridState(c.world, c.outposts, g, c.time), share = powerShare(c.world, c.outposts, id, c.time), members = [...g.values()].filter((m) => m === n).length;
  return s + `<div class="say"><b>Grid</b> (${members} outpost${members === 1 ? '' : 's'}): making ${Math.round(st.supply[n] ?? 0)} kW now, the outposts draw ${Math.round(st.demand[n] ?? 0)} kW${demandOf(o) ? ` (this one ${demandOf(o)} kW)` : ''}. Over the last day it met ${Math.round(share * 100)}% of the demand${o.done?.dig ? `: the crew digs at ${Math.round(powerFactor(share) * 100)}% pace` : ''}.</div>`;
}
/** (0.189, stage O8) A rivals game: the owner lets the other seats in, or shuts them out again. */
function partnersHTML(o: OutpostState): string {
  if (!rivalsOn() || o.o !== myOwner()) return '';
  const btn = (op: string, t: string) => `<button class="opt" style="display:inline-block;width:auto;margin:2px 4px" data-op="${op}">${t}</button>`;
  const out = seats([o.o, ...(o.pp ?? [])]), inn = o.pp ?? [];
  if (!out.length && !inn.length) return '<div class="say" style="opacity:.7">No other player has a seat in this world yet. When one comes, you can make them a partner here.</div>';
  return `<div class="say"><b>Partners</b>: they may build here, take the crates and run the convoy as you do.<br>` +
    inn.map((p) => btn('pout:' + p, `Shut ${ownerName(p)} out`)).join('') + out.map(([p, v]) => btn('pin:' + p, `Let ${v.n || 'a rival'} in`)).join('') + '</div>';
}
function render(msg = '') {
  if (!lode) return;
  const c = G.char, l = lode, spec = LODES[l.k], o = state();
  let s = `<h2>${l.name}</h2><div class="role">${spec.name} · gives ${givesText(l)} · richness ${Math.round(l.rich * 100)}%</div>`;
  if (msg) s += `<div class="say">${msg}</div>`;
  if (!o) {
    s += `<div class="say">${spec.blurb[0].toUpperCase() + spec.blurb.slice(1)}. Nobody works it. Drive a stake in and it is yours to work: build its ${DIG[digOf(l.k)].name.toLowerCase()} and a storage shed from materials you bring here, and it digs ${outputs(l).map(([g, r]) => `${(r * 24).toFixed(1)} ${ITEMS[g].name.replace(/^Crate of /, '').toLowerCase()}`).join(' and ')} a day.</div>` +
      `<button class="opt" data-op="stake" style="color:var(--gold)">Drive in the stake (found an outpost)</button>`;
  } else if (!mayUse(o, myOwner())) {
    s += `<div class="say">Staked by ${o.by}${o.o !== 'crew' && ownerName(o.o) !== o.by ? ` for ${ownerName(o.o)}` : ''}. Only they and the partners they let in work it: ask them to make you a partner.</div>`;
  } else {
    s += `<div class="say" style="opacity:.85">Outpost staked by ${o.by}. Owner: ${ownerName(o.o)}.${o.pp?.length ? ` Partners: ${o.pp.map(ownerName).join(', ')}.` : ''}</div>` + partnersHTML(o);
    s += partHTML(o, 'dig') + partHTML(o, 'store') + (procOf(o.k) ? partHTML(o, 'proc') : '') + partHTML(o, 'power') + powerHTML(l.id, o) + partHTML(o, 'bunks') + partHTML(o, 'field') + peopleHTML(o) + partHTML(o, 'wall') + partHTML(o, 'turret') + defenceHTML(l.id, o) + routeHTML(l.id, o);
    if (o.done?.dig) {
      const pw = pwOf(c.world, c.outposts, l.id, c.time), now = stockNow(o, l, c.time, pw), cap = capOf(o);
      s += `<div class="say"><b>On site</b> (${o.done.store ? 'in the shed' : 'piled in the open'}, up to ${cap} of each):<br>` + outputs(l).map(([g, r]) => {
        const n = Math.floor(now[g] ?? 0);
        return `${itemName(g)} ${n}/${cap} · ${(r * 24 * pw).toFixed(1)} a day${n >= cap ? ' · full: the crew stands idle' : ''} ` +
          (n ? `<button class="opt" style="display:inline-block;width:auto;margin:2px 4px" data-op="take:${g}:1">Take 1</button><button class="opt" style="display:inline-block;width:auto;margin:2px 4px" data-op="take:${g}:${n}">Take all</button>` : '');
      }).join('<br>');
      const p = o.done.proc ? procOf(o.k) : null;
      if (p) { // (0.188) the works' output
        const n = Math.floor(now[p.out] ?? 0), f = powerFactor(powerShare(c.world, c.outposts, l.id, c.time));
        s += `<br>${itemName(p.out)} ${n}/${cap} · the ${p.name.toLowerCase()} makes ${p.m} from ${p.n} ${ITEMS[p.inp].name.replace(/^Crate of /, '').toLowerCase()} every ${hrs(p.batch / f)} (${p.kw} kW)${n >= cap ? ' · full: it stands idle' : ''} ` +
          (n ? `<button class="opt" style="display:inline-block;width:auto;margin:2px 4px" data-op="take:${p.out}:1">Take 1</button><button class="opt" style="display:inline-block;width:auto;margin:2px 4px" data-op="take:${p.out}:${n}">Take all</button>` : '');
      }
      s += `</div>`;
    } else s += `<div class="say" style="opacity:.7">Nothing is dug until the ${DIG[digOf(l.k)].name.toLowerCase()} stands.</div>`;
    if (bare(o) && (o.o === 'crew' || o.o === myOwner())) s += `<button class="opt" data-op="drop">Pull up the stake</button>`;
  }
  panel().classList.add('wide');
  panel().innerHTML = s + `<button class="opt" data-op="close">Close</button>`;
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
  let msg = '';
  void withOutpost(l.id, () => {
    const o = c.outposts[l.id], byId = (id: string) => lodeById(c.world, id);
    if (a === 'stake') {
      if (o) { msg = `${o.by} has staked it already.`; return; }
      c.outposts[l.id] = newOutpost(l, c.name || 'You', c.time, myOwner()); // (0.189) a rival's own, else the crew's
      msg = 'The stake goes in. This is an outpost now: bring the materials and the builders will put up what you choose.';
      logLine(`You staked an outpost at ${l.name}.`); showToast('Outpost staked');
    } else if (!o || !mayUse(o, myOwner())) { msg = 'Not yours to work.'; return; }
    else if ((a === 'pin' || a === 'pout') && o.o === myOwner() && o.o !== 'crew') { // (0.189) the owner's partners
      const who = x;
      if (a === 'pin' ? addPartner(o, who) : dropPartner(o, who)) { msg = a === 'pin' ? `${ownerName(who)} may work ${o.name} with you now.` : `${ownerName(who)} may no longer work ${o.name}.`; logLine(msg); }
    }
    else if (a === 'pk') {
      msg = choosePower(o, x as PowerKind) ? `You mark out the ground for a ${POWER_SRC[x as PowerKind].name.toLowerCase()}.` : 'The builders have started on another source already.';
    } else if (a === 'fuel' && o.pk && POWER_SRC[o.pk].fuel) {
      const f = POWER_SRC[o.pk].fuel!;
      tellRaids(settleAll(c.world, c.outposts, byId, c.time, c.towns)); // the grid changes: count what was dug so far first
      const n = loadFuel(o, carried(f, at()), c.time);
      if (n) takeFrom(f, n, at());
      msg = n ? `Loaded ${n} × ${ITEMS[f].name} into the bunker.` : `No ${ITEMS[f].name} with you, or the bunker is full.`;
    } else if (a === 'route' && !o.route) { // (0.187) the convoy route
      const v = allVillages(c.world).find((q) => q.id === +x);
      if (!v || wdist(o.x, o.z, v.x, v.z) > ROUTE.reach) { msg = 'Too far.'; return; }
      o.route = newRoute(o, v, v.name); msg = `A route to ${v.name} is staked out. Hand over a truck to run it.`;
    } else if (a === 'unroute' && o.route && !o.route.truck) {
      delete o.route; msg = 'You give up the route.';
    } else if (a === 'truck' && o.route && !o.route.truck) {
      const v = myTrucks(o).find((q) => q.st.id === x);
      if (!v) { msg = 'Park it by the outpost first.'; return; }
      const why = truckProblem(v.st.parts, v.st.model) || (v.st.trunk.items.some(Boolean) || v.st.trunk.gold > 0 ? 'Empty its trunk first.' : '');
      if (why) { msg = why; return; }
      tellRaids(settleAll(c.world, c.outposts, byId, c.time, c.towns));
      assignTruck(o.route, { id: v.st.id, model: v.st.model as VehicleModel, parts: structuredClone(v.st.parts), by: c.name || 'You' }, c.time);
      takeVehicle(v);
      msg = `The crew takes your ${vehicleTitle(v.st.model)} on the route to ${o.route.vname}. The first convoy leaves in half an hour.`;
    } else if (a === 'recall' && o.route?.truck) {
      tellRaids(settleAll(c.world, c.outposts, byId, c.time, c.towns));
      const t = recallTruck(o.route)!, sp = at()!, ang = (hash(c.world, t.id.length, 0x0a71) % 628) / 100;
      parkVehicle(t.id, t.model, t.parts, sp.x + Math.cos(ang) * (l.r + 8), sp.z + Math.sin(ang) * (l.r + 8), ang);
      msg = `Your ${vehicleTitle(t.model)} is back and parked by the outpost${(t.parts.hull ?? 1) <= 0 ? ': a wreck, mend its hull' : ''}.`;
    } else if (a === 'rfuel' && o.route?.truck) {
      const n = fuelTruck(o.route, carried('fuel', at()));
      if (n) takeFrom('fuel', n, at());
      msg = n ? `Poured ${n} canister${n === 1 ? '' : 's'} into the truck.` : 'No canisters with you, or the tank is full.';
    } else if (a === 'rfood' && o.route) {
      o.route.food = !o.route.food; msg = o.route.food ? `The convoy will bring food back from ${o.route.vname} when its stores have it.` : 'No more food on the way back.';
    } else if (a === 'food') {
      tellRaids(settleAll(c.world, c.outposts, byId, c.time, c.towns)); // the people change: count what was dug so far first
      const got: string[] = [];
      for (const k of Object.keys(FOOD.value) as ItemKey[]) {
        const n = loadFood(c.world, o, k, carried(k, at()), c.time);
        if (n) { takeFrom(k, n, at()); got.push(`${ITEMS[k].name} ×${n}`); }
      }
      msg = got.length ? `Into the pantry: ${got.join(', ')}.` : 'No food with you, or the pantry is full.';
    } else if (a === 'give') {
      const p = x as OutpostPart, { taken, started } = handOver(o, p, (k) => carried(k, at()), c.time);
      for (const [k, n] of taken) takeFrom(k, n, at());
      msg = taken.length ? 'Handed over: ' + taken.map(([k, n]) => `${ITEMS[k].name} ×${n}`).join(', ') + '.' : 'You carry nothing it still needs.';
      if (started) { msg += ` <b>Everything is here: the builders start on the ${partName(o.k, p, o.pk, countOf(o, p)).toLowerCase()} (${OUTPOST.hours[p]} h).</b>`; gainXp(OUTPOST.xp[p]); }
    } else if (a === 'take') {
      tellRaids(settleAll(c.world, c.outposts, byId, c.time, c.towns)); // (0.186) a raid over since: count it first
      const g = x as ItemKey, want = Math.max(1, +y || 1), n = takeCrates(o, l, g, want, c.time, pwOf(c.world, c.outposts, l.id, c.time));
      if (!n) { msg = 'Nothing to take.'; return; }
      const left = putAway(g, n, at(), true);
      if (left) o.stock!.n[g] = (o.stock!.n[g] ?? 0) + left; // what finds no room stays on site
      msg = n - left ? `Loaded ${n - left} × ${ITEMS[g].name}${left ? `; ${left} had no room and stay here` : ''}.` : 'No room in your backpack or the trunks here.';
    } else if (a === 'drop' && bare(o) && (o.o === 'crew' || o.o === myOwner())) {
      delete c.outposts[l.id]; msg = 'You pull up the stake. The deposit is free again.';
    }
  }).then((ok) => { if (!ok) return; calcStats(); saveChar(); if (lode === l) render(msg); });
  return true;
}
