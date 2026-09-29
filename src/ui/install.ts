// The restoration window of a great installation (gen/installs.ts), opened at its control desk: the stages, what the
// current one needs (handed over bit by bit from the backpack and vehicles parked by the plant), and once restored the
// works: load ore into the hopper, collect the fuel.
import { G, W } from '../game';
import { ITEMS, type ItemKey } from '../data/items';
import { calcStats, saveChar, gainXp } from '../character';
import { INSTALL_STAGES, INSTALL_WORK, INSTALL_DRAW, HALL_STAGE, RADAR, radarPlaces, installSites, type InstallKind, type InstallState, installPlan, handOverInstall, runInstall, installDone, newInstall, batchesIn, loadInstall, canRun, hallPick, hallKw, hallReady, hallSets, fuelHall, type InstallSite } from '../gen/installs';
import { itemName } from './icons';
import { TECH_BY_ID } from '../gen/tech';
import type { Good } from '../gen/market';
import { nearX, worldDist, wrapDx, CHUNK, type Poi } from '../gen/regions';
import { discover } from '../save';
import { Terrain } from '../gen/terrain';
import { OW } from '../world/overworld';
import type { Contract } from '../gen/contracts';
const terrainNow = () => (OW.terrain && OW.terrain.world === G.char.world ? OW.terrain : new Terrain(G.char.world));
import { reactorVillages, fuelOrder, chipVillages, chipOrder, cellVillages, cellOrder } from '../gen/contracts';
import { dirWord } from '../gen/tech';
import { redrawInstalls } from '../world/installs';
import { carried, takeFrom, putAway } from './market';
import { $, showToast, logLine } from './hud';
import { lockPointer } from './input';

const dlgEl = $('dlg'), panel = () => dlgEl.querySelector('.panel') as HTMLElement;
let site: InstallSite | null = null;
const at = () => (site ? { x: nearX(site.x, G.pos.x), z: site.z } : null);
const stateOf = (s: InstallSite) => (G.char.installs[s.k] ??= newInstall());
const have = (k: ItemKey) => carried(k as Good, at());
const hours = (m: number) => (m >= 60 ? Math.round(m / 60) + ' h' : Math.round(m) + ' min');

