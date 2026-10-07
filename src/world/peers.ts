// The other players (multiplayer stage 1): a figure with a name label for everyone online who is in the same place
// as you (the open world, or the same dungeon sector), eased between the snapshots the server sends ten times a
// second, legs walking while they move, holding what they hold. Runtime only: nothing here is saved.
import { getOff } from './ride';
import { myBoatSpot, boatPoint } from './boats';
import * as THREE from 'three';
import { G } from '../game';
import { myVis } from './stealth';
import { scene } from './render';
import { makeFigure, textSprite, type Figure } from './npc';
import { poseRig, type Kit } from './rig';
import { net, sendState, isHost, SEND_EVERY, type PeerState, type PeerCar, peerAt, PEER_DELAY, onSeats } from '../net/client';
import { convoyModel, seatFigure, myCars, toLocalOf, myCarList, driving, seatRider, unseat, gunSeat, leave } from './vehicles';
import { VEHICLES, SEATS, type VehicleModel } from '../data/vehicles';
import { nearX } from '../gen/regions';
import { dungeonKey } from '../character';
import { WEAPON_KIND, type ItemKey } from '../data/items';
import { gunOf } from '../data/weapons';

/** Each player's colour, by id (castaways' suits: none of them amber, red or gold, which mean danger or loot). */
const COLORS = [0x7dd3ff, 0xd8a8ff, 0xffffff, 0x9dffe0, 0xff9ad8, 0xa8c8ff, 0xc8ff9d, 0xffc8a8];
export const peerColor = (id: number) => COLORS[(id - 1) % COLORS.length];

/** Where you are, as the server hears it: 'o' for the open world, else the dungeon sector's key. */
export function myLoc(): string {
  return G.char.loc === 'overworld' ? 'o' : 'd:' + dungeonKey();
}
const kitOf = (held: string): Kit => {
  const k = held as ItemKey;
  if (WEAPON_KIND[k] === 0) return gunOf(k)?.look === 'pistol' ? 'pistol' : 'rifle';
  if (WEAPON_KIND[k] === 1) return k === 'spear' ? 'spear' : 'sword';
  if (k === 'pickaxe') return 'pick';
  if (k === 'hatchet' || k === 'hammer') return 'hammer';
  return 'none';
};

interface Avatar { f: Figure; kit: Kit; away: boolean; label: THREE.Sprite; phase: number; seated: boolean }
const avatars = new Map<number, Avatar>();
function drop(id: number) {
  const a = avatars.get(id);
  if (!a) return;
  scene.remove(a.f.g); (a.label.material as THREE.SpriteMaterial).map?.dispose(); a.label.material.dispose();
  avatars.delete(id);
}
function avatar(id: number, name: string, kit: Kit, away: boolean): Avatar {
  const old = avatars.get(id);
  if (old && old.kit === kit && old.away === away) return old;
  if (old) drop(id);
  // a player in the menu stays in the world (the others see them standing there), marked as away
  const c = peerColor(id), f = makeFigure(c, kit), label = textSprite(away ? name + ' (in menu)' : name, '#' + c.toString(16).padStart(6, '0'));
  label.position.y = 2.2; f.g.add(label);
  const a: Avatar = { f, kit, away, label, phase: Math.random() * 6, seated: false };
  avatars.set(id, a);
  return a;
}

