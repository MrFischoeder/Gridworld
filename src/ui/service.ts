// Vehicle service window (E at the front of a vehicle): slots for every wheel's tire, the engine and its
// upgrade slots, the roof mount, the hull, and the backpack below. Drag parts between the backpack and the
// vehicle, or click one to fit it / take it off. Tires keep their wear when taken off.
import { G } from '../game';
import { item, ITEMS, PACK, HANDS_ONLY, WEAPON_KIND } from '../data/items';
import { vehicleTitle, immobile, VEHICLES, ENGINE_UPGRADES } from '../data/vehicles';
import { saveChar, stowHeld, handsChanged } from '../character';
import { putSlot, dropStack, roomFor, bulkOf } from '../inventory';
import { refreshParts, type Vehicle } from '../world/vehicles';
import type { Slot } from '../save';
import { $ } from './hud';
import { lockPointer } from './input';
import { slotHTML, bindSlots, itemInfo, parseId } from './slots';

const el = { root: $('svc'), title: $('svcTitle'), sub: $('svcSub'), rows: $('svcRows'), inv: $('svcInv'), body: $('svcBody'), detail: $('svcDetail'), msg: $('svcMsg'), close: $('svcClose') };
let cur: Vehicle | null = null;

function wheelName(v: Vehicle, i: number, short = false) {
  const axle = Math.floor(i / 2), n = v.spec.axles.length, side = i % 2 ? 'right' : 'left';
  const pos = axle === 0 ? 'Front' : axle === n - 1 ? 'Rear' : 'Middle';
  return short ? pos[0] + side[0].toUpperCase() : pos + ' ' + side + ' wheel';
}
const bar = (c: number, max: number) => `<span class="bar"><i style="width:${Math.max(0, c) / max * 100}%;${c / max < 0.35 ? 'background:var(--amber)' : ''}"></i></span>`;

function render(msg?: string) {
  const v = cur!, p = v.st.parts, wk = v.spec.wheelItem, why = immobile(p), spec = VEHICLES[v.st.model];
  el.title.textContent = vehicleTitle(v.st.model);
  el.sub.textContent = v.spec.role + ' · ' + (why ? "won't move: " + why.toLowerCase() : 'ready to drive');
  let h = '<h3>Wheels</h3><div class="svcgrid">';
  for (let a = 0; a < v.spec.axles.length; a++) {
    const lbl = a === 0 ? 'Front axle' : a === v.spec.axles.length - 1 ? 'Rear axle' : 'Middle axle';
    for (const s of [0, 1]) {
      const i = a * 2 + s, c = p.wheels[i];
      h += slotHTML('wh:' + i, c < 0 ? { k: null, hint: wheelName(v, i, true), title: wheelName(v, i) + ': no tire' }
        : { k: wk, c, title: `${wheelName(v, i)}: ${item(wk).name}, ${c === 0 ? 'wrecked' : Math.round(c) + '%'}`, cls: c === 0 ? 'wrecked' : '' });
    }
    h += `<div class="lbl">${lbl}</div><div></div><div></div>`;
  }
  h += '</div><h3>Engine and mounts</h3><div class="svcgrid">';
  h += slotHTML('en', { k: 'engine', text: 'ENG', c: p.engine, fixed: true, cls: 'fixedslot', title: `Engine ${Math.round(p.engine)}%: drop Engine Parts here to repair it (+50%)` });
  p.mods.forEach((k, i) => { h += slotHTML('em:' + i, { k, hint: 'Upgrade', title: k ? undefined : 'Engine upgrade slot: Turbocharger or Engine Guard' }); });
  h += slotHTML('gun', { k: p.gun ? 'cannon' : null, hint: 'Roof', title: p.gun ? undefined : 'Roof mount: Vehicle Cannon' });
  h += slotHTML('hull', { k: 'plating', text: 'HULL', c: p.hull / spec.hull * 100, fixed: true, cls: 'fixedslot', title: `Hull ${Math.ceil(p.hull)}/${spec.hull}: drop Hull Plating here (+40%)` });
  h += '<div></div></div>';
  h += `<div class="svcbar">Hull ${bar(p.hull, spec.hull)} ${Math.max(0, Math.ceil(p.hull))}/${spec.hull} · Engine ${Math.round(p.engine)}%</div>`;
  h += `<div class="svcbar">Fuel ${bar(p.fuel, spec.tank)} ${Math.round(p.fuel)}/${spec.tank} L <span style="opacity:.6">(no need to refuel yet)</span></div>`;
  el.rows.innerHTML = h;
  el.inv.innerHTML = G.char.inv.map((s, i) => slotHTML('p:' + i, { k: s?.k ?? null, n: s?.n, c: s?.c })).join('');
  const held = G.char.hands[0];
  el.body.innerHTML = slotHTML('h:0', { k: held?.k ?? null, n: held?.n, c: held?.c, hint: 'Hands', cls: 'held' });
  if (msg !== undefined) el.msg.textContent = msg;
}

