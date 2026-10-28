// (0.270, reworked in 0.271) The workshop beside the backpack: six cells for materials and three for tools. Drag a thing from the
// backpack, your hands or the ground into a cell: only its shadow goes there, the thing stays where it is (a lying
// thing is claimed so nobody else works it). When the cells fit a recipe a Make button appears; you stand and work
// and the product lies at your feet. The recipe list fills the cells for you from your backpack, your hands and
// what lies in reach. World side: world/workshop.ts.
import { G } from '../game';
import { item, type ItemKey } from '../data/items';
import { CELLS, MAKES, TOOLS } from '../gen/workshop';
import { count } from '../data/crafting';
import { cells, setCell, fits, avail, startMake, working, batchesNow, missing, fillFor, type Ref } from '../world/workshop';
import { groundPickup } from './ground';
import { adoptPickup } from '../world/drops';
import { setCraftPanel, closePack, refreshPack } from './backpack';
import { slotHTML, parseId } from './slots';
import { $ } from './hud';
import { tl, TL } from '../i18n';

const el = $('packCraft');
let msg = '', open = false;

const nameOf = (k: ItemKey, n: number) => item(k).name + (n > 1 ? ' ×' + n : '');
function recipeText(i: number): string {
  const m = MAKES[i];
  return TL`${nameOf(m.out[0], m.out[1])} ← ${m.inputs.map(([k, n]) => nameOf(k, n)).join(', ')}${m.tools.length ? TL` · tools: ${m.tools.map((k) => item(k).name).join(', ')}` : ''}`;
}
/** The recipe book: what you could make here now first (a click fills the cells), then the rest with what is missing. */
function book(): string {
  const rows = MAKES.map((m, i) => ({ m, i, lack: missing(m) })).sort((a, b) => a.lack.length - b.lack.length || a.i - b.i);
  const ready = rows.filter((r) => !r.lack.length).length;
  return `<details${ready ? ' open' : ''}><summary>${TL`What can be made (${ready} ready here)`}</summary>` + rows.map(({ m, i, lack }) => lack.length
    ? `<div class="rec off">${recipeText(i)}<br><span class="sub">${TL`missing: ${lack.map(([k, n]) => nameOf(k, n)).join(', ')}`}</span></div>`
    : `<div class="rec"><button data-fill="${m.id}" title="${tl('Put what it needs into the cells')}">${tl('Prepare')}</button> ${recipeText(i)}</div>`).join('') + '</details>';
}
function cellHTML(i: number): string {
  const r = cells[i], tool = i >= CELLS.inputs;
  if (!r) return slotHTML('x:' + i, { k: null, hint: tool ? tl('Tool') : tl('Put'), cls: 'cell' + (tool ? ' toolcell' : '') });
  const a = avail(r);
  return slotHTML('x:' + i, { k: r.k, n: a || r.n, cls: 'cell shadow' + (tool ? ' toolcell' : '') + (a ? '' : ' gone'), title: a ? undefined : tl('It is gone') });
}
export function render() {
  const f = fits(), busy = working();
  const makes = f.map((m) => {
    const n = batchesNow(m);
    return `<div class="mk"><button data-mk="${m.id}" data-n="1">${TL`Make ${nameOf(m.out[0], m.out[1])}`} · ${m.secs} s</button>` +
      (n > 1 ? `<button data-mk="${m.id}" data-n="${n}" title="${tl('Keep making it while the materials last')}">${TL`All ×${n}`}</button>` : '') + '</div>';
  }).join('');
  const any = cells.some((c) => c);
  el.innerHTML = `<h2>${tl('Workshop')}</h2><div class="role">${tl('Drag things in: they stay where they are until the work is done.')}</div>` +
    `<h3>${tl('Materials')}</h3><div class="grid cells">${Array.from({ length: CELLS.inputs }, (_, i) => cellHTML(i)).join('')}</div>` +
    `<h3>${tl('Tools')} <span class="sub">${tl('(not used up)')}</span></h3><div class="grid cells">${Array.from({ length: CELLS.tools }, (_, i) => cellHTML(CELLS.inputs + i)).join('')}</div>` +
    `<div class="makes">${busy ? tl('You are working…') : makes || (any ? tl('Nothing can be made of this.') : tl('Put materials in the cells above and the tools below.'))}</div>` +
    (any && !busy ? `<div class="acts"><button data-clear="1">${tl('Clear the cells')}</button></div>` : '') +
    (msg ? `<div class="cmsg">${msg}</div>` : '') + book();
  msg = '';
}
let sig = '';
const sigNow = () => cells.map((c) => (c ? c.k + avail(c) : '-')).join(',') + (working() ? 'w' : '') + MAKES.map((m) => missing(m).length).join('');

