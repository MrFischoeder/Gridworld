// Backpack window: the exoskeleton's module sockets (0.285: the harness's three, more with a frame and its extensions;
// gen/exoframe.ts), your body (what you wear, what you hold in your hand and (0.201) your other hand: a light or a
// shield) and 24 backpack slots. (0.285) The backpack can be taken off into your hands, opened, put down and put on
// again (world/bags.ts).
// Items are dragged between slots (or selected and handled with the buttons under the grid).
// Beside it stands a side panel: what lies on the ground around you (ui/ground.ts), or the chest, trunk or locker you
// opened (ui/transfer.ts). Items move between the two by dragging, a click, or the buttons.
// (0.279) Every gun keeps its own attachments (`Slot.m`): Modify opens its card beside the backpack, where they are
// dragged in and out. Hovering an item of yours brings up its sheet with the buttons (Eat, Use, Modify...) at hand.
import { dropAtFeet } from '../world/drops';
import { G } from '../game';
import { item, BULK, WEAR, WEAR_SLOTS, WEAR_NAME, gearOf, WEAPON_KIND, HANDS_ONLY, HAND_TOOLS, OFF_HAND, TWO_HANDED, type ItemKey } from '../data/items';
import { SLOT_NAME, attachSlot, gunOf, gunStats } from '../data/weapons';
import { calcStats, saveChar, listOf, stowHeld, handsChanged, packVol, stowOff, takeInOff, bothHands, settleCrates, sockets, countHeld, takeOne } from '../character';
import { EXO_EXT, MOD_MAX, extProblem, modSockets, strandedMods } from '../gen/exoframe';
import { takeOffPack, putOnPack, openCarried, layBag } from '../world/bags';
import { dropStack, bulkOf, putItems } from '../inventory';
import { isCargo, holds, boxRoom, boxCap, packFrom, takeOut, CARGO, pocketOf } from '../data/cargo';
import type { Slot } from '../save';
import { logLine, $ } from './hud';
import { useItem } from '../world/loot';
import { sawLogs } from '../world/sawing';
import { refreshGunLook } from '../world/weapons';
import { lockPointer } from './input';
import { slotHTML, bindSlots, itemInfo, parseId, loadText } from './slots';
import { setTipActions } from './itemtip';
import { tl, TL } from '../i18n';
import { NOURISH } from '../data/survival';
import { THROWABLES } from '../gen/throwing';
import { readyThrow } from '../world/throwing';
import { packClosed, packInCell } from '../world/workshop';

/** (0.270) The workshop cells beside the window (ui/workshop.ts registers itself). Slot ids 'x:<cell>'. */
export interface CraftPanel { show(on: boolean): void; render(): void; drop(from: string, to: string): string; click(id: string): string; put(id: string): string }
let craftUi: CraftPanel | null = null;
export function setCraftPanel(p: CraftPanel) { craftUi = p; }
const isCraft = (id: string) => parseId(id)[0] === 'x';
let sel: string | null = null;
const loadEl = $('packLoad'), modsSub = $('modsSub'), exoEl = $('exoExt'), offBtn = $<HTMLButtonElement>('packOffBtn');
/** (0.285) The frame's line: what it is, its extensions and the next one to build. */
function exoLine(): string {
  const c = G.char, f = c.wear.frame, n = c.exoExt ?? 0;
  if (!f) return tl('The plain harness: 3 sockets. Wear an exoskeleton frame to open more, then build it up.');
  const head = TL`${item(f).name}: extensions ${Math.min(n, EXO_EXT.length)} / ${EXO_EXT.length}`;
  if (n >= EXO_EXT.length) return head + ' · ' + tl('built up to the full');
  const e = EXO_EXT[n], why = extProblem(c.wear, n, countHeld);
  const needs = e.needs.map(([k, m]) => `${item(k).name} ${Math.min(countHeld(k), m)}/${m}`).join(', ');
  return head + '<br>' + TL`Next: ${e.name} (one more socket, +${e.max} kg before overload): ${needs}` + `<button data-exo="1"${why ? ' disabled' : ''}>${tl('Build it')}</button>`;
}
/** (0.285) What the backpack grid says while the backpack is off. */
function packOffText(): string {
  const h = G.char.hands[0];
  return h?.k === 'backpack' ? tl('Your backpack is off: you carry it in your hands.') + `<div class="acts"><button data-bag="puton">${tl('Put on')}</button><button data-bag="open">${tl('Open')}</button><button data-bag="down">${tl('Put down')}</button></div>` : tl('Your backpack is off: it lies where you put it down. Pick it up (E) and put it on. Until then nothing goes into the backpack.');
}
const packEl = $('pack'), invEl = $('inv'), modsEl = $('mods'), cardEl = $('gunCard'), detailEl = $('detail'), gearEl = $('gear'), defEl = $('gearDef');
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
 * Item in a slot: m = modules, a = the open gun card's attachments, p = backpack, g = what you wear (WEAR_SLOTS index),
 * k = your back (two weapons), h = your hands, o = your other hand.
 */
