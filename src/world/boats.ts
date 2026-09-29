// Your boats (gen/boats.ts) on the water: drawn near you, rowed from the thwart. E beside a boat gets in, E aboard
// steps out (onto a pier, a bank or the beach nearby; with nowhere dry, a second E drops you into the water);
// F opens the hold (beside it or aboard); V switches between the seat and a view from behind.
// Rowing (the rowboat, a sailboat's spare oars): W pulls, S backs water, A/D turn (on the spot too, one oar against
// the other); it costs stamina, out of breath you row weakly. Sailing: Space raises / lowers the sail, W/S let the
// sheet out / haul it in, A/D the rudder; the wind (gen/weather.ts) drives it by the point of sail and the trim.
// The motor boat: W/S throttle and reverse, A/D steer, it burns fuel, R pours in a canister. A river's current carries
// every boat; it runs aground where the water is shallower than its draught and keel, will not go under a pier, and a
// sailboat's mast will not pass under a bridge. The saved boat (`char.boats`) follows it.
import * as THREE from 'three';
import { scene } from './render';
import { PropBatch } from './props';
import { G } from '../game';
import { OW } from './overworld';
import { nearX, WORLD_W } from '../gen/regions';
import { BOATS, floats, windAngle, windSpeed, sailSpeed, trim, bestSheet, pointOfSail, type Boat, type BoatKind } from '../gen/boats';
import { weatherAt } from '../gen/weather';
import { STAMINA, BURN } from '../data/survival';
import { drainStamina } from './survival';
import { pierDeck } from './piers';
import { bridgeDeck } from './bridges';
import { saveChar, takeOne } from '../character';
import { logLine, showToast } from '../ui/hud';
import { openTransfer } from '../ui/transfer';
import { EYE } from './player';
import type { Container } from '../save';

const HULL = 0x2fe060, DARK = 0x1f9a44, SAIL = 0xc4ffd2, GOLD = 0xffd060;
/** Boats are drawn within this distance (m). */
const NEAR = 400;
interface Live { b: Boat; g: THREE.Group; oars: THREE.Group[]; boom: THREE.Group | null; prop: THREE.Group | null }
const live = new Map<string, Live>();
let aboard: Live | null = null, speed = 0, stroke = 0, third = false, scanT = 0, saveT = 0, jumpT = 0, bob = 0, aground = 0;
/** The sailboat's sail (up or down) and sheet (0 hauled in .. 1 let out); the motor boat's throttle. */
let sailUp = false, sheet = 0.5, throttle = 0, windT = 0, wind = { w: 0, dir: 0 };
export const inBoat = () => !!aboard;