// ---------- moving parts ----------
// Your side of the window is the backpack ("p:i") and your hands ("h:0"): wheels and the cannon only fit in your hands.
const listOf = (id: string): [(Slot | null)[], number] => { const [w, i] = parseId(id); return [w === 'h' ? G.char.hands : G.char.inv, i]; };
const slotAt = (id: string) => { const [L, i] = listOf(id); return L[i] ?? null; };
const mine = (id: string) => id.startsWith('p:') || id.startsWith('h:');
/** Takes one item off your slot `id` (keeping its condition). */
function takeFrom(id: string): Slot | null {
  const [L, i] = listOf(id), s = L[i];
  if (!s) return null;
  const one = { ...s, n: 1 };
  if (--s.n <= 0) L[i] = null;
  return one;
}
/** A part comes off the vehicle: into your hands if it is too big for the backpack, else into slot `to` if free, else anywhere. */
function toPack(s: Slot, to = ''): string {
  if (s.c !== undefined && s.c >= 100) delete s.c;
  if (HANDS_ONLY.has(s.k)) {
    if (G.char.hands[0]) { const m = stowHeld(); if (m) return m; }
    G.char.hands[0] = s; return '';
  }
  if (roomFor(G.char.inv, s.k, PACK.vol) < s.n) return `The ${item(s.k).name.toLowerCase()} is too bulky for your backpack (${Math.floor(PACK.vol - bulkOf(G.char.inv))} of ${PACK.vol} L free).`;
  const [L, j] = to ? listOf(to) : [G.char.inv, -1];
  if (L === G.char.inv && j >= 0 && !L[j]) { L[j] = s; return ''; }
  if (putSlot(G.char.inv, s) > 0) return `No room in your backpack: the ${item(s.k).name.toLowerCase()} was left behind.`;
  return '';
}
function fitTire(i: number, from: string): string {
  const v = cur!, p = v.st.parts, s = slotAt(from);
  if (!s || s.k !== v.spec.wheelItem) return s && (s.k === 'wheelL' || s.k === 'wheelH') ? `The ${item(s.k).name} does not fit the ${vehicleTitle(v.st.model)}.` : '';
  const tire = takeFrom(from)!, old = p.wheels[i];
  p.wheels[i] = tire.c ?? 100;
  let m = `${wheelName(v, i)}: new tire on.`;
  if (old === 0) m += ' The old one was scrap.';
  else if (old > 0) m += ' ' + (toPack({ k: v.spec.wheelItem, n: 1, c: old }) || 'You hold the old tire.');
  return m;
}
function takeTire(i: number, to = ''): string {
  const v = cur!, p = v.st.parts, c = p.wheels[i];
  if (c < 0) return '';
  if (to && slotAt(to)?.k === v.spec.wheelItem) return fitTire(i, to); // dropped on a spare: swap them
  const h = G.char.hands[0];
  if (c > 0 && h && WEAPON_KIND[h.k] === undefined) return `Your hands are full (${item(h.k).name}): put it down or fit it first.`;
  if (c > 0 && h && G.char.back.indexOf(null) < 0 && roomFor(G.char.inv, h.k, PACK.vol) < 1) return 'Free your hands first: there is nowhere to put your weapon.';
  p.wheels[i] = -1;
  if (c === 0) return `${wheelName(v, i)}: the wrecked tire went on the scrap heap.`;
  return toPack({ k: v.spec.wheelItem, n: 1, c }) || `${wheelName(v, i)}: you take the tire in your hands.`;
}
function fitUpgrade(slot: number, from: string): string {
  const p = cur!.st.parts, s = slotAt(from);
  if (!s || !ENGINE_UPGRADES.includes(s.k)) return s ? 'Only engine upgrades go there.' : '';
  if (p.mods.includes(s.k) && p.mods[slot] !== s.k) return `A ${item(s.k).name} is already fitted.`;
  const old = p.mods[slot];
  p.mods[slot] = takeFrom(from)!.k;
  return item(p.mods[slot]!).name + ' fitted.' + (old ? ' ' + (toPack({ k: old, n: 1 }, slotAt(from) ? '' : from) || item(old).name + ' → backpack.') : '');
}
/** Applies your item in slot `from` to the vehicle slot `to`. */
function apply(from: string, to: string): string {
  const v = cur!, p = v.st.parts, s = slotAt(from), [w, j] = parseId(to), max = VEHICLES[v.st.model].hull;
  if (!s) return '';
  if (w === 'wh') return fitTire(j, from) || `Only a ${item(v.spec.wheelItem).name} fits there.`;
  if (w === 'em') return fitUpgrade(j, from);
  if (w === 'en') {
    if (s.k !== 'engine') return 'Drop Engine Parts on the engine to repair it.';
    if (p.engine >= 100) return 'The engine is in perfect shape.';
    takeFrom(from); p.engine = Math.min(100, p.engine + 50); return 'Engine repaired.';
  }
  if (w === 'hull') {
    if (s.k !== 'plating') return 'Drop Hull Plating on the hull to patch it.';
    if (p.hull >= max) return 'The hull is in perfect shape.';
    takeFrom(from); p.hull = Math.min(max, Math.max(0, p.hull) + Math.round(max * 0.4)); return p.hull >= max ? 'The hull is as good as new.' : 'Plates bolted on.';
  }
  if (w === 'gun') {
    if (s.k !== 'cannon') return 'Only a Vehicle Cannon fits the roof mount.';
    if (p.gun) return 'A cannon is already mounted.';
    takeFrom(from); p.gun = true; return 'Cannon fitted on the roof. Fire it with the attack button while driving.';
  }
  return '';
}
/** Takes whatever sits in vehicle slot `from` off: into your slot `to` (or wherever it goes). */
function takeOff(from: string, to = ''): string {
  const p = cur!.st.parts, [w, j] = parseId(from);
  if (w === 'wh') return takeTire(j, to);
  if (w === 'em' && p.mods[j]) {
    if (to && slotAt(to)) return fitUpgrade(j, to);
    const k = p.mods[j]!, m = toPack({ k, n: 1 }, to);
    if (!m) p.mods[j] = null;
    return m || item(k).name + ' → backpack.';
  }
  if (w === 'gun' && p.gun) {
    const m = toPack({ k: 'cannon', n: 1 });
    if (!m) p.gun = false;
    return m || 'You lift the cannon off the roof: it is in your hands.';
  }
  if (w === 'en' || w === 'hull') return w === 'en' ? 'The engine stays in; repair it with Engine Parts.' : 'Patch the hull with Hull Plating.';
  return '';
}
/** Click on one of your parts: fit it where it makes the most sense. */
function autoFit(from: string): string {
  const v = cur!, p = v.st.parts, s = slotAt(from);
  if (!s) return '';
  if (s.k === v.spec.wheelItem) {
    const worst = p.wheels.reduce((b, c, j) => (c < p.wheels[b] ? j : b), 0);
    if (p.wheels[worst] >= (s.c ?? 100)) return 'Every wheel is in better shape than this tire.';
    return fitTire(worst, from);
  }
  if (s.k === 'engine') return apply(from, 'en');
  if (s.k === 'plating') return apply(from, 'hull');
  if (s.k === 'cannon') return apply(from, 'gun');
  if (ENGINE_UPGRADES.includes(s.k)) { const f = p.mods.indexOf(null); return f < 0 ? 'Both upgrade slots are taken. Take one off first.' : apply(from, 'em:' + f); }
  return `The ${item(s.k).name} is no use on a vehicle.`;
}

