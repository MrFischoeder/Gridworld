// The village computer in the elder's hall (world/terminal.ts finds it; E at it). A green-screen terminal with five
// pages: the village (its land, industry, storehouse, works, walls and raids), power (what is made and used now, and
// the next day hour by hour), trade (your contracts, what you have bought and sold where, the caravans on our roads,
// our market), the villages you know of (what each makes and wants, what stands there), and the Chariot of the
// Ancients. It reads only; everything it shows comes from the pure models the rest of the game runs on.
import { villageKw, IMPROVE, IMPROVE_KINDS, hasImprove } from '../gen/improve';
import { G, W } from '../game';
import { ITEMS, type ItemKey } from '../data/items';
import { findPoi, allVillages, worldDist, wrapDx, villageSeed, CHUNK, GRIDHOLM_ID, type Poi } from '../gen/regions';
import { industryOf, INDUSTRY, siteCondition, production, fertility } from '../gen/industry';
import { profileOf, quote, type Good } from '../gen/market';
import { wallOf, worksOf, powerKind, POWER, POWER_DOWN } from '../gen/town';
import { WALL_TIERS, type VillageMap } from '../gen/village';
import { nextRaid, lastRaid, raidOutcome } from '../gen/raids';
import { PLANTS, plantsOf, running, runPlant } from '../gen/plants';
import { STATIONS, DRAW, balance, baseKw, stationKw, fuelAt, fuelWords, poweredAt, sitePower, SITE_UNPOWERED } from '../gen/energy';
import { roadsOf, departures, lastArrival } from '../gen/caravans';
import { STAGES, CHARIOT, stageRows, stagesDone } from '../gen/shuttle';
import { weatherAt, WEATHER_NAME } from '../gen/weather';
import { isDiscovered } from '../save';
import { storeOf } from '../world/industry';
import { plantCondition } from '../world/power';
import { describe as describeContract, dueText } from './contracts';
import { bearingTo, point8, fmtDist } from './compass';
import { fmtTime, fmtClock } from '../core/time';
import { $ } from './hud';
import { depositOf, RARE_NAME } from '../gen/deposits';
import { trustOf, trustTier, shareLeft, TRUST_TIERS } from '../gen/standing';
import { peopleAt, targetNow, workersAt, staffing } from '../gen/people';
import { farmsOf, upgradedOf } from '../gen/farms';
import { TECHS, techSites, CARRIER_NAME, dirWord } from '../gen/tech';
import { Terrain } from '../gen/terrain';
import { holdVol, HALL } from '../gen/hall';
import { installSites, installDone, INSTALL_STAGES, workOf } from '../gen/installs';
import { oldReactor, fuelOrder, chipBuyer, chipOrder, cellBuyer, cellOrder } from '../gen/contracts';
import { OW } from '../world/overworld';
import { lockPointer } from './input';

const dlgEl = $('dlg'), panel = () => dlgEl.querySelector('.panel') as HTMLElement;
type Page = 'village' | 'power' | 'trade' | 'villages' | 'archive' | 'chariot';
const PAGES: [Page, string][] = [['village', 'VILLAGE'], ['power', 'POWER'], ['trade', 'TRADE'], ['villages', 'VILLAGES'], ['archive', 'ARCHIVE'], ['chariot', 'CHARIOT']];
let open: { vid: number; vm: VillageMap } | null = null, page: Page = 'village';

const name = (g: ItemKey) => ITEMS[g].name;
const bar = (x: number, n = 12) => { const k = Math.max(0, Math.min(n, Math.round(x * n))); return '█'.repeat(k) + '░'.repeat(n - k); };
const row = (label: string, value: string) => `<div class="trow"><span>${label}</span><span>${value}</span></div>`;
const h = (t: string) => `<div class="thead">${t}</div>`;
const hours = (min: number) => (min < 60 ? `${Math.max(0, Math.round(min))} min` : min < 2880 ? `${Math.round(min / 60)} h` : `${Math.round(min / 1440)} days`);

