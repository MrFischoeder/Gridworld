// The window of a dock (a pier: gen/piers.ts, world/piers.ts), opened at its sign on the beach: its length and the
// water at its head, what it takes (handed over bit by bit from the backpack and vehicles parked by it), pulling
// up the stakes of an unfinished one. Once built, its slip: a rowboat, a Sailing Ship or a Motor Ship built bit by
// bit and launched alongside (`launchSpot`); and the refits of your rowboats moored by it (a mast and sail, or an
// outboard: gen/boats.ts `refitsOf`).
import { G, W } from '../game';
import { ITEMS, type ItemKey } from '../data/items';
import { calcStats, saveChar, gainXp, addItem } from '../character';
import { pierRows, handOverPier, pierXp, PIER, type Pier } from '../gen/piers';
import { fmtClock } from '../core/time';
import { redrawPiers, savedPier } from '../world/piers';
import { carried, takeFrom, putAway } from './market';
import { $, showToast, logLine } from './hud';
import { lockPointer } from './input';
import { BOATS, NEW_BOATS, boatRows, handOverBoat, refitsOf, launchSpot, type BoatKind, type Boat } from '../gen/boats';
import { redrawBoats } from '../world/boats';
import { OW } from '../world/overworld';
import { nearX } from '../gen/regions';

/** How many boats you may own. */
export const MAX_BOATS = 3;
const rowsHTML = (rows: { k: ItemKey; n: number; given: number }[]) => rows.map((r) => { const h = have(r.k); return `<span style="color:${r.given >= r.n ? 'var(--xp)' : h ? 'var(--txt)' : '#ff9a7a'}">${ITEMS[r.k].name} ${r.given}/${r.n}${r.given < r.n && h ? ` (you have ${h} with you)` : ''}</span>`; }).join(' · ');
const needsText = (k: BoatKind) => BOATS[k].needs.map(([i, n]) => `${n} ${ITEMS[i].name.toLowerCase()}`).join(', ');
/** The slip: build a boat or a ship at this dock (bit by bit), then it is launched alongside. */
function slip(p: Pier): string {
  const c = G.char, own = c.boats.length;
  let s = `<div class="say" style="margin:8px 0 0"><b>The slip.</b> `;
  if (p.boat) {
    const spec = BOATS[p.boat.k], rows = boatRows(p.boat);
    s += `A ${spec.name.toLowerCase()} is going up: ${spec.blurb}.</div><div class="shoprow"><div>` + rowsHTML(rows) +
      `<br><span style="opacity:.7">On launching: ${spec.xp} xp.</span></div></div>` +
      `<button class="opt" data-pier="bgive" ${rows.some((r) => r.given < r.n && have(r.k) > 0) ? '' : 'disabled'}>Hand over what I carry for the ${spec.name.toLowerCase()}</button>`;
  } else if (own >= MAX_BOATS) s += `You have ${own} boats and ships already: that is as many as you can keep.</div>`;
  else s += `You can build a small boat or a ship here and launch it alongside. The small boat is rowed and can be refitted later with a sail or a motor; a ship carries far more, only sails or steams, and you can walk her deck while she goes.</div>` +
    NEW_BOATS.map((k) => `<button class="opt" data-pier="bnew" data-bk="${k}">Build a ${BOATS[k].name.toLowerCase()} · hold ${BOATS[k].hold} (${needsText(k)})</button>`).join('');
  return s + refits(p);
}
/** Your rowboats moored by this dock (within 40 m of its head), which it can refit. */
function mooredHere(p: Pier): Boat[] {
  const hx = p.x + p.dx * p.len, hz = p.z + p.dz * p.len;
  return G.char.boats.filter((b) => refitsOf(b.k).length && Math.hypot(nearX(b.x, hx) - hx, b.z - hz) < 40);
}
function refits(p: Pier): string {
  const boats = mooredHere(p);
  if (!boats.length) return `<div class="say" style="opacity:.75">Bring a rowboat alongside this dock to refit it with a mast and a sail, or with an outboard motor.</div>`;
  return boats.map((b, i) => {
    const s = BOATS[b.k];
    if (b.refit) {
      const r = BOATS[b.refit.k], rows = boatRows(b.refit);
      return `<div class="say" style="margin:8px 0 0"><b>Refitting your ${s.name.toLowerCase()}</b> as a ${r.name.toLowerCase()}: ${r.blurb}.</div><div class="shoprow"><div>${rowsHTML(rows)}<br><span style="opacity:.7">Done: ${r.xp} xp.</span></div></div>` +
        `<button class="opt" data-pier="rgive" data-bi="${i}" ${rows.some((x) => x.given < x.n && have(x.k) > 0) ? '' : 'disabled'}>Hand over what I carry for the refit</button>`;
    }
    return `<div class="say" style="margin:8px 0 0"><b>Your ${s.name.toLowerCase()}</b> lies by the dock.</div>` +
      refitsOf(b.k).map((k) => `<button class="opt" data-pier="rnew" data-bi="${i}" data-bk="${k}">Refit it as a ${BOATS[k].name.toLowerCase()} · hold ${BOATS[k].hold} (${needsText(k)})</button>`).join('');
  }).join('');
}

const dlgEl = $('dlg'), panel = () => dlgEl.querySelector('.panel') as HTMLElement;
let site: Pier | null = null;
const at = () => (site ? { x: site.x, z: site.z } : null);
const have = (k: ItemKey) => carried(k, at());

