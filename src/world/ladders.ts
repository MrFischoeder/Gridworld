// Ladders up the villages' watch towers (gen/village.ts `Ladder`): drawn with each village, E at the foot or at the
// top starts a climb. Climbing is not a teleport: the hero steps onto the ladder, pulls up rung by rung (hands
// reaching over each other, the view swaying with each pull), swings over onto the deck at the top, and the same
// way down. W / S turn the climb up or down, Space lets go. On a watch platform the deck is a floor (G.floor) and
// its rail keeps you from walking off; a stone tower's top is voxels, the rail is the same.
import * as THREE from 'three';
import { G } from '../game';
import { camera, lineMat } from './render';
import type { Ladder } from '../gen/village';
import type { PropBatch } from './props';

interface Placed extends Ladder { y0: number }
const ladders = new Map<number, Placed[]>();
const all = () => [...ladders.values()].flat();

/** A village was loaded / dropped: its ladders come and go with it. */
export function setLadders(id: number, list: Ladder[], y0: number) { ladders.set(id, list.map((l) => ({ ...l, y0 }))); }
export function dropLadders(id: number) { ladders.delete(id); }

const HALF = 0.28, RUNG = 0.3;
/** Two rails and rungs, from the ground to a metre over the deck (something to hold on to when stepping off). */
export function drawLadder(pb: PropBatch, l: Ladder, y0: number, color: number) {
  const tx = -l.nz, tz = l.nx, o = 0.06, top = y0 + l.top + 1.05;
  const at = (a: number, y: number, n = 0) => [l.x + tx * a + l.nx * (o + n), y, l.z + tz * a + l.nz * (o + n)];
  for (const a of [-HALF, HALF]) {
    const [x, , z] = at(a, 0);
    pb.box(x - 0.045, y0, z - 0.045, x + 0.045, top, z + 0.045, color);
  }
  for (let y = y0 + RUNG; y < y0 + l.top + 0.9; y += RUNG) pb.seg(color, at(-HALF, y), at(HALF, y));
  // the rails bend over the deck's edge
  for (const a of [-HALF, HALF]) pb.line(color, at(a, top), at(a, top, -0.35), at(a, y0 + l.top, -0.35));
}

// ---------- being near one ----------
const stand = (l: Placed) => ({ x: l.x + l.nx * 0.45, z: l.z + l.nz * 0.45 });
const deckSpot = (l: Placed) => ({ x: l.x - l.nx * 0.9, z: l.z - l.nz * 0.9 });
/** The ladder you could climb from here: `up` from its foot, or down from its top. */
export function nearLadder(): { l: Placed; up: boolean } | null {
  if (climb || G.char.loc !== 'overworld') return null;
  const p = G.pos;
  for (const l of all()) {
    const s = stand(l);
    if (Math.abs(p.y - l.y0) < 0.8 && Math.hypot(p.x - s.x, p.z - s.z) < 1.1) return { l, up: true };
    if (Math.abs(p.y - (l.y0 + l.top)) < 0.6 && Math.hypot(p.x - (l.x - l.nx * 0.5), p.z - (l.z - l.nz * 0.5)) < 0.9) return { l, up: false };
  }
  return null;
}
export const ladderPrompt = (n: { up: boolean }) => (n.up ? 'E — climb the ladder' : 'E — climb down the ladder');

// ---------- decks: a floor on stilts, and a rail round every top ----------
const inside = (r: Ladder['deck'], x: number, z: number, m = 0) => x > r.x0 + m && x < r.x1 - m && z > r.z0 + m && z < r.z1 - m;
/** The deck of a watch platform under (x, z) that you can step onto from height y. */
export function ladderFloor(x: number, y: number, z: number): number {
  let best = -Infinity;
  for (const l of all()) if (l.stilts && inside(l.deck, x, z)) { const top = l.y0 + l.top; if (y >= top - 0.6) best = Math.max(best, top); }
  return best;
}
/** The rail round a tower's top: standing up there you cannot walk off (only where the ladder comes up). */
export function ladderHit(x: number, y: number, z: number, r: number): boolean {
  if (climb) return false;
  for (const l of all()) {
    if (l.walk) continue; // the wall-walk has its own rail (world/walkways.ts)
    const top = l.y0 + l.top;
    if (y < top - 0.3 || y > top + 1.6 || !inside(l.deck, x, z, -r) || inside(l.deck, x, z, r)) continue;
    const along = (x - l.x) * -l.nz + (z - l.z) * l.nx, out = (x - l.x) * l.nx + (z - l.z) * l.nz;
    if (Math.abs(along) < HALF + 0.1 && out > -1) continue; // the gap at the ladder
    return true;
  }
  return false;
}

// ---------- climbing ----------
interface Climb { l: Placed; y: number; dir: 1 | -1; stage: 'on' | 'climb' | 'off'; t: number; from: { x: number; y: number; z: number }; phase: number }
let climb: Climb | null = null;
export const climbing = () => !!climb;
const SPEED = 2.1, ON = 0.4, OFF = 0.55;

// two hands in front of the view, gripping the rungs in turn
const hands = new THREE.Group();
for (const s of [-1, 1]) {
  const h = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.07, 0.04, 0.1)), lineMat(0x9dffb4));
  h.position.set(s * 0.17, -0.1, -0.36); hands.add(h);
}
hands.visible = false; camera.add(hands);