function villagePage(poi: Poi, vm: VillageMap): string {
  const c = G.char, st = c.towns[poi.id], seed = vm.seed, now = c.time;
  const ind = industryOf(c.world, poi, seed), spec = INDUSTRY[ind], p = profileOf(c.world, poi, seed), fert = fertility(c.world, poi, seed);
  const prod = production(c.world, poi, seed, st, now), cond = siteCondition(c.world, poi, st, now), so = storeOf(poi.id, seed);
  let s = h(`${vm.name.toUpperCase()} · ${spec.name.toUpperCase()}`);
  s += row('Makes', p.makes.map(name).join(', ')) + row('Wants', p.wants.map(name).join(', '));
  { const dep = depositOf(c.world, poi); if (dep) s += row('Rare deposit', RARE_NAME[dep]); }
  if (oldReactor(c.world, poi)) { const o = fuelOrder(c.world, poi, c.time); s += row('Old reactor', o ? `orders ${o.n} crates of fuel rods today, ${o.pay} g a crate` : 'no fuel order today'); }
  if (chipBuyer(c.world, poi)) { const o = chipOrder(c.world, poi, c.time); s += row('Workshops', o ? `order ${o.n} crates of microchips today, ${o.pay} g a crate` : 'no chip order today'); }
  if (cellBuyer(c.world, poi)) { const o = cellOrder(c.world, poi, c.time); s += row('Salvagers', o ? `order ${o.n} crates of power cells today, ${o.pay} g a crate` : 'no cell order today'); }
  { const home = poi.id === GRIDHOLM_ID, n = peopleAt(seed, home, st, now), tg = Math.round(targetNow(seed, home, st));
    s += row('People', `${Math.round(n)} · ${workersAt(seed, home, st, now)} at work · staffing ×${staffing(seed, home, st, now).toFixed(2)}` + (Math.abs(tg - n) >= 1 ? ` · ${n < tg ? 'growing' : 'shrinking'} to ${tg}` : '')); }
  { const k = trustTier(st), tr = TRUST_TIERS[k]; s += row('Your standing', `${tr.name} · trust ${trustOf(st)}` + (tr.crates ? ` · share ${shareLeft(st, now)}/${tr.crates} crates today` : ` · ${TRUST_TIERS[1].min} for a share`)); }
  if (ind === 'farm') s += row('Fields', `${fert > 1.15 ? 'rich' : fert < 0.85 ? 'poor' : 'fair'} (×${fert.toFixed(2)})`);
  s += row(spec.site, `${bar(cond / 100)} ${Math.round(cond)}% · output ${Math.round(prod * 100)}%`);
  s += row('Own goods in the hall', `${bar(so.n / so.cap)} ${Math.floor(so.n)}/${so.cap} crates` + (so.full ? ' · FULL, the work stops' : ''));
  { const hv = holdVol(st); if (hv) s += row('Stored in the hall', `${Math.round(hv)} / ${HALL.vol} L`); }
  { const im = IMPROVE_KINDS.filter((k) => hasImprove(st, k)); if (im.length) s += row('Improvements', im.map((k) => IMPROVE[k].name).join(', ')); }
  s += h('WORKS');
  const plants = plantsOf(st);
  if (!plants.length) s += `<div class="tdim">No works built. Ask the elder.</div>`;
  plants.forEach((pl, i) => {
    const pw = poweredAt(c.world, poi, seed, st, i); runPlant(pl, now, pw);
    const r = PLANTS[pl.k].recipes[pl.rec], inp = Object.entries(pl.inp).filter(([, n]) => n).map(([g, n]) => `${n} ${name(g as Good)}`).join(', ') || 'empty';
    const out = Object.entries(pl.out).filter(([, n]) => n).map(([g, n]) => `${n} ${name(g as Good)}`).join(', ') || 'none';
    s += row(PLANTS[pl.k].name, `${!running(pl) ? 'IDLE' : pw(now) ? 'WORKING' : 'NO POWER'} · makes ${name(r.out[0])}`) + `<div class="tdim">hopper: ${inp} · ready: ${out}</div>`;
  });
  if (st?.pbuild) s += `<div class="tdim">Being built: ${(STATIONS as Record<string, { name: string }>)[st.pbuild.k]?.name ?? PLANTS[st.pbuild.k as keyof typeof PLANTS].name}</div>`;
  s += h('DEFENCE');
  const tier = wallOf(st), nr = nextRaid(c.world, poi, now), lr = lastRaid(c.world, poi, now);
  s += row('Wall', WALL_TIERS[tier].name) + row('Wall turrets', `${Math.min(worksOf(st, 'turret'), vm.mounts.length)} of ${vm.mounts.length}`);
  s += row('Barricades', [worksOf(st, 'siteGuard') ? spec.site.toLowerCase() : '', worksOf(st, 'plantGuard') ? 'power plant' : ''].filter(Boolean).join(', ') || 'none');
  if (lr) s += row('Last raid', `${lr.camp.name}: ${({ won: 'beaten off', lost: 'broke through', paid: 'paid off' } as const)[raidOutcome(c.world, lr, st)]}`);
  s += row('Next raid', nr && !st?.raids?.[nr.k] ? `${nr.camp.name}, in about ${hours(nr.t0 - now)}` : 'none expected');
  return s;
}

