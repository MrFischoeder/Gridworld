// (0.207) The world editor: a whole planet drawn by hand on a grid of cells (gen/mapfile.ts WorldFile). Brushes raise
// land out of the sea, sink it, pile up mountains, level and smooth; continents and islands are whatever you paint.
// Rivers are drawn as lines, deposits and places (the start, villages, ruins, camps, wrecks, dead cities, the old
// plants, megaliths, caves) are set as markers. A new world can start from the sea, from random continents or from a
// real seed's land. (0.208) The game plays them (stage E2 of PLAN_EDYTORA.md, gen/customworld.ts): 'Test in the game'
// offers it in the game's menu; the start marker is Gridholm.
import { tl, TL } from '../i18n';
import { fbm } from '../core/noise';
import { hash } from '../core/rng';
import { LODES, type LodeKind } from '../gen/lodes';
import { INSTALLS } from '../gen/installs';
import { naturalHeight } from '../gen/heights';
import { WORLD_W, X_MIN, POLE_Z } from '../gen/regions';
import { newWorld, PLACE_KINDS, WORLD_LIMITS, type WorldFile, type PlaceKind, type WorldPlace } from '../gen/mapfile';
import { View, History, h, numField, textField, selectField, colour, type Tab } from './common';

export const PLACE_NAME: Record<PlaceKind, string> = {
  start: tl('Start (Gridholm)'), village: tl('Village'), ruin: tl('Ruins'), camp: tl('Bandit camp'), wreck: tl('Crashed ship'),
  city: tl('Dead city'), install: tl('Old plant'), megalith: tl('Megaliths'), cave: tl('Cave'),
};
const PLACE_C: Record<PlaceKind, string> = { start: '#5cc8ff', village: '#d0ffd8', ruin: '#9dffe0', camp: '#ffb347', wreck: '#8fd0c0', city: '#c8c8b0', install: '#b6ff3a', megalith: '#e0e070', cave: '#a0a080' };
type Brush = 'raise' | 'lower' | 'mountain' | 'flatten' | 'smooth' | 'sea' | 'plain';
const BRUSH_NAME: Record<Brush, string> = { raise: tl('Raise land'), lower: tl('Lower'), mountain: tl('Mountains'), flatten: tl('Flatten'), smooth: tl('Smooth'), sea: tl('Paint sea'), plain: tl('Paint lowland') };
type Tool = { t: 'brush'; b: Brush } | { t: 'river' } | { t: 'lode'; k: LodeKind } | { t: 'place'; k: PlaceKind } | { t: 'select' } | { t: 'erase' };
type Sel = { pl: number } | { lo: number } | { ri: number } | null;

export class WorldTab implements Tab<WorldFile> {
  file: WorldFile; view = new View(0.5, 80);
  private tool: Tool = { t: 'brush', b: 'raise' }; private radius = 4; private strength = 6;
  private lode: LodeKind = 'iron'; private place: PlaceKind = 'village';
  private sel: Sel = null; private hist = new History(); private paint = false; private flatTo = 0;
  private river: [number, number][] | null = null; private dragSel: { x: number; z: number } | null = null;
  private img: HTMLCanvasElement | null = null; private dirtyImg = true; private busy = '';
  private tools!: HTMLElement; private side!: HTMLElement;
  constructor(private changed: () => void, private redraw: () => void, private layouts: () => string[], private dungeons: () => string[] = () => []) { this.file = newWorld(tl('New world')); }

  fresh(name: string) { return newWorld(name); }
  load(f: WorldFile, fresh: boolean) { this.file = f; this.sel = null; this.river = null; this.dirtyImg = true; if (fresh) this.hist.clear(); this.refresh(); }
  frame(): [number, number, number, number] { return [0, 0, this.file.w, this.file.h]; }
  mount(tools: HTMLElement, side: HTMLElement) { this.tools = tools; this.side = side; this.refresh(); }

