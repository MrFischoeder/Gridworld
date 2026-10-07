import { withTownStock } from './stock';
import { online } from '../net/client';
import { settleOwn, anchorNew } from '../gen/hall';
import { developmentHTML, developmentClick } from './settlement';
import { statusHTML } from './villagestats';
import { settlementConsoleClick } from '../world/settlement';
import { progressive, development, smithAllows } from '../gen/settlement';
import { gateConsoleClick } from './worldgates';
// Conversations and shops. New options (quests) plug in through OPT_TEXT and the switch below.
import { villageKw } from '../gen/improve';
import { G, W } from '../game';
import { ITEMS, HANDS_ONLY } from '../data/items';
import { NPC_INFO, VILLAGER_LINES, RUMOURS, OPT_TEXT, LORE, LORE_SHUTTLE, BUYS, COOK_PRICE, HOUSE_PRICE, stockFor, type OptId } from '../data/npcs';
import { putItems } from '../inventory';
import { craftClick, showForge } from './craft';
import { buildClick } from './build';
import { addItem, calcStats, saveChar, listOf, handsChanged } from '../character';
import { $ } from './hud';
import { lockPointer } from './input';
import type { Npc } from '../world/npc';
import { VEHICLES, vehicleTitle, health, type VehicleModel } from '../data/vehicles';
import { buyVehicle, vehiclesForSale, sellVehicle } from '../world/vehicles';
import { questOptions, questTalk } from '../world/quests';
import { PART_PRICE, PART_BUYBACK, type ItemKey } from '../data/items';
import type { Slot } from '../save';
import { plantCondition } from '../world/power';
import { industryOf, INDUSTRY, buildPlan, handOverBuild, siteCondition } from '../gen/industry';
import { profileOf } from '../gen/market';
import { nextRaid, lastRaid, raidSource, raidOutcome } from '../gen/raids';
import { storeOf } from '../world/industry';
import { unlockMine } from '../world/housedoors';
import { shuttleClick } from './shuttle';
import { installClick } from './install';
import { bridgeClick } from './bridge';
import { pierClick } from './pier';
import { stockHas, stockTake, hallNote } from './stock';
import { buildersLine, jobHTML, building } from './jobs';
import { hallClick, openStoresHere, storesWithElder } from './hall';
import { fertility } from '../gen/industry';
import { PLANTS, PLANT_KINDS, PLANT_SLOTS, plantsOf, plantPlan, plantProblem, startPlant, handOverPlant, isStation, specOf, running, type PlantKind } from '../gen/plants';
import { STATIONS, fuelWords, STATION_KINDS, STATION_SLOTS, DRAW, balance, fuelAt, type StationKind } from '../gen/energy';
import { worksClick } from './works';
import { stationClick } from './stations';
import { terminalClick } from './terminal';
import { logbookClick } from './logbook';
import { askLead } from '../world/datacarriers';
import { ordersHTML, ordersClick } from './orders';
import { garageHTML, garageClick } from './garage';
import { foodHTML, foodClick } from './foodshop';
import { shareHTML, shareClick } from './share';
import { farmsHTML, farmsClick, showFarm } from './farms';
import { plantUpHTML, plantUpClick, showPlantUp } from './plantup';
import { improveHTML, improveClick } from './improve';
import { earnTrust } from '../world/standing';
import { CRAFTING_OPEN } from '../data/crafting';
import { pendingTribute, payTribute } from '../world/villageraid';
import { findPoi } from '../gen/regions';
import { fmtTime } from '../core/time';
import { fortifyPlan, handOver, powerKind, powerSite, POWER, POWER_DOWN, POWER_LOW, WORKS, workPlan, handOverWork, worksOf, type WorkKind, type TownState } from '../gen/town';
import { WALL_TIERS, type VillageMap } from '../gen/village';
import { loadedVillage, reloadStruct } from '../world/overworld';
import { gainXp } from '../character';
import { showToast, logLine } from './hud';
import { openMarket, renderMarket, marketClick } from './market';
import { caravanClick } from './caravan';
import { openContracts, renderContracts, contractsClick } from './contracts';
import { itemName } from './icons';
/** Kuba pays a fifth of the price for a part, less for a worn one. */
const partBuyback = (s: Slot) => Math.floor(PART_PRICE[s.k]! * PART_BUYBACK * (s.c ?? 100) / 100);

const dlgEl = $('dlg'), panel = () => dlgEl.querySelector('.panel') as HTMLElement;
/** Elder's lore line; the open world replaces it. */
export let loreText = (): string => LORE + (town() === 'Gridholm' ? LORE_SHUTTLE : '');

export function setLoreText(f: () => string) { loreText = f; }

