// Batched, opaque ancient stonework. Each monument is a local mesh, streamed independently of terrain chunks.
import * as THREE from 'three';
import { megalithsNear, megalithStones, megalithLocal, megalithStoneHit, type Megalith, type MegalithStone } from '../gen/megaliths';
import { PropBatch } from './props';
import { scene, disposeTree } from './render';
import { rng } from '../core/rng';
const STONE = 0x91ad94, CARVING = 0x4f765a, CROWN = 0xd1c597;
interface Loaded { site: Megalith; group: THREE.Group; stones: MegalithStone[] }
const loaded = new Map<string, Loaded>();
export function megalithModel(site: Megalith): THREE.Group {
  const pb = new PropBatch(), R = rng(site.seed);
  for (const b of megalithStones(site)) {
    const c = Math.cos(b.yaw), s = Math.sin(b.yaw);
    const point = (x: number, y: number, z: number) => [b.x + c * x + s * z, b.y + y, b.z - s * x + c * z];
    const ring = (y: number, factor: number) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => point(x * b.w / 2 * factor, y, z * b.d / 2 * factor));
    pb.solid8(ring(0, 1), ring(b.h, .94), b.cap ? CROWN : STONE);
    // Irregular fracture lines follow each taper instead of floating in front of the stone.
    for (const side of [-1, 1]) {
      const y = b.h * (.2 + R() * .5), x = (R() - .5) * b.w * .5;
      const p = (u: number, v: number) => point(u, v, side * (b.d / 2 * (1 - .06 * v / b.h) + .025));
      pb.line(CARVING, p(x - b.w * .2, y + b.h * .15), p(x, y), p(x + b.w * .1, Math.max(.5, y - b.h * .15)));
    }
    if (!b.cap) {
      const y = b.h * .55, z = b.d / 2 * (1 - .06 * y / b.h) + .04, w = b.w * .16;
      pb.line(CARVING, point(-w, y, z), point(0, y + w * 1.5, z), point(w, y, z), point(0, y - w * 1.5, z), point(-w, y, z));
    }
  }
  // Flush ancient paving outlines mark the sanctuary without a raised step or a solid courtyard collider.
  for (const radius of [site.radius - 4, 18]) for (let i = 0; i < 64; i++) {
    const a = i / 64 * Math.PI * 2, b = (i + 1) / 64 * Math.PI * 2;
    pb.seg(CARVING, [Math.cos(a) * radius, .035, Math.sin(a) * radius], [Math.cos(b) * radius, .035, Math.sin(b) * radius]);
  }
  const group = pb.build(); group.name = site.id; group.userData.landmark = site.id; return group;
}
export function syncMegaliths(world: number, x: number, z: number) {
  const near = megalithsNear(world, x, z, 420), keep = new Set(near.map(m => m.id));
  for (const [id, m] of loaded) if (!keep.has(id)) { disposeTree(m.group); loaded.delete(id); }
  for (const site of near) {
    const old = loaded.get(site.id);
    if (old) { old.site = site; old.group.position.set(site.x, site.y, site.z); continue; }
    const group = megalithModel(site); group.position.set(site.x, site.y, site.z); group.rotation.y = site.yaw; scene.add(group);
    loaded.set(site.id, { site, group, stones: megalithStones(site) });
  }
}
export function clearMegaliths() { for (const m of loaded.values()) disposeTree(m.group); loaded.clear(); }
export function megalithHit(x: number, y: number, z: number, radius: number): boolean {
  for (const m of loaded.values()) { const [u, v] = megalithLocal(m.site, x, z); if (megalithStoneHit(m.stones, u, y - m.site.y, v, radius)) return true; }
  return false;
}
const caster = new THREE.Raycaster();
export function megalithRay(o: { x: number; y: number; z: number }, d: { x: number; y: number; z: number }, maxT: number): number {
  caster.ray.origin.set(o.x, o.y, o.z); caster.ray.direction.set(d.x, d.y, d.z); caster.near = 0; caster.far = maxT;
  for (const m of loaded.values()) {
    m.group.updateMatrixWorld(true); const stone = m.group.children[0];
    if (!(stone instanceof THREE.Mesh)) continue;
    const hit = caster.intersectObject(stone, false)[0]; if (hit && hit.distance < maxT) { maxT = hit.distance; caster.far = maxT; }
  }
  return maxT;
}
export const megalithName = (x: number, z: number) => [...loaded.values()].find(m => Math.hypot(...megalithLocal(m.site, x, z)) < m.site.radius)?.site.name;

/** Extend the local view only near these exceptionally large structures. */
export const nearMegalith = (x: number, z: number) => [...loaded.values()].some(m => Math.hypot(...megalithLocal(m.site, x, z)) < m.site.radius + 220);
export function megalithFloor(x: number, y: number, z: number): number {
  let floor = -Infinity;
  for (const m of loaded.values()) {
    const [u, v] = megalithLocal(m.site, x, z);
    for (const b of m.stones) {
      const top = m.site.y + b.y + b.h; if (y < top - .5) continue;
      const c = Math.cos(b.yaw), s = Math.sin(b.yaw), dx = u - b.x, dz = v - b.z;
      if (Math.abs(c * dx - s * dz) <= b.w * .47 && Math.abs(s * dx + c * dz) <= b.d * .47) floor = Math.max(floor, top);
    }
  }
  return floor;
}
