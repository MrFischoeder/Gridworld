// Container window (chests, bandit stashes, vehicle trunks): the container on top, the backpack below, and
// items move freely between them like inside the backpack. Drag an item onto any slot (stacks merge, other
// items swap places), or click / tap it to send it straight to the other side. Whatever you leave stays inside.
import { G } from '../game';
import { item, PACK, HANDS_ONLY, WEAPON_KIND } from '../data/items';
import { moveStack, dropStack, countFree } from '../inventory';
import { calcStats, saveChar, stowHeld, handsChanged } from '../character';
import type { Container, Slot } from '../save';
import { $ } from './hud';
import { lockPointer } from './input';
import { slotHTML, bindSlots, itemInfo, parseId, loadText } from './slots';

export interface TransferSpec {
  title: string; subtitle: string; boxLabel: string;
  box: Container;
  onClose?: () => void;
}

const el = { root: $('xfer'), title: $('xferTitle'), sub: $('xferSub'), boxLabel: $('xferBoxLabel'), box: $('xferBox'), gold: $('xferGold'),
  inv: $('xferInv'), body: $('xferBody'), invInfo: $('xferInvInfo'), detail: $('xferDetail'), msg: $('xferMsg'), all: $('xferAll'), close: $('xferClose') };
let spec: TransferSpec | null = null;

/** Slot lists by id prefix: b = the container, p = backpack, k = your back, h = your hands. */
const list = (w: string): (Slot | null)[] => (w === 'b' ? spec!.box.items : w === 'h' ? G.char.hands : w === 'k' ? G.char.back : G.char.inv);
const view = (s: Slot | null) => ({ k: s?.k ?? null, n: s?.n, c: s?.c });

function render(msg?: string) {
  if (!spec) return;
  const b = spec.box, inv = G.char.inv;
  el.title.textContent = spec.title; el.sub.textContent = spec.subtitle;
  el.boxLabel.textContent = `${spec.boxLabel} (${b.items.length - countFree(b.items)}/${b.items.length})`;
  el.box.innerHTML = b.items.map((s, i) => slotHTML('b:' + i, view(s))).join('');
  el.gold.innerHTML = b.gold > 0 ? `Gold: ${b.gold}<button data-gold="1">Take gold</button>` : '';
  el.inv.innerHTML = inv.map((s, i) => slotHTML('p:' + i, view(s))).join('');
  el.body.innerHTML = G.char.back.map((s, i) => slotHTML('k:' + i, { ...view(s), hint: 'Back ' + (i + 1) })).join('') + slotHTML('h:0', { ...view(G.char.hands[0]), hint: 'Hands', cls: 'held' });
  el.invInfo.innerHTML = `(${inv.length - countFree(inv)}/${inv.length}) · ${loadText()} · gold ${G.char.gold}`;
  el.all.style.display = b.items.some(Boolean) || b.gold > 0 ? '' : 'none';
  if (msg !== undefined) el.msg.textContent = msg;
}
function takeGold() { if (!spec) return; G.char.gold += spec.box.gold; spec.box.gold = 0; }
const changed = (msg: string) => { calcStats(); handsChanged(); saveChar(); render(msg); };

bindSlots(el.root, {
  drop(from, to) {
    if (!spec) return;
    const [fw, i] = parseId(from), [tw, j] = parseId(to), src = list(fw), s = src[i];
    if (!s) return;
    const name = item(s.k).name, dst = list(tw)[j];
    const cap = (w: string) => (w === 'p' ? PACK.vol : undefined);
    if (tw === 'k' && WEAPON_KIND[s.k] === undefined || fw === 'k' && dst && WEAPON_KIND[dst.k] === undefined) { render('Only weapons go on your back.'); return; }
    if (tw === 'p' && HANDS_ONLY.has(s.k) || fw === 'p' && dst && HANDS_ONLY.has(dst.k)) { render(`The ${item((tw === 'p' ? s : dst!).k).name} is too big for the backpack: carry it in your hands.`); return; }
    if (!dropStack(src, i, list(tw), j, cap(tw), cap(fw))) { render(fw === tw ? '' : 'It does not fit in your backpack.'); return; }
    changed(fw === tw ? '' : (tw === 'b' ? 'Stored ' : 'Took ') + name + '.');
  },
  click(id) {
    if (!spec) return;
    const [w, i] = parseId(id), src = list(w), s = src[i];
    if (!s) return;
    const name = item(s.k).name;
    if (w === 'b' && HANDS_ONLY.has(s.k)) { // too big for the backpack: into your hands (a weapon you held goes onto your back)
      const m = stowHeld(); if (m) { render(m); return; }
      G.char.hands[0] = { ...s, n: 1 }; if (--s.n <= 0) src[i] = null;
      changed(`You carry the ${name} in your hands.`); return;
    }
    let moved = moveStack(src, i, list(w === 'b' ? 'p' : 'b'), w === 'b' ? PACK.vol : undefined);
    if (!moved && w === 'b' && WEAPON_KIND[s.k] !== undefined) { const f = G.char.back.indexOf(null); if (f >= 0) { G.char.back[f] = { ...s, n: 1 }; if (--s.n <= 0) src[i] = null; moved = 1; } }
    const where = w === 'b' ? 'Took ' : 'Stored ';
    changed(moved ? `${where}${name}${moved > 1 ? ' ×' + moved : ''}.` : w === 'b' ? 'No room in your backpack.' : `The ${spec.boxLabel.toLowerCase()} is full.`);
  },
  hover(id) {
    if (!spec) return;
    const [w, i] = id ? parseId(id) : ['', -1], s = id ? list(w)[i] : null;
    el.detail.innerHTML = s ? itemInfo(s.k, s.c) : '';
  },
});
el.root.addEventListener('click', (e) => {
  if (spec && (e.target as HTMLElement).closest('[data-gold]')) { takeGold(); saveChar(); render('Gold taken.'); }
});
el.all.onclick = () => {
  if (!spec) return;
  takeGold();
  let left = false;
  spec.box.items.forEach((_, i) => { moveStack(spec!.box.items, i, G.char.inv, PACK.vol); if (spec!.box.items[i]) left = true; });
  changed(left ? 'Your backpack is full (slots or bulk), or the rest is too big for it (click to carry it in your hands); it stays here.' : 'Took everything.');
};
el.close.onclick = () => closeTransfer();

export function openTransfer(s: TransferSpec) {
  if (!G.playing || G.xferOpen || G.packOpen || G.dlgOpen) return;
  spec = s; G.xferOpen = true; G.firing = false; for (const k in G.keys) G.keys[k] = false;
  el.detail.innerHTML = '';
  render('Drag items between the two, or click one to move it across. Whatever you leave stays here.');
  el.root.style.display = 'flex';
  if (document.pointerLockElement) document.exitPointerLock();
}
export function closeTransfer() {
  if (!G.xferOpen || !spec) return;
  G.xferOpen = false; el.root.style.display = 'none';
  const cb = spec.onClose; spec = null; cb?.();
  if (!G.isTouch) lockPointer();
}