export function openDialog(n: Npc) {
  if (!G.playing || G.dlgOpen || G.packOpen || G.xferOpen) return;
  G.dlgOpen = true; W.talkNpc = n; G.firing = false; for (const k in G.keys) G.keys[k] = false;
  const info = NPC_INFO[n.role];
  renderTalk(n.role === 'villager' ? (n.name + ' nods. "' + here(VILLAGER_LINES[(Math.random() * VILLAGER_LINES.length) | 0]) + '"') : here(info.hello!));
  dlgEl.style.display = 'flex'; if (document.pointerLockElement) document.exitPointerLock();
}
export function closeDialog() { if (!G.dlgOpen) return; G.dlgOpen = false; W.talkNpc = null; dlgEl.style.display = 'none'; if (!G.isTouch) lockPointer(); }
/** The talking resident's village (texts are written for Gridholm). */
const town = () => W.talkNpc?.town ?? 'Gridholm';
const townId = () => loadedVillage(town())?.id ?? null;
const here = (s: string) => s.replace(/Gridholm/g, town()).replace(/\{name\}/g, G.char.name || 'traveller');
const dlgHead = () => { const n = W.talkNpc!; return `<h2>${n.name}</h2><div class="role">${n.title}</div>`; };
function renderTalk(text: string) {
  const info = NPC_INFO[W.talkNpc!.role];
  panel().classList.remove('wide');
  panel().innerHTML = dlgHead() + `<div class="say">${text}</div>` +
    (townId() !== null ? questOptions(W.talkNpc!.role, townId()!) : []).map((q) => `<button class="opt" data-q="${q.id}" style="color:var(--gold)">${q.label}</button>`).join('') +
    (W.talkNpc!.role === 'elder' && progressive(G.char.towns[townId()!]) ? '<button class="opt" data-o="development">Village development — next tutorial objective</button>' : '') +
    (W.talkNpc!.role === 'elder' && estateHere() ? '<button class="opt" data-o="estate" style="color:var(--gold)">Is there a house free for me?</button>' : '') +
    (W.talkNpc!.role === 'elder' && townId() !== null && storesWithElder(townId()!) ? '<button class="opt" data-o="stores">Leave materials with me (the village stores)</button>' : '') +
    info.opts.filter((o) => (o !== 'house' || houseForSale()) && (o !== 'craft' || CRAFTING_OPEN) && (!progressive(G.char.towns[townId()!]) || W.talkNpc!.role !== 'elder' || ['status', 'lore', 'bye'].includes(o) || (development(G.char.towns[townId()!]) >= 5 && o !== 'work'))).map((o) => `<button class="opt" data-o="${o}">${OPT_TEXT[o]}</button>`).join('');
}
/** The elder sells the empty house (Gridholm's, for now) until it is yours. */
const houseForSale = () => { const v = loadedVillage(town()); return !!v?.vm.home && !G.char.houses.includes(v.id) && !estateHere(); };
/** A house here that a dead character of yours left (online: `Char.estate`, ui/rebirth.ts). */
const estateHere = () => { const id = townId(); return id !== null && !!G.char.estate?.houses.includes(id) && !G.char.houses.includes(id); };
function renderEstate(msg = '') {
  const e = G.char.estate, v = loadedVillage(town());
  if (!v || !e || !estateHere()) { renderTalk(msg || 'Hm?'); return; }
  panel().innerHTML = dlgHead() + `<div class="say">${msg || `There is. The house of ${e.from}, who did not come back. They had no one else here, and you came down in the same ship. Take it, ${here('{name}')}, and keep everything in it.`}</div>` +
    `<button class="opt" data-estate="1" style="color:var(--gold)">Take ${e.from}'s house</button>` +
    `<button class="opt" data-o="back">${OPT_TEXT.back}</button>`;
}
/** The dead one's house becomes yours with all that was in it. */
function takeEstate() {
  const c = G.char, e = c.estate, v = loadedVillage(town());
  if (!v || !e || !estateHere()) { renderTalk('Hm?'); return; }
  c.houses.push(v.id);
  Object.assign(c.containers, e.chests); // (the house chest is Gridholm's, the only house for now)
  e.houses = e.houses.filter((h) => h !== v.id); e.chests = {};
  if (!e.houses.length) delete c.estate;
  saveChar(); unlockMine(v.id); reloadStruct(v.id);
  showToast('The house is yours'); logLine(`You took over ${e.from}'s house in ${town()}.`);
  renderTalk(`Maciej hands you ${e.from}'s iron key. "Their things are where they left them. Sleep well under that roof, ${here('{name}')}."`);
}
function renderHouse(msg = '') {
  const v = loadedVillage(town()), c = G.char;
  if (!v) { renderTalk('Hm?'); return; }
  const owned = c.houses.includes(v.id);
  panel().innerHTML = dlgHead() + `<div class="say">${msg || (owned ? 'The house is yours. Mind the roof in the rains.'
    : `The empty house on our plaza has stood shut since its family went north. A bed, a good chest, a table, a roof that holds. Take it for <b>${HOUSE_PRICE} gold</b> and it is yours, ${here('{name}')}: a place to sleep safe and to keep what you gather. When you fall out there, you will wake in your own bed.`)}<br><br>Your gold: <b>${c.gold}</b></div>` +
    (owned ? '' : `<button class="opt" data-buyhouse="1" style="color:var(--gold)" ${c.gold < HOUSE_PRICE ? 'disabled' : ''}>Buy the house (${HOUSE_PRICE} gold)</button>`) +
    `<button class="opt" data-o="back">${OPT_TEXT.back}</button>`;
}
const PARTS = Object.keys(PART_PRICE) as ItemKey[];
function renderVehicleShop(msg?: string) {
  const salvage = progressive(G.char.towns[townId()!]); // (a new world: vehicles and engine parts only from salvage, built in the workshop)
  panel().innerHTML = dlgHead() + `<div class="say">Your gold: <b>${G.char.gold}</b>${msg ? '<br>' + msg : ''}${salvage ? '<br>I have no new vehicles to sell and no engine parts: nobody makes them any more. Bring me salvage and I build you one in the workshop.' : ''}</div>` +
    (salvage ? [] : Object.keys(VEHICLES) as VehicleModel[]).map((m) => {
      const s = VEHICLES[m];
      return `<div class="shoprow"><div><b>${vehicleTitle(m)}</b><br><span>${s.role} · ${s.seats} seats · trunk ${s.trunk} · ${Math.round(s.maxSpeed * 3.6)} km/h${s.enclosed ? ' · closed cab' : ' · open top'}</span></div>
      <button class="buy" data-v="${m}" ${G.char.gold < s.price ? 'disabled' : ''}>${s.price} g</button></div>`;
    }).join('') +
    PARTS.filter((k) => !salvage || k !== 'engine').map((k) => `<div class="shoprow"><div>${itemName(k)}<br><span>${ITEMS[k].desc}</span></div>
      <button class="buy" data-k="${k}" data-p="${PART_PRICE[k]}" ${G.char.gold < PART_PRICE[k]! ? 'disabled' : ''}>${PART_PRICE[k]} g</button></div>`).join('') +
    `<button class="opt" data-o="back">${OPT_TEXT.back}</button>`;
}
/** Jan and Oskar buy what you bring from the wilds (data/npcs BUYS). */
function renderTrade(msg?: string) {
  const buys = BUYS[W.talkNpc!.role] ?? {}, rows = G.char.inv.map((s, i) => ({ s, i })).filter(({ s }) => s && buys[s.k]);
  panel().innerHTML = dlgHead() + `<div class="say">Your gold: <b>${G.char.gold}</b>${msg ? '<br>' + msg : ''}</div>` +
    (rows.length ? rows.map(({ s, i }) => `<div class="shoprow"><div><b>${ITEMS[s!.k].name} ×${s!.n}</b><br><span>${buys[s!.k]} g each</span></div>
      <button class="buy" data-trade="${i}">+${buys[s!.k]} g</button><button class="buy" data-tradeall="${i}">all +${buys[s!.k]! * s!.n} g</button></div>`).join('')
      : `<div class="say" style="opacity:.7">You have nothing I would buy. I pay for ${Object.keys(buys).map((k) => ITEMS[k as ItemKey].name).join(', ')}.</div>`) +
    `<button class="opt" data-o="back">${OPT_TEXT.back}</button>`;
}
/** Kuba buys vehicles back at half price (less for wrecks) and parts for a fifth of what he charges. */
function renderSell(msg?: string) {
  if (W.talkNpc!.role !== 'dealer') { renderTrade(msg); return; }
  const offers = vehiclesForSale(), parts = [...G.char.hands.map((s, i) => ({ s, i: 'h:' + i })), ...G.char.inv.map((s, i) => ({ s, i: 'p:' + i }))].filter(({ s }) => s && PART_PRICE[s.k]);
  panel().innerHTML = dlgHead() + `<div class="say">Your gold: <b>${G.char.gold}</b>${msg ? '<br>' + msg : ''}</div>` +
    (offers.length ? offers.map((o) => `<div class="shoprow"><div><b>${vehicleTitle(o.v.st.model)}</b><br><span>${o.why ?? 'parked in the yard · condition ' + Math.round(health(o.v.st.model, o.v.st.parts) * 100) + '%'}</span></div>
      <button class="buy" data-sellv="${o.v.st.id}" ${o.why ? 'disabled' : ''}>+${o.price} g</button></div>`).join('')
      : '<div class="say" style="opacity:.7">Park a vehicle in my yard and I will make you an offer.</div>') +
    parts.map(({ s, i }) => `<div class="shoprow"><div><b>${ITEMS[s!.k].name}${s!.n > 1 ? ' ×' + s!.n : ''}</b><br><span>used part${s!.c !== undefined ? ', ' + Math.round(s!.c) + '% worn in' : ''}</span></div>
      <button class="buy" data-sells="${i}">+${partBuyback(s!)} g</button></div>`).join('') +
    `<button class="opt" data-o="back">${OPT_TEXT.back}</button>`;
}
function renderShop(msg?: string) {
  if (W.talkNpc!.role === 'dealer') { renderVehicleShop(msg); return; }
  if (W.talkNpc!.role === 'grocer') { panel().innerHTML = foodHTML(dlgHead(), loadedVillage(town())?.id ?? null, msg); return; }
  const stock = stockFor(W.talkNpc!.role, G.char.world).filter(([k]) => W.talkNpc!.role !== 'blacksmith' || smithAllows(G.char.towns[townId()!], k));
  panel().innerHTML = dlgHead() + `<div class="say">Your gold: <b>${G.char.gold}</b>${msg ? '<br>' + msg : ''}</div>` +
    stock.map(([k, p]) => `<div class="shoprow"><div>${itemName(k)}<br><span>${ITEMS[k].desc}</span></div>
      <button class="buy" data-k="${k}" data-p="${p}" ${G.char.gold < p ? 'disabled' : ''}>${p} g</button></div>`).join('') +
    `<button class="opt" data-o="back">${OPT_TEXT.back}</button>`;
}
const SIDE_NAME = { W: 'west', E: 'east', S: 'south', N: 'north' } as const;
/** Where the village's raiders come from, how the last raid went and when the scouts expect the next. */
function raidNews(id: number): string {
  const c = G.char, poi = findPoi(c.world, id), st = c.towns[id], nr = poi && nextRaid(c.world, poi, c.time), lr = poi && lastRaid(c.world, poi, c.time);
  return !poi || !raidSource(c.world, poi) ? 'No bandit camp is near enough to trouble us, thank the stars.'
    : `Bandits from ${raidSource(c.world, poi)!.name} raid us every few days.` + (lr ? ` The last time ${({ won: 'we beat them off', lost: 'they broke through', paid: 'we paid them off' } as const)[raidOutcome(c.world, lr, st)]}.` : '') + (nr && !st?.raids?.[nr.k] && nr.t0 - c.time < 1440 ? ` Our scouts expect them again about ${fmtTime(nr.t0)}.` : '') + ' A stronger wall holds them better.';
}
/** The captain of the guard's report: the wall, the raiders, the towers. */
function renderWatch(msg = '') {
  const v = loadedVillage(town());
  if (!v) { renderTalk('Hm?'); return; }
  const plan = fortifyPlan(G.char.towns[v.id]), wall = WALL_TIERS[plan ? plan.from : WALL_TIERS.length - 1], pt = pendingTribute(v.id);
  renderTalk((msg ? msg + '<br><br>' : '') + `We sit behind a <b>${wall.name}</b>. ${raidNews(v.id)}${tributeNote(v.id)} When they come, meet them at the gates, or climb a tower: from up there you see them long before they see you.` +
    (plan ? ` The Elder is raising money and materials for a ${WALL_TIERS[plan.to].name.toLowerCase()}; help him and my job gets easier.` : '') +
    (pt ? `<br><br><button class="opt" data-tribute="pay" ${G.char.gold < pt.amount ? 'disabled' : ''} style="color:var(--gold)">Pay the bandits their ${pt.amount} gold</button>` : ''));
}
/** The elder's commissions: raise the fence to the next tier (materials handed over bit by bit), the power plant, the raids, the village's industry (and building its refinery). */
function renderFortify(msg?: string) {
  const v = loadedVillage(town()), c = G.char;
  if (!v) { renderTalk('Hm?'); return; }
  const st = c.towns[v.id], plan = fortifyPlan(st), wall = WALL_TIERS[plan ? plan.from : WALL_TIERS.length - 1];
  const k = powerKind(v.vm.seed), pc = Math.round(plantCondition(v.id, v.vm.seed)), side = SIDE_NAME[powerSite(v.vm.seed).side];
  const power = `Our power comes from the <b>${POWER[k].name}</b> outside the ${side} fence: ${pc < POWER_DOWN ? '<span style="color:var(--red,#ff5a3c)">it is down</span>' : pc < POWER_LOW ? 'it is failing' : 'it runs'} (${pc}%). ` +
    (pc < 90 ? `Mend it with ${POWER[k].fix.map(([i, n]) => `${n} ${ITEMS[i].name}`).join(', ')} and we will pay you.` : 'Keep an eye on it for us.');
  const poi = findPoi(c.world, v.id), raids = raidNews(v.id) + tributeNote(v.id);
  // the village's own goods in the hall
  const so = storeOf(v.id, v.vm.seed), pt = pendingTribute(v.id);
  const store = `Our own goods in the village hall: <b>${Math.floor(so.n)} of ${so.cap}</b> crates` + (so.full ? '. <span style="color:var(--red,#ff5a3c)">That is all it takes of them, so the work has stopped</span>: buy some at the market, or take your share.' : '.');
  // the village's industry, and (refinery towns) the commission to build the refinery
  const ind = poi ? industryOf(c.world, poi, v.vm.seed) : 'farm', spec = INDUSTRY[ind], bp = buildPlan(ind, st), sc = poi ? Math.round(siteCondition(c.world, poi, st, c.time)) : 100;
  const trade = poi ? profileOf(c.world, poi, v.vm.seed).makes.map((g) => ITEMS[g].name).join(' and ') : '';
  const work = bp && progressive(st) ? `This marked site has no functioning ${spec.site.toLowerCase()} yet. Store the materials to build it.` : bp ? `Oil comes up not far from here, and we mean to put up a <b>refinery</b> that turns crude into fuel. Help us build it and the village will pay you <b>${REFINERY_PAY} gold</b>.`
    : `We are a ${spec.name.toLowerCase()}: our ${spec.site.toLowerCase()} ${spec.site.endsWith('s') ? 'give' : 'gives'} us ${trade}` + (sc < 90 ? `, but the raids have damaged ${spec.site.endsWith('s') ? 'them' : 'it'} (${sc}%): mend ${spec.site.endsWith('s') ? 'them' : 'it'} with ${spec.fix.map(([i, n]) => `${n} ${ITEMS[i].name}`).join(', ')} and we will pay you.` : '.');
  const brows = building(st, 'refinery') ? jobHTML(st, 'refinery', undefined, 'the ' + spec.site.toLowerCase()) : bp ? bp.rows.map((r) => `<div class="shoprow"><div>${itemName(r.k)}<br><span>${r.given} / ${r.n} for the ${spec.site.toLowerCase()}${hallNote(hh(r.k), r.given, r.n)}</span></div></div>`).join('') : '';
  const canBuild = !!bp && !building(st, 'refinery') && bp.rows.some((r) => r.given < r.n && hh(r.k) > 0);
  const walling = plan && building(st, 'wall');
  const rows = walling ? jobHTML(st, 'wall', String(plan!.to), 'the ' + WALL_TIERS[plan!.to].name.toLowerCase()) : plan ? plan.rows.map((r) => {
    const have = hh(r.k), left = r.n - r.given;
    return `<div class="shoprow"><div>${itemName(r.k)}<br><span>${r.given} / ${r.n} handed over${left > 0 ? ` · in the village hall: ${have}` : ' · done'}</span></div></div>`;
  }).join('') : '';
  const canGive = !!plan && plan.rows.some((r) => r.given < r.n && hh(r.k) > 0);
  panel().innerHTML = dlgHead() + `<div class="say">${msg ? msg + '<br><br>' : ''}` +
    (plan ? `Our wall is a <b>${wall.name}</b>. Help us raise a <b>${WALL_TIERS[plan.to].name}</b> (${WALL_TIERS[plan.to].h} m) and the village will pay you <b>${plan.gold} gold</b>. We build from what is in the village hall.`
      : `Our wall is a <b>${wall.name}</b>, as strong as we can make it. Thank you.`) + `<br><br>${power}<br><br>${raids}<br><br>${work}<br><br>${store}<br><br>${defenceText(v.id, v.vm, st)}</div>` +
    (pt ? `<button class="opt" data-tribute="pay" ${c.gold < pt.amount ? 'disabled' : ''} style="color:var(--gold)">Pay the bandits their ${pt.amount} gold</button>` : '') + rows +
    (plan && !walling ? `<button class="opt" data-fort="give" ${canGive ? '' : 'disabled'}>Build from the village hall's stock (the wall)</button>` : '') + brows +
    (bp && !building(st, 'refinery') ? `<button class="opt" data-rbuild="give" ${canBuild ? '' : 'disabled'}>Build from the village hall's stock (the ${spec.site.toLowerCase()})</button>` : '') +
    defenceRows(v.vm, st) +
    `<button class="opt" data-o="back">${OPT_TEXT.back}</button>`;
}
// ---------- power and processing works (gen/energy.ts, gen/plants.ts) ----------
const aN = (name: string) => (/^[AEIOU]/.test(name) ? 'an' : 'a');
function powerText(vid: number, vm: VillageMap, st: TownState | undefined): string {
  const c = G.char, poi = findPoi(c.world, vid);
  if (!poi) return '';
  const b = balance(c.world, poi, vm.seed, st, c.time), stations = st?.stations ?? [];
  const works = plantsOf(st).map((p, i) => `the ${PLANTS[p.k].name} ${DRAW[p.k]} kW${!running(p) ? ' (idle)' : b.powered[i] ? ' (powered)' : ' <span style="color:var(--red,#ff5a3c)">(no power)</span>'}`);
  return `<b>Power.</b> We make <b>${Math.round(b.made)} kW</b> now` + (stations.length ? ` (our ${POWER[powerKind(vm.seed)].name.toLowerCase()} and ${stations.map((x) => `the ${STATIONS[x.k].name}${STATIONS[x.k].fuel && fuelAt(x, c.time) <= 0 ? ' (out of ' + ITEMS[STATIONS[x.k].fuel!].name.toLowerCase() + ')' : ''}`).join(' and ')})` : ` from our ${POWER[powerKind(vm.seed)].name.toLowerCase()}`) +
    `; the village itself takes ${villageKw(st)} kW` + (b.farms ? `, the farms ${b.farms} kW` : '') +
    (b.site ? `, our ${INDUSTRY[industryOf(c.world, poi, vm.seed)].site.toLowerCase()} ${b.site} kW${b.sitePowered < 1 ? ` <span style="color:var(--red,#ff5a3c)">(${Math.round(b.sitePowered * 100)}% powered: it makes less)</span>` : ''}` : '') +
    `, which leaves <b>${Math.round(b.free + b.powered.reduce((a, on, i) => a + (on ? DRAW[plantsOf(st)[i].k] : 0), 0))} kW</b> for works.` + (works.length ? ` They draw: ${works.join(', ')}.` : '') +
    ` Every works needs power to run: build power stations first.`;
}
function worksText(st: TownState | undefined): string {
  const built = plantsOf(st), plan = plantPlan(st), free = PLANT_SLOTS - built.length - (plan && !isStation(plan.k) ? 1 : 0), sfree = STATION_SLOTS - (st?.stations?.length ?? 0) - (plan && isStation(plan.k) ? 1 : 0);
  return `<b>Works.</b> Whatever our land gives, any village can process goods, and processed goods fetch the real money. ` +
    (built.length ? `Outside our fence ${built.length > 1 ? 'stand' : 'stands'} ${built.map((p) => `the <b>${PLANTS[p.k].name}</b>`).join(' and ')}: ${built.length > 1 ? 'they are' : 'it is'} yours to run. ` : '') +
    (plan ? `The <b>${specOf(plan.k).name}</b> is going up: bring the materials, and the fee of <b>${plan.fee} gold</b> pays the builders when it is done. `
      : `There is room for ${free} more works and ${sfree} more power station${sfree === 1 ? '' : 's'}: choose what we should build, you bring the materials and pay the builders.`);
}
function worksRows(st: TownState | undefined): string {
  const c = G.char, plan = plantPlan(st);
  if (plan) {
    const name = specOf(plan.k).name;
    if (building(st, 'plant', plan.k)) return jobHTML(st, 'plant', plan.k, 'the ' + name);
    const rows = plan.rows.map((r) => `<div class="shoprow"><div>${itemName(r.k)}<br><span>${r.given} / ${r.n} for the ${name.toLowerCase()}${hallNote(hh(r.k), r.given, r.n)}</span></div></div>`).join('');
    const can = plan.rows.some((r) => r.given < r.n && hh(r.k) > 0) || (plan.done && c.gold >= plan.fee);
    return rows + `<button class="opt" data-pgive="1" ${can ? '' : 'disabled'}>${plan.done ? `Pay the builders ${plan.fee} gold` : `Build from the village hall's stock (${name.toLowerCase()})`}</button>`;
  }
  const btn = (k: PlantKind | StationKind) => { const sp = specOf(k), no = plantProblem(st, k, c.tech); if (no) return `<button class="opt" disabled>${sp.name}, ${isStation(k) ? STATIONS[k].kw + ' kW' : `draws ${DRAW[k]} kW`}: ${no}</button>`; return `<button class="opt" data-pnew="${k}">Build ${aN(sp.name)} ${sp.name}: ${sp.blurb}${isStation(k) ? `, ${STATIONS[k].kw} kW` : `, draws ${DRAW[k]} kW`} (${sp.needs.map(([i, n]) => `${n} ${ITEMS[i].name}`).join(', ')}; ${sp.fee} gold)</button>`; };
  const st1 = STATION_KINDS.filter((k) => !plantProblem(st, k)), pl = PLANT_KINDS.filter((k) => !plantProblem(st, k));
  const plain = pl.filter((k) => !PLANTS[k].tech), plans = pl.filter((k) => PLANTS[k].tech);
  return (st1.length ? `<div class="say" style="margin:8px 0 0">Power stations</div>${st1.map(btn).join('')}` : '') +
    (plain.length ? `<div class="say" style="margin:8px 0 0">Works anyone can build</div>${plain.map(btn).join('')}` : '') +
    (plans.length ? `<div class="say" style="margin:8px 0 0">Works that want the old plans</div>${plans.map(btn).join('')}` : '');
}
/** The elder on power and works: what the land gives, the power balance, what stands, what can be built. */
function renderWorksPanel(msg = '') {
  const v = loadedVillage(town()), c = G.char, poi = v && findPoi(c.world, v.id);
  if (!W.talkNpc) return; // the talk is over (a stale click)
  if (!v || !poi) { renderTalk('Hm?'); return; }
  const st = c.towns[v.id], p = profileOf(c.world, poi, v.vm.seed), fert = fertility(c.world, poi, v.vm.seed);
  const land = `Our land gives us ${p.makes.map((g) => ITEMS[g].name).join(' and ')}` + (fert > 1.15 ? ', and our fields are rich: we grow more than we eat' : fert < 0.85 ? ', though our fields are poor' : '') + '.';
  panel().classList.add('wide');
  panel().innerHTML = dlgHead() + `<div class="say">${msg ? msg + '<br><br>' : ''}${land}<br><br>${powerText(v.id, v.vm, st)}<br><br>${worksText(st)}</div>` + worksRows(st) + `<button class="opt" data-o="back">${OPT_TEXT.back}</button>`;
}
function newWorks(k: PlantKind | StationKind) {
  const v = loadedVillage(town()), c = G.char;
  if (!v) return;
  const why = startPlant((c.towns[v.id] ??= {}), k, c.tech);
  if (why) { renderWorksPanel(why); return; }
  saveChar(); reloadStruct(v.id);
  const sp = specOf(k);
  renderWorksPanel(`We will build ${aN(sp.name)} ${sp.name} on the plot outside the fence. The builders take the materials from the village hall and want ${sp.fee} gold when it stands.`);
}
function giveWorks() {
  const v = loadedVillage(town()), c = G.char;
  if (!v) return;
  const st = (c.towns[v.id] ??= {}), plan = plantPlan(st);
  if (!plan) { renderWorksPanel(); return; }
  const { taken, built, started } = handOverPlant(st, stockHas(v.id), c.time, (fee) => { if (c.gold < fee) return false; c.gold -= fee; return true; }, true);
  stockTake(v.id, taken);
  if (started) {
    gainXp(plan.xp); earnTrust(v.id, 'works'); calcStats(); saveChar();
    renderWorksPanel(`All the materials are in and the builders have their ${plan.fee} gold. They get to work on the ${specOf(plan.k).name} now: ${buildersLine(st, 'plant', plan.k)}`);
    return;
  }
  if (!built) {
    saveChar();
    const after = plantPlan(st)!;
    renderWorksPanel((taken.length ? 'Handed over: ' + taken.map(([i, n]) => `${ITEMS[i].name} ×${n}`).join(', ') + '. ' : '') +
      (after.done ? `All the materials are in. The builders want their ${after.fee} gold${c.gold < after.fee ? ', and you do not have it yet' : ''}.` : taken.length ? '' : 'The village hall has nothing more of what it needs: bring the materials to the village stores.'));
    return;
  }
  gainXp(plan.xp); earnTrust(v.id, 'works'); calcStats(); saveChar();
  closeDialog(); reloadStruct(v.id);
  const name = specOf(built).name;
  showToast(`${v.vm.name}: the ${name} stands`);
  logLine(isStation(built)
    ? `The ${name} at ${v.vm.name} is finished: ${STATIONS[built].kw} kW for the works${STATIONS[built].fuel ? `, as long as you keep its ${built === 'reactor' ? 'core' : 'bunker'} fed with ${fuelWords(built)[2]}` : ''}.`
    : `The ${name} at ${v.vm.name} is finished and yours to run: load its hopper with ${[...new Set(PLANTS[built].recipes.flatMap((r) => r.in.map(([g]) => ITEMS[g].name)))].join(', ')} and collect what it makes. It draws ${DRAW[built]} kW.`);
}
// ---------- defence works: turrets on the wall, barricades round the works and the plant ----------
const WORK_KINDS: WorkKind[] = ['turret', 'siteGuard', 'plantGuard'];
const workLimit = (k: WorkKind, vm: VillageMap) => (k === 'turret' ? vm.mounts.length : WORKS[k].max);
function defenceText(vid: number, vm: VillageMap, st: TownState | undefined): string {
  const c = G.char, poi = findPoi(c.world, vid), site = poi ? INDUSTRY[industryOf(c.world, poi, vm.seed)].site.toLowerCase() : 'works';
  const guns = worksOf(st, 'turret'), sg = worksOf(st, 'siteGuard'), pg = worksOf(st, 'plantGuard');
  const t = !vm.mounts.length ? 'Auto turrets need a wall to stand on: a palisade at least.'
    : guns >= vm.mounts.length ? `All ${guns} turrets are on the wall.`
    : `${guns ? `${guns} auto turret${guns > 1 ? 's' : ''} guard${guns > 1 ? '' : 's'} our wall.` : 'No turrets guard our wall yet.'} Bring a <b>Turret Kit</b> and the parts, and we mount another (room for ${vm.mounts.length}): <b>${WORKS.turret.gold} gold</b> each.`;
  return `<b>Defences.</b> ${t} ${sg ? `Barricades ring the ${site}.` : `Sandbags round the ${site} would keep the bandits from wrecking it (<b>${WORKS.siteGuard.gold} gold</b>).`} ${pg ? 'Barricades ring the power plant.' : `The power plant could use them too (<b>${WORKS.plantGuard.gold} gold</b>).`}`;
}
function defenceRows(vm: VillageMap, st: TownState | undefined): string {
  return WORK_KINDS.map((k) => {
    const plan = workPlan(st, k, workLimit(k, vm));
    if (!plan) return '';
    if (building(st, 'work', k)) return jobHTML(st, 'work', k, WORKS[k].name.toLowerCase());
    const rows = plan.rows.map((r) => `<div class="shoprow"><div>${itemName(r.k)}<br><span>${r.given} / ${r.n} for the ${WORKS[k].name.toLowerCase()}${hallNote(hh(r.k), r.given, r.n)}</span></div></div>`).join('');
    const can = plan.rows.some((r) => r.given < r.n && hh(r.k) > 0);
    return rows + `<button class="opt" data-work="${k}" ${can ? '' : 'disabled'}>Build from the village hall's stock (${WORKS[k].name.toLowerCase()})</button>`;
  }).join('');
}
function giveWork(k: WorkKind) {
  const v = loadedVillage(town()), c = G.char;
  if (!v) return;
  const st = (c.towns[v.id] ??= {}), plan = workPlan(st, k, workLimit(k, v.vm));
  if (!plan) { renderFortify(); return; }
  const { taken, done, started } = handOverWork(st, k, stockHas(v.id), workLimit(k, v.vm), c.time);
  stockTake(v.id, taken);
  if (started) {
    c.gold += plan.gold; earnTrust(v.id, 'work'); gainXp(plan.xp); calcStats(); saveChar();
    renderFortify(`All the materials are in. The villagers get to work on the ${WORKS[k].name.toLowerCase()}: ${buildersLine(st, 'work', k)} They pay you ${plan.gold} gold.`);
    return;
  }
  if (!done) { saveChar(); renderFortify(taken.length ? 'Handed over: ' + taken.map(([i, n]) => `${ITEMS[i].name} ×${n}`).join(', ') + '.' : 'The village hall has nothing more of what that work needs: bring the materials to the village stores.'); return; }
  c.gold += plan.gold; earnTrust(v.id, 'work'); gainXp(plan.xp); calcStats(); saveChar();
  closeDialog(); reloadStruct(v.id);
  showToast(k === 'turret' ? `${v.vm.name}: a turret on the wall` : `${v.vm.name}: ${WORKS[k].name.toLowerCase()}`);
  logLine(k === 'turret' ? `The villagers haul the turret up and bolt it to the wall. It sweeps the ground outside. They pay you ${plan.gold} gold.`
    : `The villagers fill the sandbags and stack them round: ${WORKS[k].name.toLowerCase()} stand. They pay you ${plan.gold} gold.`);
}
const REFINERY_PAY = 1200;
/** How many of k the village you talk to has in its hall's stock. */
const hh = (k: ItemKey) => { const v = loadedVillage(town()); return v ? stockHas(v.id)(k) : 0; };
/** The bandits' current demand, as the elder or the guard tells it. */
function tributeNote(vid: number): string {
  const p = pendingTribute(vid);
  return p ? ` <b>Their rider is here: ${p.camp} wants ${p.amount} gold by ${fmtTime(p.r.t0)}, or they attack.</b> Pay them, or help us fight.` : '';
}
function giveRefinery() {
  const v = loadedVillage(town()), c = G.char, poi = v && findPoi(c.world, v.id);
  if (!v || !poi) return;
  const st = (c.towns[v.id] ??= {}), k = industryOf(c.world, poi, v.vm.seed);
  settleOwn(c.world, poi, v.vm.seed, st, c.time);
  const { taken, built, started } = handOverBuild(k, st, stockHas(v.id), c.time);
  stockTake(v.id, taken);
  if (started) {
    c.gold += REFINERY_PAY; earnTrust(v.id, 'refinery'); gainXp(300); calcStats(); saveChar();
    renderFortify(`All the materials are in. The builders start on the ${INDUSTRY[k].site.toLowerCase()}: ${buildersLine(st, 'refinery')} The village pays you ${REFINERY_PAY} gold.`);
    return;
  }
  if (!built) { saveChar(); renderFortify(taken.length ? 'Handed over: ' + taken.map(([i, n]) => `${ITEMS[i].name} ×${n}`).join(', ') + '.' : 'The village hall has no more of the required materials: bring them to the village stores.'); return; }
  anchorNew(c.world, poi, v.vm.seed, st, c.time);
  c.gold += REFINERY_PAY; earnTrust(v.id, 'refinery'); gainXp(300); calcStats(); saveChar();
  closeDialog(); reloadStruct(v.id);
  showToast(`${v.vm.name} has a ${INDUSTRY[k].site.toLowerCase()}`);
  logLine(`${v.vm.name}'s ${INDUSTRY[k].site.toLowerCase()} is built. They pay you ${REFINERY_PAY} gold.`);
}
function giveFortify() {
  const v = loadedVillage(town()), c = G.char;
  if (!v) return;
  const st = (c.towns[v.id] ??= {}), plan = fortifyPlan(st)!;
  const { taken, raised, started } = handOver(st, stockHas(v.id), c.time);
  stockTake(v.id, taken);
  if (started) {
    c.gold += plan.gold; earnTrust(v.id, 'wall'); gainXp(plan.xp); calcStats(); saveChar();
    renderFortify(`All the materials are in. The villagers start raising the ${WALL_TIERS[plan.to].name.toLowerCase()}: ${buildersLine(st, 'wall', String(plan.to))} They pay you ${plan.gold} gold.`);
    return;
  }
  if (!raised) { saveChar(); renderFortify(taken.length ? 'Handed over: ' + taken.map(([k, n]) => `${ITEMS[k].name} ×${n}`).join(', ') + '.' : 'The village hall has nothing more of what the wall needs: bring the materials to the village stores.'); return; }
  c.gold += plan.gold; earnTrust(v.id, 'wall'); gainXp(plan.xp); calcStats(); saveChar();
  closeDialog();
  reloadStruct(v.id);
  showToast(`${v.vm.name} raises a ${WALL_TIERS[plan.to].name}`);
  logLine(`The villagers work through the night and the new wall stands. They pay you ${plan.gold} gold.`);
}
let economicPending = false, economicDispatch = false;
dlgEl.addEventListener('click', async (e) => {
  const target = e.target as HTMLElement;
  const mutation = target.closest('[data-devkit], [data-devsupplies], [data-devbuild], [data-devgps], [data-hin], [data-hout], [data-hall], [data-hvehicle], [data-farm], [data-crop], [data-make], [data-fort], [data-rbuild], [data-work], [data-pnew], [data-pgive], [data-plantup], [data-imp], [data-share], [data-rare], [data-food], .buy');
  if (online() && mutation && !economicDispatch) {
    if (economicPending) return;
    const dev = target.closest<HTMLElement>('[data-devkit], [data-devsupplies], [data-devbuild], [data-devgps]');
    const warehouse = target.closest<HTMLElement>('[data-stock-town]');
    const id = dev ? +(dev.dataset.devvid ?? dev.dataset.devkit ?? dev.dataset.devsupplies ?? dev.dataset.devgps!) : warehouse ? +warehouse.dataset.stockTown! : townId();
    if (id !== null && Number.isFinite(id)) {
      economicPending = true;
      try { await withTownStock(id, () => {
        if (!target.isConnected || !G.dlgOpen) return;
        economicDispatch = true;
        try { target.click(); } finally { economicDispatch = false; }
      }); } finally { economicPending = false; }
      return;
    }
  }

  if (settlementConsoleClick(e.target as HTMLElement)) return;
  const dm = developmentClick(e.target as HTMLElement, townId());
  if (dm !== null) { panel().innerHTML = developmentHTML(townId()!, dlgHead(), dm); return; }
  if (craftClick(e.target as HTMLElement) || buildClick(e.target as HTMLElement)) return;
  if (gateConsoleClick(e.target as HTMLElement) || caravanClick(e.target as HTMLElement) || shuttleClick(e.target as HTMLElement) || installClick(e.target as HTMLElement) || bridgeClick(e.target as HTMLElement) || pierClick(e.target as HTMLElement) || hallClick(e.target as HTMLElement) || worksClick(e.target as HTMLElement) || stationClick(e.target as HTMLElement) || terminalClick(e.target as HTMLElement) || logbookClick(e.target as HTMLElement)) return;
  const pm = plantUpClick(town(), e.target as HTMLElement);
  if (pm !== null) { if (pm.built) { const tn = town(); closeDialog(); showPlantUp(tn); } else panel().innerHTML = plantUpHTML(town(), dlgHead(), pm.msg); return; }
  const im = improveClick(town(), e.target as HTMLElement);
  if (im !== null) { if (im.built) { const tn = town(); closeDialog(); showPlantUp(tn); } else panel().innerHTML = improveHTML(town(), dlgHead(), im.msg); return; }
  const fm = farmsClick(town(), e.target as HTMLElement);
  if (fm !== null) { if (fm.built) { const tn = town(); closeDialog(); showFarm(tn); } else panel().innerHTML = farmsHTML(town(), dlgHead(), fm.msg); return; }
  const sm = shareClick(town(), e.target as HTMLElement);
  if (sm !== null) { panel().innerHTML = shareHTML(town(), dlgHead(), sm); return; }
  const fdm = foodClick(e.target as HTMLElement, loadedVillage(town())?.id ?? null);
  if (fdm !== null) { renderShop(fdm); return; }
  const gm = garageClick(e.target as HTMLElement, loadedVillage(town())?.id ?? null);
  if (gm !== null) { panel().innerHTML = garageHTML(dlgHead(), loadedVillage(town())?.id ?? null, gm); return; }
  const om = ordersClick(e.target as HTMLElement, loadedVillage(town())?.id ?? null);
  if (om !== null) { panel().innerHTML = ordersHTML(dlgHead(), loadedVillage(town())?.id ?? null, om); return; }
  const cm = contractsClick(e.target as HTMLElement);
  if (cm !== null) { renderContracts(panel(), dlgHead(), cm); return; }
  const mm = marketClick(e.target as HTMLElement);
  if (mm !== null) { renderMarket(panel(), dlgHead(), mm); return; }
  const t = e.target as HTMLElement, o = t.closest<HTMLElement>('[data-o]'), b = t.closest<HTMLElement>('.buy'), c = G.char;
  if (b && b.dataset.v) { renderVehicleShop(buyVehicle(b.dataset.v as VehicleModel)); return; }
  if (b && b.dataset.sellv) { renderSell(sellVehicle(b.dataset.sellv)); return; }
  if (b && b.dataset.sells) {
    const [w, i] = b.dataset.sells.split(':'), L = listOf(w), s = L[+i];
    if (s && PART_PRICE[s.k]) { c.gold += partBuyback(s); if (--s.n <= 0) L[+i] = null; handsChanged(); saveChar(); renderSell('Sold: ' + ITEMS[s.k].name + '.'); }
    return;
  }
  if (b && (b.dataset.trade || b.dataset.tradeall)) {
    const i = +(b.dataset.trade ?? b.dataset.tradeall!), s = c.inv[i], price = s && BUYS[W.talkNpc!.role]?.[s.k];
    if (s && price) {
      const n = b.dataset.tradeall ? s.n : 1;
      c.gold += price * n; s.n -= n; if (s.n <= 0) c.inv[i] = null; saveChar();
      renderTrade(`Sold: ${ITEMS[s.k].name}${n > 1 ? ' ×' + n : ''}.`);
    }
    return;
  }
  if (b) {
    const k = b.dataset.k as keyof typeof ITEMS, p = +b.dataset.p!;
    if (W.talkNpc!.role === 'blacksmith' && !smithAllows(c.towns[townId()!], k)) return renderShop('The forge needs more village development.');
    if (c.gold < p) return renderShop('Not enough gold.');
    if (!addItem(k)) return renderShop(HANDS_ONLY.has(k) ? 'You carry that in your hands, and they are full: put what you hold away first.' : 'No room in your backpack (slots or bulk).');
    c.gold -= p; calcStats(); saveChar(); return renderShop('Bought: ' + ITEMS[k].name + '.');
  }
  if (t.closest('[data-fort]')) { giveFortify(); return; }
  if (t.closest('[data-rbuild]')) { giveRefinery(); return; }
  { const w = t.closest<HTMLElement>('[data-work]'); if (w) { giveWork(w.dataset.work as WorkKind); return; } }
  { const w = t.closest<HTMLElement>('[data-pnew]'); if (w) { newWorks(w.dataset.pnew as PlantKind | StationKind); return; } }
  if (t.closest('[data-pgive]')) { giveWorks(); return; }
  if (t.closest('[data-tribute]')) { const v = loadedVillage(town()); const m = v ? payTribute(v.id) : ''; if (W.talkNpc?.role === 'guard') renderWatch(m); else renderFortify(m); return; }
  if (t.closest('[data-estate]')) { takeEstate(); return; }
  if (t.closest('[data-buyhouse]')) {
    const v = loadedVillage(town());
    if (!v || c.houses.includes(v.id)) { renderHouse(); return; }
    if (c.gold < HOUSE_PRICE) { renderHouse('That is not enough gold, I am afraid.'); return; }
    c.gold -= HOUSE_PRICE; c.houses.push(v.id); saveChar(); unlockMine(v.id); reloadStruct(v.id);
    showToast('The house is yours'); logLine(`You bought the house in ${town()} for ${HOUSE_PRICE} gold.`);
    renderHouse(`Maciej presses an iron key into your hand. "It is yours now, ${here('{name}')}. Sleep well under your own roof."`);
    return;
  }
  const qb = t.closest<HTMLElement>('[data-q]');
  if (qb) { const id = townId(); renderTalk((id !== null && questTalk(qb.dataset.q!, id)) || 'Hm?'); return; }
  if (!o) return;
  const r = W.talkNpc!.role;
  switch (o.dataset.o as OptId | 'back' | 'development' | 'stores' | 'estate') {
    case 'development': { const id = townId(); if (id !== null) panel().innerHTML = developmentHTML(id, dlgHead()); break; }
    case 'stores': { const id = townId(); if (id !== null && storesWithElder(id)) openStoresHere(id, dlgHead(), () => renderTalk('Anything else?')); break; }
    case 'bye': closeDialog(); break;
    case 'back': renderTalk('Anything else?'); break;
    case 'shop': renderShop(); break;
    case 'sell': renderSell(); break;
    case 'craft': showForge(); break;
    case 'cook': {
      let n = 0; for (const s of c.inv) if (s?.k === 'meatR') n += s.n;
      if (!n) { renderTalk('Raw meat, friend. Bring me some from a Bramble and I will roast it.'); break; }
      n = Math.min(n, Math.floor(c.gold / COOK_PRICE));
      if (!n) { renderTalk(`${COOK_PRICE} gold a piece, and you have not got it.`); break; }
      let left = n;
      for (let i = 0; i < c.inv.length && left; i++) { const s = c.inv[i]; if (s?.k === 'meatR') { const m = Math.min(left, s.n); s.n -= m; left -= m; if (s.n <= 0) c.inv[i] = null; } }
      const lost = putItems(c.inv, 'meatC', n); // the raw pieces made room, so this fits
      c.gold -= COOK_PRICE * (n - lost); if (lost) putItems(c.inv, 'meatR', lost);
      saveChar(); renderTalk(`Jan takes your meat to the kitchen and comes back with it sizzling. (Roasted Meat ×${n - lost}, -${COOK_PRICE * (n - lost)} gold)`);
      break;
    }
    case 'rest':
      if (G.hp >= G.S.maxHp && c.kcal >= 2100 && c.water >= 70) renderTalk('You look well rested already. Save your coin.');
      else if (c.gold < 10) renderTalk('Ten gold for a bed, love. Come back when you have it.');
      else { c.gold -= 10; G.hp = G.S.maxHp; c.kcal = Math.max(c.kcal, 2100); c.stomach = Math.max(c.stomach, 1); c.water = Math.max(c.water, 70); saveChar(); renderTalk('A bowl of soup, a jug of water, and you sleep like a stone. (HP restored, fed and watered)'); }
      break;
    case 'watch': renderWatch(); break;
    case 'rumour': renderTalk(RUMOURS[(Math.random() * RUMOURS.length) | 0]); break;
    case 'plantup': panel().classList.remove('wide'); panel().innerHTML = plantUpHTML(town(), dlgHead()); break;
    case 'improve': panel().classList.add('wide'); panel().innerHTML = improveHTML(town(), dlgHead()); break;
    case 'farms': panel().classList.remove('wide'); panel().innerHTML = farmsHTML(town(), dlgHead()); break;
    case 'status': { const id = townId(); panel().classList.remove('wide'); if (id !== null) panel().innerHTML = statusHTML(id, dlgHead()); break; }
    case 'share': panel().classList.remove('wide'); panel().innerHTML = shareHTML(town(), dlgHead()); break;
    case 'garage': panel().classList.remove('wide'); panel().innerHTML = garageHTML(dlgHead(), loadedVillage(town())?.id ?? null); break;
    case 'make': panel().classList.remove('wide'); panel().innerHTML = ordersHTML(dlgHead(), loadedVillage(town())?.id ?? null); break;
    case 'oldtech': { const id = townId(), p = id !== null ? findPoi(c.world, id) : null; renderTalk(p ? askLead(p.x, p.z) : 'Hm?'); break; }
    case 'chat': renderTalk(here(VILLAGER_LINES[(Math.random() * VILLAGER_LINES.length) | 0])); break;
    case 'lore': renderTalk(here(loreText())); break;
    case 'fortify': renderFortify(); break;
    case 'house': renderHouse(); break;
    case 'estate': renderEstate(); break;
    case 'works': renderWorksPanel(); break;
    case 'contracts': openContracts(town()); renderContracts(panel(), dlgHead()); break;
    case 'trade': if (openMarket(town())) renderMarket(panel(), dlgHead()); else renderTalk('Hm?'); break;
    case 'work':
      renderTalk(r === 'elder' ? 'Read the notice board on the plaza. Folk post their troubles there, and when my name is on a notice, come and see me.'
        : 'Have a look at the notice board on the plaza. If I need something, you will find it there.');
      break;
  }
});