function powerPage(poi: Poi, vm: VillageMap): string {
  const c = G.char, st = c.towns[poi.id], seed = vm.seed, now = c.time, b = balance(c.world, poi, seed, st, now);
  const kind = powerKind(seed), cond = plantCondition(poi.id, seed);
  let s = h(`POWER · ${fmtClock(now)}`);
  s += row('Made now', `<b>${Math.round(b.made)} kW</b>`) + (b.bank > 0.5 ? row('Of it, battery bank', `${Math.round(b.bank)} kW`) : '') + row('Village use', `${villageKw(st)} kW`) + row('Left for farms, industry and works', `${Math.round(Math.max(0, b.made - villageKw(st)))} kW`);
  s += h('SOURCES');
  s += row(POWER[kind].name, `${Math.round(baseKw(c.world, poi, seed, st, now))} kW · condition ${Math.round(cond)}%${cond < POWER_DOWN ? ' · DOWN' : ''}`);
  for (const x of st?.stations ?? []) {
    const sp = STATIONS[x.k];
    s += row(sp.name, `${x.on ? Math.round(stationKw(poi, seed, x, now)) + ' kW' : 'OFF'} of ${sp.kw}` + (sp.fuel ? ` · bunker ${Math.ceil(fuelAt(x, now) * 10) / 10} ${fuelWords(x.k)[2]}, ${x.on && fuelAt(x, now) > 0 ? `~${fuelAt(x, now) * sp.burn! > 2880 ? Math.round(fuelAt(x, now) * sp.burn! / 1440) + ' days' : Math.round(fuelAt(x, now) * sp.burn! / 60) + ' h'} left` : 'not burning'}` : ''));
  }
  if (!(st?.stations ?? []).length) s += `<div class="tdim">No power stations. The works need them.</div>`;
  if (b.farms) s += h('FARMS') + row(`${farmsOf(st)} farm${farmsOf(st) > 1 ? 's' : ''}${upgradedOf(st) ? `, ${upgradedOf(st)} with pumps` : ''}`, `draw ${b.farms} kW · ${Math.round(b.farmsPowered * 100)}% powered now (first in line)`);
  if (b.site) { const sp = sitePower(c.world, poi, seed, st, now); s += h('INDUSTRY') + row(INDUSTRY[industryOf(c.world, poi, seed)].site, `draw ${b.site} kW · ${Math.round(b.sitePowered * 100)}% powered now · ${Math.round(sp * 100)}% over the last day (output ×${(SITE_UNPOWERED + (1 - SITE_UNPOWERED) * sp).toFixed(2)})`); }
  s += h('WORKS');
  const plants = plantsOf(st);
  plants.forEach((p, i) => { s += row(PLANTS[p.k].name, `draws ${DRAW[p.k]} kW · ${!running(p) ? 'idle' : b.powered[i] ? 'powered' : 'NO POWER'}`); });
  if (!plants.length) s += `<div class="tdim">No works.</div>`;
  s += h('NEXT 24 HOURS (free for works)');
  const peak = Math.max(40, ...Array.from({ length: 8 }, (_, k) => balance(c.world, poi, seed, st, now + k * 180).made - villageKw(st)));
  for (let k = 0; k < 8; k++) {
    const t = now + k * 180, bb = balance(c.world, poi, seed, st, t), free = Math.max(0, bb.made - villageKw(st)), w = weatherAt(c.world, poi.x, poi.z, t);
    s += `<div class="trow mono"><span>${fmtTime(t)}</span><span>${bar(free / peak, 16)} ${String(Math.round(free)).padStart(4)} kW · ${WEATHER_NAME[w.kind]}</span></div>`;
  }
  return s + installRows(poi);
}
/** The great installations (gen/installs.ts): where they lie from here and how far they are restored. */
function installRows(poi: Poi): string {
  const c = G.char, T = OW.terrain && OW.terrain.world === c.world ? OW.terrain : new Terrain(c.world);
  let s = h('OLD INSTALLATIONS');
  for (const site of installSites(T)) {
    const st = c.installs[site.k], n = INSTALL_STAGES[site.k].length, where = `${fmtDist(worldDist(poi.x, poi.z, site.x, site.z))} ${dirWord(wrapDx(site.x - poi.x), site.z - poi.z)}`;
    const what = installDone(site.k, st) ? (workOf(site.k, st) ? `WORKING · ${ITEMS[workOf(site.k, st)!.out].name} ready ${st!.out} (as last seen)` : 'WORKING') : `${st?.stage ?? 0}/${n} STAGES RESTORED`;
    s += row(site.name, `${what} · ${where}`);
  }
  return s + `<div class="tdim">A Small Reactor burns the fuel rods the Old Enrichment Plant makes: a crate lasts ${STATIONS.reactor.burn! / 1440} days at ${STATIONS.reactor.kw} kW.</div>`;
}

