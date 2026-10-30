// Things put down on the ground by the players: Drop in the backpack lays the item at your feet, as what it is, and E
// picks it up again. Online the server keeps them (server/mp.mjs): everyone in the same place sees them, and only the
// first to ask gets an item, so nothing is doubled. Alone they lie there until you leave the game (not saved).
import * as THREE from 'three';
import { play } from './sound';
import { G, W } from '../game';
import { scene } from './render';
import { drawPickup, setGroundHook, grabPickup, type Pickup } from './loot';
import { net, online, sendDrop, sendTake, onGot, type NetDrop } from '../net/client';
import { myLoc } from './peers';
import { nearX } from '../gen/regions';
import { addItem, saveChar, handsChanged, packRoom, onCrateOverflow, settleCrates } from '../character';
import { ITEMS, HANDS_ONLY, type ItemKey } from '../data/items';
import { logLine, showToast } from '../ui/hud';
import type { Slot } from '../save';
import { workedBy } from './worklocks';
import { layBag } from './bags';
import { tl, TL } from '../i18n';

/** Put down while playing alone (runtime only), in the same shape as the server's. */
const local = new Map<string, NetDrop>();
let seq = 0;
/** The lying items drawn now: drop id → its pickup. */
const shown = new Map<string, Pickup>();
const source = () => (online() ? net.drops : local);
const label = (k: string, n: number) => (ITEMS[k as ItemKey]?.name ?? k) + (n > 1 ? ' ×' + n : '');

/** Lay a stack you have just taken out of your kit at your feet (a little ahead, so you see it fall). */
let recent: [number, number, number][] = [];
export function dropAtFeet(s: Slot) {
  if (s.k === 'backpack') { // (0.285) a backpack is put down as a backpack (world/bags.ts), its things in it
    if (!G.char.hands[0]) { G.char.hands[0] = s; logLine(layBag()); handsChanged(); } else logLine(tl('Put down what you hold first, then the backpack.'));
    return;
  }
  // (0.279.1) a gun keeps its attachments on the ground and whoever picks it up has them; only an older server, which
  // would lose them, gets them laid down loose beside the gun as in 0.279
  if (s.m?.some(Boolean) && online() && !net.feat.includes('gunmods')) {
    for (const k of s.m) if (k) dropAtFeet({ k, n: 1 });
    s = { k: s.k, n: s.n, ...(s.c !== undefined ? { c: s.c } : {}) };
    logLine(tl('The attachments come off the gun as you put it down.'));
  }
  // a pile spreads out round the spot in front of you (a golden-angle spiral), so a whole backpack put down stays apart
  const f = 0.7, cx = G.pos.x - Math.sin(G.yaw) * f, cz = G.pos.z - Math.cos(G.yaw) * f;
  const now = performance.now(); recent = recent.filter((q) => now - q[2] < 8000); // ours still on their way through the server
  const n = W.pickups.filter((q) => Math.hypot(q.p.x - cx, q.p.z - cz) < 1.3).length + recent.filter((q) => Math.hypot(q[0] - cx, q[1] - cz) < 1.3).length;
  const r = Math.min(1.1, 0.32 * Math.sqrt(n)), a = n * 2.39996 + G.yaw;
  const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
  const p: [number, number, number] = [x, G.pos.y + 0.6, z], loc = myLoc();
  if (sendDrop(s.k, s.n, s.c, p, loc, false, s.b, s.m)) recent.push([cx, cz, now]);
  else {
    const id = 'local:' + ++seq;
    local.set(id, { id, k: s.k, n: s.n, c: s.c, p, loc, by: G.char.name || 'you', at: Date.now(), ...(s.b ? { b: { ...s.b } } : {}), ...(s.m?.some(Boolean) ? { m: [...s.m] } : {}) });
  }
  logLine(TL`You put down ${label(s.k, s.n)}.`);
  syncDrops(true);
}

/**
 * (0.278.1) Loot of your own game lies without a drop id (alone, or what the server does not keep): the workshop
 * needs one to claim it and take it later, so it becomes one of your local drops in place (same model, same spot).
 * False for things that cannot be (relics, keys, quest items).
 */
