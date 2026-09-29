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
import { regionOf } from '../gen/regions';
import { regionFords, deckY, deckAt, bridgeLocal, bridgeProgress, BRIDGE, type Ford } from '../gen/bridges';

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
  const [rx, rz] = regionOf(G.pos.x, G.pos.z), seen = new Set<string>();
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) for (const f of regionFords(T.world, rx + i, rz + j, (x, z) => T.heightAt(x, z))) {
    if (Math.hypot(f.x - G.pos.x, f.z - G.pos.z) > NEAR) continue;
    seen.add(f.id);
    const l = live.get(f.id), rev = revOf(f);
    if (l && l.rev === rev && l.f.x === f.x) continue;
    if (l) drop(l);
    const g = draw(f); scene.add(g);
    live.set(f.id, { f, g, rev });
  }
  for (const [id, l] of live) if (!seen.has(id) && Math.hypot(l.f.x - G.pos.x, l.f.z - G.pos.z) > DROP) { drop(l); live.delete(id); }
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
