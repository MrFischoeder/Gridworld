// (0.280, PLAN_DROG.md stage D1) The window of a track (gen/playerroads.ts, world/playerroads.ts), opened at the sign
// at either end: what it takes (stone and planks, handed over bit by bit from the backpack and the vehicles parked by
// the sign) and the diggers' wages; once everything is in, how far the work has come; once done, the track itself.
// MP: the track lives in the shared `Char.proads` and every hand-over runs under its lock (the server's `wlock` on
// 'proads'), so two heroes handing over at once never lose a crate.
import { G, W } from '../game';
import { ITEMS, type ItemKey } from '../data/items';
import { calcStats, saveChar, gainXp } from '../character';
import { roadRows, roadWage, roadXp, handOverRoad, roadShare, roadBuilt, roadLeft, PROAD, type PlayerRoad } from '../gen/playerroads';
import { fmtClock } from '../core/time';
import { redrawRoads, endWord } from '../world/playerroads';
import { carried, takeFrom, putAway } from './market';
import { $, showToast, logLine } from './hud';
import { lockPointer } from './input';
import { net, online, lockTown, unlockTown } from '../net/client';
import { tl, TL } from '../i18n';

const dlgEl = $('dlg'), panel = () => dlgEl.querySelector('.panel') as HTMLElement;
let id = '';
const road = (): PlayerRoad | undefined => G.char.proads[id];
const at = () => { const r = road(); return r ? { x: r.pts[0][0], z: r.pts[0][1] } : null; };
/** What you carry here: the backpack, and the trunks of the vehicles by either end's sign. */
function have(k: ItemKey): number {
  const r = road(); if (!r) return 0;
  const a = carried(k, { x: r.pts[0][0], z: r.pts[0][1] }), b = carried(k, { x: r.pts[r.pts.length - 1][0], z: r.pts[r.pts.length - 1][1] });
  return Math.max(a, b);
}
/** The end whose vehicles hold k, for taking it. */
function whereHas(k: ItemKey) { const r = road()!; const e = { x: r.pts[r.pts.length - 1][0], z: r.pts[r.pts.length - 1][1] }; return carried(k, at()) >= carried(k, e) ? at() : e; }
const hrs = (m: number) => (m >= 120 ? TL`${Math.round(m / 60)} h` : TL`${Math.max(1, Math.round(m))} min`);

