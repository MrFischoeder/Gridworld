// The village stores (gen/hall.ts, world/hall.ts): the village's stock, at the warehouse's terminal or, in a new
// settlement whose warehouse is not built yet, with the elder (`openStoresHere`, inside the dialogue). Top: what is in
// the hold (take it back out: into your backpack first, then the trunks of your vehicles parked by it) and the
// village's own goods (part of the same stock; the elder shares them). Below: what you have here, in your backpack,
// your vehicles by it and crates set down on its floor, to store (one, or all of a kind, or everything). Only
// materials and goods are kept (`storable`): weapons, medkits, food, tools and clothes go in your own house's chest.
import { vehicles } from '../world/vehicles';
import { unloadCargo, cargoVehicleInside, storable, hallStands } from '../gen/hall';
import { G, W } from '../game';
import { scene } from '../world/render';
import { ITEMS, type ItemKey } from '../data/items';
import { calcStats, saveChar } from '../character';
import { findPoi, villageSeed } from '../gen/regions';
import { hallSpec, OWN, holdVol, holdRoom, deposit, withdraw, stockOf, refineStock, sawStock, smeltStock, settleConvoys } from '../gen/hall';
import { hallRect, floorPickups, refreshHall } from '../world/hall';
import { stores, takeFrom, putAway } from './market';
import { $, logLine } from './hud';
import { lockPointer } from './input';
import { itemName } from './icons';

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
  if (elderHead === null) for (const p of floorPickups(vid!)) if (storable(p.k)) get(p.k).floor++;
  return m;
}

