import * as THREE from 'three';
import { G } from '../game';
import { gatesNear, gateLocal, gatePoint, gateDestination, gateName, gateRocks, GATE_SECONDS, type WorldGate } from '../gen/worldgates';
import { ringHit, crossedGate } from '../gen/gategeometry';
import type { Terrain } from '../gen/terrain';
import { scene, disposeTree } from './render';
import { gateModel, gateEnergy } from './gatemodel';

interface LoadedGate { site: WorldGate; group: THREE.Group; energy: THREE.Mesh; rocks: (ReturnType<typeof gateRocks>[number] & { y: number })[]; to: WorldGate | null; left: number; previous: [number, number, number] }
const loaded = new Map<number, LoadedGate>();
let travel: (gate: WorldGate, x: number, z: number) => void = () => {};
export function setGateTravel(fn: typeof travel) { travel = fn; }
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
    const group = gateModel(site, height);
    group.position.set(site.x, site.y, site.z); group.rotation.y = site.yaw;
    const energy = gateEnergy(); group.add(energy); scene.add(group);
    loaded.set(site.id, { site, group, energy, rocks: gateRocks(site).map(b => ({ ...b, y: height(b.x, b.z) - .15 })), to: null, left: 0, previous: localPlayer(site) });
  }
}
export function clearWorldGates() {
  for (const g of loaded.values()) { disposeTree(g.group); (g.energy.material as THREE.Material).dispose(); }
  loaded.clear();
}
export function nearGatePanel(): WorldGate | null {
  if (G.char.loc !== 'overworld') return null;
  for (const g of loaded.values()) {
    const [x, z] = gateLocal(g.site, G.pos.x, G.pos.z);
    if (Math.hypot(x - 6.3, z - 4.1) < 2.3 && Math.abs(G.pos.y - g.site.y) < 1.3) return g.site;
  }
  return null;
}
export function dialWorldGate(source: WorldGate, symbols: readonly number[]): string {
  const g = loaded.get(source.id), near = nearGatePanel();
  if (!g || near?.id !== source.id) return 'Stand beside this gate\'s console.';
  const to = gateDestination(G.char.world, source.id, symbols);
  // Invalid dialing also disconnects a previous opening, so stale destinations cannot be entered by mistake.
  g.to = to; g.left = to ? GATE_SECONDS : 0; g.energy.visible = !!to; g.previous = localPlayer(g.site);
  return to ? `Connected to ${gateName(to)}. Walk through the ring within ${GATE_SECONDS} seconds.` : 'No connection. This address is unassigned or belongs to this gate.';
}
export function shutWorldGate(source: WorldGate) {
  const g = loaded.get(source.id); if (g) { g.to = null; g.left = 0; g.energy.visible = false; }
}
export function updateWorldGates(dt: number, onFoot: boolean) {
  if (G.char.loc !== 'overworld') return;
  for (const g of loaded.values()) {
    const now = localPlayer(g.site);
    if (g.to && (g.left -= dt) <= 0) shutWorldGate(g.site);
    if (g.to) {
      (g.energy.material as THREE.ShaderMaterial).uniforms.time.value += dt;
      if (onFoot && crossedGate(g.previous, now)) {
        const to = g.to, [x, z] = gatePoint(to, 0, 4); shutWorldGate(g.site);
        travel(to, x, z); return; // travelling rebuilds the streamed world and its loaded gate map
      }
    }
    g.previous = now;
  }
}
export function worldGateHit(px: number, py: number, pz: number, r: number): boolean {
  for (const g of loaded.values()) {
    const [x, z] = gateLocal(g.site, px, pz), y = py - g.site.y;
    if (ringHit(x, y, z, r)) return true;
    if (Math.abs(x - 6.3) < .9 + r && Math.abs(z - 3) < .65 + r && y > -r && y < 2.45 + r) return true;
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