/** A hull from the spec: local z = forward (bow +z), x across, y up from the waterline. Returns its half-width and gunwale height. */
function hull(pb: PropBatch, k: BoatKind) {
  const s = BOATS[k], L = s.len / 2, deep = k !== 'row';
  const st: number[] = []; for (let u = -L; u <= L + 1e-6; u += s.len / 14) st.push(u);
  const w = (u: number) => (u <= 0 ? s.beam / 2 - 0.2 * (s.beam / 1.5) * (u / -L) ** 2 : (s.beam / 2) * Math.sqrt(Math.max(0, 1 - (u / L) ** 2)));
  const top = deep ? 0.7 : 0.45, gun = (u: number) => top + 0.18 * (u / L) ** 2, keel = (u: number) => -s.draft + (u > 0 ? 0.3 * (u / L) ** 2 : 0);
  for (let i = 0; i + 1 < st.length; i++) {
    const a = st[i], b = st[i + 1];
    for (const sg of [-1, 1]) {
      const ga = [sg * w(a), gun(a), a], gb = [sg * w(b), gun(b), b], ca = [sg * w(a) * 0.8, -0.18, a], cb = [sg * w(b) * 0.8, -0.18, b], ka = [0, keel(a), a], kb = [0, keel(b), b];
      pb.face(ga, gb, cb, ca); pb.face(ca, cb, kb, ka);
      pb.seg(HULL, ga, gb); pb.seg(DARK, ca, cb);
      pb.seg(DARK, [sg * w(a) * 0.9, 0.16, a], [sg * w(b) * 0.9, 0.16, b]); // a strake
    }
    pb.seg(HULL, [0, keel(a), a], [0, keel(b), b]);
    // ribs, and the floorboards (just above the water line, so no water shows inside the boat)
    if (i % 2 === 0) for (const sg of [-1, 1]) pb.seg(DARK, [sg * w(a) * 0.98, gun(a) - 0.02, a], [sg * w(a) * 0.8, -0.16, a]);
    const fa = w(a) * 0.72, fb = w(b) * 0.72;
    if (a > -L + 0.2 && b < L - 0.6) pb.face([-fa, 0.08, a], [fa, 0.08, a], [fb, 0.08, b], [-fb, 0.08, b]);
  }
  const tw = w(-L);
  pb.face([-tw, gun(-L), -L], [tw, gun(-L), -L], [tw * 0.8, -0.18, -L], [0, keel(-L), -L], [-tw * 0.8, -0.18, -L]);
  pb.seg(HULL, [-tw, gun(-L), -L], [tw, gun(-L), -L]);
  return { w, gun, L };
}
/** A deck over the bow from u0 to the stem. */
function foredeck(pb: PropBatch, h: ReturnType<typeof hull>, u0: number) {
  for (let u = u0; u < h.L - 0.05; u += 0.4) {
    const b = Math.min(h.L - 0.02, u + 0.4);
    pb.face([-h.w(u), h.gun(u), u], [h.w(u), h.gun(u), u], [h.w(b), h.gun(b), b], [-h.w(b), h.gun(b), b]);
  }
  pb.seg(HULL, [-h.w(u0), h.gun(u0), u0], [h.w(u0), h.gun(u0), u0]);
}
function model(k: BoatKind): Omit<Live, 'b'> {
  const pb = new PropBatch(), h = hull(pb, k), g = new THREE.Group(), oars: THREE.Group[] = [];
  let boom: THREE.Group | null = null, prop: THREE.Group | null = null;
  const seat = (u: number, d: number, y = 0.3) => pb.box(-h.w(u) + 0.05, y - 0.03, u - d / 2, h.w(u) - 0.05, y + 0.03, u + d / 2, HULL);
  if (k === 'row') {
    for (const [u, d] of [[0.1, 0.24], [-1.4, 0.3], [1.3, 0.2]]) seat(u, d);
    for (const sg of [-1, 1]) {
      const o = new PropBatch(), og = new THREE.Group();
      o.seg(HULL, [-sg * 0.8, 0, 0], [sg * 1.9, 0, 0]); // the loom and the shaft, pivoting at the oarlock
      o.box(sg > 0 ? 1.9 : -2.5, -0.02, -0.08, sg > 0 ? 2.5 : -1.9, 0.02, 0.08, HULL); // the blade
      og.add(o.build()); og.position.set(sg * (h.w(0.35) + 0.02), h.gun(0.35) + 0.05, 0.35);
      g.add(og); oars.push(og);
    }
  } else if (k === 'sail') {
    foredeck(pb, h, 0.6);
    seat(-1.2, 0.3, 0.45); seat(-2.35, 0.35, 0.45);
    const mu = 1.1, mh = 7.8;
    pb.box(-0.07, h.gun(mu), mu - 0.07, 0.07, mh, mu + 0.07, HULL); // the mast
    pb.seg(DARK, [0, mh, mu], [0, h.gun(h.L), h.L]); // the forestay
    for (const sg of [-1, 1]) pb.seg(DARK, [0, mh - 0.4, mu], [sg * h.w(mu), h.gun(mu), mu]); // shrouds
    pb.box(-0.04, 0.4, -h.L - 0.35, 0.04, 0.9, -h.L + 0.1, HULL); // the rudder
    pb.seg(HULL, [0, 0.95, -h.L], [0, 0.85, -h.L + 1.1]); // and its tiller
    // the boom and the sail swing together about the mast
    const s = new PropBatch(), bg = new THREE.Group(), blen = 3.3, foot = 1.35;
    s.box(-0.05, foot - 0.05, -blen, 0.05, foot + 0.05, 0, HULL);
    s.face([0, foot + 0.08, -0.05], [0, mh - 0.4, -0.05], [0, foot + 0.08, -blen]);
    s.seg(SAIL, [0, foot + 0.08, 0], [0, mh - 0.4, 0]); s.seg(SAIL, [0, mh - 0.4, 0], [0, foot + 0.08, -blen]);
    for (let f = 0.25; f < 1; f += 0.25) s.seg(DARK, [0, foot + 0.08 + (mh - 0.5 - foot) * f, 0], [0, foot + 0.08, -blen * (1 - f) - 0.05 + blen * 0.0]); // seams
    bg.add(s.build()); bg.position.set(0, 0, mu); bg.scale.y = 0.2; g.add(bg); boom = bg; // furled until you raise it
  } else {
    foredeck(pb, h, 0.9);
    seat(-1.6, 0.4, 0.5);
    // the console with the windscreen
    const cu = -0.2, cw = h.w(cu) * 0.55;
    pb.box(-cw, 0.08, cu - 0.3, cw, 1.0, cu + 0.3, HULL);
    pb.face([-cw - 0.15, 1.0, cu + 0.3], [cw + 0.15, 1.0, cu + 0.3], [cw + 0.1, 1.45, cu + 0.05], [-cw - 0.1, 1.45, cu + 0.05]);
    pb.seg(SAIL, [-cw - 0.15, 1.0, cu + 0.3], [-cw - 0.1, 1.45, cu + 0.05]); pb.seg(SAIL, [cw + 0.15, 1.0, cu + 0.3], [cw + 0.1, 1.45, cu + 0.05]); pb.seg(SAIL, [-cw - 0.1, 1.45, cu + 0.05], [cw + 0.1, 1.45, cu + 0.05]);
    pb.box(-0.18, 1.0, cu - 0.2, 0.18, 1.08, cu, GOLD); // the fuel gauge
    // the outboard on the transom, turning with the helm
    const o = new PropBatch(), og = new THREE.Group();
    o.box(-0.22, 0.55, -0.55, 0.22, 1.05, 0.05, HULL); o.box(-0.07, -0.55, -0.35, 0.07, 0.55, -0.15, DARK);
    o.box(-0.03, -0.72, -0.62, 0.03, -0.38, -0.08, HULL); // the propeller
    og.add(o.build()); og.position.set(0, 0, -h.L); g.add(og); prop = og;
  }
  g.add(pb.build());
  return { g, oars, boom, prop };
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
    if (!l) { l = { b, ...model(b.k) }; scene.add(l.g); live.set(b.id, l); }
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
    if (!w || !floats(l.b.k, w.depth) || pierDeck(px, pz) !== null || (s.tall && bridgeDeck(px, pz) !== null)) return false;
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
  const k = G.keys, fwd = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0) - G.stick.dy, turn = (k.KeyA ? 1 : 0) - (k.KeyD ? 1 : 0) - G.stick.dx;
  const w0 = T.water(b.x, b.z), flow = w0?.flow ?? [0, 0];
  if ((windT -= dt) <= 0) { windT = 1; const wx = weatherAt(T.world, b.x, b.z, G.char.time); wind = { w: wx.wind, dir: wx.windDir }; }
  let want = 0, steer = 0, rowing = 0;
  if (b.k === 'motor') {
    // the throttle follows W/S; the outboard burns fuel by it and steers the stern round even at rest
    const m = s.motor!, fuel = b.fuel ?? 0;
    throttle += (fwd - throttle) * Math.min(1, dt * 2);
    if (fuel <= 0) throttle = 0;
    b.fuel = Math.max(0, fuel - Math.abs(throttle) * m.burn * dt);
    if (fuel > 0 && b.fuel === 0) showToast('Out of fuel: R to fill up from a canister');
    want = throttle > 0 ? throttle * s.speed : throttle * s.speed * s.back;
    steer = turn * s.turn * (0.35 + 0.65 * Math.min(1, Math.abs(speed) / 3));
    if (l.prop) l.prop.rotation.y = -turn * 0.5;
  } else if (b.k === 'sail' && sailUp) {
    // W lets the sheet out, S hauls it in; the wind does the rest
    sheet = Math.max(0, Math.min(1, sheet + fwd * dt * 0.5));
    const th = windAngle(b.yaw, wind.dir);
    want = sailSpeed(b.k, wind.w, th, sheet);
    steer = turn * s.turn * (0.25 + 0.75 * Math.min(1, Math.abs(speed) / 2.5));
  } else {
    // oars: a rowboat's, or a sailboat's spare pair with the sail down
    rowing = Math.min(1, Math.abs(fwd) + Math.abs(turn) * 0.6);
    const fresh = rowing > 0.05 ? drainStamina(STAMINA.swim * 0.7 * rowing, dt) : true, power = fresh ? 1 : 0.35, top = s.row ?? s.speed;
    want = fwd > 0 ? fwd * top * power : fwd * top * s.back * power;
    steer = turn * s.turn * power * (0.55 + 0.45 * Math.min(1, Math.abs(speed) / 1.5));
  }
  G.activity = rowing > 0.05 ? BURN.swim : 1;
  speed += (want - speed) * Math.min(1, dt * (Math.abs(want) > Math.abs(speed) ? (b.k === 'motor' ? 1.2 : 0.8) : 0.5));
  const dyaw = steer * dt;
  const ny = b.yaw + dyaw, nx = b.x + (Math.sin(ny) * speed + flow[0]) * dt, nz = b.z + (Math.cos(ny) * speed + flow[1]) * dt;
  if (clearAt(l, nx, nz, ny)) { b.x = nx; b.z = nz; b.yaw = ny; G.yaw += dyaw; aground = 0; }
  else if (clearAt(l, b.x, b.z, ny)) { b.yaw = ny; G.yaw += dyaw; speed *= 0.3; aground += dt; }
  else { speed = 0; aground += dt; }
  if (aground > 0.4 && aground - dt <= 0.4) showToast(s.tall && bridgeAhead(l) ? 'The mast will not pass under the bridge' : 'Aground: back off or turn');
  // the oars: a stroke cycle while pulling, one side only when turning on the spot
  stroke += dt * (1.1 + Math.abs(speed) * 0.3) * (rowing > 0.05 ? 1 : 0);
  l.oars.forEach((o, i) => {
    const side = i === 0 ? -1 : 1, pull = rowing > 0.05 && (Math.abs(fwd) > 0.1 || side * turn < 0 || Math.abs(turn) < 0.1) ? 1 : 0.25;
    const ph = stroke * 6.283 * (fwd < 0 ? -1 : 1);
    o.rotation.set(0, side * Math.sin(ph) * 0.5 * pull, side * (0.18 + Math.cos(ph) * 0.14 * pull));
  });
  // the boom swings out to leeward as the sheet is let out; lowered, the sail lies along the boat
  if (l.boom) {
    const lee = Math.sin(wind.dir - (Math.PI / 2 - b.yaw)) >= 0 ? 1 : -1;
    const want2 = sailUp ? lee * (0.08 + sheet * 1.3) : 0;
    l.boom.rotation.y += (want2 - l.boom.rotation.y) * Math.min(1, dt * 2);
    l.boom.scale.y += ((sailUp ? 1 : 0.2) - l.boom.scale.y) * Math.min(1, dt * 1.5);
  }
  bob = Math.sin(performance.now() / 700) * 0.04;
  place(l);
  // you sit on the thwart
  const sx = b.x + Math.sin(b.yaw) * s.seat, sz = b.z + Math.cos(b.yaw) * s.seat, lvl = w0?.level ?? l.g.position.y;
  G.pos.set(nearX(sx, G.pos.x), lvl + bob + s.eye - EYE, sz); G.vel.set(0, 0, 0); G.onGround = true; G.swimming = false;
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
export function boatHint(): string | null {
  if (!aboard) return null;
  const b = aboard.b, s = BOATS[b.k], head = `${s.name} · ${Math.abs(speed).toFixed(1)} m/s`, tail = ' · E step out · F the hold · V view';
  if (b.k === 'motor') return `${head} · fuel ${Math.ceil(b.fuel ?? 0)}/${s.motor!.tank} L · W/S throttle · A/D steer · R refuel${tail}`;
  if (b.k === 'sail') {
    const th = windAngle(b.yaw, wind.dir), ws = `wind ${windSpeed(wind.w).toFixed(0)} m/s ${pointOfSail(th)}`;
    if (!sailUp) return `${head} · ${ws} · sail down: W/S row · A/D turn · Space raise the sail${tail}`;
    const t = trim(th, sheet), best = bestSheet(th), tip = t > 0.8 ? 'trim good' : sheet < best ? 'let the sheet out (W)' : 'haul the sheet in (S)';
    return `${head} · ${ws} · ${tip} · A/D rudder · Space lower the sail${tail}`;
  }
  return `${head} · W/S row · A/D turn${tail}`;
}
/** Space aboard a sailboat: raise or lower the sail. */
export function toggleSail(): boolean {
  if (!aboard || aboard.b.k !== 'sail') return false;
  sailUp = !sailUp;
  logLine(sailUp ? 'You haul the sail up.' : 'You let the sail down and ship the oars.');
  return true;
}
/** R aboard (or beside) a motor boat: pour a fuel canister from the hold or the backpack into its tank. */
export function refuel(): boolean {
  const b = aboard?.b ?? nearBoat();
  if (!b || b.k !== 'motor') return false;
  const m = BOATS.motor.motor!, have = b.fuel ?? 0;
  if (have > m.tank - m.can * 0.5) { logLine('The tank is nearly full.'); return true; }
  const hold = boatHold(b), i = hold.items.findIndex((x) => x?.k === 'fuel');
  if (i >= 0) { const x = hold.items[i]!; x.n--; if (x.n <= 0) hold.items[i] = null; }
  else if (!takeOne('fuel')) { logLine('You have no Fuel Canister, in the hold or your backpack. Villages trade them.'); return true; }
  b.fuel = Math.min(m.tank, have + m.can);
  logLine(`You pour a canister into the tank: ${Math.round(b.fuel)} of ${m.tank} litres.`);
  saveChar(); return true;
}
/** Is there a bridge just ahead of the boat (why a tall one stopped)? */
function bridgeAhead(l: Live): boolean {
  const s = BOATS[l.b.k];
  for (const u of [s.len / 2 + 1, s.len / 2 + 3]) if (bridgeDeck(l.b.x + Math.sin(l.b.yaw) * u, l.b.z + Math.cos(l.b.yaw) * u) !== null) return true;
  return false;
}

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
  aboard = l; speed = 0; third = false; aground = 0; sailUp = false; sheet = 0.5; throttle = 0; windT = 0; G.yaw = b.yaw + Math.PI; // looking forward: the camera looks down −z of its yaw
  logLine(b.k === 'row' ? 'You climb into the rowboat and take up the oars.' : b.k === 'sail' ? 'You step aboard the sailboat and take the tiller. Space raises the sail.' : `You take the wheel of the motor boat: ${Math.ceil(b.fuel ?? 0)} litres in the tank.`);
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
  aboard = null; speed = 0; third = false; throttle = 0;
  if (l.boom) { l.boom.rotation.y = 0; l.boom.scale.y = 0.2; } // the sail comes down when you leave
  if (l.prop) l.prop.rotation.y = 0;
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
