// Your boats and ships (gen/boats.ts) on the water, drawn near you.
//
// The small boat: E beside it gets in, E aboard steps out (onto a dock, a bank or the beach nearby; with nowhere dry, a
// second E drops you into the water); F opens the hold (beside it or aboard); V switches between the seat and a view
// from behind. Rowing (the rowboat, a sailing skiff's oars): W pulls, S backs water, A/D turn (on the spot too, one
// oar against the other); it costs stamina, out of breath you row weakly. Sailing: Space raises / lowers the sail, W/S
// let the sheet out / haul it in, A/D the rudder; the wind (gen/weather.ts) drives it by the point of sail and the
// trim. The motor skiff: W/S throttle and reverse, A/D steer, it burns fuel, R pours in a canister.
//
// The ships are decked: you walk their deck (`shipFloor` in G.floor, the bulwarks and the deck's furniture in
// `shipHit`), boarding over a gap in the bulwark amidships (from a dock) or with E beside the hull (from the water).
// E at the wheel takes it and steers like the small boats (a Sailing Ship only sails: Space sets or furls its sails;
// a Motor Ship steams on fuel); E at the wheel again leaves it, and the ship holds her course with the sails or the
// throttle as you left them while you walk about: whoever stands on her deck is carried along (`carry`).
//
// Together (online): one game drives each boat (`drives`): whoever has the helm or the oars, else the player with the
// lowest id near it; it moves the boat and the saved boat, and tells the others ten times a second ({t:'boat'} relay),
// whose games follow (`follow`) and so carry their deck walkers along too. A rowboat seats two: the second player
// takes the aft oars and sends their pulls to the driver ({t:'row'}): two rowing together go faster (`oarPower`); in a
// skiff the second seat only rides. A ship has one wheel; anyone may walk her deck. The others' figures aboard are drawn
// where they stand on the boat (`myBoatSpot` / `boatPoint`, world/peers.ts), so they do not lag behind her.
// Gangplanks run out on both sides of a ship lying still to a dock or the shore within `PLANK.reach` (`planks`), and a
// rope ladder hangs over each side (E beside it, from the water or a dock, climbs aboard).
//
// A river's current carries every boat; it runs aground where the water is shallower than its draught and keel, will
// not go under a dock, and a mast will not pass under a bridge. The saved boat (`char.boats`) follows it.
import * as THREE from 'three';
import { scene } from './render';
import { PropBatch } from './props';
import { G } from '../game';
import { OW } from './overworld';
import { nearX, WORLD_W } from '../gen/regions';
import { BOATS, floats, windAngle, windSpeed, sailSpeed, trim, bestSheet, pointOfSail, isShip, halfBeam, hullPoints, oarPower, type Boat, type BoatKind } from '../gen/boats';
import { net, online, relay, onRelay, type Relay } from '../net/client';
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

const HULL = 0x2fe060, DARK = 0x1f9a44, SAIL = 0xc4ffd2, GOLD = 0xffd060, WOOD = 0xb8b060;
/** Boats are drawn within this distance (m). */
const NEAR = 400;
/** How a boat is being driven: kept per boat, so a ship sails on with no hand at the wheel. */
interface Ctl { speed: number; throttle: number; sheet: number; sailUp: boolean; aground: number; stroke: number; windT: number; wind: { w: number; dir: number } }
/** What the player who drives a boat last said about it (online): its pose and controls, who steers and who rows. */
interface Heard { from: number; at: number; x: number; z: number; yaw: number; sp: number; turn: number; helm: number; seat2: number; ro: [number, number] }
/** A gangplank: out from the gap in the bulwark on one side (`side` ±1), its length now and wanted, and the rise to its far end. */
interface Plank { side: number; g: THREE.Group; len: number; want: number; rise: number }
interface Live {
  b: Boat; k: BoatKind; g: THREE.Group; oars: THREE.Group[]; booms: THREE.Group[]; prop: THREE.Group | null; c: Ctl;
  /** Where it is drawn and floats: the driver's game moves it (and the saved boat with it), the others follow what they hear. */
  x: number; z: number; yaw: number;
  heard: Heard | null; planks: Plank[];
  /** (the driver) the second rower's oars as last heard: pull, turn, power, when */
  oar2: { fwd: number; turn: number; at: number; id: number } | null;
  /** how hard each pair of oars is pulling, for drawing them; how fast it turns (rad/s) */
  ro: [number, number]; turn?: number;
}
const live = new Map<string, Live>();
/** The boat you are in: your seat (0 at the oars, the tiller or the wheel; 1 the second seat of a small boat). */
let aboard: Live | null = null, seat = 0, third = false, scanT = 0, saveT = 0, jumpT = 0, bob = 0, rowT = 0, plankT = 0;
export const inBoat = () => !!aboard;
const newCtl = (): Ctl => ({ speed: 0, throttle: 0, sheet: 0.5, sailUp: false, aground: 0, stroke: 0, windT: 0, wind: { w: 0, dir: 0 } });
/** Your id on the server (alone: 0, and every boat is yours to drive). */
const me = () => (online() ? net.id : 0);
/** A message heard recently enough to go by (ms). */
const FRESH = 3000;
/** How long a second rower's word holds (ms). */
const OAR_FRESH = 1500;

