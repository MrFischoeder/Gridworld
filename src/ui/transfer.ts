// Container window (chests, bandit stashes, vehicle trunks): the container on top, the backpack below, and
// items move freely between them like inside the backpack. Drag an item onto any slot (stacks merge, other
// items swap places), or click / tap it to send it straight to the other side. Whatever you leave stays inside.
import { G } from '../game';
import { item, PACK } from '../data/items';
import { moveStack, dropStack, countFree } from '../inventory';
import { calcStats, saveChar } from '../character';
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
  inv: $('xferInv'), invInfo: $('xferInvInfo'), detail: $('xferDetail'), msg: $('xferMsg'), all: $('xferAll'), close: $('xferClose') };
let spec: TransferSpec | null = null;

const list = (w: string): (Slot | null)[] => (w === 'b' ? spec!.box.items : G.char.inv);
const view = (s: Slot | null) => ({ k: s?.k ?? null, n: s?.n, c: s?.c });

function render(msg?: string) {
  if (!spec) return;
  const b = spec.box, inv = G.char.inv;
  el.title.textContent = spec.title; el.sub.textContent = spec.subtitle;
  el.boxLabel.textContent = `${spec.boxLabel} (${b.items.length - countFree(b.items)}/${b.items.length})`;
  el.box.innerHTML = b.items.map((s, i) => slotHTML('b:' + i, view(s))).join('');
  el.gold.innerHTML = b.gold > 0 ? `Gold: ${b.gold}<button data-gold="1">Take gold</button>` : '';
  el.inv.innerHTML = inv.map((s, i) => slotHTML('p:' + i, view(s))).join('');
  el.invInfo.innerHTML = `(${inv.length - countFree(inv)}/${inv.length}) · ${loadText()} · gold ${G.char.gold}`;
  el.all.style.display = b.items.some(Boolean) || b.gold > 0 ? '' : 'none';
  if (msg !== undefined) el.msg.textContent = msg;
}
function takeGold() { if (!spec) return; G.char.gold += spec.box.gold; spec.box.gold = 0; }
const changed = (msg: string) => { calcStats(); saveChar(); render(msg); };

bindSlots(el.root, {
  drop(from, to) {
    if (!spec) return;
    const [fw, i] = parseId(from), [tw, j] = parseId(to), src = list(fw), s = src[i];
    if (!s) return;
    const name = item(s.k).name;
    const cap = (w: string) => (w === 'p' ? PACK.vol : undefined);
    if (!dropStack(src, i, list(tw), j, cap(tw), cap(fw))) { render(fw === tw ? '' : 'It does not fit in your backpack.'); return; }
    changed(fw === tw ? '' : (tw === 'b' ? 'Stored ' : 'Took ') + name + '.');
  },
  click(id) {
    if (!spec) return;
    const [w, i] = parseId(id), src = list(w), s = src[i];
    if (!s) return;
    const name = item(s.k).name, moved = moveStack(src, i, list(w === 'b' ? 'p' : 'b'), w === 'b' ? PACK.vol : undefined);
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
  changed(left ? 'Your backpack is full (slots or bulk); the rest stays here.' : 'Took everything.');
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
