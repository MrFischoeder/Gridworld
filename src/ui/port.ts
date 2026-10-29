// (0.216, PLAN_PRAD_I_LUDZIE.md stage Z2) The port window, opened at a port's board (or from its dock's window): the
// warehouse, the power source and the grid, bunkhouses, fields and people (the outposts' own rows, ui/outpost.ts), and
// the warehouse's hold. Storing and taking by hand (the backpack) always works; the crane, which unloads your trucks
// parked by the warehouse and your boats at the dock, and loads them from the hold, works only with its whole crew and
// power (gen/ports.ts `portWorks`). Every change runs under the port's lock online (`withOutpost`).
// (0.249, PLAN_MAGAZYNOW.md stage M1) The same window serves a warehouse built in the wilds (kind 'store': no dock, no
// crane, no lines; its storekeepers unload the trucks by it and take in what the deposits of its hex dig), and every
// warehouse can be renamed here.
import { airYardHTML, airYardClick } from './airships';
import { G, W } from '../game';
import { ITEMS, type ItemKey } from '../data/items';
import { calcStats, saveChar, gainXp, packVol } from '../character';
import { putItems } from '../inventory';
import { handOver, partName, hoursOf, xpOf, countOf, choosePower, mayUse, bare, PORT, type OutpostPart } from '../gen/outposts';
import { loadFood } from '../gen/outpostlife';
import { airRoadWhy } from '../world/roadnet';
import { POWER_SRC, loadFuel, settleAll, type PowerKind } from '../gen/grid';
import { FOOD } from '../gen/farms';
import { lodeById } from '../gen/lodes';
import { newPort, portSpots, portId, portProblem, portWorks, portVol, portPut, portTake, portCap } from '../gen/ports';
import { hubs, hexProblem, feeders, waitingAt, cleanHubName } from '../gen/warehouses';
import { storable } from '../gen/hall';
import type { Pier } from '../gen/piers';
import { nearX } from '../gen/regions';
import { BOATS, launchSpot, type BoatKind } from '../gen/boats';
import { PIER } from '../gen/piers';
import { LINE, newLine, isLineShip, shipCap, voyageOf, periodOf, voyageFuel, assignShip, recallShip, fuelShip, shipAt, arriving, lineTargets } from '../gen/shiplines';
import { net } from '../net/client';
import { redrawBoats, inBoat } from '../world/boats';
import { partHTML, powerHTML, peopleHTML, plineHTML, plineClick } from './outpost';
import { linkedHTML } from './radio';
import { hubLineHTML, hubLineClick } from './hublines';
import { transitHTML, transitClick } from './transit';
import { skyLineHTML, skyLineClick } from './skylines';
import { copterYardHTML, copterYardClick } from './copters';
import { airLineHTML, airLineClick } from './airlines';
import { dropWay } from '../gen/transit';
import { racksHTML, rackClick } from './racks';
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
/** (0.249) A warehouse in the wilds (no dock). */
const wild = () => state()?.k === 'store';
const state = () => (open ? G.char.outposts[open.id] : undefined);
const dockOf = () => (open && open.pier ? G.char.piers.find((q) => q.id === open!.pier) : undefined);
/** The warehouse on your copy of the planet: materials, food and fuel are counted from the backpack and the trunks there. */
const at = () => { const o = state(); return o ? { x: nearX(o.x, G.pos.x), z: o.z } : null; };
const small = (op: string, t: string) => `<button class="opt" style="display:inline-block;width:auto;margin:2px 4px" data-port="${op}">${t}</button>`;
const WHY: Record<string, string> = {
  unbuilt: tl('The warehouse is not built yet.'),
  hands: TL`The crane stands: it needs ${PORT.crew} people at the warehouse.`,
  power: TL`The crane stands: the grid met less than ${Math.round(PORT.power * 100)}% of the demand over the last day.`,
};
/** (0.249) The same for a wild warehouse's storekeepers. */
const WHY_WILD: Record<string, string> = {
  unbuilt: tl('The warehouse is not built yet.'),
  hands: TL`The storekeepers are missing: the warehouse needs ${PORT.crew} people at work.`,
  power: TL`The storekeepers stand idle: the grid met less than ${Math.round(PORT.power * 100)}% of the demand over the last day.`,
};
const whyOf = (w: string) => (wild() ? WHY_WILD : WHY)[w];

