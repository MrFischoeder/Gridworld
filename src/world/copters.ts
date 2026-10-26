// (0.259, PLAN_LOTNICTWA.md stage F5) Rotorcrafts in the air and on the ground (gen/copters.ts, shared list `Char.copters`).
//
// A small cabin with two seats under one rotor. E beside it gets in (the pilot's seat first, then the passenger's). At
// the controls W/S fly forward and astern, A/D turn, Space climbs and C descends; let go of the keys and it hangs where
// it is. It sets down where the ground under its skids is level and dry (a steep slope or deep water keeps it a few
// decimetres up: "too steep to land") and stays there when you step out (E, only landed). F opens its hold of 8 slots,
// R pours a canister, V switches between the view from behind and the cabin. A flat tank gives no lift: it settles at
// 4 m/s. It bumps into buildings, trees' crowns and the other solid things (as the airships do) and the driver's game
// checks that.
//
// Together (online): like the airships, one game drives each rotorcraft (`drives`: whoever sits at the controls, else the
// player with the lowest id near it), writes the shared state and tells the others 10 times a second (the relay type
// 'air', the ids start 'cop:'), whose games ease after it; the others' figures are drawn at their seats through
// `PeerState.boat` ([id, u, v, h, seat]: `myCopterSpot` / `copterSeatPoint`).
import * as THREE from 'three';
import { scene } from './render';
import { PropBatch } from './props';
import { G } from '../game';
import { OW, foeBody, crownHit } from './overworld';
import { nearX, WORLD_W } from '../gen/regions';
import { SEA } from '../gen/seas';
import { weatherAt } from '../gen/weather';
import { windSpeed } from '../gen/boats';
import { hullOf, hullSpeed } from '../gen/airhull';
import { COPTER, COP_SEATS, burnCop, fuelCop, copRangeKm, fitToLand, type Copter } from '../gen/copters';
import { net, online, relay, onRelay, type Relay } from '../net/client';
import { saveChar, takeOne } from '../character';
import { logLine, showToast } from '../ui/hud';
import { openTransfer } from '../ui/transfer';
import { EYE } from './player';
import type { Container } from '../save';
import { tl, TL } from '../i18n';

const SKIN = 0xc4ffd2, FRAME = 0x2fe060, GOLD = 0xffd060, STEEL = 0x9fd8b0;
/** Drawn within this distance (m); the nearest player within `NEAR` drives one nobody flies. */
const DRAW = 1200, NEAR = 700, FRESH = 3000;
/** Height of the cabin floor over the skids' bottom. */
const FLOOR = 0.45;
interface Heard { from: number; at: number; x: number; y: number; z: number; yaw: number; sp: number; vy: number; turn: number; th: number; helm: number }
interface Live { c: Copter; g: THREE.Group; rotor: THREE.Group; tail: THREE.Group; x: number; y: number; z: number; yaw: number; sp: number; vy: number; turn: number; th: number; rpm: number; heard: Heard | null; windT: number; wind: [number, number]; stuck: boolean; bumpT: number; steepT: number }
const live = new Map<string, Live>();
let aboard: Live | null = null, seat = 0, third = true, scanT = 0, saveT = 0;
export const inCopter = () => !!aboard;
const me = () => (online() ? net.id : 0);
const groundAt = (x: number, z: number) => Math.max(OW.terrain!.heightAt(x, z), SEA.level);

