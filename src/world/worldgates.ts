import * as THREE from 'three';
import { G } from '../game';
import { gatesNear, gateLocal, gatePoint, gateRocks, tabletDestinations, worldGates, GATE_PANEL, GATE_TABLET, GATE_SECONDS, type WorldGate } from '../gen/worldgates';
import { GateConnections, gateAddresses, GATE_TRANSIT_SECONDS, type GateLink } from '../../shared/gates.mjs';
import { ringHit, crossedGate, vehicleFitsGate } from '../gen/gategeometry';
import { net, online, liveGateLinks, requestGateDial, requestGateTravel, onGateTransit, liveGateDraft, sendGateDraft } from '../net/client';
import { driving, myCarList, myCars, vehicles, type Vehicle } from './vehicles';
import { riding } from './ride';
import { flushPeerState } from './peers';
import { worldDist, wrapDx } from '../gen/regions';
import { VEHICLES, SEATS } from '../data/vehicles';
import { showToast } from '../ui/hud';
import type { Terrain } from '../gen/terrain';
import { scene, disposeTree } from './render';
import { startGateTransit, finishGateTransit, gateTransitActive } from '../ui/gatetransit';
import { gateModel, gateEnergy, gateSignals } from './gatemodel';

interface LoadedGate { site: WorldGate; group: THREE.Group; energy: THREE.Mesh; signal: THREE.Group | null; signalKey: string; rocks: (ReturnType<typeof gateRocks>[number] & { y: number })[]; previous: [number, number, number] }
const loaded = new Map<number, LoadedGate>();
let travel: (gate: WorldGate, x: number, z: number, heading: number, car: Vehicle | null) => void = () => {};
export function setGateTravel(fn: typeof travel) { travel = fn; }
let single = new GateConnections(() => Date.now()), connectionKey = '', pendingTravel = false;
export const gateTravelPending = () => pendingTravel || gateTransitActive();
function connections(): GateLink[] {
  const key = `${G.char.world}:${online() ? `${net.room?.id}:${net.id}` : 'solo'}`;
  if (key !== connectionKey) { connectionKey = key; single = new GateConnections(() => Date.now()); }
  return online() ? liveGateLinks() : single.state();
}
export function gateConnection(id: number): GateLink | null { return connections().find(l => l.a === id || l.b === id) ?? null; }
export function gateDialSymbols(id: number): number[] {
  const link = gateConnection(id);
  if (link) return gateAddresses(G.char.world)[id === link.a ? link.b : link.a];
  return online() ? liveGateDraft(id) : single.draft(id);
}
export function setGateDraft(id: number, symbols: readonly number[]) {
  connections();
  if (online()) { flushPeerState(); sendGateDraft(id, symbols); }
  else single.setDraft(id, symbols);
}
onGateTransit(m => {
  if (m.t === 'gdepart' && m.players.includes(net.id)) { net.gateTravelling = true; startGateTransit(m.trip); }
  else if (m.t === 'gabort') { finishGateTransit(m.trip); net.gateTravelling = false; }
});
export const gateSecondsLeft = (id: number) => Math.max(0, Math.ceil(((gateConnection(id)?.until ?? 0) - Date.now()) / 1000));
function localPlayer(g: WorldGate): [number, number, number] {
  const [x, z] = gateLocal(g, G.pos.x, G.pos.z); return [x, G.pos.y - g.y + 1, z];
}
export function syncWorldGates(T: Terrain, x: number, z: number) {
  const near = gatesNear(T.world, x, z, 230), keep = new Set(near.map(g => g.id));
  for (const [id, g] of loaded) if (!keep.has(id)) { disposeTree(g.group); (g.energy.material as THREE.Material).dispose(); loaded.delete(id); }
  for (const site of near) {
    const existing = loaded.get(site.id);
    if (existing) { existing.site = site; existing.group.position.x = site.x; continue; }
    const height = (u: number, v: number) => { const [px, pz] = gatePoint(site, u, v); return T.heightAt(px, pz) - site.y; };
    const group = gateModel(site, height, tabletDestinations(T.world, site).map(g => g.address));
    group.position.set(site.x, site.y, site.z); group.rotation.y = site.yaw;
    const energy = gateEnergy(); group.add(energy); scene.add(group);
    loaded.set(site.id, { site, group, energy, signal: null, signalKey: '', rocks: gateRocks(site).map(b => ({ ...b, y: height(b.x, b.z) - .15 })), previous: localPlayer(site) });
  }
}
export function clearWorldGates() {
  for (const g of loaded.values()) { disposeTree(g.group); (g.energy.material as THREE.Material).dispose(); }
  loaded.clear();
}
function nearDevice(point: readonly [number, number]): WorldGate | null {
  if (G.char.loc !== 'overworld') return null;
  for (const g of loaded.values()) {
    const [x, z] = gateLocal(g.site, G.pos.x, G.pos.z);
    if (Math.hypot(x - point[0], z - point[1] - 1.2) < 2.3 && Math.abs(G.pos.y - g.site.y) < 1.3) return g.site;
  }
  return null;
}
export const nearGatePanel = () => nearDevice(GATE_PANEL);
export const nearGateTablet = () => nearDevice(GATE_TABLET);
export async function dialWorldGate(source: WorldGate, symbols: readonly number[]): Promise<string> {
  const g = loaded.get(source.id), near = nearGatePanel();
  if (!g || near?.id !== source.id || driving.v || riding()) return 'Stand beside this gate\'s console on foot.';
  if (gateConnection(source.id)) return `Terminal locked for ${gateSecondsLeft(source.id)} seconds.`;
  // Resolve the remote terrain before starting the admission clock, never during a late crossing.
  worldGates(G.char.world);
  connections();
  if (online()) flushPeerState();
  const result = online() ? await requestGateDial(source.id, symbols) : single.open(G.char.world, source.id, symbols);
  if (!result.ok) return result.why ?? 'No connection.';
  return `Connection open for ${GATE_SECONDS} seconds. Both terminals are locked. Walk or drive through the ring.`;
}