// ---------- the small boats ----------
interface Model { g: THREE.Group; oars: THREE.Group[]; booms: THREE.Group[]; prop: THREE.Group | null }
/** A hull from the spec: local z = forward (bow +z), x across, y up from the waterline. Returns its half-width and gunwale height. */
function hull(pb: PropBatch, k: BoatKind) {
  const s = BOATS[k], L = s.len / 2, deep = k !== 'row';
  const st: number[] = []; for (let u = -L; u <= L + 1e-6; u += s.len / 14) st.push(u);
  const w = (u: number) => halfBeam(k, u);
  const top = deep ? 0.6 : 0.45, gun = (u: number) => top + 0.18 * (u / L) ** 2, keel = (u: number) => -s.draft + (u > 0 ? 0.3 * (u / L) ** 2 : 0);
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
/** A gaff sail on a boom group turning about a mast at u: foot `foot` over the waterline, head `head`, boom `blen` aft. */
function sailGroup(u: number, foot: number, head: number, blen: number): THREE.Group {
  // drawn from the boom (y 0 = the foot), so furling (scale y) gathers the sail down onto the boom
  const s = new PropBatch(), bg = new THREE.Group(), h = head - foot;
  s.box(-0.05, -0.05, -blen, 0.05, 0.05, 0, HULL);
  s.face([0, 0.08, -0.05], [0, h, -0.05], [0, h - 0.4, -blen * 0.85], [0, 0.08, -blen]);
  s.line(SAIL, [0, 0.08, 0], [0, h, 0], [0, h - 0.4, -blen * 0.85], [0, 0.08, -blen]);
  s.seg(HULL, [0, h, 0], [0, h - 0.4, -blen * 0.85]); // the gaff
  for (let f = 0.25; f < 1; f += 0.25) s.seg(DARK, [0, 0.08 + (h - 0.08) * f, 0], [0, 0.08 + (h - 0.48) * f, -blen * (1 - 0.15 * f)]); // seams
  bg.add(s.build()); bg.position.set(0, foot, u); bg.scale.y = 0.08; // furled until you set it
  return bg;
}
function smallModel(k: BoatKind): Model {
  const pb = new PropBatch(), h = hull(pb, k), g = new THREE.Group(), oars: THREE.Group[] = [], booms: THREE.Group[] = [];
  let prop: THREE.Group | null = null;
  const seat = (u: number, d: number, y = 0.3) => pb.box(-h.w(u) + 0.05, y - 0.03, u - d / 2, h.w(u) - 0.05, y + 0.03, u + d / 2, HULL);
  const oarPair = (u: number) => {
    for (const sg of [-1, 1]) {
      const o = new PropBatch(), og = new THREE.Group();
      o.seg(HULL, [-sg * 0.8, 0, 0], [sg * 1.9, 0, 0]); // the loom and the shaft, pivoting at the oarlock
      o.box(sg > 0 ? 1.9 : -2.5, -0.02, -0.08, sg > 0 ? 2.5 : -1.9, 0.02, 0.08, HULL); // the blade
      og.add(o.build()); og.position.set(sg * (h.w(u) + 0.02), h.gun(u) + 0.05, u);
      g.add(og); oars.push(og);
    }
  };
  if (k === 'row') {
    for (const [u, d] of [[0.1, 0.24], [-1.4, 0.3], [1.3, 0.2]]) seat(u, d);
    oarPair(0.35); oarPair(-1.05); // two pairs: two can row
  } else if (k === 'sail') {
    foredeck(pb, h, h.L * 0.35);
    seat(-0.1, 0.24, 0.45); seat(-h.L * 0.65, 0.3, 0.45);
    const mu = h.L * 0.42, mh = 5.6;
    pb.box(-0.06, h.gun(mu), mu - 0.06, 0.06, mh, mu + 0.06, HULL); // the mast
    pb.seg(DARK, [0, mh, mu], [0, h.gun(h.L), h.L]); // the forestay
    for (const sg of [-1, 1]) pb.seg(DARK, [0, mh - 0.4, mu], [sg * h.w(mu), h.gun(mu), mu]); // shrouds
    pb.box(-0.04, 0.3, -h.L - 0.3, 0.04, 0.8, -h.L + 0.1, HULL); // the rudder
    pb.seg(HULL, [0, 0.85, -h.L], [0, 0.75, -h.L + 0.9]); // and its tiller
    const bg = sailGroup(mu, 1.1, mh - 0.3, h.L * 1.25); g.add(bg); booms.push(bg);
    oarPair(-0.1);
  } else {
    foredeck(pb, h, h.L * 0.4);
    seat(-1.25, 0.4, 0.5);
    // the console with the windscreen
    const cu = -0.1, cw = h.w(cu) * 0.5;
    pb.box(-cw, 0.08, cu - 0.25, cw, 0.9, cu + 0.25, HULL);
    pb.face([-cw - 0.15, 0.9, cu + 0.25], [cw + 0.15, 0.9, cu + 0.25], [cw + 0.1, 1.3, cu + 0.05], [-cw - 0.1, 1.3, cu + 0.05]);
    pb.seg(SAIL, [-cw - 0.15, 0.9, cu + 0.25], [-cw - 0.1, 1.3, cu + 0.05]); pb.seg(SAIL, [cw + 0.15, 0.9, cu + 0.25], [cw + 0.1, 1.3, cu + 0.05]); pb.seg(SAIL, [-cw - 0.1, 1.3, cu + 0.05], [cw + 0.1, 1.3, cu + 0.05]);
    pb.box(-0.15, 0.9, cu - 0.18, 0.15, 0.97, cu, GOLD); // the fuel gauge
    // the outboard on the transom, turning with the helm
    const o = new PropBatch(), og = new THREE.Group();
    o.box(-0.2, 0.5, -0.5, 0.2, 0.95, 0.05, HULL); o.box(-0.06, -0.5, -0.32, 0.06, 0.5, -0.14, DARK);
    o.box(-0.03, -0.65, -0.56, 0.03, -0.35, -0.08, HULL); // the propeller
    og.add(o.build()); og.position.set(0, 0, -h.L); g.add(og); prop = og;
  }
  g.add(pb.build());
  return { g, oars, booms, prop };
}

// ---------- the ships ----------
/** A box on the deck the walker bumps into: deck-local u (along) / v (across) ranges and its height over the deck. */
interface Solid { u0: number; u1: number; v0: number; v1: number; h: number }
/** Each kind's deck furniture, the wheel (where you stand to steer, `stand`) and the bulwark gap amidships (|u| < `gap`). */
const LAYOUT: Partial<Record<BoatKind, { solids: Solid[]; wheel: number; stand: number; gap: number }>> = {
  ship: {
    solids: [
      { u0: -7.4, u1: -5.6, v0: -1.3, v1: 1.3, h: 2.3 }, // the deckhouse
      { u0: -4.55, u1: -4.25, v0: -0.12, v1: 0.12, h: 1.1 }, // the wheel's pedestal
      { u0: -1.95, u1: -1.65, v0: -0.15, v1: 0.15, h: 11 }, { u0: 4.25, u1: 4.55, v0: -0.15, v1: 0.15, h: 10 }, // the masts
      { u0: 1.3, u1: 3.0, v0: -0.9, v1: 0.9, h: 0.45 }, // the hatch's coaming
    ],
    wheel: -4.4, stand: -4.98, gap: 0.9,
  },
  steamer: {
    solids: [
      { u0: -6.6, u1: -4.4, v0: -1.4, v1: 1.4, h: 2.6 }, // the wheelhouse
      { u0: -3.55, u1: -3.25, v0: -0.12, v1: 0.12, h: 1.1 }, // the wheel's pedestal
      { u0: -2.9, u1: -1.4, v0: -1.0, v1: 1.0, h: 1.6 }, // the engine casing under the funnel
      { u0: 1.4, u1: 3.1, v0: -0.9, v1: 0.9, h: 0.45 }, // the hatch's coaming
      { u0: 4.6, u1: 4.85, v0: -0.12, v1: 0.12, h: 7 }, // the mast
    ],
    wheel: -3.4, stand: -3.98, gap: 0.9,
  },
};
/** Where the rope ladders hang over the sides (u). */
const LADDER_U = 2.0;
/** An eight-sided column between y0 and y1 at (v, u), radius r. */
function column(pb: PropBatch, v: number, u: number, y0: number, y1: number, r: number, c: number) {
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * 6.283, b = (i + 1) / 8 * 6.283, p = [v + Math.cos(a) * r, u + Math.sin(a) * r], q = [v + Math.cos(b) * r, u + Math.sin(b) * r];
    pb.face([p[0], y0, p[1]], [q[0], y0, q[1]], [q[0], y1, q[1]], [p[0], y1, p[1]]);
    pb.seg(c, [p[0], y1, p[1]], [q[0], y1, q[1]]);
    if (i % 2 === 0) pb.seg(c, [p[0], y0, p[1]], [p[0], y1, p[1]]);
  }
}
function shipModel(k: BoatKind): Model {
  const s = BOATS[k], L = s.len / 2, D = s.deck!, lay = LAYOUT[k]!, pb = new PropBatch(), g = new THREE.Group(), booms: THREE.Group[] = [];
  const w = (u: number) => halfBeam(k, u), top = (u: number) => D + 0.95 + 0.35 * (u / L) ** 2, keel = (u: number) => -s.draft + (u > 0 ? 0.6 * (u / L) ** 2 : 0);
  const st: number[] = []; for (let u = -L; u <= L + 1e-6; u += s.len / 32) st.push(u);
  for (let i = 0; i + 1 < st.length; i++) {
    const a = st[i], b = st[i + 1], gap = Math.abs((a + b) / 2) < lay.gap;
    for (const sg of [-1, 1]) {
      const ta = [sg * w(a), top(a), a], tb = [sg * w(b), top(b), b], da = [sg * w(a), D, a], db = [sg * w(b), D, b];
      const ca = [sg * w(a) * 0.85, -0.45, a], cb = [sg * w(b) * 0.85, -0.45, b], ka = [0, keel(a), a], kb = [0, keel(b), b];
      if (!gap) { pb.face(ta, tb, db, da); pb.seg(WOOD, ta, tb); pb.seg(DARK, [sg * w(a) * 0.97, top(a) - 0.12, a], [sg * w(b) * 0.97, top(b) - 0.12, b]); } // the bulwark and its rail
      pb.face(da, db, cb, ca); pb.face(ca, cb, kb, ka);
      pb.seg(HULL, da, db); pb.seg(DARK, ca, cb);
      for (const y of [0.35, D - 0.35]) pb.seg(DARK, [sg * w(a) * 0.95, y, a], [sg * w(b) * 0.95, y, b]); // strakes
      if (i % 2 === 0 && !gap) pb.seg(WOOD, [sg * w(a) * 0.96, D, a], [sg * w(a) * 0.96, top(a), a]); // stanchions
    }
    pb.seg(HULL, [0, keel(a), a], [0, keel(b), b]);
    // the deck, and its planks running fore and aft
    pb.face([-w(a), D, a], [w(a), D, a], [w(b), D, b], [-w(b), D, b]);
    for (let v = -s.beam / 2 + 0.45; v < s.beam / 2; v += 0.45) if (Math.abs(v) < Math.min(w(a), w(b)) - 0.05) pb.seg(DARK, [v, D + 0.01, a], [v, D + 0.01, b]);
  }
  for (const sg of [-1, 1]) for (const u of [-lay.gap, lay.gap]) pb.seg(GOLD, [sg * w(u) * 0.97, D, u], [sg * w(u) * 0.97, top(u) + 0.1, u]); // the gangway's posts
  const tw = w(-L);
  pb.face([-tw, top(-L), -L], [tw, top(-L), -L], [tw * 0.85, -0.45, -L], [0, keel(-L), -L], [-tw * 0.85, -0.45, -L]);
  pb.line(HULL, [-tw, top(-L), -L], [tw, top(-L), -L]);
  // the rudder, the anchor at the bow and a lamp on the stern rail
  pb.box(-0.06, -s.draft + 0.2, -L - 0.5, 0.06, D - 0.2, -L + 0.05, HULL);
  pb.line(DARK, [w(L - 1.2) + 0.02, D + 0.6, L - 1.2], [w(L - 1.2) + 0.05, 0.4, L - 1.3], [w(L - 1.2) + 0.05, 0.1, L - 1.7], [w(L - 1.2) + 0.05, 0.4, L - 2.1]);
  pb.box(-0.1, top(-L), -L + 0.2, 0.1, top(-L) + 0.3, -L + 0.4, GOLD);
  // the wheel on its pedestal
  { const u = lay.wheel, y = D + 1.15;
    pb.box(-0.1, D, u - 0.15, 0.1, D + 1.0, u + 0.15, WOOD);
    for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283, b = (i + 1) / 12 * 6.283; pb.seg(WOOD, [Math.cos(a) * 0.45, y + Math.sin(a) * 0.45, u - 0.15], [Math.cos(b) * 0.45, y + Math.sin(b) * 0.45, u - 0.15]); if (i % 2 === 0) pb.seg(WOOD, [Math.cos(a) * 0.6, y + Math.sin(a) * 0.6, u - 0.15], [0, y, u - 0.15]); }
  }
  // the hatch amidships (the hold's lid), and the cargo boom
  const hatch = lay.solids.find((x) => x.h === 0.45)!;
  pb.box(hatch.v0, D, hatch.u0, hatch.v1, D + 0.45, hatch.u1, WOOD);
  for (let u = hatch.u0 + 0.35; u < hatch.u1; u += 0.35) pb.seg(DARK, [hatch.v0, D + 0.46, u], [hatch.v1, D + 0.46, u]);
  const house = lay.solids[0];
  if (k === 'ship') {
    // the deckhouse with its windows and door, the masts with their gaff sails, the bowsprit and a jib
    pb.box(house.v0, D, house.u0, house.v1, D + house.h, house.u1, WOOD);
    for (const v of [house.v0 - 0.01, house.v1 + 0.01]) for (const u of [house.u0 + 0.5, house.u1 - 0.7]) pb.line(GOLD, [v, D + 1.2, u], [v, D + 1.8, u], [v, D + 1.8, u + 0.45], [v, D + 1.2, u + 0.45], [v, D + 1.2, u]);
    pb.line(WOOD, [-0.4, D, house.u1 + 0.01], [-0.4, D + 1.9, house.u1 + 0.01], [0.4, D + 1.9, house.u1 + 0.01], [0.4, D, house.u1 + 0.01]);
    for (const [mu, mh, blen, foot] of [[-1.8, D + 11, 4.4, D + 2.7], [4.4, D + 9.5, 3.6, D + 2.2]] as const) { // the booms swing over your head
      pb.box(-0.13, D, mu - 0.13, 0.13, mh, mu + 0.13, WOOD);
      pb.box(-0.6, mh - 1.4, mu - 0.05, 0.6, mh - 1.3, mu + 0.05, WOOD); // a crosstree
      for (const sg of [-1, 1]) for (const du of [-0.6, 0.6]) pb.seg(DARK, [sg * 0.6, mh - 1.35, mu], [sg * w(mu + du) * 0.98, top(mu + du), mu + du]); // shrouds
      const bg = sailGroup(mu, foot, mh - 0.6, blen); g.add(bg); booms.push(bg);
    }
    pb.seg(WOOD, [0, top(L), L], [0, top(L) + 0.7, L + 3]); // the bowsprit
    pb.seg(DARK, [0, D + 9.3, 4.4], [0, top(L) + 0.7, L + 3]); // the forestay
    pb.face([0, D + 8.6, 4.55], [0, top(L) + 0.6, L + 2.6], [0, top(L - 0.6), L - 0.6]); // the jib
    pb.line(SAIL, [0, D + 8.6, 4.55], [0, top(L) + 0.6, L + 2.6], [0, top(L - 0.6), L - 0.6], [0, D + 8.6, 4.55]);
    pb.seg(DARK, [0, D + 11, -1.8], [0, D + 9.5, 4.4]); // the spring stay
  } else {
    // the wheelhouse with a window band, the engine casing and the funnel, a mast with a lamp, and a cargo boom
    pb.box(house.v0, D, house.u0, house.v1, D + house.h, house.u1, WOOD);
    pb.box(house.v0 - 0.15, D + house.h, house.u0 - 0.15, house.v1 + 0.15, D + house.h + 0.12, house.u1 + 0.15, WOOD);
    for (const v of [house.v0 - 0.01, house.v1 + 0.01]) pb.line(GOLD, [v, D + 1.4, house.u0 + 0.3], [v, D + 2.2, house.u0 + 0.3], [v, D + 2.2, house.u1 - 0.3], [v, D + 1.4, house.u1 - 0.3], [v, D + 1.4, house.u0 + 0.3]);
    pb.line(GOLD, [house.v0 + 0.3, D + 1.4, house.u1 + 0.01], [house.v0 + 0.3, D + 2.2, house.u1 + 0.01], [house.v1 - 0.3, D + 2.2, house.u1 + 0.01], [house.v1 - 0.3, D + 1.4, house.u1 + 0.01], [house.v0 + 0.3, D + 1.4, house.u1 + 0.01]);
    const cs = lay.solids[2];
    pb.box(cs.v0, D, cs.u0, cs.v1, D + cs.h, cs.u1, HULL);
    for (let u = cs.u0 + 0.3; u < cs.u1; u += 0.3) pb.seg(DARK, [cs.v0 + 0.1, D + cs.h + 0.01, u], [-0.6, D + cs.h + 0.01, u]); // the skylight's vents
    column(pb, 0.35, (cs.u0 + cs.u1) / 2, D + cs.h, D + 5.2, 0.5, HULL); // the funnel
    column(pb, 0.35, (cs.u0 + cs.u1) / 2, D + 4.4, D + 4.7, 0.52, GOLD); // its band
    const m = lay.solids[4];
    pb.box(m.v0, D, m.u0, m.v1, D + m.h, m.u1, WOOD);
    pb.box(-0.12, D + m.h, (m.u0 + m.u1) / 2 - 0.12, 0.12, D + m.h + 0.25, (m.u0 + m.u1) / 2 + 0.12, GOLD); // the masthead lamp
    pb.seg(DARK, [0, D + m.h - 0.2, (m.u0 + m.u1) / 2], [0, D + 1.4, hatch.u0]); // the cargo boom
    pb.seg(DARK, [0, D + m.h, (m.u0 + m.u1) / 2], [0, top(L), L]);
  }
  // a rope ladder over each side, for climbing up out of the water
  for (const sg of [-1, 1]) {
    const u = LADDER_U, x = sg * (w(u) + 0.06);
    for (const du of [-0.25, 0.25]) pb.seg(WOOD, [x, top(u), u + du], [x + sg * 0.05, -0.7, u + du]);
    for (let y = -0.55; y < top(u) - 0.1; y += 0.32) pb.seg(WOOD, [x + sg * 0.05 * (1 - (y + 0.7) / (top(u) + 0.7)), y, u - 0.25], [x + sg * 0.05 * (1 - (y + 0.7) / (top(u) + 0.7)), y, u + 0.25]);
    pb.line(GOLD, [sg * w(u) * 0.97, top(u), u - 0.3], [sg * (w(u) + 0.15), top(u) + 0.25, u - 0.3]); pb.line(GOLD, [sg * w(u) * 0.97, top(u), u + 0.3], [sg * (w(u) + 0.15), top(u) + 0.25, u + 0.3]); // its hand-holds
  }
  g.add(pb.build());
  // the propeller of the motor ship, turning under the stern
  let prop: THREE.Group | null = null;
  if (s.motor) { const o = new PropBatch(), og = new THREE.Group(); for (let i = 0; i < 3; i++) { const a = i / 3 * 6.283; o.seg(HULL, [0, 0, 0], [Math.cos(a) * 0.6, Math.sin(a) * 0.6, 0]); } og.add(o.build()); og.position.set(0, -s.draft + 0.6, -L + 0.4); g.add(og); prop = og; }
  return { g, oars: [], booms, prop };
}
const model = (k: BoatKind) => (isShip(k) ? shipModel(k) : smallModel(k));
/** A boat's model on its own (the opening film). */
export const showcaseBoat = (k: BoatKind) => model(k).g;