// ---------- the model ----------
function cabin(pb: PropBatch) {
  const st = 8, n = 8, z0 = -1.7, z1 = 2.5, rings: number[][][] = [];
  for (let i = 0; i <= st; i++) {
    const t = i / st, z = z0 + (z1 - z0) * t, r = 0.3 + 0.85 * Math.sin(Math.PI * Math.min(1, 0.15 + t * 0.85)) ** 0.8;
    rings.push(Array.from({ length: n }, (_, k) => { const a = k / n * Math.PI * 2; return [Math.cos(a) * r * 0.95, 1.4 + Math.sin(a) * r, z]; }));
  }
  for (let i = 0; i < st; i++) for (let k = 0; k < n; k++) {
    const a = rings[i][k], b = rings[i][(k + 1) % n], c = rings[i + 1][(k + 1) % n], d = rings[i + 1][k];
    pb.face(a, b, c, d); pb.seg(SKIN, a, d);
    if (i % 2 === 0) pb.seg(SKIN, a, b);
  }
  pb.seg(GOLD, [-0.9, 1.75, 1.5], [0.9, 1.75, 1.5]); // the windscreen's edge
  // the skids and their struts
  for (const x of [-1, 1]) {
    pb.box(x - 0.05, 0, -1.8, x + 0.05, 0.1, 2.1, FRAME);
    for (const z of [-0.9, 1.3]) pb.seg(STEEL, [x, 0.1, z], [x * 0.7, 0.75, z]);
  }
  // the tail boom, fin and the mast
  pb.box(-0.12, 1.5, -6.3, 0.12, 1.8, -1.6, FRAME);
  pb.face([0, 1.8, -6.3], [0, 3.2, -6.7], [0, 3.2, -6.0], [0, 1.8, -5.4]); pb.seg(FRAME, [0, 1.8, -6.3], [0, 3.2, -6.7]);
  pb.box(-0.12, 2.2, -0.2, 0.12, 2.75, 0.2, STEEL);
}
function rotorModel(): THREE.Group {
  const pb = new PropBatch(), g = new THREE.Group();
  for (const a of [0, Math.PI / 2]) pb.seg(GOLD, [Math.cos(a) * 4.4, 0, Math.sin(a) * 4.4], [-Math.cos(a) * 4.4, 0, -Math.sin(a) * 4.4]);
  g.add(pb.build()); g.position.set(0, 2.8, 0);
  return g;
}
function tailRotor(): THREE.Group {
  const pb = new PropBatch(), g = new THREE.Group();
  for (const a of [0, Math.PI / 2]) pb.seg(GOLD, [0, Math.cos(a) * 0.9, Math.sin(a) * 0.9], [0, -Math.cos(a) * 0.9, -Math.sin(a) * 0.9]);
  g.add(pb.build()); g.position.set(0.25, 2.5, -6.5);
  return g;
}
function model(): { g: THREE.Group; rotor: THREE.Group; tail: THREE.Group } {
  const pb = new PropBatch(); cabin(pb);
  const g = new THREE.Group(), rotor = rotorModel(), tail = tailRotor();
  g.add(pb.build(), rotor, tail);
  return { g, rotor, tail };
}
/** A frozen rotorcraft for the film and galleries. */
export const showcaseCopter = () => model().g;

// ---------- the world's list ----------
function newLive(c: Copter): Live {
  const md = model();
  scene.add(md.g);
  const l: Live = { c, g: md.g, rotor: md.rotor, tail: md.tail, x: c.x, y: c.y, z: c.z, yaw: c.yaw, sp: 0, vy: 0, turn: 0, th: 0, rpm: 0, heard: null, windT: 0, wind: [0, 0], stuck: true, bumpT: 0, steepT: 0 };
  place(l, 0);
  return l;
}
function drop(l: Live) { scene.remove(l.g); l.g.traverse((o) => (o as THREE.Mesh).geometry?.dispose?.()); }
function place(l: Live, dt: number) {
  l.g.position.set(nearX(l.x, G.pos.x), l.y, l.z);
  l.g.rotation.set(0, l.yaw, 0);
  l.rotor.rotation.y += l.rpm * 38 * dt; l.tail.rotation.x += l.rpm * 60 * dt;
}
/** A point in its frame (u forward, v to the right) in the world. */
function at(l: Live, u: number, v: number): [number, number] {
  const fx = Math.sin(l.yaw), fz = Math.cos(l.yaw);
  return [nearX(l.x, G.pos.x) + fx * u + fz * v, l.z + fz * u - fx * v];
}
const fresh = (l: Live): Heard | null => { const h = l.heard; return h && h.from !== me() && performance.now() - h.at < FRESH ? h : null; };
function drives(l: Live): boolean {
  if (aboard === l && seat === 0) return true;
  const h = fresh(l);
  if (h && ((h.helm && h.helm !== me()) || h.from < me())) return false;
  if (!online()) return true;
  for (const p of net.peers.values()) {
    const st = p.st;
    if (!st || st.loc !== 'o' || st.away || p.id >= me()) continue;
    if (Math.hypot(nearX(l.x, st.p[0]) - st.p[0], l.z - st.p[2]) < NEAR) return false;
  }
  return true;
}
function sync() {
  if (!OW.terrain || G.char.loc !== 'overworld') { clearCopters(); return; }
  const seen = new Set<string>();
  for (const c of G.char.copters ?? []) {
    if (Math.hypot(nearX(c.x, G.pos.x) - G.pos.x, c.z - G.pos.z) > DRAW && aboard?.c.id !== c.id) continue;
    seen.add(c.id);
    let l = live.get(c.id);
    if (!l) { l = newLive(c); live.set(c.id, l); }
    l.c = c;
    if (!fresh(l) && aboard !== l && Math.abs(l.sp) < 0.01 && Math.abs(l.vy) < 0.01) { l.x = c.x; l.y = c.y; l.z = c.z; l.yaw = c.yaw; }
  }
  for (const [id, l] of live) if (!seen.has(id)) { if (aboard === l) aboard = null; drop(l); live.delete(id); }
}
export function clearCopters() {
  aboard = null;
  for (const l of live.values()) drop(l);
  live.clear();
}
export const redrawCopters = () => { scanT = 0; };

