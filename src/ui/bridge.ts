// The building window of a bridge site (gen/bridges.ts, world/bridges.ts), opened at the sign by a ford: the river,
// the length of the deck, what it takes (handed over bit by bit from the backpack and the vehicles parked by the
// site) and, once built, a note of when it went up.
import { G, W } from '../game';
import { ITEMS, type ItemKey } from '../data/items';
import { calcStats, saveChar, gainXp, addItem } from '../character';
import { bridgeRows, handOverBridge, bridgeXp, BRIDGE, type Ford } from '../gen/bridges';
import { fmtClock } from '../core/time';
import { redrawBridges } from '../world/bridges';
import { carried, takeFrom, putAway } from './market';
import { $, showToast, logLine } from './hud';
import { lockPointer } from './input';

const dlgEl = $('dlg'), panel = () => dlgEl.querySelector('.panel') as HTMLElement;
let site: Ford | null = null;
const at = () => (site ? { x: site.x, z: site.z } : null);
const have = (k: ItemKey) => carried(k, at());

function render(msg = '') {
  if (!site) return;
  const c = G.char, st = c.bridges[site.id], len = Math.round(2 * site.end);
  const own = !site.road;
  let s = `<h2>${site.river}</h2><div class="role">${st?.done ? 'Bridge' : 'Bridge site'} · ${own ? 'staked out by you' : 'the road\'s ford'} · ${len} m of deck</div><div class="say">${msg ? msg + '<br><br>' : ''}`;
  if (st?.done) {
    s += `A timber bridge, ${BRIDGE.w} m wide, carries the road over the river: people on foot, wagons and vehicles cross dry. It was finished on ${fmtClock(st.done)}.</div>`;
  } else {
    const rows = bridgeRows(site, st);
    s += `${own ? 'Your stakes mark where the bridge will cross.' : 'Here the road wades the river.'} A timber bridge would carry ${own ? 'you' : 'it'} over: piles driven into the bed, beams and a planked deck ${BRIDGE.clear} m above the water, ramps down to the banks and a rail each side. Anyone can build it, bit by bit: bring the materials here (in your backpack, or in the trunk of a vehicle parked by the site).</div>` +
      `<div class="shoprow"><div>` + rows.map((r) => { const h = have(r.k); return `<span style="color:${r.given >= r.n ? 'var(--xp)' : h ? 'var(--txt)' : '#ff9a7a'}">${ITEMS[r.k].name} ${r.given}/${r.n}${r.given < r.n && h ? ` (you have ${h} with you)` : ''}</span>`; }).join(' · ') +
      `<br><span style="opacity:.7">Logs from any tree (a Hatchet), stones from the rocks (a Pickaxe); nails and rope at the village store. On completion: ${bridgeXp(site)} xp.</span></div></div>` +
      `<button class="opt" data-brg="give" ${rows.some((r) => r.given < r.n && have(r.k) > 0) ? '' : 'disabled'}>Hand over what I carry</button>` +
      (own ? `<button class="opt" data-brg="drop">Pull up the stakes (the materials and the kit come back)</button>` : '');
  }
  panel().classList.add('wide');
  panel().innerHTML = s + `<button class="opt" data-brg="close">Close</button>`;
}
export function openBridge(f: Ford) {
  if (!G.playing || G.dlgOpen || G.packOpen || G.xferOpen) return;
  site = f; G.dlgOpen = true; W.talkNpc = null; G.firing = false; for (const k in G.keys) G.keys[k] = false;
  render();
  dlgEl.style.display = 'flex'; if (document.pointerLockElement) document.exitPointerLock();
}
function close() { site = null; G.dlgOpen = false; dlgEl.style.display = 'none'; if (!G.isTouch) lockPointer(); }
/** Clicks in the bridge window; true when handled. */
export function bridgeClick(t: HTMLElement): boolean {
  if (!site) return false;
  const b = t.closest('[data-brg]') as HTMLElement | null;
  if (!b) return false;
  const c = G.char, a = b.dataset.brg;
  if (a === 'close') { close(); return true; }
  if (a === 'drop' && !site.road && !c.bridges[site.id]?.done) {
    const st = c.bridges[site.id], lost: string[] = [];
    for (const [k, n] of Object.entries(st?.given ?? {}) as [ItemKey, number][]) { const left = n ? putAway(k, n, at()) : 0; if (left) lost.push(`${ITEMS[k].name} ×${left}`); }
    addItem('bridgekit');
    delete c.bridges[site.id]; c.bridgeSites = c.bridgeSites.filter((f) => f.id !== site!.id);
    logLine(`You pull up the stakes over the ${site.river} and take back what you had brought${lost.length ? ` (no room for ${lost.join(', ')}: left behind)` : ''}.`);
    redrawBridges(); calcStats(); saveChar(); close(); return true;
  }
  if (a === 'give') {
    const st = (c.bridges[site.id] ??= { given: {} }), { taken, built } = handOverBridge(site, st, have, c.time);
    for (const [k, n] of taken) takeFrom(k, n, at());
    let msg = taken.length ? 'Handed over: ' + taken.map(([k, n]) => `${ITEMS[k].name} ×${n}.`).join(' ') : 'You carry nothing the bridge still needs.';
    if (built) {
      gainXp(bridgeXp(site));
      showToast(`A bridge over the ${site.river}`);
      logLine(`The last planks are nailed down: the road crosses the ${site.river} on your bridge now. +${bridgeXp(site)} xp`);
      msg += ' <b>The bridge stands.</b>';
    }
    redrawBridges(); calcStats(); saveChar(); render(msg); return true;
  }
  return false;
}
