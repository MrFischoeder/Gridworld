// (0.183, PLAN_PLACOWEK.md stage O2) The outpost window, opened with E at a deposit in the wilds (gen/lodes.ts): drive
// the stake in, hand over what the extraction and the storage shed need (from the backpack and the vehicles parked by
// it), see what it digs, and take the crates away (trunks first). Every change runs under the outpost's lock online.
import { G, W } from '../game';
import { ITEMS, type ItemKey } from '../data/items';
import { calcStats, saveChar, gainXp } from '../character';
import { LODES, type Lode } from '../gen/lodes';
import { newOutpost, outputs, stockNow, takeCrates, partPlan, partProblem, partName, handOver, jobEnd, capOf, bare, mayUse, DIG, digOf, STORE, OUTPOST, type OutpostState, type OutpostPart } from '../gen/outposts';
import { nearX } from '../gen/regions';
import { itemName } from './icons';
import { carried, takeFrom, putAway } from './market';
import { withOutpost } from './stock';
import { $, showToast, logLine } from './hud';
import { lockPointer } from './input';
import { givesText } from '../world/lodes';

const dlgEl = $('dlg'), panel = () => dlgEl.querySelector('.panel') as HTMLElement;
let lode: Lode | null = null;
const at = () => (lode ? { x: nearX(lode.x, G.pos.x), z: lode.z } : null);
const state = (): OutpostState | undefined => (lode ? G.char.outposts[lode.id] : undefined);
const hrs = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h ${Math.round(m % 60)} min` : `${Math.round(m)} min`);

function partHTML(o: OutpostState, p: OutpostPart): string {
  const name = partName(o.k, p), text = p === 'dig' ? DIG[digOf(o.k)].text : STORE.text;
  if (o.done?.[p]) return `<div class="say"><b style="color:var(--xp)">${name} ✓</b></div>`;
  if (o.job?.p === p) return `<div class="say"><b>${name}</b>: the builders are at it, ${hrs(jobEnd(o) - G.char.time)} left.</div>`;
  const rows = partPlan(o, p).map((r) => `${itemName(r.k)} ${r.given}/${r.n}${r.given >= r.n ? ' ✓' : ` · with you: ${carried(r.k, at())}`}`).join('<br>');
  const why = partProblem(o, p);
  return `<div class="say"><b>${name}</b> <span style="opacity:.8">(${OUTPOST.hours[p]} h to build)</span>: ${text}<br>${rows}</div>` +
    (why ? `<div class="say" style="opacity:.7">${why}</div>` : `<button class="opt" data-op="give:${p}">Hand over materials for the ${name.toLowerCase()}</button>`);
}
function render(msg = '') {
  if (!lode) return;
  const c = G.char, l = lode, spec = LODES[l.k], o = state();
  let s = `<h2>${l.name}</h2><div class="role">${spec.name} · gives ${givesText(l)} · richness ${Math.round(l.rich * 100)}%</div>`;
  if (msg) s += `<div class="say">${msg}</div>`;
  if (!o) {
    s += `<div class="say">${spec.blurb[0].toUpperCase() + spec.blurb.slice(1)}. Nobody works it. Drive a stake in and it is yours to work: build its ${DIG[digOf(l.k)].name.toLowerCase()} and a storage shed from materials you bring here, and it digs ${outputs(l).map(([g, r]) => `${(r * 24).toFixed(1)} ${ITEMS[g].name.replace(/^Crate of /, '').toLowerCase()}`).join(' and ')} a day.</div>` +
      `<button class="opt" data-op="stake" style="color:var(--gold)">Drive in the stake (found an outpost)</button>`;
  } else if (!mayUse(o, c.pid)) {
    s += `<div class="say">Staked by ${o.by}. It is theirs to work.</div>`;
  } else {
    s += `<div class="say" style="opacity:.85">Outpost staked by ${o.by}. Owner: ${o.o === 'crew' ? 'the whole crew' : o.by}.</div>`;
    s += partHTML(o, 'dig') + partHTML(o, 'store');
    if (o.done?.dig) {
      const now = stockNow(o, l, c.time), cap = capOf(o);
      s += `<div class="say"><b>On site</b> (${o.done.store ? 'in the shed' : 'piled in the open'}, up to ${cap} of each):<br>` + outputs(l).map(([g, r]) => {
        const n = Math.floor(now[g] ?? 0);
        return `${itemName(g)} ${n}/${cap} · ${(r * 24).toFixed(1)} a day${n >= cap ? ' · full: the crew stands idle' : ''} ` +
          (n ? `<button class="opt" style="display:inline-block;width:auto;margin:2px 4px" data-op="take:${g}:1">Take 1</button><button class="opt" style="display:inline-block;width:auto;margin:2px 4px" data-op="take:${g}:${n}">Take all</button>` : '');
      }).join('<br>') + `</div>`;
    } else s += `<div class="say" style="opacity:.7">Nothing is dug until the ${DIG[digOf(l.k)].name.toLowerCase()} stands.</div>`;
    if (bare(o)) s += `<button class="opt" data-op="drop">Pull up the stake</button>`;
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
    const o = c.outposts[l.id];
    if (a === 'stake') {
      if (o) { msg = `${o.by} has staked it already.`; return; }
      c.outposts[l.id] = newOutpost(l, c.name || 'You', c.time);
      msg = 'The stake goes in. This is an outpost now: bring the materials and the builders will put up what you choose.';
      logLine(`You staked an outpost at ${l.name}.`); showToast('Outpost staked');
    } else if (!o || !mayUse(o, c.pid)) { msg = 'Not yours to work.'; return; }
    else if (a === 'give') {
      const p = x as OutpostPart, { taken, started } = handOver(o, p, (k) => carried(k, at()), c.time);
      for (const [k, n] of taken) takeFrom(k, n, at());
      msg = taken.length ? 'Handed over: ' + taken.map(([k, n]) => `${ITEMS[k].name} ×${n}`).join(', ') + '.' : 'You carry nothing it still needs.';
      if (started) { msg += ` <b>Everything is here: the builders start on the ${partName(o.k, p).toLowerCase()} (${OUTPOST.hours[p]} h).</b>`; gainXp(OUTPOST.xp[p]); }
    } else if (a === 'take') {
      const g = x as ItemKey, want = Math.max(1, +y || 1), n = takeCrates(o, l, g, want, c.time);
      if (!n) { msg = 'Nothing to take.'; return; }
      const left = putAway(g, n, at(), true);
      if (left) o.stock!.n[g] = (o.stock!.n[g] ?? 0) + left; // what finds no room stays on site
      msg = n - left ? `Loaded ${n - left} × ${ITEMS[g].name}${left ? `; ${left} had no room and stay here` : ''}.` : 'No room in your backpack or the trunks here.';
    } else if (a === 'drop' && bare(o)) {
      delete c.outposts[l.id]; msg = 'You pull up the stake. The deposit is free again.';
    }
  }).then((ok) => { if (!ok) return; calcStats(); saveChar(); if (lode === l) render(msg); });
  return true;
}