const done = (msg: string) => { refreshParts(cur!); handsChanged(); saveChar(); render(msg); };
bindSlots(el.root, {
  drop(from, to) {
    if (!cur) return;
    const [fw, i] = parseId(from), [tw, j] = parseId(to);
    if (mine(from) && mine(to)) {
      const [A] = listOf(from), [B] = listOf(to), s = A[i], d = B[j];
      if (B === G.char.inv && s && HANDS_ONLY.has(s.k) || A === G.char.inv && d && HANDS_ONLY.has(d.k)) { done('That is too big for the backpack.'); return; }
      dropStack(A, i, B, j, B === G.char.inv ? PACK.vol : undefined, A === G.char.inv ? PACK.vol : undefined); done(''); return;
    }
    if (mine(from)) { done(apply(from, to)); return; }
    if (mine(to)) { done(takeOff(from, to)); return; }
    if (fw === 'wh' && tw === 'wh') { const w = cur.st.parts.wheels; [w[i], w[j]] = [w[j], w[i]]; done('Tires swapped round.'); return; }
    if (fw === 'em' && tw === 'em') { const m = cur.st.parts.mods; [m[i], m[j]] = [m[j], m[i]]; done(''); return; }
    done('That does not go there.');
  },
  click(id) {
    if (!cur) return;
    done(mine(id) ? autoFit(id) : takeOff(id));
  },
  hover(id) {
    if (!cur || !id) { el.detail.innerHTML = ''; return; }
    const s = mine(id) ? slotAt(id) : null;
    el.detail.innerHTML = s ? itemInfo(s.k, s.c) : (el.root.querySelector(`[data-id="${id}"]`)?.getAttribute('title') ?? '');
  },
});
el.close.onclick = () => closeService();

export function openService(v: Vehicle) {
  if (!G.playing || G.xferOpen || G.packOpen || G.dlgOpen) return;
  cur = v; G.xferOpen = true; G.firing = false; for (const k in G.keys) G.keys[k] = false;
  el.detail.innerHTML = '';
  render(`Drag parts onto the vehicle or back to your hands or backpack; click a part to fit it or take it off (wheels and the cannon come off into your hands). Mirek sells ${ITEMS[v.spec.wheelItem].name}s, ${ITEMS.engine.name}, ${ITEMS.plating.name}, upgrades and cannons.`);
  el.root.style.display = 'flex';
  if (document.pointerLockElement) document.exitPointerLock();
}
export function closeService() {
  if (!cur) return;
  cur = null; G.xferOpen = false; el.root.style.display = 'none';
  if (!G.isTouch) lockPointer();
}