function at(id: string): Slot | null {
  const [w, i] = parseId(id), c = G.char;
  if (w === 'm') return c.mods[i] ? { k: c.mods[i]!, n: 1 } : null;
  if (w === 'a') { const k = card?.m?.[i]; return k ? { k, n: 1 } : null; }
  if (w === 'g') { const k = c.wear[WEAR_SLOTS[i]]; return k ? { k, n: 1 } : null; }
  return listOf(w)[i];
}
// ---------- (0.279) the gun card: one gun's own attachments ----------
/** The gun whose card is open (the slot object itself, so it is followed wherever it moves among your slots). */
let card: Slot | null = null;
/** Where the open card's gun lies now ('h:0', 'p:3', 'k:1'), or null once it has left your kit. */
function cardId(): string | null {
  if (!card) return null;
  for (const w of ['h', 'p', 'k']) { const i = listOf(w).indexOf(card); if (i >= 0) return w + ':' + i; }
  return null;
}
/** The gun attachments go on: the open card's, else the one in your hands. */
const fitTarget = (): Slot | null => (cardId() ? card : gunOf(G.char.hands[0]?.k) ? G.char.hands[0] : null);
const statLine = (s: ReturnType<typeof gunStats>, pellets?: number) => TL`damage ${s.dmg.toFixed(2)}${pellets ? ` × ${pellets}` : ''} · ${(1 / s.interval).toFixed(1)} shots/s · range ${Math.round(s.range)} m · magazine ${s.mag} · reload ${s.reload.toFixed(1)} s · zoom ${s.zoom}× · heard ${Math.round(s.noise)} m`;
function renderCard() {
  const id = cardId(), spec = card && gunOf(card.k);
  if (!id || !card || !spec) { card = null; cardEl.style.display = 'none'; return; }
  cardEl.style.display = '';
  const m = card.m ?? [], s = gunStats(spec, m), base = gunStats(spec, []);
  const where = id[0] === 'h' ? tl('in your hands') : id[0] === 'k' ? tl('on your back') : tl('in your backpack');
  const loose = G.char.inv.filter((x): x is Slot => !!x && !!attachSlot(x.k));
  cardEl.innerHTML = `<h2>${spec.name}</h2><div class="role">${TL`This gun's own attachments (${where}). Drag them in from the backpack, or out again.`}</div>` +
    `<div class="grid mods">${spec.slots.map((sl, i) => slotHTML('a:' + i, { k: m[i] ?? null, hint: SLOT_NAME[sl], cls: 'att' }, sel === 'a:' + i)).join('')}</div>` +
    `<h3>${tl('With these')}</h3><div class="gstat">${statLine(s, spec.pellets)}</div>` +
    (m.some(Boolean) ? `<h3>${tl('Bare')}</h3><div class="gstat sub">${statLine(base, spec.pellets)}</div>` : '') +
    TL`<div class="gstat">rounds in the magazine: ${Math.min(G.char.loaded[card.k] ?? 0, s.mag)} / ${s.mag}</div>` +
    `<h3>${tl('In your backpack')}</h3><div class="gstat">${loose.length ? loose.map((x) => `<button class="gfit" data-gfit="${G.char.inv.indexOf(x)}">${item(x.k).name}</button>`).join(' ') : tl('no loose attachments')}</div>` +
    `<div class="acts"><button data-gc="1">${tl('Close')}</button></div>`;
}
function renderPack() {
  const c = G.char;
  const open = sockets();
  modsEl.innerHTML = c.mods.slice(0, MOD_MAX).map((k, i) => slotHTML('m:' + i, i < open ? { k, hint: tl('Module') } : { k, hint: '—', cls: 'locked', title: tl('A closed socket: a frame and its extensions open more') }, sel === 'm:' + i)).join('');
  modsSub.textContent = TL`modules: ${open} of ${MOD_MAX} sockets open`;
  exoEl.innerHTML = exoLine();
  offBtn.textContent = c.packOff ? '' : tl('Take the backpack off');
  offBtn.style.display = c.packOff ? 'none' : '';
  gearEl.innerHTML = WEAR_SLOTS.map((s, i) => slotHTML('g:' + i, { k: c.wear[s] ?? null, hint: WEAR_NAME[s] }, sel === 'g:' + i)).join('') + '<div></div>' +
    slotHTML('h:0', { k: c.hands[0]?.k ?? null, n: c.hands[0]?.n, c: c.hands[0]?.c, b: c.hands[0]?.b, m: c.hands[0]?.m, hint: tl('Hands'), cls: 'held', title: c.hands[0] ? undefined : tl('Your hands: the weapon you fight with, or something too big for the backpack') }, sel === 'h:0') +
    slotHTML('o:0', { k: c.off[0]?.k ?? null, n: c.off[0]?.n, hint: tl('Other hand'), cls: 'held' + (c.off[0] && bothHands() ? ' idle' : ''), title: c.off[0] ? undefined : tl('Your other hand: a light (flashlight, oil lamp, torches) or a shield, beside a one-handed weapon') }, sel === 'o:0');
  const oh = c.off[0] ? (bothHands() ? TL`${item(c.off[0].k).name} (idle: both hands on the weapon)` : item(c.off[0].k).name) : tl('nothing');
  defEl.textContent = TL`armour ${Math.round(G.S.def * 100)}% · in hands: ${c.hands[0] ? item(c.hands[0].k).name : tl('nothing')}` + ' · ' + TL`other hand: ${oh}`;
  invEl.innerHTML = c.packOff ? `<div class="packoff">${packOffText()}</div>` : c.inv.map((s, i) => slotHTML('p:' + i, { k: s?.k ?? null, n: s?.n, c: s?.c, m: s?.m, cls: s && packInCell(s.k) ? 'incell' : undefined, ...(i < 6 ? { key: i + 1, title: s ? undefined : TL`Backpack slot ${i + 1}: keys 1 to 6 take what lies in the first six slots into your hands` } : {}) }, sel === 'p:' + i)).join('');
  loadEl.innerHTML = loadText();
  let html = note || tl('Drag items between slots, or hover one for its buttons. Keys 1 to 6 take the item in the first six backpack slots into your hands, swapping what you held (weapons, tools, lights); armour and clothes on your body, modules in the exoskeleton\'s sockets. A gun\'s attachments go on its own card: Modify. Wheels and other big things only fit in your hands.');
  const s = sel && !isSide(sel) ? at(sel) : null;
  const acts = sel && s ? actsFor(sel) : [];
  if (sel && s) {
    const [w] = parseId(sel);
    html = itemInfo(s.k, s.c) + (w === 'm' ? tl('<br>Fitted in a socket') : w === 'a' ? tl('<br>Fitted to the gun') : w === 'g' ? tl('<br>Worn') : w === 'k' ? tl('<br>On your back') : w === 'h' ? tl('<br>In your hands') : w === 'o' ? tl('<br>In your other hand') : '')
      + (TWO_HANDED.has(s.k) && (WEAPON_KIND[s.k] !== undefined || HAND_TOOLS.has(s.k)) ? tl('<br>Needs both hands') : '')
      + (s.m?.some(Boolean) ? '<br>' + TL`Fitted: ${s.m.filter(Boolean).map((k) => item(k!).name).join(', ')}` : '')
      + (isCargo(s.k) ? '<br>' + boxLine(s) : '');
  } else sel = null;
  note = '';
  detailEl.innerHTML = html + (acts.length ? '<div class="acts">' + acts.map(([a, t]) => `<button class="${a === 'drop' ? 'drop' : ''}" data-a="${a}">${t}</button>`).join('') + '</div>' : '');
  side?.render();
  craftUi?.render();
  renderCard();
}
/** The buttons for the item in slot `id` (the detail line under the grid and the hover sheet both use them). */
function actsFor(id: string): [string, string][] {
  const c = G.char, s = at(id), acts: [string, string][] = [];
  if (!s) return acts;
  {
    const [w] = parseId(id), it = item(s.k), food = NOURISH[s.k];
    if (w === 'm') acts.push(['off', tl('Unequip')]);
    else if (w === 'a' || w === 'g') acts.push(['off', tl('Take off')]);
    else if (w === 'k') { if (gunOf(s.k)) acts.push(['mod', tl('Modify')]); acts.push(['hold', tl('Take in hands')], ['off', tl('Into backpack')]); }
    else if (w === 'h' && s.k === 'backpack') { if (c.packOff) acts.push(['puton', tl('Put on')]); acts.push(['bagopen', tl('Open')]); acts.push(['drop', tl('Put down')]); return acts; }
    else if (w === 'h') { if (gunOf(s.k)) acts.push(['mod', tl('Modify')]); if (it.type === 'cons') acts.push(['use', food ? (food.kcal ? tl('Eat') : tl('Drink')) : tl('Use')]); if (OFF_HAND.has(s.k)) acts.push(['offh', tl('Into other hand')]); acts.push(['stow', tl('Put away')]); }
    else if (w === 'o') { if (s.k === 'flashlight' || s.k === 'oillamp' || s.k === 'firebrand') acts.push(['use', tl('Light / put out')]); acts.push(['stowo', tl('Put away')]); }
    else if (OFF_HAND.has(s.k)) { acts.push(['offh', tl('Take in other hand')]); if (it.type === 'cons' || s.k === 'flashlight' || s.k === 'oillamp') acts.push(['use', tl('Use')]); }
    else if (it.type === 'relic') acts.push(['on', tl('Equip')]);
    else if (it.type === 'attach') { const g = fitTarget(); if (g) acts.push(['on', TL`Fit to the ${item(g.k).name}`]); }
    else if (it.type === 'wear') acts.push(['on', tl('Wear')]);
    else if (it.type === 'weapon') { acts.push(['hold', tl('Take in hands')]); if (gunOf(s.k)) acts.push(['mod', tl('Modify')]); }
    else if (it.type === 'cons') acts.push(['use', food ? (food.kcal ? tl('Eat') : tl('Drink')) : tl('Use')]);
    else if (s.k === 'roadkit') acts.push(['use', tl('Stake out a track')]); // (0.280)
    else if (HAND_TOOLS.has(s.k)) acts.push(['hold', tl('Take in hands')]);
    if (THROWABLES.includes(s.k) && (w === 'p' || w === 'h')) acts.push(['throw', tl('Ready to throw (Z)')]); // (0.225) world/throwing.ts
    if (s.k === 'log' && (w === 'p' || w === 'h')) acts.push(['saw', tl('Saw into planks')], ['sawall', tl('Saw all')]); // (world/sawing.ts: a Saw in your kit)
    { const h = c.hands[0]; // (0.247) a crate or a barrel in your hands: fill it from the backpack, or empty it
      if (w === 'p' && h && isCargo(h.k) && boxRoom(h, s.k) > 0) acts.unshift(['pack', TL`Into the ${item(h.k).name}`]); }
    if (craftUi && (w === 'p' || w === 'h' || w === 'o')) acts.push(['cell', tl('Into the workshop')]); // (0.271)
    if (w === 'p' || w === 'h' || w === 'k' || w === 'o') acts.push(['drop', tl('Drop')]);
    if (side?.act && (w === 'p' || w === 'h' || w === 'k' || w === 'o')) acts.unshift(side.act);
  }
  return acts;
}
function changed() { settleCrates(); calcStats(); refreshGunLook(); handsChanged(); saveChar(); renderPack(); } // (0.251) heaps into crates, empty crates gone

