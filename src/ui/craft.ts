// The workbench window: the recipes you can make here, what each needs (what you carry / what it takes), and a
// Craft button. It lives in the dialogue panel: a village blacksmith's forge opens it from his options (every
// recipe), a workbench you set up in the wilds opens it on its own (only the plain 'bench' recipes).
import { G, W } from '../game';
import { ITEMS, PACK } from '../data/items';
import { RECIPES, canUseAt, count, craft, hasAll, type Station } from '../data/crafting';
import { saveChar, calcStats } from '../character';
import { packBench, type Bench } from '../world/benches';
import { loadText } from './slots';
import { $ } from './hud';
import { lockPointer } from './input';

const dlgEl = $('dlg'), panel = () => dlgEl.querySelector('.panel') as HTMLElement;
let station: Station = 'bench', bench: Bench | null = null;

/** Draws the recipe list into the dialogue panel. `head` is the title block, `foot` the buttons under the list. */
function render(msg = '') {
  const inv = G.char.inv;
  const rows = RECIPES.map((r, i) => {
    const ok = canUseAt(r, station), all = ok && hasAll(inv, r), it = ITEMS[r.out];
    const needs = r.needs.map(([k, n]) => { const have = count(inv, k); return `<span class="${have >= n ? '' : 'bad'}">${ITEMS[k].name} ${have}/${n}</span>`; }).join(' · ');
    return `<div class="shoprow${ok ? '' : ' off'}"><div><b>${it.name}${r.n > 1 ? ' ×' + r.n : ''}</b><br><span>${ok ? needs : 'needs a forge: craft it at a village blacksmith'}</span></div>
      <button class="buy" data-craft="${i}" ${all ? '' : 'disabled'}>Craft</button></div>`;
  }).join('');
  const head = bench ? `<h2>Workbench</h2><div class="role">your own, set up in the wilds</div>` : `<h2>${W.talkNpc?.name ?? 'Forge'}'s workbench</h2><div class="role">the forge: everything can be made here</div>`;
  const foot = bench ? `<button class="opt" data-cpack="1">Pack up the workbench</button><button class="opt" data-cclose="1">Close</button>` : `<button class="opt" data-o="back">Back</button>`;
  panel().innerHTML = head + `<div class="say">Backpack: ${loadText()}${msg ? '<br>' + msg : ''}</div>` + `<div class="recipes">${rows}</div>` + foot;
}

/** From the blacksmith's options: the forge's workbench. */
export function showForge() { station = 'forge'; bench = null; render(); }
/** E at a workbench in the wilds. */
export function openBench(b: Bench) {
  if (!G.playing || G.dlgOpen || G.packOpen || G.xferOpen) return;
  station = 'bench'; bench = b;
  G.dlgOpen = true; W.talkNpc = null; G.firing = false; for (const k in G.keys) G.keys[k] = false;
  render('');
  dlgEl.style.display = 'flex'; if (document.pointerLockElement) document.exitPointerLock();
}
function close() { G.dlgOpen = false; bench = null; dlgEl.style.display = 'none'; if (!G.isTouch) lockPointer(); }

/** Clicks inside the panel that belong to the workbench. Returns true when handled. */
export function craftClick(t: HTMLElement): boolean {
  const c = t.closest<HTMLElement>('[data-craft]');
  if (c) {
    const r = RECIPES[+c.dataset.craft!], why = craft(G.char.inv, r, PACK.vol);
    if (!why) { calcStats(); saveChar(); }
    render(why === 'missing' ? 'You are missing something.' : why === 'room' ? 'No room in your backpack for it.' : `Made: ${ITEMS[r.out].name}${r.n > 1 ? ' ×' + r.n : ''}.`);
    return true;
  }
  if (t.closest('[data-cclose]')) { close(); return true; }
  if (t.closest('[data-cpack]') && bench) { const m = packBench(bench); if (m) render(m); else close(); return true; }
  return false;
}
