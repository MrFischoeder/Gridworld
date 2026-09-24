// Vehicle service window (E at the front of a vehicle): slots for every wheel's tire, the engine and its
// upgrade slots, the roof mount, the hull, and the backpack below. Drag parts between the backpack and the
// vehicle, or click one to fit it / take it off. Tires keep their wear when taken off.
import { G } from '../game';
import { item, ITEMS, PACK } from '../data/items';
import { vehicleTitle, immobile, VEHICLES, ENGINE_UPGRADES } from '../data/vehicles';
import { saveChar } from '../character';
import { putSlot, dropStack, roomFor, bulkOf } from '../inventory';
import { refreshParts, type Vehicle } from '../world/vehicles';
import type { Slot } from '../save';
import { $ } from './hud';
import { lockPointer } from './input';
import { slotHTML, bindSlots, itemInfo, parseId } from './slots';

const el = { root: $('svc'), title: $('svcTitle'), sub: $('svcSub'), rows: $('svcRows'), inv: $('svcInv'), detail: $('svcDetail'), msg: $('svcMsg'), close: $('svcClose') };
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
  if (msg !== undefined) el.msg.textContent = msg;
}

// ---------- moving parts ----------
/** Takes one item off backpack slot i (keeping its condition). */
function takeFrom(i: number): Slot | null {
  const s = G.char.inv[i];
  if (!s) return null;
  const one = { ...s, n: 1 };
  if (--s.n <= 0) G.char.inv[i] = null;
  return one;
}
/** A part comes off the vehicle: into backpack slot j if it is free, else anywhere. */
function toPack(s: Slot, j = -1): string {
  if (s.c !== undefined && s.c >= 100) delete s.c;
  if (roomFor(G.char.inv, s.k, PACK.vol) < s.n) return `The ${item(s.k).name.toLowerCase()} is too bulky for your backpack (${Math.floor(PACK.vol - bulkOf(G.char.inv))} of ${PACK.vol} L free).`;
  if (j >= 0 && !G.char.inv[j]) { G.char.inv[j] = s; return ''; }
  if (putSlot(G.char.inv, s) > 0) return `No room in your backpack: the ${item(s.k).name.toLowerCase()} was left behind.`;
  return '';
}
function fitTire(i: number, from: number): string {
  const v = cur!, p = v.st.parts, s = G.char.inv[from];
  if (!s || s.k !== v.spec.wheelItem) return s && (s.k === 'wheelL' || s.k === 'wheelH') ? `The ${item(s.k).name} does not fit the ${vehicleTitle(v.st.model)}.` : '';
  const tire = takeFrom(from)!, old = p.wheels[i];
  p.wheels[i] = tire.c ?? 100;
  let m = `${wheelName(v, i)}: new tire on.`;
  if (old === 0) m += ' The old one was scrap.';
  else if (old > 0) m += ' ' + (toPack({ k: v.spec.wheelItem, n: 1, c: old }, G.char.inv[from] ? -1 : from) || 'Old tire → backpack.');
  return m;
}
function takeTire(i: number, to = -1): string {
  const v = cur!, p = v.st.parts, c = p.wheels[i];
  if (c < 0) return '';
  if (to >= 0 && G.char.inv[to]?.k === v.spec.wheelItem) return fitTire(i, to); // dropped on a spare: swap them
  if (c > 0 && !(to >= 0 && !G.char.inv[to]) && !G.char.inv.includes(null)) return 'Your backpack is full.';
  if (c > 0 && roomFor(G.char.inv, v.spec.wheelItem, PACK.vol) < 1) return `The tire is too bulky for your backpack (${Math.floor(PACK.vol - bulkOf(G.char.inv))} of ${PACK.vol} L free).`;
  p.wheels[i] = -1;
  if (c === 0) return `${wheelName(v, i)}: the wrecked tire went on the scrap heap.`;
  return toPack({ k: v.spec.wheelItem, n: 1, c }, to) || `${wheelName(v, i)}: tire → backpack.`;
}
function fitUpgrade(slot: number, from: number): string {
  const p = cur!.st.parts, s = G.char.inv[from];
  if (!s || !ENGINE_UPGRADES.includes(s.k)) return s ? 'Only engine upgrades go there.' : '';
  if (p.mods.includes(s.k) && p.mods[slot] !== s.k) return `A ${item(s.k).name} is already fitted.`;
  const old = p.mods[slot];
  p.mods[slot] = takeFrom(from)!.k;
  return item(p.mods[slot]!).name + ' fitted.' + (old ? ' ' + (toPack({ k: old, n: 1 }, G.char.inv[from] ? -1 : from) || item(old).name + ' → backpack.') : '');
}
/** Applies backpack item i to the vehicle slot `to`. */
function apply(i: number, to: string): string {
  const v = cur!, p = v.st.parts, s = G.char.inv[i], [w, j] = parseId(to), max = VEHICLES[v.st.model].hull;
  if (!s) return '';
  if (w === 'wh') return fitTire(j, i) || `Only a ${item(v.spec.wheelItem).name} fits there.`;
  if (w === 'em') return fitUpgrade(j, i);
  if (w === 'en') {
    if (s.k !== 'engine') return 'Drop Engine Parts on the engine to repair it.';
    if (p.engine >= 100) return 'The engine is in perfect shape.';
    takeFrom(i); p.engine = Math.min(100, p.engine + 50); return 'Engine repaired.';
  }
  if (w === 'hull') {
    if (s.k !== 'plating') return 'Drop Hull Plating on the hull to patch it.';
    if (p.hull >= max) return 'The hull is in perfect shape.';
    takeFrom(i); p.hull = Math.min(max, Math.max(0, p.hull) + Math.round(max * 0.4)); return p.hull >= max ? 'The hull is as good as new.' : 'Plates bolted on.';
  }
  if (w === 'gun') {
    if (s.k !== 'cannon') return 'Only a Vehicle Cannon fits the roof mount.';
    if (p.gun) return 'A cannon is already mounted.';
    takeFrom(i); p.gun = true; return 'Cannon fitted on the roof. Fire it with the attack button while driving.';
  }
  return '';
}
/** Takes whatever sits in vehicle slot `from` into the backpack (slot `to`, or anywhere). */
function takeOff(from: string, to = -1): string {
  const p = cur!.st.parts, [w, j] = parseId(from);
  if (w === 'wh') return takeTire(j, to);
  if (w === 'em' && p.mods[j]) {
    if (to >= 0 && G.char.inv[to]) return fitUpgrade(j, to);
    const k = p.mods[j]!, m = toPack({ k, n: 1 }, to);
    if (!m) p.mods[j] = null;
    return m || item(k).name + ' → backpack.';
  }
  if (w === 'gun' && p.gun) {
    if (to >= 0 && G.char.inv[to]) return 'Drop it on an empty slot.';
    const m = toPack({ k: 'cannon', n: 1 }, to);
    if (!m) p.gun = false;
    return m || 'Cannon → backpack.';
  }
  if (w === 'en' || w === 'hull') return w === 'en' ? 'The engine stays in; repair it with Engine Parts.' : 'Patch the hull with Hull Plating.';
  return '';
}
/** Click on a backpack part: fit it where it makes the most sense. */
function autoFit(i: number): string {
  const v = cur!, p = v.st.parts, s = G.char.inv[i];
  if (!s) return '';
  if (s.k === v.spec.wheelItem) {
    const worst = p.wheels.reduce((b, c, j) => (c < p.wheels[b] ? j : b), 0);
    if (p.wheels[worst] >= (s.c ?? 100)) return 'Every wheel is in better shape than this tire.';
    return fitTire(worst, i);
  }
  if (s.k === 'engine') return apply(i, 'en');
  if (s.k === 'plating') return apply(i, 'hull');
  if (s.k === 'cannon') return apply(i, 'gun');
  if (ENGINE_UPGRADES.includes(s.k)) { const f = p.mods.indexOf(null); return f < 0 ? 'Both upgrade slots are taken. Take one off first.' : apply(i, 'em:' + f); }
  return `The ${item(s.k).name} is no use on a vehicle.`;
}

