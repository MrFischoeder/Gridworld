// (0.256, PLAN_LOTNICTWA.md stage F3, part 1) Airships in the air and the mooring masts beside the warehouses.
//
// The masts: drawn by every warehouse that has one (gen/airships.ts `mastAt`): a braced lattice mast, a turning cap,
// a ladder, a winch hut; a lamp at the head while it works. The airships (`Char.airships`, shared): an envelope with
// four tail fins, a gondola under it and two engine pods whose propellers turn with the throttle.
//
// Flying: E beside the gondola (moored at a mast or hovering low) gets in; the helm is the first seat, the others ride.
// At the helm W/S set the throttle (it stays where you leave it), A/D turn, Space climbs and C sinks; the wind
// (gen/weather.ts) pushes it off its course. Diesel burns from the tank (R pours a canister), cells drain and charge
// while moored at a working mast. E at the helm: tie up at a mast whose head is near the nose (slowly), step out when
// the gondola hangs low over the ground, else leave the helm and ride; E in another seat: step out low, or take a free
// helm. F opens the hold. V switches between the view from behind and the gondola.
//
// Together (online): like the boats (world/boats.ts), one game drives each airship (`drives`): whoever holds its helm,
// else the player with the lowest id near it; it moves it, writes the shared airship and tells the others ten times a
// second ({t:'air'} relay), whose games ease after it (`follow`) and carry their passengers along. The others' figures
// aboard are drawn at their seats (`myAirSpot` / `airSeatPoint` through world/peers.ts). Not yet (stage F3 part 2):
// walking about the gondola in flight, the rope ladder, collisions with buildings and trees in the air.
import * as THREE from 'three';
import { scene } from './render';
import { PropBatch } from './props';
import { G } from '../game';
import { OW } from './overworld';
import { nearX, worldDist, WORLD_W } from '../gen/regions';
import { SEA } from '../gen/seas';
import { weatherAt } from '../gen/weather';
import { windSpeed } from '../gen/boats';
import { hubs, type Hub } from '../gen/warehouses';
import { AIRMAST, AIRSHIP } from '../gen/airmast';
import { hasAmast, amastWhy, mastAt, moorPose, airEnergy, burnAir, chargeAir, fuelAir, airRangeKm, lowest, SEAT_U, type Airship } from '../gen/airships';
import { net, online, relay, onRelay, type Relay } from '../net/client';
import { saveChar, takeOne } from '../character';
import { logLine, showToast } from '../ui/hud';
import { openTransfer } from '../ui/transfer';
import { EYE } from './player';
import type { Container } from '../save';
import { tl, TL } from '../i18n';

const SKIN = 0xc4ffd2, FRAME = 0x2fe060, GOLD = 0xffd060, STEEL = 0x9fd8b0;
/** Airships are drawn within this distance (m); the nearest player within `NEAR` drives one nobody steers. */
const DRAW = 1500, NEAR = 900, MAST_R = 700;
/** A message heard recently enough to go by (ms). */
const FRESH = 3000;
interface Heard { from: number; at: number; x: number; y: number; z: number; yaw: number; sp: number; vy: number; turn: number; th: number; helm: number }
interface Live { a: Airship; g: THREE.Group; props: THREE.Group[]; x: number; y: number; z: number; yaw: number; sp: number; vy: number; turn: number; th: number; heard: Heard | null; windT: number; wind: [number, number]; chargeT: number; charging: boolean }
const live = new Map<string, Live>();
let aboard: Live | null = null, seat = 0, third = true, scanT = 0, saveT = 0;
export const inAir = () => !!aboard;
const me = () => (online() ? net.id : 0);
const groundAt = (x: number, z: number) => Math.max(OW.terrain!.heightAt(x, z), SEA.level);

