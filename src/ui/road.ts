// (0.280, PLAN_DROG.md stage D1) The window of a track (gen/playerroads.ts, world/playerroads.ts), opened at the sign
// at either end: what it takes (stone and planks, handed over bit by bit from the backpack and the vehicles parked by
// the sign) and the diggers' wages; once everything is in, how far the work has come; once done, the track itself.
// MP: the track lives in the shared `Char.proads` and every hand-over runs under its lock (the server's `wlock` on
// 'proads'), so two heroes handing over at once never lose a crate.
import { G, W } from '../game';
import { ITEMS, type ItemKey } from '../data/items';
import { calcStats, saveChar, gainXp } from '../character';
import { roadRows, fedOf, foodFor, roadWage, roadXp, handOverRoad, handOverPart, partRows, roadShare, roadBuilt, roadLeft, frontAt, coverOf, doneAt, campWanted, stalled, paceOf, logsReady, MACHINE_X, PROAD, SURFACE_CLS, clsOf, nextCls, startUpgrade, handOverUp, upRows, upWage, upXp, upNeeds, upCover, upFrontAt, upDone, upDoneAt, upStalled, upPace, type PlayerRoad, type RoadPart } from '../gen/playerroads';
import { fmtClock } from '../core/time';
import { FOOD } from '../gen/farms';
import { redrawRoads, endWord, freeHands, roadFront } from '../world/playerroads';
import { carried, takeFrom, putAway } from './market';
import { dropAtFeet } from '../world/drops';
import { $, showToast, logLine } from './hud';
import { lockPointer } from './input';
import { net, online, lockTown, unlockTown } from '../net/client';
import { tl, TL } from '../i18n';

const dlgEl = $('dlg'), panel = () => dlgEl.querySelector('.panel') as HTMLElement;
let id = '';
const road = (): PlayerRoad | undefined => G.char.proads[id];
const at = () => { const r = road(); return r ? { x: r.pts[0][0], z: r.pts[0][1] } : null; };
/** The places your vehicles may stand to hand over from: either end's sign and (0.281) the diggers' camp at the front. */
function spots(): { x: number; z: number }[] {
  const r = road(); if (!r) return [];
  const out = [{ x: r.pts[0][0], z: r.pts[0][1] }, { x: r.pts[r.pts.length - 1][0], z: r.pts[r.pts.length - 1][1] }], f = roadFront(r);
  if (f) out.push(f);
  return out;
}
/** What you carry here: the backpack, and the trunks of the vehicles by a sign or the front. */
function have(k: ItemKey): number { return Math.max(0, ...spots().map((p) => carried(k, p))); }
/** The spot whose vehicles hold most of k, for taking it. */
function whereHas(k: ItemKey) { let best = spots()[0], n = -1; for (const p of spots()) { const m = carried(k, p); if (m > n) { n = m; best = p; } } return best; }
const hrs = (m: number) => (m >= 120 ? TL`${Math.round(m / 60)} h` : TL`${Math.max(1, Math.round(m))} min`);

