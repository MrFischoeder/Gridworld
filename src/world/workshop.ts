// (0.270, reworked in 0.271) The state and the work of the workshop cells (ui/workshop.ts is its window in the
// backpack). A cell holds a shadow of a thing: from the backpack ('pack'), your hands ('hand') or the ground ('ground',
// by the drop's id, claimed in the shared `Char.workclaims` so nobody else picks it up or works it meanwhile); once the
// work has taken a lying pile its rest waits 'on the bench' (yours, carried with the job) for the next batches.
// Nothing is used up before a batch is done: you stand and work for the recipe's time (the tool in front of the view),
// then the materials go and the product lies at your feet. Moving away stops the work; what was on the bench is laid
// back down, so nothing is lost.
// MP: the cells and the bench are yours alone; only the claim on a lying thing is shared; the server's drop decides
// who really gets it (`consumeDrop`), so nothing doubles even if two heroes claimed at once.
import { G, W } from '../game';
import { saveChar } from '../character';
import { CELLS, CLAIM, claimFresh, matching, batches, type Make, type Put } from '../gen/workshop';
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
import { reportWork } from '../ui/workring';

export interface Ref { k: ItemKey; n: number; src: 'pack' | 'hand' | 'ground' | 'bench'; id?: string }
/** Cells 0..5 are materials, 6..8 tools. */
export const cells: (Ref | null)[] = Array(CELLS.inputs + CELLS.tools).fill(null);
export const isToolCell = (i: number) => i >= CELLS.inputs;
/** How far round you lying things count (the ground panel's reach). */
const REACH = 2;
/** Materials a running job has already taken off the ground and not used yet. */
const bench = new Map<ItemKey, number>();

const pickupOf = (id: string): Pickup | undefined => W.pickups.find((p) => p.drop === id);
const mine = (id: string) => { const w = G.char.workclaims[id]; return !claimFresh(w, G.char.time) || w.by === G.char.pid; };
const reachable = (p: Pickup) => Math.hypot(p.p.x - G.pos.x, p.p.z - G.pos.z) < REACH + 0.5 && Math.abs(p.p.y - (G.pos.y + 0.9)) < 2.5;
/** What a cell still stands for now (0 = the thing has gone: someone took it, you moved the stack, you walked off). */
export function avail(r: Ref): number {
  const c = G.char;
  if (r.src === 'pack') return Math.min(r.n, count(c.inv, r.k));
  if (r.src === 'hand') return c.hands[0]?.k === r.k || c.off[0]?.k === r.k ? 1 : 0;
  if (r.src === 'bench') return bench.get(r.k) ?? 0;
  const p = r.id ? pickupOf(r.id) : undefined;
  return p && p.k === r.k && mine(r.id!) && reachable(p) ? Math.min(r.n, p.n ?? 1) : 0;
}
const put = (r: Ref | null): Put | null => { const n = r ? avail(r) : 0; return r && n > 0 ? { k: r.k, n } : null; };
const view = () => ({ ins: cells.slice(0, CELLS.inputs).map(put), tools: cells.slice(CELLS.inputs).map(put) });
/** The recipes the cells fit now. */
export function fits(): Make[] { const v = view(); return matching(v.ins, v.tools); }
/** How many batches of `m` the cells hold now. */
export const batchesNow = (m: Make) => batches(m, view().ins);

// ---------- claims on lying things ----------
const claim = (id: string) => { const c = G.char; c.workclaims[id] = { by: c.pid, n: c.name || tl('someone'), t: c.time }; };
const heldIds = () => cells.flatMap((r) => (r?.src === 'ground' && r.id ? [r.id] : []));
function release(id: string) { const c = G.char.workclaims[id]; if (c && c.by === G.char.pid) delete G.char.workclaims[id]; }
/** Whether a lying thing is in one of your cells (the ground panel marks it). */
export const inMyCell = (id: string | undefined) => !!id && heldIds().includes(id);
/** Whether a backpack kind is in one of your cells (the backpack marks it). */
export const packInCell = (k: ItemKey) => cells.some((r) => r?.src === 'pack' && r.k === k);
/** Put a shadow in cell i. Returns why not, or ''. */
export function setCell(i: number, r: Ref | null): string {
  if (job) return tl('Wait until you have finished working.');
  const old = cells[i];
  if (r?.src === 'ground' && r.id) {
    const other = G.char.workclaims[r.id];
    if (claimFresh(other, G.char.time) && other.by !== G.char.pid) return TL`${other.n} is already working that.`;
    if (heldIds().includes(r.id)) return tl('It is already in a cell.');
    claim(r.id);
  }
  if (r?.src === 'pack' && cells.some((q, j) => j !== i && q?.src === 'pack' && q.k === r.k)) return tl('That is already in a cell.');
  cells[i] = r;
  if (old?.src === 'ground' && old.id && !heldIds().includes(old.id)) release(old.id);
  return '';
}
export function clearCells() { for (const id of heldIds()) release(id); cells.fill(null); }