export function adoptPickup(p: Pickup): boolean {
  if (p.drop) return true;
  const t = ITEMS[p.k]?.type;
  if (!t || t === 'relic' || t === 'quest' || p.k === 'key' || !W.pickups.includes(p)) return false;
  const id = 'local:' + ++seq;
  local.set(id, { id, k: p.k, n: p.n ?? 1, c: p.c, p: [p.p.x, p.p.y, p.p.z], loc: myLoc(), by: '', at: Date.now(), auto: true, ...(p.b ? { b: { ...p.b } } : {}), ...(p.m?.some(Boolean) ? { m: [...p.m] } : {}) });
  p.drop = id; p.auto = true; shown.set(id, p);
  return true;
}
/** Into your kit, keeping a worn part's condition. False if there is no room. */
function give(d: NetDrop): boolean {
  const k = d.k as ItemKey, c = G.char;
  if (!ITEMS[k]) return false;
  if (d.b && ITEMS[d.b.k as ItemKey]) { // (0.247) a crate or a barrel with its load: into your hands as it was
    if (!addItem(k, 1) || c.hands[0]?.k !== k) return false;
    c.hands[0].b = { k: d.b.k as ItemKey, n: d.b.n }; handsChanged(); return true;
  }
  const gm = d.m?.some(Boolean) ? d.m.map((x) => (x && ITEMS[x as ItemKey] ? x as ItemKey : null)) : undefined;
  if (gm) { // (0.279.1) a gun with its own attachments, just as it was put down
    const i = c.inv.indexOf(null);
    if (i < 0 || packRoom(k) < 1) return false;
    c.inv[i] = { k, n: 1, ...(d.c !== undefined ? { c: d.c } : {}), m: gm }; return true;
  }
  if (d.c === undefined) return !!addItem(k, d.n);
  if (HANDS_ONLY.has(k)) { if (!addItem(k, 1)) return false; c.hands[0] = { k, n: 1, c: d.c }; handsChanged(); return true; }
  const i = c.inv.indexOf(null);
  if (i < 0 || packRoom(k) < 1) return false;
  c.inv[i] = { k, n: d.n, c: d.c }; return true;
}
/** Lying items being worked up rather than picked up (world/handwork.ts): drop id → what to do once the server hands it over. */
const eat = new Map<string, (n: number) => void>();
/** Use a lying item up (alone at once; online once the server says you were first). False if it cannot be had now. */
export function consumeDrop(p: Pickup, then: (n: number) => void): boolean {
  if (!p.drop) { const i = W.pickups.indexOf(p); if (i < 0) return false; scene.remove(p.g); W.pickups.splice(i, 1); then(p.n ?? 1); return true; }
  const id = p.drop;
  if (workedBy(id)) return false; // another hero's workshop has it
  if (id.startsWith('local:')) { const d = local.get(id); if (!d) return false; local.delete(id); syncDrops(true); then(d.n); return true; }
  if (p.taking && performance.now() - p.taking < 3000) return false;
  p.taking = performance.now(); eat.set(id, then);
  if (!sendTake(id)) { p.taking = 0; eat.delete(id); return false; }
  return true;
}
function took(d: NetDrop) {
  const then = eat.get(d.id);
  if (then) { eat.delete(d.id); then(d.n); syncDrops(true); return; }
  if (give(d)) { settleCrates(); saveChar(); logLine(TL`Picked up ${label(d.k, d.n)}${d.by && d.by !== G.char.name && !d.auto ? TL` (left by ${d.by})` : ''}.`); }
  else { // no room after all: it goes back down where it was
    showToast(tl('No room for it')); logLine(TL`No room for ${label(d.k, d.n)}: it stays on the ground.`);
    if (!sendDrop(d.k, d.n, d.c, d.p, d.loc, false, d.b, d.m)) local.set(d.id, d); // (now only for E, so it is not taken again at once)
  }
  syncDrops(true);
}
onGot(took);
// online, loot falls into the shared world: the server lays it down for everyone (in the open world or a dungeon);
// hooked on the first `syncDrops` (loot.ts and this module import each other)
let hooked = false;
const hook = () => setGroundHook((at, k, n) => (G.char.loc === 'overworld' || G.char.loc === 'dungeon') && sendDrop(k, n, undefined, [Math.round(at.x * 100) / 100, Math.round(at.y * 100) / 100, Math.round(at.z * 100) / 100], myLoc(), true));