  edit(fn: () => void, img = false) { this.hist.push(this.file); fn(); if (img) this.dirtyImg = true; this.refresh(); this.changed(); }
  private refresh() { if (this.tools) { this.buildTools(); this.buildSide(); } this.redraw(); }
  private buildTools() {
    const btn = (label: string, on: boolean, act: () => void) => h('button', { class: on ? 'on' : '', onclick: act }, label);
    const is = (t: Tool) => JSON.stringify(t) === JSON.stringify(this.tool);
    const set = (t: Tool) => () => { this.finishRiver(); this.tool = t; this.buildTools(); };
    const f = this.file;
    this.tools.replaceChildren(
      h('h3', {}, tl('Start from')),
      h('div', { class: 'grid2' },
        h('button', { onclick: () => this.edit(() => { f.land.fill(-20); }, true) }, tl('Open sea')),
        h('button', { onclick: () => this.continents() }, tl('Random continents')),
        h('button', { onclick: () => this.fromSeed() }, tl('A game seed\'s land'))),
      numField(tl('Seed'), this.seed, (v) => { this.seed = Math.round(v); }, 1, -2147483647, 2147483647),
      numField(tl('Sea (%)'), this.seaShare, (v) => { this.seaShare = v; }, 5, 5, 95),
      ...(this.busy ? [h('div', { class: 'hint' }, this.busy)] : []),
      h('h3', {}, tl('Shape the land')),
      h('div', { class: 'grid2' }, ...(Object.keys(BRUSH_NAME) as Brush[]).map((b) => btn(BRUSH_NAME[b], is({ t: 'brush', b }), set({ t: 'brush', b })))),
      numField(tl('Brush size (cells)'), this.radius, (v) => { this.radius = v; }, 1, 1, 40),
      numField(tl('Strength (m)'), this.strength, (v) => { this.strength = v; }, 1, 1, 60),
      h('h3', {}, tl('Draw')),
      h('div', { class: 'grid2' },
        btn(tl('River'), is({ t: 'river' }), set({ t: 'river' })),
        btn(tl('Select / move'), is({ t: 'select' }), set({ t: 'select' })),
        btn(tl('Erase'), is({ t: 'erase' }), set({ t: 'erase' }))),
      h('h3', {}, tl('Deposits')),
      selectField(tl('Kind'), this.lode, (Object.keys(LODES) as LodeKind[]).map((k) => [k, LODES[k].name]), (v) => { this.lode = v; this.tool = { t: 'lode', k: v }; this.buildTools(); }),
      btn(tl('Place a deposit'), this.tool.t === 'lode', set({ t: 'lode', k: this.lode })),
      h('h3', {}, tl('Places')),
      selectField(tl('Kind'), this.place, PLACE_KINDS.map((k) => [k, PLACE_NAME[k]]), (v) => { this.place = v; this.tool = { t: 'place', k: v }; this.buildTools(); }),
      btn(tl('Place it'), this.tool.t === 'place', set({ t: 'place', k: this.place })),
      h('div', { class: 'hint' }, this.toolHint()),
    );
  }
  private seed = 12345; private seaShare = 60;
  private toolHint() {
    const t = this.tool;
    if (t.t === 'brush') return tl('Hold the left button and paint. Right drag moves the map, the wheel zooms.');
    if (t.t === 'river') return tl('Click the points from the spring to the mouth; Enter or a double click ends it, Esc drops it.');
    if (t.t === 'select') return tl('Click a marker or a river to select it, drag to move it. Delete removes it.');
    if (t.t === 'erase') return tl('Click a marker or a river to remove it.');
    return tl('Click on the map to place it.');
  }
  private buildSide() {
    const f = this.file, s = this.sel;
    const land = f.land.filter((v) => v > 0).length, top = Math.max(...f.land);
    const props: HTMLElement[] = [];
    if (s && 'pl' in s && f.places[s.pl]) {
      const p = f.places[s.pl];
      props.push(h('div', { class: 'what' }, PLACE_NAME[p.k]), textField(tl('Name'), p.name ?? '', (v) => this.edit(() => { p.name = v || undefined; })));
      if (p.k === 'city') props.push(numField(tl('Radius (m)'), p.r ?? 600, (v) => this.edit(() => { p.r = v; }), 50, 200, 2000));
      if (p.k === 'ruin' || p.k === 'wreck' || p.k === 'city') props.push(selectField(tl('Dungeon'), p.dungeon ?? '', [['', tl('(generated)')], ...this.dungeons().map((n): [string, string] => [n, n])], (v) => this.edit(() => { p.dungeon = v || undefined; })));
      if (p.k === 'village' || p.k === 'start') props.push(selectField(tl('Layout'), p.layout ?? '', [['', tl('(generated)')], ...this.layouts().map((n): [string, string] => [n, n])], (v) => this.edit(() => { p.layout = v || undefined; })));
      if (p.k === 'install') props.push(selectField(tl('Plant'), p.install ?? INSTALLS[0].k, INSTALLS.map((i): [string, string] => [i.k, i.name]), (v) => this.edit(() => { p.install = v; })));
      props.push(h('button', { onclick: () => this.removeSel() }, tl('Remove')));
    } else if (s && 'lo' in s && f.lodes[s.lo]) {
      const l = f.lodes[s.lo];
      props.push(h('div', { class: 'what' }, LODES[l.k].name), numField(tl('Richness'), l.rich, (v) => this.edit(() => { l.rich = v; }), 0.1, 0.2, 3), h('button', { onclick: () => this.removeSel() }, tl('Remove')));
    } else if (s && 'ri' in s && f.rivers[s.ri]) {
      const r = f.rivers[s.ri];
      props.push(h('div', { class: 'what' }, tl('River')), textField(tl('Name'), r.name ?? '', (v) => this.edit(() => { r.name = v || undefined; })),
        numField(tl('Width (m)'), r.w, (v) => this.edit(() => { r.w = v; }), 1, 4, 40), h('button', { onclick: () => this.removeSel() }, tl('Remove')));
    } else props.push(h('div', { class: 'hint' }, tl('Nothing selected.')));
    this.side.replaceChildren(
      h('h3', {}, tl('Planet')),
      numField(tl('Width (cells)'), f.w, (v) => this.resize(Math.round(v), f.h), 10, WORLD_LIMITS.w[0], WORLD_LIMITS.w[1]),
      numField(tl('Height (cells)'), f.h, (v) => this.resize(f.w, Math.round(v)), 10, WORLD_LIMITS.h[0], WORLD_LIMITS.h[1]),
      numField(tl('Cell (m)'), f.cell, (v) => this.edit(() => { f.cell = v; }), 50, 100, 2000),
      h('div', { class: 'hint' }, TL`${(f.w * f.cell / 1000).toFixed(0)} × ${(f.h * f.cell / 1000).toFixed(0)} km · land ${Math.round(land / f.land.length * 100)}% · highest ${Math.round(top)} m`),
      h('div', { class: 'hint' }, TL`${f.rivers.length} rivers, ${f.lodes.length} deposits, ${f.places.length} places.`),
      ...this.warnings().map((w) => h('div', { class: 'hint warn' }, w)),
      h('h3', {}, tl('Selected')), ...props,
      h('h3', {}, tl('Legend')),
      h('div', { class: 'legend' }, ...PLACE_KINDS.map((k) => h('div', {}, h('i', { style: `background:${PLACE_C[k]}` }), PLACE_NAME[k]))),
    );
  }
  /** Change the planet's size: the land kept where it overlaps, sea around it. */
  private resize(w: number, hh: number) {
    const f = this.file;
    if (w === f.w && hh === f.h) return;
    this.edit(() => {
      const land = new Array(w * hh).fill(-20);
      for (let j = 0; j < Math.min(hh, f.h); j++) for (let i = 0; i < Math.min(w, f.w); i++) land[j * w + i] = f.land[j * f.w + i];
      f.land = land; f.w = w; f.h = hh;
      const keep = (x: number, z: number) => x < w * f.cell && z < hh * f.cell;
      f.places = f.places.filter((p) => keep(p.x, p.z)); f.lodes = f.lodes.filter((l) => keep(l.x, l.z));
    }, true);
  }
  /** Random continents from noise: the share of sea asked for, mountains in the middle of the land. */
  private continents() {
    const f = this.file, s = hash(this.seed, 0xc0), m = hash(this.seed, 0x3e), v: number[] = [];
    for (let j = 0; j < f.h; j++) for (let i = 0; i < f.w; i++) v.push(fbm(s, i / 22, j / 22, 4, f.w / 22) - 0.25 * Math.pow(Math.abs(j / f.h - 0.5) * 2, 3));
    const cut = [...v].sort((a, b) => a - b)[Math.floor(v.length * this.seaShare / 100)];
    this.edit(() => {
      f.land = v.map((n, k) => {
        const i = k % f.w, j = Math.floor(k / f.w);
        if (n < cut) return Math.round(-6 - (cut - n) * 200);
        const ridge = 1 - Math.abs(2 * fbm(m, i / 9, j / 9, 3, f.w / 9) - 1);
        return Math.round(2 + (n - cut) * 160 + Math.max(0, ridge - 0.55) * 300 * Math.min(1, (n - cut) * 6));
      });
    }, true);
  }
  /** A real game seed's land (naturalHeight of gen/heights.ts) squeezed onto the grid: worked out a few rows a frame. */
  private fromSeed() {
    const f = this.file, w = f.w, hh = f.h, world = this.seed, land = new Array(w * hh).fill(-20);
    let j = 0;
    const step = () => {
      const t0 = performance.now();
      while (j < hh && performance.now() - t0 < 30) {
        for (let i = 0; i < w; i++) land[j * w + i] = Math.round(naturalHeight(world, X_MIN + (i + 0.5) / w * WORLD_W, -POLE_Z + (j + 0.5) / hh * POLE_Z * 2));
        j++;
      }
      this.busy = TL`Reading the land: ${Math.round(j / hh * 100)}%`; this.buildTools();
      if (j < hh) requestAnimationFrame(step);
      else { this.busy = ''; this.edit(() => { f.land = land; f.cell = Math.round(WORLD_W / w); }, true); }
    };
    step();
  }