// ---------- filling the cells for a recipe ----------
/** Unclaimed lying piles of k within reach, biggest first. */
function lyingOf(k: ItemKey): Pickup[] {
  return W.pickups.filter((p) => p.k === k && p.drop && reachable(p) && mine(p.drop) && !p.taking).sort((a, b) => (b.n ?? 1) - (a.n ?? 1));
}
const inHandsK = (k: ItemKey) => G.char.hands[0]?.k === k || G.char.off[0]?.k === k;
/** What of `m` you could gather here (backpack, hands, the ground in reach): the missing [item, n] rows, empty = all. */
export function missing(m: Make): [ItemKey, number][] {
  const out: [ItemKey, number][] = [];
  for (const [k, n] of m.inputs) {
    const have = count(G.char.inv, k) + lyingOf(k).reduce((a, p) => a + (p.n ?? 1), 0);
    if (have < n) out.push([k, n - have]);
  }
  for (const k of m.tools) if (!inHandsK(k) && !count(G.char.inv, k) && !lyingOf(k).length) out.push([k, 1]);
  return out;
}
/** Fill the cells for `m` from what you carry and what lies in reach (the backpack first). Returns why not, or ''. */
export function fillFor(m: Make): string {
  if (job) return tl('Wait until you have finished working.');
  const lack = missing(m);
  if (lack.length) return TL`You lack ${lack.map(([k, n]) => ITEMS[k].name + (n > 1 ? ' ×' + n : '')).join(', ')}.`;
  clearCells();
  let i = 0;
  for (const [k, n] of m.inputs) {
    let got = count(G.char.inv, k);
    if (got && i < CELLS.inputs) cells[i++] = { k, n: got, src: 'pack' };
    for (const p of lyingOf(k)) { if (got >= n || i >= CELLS.inputs) break; cells[i++] = { k, n: p.n ?? 1, src: 'ground', id: p.drop }; claim(p.drop!); got += p.n ?? 1; }
  }
  m.tools.forEach((k, j) => {
    const p = lyingOf(k)[0];
    cells[CELLS.inputs + j] = inHandsK(k) ? { k, n: 1, src: 'hand' } : count(G.char.inv, k) ? { k, n: 1, src: 'pack' } : { k, n: 1, src: 'ground', id: p.drop };
    if (!inHandsK(k) && !count(G.char.inv, k)) claim(p.drop!);
  });
  return fits().includes(m) ? '' : tl('That does not fit what is in the cells.');
}

// ---------- the work ----------
interface Job { make: Make; t: number; left: number; x: number; z: number; pending: number; got: { k: ItemKey; n: number }[]; wait: number; waiting: boolean; check: number }
let job: Job | null = null;
export const working = () => !!job;
export const workProgress = () => (job ? Math.min(1, job.t / job.make.secs) : 0);
export function workPrompt(): string {
  if (!job) return '';
  const more = job.left > 1 ? ' ' + TL`(${job.left - 1} more)` : '';
  return `${tl('Working')} ${Math.round(workProgress() * 100)}% — ${ITEMS[job.make.out[0]].name}${more}`;
}
const toolCell = () => { const k = cells.slice(CELLS.inputs).find((r) => r && avail(r) && isToolModel(r.k))?.k; return k && isToolModel(k) ? k : null; };

/** Lay what is on the bench back down and forget the shadows of things that are gone. */
function tidy() {
  for (const [k, n] of bench) if (n > 0) dropAtFeet({ k, n });
  bench.clear();
  for (let i = 0; i < cells.length; i++) { const r = cells[i]; if (r && (r.src === 'bench' || (r.src === 'ground' && !avail(r)))) { if (r.id) release(r.id); cells[i] = null; } }
}
function stop(msg: string) {
  if (job && msg) { logLine(msg); showToast(msg); }
  if (job) for (const g of job.got) dropAtFeet(g);
  job = null; setHandWork(null);
  tidy();
  if (!G.packOpen) packClosed();
}
/** Start the work: `times` batches (Infinity = while the materials last). Returns why not, or ''. */
export function startMake(make: Make, times = 1): string {
  if (job) return tl('You are already working.');
  if (!fits().includes(make)) return tl('That does not fit what is in the cells.');
  job = { make, t: 0, left: Math.max(1, Math.min(times, batchesNow(make))), x: G.pos.x, z: G.pos.z, pending: 0, got: [], wait: 0, waiting: false, check: 0 };
  return '';
}
/** The backpack closed: lying things' shadows go (their claims with them) unless a job holds them; what you carry stays. */
export function packClosed() {
  if (job) return;
  for (let i = 0; i < cells.length; i++) { const r = cells[i]; if (r?.src === 'ground') { if (r.id) release(r.id); cells[i] = null; } }
}
export function cancelWork(msg = '') { if (job) stop(msg); }

