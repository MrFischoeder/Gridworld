// Bridges at the fords (gen/bridges.ts), built by the players. Every ford within reach is drawn: while it is a
// building site, survey stakes and a line across the river, a sign at both ends and, as the materials come in,
// the piles going up and a stack of logs; once built, a timber bridge (piles, beams, a planked deck ramping down
// to the banks, a rail each side). The deck is a floor for the player (`bridgeFloor` in G.floor) and the surface
// for vehicles and caravans (`bridgeDeck`); the rails collide (`bridgeHit` in G.obstacle). E at a sign opens the
// building window (ui/bridge.ts).
import * as THREE from 'three';
import { scene } from './render';
import { PropBatch } from './props';
import { textSprite } from './npc';
import { G } from '../game';
import { OW } from './overworld';
import { regionOf, nearX } from '../gen/regions';
import { regionFords, deckY, deckAt, bridgeLocal, bridgeProgress, planBridge, bridgeProblem, fordsNear, BRIDGE, type Ford } from '../gen/bridges';
import { driving } from './vehicles';
import { takeOne, saveChar } from '../character';
import { logLine, showToast } from '../ui/hud';

const WOOD = 0x2fe060, DARK = 0x1f9a44, STAKE = 0xffd060;
/** Fords are drawn within this distance (m) and dropped past `DROP`. */
const NEAR = 420, DROP = 520;
interface Live { f: Ford; g: THREE.Group; rev: string }
const live = new Map<string, Live>();
let scanT = 0;

/** A key of what is drawn: rebuilt when the bridge's progress moves on. */
const revOf = (f: Ford) => { const s = G.char.bridges[f.id]; return s?.done ? 'done' : 'p' + Math.floor(bridgeProgress(f, s) * 20); };
export const built = (f: Ford) => !!G.char.bridges[f.id]?.done;