function render(msg = '') {
  if (!site) return;
  const c = G.char, st = stateOf(site), stages = INSTALL_STAGES[site.k];
  runInstall(site.k, st, c.time);
  const list = stages.map((x, i) => `<span style="color:${i < st.stage ? 'var(--xp)' : i === st.stage ? 'var(--txt)' : '#6a8a70'}">${i + 1}. ${x.title}${i < st.stage ? ' ✓' : ''}</span>`).join(' · ');
  let s = `<h2>${site.name}</h2><div class="role">Control desk · ${Math.min(st.stage, stages.length)} of ${stages.length} stages restored</div>` +
    `<div class="say">${msg ? msg + '<br><br>' : ''}`;
  const plan = installPlan(site.k, st, c.tech);
  if (plan) {
    s += `<b>${plan.st.title}.</b> ${plan.st.text}</div><div class="shoprow"><div>${list}<br><span>`;
    if (!plan.plans) s += `Nobody knows how this was built. The plans for ${TECH_BY_ID[plan.st.tech!].name} must lie somewhere out there, on an old data carrier.`;
    else s += plan.rows.map((r) => { const h = have(r.k); return `<span style="color:${r.given >= r.n ? 'var(--xp)' : h ? 'var(--txt)' : '#ff9a7a'}">${ITEMS[r.k].name} ${r.given}/${r.n}${r.given < r.n && h ? ` (you have ${h} with you)` : ''}</span>`; }).join(' · ');
    s += `</span><br><span style="opacity:.7">On completion: ${plan.st.gold} gold, ${plan.st.xp} xp.</span></div></div>`;
    if (plan.plans) s += `<button class="opt" data-ins="give" ${plan.rows.some((r) => r.given < r.n && have(r.k) > 0) ? '' : 'disabled'}>Hand over what I carry</button>`;
  } else if (!INSTALL_WORK[site.k]) {
    s += `The dish turns on its tower and the screens in the bunker glow: every village, ruin, wreck and camp within ${RADAR.r / 1000} km shows up, and whatever else is out there.</div>` +
      `<div class="shoprow"><div>${list}</div></div><button class="opt" data-ins="sweep">Sweep again and copy it onto my map</button>`;
  } else {
    const w = INSTALL_WORK[site.k]!, recipe = w.inp.map(([i, n]) => `${n} ${short(ITEMS[i].name)}`).join(' and ');
    s += `${w.what} ${recipe} make ${(w.n ?? 1) > 1 ? `${w.n} crates` : "one crate"} of ${ITEMS[w.out].name} every ${hours(w.batch)}, while the power hall gives ${INSTALL_DRAW[site.k]} kW.</div>` +
      `<div class="shoprow"><div>${list}</div></div>` + screen(site.k, st) +
      w.inp.map(([i]) => { const h = have(i); return `<button class="opt" data-ins="load" data-insk="${i}" ${h && (st.inp[i] ?? 0) < w.hopper ? '' : 'disabled'}>Load ${short(ITEMS[i].name)} (${st.inp[i] ?? 0}/${w.hopper} in the hopper · you have ${h} with you)</button>`; }).join('') +
      `<button class="opt" data-ins="take" ${st.out ? '' : 'disabled'}>Collect the ${ITEMS[w.out].name} (${st.out})</button>`;
  }
  panel().classList.add('wide');
  panel().innerHTML = s + hall(site.k, st) + buyers() + `<button class="opt" data-ins="close">Close</button>`;
}
const short = (n: string) => n.replace(/^(Crate|Sack|Barrel|Bale) of /, '').toLowerCase();
/** The plant's own terminal: power, the hopper, what it makes and when the next batch is due. */
function screen(k: InstallKind, st: InstallState): string {
  const w = INSTALL_WORK[k]!, c = G.char, draw = INSTALL_DRAW[k] ?? 0, kw = hallKw(k, st), run = canRun(k, st), pick = hallPick(k, st);
  const pad = (a: string, n = 22) => (a + ':').toUpperCase().padEnd(n);
  let t = `${site!.name.toUpperCase()}\n${pad('Power')}${kw}/${draw} kW${pick ? ' · ' + pick.map((h) => h.name.toLowerCase()).join(' + ') : ''}\n`;
  for (const [i] of w.inp) t += `${pad(short(ITEMS[i].name))}${st.inp[i] ?? 0} crates\n`;
  t += `${pad('Production')}${ITEMS[w.out].name.toUpperCase()} · ${st.out}/${w.bay} in the bay\n`;
  const left = Math.max(0, w.batch - (c.time - st.t));
  t += `${pad('Next batch')}${run ? `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(Math.floor(left % 60)).padStart(2, '0')}` : st.out >= w.bay ? 'STOPPED · THE BAY IS FULL' : batchesIn(k, st) < 1 ? 'WAITING FOR ' + w.inp.filter(([i, n]) => (st.inp[i] ?? 0) < n).map(([i]) => short(ITEMS[i].name).toUpperCase()).join(', ') : 'NO POWER'}`;
  return `<pre style="font-family:monospace;white-space:pre-wrap;color:var(--xp);background:#010d04;border:1px solid #2fe06055;padding:8px 10px;margin:6px 0">${t}</pre>`;
}
/** The power hall: its generator sets and their bunkers (once the second stage has brought it back). */
function hall(k: InstallKind, st: InstallState): string {
  if (!INSTALL_DRAW[k]) return '';
  if (!hallReady(k, st)) return `<div class="say" style="opacity:.8">The power hall by the gate is a burnt-out shell. It comes back with the ${INSTALL_STAGES[k][HALL_STAGE - 1].title.toLowerCase()} stage.</div>`;
  const rows = hallSets(k).map((h) => {
    const n = st.pw?.[h.fuel] ?? 0, hv = have(h.fuel), per = INSTALL_WORK[k]!.batch / h.burn;
    return `<div class="shoprow"><div><b>${h.name}</b> · ${h.kw} kW<br><span>${itemName(h.fuel)} in the bunker ${n > 0 && n < 1 ? n.toFixed(2) : Math.floor(n * 10) / 10}/${h.bunker} · ${per < 1 ? `${Math.round(1 / per)} batches a crate` : `${per.toFixed(1)} crates a batch`} · you have ${hv}</span></div>` +
      `<button class="opt" style="width:auto" data-ins="fuel" data-insk="${h.fuel}" ${hv && n < h.bunker - 1 + 1e-9 ? '' : 'disabled'}>load</button></div>`;
  }).join('');
  return `<div class="say" style="margin:8px 0 0"><b>The power hall.</b> A batch needs ${INSTALL_DRAW[k]} kW: ${k === 'uranium' ? 'the coal boiler and the diesel sets together, or the plant\'s own reactor on its own rods' : 'the coal boiler or the diesel sets'}. The sets burn only while a batch is under way.</div>` + rows;
}
/** The buyers of what this installation makes nearest to it, and whether they order today (its radio log). */
const BUYERS: Partial<Record<InstallKind, { list: (world: number) => Poi[]; order: (world: number, v: Poi, now: number) => Contract | null; who: string }>> = {
  uranium: { list: reactorVillages, order: fuelOrder, who: 'the old reactors that burn these rods' },
  chips: { list: chipVillages, order: chipOrder, who: 'the workshops that build with these chips' },
  battery: { list: cellVillages, order: cellOrder, who: 'the salvagers who keep the old machines going on these cells' },
};
function buyers(): string {
  if (!site) return '';
  const c = G.char, s0 = site, b = BUYERS[s0.k];
  if (!b) return '';
  const list = b.list(c.world).map((v) => ({ v, d: worldDist(v.x, v.z, s0.x, s0.z) })).sort((a, q) => a.d - q.d).slice(0, 3);
  if (!list.length) return '';
  return `<div class="say" style="opacity:.85">The radio log still lists ${b.who}: ` + list.map(({ v, d }) => {
    const o = b.order(c.world, v, c.time);
    return `<b>${v.name}</b> (${(d / 1000).toFixed(1)} km ${dirWord(wrapDx(v.x - s0.x), v.z - s0.z)} of here${o ? `, orders ${o.n} today at ${o.pay} g a crate` : ', no order today'})`;
  }).join(', ') + '. Their orders are posted at their stores and on the notice boards round about.</div>';
}
export function openInstall(s: InstallSite) {
  if (!G.playing || G.dlgOpen || G.packOpen || G.xferOpen) return;
  site = s; G.dlgOpen = true; W.talkNpc = null; G.firing = false; for (const k in G.keys) G.keys[k] = false;
  render();
  dlgEl.style.display = 'flex'; if (document.pointerLockElement) document.exitPointerLock();
}
/** What the crew say when an installation comes back to life. */
const FINISH: Record<InstallKind, string> = {
  uranium: 'The last controller clicks into place and the centrifuges spin up.',
  chips: 'The etchers wake one by one and the clean room fills with a violet glow.',
  radar: 'The dish swings up on its tower, the screens flicker, and the land for miles round fills with blips.',
  propellant: 'Steam rises from the columns, the flare lights, and the first batch runs into the mixing house.',
  battery: 'The formation lines crackle into life and the first racks of cells begin to charge.',
};
/** The radar station's sweep: every place within its reach goes on your map. */
function sweep(s: InstallSite): string {
  const c = G.char, places = radarPlaces(c.world, s), sites = installSites(terrainNow()).filter((o) => o !== s && worldDist(o.x, o.z, s.x, s.z) <= RADAR.r);
  let n = 0;
  for (const p of [...places, ...sites]) if (discover(c.discovered, Math.floor(p.x / CHUNK), Math.floor(p.z / CHUNK))) n++;
  const v = places.filter((p) => p.type === 'village').length;
  if (n) { saveChar(); logLine(`The radar copies ${n} new place${n === 1 ? '' : 's'} onto your map (M).`); }
  const all = places.length + sites.length;
  return n ? `The sweep shows ${all} places within ${RADAR.r / 1000} km (${v} villages${sites.length ? `, ${sites.map((o) => 'the ' + o.name).join(' and ')}` : ''}): ${Math.min(n, all)} of them are new on your map.` : `The sweep shows ${all} places within ${RADAR.r / 1000} km; you already have them all on your map.`;
}
function close() { site = null; G.dlgOpen = false; dlgEl.style.display = 'none'; if (!G.isTouch) lockPointer(); }
/** Clicks in the restoration window; true when handled. */
export function installClick(t: HTMLElement): boolean {
  if (!site) return false;
  const b = t.closest('[data-ins]') as HTMLElement | null;
  if (!b) return false;
  const c = G.char, st = stateOf(site), a = b.dataset.ins;
  if (a === 'close') { close(); return true; }
  if (a === 'give') {
    const before = st.stage, { taken, built } = handOverInstall(site.k, st, c.tech, have, c.time);
    for (const [k, n] of taken) takeFrom(k as Good, n, at());
    let msg = taken.length ? 'Handed over: ' + taken.map(([k, n]) => `${ITEMS[k].name} ×${n}.`).join(' ') : 'You carry nothing this stage still needs.';
    if (built) {
      const done = INSTALL_STAGES[site.k][before];
      c.gold += done.gold; gainXp(done.xp);
      showToast(`${site.name}: ${done.title.toLowerCase()} done`);
      const fin = installDone(site.k, st);
      logLine(fin ? `${FINISH[site.k]} The ${site.name} is working again. You earn ${done.gold} gold.` : `${done.title}: done. You earn ${done.gold} gold.`);
      msg += ` <b>${done.title}: done.</b>`;
      if (fin && !INSTALL_WORK[site.k]) msg += ' ' + sweep(site);
      redrawInstalls();
    }
    calcStats(); saveChar(); render(msg); return true;
  }
  if (a === 'sweep') { render(sweep(site)); return true; }
  if (a === 'fuel') {
    const i = b.dataset.insk as ItemKey, n = fuelHall(site.k, st, i, have(i), c.time);
    if (n > 0) { takeFrom(i, n, at()); calcStats(); saveChar(); }
    render(n > 0 ? `Loaded ${n} × ${ITEMS[i].name} into the power hall.` : 'No room in that bunker, or nothing to load.'); return true;
  }
  if (a === 'load') {
    const i = b.dataset.insk as ItemKey, n = loadInstall(site.k, st, i, have(i), c.time);
    if (n > 0) { takeFrom(i, n, at()); calcStats(); saveChar(); }
    render(n > 0 ? `Loaded ${n} × ${ITEMS[i].name}.` : 'Nothing to load.'); return true;
  }
  if (a === 'take') {
    runInstall(site.k, st, c.time);
    const w = INSTALL_WORK[site.k];
    if (!w) return true;
    const left = putAway(w.out, st.out, at(), true), got = st.out - left;
    if (got > 0 && st.out >= w.bay) st.t = c.time; // the bay had stopped it: it starts again now
    st.out = left; calcStats(); saveChar();
    render(got ? `Collected ${got} crates of ${ITEMS[w.out].name}${left ? ` (no room for ${left})` : ''}.` : 'No room for them.'); return true;
  }
  return false;
}
