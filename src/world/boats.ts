// Your boats (gen/boats.ts) on the water: drawn near you, rowed from the thwart. E beside a boat gets in, E aboard
// steps out (onto a pier, a bank or the beach nearby; with nowhere dry, a second E drops you into the water);
// F opens the hold (beside it or aboard); V switches between the seat and a view from behind.
// Rowing: W pulls, S backs water, A/D turn (the boat turns on the spot too, one oar against the other); rowing
// costs stamina, out of breath you row weakly. A river's current carries the boat; it runs aground where the water
// is shallower than its draught and keel and will not go under a pier. The saved boat (`char.boats`) follows it.
import * as THREE from 'three';
import { scene } from './render';
import { PropBatch } from './props';
import { G } from '../game';
import { OW } from './overworld';
import { nearX, WORLD_W } from '../gen/regions';
import { BOATS, KEEL, floats, type Boat } from '../gen/boats';
import { STAMINA, BURN } from '../data/survival';
import { drainStamina } from './survival';
import { pierDeck } from './piers';
import { bridgeDeck } from './bridges';
import { saveChar } from '../character';
import { logLine, showToast } from '../ui/hud';
import { openTransfer } from '../ui/transfer';
import { EYE } from './player';
import type { Container } from '../save';

const HULL = 0x2fe060, DARK = 0x1f9a44;
/** Boats are drawn within this distance (m). */
const NEAR = 400;
interface Live { b: Boat; g: THREE.Group; oars: THREE.Group[] }
const live = new Map<string, Live>();
let aboard: Live | null = null, speed = 0, stroke = 0, third = false, scanT = 0, saveT = 0, jumpT = 0, bob = 0, aground = 0;
export const inBoat = () => !!aboard;

/** The rowboat: local z = forward (bow +z), x across, y up from the waterline. */
function rowboat(): { g: THREE.Group; oars: THREE.Group[] } {
  const s = BOATS.row, L = s.len / 2, pb = new PropBatch();
  const st: number[] = []; for (let u = -L; u <= L + 1e-6; u += s.len / 12) st.push(u);
  const w = (u: number) => (u <= 0 ? s.beam / 2 - 0.15 * (u / -L) ** 2 : (s.beam / 2) * Math.sqrt(Math.max(0, 1 - (u / L) ** 2)));
  const gun = (u: number) => 0.45 + 0.15 * (u / L) ** 2, keel = (u: number) => -s.draft + (u > 0 ? 0.25 * (u / L) ** 2 : 0);
  for (let i = 0; i + 1 < st.length; i++) {
    const a = st[i], b = st[i + 1];
    for (const sg of [-1, 1]) {
      const ga = [sg * w(a), gun(a), a], gb = [sg * w(b), gun(b), b], ca = [sg * w(a) * 0.8, -0.18, a], cb = [sg * w(b) * 0.8, -0.18, b], ka = [0, keel(a), a], kb = [0, keel(b), b];
      pb.face(ga, gb, cb, ca); pb.face(ca, cb, kb, ka);
      pb.seg(HULL, ga, gb); pb.seg(DARK, ca, cb);
      pb.seg(DARK, [sg * w(a) * 0.9, 0.14, a], [sg * w(b) * 0.9, 0.14, b]); // a strake
    }
    pb.seg(HULL, [0, keel(a), a], [0, keel(b), b]);
    // ribs, and the floorboards (just above the water line, so no water shows inside the boat)
    if (i % 2 === 0) for (const sg of [-1, 1]) pb.seg(DARK, [sg * w(a) * 0.98, gun(a) - 0.02, a], [sg * w(a) * 0.8, -0.16, a]);
    const fa = w(a) * 0.72, fb = w(b) * 0.72;
    if (a > -L + 0.2 && b < L - 0.6) pb.face([-fa, 0.08, a], [fa, 0.08, a], [fb, 0.08, b], [-fb, 0.08, b]);
  }
  // the transom, the thwarts and the oarlocks
  const tw = w(-L);
  pb.face([-tw, gun(-L), -L], [tw, gun(-L), -L], [tw * 0.8, -0.18, -L], [0, keel(-L), -L], [-tw * 0.8, -0.18, -L]);
  pb.seg(HULL, [-tw, gun(-L), -L], [tw, gun(-L), -L]);
  for (const [u, d] of [[0.1, 0.24], [-1.4, 0.3], [1.3, 0.2]]) pb.box(-w(u) + 0.05, 0.28, u - d / 2, w(u) - 0.05, 0.34, u + d / 2, HULL);
  const g = new THREE.Group(); g.add(pb.build());
  const oars: THREE.Group[] = [];
  for (const sg of [-1, 1]) {
    const o = new PropBatch(), og = new THREE.Group();
    o.seg(HULL, [-sg * 0.8, 0, 0], [sg * 1.9, 0, 0]); // the loom and the shaft, pivoting at the oarlock
    o.box(sg > 0 ? 1.9 : -2.5, -0.02, -0.08, sg > 0 ? 2.5 : -1.9, 0.02, 0.08, HULL); // the blade
    og.add(o.build()); og.position.set(sg * (w(0.35) + 0.02), gun(0.35) + 0.05, 0.35);
    g.add(og); oars.push(og);
  }
  return { g, oars };
}
function place(l: Live) {
  const T = OW.terrain, x = nearX(l.b.x, G.pos.x), w = T?.water(x, l.b.z);
  l.g.position.set(x, (w ? w.level : 0) + (l === aboard ? bob : 0), l.b.z);
  l.g.rotation.set(0, l.b.yaw, 0);
}
function drop(l: Live) { scene.remove(l.g); l.g.traverse((o) => (o as THREE.Mesh).geometry?.dispose()); }

