// The workbench window: the recipes you can make here, what each needs (what you carry / what it takes), and a
// Craft button. It lives in the dialogue panel: a village blacksmith's forge opens it from his options (every
// recipe), a workbench you set up in the wilds opens it on its own (only the plain 'bench' recipes).
import { G, W } from '../game';
import { ITEMS, PACK, HANDS_ONLY, WEAPON_KIND } from '../data/items';
import { RECIPES, canUseAt, count, craft, craftTime, hasAll, type Station, type Recipe } from '../data/crafting';
import { saveChar, calcStats, stowHeld, handsChanged } from '../character';
import { packBench, type Bench } from '../world/benches';
import { loadText } from './slots';
import { $ } from './hud';
import { lockPointer } from './input';

const dlgEl = $('dlg'), panel = () => dlgEl.querySelector('.panel') as HTMLElement;
let station: Station = 'bench', bench: Bench | null = null;
/** The work under way: recipe i, started at `t0` (ms), `left` more batches after this one. Closing the window stops it (nothing is used up until a batch is done). */
let job: { i: number; t0: number; ms: number; left: number } | null = null, raf = 0;

/** Draws the recipe list into the dialogue panel. `head` is the title block, `foot` the buttons under the list. */
function render(msg = '') {
  const inv = G.char.inv;
  const rows = RECIPES.map((r, i) => {
    const ok = canUseAt(r, station), all = ok && hasAll(inv, r), it = ITEMS[r.out];
    const needs = r.needs.map(([k, n]) => { const have = count(inv, k); return `<span class="${have >= n ? '' : 'bad'}">${ITEMS[k].name} ${have}/${n}</span>`; }).join(' · ') +
      (r.tools ?? []).map((k) => ` · <span class="${count(inv, k) ? '' : 'bad'}">tool: ${ITEMS[k].name}</span>`).join('');
    const busy = !!job, mine = job?.i === i;
    return `<div class="shoprow${ok ? '' : ' off'}"><div><b>${it.name}${r.n > 1 ? ' ×' + r.n : ''}</b> <span style="opacity:.6">${craftTime(r)} s</span><br><span>${ok ? needs : 'needs a forge: craft it at a village blacksmith'}</span>${mine ? `<div class="cbar"><div id="cbarFill"></div></div>` : ''}</div>
      ${mine ? `<button class="buy" data-cstop="1">Stop${job!.left ? ` (${job!.left + 1} left)` : ''}</button>` : `<button class="buy" data-craft="${i}" data-n="1" ${all && !busy ? '' : 'disabled'}>Craft</button><button class="buy" data-craft="${i}" data-n="5" ${all && !busy && !HANDS_ONLY.has(r.out) ? '' : 'disabled'}>×5</button>`}</div>`;
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
function close() { stopJob(); G.dlgOpen = false; bench = null; dlgEl.style.display = 'none'; if (!G.isTouch) lockPointer(); }

/** Clicks inside the panel that belong to the workbench. Returns true when handled. */
export function craftClick(t: HTMLElement): boolean {
  const c = t.closest<HTMLElement>('[data-craft]');
  if (c) {
    if (job) return true;
    const i = +c.dataset.craft!, r = RECIPES[i];
    if (!hasAll(G.char.inv, r)) { render('You are missing something.'); return true; }
    startJob(i, r, Math.max(1, +(c.dataset.n ?? 1)) - 1);
    return true;
  }
  if (t.closest('[data-cstop]')) { stopJob(); render('You put the work down.'); return true; }
  if (t.closest('[data-cclose]')) { close(); return true; }
  if (t.closest('[data-cpack]') && bench) { if (job) return true; const m = packBench(bench); if (m) render(m); else close(); return true; }
  return false;
}
/** Work on recipe i: the bar fills over its time, then the batch is made (and the next one starts, if more were asked). */
function startJob(i: number, r: Recipe, left: number) {
  job = { i, t0: performance.now(), ms: craftTime(r) * 1000, left };
  render(`Working on the ${ITEMS[r.out].name}...`);
  cancelAnimationFrame(raf);
  const tick = () => {
    if (!job) return;
    const k = Math.min(1, (performance.now() - job.t0) / job.ms), fill = document.getElementById('cbarFill');
    if (!G.dlgOpen || !panel().querySelector('.recipes')) { stopJob(); return; } // the window was closed or left
    if (fill) fill.style.width = (k * 100).toFixed(1) + '%';
    if (k < 1) { raf = requestAnimationFrame(tick); return; }
    const more = job.left; job = null;
    const msg = finish(r);
    if (!msg.startsWith('Made') || !more || !hasAll(G.char.inv, r)) { render(msg); return; }
    startJob(i, r, more - 1);
  };
  raf = requestAnimationFrame(tick);
}
function stopJob() { job = null; cancelAnimationFrame(raf); }
/** A batch is done: the materials are used up and the thing is made. */
function finish(r: Recipe): string {
  if (HANDS_ONLY.has(r.out) && G.char.hands[0] && WEAPON_KIND[G.char.hands[0].k] !== undefined) stowHeld(); // it comes out into your hands
  const why = craft(G.char.inv, r, PACK.vol, G.char.hands);
  if (!why) { calcStats(); handsChanged(); saveChar(); }
  return why === 'missing' ? 'You are missing something.' : why === 'room' ? 'No room in your backpack for it.' : why === 'hands' ? `The ${ITEMS[r.out].name} is carried in your hands: free them first.`
    : `Made: ${ITEMS[r.out].name}${r.n > 1 ? ' ×' + r.n : ''}${HANDS_ONLY.has(r.out) ? ' (in your hands)' : ''}.`;
}