/** Whether item k may sit in slot (w, idx). */
function fits(w: string, idx: number, k: ItemKey): boolean {
  if (w === 'p') return !HANDS_ONLY.has(k);
  if (w === 'm') return item(k).type === 'relic' && idx < sockets();
  if (w === 'g' && WEAR_SLOTS[idx] === 'pack' && G.char.packOff) return false;
  if (w === 'a') { const g = card && gunOf(card.k); return !!g && attachSlot(k) === g.slots[idx]; }
  if (w === 'g') return WEAR[k]?.slot === WEAR_SLOTS[idx];
  if (w === 'k') return WEAPON_KIND[k] !== undefined;
  if (w === 'o') return OFF_HAND.has(k);
  return true; // hands hold anything
}
function why(w: string, idx: number, k: ItemKey): string {
  if (w === 'p') return TL`The ${item(k).name} is too big for the backpack: carry it in your hands.`;
  if (w === 'm') return item(k).type === 'relic' ? tl('That socket is closed: a frame and its extensions open more.') : tl('Only exoskeleton modules go in the sockets.');
  if (w === 'g' && WEAR_SLOTS[idx] === 'pack' && G.char.packOff) return tl('Your backpack is off: put it on first.');
  if (w === 'a') { const g = card && gunOf(card.k); return g ? TL`That does not fit the ${SLOT_NAME[g.slots[idx]].toLowerCase()} slot.` : ''; }
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
  { // (0.285) a frame coming off may not leave modules in the sockets it opened
    const frameIdx = WEAR_SLOTS.indexOf('frame');
    if ((tw === 'g' && j === frameIdx) || (fw === 'g' && i === frameIdx)) {
      const w2 = { ...c.wear, frame: tw === 'g' && j === frameIdx ? a.k : b?.k ?? null };
      if (strandedMods(c.mods, modSockets(w2, c.exoExt)) > 0) return tl('Take the modules out of the frame\'s sockets first.');
    }
  }
  const room = gearOf(wearAfter).vol, after = bulkOf(c.inv) + (tw === 'p' ? vol(a) - vol(b) : 0) + (fw === 'p' ? vol(b) - vol(a) : 0);
  if (after > room + 1e-6) return room < packVol() ? TL`Empty the backpack down to ${room} L first: without that pack it holds no more.` : tl('No room for it in your backpack.');
  const single = (w: string) => w === 'm' || w === 'a' || w === 'g' || w === 'k';
  const put = (w: string, idx: number, x: Slot | null) => {
    if (w === 'm') c.mods[idx] = x?.k ?? null;
    else if (w === 'a') { if (card) { card.m ??= [null, null, null]; card.m[idx] = x?.k ?? null; } }
    else if (w === 'g') c.wear[WEAR_SLOTS[idx]] = x?.k ?? null;
    else listOf(w)[idx] = x; // the slot itself moves (a gun keeps its attachments, its card follows it)
  };
  if ((fw === 'a' || tw === 'a') && !cardId()) return '';
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
  if (it.type === 'relic') { const f = c.mods.slice(0, sockets()).indexOf(null); return f < 0 ? tl('Every open socket holds a module. Take one out first.') : move(id, 'm:' + f); }
  if (it.type === 'attach') {
    const g = fitTarget(), spec = g && gunOf(g.k);
    if (!g || !spec) return tl('Hold a gun, or open one\'s card (Modify), to fit it.');
    const j = spec.slots.indexOf(attachSlot(a.k)!);
    if (j < 0) return tl('That does not fit this gun.');
    card = g; return move(id, 'a:' + j);
  }
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
  const t = e.target as HTMLElement;
  if (t.closest('[data-gc]')) { card = null; renderPack(); return; }
  const bg = t.closest<HTMLElement>('[data-bag]')?.dataset.bag; // (0.285) the backpack in your hands
  if (bg) { doAct('h:0', bg === 'puton' ? 'puton' : bg === 'open' ? 'bagopen' : 'drop'); return; }
  if (t.closest('[data-exo]')) { note = buildExt(); logLine(note); changed(); return; }
  const gf = t.closest<HTMLElement>('[data-gfit]');
  if (gf) { const m = quick('p:' + gf.dataset.gfit, 'on'); note = m; if (m) logLine(m); changed(); return; }
  const a = t.closest<HTMLElement>('[data-a]');
  if (!a || !sel) return;
  doAct(sel, a.dataset.a!);
});
/** Does what button `act` says to the item in slot `id`. */
function doAct(id: string, act: string) {
  const [w, i] = parseId(id);
  if (act === 'mod') { const s = at(id); if (s && gunOf(s.k) && w !== 'a') { card = listOf(w)[i]; sel = null; renderPack(); } return; }
  if (act === 'off' || act === 'on' || act === 'hold' || act === 'stow' || act === 'stowo' || act === 'offh') { const m = quick(id, act); if (m) logLine(m); note = m; sel = null; }
  if (act === 'cell' && craftUi) { note = craftUi.put(id); sel = null; }
  if (act === 'use' && (w === 'p' || w === 'h' || w === 'o')) { const s = listOf(w)[i]; if (s) useItem(s.k); }
  if (act === 'pack' && w === 'p') { note = packHeld(i); logLine(note); }
  if (act === 'unpack' && w === 'h') { note = unpackHeld(); logLine(note); sel = null; }
  if (act === 'throw' && (w === 'p' || w === 'h')) { const s = listOf(w)[i]; if (s) readyThrow(s.k); }
  if (act === 'saw' || act === 'sawall') { const m = sawLogs(act === 'sawall'); logLine(m); note = m; if (!G.char.inv.some((x) => x?.k === 'log') && G.char.hands[0]?.k !== 'log') sel = null; }
  if (side?.act && act === side.act[0] && side.doAct) { note = side.doAct(id); sel = null; if (!G.packOpen) return; }
  if (act === 'puton') { void putOnPack().then((m) => { logLine(m); note = m; changed(); }); return; }
  if (act === 'bagopen') { closePack(); const m = openCarried(); if (m) logLine(m); return; }
  if (act === 'drop' && w === 'h' && G.char.hands[0]?.k === 'backpack') { const m = layBag(); logLine(m); note = m; sel = null; changed(); return; }
  if (act === 'drop' && (w === 'p' || w === 'h' || w === 'k' || w === 'o')) { const s = listOf(w)[i]; listOf(w)[i] = null; sel = null; if (s) dropAtFeet(s); } // laid at your feet, for you or anyone to pick up
  changed();
}
// (0.279) hovering an item of yours brings its sheet with these buttons (ui/itemtip.ts)
setTipActions((el) => {
  const id = el.closest<HTMLElement>('.slot[data-id]')?.dataset.id;
  if (!G.packOpen || !id || !packEl.contains(el) || isSide(id) || isCraft(id)) return null;
  const acts = actsFor(id);
  return acts.length ? { key: id, acts, run: (act: string) => { if (at(id)) { sel = id; doAct(id, act); } } } : null;
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
offBtn.onclick = () => { const m = takeOffPack(); logLine(m); note = m; sel = null; changed(); };
/** (0.285) Build the frame's next extension from what you carry. */
function buildExt(): string {
  const c = G.char, n = c.exoExt ?? 0, why = extProblem(c.wear, n, countHeld);
  if (why === 'frame') return tl('Wear an exoskeleton frame first.');
  if (why === 'full') return tl('The frame is built up to the full.');
  const e = EXO_EXT[n];
  if (why) return TL`For the ${e.name} you need: ${e.needs.map(([k, m]) => `${item(k).name} ×${m}`).join(', ')}.`;
  for (const [k, m] of e.needs) for (let i = 0; i < m; i++) takeOne(k);
  c.exoExt = n + 1; calcStats(); saveChar();
  return TL`You build the ${e.name} onto the frame: one more socket, and it carries more.`;
}
