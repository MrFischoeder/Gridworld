// (0.207) Shared parts of the map editor (editor.html): a pan-and-zoom view over a flat plan, a tiny DOM helper and an
// undo history. Plain DOM and canvas, no framework (the game's own rule).

/** A plan seen from above: world units (metres, or cells) to canvas pixels. */
export class View {
  /** Pixels a unit; the world point at the canvas middle. */
  scale = 8; ox = 0; oz = 0;
  w = 1; h = 1;
  constructor(public min = 0.05, public max = 64) {}
  sx(x: number) { return (x - this.ox) * this.scale + this.w / 2; }
  sz(z: number) { return (z - this.oz) * this.scale + this.h / 2; }
  wx(px: number) { return (px - this.w / 2) / this.scale + this.ox; }
  wz(py: number) { return (py - this.h / 2) / this.scale + this.oz; }
  zoomAt(px: number, py: number, f: number) {
    const x = this.wx(px), z = this.wz(py);
    this.scale = Math.max(this.min, Math.min(this.max, this.scale * f));
    this.ox = x - (px - this.w / 2) / this.scale; this.oz = z - (py - this.h / 2) / this.scale;
  }
  fit(x0: number, z0: number, x1: number, z1: number) {
    this.ox = (x0 + x1) / 2; this.oz = (z0 + z1) / 2;
    this.scale = Math.max(this.min, Math.min(this.max, 0.9 * Math.min(this.w / Math.max(1, x1 - x0), this.h / Math.max(1, z1 - z0))));
  }
}

/** A DOM element with attributes and children. */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string | number | boolean | ((e: Event) => void)> = {}, ...kids: (Node | string | null | undefined | false)[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (typeof v === 'function') el.addEventListener(k.replace(/^on/, ''), v as EventListener);
    else if (k === 'class') el.className = String(v);
    else if (typeof v === 'boolean') { if (v) el.setAttribute(k, ''); }
    else el.setAttribute(k, String(v));
  }
  for (const c of kids) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}
/** A labelled number field that calls back with the new value. */
export function numField(label: string, value: number, set: (v: number) => void, step = 1, min = -1e6, max = 1e6) {
  const inp = h('input', { type: 'number', value, step, min, max });
  inp.addEventListener('change', () => { const v = Number(inp.value); if (Number.isFinite(v)) set(Math.max(min, Math.min(max, v))); });
  return h('label', { class: 'field' }, h('span', {}, label), inp);
}
export function textField(label: string, value: string, set: (v: string) => void) {
  const inp = h('input', { type: 'text', value });
  inp.addEventListener('change', () => set(inp.value.trim()));
  return h('label', { class: 'field' }, h('span', {}, label), inp);
}
export function selectField<T extends string>(label: string, value: T, options: [T, string][], set: (v: T) => void) {
  const sel = h('select', {}, ...options.map(([v, n]) => h('option', { value: v, ...(v === value ? { selected: true } : {}) }, n)));
  sel.addEventListener('change', () => set(sel.value as T));
  return h('label', { class: 'field' }, h('span', {}, label), sel);
}

/** Undo history of a file: snapshots as JSON, at most 80. */
export class History {
  private past: string[] = []; private future: string[] = [];
  push(state: unknown) { this.past.push(JSON.stringify(state)); if (this.past.length > 80) this.past.shift(); this.future = []; }
  undo<T>(now: T): T | null { const s = this.past.pop(); if (s === undefined) return null; this.future.push(JSON.stringify(now)); return JSON.parse(s) as T; }
  redo<T>(now: T): T | null { const s = this.future.pop(); if (s === undefined) return null; this.past.push(JSON.stringify(now)); return JSON.parse(s) as T; }
  clear() { this.past = []; this.future = []; }
}

/** What a tab of the editor does for the page round it. */
export interface Tab<F> {
  file: F;
  /** Builds its tool palette and side panel. */
  mount(tools: HTMLElement, side: HTMLElement): void;
  draw(ctx: CanvasRenderingContext2D, v: View): void;
  view: View;
  down(x: number, z: number, e: MouseEvent): void;
  move(x: number, z: number, e: MouseEvent): void;
  up(x: number, z: number, e: MouseEvent): void;
  key?(e: KeyboardEvent): boolean;
  /** The line under the canvas for the point under the mouse. */
  status(x: number, z: number): string;
  /** Load another file into it (after open, new, import, undo). */
  load(f: F, fresh: boolean): void;
  fresh(name: string): F;
  /** A frame fitting the whole file. */
  frame(): [number, number, number, number];
}
export const fmt = (n: number, d = 0) => n.toFixed(d);
export const colour = (c: number) => '#' + c.toString(16).padStart(6, '0');
