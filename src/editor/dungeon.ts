// (0.207) The dungeon editor: a hand-made level in one of the game's three underground styles, laid out from above on
// a 1 m grid. Each style has its own kit (gen/mapfile.ts PIECES): an ancient ruin's rooms, great halls and corridors; a
// crashed ship's bays, engine room and corridors; the metro's station halls (platforms a step above the track),
// tunnels, wrecked trains and falls of rubble. Markers set the start, the stairs out, chests, crystals, a boss, robot
// guards and doors. The 3D view shows the voxels the game will build; the list under it says what is wrong.
import { tl, TL } from '../i18n';
import { ROBOTS, type RobotKind } from '../data/robots';
import { METRO } from '../gen/metro';
import {
  PIECES, PIECE_KINDS, MARK_KINDS, STYLES, newDungeon, expandDungeon, dungeonProblems, exitStairs, roomAt,
  type DungeonFile, type Piece, type PieceKind, type Mark, type MarkKind, type DStyle, type Problem,
} from '../gen/mapfile';
import { View, History, h, numField, textField, selectField, type Tab } from './common';
import { Preview } from './preview';

export const PIECE_NAME: Record<PieceKind, string> = {
  room: tl('Room'), hall: tl('Great hall'), corridor: tl('Corridor'), solid: tl('Solid block'), bay: tl('Bay'), engine: tl('Engine room'),
  shipcorr: tl('Ship corridor'), station: tl('Station hall'), tunnel: tl('Metro tunnel'), train: tl('Wrecked train'), rubble: tl('Rubble fall'), niche: tl('Niche'),
};
export const MARK_NAME: Record<MarkKind, string> = {
  spawn: tl('Start'), exit: tl('Exit stairs'), chest: tl('Chest'), crystal: tl('Crystals'), boss: tl('Boss'), guard: tl('Robot guard'), door: tl('Door'),
};
export const STYLE_NAME: Record<DStyle, string> = { temple: tl('Ancient ruin'), ship: tl('Crashed ship'), metro: tl('Metro') };
const ROOM_H: Record<DStyle, number> = { temple: 5, ship: 4, metro: 4 };
const MARK_C: Record<MarkKind, string> = { spawn: '#5cc8ff', exit: '#5cc8ff', chest: '#ffd060', crystal: '#b6ff3a', boss: '#ff6a4a', guard: '#ffb347', door: '#ff9a3c' };

type Tool = { t: 'select' } | { t: 'erase' } | { t: 'piece'; k: PieceKind } | { t: 'mark'; k: MarkKind };
type Sel = { p: number } | { m: number } | null;

export class DungeonTab implements Tab<DungeonFile> {
  file: DungeonFile; view = new View(0.5, 60);
  private tool: Tool = { t: 'select' }; private guard: RobotKind = 'scout';
  private sel: Sel = null; private hist = new History();
  private drag: { x0: number; z0: number; x1: number; z1: number; moved: boolean; orig?: { x: number; z: number } } | null = null;
  private tools!: HTMLElement; private props!: HTMLElement; private probs!: HTMLElement;
  private preview: Preview | null = null; private timer = 0; private problems: Problem[] = [];
  constructor(private changed: () => void, private redraw: () => void) { this.file = newDungeon(tl('New dungeon'), 'temple'); }

  fresh(name: string) { return newDungeon(name, this.file?.style ?? 'temple'); }
  load(f: DungeonFile, fresh: boolean) { this.file = f; this.sel = null; if (fresh) this.hist.clear(); this.refresh(); }
  frame(): [number, number, number, number] {
    const ps = this.file.pieces;
    if (!ps.length) return [-20, -20, 60, 60];
    return [Math.min(...ps.map((p) => p.x)) - 6, Math.min(...ps.map((p) => p.z)) - 6, Math.max(...ps.map((p) => p.x + p.w)) + 6, Math.max(...ps.map((p) => p.z + p.d)) + 6];
  }