let onChange: () => void = () => {};
/** Weapons go away while climbing (world/weapons.ts refreshes on this). */
export function onClimbChange(f: () => void) { onChange = f; }

export function startClimb(n: { l: Placed; up: boolean }): string {
  const h = G.char.hands[0];
  if (h && !['blaster', 'blade'].includes(h.k)) return 'Your hands are full. Put it down first.';
  const p = G.pos;
  climb = { l: n.l, y: n.up ? n.l.y0 : n.l.y0 + n.l.top, dir: n.up ? 1 : -1, stage: 'on', t: 0, from: { x: p.x, y: p.y, z: p.z }, phase: 0 };
  G.vel.set(0, 0, 0); G.onGround = false; hands.visible = true; onChange();
  return '';
}
function stop(fall = false) {
  if (!climb) return;
  if (fall) { G.vel.set(climb.l.nx * 1.5, 0, climb.l.nz * 1.5); G.pos.x += climb.l.nx * 0.15; G.pos.z += climb.l.nz * 0.15; }
  climb = null; hands.visible = false; onChange();
}
/** Turn to face the ladder (the shortest way round). */
function faceLadder(l: Placed, k: number) {
  const want = Math.atan2(l.nx, l.nz);
  let d = want - G.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
  G.yaw += d * k;
}
const ease = (t: number) => t * t * (3 - 2 * t);
/** Instead of walking while on a ladder. Returns true while climbing. */
export function updateClimb(dt: number): boolean {
  const c = climb;
  if (!c) return false;
  const l = c.l, s = stand(l), p = G.pos, tx = -l.nz, tz = l.nx;
  if (G.char.loc !== 'overworld' || Math.hypot(p.x - s.x, p.z - s.z) > 3) { stop(); return false; } // moved away (travel, death)
  G.vel.set(0, 0, 0); G.activity = 3;
  if (c.stage === 'on') {
    // step onto the ladder: from the ground in front of it, or over the deck's edge from above
    c.t = Math.min(1, c.t + dt / ON);
    const e = ease(c.t), y = c.dir > 0 ? l.y0 + 0.25 * e : c.from.y - 0.35 * e;
    p.set(c.from.x + (s.x - c.from.x) * e, c.dir > 0 ? c.from.y + (y - c.from.y) * e : y, c.from.z + (s.z - c.from.z) * e);
    faceLadder(l, Math.min(1, dt * 9));
    if (c.dir < 0) G.pitch += (-0.55 - G.pitch) * Math.min(1, dt * 5);
    if (c.t >= 1) { c.stage = 'climb'; c.y = p.y; }
    animHands(c, 0);
    return true;
  }
  if (c.stage === 'climb') {
    if (G.keys.Space || G.touchJump) { stop(true); return false; }
    if (G.keys.KeyW && c.dir < 0) c.dir = 1;
    if (G.keys.KeyS && c.dir > 0) c.dir = -1;
    // pulls: quick through the middle of each rung, a moment's pause at the grip
    const beat = c.phase % Math.PI, pull = 0.35 + 1.3 * Math.sin(beat);
    const dy = c.dir * SPEED * pull * dt;
    c.y += dy; c.phase += Math.abs(dy) / RUNG * Math.PI;
    const sway = Math.sin(c.phase) * 0.035;
    p.set(s.x + tx * sway, c.y, s.z + tz * sway);
    faceLadder(l, Math.min(1, dt * 3));
    animHands(c, sway);
    if (c.dir > 0 && c.y >= l.y0 + l.top) { c.stage = 'off'; c.t = 0; c.from = { x: p.x, y: l.y0 + l.top, z: p.z }; }
    if (c.dir < 0 && c.y <= l.y0) { p.set(s.x, l.y0, s.z); G.onGround = true; stop(); }
    return true;
  }
  // swing over the edge onto the deck
  c.t = Math.min(1, c.t + dt / OFF);
  const e = ease(c.t), d = deckSpot(l);
  p.set(c.from.x + (d.x - c.from.x) * e, c.from.y + Math.sin(e * Math.PI) * 0.3, c.from.z + (d.z - c.from.z) * e);
  G.pitch += (0 - G.pitch) * Math.min(1, dt * 4);
  animHands(c, 0);
  if (c.t >= 1) { p.y = l.y0 + l.top; G.onGround = true; stop(); }
  return true;
}
function animHands(c: Climb, sway: number) {
  // hand over hand: one reaches up while the other holds, swapping every rung; both drop away stepping off
  const [a, b] = hands.children, k = c.stage === 'climb' ? 1 : c.stage === 'on' ? c.t : 1 - c.t;
  const r = Math.sin(c.phase / 2);
  a.position.set(-0.17 - sway, -0.35 + k * (0.2 + 0.14 * r), -0.36);
  b.position.set(0.17 - sway, -0.35 + k * (0.2 - 0.14 * r), -0.36);
  a.rotation.x = b.rotation.x = -G.pitch * 0.6;
}
/** Leaving the place (travel, death): off the ladder at once. */
export function cancelClimb() { stop(); }