function tradePage(poi: Poi, vm: VillageMap): string {
  const c = G.char, now = c.time;
  let s = h('YOUR CONTRACTS');
  s += c.contracts.length ? c.contracts.map((k) => `<div class="tline">${describeContract(k)}<br><span class="tdim">${k.done}/${k.n} delivered · ${dueText(k.due)}</span></div>`).join('') : `<div class="tdim">None. The store keeps a board of deliveries.</div>`;
  // what you have bought and sold where (the market remembers it for a day or two)
  s += h('YOUR RECENT TRADE');
  const by = new Map<number, string[]>();
  for (const [key, v] of Object.entries(c.market)) {
    const [vid, g] = key.split(':'), d = v.d * Math.pow(0.5, (now - v.t) / (36 * 60));
    if (Math.abs(d) < 0.5) continue;
    (by.get(+vid) ?? by.set(+vid, []).get(+vid)!).push(`${d > 0 ? 'sold' : 'bought'} ${Math.abs(Math.round(d))} ${name(g as Good)}`);
  }
  s += by.size ? [...by.entries()].map(([vid, list]) => row(findPoi(c.world, vid)?.name ?? '?', list.join(', '))).join('') : `<div class="tdim">Nothing lately.</div>`;
  s += h('CARAVANS ON OUR ROADS (next day)');
  const cars = roadsOf(c.world, poi.id).flatMap((e) => departures(c.world, e, now - 600, now + 1440)).filter((x) => x.from === poi.id || x.to === poi.id)
    .map((x) => ({ x, at: x.from === poi.id ? x.t0 : x.t0 + x.T })).filter(({ at }) => at >= now).sort((a, b) => a.at - b.at).slice(0, 8);
  s += cars.length ? cars.map(({ x, at }) => row(fmtTime(at), x.from === poi.id ? `leaves for ${x.toName} with ${x.n} ${name(x.good)}` : `arrives from ${x.fromName} with ${x.n} ${name(x.good)}`)).join('') : `<div class="tdim">No road here, or none due.</div>`;
  const la = lastArrival(c.world, poi.id, now);
  if (la) s += `<div class="tdim">Last in: ${la.n} ${name(la.good)} from ${la.fromName}.</div>`;
  s += h(`${vm.name.toUpperCase()} MARKET`);
  const p = profileOf(c.world, poi, vm.seed);
  for (const g of [...p.makes, ...p.wants]) { const q = quote(poi, vm.seed, c.world, g, c.market, now); s += row(`${name(g)} (${p.makes.includes(g) ? 'made here' : 'wanted'})`, `buy ${q.buy} · sell ${q.sell} · stock ${q.stock}`); }
  return s;
}

