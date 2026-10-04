// Riding along in another player's vehicle (multiplayer): E at its door takes a free seat (the passenger's, else the
// gunner's), 1 / 2 / 3 move you between the free seats (the wheel stays the owner's: their game drives it), V the
// view, E gets you out beside it. From the gunner's seat you work its cannon: you aim it with the view and fire, the
// others see it turn. Where the vehicle is and who sits where comes from world/peers.ts (`ride`, the ghosts).
import * as THREE from 'three';
import { finishGateTransit } from '../ui/gatetransit';
import { G } from '../game';
import { V } from './render';
import { ride, allGhosts, ghostOf, type Ghost } from './peers';
import { net, onVehicleWarp } from '../net/client';
import { VEHICLES, SEATS, vehicleTitle } from '../data/vehicles';
import { SEAT_NAMES, shootCannon } from './vehicles';
import { showToast, logLine, el } from '../ui/hud';
import { collides } from './player';

export const riding = () => !!ride.on;
let warpArrival = () => {};
export function setRideWarpArrival(fn: () => void) { warpArrival = fn; }
onVehicleWarp(m => {
  const g = ghostOf(m.owner, m.index), c = m.car;
  if (g) {
    const delta = c[4] - g.h;
    g.x = c[1]; g.y = c[2]; g.z = c[3]; g.h = c[4]; g.p = c[5]; g.r = c[6];
    g.g.position.set(g.x, g.y - .05, g.z); g.g.rotation.set(-g.p, g.h, g.r, 'YXZ');
    if (ride.on?.owner === m.owner && ride.on.idx === m.index) G.yaw += delta;
  }
  if (ride.on?.owner === m.owner && ride.on.idx === m.index) {
    // Keep the passenger or gunner's seat. Do not call getOff or reload the whole world.
    G.pos.set(c[1], c[2], c[3]); G.vel.set(0, 0, 0); warpArrival();
    finishGateTransit(m.trip); net.gateTravelling = false;
    showToast('Your vehicle travelled through the ancient gate.');
  }
});
const ownerName = (g: Ghost) => net.peers.get(g.owner)?.name ?? 'Someone';
const title = (g: Ghost) => vehicleTitle(g.m);
const toWorld = (g: Ghost, lx: number, lz: number): [number, number] => {
  const c = Math.cos(g.h), s = Math.sin(g.h);
  return [g.x + lx * c + lz * s, g.z - lx * s + lz * c];
};
/** The first seat free for a rider: the passenger's, then the gunner's (only with a cannon on the roof); -1 = full. */
function freeSeat(g: Ghost, but = -1): number {
  for (let i = 1; i < SEATS[g.m].length; i++) {
    if (i === but || (g.occ[i] && g.occ[i] !== 'me')) continue;
    if (SEATS[g.m][i].gun && !g.turret) continue;
    return i;
  }
  return -1;
}

export interface RideSpot { g: Ghost; seat: number }
/** Another player's vehicle whose door you stand at (on foot, in the open world). */
export function rideSpot(): RideSpot | null {
  if (G.char.loc !== 'overworld' || ride.on) return null;
  let best: RideSpot | null = null, bd = 2.4;
  for (const g of allGhosts()) {
    if (g.condition <= 0) continue;
    if (Math.abs(G.pos.y - g.y) > 2.5) continue;
    const s = VEHICLES[g.m];
    for (const side of [-1, 1]) {
      const [x, z] = toWorld(g, side * s.door[0], s.door[1]), d = Math.hypot(x - G.pos.x, z - G.pos.z);
      if (d < bd) { bd = d; best = { g, seat: freeSeat(g) }; }
    }
  }
  return best;
}
export const ridePrompt = (s: RideSpot) => (s.seat < 0 ? `${ownerName(s.g)}'s ${title(s.g)} is full` : `E — ride in ${ownerName(s.g)}'s ${title(s.g)} (the ${SEAT_NAMES[s.seat]}'s seat)`);