/** The boats moored at this dock (within 45 m of its head; 0.248: anyone's). */
function boatsHere(p: Pier | undefined) {
  if (!p) return [];
  const hx = p.x + p.dx * p.len, hz = p.z + p.dz * p.len;
  return G.char.boats.filter((b) => Math.hypot(nearX(b.x, hx) - hx, b.z - hz) < 45);
}
/** Your trucks' trunks parked by the warehouse. */
const trunksHere = () => stores(at()).slice(1);
const count = (slots: (Slot | null)[]) => slots.reduce((a, s) => a + (s && storable(s.k) ? s.n : 0), 0);

function holdHTML(id: string): string {
  const c = G.char, o = c.outposts[id], p = dockOf();
  if (!o?.done?.port || (!p && o.k !== 'store')) return '';
  const used = Math.round(portVol(o)), works = portWorks(c.world, c.outposts, id, c.time);
  let s = TL`<div class="say"><b>The hold</b>: ${used} of ${Math.round(portCap(o))} L.<br>`;
  const list = Object.entries(o.hold ?? {}).filter(([, n]) => (n ?? 0) > 0) as [ItemKey, number][];
  s += list.length ? list.map(([k, n]) => `${itemName(k)} ×${n} ` + small(`take:${k}:1`, tl('Take 1')) + small(`take:${k}:${n}`, tl('Take all'))).join('<br>') : tl('Empty.');
  const mine = (Object.entries(G.char.inv.reduce((a, x) => { if (x && storable(x.k)) a[x.k] = (a[x.k] ?? 0) + x.n; return a; }, {} as Record<string, number>)) as [ItemKey, number][]);
  s += '</div>' + racksHTML(o.racks, 'data-port', 'rack:') + (mine.length ? TL`<div class="say">In your backpack: ` + mine.map(([k, n]) => `${itemName(k)} ×${n} ` + small(`put:${k}`, tl('Store'))).join('<br>') + `</div>` + small('putall', tl('Store everything from the backpack')) : '');
  // the crane (a wild warehouse: its storekeepers)
  s += o.k === 'store' ? TL`<div class="say"><b>The storekeepers</b>: ` : TL`<div class="say"><b>The crane</b>: `;
  if (works.why) return s + `<span style="color:#ff6a4a">${whyOf(works.why)}</span>` + tl(' Storing and taking by hand still works.') + '</div>' + carriersHTML(id);
  const boats = boatsHere(p), tr = trunksHere();
  s += o.k === 'store' ? TL`they work (${works.hands} people, ${Math.round(works.power * 100)}% power). They unload the trucks parked by the warehouse and load them from the hold.</div>` : TL`it works (${works.hands} people, ${Math.round(works.power * 100)}% power). It unloads the trucks parked by the warehouse and the boats at the dock, and loads them from the hold.</div>`;
  s += carriersHTML(id);
  const inTrunks = tr.reduce((a, t) => a + count(t.slots), 0), inBoats = boats.reduce((a, b) => a + count(boatHold(b).items), 0);
  s += inTrunks + inBoats ? small('cunload', TL`Unload ${inTrunks + inBoats} crates into the hold`) : o.k === 'store' ? TL`<div class="say" style="opacity:.7">Nothing to unload: park a truck by the warehouse.</div>` : TL`<div class="say" style="opacity:.7">Nothing to unload: park a truck by the warehouse or moor a boat at the dock.</div>`;
  if (list.length) {
    if (tr.length) s += small('cloadt', tl('Load your trucks here from the hold'));
    boats.forEach((b, i) => { s += small(`cloadb:${i}`, TL`Load your ${BOATS[b.k].name.toLowerCase()} from the hold`); });
  }
  return s;
}
const hrs = (m: number) => (m >= 60 ? TL`${Math.floor(m / 60)} h ${Math.round(m % 60)} min` : `${Math.round(m)} min`);
const FATE: Record<string, string> = { ok: tl('sailed'), idle: tl('stayed in port: a crane had no crew or no power'), dry: tl('stayed in port: no diesel'), calm: tl('lay becalmed') };
/** The ships moored at this dock that could take a line (within 60 m of its head; 0.248: anyone's). */
function shipsHere(p: Pier) {
  const hx = p.x + p.dx * p.len, hz = p.z + p.dz * p.len;
  return G.char.boats.filter((b) => isLineShip(b.k) && Math.hypot(nearX(b.x, hx) - hx, b.z - hz) < 60);
}
/** (0.249) What the carriers bring here from the deposits of this warehouse's hex, and its name. */
function carriersHTML(id: string): string {
  const c = G.char, h = hubs(c.world, c.towns, c.outposts).find((q) => q.id === id);
  if (!h) return '';
  const from = feeders(h, c.outposts, (q) => lodeById(c.world, q)), wait = waitingAt(id, c.outposts, c.outposts[id]?.rcv).reduce((a, w) => a + w[3], 0);
  return TL`<div class="say"><b>Its area</b> (a hex about a kilometre across): ` + (from.length ? TL`the carriers bring in what ${from.map(([, n]) => n).join(', ')} dig, every two hours while the storekeepers work.` : tl('no deposit is worked in it yet. Outposts staked at deposits in this area send what they dig here on their own.')) +
    (wait ? TL` ${wait} crates wait outside for room in the hold.` : '') + '</div>';
}
/** (0.249) The name row: rename this warehouse. */
const nameHTML = (o: { name: string }) => { const v = o.name.replace(/"/g, '&quot;'); return tl('<div class="say"><b>Name</b>: ') + `<input id="whName" maxlength="28" value="${v}" style="width:14em"> ` + small('rename', tl('Rename')) + '</div>'; };
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
  if (!o || (!p && o.k !== 'store')) { close(); return; }
  let s = (o.k === 'store' ? TL`<h2>${o.name}</h2><div class="role">A warehouse in the wilds · staked out by ${o.by}${o.o !== 'crew' ? ` · ${ownerName(o.o)}` : ''}</div>` : TL`<h2>${o.name}</h2><div class="role">A port on the dock · founded by ${o.by}${o.o !== 'crew' ? ` · ${ownerName(o.o)}` : ''}</div>`);
  if (msg) s += `<div class="say">${msg}</div>`;
  if (!mayUse(o, myOwner())) s += TL`<div class="say">Founded by ${o.by}. Only they and the partners they let in work it.</div>`;
  else {
    s += o.k === 'store' ? TL`<div class="say" style="opacity:.85">A warehouse in the wilds works like an outpost: it needs its own power and its own people. Build the warehouse, a power source, bunkhouses and fields; settlers come when there are beds and food. Its storekeepers need ${PORT.crew} people and power. It serves its hex: one warehouse to an area.</div>` : TL`<div class="say" style="opacity:.85">A port works like an outpost: it needs its own power and its own people. Build the warehouse, a power source, bunkhouses and fields; settlers come when there are beds and food. The warehouse's crane needs ${PORT.crew} people and power.</div>`;
    s += nameHTML(o);
    const pos = at();
    s += partHTML(o, 'port', pos) + holdHTML(open.id) + partHTML(o, 'power', pos) + powerHTML(open.id, o, pos) + plineHTML(open.id, o, pos) + partHTML(o, 'bunks', pos) + partHTML(o, 'field', pos) + peopleHTML(o, pos) + commuteHTML(open.id, o) + (o.done?.port ? partHTML(o, 'radio', pos) + linkedHTML(open.id) + hubLineHTML(open.id, (v) => `data-port="hl" data-hl="${v}"`) + partHTML(o, 'pad', pos) + airLineHTML(open.id, (v) => `data-port="al" data-al="${v}"`) + partHTML(o, 'amast', pos) + airYardHTML(open.id, (v) => `data-port="ay" data-ay="${v}"`) + skyLineHTML(open.id, (v) => `data-port="sk" data-sk="${v}"`) + copterYardHTML(open.id, (v) => `data-port="cp" data-cp="${v}"`) : '') + (o.done?.port ? lineHTML(open.id) + transitHTML(open.id, (v) => `data-port="tr" data-tr="${v}"`) : '');
    if (bare(o) && (o.o === 'crew' || o.o === myOwner())) s += small('drop', o.k === 'store' ? tl('Pull up the stakes') : tl('Give up the port'));
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
  const [hx, hz] = (() => { const ps = portSpots(p, dryAt); return ps.house; })(), taken = hexProblem(hubs(G.char.world, G.char.towns, G.char.outposts), hx, hz); // (0.249) one warehouse to a hex
  if (taken) return taken;
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
  const typed = a === 'rename' ? cleanHubName((document.getElementById('whName') as HTMLInputElement | null)?.value ?? '') : '';
  if (a === 'rename' && !typed) { render(tl('Give it a name.')); return true; }
  if (a === 'commute') { commuteClick(id, x, (m) => { if (open?.id === id) render(m); }); return true; }
  let msg = '';
  void withOutpost(id, () => {
    const o = c.outposts[id], here = at(), p = dockOf();
    if (!o || (!p && o.k !== 'store') || !mayUse(o, myOwner())) { msg = tl('Not yours to work.'); return; }
    if (a === 'rename') { o.name = typed; msg = TL`It is called ${typed} now.`; return; }
    if (a === 'rack') { // (0.250) the racks
      if (!o.done?.port) return;
      msg = rackClick((o.racks ??= {}), b0.dataset.port!.slice(5), (k, n) => portPut(o, k, n), portVol(o), portCap(o));
      if (!Object.keys(o.racks).length) delete o.racks;
      return;
    }
    msg = tickPort(id);
    if (a === 'ay') { if (o.done?.port) { const m = airYardClick(id, b0.dataset.ay ?? ''); if (m) msg = msg ? msg + ' ' + m : m; } return; } // (0.256) the airship yard
    if (a === 'cp') { if (o.done?.port) { const m = copterYardClick(id, b0.dataset.cp ?? ''); if (m) msg = msg ? msg + ' ' + m : m; } return; } // (0.259) the rotorcraft yard
    if (a === 'sk') { if (o.done?.port) { const m = skyLineClick(id, b0.dataset.sk ?? ''); if (m) msg = msg ? msg + ' ' + m : m; } return; } // (0.258) the airship line
    if (a === 'al') { if (o.done?.port) { const m = airLineClick(id, b0.dataset.al ?? ''); if (m) msg = msg ? msg + ' ' + m : m; } return; } // (0.254) the air line
    if (a === 'tr') { if (o.done?.port) { const m = transitClick(id, b0.dataset.tr ?? ''); if (m) msg = msg ? msg + ' ' + m : m; } return; } // (0.253) goods passing through
    if (a === 'hl') { if (o.done?.port) { const m = hubLineClick(id, b0.dataset.hl ?? ''); if (m) msg = msg ? msg + ' ' + m : m; } return; } // (0.252) the convoy line
    const say = (w: string) => { msg = msg ? msg + ' ' + w : w; };
    const l = o.line;
    if (a === 'lnew' && !l) {
      const to = lineTargets(c.outposts, id).find((q) => q.id === b0.dataset.port!.slice(5));
      if (!to) { say(tl('That port is out of reach.')); return; }
      o.line = newLine(o, to.id, to.o, c.time); say(TL`A cargo line to ${to.o.name} is open. Hand a ship over to sail it.`);
    } else if (!p && /^l(new|give|ship|fuel|recall|all|only)$/.test(a)) { return; // (0.249) a wild warehouse has no dock and no line
    } else if (a === 'lgive' && l && !l.ship) { delete o.line; dropWay(o, 'sl'); say(tl('You give up the line.')); }
    else if (a === 'lship' && l && !l.ship) {
      const b = shipsHere(p!).find((q) => q.id === b0.dataset.port!.slice(6));
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
      const spot = T && p ? launchSpot(k, { ...p, head: PIER.head, headW: PIER.headW, w: PIER.w }, (qx, qz) => { const w = T.water(qx, qz); return w ? w.depth : null; }) : null;
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
    else if (a === 'give' && (x === 'pad' || x === 'amast') && airRoadWhy(id)) msg = airRoadWhy(id); // (0.283) flying after the roads
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
      if (why) { msg = whyOf(why); return; }
      if (a === 'cunload') {
        let moved = 0;
        for (const box of [...trunksHere().map((t) => t.slots), ...boatsHere(p).map((bt) => boatHold(bt).items)]) for (let i = 0; i < box.length; i++) {
          const s = box[i];
          if (!s || !storable(s.k)) continue;
          const m = portPut(o, s.k, s.n); moved += m; s.n -= m; if (s.n <= 0) box[i] = null;
        }
        msg = moved ? (o.k === 'store' ? TL`The storekeepers carry ${moved} crates into the hold.` : TL`The crane swings ${moved} crates into the hold.`) : tl('Nothing fits in the hold.');
      } else {
        const boxes = a === 'cloadt' ? trunksHere().map((t) => t.slots) : [boatHold(boatsHere(p)[+x]).items].filter(Boolean);
        let moved = 0;
        for (const [k, n] of Object.entries(o.hold ?? {}) as [ItemKey, number][]) {
          let left = n;
          for (const box of boxes) if (left > 0) left = putItems(box, k, left);
          if (left < n) { portTake(o, k, n - left); moved += n - left; }
        }
        msg = moved ? (o.k === 'store' ? TL`The storekeepers load ${moved} crates.` : TL`The crane loads ${moved} crates.`) : tl('No room aboard.');
      }
    } else if (a === 'drop' && bare(o) && (o.o === 'crew' || o.o === myOwner())) {
      delete c.outposts[id]; msg = o.k === 'store' ? tl('You pull up the stakes. The ground is open again.') : tl('You give up the port. The dock is just a dock again.');
    }
  }).then((ok) => { if (!ok) return; calcStats(); saveChar(); redrawPorts(); if (open?.id === id) render(msg); });
  return true;
}
