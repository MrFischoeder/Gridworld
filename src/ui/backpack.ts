// Backpack window: 3 relic modules, the Blaster's attachment slots, your body (what you wear, two weapons on your
// back, what you hold in your hand and (0.201) your other hand: a light or a shield) and 24 backpack slots.
// Items are dragged between slots (or selected and handled with the buttons under the grid).
// Beside it stands a side panel: what lies on the ground around you (ui/ground.ts), or the chest, trunk or locker you
// opened (ui/transfer.ts). Items move between the two by dragging, a click, or the buttons.
import { dropAtFeet } from '../world/drops';
import { G } from '../game';
import { item, BULK, WEAR, WEAR_SLOTS, WEAR_NAME, gearOf, WEAPON_KIND, HANDS_ONLY, HAND_TOOLS, OFF_HAND, TWO_HANDED, type ItemKey } from '../data/items';
import { BLASTER, SLOT_NAME, attachSlot } from '../data/weapons';
import { calcStats, saveChar, listOf, stowHeld, handsChanged, packVol, stowOff, takeInOff, bothHands, settleCrates } from '../character';
import { dropStack, bulkOf, putItems } from '../inventory';
import { isCargo, holds, boxRoom, boxCap, packFrom, takeOut, CARGO, pocketOf } from '../data/cargo';
import type { Slot } from '../save';
import { logLine, $ } from './hud';
import { useItem } from '../world/loot';
import { sawLogs } from '../world/sawing';
import { refreshGunLook } from '../world/weapons';
import { lockPointer } from './input';
import { slotHTML, bindSlots, itemInfo, parseId, loadText } from './slots';
import { tl, TL } from '../i18n';
import { THROWABLES } from '../gen/throwing';
import { readyThrow } from '../world/throwing';
import { packClosed } from '../world/workshop';

/** (0.270) The workshop cells beside the window (ui/workshop.ts registers itself). Slot ids 'x:<cell>'. */
export interface CraftPanel { show(on: boolean): void; render(): void; drop(from: string, to: string): string; click(id: string): string }
let craftUi: CraftPanel | null = null;
export function setCraftPanel(p: CraftPanel) { craftUi = p; }
const isCraft = (id: string) => parseId(id)[0] === 'x';
let sel: string | null = null;
const loadEl = $('packLoad');
const packEl = $('pack'), invEl = $('inv'), modsEl = $('mods'), gunEl = $('gunSlots'), statsEl = $('gunStats'), detailEl = $('detail'), gearEl = $('gear'), defEl = $('gearDef');
let note = '';

/** The panel beside the backpack: its slot ids use `prefix` ('f' the ground, 'b' a container). */
export interface PackSide {
  prefix: string;
  /** (0.247) More slot-id prefixes it answers for (a trunk's cargo bays, 'c'). */
  prefixes?: string[];
  /** Fills the side panel (#sideTitle, #sideGrid...). */
  render(): void;
  /** A drag that starts or ends on the side panel. Returns a message for the detail line (or ''). */
  drop(from: string, to: string): string;
  /** A click on one of its slots. */
  click(id: string): string;
  /** The extra button for a selected backpack / back / hands item, e.g. ['store', 'Store'], and what it does. */
  act?: [string, string];
  doAct?(id: string): string;
  /** The window is closing. */
  close(): void;
}
const sideEl = $('packSide');
let side: PackSide | null = null, ground: PackSide | null = null;
/** ui/ground.ts registers the default side panel. */
export function setGroundSide(s: PackSide) { ground = s; }
const isSide = (id: string) => !!side && (parseId(id)[0] === side.prefix || !!side.prefixes?.includes(parseId(id)[0]));
/** Redraws the whole window (after something changed from outside, e.g. a pickup reached the backpack). */
export function refreshPack() { if (G.packOpen) renderPack(); }
/** The side panel showing now. */
export const packSide = () => side;

/**
 * Item in a slot: m = modules, w = weapon attachments, p = backpack, g = what you wear (WEAR_SLOTS index),
 * k = your back (two weapons), h = your hands, o = your other hand.
 */
