// The building window of a pier (gen/piers.ts, world/piers.ts), opened at its sign on the beach: its length and the
// water at its head, what it takes (handed over bit by bit from the backpack and vehicles parked by it), pulling
// up the stakes of an unfinished one; once built, a note of when it went up.
import { G, W } from '../game';
import { ITEMS, type ItemKey } from '../data/items';
import { calcStats, saveChar, gainXp, addItem } from '../character';
import { pierRows, handOverPier, pierXp, PIER, type Pier } from '../gen/piers';
import { fmtClock } from '../core/time';
import { redrawPiers, savedPier } from '../world/piers';
import { carried, takeFrom, putAway } from './market';
import { $, showToast, logLine } from './hud';
import { lockPointer } from './input';

const dlgEl = $('dlg'), panel = () => dlgEl.querySelector('.panel') as HTMLElement;
let site: Pier | null = null;
const at = () => (site ? { x: site.x, z: site.z } : null);
const have = (k: ItemKey) => carried(k, at());

function render(msg = '') {
  if (!site) return;
  const p = savedPier(site.id);
  if (!p) return;
  let s = `<h2>${p.done ? 'Pier' : 'Pier site'}</h2><div class="role">On the sea coast · ${Math.round(p.len)} m out to ${PIER.depth} m of water</div><div class="say">${msg ? msg + '<br><br>' : ''}`;
  if (p.done) {
    s += `A timber pier runs out from the beach on piles, ${PIER.clear} m above the sea, to a head with bollards, a lamp and a crate for goods (E at the crate). Boats will tie up here. It was finished on ${fmtClock(p.done)}.</div>`;
  } else {
    const rows = pierRows(p);
    s += `Your stakes mark a pier out to deep enough water for a boat: piles driven into the sea bed, a planked deck ramping up from the beach, a wide head with bollards, a lamp and a crate. Bring the materials here (in your backpack, or in the trunk of a vehicle parked by the beach) and hand them over bit by bit.</div>` +
      `<div class="shoprow"><div>` + rows.map((r) => { const h = have(r.k); return `<span style="color:${r.given >= r.n ? 'var(--xp)' : h ? 'var(--txt)' : '#ff9a7a'}">${ITEMS[r.k].name} ${r.given}/${r.n}${r.given < r.n && h ? ` (you have ${h} with you)` : ''}</span>`; }).join(' · ') +
      `<br><span style="opacity:.7">Logs from any tree, stones from the rocks; nails, rope and wire at the village store; scrap from robots and wrecks. On completion: ${pierXp(p)} xp.</span></div></div>` +
      `<button class="opt" data-pier="give" ${rows.some((r) => r.given < r.n && have(r.k) > 0) ? '' : 'disabled'}>Hand over what I carry</button>` +
      `<button class="opt" data-pier="drop">Pull up the stakes (the materials and the kit come back)</button>`;
  }
  panel().classList.add('wide');
  panel().innerHTML = s + `<button class="opt" data-pier="close">Close</button>`;
}
export function openPier(p: Pier) {
  if (!G.playing || G.dlgOpen || G.packOpen || G.xferOpen) return;
  site = p; G.dlgOpen = true; W.talkNpc = null; G.firing = false; for (const k in G.keys) G.keys[k] = false;
  render();
  dlgEl.style.display = 'flex'; if (document.pointerLockElement) document.exitPointerLock();
}
function close() { site = null; G.dlgOpen = false; dlgEl.style.display = 'none'; if (!G.isTouch) lockPointer(); }
/** Clicks in the pier window; true when handled. */
export function pierClick(t: HTMLElement): boolean {
  if (!site) return false;
  const b = t.closest('[data-pier]') as HTMLElement | null;
  if (!b) return false;
  const c = G.char, a = b.dataset.pier, p = savedPier(site.id);
  if (a === 'close' || !p) { close(); return true; }
  if (a === 'drop' && !p.done) {
    const lost: string[] = [];
    for (const [k, n] of Object.entries(p.given) as [ItemKey, number][]) { const left = n ? putAway(k, n, at()) : 0; if (left) lost.push(`${ITEMS[k].name} ×${left}`); }
    addItem('pierkit');
    c.piers = c.piers.filter((q) => q.id !== p.id);
    logLine(`You pull up the stakes on the beach and take back what you had brought${lost.length ? ` (no room for ${lost.join(', ')}: left behind)` : ''}.`);
    redrawPiers(); calcStats(); saveChar(); close(); return true;
  }
  if (a === 'give') {
    const { taken, built } = handOverPier(p, have, c.time);
    for (const [k, n] of taken) takeFrom(k, n, at());
    let msg = taken.length ? 'Handed over: ' + taken.map(([k, n]) => `${ITEMS[k].name} ×${n}.`).join(' ') : 'You carry nothing the pier still needs.';
    if (built) {
      gainXp(pierXp(p));
      showToast('The pier stands');
      logLine(`The last planks are down and the lamp is lit: your pier reaches ${PIER.depth} m of water. +${pierXp(p)} xp`);
      msg += ' <b>The pier stands.</b>';
    }
    redrawPiers(); calcStats(); saveChar(); render(msg); return true;
  }
  return false;
}
