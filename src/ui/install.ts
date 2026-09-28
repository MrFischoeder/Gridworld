// The restoration window of a great installation (gen/installs.ts), opened at its control desk: the stages, what the
// current one needs (handed over bit by bit from the backpack and vehicles parked by the plant), and once restored the
// works: load ore into the hopper, collect the fuel.
import { G, W } from '../game';
import { ITEMS, type ItemKey } from '../data/items';
import { calcStats, saveChar, gainXp } from '../character';
import { INSTALL_STAGES, INSTALL_WORK, installPlan, handOverInstall, runInstall, installDone, newInstall, type InstallSite } from '../gen/installs';
import { TECH_BY_ID } from '../gen/tech';
import type { Good } from '../gen/market';
import { nearX } from '../gen/regions';
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
  } else {
    const w = INSTALL_WORK[site.k], ore = have(w.inp), running = st.inp >= w.n && st.out < w.bay;
    s += `The centrifuges hum again. ${w.n} crates of ${ITEMS[w.inp].name.replace(/^Crate of /, '').toLowerCase()} make one crate of ${ITEMS[w.out].name} every ${hours(w.batch)}.</div>` +
      `<div class="shoprow"><div>${list}<br>Hopper: <b>${st.inp}/${w.hopper}</b> ore · Bay: <b>${st.out}/${w.bay}</b> ${ITEMS[w.out].name}<br><span style="opacity:.8">${running ? `Running: the next crate in ${hours(Math.max(0, w.batch - (c.time - st.t)))}.` : st.out >= w.bay ? 'Stopped: the bay is full.' : `Idle: it needs at least ${w.n} crates of ore.`}</span></div></div>` +
      `<button class="opt" data-ins="load" ${ore && st.inp < w.hopper ? '' : 'disabled'}>Load ore (you have ${ore} with you)</button>` +
      `<button class="opt" data-ins="take" ${st.out ? '' : 'disabled'}>Collect the fuel (${st.out})</button>`;
  }
  panel().classList.add('wide');
  panel().innerHTML = s + `<button class="opt" data-ins="close">Close</button>`;
}
export function openInstall(s: InstallSite) {
  if (!G.playing || G.dlgOpen || G.packOpen || G.xferOpen) return;
  site = s; G.dlgOpen = true; W.talkNpc = null; G.firing = false; for (const k in G.keys) G.keys[k] = false;
  render();
  dlgEl.style.display = 'flex'; if (document.pointerLockElement) document.exitPointerLock();
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
      logLine(fin ? `The last controller clicks into place and the centrifuges spin up. The ${site.name} is working again. You earn ${done.gold} gold.` : `${done.title}: done. You earn ${done.gold} gold.`);
      msg += ` <b>${done.title}: done.</b>`;
      redrawInstalls();
    }
    calcStats(); saveChar(); render(msg); return true;
  }
  if (a === 'load') {
    runInstall(site.k, st, c.time);
    const w = INSTALL_WORK[site.k], n = Math.min(w.hopper - st.inp, have(w.inp));
    if (n > 0) { takeFrom(w.inp as Good, n, at()); if (st.inp < w.n) st.t = c.time; st.inp += n; calcStats(); saveChar(); }
    render(n > 0 ? `Loaded ${n} crates of ore.` : 'Nothing to load.'); return true;
  }
  if (a === 'take') {
    runInstall(site.k, st, c.time);
    const w = INSTALL_WORK[site.k], left = putAway(w.out as Good, st.out, at(), true), got = st.out - left;
    if (got > 0 && st.out >= w.bay) st.t = c.time; // the bay had stopped it: it starts again now
    st.out = left; calcStats(); saveChar();
    render(got ? `Collected ${got} crates of ${ITEMS[w.out].name}${left ? ` (no room for ${left})` : ''}.` : 'No room for the fuel.'); return true;
  }
  return false;
}