const done = (msg: string) => { refreshParts(cur!); saveChar(); render(msg); };
bindSlots(el.root, {
  drop(from, to) {
    if (!cur) return;
    const [fw, i] = parseId(from), [tw, j] = parseId(to);
    if (fw === 'p' && tw === 'p') { dropStack(G.char.inv, i, G.char.inv, j); done(''); return; }
    if (fw === 'p') { done(apply(i, to)); return; }
    if (tw === 'p') { done(takeOff(from, j)); return; }
    if (fw === 'wh' && tw === 'wh') { const w = cur.st.parts.wheels; [w[i], w[j]] = [w[j], w[i]]; done('Tires swapped round.'); return; }
    if (fw === 'em' && tw === 'em') { const m = cur.st.parts.mods; [m[i], m[j]] = [m[j], m[i]]; done(''); return; }
    done('That does not go there.');
  },
  click(id) {
    if (!cur) return;
    const [w, i] = parseId(id);
    done(w === 'p' ? autoFit(i) : takeOff(id));
  },
  hover(id) {
    if (!cur || !id) { el.detail.innerHTML = ''; return; }
    const [w, i] = parseId(id), s = w === 'p' ? G.char.inv[i] : null;
    el.detail.innerHTML = s ? itemInfo(s.k, s.c) : (el.root.querySelector(`[data-id="${id}"]`)?.getAttribute('title') ?? '');
  },
});
el.close.onclick = () => closeService();

export function openService(v: Vehicle) {
  if (!G.playing || G.xferOpen || G.packOpen || G.dlgOpen) return;
  cur = v; G.xferOpen = true; G.firing = false; for (const k in G.keys) G.keys[k] = false;
  el.detail.innerHTML = '';
  render(`Drag parts onto the vehicle or back into your backpack; click a part to fit it or take it off. Mirek sells ${ITEMS[v.spec.wheelItem].name}s, ${ITEMS.engine.name}, ${ITEMS.plating.name}, upgrades and cannons.`);
  el.root.style.display = 'flex';
  if (document.pointerLockElement) document.exitPointerLock();
}
export function closeService() {
  if (!cur) return;
  cur = null; G.xferOpen = false; el.root.style.display = 'none';
  if (!G.isTouch) lockPointer();
}