function at(id: string): Slot | null {
  const [w, i] = parseId(id), c = G.char;
  if (w === 'm') return c.mods[i] ? { k: c.mods[i]!, n: 1 } : null;
  if (w === 'w') return c.gunMods[i] ? { k: c.gunMods[i]!, n: 1 } : null;
  if (w === 'g') { const k = c.wear[WEAR_SLOTS[i]]; return k ? { k, n: 1 } : null; }
  return listOf(w)[i];
}
function renderPack() {
  const c = G.char, g = G.gun;
  modsEl.innerHTML = c.mods.map((k, i) => slotHTML('m:' + i, { k, hint: tl('Relic') }, sel === 'm:' + i)).join('');
  gunEl.innerHTML = BLASTER.slots.map((s, i) => slotHTML('w:' + i, { k: c.gunMods[i], hint: SLOT_NAME[s], cls: 'att' }, sel === 'w:' + i)).join('');
  gearEl.innerHTML = WEAR_SLOTS.map((s, i) => slotHTML('g:' + i, { k: c.wear[s] ?? null, hint: WEAR_NAME[s] }, sel === 'g:' + i)).join('') + '<div></div>' +
    slotHTML('h:0', { k: c.hands[0]?.k ?? null, n: c.hands[0]?.n, c: c.hands[0]?.c, b: c.hands[0]?.b, hint: tl('Hands'), cls: 'held', title: c.hands[0] ? undefined : tl('Your hands: the weapon you fight with, or something too big for the backpack') }, sel === 'h:0') +
    slotHTML('o:0', { k: c.off[0]?.k ?? null, n: c.off[0]?.n, hint: tl('Other hand'), cls: 'held' + (c.off[0] && bothHands() ? ' idle' : ''), title: c.off[0] ? undefined : tl('Your other hand: a light (flashlight, oil lamp, torches) or a shield, beside a one-handed weapon') }, sel === 'o:0');
  const oh = c.off[0] ? (bothHands() ? TL`${item(c.off[0].k).name} (idle: both hands on the weapon)` : item(c.off[0].k).name) : tl('nothing');
  defEl.textContent = TL`armour ${Math.round(G.S.def * 100)}% · in hands: ${c.hands[0] ? item(c.hands[0].k).name : tl('nothing')}` + ' · ' + TL`other hand: ${oh}`;
  invEl.innerHTML = c.inv.map((s, i) => slotHTML('p:' + i, { k: s?.k ?? null, n: s?.n, c: s?.c, ...(i < 6 ? { key: i + 1, title: s ? undefined : TL`Backpack slot ${i + 1}: keys 1 to 6 take what lies in the first six slots into your hands` } : {}) }, sel === 'p:' + i)).join('');
  loadEl.innerHTML = loadText();
  statsEl.textContent = TL`damage ${(g.dmg * G.S.bm).toFixed(2)} · ${(1 / G.S.rate).toFixed(1)} shots/s · range ${g.range} m · magazine ${g.mag} · reload ${g.reload.toFixed(1)} s · zoom ${g.zoom}×`;
  let html = note || tl('Drag items between slots. Keys 1 to 6 take the item in the first six backpack slots into your hands, swapping what you held (weapons, tools, lights); armour and clothes on your body, relics in the modules, attachments in the Blaster slots. Wheels and other big things only fit in your hands.');
  const acts: [string, string][] = [];
  const s = sel && !isSide(sel) ? at(sel) : null;
  if (sel && s) {
    const [w] = parseId(sel), it = item(s.k);
    html = itemInfo(s.k, s.c) + (w === 'm' ? tl('<br>Equipped in a module') : w === 'w' ? tl('<br>Fitted to the Blaster') : w === 'g' ? tl('<br>Worn') : w === 'k' ? tl('<br>On your back') : w === 'h' ? tl('<br>In your hands') : w === 'o' ? tl('<br>In your other hand') : '')
      + (TWO_HANDED.has(s.k) && (WEAPON_KIND[s.k] !== undefined || HAND_TOOLS.has(s.k)) ? tl('<br>Needs both hands') : '')
      + (isCargo(s.k) ? '<br>' + boxLine(s) : '');
    if (w === 'm') acts.push(['off', tl('Unequip')]);
    else if (w === 'w' || w === 'g') acts.push(['off', tl('Take off')]);
    else if (w === 'k') acts.push(['hold', tl('Take in hands')], ['off', tl('Into backpack')]);
    else if (w === 'h') { if (it.type === 'cons') acts.push(['use', tl('Use')]); if (OFF_HAND.has(s.k)) acts.push(['offh', tl('Into other hand')]); acts.push(['stow', WEAPON_KIND[s.k] !== undefined ? tl('Sling on back') : tl('Put away')]); }
    else if (w === 'o') { if (s.k === 'flashlight' || s.k === 'oillamp' || s.k === 'firebrand') acts.push(['use', tl('Light / put out')]); acts.push(['stowo', tl('Put away')]); }
    else if (OFF_HAND.has(s.k)) { acts.push(['offh', tl('Take in other hand')]); if (it.type === 'cons' || s.k === 'flashlight' || s.k === 'oillamp') acts.push(['use', tl('Use')]); }
    else if (it.type === 'relic') acts.push(['on', tl('Equip')]);
    else if (it.type === 'attach') acts.push(['on', tl('Fit to Blaster')]);
    else if (it.type === 'wear') acts.push(['on', tl('Wear')]);
    else if (it.type === 'weapon') acts.push(['hold', tl('Take in hands')], ['on', tl('Sling on back')]);
    else if (it.type === 'cons') acts.push(['use', tl('Use')]);
    else if (HAND_TOOLS.has(s.k)) acts.push(['hold', tl('Take in hands')]);
    if (THROWABLES.includes(s.k) && (w === 'p' || w === 'h')) acts.push(['throw', tl('Ready to throw (Z)')]); // (0.225) world/throwing.ts
    if (s.k === 'log' && (w === 'p' || w === 'h')) acts.push(['saw', tl('Saw into planks')], ['sawall', tl('Saw all')]); // (world/sawing.ts: a Saw in your kit)
    { const h = c.hands[0]; // (0.247) a crate or a barrel in your hands: fill it from the backpack, or empty it
      if (w === 'p' && h && isCargo(h.k) && boxRoom(h, s.k) > 0) acts.unshift(['pack', TL`Into the ${item(h.k).name}`]); }
    if (w === 'p' || w === 'h' || w === 'k' || w === 'o') acts.push(['drop', tl('Drop')]);
  } else sel = null;
  note = '';
  if (sel && s && side?.act && (parseId(sel)[0] === 'p' || parseId(sel)[0] === 'h' || parseId(sel)[0] === 'k' || parseId(sel)[0] === 'o')) acts.unshift(side.act);
  detailEl.innerHTML = html + (acts.length ? '<div class="acts">' + acts.map(([a, t]) => `<button class="${a === 'drop' ? 'drop' : ''}" data-a="${a}">${t}</button>`).join('') + '</div>' : '');
  side?.render();
  craftUi?.render();
}
function changed() { settleCrates(); calcStats(); refreshGunLook(); handsChanged(); saveChar(); renderPack(); } // (0.251) heaps into crates, empty crates gone

