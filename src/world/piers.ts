// Piers on the sea coast (gen/piers.ts), staked out with a Pier Kit and built by the players. Drawn near the
// player: while building, stakes at the corners, a line out over the water, the piles going up with the work and a
// stack of logs by the sign; once built, a planked deck on piles ramping up from the beach, a wider head with
// bollards, a lamp and a crate for goods. The deck is a floor (`pierFloor` in G.floor) and a surface for vehicles
// (`pierDeck`); the crate and the lamp collide (`pierHit`). E at the sign opens the building window (ui/pier.ts),
// E at the crate of a finished pier opens it (the transfer window).
import * as THREE from 'three';
import { scene } from './render';
import { PropBatch } from './props';
import { textSprite } from './npc';
import { G } from '../game';
import { OW } from './overworld';
import { nearX } from '../gen/regions';
import { SEA } from '../gen/seas';
import { PIER, pierY, pierAt, pierLocal, pierProgress, planPier, type Pier } from '../gen/piers';
import { driving } from './vehicles';
import { takeOne, saveChar } from '../character';
import { logLine, showToast } from '../ui/hud';
import type { Container } from '../save';

const WOOD = 0x2fe060, DARK = 0x1f9a44, STAKE = 0xffd060, GOLD = 0xffd060;
const NEAR = 420, DROP = 520;
interface Live { p: Pier; g: THREE.Group; rev: string }
const live = new Map<string, Live>();
let scanT = 0;
const revOf = (p: Pier) => (p.done ? 'done' : 'p' + Math.floor(pierProgress(p) * 20));
/** On the group's +x side (gen's −v): the sign on the beach and the crate on the head. */
const SIGN = { s: -1.5, v: PIER.w / 2 + 1.2 }, CRATE = { s: -1.6, v: PIER.headW / 2 - 1.1 };

