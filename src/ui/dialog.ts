// Conversations and shops. New options (quests) plug in through OPT_TEXT and the switch below.
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
import { storePlan, handOverStore, STORE } from '../gen/store';
import { storeOf } from '../world/industry';
import { unlockMine } from '../world/housedoors';
import { shuttleClick } from './shuttle';
import { fertility } from '../gen/industry';
import { PLANTS, PLANT_KINDS, PLANT_SLOTS, plantsOf, plantPlan, plantProblem, startPlant, handOverPlant, isStation, specOf, running, type PlantKind } from '../gen/plants';
import { STATIONS, STATION_KINDS, STATION_SLOTS, DRAW, VILLAGE_KW, balance, fuelAt, type StationKind } from '../gen/energy';
import { worksClick } from './works';
import { stationClick } from './stations';
import { shipmentOffer } from '../gen/contracts';
import { pendingTribute, payTribute } from '../world/villageraid';
import { findPoi } from '../gen/regions';
import { fmtTime } from '../core/time';
import { fortifyPlan, handOver, powerKind, powerSite, POWER, POWER_DOWN, POWER_LOW, WORKS, workPlan, handOverWork, worksOf, type WorkKind, type TownState } from '../gen/town';
import { WALL_TIERS, type VillageMap } from '../gen/village';
import { count } from '../data/crafting';
import { loadedVillage, reloadStruct } from '../world/overworld';
import { gainXp } from '../character';
import { showToast, logLine } from './hud';
import { openMarket, renderMarket, marketClick } from './market';
import { caravanClick } from './caravan';
import { openContracts, renderContracts, contractsClick } from './contracts';
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
    info.opts.filter((o) => o !== 'house' || houseForSale()).map((o) => `<button class="opt" data-o="${o}">${OPT_TEXT[o]}</button>`).join('');
}
/** The elder sells the empty house (Gridholm's, for now) until it is yours. */
const houseForSale = () => { const v = loadedVillage(town()); return !!v?.vm.home && !G.char.houses.includes(v.id); };
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
  panel().innerHTML = dlgHead() + `<div class="say">Your gold: <b>${G.char.gold}</b>${msg ? '<br>' + msg : ''}</div>` +
    (Object.keys(VEHICLES) as VehicleModel[]).map((m) => {
      const s = VEHICLES[m];
      return `<div class="shoprow"><div><b>${vehicleTitle(m)}</b><br><span>${s.role} · ${s.seats} seats · trunk ${s.trunk} · ${Math.round(s.maxSpeed * 3.6)} km/h${s.enclosed ? ' · closed cab' : ' · open top'}</span></div>
      <button class="buy" data-v="${m}" ${G.char.gold < s.price ? 'disabled' : ''}>${s.price} g</button></div>`;
    }).join('') +
    PARTS.map((k) => `<div class="shoprow"><div><b>${ITEMS[k].name}</b><br><span>${ITEMS[k].desc}</span></div>
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
  const stock = stockFor(W.talkNpc!.role, G.char.world);
  panel().innerHTML = dlgHead() + `<div class="say">Your gold: <b>${G.char.gold}</b>${msg ? '<br>' + msg : ''}</div>` +
    stock.map(([k, p]) => `<div class="shoprow"><div><b>${ITEMS[k].name}</b><br><span>${ITEMS[k].desc}</span></div>
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
  // the storehouse: how full, and the commission for a bigger one
  const so = storeOf(v.id, v.vm.seed), sp = storePlan(st), ship = poi && so.full ? shipmentOffer(c.world, poi, v.vm.seed, st, c.time) : null;
  const store = `Our ${so.name.toLowerCase()} by the ${poi ? INDUSTRY[industryOf(c.world, poi, v.vm.seed)].site.toLowerCase() : 'works'} holds <b>${Math.floor(so.n)} of ${so.cap}</b> crates` +
    (so.full ? '. <span style="color:var(--red,#ff5a3c)">It is full, so the work has stopped.</span>' + (ship ? ` The load waits for a carrier: take the <b>shipment</b> to ${ship.toName} (the notice board or the store's contracts), or buy our goods cheap at the market and sell them where you like. Otherwise our own convoy takes it away at ${fmtTime(ship.convoyAt)}.` : ' Our own convoy will take it away soon.') : '.') +
    (sp ? ` Build us a <b>${STORE.tiers[sp.to].name.toLowerCase()}</b> (${STORE.tiers[sp.to].cap} crates) and we can gather more to trade: the village will pay you <b>${sp.gold} gold</b>.` : '');
  const srows = sp ? sp.rows.map((r) => `<div class="shoprow"><div><b>${ITEMS[r.k].name}</b><br><span>${r.given} / ${r.n} for the ${STORE.tiers[sp.to].name.toLowerCase()}${r.given < r.n ? ` · you carry ${count(c.inv, r.k)}` : ' · done'}</span></div></div>`).join('') : '';
  const canStore = !!sp && sp.rows.some((r) => r.given < r.n && count(c.inv, r.k) > 0), pt = pendingTribute(v.id);
  // the village's industry, and (refinery towns) the commission to build the refinery
  const ind = poi ? industryOf(c.world, poi, v.vm.seed) : 'farm', spec = INDUSTRY[ind], bp = buildPlan(ind, st), sc = poi ? Math.round(siteCondition(c.world, poi, st, c.time)) : 100;
  const trade = poi ? profileOf(c.world, poi, v.vm.seed).makes.map((g) => ITEMS[g].name).join(' and ') : '';
  const work = bp ? `Oil comes up not far from here, and we mean to put up a <b>refinery</b> that turns crude into fuel. Help us build it and the village will pay you <b>${REFINERY_PAY} gold</b>.`
    : `We are a ${spec.name.toLowerCase()}: our ${spec.site.toLowerCase()} ${spec.site.endsWith('s') ? 'give' : 'gives'} us ${trade}` + (sc < 90 ? `, but the raids have damaged ${spec.site.endsWith('s') ? 'them' : 'it'} (${sc}%): mend ${spec.site.endsWith('s') ? 'them' : 'it'} with ${spec.fix.map(([i, n]) => `${n} ${ITEMS[i].name}`).join(', ')} and we will pay you.` : '.');
  const brows = bp ? bp.rows.map((r) => `<div class="shoprow"><div><b>${ITEMS[r.k].name}</b><br><span>${r.given} / ${r.n} for the refinery${r.given < r.n ? ` · you carry ${count(c.inv, r.k)}` : ' · done'}</span></div></div>`).join('') : '';
  const canBuild = !!bp && bp.rows.some((r) => r.given < r.n && count(c.inv, r.k) > 0);
  const rows = plan ? plan.rows.map((r) => {
    const have = count(c.inv, r.k), left = r.n - r.given;
    return `<div class="shoprow"><div><b>${ITEMS[r.k].name}</b><br><span>${r.given} / ${r.n} handed over${left > 0 ? ` · you carry ${have}` : ' · done'}</span></div></div>`;
  }).join('') : '';
  const canGive = !!plan && plan.rows.some((r) => r.given < r.n && count(c.inv, r.k) > 0);
  panel().innerHTML = dlgHead() + `<div class="say">${msg ? msg + '<br><br>' : ''}` +
    (plan ? `Our wall is a <b>${wall.name}</b>. Help us raise a <b>${WALL_TIERS[plan.to].name}</b> (${WALL_TIERS[plan.to].h} m) and the village will pay you <b>${plan.gold} gold</b>. Bring the materials a load at a time: we keep count.`
      : `Our wall is a <b>${wall.name}</b>, as strong as we can make it. Thank you.`) + `<br><br>${power}<br><br>${raids}<br><br>${work}<br><br>${store}<br><br>${defenceText(v.id, v.vm, st)}</div>` +
    (pt ? `<button class="opt" data-tribute="pay" ${c.gold < pt.amount ? 'disabled' : ''} style="color:var(--gold)">Pay the bandits their ${pt.amount} gold</button>` : '') + rows +
    (plan ? `<button class="opt" data-fort="give" ${canGive ? '' : 'disabled'}>Hand over what I carry (for the wall)</button>` : '') + brows +
    (bp ? `<button class="opt" data-rbuild="give" ${canBuild ? '' : 'disabled'}>Hand over what I carry (for the refinery)</button>` : '') + srows +
    (sp ? `<button class="opt" data-sbuild="give" ${canStore ? '' : 'disabled'}>Hand over what I carry (for the ${STORE.tiers[sp.to].name.toLowerCase()})</button>` : '') +
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
    `; the village itself takes ${VILLAGE_KW} kW, which leaves <b>${Math.round(Math.max(0, b.made - VILLAGE_KW))} kW</b> for works.` + (works.length ? ` They draw: ${works.join(', ')}.` : '') +
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
    const rows = plan.rows.map((r) => `<div class="shoprow"><div><b>${ITEMS[r.k].name}</b><br><span>${r.given} / ${r.n} for the ${name.toLowerCase()}${r.given < r.n ? ` · you carry ${count(c.inv, r.k)}` : ' · done'}</span></div></div>`).join('');
    const can = plan.rows.some((r) => r.given < r.n && count(c.inv, r.k) > 0) || (plan.done && c.gold >= plan.fee);
    return rows + `<button class="opt" data-pgive="1" ${can ? '' : 'disabled'}>${plan.done ? `Pay the builders ${plan.fee} gold` : `Hand over what I carry (${name.toLowerCase()})`}</button>`;
  }
  const btn = (k: PlantKind | StationKind) => { const sp = specOf(k); return `<button class="opt" data-pnew="${k}">Build ${aN(sp.name)} ${sp.name}: ${sp.blurb}${isStation(k) ? `, ${STATIONS[k].kw} kW` : `, draws ${DRAW[k]} kW`} (${sp.needs.map(([i, n]) => `${n} ${ITEMS[i].name}`).join(', ')}; ${sp.fee} gold)</button>`; };
  const st1 = STATION_KINDS.filter((k) => !plantProblem(st, k)), pl = PLANT_KINDS.filter((k) => !plantProblem(st, k));
  return (st1.length ? `<div class="say" style="margin:8px 0 0">Power stations</div>${st1.map(btn).join('')}` : '') + (pl.length ? `<div class="say" style="margin:8px 0 0">Works</div>${pl.map(btn).join('')}` : '');
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
  const why = startPlant((c.towns[v.id] ??= {}), k);
  if (why) { renderWorksPanel(why); return; }
  saveChar(); reloadStruct(v.id);
  const sp = specOf(k);
  renderWorksPanel(`We will build ${aN(sp.name)} ${sp.name} on the plot outside the fence. Bring the materials a load at a time; the builders want ${sp.fee} gold when it stands.`);
}
function giveWorks() {
  const v = loadedVillage(town()), c = G.char;
  if (!v) return;
  const st = (c.towns[v.id] ??= {}), plan = plantPlan(st);
  if (!plan) { renderWorksPanel(); return; }
  const { taken, built } = handOverPlant(st, (i) => count(c.inv, i), c.time, (fee) => { if (c.gold < fee) return false; c.gold -= fee; return true; });
  for (const [i, n] of taken) { let left = n; for (let j = 0; j < c.inv.length && left; j++) { const s = c.inv[j]; if (s?.k === i) { const m = Math.min(left, s.n); s.n -= m; left -= m; if (s.n <= 0) c.inv[j] = null; } } }
  if (!built) {
    saveChar();
    const after = plantPlan(st)!;
    renderWorksPanel((taken.length ? 'Handed over: ' + taken.map(([i, n]) => `${ITEMS[i].name} ×${n}`).join(', ') + '. ' : '') +
      (after.done ? `All the materials are in. The builders want their ${after.fee} gold${c.gold < after.fee ? ', and you do not have it yet' : ''}.` : taken.length ? '' : 'You carry nothing it still needs.'));
    return;
  }
  gainXp(plan.xp); calcStats(); saveChar();
  closeDialog(); reloadStruct(v.id);
  const name = specOf(built).name;
  showToast(`${v.vm.name}: the ${name} stands`);
  logLine(isStation(built)
    ? `The ${name} at ${v.vm.name} is finished: ${STATIONS[built].kw} kW for the works${STATIONS[built].fuel ? `, as long as you keep its bunker full of ${STATIONS[built].fuel === 'coal' ? 'coal' : 'fuel'}` : ''}.`
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
  const c = G.char;
  return WORK_KINDS.map((k) => {
    const plan = workPlan(st, k, workLimit(k, vm));
    if (!plan) return '';
    const rows = plan.rows.map((r) => `<div class="shoprow"><div><b>${ITEMS[r.k].name}</b><br><span>${r.given} / ${r.n} for the ${WORKS[k].name.toLowerCase()}${r.given < r.n ? ` · you carry ${count(c.inv, r.k)}` : ' · done'}</span></div></div>`).join('');
    const can = plan.rows.some((r) => r.given < r.n && count(c.inv, r.k) > 0);
    return rows + `<button class="opt" data-work="${k}" ${can ? '' : 'disabled'}>Hand over what I carry (${WORKS[k].name.toLowerCase()})</button>`;
  }).join('');
}
function giveWork(k: WorkKind) {
  const v = loadedVillage(town()), c = G.char;
  if (!v) return;
  const st = (c.towns[v.id] ??= {}), plan = workPlan(st, k, workLimit(k, v.vm));
  if (!plan) { renderFortify(); return; }
  const { taken, done } = handOverWork(st, k, (i) => count(c.inv, i), workLimit(k, v.vm));
  for (const [i, n] of taken) { let left = n; for (let j = 0; j < c.inv.length && left; j++) { const s = c.inv[j]; if (s?.k === i) { const m = Math.min(left, s.n); s.n -= m; left -= m; if (s.n <= 0) c.inv[j] = null; } } }
  if (!done) { saveChar(); renderFortify(taken.length ? 'Handed over: ' + taken.map(([i, n]) => `${ITEMS[i].name} ×${n}`).join(', ') + '.' : 'You carry nothing that work still needs.'); return; }
  c.gold += plan.gold; gainXp(plan.xp); calcStats(); saveChar();
  closeDialog(); reloadStruct(v.id);
  showToast(k === 'turret' ? `${v.vm.name}: a turret on the wall` : `${v.vm.name}: ${WORKS[k].name.toLowerCase()}`);
  logLine(k === 'turret' ? `The villagers haul the turret up and bolt it to the wall. It sweeps the ground outside. They pay you ${plan.gold} gold.`
    : `The villagers fill the sandbags and stack them round: ${WORKS[k].name.toLowerCase()} stand. They pay you ${plan.gold} gold.`);
}
const REFINERY_PAY = 1200;
/** The bandits' current demand, as the elder or the guard tells it. */
function tributeNote(vid: number): string {
  const p = pendingTribute(vid);
  return p ? ` <b>Their rider is here: ${p.camp} wants ${p.amount} gold by ${fmtTime(p.r.t0)}, or they attack.</b> Pay them, or help us fight.` : '';
}
function giveStore() {
  const v = loadedVillage(town()), c = G.char;
  if (!v) return;
  const st = (c.towns[v.id] ??= {}), so = storeOf(v.id, v.vm.seed), plan = storePlan(st)!;
  const { taken, built } = handOverStore(st, v.vm.seed, c.time, so.prod, (i) => count(c.inv, i));
  for (const [i, n] of taken) { let left = n; for (let j = 0; j < c.inv.length && left; j++) { const s = c.inv[j]; if (s?.k === i) { const m = Math.min(left, s.n); s.n -= m; left -= m; if (s.n <= 0) c.inv[j] = null; } } }
  if (!built) { saveChar(); renderFortify(taken.length ? 'Handed over: ' + taken.map(([i, n]) => `${ITEMS[i].name} ×${n}`).join(', ') + '.' : 'You carry nothing the storehouse still needs.'); return; }
  c.gold += plan.gold; gainXp(plan.xp); calcStats(); saveChar();
  closeDialog(); reloadStruct(v.id);
  showToast(`${v.vm.name}: a new ${STORE.tiers[plan.to].name.toLowerCase()}`);
  logLine(`${v.vm.name}'s new ${STORE.tiers[plan.to].name.toLowerCase()} holds ${STORE.tiers[plan.to].cap} crates. The village pays you ${plan.gold} gold.`);
}
function giveRefinery() {
  const v = loadedVillage(town()), c = G.char, poi = v && findPoi(c.world, v.id);
  if (!v || !poi) return;
  const st = (c.towns[v.id] ??= {}), k = industryOf(c.world, poi, v.vm.seed);
  const { taken, built } = handOverBuild(k, st, (i) => count(c.inv, i));
  for (const [i, n] of taken) { let left = n; for (let j = 0; j < c.inv.length && left; j++) { const s = c.inv[j]; if (s?.k === i) { const m = Math.min(left, s.n); s.n -= m; left -= m; if (s.n <= 0) c.inv[j] = null; } } }
  if (!built) { saveChar(); renderFortify(taken.length ? 'Handed over: ' + taken.map(([i, n]) => `${ITEMS[i].name} ×${n}`).join(', ') + '.' : 'You carry nothing the refinery still needs.'); return; }
  c.gold += REFINERY_PAY; gainXp(300); calcStats(); saveChar();
  closeDialog(); reloadStruct(v.id);
  showToast(`${v.vm.name} has a refinery`);
  logLine(`The columns go up, the flare is lit: ${v.vm.name} refines crude into fuel now. They pay you ${REFINERY_PAY} gold.`);
}
function giveFortify() {
  const v = loadedVillage(town()), c = G.char;
  if (!v) return;
  const st = (c.towns[v.id] ??= {}), plan = fortifyPlan(st)!;
  const { taken, raised } = handOver(st, (k) => count(c.inv, k));
  for (const [k, n] of taken) { let left = n; for (let i = 0; i < c.inv.length && left; i++) { const s = c.inv[i]; if (s?.k === k) { const m = Math.min(left, s.n); s.n -= m; left -= m; if (s.n <= 0) c.inv[i] = null; } } }
  if (!raised) { saveChar(); renderFortify(taken.length ? 'Handed over: ' + taken.map(([k, n]) => `${ITEMS[k].name} ×${n}`).join(', ') + '.' : 'You carry nothing we still need.'); return; }
  c.gold += plan.gold; gainXp(plan.xp); calcStats(); saveChar();
  closeDialog();
  reloadStruct(v.id);
  showToast(`${v.vm.name} raises a ${WALL_TIERS[plan.to].name}`);
  logLine(`The villagers work through the night and the new wall stands. They pay you ${plan.gold} gold.`);
}
dlgEl.addEventListener('click', (e) => {
  if (craftClick(e.target as HTMLElement) || buildClick(e.target as HTMLElement)) return;
  if (caravanClick(e.target as HTMLElement) || shuttleClick(e.target as HTMLElement) || worksClick(e.target as HTMLElement) || stationClick(e.target as HTMLElement)) return;
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
    if (c.gold < p) return renderShop('Not enough gold.');
    if (!addItem(k)) return renderShop(HANDS_ONLY.has(k) ? 'You carry that in your hands, and they are full: put what you hold away first.' : 'No room in your backpack (slots or bulk).');
    c.gold -= p; calcStats(); saveChar(); return renderShop('Bought: ' + ITEMS[k].name + '.');
  }
  if (t.closest('[data-fort]')) { giveFortify(); return; }
  if (t.closest('[data-rbuild]')) { giveRefinery(); return; }
  if (t.closest('[data-sbuild]')) { giveStore(); return; }
  { const w = t.closest<HTMLElement>('[data-work]'); if (w) { giveWork(w.dataset.work as WorkKind); return; } }
  { const w = t.closest<HTMLElement>('[data-pnew]'); if (w) { newWorks(w.dataset.pnew as PlantKind | StationKind); return; } }
  if (t.closest('[data-pgive]')) { giveWorks(); return; }
  if (t.closest('[data-tribute]')) { const v = loadedVillage(town()); const m = v ? payTribute(v.id) : ''; if (W.talkNpc?.role === 'guard') renderWatch(m); else renderFortify(m); return; }
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
  switch (o.dataset.o as OptId | 'back') {
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
    case 'chat': renderTalk(here(VILLAGER_LINES[(Math.random() * VILLAGER_LINES.length) | 0])); break;
    case 'lore': renderTalk(here(loreText())); break;
    case 'fortify': renderFortify(); break;
    case 'house': renderHouse(); break;
    case 'works': renderWorksPanel(); break;
    case 'contracts': openContracts(town()); renderContracts(panel(), dlgHead()); break;
    case 'trade': if (openMarket(town())) renderMarket(panel(), dlgHead()); else renderTalk('Hm?'); break;
    case 'work':
      renderTalk(r === 'elder' ? 'Read the notice board on the plaza. Folk post their troubles there, and when my name is on a notice, come and see me.'
        : 'Have a look at the notice board on the plaza. If I need something, you will find it there.');
      break;
  }
});
