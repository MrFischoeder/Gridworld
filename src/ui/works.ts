// The window of a processing works (E at it; gen/plants.ts, world/works.ts): what it can make (pick one), the hopper
// (load crates of the inputs from your backpack and the vehicles parked by the village), the batch under way, and
// the finished crates (collect them: into the trunks first, crates are heavy).
import { G, W } from '../game';
import { ITEMS } from '../data/items';
import { calcStats, saveChar } from '../character';
import { PLANTS, HOPPER, OUT_CAP, plantsOf, runPlant, progress, feed, collect, setRecipe, type PlantState } from '../gen/plants';
import { findPoi } from '../gen/regions';
import { GOOD_INFO, type Good } from '../gen/market';
import { carried, takeFrom, putAway } from './market';
import type { Works } from '../world/works';
import { $ } from './hud';
import { lockPointer } from './input';

const dlgEl = $('dlg'), panel = () => dlgEl.querySelector('.panel') as HTMLElement;
let open: Works | null = null;
const plant = (): PlantState | null => (open ? plantsOf(G.char.towns[open.vid])[open.slot] ?? null : null);
const where = () => (open ? findPoi(G.char.world, open.vid) ?? null : null);

function render(msg = '') {
  const p = plant(), at = where();
  if (!p || !open) return;
  const now = G.char.time, spec = PLANTS[p.k];
  runPlant(p, now);
  const rec = spec.recipes[p.rec], pr = progress(p, now);
  const name = (g: Good) => ITEMS[g].name, recTxt = (i: number) => { const r = spec.recipes[i]; return r.in.map(([g, n]) => `${n} ${name(g)}`).join(' + ') + ` → ${r.out[1]} ${name(r.out[0])}`; };
  const recipes = spec.recipes.length > 1 ? spec.recipes.map((_, i) => `<button class="opt" style="width:auto;${i === p.rec ? 'color:var(--gold)' : ''}" data-wkr="${i}">${i === p.rec ? '▸ ' : ''}${recTxt(i)}</button>`).join('') : '';
  const inputs = [...new Set(spec.recipes.flatMap((r) => r.in.map(([g]) => g)))];
  const rows = inputs.map((g) => {
    const inn = p.inp[g] ?? 0, have = carried(g, at), room = HOPPER - inn;
    return `<div class="shoprow"><div><b>${name(g)}</b><br><span>in the hopper ${inn}/${HOPPER} · you have ${have}</span></div>
      <button class="opt" style="width:auto" data-wkl="${g}" data-n="1" ${have && room ? '' : 'disabled'}>load 1</button>
      <button class="opt" style="width:auto" data-wkl="${g}" data-n="999" ${have > 1 && room > 1 ? '' : 'disabled'}>load all</button></div>`;
  }).join('');
  const outs = Object.entries(p.out).filter(([, n]) => n).map(([g, n]) => `<div class="shoprow"><div><b>${name(g as Good)}</b><br><span>${n} finished · worth about ${GOOD_INFO[g as Good].base} g a crate</span></div>
      <button class="opt" style="width:auto;color:var(--gold)" data-wkc="${g}">collect ${n}</button></div>`).join('');
  const state = pr !== null ? `Working: batch ${Math.round(pr * 100)}% · next in ${Math.ceil(spec.batch * (1 - pr))} min.`
    : !rec.in.every(([g, n]) => (p.inp[g] ?? 0) >= n) ? `Idle: it needs ${rec.in.map(([g, n]) => `${n} ${name(g)}`).join(' and ')} for a batch.`
    : `Idle: the output bay is full (${OUT_CAP} crates). Collect them.`;
  panel().classList.add('wide');
  panel().innerHTML = `<h2>${spec.name}</h2><div class="role">${open.town} · ${spec.blurb}</div>` +
    `<div class="say">${msg ? msg + '<br><br>' : ''}Makes <b>${recTxt(p.rec)}</b>, a batch every ${spec.batch} minutes while the hopper holds the inputs. ${state}<br><span style="opacity:.8">Crates come from your backpack and your vehicles parked by the village.</span></div>` +
    (recipes ? `<div class="say" style="margin:6px 0 0">What it makes</div>${recipes}` : '') +
    `<div class="say" style="margin:10px 0 0">Hopper</div>${rows}` + (outs ? `<div class="say" style="margin:10px 0 0">Finished</div>${outs}` : '') +
    `<button class="opt" data-wkclose="1">Close</button>`;
}
/** Open the window of works w; false when there is none (an empty plot, a building site). */
export function openWorks(w: Works): boolean {
  if (!G.playing || G.dlgOpen || G.packOpen || G.xferOpen) return true;
  open = w;
  if (!plant()) { open = null; return false; }
  G.dlgOpen = true; W.talkNpc = null; G.firing = false; for (const k in G.keys) G.keys[k] = false;
  render();
  dlgEl.style.display = 'flex'; if (document.pointerLockElement) document.exitPointerLock();
  return true;
}
function close() { open = null; G.dlgOpen = false; dlgEl.style.display = 'none'; if (!G.isTouch) lockPointer(); }
/** Clicks in the works window; true when handled. */
export function worksClick(t: HTMLElement): boolean {
  if (!open) return false;
  if (t.closest('[data-wkclose]')) { close(); return true; }
  const p = plant(), at = where(), now = G.char.time;
  if (!p) { close(); return true; }
  const r = t.closest<HTMLElement>('[data-wkr]'), l = t.closest<HTMLElement>('[data-wkl]'), c = t.closest<HTMLElement>('[data-wkc]');
  if (r) { setRecipe(p, +r.dataset.wkr!, now); saveChar(); render('It is set to make something else now.'); return true; }
  if (l) {
    const g = l.dataset.wkl as Good, n = feed(p, g, Math.min(+l.dataset.n!, carried(g, at)), now);
    if (n) takeFrom(g, n, at);
    calcStats(); saveChar();
    render(n ? `Loaded ${n} × ${ITEMS[g].name} into the hopper.` : 'The hopper has no room for more of that.');
    return true;
  }
  if (c) {
    const g = c.dataset.wkc as Good, n = collect(p, g, 999, now), lost = putAway(g, n, at, true);
    if (lost) (p.out[g] = (p.out[g] ?? 0) + lost); // what did not fit stays in the bay
    calcStats(); saveChar();
    render(n - lost ? `Collected ${n - lost} × ${ITEMS[g].name}${lost ? ` (${lost} left in the bay: no room)` : ''}.` : 'No room for a crate in your backpack or a vehicle parked by the village.');
    return true;
  }
  return false;
}
