// The village stores (gen/hall.ts, world/hall.ts): the village's stock, at the warehouse's terminal or, in a new
// settlement whose warehouse is not built yet, with the elder (`openStoresHere`, inside the dialogue). Top: what is in
// the hold (take it back out: into your backpack first, then the trunks of your vehicles parked by it) and the
// village's own goods (part of the same stock; the elder shares them). Below: what you have here, in your backpack,
// your vehicles by it and crates set down on its floor, to store (one, or all of a kind, or everything). Only
// materials and goods are kept (`storable`): weapons, medkits, food, tools and clothes go in your own house's chest.
import { vehicles, refreshBays, trunkHere } from '../world/vehicles';
import { unloadCargo, unloadBays, cargoVehicleInside, storable, hallStands } from '../gen/hall';
import { G, W } from '../game';
import { scene } from '../world/render';
import { ITEMS, type ItemKey } from '../data/items';
import { calcStats, saveChar } from '../character';
import { findPoi, villageSeed } from '../gen/regions';
import { hallSpec, hallVol, OWN, holdVol, holdRoom, deposit, withdraw, stockOf, refineStock, sawStock, smeltStock, settleConvoys } from '../gen/hall';
import { hallRect, floorPickups, refreshHall } from '../world/hall';
import { stores, takeFrom, putAway, crates } from './market';
import { $, logLine } from './hud';
import { lockPointer } from './input';
import { itemName } from './icons';
import { tl, TL } from '../i18n';
import { serviceWhy } from './villagestats';
import { racksHTML, rackClick } from './racks';
import { villageRadioHTML, villageRadioClick } from './radio';
import { hubLineHTML, hubLineClick } from './hublines';
import { transitHTML, transitClick } from './transit';
import { villagePadHTML, villagePadClick, airLineHTML, airLineClick } from './airlines';
import { runHub } from '../world/hublines';
import { hubs, villageHub, villageHubName, feeders, waitingAt, drainVillage, cleanHubName } from '../gen/warehouses';
import { lodeById } from '../gen/lodes';

const dlgEl = $('dlg'), panel = () => dlgEl.querySelector('.panel') as HTMLElement;
let vid: number | null = null;
/** Opened from the elder's dialogue (no warehouse yet): his head line, and Back returns to the talk. */
let elderHead: string | null = null;
const at = () => { const r = vid !== null && elderHead === null ? hallRect(vid) : null; return r ? { x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 } : elderHead !== null ? { x: G.pos.x, z: G.pos.z } : null; };
/** Personal things you have on you that the stores will not take (for the note). */
const personal = () => { const ks = new Set<ItemKey>(); for (const x of G.char.inv) if (x && !storable(x.k)) ks.add(x.k); return [...ks]; };
/** What you have here, by item: backpack and trunks by the hall, and what lies on its floor. */
function withYou(): Map<ItemKey, { carried: number; floor: number }> {
  const m = new Map<ItemKey, { carried: number; floor: number }>(), get = (k: ItemKey) => { let e = m.get(k); if (!e) m.set(k, e = { carried: 0, floor: 0 }); return e; };
  for (const s of stores(at())) for (const x of s.slots) if (x && storable(x.k)) get(x.k).carried += x.n;
  for (const L of crates(at())) for (const x of L) if (x?.b && storable(x.b.k)) get(x.b.k).carried += x.b.n; // (0.251) the crate in your hands, the cargo bays
  if (elderHead === null) for (const p of floorPickups(vid!)) if (storable(p.k)) get(p.k).floor++;
  return m;
}

