// Containers (chests, bandit stashes, vehicle trunks, lockers): opened beside the backpack (ui/backpack.ts), and
// items move freely between them. Drag an item onto any slot (stacks merge, other items swap places), click one in
// the container to take it, or select one of yours and Store it. Whatever you leave stays inside.
import { play } from '../world/sound';
import { online, lockContainer, unlockContainer, saveContainer, activeContainers, net } from '../net/client';
import { G } from '../game';
import { item, HANDS_ONLY } from '../data/items';
import { moveStack, dropStack, countFree, putItems } from '../inventory';
import { isCargo, holds, packFrom, takeOut, CARGO, autoBox, boxCap, boxOf, dropEmpty } from '../data/cargo';
import { stowHeld, packVol, settleCrates } from '../character';
import type { Container, Slot } from '../save';
import { $, showToast } from './hud';
import { slotHTML, parseId } from './slots';
import { openPack, closePack, refreshPack, packSide, type PackSide } from './backpack';
import { tl, TL } from '../i18n';

export interface TransferSpec {
  title: string; subtitle: string; boxLabel: string;
  box: Container;
  /** (0.247) A vehicle's cargo bays (VehicleState.bays): crates and barrels, one a bay, shown under the trunk. */
  bays?: (Slot | null)[];
  onClose?: () => void;
}

const el = { side: $('packSide'), title: $('sideTitle'), sub: $('sideSub'), label: $('sideLabel'), grid: $('sideGrid'), gold: $('sideGold'), msg: $('sideMsg'), all: $('sideAll') };
let spec: TransferSpec | null = null;
let locked: string | null = null, opening = false;

/** Slot lists by id prefix: b = the container, c = a vehicle's cargo bays, p = backpack, k = your back, h = your hands. */
const list = (w: string): (Slot | null)[] => (w === 'b' ? spec!.box.items : w === 'c' ? spec!.bays ?? [] : w === 'h' ? G.char.hands : w === 'k' ? G.char.back : G.char.inv);
const view = (s: Slot | null) => ({ k: s?.k ?? null, n: s?.n, c: s?.c, b: s?.b });
const mine = (w: string) => w === 'b' || w === 'c' || w === 'p' || w === 'k' || w === 'h';

/** False (and the window shut) when the server took the container away from us. */
function canTransfer() { if (locked && !activeContainers.has(locked)) { locked = null; closePack(); return false; } return true; }
function takeGold() { if (!spec) return; G.char.gold += spec.box.gold; spec.box.gold = 0; }
const save = () => { if (locked && spec) saveContainer(locked, spec.box); };

/**
 * (0.247) A drag or a click that involves the cargo bays ('c') or a crate / barrel: put one in a bay or take it out
 * into your hands, fill one from a stack dragged onto it, empty one onto the trunk or the backpack. Returns the message,
 * or null when the move is an ordinary one.
 */