/** Draw your boats near you (twice a second) and keep the one you sit in placed. */
function syncBoats() {
  if (!OW.terrain || G.char.loc !== 'overworld') { clearBoats(); return; }
  const seen = new Set<string>();
  for (const b of G.char.boats) {
    if (Math.hypot(nearX(b.x, G.pos.x) - G.pos.x, b.z - G.pos.z) > NEAR && aboard?.b !== b) continue;
    seen.add(b.id);
    let l = live.get(b.id);
    if (!l) { const m = rowboat(); l = { b, g: m.g, oars: m.oars }; scene.add(l.g); live.set(b.id, l); }
    l.b = b; place(l);
  }
  for (const [id, l] of live) if (!seen.has(id)) { drop(l); live.delete(id); }
}
export function clearBoats() { if (aboard) stepOff(true); for (const l of live.values()) drop(l); live.clear(); }
/** A boat was launched or taken away: draw it now. */
export function redrawBoats() { scanT = 0; }

/** Is the boat's hull clear of the land at (x, z) facing yaw: bow, stern and both sides over deep enough water, no pier? */
function clearAt(l: Live, x: number, z: number, yaw: number): boolean {
  const T = OW.terrain!, s = BOATS[l.b.k], fx = Math.sin(yaw), fz = Math.cos(yaw);
  for (const [u, v] of [[s.len / 2, 0], [-s.len / 2, 0], [0, s.beam / 2], [0, -s.beam / 2], [s.len / 4, s.beam / 3], [s.len / 4, -s.beam / 3]]) {
    const px = x + fx * u + fz * v, pz = z + fz * u - fx * v, w = T.water(px, pz);
    if (!w || !floats(l.b.k, w.depth) || pierDeck(px, pz) !== null) return false;
  }
  return true;
}

