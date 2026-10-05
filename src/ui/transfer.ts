// Containers (chests, bandit stashes, vehicle trunks, lockers): opened beside the backpack (ui/backpack.ts), and
// items move freely between them. Drag an item onto any slot (stacks merge, other items swap places), click one in
// the container to take it, or select one of yours and Store it. Whatever you leave stays inside.
import { online, lockContainer, unlockContainer, saveContainer, activeContainers, net } from '../net/client';
import { G } from '../game';
import { item, HANDS_ONLY, WEAPON_KIND } from '../data/items';
import { moveStack, dropStack, countFree } from '../inventory';
import { stowHeld, packVol } from '../character';
import type { Container, Slot } from '../save';
import { $, showToast } from './hud';
import { slotHTML, parseId } from './slots';
import { openPack, closePack, refreshPack, packSide, type PackSide } from './backpack';

export interface TransferSpec {
  title: string; subtitle: string; boxLabel: string;
  box: Container;
  onClose?: () => void;
}

const el = { side: $('packSide'), title: $('sideTitle'), sub: $('sideSub'), label: $('sideLabel'), grid: $('sideGrid'), gold: $('sideGold'), msg: $('sideMsg'), all: $('sideAll') };
let spec: TransferSpec | null = null;
let locked: string | null = null, opening = false;

/** Slot lists by id prefix: b = the container, p = backpack, k = your back, h = your hands. */
const list = (w: string): (Slot | null)[] => (w === 'b' ? spec!.box.items : w === 'h' ? G.char.hands : w === 'k' ? G.char.back : G.char.inv);
const view = (s: Slot | null) => ({ k: s?.k ?? null, n: s?.n, c: s?.c });
const mine = (w: string) => w === 'b' || w === 'p' || w === 'k' || w === 'h';

/** False (and the window shut) when the server took the container away from us. */
function canTransfer() { if (locked && !activeContainers.has(locked)) { locked = null; closePack(); return false; } return true; }
function takeGold() { if (!spec) return; G.char.gold += spec.box.gold; spec.box.gold = 0; }
const save = () => { if (locked && spec) saveContainer(locked, spec.box); };

const box: PackSide = {
  prefix: 'b',
  act: ['store', 'Store'],
  render() {
    if (!spec) return;
    const b = spec.box;
    el.side.classList.remove('ground');
    el.title.textContent = spec.title; el.sub.textContent = spec.subtitle;
    el.label.textContent = `${spec.boxLabel} (${b.items.length - countFree(b.items)}/${b.items.length})`;
    el.grid.innerHTML = b.items.map((s, i) => slotHTML('b:' + i, view(s))).join('');
    el.gold.innerHTML = b.gold > 0 ? `Gold: ${b.gold}<button data-gold="1">Take gold</button>` : '';
    el.all.textContent = 'Take all';
    el.all.style.display = b.items.some(Boolean) || b.gold > 0 ? '' : 'none';
  },
  drop(from, to) {
    if (!spec || !canTransfer()) return '';
    const [fw, i] = parseId(from), [tw, j] = parseId(to);
    if (!mine(fw) || !mine(tw)) return fw === 'b' ? 'Put it in your backpack first.' : 'Take it off into your backpack first.';
    const src = list(fw), s = src[i];
    if (!s) return '';
    const name = item(s.k).name, dst = list(tw)[j];
    const cap = (w: string) => (w === 'p' ? packVol() : undefined);
    if (tw === 'k' && WEAPON_KIND[s.k] === undefined || fw === 'k' && dst && WEAPON_KIND[dst.k] === undefined) return 'Only weapons go on your back.';
    if (tw === 'p' && HANDS_ONLY.has(s.k) || fw === 'p' && dst && HANDS_ONLY.has(dst.k)) return `The ${item((tw === 'p' ? s : dst!).k).name} is too big for the backpack: carry it in your hands.`;
    if (!dropStack(src, i, list(tw), j, cap(tw), cap(fw))) return fw === tw ? '' : 'It does not fit in your backpack.';
    save();
    return fw === tw ? '' : (tw === 'b' ? 'Stored ' : 'Took ') + name + '.';
  },
  click(id) {
    if (!spec || !canTransfer()) return '';
    const [w, i] = parseId(id), src = list(w), s = src[i];
    if (!s) return '';
    const name = item(s.k).name;
    if (w === 'b' && HANDS_ONLY.has(s.k)) { // too big for the backpack: into your hands (a weapon you held goes onto your back)
      const m = stowHeld(); if (m) return m;
      G.char.hands[0] = { ...s, n: 1 }; if (--s.n <= 0) src[i] = null;
      save(); return `You carry the ${name} in your hands.`;
    }
    let moved = moveStack(src, i, list(w === 'b' ? 'p' : 'b'), w === 'b' ? packVol() : undefined);
    if (!moved && w === 'b' && WEAPON_KIND[s.k] !== undefined) { const f = G.char.back.indexOf(null); if (f >= 0) { G.char.back[f] = { ...s, n: 1 }; if (--s.n <= 0) src[i] = null; moved = 1; } }
    if (moved) save();
    const where = w === 'b' ? 'Took ' : 'Stored ';
    return moved ? `${where}${name}${moved > 1 ? ' ×' + moved : ''}.` : w === 'b' ? 'No room in your backpack.' : `The ${spec.boxLabel.toLowerCase()} is full.`;
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
  if ((e.target as HTMLElement).closest('[data-gold]')) { takeGold(); save(); el.msg.textContent = 'Gold taken.'; refreshPack(); }
});
el.all.addEventListener('click', () => {
  if (packSide() !== box || !spec || !canTransfer()) return;
  takeGold();
  let left = false;
  spec.box.items.forEach((_, i) => { moveStack(spec!.box.items, i, G.char.inv, packVol()); if (spec!.box.items[i]) left = true; });
  save();
  el.msg.textContent = left ? 'Your backpack is full (slots or bulk), or the rest is too big for it (click it to carry it in your hands); it stays here.' : 'Took everything.';
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
      if (!ok && online()) showToast('Someone else is using this container');
      return;
    }
    locked = key;
    s.box = G.char.containers[key];
  }
  spec = s;
  el.msg.textContent = 'Drag items between the two, click one in here to take it, or select one of yours and Store it. Whatever you leave stays here.';
  openPack(box);
  if (!G.packOpen) box.close();
}
/** Shuts the container (and the backpack beside it). */
export function closeTransfer() { if (spec && packSide() === box) closePack(); }