/** A thing from the backpack (p), your hands (h, o) or the ground (f) as a shadow for a cell, or why not. */
function refOf(from: string, tool: boolean): Ref | string {
  const [fw, fi] = parseId(from), c = G.char;
  if (fw === 'p') { const s = c.inv[fi]; return s ? { k: s.k, n: count(c.inv, s.k), src: 'pack' } : ''; }
  if (fw === 'h' || fw === 'o') {
    const s = fw === 'h' ? c.hands[0] : c.off[0];
    if (!s) return '';
    return tool || TOOLS.has(s.k) ? { k: s.k, n: 1, src: 'hand' } : tl('Put it in your backpack first.');
  }
  if (fw === 'f') {
    const p = groundPickup(fi);
    if (!p) return '';
    return p.drop || adoptPickup(p) ? { k: p.k, n: p.n ?? 1, src: 'ground', id: p.drop } : tl('That cannot be worked where it lies.');
  }
  return tl('That cannot go in a cell.');
}
/** Into cell i, or the first free cell of the right kind (tools below, materials above) when i < 0. */
function putIn(from: string, i: number): string {
  const probe = refOf(from, true);
  if (typeof probe === 'string') return probe;
  const tool = TOOLS.has(probe.k) && !MAKES.some((m) => m.inputs.some(([k]) => k === probe.k));
  if (i < 0) {
    const lo = tool ? CELLS.inputs : 0, hi = tool ? cells.length : CELLS.inputs;
    i = cells.findIndex((c, j) => j >= lo && j < hi && !c);
    if (i < 0) return tl('The cells are full.');
  }
  const ref = refOf(from, i >= CELLS.inputs);
  if (typeof ref === 'string') return ref;
  if (i >= CELLS.inputs && !TOOLS.has(ref.k)) return tl('That is no tool.');
  if (i < CELLS.inputs && tool) return tl('That is a tool: it goes in a tool cell.');
  return setCell(i, ref);
}
/** Something is dragged into / out of / between the cells. Returns a line for the detail area. */
function drop(from: string, to: string): string {
  const [fw, fi] = parseId(from), [tw, ti] = parseId(to);
  if (working()) return tl('Wait until you have finished working.');
  if (fw === 'x') {
    const r = cells[fi];
    if (!r) return '';
    if (tw !== 'x') return setCell(fi, null); // dragged out: the shadow is gone
    if (ti === fi) return '';
    if (ti >= CELLS.inputs && !TOOLS.has(r.k)) return tl('That is no tool.');
    const other = cells[ti]; cells[ti] = r; cells[fi] = other; return '';
  }
  return tw === 'x' ? putIn(from, ti) : '';
}
function click(id: string): string {
  const [, i] = parseId(id);
  return working() ? '' : setCell(i, null);
}
setCraftPanel({
  show(on) { open = on; el.style.display = on ? 'block' : 'none'; if (on) render(); },
  render() { render(); sig = sigNow(); },
  drop, click,
  put: (id) => (working() ? tl('Wait until you have finished working.') : putIn(id, -1)),
});
el.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  if (t.closest('[data-clear]')) { for (let i = 0; i < cells.length; i++) setCell(i, null); refreshPack(); return; }
  const f = t.closest<HTMLElement>('[data-fill]');
  if (f) { const m = MAKES.find((x) => x.id === f.dataset.fill); if (m) { msg = fillFor(m); refreshPack(); } return; }
  const b = t.closest<HTMLElement>('[data-mk]');
  if (!b) return;
  const m = MAKES.find((x) => x.id === b.dataset.mk);
  if (!m) return;
  const why = startMake(m, Math.max(1, +(b.dataset.n ?? 1)));
  if (why) { msg = why; refreshPack(); return; }
  closePack(); // you stand and work; the progress shows in the prompt
});
/** Keeps the cells current while the window is open (a lying thing taken by another hero, the stack you used). */
setInterval(() => {
  if (!G.packOpen || !open || document.querySelector('.slot.ghost')) return;
  if (sigNow() !== sig) refreshPack();
}, 400);
