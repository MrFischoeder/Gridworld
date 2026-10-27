// (0.270, the owner's new crafting) The state and the work of the workshop cells (ui/workshop.ts is its window in the
// backpack). A cell holds a shadow of a thing: from the backpack ('pack'), your hands ('hand') or the ground ('ground',
// by the drop's id, claimed in the shared `Char.workclaims` so nobody else picks it up or works it meanwhile). Nothing
// is used up until the work is done: you stand and work for the recipe's time (the tool in front of the view), then the
// materials go and the product lies at your feet. Moving away stops the work and nothing is lost.
// MP: the cells are yours alone; only the claim on a lying thing is shared; the server's drop decides who really gets
// it (`consumeDrop`), so nothing doubles even if two heroes claimed at once.
import { G, W } from '../game';
import { saveChar } from '../character';
import { CELLS, CLAIM, claimFresh, matching, TOOLS, type Make, type Put } from '../gen/workshop';
import { count, takeAll } from '../data/crafting';
import { ITEMS, type ItemKey } from '../data/items';
import { consumeDrop, dropAtFeet } from './drops';
import { spendStamina, burn } from './survival';
import { setHandWork } from './gather';
import { isToolModel } from './toolmodels';
import { play } from './sound';
import type { Pickup } from './loot';
import { logLine, showToast } from '../ui/hud';
import { tl, TL } from '../i18n';

export interface Ref { k: ItemKey; n: number; src: 'pack' | 'hand' | 'ground'; id?: string }
/** Cells 0..5 are materials, 6..8 tools. */
export const cells: (Ref | null)[] = Array(CELLS.inputs + CELLS.tools).fill(null);
export const isToolCell = (i: number) => i >= CELLS.inputs;

const pickupOf = (id: string): Pickup | undefined => W.pickups.find((p) => p.drop === id);
/** What a cell still stands for now (0 = the thing has gone: someone took it, you moved the stack). */
export function avail(r: Ref): number {
  const c = G.char;
  if (r.src === 'pack') return Math.min(r.n, count(c.inv, r.k));
  if (r.src === 'hand') return c.hands[0]?.k === r.k || c.off[0]?.k === r.k ? 1 : 0;
  const p = r.id ? pickupOf(r.id) : undefined;
  return p && p.k === r.k && (!r.id || !G.char.workclaims[r.id] || G.char.workclaims[r.id].by === c.pid || !claimFresh(G.char.workclaims[r.id], c.time)) ? Math.min(r.n, p.n ?? 1) : 0;
}
const put = (r: Ref | null): Put | null => (r ? { k: r.k, n: avail(r) } : null);
const view = (): { ins: (Put | null)[]; tools: (Put | null)[] } => {
  const ins = cells.slice(0, CELLS.inputs).map(put), tools = cells.slice(CELLS.inputs).map(put);
  return { ins: ins.map((p) => (p && p.n > 0 ? p : null)), tools: tools.map((p) => (p && p.n > 0 ? p : null)) };
};
/** The recipes the cells fit now. */
export function fits(): Make[] { const v = view(); return matching(v.ins, v.tools); }

// ---------- claims on lying things ----------
const claim = (id: string) => { const c = G.char; c.workclaims[id] = { by: c.pid, n: c.name || tl('someone'), t: c.time }; };
const heldIds = () => cells.flatMap((r) => (r?.src === 'ground' && r.id ? [r.id] : []));
function release(id: string) { const c = G.char.workclaims[id]; if (c && c.by === G.char.pid) delete G.char.workclaims[id]; }
/** Put a shadow in cell i. Returns why not, or ''. */
export function setCell(i: number, r: Ref | null): string {
  const old = cells[i];
  if (r?.src === 'ground' && r.id) {
    const other = G.char.workclaims[r.id];
    if (claimFresh(other, G.char.time) && other.by !== G.char.pid) return TL`${other.n} is already working that.`;
    if (heldIds().includes(r.id)) return tl('It is already in a cell.');
    claim(r.id);
  }
  cells[i] = r;
  if (old?.src === 'ground' && old.id && !heldIds().includes(old.id)) release(old.id);
  return '';
}
export function clearCells() { for (const id of heldIds()) release(id); cells.fill(null); }
let beatT = 0;

// ---------- the work ----------
interface Job { make: Make; t: number; repeat: boolean; x: number; z: number; pending: number; got: { k: ItemKey; n: number }[]; wait: number; waiting: boolean }
let job: Job | null = null;
export const working = () => !!job;
export const workProgress = () => (job ? Math.min(1, job.t / job.make.secs) : 0);
export const workPrompt = () => (job ? `${tl('Working')} ${'▮'.repeat(Math.round(workProgress() * 10))}${'▯'.repeat(10 - Math.round(workProgress() * 10))} ${Math.round(workProgress() * 100)}% — ${ITEMS[job.make.out[0]].name}` : '');
const toolCell = () => { const k = cells.slice(CELLS.inputs).find((r) => r && isToolModel(r.k))?.k; return k && isToolModel(k) ? k : null; };

