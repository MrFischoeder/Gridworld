// The ground beside the backpack: whatever lies within reach of you (things you or others put down, loot your
// backpack had no room for) shows in the side panel of the backpack window (ui/backpack.ts). Drag or click an item
// into the backpack to pick it up; drag one of yours onto the ground (or press Drop) to put it down at your feet.
// Nothing is picked up by walking over it: only from here or with E by the thing.
import { G, W } from '../game';
import { item, ITEMS } from '../data/items';
import { listOf } from '../character';
import type { Pickup } from '../world/loot';
import { grabPickup } from '../world/loot';
import { dropAtFeet, takeDrop } from '../world/drops';
import { $ } from './hud';
import { slotHTML, parseId } from './slots';
import { setGroundSide, refreshPack, packSide, type PackSide } from './backpack';

/** How far around you the ground panel looks (m), and how many things it lists. */
export const GROUND = { reach: 2, max: 48, min: 24 };

const el = { side: $('packSide'), title: $('sideTitle'), sub: $('sideSub'), label: $('sideLabel'), grid: $('sideGrid'), gold: $('sideGold'), msg: $('sideMsg'), all: $('sideAll') };
/** The pickups shown, in slot order (f:i). */
let shown: Pickup[] = [];
let sig = '', msg = '';

/** The things lying within reach, nearest first. */
export function groundNear(): Pickup[] {
  const body = G.pos.y + 0.9;
  return W.pickups
    .filter((p) => ITEMS[p.k] && Math.hypot(p.p.x - G.pos.x, p.p.z - G.pos.z) < GROUND.reach && Math.abs(p.p.y - body) < 2.5)
    .sort((a, b) => Math.hypot(a.p.x - G.pos.x, a.p.z - G.pos.z) - Math.hypot(b.p.x - G.pos.x, b.p.z - G.pos.z))
    .slice(0, GROUND.max);
}
const sigOf = (ps: Pickup[]) => ps.map((p) => `${p.drop ?? p.k}:${p.n ?? 1}:${p.taking ? 1 : 0}`).join('|');

/** Picks a lying thing up: a shared drop asks the server (it arrives a moment later), loot comes at once. */
function take(p: Pickup): string {
  const name = item(p.k).name + ((p.n ?? 1) > 1 ? ' ×' + p.n : '');
  if (p.drop) { takeDrop(p); return `Picking up ${name}…`; }
  return grabPickup(p) ? `Picked up ${name}.` : 'No room for it in your backpack.';
}

const ground: PackSide = {
  prefix: 'f',
  render() {
    shown = groundNear(); sig = sigOf(shown);
    el.side.classList.add('ground');
    el.title.textContent = 'On the ground';
    el.sub.textContent = `Within ${GROUND.reach} m of you`;
    el.label.textContent = shown.length ? `Lying here (${shown.length})` : 'Nothing lies here';
    const n = Math.max(GROUND.min, Math.ceil((shown.length + 6) / 6) * 6); // always a free row to put things down
    el.grid.innerHTML = Array.from({ length: n }, (_, i) => {
      const p = shown[i];
      return p ? slotHTML('f:' + i, { k: p.k, n: p.n, c: p.c, cls: p.taking ? 'off' : '' }) : slotHTML('f:' + i, { k: null, cls: 'empty-ground', title: 'Drag an item here to put it down' });
    }).join('');
    el.gold.innerHTML = '';
    el.all.textContent = 'Pick up all';
    el.all.style.display = shown.length ? '' : 'none';
    el.msg.textContent = msg || (shown.length ? 'Click an item or drag it into your backpack to pick it up. Drag yours here to put them down.' : 'Drag an item here (or select it and press Drop) to put it down at your feet.');
    msg = '';
  },
  drop(from, to) {
    const [fw, i] = parseId(from), [tw] = parseId(to);
    if (fw === 'f' && tw === 'f') return '';
    if (fw === 'f') { const p = shown[i]; return p && W.pickups.includes(p) ? take(p) : ''; } // into the kit: it finds its own place
    if (fw !== 'p' && fw !== 'k' && fw !== 'h') return 'Take it off into your backpack first.';
    const L = listOf(fw), s = L[i];
    if (!s) return '';
    L[i] = null; dropAtFeet(s);
    return `You put down ${item(s.k).name}${s.n > 1 ? ' ×' + s.n : ''}.`;
  },
  click(id) {
    const [, i] = parseId(id), p = shown[i];
    return p && W.pickups.includes(p) ? take(p) : '';
  },
  close() { shown = []; sig = ''; },
};
setGroundSide(ground);

el.all.addEventListener('click', () => {
  if (packSide() !== ground) return;
  let left = 0;
  for (const p of groundNear()) { if (p.drop) takeDrop(p); else if (!grabPickup(p)) left++; }
  msg = left ? 'No room for the rest: it stays on the ground.' : 'Picked everything up.';
  refreshPack();
});

/** Keeps the panel current while the backpack is open (things land, others pick them up, you walk away). */
setInterval(() => {
  if (!G.packOpen || packSide() !== ground || document.querySelector('.slot.ghost')) return;
  if (sigOf(groundNear()) !== sig) refreshPack();
}, 300);