let sendT = 0;
/** Flush seating and the current vehicle pose before requesting a gate transfer. */
export function flushPeerState(moving = false) {
  if (!net.id) return;
  sendT = SEND_EVERY;
  const s: PeerState = { p: [G.pos.x, G.pos.y, G.pos.z], yaw: G.yaw, pitch: G.pitch, loc: myLoc(), held: G.char.hands[0]?.k ?? '', mv: moving && G.playing, away: !G.playing, cars: myCars(), carIds: myCarList().map(v => v.st.id), ride: ride.on ? [ride.on.owner, ride.on.idx, ride.on.seat] : undefined, gun: ride.on ? ride.gun : undefined, boat: myBoatSpot(), vis: Math.round(myVis() * 100) / 100, cr: G.crouch || undefined };
  sendState(s, isHost() ? G.char.time : undefined);
}
/** Every frame: send where you are now and then, and draw the others. */
export function updatePeers(dt: number, moving: boolean) {
  if (!net.id) { if (avatars.size || ghosts.size || ride.on) clearPeers(); return; }
  if ((sendT -= dt) <= 0 && !net.gateTravelling) flushPeerState(moving);
  const here = myLoc(), now = performance.now();
  for (const id of [...avatars.keys()]) if (!net.peers.has(id)) drop(id);
  syncCars(here, now);
  for (const p of net.peers.values()) {
    const s = p.st;
    if (!s || s.loc !== here) { drop(p.id); continue; }
    const a = avatar(p.id, p.name, kitOf(s.held), !!s.away);
    // drawn a little in the past, between the two snapshots round that moment, so the motion stays smooth when packets
    // come unevenly
    const at = peerAt(p, now - PEER_DELAY)!, k = at.k, q = at.a.loc === here ? at.a : s, e = at.b.loc === here ? at.b : s;
    const x = q.p[0] + (e.p[0] - q.p[0]) * k, y = q.p[1] + (e.p[1] - q.p[1]) * k, z = q.p[2] + (e.p[2] - q.p[2]) * k;
    a.f.g.position.set(here === 'o' ? nearX(x, G.pos.x) : x, y, z);
    // aboard one of the boats drawn here: where they stand on it now, so they ride with it instead of lagging behind
    const onb = here === 'o' && e.boat ? boatPoint(e.boat[0], e.boat[1], e.boat[2], e.boat[3]) : null;
    if (onb) a.f.g.position.set(onb[0], onb[1], onb[2]);
    let dy = e.yaw - q.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    a.f.g.rotation.y = q.yaw + dy * k + Math.PI; // the figure faces +z, the player looks along -z
    // in a vehicle (theirs or someone's): their figure sits in it (drawn with the vehicle), only the name stays over it
    const seated = here === 'o' && (!!e.cars?.some((c) => c[8]) || !!e.ride);
    if (seated !== a.seated) { a.seated = seated; for (const o of a.f.g.children) if (o !== a.label) o.visible = !seated; }
    if (seated) continue;
    a.phase += dt * (s.mv ? (s.cr ? 5 : 9) : 0);
    const sw = s.mv ? Math.sin(a.phase) * (s.cr ? 0.3 : 0.5) : 0;
    // crouched: lower, knees bent forward
    if (s.cr) a.f.g.position.y -= 0.45;
    a.f.legL.rotation.x = sw + (s.cr ? -1.1 : 0); a.f.legR.rotation.x = -sw + (s.cr ? -1.1 : 0);
    poseRig(a.f.rig, { swing: sw, aim: a.kit === 'rifle' || a.kit === 'pistol' ? Math.max(0, Math.min(1, 0.5 - s.pitch)) : 0 });
  }
}
/** Forget every figure (leaving the game, loading another place). */
export function clearPeers() {
  for (const id of [...avatars.keys()]) drop(id);
  for (const k of [...ghosts.keys()]) dropGhost(k);
  ride.on = null;
  for (const v of myCarList()) { v.riders.forEach((r, i) => { if (r?.who.startsWith('peer:')) unseat(v, i); }); v.gunYaw = undefined; }
}