/** A gangplank on one side of a ship: a planked board with rope rails, one metre long before it is stretched out. */
function plankModel(l: Live, side: number): Plank {
  const s = BOATS[l.k], outer = new THREE.Group(), inner = new THREE.Group(), pb = new PropBatch();
  pb.box(0, -0.08, -0.5, 1, 0, 0.5, WOOD);
  for (let x = 0.1; x < 1; x += 0.15) pb.seg(DARK, [x, 0.005, -0.5], [x, 0.005, 0.5]);
  for (const z of [-0.5, 0.5]) { pb.seg(WOOD, [0, 0.9, z], [1, 0.9, z]); pb.seg(WOOD, [0, 0, z], [0, 0.9, z]); pb.seg(WOOD, [1, 0, z], [1, 0.9, z]); }
  inner.add(pb.build()); inner.scale.x = 0.001; inner.visible = false;
  outer.add(inner); outer.position.set(side * halfBeam(l.k, 0), s.deck!, 0); outer.rotation.y = side > 0 ? 0 : Math.PI;
  l.g.add(outer);
  return { side, g: inner, len: 0, want: 0, rise: 0 };
}
function newLive(b: Boat): Live {
  const l: Live = { b, k: b.k, c: newCtl(), ...model(b.k), x: b.x, z: b.z, yaw: b.yaw, heard: null, planks: [], oar2: null, ro: [0, 0] };
  if (isShip(b.k)) l.planks = [plankModel(l, 1), plankModel(l, -1)];
  scene.add(l.g);
  return l;
}
function place(l: Live) {
  const T = OW.terrain, x = nearX(l.x, G.pos.x), w = T?.water(x, l.z);
  l.g.position.set(x, (w ? w.level : 0) + (l === aboard && !isShip(l.k) ? bob : 0), l.z);
  l.g.rotation.set(0, l.yaw, 0);
}
function drop(l: Live) { scene.remove(l.g); l.g.traverse((o) => (o as THREE.Mesh).geometry?.dispose()); }

