// Backpack window: 3 relic modules, the Blaster's attachment slots, your body (what you wear, two weapons on your
// back, what you hold in your hands) and 12 backpack slots.
// Items are dragged between slots (or selected and handled with the buttons under the grid).
import { G } from '../game';
import { item, BULK, PACK, WEAR, WEAR_SLOTS, WEAR_NAME, WEAPON_KIND, HANDS_ONLY, type ItemKey } from '../data/items';
import { BLASTER, SLOT_NAME, attachSlot } from '../data/weapons';
import { calcStats, saveChar, listOf, stowHeld, handsChanged } from '../character';
import { dropStack, bulkOf } from '../inventory';
import { logLine, $ } from './hud';
import { useItem } from '../world/loot';
import { refreshGunLook } from '../world/weapons';
import { lockPointer } from './input';
import { slotHTML, bindSlots, itemInfo, parseId, loadText } from './slots';

let sel: string | null = null;
const loadEl = $('packLoad');
const packEl = $('pack'), invEl = $('inv'), modsEl = $('mods'), gunEl = $('gunSlots'), statsEl = $('gunStats'), detailEl = $('detail'), gearEl = $('gear'), defEl = $('gearDef');
let note = '';

/**
 * Item in a slot: m = modules, w = weapon attachments, p = backpack, g = what you wear (WEAR_SLOTS index),
 * k = your back (two weapons), h = your hands.
 */
function at(id: string): { k: ItemKey; n: number; c?: number } | null {
  const [w, i] = parseId(id), c = G.char;
  if (w === 'm') return c.mods[i] ? { k: c.mods[i]!, n: 1 } : null;
  if (w === 'w') return c.gunMods[i] ? { k: c.gunMods[i]!, n: 1 } : null;
  if (w === 'g') { const k = c.wear[WEAR_SLOTS[i]]; return k ? { k, n: 1 } : null; }
  return listOf(w)[i];
}
function renderPack() {
  const c = G.char, g = G.gun;
  modsEl.innerHTML = c.mods.map((k, i) => slotHTML('m:' + i, { k, hint: 'Relic' }, sel === 'm:' + i)).join('');
  gunEl.innerHTML = BLASTER.slots.map((s, i) => slotHTML('w:' + i, { k: c.gunMods[i], hint: SLOT_NAME[s], cls: 'att' }, sel === 'w:' + i)).join('');
  gearEl.innerHTML = WEAR_SLOTS.map((s, i) => slotHTML('g:' + i, { k: c.wear[s] ?? null, hint: WEAR_NAME[s] }, sel === 'g:' + i)).join('') + '<div></div>' +
    c.back.map((s, i) => slotHTML('k:' + i, { k: s?.k ?? null, hint: 'Back ' + (i + 1), title: s ? undefined : `Back ${i + 1}: a weapon slung on your back (key ${i + 1} draws it)` }, sel === 'k:' + i)).join('') +
    slotHTML('h:0', { k: c.hands[0]?.k ?? null, n: c.hands[0]?.n, c: c.hands[0]?.c, hint: 'Hands', cls: 'held', title: c.hands[0] ? undefined : 'Your hands: the weapon you fight with, or something too big for the backpack' }, sel === 'h:0');
  defEl.textContent = `armour ${Math.round(G.S.def * 100)}% · in hands: ${c.hands[0] ? item(c.hands[0].k).name : 'nothing'}`;
  invEl.innerHTML = c.inv.map((s, i) => slotHTML('p:' + i, { k: s?.k ?? null, n: s?.n, c: s?.c }, sel === 'p:' + i)).join('');
  loadEl.innerHTML = loadText();
  statsEl.textContent = `damage ${(g.dmg * G.S.bm).toFixed(2)} · ${(1 / G.S.rate).toFixed(1)} shots/s · range ${g.range} m · magazine ${g.mag} · reload ${g.reload.toFixed(1)} s · zoom ${g.zoom}×`;
  let html = note || 'Drag items between slots. Weapons go in your hands or on your back, armour and clothes on your body, relics in the modules, attachments in the Blaster slots. Wheels and other big things only fit in your hands.';
  const acts: [string, string][] = [];
  const s = sel ? at(sel) : null;
  if (sel && s) {
    const [w] = parseId(sel), it = item(s.k);
    html = itemInfo(s.k, s.c) + (w === 'm' ? '<br>Equipped in a module' : w === 'w' ? '<br>Fitted to the Blaster' : w === 'g' ? '<br>Worn' : w === 'k' ? '<br>On your back' : w === 'h' ? '<br>In your hands' : '');
    if (w === 'm') acts.push(['off', 'Unequip']);
    else if (w === 'w' || w === 'g') acts.push(['off', 'Take off']);
    else if (w === 'k') acts.push(['hold', 'Take in hands'], ['off', 'Into backpack']);
    else if (w === 'h') { if (it.type === 'cons') acts.push(['use', 'Use']); acts.push(['stow', WEAPON_KIND[s.k] !== undefined ? 'Sling on back' : 'Put away']); }
    else if (it.type === 'relic') acts.push(['on', 'Equip']);
    else if (it.type === 'attach') acts.push(['on', 'Fit to Blaster']);
    else if (it.type === 'wear') acts.push(['on', 'Wear']);
    else if (it.type === 'weapon') acts.push(['hold', 'Take in hands'], ['on', 'Sling on back']);
    else if (it.type === 'cons') acts.push(['use', 'Use']);
    if (w === 'p' || w === 'h' || w === 'k') acts.push(['drop', 'Drop']);
  } else sel = null;
  note = '';
  detailEl.innerHTML = html + (acts.length ? '<div class="acts">' + acts.map(([a, t]) => `<button class="${a === 'drop' ? 'drop' : ''}" data-a="${a}">${t}</button>`).join('') + '</div>' : '');
}
function changed() { calcStats(); refreshGunLook(); handsChanged(); saveChar(); renderPack(); }