  mount(tools: HTMLElement, side: HTMLElement) {
    this.tools = tools;
    this.props = h('div', { class: 'props' }); this.probs = h('div', { class: 'probs' });
    const cv = h('canvas', { class: 'preview' });
    side.replaceChildren(h('h3', {}, tl('Selected')), this.props, h('h3', {}, tl('3D view')), cv, h('div', { class: 'hint' }, tl('Drag to turn, wheel to zoom.')), h('h3', {}, tl('Checks')), this.probs);
    this.preview = new Preview(cv);
    this.buildTools(); this.refresh();
  }
  private buildTools() {
    const f = this.file, btn = (label: string, on: boolean, act: () => void, title = '') => h('button', { class: on ? 'on' : '', title, onclick: act }, label);
    const is = (t: Tool) => JSON.stringify(t) === JSON.stringify(this.tool);
    const set = (t: Tool) => () => { this.tool = t; this.buildTools(); };
    this.tools.replaceChildren(
      h('h3', {}, tl('Style')),
      h('div', { class: 'row' }, ...STYLES.map((s) => btn(STYLE_NAME[s], f.style === s, () => this.edit(() => { f.style = s; })))),
      h('h3', {}, tl('Tools')),
      h('div', { class: 'grid2' }, btn(tl('Select / move'), is({ t: 'select' }), set({ t: 'select' })), btn(tl('Erase'), is({ t: 'erase' }), set({ t: 'erase' }))),
      h('h3', {}, TL`Kit: ${STYLE_NAME[f.style]}`),
      h('div', { class: 'grid2' }, ...PIECE_KINDS.filter((k) => PIECES[k].styles.includes(f.style)).map((k) => btn(PIECE_NAME[k], is({ t: 'piece', k }), set({ t: 'piece', k })))),
      h('h3', {}, tl('Markers')),
      h('div', { class: 'grid2' }, ...MARK_KINDS.map((k) => btn(MARK_NAME[k], is({ t: 'mark', k }), set({ t: 'mark', k })))),
      selectField(tl('Guard'), this.guard, (Object.keys(ROBOTS) as RobotKind[]).map((k) => [k, ROBOTS[k].name]), (v) => { this.guard = v; }),
      h('h3', {}, tl('Level')),
      numField(tl('Danger (1–8)'), f.danger, (v) => this.edit(() => { f.danger = v; }), 1, 1, 8),
      numField(tl('Stray drones'), f.drones, (v) => this.edit(() => { f.drones = v; }), 1, 0, 30),
      h('div', { class: 'hint' }, this.toolHint()),
    );
  }
  private toolHint(): string {
    const t = this.tool;
    if (t.t === 'piece') {
      const s = PIECES[t.k];
      return s.fixed ? tl('Click to place; drag up or down to turn it along the other axis.') : s.across ? tl('Drag along the way it should run.') : tl('Drag a rectangle, or click for the usual size.');
    }
    if (t.t === 'mark') return t.k === 'exit' ? tl('Click inside a room by the wall the stairs should leave through.') : tl('Click a cell inside a room.');
    if (t.t === 'erase') return tl('Click a marker or a piece to remove it.');
    return tl('Click to select, drag to move. Delete removes, R turns a piece, Ctrl+Z undoes.');
  }