/** Whether item k may sit in slot (w, idx). */
function fits(w: string, idx: number, k: ItemKey): boolean {
  if (w === 'p') return !HANDS_ONLY.has(k);
  if (w === 'm') return item(k).type === 'relic';
  if (w === 'w') return attachSlot(k) === BLASTER.slots[idx];
  if (w === 'g') return WEAR[k]?.slot === WEAR_SLOTS[idx];
  if (w === 'k') return WEAPON_KIND[k] !== undefined;
  if (w === 'o') return OFF_HAND.has(k);
  return true; // hands hold anything
}
function why(w: string, idx: number, k: ItemKey): string {
  if (w === 'p') return TL`The ${item(k).name} is too big for the backpack: carry it in your hands.`;
  if (w === 'm') return tl('Only relics go in the modules.');
  if (w === 'w') return TL`That does not fit the ${SLOT_NAME[BLASTER.slots[idx]].toLowerCase()} slot.`;
  if (w === 'g') return WEAR[k] ? TL`That is worn on the ${WEAR_NAME[WEAR[k]!.slot].toLowerCase()}.` : tl('You cannot wear that.');
  if (w === 'k') return tl('Only weapons go on your back.');
  if (w === 'o') return tl('Only a light or a shield goes in your other hand.');
  return '';
}
/** Moves an item between slots, following the rules of each kind of slot. Returns an error message or ''. */
function move(from: string, to: string): string {
  const c = G.char, [fw, i] = parseId(from), [tw, j] = parseId(to), a = at(from), b = at(to);
  if (!a) return '';
  if (fw === 'p' && tw === 'h' && b && isCargo(b.k) && !isCargo(a.k)) return packHeld(i); // (0.247) into the crate in your hands
  if (fw === 'h' && tw === 'p' && isCargo(a.k)) return unpackHeld();
  if (!fits(tw, j, a.k)) return why(tw, j, a.k);
  if (b && !fits(fw, i, b.k)) return b && fw === 'p' ? why(fw, i, b.k) : tl('Swap it with an empty slot or a matching item instead.');
  if (fw === 'p' && tw === 'p') { dropStack(c.inv, i, c.inv, j); return ''; }
  const vol = (x: { k: ItemKey; n: number } | null) => (x ? BULK[x.k][1] * x.n : 0);
  // the backpack's litres after the move: a pack going on or coming off changes them
  const packIdx = WEAR_SLOTS.indexOf('pack'), wearAfter = { ...c.wear };
  if (tw === 'g' && j === packIdx) wearAfter.pack = a.k;
  if (fw === 'g' && i === packIdx) wearAfter.pack = b?.k ?? null;
  const room = gearOf(wearAfter).vol, after = bulkOf(c.inv) + (tw === 'p' ? vol(a) - vol(b) : 0) + (fw === 'p' ? vol(b) - vol(a) : 0);
  if (after > room + 1e-6) return room < packVol() ? TL`Empty the backpack down to ${room} L first: without that pack it holds no more.` : tl('No room for it in your backpack.');
  const single = (w: string) => w === 'm' || w === 'w' || w === 'g' || w === 'k';
  const put = (w: string, idx: number, x: { k: ItemKey; n: number; c?: number } | null) => {
    if (w === 'm') c.mods[idx] = x?.k ?? null; else if (w === 'w') c.gunMods[idx] = x?.k ?? null;
    else if (w === 'g') c.wear[WEAR_SLOTS[idx]] = x?.k ?? null;
    else listOf(w)[idx] = x ? { k: x.k, n: x.n, ...(x.c !== undefined ? { c: x.c } : {}), ...((x as Slot).b ? { b: (x as Slot).b } : {}) } : null;
  };
  if (single(tw) && a.n > 1) { // taking one item off a stack: the target must be free
    if (b) return tl('Take a single item or use an empty slot.');
    a.n--; put(tw, j, { k: a.k, n: 1 }); return '';
  }
  put(tw, j, a); put(fw, i, b);
  return '';
}
/** (0.247) The backpack's stack i into the crate / barrel in your hands. */
function packHeld(i: number): string {
  const h = G.char.hands[0], a = G.char.inv[i];
  if (!h || !a || !isCargo(h.k)) return '';
  if (!holds(h.k, a.k)) return CARGO[h.k]!.kind === 'barrel' ? tl('A barrel takes only liquids: fuel, lamp oil, milk.') : tl('A crate takes building stuff: planks, stone, logs, ore, scrap and the like.');
  if (h.b && h.b.k !== a.k) return TL`It already holds ${item(h.b.k).name}: one kind of thing to a crate.`;
  const m = packFrom(h, G.char.inv, i);
  return m ? TL`${item(a.k).name} ×${m} into the ${item(h.k).name}.` : TL`The ${item(h.k).name} is full.`;
}
/** (0.247) Empty the crate / barrel in your hands into the backpack (what fits). */
function unpackHeld(): string {
  const h = G.char.hands[0];
  if (!h?.b) return tl('It is empty.');
  if (h.b.n > pocketOf(h.b.k)) return TL`More than your pockets hold: it stays a crate. Put it down, or into a cargo bay or a warehouse.`; // (0.251)
  const k = h.b.k, left = putItems(G.char.inv, k, h.b.n, packVol()), m = h.b.n - left;
  takeOut(h, m);
  return m ? TL`${item(k).name} ×${m} into your backpack${left ? TL` (${left} stay inside: no more room)` : ''}.` : tl('No room in your backpack.');
}
/** "holds Planks ×40 of 40" / "empty" */
export const boxLine = (s: Slot) => (s.b ? TL`holds ${item(s.b.k).name} ×${s.b.n} of ${boxCap(s.k, s.b.k)}` : tl('empty'));
/** Sends the selected item to its natural place. */
function quick(id: string, act: string): string {
  const c = G.char, [w] = parseId(id), a = at(id);
  if (!a) return '';
  const toPack = () => { const f = c.inv.indexOf(null); return f < 0 ? tl('Your backpack is full.') : move(id, 'p:' + f); };
  if (act === 'hold') {
    const h = c.hands[0];
    if (h && WEAPON_KIND[h.k] === undefined && !HAND_TOOLS.has(h.k)) return TL`Your hands are full: ${item(h.k).name}. Put it away first.`;
    if (h && HAND_TOOLS.has(h.k) && w !== 'p') { const m = stowHeld(); if (m) return m; } // the tool goes into the backpack
    return move(id, 'h:0'); // what you held takes its place
  }
  if (act === 'stow') { const m = stowHeld(); return m; }
  if (act === 'stowo') return stowOff();
  if (act === 'offh') return takeInOff(a.k);
  if (w !== 'p') return toPack();
  const it = item(a.k);
  if (it.type === 'relic') { const f = c.mods.indexOf(null); return f < 0 ? tl('All modules are full. Unequip one first.') : move(id, 'm:' + f); }
  if (it.type === 'attach') return move(id, 'w:' + BLASTER.slots.indexOf(attachSlot(a.k)!));
  if (it.type === 'wear') return move(id, 'g:' + WEAR_SLOTS.indexOf(WEAR[a.k]!.slot));
  if (it.type === 'weapon') return move(id, 'h:0');
  return '';
}