  /** (0.208) What will play oddly in the game: no start, a start or a village in the sea. */
  private warnings(): string[] {
    const f = this.file, out: string[] = [], start = f.places.find((p) => p.k === 'start');
    const wet = (x: number, z: number) => { const k = this.at(x / f.cell, z / f.cell); return k < 0 || f.land[k] < 1; };
    if (!start) out.push(tl('No start: Gridholm will stand in the middle of the map.'));
    else if (wet(start.x, start.z)) out.push(tl('The start is in the sea: Gridholm needs dry land.'));
    const n = f.places.filter((p) => p.k === 'village' && wet(p.x, p.z)).length;
    if (n) out.push(TL`${n} villages stand in the sea.`);
    // (0.210) a layout or a dungeon named that this browser does not keep (the game would build the place itself)
    const lays = this.layouts(), dgs = this.dungeons();
    const lost = f.places.filter((p) => (p.layout && !lays.includes(p.layout)) || (p.dungeon && !dgs.includes(p.dungeon))).length;
    if (lost) out.push(TL`${lost} places name a village layout or a dungeon that is not saved here.`);
    return out;
  }
  private at(x: number, z: number) { const i = Math.floor(x), j = Math.floor(z); return i >= 0 && j >= 0 && i < this.file.w && j < this.file.h ? j * this.file.w + i : -1; }
  private stroke(x: number, z: number) {
    const f = this.file, b = (this.tool as { b: Brush }).b, r = this.radius, s = this.strength;
    const near: number[] = [];
    for (let j = Math.floor(z - r); j <= Math.ceil(z + r); j++) for (let i = Math.floor(x - r); i <= Math.ceil(x + r); i++) {
      if (i < 0 || j < 0 || i >= f.w || j >= f.h) continue;
      const d = Math.hypot(i + 0.5 - x, j + 0.5 - z) / r;
      if (d >= 1) continue;
      const k = j * f.w + i, wgt = 1 - d * d, cur = f.land[k];
      let to = cur;
      if (b === 'raise') to = cur + s * 0.4 * wgt;
      else if (b === 'lower') to = cur - s * 0.4 * wgt;
      else if (b === 'mountain') to = cur + s * 1.2 * wgt * (0.6 + 0.8 * ((hash(i, j, 0x77) % 100) / 100));
      else if (b === 'flatten') to = cur + (this.flatTo - cur) * 0.35 * wgt;
      else if (b === 'sea') to = cur + (-Math.max(8, s) - cur) * 0.5 * wgt;
      else if (b === 'plain') to = cur + (Math.max(3, s) - cur) * 0.5 * wgt;
      else if (b === 'smooth') { near.push(k); continue; }
      f.land[k] = Math.round(Math.max(WORLD_LIMITS.low, Math.min(WORLD_LIMITS.high, to)) * 10) / 10;
    }
    if (b === 'smooth') {
      const nv = near.map((k) => { const i = k % f.w, j = Math.floor(k / f.w); let sum = 0, n = 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const q = this.at(i + di + 0.5, j + dj + 0.5); if (q >= 0) { sum += f.land[q]; n++; } } return sum / n; });
      near.forEach((k, n) => { f.land[k] = Math.round((f.land[k] * 0.5 + nv[n] * 0.5) * 10) / 10; });
    }
    this.dirtyImg = true;
  }
  /** Cells → metres and back (markers and rivers are kept in metres). */
  private m(c: number) { return c * this.file.cell; }
  private pick(x: number, z: number): Sel {
    const f = this.file, r = 10 / this.view.scale;
    let best: Sel = null, bd = r;
    f.places.forEach((p, i) => { const d = Math.hypot(p.x / f.cell - x, p.z / f.cell - z); if (d < bd) { bd = d; best = { pl: i }; } });
    f.lodes.forEach((l, i) => { const d = Math.hypot(l.x / f.cell - x, l.z / f.cell - z); if (d < bd) { bd = d; best = { lo: i }; } });
    if (best) return best;
    f.rivers.forEach((rv, i) => { for (let k = 1; k < rv.pts.length; k++) { const d = segDist(x, z, rv.pts[k - 1][0] / f.cell, rv.pts[k - 1][1] / f.cell, rv.pts[k][0] / f.cell, rv.pts[k][1] / f.cell); if (d < bd) { bd = d; best = { ri: i }; } } });
    return best;
  }
  private removeSel() {
    const s = this.sel, f = this.file;
    if (!s) return;
    this.edit(() => { if ('pl' in s) f.places.splice(s.pl, 1); else if ('lo' in s) f.lodes.splice(s.lo, 1); else f.rivers.splice(s.ri, 1); });
    this.sel = null; this.buildSide();
  }
  private finishRiver() {
    const r = this.river;
    this.river = null;
    if (r && r.length > 1) { this.edit(() => { this.file.rivers.push({ pts: r, w: 10 }); }); this.sel = { ri: this.file.rivers.length - 1 }; this.buildSide(); }
    this.redraw();
  }
  down(x: number, z: number, e: MouseEvent) {
    const t = this.tool, f = this.file;
    if (t.t === 'brush') { this.hist.push(f); this.paint = true; const k = this.at(x, z); this.flatTo = k >= 0 ? f.land[k] : 0; this.stroke(x, z); this.redraw(); return; }
    if (t.t === 'river') {
      if (e.detail >= 2) { this.finishRiver(); return; }
      (this.river ??= []).push([Math.round(this.m(x)), Math.round(this.m(z))]); this.redraw(); return;
    }
    if (t.t === 'lode') { this.edit(() => { f.lodes.push({ k: t.k, x: Math.round(this.m(x)), z: Math.round(this.m(z)), rich: 1 }); }); this.sel = { lo: f.lodes.length - 1 }; this.buildSide(); return; }
    if (t.t === 'place') {
      const p: WorldPlace = { k: t.k, x: Math.round(this.m(x)), z: Math.round(this.m(z)), ...(t.k === 'city' ? { r: 600 } : {}), ...(t.k === 'install' ? { install: INSTALLS[0].k } : {}) };
      this.edit(() => { if (t.k === 'start') f.places = f.places.filter((q) => q.k !== 'start'); f.places.push(p); });
      this.sel = { pl: f.places.length - 1 }; this.buildSide(); return;
    }
    const s = this.pick(x, z);
    if (t.t === 'erase') { if (s) { this.sel = s; this.removeSel(); } return; }
    this.sel = s; this.buildSide(); this.redraw();
    if (s && !('ri' in s)) { this.hist.push(f); this.dragSel = { x, z }; }
  }
  move(x: number, z: number) {
    if (this.paint) { this.stroke(x, z); this.redraw(); return; }
    if (this.river) { this.redraw(); this.hover = [x, z]; return; }
    const s = this.sel, d = this.dragSel;
    if (d && s) {
      const o = 'pl' in s ? this.file.places[s.pl] : 'lo' in s ? this.file.lodes[s.lo] : null;
      if (o) { o.x = Math.round(this.m(x)); o.z = Math.round(this.m(z)); this.redraw(); }
    }
  }
  private hover: [number, number] | null = null;
  up() {
    if (this.paint) { this.paint = false; this.refresh(); this.changed(); }
    if (this.dragSel) { this.dragSel = null; this.buildSide(); this.changed(); }
  }
  key(e: KeyboardEvent): boolean {
    if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyZ' || e.code === 'KeyY')) { const f = e.shiftKey || e.code === 'KeyY' ? this.hist.redo(this.file) : this.hist.undo(this.file); if (f) { this.file = f; this.sel = null; this.dirtyImg = true; this.refresh(); this.changed(); } return true; }
    if (e.code === 'Enter' && this.river) { this.finishRiver(); return true; }
    if (e.code === 'Escape') { this.river = null; this.sel = null; this.refresh(); return true; }
    if (e.code === 'Delete' || e.code === 'Backspace') { this.removeSel(); return true; }
    return false;
  }
  status(x: number, z: number) {
    const k = this.at(x, z);
    return (k >= 0 ? TL`${(this.m(x) / 1000).toFixed(1)} km, ${(this.m(z) / 1000).toFixed(1)} km · ground ${Math.round(this.file.land[k])} m` : '') + ' · ' + this.toolHint();
  }

  draw(c: CanvasRenderingContext2D, v: View) {
    const f = this.file;
    c.fillStyle = '#000'; c.fillRect(0, 0, v.w, v.h);
    if (this.dirtyImg || !this.img || this.img.width !== f.w || this.img.height !== f.h) { this.img = landImage(f, this.img); this.dirtyImg = false; }
    c.imageSmoothingEnabled = false;
    c.drawImage(this.img, v.sx(0), v.sz(0), f.w * v.scale, f.h * v.scale);
    c.strokeStyle = '#16391d'; c.strokeRect(v.sx(0) - 0.5, v.sz(0) - 0.5, f.w * v.scale + 1, f.h * v.scale + 1);
    const px = (mx: number) => v.sx(mx / f.cell), pz = (mz: number) => v.sz(mz / f.cell);
    // rivers
    f.rivers.forEach((r, i) => {
      c.strokeStyle = this.sel && 'ri' in this.sel && this.sel.ri === i ? '#ffffff' : '#2ac8b0';
      c.lineWidth = Math.max(1.5, r.w / f.cell * v.scale); c.lineJoin = 'round'; c.beginPath();
      r.pts.forEach(([x, z], k) => (k ? c.lineTo(px(x), pz(z)) : c.moveTo(px(x), pz(z)))); c.stroke();
    });
    c.lineWidth = 1;
    if (this.river) {
      c.strokeStyle = '#9dffe0'; c.setLineDash([5, 4]); c.beginPath();
      this.river.forEach(([x, z], k) => (k ? c.lineTo(px(x), pz(z)) : c.moveTo(px(x), pz(z))));
      if (this.hover) c.lineTo(v.sx(this.hover[0]), v.sz(this.hover[1]));
      c.stroke(); c.setLineDash([]);
    }
    // deposits
    f.lodes.forEach((l, i) => {
      const x = px(l.x), z = pz(l.z), s = 5;
      c.fillStyle = colour(LODES[l.k].c); c.fillRect(x - s, z - s, s * 2, s * 2);
      c.strokeStyle = this.sel && 'lo' in this.sel && this.sel.lo === i ? '#fff' : '#000'; c.strokeRect(x - s - 0.5, z - s - 0.5, s * 2 + 1, s * 2 + 1);
    });
    // places
    c.font = '11px monospace';
    f.places.forEach((p, i) => {
      const x = px(p.x), z = pz(p.z);
      c.fillStyle = PLACE_C[p.k]; c.strokeStyle = PLACE_C[p.k];
      if (p.k === 'city') { c.beginPath(); c.arc(x, z, Math.max(4, (p.r ?? 600) / f.cell * v.scale), 0, Math.PI * 2); c.setLineDash([4, 3]); c.stroke(); c.setLineDash([]); }
      c.beginPath();
      if (p.k === 'village' || p.k === 'start') { for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + Math.PI / 8; const fn = k ? 'lineTo' : 'moveTo'; c[fn](x + Math.cos(a) * 6, z + Math.sin(a) * 6); } c.closePath(); }
      else if (p.k === 'install') { for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; const fn = k ? 'lineTo' : 'moveTo'; c[fn](x + Math.cos(a) * 6, z + Math.sin(a) * 6); } c.closePath(); }
      else c.arc(x, z, 4.5, 0, Math.PI * 2);
      c.fill();
      if (this.sel && 'pl' in this.sel && this.sel.pl === i) { c.strokeStyle = '#fff'; c.beginPath(); c.arc(x, z, 10, 0, Math.PI * 2); c.stroke(); }
      const label = p.name || (p.k === 'start' ? PLACE_NAME.start : '');
      if (label) { c.fillStyle = '#d0ffd8'; c.fillText(label, x + 9, z + 4); }
    });
  }
}
/** The height grid as an image, one pixel a cell: the sea in blue-greens by depth, the land green to pale, snow white. */
function landImage(f: WorldFile, cv: HTMLCanvasElement | null): HTMLCanvasElement {
  const c = cv && cv.width === f.w && cv.height === f.h ? cv : Object.assign(document.createElement('canvas'), { width: f.w, height: f.h });
  const ctx = c.getContext('2d')!, img = ctx.createImageData(f.w, f.h);
  for (let k = 0; k < f.land.length; k++) {
    const y = f.land[k];
    let r: number, g: number, b: number;
    if (y < 0) { const t = Math.min(1, -y / 40); r = 4; g = 40 - t * 28; b = 52 - t * 30; }
    else if (y < 115) { const t = y / 115; r = 12 + t * 120; g = 70 + t * 130; b = 24 + t * 90; }
    else { r = 225; g = 240; b = 230; }
    img.data[k * 4] = r; img.data[k * 4 + 1] = g; img.data[k * 4 + 2] = b; img.data[k * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
function segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz, t = L ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L)) : 0;
  return Math.hypot(px - ax - t * dx, pz - az - t * dz);
}