/** The lying item you stand by (E picks it up). */
export function nearDrop(): Pickup | null {
  let best: Pickup | null = null, bd = 1.7;
  for (const p of W.pickups) {
    if (!ITEMS[p.k]) continue;
    const d = Math.hypot(p.p.x - G.pos.x, p.p.z - G.pos.z);
    if (d < bd && Math.abs(p.p.y - (G.pos.y + 0.9)) < 2.5) { bd = d; best = p; }
  }
  return best;
}
export const dropPrompt = (p: Pickup) => {
  const more = W.pickups.filter((q) => q !== p && ITEMS[q.k] && Math.hypot(q.p.x - G.pos.x, q.p.z - G.pos.z) < 2).length;
  return TL`E — pick up ${label(p.k, p.n ?? 1)}${p.by && p.by !== G.char.name ? TL` (left by ${p.by})` : ''}${more ? TL` · Tab — ${more} more on the ground` : ''}`;
};
export function takeDrop(p: Pickup) {
  if (!p.drop) { if (!grabPickup(p)) showToast(tl('No room in your backpack')); return; } // loot of your own game
  const id = p.drop, busy = workedBy(id);
  if (busy) { showToast(TL`${busy} is working that.`); return; }
  play('pickup', { vol: 0.5 });
  if (id.startsWith('local:')) { const d = local.get(id); if (d) { local.delete(id); took(d); } return; }
  if (p.taking && performance.now() - p.taking < 3000) return; // already asked
  p.taking = performance.now();
  if (!sendTake(id)) p.taking = 0;
}

let clock = 0;
/** Draw the lying items of the place you are in, and drop the ones taken away (main loop; `now` = at once). */
export function syncDrops(now = false, dt = 0) {
  if (!hooked) { hooked = true; hook(); }
  if (!now && (clock -= dt) > 0) return;
  clock = 0.25;
  const here = G.char.loc === 'overworld' || G.char.loc === 'dungeon' ? myLoc() : '', src = source();
  for (const [id, p] of [...shown]) {
    const d = (id.startsWith('local:') ? local : src).get(id);
    if (d && d.loc === here && W.pickups.includes(p)) continue;
    shown.delete(id);
    const i = W.pickups.indexOf(p);
    if (i >= 0) { scene.remove(p.g); W.pickups.splice(i, 1); }
  }
  if (!here) return;
  for (const d of src === local ? local.values() : [...src.values(), ...local.values()]) {
    if (d.loc !== here || shown.has(d.id) || !ITEMS[d.k as ItemKey]) continue;
    const x = here === 'o' ? nearX(d.p[0], G.pos.x) : d.p[0];
    const p = drawPickup(new THREE.Vector3(x, d.p[1], d.p[2]), d.k as ItemKey, d.n);
    p.drop = d.id; p.c = d.c; p.by = d.by; p.age = d.auto ? 0 : 1; p.auto = d.auto; if (d.b) p.b = d.b as Pickup['b']; if (d.m) p.m = d.m as Pickup['m'];
    shown.set(d.id, p);
  }
}
/** Leaving to the menu's other world: forget what you put down alone. */
export function clearLocalDrops() { local.clear(); syncDrops(true); }
// (0.251) a second crate turns up while your hands hold one: it is set down at your feet
onCrateOverflow((s) => { dropAtFeet(s); showToast(TL`Your hands are full: the ${ITEMS[s.k].name.toLowerCase()} of ${ITEMS[s.b!.k].name} is set down at your feet`); });