// ---------- the models ----------
function envelope(pb: PropBatch) {
  const L = AIRSHIP.len, R = AIRSHIP.r, n = 12, st = 13, rings: number[][][] = [];
  for (let i = 0; i <= st; i++) {
    const t = i / st, u = (t - 0.5) * L, r = R * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.08)), 0.7) * (t > 0.7 ? 1 - (t - 0.7) * 0.6 : 1);
    rings.push(Array.from({ length: n }, (_, k) => { const a = k / n * Math.PI * 2; return [Math.cos(a) * Math.max(0.05, r), Math.sin(a) * Math.max(0.05, r), u]; }));
  }
  for (let i = 0; i < st; i++) for (let k = 0; k < n; k++) {
    const a = rings[i][k], b = rings[i][(k + 1) % n], c = rings[i + 1][(k + 1) % n], d = rings[i + 1][k];
    pb.face(a, b, c, d); pb.seg(SKIN, a, d);
    if (i % 2 === 0) pb.seg(SKIN, a, b);
  }
  // four tail fins
  for (const [fx, fy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    const u0 = -L / 2 + 1, u1 = -L / 2 + 7, r0 = R * 0.45, r1 = R * 0.75, o = R * 1.2;
    const p = (r: number, u: number) => [fx * r, fy * r, u];
    pb.face(p(r0, u0), p(o, u0 - 1), p(o, u0 + 2.5), p(r1, u1)); pb.seg(FRAME, p(r0, u0), p(o, u0 - 1)); pb.seg(FRAME, p(o, u0 - 1), p(o, u0 + 2.5)); pb.seg(FRAME, p(o, u0 + 2.5), p(r1, u1));
  }
}
function gondola(pb: PropBatch) {
  const { len, w, h } = AIRSHIP.gond, y0 = -AIRSHIP.below, y1 = y0 + h;
  pb.box(-w / 2, y0, -len / 2, w / 2, y0 + 0.9, len / 2, FRAME);
  for (const x of [-w / 2, w / 2]) for (let u = -len / 2; u <= len / 2 + 0.01; u += len / 4) pb.seg(FRAME, [x, y0 + 0.9, u], [x, y1, u]);
  for (const x of [-w / 2, w / 2]) pb.seg(FRAME, [x, y1, -len / 2], [x, y1, len / 2]);
  pb.seg(GOLD, [-w / 2, y0 + 1.5, len / 2 - 0.2], [w / 2, y0 + 1.5, len / 2 - 0.2]); // the window band at the helm
  pb.box(-w / 2, y1, -len / 2, w / 2, y1 + 0.2, len / 2, FRAME);
  // the struts up to the envelope
  for (const u of [-len / 2, len / 2]) for (const x of [-w / 2, w / 2]) pb.seg(STEEL, [x, y1 + 0.2, u], [x * 0.6, -AIRSHIP.r * 0.92, u * 1.2]);
}
function engine(side: number): THREE.Group {
  const pb = new PropBatch(), x = side * (AIRSHIP.gond.w / 2 + 2.4), y = -AIRSHIP.below + 1.6;
  pb.seg(STEEL, [side * AIRSHIP.gond.w / 2, y, 0], [x, y, 0]);
  pb.box(x - 0.5, y - 0.5, -1.2, x + 0.5, y + 0.5, 0.8, FRAME);
  const g = pb.build(), prop = new THREE.Group(), pp = new PropBatch();
  for (const a of [0, Math.PI / 2]) pp.seg(GOLD, [Math.cos(a) * 1.3, Math.sin(a) * 1.3, 0], [-Math.cos(a) * 1.3, -Math.sin(a) * 1.3, 0]);
  prop.add(pp.build()); prop.position.set(x, y, -1.4); g.add(prop); g.userData.prop = prop;
  return g;
}
function model(): { g: THREE.Group; props: THREE.Group[] } {
  const pb = new PropBatch(); envelope(pb); gondola(pb);
  const g = new THREE.Group(); g.add(pb.build());
  const props: THREE.Group[] = [];
  for (const s of [-1, 1]) { const e = engine(s); g.add(e); props.push(e.userData.prop); }
  return { g, props };
}
/** A frozen airship for the film and galleries. */
export const showcaseAirship = () => model().g;

