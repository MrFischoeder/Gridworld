// Container window: move stacks between a chest or trunk and the backpack, take the gold, take everything.
import { G } from '../game';
import { item } from '../data/items';
import { moveStack, countFree } from '../inventory';
import { calcStats, saveChar } from '../character';
import type { Container } from '../save';
import { $ } from './hud';
import { lockPointer } from './input';

export interface TransferSpec {
  title: string; subtitle: string; boxLabel: string;
  box: Container;
  /** Trunks take items from the backpack; chests only give. */
  canStore: boolean;
  onClose?: () => void;
}

const el = { root: $('xfer'), title: $('xferTitle'), sub: $('xferSub'), boxLabel: $('xferBoxLabel'), box: $('xferBox'), gold: $('xferGold'),
  inv: $('xferInv'), invInfo: $('xferInvInfo'), msg: $('xferMsg'), all: $('xferAll'), close: $('xferClose') };
let spec: TransferSpec | null = null;

function slot(s: { k: Parameters<typeof item>[0]; n: number } | null, where: 'box' | 'inv', i: number, active: boolean) {
  if (!s) return `<button class="slot${active ? '' : ' off'}" data-w="${where}" data-i="${i}" aria-label="Empty slot"></button>`;
  const it = item(s.k), cnt = s.n > 1 ? `<span class="n">${s.n}</span>` : '';
  return `<button class="slot ${it.type}${active ? '' : ' off'}" data-w="${where}" data-i="${i}" title="${it.name}: ${it.desc}" aria-label="${it.name}">${it.ab}${cnt}</button>`;
}
function render(msg?: string) {
  if (!spec) return;
  const b = spec.box, inv = G.char.inv;
  el.title.textContent = spec.title; el.sub.textContent = spec.subtitle;
  el.boxLabel.textContent = spec.boxLabel + (spec.canStore ? ` (${b.items.length - countFree(b.items)}/${b.items.length})` : '');
  el.box.innerHTML = b.items.length ? b.items.map((s, i) => slot(s, 'box', i, true)).join('') : '';
  if (!b.items.some(Boolean) && !spec.canStore) el.box.innerHTML = '<div style="grid-column:1/-1;opacity:.7">Nothing left inside.</div>';
  el.gold.innerHTML = b.gold > 0 ? `Gold: ${b.gold}<button data-gold="1">Take gold</button>` : '';
  el.inv.innerHTML = inv.map((s, i) => slot(s, 'inv', i, spec!.canStore)).join('');
  el.invInfo.textContent = `(${inv.length - countFree(inv)}/${inv.length}) · gold ${G.char.gold}`;
  el.all.style.display = b.items.some(Boolean) || b.gold > 0 ? '' : 'none';
  if (msg !== undefined) el.msg.textContent = msg;
}
function takeGold() { if (!spec) return; G.char.gold += spec.box.gold; spec.box.gold = 0; }

el.root.addEventListener('click', (e) => {
  if (!spec) return;
  const t = e.target as HTMLElement, s = t.closest<HTMLElement>('.slot');
  if (t.closest('[data-gold]')) { takeGold(); saveChar(); render('Gold taken.'); return; }
  if (!s) return;
  const i = +s.dataset.i!, inv = G.char.inv;
  if (s.dataset.w === 'box') {
    const st = spec.box.items[i]; if (!st) return;
    const name = item(st.k).name, moved = moveStack(spec.box.items, i, inv);
    render(moved ? `Took ${name}${moved > 1 ? ' ×' + moved : ''}.` : 'Your backpack is full.');
  } else if (spec.canStore) {
    const st = inv[i]; if (!st) return;
    const name = item(st.k).name, moved = moveStack(inv, i, spec.box.items);
    render(moved ? `Stored ${name}${moved > 1 ? ' ×' + moved : ''}.` : 'The trunk is full.');
  } else return;
  calcStats(); saveChar();
});
el.all.onclick = () => {
  if (!spec) return;
  takeGold();
  let left = false;
  spec.box.items.forEach((_, i) => { moveStack(spec!.box.items, i, G.char.inv); if (spec!.box.items[i]) left = true; });
  saveChar(); render(left ? 'Your backpack is full; the rest stays here.' : 'Took everything.');
};
el.close.onclick = () => closeTransfer();

export function openTransfer(s: TransferSpec) {
  if (!G.playing || G.xferOpen || G.packOpen || G.dlgOpen) return;
  spec = s; G.xferOpen = true; G.firing = false; for (const k in G.keys) G.keys[k] = false;
  render(s.canStore ? 'Click an item to move it between the trunk and your backpack.' : 'Click an item to take it. Whatever you leave stays in the chest.');
  el.root.style.display = 'flex';
  if (document.pointerLockElement) document.exitPointerLock();
}
export function closeTransfer() {
  if (!G.xferOpen) return;
  G.xferOpen = false; el.root.style.display = 'none';
  const cb = spec?.onClose; spec = null; cb?.();
  if (!G.isTouch) lockPointer();
}