/** What someone else who drives the boat said lately, if anything. */
function fresh(l: Live): Heard | null {
  const h = l.heard;
  return h && h.from !== me() && performance.now() - h.at < FRESH ? h : null;
}
/** Does your game move this boat? Whoever steers it does; with nobody at the helm, the player with the lowest id near it
 *  (alone: you). The others follow what the driver tells them (`follow`). */
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

/** Draw your boats near you (twice a second); a refitted boat is drawn anew; one nobody drives lies where it was saved. */
function syncBoats() {
  if (!OW.terrain || G.char.loc !== 'overworld') { clearBoats(); return; }
  const seen = new Set<string>();
  for (const b of G.char.boats) {
    if (Math.hypot(nearX(b.x, G.pos.x) - G.pos.x, b.z - G.pos.z) > NEAR && aboard?.b !== b) continue;
    seen.add(b.id);
    let l = live.get(b.id);
    if (l && l.k !== b.k) { drop(l); live.delete(b.id); l = undefined; if (aboard?.b === b) aboard = null; }
    if (!l) { l = newLive(b); live.set(b.id, l); }
    l.b = b;
    if (!fresh(l) && Math.abs(l.c.speed) < 0.01 && !l.c.sailUp && !l.c.throttle && aboard !== l) { l.x = b.x; l.z = b.z; l.yaw = b.yaw; } // (moved by someone else while you were away)
    place(l);
  }
  for (const [id, l] of live) if (!seen.has(id)) { drop(l); live.delete(id); }
}
export function clearBoats() { if (aboard) stepOff(true); for (const l of live.values()) drop(l); live.clear(); }
/** A boat was launched, refitted or taken away: draw it now. */
export function redrawBoats() { scanT = 0; }

/** Is the boat's hull clear of the land at (x, z) facing yaw: every point under it over deep enough water, no dock? */
function clearAt(l: Live, x: number, z: number, yaw: number): boolean {
  const T = OW.terrain!, s = BOATS[l.k], fx = Math.sin(yaw), fz = Math.cos(yaw);
  for (const [u, v] of hullPoints(l.k)) {
    const px = x + fx * u + fz * v, pz = z + fz * u - fx * v, w = T.water(px, pz);
    if (!w || !floats(l.k, w.depth) || pierDeck(px, pz) !== null || (s.tall && bridgeDeck(px, pz) !== null)) return false;
  }
  return true;
}
/** (x, z) in a live boat's frame: u along it (+ to the bow), v across. */
function local(l: Live, x: number, z: number): [number, number] {
  const dx = x - l.g.position.x, dz = z - l.g.position.z, sy = Math.sin(l.yaw), cy = Math.cos(l.yaw);
  return [dx * sy + dz * cy, dx * cy - dz * sy];
}
/** A boat-local point back in the world. */
function world(l: Live, u: number, v: number): [number, number] {
  const sy = Math.sin(l.yaw), cy = Math.cos(l.yaw);
  return [l.g.position.x + u * sy + v * cy, l.g.position.z + u * cy - v * sy];
}
/** The ship whose deck you stand on (your feet on it), if any. */
function shipUnder(): Live | null {
  if (aboard) return null;
  for (const l of live.values()) {
    if (!isShip(l.k)) continue;
    const [u, v] = local(l, G.pos.x, G.pos.z), deck = l.g.position.y + BOATS[l.k].deck!;
    if (Math.abs(u) < BOATS[l.k].len / 2 && Math.abs(v) < halfBeam(l.k, u) + 0.05 && G.pos.y > deck - 0.3 && G.pos.y < deck + 0.8) return l;
  }
  return null;
}
/** Carry whoever stands on the deck along with the ship's move from `was` (its group's place and yaw before). */
function carry(l: Live, was: { x: number; y: number; z: number; yaw: number }) {
  const dx = G.pos.x - was.x, dz = G.pos.z - was.z, sy = Math.sin(was.yaw), cy = Math.cos(was.yaw);
  const u = dx * sy + dz * cy, v = dx * cy - dz * sy, [x, z] = world(l, u, v), dyaw = l.yaw - was.yaw;
  G.pos.x = x; G.pos.z = z; G.pos.y += l.g.position.y - was.y; G.yaw += dyaw;
}