/** Points in the bridge's frame (v across, y, s along the road) to world-relative coordinates of its group. */
function draw(f: Ford): THREE.Group {
  const pb = new PropBatch(), p = bridgeProgress(f, G.char.bridges[f.id]), done = built(f), hw = BRIDGE.w / 2, flat = f.half + BRIDGE.flat;
  const T = OW.terrain!, P = (v: number, y: number, s: number) => [v, y, s];
  const groundAt = (v: number, s: number) => T.heightAt(f.x + s * f.dx + v * f.dz, f.z + s * f.dz - v * f.dx); // v as the group turns it (see below)
  // the piles: pairs every 4 m under the flat part, rising from the bed; as the bridge goes up they appear one by one
  const piles: number[] = [];
  for (let s = -flat; s <= flat + 0.01; s += 4) piles.push(s);
  const shown = done ? piles.length : Math.round(piles.length * Math.min(1, p * 1.6));
  for (let i = 0; i < shown; i++) {
    const s = piles[i], top = done ? deckY(f, s) - 0.3 : f.level + BRIDGE.clear - 0.3;
    for (const v of [-hw + 0.4, hw - 0.4]) { const b = groundAt(v, s) - 0.4; pb.box(v - 0.18, b, s - 0.18, v + 0.18, top, s + 0.18, DARK); }
    if (done || p > 0.55) pb.box(-hw, top - 0.25, s - 0.2, hw, top, s + 0.2, DARK); // the cross beam
  }
  if (done) {
    // the deck: planked, 0.25 m thick, following its profile
    const n = Math.ceil(2 * f.end / 1.5), st = 2 * f.end / n;
    for (let i = 0; i < n; i++) {
      const s0 = -f.end + i * st, s1 = s0 + st, y0 = deckY(f, s0), y1 = deckY(f, s1);
      pb.face(P(-hw, y0, s0), P(hw, y0, s0), P(hw, y1, s1), P(-hw, y1, s1));
      pb.face(P(-hw, y0 - 0.25, s0), P(-hw, y0, s0), P(-hw, y1, s1), P(-hw, y1 - 0.25, s1));
      pb.face(P(hw, y0, s0), P(hw, y0 - 0.25, s0), P(hw, y1 - 0.25, s1), P(hw, y1, s1));
      pb.face(P(hw, y0 - 0.25, s0), P(-hw, y0 - 0.25, s0), P(-hw, y1 - 0.25, s1), P(hw, y1 - 0.25, s1));
      pb.seg(WOOD, P(-hw, y0 + 0.01, s0), P(hw, y0 + 0.01, s0)); // plank seams
      pb.seg(DARK, P(-hw, y0 + 0.01, s0 + st / 2), P(hw, (y0 + y1) / 2 + 0.01, s0 + st / 2));
      for (const v of [-hw, hw]) { pb.seg(WOOD, P(v, y0, s0), P(v, y1, s1)); pb.seg(DARK, P(v, y0 - 0.25, s0), P(v, y1 - 0.25, s1)); }
    }
    // the rails: posts every 2 m, a top rail and a mid rail, along the whole deck
    for (const v of [-hw + 0.1, hw - 0.1]) {
      let prev: number[] | null = null, prevM: number[] | null = null;
      for (let s = -f.end + 0.5; s <= f.end - 0.5 + 0.01; s += 2) {
        const y = deckY(f, s);
        pb.box(v - 0.08, y, s - 0.08, v + 0.08, y + 1.05, s + 0.08, DARK);
        const top = P(v, y + 1.05, s), mid = P(v, y + 0.55, s);
        if (prev && prevM) { pb.seg(WOOD, prev, top); pb.seg(DARK, prevM, mid); }
        prev = top; prevM = mid;
      }
    }
  } else {
    // the building site: stakes at the deck's corners and a line across the river between them
    for (const s of [-f.end, f.end]) for (const v of [-hw, hw]) { const y = groundAt(v, s); pb.box(v - 0.05, y - 0.1, s - 0.05, v + 0.05, y + 0.9, s + 0.05, STAKE); }
    for (const v of [-hw, hw]) pb.seg(STAKE, P(v, groundAt(v, -f.end) + 0.8, -f.end), P(v, groundAt(v, f.end) + 0.8, f.end));
    // the logs handed over, stacked by the near sign
    const logs = Math.round(p * 12);
    for (let i = 0; i < logs; i++) {
      const row = Math.floor(i / 4), k = i % 4, v = hw + 2.6 + k * 0.42 + row * 0.21, y = groundAt(hw + 3, -f.end - 1) + 0.2 + row * 0.38;
      pb.box(v - 0.18, y - 0.18, -f.end - 3, v + 0.18, y + 0.18, -f.end + 0.5, DARK);
    }
  }
  // the signs at both ends, beside the road
  const g = new THREE.Group();
  for (const s of [-f.end - 1, f.end + 1]) {
    const v = hw + 1.4, y = groundAt(v, s);
    pb.box(v - 0.07, y - 0.1, s - 0.07, v + 0.07, y + 2.1, s + 0.07, DARK);
    pb.box(v - 0.06, y + 1.4, s - 0.8, v + 0.06, y + 2.1, s + 0.8, DARK);
    const label = textSprite(done ? f.river.toUpperCase() : 'BRIDGE SITE · ' + f.river.toUpperCase(), done ? '#2ac8b0' : '#ffd060', 3.2);
    label.position.set(v, y + 2.55, s); g.add(label);
  }
  g.add(pb.build());
  g.position.set(f.x, 0, f.z); g.rotation.y = Math.atan2(f.dx, f.dz);
  // PropBatch coordinates are (v, y, s); the group turns s onto the road. With this turn local +x points to
  // (dz, -dx), the opposite of the v used by gen/bridges.ts, which the bridge's symmetry does not mind.
  return g;
}
function drop(l: Live) { scene.remove(l.g); l.g.traverse((o) => { (o as THREE.Mesh).geometry?.dispose(); }); }

