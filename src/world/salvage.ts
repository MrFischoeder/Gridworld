// (0.272) Stripping machines for parts with a wrench (gen/salvage.ts): the reactor drums, drive cabinets and laboratory
// benches of a crashed freighter, and the crumpled engine of your own ship at the crash site. Carry a wrench, stand by
// the machine and hold E: a part comes off every few seconds and its salvage lies at your feet, until the machine is
// stripped bare. Nothing grows back. MP: the parts taken are the shared `Char.salvage` (a claim keeps two heroes off
// one machine), the yields are hashed, so every game agrees; the models show the parts left on every game.
import * as THREE from 'three';
import { G } from '../game';
import { hasItem, saveChar } from '../character';
import { ITEMS } from '../data/items';
import { SALVAGE, SALVAGE_NAME, salvageYield, partsLeft, workingOn, shipSalvage, kestrelKey, wreckKey, type SalvageKind } from '../gen/salvage';
import type { DungeonMap } from '../gen/dungeon';
import { PropBatch } from './props';
import { scene } from './render';
import { spendStamina, burn } from './survival';
import { setHandWork } from './gather';
import { dropAtFeet } from './drops';
import { play } from './sound';
import { kestrelEngine } from './crashpod';
import { logLine, showToast } from '../ui/hud';
import { tl, TL } from '../i18n';

interface Spot { key: string; k: SalvageKind; x: number; y: number; z: number; nx: number; nz: number; reach: number }
interface Drawn { g: THREE.Group; n: number }
let spots: Spot[] = [], drawn = new Map<string, Drawn>(), root: THREE.Group | null = null;
let t = 0, beat = 0, beatClaim = 0, cur: Spot | null = null, redrawT = 0;

const AMBER = 0xffb347, LIT = 0x5cc8ff, DARK = 0x3f5a50, STEEL = 0xa8e8ff, GLASS = 0x9dffe0;

/** The machines of the wreck just loaded (world/level.ts loadDungeon, after the voxels are built). */
export function setWreckSalvage(map: DungeonMap, ruinId: number, free: (x: number, z: number) => boolean) {
  clearSalvage();
  spots = shipSalvage(map, free).map((s, i) => ({ key: wreckKey(ruinId, i), k: s.k, x: s.x, y: 0, z: s.z, nx: s.nx, nz: s.nz, reach: SALVAGE.reach }));
  root = new THREE.Group(); scene.add(root);
  for (const s of spots) draw(s);
}
export function clearSalvage() {
  stop();
  if (root) { scene.remove(root); root.traverse((o) => (o as THREE.Mesh).geometry?.dispose()); }
  root = null; spots = []; drawn.clear();
}

