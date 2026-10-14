// (0.207) GridWorld's map editor (editor.html, opened from the game's main menu): three editors in tabs, the world,
// a village's layout and a dungeon. Files are kept in this browser (gen/mapfile.ts EDITOR_KEY: the game reads the
// dungeons from there) and go out and in as JSON files. A dungeon can be tried at once in the game ('Test in the
// game' opens it with ?test=<name>; world/custommaps.ts takes it down there).
import './editor.css';
import { tl, TL } from '../i18n';
import { VERSION } from '../version';
import { EDITOR_KEY, MAP_FORMAT, readMapFile, expandDungeon, type MapKind, type MapFile, type DungeonFile, type WorldFile, type VillageFile } from '../gen/mapfile';
import { h, type Tab, type View } from './common';
import { DungeonTab } from './dungeon';
import { WorldTab } from './world';
import { VillageTab } from './village';

document.title = tl('GridWorld map editor');
const store = (): Storage | null => { try { return localStorage; } catch { return null; } };
function all(kind: MapKind): Record<string, unknown> { try { return JSON.parse(store()?.getItem(EDITOR_KEY[kind]) ?? '{}'); } catch { return {}; } }
function put(kind: MapKind, name: string, f: MapFile | null) {
  const m = all(kind);
  if (f) m[name] = f; else delete m[name];
  try { store()?.setItem(EDITOR_KEY[kind], JSON.stringify(m)); return true; } catch { return false; }
}
const names = (kind: MapKind) => Object.keys(all(kind)).sort();

// ---------- the page ----------
const app = document.getElementById('app')!;
const tools = h('div', { id: 'tools' }), side = h('div', { id: 'side' }), cv = h('canvas', { id: 'plan' }), stage = h('div', { id: 'stage' }, cv), foot = h('div', { id: 'foot' });
const nameIn = h('input', { type: 'text', id: 'fname' }), openSel = h('select', { id: 'fopen' }), note = h('span', { id: 'note' });
const fileIn = h('input', { type: 'file', accept: '.json,application/json', style: 'display:none' });
const tabsEl = h('div', { id: 'tabs' }), testBtn = h('button', { id: 'test' }, tl('Test in the game'));
let dirty = false;
const markDirty = () => { dirty = true; note.textContent = tl('Not saved'); note.className = 'warn'; };
const ctx2 = cv.getContext('2d')!;
let frameQueued = false;
const redraw = () => { if (frameQueued) return; frameQueued = true; requestAnimationFrame(() => { frameQueued = false; paint(); }); };

const tabs = {
  world: new WorldTab(markDirty, redraw, () => names('village')),
  village: new VillageTab(markDirty, redraw),
  dungeon: new DungeonTab(markDirty, redraw),
} as { world: WorldTab; village: VillageTab; dungeon: DungeonTab };
const TAB_NAME: Record<MapKind, string> = { world: tl('World'), village: tl('Village'), dungeon: tl('Dungeon') };
let kind: MapKind = (sessionStorage.getItem('gridWorld.editor.tab') as MapKind) || 'dungeon';
if (!(kind in tabs)) kind = 'dungeon';
const cur = (): Tab<MapFile> => tabs[kind] as unknown as Tab<MapFile>;

app.append(
  h('div', { id: 'bar' },
    h('b', { class: 'brand' }, TL`GRIDWORLD · map editor v${VERSION}`), tabsEl,
    h('span', { class: 'sep' }), h('label', {}, tl('Name') + ' ', nameIn),
    h('button', { onclick: () => newFile() }, tl('New')), h('button', { onclick: () => save() }, tl('Save')),
    openSel, h('button', { onclick: () => remove() }, tl('Delete')),
    h('button', { onclick: () => exportFile() }, tl('Export JSON')), h('button', { onclick: () => fileIn.click() }, tl('Import JSON')), fileIn,
    testBtn, note),
  h('div', { id: 'body' }, tools, stage, side), foot,
);
testBtn.onclick = () => {
  if (!save()) return;
  window.open('index.html?test=' + encodeURIComponent(tabs.dungeon.file.name), '_blank');
};

