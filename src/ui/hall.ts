// The village hall's terminal (gen/hall.ts, world/hall.ts): the village's stock. Top: what is in the hold (take it
// back out: into your backpack first, then the trunks of your vehicles parked by the hall) and the village's own goods
// in its industry storehouse (part of the same stock; the elder shares them). Below: what you have here, in your
// backpack, your vehicles by the hall and crates set down on its floor, to store (one, or all of a kind, or everything).
import { G, W } from '../game';
import { scene } from '../world/render';
import { ITEMS, type ItemKey } from '../data/items';
import { calcStats, saveChar } from '../character';
import { findPoi, villageSeed } from '../gen/regions';
import { HALL, holdVol, holdRoom, deposit, withdraw } from '../gen/hall';
import { profileOf } from '../gen/market';
import { production } from '../gen/industry';
import { storeAt, storeCap } from '../gen/store';
import { hallRect, floorPickups, refreshHall } from '../world/hall';
import { stores, takeFrom, putAway } from './market';
import { $, logLine } from './hud';
import { lockPointer } from './input';

const dlgEl = $('dlg'), panel = () => dlgEl.querySelector('.panel') as HTMLElement;
let vid: number | null = null;
/** Things a village keeps: not weapons, relics, keys or quest items. */
const storable = (k: ItemKey) => !['weapon', 'relic', 'quest'].includes(ITEMS[k].type) && k !== 'key';
const at = () => { const r = vid !== null ? hallRect(vid) : null; return r ? { x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 } : null; };
/** What you have here, by item: backpack and trunks by the hall, and what lies on its floor. */
function withYou(): Map<ItemKey, { carried: number; floor: number }> {
  const m = new Map<ItemKey, { carried: number; floor: number }>(), get = (k: ItemKey) => { let e = m.get(k); if (!e) m.set(k, e = { carried: 0, floor: 0 }); return e; };
  for (const s of stores(at())) for (const x of s.slots) if (x && storable(x.k)) get(x.k).carried += x.n;
  for (const p of floorPickups(vid!)) if (storable(p.k)) get(p.k).floor++;
  return m;
}

function render(msg = '') {
  if (vid === null) return;
  const c = G.char, poi = findPoi(c.world, vid), st = c.towns[vid];
  if (!poi) return;
  const hold = Object.entries(st?.hold ?? {}).filter(([, n]) => n) as [ItemKey, number][];
  const seed = villageSeed(c.world, poi), makes = profileOf(c.world, poi, seed).makes, own = Math.floor(storeAt(seed, st, c.time, production(c.world, poi, seed, st, c.time)));
  const mine = [...withYou()].sort((a, b) => ITEMS[a[0]].name.localeCompare(ITEMS[b[0]].name));
  let s = `<h2>${poi.name} · Village Hall</h2><div class="role">The village's stock · hold ${Math.round(holdVol(st))} / ${HALL.vol} L</div>` +
    `<div class="say">${msg ? msg + '<br><br>' : ''}Whatever is stored here belongs to the village: its builds will draw on it. You can take it back out whenever you like.</div>`;
  s += `<div class="say" style="margin:8px 0 0">In the hold</div>` + (hold.length ? hold.sort((a, b) => ITEMS[a[0]].name.localeCompare(ITEMS[b[0]].name)).map(([k, n]) =>
    `<div class="shoprow"><div><b>${ITEMS[k].name}</b> ×${n}</div><button class="opt" style="width:auto" data-hout="${k}" data-hn="1">Take 1</button><button class="opt" style="width:auto" data-hout="${k}" data-hn="999">Take all</button></div>`).join('')
    : '<div class="say" style="opacity:.7">Empty.</div>');
  s += `<div class="say" style="opacity:.85">The village's own goods in its storehouse: <b>${own}</b> of ${storeCap(st)} crates of ${makes.map((g) => ITEMS[g].name).join(' and ') || 'nothing'} (part of the same stock; the elder shares them with friends of the village).</div>`;
  s += `<div class="say" style="margin:8px 0 0">With you here (backpack, vehicles by the hall, the floor)</div>` + (mine.length ? mine.map(([k, e]) => {
    const room = holdRoom(st, k), n = e.carried + e.floor;
    return `<div class="shoprow"><div><b>${ITEMS[k].name}</b> ×${n}${e.floor ? ` <span style="opacity:.7">(${e.floor} on the floor)</span>` : ''}</div><button class="opt" style="width:auto" data-hin="${k}" data-hn="1" ${room ? '' : 'disabled'}>Store 1</button><button class="opt" style="width:auto" data-hin="${k}" data-hn="999" ${room ? '' : 'disabled'}>Store all</button></div>`;
  }).join('') + `<button class="opt" data-hall="1">Store everything I have here</button>` : '<div class="say" style="opacity:.7">Nothing the village could use.</div>');
  panel().classList.add('wide');
  panel().innerHTML = s + `<button class="opt" data-hclose="1">Close</button>`;
}
/** Store up to n of k: the floor first, then the backpack and the trunks. Returns how many went in. */
function store(k: ItemKey, n: number): number {
  const st = (G.char.towns[vid!] ??= {}), m = deposit(st, k, n);
  let left = m;
  for (const p of floorPickups(vid!)) {
    if (!left) break;
    if (p.k !== k) continue;
    scene.remove(p.g); W.pickups.splice(W.pickups.indexOf(p), 1); left--;
  }
  if (left) takeFrom(k, left, at());
  return m;
}
export function openHall(id: number) {
  if (!G.playing || G.dlgOpen || G.packOpen || G.xferOpen) return;
  vid = id; G.dlgOpen = true; W.talkNpc = null; G.firing = false; for (const k in G.keys) G.keys[k] = false;
  render();
  dlgEl.style.display = 'flex'; if (document.pointerLockElement) document.exitPointerLock();
}
function close() { vid = null; G.dlgOpen = false; dlgEl.style.display = 'none'; if (!G.isTouch) lockPointer(); }
/** Clicks in the hall's window; true when handled. */
export function hallClick(t: HTMLElement): boolean {
  if (vid === null) return false;
  if (t.closest('[data-hclose]')) { close(); return true; }
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
    msg = got.length ? `Stored ${got.join(', ')}.` : 'The hold is full.';
    if (got.length) logLine(`Into the village hall: ${got.join(', ')}.`);
  }
  calcStats(); saveChar(); refreshHall(vid); render(msg);
  return true;
}