function stop(msg: string) {
  if (job && msg) { logLine(msg); showToast(msg); }
  job = null; setHandWork(null);
  for (const r of cells) if (r?.src === 'ground' && !avail(r) && r.id) { release(r.id); }
  for (let i = 0; i < cells.length; i++) if (cells[i]?.src === 'ground' && !avail(cells[i]!)) cells[i] = null;
  if (!G.packOpen) clearCells();
}
/** Start the work (the window has already checked `make` is among `fits()`). Returns why not, or ''. */
export function startMake(make: Make, repeat: boolean): string {
  if (job) return tl('You are already working.');
  if (!fits().includes(make)) return tl('That does not fit what is in the cells.');
  const ground = cells.some((r) => r?.src === 'ground' && make.inputs.some(([k]) => k === r.k));
  job = { make, t: 0, repeat: repeat && !ground, x: G.pos.x, z: G.pos.z, pending: 0, got: [], wait: 0, waiting: false };
  return '';
}
/** Called when the backpack closes: idle cells are cleared (and their claims given up), a running job keeps its. */
export function packClosed() { if (!job) clearCells(); }
export function cancelWork(msg = '') { if (job) stop(msg); }

/** The work time is up: take the materials (lying ones from the server first) and lay the product at your feet. */
function finish(j: Job) {
  const m = j.make;
  const packOf = (k: ItemKey) => cells.slice(0, CELLS.inputs).filter((r) => r?.src === 'pack' && r.k === k).reduce((a, r) => a + avail(r!), 0);
  const lying = cells.slice(0, CELLS.inputs).filter((r): r is Ref => r?.src === 'ground' && !!r.id && m.inputs.some(([k]) => k === r.k));
  const ground: Ref[] = [];
  for (const [k, n] of m.inputs) {
    let left = n - Math.min(n, packOf(k));
    for (const r of lying.filter((q) => q.k === k)) { if (left <= 0) break; ground.push(r); left -= Math.min(r.n, avail(r)); }
    if (left > 0) { stop(tl('Something you were using is gone.')); return; }
  }
  j.got = []; j.pending = ground.length; j.wait = 4; j.waiting = true;
  for (const r of ground) {
    const p = pickupOf(r.id!);
    if (!p || !consumeDrop(p, (n) => { j.got.push({ k: r.k, n }); j.pending--; })) { for (const g of j.got) dropAtFeet(g); stop(tl('Someone got there first.')); return; }
  }
  if (j.pending === 0) complete(j);
}
/** Everything is in hand: use it up, lay the product down, go on or end. */
function complete(j: Job) {
  const m = j.make, c = G.char, used = new Map<ItemKey, number>();
  for (const [k, n] of m.inputs) {
    const fromPack = Math.min(n, cells.slice(0, CELLS.inputs).filter((r) => r?.src === 'pack' && r.k === k).reduce((a, r) => a + avail(r!), 0));
    used.set(k, n - fromPack);
    if (fromPack > 0) takeAll(c.inv, [[k, fromPack]]);
  }
  for (const g of j.got) { // a whole lying stack came to us: what the recipe did not use goes back down
    const u = Math.min(used.get(g.k) ?? 0, g.n); used.set(g.k, (used.get(g.k) ?? 0) - u);
    if (g.n > u) dropAtFeet({ k: g.k, n: g.n - u });
  }
  burn(m.kcal);
  dropAtFeet({ k: m.out[0], n: m.out[1] });
  showToast(`+${m.out[1]} ${ITEMS[m.out[0]].name}`);
  play('chop', { vol: 0.4, far: 30, share: 25 });
  saveChar();
  for (let i = 0; i < cells.length; i++) { const r = cells[i]; if (r?.src === 'ground' && !avail(r)) { release(r.id!); cells[i] = null; } }
  j.waiting = false; j.got = []; j.t = 0;
  if (j.repeat && fits().includes(m)) return; // the same again
  job = null; setHandWork(null);
  if (!G.packOpen) clearCells();
}

/** Every frame (main loop). */
export function updateWorkshop(dt: number) {
  const c = G.char;
  if ((beatT -= dt) <= 0) { // keep my claims alive, drop the dead ones
    beatT = CLAIM.beat;
    for (const id of heldIds()) claim(id);
    for (const [id, w] of Object.entries(c.workclaims)) if (c.time - w.t > CLAIM.life * 3) delete c.workclaims[id];
  }
  const j = job;
  if (!j) return;
  if (Math.hypot(G.pos.x - j.x, G.pos.z - j.z) > 2.5) { for (const g of j.got) dropAtFeet(g); stop(tl('You walked away from your work.')); return; }
  if (j.waiting) { // the lying things are being handed over by the server
    if (j.pending === 0) complete(j);
    else if ((j.wait -= dt) <= 0) { for (const g of j.got) dropAtFeet(g); stop(tl('Someone got there first.')); }
    return;
  }
  if (!fits().includes(j.make)) { stop(tl('Something you were using is gone.')); return; }
  const tool = toolCell();
  setHandWork(tool ?? null, j.t * 2.5);
  const before = j.t; j.t += dt;
  if (Math.floor(j.t * 1.25) !== Math.floor(before * 1.25)) play('chop', { vol: 0.3, far: 25, share: 20 });
  if (j.t < j.make.secs) return;
  if (!spendStamina(j.make.stamina)) { stop(tl('Too tired to work on. Catch your breath.')); return; }
  finish(j);
}
export const isTool = (k: ItemKey) => TOOLS.has(k);