/** Whether item k may sit in slot (w, idx). */
function fits(w: string, idx: number, k: ItemKey): boolean {
  if (w === 'p') return !HANDS_ONLY.has(k);
  if (w === 'm') return item(k).type === 'relic';
  if (w === 'w') return attachSlot(k) === BLASTER.slots[idx];
  if (w === 'g') return WEAR[k]?.slot === WEAR_SLOTS[idx];
  if (w === 'k') return WEAPON_KIND[k] !== undefined;
  return true; // hands hold anything
}
function why(w: string, idx: number, k: ItemKey): string {
  if (w === 'p') return `The ${item(k).name} is too big for the backpack: carry it in your hands.`;
  if (w === 'm') return 'Only relics go in the modules.';
  if (w === 'w') return `That does not fit the ${SLOT_NAME[BLASTER.slots[idx]].toLowerCase()} slot.`;
  if (w === 'g') return WEAR[k] ? `That is worn on the ${WEAR_NAME[WEAR[k]!.slot].toLowerCase()}.` : 'You cannot wear that.';
  if (w === 'k') return 'Only weapons go on your back.';
  return '';
}
/** Moves an item between slots, following the rules of each kind of slot. Returns an error message or ''. */
function move(from: string, to: string): string {
  const c = G.char, [fw, i] = parseId(from), [tw, j] = parseId(to), a = at(from), b = at(to);
  if (!a) return '';
  if (!fits(tw, j, a.k)) return why(tw, j, a.k);
  if (b && !fits(fw, i, b.k)) return b && fw === 'p' ? why(fw, i, b.k) : 'Swap it with an empty slot or a matching item instead.';
  if (fw === 'p' && tw === 'p') { dropStack(c.inv, i, c.inv, j); return ''; }
  const vol = (x: { k: ItemKey; n: number } | null) => (x ? BULK[x.k][1] * x.n : 0);
  if (tw === 'p' && bulkOf(c.inv) - vol(b) + vol(a) > PACK.vol + 1e-6) return 'No room for it in your backpack.';
  if (fw === 'p' && b && bulkOf(c.inv) - vol(a) + vol(b) > PACK.vol + 1e-6) return 'No room for it in your backpack.';
  const single = (w: string) => w === 'm' || w === 'w' || w === 'g' || w === 'k';
  const put = (w: string, idx: number, x: { k: ItemKey; n: number; c?: number } | null) => {
    if (w === 'm') c.mods[idx] = x?.k ?? null; else if (w === 'w') c.gunMods[idx] = x?.k ?? null;
    else if (w === 'g') c.wear[WEAR_SLOTS[idx]] = x?.k ?? null;
    else listOf(w)[idx] = x ? { k: x.k, n: x.n, ...(x.c !== undefined ? { c: x.c } : {}) } : null;
  };
  if (single(tw) && a.n > 1) { // taking one item off a stack: the target must be free
    if (b) return 'Take a single item or use an empty slot.';
    a.n--; put(tw, j, { k: a.k, n: 1 }); return '';
  }
  put(tw, j, a); put(fw, i, b);
  return '';
}
/** Sends the selected item to its natural place. */
function quick(id: string, act: string): string {
  const c = G.char, [w] = parseId(id), a = at(id);
  if (!a) return '';
  const toPack = () => { const f = c.inv.indexOf(null); return f < 0 ? 'Your backpack is full.' : move(id, 'p:' + f); };
  if (act === 'hold') {
    const h = c.hands[0];
    if (h && WEAPON_KIND[h.k] === undefined) return `Your hands are full: ${item(h.k).name}. Put it away first.`;
    return move(id, 'h:0'); // what you held takes its place
  }
  if (act === 'stow') { const m = stowHeld(); return m; }
  if (w !== 'p') return toPack();
  const it = item(a.k);
  if (it.type === 'relic') { const f = c.mods.indexOf(null); return f < 0 ? 'All modules are full. Unequip one first.' : move(id, 'm:' + f); }
  if (it.type === 'attach') return move(id, 'w:' + BLASTER.slots.indexOf(attachSlot(a.k)!));
  if (it.type === 'wear') return move(id, 'g:' + WEAR_SLOTS.indexOf(WEAR[a.k]!.slot));
  if (it.type === 'weapon') { const f = c.back.indexOf(null); return f < 0 ? 'Both back slots are taken.' : move(id, 'k:' + f); }
  return '';
}