function draw(p: Pier): THREE.Group {
  const pb = new PropBatch(), prog = pierProgress(p), done = !!p.done, T = OW.terrain!, P = (v: number, y: number, s: number) => [v, y, s];
  const groundAt = (v: number, s: number) => T.heightAt(p.x + s * p.dx + v * p.dz, p.z + s * p.dz - v * p.dx);
  const headAt = p.len - PIER.head, half = (s: number) => (s > headAt ? PIER.headW : PIER.w) / 2, top = SEA.level + PIER.clear;
  // piles: pairs every 3 m out from the end of the ramp, and a row across the head's far edge
  const piles: [number, number][] = [];
  for (let s = PIER.ramp - 1; s <= p.len - 0.3; s += 3) for (const v of [-half(s) + 0.3, half(s) - 0.3]) piles.push([s, v]);
  for (const v of [-1, 0, 1]) piles.push([p.len - 0.3, v * (PIER.headW / 2 - 0.3)]);
  const shown = done ? piles.length : Math.round(piles.length * Math.min(1, prog * 1.6));
  for (let i = 0; i < shown; i++) { const [s, v] = piles[i]; pb.box(v - 0.16, groundAt(v, s) - 0.5, s - 0.16, v + 0.16, top - 0.2, s + 0.16, DARK); }
  if (done) {
    // the deck, planked, 0.2 m thick
    const n = Math.ceil(p.len / 1.2), st = p.len / n;
    for (let i = 0; i < n; i++) {
      const s0 = i * st, s1 = s0 + st, y0 = pierY(p, s0), y1 = pierY(p, s1), h = half((s0 + s1) / 2);
      pb.face(P(-h, y0, s0), P(h, y0, s0), P(h, y1, s1), P(-h, y1, s1));
      pb.face(P(-h, y0 - 0.2, s0), P(-h, y0, s0), P(-h, y1, s1), P(-h, y1 - 0.2, s1));
      pb.face(P(h, y0, s0), P(h, y0 - 0.2, s0), P(h, y1 - 0.2, s1), P(h, y1, s1));
      pb.face(P(h, y0 - 0.2, s0), P(-h, y0 - 0.2, s0), P(-h, y1 - 0.2, s1), P(h, y1 - 0.2, s1));
      pb.seg(WOOD, P(-h, y0 + 0.01, s0), P(h, y0 + 0.01, s0));
      for (const v of [-h, h]) pb.seg(WOOD, P(v, y0, s0), P(v, y1, s1));
    }
    pb.face(P(-PIER.headW / 2, top, p.len), P(PIER.headW / 2, top, p.len), P(PIER.headW / 2, top - 0.2, p.len), P(-PIER.headW / 2, top - 0.2, p.len));
    // bollards at the head's corners, a lamp and the crate
    for (const s of [headAt + 0.5, p.len - 0.5]) for (const v of [-PIER.headW / 2 + 0.35, PIER.headW / 2 - 0.35]) pb.box(v - 0.14, top, s - 0.14, v + 0.14, top + 0.55, s + 0.14, DARK);
    const lv = -PIER.headW / 2 + 0.35, ls = p.len - 2.5;
    pb.box(lv - 0.07, top, ls - 0.07, lv + 0.07, top + 3.2, ls + 0.07, DARK);
    pb.box(lv - 0.22, top + 3.2, ls - 0.22, lv + 0.22, top + 3.6, ls + 0.22, GOLD);
    const cs = p.len + CRATE.s, cv = CRATE.v;
    pb.box(cv - 0.6, top, cs - 0.45, cv + 0.6, top + 0.9, cs + 0.45, GOLD);
    pb.seg(GOLD, P(cv - 0.6, top + 0.65, cs - 0.45), P(cv + 0.6, top + 0.65, cs - 0.45));
  } else {
    // stakes at the corners of the deck and the head, a line out over the water
    const corners: [number, number][] = [[0, -PIER.w / 2], [0, PIER.w / 2], [p.len, -PIER.headW / 2], [p.len, PIER.headW / 2]];
    for (const [s, v] of corners) { const y = Math.max(groundAt(v, s), SEA.level); pb.box(v - 0.05, y - 0.1, s - 0.05, v + 0.05, y + 1.1, s + 0.05, STAKE); }
    for (const v of [-PIER.w / 2, PIER.w / 2]) pb.seg(STAKE, P(v, groundAt(v, 0) + 0.9, 0), P(v * PIER.headW / PIER.w, SEA.level + 1, p.len));
    const logs = Math.round(prog * 12);
    for (let i = 0; i < logs; i++) {
      const row = Math.floor(i / 4), k = i % 4, v = SIGN.v + 1.2 + k * 0.42 + row * 0.21, y = groundAt(SIGN.v + 1.6, -3) + 0.2 + row * 0.38;
      pb.box(v - 0.18, y - 0.18, -5, v + 0.18, y + 0.18, -1.5, DARK);
    }
  }
  // the sign on the beach
  const g = new THREE.Group(), y = groundAt(SIGN.v, SIGN.s);
  pb.box(SIGN.v - 0.07, y - 0.1, SIGN.s - 0.07, SIGN.v + 0.07, y + 2.1, SIGN.s + 0.07, DARK);
  pb.box(SIGN.v - 0.06, y + 1.4, SIGN.s - 0.8, SIGN.v + 0.06, y + 2.1, SIGN.s + 0.8, DARK);
  const label = textSprite(done ? 'PIER' : 'PIER SITE', done ? '#2ac8b0' : '#ffd060', 2.2);
  label.position.set(SIGN.v, y + 2.55, SIGN.s); g.add(label);
  g.add(pb.build());
  g.position.set(p.x, 0, p.z); g.rotation.y = Math.atan2(p.dx, p.dz); // local z = out to sea, local x = gen's −v
  return g;
}
function drop(l: Live) { scene.remove(l.g); l.g.traverse((o) => { (o as THREE.Mesh).geometry?.dispose(); }); }