function render(msg = '') {
  if (vid === null) return;
  const c = G.char, poi = findPoi(c.world, vid), st = c.towns[vid];
  if (!poi) return;
  if (st) { refineStock(c.world, poi, villageSeed(c.world, poi), st, c.time); sawStock(c.world, poi, villageSeed(c.world, poi), st, c.time); smeltStock(c.world, poi, villageSeed(c.world, poi), st, c.time); settleConvoys(c.world, poi, villageSeed(c.world, poi), st, c.time); drainVillage(st, vid, c.outposts); runHub('v:' + vid); }
  const hold = Object.entries(st?.hold ?? {}).filter(([, n]) => n) as [ItemKey, number][];
  const seed = villageSeed(c.world, poi), sk = stockOf(c.world, poi, seed, st, c.time);
  const mine = [...withYou()].sort((a, b) => ITEMS[a[0]].name.localeCompare(ITEMS[b[0]].name));
  const elder = elderHead !== null, big = hallSpec(st).h >= 6, other = personal();
  let s = (elder ? elderHead + TL`<div class="role">The village's stores, kept by the elder · ${Math.round(holdVol(st))} / ${hallSpec(st).vol} L</div>`
    : TL`<h2>${poi.name} · ${big ? tl('Warehouse') : tl('Village Hall')}</h2><div class="role">The village's stock · hold ${Math.round(holdVol(st))} / ${Math.round(hallVol(st))} L</div>` + networkHTML(vid, poi.name) + (big ? villageRadioHTML(vid) + hubLineHTML('v:' + vid, (v) => `data-hhl="${v}"`) + villagePadHTML(vid) + airLineHTML('v:' + vid, (v) => `data-hal="${v}"`) + transitHTML('v:' + vid, (v) => `data-htr="${v}"`) : '')) +
    TL`<div class="say">${msg ? msg + '<br><br>' : ''}${elder ? tl('Until we raise a warehouse, bring what the village needs to me: I keep it in my house and the outbuildings. ') : ''}Whatever is stored here belongs to the village: its builds will draw on it. You can take it back out whenever you like.` +
    TL`<br><span style="opacity:.75">Only materials are kept here: wood, stone, ore and metals, parts, crates of goods and what the works make of them. Weapons, ammunition, medkits, food, tools and clothes are yours to keep: leave them in a chest in your own house.${other.length ? TL` (Not taken: ${other.slice(0, 6).map((k) => ITEMS[k].name).join(', ')}${other.length > 6 ? '…' : ''}.)` : ''}</span></div>`;
  s += TL`<div class="say" style="margin:8px 0 0">In the hold</div>` + (hold.length ? hold.sort((a, b) => ITEMS[a[0]].name.localeCompare(ITEMS[b[0]].name)).map(([k, n]) =>
    TL`<div class="shoprow"><div>${itemName(k)} ×${n}</div><button class="opt" style="width:auto" data-hout="${k}" data-hn="1">Take 1</button><button class="opt" style="width:auto" data-hout="${k}" data-hn="999">Take all</button></div>`).join('')
    : tl('<div class="say" style="opacity:.7">Empty.</div>'));
  s += TL`<div class="say" style="margin:8px 0 0">The village's own goods (what its site makes and its farms grow; up to ${OWN.cap} crates of each, then that work stops)</div>` +
    (sk.own.map((g) => `<div class="shoprow"><div>${itemName(g)} ×${Math.floor(sk.ownOf(g))}</div></div>`).join('') || tl('<div class="say" style="opacity:.7">None.</div>')) +
    TL`<div class="say" style="opacity:.8">The village's builds use these too. You buy them at the market, or the elder shares them with friends of the village.</div>`;
  s += TL`<div class="say" style="margin:8px 0 0">With you here (backpack, vehicles ${elder ? tl('nearby') : tl('by the hall, the floor')})</div>` + (mine.length ? mine.map(([k, e]) => {
    const room = holdRoom(st, k), n = e.carried + e.floor;
    return TL`<div class="shoprow"><div>${itemName(k)} ×${n}${e.floor ? TL` <span style="opacity:.7">(${e.floor} on the floor)</span>` : ''}</div><button class="opt" style="width:auto" data-hin="${k}" data-hn="1" ${room ? '' : 'disabled'}>Store 1</button><button class="opt" style="width:auto" data-hin="${k}" data-hn="999" ${room ? '' : 'disabled'}>Store all</button></div>`;
  }).join('') + TL`<button class="opt" data-hall="1">Store everything I have here</button>` : tl('<div class="say" style="opacity:.7">Nothing the village could use.</div>'));
  if (!elder) s += racksHTML(st?.racks, 'data-hrack'); // (0.250) crates and barrels on the racks
  const off = !elder && big ? serviceWhy(vid!, 'warehouse') : ''; // (0.215) no storekeepers or no power
  if (off) s += `<div class="say" style="color:var(--warn,#ff5a3c)">${off} ${tl('Store your goods by hand meanwhile.')}</div>`;
  else if (!elder && big) s += tl('<button class="opt" data-hvehicle="1">Unload vehicles parked inside this warehouse</button><div class="say">Drive in through the wide doors, park fully inside, leave the cab and use this terminal. The materials in the trunk move straight into the hold; anything else stays in the trunk.</div>');
  panel().classList.add('wide');
  panel().innerHTML = `<div data-stock-town="${vid}">` + s + (elder ? tl('<button class="opt" data-hback="1">Back</button>') : tl('<button class="opt" data-hclose="1">Close</button>')) + `</div>`;
}
/** (0.249, PLAN_MAGAZYNOW.md) The warehouse's name in the network (rename it here) and what the carriers bring it from
 *  the deposits of its hex. */