// ---------- the masts ----------
interface Mast { g: THREE.Group; lamp: THREE.Mesh; sig: string }
const masts = new Map<string, Mast>();
function drawMast(): Mast {
  const pb = new PropBatch(), H = AIRMAST.h;
  for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) pb.seg(FRAME, [x * 1.4, 0, z * 1.4], [x * 0.35, H - 0.6, z * 0.35]);
  for (let y = 1.5; y < H - 0.6; y += 1.5) { const r = 1.4 - (1.05 * y) / (H - 0.6); const c = [[-r, -r], [r, -r], [r, r], [-r, r]]; for (let i = 0; i < 4; i++) { pb.seg(FRAME, [c[i][0], y, c[i][1]], [c[(i + 1) % 4][0], y, c[(i + 1) % 4][1]]); pb.seg(FRAME, [c[i][0], y, c[i][1]], [c[(i + 1) % 4][0], y + 1.5, c[(i + 1) % 4][1]]); } }
  pb.box(-0.5, H - 0.6, -0.5, 0.5, H + 0.2, 0.5, STEEL); // the turning cap
  pb.box(-1.8, 0, 2.2, 0.2, 2.2, 4.2, FRAME); // the winch hut
  for (let y = 0.4; y < H - 0.8; y += 0.5) pb.seg(GOLD, [1.5, y, -0.25], [1.5, y, 0.25]); // the ladder's rungs
  pb.seg(GOLD, [1.5, 0, -0.25], [1.5, H - 0.6, -0.25]); pb.seg(GOLD, [1.5, 0, 0.25], [1.5, H - 0.6, 0.25]);
  const g = pb.build(), lamp = new THREE.Mesh(new THREE.SphereGeometry(0.25, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff5a3c, fog: false }));
  lamp.position.set(0, H + 0.5, 0); g.add(lamp); scene.add(g);
  return { g, lamp, sig: '' };
}
function updateMasts(list: Hub[]) {
  const c = G.char, seen = new Set<string>();
  for (const h of list) {
    if (!hasAmast(h, c.towns, c.outposts)) continue;
    const m = mastAt(c.world, h), x = nearX(m.x, G.pos.x);
    if (worldDist(x, m.z, G.pos.x, G.pos.z) > MAST_R) continue;
    seen.add(h.id);
    let d = masts.get(h.id);
    if (!d) { d = drawMast(); masts.set(h.id, d); }
    d.g.position.set(x, groundAt(x, m.z), m.z);
    d.lamp.visible = !amastWhy(c.world, h, c.towns, c.outposts, c.time) && Math.floor(performance.now() / 700) % 2 === 0;
  }
  for (const [id, d] of masts) if (!seen.has(id)) { scene.remove(d.g); d.g.traverse((o) => (o as THREE.Mesh).geometry?.dispose?.()); masts.delete(id); }
}
/** Where warehouse `id`'s mast is, with the ground at its foot (for mooring). */
function mastOf(id: string, list: Hub[]): { x: number; z: number; a: number; g: number } | null {
  const h = list.find((q) => q.id === id);
  if (!h || !hasAmast(h, G.char.towns, G.char.outposts) || !OW.terrain) return null;
  const m = mastAt(G.char.world, h), x = nearX(m.x, G.pos.x);
  return { x, z: m.z, a: m.a, g: groundAt(x, m.z) };
}

// ---------- the airships ----------
function newLive(a: Airship): Live {
  const md = model();
  scene.add(md.g);
  return { a, g: md.g, props: md.props, x: a.x, y: a.y, z: a.z, yaw: a.yaw, sp: 0, vy: 0, turn: 0, th: 0, heard: null, windT: 0, wind: [0, 0], chargeT: 0, charging: false };
}
function drop(l: Live) { scene.remove(l.g); l.g.traverse((o) => (o as THREE.Mesh).geometry?.dispose?.()); }
function place(l: Live) {
  l.g.position.set(nearX(l.x, G.pos.x), l.y, l.z);
  l.g.rotation.set(0, l.yaw, 0);
  for (const p of l.props) p.rotation.z += l.th * 0.6;
}
/** A point in its frame (u forward, v to the right as seen from behind) in the world. */
function at(l: Live, u: number, v: number): [number, number] {
  const fx = Math.sin(l.yaw), fz = Math.cos(l.yaw);
  return [nearX(l.x, G.pos.x) + fx * u + fz * v, l.z + fz * u - fx * v];
}
const floorY = (l: Live) => l.y - AIRSHIP.below + 0.9;
function fresh(l: Live): Heard | null { const h = l.heard; return h && h.from !== me() && performance.now() - h.at < FRESH ? h : null; }
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
function sync(list: Hub[]) {
  if (!OW.terrain || G.char.loc !== 'overworld') { clearAirships(); return; }
  const seen = new Set<string>();
  for (const a of G.char.airships ?? []) {
    if (Math.hypot(nearX(a.x, G.pos.x) - G.pos.x, a.z - G.pos.z) > DRAW && aboard?.a.id !== a.id) continue;
    seen.add(a.id);
    let l = live.get(a.id);
    if (!l) { l = newLive(a); live.set(a.id, l); }
    l.a = a;
    if (!fresh(l) && aboard !== l && Math.abs(l.sp) < 0.01 && !l.th) { l.x = a.x; l.y = a.y; l.z = a.z; l.yaw = a.yaw; }
  }
  for (const [id, l] of live) if (!seen.has(id)) { if (aboard === l) aboard = null; drop(l); live.delete(id); }
  updateMasts(list);
}
export function clearAirships() {
  aboard = null;
  for (const l of live.values()) drop(l);
  live.clear();
  for (const d of masts.values()) { scene.remove(d.g); d.g.traverse((o) => (o as THREE.Mesh).geometry?.dispose?.()); }
  masts.clear();
}
export function redrawAirships() { scanT = 0; }
let hubList: Hub[] = [];

