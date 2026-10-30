// (0.285, the owner's request) Taking the backpack off: it is carried in both hands with everything in it, opened,
// put down on the ground, picked up again (by you or anyone) and put back on (gen/bags.ts).
// Multiplayer: the backpack's contents are the shared container `containers[id]` and a backpack lying on the ground is
// a record in the shared `bags`. Picking one up takes the container's lock first (the server grants it to one player)
// and marks the container `held`, so two players cannot both carry it off; the record goes once it is picked up.
// While it is carried nobody else can reach it. An older server without the 'bags' feature cannot keep one lying,
// so then it cannot be put down.
import * as THREE from 'three';
import { scene } from './render';
import { G } from '../game';
import { myLoc } from './peers';
import { nearX } from '../gen/regions';
import { textSprite } from './npc';
import { sharedLine, sharedFill } from './props';
import { BAG, bagBox, bagFree, bagId, type Bag } from '../gen/bags';
import { calcStats, handsChanged, saveChar, stowHeld } from '../character';
import { putSlot } from '../inventory';
import { INV_SIZE, item, HANDS_ONLY } from '../data/items';
import { net, online, lockContainer, unlockContainer } from '../net/client';
import { openTransfer } from '../ui/transfer';
import { showToast, logLine } from '../ui/hud';
import { play } from './sound';
import { tl, TL } from '../i18n';

let seq = 0;
const LINE = 0xc8b77c;
/** Whether a backpack can be put down here: alone always, online only with a server that keeps them. */
export const canLayBag = () => !online() || net.feat.includes('bags');

/** Take your backpack off: everything in it (and the bigger pack you wear) goes with it into your hands. '' when done. */
export function takeOffPack(): string {
  const c = G.char;
  if (c.packOff) return tl('Your backpack is already off.');
  const h = c.hands[0];
  if (h && HANDS_ONLY.has(h.k)) return TL`Your hands are full: ${item(h.k).name}. Put it down first.`;
  const id = bagId(c.pid, c.time, ++seq), box = bagBox(c.inv, c.wear.pack, c.pid);
  if (h) { // what you held goes in with the rest
    if (putSlot(box.items, h, Infinity) > 0) return tl('Your backpack is full: put away what you hold first.');
  }
  c.containers[id] = box;
  c.inv = Array(INV_SIZE).fill(null);
  c.wear.pack = null; c.packOff = true;
  c.hands[0] = { k: 'backpack', n: 1, bag: id };
  calcStats(); handsChanged(); saveChar();
  play('chest', { vol: 0.4 });
  return tl('You take your backpack off and carry it in your hands.');
}
/** The backpack in your hands, and its container. */
function carried() {
  const h = G.char.hands[0];
  return h?.k === 'backpack' && h.bag ? { h, id: h.bag, box: G.char.containers[h.bag] } : null;
}
/** Put on the backpack you carry (yours or one you picked up): its things go back into the backpack slots. */
export async function putOnPack(): Promise<string> {
  const c = G.char, b = carried();
  if (!b) return tl('Carry a backpack in your hands to put it on.');
  if (!c.packOff) return tl('You already wear a backpack: take yours off first.');
  if (!b.box) { c.hands[0] = null; handsChanged(); return tl('There is nothing left of that backpack.'); }
  const want = b.id;
  if (online() && !(await lockContainer(want, b.box))) return tl('Someone else is using this backpack.');
  const box = c.containers[want], h = c.hands[0];
  if (!box || h?.bag !== want) { if (online()) unlockContainer(want); return tl('The backpack is not in your hands any more.'); }
  const inv: typeof c.inv = Array(INV_SIZE).fill(null), spill: typeof c.inv = [];
  box.items.forEach((s, i) => { if (s) (i < INV_SIZE ? (inv[i] = s) : spill.push(s)); });
  c.inv = inv; c.wear.pack = box.pack ?? null; c.packOff = false; c.hands[0] = null;
  for (const s of spill) if (s && putSlot(c.inv, s, Infinity) > 0) logLine(TL`No slot left for ${item(s.k).name}: it stays out.`);
  delete c.containers[want];
  if (online()) unlockContainer(want); // its deletion goes with the next world sync
  calcStats(); handsChanged(); saveChar();
  play('chest', { vol: 0.4 });
  return tl('You put the backpack on.');
}
/** Open the backpack you carry (the transfer window). */
export function openCarried(): string {
  const b = carried();
  if (!b?.box) return tl('Carry a backpack in your hands to open it.');
  void openTransfer({ title: tl('Backpack'), subtitle: tl('Carried in your hands'), boxLabel: tl('Backpack'), box: b.box });
  return '';
}
/** Put the backpack you carry down at your feet. '' when done. */
export function layBag(): string {
  const c = G.char, b = carried();
  if (!b) return '';
  if (!canLayBag()) return tl('This server cannot keep a backpack lying on the ground (update the server). Put it on instead.');
  const f = 0.8, x = G.pos.x - Math.sin(G.yaw) * f, z = G.pos.z - Math.cos(G.yaw) * f;
  const g = G.ground ? G.ground(x, z) : NaN, y = Number.isFinite(g) && g <= G.pos.y + 1 && g > G.pos.y - 40 ? g : G.pos.y; // on the ground, also when put down mid-jump
  const bag: Bag = { id: b.id, by: c.name || tl('a castaway'), pid: c.pid, x, y, z, yaw: G.yaw, loc: myLoc(), t: Math.round(c.time) };
  if (!b.box) c.containers[b.id] = bagBox([], null, '');
  delete c.containers[b.id].held;
  (c.bags ??= {})[b.id] = bag;
  c.hands[0] = null; handsChanged(); saveChar();
  play('thud', { vol: 0.5, share: 12 });
  return tl('You put the backpack down.');
}
/** Pick up a backpack lying here into your hands. */
export async function pickUpBag(bag: Bag): Promise<string> {
  const c = G.char, h = c.hands[0];
  if (h) { if (HANDS_ONLY.has(h.k) || c.packOff) return TL`Your hands are full: ${item(h.k).name}.`; const m = stowHeld(); if (m) return m; }
  if (online() && !(await lockContainer(bag.id, c.containers[bag.id]))) return tl('Someone else is taking this backpack.');
  const box = c.containers[bag.id];
  if (!box || !bagFree(box) || !c.bags?.[bag.id] || c.hands[0]) { if (online()) unlockContainer(bag.id); return tl('Someone took it first.'); }
  box.held = c.pid;
  delete c.bags[bag.id];
  c.hands[0] = { k: 'backpack', n: 1, bag: bag.id };
  if (online()) unlockContainer(bag.id, box);
  handsChanged(); saveChar(); drop(bag.id);
  play('pickup', { vol: 0.5 });
  return bag.pid === c.pid ? tl('You pick your backpack up.') : TL`You pick up ${bag.by}'s backpack.`;
}

