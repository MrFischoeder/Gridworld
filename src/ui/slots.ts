// Item slots shared by every inventory window (backpack, chests and trunks, vehicle service):
// how a slot looks, and drag and drop with the mouse or a finger (pointer events).
import { item, type ItemKey } from '../data/items';

export interface SlotView {
  k: ItemKey | null; n?: number;
  /** Condition in percent (worn parts, a vehicle's engine...): drawn as a bar along the bottom. */
  c?: number;
  /** Shown in an empty slot, e.g. "Optic" or "FL" (front left wheel). */
  hint?: string;
  /** Overrides the item abbreviation (e.g. "ENG" for the engine slot). */
  text?: string;
  /** Extra CSS classes. */
  cls?: string;
  /** Can be dropped on but not dragged away. */
  fixed?: boolean;
  /** Tooltip; defaults to the item's name and description. */
  title?: string;
}
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export function slotHTML(id: string, v: SlotView, selected = false): string {
  const it = v.k ? item(v.k) : null, cls = ['slot', it?.type ?? '', v.cls ?? '', selected ? 'sel' : '', v.k && !v.fixed ? 'drag' : ''].filter(Boolean).join(' ');
  const cnt = (v.n ?? 0) > 1 ? `<span class="n">${v.n}</span>` : '';
  const bar = v.c !== undefined ? `<i class="cond${v.c < 35 ? ' low' : ''}" style="width:${Math.max(0, Math.min(100, v.c))}%"></i>` : '';
  const title = v.title ?? (it ? `${it.name}: ${it.desc}${v.c !== undefined ? ` (${Math.round(v.c)}%)` : ''}` : v.hint ?? 'Empty slot');
  const face = v.text ?? it?.ab ?? (v.hint ? `<span class="hint">${v.hint}</span>` : '');
  return `<button class="${cls}" data-id="${id}" title="${esc(title)}" aria-label="${esc(title)}">${face}${cnt}${bar}</button>`;
}

/** One line about an item for the detail area under the slots. */
export function itemInfo(k: ItemKey, c?: number): string {
  const it = item(k);
  return `<b>${it.name}</b>${c !== undefined ? ` <span class="${c < 35 ? 'bad' : ''}">${Math.round(c)}%</span>` : ''}<br>${it.desc}`;
}

export interface SlotHandlers {
  /** An item was dragged from slot `from` and let go over slot `to`. */
  drop(from: string, to: string): void;
  /** A slot was clicked or tapped (no drag). */
  click(id: string): void;
  /** The pointer is over a slot (or left them): for the detail line. */
  hover?(id: string | null): void;
}

/**
 * Drag and drop inside `root`. Press on a slot holding an item and move a few pixels: a ghost follows the
 * pointer, and letting go over another slot calls drop(). A press without movement is a click. Works with
 * mouse, pen and touch; keyboard activation (Enter / Space) also counts as a click.
 */
export function bindSlots(root: HTMLElement, h: SlotHandlers) {
  let press: { id: string; el: HTMLElement; x: number; y: number; pid: number } | null = null, ghost: HTMLElement | null = null;
  const end = () => {
    ghost?.remove(); ghost = null;
    press?.el.classList.remove('dragging'); press = null;
    removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', cancel);
  };
  const move = (e: PointerEvent) => {
    if (!press || e.pointerId !== press.pid) return;
    if (!ghost) {
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) < 6 || !press.el.classList.contains('drag')) return;
      ghost = press.el.cloneNode(true) as HTMLElement;
      ghost.classList.add('ghost'); ghost.style.width = press.el.offsetWidth + 'px'; ghost.style.height = press.el.offsetHeight + 'px';
      document.body.appendChild(ghost); press.el.classList.add('dragging');
    }
    ghost.style.left = e.clientX - ghost.offsetWidth / 2 + 'px'; ghost.style.top = e.clientY - ghost.offsetHeight / 2 + 'px';
    root.querySelectorAll('.slot.over').forEach((o) => o.classList.remove('over'));
    const t = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('.slot[data-id]');
    if (t && root.contains(t) && t !== press.el) t.classList.add('over');
  };
  const up = (e: PointerEvent) => {
    if (!press || e.pointerId !== press.pid) return;
    const from = press.id, dragged = !!ghost;
    root.querySelectorAll('.slot.over').forEach((o) => o.classList.remove('over'));
    if (ghost) ghost.style.display = 'none';
    const t = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('.slot[data-id]');
    end();
    if (!dragged) h.click(from);
    else if (t && root.contains(t) && t.dataset.id !== from) h.drop(from, t.dataset.id!);
  };
  const cancel = () => end();
  root.addEventListener('pointerdown', (e) => {
    const s = (e.target as HTMLElement).closest<HTMLElement>('.slot[data-id]');
    if (!s || e.button > 0) return;
    e.preventDefault();
    press = { id: s.dataset.id!, el: s, x: e.clientX, y: e.clientY, pid: e.pointerId };
    addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', cancel);
  });
  root.addEventListener('click', (e) => {
    // keyboard activation only (pointer presses are handled above)
    if ((e as MouseEvent).detail !== 0) return;
    const s = (e.target as HTMLElement).closest<HTMLElement>('.slot[data-id]');
    if (s) h.click(s.dataset.id!);
  });
  if (h.hover) {
    root.addEventListener('pointerover', (e) => { const s = (e.target as HTMLElement).closest<HTMLElement>('.slot[data-id]'); if (!press) h.hover!(s ? s.dataset.id! : null); });
  }
}
/** Split a slot id "p:3" into its list prefix and index. */
export const parseId = (id: string): [string, number] => { const [a, b] = id.split(':'); return [a, b === undefined ? -1 : +b]; };