function buildTabs() {
  tabsEl.replaceChildren(...(Object.keys(tabs) as MapKind[]).map((k) => h('button', { class: k === kind ? 'on' : '', onclick: () => switchTo(k) }, TAB_NAME[k])));
  testBtn.style.display = kind === 'dungeon' ? '' : 'none';
  nameIn.value = cur().file.name;
  const list = names(kind);
  openSel.replaceChildren(h('option', { value: '' }, TL`Open… (${list.length})`), ...list.map((n) => h('option', { value: n }, n)));
}
function switchTo(k: MapKind) {
  if (dirty && !confirm(tl('This file is not saved. Leave it anyway?'))) return;
  kind = k; sessionStorage.setItem('gridWorld.editor.tab', k); dirty = false; note.textContent = '';
  cur().mount(tools, side); fitView(); buildTabs(); redraw();
}
function fitView() { resize(); const [x0, z0, x1, z1] = cur().frame(); cur().view.fit(x0, z0, x1, z1); }
function setFile(f: MapFile, fresh = true) {
  (cur() as Tab<MapFile>).load(f, fresh);
  nameIn.value = f.name; dirty = false; note.textContent = ''; fitView(); buildTabs(); redraw();
}
function newFile() {
  if (dirty && !confirm(tl('This file is not saved. Start a new one anyway?'))) return;
  const n = TL`New ${TAB_NAME[kind].toLowerCase()}`;
  setFile(cur().fresh(names(kind).includes(n) ? n + ' ' + (names(kind).length + 1) : n));
}
function save(): boolean {
  const f = cur().file as MapFile, n = nameIn.value.trim();
  if (!n) { alert(tl('Give it a name first.')); return false; }
  f.name = n; f.format = MAP_FORMAT;
  if (f.kind === 'dungeon') (f as DungeonFile).ops = expandDungeon(f as DungeonFile).ops; // the op list, for other tools
  if (!put(kind, n, f)) { alert(tl('The browser would not keep it (its storage is full or blocked).')); return false; }
  dirty = false; note.textContent = tl('Saved'); note.className = 'ok'; buildTabs(); return true;
}
function remove() {
  const n = openSel.value || nameIn.value.trim();
  if (!n || !names(kind).includes(n) || !confirm(TL`Delete ${n}?`)) return;
  put(kind, n, null); buildTabs();
}
openSel.onchange = () => {
  const n = openSel.value;
  if (!n) return;
  if (dirty && !confirm(tl('This file is not saved. Open another anyway?'))) { openSel.value = ''; return; }
  const f = readMapFile(all(kind)[n]);
  if (f && f.kind === kind) setFile(f); else alert(tl('That file cannot be read.'));
};
function exportFile() {
  const f = cur().file as MapFile;
  if (f.kind === 'dungeon') (f as DungeonFile).ops = expandDungeon(f as DungeonFile).ops;
  const a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify(f, null, 1)], { type: 'application/json' })), download: (nameIn.value.trim() || f.name || 'map').replace(/[^\w.-]+/g, '_') + '.' + f.kind + '.json' });
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
fileIn.onchange = async () => {
  const file = fileIn.files?.[0];
  fileIn.value = '';
  if (!file) return;
  let f: MapFile | null = null;
  try { f = readMapFile(JSON.parse(await file.text())); } catch { f = null; }
  if (!f) { alert(tl('That file is not a GridWorld map.')); return; }
  if (f.kind !== kind) { kind = f.kind; sessionStorage.setItem('gridWorld.editor.tab', kind); cur().mount(tools, side); }
  setFile(f);
  markDirty();
};

// ---------- the plan: mouse and keys ----------
function resize() {
  const r = stage.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = Math.max(1, Math.round(r.width * dpr)); cv.height = Math.max(1, Math.round(r.height * dpr));
  cv.style.width = r.width + 'px'; cv.style.height = r.height + 'px';
  for (const t of Object.values(tabs)) { t.view.w = r.width; t.view.h = r.height; }
}
function paint() {
  const dpr = cv.width / Math.max(1, cv.clientWidth);
  ctx2.setTransform(dpr, 0, 0, dpr, 0, 0);
  const t = cur();
  t.draw(ctx2, t.view);
}
window.addEventListener('resize', () => { resize(); redraw(); });
let pan: { x: number; y: number; ox: number; oz: number } | null = null, space = false, mouse = { x: 0, y: 0 };
const local = (e: MouseEvent) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] as const; };
cv.addEventListener('contextmenu', (e) => e.preventDefault());
cv.addEventListener('mousedown', (e) => {
  const [px, py] = local(e), v: View = cur().view;
  if (e.button === 1 || e.button === 2 || (e.button === 0 && space)) { pan = { x: px, y: py, ox: v.ox, oz: v.oz }; e.preventDefault(); return; }
  if (e.button === 0) cur().down(v.wx(px), v.wz(py), e);
});
window.addEventListener('mousemove', (e) => {
  const [px, py] = local(e), v = cur().view;
  mouse = { x: px, y: py };
  if (pan) { v.ox = pan.ox - (px - pan.x) / v.scale; v.oz = pan.oz - (py - pan.y) / v.scale; redraw(); return; }
  if (e.target === cv || e.buttons) cur().move(v.wx(px), v.wz(py), e);
  if (e.target === cv) foot.textContent = cur().status(v.wx(px), v.wz(py));
});
window.addEventListener('mouseup', (e) => {
  if (pan) { pan = null; return; }
  const [px, py] = local(e), v = cur().view;
  if (e.button === 0) cur().up(v.wx(px), v.wz(py), e);
});
cv.addEventListener('wheel', (e) => { e.preventDefault(); const [px, py] = local(e); cur().view.zoomAt(px, py, e.deltaY > 0 ? 0.87 : 1.15); redraw(); }, { passive: false });
window.addEventListener('keydown', (e) => {
  const tag = (e.target as HTMLElement).tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
  if (e.code === 'Space') { space = true; e.preventDefault(); return; }
  if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') { e.preventDefault(); save(); return; }
  if (e.code === 'KeyF' && !e.ctrlKey) { fitView(); redraw(); return; }
  if (cur().key?.(e)) e.preventDefault();
  void mouse;
});
window.addEventListener('keyup', (e) => { if (e.code === 'Space') space = false; });
window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

// start on the last tab, with the last file of its kind if there is one
cur().mount(tools, side);
{ const last = names(kind).at(-1), f = last ? readMapFile(all(kind)[last]) : null; if (f && f.kind === kind) setFile(f); else { fitView(); buildTabs(); } }
foot.textContent = tl('Right drag or Space + drag moves the plan, the wheel zooms, F fits it to the screen, Ctrl+S saves.');
redraw();
export type { WorldFile, VillageFile };