bindSlots(packEl, {
  drop(from, to) { note = isCraft(from) || isCraft(to) ? craftUi!.drop(from, to) : side && (isSide(from) || isSide(to)) ? side.drop(from, to) : move(from, to); sel = null; if (G.packOpen) changed(); },
  click(id) {
    if (isCraft(id)) { note = craftUi!.click(id); sel = null; if (G.packOpen) changed(); return; }
    if (side && isSide(id)) { note = side.click(id); sel = null; if (G.packOpen) changed(); return; }
    sel = sel === id ? null : id; renderPack();
  },
});
packEl.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest<HTMLElement>('[data-a]');
  if (!a || !sel) return;
  const id = sel, [w, i] = parseId(id), act = a.dataset.a!;
  if (act === 'off' || act === 'on' || act === 'hold' || act === 'stow' || act === 'stowo' || act === 'offh') { const m = quick(sel, act); if (m) logLine(m); note = m; sel = null; }
  if (act === 'use' && (w === 'p' || w === 'h' || w === 'o')) { const s = listOf(w)[i]; if (s) useItem(s.k); }
  if (act === 'pack' && w === 'p') { note = packHeld(i); logLine(note); }
  if (act === 'unpack' && w === 'h') { note = unpackHeld(); logLine(note); sel = null; }
  if (act === 'throw' && (w === 'p' || w === 'h')) { const s = listOf(w)[i]; if (s) readyThrow(s.k); }
  if (act === 'saw' || act === 'sawall') { const m = sawLogs(act === 'sawall'); logLine(m); note = m; if (!G.char.inv.some((x) => x?.k === 'log') && G.char.hands[0]?.k !== 'log') sel = null; }
  if (side?.act && act === side.act[0] && side.doAct) { note = side.doAct(id); sel = null; if (!G.packOpen) return; }
  if (act === 'drop' && (w === 'p' || w === 'h' || w === 'k' || w === 'o')) { const s = listOf(w)[i]; listOf(w)[i] = null; sel = null; if (s) dropAtFeet(s); } // laid at your feet, for you or anyone to pick up
  changed();
});
/** Opens the backpack, with `with` (a container) beside it instead of the ground. */
export function openPack(with_?: PackSide) {
  if (!G.playing || G.packOpen || G.dlgOpen || G.xferOpen) return;
  side = with_ ?? ground; sideEl.style.display = side ? '' : 'none';
  craftUi?.show(true); G.packOpen = true; G.firing = false; for (const k in G.keys) G.keys[k] = false; sel = null; renderPack(); packEl.style.display = 'flex';
  if (document.pointerLockElement) document.exitPointerLock();
}
export function closePack() {
  if (!G.packOpen) return;
  G.packOpen = false; packEl.style.display = 'none'; craftUi?.show(false); packClosed();
  const s = side; side = null; s?.close();
  if (!G.isTouch) lockPointer();
}
export const togglePack = () => (G.packOpen ? closePack() : openPack());
$('packClose').onclick = closePack;