/** One airship's frame, driven by your game. */
function step(l: Live, dt: number, manned: boolean) {
  const a = l.a, c = G.char, k = G.keys;
  const fwd = manned ? (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0) : 0, turn = manned ? (k.KeyA ? 1 : 0) - (k.KeyD ? 1 : 0) : 0, up = manned ? (k.Space ? 1 : 0) - (k.KeyC ? 1 : 0) : 0;
  if (a.moor) {
    const m = mastOf(a.moor, hubList);
    if (manned && (fwd || up)) { delete a.moor; logLine(tl('You cast off from the mast.')); }
    else if (m) {
      const p = moorPose(m, m.g);
      l.x = p.x; l.y = p.y; l.z = p.z; l.yaw = p.yaw; l.sp = 0; l.vy = 0; l.th = 0; l.turn = 0;
      if ((l.chargeT -= dt) <= 0) { l.chargeT = 1; const h = hubList.find((q) => q.id === a.moor); l.charging = !!h && a.drive === 'cell' && !amastWhy(c.world, h, c.towns, c.outposts, c.time); }
      if (l.charging) chargeAir(a, dt);
      a.x = l.x; a.y = l.y; a.z = l.z; a.yaw = l.yaw;
      place(l); return;
    } else delete a.moor; // its mast is gone
  }
  if ((l.windT -= dt) <= 0) { l.windT = 1; const w = weatherAt(c.world, l.x, l.z, c.time), s = windSpeed(w.wind) * AIRSHIP.wind; l.wind = [Math.cos(w.windDir) * s, Math.sin(w.windDir) * s]; }
  if (manned) l.th += (fwd - l.th) * Math.min(1, dt * 0.8);
  if (!burnAir(a, l.th, dt)) { if (l.th && manned) showToast(a.drive === 'fuel' ? tl('Out of fuel: R to pour in a canister') : tl('The cells are flat: drift to a mast to charge')); l.th = 0; }
  const top = AIRSHIP.speed[a.drive], want = l.th > 0 ? l.th * top : l.th * top * AIRSHIP.back;
  l.sp += (want - l.sp) * Math.min(1, dt * 0.35);
  l.vy += (up * AIRSHIP.climb - l.vy) * Math.min(1, dt * 1.5);
  const dyaw = turn * AIRSHIP.turn * (0.4 + 0.6 * Math.min(1, Math.abs(l.sp) / 4)) * dt;
  l.yaw += dyaw; if (manned) G.yaw += dyaw;
  l.turn = dyaw / Math.max(dt, 1e-3);
  l.x += (Math.sin(l.yaw) * l.sp + l.wind[0]) * dt; l.z += (Math.cos(l.yaw) * l.sp + l.wind[1]) * dt;
  l.y += l.vy * dt;
  // the gondola keeps clear of the ground and the sea under its whole length
  let g = groundAt(l.x, l.z);
  for (const u of [-AIRSHIP.len / 2, AIRSHIP.len / 2]) { const [px, pz] = at(l, u, 0); g = Math.max(g, groundAt(px, pz)); }
  if (l.y < lowest(g)) { l.y = lowest(g); l.vy = Math.max(0, l.vy); }
  if (l.y > SEA.level + AIRSHIP.ceil) { l.y = SEA.level + AIRSHIP.ceil; l.vy = Math.min(0, l.vy); }
  a.x = l.x; a.y = l.y; a.z = l.z; a.yaw = l.yaw;
  place(l);
}
function follow(l: Live, dt: number) {
  const h = l.heard;
  if (!h) { place(l); return; }
  const age = Math.min(1.5, (performance.now() - h.at) / 1000), yaw = h.yaw + h.turn * age;
  const px = nearX(h.x + Math.sin(yaw) * h.sp * age, l.x), pz = h.z + Math.cos(yaw) * h.sp * age, py = h.y + h.vy * age;
  if (Math.hypot(px - l.x, pz - l.z) > 25) { l.x = px; l.y = py; l.z = pz; l.yaw = yaw; }
  else {
    const k = Math.min(1, dt * 5); let dy = yaw - l.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    l.x += (px - l.x) * k; l.y += (py - l.y) * k; l.z += (pz - l.z) * k; l.yaw += dy * k;
    if (aboard === l) G.yaw += dy * k;
  }
  l.sp = h.sp; l.th = h.th;
  place(l);
}
const sendAt = new Map<string, number>();
function tell(l: Live) {
  if (!online() || !net.peers.size) return;
  const helm = aboard === l && seat === 0 ? me() : 0, busy = helm || Math.abs(l.sp) > 0.05 || Math.abs(l.vy) > 0.05 || l.th, now = performance.now();
  if (now < (sendAt.get(l.a.id) ?? 0)) return;
  sendAt.set(l.a.id, now + (busy ? 100 : 1000));
  relay({ t: 'air', id: l.a.id, x: l.x, y: l.y, z: l.z, yaw: l.yaw, sp: l.sp, vy: l.vy, turn: l.turn, th: l.th, helm });
}
onRelay((m: Relay) => {
  if (m.t !== 'air') return;
  const l = live.get(String(m.id));
  if (!l) return;
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  l.heard = { from: m.from, at: performance.now(), x: n(m.x), y: n(m.y), z: n(m.z), yaw: n(m.yaw), sp: n(m.sp), vy: n(m.vy), turn: n(m.turn), th: n(m.th), helm: n(m.helm) };
});