/** Your piers on the player's copy of the planet. */
const mine = (): Pier[] => G.char.piers.map((p) => ({ ...p, x: nearX(p.x, G.pos.x) }));
/** Draw the piers around the player, redraw those that moved on (twice a second). */
export function updatePiers(dt: number) {
  if ((scanT -= dt) > 0) return;
  scanT = 0.5;
  if (!OW.terrain || G.char.loc !== 'overworld') { clearPiers(); return; }
  const seen = new Set<string>();
  for (const p of mine()) {
    if (Math.hypot(p.x - G.pos.x, p.z - G.pos.z) > NEAR) continue;
    seen.add(p.id);
    const l = live.get(p.id), rev = revOf(p);
    if (l && l.rev === rev && l.p.x === p.x) { l.p = p; continue; }
    if (l) drop(l);
    const g = draw(p); scene.add(g);
    live.set(p.id, { p, g, rev });
  }
  for (const [id, l] of live) if (!seen.has(id) || Math.hypot(l.p.x - G.pos.x, l.p.z - G.pos.z) > DROP) { drop(l); live.delete(id); }
}
export function clearPiers() { for (const l of live.values()) drop(l); live.clear(); }
export function redrawPiers() { scanT = 0; }

/** The deck of a built pier under (x, z), or null. */
export function pierDeck(x: number, z: number): number | null {
  for (const l of live.values()) if (l.p.done) { const y = pierAt(l.p, x, z); if (y !== null) return y; }
  return null;
}
export function pierFloor(x: number, y: number, z: number): number {
  const d = pierDeck(x, z);
  return d !== null && y > d - 0.9 ? d : -Infinity;
}
/** The crate and the lamp post on a pier's head. */
export function pierHit(x: number, y: number, z: number, r: number): boolean {
  for (const l of live.values()) {
    if (!l.p.done) continue;
    const [s, v] = pierLocal(l.p, x, z), top = SEA.level + PIER.clear;
    if (y > top + 0.9 || y + 1.6 < top) continue;
    if (Math.abs(s - (l.p.len + CRATE.s)) < 0.45 + r && Math.abs(-v - CRATE.v) < 0.6 + r) return true;
    if (Math.abs(s - (l.p.len - 2.5)) < 0.07 + r && Math.abs(-v - (-PIER.headW / 2 + 0.35)) < 0.07 + r) return true;
  }
  return false;
}
/** The pier whose sign you stand by. */
export function nearPierSign(): Pier | null {
  if (G.char.loc !== 'overworld') return null;
  for (const l of live.values()) { const [s, v] = pierLocal(l.p, G.pos.x, G.pos.z); if (Math.hypot(s - SIGN.s, -v - SIGN.v) < 1.8) return l.p; }
  return null;
}
/** The crate of a finished pier you stand by. */
export function nearPierCrate(): Pier | null {
  if (G.char.loc !== 'overworld') return null;
  for (const l of live.values()) {
    if (!l.p.done) continue;
    const [s, v] = pierLocal(l.p, G.pos.x, G.pos.z);
    if (Math.hypot(s - (l.p.len + CRATE.s), -v - CRATE.v) < 1.6) return l.p;
  }
  return null;
}
/** A pier's crate (`char.containers[<pier id>]`, 'pier:...'). */
export function pierCrate(p: Pier): Container {
  const box = (G.char.containers[p.id] ??= { items: Array(PIER.crate).fill(null), gold: 0 });
  while (box.items.length < PIER.crate) box.items.push(null);
  return box;
}
/** The saved pier (not the copy shifted to the player's side of the planet). */
export const savedPier = (id: string) => G.char.piers.find((p) => p.id === id);