/** A machine's model, by the parts still in it: lit strips for the parts left, dark ones and an open panel for the rest. */
function model(s: Spot, left: number): THREE.Group {
  const pb = new PropBatch(), total = SALVAGE.parts[s.k];
  const bars = (x0: number, x1: number, y: number, z: number) => { for (let i = 0; i < total; i++) { const a = x0 + (x1 - x0) * (i + 0.15) / total, b = x0 + (x1 - x0) * (i + 0.85) / total; pb.seg(i < left ? LIT : DARK, [a, y, z], [b, y, z]); } };
  // model frame: x across, z towards the worker (the machine's back at z < 0), y up
  if (s.k === 'reactor') { // a service panel on the drum's front, cables
    pb.box(-1.1, 0.4, -0.6, 1.1, 3.4, -0.5, AMBER);
    pb.seg(AMBER, [-0.9, 3.0, -0.48], [0.9, 3.0, -0.48]); pb.seg(AMBER, [-0.9, 0.7, -0.48], [0.9, 0.7, -0.48]);
    bars(-0.8, 0.8, 2.6, -0.47);
    for (const x of [-0.7, 0, 0.7]) pb.seg(left ? STEEL : DARK, [x, 1.2, -0.47], [x, 2.2, -0.47]);
    if (left < total) pb.seg(DARK, [1.1, 3.4, -0.5], [1.6, 2.4, 0.1]); // a panel hanging off
  } else if (s.k === 'drive') { // a tall cabinet against the stern wall with cooling ribs
    pb.box(-0.9, 0, -0.9, 0.9, 2.6, -0.35, AMBER);
    for (let y = 0.5; y < 2.3; y += 0.3) pb.seg(STEEL, [-0.7, y, -0.34], [0.7, y, -0.34]);
    bars(-0.7, 0.7, 2.35, -0.33);
    pb.seg(AMBER, [-0.4, 2.6, -0.6], [-0.4, 3.2, -0.6]); pb.seg(AMBER, [0.4, 2.6, -0.6], [0.4, 3.2, -0.6]);
  } else if (s.k === 'lab') { // a bench with glass cylinders and a screen
    pb.box(-1.4, 0, -1.0, 1.4, 0.9, -0.4, STEEL);
    for (let i = 0; i < total; i++) {
      const x = -0.9 + i * 0.9, c = i < left ? GLASS : DARK;
      pb.seg(c, [x - 0.15, 0.9, -0.7], [x - 0.15, 1.5, -0.7]); pb.seg(c, [x + 0.15, 0.9, -0.7], [x + 0.15, 1.5, -0.7]); pb.seg(c, [x - 0.15, 1.5, -0.7], [x + 0.15, 1.5, -0.7]);
    }
    pb.seg(STEEL, [-1.2, 1.7, -0.95], [1.2, 1.7, -0.95]); pb.seg(STEEL, [-1.2, 2.4, -0.95], [1.2, 2.4, -0.95]);
    bars(-1.0, 1.0, 2.05, -0.94);
  } else { // the Kestrel: a hatch on the crumpled nacelle, the parts' strips beside it
    bars(-0.5, 0.5, 2.0, 0.6);
    pb.seg(AMBER, [-0.6, 1.7, 0.6], [0.6, 1.7, 0.6]); pb.seg(AMBER, [-0.6, 2.3, 0.6], [0.6, 2.3, 0.6]);
  }
  const g = pb.build();
  g.position.set(s.x, s.y, s.z); g.rotation.y = Math.atan2(s.nx, s.nz);
  return g;
}
function draw(s: Spot) {
  const left = partsLeft(s.k, G.char.salvage?.[s.key]), d = drawn.get(s.key);
  if (d && d.n === left) return;
  if (d) { d.g.parent?.remove(d.g); d.g.traverse((o) => (o as THREE.Mesh).geometry?.dispose()); }
  const g = model(s, left);
  (root ?? scene).add(g); drawn.set(s.key, { g, n: left });
}

/** The Kestrel's engine while you are on the surface near the crash site. */
function kestrelSpot(): Spot | null {
  const e = G.char.loc === 'overworld' ? kestrelEngine() : null;
  return e && Math.abs(e.x - G.pos.x) < 30 && Math.abs(e.z - G.pos.z) < 30 ? { key: kestrelKey, k: 'kestrel', ...e, reach: 3 } : null;
}
let kroot: THREE.Group | null = null;
function syncKestrel(k: Spot | null) {
  if (!k) { if (kroot) { scene.remove(kroot); kroot = null; drawn.delete(kestrelKey); } return; }
  if (!kroot) { kroot = new THREE.Group(); scene.add(kroot); }
  const left = partsLeft('kestrel', G.char.salvage?.[kestrelKey]), d = drawn.get(kestrelKey);
  if (d && d.n === left) return;
  if (d) { kroot.remove(d.g); d.g.traverse((o) => (o as THREE.Mesh).geometry?.dispose()); }
  const g = model(k, left); kroot.add(g); drawn.set(kestrelKey, { g, n: left });
}

