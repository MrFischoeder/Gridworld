// (0.270) The workshop beside the backpack: six cells for materials and three for tools. Drag a thing from the
// backpack, your hands or the ground into a cell: only its shadow goes there, the thing stays where it is (a lying
// thing is claimed so nobody else works it). When the cells fit a recipe a Make button appears; you stand and work
// and the product lies at your feet. World side: world/workshop.ts.
import { G } from '../game';
import { item, type ItemKey } from '../data/items';
import { CELLS, MAKES, TOOLS } from '../gen/workshop';
import { count } from '../data/crafting';
import { cells, setCell, fits, avail, startMake, working, type Ref } from '../world/workshop';
import { groundPickup } from './ground';
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
function cellHTML(i: number): string {
  const r = cells[i], tool = i >= CELLS.inputs;
  if (!r) return slotHTML('x:' + i, { k: null, hint: tool ? tl('Tool') : tl('Put'), cls: 'cell' + (tool ? ' toolcell' : '') });
  const a = avail(r);
  return slotHTML('x:' + i, { k: r.k, n: a || r.n, cls: 'cell shadow' + (tool ? ' toolcell' : '') + (a ? '' : ' gone'), title: a ? undefined : tl('It is gone') });
}
export function render() {
  const f = fits(), busy = working();
  const makes = f.map((m) => `<div class="mk"><button data-mk="${m.id}">${TL`Make ${nameOf(m.out[0], m.out[1])}`} · ${m.secs} s</button><button data-mk="${m.id}" data-all="1" title="${tl('Keep making it while the materials last')}">×</button></div>`).join('');
  const any = cells.some((c) => c);
  el.innerHTML = `<h2>${tl('Workshop')}</h2><div class="role">${tl('Drag things in: they stay where they are until the work is done.')}</div>` +
    `<h3>${tl('Materials')}</h3><div class="grid cells">${Array.from({ length: CELLS.inputs }, (_, i) => cellHTML(i)).join('')}</div>` +
    `<h3>${tl('Tools')} <span class="sub">${tl('(not used up)')}</span></h3><div class="grid cells">${Array.from({ length: CELLS.tools }, (_, i) => cellHTML(CELLS.inputs + i)).join('')}</div>` +
    `<div class="makes">${busy ? tl('You are working…') : makes || (any ? tl('Nothing can be made of this.') : tl('Put materials in the cells above and the tools below.'))}</div>` +
    (msg ? `<div class="cmsg">${msg}</div>` : '') +
    `<details><summary>${tl('What can be made')}</summary>${MAKES.map((_, i) => `<div class="rec">${recipeText(i)}</div>`).join('')}</details>`;
  msg = '';
}
let sig = '';
const sigNow = () => cells.map((c) => (c ? c.k + avail(c) : '-')).join(',') + (working() ? 'w' : '') + fits().map((m) => m.id).join('+');

/** Something is dragged into / out of / between the cells. Returns a line for the detail area. */
function drop(from: string, to: string): string {
  const [fw, fi] = parseId(from), [tw, ti] = parseId(to);
  if (working()) return tl('Wait until you have finished working.');
  if (fw === 'x') {
    const r = cells[fi];
    if (!r) return '';
    if (tw !== 'x') return setCell(fi, null); // dragged out: the shadow is gone
    if (ti === fi) return '';
    if ((ti >= CELLS.inputs) !== (fi >= CELLS.inputs) && !(ti >= CELLS.inputs ? TOOLS.has(r.k) : true)) return tl('That is no tool.');
    const other = cells[ti]; cells[ti] = r; cells[fi] = other; return '';
  }
  if (tw !== 'x') return '';
  const tool = ti >= CELLS.inputs, c = G.char;
  let ref: Ref | null = null;
  if (fw === 'p') { const s = c.inv[fi]; if (s) ref = { k: s.k, n: count(c.inv, s.k), src: 'pack' }; }
  else if (fw === 'h' || fw === 'o') {
    const s = fw === 'h' ? c.hands[0] : c.off[0];
    if (s) { if (!tool) return tl('Put it in your backpack first.'); ref = { k: s.k, n: 1, src: 'hand' }; }
  } else if (fw === 'f') {
    const p = groundPickup(fi);
    if (!p) return '';
    if (!p.drop) return tl('That cannot be worked where it lies.');
    ref = { k: p.k, n: p.n ?? 1, src: 'ground', id: p.drop };
  } else return tl('That cannot go in a cell.');
  if (!ref) return '';
  if (tool && !TOOLS.has(ref.k)) return tl('That is no tool.');
  if (!tool && TOOLS.has(ref.k) && !MAKES.some((m) => m.inputs.some(([k]) => k === ref!.k))) return tl('That is a tool: it goes in a tool cell.');
  if (ref.src === 'pack' && cells.some((q, j) => j !== ti && q?.src === 'pack' && q.k === ref!.k)) return tl('That is already in a cell.');
  return setCell(ti, ref);
}
function click(id: string): string {
  const [, i] = parseId(id);
  return working() ? '' : setCell(i, null);
}
setCraftPanel({
  show(on) { open = on; el.style.display = on ? 'block' : 'none'; if (on) render(); },
  render() { render(); sig = sigNow(); },
  drop, click,
});
el.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-mk]');
  if (!b) return;
  const m = MAKES.find((x) => x.id === b.dataset.mk);
  if (!m) return;
  const why = startMake(m, !!b.dataset.all);
  if (why) { msg = why; refreshPack(); return; }
  closePack(); // you stand and work; the progress shows in the prompt
});
/** Keeps the cells current while the window is open (a lying thing taken by another hero, the stack you used). */
setInterval(() => {
  if (!G.packOpen || !open || document.querySelector('.slot.ghost')) return;
  if (sigNow() !== sig) refreshPack();
}, 300);