function villagesPage(poi: Poi): string {
  const c = G.char;
  // explored, traded with, or at the other end of one of our roads (the caravans bring word of them)
  const linked = new Set(roadsOf(c.world, poi.id).map((e) => (e.a.id === poi.id ? e.b.id : e.a.id)));
  const known = allVillages(c.world).filter((v) => v.id !== poi.id && (linked.has(v.id) || isDiscovered(c.discovered, Math.floor(v.x / CHUNK), Math.floor(v.z / CHUNK)) || c.ledger[v.id]))
    .map((v) => ({ v, d: worldDist(v.x, v.z, poi.x, poi.z) })).sort((a, b) => a.d - b.d);
  let s = h(`VILLAGES YOU KNOW OF · ${known.length}`);
  if (!known.length) return s + `<div class="tdim">None yet. Explore, read the map boards, trade.</div>`;
  for (const { v, d } of known.slice(0, 30)) {
    const seed = villageSeed(c.world, v), st = c.towns[v.id], p = profileOf(c.world, v, seed), ind = INDUSTRY[industryOf(c.world, v, seed)];
    const built = [...plantsOf(st).map((x) => PLANTS[x.k].name), ...(st?.stations ?? []).map((x) => STATIONS[x.k].name)];
    const seen = c.ledger[v.id];
    s += `<div class="tline"><b>${v.name}</b> <span class="tdim">${fmtDist(d)} ${point8(bearingTo(v.x, v.z))} · ${ind.name}${linked.has(v.id) ? ' · road' : ''}</span><br>` +
      `makes ${p.makes.map(name).join(', ')} · wants ${p.wants.map(name).join(', ')}${depositOf(c.world, v) ? ` · <b>deposit: ${RARE_NAME[depositOf(c.world, v)!]}</b>` : ''}${oldReactor(c.world, v) ? ' · <b>old reactor (orders fuel rods)</b>' : ''}${chipBuyer(c.world, v) ? ' · <b>orders microchips</b>' : ''}${cellBuyer(c.world, v) ? ' · <b>orders power cells</b>' : ''}` +
      `<br><span class="tdim">${WALL_TIERS[wallOf(st)].name}${built.length ? ' · ' + built.join(', ') : ''}${seen ? ` · prices seen ${hours(c.time - seen.t)} ago` : ''}</span></div>`;
  }
  return s;
}