function render(msg = '') {
  if (!site) return;
  const p = savedPier(site.id);
  if (!p) return;
  let s = `<h2>${p.done ? 'Dock' : 'Dock site'}</h2><div class="role">On the sea coast · ${Math.round(p.len)} m out to ${PIER.depth} m of water</div><div class="say">${msg ? msg + '<br><br>' : ''}`;
  if (p.done) {
    s += `A timber dock runs out from the beach on piles, ${PIER.clear} m above the sea, to a head with bollards, a lamp and a crate for goods (E at the crate). It was finished on ${fmtClock(p.done)}.</div>` + slip(p);
  } else {
    const rows = pierRows(p);
    s += `Your stakes mark a dock out to deep enough water for boats and ships: piles driven into the sea bed, a planked deck ramping up from the beach, a wide head with bollards, a lamp and a crate. Bring the materials here (in your backpack, or in the trunk of a vehicle parked by the beach) and hand them over bit by bit.</div>` +
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
  if (a === 'bnew' && p.done && !p.boat && c.boats.length < MAX_BOATS) { p.boat = { k: (b.dataset.bk as BoatKind) ?? 'row', given: {} }; saveChar(); render('The keel is laid on the slip.'); return true; }
  if (a === 'bgive' && p.boat) {
    const spec = BOATS[p.boat.k], T = OW.terrain;
    const spot = T ? launchSpot(p.boat.k, { ...p, head: PIER.head, headW: PIER.headW, w: PIER.w }, (x, z) => { const w = T.water(x, z); return w ? w.depth : null; }) : null;
    const { taken, built } = handOverBoat(p.boat, have);
    for (const [k, n] of taken) takeFrom(k, n, at());
    let msg = taken.length ? 'Handed over: ' + taken.map(([k, n]) => `${ITEMS[k].name} ×${n}.`).join(' ') : `You carry nothing the ${spec.name.toLowerCase()} still needs.`;
    if (built && !spot) msg += ` <b>She is finished, but the water alongside this dock is too shallow to float her (${spec.draft} m draught): she waits on the slip. Build a dock out to deeper water.</b>`;
    else if (built && spot) {
      c.boats.push({ id: `boat:${c.pid}:${Math.round(c.time)}:${c.boats.length}`, k: p.boat.k, x: spot.x, z: spot.z, yaw: spot.yaw, t: c.time, ...(spec.motor ? { fuel: Math.min(spec.motor.tank, spec.motor.can) } : {}) }); // an engine comes with a canister in its tank
      delete p.boat; gainXp(spec.xp); redrawBoats();
      showToast(`${spec.name} launched`);
      logLine(`Your ${spec.name.toLowerCase()} slides off the slip and lies alongside the dock. +${spec.xp} xp`);
      msg += ` <b>The ${spec.name.toLowerCase()} is launched: she lies alongside the dock. ${spec.deck !== undefined ? 'Step across onto her deck (or E beside her) and take the wheel aft.' : 'E beside it to get in.'}</b>`;
    }
    calcStats(); saveChar(); render(msg); return true;
  }
  if ((a === 'rnew' || a === 'rgive') && p.done) {
    const boat = mooredHere(p)[+(b.dataset.bi ?? -1)];
    if (!boat) { render('The boat is no longer by the dock.'); return true; }
    if (a === 'rnew') { const k = b.dataset.bk as BoatKind; if (BOATS[k]?.from === boat.k && !boat.refit) boat.refit = { k, given: {} }; saveChar(); render('The boat is hauled up beside the dock for her refit.'); return true; }
    if (!boat.refit) { render(''); return true; }
    const to = BOATS[boat.refit.k], { taken, built } = handOverBoat(boat.refit, have);
    for (const [k, n] of taken) takeFrom(k, n, at());
    let msg = taken.length ? 'Handed over: ' + taken.map(([k, n]) => `${ITEMS[k].name} ×${n}.`).join(' ') : 'You carry nothing the refit still needs.';
    if (built) {
      boat.k = boat.refit.k; delete boat.refit;
      if (to.motor) boat.fuel = Math.max(boat.fuel ?? 0, Math.min(to.motor.tank, to.motor.can));
      gainXp(to.xp); redrawBoats(); showToast(`Refitted: ${to.name}`);
      logLine(`Your boat is refitted as a ${to.name.toLowerCase()}. +${to.xp} xp`);
      msg += ` <b>She is a ${to.name.toLowerCase()} now.</b>`;
    }
    calcStats(); saveChar(); render(msg); return true;
  }
  if (a === 'give') {
    const { taken, built } = handOverPier(p, have, c.time);
    for (const [k, n] of taken) takeFrom(k, n, at());
    let msg = taken.length ? 'Handed over: ' + taken.map(([k, n]) => `${ITEMS[k].name} ×${n}.`).join(' ') : 'You carry nothing the dock still needs.';
    if (built) {
      gainXp(pierXp(p));
      showToast('The dock stands');
      logLine(`The last planks are down and the lamp is lit: your dock reaches ${PIER.depth} m of water. +${pierXp(p)} xp`);
      msg += ' <b>The pier stands.</b>';
    }
    redrawPiers(); calcStats(); saveChar(); render(msg); return true;
  }
  return false;
}