/** Draw the fords around the player and redraw those whose bridge moved on (twice a second). */
export function updateBridges(dt: number) {
  if ((scanT -= dt) > 0) return;
  scanT = 0.5;
  const T = OW.terrain;
  if (!T || G.char.loc !== 'overworld') { clearBridges(); return; }
  const [rx, rz] = regionOf(G.pos.x, G.pos.z), seen = new Set<string>(), all: Ford[] = [];
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) all.push(...regionFords(T.world, rx + i, rz + j, (x, z) => T.heightAt(x, z)));
  for (const f of G.char.bridgeSites) all.push({ ...f, x: nearX(f.x, G.pos.x) }); // your own, on this copy of the planet
  for (const f of all) {
    if (Math.hypot(f.x - G.pos.x, f.z - G.pos.z) > NEAR) continue;
    seen.add(f.id);
    const l = live.get(f.id), rev = revOf(f);
    if (l && l.rev === rev && l.f.x === f.x) continue;
    if (l) drop(l);
    const g = draw(f); scene.add(g);
    live.set(f.id, { f, g, rev });
  }
  for (const [id, l] of live) if (!seen.has(id) && (Math.hypot(l.f.x - G.pos.x, l.f.z - G.pos.z) > DROP || (!l.f.road && !G.char.bridgeSites.some((f) => f.id === id)))) { drop(l); live.delete(id); } // far off, or your site given up
}
export function clearBridges() { for (const l of live.values()) drop(l); live.clear(); }
/** Redraw now (a bridge was finished). */
export function redrawBridges() { scanT = 0; }

/** The deck of a built bridge under (x, z), or null. */
export function bridgeDeck(x: number, z: number): number | null {
  for (const l of live.values()) if (built(l.f)) { const y = deckAt(l.f, x, z); if (y !== null) return y; }
  return null;
}
/** The deck as a floor for someone at height y: only from above it (you swim under a bridge). */
export function bridgeFloor(x: number, y: number, z: number): number {
  const d = bridgeDeck(x, z);
  return d !== null && y > d - 0.9 ? d : -Infinity;
}
/** The rails (the ends stay open for the road). */
export function bridgeHit(x: number, y: number, z: number, r: number): boolean {
  for (const l of live.values()) {
    if (!built(l.f)) continue;
    const [s, v] = bridgeLocal(l.f, x, z);
    if (Math.abs(s) > l.f.end - 0.4) continue;
    const d = deckY(l.f, s);
    if (y > d + 1.1 || y + 1.6 < d) continue;
    if (Math.abs(Math.abs(v) - (BRIDGE.w / 2 - 0.1)) < r + 0.1) return true;
  }
  return false;
}
/** The sign of a bridge site (or a built bridge) you stand by. */
export function nearBridgeSign(): Ford | null {
  if (G.char.loc !== 'overworld') return null;
  for (const l of live.values()) {
    const [s, v] = bridgeLocal(l.f, G.pos.x, G.pos.z);
    if (Math.abs(Math.abs(s) - (l.f.end + 1)) < 1.8 && Math.abs(v + BRIDGE.w / 2 + 1.4) < 1.8) return l.f; // the signs stand on the group's +x side, -v here
  }
  return null;
}

