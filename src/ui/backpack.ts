// Backpack window: 12 slots plus 3 relic modules.
import { G } from '../game';
import { item, type ItemKey } from '../data/items';
import { calcStats, saveChar } from '../character';
import { logLine, $ } from './hud';
import { useItem } from '../world/loot';
import { lockPointer } from './input';

let sel: { w: 'mods' | 'inv'; i: number } | null = null;
const packEl = $('pack'), invEl = $('inv'), modsEl = $('mods'), detailEl = $('detail');

function slotHTML(k: ItemKey | null, n: number, where: 'mods' | 'inv', i: number) {
  if (!k) return `<button class="slot" data-w="${where}" data-i="${i}" aria-label="Empty slot"></button>`;
  const it = item(k), cnt = where === 'inv' && n > 1 ? `<span class="n">${n}</span>` : '';
  const s = sel && sel.w === where && sel.i === i ? ' sel' : '';
  return `<button class="slot ${it.type}${s}" data-w="${where}" data-i="${i}" aria-label="${it.name}">${it.ab}${cnt}</button>`;
}
function renderPack() {
  const c = G.char;
  modsEl.innerHTML = c.mods.map((m, i) => slotHTML(m, 1, 'mods', i)).join('');
  invEl.innerHTML = c.inv.map((m, i) => slotHTML(m ? m.k : null, m ? m.n : 0, 'inv', i)).join('');
  let html = 'Select an item to see what it does.';
  const acts: [string, string][] = [];
  if (sel) {
    const k = sel.w === 'mods' ? c.mods[sel.i] : c.inv[sel.i]?.k;
    if (k) {
      const it = item(k);
      html = `<b>${it.name}</b><br>${it.desc}${sel.w === 'mods' ? '<br>Equipped in a module' : ''}`;
      if (sel.w === 'mods') acts.push(['off', 'Unequip']);
      else if (it.type === 'relic') acts.push(['on', 'Equip']);
      else if (it.type === 'cons') acts.push(['use', 'Use']);
      if (sel.w === 'inv') acts.push(['drop', 'Drop']);
    } else sel = null;
  }
  detailEl.innerHTML = html + (acts.length ? '<div class="acts">' + acts.map(([a, t]) => `<button class="${a === 'drop' ? 'drop' : ''}" data-a="${a}">${t}</button>`).join('') + '</div>' : '');
}
packEl.addEventListener('click', (e) => {
  const t = e.target as HTMLElement, s = t.closest<HTMLElement>('.slot'), a = t.closest<HTMLElement>('[data-a]'), c = G.char;
  if (s) { sel = { w: s.dataset.w as 'mods' | 'inv', i: +s.dataset.i! }; renderPack(); return; }
  if (!a || !sel) return;
  if (a.dataset.a === 'off') {
    const f = c.inv.indexOf(null);
    if (f < 0) logLine('Backpack full'); else { c.inv[f] = { k: c.mods[sel.i]!, n: 1 }; c.mods[sel.i] = null; sel = { w: 'inv', i: f }; }
  }
  if (a.dataset.a === 'on') {
    const k = c.inv[sel.i]!.k, f = c.mods.indexOf(null);
    if (f < 0) { detailEl.insertAdjacentHTML('beforeend', '<div style="color:var(--amber)">All modules are full. Unequip one first.</div>'); return; }
    c.mods[f] = k; c.inv[sel.i] = null; sel = { w: 'mods', i: f };
  }
  if (a.dataset.a === 'use') useItem(c.inv[sel.i]!.k);
  if (a.dataset.a === 'drop') { c.inv[sel.i] = null; sel = null; }
  calcStats(); saveChar(); renderPack();
});
export function openPack() {
  if (!G.playing || G.packOpen || G.dlgOpen) return;
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
