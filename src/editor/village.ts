// (0.207) The village editor: a village's wall (its shape and kind) and every building the game knows, set out by hand
// on a plan in metres from the village's middle. The library is the game's own lists: the village's houses and shops,
// the settlement's projects (yards, sawmill, furnace, warehouse...), the works, the power stations, the fields, the
// defences and the lights. Kept as a file (gen/mapfile.ts VillageFile); a world's village can name it as its layout.
// The game builds villages from these later (stage E3 of PLAN_EDYTORA.md).
import { tl, TL } from '../i18n';
import { PLANTS, PLANT_KINDS } from '../gen/plants';
import { STATIONS, type StationKind } from '../gen/energy';
import { PROJECTS, type Project } from '../gen/settlement';
import { CROPS, type Crop } from '../gen/farms';
import { WORKS, POWER, type WorkKind } from '../gen/town';
import { WALL_TIERS, apothem, wallPolygon } from '../gen/village';
import { newVillage, type VillageFile, type VillageItem } from '../gen/mapfile';
import { View, History, h, numField, textField, selectField, type Tab } from './common';

export interface LibItem { k: string; name: string; w: number; d: number; c: string }
export interface LibGroup { name: string; items: LibItem[] }
/** Everything a village can hold, grouped as the game groups it. */
export function library(): LibGroup[] {
  const it = (k: string, name: string, w: number, d: number, c: string): LibItem => ({ k, name, w, d, c });
  return [
    { name: tl('Village buildings'), items: [
      it('b:tavern', tl('Tavern'), 10, 8, '#ffb347'), it('b:elder', tl('Elder\'s hall'), 10, 8, '#ffd060'), it('b:smith', tl('Blacksmith'), 8, 7, '#d0a070'),
      it('b:store', tl('Store'), 8, 7, '#c8d0a0'), it('b:food', tl('Food shop'), 8, 7, '#b6ff3a'), it('b:house', tl('House'), 8, 7, '#7fbf8a'),
      it('b:well', tl('Well'), 2, 2, '#2ac8b0'), it('b:board', tl('Notice board'), 2, 1, '#ffd060'), it('b:map', tl('Map board'), 2, 1, '#5cc8ff'),
      it('b:tower', tl('Watchtower'), 4, 4, '#a0a080'), it('b:gate', tl('Gate'), 6, 2, '#ff9a3c'), it('b:hall', tl('Village hall (store)'), 12, 8, '#d0c090'),
    ] },
    { name: tl('Power plant'), items: (Object.keys(POWER) as (keyof typeof POWER)[]).map((k) => it('power:' + k, POWER[k].name, 10, 10, '#e0e070')) },
    { name: tl('Settlement projects'), items: (Object.keys(PROJECTS) as Project[]).map((k) => it('proj:' + k, PROJECTS[k].name, k === 'warehouse' ? 14 : 12, k === 'warehouse' ? 20 : 12, '#9dffe0')) },
    { name: tl('Works'), items: PLANT_KINDS.map((k) => it('plant:' + k, PLANTS[k].name, 16, 14, '#8fd0c0')) },
    { name: tl('Power stations'), items: (Object.keys(STATIONS) as StationKind[]).map((k) => it('station:' + k, STATIONS[k].name, 16, 14, '#e8e040')) },
    { name: tl('Fields'), items: (Object.keys(CROPS) as Crop[]).map((k) => it('farm:' + k, TL`Field: ${CROPS[k].name}`, 12, 12, '#6f9a40')) },
    { name: tl('Defences'), items: (Object.keys(WORKS) as WorkKind[]).map((k) => it('work:' + k, WORKS[k].name, k === 'turret' ? 3 : 10, k === 'turret' ? 3 : 10, '#ff6a4a')) },
    { name: tl('Lights'), items: [it('lamp:electric', tl('Electric street lamp'), 1, 1, '#dff2ff'), it('lamp:oil', tl('Oil street lamp'), 1, 1, '#ffd060'), it('lighthouse', tl('Lighthouse'), 7, 7, '#ff5a3c')] },
  ];
}
const LIB = new Map<string, LibItem>();
const lib = (k: string) => { if (!LIB.size) for (const g of library()) for (const i of g.items) LIB.set(i.k, i); return LIB.get(k); };

type Tool = { t: 'select' } | { t: 'erase' } | { t: 'put'; k: string };
export class VillageTab implements Tab<VillageFile> {
  file: VillageFile; view = new View(0.4, 40);
  private tool: Tool = { t: 'select' }; private sel = -1; private hist = new History();
  private drag: { dx: number; dz: number } | null = null; private open = 0;
  private tools!: HTMLElement; private side!: HTMLElement;
  constructor(private changed: () => void, private redraw: () => void) { this.file = newVillage(tl('New village')); this.view.scale = 3; }