/** The machine in reach, if any. */
export function salvageTarget(): Spot | null {
  if (!G.playing) return null;
  const list = G.char.loc === 'dungeon' ? spots : [];
  const k = kestrelSpot(); const all = k ? [...list, k] : list;
  let best: Spot | null = null, bd = Infinity;
  for (const s of all) {
    const d = Math.hypot(s.x - G.pos.x, s.z - G.pos.z);
    if (d < s.reach && d < bd && Math.abs(G.pos.y - s.y) < 2.5) { bd = d; best = s; }
  }
  return best;
}
const nameOf = (s: Spot) => SALVAGE_NAME[s.k];
export function salvagePrompt(s: Spot): string {
  const c = G.char, st = c.salvage?.[s.key], left = partsLeft(s.k, st), total = SALVAGE.parts[s.k];
  if (!left) return TL`The ${nameOf(s)} is stripped bare: nothing more to take.`;
  const who = workingOn(st, c.pid, c.time);
  if (who) return TL`${who} is taking the ${nameOf(s)} apart.`;
  if (!hasItem('wrench')) return TL`The ${nameOf(s)}: a wrench would strip it for parts (${left} of ${total} left).`;
  if (t > 0 && cur?.key === s.key) { const f = Math.min(1, t / SALVAGE.secs[s.k]), k = Math.round(f * 10); return `${tl('Unbolting')} ${'▮'.repeat(k)}${'▯'.repeat(10 - k)} ${Math.round(f * 100)}%`; }
  return TL`Hold E — strip the ${nameOf(s)} for parts (${left} of ${total} left)`;
}
/** Does E belong to the machine (so the press opens nothing else)? */
export const salvageTakesE = (s: Spot | null) => !!s && hasItem('wrench') && partsLeft(s.k, G.char.salvage?.[s.key]) > 0;

function release() {
  const c = G.char, st = cur ? c.salvage?.[cur.key] : undefined;
  if (st && st.by === c.pid) { delete st.by; delete st.nm; delete st.t; }
}
function stop() { if (cur) release(); t = 0; beat = 0; beatClaim = 0; cur = null; setHandWork(null); }

/** Every frame (world/interact.ts): E held by a machine with a wrench carried strips it, a part at a time. */
export function updateSalvage(dt: number, s: Spot | null) {
  redrawT -= dt;
  if (redrawT <= 0) { redrawT = 0.5; for (const x of spots) draw(x); syncKestrel(kestrelSpot()); }
  const c = G.char, down = !!G.keys.KeyE && G.playing && !G.dlgOpen;
  const st = s ? c.salvage?.[s.key] : undefined;
  if (!s || !down || !hasItem('wrench') || !partsLeft(s.k, st) || workingOn(st, c.pid, c.time)) { if (cur) stop(); return; }
  if (cur?.key !== s.key) { if (cur) stop(); t = 0; }
  cur = s;
  c.salvage ??= {};
  const mine = (c.salvage[s.key] ??= { n: 0 });
  beatClaim -= dt;
  if (beatClaim <= 0) { beatClaim = 3; mine.by = c.pid; mine.nm = c.name || tl('Someone'); mine.t = c.time; }
  t += dt; beat += dt;
  setHandWork('wrench', t * 1.6);
  if (beat > 0.75) { beat = 0; play('hammer', { vol: 0.35, far: 30, share: 25 }); }
  if (t < SALVAGE.secs[s.k]) return;
  t = 0;
  if (!spendStamina(SALVAGE.stamina)) { logLine(tl('Too tired to work on. Catch your breath.')); stop(); return; }
  burn(SALVAGE.kcal);
  const piece = mine.n;
  mine.n = piece + 1; mine.t = c.time;
  const got = salvageYield(c.world, s.key, s.k, piece);
  for (const [k, n] of got) dropAtFeet({ k, n });
  const words = got.map(([k, n]) => `${n} ${ITEMS[k].name}`).join(', ');
  showToast(words ? '+' + words : tl('Nothing worth keeping came off.'));
  logLine(TL`You unbolt a part of the ${nameOf(s)}: ${words || tl('nothing worth keeping')}.`);
  if (!partsLeft(s.k, mine)) { logLine(TL`The ${nameOf(s)} is stripped bare.`); stop(); }
  if (s.k === 'kestrel') syncKestrel(s); else draw(s);
  saveChar();
}
/** The machines of the place loaded (tests, debugging). */
export const salvageSpots = () => spots;