/** Every frame: the airships near you, driven by your game or followed; you at your seat. True while you are aboard. */
export function updateAirships(dt: number): boolean {
  if ((scanT -= dt) <= 0) { scanT = 0.5; hubList = OW.terrain ? hubs(G.char.world, G.char.towns, G.char.outposts) : []; sync(hubList); }
  if (!OW.terrain) { aboard = null; return false; }
  if (aboard && Math.abs(G.pos.x - aboard.x) > WORLD_W / 2) aboard.x += Math.round((G.pos.x - aboard.x) / WORLD_W) * WORLD_W; // the planet's seam
  for (const l of live.values()) {
    if (drives(l)) { step(l, dt, aboard === l && seat === 0); tell(l); }
    else follow(l, dt);
  }
  if ((saveT -= dt) <= 0 && aboard) { saveT = 8; saveChar(); }
  if (!aboard) return false;
  const [sx, sz] = at(aboard, SEAT_U[seat] ?? 0, 0);
  G.pos.set(sx, floorY(aboard), sz); G.vel.set(0, 0, 0); G.onGround = true; G.swimming = false;
  return true;
}
/** The camera: from behind and above, or your seat in the gondola. */
export function airCamera(camera: THREE.PerspectiveCamera) {
  if (!aboard) return;
  if (!third) { camera.position.set(G.pos.x, G.pos.y + EYE, G.pos.z); return; }
  const g = aboard.g.position, cy = Math.cos(G.pitch), f = new THREE.Vector3(-Math.sin(G.yaw) * cy, Math.sin(G.pitch), -Math.cos(G.yaw) * cy);
  camera.position.set(g.x, g.y + 6, g.z).addScaledVector(f, -48);
  const T = OW.terrain;
  if (T) camera.position.y = Math.max(camera.position.y, groundAt(camera.position.x, camera.position.z) + 2);
}
export function toggleAirView() { if (aboard) third = !third; }