// ---------- staking out a pier (a Pier Kit) ----------
const OK = 0xe8fff0, BAD = 0xff5a3c;
const matA = new THREE.LineBasicMaterial({ color: OK, transparent: true, opacity: 0.9, depthTest: false, fog: false });
const matB = new THREE.LineBasicMaterial({ color: OK, transparent: true, opacity: 0.45, depthTest: false, fog: false });
let placing = false, preview: THREE.Group | null = null, plan: Pier | null = null, problem: string | null = null, lastT = 0, lastYaw = NaN, lastX = NaN;
export const isPierPlacing = () => placing;
export function startPierPlacing(): boolean {
  if (G.char.loc !== 'overworld' || !OW.terrain) { logLine('Piers are built outdoors, on the sea coast.'); return false; }
  if (driving.v) { logLine('Get out of the vehicle first.'); return false; }
  placing = true; plan = null; problem = null; lastT = 0; lastYaw = NaN;
  logLine('Stand on the beach and look out to sea: click to stake out the pier, right mouse button or Esc to cancel.');
  return true;
}
export function cancelPierPlacing(quiet = false) {
  if (!placing) return;
  placing = false; plan = null;
  if (preview) { scene.remove(preview); preview.traverse((o) => (o as THREE.Line).geometry?.dispose()); preview = null; }
  if (!quiet) logLine('You put the Pier Kit away.');
}
export const pierPlacingHint = () => (!placing ? null : problem ?? 'Click — stake out a pier here · right mouse / Esc — cancel');
export const pierPlacingOk = () => !!plan && !problem;
export function confirmPierPlacing() {
  if (!placing) return;
  if (!plan || problem) { logLine(problem ?? 'Look out to sea to build a pier'); return; }
  if (!takeOne('pierkit')) { cancelPierPlacing(true); return; }
  const p: Pier = { ...plan, id: `pier:${G.char.pid}:${Math.round(G.char.time)}:${G.char.piers.length}`, given: {} };
  G.char.piers.push(p); saveChar();
  cancelPierPlacing(true); scanT = 0;
  showToast('Pier staked out');
  logLine(`The pier is staked out: ${Math.round(p.len)} m out to ${PIER.depth} m of water. Bring the materials to its sign on the beach.`);
}
/** Every frame while staking out: plan from where you stand and look, redraw the hologram when that changed. */
export function updatePierPlacing() {
  if (!placing) return;
  const T = OW.terrain;
  if (G.char.loc !== 'overworld' || driving.v || !T) { cancelPierPlacing(true); return; }
  const now = performance.now();
  if (now - lastT < 150 || (Math.abs(G.yaw - lastYaw) < 0.02 && Math.abs(G.pos.x - lastX) < 0.3)) return;
  lastT = now; lastYaw = G.yaw; lastX = G.pos.x;
  const r = planPier(T.world, G.pos.x, G.pos.z, -Math.sin(G.yaw), -Math.cos(G.yaw), (x, z) => T.heightAt(x, z), (x, z) => T.water(x, z), mine());
  plan = r.p; problem = r.problem;
  if (!preview) { preview = new THREE.Group(); preview.renderOrder = 10; scene.add(preview); }
  preview.traverse((o) => (o as THREE.Line).geometry?.dispose()); preview.clear();
  if (!plan) return;
  const p = plan, a: number[] = [], b: number[] = [];
  const W = (s: number, v: number, y: number) => [p.x + s * p.dx - v * p.dz, y, p.z + s * p.dz + v * p.dx];
  const hw = (s: number) => (s > p.len - PIER.head ? PIER.headW : PIER.w) / 2;
  for (let s = 0; s < p.len - 0.01; s += 1) for (const sg of [-1, 1]) a.push(...W(s, sg * hw(s + 0.5), pierY(p, s) + 0.05), ...W(s + 1, sg * hw(s + 0.5), pierY(p, s + 1) + 0.05));
  a.push(...W(p.len, -PIER.headW / 2, pierY(p, p.len) + 0.05), ...W(p.len, PIER.headW / 2, pierY(p, p.len) + 0.05), ...W(p.len - PIER.head, -PIER.headW / 2, pierY(p, p.len) + 0.05), ...W(p.len - PIER.head, PIER.headW / 2, pierY(p, p.len) + 0.05));
  for (let s = 0; s <= p.len + 0.01; s += 3) b.push(...W(s, -hw(s), pierY(p, s) + 0.05), ...W(s, hw(s), pierY(p, s) + 0.05));
  for (let s = PIER.ramp - 1; s <= p.len; s += 3) for (const sg of [-1, 1]) { const [px, , pz] = W(s, sg * (hw(s) - 0.3), 0); b.push(...W(s, sg * (hw(s) - 0.3), T.heightAt(px, pz)), ...W(s, sg * (hw(s) - 0.3), pierY(p, s))); }
  for (const [pts, m] of [[a, matA], [b, matB]] as const) {
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const l = new THREE.LineSegments(geo, m); l.renderOrder = 10; l.frustumCulled = false; preview.add(l);
  }
  matA.color.setHex(problem ? BAD : OK); matB.color.setHex(problem ? BAD : OK);
}