// ---------- staking out a bridge anywhere (a Bridge Kit) ----------
const OK = 0xe8fff0, BAD = 0xff5a3c;
const matA = new THREE.LineBasicMaterial({ color: OK, transparent: true, opacity: 0.9, depthTest: false, fog: false });
const matB = new THREE.LineBasicMaterial({ color: OK, transparent: true, opacity: 0.45, depthTest: false, fog: false });
let placing = false, preview: THREE.Group | null = null, plan: Ford | null = null, problem: string | null = null, last = { x: NaN, z: NaN, t: 0 };
export const isBridgePlacing = () => placing;
/** Use a Bridge Kit: start choosing where the bridge crosses. */
export function startBridgePlacing(): boolean {
  if (G.char.loc !== 'overworld' || !OW.terrain) { logLine('Bridges are built outdoors, over rivers.'); return false; }
  if (driving.v) { logLine('Get out of the vehicle first.'); return false; }
  placing = true; plan = null; problem = null; last = { x: NaN, z: NaN, t: 0 };
  logLine('Look at the river where the bridge should cross: click to stake out the site, right mouse button or Esc to cancel.');
  return true;
}
export function cancelBridgePlacing(quiet = false) {
  if (!placing) return;
  placing = false; plan = null;
  if (preview) { scene.remove(preview); preview.traverse((o) => (o as THREE.Line).geometry?.dispose()); preview = null; }
  if (!quiet) logLine('You put the Bridge Kit away.');
}
export const bridgePlacingHint = () => (!placing ? null : problem ?? 'Click — stake out a bridge here · right mouse / Esc — cancel');
export const bridgePlacingOk = () => !!plan && !problem;
/** Stake out the site where the hologram stands. */
export function confirmBridgePlacing() {
  if (!placing) return;
  if (!plan || problem) { logLine(problem ?? 'Look at a river to bridge it'); return; }
  if (!takeOne('bridgekit')) { cancelBridgePlacing(true); return; }
  const f: Ford = { ...plan, id: `bridge:own:${G.char.pid}:${Math.round(G.char.time)}:${G.char.bridgeSites.length}` };
  G.char.bridgeSites.push(f); G.char.bridges[f.id] = { given: {} }; saveChar();
  cancelBridgePlacing(true); scanT = 0;
  showToast('Bridge site staked out');
  logLine(`The site is staked out over the ${f.river}: ${Math.round(2 * f.end)} m of deck. Bring the materials to its sign.`);
}
/** The ground point the player looks at (up to 70 m away). */
function aim(): [number, number] {
  const T = OW.terrain!, cp = Math.cos(G.pitch), dx = -Math.sin(G.yaw) * cp, dy = Math.sin(G.pitch), dz = -Math.cos(G.yaw) * cp, y0 = G.pos.y + 1.6;
  for (let t = 2; t <= 70; t += 0.5) { const x = G.pos.x + dx * t, z = G.pos.z + dz * t; if (y0 + dy * t <= Math.max(T.heightAt(x, z), T.water(x, z)?.level ?? -Infinity)) return [x, z]; }
  const h = Math.hypot(dx, dz) || 1; return [G.pos.x + dx / h * 30, G.pos.z + dz / h * 30];
}
/** Every frame while staking out: follow the view, plan the bridge, check it, redraw the hologram when it moved. */
export function updateBridgePlacing() {
  if (!placing) return;
  const T = OW.terrain;
  if (G.char.loc !== 'overworld' || driving.v || !T) { cancelBridgePlacing(true); return; }
  const now = performance.now(), [x, z] = aim();
  if (Math.hypot(x - last.x, z - last.z) < 0.75 || now - last.t < 120) return;
  last = { x, z, t: now };
  const ground = (px: number, pz: number) => T.heightAt(px, pz);
  plan = planBridge(T.world, x, z, G.pos.x, G.pos.z, ground);
  const others = plan ? [...fordsNear(T.world, plan.x, plan.z, 200, ground), ...G.char.bridgeSites] : [];
  problem = bridgeProblem(T.world, plan, others);
  if (!preview) { preview = new THREE.Group(); preview.renderOrder = 10; scene.add(preview); }
  preview.traverse((o) => (o as THREE.Line).geometry?.dispose()); preview.clear();
  if (!plan) return;
  const f = plan, hw = BRIDGE.w / 2, a: number[] = [], b: number[] = [];
  const W = (s: number, v: number, y: number) => [f.x + s * f.dx - v * f.dz, y, f.z + s * f.dz + v * f.dx];
  for (let s = -f.end; s < f.end - 0.01; s += 2) for (const v of [-hw, hw]) a.push(...W(s, v, deckY(f, s) + 0.05), ...W(s + 2, v, deckY(f, s + 2) + 0.05));
  for (let s = -f.end; s <= f.end + 0.01; s += 4) b.push(...W(s, -hw, deckY(f, s) + 0.05), ...W(s, hw, deckY(f, s) + 0.05));
  for (let s = -(f.half + BRIDGE.flat); s <= f.half + BRIDGE.flat + 0.01; s += 4) for (const v of [-hw + 0.4, hw - 0.4]) { const [px, , pz] = W(s, v, 0); b.push(...W(s, v, T.heightAt(px, pz)), ...W(s, v, deckY(f, s))); }
  for (const s of [-f.end, f.end]) for (const v of [-hw, hw]) { const [px, , pz] = W(s, v, 0), g = T.heightAt(px, pz); a.push(...W(s, v, g), ...W(s, v, g + 1.2)); }
  for (const [pts, m] of [[a, matA], [b, matB]] as const) {
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const l = new THREE.LineSegments(geo, m); l.renderOrder = 10; l.frustumCulled = false; preview.add(l);
  }
  matA.color.setHex(problem ? BAD : OK); matB.color.setHex(problem ? BAD : OK);
}