/** Every frame: the boats near you, and rowing the one you sit in. Returns true while you are aboard (the player does not walk). */
export function updateBoats(dt: number): boolean {
  if ((scanT -= dt) <= 0) { scanT = 0.5; syncBoats(); }
  jumpT -= dt;
  if (!aboard) { for (const l of live.values()) l.oars.forEach((o) => o.rotation.set(0, 0, 0)); return false; }
  const l = aboard, b = l.b, s = BOATS[b.k], T = OW.terrain;
  if (!T) { stepOff(true); return false; }
  // the planet's seam: the player was moved to the other copy
  if (Math.abs(G.pos.x - b.x) > WORLD_W / 2) b.x += Math.round((G.pos.x - b.x) / WORLD_W) * WORLD_W;
  const k = G.keys, row = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0) - G.stick.dy, turn = (k.KeyA ? 1 : 0) - (k.KeyD ? 1 : 0) - G.stick.dx;
  const effort = Math.min(1, Math.abs(row) + Math.abs(turn) * 0.6), fresh = effort > 0.05 ? drainStamina(STAMINA.swim * 0.7 * effort, dt) : true;
  const power = fresh ? 1 : 0.35;
  G.activity = effort > 0.05 ? BURN.swim : 1;
  const want = row > 0 ? row * s.speed * power : row * s.speed * s.back * power;
  speed += (want - speed) * Math.min(1, dt * (Math.abs(want) > Math.abs(speed) ? 0.8 : 0.5));
  const dyaw = turn * s.turn * power * (0.55 + 0.45 * Math.min(1, Math.abs(speed) / 1.5)) * dt;
  const w0 = T.water(b.x, b.z), flow = w0?.flow ?? [0, 0];
  const ny = b.yaw + dyaw, nx = b.x + (Math.sin(ny) * speed + flow[0]) * dt, nz = b.z + (Math.cos(ny) * speed + flow[1]) * dt;
  if (clearAt(l, nx, nz, ny)) { b.x = nx; b.z = nz; b.yaw = ny; G.yaw += dyaw; aground = 0; }
  else if (clearAt(l, b.x, b.z, ny)) { b.yaw = ny; G.yaw += dyaw; speed *= 0.3; aground += dt; }
  else { speed = 0; aground += dt; }
  if (aground > 0.4 && aground - dt <= 0.4) showToast('Aground: back water or turn');
  // the oars: a stroke cycle while pulling, one side only when turning on the spot
  stroke += dt * (1.1 + Math.abs(speed) * 0.3) * (effort > 0.05 ? 1 : 0);
  l.oars.forEach((o, i) => {
    const side = i === 0 ? -1 : 1, pull = effort > 0.05 && (Math.abs(row) > 0.1 || side * turn < 0 || Math.abs(turn) < 0.1) ? 1 : 0.25;
    const ph = stroke * 6.283 * (row < 0 ? -1 : 1);
    o.rotation.set(0, side * Math.sin(ph) * 0.5 * pull, side * (0.18 + Math.cos(ph) * 0.14 * pull));
  });
  bob = Math.sin(performance.now() / 700) * 0.04;
  place(l);
  // you sit on the thwart
  const sx = b.x - Math.sin(b.yaw) * 0.15, sz = b.z - Math.cos(b.yaw) * 0.15, lvl = w0?.level ?? l.g.position.y;
  G.pos.set(nearX(sx, G.pos.x), lvl + bob + 1.0 - EYE, sz); G.vel.set(0, 0, 0); G.onGround = true; G.swimming = false;
  if ((saveT -= dt) <= 0) { saveT = 8; saveChar(); }
  return true;
}
/** The camera: on the thwart, or behind and above the boat. */
export function boatCamera(camera: THREE.PerspectiveCamera) {
  if (!aboard) return;
  if (!third) { camera.position.set(G.pos.x, G.pos.y + EYE, G.pos.z); return; }
  const g = aboard.g.position, cy = Math.cos(G.pitch), f = new THREE.Vector3(-Math.sin(G.yaw) * cy, Math.sin(G.pitch), -Math.cos(G.yaw) * cy);
  camera.position.set(g.x, g.y + 1.6, g.z).addScaledVector(f, -7);
  camera.position.y = Math.max(camera.position.y, g.y + 1);
}
export function toggleBoatView() { if (aboard) third = !third; }
/** HUD line while aboard. */
export const boatHint = () => (aboard ? `${BOATS[aboard.b.k].name} · ${Math.abs(speed).toFixed(1)} m/s · W/S row · A/D turn · E step out · F the hold · V view` : null);