function networkHTML(id: number, vname: string): string {
  const c = G.char, h = hubs(c.world, c.towns, c.outposts).find((q) => q.id === villageHub(id));
  if (!h) return '';
  const from = feeders(h, c.outposts, (q) => lodeById(c.world, q)), wait = waitingAt(h.id, c.outposts, c.towns[id]?.rcv).reduce((a, w) => a + w[3], 0);
  const v = villageHubName({ name: vname } as never, c.towns[id]).replace(/"/g, '&quot;');
  return tl('<div class="say"><b>Name</b>: ') + `<input id="whName" maxlength="28" value="${v}" style="width:14em"> <button class="opt" style="display:inline-block;width:auto;margin:2px 4px" data-hname="1">` + tl('Rename') + '</button><br>' +
    TL`<b>Its area</b> (a hex about a kilometre across): ` + (from.length ? TL`the carriers bring in what ${from.map(([, n]) => n).join(', ')} dig, every two hours while the storekeepers work.` : tl('no deposit is worked in it yet. Outposts staked at deposits in this area send what they dig here on their own.')) +
    (wait ? TL` ${wait} crates wait outside for room in the hold.` : '') + '</div>';
}
/** Store up to n of k: the floor first, then the backpack and the trunks. Returns how many went in. */
function store(k: ItemKey, n: number): number {
  const st = (G.char.towns[vid!] ??= {}), m = deposit(st, k, n);
  let left = m;
  for (const p of elderHead === null ? floorPickups(vid!) : []) {
    if (!left) break;
    if (p.k !== k) continue;
    scene.remove(p.g); W.pickups.splice(W.pickups.indexOf(p), 1); left--;
  }
  if (left) takeFrom(k, left, at());
  return m;
}
/** The elder's stores, inside the open dialogue (a settlement without its warehouse); `back` returns to the talk. */
let backToTalk: (() => void) | null = null;
export function openStoresHere(id: number, head: string, back: () => void) { vid = id; elderHead = head; backToTalk = back; render(); }
/** Whether village `id` keeps its stores with the elder (no store building yet). */
export const storesWithElder = (id: number) => !hallStands(G.char.towns[id]);
export function openHall(id: number) {
  if (!G.playing || G.dlgOpen || G.packOpen || G.xferOpen) return;
  vid = id; elderHead = null; G.dlgOpen = true; W.talkNpc = null; G.firing = false; for (const k in G.keys) G.keys[k] = false;
  render();
  dlgEl.style.display = 'flex'; if (document.pointerLockElement) document.exitPointerLock();
}
function close() { vid = null; elderHead = null; G.dlgOpen = false; dlgEl.style.display = 'none'; if (!G.isTouch) lockPointer(); }
/** Clicks in the hall's window; true when handled. */
export function hallClick(t: HTMLElement): boolean {
  if (vid === null) return false;
  if (t.closest('[data-hclose]')) { close(); return true; }
  if (t.closest('[data-hname]')) { // (0.249) a new name for the warehouse
    const n = cleanHubName((document.getElementById('whName') as HTMLInputElement | null)?.value ?? ''), st = (G.char.towns[vid] ??= {});
    if (n) st.whn = n; else delete st.whn;
    saveChar(); render(n ? TL`It is called ${n} now.` : tl('It goes by the village\'s name again.')); return true;
  }
  const al = t.closest<HTMLElement>('[data-hal]');
  if (al) { runHub('v:' + vid); const m = airLineClick('v:' + vid, al.dataset.hal!); calcStats(); saveChar(); render(m); return true; } // (0.254) the air line
  if (t.closest('[data-hpad]')) { const m = villagePadClick(vid); calcStats(); saveChar(); render(m); return true; } // (0.254) the drone pad
  const tr = t.closest<HTMLElement>('[data-htr]');
  if (tr) { runHub('v:' + vid); const m = transitClick('v:' + vid, tr.dataset.htr!); saveChar(); render(m); return true; } // (0.253) goods passing through
  const hl = t.closest<HTMLElement>('[data-hhl]');
  if (hl) { const m = hubLineClick('v:' + vid, hl.dataset.hhl!); calcStats(); saveChar(); render(m); return true; } // (0.252) the convoy line
  if (t.closest('[data-hradio]')) { const m = villageRadioClick(vid); calcStats(); saveChar(); render(m); return true; } // (0.251) the radio mast
  const rk = t.closest<HTMLElement>('[data-hrack]');
  if (rk) { // (0.250) the racks
    const st = (G.char.towns[vid] ??= {}), m = rackClick((st.racks ??= {}), rk.dataset.hrack!, (k, n) => deposit(st, k, n), holdVol(st), hallVol(st));
    if (!Object.keys(st.racks).length) delete st.racks;
    calcStats(); saveChar(); refreshHall(vid); render(m); return true;
  }
  if (t.closest('[data-hback]')) { vid = null; elderHead = null; const b = backToTalk; backToTalk = null; b?.(); return true; }
  if (t.closest('[data-hvehicle]')) {
    const why = serviceWhy(vid, 'warehouse'); // (0.215) no storekeepers or no power: carry the goods in by hand
    if (why) { render(why + ' ' + tl('Store your goods by hand meanwhile.')); return true; }
    const r = hallRect(vid), st = (G.char.towns[vid] ??= {}); let n = 0;
    if (r && hallSpec(st).h >= 6) for (const v of vehicles) { const t = trunkHere(v); if (t && cargoVehicleInside(r, v.st, v.spec)) { n += unloadCargo(st, t.items) + unloadBays(st, t.bays); refreshBays(v); } }
    calcStats(); saveChar(); refreshHall(vid); render(n ? TL`Unloaded ${n} items directly from vehicle trunks.` : tl('Park your vehicle fully inside, or make room in the hold.')); return true;
  }
  const out = t.closest<HTMLElement>('[data-hout]'), inn = t.closest<HTMLElement>('[data-hin]'), all = t.closest('[data-hall]');
  if (!out && !inn && !all) return false;
  const st = (G.char.towns[vid] ??= {});
  let msg = '';
  if (out) {
    const k = out.dataset.hout as ItemKey, n = withdraw(st, k, +out.dataset.hn!), left = putAway(k, n, at(), false);
    if (left) deposit(st, k, left);
    msg = n - left ? TL`Took ${n - left} × ${ITEMS[k].name}.` : tl('No room in your backpack or vehicles.');
    if (left && n - left) msg += TL` ${left} stay in the hold (no room).`;
  } else if (inn) {
    const k = inn.dataset.hin as ItemKey, e = withYou().get(k), n = store(k, Math.min(+inn.dataset.hn!, (e?.carried ?? 0) + (e?.floor ?? 0)));
    msg = n ? TL`Stored ${n} × ${ITEMS[k].name}.` : tl('The hold is full.');
  } else {
    const got: string[] = [];
    for (const [k, e] of withYou()) { const n = store(k, e.carried + e.floor); if (n) got.push(`${ITEMS[k].name} ×${n}`); }
    msg = got.length ? TL`Stored ${got.join(', ')}.` : withYou().size ? tl('The hold is full.') : tl('Nothing here the stores take.');
    if (got.length) logLine(TL`Into the village stores: ${got.join(', ')}.`);
  }
  calcStats(); saveChar(); refreshHall(vid); render(msg);
  return true;
}