const rowsHTML = (rows: { k: ItemKey; n: number; given: number }[]) => rows.map((w) => { const h = have(w.k); return `<span style="color:${w.given >= w.n ? 'var(--xp)' : h ? 'var(--txt)' : '#ff9a7a'}">${ITEMS[w.k].name} ${w.given}/${w.n}${w.given < w.n && h ? TL` (you have ${h} with you)` : ''}</span>`; }).join(' · ');
const canGive = (rows: { k: ItemKey; n: number; given: number }[]) => rows.some((w) => w.given < w.n && have(w.k) > 0);
/** (0.283, D4) The crew's food: crates of grain, potatoes, carrots, eggs, milk or meat, counted in food units. */
const FOODS = Object.keys(FOOD.value) as ItemKey[];
function foodHTML(given: Partial<Record<ItemKey, number>>, need: number | undefined): string {
  if (!need) return '';
  const fed = Math.floor(fedOf(given) + 1e-6), h = FOODS.reduce((a, k) => a + have(k) * FOOD.value[k]!, 0);
  return ` · <span style="color:${fed >= need ? 'var(--xp)' : h ? 'var(--txt)' : '#ff9a7a'}">${TL`Food for the crew ${fed}/${need}`}${fed < need && h ? TL` (you have ${Math.floor(h)} with you)` : ''}</span>`;
}
const canFeed = (given: Partial<Record<ItemKey, number>>, need: number | undefined) => !!need && fedOf(given) < need - 1e-6 && FOODS.some((k) => have(k) > 0);
/** (0.281) The crew, the front, the supplies, the camp, the machines and the logs of a D2 track. */
function frontHTML(r: PlayerRoad): string {
  const c = G.char, now = c.time, home = r.home!, f = frontAt(r, now), cov = coverOf(r), stop = stalled(r, now);
  let s = '';
  if (r.t0 === undefined) {
    const free = Math.min(PROAD.crew, Math.floor(freeHands(home, now)));
    s += TL`<b>The crew</b> comes from ${home.name} (${home.d} m from the start): ${free} free hands there now (the work wants at least ${PROAD.minCrew}, takes up to ${PROAD.crew}). `;
    s += TL`The work starts at ${endWord(r.a)} once the supplies cover the first ${Math.min(r.len, PROAD.first)} m (now ${cov} m).`;
  } else {
    s += TL`<b>${r.crew} diggers</b> from ${home.name}${r.has?.mach ? tl(' with a steam grader') : ''}: ${Math.round(f)} m of ${r.len} m done (${Math.floor(roadShare(r, now) * 100)}%), ${Math.round(paceOf(r) * 60)} m an hour. `;
    if (now < (r.fr?.[1] ?? 0)) s += tl('They are pitching their camp. ');
    if (stop === 'supply') s += TL`<span style="color:#ff9a7a">They wait at ${Math.round(f)} m: the supplies brought cover no further. Bring more.</span>`;
    else if (stop === 'camp') s += TL`<span style="color:#ff9a7a">They wait ${PROAD.walk} m from home: too far to walk back each night. Build them a road camp.</span>`;
    else if (Number.isFinite(roadLeft(r, now))) s += TL`Everything is in: done in ${hrs(roadLeft(r, now))}.`;
    else s += TL`The supplies cover ${cov} m: they dig on towards it${campWanted(r) && !r.has?.camp ? TL` (without a road camp no further than ${PROAD.walk} m from home)` : ''}.`;
  }
  if (r.wet) s += TL`<br>Swamp to fill on the way: ${r.wet} m (more stone).`;
  return s;
}
function partHTML(r: PlayerRoad, k: RoadPart): string {
  const done = !!r.has?.[k], rows = partRows(r, k), name = k === 'camp' ? tl('Road camp') : tl('Steam grader');
  const what = k === 'camp' ? TL`bunks and a cookhouse at the front: the diggers go on past ${PROAD.walk} m from home` : TL`a grader and a dump cart from the Heavy Engineering Works: the front moves ×${MACHINE_X}`;
  if (done) return `<div class="shoprow"><div><b>${name}</b> · <span style="color:var(--xp)">${tl('built')}</span> · ${what}</div></div>`;
  return `<div class="shoprow"><div><b>${name}</b> · ${what}<br>${rowsHTML(rows)}</div><button class="buy" data-road="${k}" ${canGive(rows) ? '' : 'disabled'}>${tl('Hand over')}</button></div>`;
}
/** (0.282, D3) The surface and laying the next one. */
function surfaceHTML(r: PlayerRoad): string {
  const c = G.char, now = c.time, u = r.up, cur = u && upDone(r, now) ? u.to : clsOf(r);
  let s = `<div class="say">` + TL`Surface: <b>${SURFACE_CLS[cur].name}</b>.`;
  if (u && !upDone(r, now)) {
    const name = SURFACE_CLS[u.to].name, f = upFrontAt(r, now), stop = upStalled(r, now), rows = upRows(r), wage = upWage(r.len, u.to), left = wage - u.paid;
    if (u.t0 === undefined) s += ' ' + TL`Laying a ${name.toLowerCase()}: the crew from ${r.home?.name ?? tl('nearby')} starts once the supplies cover the first ${Math.min(r.len, PROAD.first)} m (now ${upCover(r)} m).`;
    else {
      s += ' ' + TL`<b>${u.crew} workers</b> lay a ${name.toLowerCase()}: ${Math.round(f)} m of ${r.len} m (${Math.floor(f / r.len * 100)}%), ${Math.round(upPace(r) * 60)} m an hour. `;
      if (stop === 'supply') s += TL`<span style="color:#ff9a7a">They wait at ${Math.round(f)} m: the supplies brought cover no further. Bring more.</span>`;
      else if (stop === 'camp') s += TL`<span style="color:#ff9a7a">They wait ${PROAD.walk} m from home: too far to walk back each night. Build them a road camp.</span>`;
      else if (Number.isFinite(upDoneAt(r))) s += TL`Everything is in: done in ${hrs(upDoneAt(r) - now)}.`;
      else s += TL`The supplies cover ${upCover(r)} m: they dig on towards it.`;
    }
    s += '</div>' + `<div class="shoprow"><div>${rowsHTML(rows)}${foodHTML(u.given, u.food)} · <span style="color:${left <= 0 ? 'var(--xp)' : c.gold > 0 ? 'var(--txt)' : '#ff9a7a'}">${TL`Wages ${u.paid}/${wage} gold`}</span>` +
      TL`<br><span style="opacity:.7">Bring them to either sign or to the crew at the front. When the work starts: ${upXp(r.len, u.to)} xp.</span>` + `</div></div>` +
      TL`<button class="opt" data-road="upgive" ${canGive(rows) || canFeed(u.given, u.food) || (left > 0 && c.gold > 0) ? '' : 'disabled'}>Hand over what I carry and pay the wages</button>`;
    if (r.v === 2) { if (campWanted(r)) s += partHTML(r, 'camp'); s += partHTML(r, 'mach'); }
    return s;
  }
  const nx = nextCls(r, now);
  s += ' ' + (nx ? TL`A ${SURFACE_CLS[nx].name.toLowerCase()} would let vehicles go faster and burn less: it takes ${upNeeds(r.len, nx).map(([k, n]) => `${n} × ${ITEMS[k].name}`).join(', ')}, ${foodFor(r.len, PROAD.upFood[nx])} food for the crew and ${upWage(r.len, nx)} gold in wages.` : tl('The best surface there is.')) + '</div>';
  if (nx) s += TL`<button class="opt" data-road="upnew">Stake out the ${SURFACE_CLS[nx].name.toLowerCase()}</button>`;
  return s;
}
function render(msg = '') {
  const r = road(), c = G.char;
  if (!r) { close(); return; }
  const built = roadBuilt(r, c.time), v2 = r.v === 2;
  let s = TL`<h2>${r.name}</h2><div class="role">${built ? tl('Track') : r.t0 !== undefined ? tl('Track works') : tl('Track site')} · ${r.len} m · from ${endWord(r.a)} to ${endWord(r.b)}</div><div class="say">${msg ? msg + '<br><br>' : ''}`;
  if (built) {
    s += TL`A dirt track ${PROAD.half * 2} m wide: graded flat across, cleared of trees and rocks, kept dry over the swamp pools. Staked out by ${r.by}, finished on ${fmtClock(doneAt(r))}.</div>` + surfaceHTML(r);
  } else if (!v2 && r.t0 !== undefined) {
    const p = roadShare(r, c.time);
    s += TL`The diggers are at work: ${Math.floor(p * 100)}% done, about ${Math.round(p * r.len)} m of ${r.len} m graded. Their camp moves along the front of the work. It will be done in ${hrs(roadLeft(r, c.time))}.</div>`;
  } else {
    const rows = roadRows(r), wage = roadWage(r.len), left = wage - r.paid;
    if (v2) s += frontHTML(r) + '</div>';
    else s += TL`The stakes mark the way. Diggers from the nearby villages will grade a dirt track along it, ${PROAD.half * 2} m wide, once the materials are here and their wages are paid: stone for the culverts and the wet spots, planks for the pegs and the culvert boxes. Anyone can bring them, bit by bit (in your backpack, or in a vehicle parked by either sign). The work takes about ${hrs(r.h * 60)}.</div>`;
    s += `<div class="shoprow"><div>` + rowsHTML(rows) + foodHTML(r.given, r.food) +
      ` · <span style="color:${left <= 0 ? 'var(--xp)' : c.gold > 0 ? 'var(--txt)' : '#ff9a7a'}">${TL`Wages ${r.paid}/${wage} gold`}</span>` +
      TL`<br><span style="opacity:.7">Stones from the rocks (a Pickaxe) or a quarry, planks from logs (a Saw) or a sawmill${r.food ? tl(', and food for the crew: crates of grain, potatoes, carrots, eggs, milk or meat') : ''}. Bring them to either sign or to the diggers at the front, in your backpack or a vehicle. When the work starts: ${roadXp(r.len)} xp.</span></div></div>` +
      TL`<button class="opt" data-road="give" ${canGive(rows) || canFeed(r.given, r.food) || (left > 0 && c.gold > 0) ? '' : 'disabled'}>Hand over what I carry and pay the wages</button>`;
    if (v2) {
      if (campWanted(r)) s += partHTML(r, 'camp');
      s += partHTML(r, 'mach');
    }
    if (r.pid === c.pid && r.t0 === undefined) s += TL`<button class="opt" data-road="drop">Pull up the stakes (the materials and the wages come back)</button>`;
  }
  const logs = logsReady(r, c.time);
  if (logs > 0) s += TL`<button class="opt" data-road="logs">Take the logs felled on the way (${logs})</button>`;
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
      const { taken, paid, started, noCrew } = handOverRoad(r, have, c.gold, c.time, freeHands);
      for (const [k, n] of taken) takeFrom(k, n, whereHas(k));
      c.gold -= paid;
      msg = taken.length || paid ? tl('Handed over: ') + [...taken.map(([k, n]) => `${ITEMS[k].name} ×${n}`), ...(paid ? [TL`${paid} gold in wages`] : [])].join(', ') + '.' : tl('You carry nothing the track still needs.');
      if (started) {
        gainXp(roadXp(r.len));
        showToast(TL`The diggers start on ${r.name}`);
        logLine(TL`Everything is in: the diggers start grading the track ${r.name}. +${roadXp(r.len)} xp`);
        msg += tl(' <b>The diggers start work.</b>');
      }
      if (noCrew) msg += TL` <b>${r.home?.name ?? ''} has no free hands to send: the work waits until people are free there.</b>`;
      redrawRoads(); calcStats(); saveChar();
    }).then(() => render(msg));
    return true;
  }
  if (a === 'upnew') {
    let msg = '';
    void withRoad(() => {
      const r = road(); if (!r) return;
      if (startUpgrade(r, c.time)) { msg = TL`The stakes for a ${SURFACE_CLS[r.up!.to].name.toLowerCase()} go in. Bring the materials and the wages.`; redrawRoads(); saveChar(); }
    }).then(() => render(msg));
    return true;
  }
  if (a === 'upgive') {
    let msg = '';
    void withRoad(() => {
      const r = road(); if (!r?.up) return;
      const { taken, paid, started, noCrew } = handOverUp(r, have, c.gold, c.time, freeHands);
      for (const [k, n] of taken) takeFrom(k, n, whereHas(k));
      c.gold -= paid;
      msg = taken.length || paid ? tl('Handed over: ') + [...taken.map(([k, n]) => `${ITEMS[k].name} ×${n}`), ...(paid ? [TL`${paid} gold in wages`] : [])].join(', ') + '.' : tl('You carry nothing the track still needs.');
      if (started) {
        const what = SURFACE_CLS[r.up.to].name;
        gainXp(upXp(r.len, r.up.to));
        showToast(TL`The crew starts laying the ${what.toLowerCase()}`);
        logLine(TL`Everything needed is in: the crew starts laying the ${what.toLowerCase()} on ${r.name}. +${upXp(r.len, r.up.to)} xp`);
      }
      if (noCrew) msg += TL` <b>${r.home?.name ?? ''} has no free hands to send: the work waits until people are free there.</b>`;
      redrawRoads(); calcStats(); saveChar();
    }).then(() => render(msg));
    return true;
  }
  if (a === 'camp' || a === 'mach') {
    let msg = '';
    void withRoad(() => {
      const r = road(); if (!r) return;
      const { taken, built } = handOverPart(r, a, have, c.time);
      for (const [k, n] of taken) takeFrom(k, n, whereHas(k));
      msg = taken.length ? tl('Handed over: ') + taken.map(([k, n]) => `${ITEMS[k].name} ×${n}`).join(', ') + '.' : tl('You carry nothing it still needs.');
      if (built) {
        const what = a === 'camp' ? tl('The road camp stands at the front.') : tl('The steam grader is at work.');
        msg += ' <b>' + what + '</b>'; logLine(r.name + ": " + what); showToast(what);
      }
      redrawRoads(); calcStats(); saveChar();
    }).then(() => render(msg));
    return true;
  }
  if (a === 'logs') {
    let msg = '';
    void withRoad(() => {
      const r = road(); if (!r) return;
      const n = logsReady(r, c.time); if (!n) return;
      const left = putAway('log', n, whereHas('log'));
      if (left) dropAtFeet({ k: 'log', n: left }); // what finds no room is rolled off at your feet
      r.took = (r.took ?? 0) + n;
      msg = left ? TL`You take ${n - left} logs; ${left} more lie at your feet.` : TL`You take ${n} logs.`;
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