function render(msg = '') {
  const r = road(), c = G.char;
  if (!r) { close(); return; }
  const built = roadBuilt(r, c.time);
  let s = TL`<h2>${r.name}</h2><div class="role">${built ? tl('Track') : r.t0 !== undefined ? tl('Track works') : tl('Track site')} · ${r.len} m · from ${endWord(r.a)} to ${endWord(r.b)}</div><div class="say">${msg ? msg + '<br><br>' : ''}`;
  if (built) {
    s += TL`A dirt track ${PROAD.half * 2} m wide: graded flat across, cleared of trees and rocks, kept dry over the swamp pools. Staked out by ${r.by}, finished on ${fmtClock(r.t0! + r.h * 60)}.</div>`;
  } else if (r.t0 !== undefined) {
    const p = roadShare(r, c.time);
    s += TL`The diggers are at work: ${Math.floor(p * 100)}% done, about ${Math.round(p * r.len)} m of ${r.len} m graded. Their camp moves along the front of the work. It will be done in ${hrs(roadLeft(r, c.time))}.</div>`;
  } else {
    const rows = roadRows(r), wage = roadWage(r.len), left = wage - r.paid;
    s += TL`The stakes mark the way. Diggers from the nearby villages will grade a dirt track along it, ${PROAD.half * 2} m wide, once the materials are here and their wages are paid: stone for the culverts and the wet spots, planks for the pegs and the culvert boxes. Anyone can bring them, bit by bit (in your backpack, or in a vehicle parked by either sign). The work takes about ${hrs(r.h * 60)}.</div>` +
      `<div class="shoprow"><div>` + rows.map((w) => { const h = have(w.k); return `<span style="color:${w.given >= w.n ? 'var(--xp)' : h ? 'var(--txt)' : '#ff9a7a'}">${ITEMS[w.k].name} ${w.given}/${w.n}${w.given < w.n && h ? TL` (you have ${h} with you)` : ''}</span>`; }).join(' · ') +
      ` · <span style="color:${left <= 0 ? 'var(--xp)' : c.gold > 0 ? 'var(--txt)' : '#ff9a7a'}">${TL`Wages ${r.paid}/${wage} gold`}</span>` +
      TL`<br><span style="opacity:.7">Stones from the rocks (a Pickaxe) or a quarry, planks from logs (a Saw) or a sawmill. When the work starts: ${roadXp(r.len)} xp.</span></div></div>` +
      TL`<button class="opt" data-road="give" ${rows.some((w) => w.given < w.n && have(w.k) > 0) || (left > 0 && c.gold > 0) ? '' : 'disabled'}>Hand over what I carry and pay the wages</button>` +
      (r.pid === c.pid ? TL`<button class="opt" data-road="drop">Pull up the stakes (the materials and the wages come back)</button>` : '');
  }
  panel().classList.add('wide');
  panel().innerHTML = s + TL`<button class="opt" data-road="close">Close</button>`;
}
export function openRoad(r: PlayerRoad) {
  if (!G.playing || G.dlgOpen || G.packOpen || G.xferOpen) return;
  id = r.id; G.dlgOpen = true; W.talkNpc = null; G.firing = false; for (const k in G.keys) G.keys[k] = false;
  render();
  dlgEl.style.display = 'flex'; if (document.pointerLockElement) document.exitPointerLock();
}
function close() { id = ''; G.dlgOpen = false; dlgEl.style.display = 'none'; if (!G.isTouch) lockPointer(); }
/** Change the track under its lock (alone at once). */
async function withRoad(action: () => void): Promise<boolean> {
  const k = id;
  if (!online()) { action(); return true; }
  const conn = net.id, ok = await lockTown(k, G.char.proads[k], 'proads');
  if (!ok || net.id !== conn) { if (ok && net.id === conn) unlockTown(k, undefined, 'proads'); showToast(tl('Someone else is handing things over at this track. Try again shortly.')); return false; }
  try { action(); return true; }
  finally { unlockTown(k, G.char.proads[k], 'proads'); }
}
/** Clicks in the track window; true when handled. */
export function roadClick(t: HTMLElement): boolean {
  if (!id) return false;
  const b = t.closest('[data-road]') as HTMLElement | null;
  if (!b) return false;
  const a = b.dataset.road, c = G.char;
  if (a === 'close') { close(); return true; }
  if (a === 'give') {
    let msg = '';
    void withRoad(() => {
      const r = road(); if (!r) return;
      const { taken, paid, started } = handOverRoad(r, have, c.gold, c.time);
      for (const [k, n] of taken) takeFrom(k, n, whereHas(k));
      c.gold -= paid;
      msg = taken.length || paid ? tl('Handed over: ') + [...taken.map(([k, n]) => `${ITEMS[k].name} ×${n}`), ...(paid ? [TL`${paid} gold in wages`] : [])].join(', ') + '.' : tl('You carry nothing the track still needs.');
      if (started) {
        gainXp(roadXp(r.len));
        showToast(TL`The diggers start on ${r.name}`);
        logLine(TL`Everything is in: the diggers start grading the track ${r.name}. +${roadXp(r.len)} xp`);
        msg += tl(' <b>The diggers start work.</b>');
      }
      redrawRoads(); calcStats(); saveChar();
    }).then(() => render(msg));
    return true;
  }
  if (a === 'drop') {
    void withRoad(() => {
      const r = road();
      if (!r || r.pid !== c.pid || r.t0 !== undefined) return;
      const lost: string[] = [];
      for (const [k, n] of Object.entries(r.given) as [ItemKey, number][]) { const left = n ? putAway(k, n, at()) : 0; if (left) lost.push(`${ITEMS[k].name} ×${left}`); }
      c.gold += r.paid;
      delete c.proads[r.id];
      logLine(TL`You pull up the stakes of ${r.name} and take back what was brought${lost.length ? TL` (no room for ${lost.join(', ')}: left behind)` : ''}.`);
      redrawRoads(); calcStats(); saveChar();
    }).then(() => close());
    return true;
  }
  return false;
}