/** The oars: a stroke cycle for each pair pulling (`ro`, −1..1), resting otherwise. */
function rowOars(l: Live, dt: number, turn: number) {
  const c = l.c, pull = Math.max(Math.abs(l.ro[0]), Math.abs(l.ro[1]));
  c.stroke += dt * (1.1 + Math.abs(c.speed) * 0.3) * (pull > 0.05 ? 1 : 0);
  l.oars.forEach((o, i) => {
    const r = l.ro[i >> 1] ?? 0;
    if (Math.abs(r) < 0.05 && !(i < 2 && Math.abs(turn) > 0.1 && aboard === l)) { o.rotation.set(0, 0, 0); return; }
    const side = i % 2 === 0 ? -1 : 1, ph = c.stroke * 6.283 * (r < 0 ? -1 : 1), p = Math.abs(r) > 0.05 ? 1 : 0.25;
    o.rotation.set(0, side * Math.sin(ph) * 0.5 * p, side * (0.18 + Math.cos(ph) * 0.14 * p));
  });
}
/** The booms swing out to leeward as the sheet is let out; furled, the sails lie along the boat. */
function swingBooms(l: Live, dt: number) {
  const c = l.c, lee = Math.sin(c.wind.dir - (Math.PI / 2 - l.yaw)) >= 0 ? 1 : -1;
  for (const bm of l.booms) {
    const to = c.sailUp ? lee * (0.08 + c.sheet * 1.3) : 0;
    bm.rotation.y += (to - bm.rotation.y) * Math.min(1, dt * 2);
    bm.scale.y += ((c.sailUp ? 1 : 0.08) - bm.scale.y) * Math.min(1, dt * 1.5);
  }
}

/** One boat's frame where your game drives it: its controls (yours with `manned`, the second rower's as heard), the
 *  wind, the move, running aground. The saved boat follows. */
function step(l: Live, dt: number, manned: boolean, watched: boolean) {
  const T = OW.terrain!, b = l.b, s = BOATS[b.k], c = l.c;
  const k = G.keys, fwd = manned ? (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0) - G.stick.dy : 0, turn = manned ? (k.KeyA ? 1 : 0) - (k.KeyD ? 1 : 0) - G.stick.dx : 0;
  const o2 = l.oar2 && performance.now() - l.oar2.at < 600 ? l.oar2 : null;
  if ((c.windT -= dt) <= 0) { c.windT = 1; const wx = weatherAt(T.world, l.x, l.z, G.char.time); c.wind = { w: wx.wind, dir: wx.windDir }; }
  // a ship with nobody at the wheel sails on as it was left; a small boat drifts to a stop
  if (!manned && !o2 && (!isShip(b.k) || (c.throttle === 0 && !c.sailUp)) && Math.abs(c.speed) < 0.01) { c.speed = 0; l.ro = [0, 0]; rowOars(l, dt, 0); swingBooms(l, dt); return; }
  const w0 = T.water(l.x, l.z), flow = w0?.flow ?? [0, 0];
  let want = 0, steer = 0, rowing = 0;
  l.ro = [0, 0];
  if (s.motor) {
    // the throttle follows W/S at the wheel and stays where it was left; the engine burns fuel by it
    const m = s.motor, fuel = b.fuel ?? 0;
    if (manned) c.throttle += (fwd - c.throttle) * Math.min(1, dt * (isShip(b.k) ? 0.8 : 2));
    if (fuel <= 0) c.throttle = 0;
    b.fuel = Math.max(0, fuel - Math.abs(c.throttle) * m.burn * dt);
    if (fuel > 0 && b.fuel === 0 && (manned || watched)) showToast('Out of fuel: R to fill up from a canister');
    want = c.throttle > 0 ? c.throttle * s.speed : c.throttle * s.speed * s.back;
    steer = turn * s.turn * (0.35 + 0.65 * Math.min(1, Math.abs(c.speed) / 3));
    if (l.prop) { if (isShip(b.k)) l.prop.rotation.z += c.throttle * dt * 12; else l.prop.rotation.y = -turn * 0.5; }
  } else if (s.sails && c.sailUp) {
    // W lets the sheet out, S hauls it in; the wind does the rest
    c.sheet = Math.max(0, Math.min(1, c.sheet + fwd * dt * 0.5));
    want = sailSpeed(b.k, c.wind.w, windAngle(l.yaw, c.wind.dir), c.sheet);
    steer = turn * s.turn * (0.25 + 0.75 * Math.min(1, Math.abs(c.speed) / 2.5));
  } else if (!isShip(b.k)) {
    // oars: yours (a rowboat's, or a sailing skiff's with the sail down), and the second rower's in a rowboat
    rowing = Math.min(1, Math.abs(fwd) + Math.abs(turn) * 0.6);
    const fresh1 = rowing > 0.05 ? drainStamina(STAMINA.swim * 0.7 * rowing, dt) : true, power = fresh1 ? 1 : 0.35, top = s.row ?? s.speed;
    const r2 = o2 && (s.rowers ?? 1) >= 2 ? o2.fwd : 0, t2 = o2 && (s.rowers ?? 1) >= 2 ? o2.turn : 0;
    l.ro = [fwd * power, r2];
    const pull = oarPower(fwd * power, r2);
    want = pull > 0 ? pull * top : pull * top * s.back;
    steer = Math.max(-1.3, Math.min(1.3, turn * power + t2)) * s.turn * (0.55 + 0.45 * Math.min(1, Math.abs(c.speed) / 1.5));
  } else steer = turn * s.turn * 0.25 * Math.min(1, Math.abs(c.speed) / 2); // a ship with her sails furled only drifts
  if (manned) G.activity = rowing > 0.05 ? BURN.swim : 1;
  const heavy = isShip(b.k) ? 0.35 : 1;
  c.speed += (want - c.speed) * Math.min(1, dt * heavy * (Math.abs(want) > Math.abs(c.speed) ? (s.motor ? 1.2 : 0.8) : 0.5));
  const dyaw = steer * dt;
  const ny = l.yaw + dyaw, nx = l.x + (Math.sin(ny) * c.speed + flow[0]) * dt, nz = l.z + (Math.cos(ny) * c.speed + flow[1]) * dt;
  if (clearAt(l, nx, nz, ny)) { l.x = nx; l.z = nz; l.yaw = ny; if (manned) G.yaw += dyaw; c.aground = 0; }
  else if (clearAt(l, l.x, l.z, ny)) { l.yaw = ny; if (manned) G.yaw += dyaw; c.speed *= 0.3; c.aground += dt; }
  else { c.speed = 0; c.aground += dt; }
  l.turn = dyaw / Math.max(dt, 1e-3);
  if (c.aground > 0.4 && c.aground - dt <= 0.4 && (manned || watched)) showToast(s.tall && bridgeAhead(l) ? 'The mast will not pass under the bridge' : 'Aground: back off or turn');
  b.x = l.x; b.z = l.z; b.yaw = l.yaw;
  rowOars(l, dt, turn); swingBooms(l, dt);
  place(l);
}
/** One boat's frame where someone else drives it: ease towards where they said it is (run on by its speed since). */
function follow(l: Live, dt: number) {
  const h = l.heard;
  if (!h) return;
  const age = Math.min(1.5, (performance.now() - h.at) / 1000), yaw = h.yaw + h.turn * age;
  const px = nearX(h.x + Math.sin(yaw) * h.sp * age, l.x), pz = h.z + Math.cos(yaw) * h.sp * age;
  if (Math.hypot(px - l.x, pz - l.z) > 15) { l.x = px; l.z = pz; l.yaw = yaw; }
  else {
    const k = Math.min(1, dt * 6); let dy = yaw - l.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    l.x += (px - l.x) * k; l.z += (pz - l.z) * k; l.yaw += dy * k;
  }
  l.c.speed = h.sp; l.ro = h.ro;
  rowOars(l, dt, 0); swingBooms(l, dt);
  place(l);
}
/** (the driver) Tell the others where the boat is and how it goes: ten times a second while it moves or someone is
 *  aboard, else once a second (real time, so a slow game still keeps the others in step). */