/** The batch's time is up: take what is needed from the bench, the backpack and (through the server) the ground. */
function finish(j: Job) {
  const m = j.make;
  const lying = cells.slice(0, CELLS.inputs).filter((r): r is Ref => r?.src === 'ground' && !!r.id && avail(r) > 0 && m.inputs.some(([k]) => k === r.k));
  const take: Ref[] = [];
  for (const [k, n] of m.inputs) {
    let left = n - (bench.get(k) ?? 0) - Math.min(n, cells.slice(0, CELLS.inputs).filter((r) => r?.src === 'pack' && r.k === k).reduce((a, r) => a + avail(r!), 0));
    for (const r of lying.filter((q) => q.k === k)) { if (left <= 0) break; take.push(r); left -= avail(r); }
    if (left > 0) { stop(tl('Something you were using is gone.')); return; }
  }
  j.got = []; j.pending = take.length; j.wait = 4; j.waiting = true;
  for (const r of take) {
    const p = pickupOf(r.id!);
    if (!p || !consumeDrop(p, (n) => { j.got.push({ k: r.k, n }); j.pending--; })) { stop(tl('Someone got there first.')); return; }
  }
  if (j.pending === 0) complete(j);
}
/** Everything is in hand: use it up, lay the product down, go on or end. */
function complete(j: Job) {
  const m = j.make, c = G.char;
  // the lying piles just taken go onto the bench; their cells now stand for the bench
  for (const g of j.got) bench.set(g.k, (bench.get(g.k) ?? 0) + g.n);
  j.got = [];
  for (let i = 0; i < CELLS.inputs; i++) {
    const r = cells[i];
    if (r?.src !== 'ground' || !bench.get(r.k) || avail(r)) continue;
    if (r.id) release(r.id);
    cells[i] = cells.some((q) => q?.src === 'bench' && q.k === r.k) ? null : { k: r.k, n: Infinity, src: 'bench' };
  }
  for (const [k, n] of m.inputs) {
    const b = Math.min(n, bench.get(k) ?? 0);
    if (b) bench.set(k, (bench.get(k) ?? 0) - b);
    if (n > b) takeAll(c.inv, [[k, n - b]]);
  }
  burn(m.kcal);
  dropAtFeet({ k: m.out[0], n: m.out[1] });
  showToast(`+${m.out[1]} ${ITEMS[m.out[0]].name}`);
  play('chop', { vol: 0.4, far: 30, share: 25 });
  saveChar();
  j.waiting = false; j.t = 0; j.left--;
  if (j.left > 0 && fits().includes(m)) return; // the same again
  job = null; setHandWork(null);
  tidy();
  if (!G.packOpen) packClosed();
}

let beatT = 0;
/** Every frame (world/interact.ts). */
export function updateWorkshop(dt: number) {
  const c = G.char;
  if ((beatT -= dt) <= 0) { // keep my claims alive, drop the long dead ones
    beatT = CLAIM.beat;
    for (const id of heldIds()) claim(id);
    for (const [id, w] of Object.entries(c.workclaims)) if (c.time - w.t > CLAIM.life * 3) delete c.workclaims[id];
  }
  const j = job;
  if (!j) return;
  if (Math.hypot(G.pos.x - j.x, G.pos.z - j.z) > 2.5) { stop(tl('You walked away from your work.')); return; }
  reportWork(workProgress());
  if (j.waiting) { // the lying things are being handed over by the server
    if (j.pending === 0) complete(j);
    else if ((j.wait -= dt) <= 0) stop(tl('Someone got there first.'));
    return;
  }
  if ((j.check -= dt) <= 0) { j.check = 0.25; if (!fits().includes(j.make)) { stop(tl('Something you were using is gone.')); return; } }
  setHandWork(toolCell(), j.t * 2.5);
  const before = j.t; j.t += dt;
  if (Math.floor(j.t * 1.25) !== Math.floor(before * 1.25)) play('chop', { vol: 0.3, far: 25, share: 20 });
  if (j.t < j.make.secs) return;
  if (!spendStamina(j.make.stamina)) { stop(tl('Too tired to work on. Catch your breath.')); return; }
  finish(j);
}