  fresh(name: string) { return newVillage(name); }
  load(f: VillageFile, fresh: boolean) { this.file = f; this.sel = -1; if (fresh) this.hist.clear(); this.refresh(); }
  frame(): [number, number, number, number] { return [-90, -90, 90, 90]; }
  mount(tools: HTMLElement, side: HTMLElement) { this.tools = tools; this.side = side; this.refresh(); }
  edit(fn: () => void) { this.hist.push(this.file); fn(); this.refresh(); this.changed(); }
  private refresh() { if (this.tools) { this.buildTools(); this.buildSide(); } this.redraw(); }
  private buildTools() {
    const btn = (label: string, on: boolean, act: () => void, title = '') => h('button', { class: on ? 'on' : '', title, onclick: act }, label);
    const t = this.tool;
    const groups = library();
    this.tools.replaceChildren(
      h('h3', {}, tl('Tools')),
      h('div', { class: 'grid2' }, btn(tl('Select / move'), t.t === 'select', () => { this.tool = { t: 'select' }; this.buildTools(); }), btn(tl('Erase'), t.t === 'erase', () => { this.tool = { t: 'erase' }; this.buildTools(); })),
      h('h3', {}, tl('Buildings')),
      ...groups.map((g, i) => h('div', { class: 'group' },
        h('button', { class: 'grouphead' + (this.open === i ? ' on' : ''), onclick: () => { this.open = this.open === i ? -1 : i; this.buildTools(); } }, (this.open === i ? '▾ ' : '▸ ') + g.name),
        this.open === i ? h('div', { class: 'grid1' }, ...g.items.map((it) => btn(it.name, t.t === 'put' && t.k === it.k, () => { this.tool = { t: 'put', k: it.k }; this.buildTools(); }))) : null)),
      h('div', { class: 'hint' }, t.t === 'put' ? tl('Click to set it down. R turns the selected building.') : t.t === 'erase' ? tl('Click a building to remove it.') : tl('Click to select, drag to move. Delete removes, R turns it.')),
    );
  }
  private buildSide() {
    const f = this.file, it = f.items[this.sel];
    const props: HTMLElement[] = [];
    if (it) {
      props.push(h('div', { class: 'what' }, lib(it.k)?.name ?? it.k), textField(tl('Label'), it.label ?? '', (v) => this.edit(() => { it.label = v || undefined; })),
        numField('x', it.x, (v) => this.edit(() => { it.x = v; }), 0.5), numField('z', it.z, (v) => this.edit(() => { it.z = v; }), 0.5),
        numField(tl('Width'), it.w, (v) => this.edit(() => { it.w = v; }), 0.5, 0.5, 200), numField(tl('Length'), it.d, (v) => this.edit(() => { it.d = v; }), 0.5, 0.5, 200),
        numField(tl('Turn (°)'), it.rot, (v) => this.edit(() => { it.rot = ((v % 360) + 360) % 360; }), 15, -360, 720),
        h('button', { onclick: () => this.removeSel() }, tl('Remove')));
    } else props.push(h('div', { class: 'hint' }, tl('Nothing selected.')));
    this.side.replaceChildren(
      h('h3', {}, tl('Wall')),
      selectField(tl('Shape'), String(f.sides) as '6' | '8' | '12', [['6', tl('Hexagon')], ['8', tl('Octagon')], ['12', tl('Dodecagon')]], (v) => this.edit(() => { f.sides = Number(v) as 6 | 8 | 12; })),
      selectField(tl('Kind'), String(f.wall), WALL_TIERS.map((w, i): [string, string] => [String(i), w.name]), (v) => this.edit(() => { f.wall = Number(v); })),
      h('div', { class: 'hint' }, TL`${f.items.length} buildings.`),
      h('h3', {}, tl('Selected')), ...props,
    );
  }
  private removeSel() { if (this.sel < 0) return; const i = this.sel; this.edit(() => { this.file.items.splice(i, 1); }); this.sel = -1; this.buildSide(); }
  /** The building under (x, z) (the last one set down), or -1. */
  private hit(x: number, z: number) {
    for (let i = this.file.items.length - 1; i >= 0; i--) {
      const it = this.file.items[i], a = -it.rot * Math.PI / 180, dx = x - it.x, dz = z - it.z;
      const u = dx * Math.cos(a) - dz * Math.sin(a), w = dx * Math.sin(a) + dz * Math.cos(a);
      if (Math.abs(u) <= it.w / 2 && Math.abs(w) <= it.d / 2) return i;
    }
    return -1;
  }
  down(x: number, z: number) {
    const t = this.tool, snap = (v: number) => Math.round(v * 2) / 2;
    if (t.t === 'put') {
      const li = lib(t.k)!, item: VillageItem = { k: t.k, x: snap(x), z: snap(z), w: li.w, d: li.d, rot: 0 };
      this.edit(() => { this.file.items.push(item); }); this.sel = this.file.items.length - 1; this.buildSide(); return;
    }
    const i = this.hit(x, z);
    if (t.t === 'erase') { if (i >= 0) { this.sel = i; this.removeSel(); } return; }
    this.sel = i; this.buildSide(); this.redraw();
    if (i >= 0) { this.hist.push(this.file); this.drag = { dx: this.file.items[i].x - x, dz: this.file.items[i].z - z }; }
  }
  move(x: number, z: number) {
    const d = this.drag, it = this.file.items[this.sel];
    if (!d || !it) return;
    it.x = Math.round((x + d.dx) * 2) / 2; it.z = Math.round((z + d.dz) * 2) / 2; this.redraw();
  }
  up() { if (this.drag) { this.drag = null; this.buildSide(); this.changed(); } }
  key(e: KeyboardEvent): boolean {
    if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyZ' || e.code === 'KeyY')) { const f = e.shiftKey || e.code === 'KeyY' ? this.hist.redo(this.file) : this.hist.undo(this.file); if (f) { this.file = f; this.sel = -1; this.refresh(); this.changed(); } return true; }
    if (e.code === 'Delete' || e.code === 'Backspace') { this.removeSel(); return true; }
    if (e.code === 'KeyR' && this.file.items[this.sel]) { const it = this.file.items[this.sel]; this.edit(() => { it.rot = (it.rot + (e.shiftKey ? 15 : 90)) % 360; }); return true; }
    if (e.code === 'Escape') { this.tool = { t: 'select' }; this.sel = -1; this.refresh(); return true; }
    return false;
  }
  status(x: number, z: number) { return TL`${x.toFixed(1)} m, ${z.toFixed(1)} m from the middle` + ' · ' + TL`${Math.round(Math.hypot(x, z))} m out`; }

