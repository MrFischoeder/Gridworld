// The village computer in the elder's hall (world/terminal.ts finds it; E at it). A green-screen terminal with five
// pages: the village (its land, industry, storehouse, works, walls and raids), power (what is made and used now, and
// the next day hour by hour), trade (your contracts, what you have bought and sold where, the caravans on our roads,
// our market), the villages you know of (what each makes and wants, what stands there), and the Chariot of the
// Ancients. It reads only; everything it shows comes from the pure models the rest of the game runs on.
import { G, W } from '../game';
import { ITEMS } from '../data/items';
import { findPoi, allVillages, worldDist, villageSeed, CHUNK, type Poi } from '../gen/regions';
import { industryOf, INDUSTRY, siteCondition, production, fertility } from '../gen/industry';
import { profileOf, quote, type Good } from '../gen/market';
import { storeInfo } from '../gen/store';
import { wallOf, worksOf, powerKind, POWER, POWER_DOWN } from '../gen/town';
import { WALL_TIERS, type VillageMap } from '../gen/village';
import { nextRaid, lastRaid, raidOutcome } from '../gen/raids';
import { PLANTS, plantsOf, running, runPlant } from '../gen/plants';
import { STATIONS, DRAW, VILLAGE_KW, balance, baseKw, stationKw, fuelAt, poweredAt } from '../gen/energy';
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
import { lockPointer } from './input';

const dlgEl = $('dlg'), panel = () => dlgEl.querySelector('.panel') as HTMLElement;
type Page = 'village' | 'power' | 'trade' | 'villages' | 'chariot';
const PAGES: [Page, string][] = [['village', 'VILLAGE'], ['power', 'POWER'], ['trade', 'TRADE'], ['villages', 'VILLAGES'], ['chariot', 'CHARIOT']];
let open: { vid: number; vm: VillageMap } | null = null, page: Page = 'village';

const name = (g: Good) => ITEMS[g].name;
const bar = (x: number, n = 12) => { const k = Math.max(0, Math.min(n, Math.round(x * n))); return '█'.repeat(k) + '░'.repeat(n - k); };
const row = (label: string, value: string) => `<div class="trow"><span>${label}</span><span>${value}</span></div>`;
const h = (t: string) => `<div class="thead">${t}</div>`;
const hours = (min: number) => (min < 60 ? `${Math.max(0, Math.round(min))} min` : min < 2880 ? `${Math.round(min / 60)} h` : `${Math.round(min / 1440)} days`);

function villagePage(poi: Poi, vm: VillageMap): string {
  const c = G.char, st = c.towns[poi.id], seed = vm.seed, now = c.time;
  const ind = industryOf(c.world, poi, seed), spec = INDUSTRY[ind], p = profileOf(c.world, poi, seed), fert = fertility(c.world, poi, seed);
  const prod = production(c.world, poi, seed, st, now), cond = siteCondition(c.world, poi, st, now), so = storeOf(poi.id, seed), info = storeInfo(seed, st, now, prod);
  let s = h(`${vm.name.toUpperCase()} · ${spec.name.toUpperCase()}`);
  s += row('Makes', p.makes.map(name).join(', ')) + row('Wants', p.wants.map(name).join(', '));
  if (ind === 'farm') s += row('Fields', `${fert > 1.15 ? 'rich' : fert < 0.85 ? 'poor' : 'fair'} (×${fert.toFixed(2)})`);
  s += row(spec.site, `${bar(cond / 100)} ${Math.round(cond)}% · output ${Math.round(prod * 100)}%`);
  s += row(so.name, `${bar(so.n / so.cap)} ${Math.floor(so.n)}/${so.cap} crates` + (info.fullSince !== null && info.convoyAt !== null ? ` · FULL, convoy ${fmtTime(info.convoyAt)}` : ''));
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
  s += row('Made now', `<b>${Math.round(b.made)} kW</b>`) + row('Village use', `${VILLAGE_KW} kW`) + row('Left for works', `${Math.round(Math.max(0, b.made - VILLAGE_KW))} kW`);
  s += h('SOURCES');
  s += row(POWER[kind].name, `${Math.round(baseKw(c.world, poi, seed, st, now))} kW · condition ${Math.round(cond)}%${cond < POWER_DOWN ? ' · DOWN' : ''}`);
  for (const x of st?.stations ?? []) {
    const sp = STATIONS[x.k];
    s += row(sp.name, `${x.on ? Math.round(stationKw(poi, seed, x, now)) + ' kW' : 'OFF'} of ${sp.kw}` + (sp.fuel ? ` · bunker ${Math.floor(fuelAt(x, now))} ${sp.fuel === 'coal' ? 'coal' : 'fuel'}, ${x.on && fuelAt(x, now) > 0 ? `~${Math.round(fuelAt(x, now) * sp.burn! / 60)} h left` : 'not burning'}` : ''));
  }
  if (!(st?.stations ?? []).length) s += `<div class="tdim">No power stations. The works need them.</div>`;
  s += h('WORKS');
  const plants = plantsOf(st);
  plants.forEach((p, i) => { s += row(PLANTS[p.k].name, `draws ${DRAW[p.k]} kW · ${!running(p) ? 'idle' : b.powered[i] ? 'powered' : 'NO POWER'}`); });
  if (!plants.length) s += `<div class="tdim">No works.</div>`;
  s += h('NEXT 24 HOURS (free for works)');
  const peak = Math.max(40, ...Array.from({ length: 8 }, (_, k) => balance(c.world, poi, seed, st, now + k * 180).made - VILLAGE_KW));
  for (let k = 0; k < 8; k++) {
    const t = now + k * 180, bb = balance(c.world, poi, seed, st, t), free = Math.max(0, bb.made - VILLAGE_KW), w = weatherAt(c.world, poi.x, poi.z, t);
    s += `<div class="trow mono"><span>${fmtTime(t)}</span><span>${bar(free / peak, 16)} ${String(Math.round(free)).padStart(4)} kW · ${WEATHER_NAME[w.kind]}</span></div>`;
  }
  return s;
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
      `makes ${p.makes.map(name).join(', ')} · wants ${p.wants.map(name).join(', ')}` +
      `<br><span class="tdim">${WALL_TIERS[wallOf(st)].name}${built.length ? ' · ' + built.join(', ') : ''}${seen ? ` · prices seen ${hours(c.time - seen.t)} ago` : ''}</span></div>`;
  }
  return s;
}

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
  const body = page === 'village' ? villagePage(poi, open.vm) : page === 'power' ? powerPage(poi, open.vm) : page === 'trade' ? tradePage(poi, open.vm) : page === 'villages' ? villagesPage(poi) : chariotPage();
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