/** The technologies read off the data carriers you found (gen/tech.ts). */
function archivePage(): string {
  const c = G.char, sites = techSites(OW.terrain && OW.terrain.world === c.world ? OW.terrain : new Terrain(c.world));
  const got = TECHS.filter((t) => c.tech[t.id] !== undefined);
  let s = h(`ARCHIVE · ${got.length} OF ${TECHS.length} RECOVERED`);
  if (!got.length) s += `<div class="tdim">No data. The old civilisation kept its plans on floppy disks, data disks and memory crystals. Some must still lie in the ruins, the crashed ships and the caves: the simpler knowledge near Gridholm, the rarer further out.</div>`;
  for (const t of got) {
    const at = sites.find((x) => x.tech === t.id);
    s += row(t.name, `${AREA[t.area]} · level ${t.tier}`) + `<div class="tdim">${t.blurb}${at ? ` · from a ${CARRIER_NAME[at.carrier].toLowerCase()}, ${at.name}` : ''}</div>`;
  }
  const left = ([1, 2, 3, 4] as const).map((k) => [k, TECHS.filter((t) => t.tier === k && c.tech[t.id] === undefined).length] as const).filter(([, n]) => n);
  if (left.length) s += h('STILL LOST') + left.map(([k, n]) => row(`Level ${k}`, `${n} ${n > 1 ? 'plans' : 'plan'} · ${TIER_WHERE[k]}`)).join('');
  return s;
}
const AREA: Record<string, string> = { farming: 'Farming', building: 'Building', power: 'Power', metal: 'Metalwork', electronics: 'Electronics', transport: 'Transport', navigation: 'Navigation', chemistry: 'Chemistry', nuclear: 'Nuclear' };
const TIER_WHERE: Record<number, string> = { 1: 'within a few km of Gridholm', 2: 'some 3 to 8 km out', 3: 'some 8 to 16 km out', 4: 'far out, 16 km and more' };

function chariotPage(): string {
  const s0 = G.char.shuttle;
  let s = h(`${CHARIOT.toUpperCase()} · ${stagesDone(s0)} OF ${STAGES.length}`);
  for (const st of STAGES) {
    const { rows, done } = stageRows(s0, st), have = rows.reduce((a, r) => a + r.given, 0), need = rows.reduce((a, r) => a + r.n, 0);
    s += row(st.name, `${bar(have / need)} ${done ? 'DONE' : `${have}/${need}`}`) + `<div class="tdim">${rows.map((r) => `${name(r.g)} ${r.given}/${r.n}`).join(' · ')}</div>`;
  }
  return s + `<div class="tdim">Bring the crates to the Old Hangar north-east of Gridholm; the crew unload them onto the Chariot.</div>`;
}

function render() {
  if (!open) return;
  const poi = findPoi(G.char.world, open.vid);
  if (!poi) return;
  const body = page === 'village' ? villagePage(poi, open.vm) : page === 'power' ? powerPage(poi, open.vm) : page === 'trade' ? tradePage(poi, open.vm) : page === 'villages' ? villagesPage(poi) : page === 'archive' ? archivePage() : chariotPage();
  panel().classList.add('wide');
  panel().innerHTML = `<div class="term"><div class="ttabs">${PAGES.map(([k, t]) => `<button class="ttab${k === page ? ' on' : ''}" data-tt="${k}">${t}</button>`).join('')}</div>` +
    `<div class="tbody">${body}</div><div class="tfoot">${open.vm.name.toUpperCase()} HALL TERMINAL · ${fmtClock(G.char.time)}</div></div>` +
    `<button class="opt" data-tclose="1">Log off</button>`;
}
export function openTerminal(t: { vid: number; vm: VillageMap }) {
  if (!G.playing || G.dlgOpen || G.packOpen || G.xferOpen) return;
  open = t; G.dlgOpen = true; W.talkNpc = null; G.firing = false; for (const k in G.keys) G.keys[k] = false;
  render();
  dlgEl.style.display = 'flex'; if (document.pointerLockElement) document.exitPointerLock();
}
function close() { open = null; G.dlgOpen = false; dlgEl.style.display = 'none'; if (!G.isTouch) lockPointer(); }
/** Clicks in the terminal; true when handled. */
export function terminalClick(t: HTMLElement): boolean {
  if (!open) return false;
  if (t.closest('[data-tclose]')) { close(); return true; }
  const b = t.closest<HTMLElement>('[data-tt]');
  if (b) { page = b.dataset.tt as Page; render(); return true; }
  return false;
}