// ---------- flying ----------
/** The ground under its skids at five points and whether the middle is deep water: its base height and whether it may set down. */
function footprint(l: Live): { base: number; fit: boolean } {
  const hs = [[0, 0], [1.9, 0], [-1.5, 0], [0, 1], [0, -1]].map(([u, v]) => { const [x, z] = at(l, u, v); return groundAt(x, z); });
  const [mx, mz] = at(l, 0, 0), w = OW.terrain!.water(mx, mz);
  return { base: Math.max(...hs), fit: fitToLand(hs, !!w && w.depth > 1) };
}
/** Probes round the cabin, the tail and the rotor's reach as [u, v, dy over the skids, r]. */
const PROBES: [number, number, number, number][] = [[2.3, 0, 1.2, 0.8], [0, 0, 1.4, 1.3], [-5.6, 0, 1.7, 0.5], [4.2, 0, 2.8, 0.5], [-4.2, 0, 2.8, 0.5], [0, 4.2, 2.8, 0.5], [0, -4.2, 2.8, 0.5]];
function blockedAt(l: Live): boolean {
  for (const [u, v, dy, r] of PROBES) {
    const [x, z] = at(l, u, v), y = l.y + dy;
    if (foeBody(x, y - 0.75, z, r) || crownHit(x, y, z, r)) return true;
  }
  return false;
}
/** One rotorcraft's frame, driven by your game. */
function step(l: Live, dt: number, manned: boolean) {
  const c = l.c, k = G.keys, w = (l.windT -= dt);
  const fwd = manned ? (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0) : 0, turn = manned ? (k.KeyA ? 1 : 0) - (k.KeyD ? 1 : 0) : 0, up = manned ? (k.Space ? 1 : 0) - (k.KeyC ? 1 : 0) : 0;
  const { base } = footprint(l), landed = l.y <= base + 0.05, was = { x: l.x, y: l.y, z: l.z, yaw: l.yaw };
  if (w <= 0) { l.windT = 1; const wt = weatherAt(G.char.world, l.x, l.z, G.char.time), s = windSpeed(wt.wind) * COPTER.wind; l.wind = [Math.cos(wt.windDir) * s, Math.sin(wt.windDir) * s]; }
  const hs = hullSpeed(hullOf(c)), lift = c.fuel > 0 && hullOf(c) > 0, flying = !landed || (manned && up > 0 && lift);
  if (flying && !burnCop(c, lift ? fwd : 0, dt) && manned) showToast(tl('Out of fuel: she is settling. R pours in a canister once down.'));
  const top = (fwd > 0 ? COPTER.speed : COPTER.back) * hs, want = lift && !landed ? fwd * top : 0;
  l.th = lift && manned ? fwd : 0;
  l.sp += (want - l.sp) * Math.min(1, dt * 1.6);
  const wantVy = !lift ? (landed ? 0 : -COPTER.fall) : up * COPTER.climb * hs;
  l.vy += (wantVy - l.vy) * Math.min(1, dt * 2.2);
  const dyaw = turn * COPTER.turn * dt * (lift ? 1 : 0);
  l.yaw += dyaw; if (manned) G.yaw += dyaw;
  l.turn = dyaw / Math.max(dt, 1e-3);
  const gust = landed ? 0 : 1;
  l.x += (Math.sin(l.yaw) * l.sp + l.wind[0] * gust) * dt; l.z += (Math.cos(l.yaw) * l.sp + l.wind[1] * gust) * dt;
  l.y += l.vy * dt;
  const fp = footprint(l);
  // it sets down on level, dry ground when it comes down slowly; else it hangs a little above
  const touch = fp.fit && l.vy <= 0.5 && Math.abs(l.sp) < 6, floor = touch ? fp.base : fp.base + COPTER.min + (fp.fit ? 0 : 0.2);
  if (l.y < floor) {
    if (!fp.fit && manned && up < 0 && performance.now() > l.steepT) { l.steepT = performance.now() + 4000; showToast(tl('Too steep or too wet to set down: find level ground')); }
    l.y = floor; l.vy = Math.max(0, l.vy); if (touch) l.sp = 0;
  }
  if (l.y > SEA.level + COPTER.ceil) { l.y = SEA.level + COPTER.ceil; l.vy = Math.min(0, l.vy); }
  // it bumps into what stands in its way (but may always move out of something it is caught in)
  const stuck = blockedAt(l);
  if (stuck && !l.stuck) {
    if (manned) G.yaw -= l.yaw - was.yaw;
    l.x = was.x; l.y = was.y; l.z = was.z; l.yaw = was.yaw; l.sp *= -0.25; l.vy = 0; l.turn = 0;
    if (manned && performance.now() > l.bumpT) { l.bumpT = performance.now() + 2500; showToast(tl('The rotorcraft bumps into something: climb or steer clear')); }
  } else l.stuck = stuck;
  l.rpm += ((flying || !landed || manned ? 1 : 0) - l.rpm) * Math.min(1, dt * 1.2);
  c.x = l.x; c.y = l.y; c.z = l.z; c.yaw = l.yaw;
  place(l, dt);
}
function follow(l: Live, dt: number) {
  l.stuck = true;
  const h = l.heard;
  if (!h) { l.rpm *= 0.9; place(l, dt); return; }
  const age = Math.min(1.5, (performance.now() - h.at) / 1000), yaw = h.yaw + h.turn * age;
  const px = nearX(h.x + Math.sin(yaw) * h.sp * age, l.x), pz = h.z + Math.cos(yaw) * h.sp * age, py = h.y + h.vy * age;
  if (Math.hypot(px - l.x, pz - l.z) > 25) { l.x = px; l.y = py; l.z = pz; l.yaw = yaw; }
  else {
    const k = Math.min(1, dt * 6); let dy = yaw - l.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    l.x += (px - l.x) * k; l.y += (py - l.y) * k; l.z += (pz - l.z) * k; l.yaw += dy * k;
    if (aboard === l) G.yaw += dy * k;
  }
  l.sp = h.sp; l.th = h.th;
  l.rpm += ((Math.abs(h.sp) > 0.2 || Math.abs(h.vy) > 0.2 || h.helm ? 1 : 0) - l.rpm) * Math.min(1, dt * 1.2);
  place(l, dt);
}
const sendAt = new Map<string, number>();
function tell(l: Live) {
  if (!online() || !net.peers.size) return;
  const helm = aboard === l && seat === 0 ? me() : 0, busy = helm || Math.abs(l.sp) > 0.05 || Math.abs(l.vy) > 0.05, now = performance.now();
  if (now < (sendAt.get(l.c.id) ?? 0)) return;
  sendAt.set(l.c.id, now + (busy ? 100 : 1000));
  relay({ t: 'air', id: l.c.id, x: l.x, y: l.y, z: l.z, yaw: l.yaw, sp: l.sp, vy: l.vy, turn: l.turn, th: l.th, helm });
}
onRelay((m: Relay) => {
  if (m.t !== 'air' || !String(m.id).startsWith('cop:')) return;
  const l = live.get(String(m.id));
  if (!l) return;
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  l.heard = { from: m.from, at: performance.now(), x: n(m.x), y: n(m.y), z: n(m.z), yaw: n(m.yaw), sp: n(m.sp), vy: n(m.vy), turn: n(m.turn), th: n(m.th), helm: n(m.helm) };
});
/** Every frame: the rotorcrafts near you, driven by your game or followed; you at your seat. True while you are aboard. */
export function updateCopters(dt: number): boolean {
  if ((scanT -= dt) <= 0) { scanT = 0.5; sync(); }
  if (!OW.terrain) { aboard = null; return false; }
  if (aboard && Math.abs(G.pos.x - aboard.x) > WORLD_W / 2) aboard.x += Math.round((G.pos.x - aboard.x) / WORLD_W) * WORLD_W; // the planet's seam
  for (const l of live.values()) {
    if (drives(l)) { step(l, dt, aboard === l && seat === 0); tell(l); }
    else follow(l, dt);
  }
  if ((saveT -= dt) <= 0 && aboard) { saveT = 8; saveChar(); }
  if (!aboard) return false;
  const [sx, sz] = at(aboard, COP_SEATS[seat][0], COP_SEATS[seat][1]);
  G.pos.set(sx, aboard.y + FLOOR, sz); G.vel.set(0, 0, 0); G.onGround = true; G.swimming = false;
  return true;
}
/** The camera: from behind and above, or your seat in the cabin. */
export function copterCamera(camera: THREE.PerspectiveCamera) {
  if (!aboard) return;
  if (!third) { camera.position.set(G.pos.x, G.pos.y + EYE, G.pos.z); return; }
  const g = aboard.g.position, cy = Math.cos(G.pitch), f = new THREE.Vector3(-Math.sin(G.yaw) * cy, Math.sin(G.pitch), -Math.cos(G.yaw) * cy);
  camera.position.set(g.x, g.y + 2.5, g.z).addScaledVector(f, -13);
  if (OW.terrain) camera.position.y = Math.max(camera.position.y, groundAt(camera.position.x, camera.position.z) + 1.5);
}
export function toggleCopterView() { if (aboard) third = !third; }