function cargoMove(fw: string, i: number, tw: string, j: number): string | null {
  const src = list(fw), s = src[i], dst = list(tw)[j];
  if (!s) return '';
  const name = item(s.k).name;
  if (tw === 'c' && !isCargo(s.k)) { // a stack dropped on a crate in a bay: into it
    if (!dst && autoBox(s.k)) { const m = Math.min(s.n, boxCap(autoBox(s.k)!, s.k)), box = boxOf(s.k, m)!; list('c')[j] = box; if ((s.n -= m) <= 0) src[i] = null; return TL`${name} ×${m} into a ${item(box.k).name.toLowerCase()} in the cargo bay.`; } // (0.251) a crate turns up for it
    if (!dst || !isCargo(dst.k)) return tl('Only building stuff and liquids go in the cargo bay: they are packed in a crate or a barrel there.');
    if (!holds(dst.k, s.k)) return CARGO[dst.k]!.kind === 'barrel' ? tl('A barrel takes only liquids: fuel, lamp oil, milk.') : tl('A crate takes building stuff: planks, stone, logs, ore, scrap and the like.');
    if (dst.b && dst.b.k !== s.k) return TL`It already holds ${item(dst.b.k).name}: one kind of thing to a crate.`;
    const m = packFrom(dst, src, i);
    return m ? TL`${name} ×${m} into the ${item(dst.k).name}.` : TL`The ${item(dst.k).name} is full.`;
  }
  if (fw === 'c' && (tw === 'b' || tw === 'p')) { // a crate dragged onto the trunk or the backpack: emptied there
    if (!s.b) return tl('It is empty.');
    const k = s.b.k, left = putItems(list(tw), k, s.b.n, tw === 'p' ? packVol() : undefined), m = s.b.n - left;
    takeOut(s, m); dropEmpty(src); // (0.251) emptied, it is gone
    return m ? TL`${item(k).name} ×${m} out of the ${name}${left ? TL` (${left} stay inside: no more room)` : ''}.` : tl('No room there.');
  }
  if (tw === 'c' || fw === 'c') { // between the bays and your hands, or bay to bay
    if (fw === 'c' && tw === 'c') { src[i] = dst ?? null; list('c')[j] = s; return ''; }
    if (tw === 'c' && fw !== 'h') return tl('Crates and barrels are carried in your hands.');
    if (fw === 'c' && tw !== 'h') return tl('Take it in your hands.');
    return fw === 'c' ? takeBay(i) : putBay(j);
  }
  if (tw === 'b' && isCargo(s.k) && spec!.bays) return tl('Crates and barrels ride in the cargo bay, not the trunk.');
  return null;
}
/** The crate / barrel in bay i into your hands (what you held goes onto your back or into the backpack). */
function takeBay(i: number): string {
  const bays = spec!.bays!, s = bays[i], h = G.char.hands[0];
  if (!s) return '';
  if (h && isCargo(h.k)) { bays[i] = h; G.char.hands[0] = s; return TL`You swap the ${item(h.k).name} for the ${item(s.k).name}.`; }
  const m = stowHeld(); if (m) return m;
  G.char.hands[0] = s; bays[i] = null;
  return TL`You carry the ${item(s.k).name} in your hands.`;
}
/** The crate / barrel in your hands into bay j (the first free one when j < 0). */
function putBay(j: number): string {
  const bays = spec!.bays!, h = G.char.hands[0];
  if (!h || !isCargo(h.k)) return tl('Carry a crate or a barrel in your hands to load it.');
  if (j < 0) j = bays.indexOf(null);
  if (j < 0) return tl('Every cargo bay is taken.');
  const old = bays[j];
  bays[j] = h; G.char.hands[0] = old ?? null;
  return TL`You load the ${item(h.k).name} into the cargo bay.`;
}