  draw(c: CanvasRenderingContext2D, v: View) {
    const f = this.file;
    c.fillStyle = '#000'; c.fillRect(0, 0, v.w, v.h);
    for (let k = -500; k <= 500; k += 10) {
      c.strokeStyle = k % 50 ? '#0b1f10' : '#16391d';
      c.beginPath(); c.moveTo(v.sx(k) + 0.5, v.sz(-500)); c.lineTo(v.sx(k) + 0.5, v.sz(500)); c.moveTo(v.sx(-500), v.sz(k) + 0.5); c.lineTo(v.sx(500), v.sz(k) + 0.5); c.stroke();
    }
    // the wall: the polygon on its middle line (gen/village.ts), centred on the village's middle
    const poly = wallPolygon(f.sides), mid = 36;
    c.strokeStyle = f.wall >= 2 ? '#c8d0c0' : f.wall === 1 ? '#b08a50' : '#8a7040'; c.lineWidth = Math.max(1, (f.wall + 1) * 0.6 * v.scale * 0.5);
    c.beginPath(); poly.forEach(([x, z], i) => (i ? c.lineTo(v.sx(x - mid), v.sz(z - mid)) : c.moveTo(v.sx(x - mid), v.sz(z - mid)))); c.closePath(); c.stroke();
    c.lineWidth = 1;
    c.fillStyle = '#16391d'; c.font = '11px monospace'; c.fillText(TL`${WALL_TIERS[f.wall]?.name ?? ''} · apothem ${apothem(f.sides)} m`, v.sx(-apothem(f.sides)), v.sz(-apothem(f.sides)) - 6);
    f.items.forEach((it, i) => {
      const li = lib(it.k), col = li?.c ?? '#2fe060';
      c.save(); c.translate(v.sx(it.x), v.sz(it.z)); c.rotate(it.rot * Math.PI / 180);
      const w = it.w * v.scale, d = it.d * v.scale;
      c.fillStyle = col + '33'; c.fillRect(-w / 2, -d / 2, w, d);
      c.strokeStyle = i === this.sel ? '#fff' : col; c.strokeRect(-w / 2, -d / 2, w, d);
      // the front (the door side): a tick on the +z face
      c.beginPath(); c.moveTo(-Math.min(w, 6) / 2, d / 2); c.lineTo(Math.min(w, 6) / 2, d / 2); c.lineWidth = 3; c.stroke(); c.lineWidth = 1;
      c.restore();
      if (v.scale >= 2.5) { c.fillStyle = '#d0ffd8'; c.font = '10px monospace'; c.fillText(it.label || li?.name || it.k, v.sx(it.x - it.w / 2), v.sz(it.z - it.d / 2) - 3); }
    });
  }
}