// ---------- getting in and out ----------
/** The gondola hangs within reach of the ground (or it is moored). */
function low(l: Live): boolean {
  if (l.a.moor) return true;
  const [x, z] = at(l, 0, 0), w = OW.terrain!.water(x, z);
  return floorY(l) - OW.terrain!.heightAt(x, z) < 3.5 && (!w || w.depth < 1);
}
/** Its helm is held by someone else. */
const helmTaken = (l: Live) => { const h = fresh(l); return !!h?.helm && h.helm !== me(); };
/** The seats others sit in (from their figures' spots). */
function seatsTaken(l: Live): Set<number> {
  const out = new Set<number>();
  if (online()) for (const p of net.peers.values()) { const b = p.st?.boat; if (b && b[0] === l.a.id && b[4] >= 0) out.add(b[4]); }
  if (helmTaken(l)) out.add(0);
  return out;
}
/** The airship whose gondola you stand by (not aboard). */
export function nearAirship(): Airship | null {
  if (aboard || G.char.loc !== 'overworld' || !OW.terrain) return null;
  for (const l of live.values()) {
    const [x, z] = at(l, 0, 0), fy = floorY(l);
    if (Math.hypot(G.pos.x - x, G.pos.z - z) < AIRSHIP.gond.len / 2 + 2.5 && G.pos.y > fy - 4 && G.pos.y < fy + 1.5) return l.a;
  }
  return null;
}
export function airPrompt(a: Airship): string {
  const l = live.get(a.id);
  if (!l) return '';
  const taken = seatsTaken(l);
  if (taken.size >= AIRSHIP.seats) return tl('The airship\'s gondola is full');
  return taken.has(0) ? tl('E — climb into the gondola and ride · F — its hold') : tl('E — climb into the gondola and take the helm · F — its hold');
}
export function boardAir(a: Airship) {
  const l = live.get(a.id);
  if (!l || aboard) return;
  const taken = seatsTaken(l);
  const s = [0, 1, 2, 3].find((i) => !taken.has(i));
  if (s === undefined) { showToast(tl('The airship\'s gondola is full')); return; }
  aboard = l; seat = s; third = true; G.yaw = l.yaw + Math.PI;
  const [now, , unit] = airEnergy(a);
  logLine(s === 0 ? TL`You take the helm of the airship: ${Math.round(now)} ${unit}, about ${airRangeKm(a).toFixed(0)} km. W/S throttle, A/D turn, Space climb, C sink, V the view.` : tl('You take a seat in the gondola.'));
}
/** The mast whose head is by the nose, if any (for tying up). */
function mastNear(l: Live): Hub | null {
  const [nx, nz] = at(l, AIRSHIP.len / 2, 0);
  for (const h of hubList) {
    if (!hasAmast(h, G.char.towns, G.char.outposts)) continue;
    const m = mastAt(G.char.world, h), x = nearX(m.x, nx), top = groundAt(x, m.z) + AIRMAST.h;
    if (Math.hypot(nx - x, nz - m.z) < 16 && Math.abs(l.y - top) < 8) return h;
  }
  return null;
}
/** E aboard: tie up at a mast, step out low down, leave the helm, or take a free helm. */
export function airUse() {
  const l = aboard;
  if (!l) return;
  if (seat === 0 && !l.a.moor) {
    const m = mastNear(l);
    if (m && Math.abs(l.sp) < 3) { l.a.moor = m.id; l.th = 0; l.sp = 0; l.vy = 0; logLine(TL`You tie up at the mast of ${m.name}.`); saveChar(); return; }
  }
  if (low(l)) { stepOut(l); return; }
  if (seat === 0) { const taken = seatsTaken(l), s = [1, 2, 3].find((i) => !taken.has(i)); if (s !== undefined) { seat = s; logLine(tl('You leave the helm: she holds her course and throttle. Find a mast or come down low to get out.')); } return; }
  if (!seatsTaken(l).has(0)) { seat = 0; logLine(tl('You take the helm.')); return; }
  logLine(tl('Too high to get out: ask whoever has the helm to come down or tie up at a mast.'));
}
function stepOut(l: Live) {
  const T = OW.terrain!;
  for (const v of [AIRSHIP.gond.w / 2 + 1.4, -AIRSHIP.gond.w / 2 - 1.4]) {
    const [x, z] = at(l, 0, v), w = T.water(x, z);
    if (w && w.depth > 1) continue;
    G.pos.set(x, T.heightAt(x, z) + 0.05, z); break;
  }
  aboard = null; seat = 0; G.vel.set(0, 0, 0);
  logLine(tl('You climb down out of the gondola.'));
  saveChar();
}
/** Where you sit (for the others' figures): [airship id, u, v, feet over its middle, seat]. */
export function myAirSpot(): [string, number, number, number, number] | undefined {
  return aboard ? [aboard.a.id, SEAT_U[seat] ?? 0, 0, G.pos.y - aboard.y, seat] : undefined;
}
/** Where a seat of an airship drawn here is now. */
export function airSeatPoint(id: string, u: number, v: number, h: number): [number, number, number] | null {
  const l = live.get(id);
  if (!l) return null;
  const [x, z] = at(l, u, v);
  return [x, l.y + h, z];
}
/** The HUD line aboard. */
export function airHint(): string | null {
  const l = aboard;
  if (!l) return null;
  const a = l.a, [now, full, unit] = airEnergy(a), g = OW.terrain ? groundAt(l.x, l.z) : 0;
  const head = TL`Airship · ${Math.round(Math.abs(l.sp) * 3.6)} km/h · ${Math.round(floorY(l) - g)} m up · ${Math.round(now)}/${full} ${unit} (~${airRangeKm(a).toFixed(0)} km)`;
  if (a.moor) return head + ' · ' + (l.charging ? tl('moored, charging') : tl('moored')) + (seat === 0 ? tl(' · W or Space casts off · E get out') : tl(' · E get out'));
  if (seat !== 0) return head + (low(l) ? tl(' · E get out') : seatsTaken(l).has(0) ? '' : tl(' · E take the helm'));
  const m = mastNear(l);
  return head + (m ? TL` · E tie up at ${m.name}` : low(l) ? tl(' · E get out') : tl(' · E leave the helm'));
}
export function airHold(a: Airship): Container {
  const box = (G.char.containers[a.id] ??= { items: Array(AIRSHIP.hold).fill(null), gold: 0 });
  while (box.items.length < AIRSHIP.hold) box.items.push(null);
  return box;
}
/** F: the hold of the airship you sit in or stand by. */
export function openAirHold(): boolean {
  const a = aboard?.a ?? nearAirship();
  if (!a) return false;
  openTransfer({ title: AIRSHIP.name, subtitle: tl('The hold'), boxLabel: tl('Hold'), box: airHold(a) });
  return true;
}
/** R aboard or beside a diesel airship: pour a canister from the hold or your backpack. */
export function refuelAir(): boolean {
  const a = aboard?.a ?? nearAirship();
  if (!a) return false;
  if (a.drive !== 'fuel') { logLine(tl('This airship runs on cells: it charges moored at a working mast.')); return true; }
  if (a.fuel > AIRSHIP.fuel.tank - AIRSHIP.fuel.can * 0.5) { logLine(tl('The tank is nearly full.')); return true; }
  const hold = airHold(a), i = hold.items.findIndex((x) => x?.k === 'fuel');
  if (i >= 0) { const x = hold.items[i]!; x.n--; if (x.n <= 0) hold.items[i] = null; }
  else if (!takeOne('fuel')) { logLine(tl('You have no Fuel Canister, in the hold or your backpack.')); return true; }
  fuelAir(a, AIRSHIP.fuel.can);
  logLine(TL`You pour a canister into the tank: ${Math.round(a.fuel)} of ${AIRSHIP.fuel.tank} litres.`);
  saveChar(); return true;
}
/** For the maps: every airship's place and heading. */
export const airshipsForMap = (): [number, number, number][] => (G.char.airships ?? []).map((a) => { const l = live.get(a.id); return l ? [l.x, l.z, l.yaw] : [a.x, a.z, a.yaw]; });