const sendAt = new Map<string, number>();
function tell(l: Live) {
  if (!online() || !net.peers.size) return;
  const c = l.c, helm = aboard === l && seat === 0 ? me() : 0, o2 = l.oar2 && performance.now() - l.oar2.at < OAR_FRESH ? l.oar2.id : 0;
  const busy = helm || o2 || Math.abs(c.speed) > 0.01 || c.sailUp || c.throttle;
  const now = performance.now();
  if (now < (sendAt.get(l.b.id) ?? 0)) return;
  sendAt.set(l.b.id, now + (busy ? 100 : 1000));
  relay({ t: 'boat', id: l.b.id, x: l.x, z: l.z, yaw: l.yaw, sp: c.speed, turn: l.turn ?? 0, th: c.throttle, sh: c.sheet, su: c.sailUp ? 1 : 0, fuel: l.b.fuel ?? 0, helm, seat2: o2, ro: l.ro });
}
onRelay((m: Relay) => {
  if (m.t === 'boat') {
    const l = live.get(String(m.id));
    if (!l) return;
    const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
    l.heard = { from: m.from, at: performance.now(), x: n(m.x), z: n(m.z), yaw: n(m.yaw), sp: n(m.sp), turn: n(m.turn), helm: n(m.helm), seat2: n(m.seat2), ro: Array.isArray(m.ro) ? [n(m.ro[0]), n(m.ro[1])] : [0, 0] };
    if (!drives(l)) { l.c.throttle = n(m.th); l.c.sheet = n(m.sh); l.c.sailUp = !!m.su; }
  } else if (m.t === 'row') {
    const l = live.get(String(m.id));
    if (l) l.oar2 = { fwd: Math.max(-1, Math.min(1, +(m.fwd as number) || 0)), turn: Math.max(-1, Math.min(1, +(m.turn as number) || 0)), at: performance.now(), id: m.from };
  }
});

/** Gangplanks: on a ship lying still, each side's plank reaches out from the gap in the bulwark to a dock, a bridge or dry
 *  ground within `PLANK.reach` (and a sensible rise), so you walk ashore; when she gets under way they come in. */
const PLANK = { reach: 3.2, rise: 1.6, speed: 1.6 };
function planks(l: Live, dt: number, look: boolean) {
  const T = OW.terrain;
  if (!T || !l.planks.length) return;
  const s = BOATS[l.k], deck = l.g.position.y + s.deck!;
  for (const p of l.planks) {
    if (look) {
      p.want = 0;
      if (Math.abs(l.c.speed) < 0.4) {
        const hw = halfBeam(l.k, 0);
        for (let d = 0.2; d <= PLANK.reach; d += 0.2) {
          const [x, z] = world(l, 0, p.side * (hw + d)), w = T.water(x, z);
          const land = pierDeck(x, z) ?? bridgeDeck(x, z) ?? (!w || w.depth < 0.15 ? T.heightAt(x, z) : null);
          if (land === null) continue;
          if (Math.abs(land - deck) <= PLANK.rise) { p.want = Math.min(PLANK.reach + 0.6, d + 0.5); p.rise = land - deck; }
          break;
        }
      }
    }
    if (Math.abs(l.c.speed) >= 0.4) p.want = 0;
    p.len += Math.sign(p.want - p.len) * Math.min(Math.abs(p.want - p.len), dt * PLANK.speed);
    p.g.visible = p.len > 0.05; p.g.scale.x = Math.max(0.001, p.len);
    p.g.rotation.z = p.want > 0 ? Math.atan2(p.rise, p.want) : p.g.rotation.z;
  }
}

/** Every frame: the boats near you (driven by your game or followed), carrying you along on a ship's deck, the
 *  gangplanks. Returns true while you sit in a small boat or stand at a ship's wheel (the player does not walk then). */