// ---------- drawn on the ground ----------
const live = new Map<string, THREE.Group>();
let clock = 0;
function model(b: Bag): THREE.Group {
  const g = new THREE.Group(), fill = sharedFill(), line = sharedLine(LINE);
  const box = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Mesh(geo, fill); m.position.set(x, y, z); g.add(m);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), line); e.position.copy(m.position); g.add(e);
  };
  box(0.5, 0.62, 0.3, 0, 0.31, 0); // the body, standing
  box(0.52, 0.16, 0.34, 0, 0.66, -0.01); // the flap
  box(0.36, 0.22, 0.08, 0, 0.25, 0.19); // the front pocket
  box(0.06, 0.5, 0.05, -0.15, 0.36, -0.18); box(0.06, 0.5, 0.05, 0.15, 0.36, -0.18); // the straps
  const tag = textSprite(TL`${b.by}'s backpack`, '#c8b77c'); tag.position.set(0, 1.05, 0); g.add(tag);
  g.rotation.y = b.yaw;
  scene.add(g);
  return g;
}
function drop(id: string) { const g = live.get(id); if (g) { scene.remove(g); live.delete(id); } }
/** Main loop: the backpacks lying in your place near you; records whose backpack is carried or gone are dropped. */
export function updateBags(dt: number) {
  if ((clock -= dt) > 0) return;
  clock = 0.4;
  const c = G.char, all = c.bags ?? {}, here = myLoc();
  for (const [id, g] of live) { const b = all[id]; if (!b || b.loc !== here || !bagFree(c.containers[id])) drop(id); else if (here === 'o') g.position.x = nearX(b.x, G.pos.x); }
  for (const b of Object.values(all)) {
    if (b.loc !== here || live.has(b.id) || !bagFree(c.containers[b.id])) continue;
    const x = here === 'o' ? nearX(b.x, G.pos.x) : b.x;
    if (Math.hypot(x - G.pos.x, b.z - G.pos.z) > BAG.show) continue;
    const g = model(b); g.position.set(x, b.y, b.z); live.set(b.id, g);
  }
}
/** The backpack lying by you, or null. */
export function nearBag(): Bag | null {
  const c = G.char, here = myLoc();
  let best: Bag | null = null, bd: number = BAG.reach;
  for (const b of Object.values(c.bags ?? {})) {
    if (b.loc !== here || !bagFree(c.containers[b.id])) continue;
    const x = here === 'o' ? nearX(b.x, G.pos.x) : b.x, d = Math.hypot(x - G.pos.x, b.z - G.pos.z);
    if (d < bd && Math.abs(b.y - G.pos.y) < 2.5) { bd = d; best = b; }
  }
  return best;
}
export const bagPrompt = (b: Bag) => (b.pid === G.char.pid ? tl('E — pick up your backpack') : TL`E — pick up ${b.by}'s backpack`);
/** E by a lying backpack. */
export function takeBag(b: Bag) { void pickUpBag(b).then((m) => { if (m) { logLine(m); showToast(m); } }); }
/** Leaving a place or a world: the drawn backpacks go (they come back from the save). */
export function clearBags() { for (const id of [...live.keys()]) drop(id); }