/** The boat of yours you stand beside (not aboard). */
export function nearBoat(): Boat | null {
  if (aboard || G.char.loc !== 'overworld') return null;
  for (const l of live.values()) {
    const s = BOATS[l.b.k], g = l.g.position, dx = G.pos.x - g.x, dz = G.pos.z - g.z, u = dx * Math.sin(l.b.yaw) + dz * Math.cos(l.b.yaw), v = dx * Math.cos(l.b.yaw) - dz * Math.sin(l.b.yaw);
    if (Math.abs(u) < s.len / 2 + 1.3 && Math.abs(v) < s.beam / 2 + 1.5 && Math.abs(G.pos.y - g.y) < 3) return l.b;
  }
  return null;
}
/** Get in. */
export function board(b: Boat) {
  const l = live.get(b.id);
  if (!l || aboard) return;
  aboard = l; speed = 0; third = false; aground = 0; G.yaw = b.yaw + Math.PI; // looking forward: the camera looks down −z of its yaw
  logLine(`You climb into the ${BOATS[b.k].name.toLowerCase()} and take up the oars.`);
}
/** Step out: onto a pier, a bridge's deck or dry ground beside the boat; with none, a second E drops you into the water. */
export function stepOff(quiet = false) {
  const l = aboard;
  if (!l) return;
  const b = l.b, T = OW.terrain, s = BOATS[b.k];
  if (!quiet && T) {
    const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw);
    let spot: [number, number, number] | null = null;
    for (const [u, v] of [[0, s.beam / 2 + 0.8], [0, -s.beam / 2 - 0.8], [s.len / 2 + 0.7, 0], [-s.len / 2 - 0.7, 0], [0, s.beam / 2 + 1.8], [0, -s.beam / 2 - 1.8], [s.len / 2 + 1.6, 0]]) {
      const x = nearX(b.x, G.pos.x) + fx * u + fz * v, z = b.z + fz * u - fx * v, deck = pierDeck(x, z) ?? bridgeDeck(x, z), w = T.water(x, z);
      if (deck !== null) { spot = [x, deck, z]; break; }
      if (!w || w.depth < 0.35) { spot = [x, T.heightAt(x, z), z]; break; }
    }
    if (!spot && jumpT <= 0) { jumpT = 3; logLine('Nowhere dry to step out here: row to a bank, a beach or a pier. Press E again to go over the side.'); return; }
    if (spot) G.pos.set(spot[0], spot[1] + 0.02, spot[2]);
    else G.pos.set(nearX(b.x, G.pos.x) + fz * (s.beam / 2 + 1), l.g.position.y - 1, b.z - fx * (s.beam / 2 + 1));
    logLine(spot ? 'You step out of the boat.' : 'You slip over the side into the water.');
  }
  aboard = null; speed = 0; third = false;
  l.oars.forEach((o) => o.rotation.set(0, 0, 0));
  G.vel.set(0, 0, 0);
  saveChar();
}
/** A boat's hold (`char.containers[id]`). */
export function boatHold(b: Boat): Container {
  const n = BOATS[b.k].hold, box = (G.char.containers[b.id] ??= { items: Array(n).fill(null), gold: 0 });
  while (box.items.length < n) box.items.push(null);
  return box;
}
/** F: the hold of the boat you sit in or stand by. */
export function openBoatHold(): boolean {
  const b = aboard?.b ?? nearBoat();
  if (!b) return false;
  openTransfer({ title: BOATS[b.k].name, subtitle: 'The hold', boxLabel: 'Hold', box: boatHold(b) });
  return true;
}
/** The hulls you are not sitting in are solid to someone wading or swimming beside them. */
export function boatHit(x: number, y: number, z: number, r: number): boolean {
  for (const l of live.values()) {
    if (l === aboard) continue;
    const s = BOATS[l.b.k], g = l.g.position;
    if (y > g.y + 0.5 || y + 1.7 < g.y - s.draft) continue;
    const dx = x - g.x, dz = z - g.z, u = dx * Math.sin(l.b.yaw) + dz * Math.cos(l.b.yaw), v = dx * Math.cos(l.b.yaw) - dz * Math.sin(l.b.yaw);
    if (Math.abs(u) < s.len / 2 + r && Math.abs(v) < s.beam / 2 + r) return true;
  }
  return false;
}
/** Where a new boat is put in the water beside a pier's head (KEEL: some room under it). */
export const LAUNCH = { side: 1.4, keel: KEEL };