export function updateBoats(dt: number): boolean {
  if ((scanT -= dt) <= 0) { scanT = 0.5; syncBoats(); }
  jumpT -= dt;
  const T = OW.terrain;
  if (!T) { if (aboard) stepOff(true); return false; }
  if (aboard && Math.abs(G.pos.x - aboard.x) > WORLD_W / 2) aboard.x += Math.round((G.pos.x - aboard.x) / WORLD_W) * WORLD_W; // the planet's seam
  // the second seat of a small boat takes the oars when nobody else holds them
  if (aboard && seat === 1 && !fresh(aboard)?.helm) { seat = 0; logLine('You move to the forward thwart and take the boat.'); }
  const deck = shipUnder(), was = deck ? { x: deck.g.position.x, y: deck.g.position.y, z: deck.g.position.z, yaw: deck.yaw } : null;
  bob = Math.sin(performance.now() / 700) * 0.04;
  const look = (plankT -= dt) <= 0; if (look) plankT = 0.4;
  for (const l of live.values()) {
    if (drives(l)) { step(l, dt, l === aboard && seat === 0, l === deck || l === aboard); tell(l); }
    else follow(l, dt);
    planks(l, dt, look);
  }
  if (deck && was) carry(deck, was);
  // in the second seat: your oars go to whoever drives the boat
  if (aboard && seat === 1) {
    const k = G.keys, s = BOATS[aboard.k], rows = (s.rowers ?? 1) >= 2 && !aboard.c.sailUp, fwd = rows ? (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0) - G.stick.dy : 0, turn = rows ? (k.KeyA ? 1 : 0) - (k.KeyD ? 1 : 0) - G.stick.dx : 0;
    const effort = Math.min(1, Math.abs(fwd) + Math.abs(turn) * 0.6), power = effort > 0.05 && !drainStamina(STAMINA.swim * 0.7 * effort, dt) ? 0.35 : 1;
    G.activity = effort > 0.05 ? BURN.swim : 1;
    const now = performance.now();
    if (now >= rowT) { rowT = now + 100; relay({ t: 'row', id: aboard.b.id, fwd: fwd * power, turn: turn * power }); }
  }
  if ((saveT -= dt) <= 0 && (aboard || deck)) { saveT = 8; saveChar(); }
  if (!aboard) return false;
  // you sit on a thwart, or stand at the wheel
  const l = aboard, s = BOATS[l.k], ship = isShip(l.k), at = ship ? LAYOUT[l.k]!.stand : seat === 1 ? s.seat2 ?? s.seat : s.seat;
  const [sx, sz] = world(l, at, 0), lvl = l.g.position.y;
  G.pos.set(sx, ship ? lvl + s.deck! : lvl + s.eye - EYE, sz); G.vel.set(0, 0, 0); G.onGround = true; G.swimming = false;
  return true;
}
/** For the others' figures (world/peers.ts): where on a boat you are, as [boat id, u, v, feet over its waterline, seat]. */
export function myBoatSpot(): [string, number, number, number, number] | undefined {
  if (aboard) { const s = BOATS[aboard.k], u = isShip(aboard.k) ? LAYOUT[aboard.k]!.stand : seat === 1 ? s.seat2 ?? s.seat : s.seat; return [aboard.b.id, u, 0, G.pos.y - aboard.g.position.y, isShip(aboard.k) ? -1 : seat]; }
  const d = shipUnder();
  if (!d) return undefined;
  const [u, v] = local(d, G.pos.x, G.pos.z);
  return [d.b.id, u, v, G.pos.y - d.g.position.y, -1];
}
/** Where a point on one of the boats drawn here is in the world now (for the others' figures aboard). */
export function boatPoint(id: string, u: number, v: number, h: number): [number, number, number] | null {
  const l = live.get(id);
  if (!l) return null;
  const [x, z] = world(l, u, v);
  return [x, l.g.position.y + h, z];
}
/** The camera: on the thwart or at the wheel, or behind and above the boat. */
export function boatCamera(camera: THREE.PerspectiveCamera) {
  if (!aboard) return;
  if (!third) { camera.position.set(G.pos.x, G.pos.y + EYE, G.pos.z); return; }
  const ship = isShip(aboard.k), g = aboard.g.position, cy = Math.cos(G.pitch), f = new THREE.Vector3(-Math.sin(G.yaw) * cy, Math.sin(G.pitch), -Math.cos(G.yaw) * cy);
  camera.position.set(g.x, g.y + (ship ? 5 : 1.6), g.z).addScaledVector(f, ship ? -22 : -7);
  camera.position.y = Math.max(camera.position.y, g.y + (ship ? 3 : 1));
}
export function toggleBoatView() { if (aboard) third = !third; }
/** The wind as the boat feels it, in words. */
function windWords(l: Live) { const th = windAngle(l.yaw, l.c.wind.dir); return `wind ${windSpeed(l.c.wind.w).toFixed(0)} m/s ${pointOfSail(th)}`; }
/** HUD line while aboard, or standing on a ship's deck away from its wheel. */
export function boatHint(): string | null {
  const deck = shipUnder();
  if (!aboard && deck) {
    if (nearHelm(deck)) return null; // the prompt offers the wheel
    const s = BOATS[deck.k], c = deck.c, how = s.motor ? (c.throttle ? `engine at ${Math.round(Math.abs(c.throttle) * 100)}%` : 'engine idle') : c.sailUp ? 'under sail' : 'sails furled';
    const helm = fresh(deck)?.helm ? ' · someone has the wheel' : '';
    return `On the deck of the ${s.name.toLowerCase()} · ${Math.abs(c.speed).toFixed(1)} m/s · ${how}${helm} · E at the wheel (aft) to steer · F the hold`;
  }
  if (!aboard) return null;
  const l = aboard, b = l.b, s = BOATS[b.k], c = l.c, ship = isShip(b.k), head = `${s.name} · ${Math.abs(c.speed).toFixed(1)} m/s`;
  if (seat === 1) return (s.rowers ?? 1) >= 2 && !c.sailUp ? `${head} · the second oars: W/S row (together you go faster) · A/D help turn · E step out · V view` : `${head} · along for the ride · E step out · F the hold · V view`;
  const tail = ship ? ' · E leave the wheel (she holds her course) · F the hold · V view' : ' · E step out · F the hold · V view';
  if (s.motor) return `${head} · fuel ${Math.ceil(b.fuel ?? 0)}/${s.motor.tank} L · W/S throttle · A/D steer · R refuel${tail}`;
  if (s.sails) {
    const th = windAngle(l.yaw, c.wind.dir), ws = windWords(l);
    if (!c.sailUp) return ship ? `${head} · ${ws} · sails furled: she only drifts · A/D rudder · Space set the sails${tail}` : `${head} · ${ws} · sail down: W/S row · A/D turn · Space raise the sail${tail}`;
    const t = trim(th, c.sheet), best = bestSheet(th), tip = t > 0.8 ? 'trim good' : c.sheet < best ? 'let the sheets out (W)' : 'haul the sheets in (S)';
    return `${head} · ${ws} · ${tip} · A/D rudder · Space ${ship ? 'furl the sails' : 'lower the sail'}${tail}`;
  }
  const two = l.oar2 && performance.now() - l.oar2.at < 600 ? ' · two rowing' : (s.rowers ?? 1) >= 2 ? ' · a second player can take the aft oars' : '';
  return `${head} · W/S row · A/D turn${two}${tail}`;
}
/** Space at the helm of a sailing boat: raise or lower the sail (set or furl a ship's sails). */
export function toggleSail(): boolean {
  if (!aboard || seat !== 0 || !BOATS[aboard.k].sails) return false;
  const c = aboard.c, ship = isShip(aboard.k);
  c.sailUp = !c.sailUp;
  logLine(c.sailUp ? (ship ? 'The sails are set.' : 'You haul the sail up.') : (ship ? 'The sails are furled: she drifts.' : 'You let the sail down and ship the oars.'));
  return true;
}
/** R aboard (or beside, or on the deck of) a motor boat or ship: pour a fuel canister from the hold or the backpack into its tank. */
export function refuel(): boolean {
  const b = aboard?.b ?? shipUnder()?.b ?? nearBoat();
  if (!b || !BOATS[b.k].motor) return false;
  const m = BOATS[b.k].motor!, have = b.fuel ?? 0;
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
  const s = BOATS[l.k];
  for (const u of [s.len / 2 + 1, s.len / 2 + 3]) if (bridgeDeck(l.x + Math.sin(l.yaw) * u, l.z + Math.cos(l.yaw) * u) !== null) return true;
  return false;
}

/** Standing on ship l's deck by its wheel. */
function nearHelm(l: Live): boolean {
  const [u, v] = local(l, G.pos.x, G.pos.z), lay = LAYOUT[l.k]!;
  return Math.abs(u - lay.stand) < 1.1 && Math.abs(v) < 1.1;
}
/** Beside one of ship l's rope ladders, outside the hull (in the water or on a dock alongside): the side, or 0. */
function atLadder(l: Live): number {
  const [u, v] = local(l, G.pos.x, G.pos.z), hw = halfBeam(l.k, LADDER_U), g = l.g.position;
  if (Math.abs(u - LADDER_U) > 1.3 || Math.abs(v) < hw - 0.2 || Math.abs(v) > hw + 1.9) return 0;
  if (G.pos.y < g.y - 2.2 || G.pos.y > g.y + BOATS[l.k].deck! + 0.4) return 0;
  return v >= 0 ? 1 : -1;
}
/** The boat of yours E would act on: a small boat beside you, the wheel of the ship you stand on, or a ship's ladder. */
export function nearBoat(): Boat | null {
  if (aboard || G.char.loc !== 'overworld') return null;
  const deck = shipUnder();
  if (deck) return nearHelm(deck) ? deck.b : null;
  for (const l of live.values()) {
    if (isShip(l.k)) { if (atLadder(l)) return l.b; continue; }
    const s = BOATS[l.k], g = l.g.position, [u, v] = local(l, G.pos.x, G.pos.z);
    if (Math.abs(u) < s.len / 2 + 1.3 && Math.abs(v) < s.beam / 2 + 1.5 && Math.abs(G.pos.y - g.y) < 3) return l.b;
  }
  return null;
}
/** What E does there, in words. */
export function boatPrompt(b: Boat): string {
  const s = BOATS[b.k], n = s.name.toLowerCase(), l = live.get(b.id);
  if (!isShip(b.k)) {
    const h = l && fresh(l);
    return h?.helm ? (s.seat2 !== undefined && !h.seat2 ? `E — take the ${(s.rowers ?? 1) >= 2 ? 'aft oars' : 'second seat'} of the ${n}` : `The ${n} is full`) : `E — get into the ${n} · F — its hold`;
  }
  if (shipUnder()?.b === b) return l && fresh(l)?.helm ? `Someone else has the wheel of the ${n}` : `E — take the wheel of the ${n} · F — the hold`;
  return `E — climb the ladder up the side of the ${n}`;
}
/** Get in (a small boat: the oars, or the second seat if someone has them), take the wheel (on a ship's deck), or climb a
 *  ship's ladder up onto her deck. */