const box: PackSide = {
  prefix: 'b',
  prefixes: ['c'],
  act: ['store', tl('Store')],
  render() {
    if (!spec) return;
    const b = spec.box;
    el.side.classList.remove('ground');
    el.title.textContent = spec.title; el.sub.textContent = spec.subtitle;
    el.label.textContent = `${spec.boxLabel} (${b.items.length - countFree(b.items)}/${b.items.length})`;
    el.grid.innerHTML = b.items.map((s, i) => slotHTML('b:' + i, view(s))).join('') + (spec.bays ? `<div class="bayhead">${TL`Cargo bay (${spec.bays.filter(Boolean).length}/${spec.bays.length}): crates and barrels, carried in your hands`}</div>` + spec.bays.map((s, i) => slotHTML('c:' + i, { ...view(s), hint: tl('Bay') })).join('') : '');
    el.gold.innerHTML = b.gold > 0 ? TL`Gold: ${b.gold}<button data-gold="1">Take gold</button>` : '';
    el.all.textContent = tl('Take all');
    el.all.style.display = b.items.some(Boolean) || b.gold > 0 ? '' : 'none';
  },
  drop(from, to) {
    if (!spec || !canTransfer()) return '';
    const [fw, i] = parseId(from), [tw, j] = parseId(to);
    if (!mine(fw) || !mine(tw)) return fw === 'b' || fw === 'c' ? tl('Put it in your backpack first.') : tl('Take it off into your backpack first.');
    const cm = cargoMove(fw, i, tw, j);
    if (cm !== null) { dropEmpty(spec.bays); settleCrates(); save(); return cm; }
    const src = list(fw), s = src[i];
    if (!s) return '';
    if (s.k === 'backpack' && tw === 'b' && fw !== 'b') return tl('A backpack is carried, put down or put on, not packed into something.'); // (0.285)
    const name = item(s.k).name, dst = list(tw)[j];
    const cap = (w: string) => (w === 'p' ? packVol() : undefined);
    if (tw === 'p' && HANDS_ONLY.has(s.k) || fw === 'p' && dst && HANDS_ONLY.has(dst.k)) return TL`The ${item((tw === 'p' ? s : dst!).k).name} is too big for the backpack: carry it in your hands.`;
    if (!dropStack(src, i, list(tw), j, cap(tw), cap(fw))) return fw === tw ? '' : tl('It does not fit in your backpack.');
    save();
    return fw === tw ? '' : (tw === 'b' ? tl('Stored ') : tl('Took ')) + name + '.';
  },
  click(id) {
    if (!spec || !canTransfer()) return '';
    const [w, i] = parseId(id), src = list(w), s = src[i];
    if (w === 'c') return s ? takeBay(i) : putBay(i); // (0.247) the cargo bays
    if (!s) return '';
    if (s.k === 'backpack' && w !== 'b') return tl('A backpack is carried, put down or put on, not packed into something.'); // (0.285)
    const name = item(s.k).name;
    if (isCargo(s.k) && w !== 'b' && spec.bays) return putBay(-1);
    if (w === 'b' && HANDS_ONLY.has(s.k)) { // too big for the backpack: into your hands (a weapon you held goes onto your back)
      const m = stowHeld(); if (m) return m;
      G.char.hands[0] = { ...s, n: 1 }; if (--s.n <= 0) src[i] = null;
      save(); return TL`You carry the ${name} in your hands.`;
    }
    let moved = moveStack(src, i, list(w === 'b' ? 'p' : 'b'), w === 'b' ? packVol() : undefined);
    if (moved) save();
    const where = w === 'b' ? tl('Took ') : tl('Stored ');
    return moved ? `${where}${name}${moved > 1 ? ' ×' + moved : ''}.` : w === 'b' ? tl('No room in your backpack.') : TL`The ${spec.boxLabel.toLowerCase()} is full.`;
  },
  doAct(id) { return box.click(id); },
  close() {
    if (!spec) return;
    if (locked && activeContainers.has(locked)) unlockContainer(locked, spec.box);
    locked = null;
    const cb = spec.onClose; spec = null; cb?.();
  },
};

el.side.addEventListener('click', (e) => {
  if (packSide() !== box || !spec || !canTransfer()) return;
  if ((e.target as HTMLElement).closest('[data-gold]')) { takeGold(); save(); el.msg.textContent = tl('Gold taken.'); refreshPack(); }
});
el.all.addEventListener('click', () => {
  if (packSide() !== box || !spec || !canTransfer()) return;
  takeGold();
  let left = false;
  spec.box.items.forEach((_, i) => { moveStack(spec!.box.items, i, G.char.inv, packVol()); if (spec!.box.items[i]) left = true; });
  save();
  el.msg.textContent = left ? tl('Your backpack is full (slots or bulk), or the rest is too big for it (click it to carry it in your hands); it stays here.') : tl('Took everything.');
  refreshPack();
});

export async function openTransfer(s: TransferSpec) {
  if (!G.playing || G.xferOpen || G.packOpen || G.dlgOpen || opening) return;
  const key = online() ? Object.entries(G.char.containers).find(([k, v]) => !k.startsWith('home:') && v === s.box)?.[0] : undefined;
  if (key) {
    opening = true;
    const id = net.id, ok = await lockContainer(key, s.box);
    opening = false;
    if (!ok || net.id !== id || !G.playing || G.xferOpen || G.packOpen || G.dlgOpen) {
      if (ok && net.id === id) unlockContainer(key);
      if (!ok && online()) showToast(tl('Someone else is using this container'));
      return;
    }
    locked = key;
    s.box = G.char.containers[key];
    if (s.bays) s.bays = (s.box.bays ??= s.bays); // (0.248) a trunk's cargo bays come with it
  }
  spec = s;
  el.msg.textContent = tl('Drag items between the two, click one in here to take it, or select one of yours and Store it. Whatever you leave stays here.');
  openPack(box); play('chest', { vol: 0.55 });
  if (!G.packOpen) box.close();
}
/** Shuts the container (and the backpack beside it). */
export function closeTransfer() { if (spec && packSide() === box) closePack(); }
