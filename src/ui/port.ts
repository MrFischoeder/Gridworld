// (0.216, PLAN_PRAD_I_LUDZIE.md stage Z2) The port window, opened at a port's board (or from its dock's window): the
// warehouse, the power source and the grid, bunkhouses, fields and people (the outposts' own rows, ui/outpost.ts), and
// the warehouse's hold. Storing and taking by hand (the backpack) always works; the crane, which unloads your trucks
// parked by the warehouse and your boats at the dock, and loads them from the hold, works only with its whole crew and
// power (gen/ports.ts `portWorks`). Every change runs under the port's lock online (`withOutpost`).
import { G, W } from '../game';
import { ITEMS, type ItemKey } from '../data/items';
import { calcStats, saveChar, gainXp, packVol } from '../character';
import { putItems } from '../inventory';
import { handOver, partName, hoursOf, xpOf, countOf, choosePower, mayUse, bare, PORT, type OutpostPart } from '../gen/outposts';
import { loadFood } from '../gen/outpostlife';
import { POWER_SRC, loadFuel, settleAll, type PowerKind } from '../gen/grid';
import { FOOD } from '../gen/farms';
import { lodeById } from '../gen/lodes';
import { newPort, portSpots, portId, portProblem, portWorks, portVol, portPut, portTake } from '../gen/ports';
import { storable } from '../gen/hall';
import type { Pier } from '../gen/piers';
import { nearX } from '../gen/regions';
import { BOATS, launchSpot, type BoatKind } from '../gen/boats';
import { PIER } from '../gen/piers';
import { LINE, newLine, isLineShip, shipCap, voyageOf, periodOf, voyageFuel, assignShip, recallShip, fuelShip, shipAt, arriving, lineTargets } from '../gen/shiplines';
import { net } from '../net/client';
import { redrawBoats, inBoat } from '../world/boats';
import { partHTML, powerHTML, peopleHTML, plineHTML, plineClick } from './outpost';
import { commuteHTML, commuteClick } from './commute';
import { carried, takeFrom, stores } from './market';
import { itemName } from './icons';
import { withOutpost } from './stock';
import { $, showToast, logLine } from './hud';
import { lockPointer } from './input';
import { tellRaids } from '../world/lodes';
import { redrawPorts, dryAt, tickPort } from '../world/ports';
import { boatHold } from '../world/boats';
import { OW } from '../world/overworld';
import { myOwner, ownerName } from '../world/rivals';
import type { Slot } from '../save';
import { tl, TL } from '../i18n';

const dlgEl = $('dlg'), panel = () => dlgEl.querySelector('.panel') as HTMLElement;
let open: { id: string; pier: string } | null = null;
const state = () => (open ? G.char.outposts[open.id] : undefined);
const dockOf = () => (open ? G.char.piers.find((q) => q.id === open!.pier) : undefined);
/** The warehouse on your copy of the planet: materials, food and fuel are counted from the backpack and the trunks there. */
const at = () => { const o = state(); return o ? { x: nearX(o.x, G.pos.x), z: o.z } : null; };
const small = (op: string, t: string) => `<button class="opt" style="display:inline-block;width:auto;margin:2px 4px" data-port="${op}">${t}</button>`;
const WHY: Record<string, string> = {
  unbuilt: tl('The warehouse is not built yet.'),
  hands: TL`The crane stands: it needs ${PORT.crew} people at the warehouse.`,
  power: TL`The crane stands: the grid met less than ${Math.round(PORT.power * 100)}% of the demand over the last day.`,
};

/** Your boats moored at this dock (within 45 m of its head). */
function boatsHere(p: Pier) {
  const hx = p.x + p.dx * p.len, hz = p.z + p.dz * p.len;
  return G.char.boats.filter((b) => b.id.startsWith(`boat:${G.char.pid}:`) && Math.hypot(nearX(b.x, hx) - hx, b.z - hz) < 45);
}
/** Your trucks' trunks parked by the warehouse. */
const trunksHere = () => stores(at()).slice(1);
const count = (slots: (Slot | null)[]) => slots.reduce((a, s) => a + (s && storable(s.k) ? s.n : 0), 0);