function render(msg = '') {
  if (vid === null) return;
  const c = G.char, poi = findPoi(c.world, vid), st = c.towns[vid];
  if (!poi) return;
  if (st) { refineStock(c.world, poi, villageSeed(c.world, poi), st, c.time); sawStock(c.world, poi, villageSeed(c.world, poi), st, c.time); smeltStock(c.world, poi, villageSeed(c.world, poi), st, c.time); settleConvoys(c.world, poi, villageSeed(c.world, poi), st, c.time); }
  const hold = Object.entries(st?.hold ?? {}).filter(([, n]) => n) as [ItemKey, number][];
  const seed = villageSeed(c.world, poi), sk = stockOf(c.world, poi, seed, st, c.time);
  const mine = [...withYou()].sort((a, b) => ITEMS[a[0]].name.localeCompare(ITEMS[b[0]].name));
  const elder = elderHead !== null, big = hallSpec(st).h >= 6, other = personal();
  let s = (elder ? elderHead + `<div class="role">The village's stores, kept by the elder · ${Math.round(holdVol(st))} / ${hallSpec(st).vol} L</div>`
    : `<h2>${poi.name} · ${big ? 'Warehouse' : 'Village Hall'}</h2><div class="role">The village's stock · hold ${Math.round(holdVol(st))} / ${hallSpec(st).vol} L</div>`) +
    `<div class="say">${msg ? msg + '<br><br>' : ''}${elder ? 'Until we raise a warehouse, bring what the village needs to me: I keep it in my house and the outbuildings. ' : ''}Whatever is stored here belongs to the village: its builds will draw on it. You can take it back out whenever you like.` +
    `<br><span style="opacity:.75">Only materials are kept here: wood, stone, ore and metals, parts, crates of goods and what the works make of them. Weapons, ammunition, medkits, food, tools and clothes are yours to keep: leave them in a chest in your own house.${other.length ? ` (Not taken: ${other.slice(0, 6).map((k) => ITEMS[k].name).join(', ')}${other.length > 6 ? '…' : ''}.)` : ''}</span></div>`;
  s += `<div class="say" style="margin:8px 0 0">In the hold</div>` + (hold.length ? hold.sort((a, b) => ITEMS[a[0]].name.localeCompare(ITEMS[b[0]].name)).map(([k, n]) =>
    `<div class="shoprow"><div>${itemName(k)} ×${n}</div><button class="opt" style="width:auto" data-hout="${k}" data-hn="1">Take 1</button><button class="opt" style="width:auto" data-hout="${k}" data-hn="999">Take all</button></div>`).join('')
    : '<div class="say" style="opacity:.7">Empty.</div>');
  s += `<div class="say" style="margin:8px 0 0">The village's own goods (what its site makes and its farms grow; up to ${OWN.cap} crates of each, then that work stops)</div>` +
    (sk.own.map((g) => `<div class="shoprow"><div>${itemName(g)} ×${Math.floor(sk.ownOf(g))}</div></div>`).join('') || '<div class="say" style="opacity:.7">None.</div>') +
    `<div class="say" style="opacity:.8">The village's builds use these too. You buy them at the market, or the elder shares them with friends of the village.</div>`;
  s += `<div class="say" style="margin:8px 0 0">With you here (backpack, vehicles ${elder ? 'nearby' : 'by the hall, the floor'})</div>` + (mine.length ? mine.map(([k, e]) => {
    const room = holdRoom(st, k), n = e.carried + e.floor;
    return `<div class="shoprow"><div>${itemName(k)} ×${n}${e.floor ? ` <span style="opacity:.7">(${e.floor} on the floor)</span>` : ''}</div><button class="opt" style="width:auto" data-hin="${k}" data-hn="1" ${room ? '' : 'disabled'}>Store 1</button><button class="opt" style="width:auto" data-hin="${k}" data-hn="999" ${room ? '' : 'disabled'}>Store all</button></div>`;
  }).join('') + `<button class="opt" data-hall="1">Store everything I have here</button>` : '<div class="say" style="opacity:.7">Nothing the village could use.</div>');
  if (!elder && big) s += '<button class="opt" data-hvehicle="1">Unload vehicles parked inside this warehouse</button><div class="say">Drive in through the wide doors, park fully inside, leave the cab and use this terminal. The materials in the trunk move straight into the hold; anything else stays in the trunk.</div>';
  panel().classList.add('wide');
  panel().innerHTML = `<div data-stock-town="${vid}">` + s + (elder ? '<button class="opt" data-hback="1">Back</button>' : '<button class="opt" data-hclose="1">Close</button>') + `</div>`;
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
  if (t.closest('[data-hback]')) { vid = null; elderHead = null; const b = backToTalk; backToTalk = null; b?.(); return true; }
  if (t.closest('[data-hvehicle]')) {
    const r = hallRect(vid), st = (G.char.towns[vid] ??= {}); let n = 0;
    if (r && hallSpec(st).h >= 6) for (const v of vehicles) if (v.claimed && !v.ai && cargoVehicleInside(r, v.st, v.spec)) n += unloadCargo(st, v.st.trunk.items);
    calcStats(); saveChar(); refreshHall(vid); render(n ? `Unloaded ${n} items directly from vehicle trunks.` : 'Park your vehicle fully inside, or make room in the hold.'); return true;
  }
  const out = t.closest<HTMLElement>('[data-hout]'), inn = t.closest<HTMLElement>('[data-hin]'), all = t.closest('[data-hall]');
  if (!out && !inn && !all) return false;
  const st = (G.char.towns[vid] ??= {});
  let msg = '';
  if (out) {
    const k = out.dataset.hout as ItemKey, n = withdraw(st, k, +out.dataset.hn!), left = putAway(k, n, at(), false);
    if (left) deposit(st, k, left);
    msg = n - left ? `Took ${n - left} × ${ITEMS[k].name}.` : 'No room in your backpack or vehicles.';
    if (left && n - left) msg += ` ${left} stay in the hold (no room).`;
  } else if (inn) {
    const k = inn.dataset.hin as ItemKey, e = withYou().get(k), n = store(k, Math.min(+inn.dataset.hn!, (e?.carried ?? 0) + (e?.floor ?? 0)));
    msg = n ? `Stored ${n} × ${ITEMS[k].name}.` : 'The hold is full.';
  } else {
    const got: string[] = [];
    for (const [k, e] of withYou()) { const n = store(k, e.carried + e.floor); if (n) got.push(`${ITEMS[k].name} ×${n}`); }
    msg = got.length ? `Stored ${got.join(', ')}.` : withYou().size ? 'The hold is full.' : 'Nothing here the stores take.';
    if (got.length) logLine(`Into the village stores: ${got.join(', ')}.`);
  }
  calcStats(); saveChar(); refreshHall(vid); render(msg);
  return true;
}