  /** A change to the file: undo point, then the change, then everything redrawn. */
  edit(fn: () => void) { this.hist.push(this.file); fn(); this.refresh(); this.changed(); }
  private refresh() {
    if (this.tools) this.buildTools();
    this.showProps(); this.redraw();
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      this.problems = dungeonProblems(this.file);
      this.showProblems();
      this.preview?.show(this.file.pieces.length ? expandDungeon(this.file) : null);
      this.redraw();
    }, 250);
  }
  private showProblems() {
    if (!this.probs) return;
    const say = (p: Problem): string => {
      const what = p.what ? MARK_NAME[p.what] : '';
      switch (p.k) {
        case 'noRooms': return tl('Place a room first.');
        case 'noExit': return tl('No way out: put exit stairs in a room.');
        case 'badExit': return TL`Exit stairs that cannot be built at ${p.x}, ${p.z}.`;
        case 'outside': return TL`${what} at ${p.x}, ${p.z} is not in a room.`;
        case 'unreached': return TL`${what} at ${p.x}, ${p.z} cannot be reached on foot.`;
      }
    };
    this.probs.replaceChildren(...(this.problems.length ? this.problems.map((p) => h('div', { class: 'prob', onclick: () => { if (p.x !== undefined) { this.view.ox = p.x; this.view.oz = p.z!; this.redraw(); } } }, say(p))) : [h('div', { class: 'ok' }, tl('Ready to play.'))]));
  }
  private showProps() {
    if (!this.props) return;
    const s = this.sel, f = this.file;
    if (s && 'p' in s && f.pieces[s.p]) {
      const p = f.pieces[s.p];
      const fixed = !!PIECES[p.k].fixed;
      this.props.replaceChildren(h('div', { class: 'what' }, PIECE_NAME[p.k]),
        numField('x', p.x, (v) => this.edit(() => { p.x = Math.round(v); })), numField('z', p.z, (v) => this.edit(() => { p.z = Math.round(v); })),
        ...(fixed ? [] : [numField(tl('Width'), p.w, (v) => this.edit(() => { p.w = Math.max(1, Math.round(v)); }), 1, 1, 400), numField(tl('Length'), p.d, (v) => this.edit(() => { p.d = Math.max(1, Math.round(v)); }), 1, 1, 400)]),
        ...(p.k === 'station' ? [] : [numField(tl('Height'), p.h ?? PIECES[p.k].h, (v) => this.edit(() => { p.h = Math.max(2, Math.round(v)); }), 1, 2, 40)]),
        numField(tl('Floor level'), p.y ?? 0, (v) => this.edit(() => { p.y = Math.round(v); }), 1, -40, 40),
        ...(p.k === 'station' ? [textField(tl('Name'), p.name ?? '', (v) => this.edit(() => { p.name = v || undefined; }))] : []),
        h('button', { onclick: () => this.removeSel() }, tl('Remove')));
      return;
    }
    if (s && 'm' in s && f.marks[s.m]) {
      const m = f.marks[s.m];
      this.props.replaceChildren(h('div', { class: 'what' }, MARK_NAME[m.k]),
        numField('x', m.x, (v) => this.edit(() => { m.x = Math.round(v); })), numField('z', m.z, (v) => this.edit(() => { m.z = Math.round(v); })),
        ...(m.k === 'guard' ? [selectField(tl('Robot'), m.kind ?? 'scout', (Object.keys(ROBOTS) as RobotKind[]).map((k) => [k, ROBOTS[k].name]), (v) => this.edit(() => { m.kind = v; }))] : []),
        h('button', { onclick: () => this.removeSel() }, tl('Remove')));
      return;
    }
    this.props.replaceChildren(h('div', { class: 'hint' }, tl('Nothing selected.')), h('div', { class: 'hint' }, TL`${f.pieces.length} pieces, ${f.marks.length} markers.`));
  }
  private removeSel() {
    const s = this.sel;
    if (!s) return;
    this.edit(() => { if ('p' in s) this.file.pieces.splice(s.p, 1); else this.file.marks.splice(s.m, 1); });
    this.sel = null; this.showProps();
  }
  private markAt(x: number, z: number) { for (let i = this.file.marks.length - 1; i >= 0; i--) { const m = this.file.marks[i]; if (m.x === x && m.z === z) return i; } return -1; }
  private pieceAt(x: number, z: number) { for (let i = this.file.pieces.length - 1; i >= 0; i--) { const p = this.file.pieces[i]; if (x >= p.x && x < p.x + p.w && z >= p.z && z < p.z + p.d) return i; } return -1; }

  down(fx: number, fz: number) {
    const x = Math.floor(fx), z = Math.floor(fz), t = this.tool;
    if (t.t === 'erase') {
      const m = this.markAt(x, z), p = this.pieceAt(x, z);
      if (m >= 0) this.edit(() => { this.file.marks.splice(m, 1); });
      else if (p >= 0) this.edit(() => { this.file.pieces.splice(p, 1); });
      this.sel = null; return;
    }
    if (t.t === 'mark') {
      const mk: Mark = { k: t.k, x, z, ...(t.k === 'guard' ? { kind: this.guard } : {}) };
      this.edit(() => {
        if (t.k === 'spawn') this.file.marks = this.file.marks.filter((m) => m.k !== 'spawn');
        this.file.marks.push(mk);
      });
      this.sel = { m: this.file.marks.length - 1 }; this.showProps(); return;
    }
    if (t.t === 'select') {
      const m = this.markAt(x, z), p = this.pieceAt(x, z);
      this.sel = m >= 0 ? { m } : p >= 0 ? { p } : null;
      const o = this.sel && ('m' in this.sel ? this.file.marks[this.sel.m] : this.file.pieces[this.sel.p]);
      this.drag = o ? { x0: x, z0: z, x1: x, z1: z, moved: false, orig: { x: o.x, z: o.z } } : null;
      if (o) this.hist.push(this.file);
      this.showProps(); this.redraw(); return;
    }
    this.drag = { x0: x, z0: z, x1: x, z1: z, moved: false };
  }
  move(fx: number, fz: number) {
    const d = this.drag;
    if (!d) return;
    const x = Math.floor(fx), z = Math.floor(fz);
    if (x === d.x1 && z === d.z1) return;
    d.x1 = x; d.z1 = z; d.moved = true;
    if (this.tool.t === 'select' && this.sel && d.orig) {
      const o = 'm' in this.sel ? this.file.marks[this.sel.m] : this.file.pieces[this.sel.p];
      o.x = d.orig.x + x - d.x0; o.z = d.orig.z + z - d.z0;
    }
    this.redraw();
  }
  up() {
    const d = this.drag, t = this.tool;
    this.drag = null;
    if (!d) return;
    if (t.t === 'select') { if (d.moved) this.refresh(), this.changed(); return; }
    if (t.t !== 'piece') return;
    const p = this.shape(t.k, d);
    this.edit(() => { this.file.pieces.push(p); });
    this.sel = { p: this.file.pieces.length - 1 }; this.showProps();
  }
  /** The piece a drag makes with this kit piece. */
  private shape(k: PieceKind, d: { x0: number; z0: number; x1: number; z1: number }): Piece {
    const s = PIECES[k], dx = d.x1 - d.x0, dz = d.z1 - d.z0, h = k === 'room' ? ROOM_H[this.file.style] : s.h;
    if (s.fixed) {
      const turn = Math.abs(dz) > Math.abs(dx);
      const [w, dd] = turn ? [s.fixed[1], s.fixed[0]] : s.fixed;
      return { k, x: d.x0 - Math.floor(w / 2), z: d.z0 - Math.floor(dd / 2), w, d: dd, h };
    }
    if (s.across) {
      const a = s.across, half = Math.floor(a / 2);
      if (Math.abs(dx) >= Math.abs(dz)) return { k, x: Math.min(d.x0, d.x1), z: d.z0 - half, w: Math.max(2, Math.abs(dx) + 1), d: a, h };
      return { k, x: d.x0 - half, z: Math.min(d.z0, d.z1), w: a, d: Math.max(2, Math.abs(dz) + 1), h };
    }
    if (Math.abs(dx) < 1 && Math.abs(dz) < 1) return { k, x: d.x0 - Math.floor(s.w / 2), z: d.z0 - Math.floor(s.d / 2), w: s.w, d: s.d, h };
    return { k, x: Math.min(d.x0, d.x1), z: Math.min(d.z0, d.z1), w: Math.abs(dx) + 1, d: Math.abs(dz) + 1, h };
  }
  key(e: KeyboardEvent): boolean {
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { const f = e.shiftKey ? this.hist.redo(this.file) : this.hist.undo(this.file); if (f) { this.file = f; this.sel = null; this.refresh(); this.changed(); } return true; }
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') { const f = this.hist.redo(this.file); if (f) { this.file = f; this.sel = null; this.refresh(); this.changed(); } return true; }
    if (e.code === 'Delete' || e.code === 'Backspace') { this.removeSel(); return true; }
    if (e.code === 'Escape') { this.tool = { t: 'select' }; this.sel = null; this.buildTools(); this.showProps(); this.redraw(); return true; }
    if (e.code === 'KeyR' && this.sel && 'p' in this.sel) {
      const p = this.file.pieces[this.sel.p];
      this.edit(() => { const cx = p.x + p.w / 2, cz = p.z + p.d / 2; [p.w, p.d] = [p.d, p.w]; p.x = Math.round(cx - p.w / 2); p.z = Math.round(cz - p.d / 2); });
      return true;
    }
    return false;
  }
  status(x: number, z: number) {
    const r = roomAt(this.file, Math.floor(x), Math.floor(z));
    return TL`x ${Math.floor(x)}, z ${Math.floor(z)}` + (r ? ' · ' + PIECE_NAME[r.k] : '') + ' · ' + this.toolHint();
  }

  draw(c: CanvasRenderingContext2D, v: View) {
    const f = this.file;
    c.fillStyle = '#000'; c.fillRect(0, 0, v.w, v.h);
    // the grid: metres when close, every ten always
    const x0 = Math.floor(v.wx(0)), x1 = Math.ceil(v.wx(v.w)), z0 = Math.floor(v.wz(0)), z1 = Math.ceil(v.wz(v.h));
    c.lineWidth = 1;
    for (let x = x0; x <= x1; x++) { if (x % 10 && v.scale < 6) continue; c.strokeStyle = x % 10 ? '#0b1f10' : '#16391d'; c.beginPath(); c.moveTo(v.sx(x) + 0.5, 0); c.lineTo(v.sx(x) + 0.5, v.h); c.stroke(); }
    for (let z = z0; z <= z1; z++) { if (z % 10 && v.scale < 6) continue; c.strokeStyle = z % 10 ? '#0b1f10' : '#16391d'; c.beginPath(); c.moveTo(0, v.sz(z) + 0.5); c.lineTo(v.w, v.sz(z) + 0.5); c.stroke(); }
    const rect = (x: number, z: number, w: number, d: number, fill: string, line: string) => {
      c.fillStyle = fill; c.fillRect(v.sx(x), v.sz(z), w * v.scale, d * v.scale);
      c.strokeStyle = line; c.strokeRect(v.sx(x) + 0.5, v.sz(z) + 0.5, w * v.scale, d * v.scale);
    };
    f.pieces.forEach((p, i) => {
      const s = PIECES[p.k];
      if (p.k === 'station') {
        rect(p.x, p.z, p.w, p.d, '#0d2a14', '#2fe060');
        const ax = p.w >= p.d, th = METRO.trench / 2, cx = Math.round(p.x + p.w / 2), cz = Math.round(p.z + p.d / 2);
        // the platforms either side, the trench and its rails between them
        if (ax) { rect(p.x, p.z, p.w, cz - th - p.z, '#1d4a28', '#2fe060'); rect(p.x, cz + th, p.w, p.z + p.d - cz - th, '#1d4a28', '#2fe060'); }
        else { rect(p.x, p.z, cx - th - p.x, p.d, '#1d4a28', '#2fe060'); rect(cx + th, p.z, p.x + p.w - cx - th, p.d, '#1d4a28', '#2fe060'); }
        c.strokeStyle = '#a8c8c0'; c.beginPath();
        for (const o of [-0.72, 0.72]) {
          if (ax) { c.moveTo(v.sx(p.x), v.sz(cz + o)); c.lineTo(v.sx(p.x + p.w), v.sz(cz + o)); } else { c.moveTo(v.sx(cx + o), v.sz(p.z)); c.lineTo(v.sx(cx + o), v.sz(p.z + p.d)); }
        }
        c.stroke();
      } else if (s.solid) rect(p.x, p.z, p.w, p.d, p.k === 'train' ? '#1f3f3a' : p.k === 'rubble' ? '#3a3a24' : '#2a2a26', p.k === 'train' ? '#8fd0c0' : '#a0a080');
      else rect(p.x, p.z, p.w, p.d, s.tunnel ? '#0b2310' : '#0d2a14', '#2fe060');
      if (p.k === 'tunnel') {
        const ax = p.w >= p.d, m = ax ? p.z + p.d / 2 : p.x + p.w / 2;
        c.strokeStyle = '#a8c8c0'; c.beginPath();
        for (const o of [-0.72, 0.72]) { if (ax) { c.moveTo(v.sx(p.x), v.sz(m + o)); c.lineTo(v.sx(p.x + p.w), v.sz(m + o)); } else { c.moveTo(v.sx(m + o), v.sz(p.z)); c.lineTo(v.sx(m + o), v.sz(p.z + p.d)); } }
        c.stroke();
      }
      if (v.scale >= 3) {
        c.fillStyle = '#7fbf8a'; c.font = '11px monospace';
        const tag = (p.y ? 'y' + (p.y > 0 ? '+' : '') + p.y + ' ' : '') + (p.name ?? '');
        if (tag.trim()) c.fillText(tag, v.sx(p.x) + 3, v.sz(p.z) + 12);
      }
      if (this.sel && 'p' in this.sel && this.sel.p === i) { c.setLineDash([4, 3]); c.strokeStyle = '#fff'; c.strokeRect(v.sx(p.x) - 1.5, v.sz(p.z) - 1.5, p.w * v.scale + 3, p.d * v.scale + 3); c.setLineDash([]); }
    });
    // markers
    const s = Math.max(4, v.scale * 0.45);
    f.marks.forEach((m, i) => {
      const x = v.sx(m.x + 0.5), z = v.sz(m.z + 0.5);
      c.fillStyle = MARK_C[m.k]; c.strokeStyle = MARK_C[m.k];
      c.beginPath();
      if (m.k === 'chest') c.rect(x - s, z - s * 0.7, s * 2, s * 1.4);
      else if (m.k === 'crystal') { c.moveTo(x, z - s); c.lineTo(x + s * 0.7, z); c.lineTo(x, z + s); c.lineTo(x - s * 0.7, z); c.closePath(); }
      else if (m.k === 'spawn') { c.moveTo(x, z - s); c.lineTo(x + s, z + s); c.lineTo(x - s, z + s); c.closePath(); }
      else if (m.k === 'door') c.rect(x - s, z - s * 0.3, s * 2, s * 0.6);
      else c.arc(x, z, s, 0, Math.PI * 2);
      c.fill();
      if (m.k === 'exit') {
        const e = exitStairs(f, m);
        if (e) { // the stairs' shaft going out through the wall
          const [dx, dz] = e.dir === 'N' ? [0, -1] : e.dir === 'S' ? [0, 1] : e.dir === 'E' ? [1, 0] : [-1, 0];
          const along = e.dir === 'N' || e.dir === 'S', wx = along ? e.c - 1 : e.m + (dx > 0 ? 1 : -8), wz = along ? e.m + (dz > 0 ? 1 : -8) : e.c - 1;
          c.strokeStyle = '#5cc8ff'; c.setLineDash([3, 3]);
          c.strokeRect(v.sx(wx), v.sz(wz), (along ? 3 : 8) * v.scale, (along ? 8 : 3) * v.scale); c.setLineDash([]);
        }
        c.fillStyle = '#000'; c.font = `${Math.round(s * 1.4)}px monospace`; c.fillText('▲', x - s * 0.5, z + s * 0.5);
      }
      if (m.k === 'guard') { c.fillStyle = '#000'; c.font = `${Math.round(s * 1.2)}px monospace`; c.fillText((m.kind ?? 'scout')[0].toUpperCase(), x - s * 0.4, z + s * 0.45); }
      if (this.sel && 'm' in this.sel && this.sel.m === i) { c.strokeStyle = '#fff'; c.beginPath(); c.arc(x, z, s + 3, 0, Math.PI * 2); c.stroke(); }
    });
    // what is wrong, ringed in red
    c.strokeStyle = '#ff5a3c';
    for (const p of this.problems) if (p.x !== undefined) { c.beginPath(); c.arc(v.sx(p.x + 0.5), v.sz(p.z! + 0.5), s + 7, 0, Math.PI * 2); c.stroke(); }
    // the piece being dragged out
    const d = this.drag, t = this.tool;
    if (d && t.t === 'piece') { const p = this.shape(t.k, d); c.setLineDash([5, 4]); c.strokeStyle = '#d0ffd8'; c.strokeRect(v.sx(p.x), v.sz(p.z), p.w * v.scale, p.d * v.scale); c.setLineDash([]); }
  }
}