/** Avoid an occupied exit while leaving enough room for the whole truck behind the portal plane. */
function landing(to: WorldGate, car: Vehicle | null, side: number): [number, number] | null {
  const length = car?.spec.length ?? 1, width = car?.spec.width ?? .8;
  const occupied = vehicles.filter(v => v !== car).map(v => ({ x: v.st.x, z: v.st.z, w: v.spec.width, l: v.spec.length, h: v.st.heading }));
  for (const p of net.peers.values()) if (p.st?.loc === 'o') for (const c of p.st.cars ?? []) {
    const s = VEHICLES[c[0] === 1 ? 'mastodon' : 'scout']; occupied.push({ x: c[1], z: c[3], w: s.width, l: s.length, h: c[4] });
  }
  for (const offset of [0, width + 2, -width - 2]) {
    const point = gatePoint(to, offset, side * (length / 2 + 4));
    const clear = occupied.every(o => {
      if (worldDist(point[0], point[1], o.x, o.z) > length + o.l + 4) return true;
      const dx = wrapDx(point[0] - o.x), dz = point[1] - o.z;
      const x = dx * Math.cos(o.h) - dz * Math.sin(o.h), z = dx * Math.sin(o.h) + dz * Math.cos(o.h), a = to.yaw - o.h;
      return Math.abs(x) > o.w / 2 + Math.abs(Math.cos(a)) * width / 2 + Math.abs(Math.sin(a)) * length / 2 + .5 || Math.abs(z) > o.l / 2 + Math.abs(Math.cos(a)) * length / 2 + Math.abs(Math.sin(a)) * width / 2 + .5;
    });
    if (clear) return point;
  }
  return null;
}
function beginTravel(g: LoadedGate, to: WorldGate, side: number) {
  const car = driving.v, point = landing(to, car, side);
  if (!point) { if (car) car.speed = 0; showToast('The destination exit is occupied. Wait for it to clear.'); return; }
  const [x, z] = point, heading = to.yaw + (side < 0 ? Math.PI : 0), world = G.char.world;
  if (!online()) {
    const connection = single, accepted = connection.begin(g.site.id);
    if (!accepted) return;
    pendingTravel = true; startGateTransit(accepted.token); if (car) car.speed = 0;
    setTimeout(() => {
      try { if (G.char.world === world && G.char.loc === 'overworld' && driving.v === car) travel(to, x, z, heading, car); }
      finally { connection.finish(accepted.token); finishGateTransit(accepted.token); pendingTravel = false; }
    }, GATE_TRANSIT_SECONDS * 1000);
    return;
  }
  const index = car ? myCarList().indexOf(car) : -1, pose = car ? [...myCars()[index]] : null;
  if (pose) { pose[1] = x; pose[2] = to.y; pose[3] = z; pose[4] = heading; pose[5] = pose[6] = 0; }
  flushPeerState(); pendingTravel = net.gateTravelling = true;
  void requestGateTravel(g.site.id, car && pose ? { index, id: car.st.id, pose } : undefined).then(result => {
    if (result.ok && result.to === to.id && G.char.world === world && G.char.loc === 'overworld' && driving.v === car) travel(to, x, z, heading, car);
    else { if (car) car.speed = 0; showToast(result.why ?? 'The connection closed.'); }
  }).finally(() => { finishGateTransit(); pendingTravel = net.gateTravelling = false; });
}
export function updateWorldGates(dt: number, canTravel = false) {
  if (G.char.loc !== 'overworld') return;
  for (const g of loaded.values()) {
    const now = localPlayer(g.site), link = gateConnection(g.site.id);
    g.energy.visible = !!link;
    const symbols = gateDialSymbols(g.site.id), key = symbols.join(',');
    if (key !== g.signalKey) {
      if (g.signal) { g.group.remove(g.signal); disposeTree(g.signal); }
      g.signal = gateSignals(symbols); g.signalKey = key; g.group.add(g.signal);
    }
    if (link) {
      (g.energy.material as THREE.ShaderMaterial).uniforms.time.value += dt;
      if (canTravel && !gateTravelPending() && !riding() && crossedGate(g.previous, now)) {
        const car = driving.v, [x] = gateLocal(g.site, G.pos.x, G.pos.z);
        const height = car ? Math.max(car.spec.height, ...SEATS[car.st.model].map(s => s.y + 1.9), car.turret ? car.spec.mount[1] + 2 : 0) : 0;
        if (!car || vehicleFitsGate(x, car.y - g.site.y, car.st.heading - g.site.yaw, car.spec.width, car.spec.length, height)) {
          const to = worldGates(G.char.world)[link.a === g.site.id ? link.b : link.a];
          beginTravel(g, to, g.previous[2] >= 0 ? 1 : -1); g.previous = now; return;
        }
      }
    }
    g.previous = now;
  }
}
export function worldGateHit(px: number, py: number, pz: number, r: number): boolean {
  for (const g of loaded.values()) {
    const [x, z] = gateLocal(g.site, px, pz), y = py - g.site.y;
    if (ringHit(x, y, z, r)) return true;
    if (Math.abs(x - GATE_PANEL[0]) < 1 + r && Math.abs(z - GATE_PANEL[1]) < .8 + r && y > -r && y < 2.45 + r) return true;
    if (Math.abs(x - GATE_TABLET[0]) < 1.8 + r && Math.abs(z - GATE_TABLET[1]) < .8 + r && y > -r && y < 2.9 + r) return true;
    for (const b of g.rocks) if (y > b.y - r && y < b.y + b.h + r && Math.hypot(x - b.x, z - b.z) < b.r + r) return true;
  }
  return false;
}

const caster = new THREE.Raycaster();
/** Only opaque stone geometry stops shots and sight; the active energy sheet is passable. */
export function worldGateRay(o: { x: number; y: number; z: number }, d: { x: number; y: number; z: number }, maxT: number): number {
  caster.ray.origin.set(o.x, o.y, o.z); caster.ray.direction.set(d.x, d.y, d.z); caster.near = 0; caster.far = maxT;
  for (const g of loaded.values()) {
    g.group.updateMatrixWorld(true);
    const stone = g.group.children[0];
    if (!(stone instanceof THREE.Mesh)) continue;
    const hit = caster.intersectObject(stone, false)[0]; if (hit && hit.distance < maxT) { maxT = hit.distance; caster.far = maxT; }
  }
  return maxT;
}