bindSlots(packEl, {
  drop(from, to) { note = move(from, to); sel = null; changed(); },
  click(id) { sel = sel === id ? null : id; renderPack(); },
});
packEl.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest<HTMLElement>('[data-a]');
  if (!a || !sel) return;
  const [w, i] = parseId(sel), act = a.dataset.a!;
  if (act === 'off' || act === 'on' || act === 'hold' || act === 'stow') { const m = quick(sel, act); if (m) logLine(m); note = m; sel = null; }
  if (act === 'use' && (w === 'p' || w === 'h')) { const s = listOf(w)[i]; if (s) useItem(s.k); }
  if (act === 'drop' && (w === 'p' || w === 'h' || w === 'k')) { listOf(w)[i] = null; sel = null; }
  changed();
});
export function openPack() {
  if (!G.playing || G.packOpen || G.dlgOpen || G.xferOpen) return;
  G.packOpen = true; G.firing = false; for (const k in G.keys) G.keys[k] = false; sel = null; renderPack(); packEl.style.display = 'flex';
  if (document.pointerLockElement) document.exitPointerLock();
}
export function closePack() {
  if (!G.packOpen) return;
  G.packOpen = false; packEl.style.display = 'none';
  if (!G.isTouch) lockPointer();
}
export const togglePack = () => (G.packOpen ? closePack() : openPack());
$('packClose').onclick = closePack;