// ---------- the others' vehicles ----------
// Every player sends where their own vehicles stand (and which one they drive); here each is drawn as a body with
// wheels (and the cannon), the people aboard in their seats, eased between snapshots while it moves. They block you
// and your vehicle like any other. Only their owner drives them (their game moves them), but anyone can ride along
// in a free seat (world/ride.ts) and work the cannon from the gunner's.
/** Who sits in a seat: 'p<id>' another player, 'me' you. */
export type Occupant = string | null;
export interface Ghost {
  g: THREE.Group; m: VehicleModel; gun: boolean; turret: THREE.Group | null; owner: number; idx: number;
  x: number; y: number; z: number; h: number; p: number; r: number;
  /** The seats taken now, and the players who reached for a taken seat (the later ones give way). */
  occ: Occupant[]; bumped: Set<string>;
  figs: (Figure | null)[]; figKey: Occupant[];
  /** The cannon's yaw as its owner's game shows it. */
  aim: number;
  condition: number;
}
const ghosts = new Map<string, Ghost>();
const MODELS: VehicleModel[] = ['scout', 'mastodon'];
const ME_C = 0xd8ffe8;
/** You riding in another player's vehicle (world/ride.ts runs it): whose, which of theirs, which seat, the cannon's yaw. */
export const ride = { on: null as { owner: number; idx: number; seat: number } | null, gun: 0, cockpit: false };
onSeats((m) => {
  const wanted = ride.on ? [ride.on.owner, ride.on.idx, ride.on.seat] : null;
  if (ride.on && JSON.stringify(wanted) === JSON.stringify(m.requested) && !m.ride) getOff(true);
  const list = myCarList(), v = driving.v, idx = v ? list.indexOf(v) : -1;
  if (idx >= 0 && m.requestedSeats?.[idx] === driving.seat + 1 && m.seats?.[idx] !== driving.seat + 1) leave();
});
export const ghostOf = (owner: number, idx: number) => ghosts.get(owner + ':' + idx) ?? null;
export const allGhosts = () => ghosts.values();
function dropGhost(k: string) {
  const g = ghosts.get(k);
  if (!g) return;
  scene.remove(g.g); ghosts.delete(k);
}
const lerpAng = (a: number, b: number, k: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
/** Seat the riders who asked for seat s of a vehicle whose owner sits in `own` (-1 = not in it): the owner first, then by id. */
function seatsFor(n: number, own: number, riders: { id: string; seat: number; n: number }[]): { occ: Occupant[]; bumped: Set<string>; byId: Map<string, number> } {
  const occ: Occupant[] = Array(n).fill(null), bumped = new Set<string>(), byId = new Map<string, number>();
  if (own >= 0 && own < n) occ[own] = 'owner';
  for (const r of riders.sort((a, b) => a.n - b.n)) {
    if (r.seat < 1 || r.seat >= n || occ[r.seat]) { bumped.add(r.id); continue; } // the wheel stays the owner's
    occ[r.seat] = r.id; byId.set(r.id, r.seat);
  }
  return { occ, bumped, byId };
}
function syncCars(here: string, now: number) {
  const seen = new Set<string>();
  if (here === 'o') for (const p of net.peers.values()) {
    const at = peerAt(p, now - PEER_DELAY), cars = at?.b.cars;
    if (!at || !cars || p.st?.loc !== here) continue;
    const k = at.k, prev = at.a.cars;
    cars.forEach((c: PeerCar, i) => {
      const m = MODELS[c[0]] ?? 'scout', gun = !!c[7], key = p.id + ':' + i;
      seen.add(key);
      let g = ghosts.get(key);
      if (g && (g.m !== m || g.gun !== gun)) { dropGhost(key); g = undefined; }
      if (!g) {
        const cm = convoyModel(m, gun), n = SEATS[m].length;
        g = { g: cm.g, m, gun, turret: cm.turret, owner: p.id, idx: i, x: c[1], y: c[2], z: c[3], h: c[4], p: c[5], r: c[6], occ: Array(n).fill(null), bumped: new Set(), figs: Array(n).fill(null), figKey: Array(n).fill(null), aim: 0, condition: c[10] ?? 100 };
        scene.add(g.g); ghosts.set(key, g);
      }
      const q = prev?.[i] && prev[i][0] === c[0] && at.a.carIds?.[i] === at.b.carIds?.[i] && Math.hypot(prev[i][1] - c[1], prev[i][3] - c[3]) < 80 ? prev[i] : c;
      g.x = q[1] + (c[1] - q[1]) * k; g.y = q[2] + (c[2] - q[2]) * k; g.z = q[3] + (c[3] - q[3]) * k;
      g.h = lerpAng(q[4], c[4], k); g.p = q[5] + (c[5] - q[5]) * k; g.r = q[6] + (c[6] - q[6]) * k;
      g.condition = c[10] ?? 100;
      g.aim = c.length > 9 ? lerpAng(q[9] ?? c[9], c[9], k) : 0;
      g.x = nearX(g.x, G.pos.x);
      g.g.position.set(g.x, g.y - 0.05, g.z);
      g.g.rotation.set(-g.p, g.h, g.r, 'YXZ');
      // who sits where: the owner (their seat + 1 in c[8]; older games send 1 for driving), then the riders
      const riders: { id: string; seat: number; n: number }[] = [];
      for (const o of net.peers.values()) { const r = o.st?.ride; if (r && r[0] === p.id && r[1] === i) riders.push({ id: 'p' + o.id, seat: r[2], n: o.id }); }
      if (ride.on && ride.on.owner === p.id && ride.on.idx === i) riders.push({ id: 'me', seat: ride.on.seat, n: net.id });
      const st = seatsFor(SEATS[m].length, ((p.st?.cars?.[i]?.[8] ?? 0) | 0) - 1, riders);
      g.occ = st.occ.map((o) => (o === 'owner' ? 'p' + p.id : o)); g.bumped = st.bumped;
      g.occ.forEach((o, si) => {
        if (g!.figKey[si] === o) return;
        if (g!.figs[si]) g!.g.remove(g!.figs[si]!.g);
        g!.figs[si] = null; g!.figKey[si] = o;
        if (!o) return;
        const f = seatFigure(m, si, o === 'me' ? ME_C : peerColor(+o.slice(1)));
        g!.figs[si] = f; g!.g.add(f.g);
      });
      const gs = SEATS[m].findIndex((x) => x.gun), meGun = ride.on && ride.on.owner === p.id && ride.on.idx === i && g.occ[gs] === 'me';
      if (g.turret) g.turret.rotation.y = meGun ? ride.gun : g.aim;
      if (gs >= 0 && g.figs[gs]) g.figs[gs]!.g.rotation.y = g.turret ? g.turret.rotation.y : 0; // the gunner turns with the cannon
      const mine = g.occ.indexOf('me');
      if (mine >= 0 && g.figs[mine]) g.figs[mine]!.g.visible = !ride.cockpit; // in the seat's view your own figure would fill the screen
    });
  }
  for (const k of [...ghosts.keys()]) if (!seen.has(k)) dropGhost(k);
  syncMyRiders();
}
/** The players riding in your own vehicles: seated there, the one at the cannon aiming it. */
function syncMyRiders() {
  const list = myCarList();
  list.forEach((v, i) => {
    const riders: { id: string; seat: number; n: number }[] = [];
    for (const o of net.peers.values()) { const r = o.st?.ride; if (r && r[0] === net.id && r[1] === i) riders.push({ id: 'peer:' + o.id, seat: r[2], n: o.id }); }
    const own = v === driving.v ? driving.seat : -1, st = seatsFor(SEATS[v.st.model].length, own, riders);
    v.riders.forEach((r, si) => { if (r && r.who.startsWith('peer:') && st.occ[si] !== r.who) unseat(v, si); });
    st.occ.forEach((o, si) => { if (o && o !== 'owner' && v.riders[si]?.who !== o) seatRider(v, si, o, peerColor(+o.slice(5))); });
    const gs = gunSeat(v.st.model), gunner = st.occ[gs];
    v.gunYaw = gunner && gunner !== 'owner' ? net.peers.get(+gunner.slice(5))?.st?.gun ?? 0 : undefined;
  });
}
/** Another player's vehicle in the way (for you on foot and for your vehicle). */
export function peerCarHit(x: number, y: number, z: number, r: number): boolean {
  for (const g of ghosts.values()) {
    const s = VEHICLES[g.m];
    if (y > g.y + s.height || y + 1.7 < g.y) continue;
    const [lx, lz] = toLocalOf(g.h, g.x, g.z, x, z);
    if (Math.abs(lx) < s.width / 2 + r && Math.abs(lz) < s.length / 2 + r) return true;
  }
  return false;
}