// ---------- getting in and out ----------
/** Its pilot's seat is held by someone else, and the seats others sit in (from their figures' spots). */
function seatsTaken(l: Live): Set<number> {
  const out = new Set<number>();
  if (online()) for (const p of net.peers.values()) { const b = p.st?.boat; if (b && b[0] === l.c.id && b[4] >= 0) out.add(b[4]); }
  const h = fresh(l); if (h?.helm && h.helm !== me()) out.add(0);
  return out;
}
/** The rotorcraft you stand beside (not aboard). */
export function nearCopter(): Copter | null {
  if (aboard || G.char.loc !== 'overworld' || !OW.terrain) return null;
  for (const l of live.values()) {
    const [x, z] = at(l, 0, 0);
    if (Math.hypot(G.pos.x - x, G.pos.z - z) < 3.4 && Math.abs(G.pos.y - l.y) < 3) return l.c;
  }
  return null;
}
export function copterPrompt(c: Copter): string {
  const l = live.get(c.id);
  if (!l) return '';
  const taken = seatsTaken(l);
  if (taken.size >= COPTER.seats) return tl('The rotorcraft is full');
  return taken.has(0) ? tl('E — climb in and ride · F — its hold') : tl('E — climb in and take the controls · F — its hold');
}
export function boardCopter(c: Copter) {
  const l = live.get(c.id);
  if (!l || aboard) return;
  const taken = seatsTaken(l), s = [0, 1].find((i) => !taken.has(i));
  if (s === undefined) { showToast(tl('The rotorcraft is full')); return; }
  aboard = l; seat = s; third = true; G.yaw = l.yaw + Math.PI;
  logLine(s === 0 ? TL`You take the controls of the rotorcraft: ${Math.round(c.fuel)} L, about ${copRangeKm(c).toFixed(0)} km. W/S forward, A/D turn, Space climb, C descend, V the view, E get out once landed.` : tl('You take the passenger\'s seat.'));
}
/** E seated: get out, only once it has set down on dry ground. */
export function copterUse() {
  const l = aboard;
  if (!l) return;
  const { base } = footprint(l), T = OW.terrain!;
  if (l.y - base > 0.6) { logLine(tl('Too high to get out: set down first.')); return; }
  for (const v of [2.4, -2.4]) {
    const [x, z] = at(l, 0.3, v), w = T.water(x, z);
    if (w && w.depth > 1) continue;
    if (foeBody(x, T.heightAt(x, z), z, 0.4)) continue;
    G.pos.set(x, T.heightAt(x, z) + 0.05, z); G.vel.set(0, 0, 0);
    aboard = null; seat = 0; logLine(tl('You climb out of the rotorcraft.')); saveChar(); return;
  }
  logLine(tl('No room to get out here: set down on clearer ground.'));
}
/** Where you sit (for the others' figures): [id, u, v, feet over its skids, seat]. */
export function myCopterSpot(): [string, number, number, number, number] | undefined {
  return aboard ? [aboard.c.id, COP_SEATS[seat][0], COP_SEATS[seat][1], G.pos.y - aboard.y, seat] : undefined;
}
/** Where a seat of a rotorcraft drawn here is now. */
export function copterSeatPoint(id: string, u: number, v: number, h: number): [number, number, number] | null {
  const l = live.get(id);
  if (!l) return null;
  const [x, z] = at(l, u, v);
  return [x, l.y + h, z];
}
/** (0.260) The rotorcraft you sit in: its shared record, height, whether you are at the controls. */
export const copAboard = () => (aboard ? { c: aboard.c, y: aboard.y, x: aboard.x, z: aboard.z, sp: aboard.sp, pilot: seat === 0 } : null);
/** The HUD line aboard. */
export function copterHint(): string | null {
  const l = aboard;
  if (!l) return null;
  const c = l.c, { base } = footprint(l), up = Math.round(l.y - base);
  const head = TL`Rotorcraft · ${Math.round(Math.abs(l.sp) * 3.6)} km/h · ${up} m up · ${Math.round(c.fuel)}/${COPTER.fuel.tank} L (~${copRangeKm(c).toFixed(0)} km)`;
  return head + (hullOf(c) < 100 ? TL` · hull ${Math.round(hullOf(c))}%` : '') + (up < 1 ? tl(' · E get out') : '') + (c.fuel <= 0 ? tl(' · no fuel') : '');
}
export function copterHold(c: Copter): Container {
  const box = (G.char.containers[c.id] ??= { items: Array(COPTER.hold).fill(null), gold: 0 });
  while (box.items.length < COPTER.hold) box.items.push(null);
  return box;
}
/** F: the hold of the rotorcraft you sit in or stand by. */
export function openCopterHold(): boolean {
  const c = aboard?.c ?? nearCopter();
  if (!c) return false;
  openTransfer({ title: COPTER.name, subtitle: tl('The hold'), boxLabel: tl('Hold'), box: copterHold(c) });
  return true;
}
/** R aboard or beside one: pour a canister from the hold or your backpack. */
export function refuelCopter(): boolean {
  const c = aboard?.c ?? nearCopter();
  if (!c) return false;
  if (c.fuel > COPTER.fuel.tank - COPTER.fuel.can * 0.5) { logLine(tl('The tank is nearly full.')); return true; }
  const hold = copterHold(c), i = hold.items.findIndex((x) => x?.k === 'fuel');
  if (i >= 0) { const x = hold.items[i]!; x.n--; if (x.n <= 0) hold.items[i] = null; }
  else if (!takeOne('fuel')) { logLine(tl('You have no Fuel Canister, in the hold or your backpack.')); return true; }
  fuelCop(c, COPTER.fuel.can);
  logLine(TL`You pour a canister into the tank: ${Math.round(c.fuel)} of ${COPTER.fuel.tank} litres.`);
  saveChar(); return true;
}
/** For the maps: every rotorcraft's place and heading. */
export const coptersForMap = (): [number, number, number][] => (G.char.copters ?? []).map((c) => { const l = live.get(c.id); return l ? [l.x, l.z, l.yaw] : [c.x, c.z, c.yaw]; });
/** (tests and debugging) the rotorcrafts drawn here. */
export const liveCopters = () => live;