function holdHTML(id: string): string {
  const c = G.char, o = c.outposts[id], p = dockOf();
  if (!o?.done?.port || !p) return '';
  const used = Math.round(portVol(o)), works = portWorks(c.world, c.outposts, id, c.time);
  let s = TL`<div class="say"><b>The hold</b>: ${used} of ${PORT.vol} L.<br>`;
  const list = Object.entries(o.hold ?? {}).filter(([, n]) => (n ?? 0) > 0) as [ItemKey, number][];
  s += list.length ? list.map(([k, n]) => `${itemName(k)} ×${n} ` + small(`take:${k}:1`, tl('Take 1')) + small(`take:${k}:${n}`, tl('Take all'))).join('<br>') : tl('Empty.');
  const mine = (Object.entries(G.char.inv.reduce((a, x) => { if (x && storable(x.k)) a[x.k] = (a[x.k] ?? 0) + x.n; return a; }, {} as Record<string, number>)) as [ItemKey, number][]);
  s += '</div>' + (mine.length ? TL`<div class="say">In your backpack: ` + mine.map(([k, n]) => `${itemName(k)} ×${n} ` + small(`put:${k}`, tl('Store'))).join('<br>') + `</div>` + small('putall', tl('Store everything from the backpack')) : '');
  // the crane
  s += TL`<div class="say"><b>The crane</b>: `;
  if (works.why) return s + `<span style="color:#ff6a4a">${WHY[works.why]}</span>` + tl(' Storing and taking by hand still works.') + '</div>';
  const boats = boatsHere(p), tr = trunksHere();
  s += TL`it works (${works.hands} people, ${Math.round(works.power * 100)}% power). It unloads your trucks parked by the warehouse and your boats at the dock, and loads them from the hold.</div>`;
  const inTrunks = tr.reduce((a, t) => a + count(t.slots), 0), inBoats = boats.reduce((a, b) => a + count(boatHold(b).items), 0);
  s += inTrunks + inBoats ? small('cunload', TL`Unload ${inTrunks + inBoats} crates into the hold`) : TL`<div class="say" style="opacity:.7">Nothing to unload: park a truck by the warehouse or moor a boat of yours at the dock.</div>`;
  if (list.length) {
    if (tr.length) s += small('cloadt', tl('Load your trucks here from the hold'));
    boats.forEach((b, i) => { s += small(`cloadb:${i}`, TL`Load your ${BOATS[b.k].name.toLowerCase()} from the hold`); });
  }
  return s;
}
const hrs = (m: number) => (m >= 60 ? TL`${Math.floor(m / 60)} h ${Math.round(m % 60)} min` : `${Math.round(m)} min`);
const FATE: Record<string, string> = { ok: tl('sailed'), idle: tl('stayed in port: a crane had no crew or no power'), dry: tl('stayed in port: no diesel'), calm: tl('lay becalmed') };
/** Your ships moored at this dock that could take a line (within 60 m of its head). */
function shipsHere(p: Pier) {
  const hx = p.x + p.dx * p.len, hz = p.z + p.dz * p.len;
  return G.char.boats.filter((b) => isLineShip(b.k) && b.id.startsWith(`boat:${G.char.pid}:`) && Math.hypot(nearX(b.x, hx) - hx, b.z - hz) < 60);
}
const someoneAboard = (id: string) => (inBoat() && G.char.boats.some((b) => b.id === id)) || [...net.peers.values()].some((q) => q.st?.boat?.[0] === id);
/** The cargo line: open one to another port, hand a ship over, keep a Motor Ship's tank full, choose the goods. */
function lineHTML(id: string): string {
  const c = G.char, o = c.outposts[id], p = dockOf(), l = o?.line;
  if (!o || !p) return '';
  let s = '';
  for (const a of arriving(c.outposts, id)) if (a.n) s += TL`<div class="say">From ${a.name}: ${a.n} crates delivered here wait for the crane.</div>`;
  if (!l) {
    const ts = lineTargets(c.outposts, id);
    return s + TL`<div class="say"><b>Cargo line</b>: a ship of yours can carry this hold's crates to another port on a timetable. It sails only while both ports' cranes have their crew and power.</div>` +
      (ts.length ? ts.slice(0, 5).map((q) => TL`<button class="opt" data-port="lnew:${q.id}">Open a line to ${q.o.name} (${(q.d * LINE.detour / 1000).toFixed(1)} km by sea)</button>`).join('') : TL`<div class="say" style="opacity:.7">No other port within ${LINE.reach / 1000} km. Found one at another dock.</div>`);
  }
  const sh = l.ship;
  s += TL`<div class="say"><b>Cargo line</b> to ${l.toName}: ${l.km} km by sea.`;
  const sent = Object.entries(l.sent).filter(([, n]) => n).map(([g, n]) => `${n} × ${ITEMS[g as ItemKey].name}`).join(', ');
  if (sent) s += TL`<br>Delivered so far: ${sent}.`;
  if (!sh) {
    s += TL`<br>No ship on it. Moor a Sailing Ship or a Motor Ship of yours at this dock (its hold empty, nobody aboard) and hand it over.</div>`;
    s += shipsHere(p).map((b) => TL`<button class="opt" data-port="lship:${b.id}">Hand over your ${BOATS[b.k].name.toLowerCase()} (${shipCap(b.k)} crates a voyage)</button>`).join('');
    return s + small('lgive', tl('Give up the line'));
  }
  const P = periodOf(l, sh.k), at = shipAt(l, c.time), where = at.at === 'home' ? tl('loading here') : at.at === 'out' ? TL`at sea, bound for ${l.toName} (${Math.round(at.p * 100)}%)` : at.at === 'there' ? TL`unloading at ${l.toName}` : TL`at sea, coming back (${Math.round(at.p * 100)}%)`;
  s += TL`<br>Ship: a ${BOATS[sh.k].name.toLowerCase()} (handed over by ${sh.by}), ${shipCap(sh.k)} crates a voyage, ${hrs(voyageOf(l, sh.k))} each way, a round voyage every ${hrs(P)}; now ${where}.`;
  if (BOATS[sh.k].motor) { const need = voyageFuel(l, sh.k); s += TL`<br>Tank: ${Math.round(sh.fuel ?? 0)} of ${BOATS[sh.k].motor!.tank} L, ${need} L a round voyage: ${need ? Math.floor((sh.fuel ?? 0) / need) : 0} more. With you: ${carried('fuel', at0())} canisters.`; }
  else s += TL`<br>Under sail it burns nothing, but ${Math.round(LINE.calm * 100)}% of voyages lie becalmed.`;
  if (l.last) s += TL`<br>Last voyage: ${FATE[l.last[1]]}.`;
  const goods = Object.keys(o.hold ?? {}) as ItemKey[];
  s += `<br>` + (l.only ? TL`It carries only: ${l.only.map((g) => ITEMS[g].name).join(', ') || tl('nothing')}.` : tl('It carries everything in the hold.')) + `</div>`;
  if (goods.length || l.only) s += `<div class="say">` + (l.only ? small('lall', tl('Carry everything')) : '') + [...new Set([...goods, ...(l.only ?? [])])].map((g) => small(`lonly:${g}`, (l.only?.includes(g) ? '✓ ' : '') + ITEMS[g].name)).join('') + `</div>`;
  return s + (BOATS[sh.k].motor ? small('lfuel', tl('Pour fuel canisters into the ship')) : '') + small('lrecall', tl('Recall the ship (it moors at this dock)'));
}
const at0 = () => at();
function render(msg = '') {
  if (!open) return;
  const o = state(), p = dockOf();
  if (!o || !p) { close(); return; }
  let s = TL`<h2>${o.name}</h2><div class="role">A port on the dock · founded by ${o.by}${o.o !== 'crew' ? ` · ${ownerName(o.o)}` : ''}</div>`;
  if (msg) s += `<div class="say">${msg}</div>`;
  if (!mayUse(o, myOwner())) s += TL`<div class="say">Founded by ${o.by}. Only they and the partners they let in work it.</div>`;
  else {
    s += TL`<div class="say" style="opacity:.85">A port works like an outpost: it needs its own power and its own people. Build the warehouse, a power source, bunkhouses and fields; settlers come when there are beds and food. The warehouse's crane needs ${PORT.crew} people and power.</div>`;
    const pos = at();
    s += partHTML(o, 'port', pos) + holdHTML(open.id) + partHTML(o, 'power', pos) + powerHTML(open.id, o, pos) + plineHTML(open.id, o, pos) + partHTML(o, 'bunks', pos) + partHTML(o, 'field', pos) + peopleHTML(o, pos) + commuteHTML(open.id, o) + (o.done?.port ? lineHTML(open.id) : '');
    if (bare(o) && (o.o === 'crew' || o.o === myOwner())) s += small('drop', tl('Give up the port'));
  }
  panel().classList.add('wide');
  panel().innerHTML = s + TL`<button class="opt" data-port="close">Close</button>`;
}
export function openPort(id: string, pierId: string) {
  if (!G.playing || G.packOpen || G.xferOpen) return;
  open = { id, pier: pierId }; G.dlgOpen = true; W.talkNpc = null; G.firing = false; for (const k in G.keys) G.keys[k] = false;
  render();
  dlgEl.style.display = 'flex'; if (document.pointerLockElement) document.exitPointerLock();
  let news = '';
  void withOutpost(id, () => { news = tickPort(id); }).then((ok) => { if (ok && news) { saveChar(); if (open?.id === id) render(news); } });
}
function close() { open = null; G.dlgOpen = false; dlgEl.style.display = 'none'; if (!G.isTouch) lockPointer(); }
/** Why no port can be founded at this finished dock ('' = it can). */
export function foundProblem(p: Pier): string {
  const T = OW.terrain;
  if (!T) return tl('Not here.');
  const q = { ...p, x: nearX(p.x, G.pos.x) }, why = portProblem(q, (x, z) => T.heightAt(x, z), dryAt);
  return why === 'wet' ? tl('There is no dry ground for a warehouse behind this dock.') : why === 'steep' ? tl('The shore behind this dock is too steep for a warehouse.') : why ? tl('The dock is not finished.') : '';
}
/** Found a port at dock p (from the dock's window); then its window opens. */
export function foundPort(p: Pier) {
  const c = G.char, id = portId(p.id), why = foundProblem(p);
  if (why) { showToast(why); return; }
  void withOutpost(id, () => {
    if (c.outposts[id]) return;
    c.outposts[id] = newPort(c.world, p, c.name || tl('You'), c.time, myOwner(), portSpots(p, dryAt));
    logLine(TL`You founded ${c.outposts[id].name} at your dock. Bring the materials for its warehouse.`); showToast(tl('Port founded'));
  }).then((ok) => { if (!ok) return; saveChar(); redrawPorts(); G.dlgOpen = false; openPort(id, p.id); });
}
/** Clicks in the port window (its own buttons and the outposts' rows it shows); true when handled. */
export function portClick(t: HTMLElement): boolean {
  if (!open) return false;
  const b = (t.closest('[data-port]') ?? t.closest('[data-op]')) as HTMLElement | null;
  if (!b) return false;
  const b0 = b, c = G.char, { id } = open, [a, x, y] = (b.dataset.port ?? b.dataset.op)!.split(':'), byId = (q: string) => lodeById(c.world, q);
  if (a === 'close') { close(); return true; }
  if (a === 'commute') { commuteClick(id, x, (m) => { if (open?.id === id) render(m); }); return true; }
  let msg = '';
  void withOutpost(id, () => {
    const o = c.outposts[id], here = at(), p = dockOf();
    if (!o || !p || !mayUse(o, myOwner())) { msg = tl('Not yours to work.'); return; }
    msg = tickPort(id);
    const say = (w: string) => { msg = msg ? msg + ' ' + w : w; };
    const l = o.line;
    if (a === 'lnew' && !l) {
      const to = lineTargets(c.outposts, id).find((q) => q.id === b0.dataset.port!.slice(5));
      if (!to) { say(tl('That port is out of reach.')); return; }
      o.line = newLine(o, to.id, to.o, c.time); say(TL`A cargo line to ${to.o.name} is open. Hand a ship over to sail it.`);
    } else if (a === 'lgive' && l && !l.ship) { delete o.line; say(tl('You give up the line.')); }
    else if (a === 'lship' && l && !l.ship) {
      const b = shipsHere(p).find((q) => q.id === b0.dataset.port!.slice(6));
      if (!b) { say(tl('Moor it at this dock first.')); return; }
      if (someoneAboard(b.id)) { say(tl('Everyone must be off the ship first.')); return; }
      if (boatHold(b).items.some(Boolean) || boatHold(b).gold > 0) { say(tl('Empty its hold first.')); return; }
      assignShip(l, { id: b.id, k: b.k, ...(b.fuel !== undefined ? { fuel: b.fuel } : {}), by: c.name || tl('You') }, c.time);
      c.boats = c.boats.filter((q) => q.id !== b.id); redrawBoats();
      say(TL`The crew takes your ${BOATS[b.k].name.toLowerCase()} on the line to ${l.toName}. She sails in ${LINE.load} minutes, when both cranes are working.`);
    } else if (a === 'lfuel' && l?.ship) {
      const n = fuelShip(l, carried('fuel', here));
      if (n) takeFrom('fuel', n, here);
      say(n ? TL`Poured ${n} canister${n === 1 ? '' : 's'} into the ship.` : tl('No canisters with you, or the tank is full.'));
    } else if (a === 'lrecall' && l?.ship) {
      const T = OW.terrain, k: BoatKind = l.ship.k;
      const spot = T ? launchSpot(k, { ...p, head: PIER.head, headW: PIER.headW, w: PIER.w }, (qx, qz) => { const w = T.water(qx, qz); return w ? w.depth : null; }) : null;
      if (!spot) { say(tl('The water by this dock is too shallow to moor her.')); return; }
      const sh = recallShip(l)!;
      c.boats.push({ id: sh.id, k: sh.k, x: spot.x, z: spot.z, yaw: spot.yaw, t: c.time, ...(sh.fuel !== undefined ? { fuel: sh.fuel } : {}) }); redrawBoats();
      say(TL`Your ${BOATS[sh.k].name.toLowerCase()} is back and moored alongside the dock.`);
    } else if (a === 'lall' && l) { delete l.only; say(tl('The ship carries everything in the hold.')); }
    else if (a === 'lonly' && l) {
      const g = x as ItemKey, only = l.only ?? [];
      l.only = only.includes(g) ? only.filter((q) => q !== g) : [...only, g];
    }
    else if (a === 'pl' || a === 'unpl') msg = plineClick(id, o, a, x) ?? '';
    else if (a === 'pk') msg = choosePower(o, x as PowerKind) ? TL`You mark out the ground for a ${POWER_SRC[x as PowerKind].name.toLowerCase()}.` : tl('The builders have started on another source already.');
    else if (a === 'give') {
      const part = x as OutpostPart, { taken, started } = handOver(o, part, (k) => carried(k, here), c.time);
      for (const [k, n] of taken) takeFrom(k, n, here);
      msg = taken.length ? tl('Handed over: ') + taken.map(([k, n]) => `${ITEMS[k].name} ×${n}`).join(', ') + '.' : tl('You carry nothing it still needs.');
      if (started) { msg += TL` <b>Everything is here: the builders start on the ${partName(o.k, part, o.pk, countOf(o, part)).toLowerCase()} (${hoursOf(o, part)} h).</b>`; gainXp(xpOf(o, part)); }
    } else if (a === 'fuel' && o.pk && POWER_SRC[o.pk].fuel) {
      const f = POWER_SRC[o.pk].fuel!;
      tellRaids(settleAll(c.world, c.outposts, byId, c.time, c.towns));
      const n = loadFuel(o, carried(f, here), c.time);
      if (n) takeFrom(f, n, here);
      msg = n ? TL`Loaded ${n} × ${ITEMS[f].name} into the bunker.` : TL`No ${ITEMS[f].name} with you, or the bunker is full.`;
    } else if (a === 'food') {
      tellRaids(settleAll(c.world, c.outposts, byId, c.time, c.towns));
      const got: string[] = [];
      for (const k of Object.keys(FOOD.value) as ItemKey[]) { const n = loadFood(c.world, o, k, carried(k, here), c.time); if (n) { takeFrom(k, n, here); got.push(`${ITEMS[k].name} ×${n}`); } }
      msg = got.length ? TL`Into the pantry: ${got.join(', ')}.` : tl('No food with you, or the pantry is full.');
    } else if (a === 'take') { // by hand, into the backpack
      const k = x as ItemKey, want = Math.max(1, +y || 1), n = portTake(o, k, want), left = n ? putItems(c.inv, k, n, packVol()) : 0;
      if (left) portPut(o, k, left);
      msg = n - left ? TL`Taken: ${ITEMS[k].name} ×${n - left}${left ? TL`; ${left} had no room in your backpack` : ''}.` : tl('No room in your backpack.');
    } else if (a === 'put' || a === 'putall') { // by hand, out of the backpack
      let moved = 0;
      for (let i = 0; i < c.inv.length; i++) {
        const s = c.inv[i];
        if (!s || !storable(s.k) || (a === 'put' && s.k !== x)) continue;
        const m = portPut(o, s.k, s.n); moved += m; s.n -= m; if (s.n <= 0) c.inv[i] = null;
      }
      msg = moved ? TL`Stored ${moved} by hand.` : tl('The hold is full.');
    } else if (a === 'cunload' || a === 'cloadt' || a === 'cloadb') {
      const why = portWorks(c.world, c.outposts, id, c.time).why;
      if (why) { msg = WHY[why]; return; }
      if (a === 'cunload') {
        let moved = 0;
        for (const box of [...trunksHere().map((t) => t.slots), ...boatsHere(p).map((bt) => boatHold(bt).items)]) for (let i = 0; i < box.length; i++) {
          const s = box[i];
          if (!s || !storable(s.k)) continue;
          const m = portPut(o, s.k, s.n); moved += m; s.n -= m; if (s.n <= 0) box[i] = null;
        }
        msg = moved ? TL`The crane swings ${moved} crates into the hold.` : tl('Nothing fits in the hold.');
      } else {
        const boxes = a === 'cloadt' ? trunksHere().map((t) => t.slots) : [boatHold(boatsHere(p)[+x]).items].filter(Boolean);
        let moved = 0;
        for (const [k, n] of Object.entries(o.hold ?? {}) as [ItemKey, number][]) {
          let left = n;
          for (const box of boxes) if (left > 0) left = putItems(box, k, left);
          if (left < n) { portTake(o, k, n - left); moved += n - left; }
        }
        msg = moved ? TL`The crane loads ${moved} crates.` : tl('No room aboard.');
      }
    } else if (a === 'drop' && bare(o) && (o.o === 'crew' || o.o === myOwner())) {
      delete c.outposts[id]; msg = tl('You give up the port. The dock is just a dock again.');
    }
  }).then((ok) => { if (!ok) return; calcStats(); saveChar(); redrawPorts(); if (open?.id === id) render(msg); });
  return true;
}
