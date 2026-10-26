// (0.256, PLAN_LOTNICTWA.md stage F3, part 1) Airships in the air and the mooring masts beside the warehouses.
//
// The masts: drawn by every warehouse that has one (gen/airships.ts `mastAt`): a braced lattice mast, a turning cap,
// a ladder, a winch hut; a lamp at the head while it works. The airships (`Char.airships`, shared): an envelope with
// four tail fins, a gondola under it and two engine pods whose propellers turn with the throttle.
//
// Flying: E beside the gondola (moored at a mast or hovering low) gets in; the helm is the first seat, the others ride.
// At the helm W/S set the throttle (it stays where you leave it; 0.257: it stops at zero, press again to go on past it), A/D turn, Space climbs and C sinks; the wind
// (gen/weather.ts) pushes it off its course. Diesel burns from the tank (R pours a canister), cells drain and charge
// while moored at a working mast. E at the helm: tie up at a mast whose head is near the nose (slowly), step out when
// the gondola hangs low over the ground, else leave the helm and ride; E in another seat: step out low, or take a free
// helm. F opens the hold. V switches between the view from behind and the gondola.
//
// Together (online): like the boats (world/boats.ts), one game drives each airship (`drives`): whoever holds its helm,
// else the player with the lowest id near it; it moves it, writes the shared airship and tells the others ten times a
// second ({t:'air'} relay), whose games ease after it (`follow`) and carry their passengers along. The others' figures
// aboard are drawn at their seats (`myAirSpot` / `airSeatPoint` through world/peers.ts).
//
// (0.257, F3 part 2) The gondola is walked like a ship's deck: E in a seat stands you up, and you walk about it in
// flight (`gondolaFloor` in G.floor, its walls in G.obstacle `gondolaHit`, carried along with it: `carry`); E by the
// helm or a seat sits you down. Its doors (amidships on both sides) are open only while it hangs low or is moored, so
// you walk in and out there. Hovering slowly within `AIRSHIP.ladder` m of dry ground it lets a rope ladder down from
// the right-hand door (`ladderDown`, the same on every game from the shared pose): E at the door climbs down, E at its
// foot climbs up (`climb`: W up, S down, Space lets go). In the air it bumps into buildings, tall trees' crowns, the
// old plants, lighthouses and the other solid things foes walk into (`blockedAt`: probes round the envelope and the
// gondola); the driver's game checks it and the others follow its pose. The others see you where you stand or climb.
import * as THREE from 'three';
import { scene } from './render';
import { PropBatch } from './props';
import { G } from '../game';
import { OW, foeBody, crownHit } from './overworld';
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
/** The gondola's floor stands this far over its bottom. */
const FLOOR = 0.5;
/** Airships are drawn within this distance (m); the nearest player within `NEAR` drives one nobody steers. */
const DRAW = 1500, NEAR = 900, MAST_R = 700;
/** A message heard recently enough to go by (ms). */
const FRESH = 3000;
interface Heard { from: number; at: number; x: number; y: number; z: number; yaw: number; sp: number; vy: number; turn: number; th: number; helm: number }
interface Live { a: Airship; g: THREE.Group; props: THREE.Group[]; lad: THREE.LineSegments; stuck: boolean; bumpT: number; notch: boolean; x: number; y: number; z: number; yaw: number; sp: number; vy: number; turn: number; th: number; heard: Heard | null; windT: number; wind: [number, number]; chargeT: number; charging: boolean }
const live = new Map<string, Live>();
let aboard: Live | null = null, seat = 0, third = true, scanT = 0, saveT = 0;
/** (0.257) On the rope ladder: `d` = your feet's metres under the gondola's floor. */
let climb: { l: Live; d: number } | null = null;
/** Seated in an airship or on its ladder (the armed, tool and camera rules). */
export const inAir = () => !!aboard || !!climb;
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
  const { len, w, h } = AIRSHIP.gond, y0 = -AIRSHIP.below, f = y0 + FLOOR, y1 = y0 + h, D = AIRSHIP.door;
  pb.box(-w / 2, y0, -len / 2, w / 2, f, len / 2, FRAME); // the floor
  for (const x of [-w / 2, w / 2]) {
    for (const u of [-len / 2, -len / 4, -D, D, len / 4, len / 2]) pb.seg(FRAME, [x, f, u], [x, y1, u]); // posts, the door's jambs amidships
    pb.seg(FRAME, [x, y1, -len / 2], [x, y1, len / 2]);
    for (const [u0, u1] of [[-len / 2, -D], [D, len / 2]]) { pb.seg(FRAME, [x, f + 1.05, u0], [x, f + 1.05, u1]); pb.seg(GOLD, [x, f + 1.9, u0], [x, f + 1.9, u1]); } // the rail and the window band
    pb.seg(FRAME, [x, f + 2.1, -D], [x, f + 2.1, D]); // the door's lintel
  }
  for (const u of [-len / 2, len / 2]) { pb.seg(FRAME, [-w / 2, f + 1.05, u], [w / 2, f + 1.05, u]); pb.seg(GOLD, [-w / 2, f + 1.9, u], [w / 2, f + 1.9, u]); }
  for (const u of SEAT_U) pb.box(-0.35, f, u - 0.3, 0.35, f + 0.45, u + 0.3, STEEL); // the seats
  pb.box(-0.6, f, SEAT_U[0] + 0.7, 0.6, f + 1, SEAT_U[0] + 1, FRAME); // the helm's console
  pb.box(-w / 2, y1, -len / 2, w / 2, y1 + 0.2, len / 2, FRAME);
  // the struts up to the envelope
  for (const u of [-len / 2, len / 2]) for (const x of [-w / 2, w / 2]) pb.seg(STEEL, [x, y1 + 0.2, u], [x * 0.6, -AIRSHIP.r * 0.92, u * 1.2]);
}
function engine(side: number): THREE.Group {
  const pb = new PropBatch(), x = side * (AIRSHIP.gond.w / 2 + 2.4), y = -AIRSHIP.below + 2.6;
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
/** (0.257) The rope ladder: rope and rung segments every `RUNG` m down from the right-hand door (local x = v, z = u), shown as far as it hangs (setDrawRange). */
const RUNG = 0.4, LAD_V = AIRSHIP.gond.w / 2 + 0.3, LAD_MAT = new THREE.LineBasicMaterial({ color: GOLD });
function ladder(): THREE.LineSegments {
  const p: number[] = [], top = -AIRSHIP.below + FLOOR;
  for (let i = 0; i * RUNG < AIRSHIP.ladder + 1; i++) {
    const a = top - i * RUNG, b = a - RUNG;
    p.push(LAD_V, a, -0.25, LAD_V, b, -0.25, LAD_V, a, 0.25, LAD_V, b, 0.25, LAD_V, b, -0.25, LAD_V, b, 0.25);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  const l = new THREE.LineSegments(geo, LAD_MAT); l.frustumCulled = false; l.visible = false;
  return l;
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
    const m = mastAt(c.world, h, c.towns), x = nearX(m.x, G.pos.x);
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
  const m = mastAt(G.char.world, h, G.char.towns), x = nearX(m.x, G.pos.x);
  return { x, z: m.z, a: m.a, g: groundAt(x, m.z) };
}

// ---------- the airships ----------
function newLive(a: Airship): Live {
  const md = model(), lad = ladder();
  md.g.add(lad); scene.add(md.g);
  const l: Live = { a, g: md.g, props: md.props, lad, stuck: true, bumpT: 0, notch: false, x: a.x, y: a.y, z: a.z, yaw: a.yaw, sp: 0, vy: 0, turn: 0, th: 0, heard: null, windT: 0, wind: [0, 0], chargeT: 0, charging: false };
  place(l); // (0.257) in place from the start: whoever stands in its gondola is carried from where it is
  return l;
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
/** A world point in its frame: [u forward, v to the right]. */
function local(l: Live, x: number, z: number): [number, number] {
  const dx = nearX(x, l.x) - l.x, dz = z - l.z, fx = Math.sin(l.yaw), fz = Math.cos(l.yaw);
  return [dx * fx + dz * fz, dx * fz - dz * fx];
}
const floorY = (l: Live) => l.y - AIRSHIP.below + FLOOR;
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
  for (const [id, l] of live) if (!seen.has(id)) { if (aboard === l) aboard = null; if (climb?.l === l) climb = null; drop(l); live.delete(id); }
  updateMasts(list);
}
export function clearAirships() {
  aboard = null; climb = null;
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
    if (manned && (fwd || up)) { delete a.moor; l.stuck = true; logLine(tl('You cast off from the mast.')); }
    else if (m) {
      const p = moorPose(m, m.g), [gx, gz] = [p.x - Math.sin(p.yaw) * SEAT_U[1], p.z - Math.cos(p.yaw) * SEAT_U[1]];
      l.x = p.x; l.y = Math.max(p.y, groundAt(gx, gz) + AIRSHIP.below); l.z = p.z; // (0.257) the gondola stands on the ground, never in it l.yaw = p.yaw; l.sp = 0; l.vy = 0; l.th = 0; l.turn = 0;
      if ((l.chargeT -= dt) <= 0) { l.chargeT = 1; const h = hubList.find((q) => q.id === a.moor); l.charging = !!h && a.drive === 'cell' && !amastWhy(c.world, h, c.towns, c.outposts, c.time); }
      if (l.charging) chargeAir(a, dt);
      a.x = l.x; a.y = l.y; a.z = l.z; a.yaw = l.yaw;
      place(l); return;
    } else delete a.moor; // its mast is gone
  }
  if ((l.windT -= dt) <= 0) { l.windT = 1; const w = weatherAt(c.world, l.x, l.z, c.time), s = windSpeed(w.wind) * AIRSHIP.wind; l.wind = [Math.cos(w.windDir) * s, Math.sin(w.windDir) * s]; }
  if (manned) { // (0.257) the throttle stops at a notch at zero: a fresh press goes on past it (so you can hover)
    const nt = l.th + (fwd - l.th) * Math.min(1, dt * 0.8);
    if (fwd && l.th && Math.sign(nt) !== Math.sign(l.th)) { l.th = 0; l.notch = true; }
    else if (!(fwd && l.notch)) l.th = Math.abs(nt) < 0.004 && !fwd ? 0 : nt;
    if (!fwd) l.notch = false;
  }
  const was = { x: l.x, y: l.y, z: l.z, yaw: l.yaw };
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
  // (0.257) it bumps into what stands in its way (but may always move out of something it is caught in)
  const stuck = blockedAt(l);
  if (stuck && !l.stuck) {
    if (manned) G.yaw -= l.yaw - was.yaw;
    l.x = was.x; l.y = was.y; l.z = was.z; l.yaw = was.yaw; l.sp *= -0.25; l.vy = 0; l.th = 0; l.turn = 0;
    l.stuck = blockedAt(l); // caught where it was too (trees loaded in round it): let it move out next frame
    if (manned && performance.now() > l.bumpT) { l.bumpT = performance.now() + 2500; showToast(tl('The airship bumps into something: steer clear or climb')); }
  } else l.stuck = stuck;
  a.x = l.x; a.y = l.y; a.z = l.z; a.yaw = l.yaw;
  place(l);
}
/** Probes round the envelope and the gondola as [u, v, dy from its middle, r]. */
const PROBES: [number, number, number, number][] = (() => {
  const { len, w } = AIRSHIP.gond, b = -AIRSHIP.below, R = AIRSHIP.r, out: [number, number, number, number][] = [];
  for (const u of [-len / 2, len / 2]) for (const v of [-w / 2, w / 2]) out.push([u, v, b, 0.4]);
  for (const u of [-11, 0, 11]) out.push([u, 0, -R * 0.8, 2.2]);
  for (const v of [-R * 0.85, R * 0.85]) out.push([0, v, -0.5, 1.2]);
  out.push([AIRSHIP.len / 2 - 2.5, 0, -0.5, 1.6], [-AIRSHIP.len / 2 + 3, 0, -0.5, 1.6]);
  return out;
})();
/** (0.257) Something solid is where its envelope or gondola is. */
function blockedAt(l: Live): boolean {
  for (const [u, v, dy, r] of PROBES) {
    const [x, z] = at(l, u, v), y = l.y + dy;
    if (foeBody(x, y, z, r) || crownHit(x, y, z, r)) return true;
  }
  return false;
}
function follow(l: Live, dt: number) {
  l.stuck = true; // (0.257) if this game takes it over, it may first move out of whatever it is caught in
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

// ---------- (0.257) walking the gondola and the rope ladder ----------
/** The ground (or water's floor) under a point and whether deep water is there. */
function under(x: number, z: number): { h: number; wet: boolean } { const T = OW.terrain!, w = T.water(x, z); return { h: T.heightAt(x, z), wet: !!w && w.depth > 1 }; }
/** The rope ladder hangs: hovering slowly, not low enough to walk out, within `AIRSHIP.ladder` of dry ground. */
function ladderDown(l: Live): boolean {
  if (l.a.moor || Math.abs(l.sp) > AIRSHIP.slow || low(l)) return false;
  const [x, z] = at(l, 0, LAD_V), g = under(x, z);
  return !g.wet && floorY(l) - g.h <= AIRSHIP.ladder;
}
/** The gondola whose floor you stand on (not seated), if any. */
function gondolaUnder(): Live | null {
  if (aboard || climb) return null;
  for (const l of live.values()) {
    const [u, v] = local(l, G.pos.x, G.pos.z), f = floorY(l);
    if (Math.abs(u) < AIRSHIP.gond.len / 2 && Math.abs(v) < AIRSHIP.gond.w / 2 + 0.05 && G.pos.y > f - 0.3 && G.pos.y < f + 1) return l;
  }
  return null;
}
/** Carry whoever stands in the gondola along with its move from `was` (its group's place and yaw before). */
function carry(l: Live, was: { x: number; y: number; z: number; yaw: number }) {
  const dx = G.pos.x - was.x, dz = G.pos.z - was.z, fx = Math.sin(was.yaw), fz = Math.cos(was.yaw);
  const u = dx * fx + dz * fz, v = dx * fz - dz * fx, nx = Math.sin(l.yaw), nz = Math.cos(l.yaw), p = l.g.position;
  G.pos.x = p.x + nx * u + nz * v; G.pos.z = p.z + nz * u - nx * v; G.pos.y += p.y - was.y; G.yaw += l.yaw - was.yaw;
}
/** For G.floor: a gondola's floor under you, from above. */
export function gondolaFloor(x: number, y: number, z: number): number {
  let best = -Infinity;
  for (const l of live.values()) {
    const [u, v] = local(l, x, z), f = floorY(l);
    if (Math.abs(u) < AIRSHIP.gond.len / 2 - 0.1 && Math.abs(v) < AIRSHIP.gond.w / 2 - 0.05 && y > f - 0.9) best = Math.max(best, f);
  }
  return best;
}
/** For G.obstacle: a gondola's walls and ends, its doors open only while it hangs low or is moored. */
export function gondolaHit(x: number, y: number, z: number, r: number): boolean {
  const L = AIRSHIP.gond.len / 2, W = AIRSHIP.gond.w / 2;
  for (const l of live.values()) {
    const f = floorY(l);
    if (y < f - 0.6 || y > f + 2.6) continue;
    const [u, v] = local(l, x, z);
    if (Math.abs(u) > L + r || Math.abs(v) > W + r) continue;
    if (Math.abs(u) > L - 0.15 - r) return true; // the ends
    if (Math.abs(v) > W - 0.15 - r && !(Math.abs(u) < AIRSHIP.door - r && low(l))) return true; // the sides and the shut doors
  }
  return false;
}
/** You stand at the right-hand door of a gondola whose ladder is down. */
function atLadderTop(l: Live): boolean {
  const [u, v] = local(l, G.pos.x, G.pos.z);
  return Math.abs(u) < AIRSHIP.door + 0.3 && v > AIRSHIP.gond.w / 2 - 0.9 && ladderDown(l);
}
/** You stand at the foot of a gondola's hanging ladder. */
function atLadderFoot(l: Live): boolean {
  if (!ladderDown(l)) return false;
  const [x, z] = at(l, 0, LAD_V);
  return Math.hypot(G.pos.x - x, G.pos.z - z) < 1.8 && G.pos.y < under(x, z).h + 2 && G.pos.y < floorY(l) - 2;
}
function startClimb(l: Live, d: number) {
  climb = { l, d }; G.vel.set(0, 0, 0);
  logLine(d > 0 ? tl('You take hold of the rope ladder: W up, S down, Space lets go.') : tl('You swing out onto the rope ladder: S down, W back up, Space lets go.'));
}
/** On the ladder: W up, S down; off at the bottom onto the ground, at the top into the gondola. */
function updateClimb(dt: number) {
  const c = climb!, l = c.l, k = G.keys, f = floorY(l), [x, z] = at(l, 0, LAD_V), g = under(x, z).h;
  if (k.Space) { climb = null; logLine(tl('You let go of the ladder.')); return; }
  const dir = (k.KeyS ? 1 : 0) - (k.KeyW ? 1 : 0) + G.stick.dy;
  c.d += dir * AIRSHIP.climbs * dt;
  const bottom = Math.min(AIRSHIP.ladder, f - g);
  if (c.d >= bottom - 0.02 && f - g <= AIRSHIP.ladder + 0.5) { // down on the ground, a step away from the ladder
    const [ox, oz] = at(l, 0, LAD_V + 0.8); climb = null;
    G.pos.set(ox, under(ox, oz).h + 0.05, oz); G.vel.set(0, 0, 0);
    logLine(tl('You step off the rope ladder.')); saveChar(); return;
  }
  c.d = Math.min(c.d, bottom);
  if (c.d <= 0) { // in at the door
    const [ix, iz] = at(l, 0, AIRSHIP.gond.w / 2 - 0.7); climb = null;
    G.pos.set(ix, f, iz); G.vel.set(0, 0, 0); G.onGround = true;
    logLine(tl('You climb in at the gondola\'s door.')); return;
  }
  G.pos.set(x, f - c.d, z); G.vel.set(0, 0, 0); G.onGround = true; G.swimming = false;
}
/** The ladder of each airship drawn here, as far down as it hangs. */
function showLadder(l: Live) {
  const [x, z] = at(l, 0, LAD_V), f = floorY(l), down = ladderDown(l) || climb?.l === l;
  l.lad.visible = down;
  if (down) l.lad.geometry.setDrawRange(0, Math.min(Math.ceil((AIRSHIP.ladder + 1) / RUNG), Math.ceil(Math.max(1, f - under(x, z).h) / RUNG)) * 6);
}

/** Every frame: the airships near you, driven by your game or followed; you at your seat, in the gondola or on its ladder. True while you are seated or climbing. */
export function updateAirships(dt: number): boolean {
  if ((scanT -= dt) <= 0) { scanT = 0.5; hubList = OW.terrain ? hubs(G.char.world, G.char.towns, G.char.outposts) : []; sync(hubList); }
  if (!OW.terrain) { aboard = null; climb = null; return false; }
  if (aboard && Math.abs(G.pos.x - aboard.x) > WORLD_W / 2) aboard.x += Math.round((G.pos.x - aboard.x) / WORLD_W) * WORLD_W; // the planet's seam
  const deck = gondolaUnder(), was = deck ? { x: deck.g.position.x, y: deck.g.position.y, z: deck.g.position.z, yaw: deck.yaw } : null;
  for (const l of live.values()) {
    if (drives(l)) { step(l, dt, aboard === l && seat === 0); tell(l); }
    else follow(l, dt);
    showLadder(l);
  }
  if (deck && was) carry(deck, was);
  if ((saveT -= dt) <= 0 && (aboard || deck || climb)) { saveT = 8; saveChar(); }
  if (climb) { updateClimb(dt); return !!climb; }
  if (!aboard) return false;
  const [sx, sz] = at(aboard, SEAT_U[seat] ?? 0, 0);
  G.pos.set(sx, floorY(aboard), sz); G.vel.set(0, 0, 0); G.onGround = true; G.swimming = false;
  return true;
}
/** The camera: from behind and above, or your seat in the gondola. */
export function airCamera(camera: THREE.PerspectiveCamera) {
  if (climb || (aboard && !third)) { camera.position.set(G.pos.x, G.pos.y + EYE, G.pos.z); return; }
  if (!aboard) return;
  const g = aboard.g.position, cy = Math.cos(G.pitch), f = new THREE.Vector3(-Math.sin(G.yaw) * cy, Math.sin(G.pitch), -Math.cos(G.yaw) * cy);
  camera.position.set(g.x, g.y + 6, g.z).addScaledVector(f, -48);
  const T = OW.terrain;
  if (T) camera.position.y = Math.max(camera.position.y, groundAt(camera.position.x, camera.position.z) + 2);
}
export function toggleAirView() { if (aboard) third = !third; }

// ---------- getting in and out ----------
/** The gondola hangs within reach of the ground (or it is moored): its doors are open. */
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
/** (0.257) Standing in the gondola: the free seat nearest you (the helm first when you stand by it), or -1. */
function seatHere(l: Live): number {
  const [u] = local(l, G.pos.x, G.pos.z), taken = seatsTaken(l);
  let best = -1, bd = 1.3;
  SEAT_U.forEach((su, i) => { const d = Math.abs(u - su); if (!taken.has(i) && d < bd) { bd = d; best = i; } });
  return best;
}
/** The airship whose gondola you stand by or in, or at the foot of whose ladder you stand (not seated). */
export function nearAirship(): Airship | null {
  if (aboard || climb || G.char.loc !== 'overworld' || !OW.terrain) return null;
  const deck = gondolaUnder();
  if (deck) return deck.a;
  for (const l of live.values()) {
    if (atLadderFoot(l)) return l.a;
    const [x, z] = at(l, 0, 0), fy = floorY(l);
    if (Math.hypot(G.pos.x - x, G.pos.z - z) < AIRSHIP.gond.len / 2 + 2.5 && G.pos.y > fy - 4 && G.pos.y < fy + 1.5) return l.a;
  }
  return null;
}
/** The ship's state in a few words: speed, height over the ground, energy. */
function status(l: Live): string {
  const [now, full, unit] = airEnergy(l.a), g = OW.terrain ? groundAt(l.x, l.z) : 0;
  return TL`Airship · ${Math.round(Math.abs(l.sp) * 3.6)} km/h · ${Math.round(floorY(l) - g)} m up · ${Math.round(now)}/${full} ${unit} (~${airRangeKm(l.a).toFixed(0)} km)`;
}
export function airPrompt(a: Airship): string {
  const l = live.get(a.id);
  if (!l) return '';
  if (gondolaUnder() === l) { // walking about it
    if (atLadderTop(l)) return status(l) + tl(' · E — climb down the rope ladder');
    const s = seatHere(l);
    return status(l) + (s === 0 ? tl(' · E — take the helm') : s > 0 ? tl(' · E — sit down') : '') + tl(' · F — its hold');
  }
  if (atLadderFoot(l)) return tl('E — climb the rope ladder up to the gondola');
  const taken = seatsTaken(l);
  if (taken.size >= AIRSHIP.seats) return tl('The airship\'s gondola is full');
  return taken.has(0) ? tl('E — climb into the gondola and ride · F — its hold') : tl('E — climb into the gondola and take the helm · F — its hold');
}
/** E by an airship: climb its ladder (up from its foot, down from its door), sit in the gondola where you stand in it, or climb in from beside it. */
export function boardAir(a: Airship) {
  const l = live.get(a.id);
  if (!l || aboard || climb) return;
  const deck = gondolaUnder() === l;
  if (deck && atLadderTop(l)) { startClimb(l, 0.05); return; }
  if (!deck && atLadderFoot(l)) { const [x, z] = at(l, 0, LAD_V); startClimb(l, Math.max(0.1, floorY(l) - under(x, z).h - 0.05)); return; }
  const taken = seatsTaken(l);
  const s = deck ? seatHere(l) : [0, 1, 2, 3].find((i) => !taken.has(i));
  if (s === undefined || s < 0) { if (!deck) showToast(tl('The airship\'s gondola is full')); return; }
  aboard = l; seat = s; third = true; G.yaw = l.yaw + Math.PI;
  const [now, , unit] = airEnergy(a);
  logLine(s === 0 ? TL`You take the helm of the airship: ${Math.round(now)} ${unit}, about ${airRangeKm(a).toFixed(0)} km. W/S throttle, A/D turn, Space climb, C sink, V the view, E stand up.` : tl('You take a seat in the gondola. E stands you up again.'));
}
/** The mast whose head is by the nose, if any (for tying up). */
function mastNear(l: Live): Hub | null {
  const [nx, nz] = at(l, AIRSHIP.len / 2, 0);
  for (const h of hubList) {
    if (!hasAmast(h, G.char.towns, G.char.outposts)) continue;
    const m = mastAt(G.char.world, h, G.char.towns), x = nearX(m.x, nx), top = groundAt(x, m.z) + AIRMAST.h;
    if (Math.hypot(nx - x, nz - m.z) < 16 && Math.abs(l.y - top) < 8) return h;
  }
  return null;
}
/** E seated: tie up at a mast (at the helm), else stand up and walk about the gondola (its doors open while it hangs low or is moored). */
export function airUse() {
  const l = aboard;
  if (!l) return;
  if (seat === 0 && !l.a.moor) {
    const m = mastNear(l);
    if (m && Math.abs(l.sp) < 3) { l.a.moor = m.id; l.th = 0; l.sp = 0; l.vy = 0; logLine(TL`You tie up at the mast of ${m.name}.`); saveChar(); return; }
  }
  const [x, z] = at(l, SEAT_U[seat] ?? 0, 0.6);
  aboard = null; G.pos.set(x, floorY(l), z); G.vel.set(0, 0, 0); G.onGround = true;
  logLine(seat === 0 ? tl('You leave the helm: she holds her course and throttle.') + (low(l) ? tl(' The doors are open.') : ladderDown(l) ? tl(' The rope ladder hangs from the right-hand door.') : '') : tl('You stand up in the gondola.'));
  seat = 0;
}
/** Where you are aboard (for the others' figures): [airship id, u, v, feet over its middle, seat or -1 standing / climbing]. */
export function myAirSpot(): [string, number, number, number, number] | undefined {
  if (aboard) return [aboard.a.id, SEAT_U[seat] ?? 0, 0, G.pos.y - aboard.y, seat];
  if (climb) return [climb.l.a.id, 0, LAD_V, G.pos.y - climb.l.y, -1];
  const d = gondolaUnder();
  if (!d) return undefined;
  const [u, v] = local(d, G.pos.x, G.pos.z);
  return [d.a.id, u, v, G.pos.y - d.y, -1];
}
/** Where a seat of an airship drawn here is now. */
export function airSeatPoint(id: string, u: number, v: number, h: number): [number, number, number] | null {
  const l = live.get(id);
  if (!l) return null;
  const [x, z] = at(l, u, v);
  return [x, l.y + h, z];
}
/** (0.258) Someone is in or on the airship `id` (seated, standing in the gondola or on its ladder: you or another player). */
export function airOccupied(id: string): boolean {
  if (aboard?.a.id === id || climb?.l.a.id === id || gondolaUnder()?.a.id === id) return true;
  return online() && [...net.peers.values()].some((p) => p.st?.boat?.[0] === id);
}
/** The HUD line seated or on the ladder. */
export function airHint(): string | null {
  if (climb) return tl('Rope ladder · W up · S down · Space let go');
  const l = aboard;
  if (!l) return null;
  const a = l.a, head = status(l);
  if (a.moor) return head + ' · ' + (l.charging ? tl('moored, charging') : tl('moored')) + (seat === 0 ? tl(' · W or Space casts off · E stand up') : tl(' · E stand up'));
  if (seat !== 0) return head + tl(' · E stand up');
  const m = mastNear(l);
  return head + (m ? TL` · E tie up at ${m.name}` : tl(' · E stand up'));
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
/** (tests and debugging) the airships drawn here. */
export const liveAirships = () => live;
