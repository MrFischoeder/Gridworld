// Vehicle service: one condition pool, optional upgrades and roof cannon.
import { G } from '../game';
import { item, ITEMS, HANDS_ONLY } from '../data/items';
import { vehicleTitle, immobile, VEHICLES, ENGINE_UPGRADES, FUEL, rangeKm, cansToFill } from '../data/vehicles';
import { saveChar, stowHeld, handsChanged, packVol } from '../character';
import { putSlot, dropStack, roomFor, bulkOf } from '../inventory';
import { refreshParts, type Vehicle } from '../world/vehicles';
import type { Slot } from '../save';
import { $ } from './hud';
import { lockPointer } from './input';
import { slotHTML, bindSlots, itemInfo, parseId } from './slots';

const el = { root: $('svc'), title: $('svcTitle'), sub: $('svcSub'), rows: $('svcRows'), inv: $('svcInv'), body: $('svcBody'), detail: $('svcDetail'), msg: $('svcMsg'), close: $('svcClose') };
let cur: Vehicle | null = null;

const bar = (c: number, max: number) => `<span class="bar"><i style="width:${Math.max(0, c) / max * 100}%;${c / max < 0.35 ? 'background:var(--amber)' : ''}"></i></span>`;

function render(msg?: string) {
  const v = cur!, p = v.st.parts, why = immobile(p), spec = VEHICLES[v.st.model];
  el.title.textContent = vehicleTitle(v.st.model);
  el.sub.textContent = v.spec.role + ' · ' + (why ? "won't move: " + why.toLowerCase() : 'ready to drive');
  let h = '<h3>Vehicle condition and equipment</h3><div class="svcgrid">';
  h += slotHTML('hull', { k: 'plating', text: 'STATE', c: p.hull / spec.hull * 100, fixed: true, cls: 'fixedslot', title: 'One condition pool for the whole vehicle. Drop Hull Plating (+40%), Engine Parts (+50%), a matching tire (+20%) or a Repair Kit (+40%) here.' });
  p.mods.forEach((k, i) => { h += slotHTML('em:' + i, { k, hint: 'Upgrade' }); });
  h += slotHTML('gun', { k: p.gun ? 'cannon' : null, hint: 'Roof', title: p.gun ? undefined : 'Roof mount: Vehicle Cannon' });
  h += '</div>';
  h += `<div class="svcbar">Condition ${bar(p.hull, spec.hull)} ${Math.ceil(p.hull / spec.hull * 100)}%</div>`;
  h += `<div class="svcbar">Fuel ${bar(p.fuel, spec.tank)} ${Math.round(p.fuel)}/${spec.tank} L <span style="opacity:.6">· ~${Math.round(rangeKm(v.st.model, p.fuel))} km${cansToFill(v.st.model, p.fuel) ? ` · ${cansToFill(v.st.model, p.fuel)} canister${cansToFill(v.st.model, p.fuel) > 1 ? 's' : ''} fill it: click a ${ITEMS.fuel.name} (or R by the vehicle)` : ' · full'}</span></div>`;
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
  if (roomFor(G.char.inv, s.k, packVol()) < s.n) return `The ${item(s.k).name.toLowerCase()} is too bulky for your backpack (${Math.floor(packVol() - bulkOf(G.char.inv))} of ${packVol()} L free).`;
  const [L, j] = to ? listOf(to) : [G.char.inv, -1];
  if (L === G.char.inv && j >= 0 && !L[j]) { L[j] = s; return ''; }
  if (putSlot(G.char.inv, s) > 0) return `No room in your backpack: the ${item(s.k).name.toLowerCase()} was left behind.`;
  return '';
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
  if (w === 'em') return fitUpgrade(j, from);
  if (s.k === 'fuel') return pour(from);
  if (w === 'hull') {
    const amount = s.k === 'engine' ? .5 : s.k === v.spec.wheelItem ? .2 : s.k === 'plating' || s.k === 'repairkit' ? .4 : 0;
    if (!amount) return 'Use Hull Plating, Engine Parts, a matching tire or a Vehicle Repair Kit.';
    if (p.hull >= max) return 'Vehicle condition is 100%.';
    takeFrom(from); p.hull = Math.min(max, Math.max(0, p.hull) + max * amount);
    return `Vehicle repaired: condition ${Math.ceil(p.hull / max * 100)}%.`;
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
  if (w === 'hull') return 'Repair the whole vehicle using the condition slot.';
  return '';
}
/** Pours the Fuel Canister in your slot `from` into the tank. */
function pour(from: string): string {
  const v = cur!, p = v.st.parts;
  if (!cansToFill(v.st.model, p.fuel)) return 'The tank is nearly full.';
  takeFrom(from); p.fuel = Math.min(v.spec.tank, p.fuel + FUEL.can);
  return `You pour a canister into the tank: ${Math.round(p.fuel)} of ${v.spec.tank} litres.`;
}
/** Click on one of your parts: fit it where it makes the most sense. */
function autoFit(from: string): string {
  const v = cur!, p = v.st.parts, s = slotAt(from);
  if (!s) return '';
  if (s.k === v.spec.wheelItem || s.k === 'engine' || s.k === 'plating' || s.k === 'repairkit') return apply(from, 'hull');
  if (s.k === 'cannon') return apply(from, 'gun');
  if (s.k === 'fuel') return pour(from);
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
      dropStack(A, i, B, j, B === G.char.inv ? packVol() : undefined, A === G.char.inv ? packVol() : undefined); done(''); return;
    }
    if (mine(from)) { done(apply(from, to)); return; }
    if (mine(to)) { done(takeOff(from, to)); return; }
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
  render(`Repair one shared vehicle condition. Drag repair supplies onto STATE; click equipment to fit it or take it off. Kuba sells ${ITEMS[v.spec.wheelItem].name}s, ${ITEMS.engine.name}, ${ITEMS.plating.name}, upgrades and cannons.`);
  el.root.style.display = 'flex';
  if (document.pointerLockElement) document.exitPointerLock();
}
export function closeService() {
  if (!cur) return;
  cur = null; G.xferOpen = false; el.root.style.display = 'none';
  if (!G.isTouch) lockPointer();
}