let cool = 0;
export function board(s: RideSpot) {
  if (s.seat < 0) { showToast('No free seat'); return; }
  ride.on = { owner: s.g.owner, idx: s.g.idx, seat: s.seat }; ride.gun = 0;
  G.vel.set(0, 0, 0); G.firing = false;
  G.yaw = s.g.h + Math.PI; G.pitch = -0.12;
  showToast(`${ownerName(s.g)}'s ${title(s.g)}`);
  logLine(`You climb into ${ownerName(s.g)}'s ${title(s.g)}: the ${SEAT_NAMES[s.seat]}'s seat. 1 / 2 / 3 change seats, E gets you out.`);
}
/** Out beside the vehicle (the door's side, else the other side or behind it). */
export function getOff(quiet = false) {
  const on = ride.on, g = on ? ghostOf(on.owner, on.idx) : null;
  ride.on = null; el.veh.innerHTML = '';
  if (!g) return;
  const s = VEHICLES[g.m];
  for (const [lx, lz] of [[s.door[0], s.door[1]], [-s.door[0], s.door[1]], [s.rear[0], s.rear[1] - 0.8], [s.door[0] + 1, s.door[1]]]) {
    const [x, z] = toWorld(g, lx, lz);
    G.pos.set(x, g.y + 0.3, z);
    if (!collides(G.pos)) break;
  }
  G.vel.set(0, 0, 0); G.yaw = g.h + Math.PI; G.pitch = 0;
  if (!quiet) showToast('Out');
}
/** Keys 1 / 2 / 3 while riding along. */
export function rideSeat(i: number) {
  const on = ride.on, g = on ? ghostOf(on.owner, on.idx) : null;
  if (!on || !g || i === on.seat || i < 0 || i >= SEATS[g.m].length) return;
  if (i === 0) { showToast(`Only ${ownerName(g)} can drive it`); return; }
  if (g.occ[i] && g.occ[i] !== 'me') { showToast(`The ${SEAT_NAMES[i]}'s seat is taken`); return; }
  if (SEATS[g.m][i].gun && !g.turret) { showToast('No cannon on the roof'); return; }
  on.seat = i; showToast(`In the ${SEAT_NAMES[i]}'s seat`);
}
export const toggleRideView = () => { ride.cockpit = !ride.cockpit; };

/** Every frame while riding (instead of walking): sit where the vehicle is, work the cannon from the gunner's seat. */
export function updateRide(dt: number) {
  const on = ride.on!, g = ghostOf(on.owner, on.idx);
  if (!g) { ride.on = null; el.veh.innerHTML = ''; showToast('The vehicle is gone'); logLine('The vehicle you rode in is gone (its owner left or went elsewhere).'); return; }
  if (g.condition <= 0) { getOff(true); showToast('Vehicle disabled: condition 0%'); return; }
  if (g.bumped.has('me')) { // someone else got to that seat first
    const s = freeSeat(g, on.seat);
    if (s < 0) { getOff(true); showToast('No seat left for you'); return; }
    on.seat = s; showToast(`Moved to the ${SEAT_NAMES[s]}'s seat`);
  }
  G.pos.set(g.x, g.y, g.z); G.vel.set(0, 0, 0);
  const gunner = !!SEATS[g.m][on.seat]?.gun;
  if (gunner && g.turret) {
    let a = G.yaw + Math.PI - g.h; a = Math.atan2(Math.sin(a), Math.cos(a));
    ride.gun = a; g.turret.rotation.y = a;
    cool -= dt;
    if (G.firing && cool <= 0) { cool = 0.55; g.g.updateMatrixWorld(true); shootCannon(g.turret); }
  }
  el.veh.innerHTML = `${ownerName(g)}'s ${title(g)} · the ${SEAT_NAMES[on.seat]}'s seat${gunner ? ' · you work the cannon' : ''}` +
    `<br>condition ${Math.ceil(g.condition)}% · 1 / 2 / 3 change seats · V view · E get out`;
}
const tmp = new THREE.Vector3();
/** Behind and above the vehicle, or the seat's own view (V). */
export function rideCamera(camera: THREE.PerspectiveCamera) {
  const on = ride.on, g = on ? ghostOf(on.owner, on.idx) : null;
  if (!on || !g) return;
  const s = VEHICLES[g.m], st = SEATS[g.m][on.seat];
  if (ride.cockpit) {
    tmp.set(st.x, st.y + (st.gun ? 1.6 : 0.75), st.z).applyEuler(g.g.rotation).add(g.g.position);
    camera.position.copy(tmp); return;
  }
  const dist = s.length * 0.9 + 4, cy = Math.cos(G.pitch), f = V(-Math.sin(G.yaw) * cy, Math.sin(G.pitch), -Math.cos(G.yaw) * cy);
  const p = V(g.x, g.y + s.height * 0.85, g.z).addScaledVector(f, -dist); p.y += 1.2;
  camera.position.copy(p);
}