export function board(b: Boat) {
  const l = live.get(b.id);
  if (!l || aboard) return;
  const s = BOATS[b.k], h = fresh(l);
  if (isShip(b.k) && shipUnder() !== l) {
    const side = atLadder(l);
    if (!side) return;
    const [x, z] = world(l, LADDER_U, side * (halfBeam(l.k, LADDER_U) - 0.6));
    G.pos.set(x, l.g.position.y + s.deck!, z); G.vel.set(0, 0, 0); G.swimming = false;
    logLine(`You climb the rope ladder onto the deck of the ${s.name.toLowerCase()}. The wheel is aft.`);
    return;
  }
  if (h?.helm && h.helm !== me()) {
    if (isShip(b.k)) { showToast('Someone else has the wheel'); return; }
    if (s.seat2 === undefined || (h.seat2 && h.seat2 !== me())) { showToast(`The ${s.name.toLowerCase()} is full`); return; }
    aboard = l; seat = 1; third = false; G.yaw = l.yaw + Math.PI;
    logLine((s.rowers ?? 1) >= 2 ? `You take the aft oars of the ${s.name.toLowerCase()}: row together and she goes faster.` : `You sit in the ${s.name.toLowerCase()}, along for the ride.`);
    return;
  }
  aboard = l; seat = 0; third = false;
  if (!isShip(b.k)) { l.c.speed = 0; l.c.sailUp = false; l.c.sheet = 0.5; l.c.throttle = 0; }
  l.c.aground = 0; l.c.windT = 0; G.yaw = l.yaw + Math.PI; // looking forward: the camera looks down −z of its yaw
  logLine(b.k === 'row' ? 'You climb into the rowboat and take up the oars.' : b.k === 'sail' ? 'You step into the sailing skiff and take the tiller. Space raises the sail.'
    : b.k === 'motor' ? `You take the helm of the motor skiff: ${Math.ceil(b.fuel ?? 0)} litres in the tank.`
    : s.motor ? `You take the wheel of the motor ship: ${Math.ceil(b.fuel ?? 0)} of ${s.motor.tank} litres. W/S the throttle.` : 'You take the wheel of the sailing ship. Space sets the sails.');
}
/** E at the oars or the wheel: step out of a small boat (onto a dock, a bridge's deck, a gangplank or dry ground beside it;
 *  with none, a second E drops you into the water), or leave a ship's wheel and stand on her deck. */
export function stepOff(quiet = false) {
  const l = aboard;
  if (!l) return;
  const b = l.b, T = OW.terrain, s = BOATS[b.k], mine = seat === 0;
  if (isShip(b.k)) {
    aboard = null; seat = 0; third = false; G.vel.set(0, 0, 0);
    if (!quiet) logLine(l.c.sailUp || l.c.throttle ? 'You leave the wheel: she holds her course. Mind the shore.' : 'You leave the wheel.');
    saveChar(); return;
  }
  if (!quiet && T) {
    const fx = Math.sin(l.yaw), fz = Math.cos(l.yaw);
    let spot: [number, number, number] | null = null;
    for (const [u, v] of [[0, s.beam / 2 + 0.8], [0, -s.beam / 2 - 0.8], [s.len / 2 + 0.7, 0], [-s.len / 2 - 0.7, 0], [0, s.beam / 2 + 1.8], [0, -s.beam / 2 - 1.8], [s.len / 2 + 1.6, 0]]) {
      const x = nearX(l.x, G.pos.x) + fx * u + fz * v, z = l.z + fz * u - fx * v, deck = pierDeck(x, z) ?? bridgeDeck(x, z) ?? shipDeckAt(x, z), w = T.water(x, z);
      if (deck !== null) { spot = [x, deck, z]; break; }
      if (!w || w.depth < 0.35) { spot = [x, T.heightAt(x, z), z]; break; }
    }
    if (!spot && jumpT <= 0) { jumpT = 3; logLine('Nowhere dry to step out here: row to a bank, a beach or a dock. Press E again to go over the side.'); return; }
    if (spot) G.pos.set(spot[0], spot[1] + 0.02, spot[2]);
    else G.pos.set(nearX(l.x, G.pos.x) + fz * (s.beam / 2 + 1), l.g.position.y - 1, l.z - fx * (s.beam / 2 + 1));
    logLine(spot ? 'You step out of the boat.' : 'You slip over the side into the water.');
  }
  aboard = null; seat = 0; third = false;
  if (mine) { l.c.speed = 0; l.c.throttle = 0; l.c.sailUp = false; if (l.prop) l.prop.rotation.y = 0; l.ro = [0, 0]; l.oars.forEach((o) => o.rotation.set(0, 0, 0)); }
  G.vel.set(0, 0, 0);
  saveChar();
}
/** A boat's hold (`char.containers[id]`). */
export function boatHold(b: Boat): Container {
  const n = BOATS[b.k].hold, box = (G.char.containers[b.id] ??= { items: Array(n).fill(null), gold: 0 });
  while (box.items.length < n) box.items.push(null);
  return box;
}
/** F: the hold of the boat you sit in, stand on or stand by. */
export function openBoatHold(): boolean {
  const b = aboard?.b ?? shipUnder()?.b ?? nearBoat();
  if (!b) return false;
  openTransfer({ title: BOATS[b.k].name, subtitle: 'The hold', boxLabel: 'Hold', box: boatHold(b) });
  return true;
}
/** The hulls you are not in are solid to someone wading or swimming beside them (a ship's deck is `shipHit`'s). */
export function boatHit(x: number, y: number, z: number, r: number): boolean {
  for (const l of live.values()) {
    if (l === aboard) continue;
    const s = BOATS[l.k], g = l.g.position;
    if (y > g.y + (s.deck !== undefined ? s.deck - 0.6 : 0.5) || y + 1.7 < g.y - s.draft) continue;
    const [u, v] = local(l, x, z);
    if (Math.abs(u) < s.len / 2 + r && Math.abs(v) < halfBeam(l.k, u) + r) return true;
  }
  return false;
}
/** A ship's deck (or a gangplank's) height at (x, z), or null off every one. */
function shipDeckAt(x: number, z: number): number | null {
  for (const l of live.values()) {
    if (!isShip(l.k)) continue;
    const [u, v] = local(l, x, z), D = l.g.position.y + BOATS[l.k].deck!;
    if (Math.abs(u) < BOATS[l.k].len / 2 - 0.3 && Math.abs(v) < halfBeam(l.k, u) - 0.1) return D;
    if (Math.abs(u) < 0.5) for (const p of l.planks) {
      const along = p.side * v - halfBeam(l.k, 0), run = p.len * Math.cos(p.g.rotation.z);
      if (p.len > 0.3 && along > -0.15 && along < run) return D + Math.tan(p.g.rotation.z) * Math.max(0, along);
    }
  }
  return null;
}
/** For G.floor: a deck or a gangplank under you, from above. */
export function shipFloor(x: number, y: number, z: number): number {
  const d = shipDeckAt(x, z);
  return d !== null && y > d - 0.9 ? d : -Infinity;
}
/** For G.obstacle: a ship's bulwarks (open at the gangway amidships), ends and deck furniture, for someone on deck or alongside. */
export function shipHit(x: number, y: number, z: number, r: number): boolean {
  for (const l of live.values()) {
    if (!isShip(l.k) || l === aboard) continue;
    const s = BOATS[l.k], D = l.g.position.y + s.deck!, lay = LAYOUT[l.k]!;
    if (y < D - 0.6 || y > D + 2.6) continue;
    const [u, v] = local(l, x, z), L = s.len / 2, hw = halfBeam(l.k, u);
    if (Math.abs(u) > L + r || Math.abs(v) > hw + r + 0.1) continue;
    if (Math.abs(u) > L - 0.4 - r && Math.abs(v) < hw + r) return true; // stem and stern
    if (Math.abs(v) > hw - 0.2 - r && Math.abs(u) > lay.gap - r) return true; // the bulwark
    for (const q of lay.solids) if (u > q.u0 - r && u < q.u1 + r && v > q.v0 - r && v < q.v1 + r && y < D + q.h) return true;
  }
  return false;
}
/** (tests and debugging) the boats drawn here. */
export const liveBoats = () => live;
