// Barricades round a village's industry site and its power plant (commissioned from the elder: gen/town.ts WORKS
// siteGuard / plantGuard). A ring of sandbag walls three courses high following the ground, open on the side that
// faces the village, with steel hedgehogs and spiked timber outside. Bandits at a guarded site or plant do much less
// harm (world/villageraid.ts, gen/raids.ts, gen/industry.ts: GUARDED). The walls collide (`guardHit` in G.obstacle).
import * as THREE from 'three';
import { G } from '../game';
import { PropBatch } from './props';
import { findPoi } from '../gen/regions';
import { industryOf, industrySite } from '../gen/industry';
import { powerSite, worksOf } from '../gen/town';
import type { VillageMap } from '../gen/village';
import type { Terrain } from '../gen/terrain';

const BAG = 0xc8b890, STEEL = 0xb8c4cc, WOOD = 0xb8b060;
const COURSE = 0.26, COURSES = 3, PAD = 2.5, OPEN = 4.5;
/** Collision: wall segments [x0, z0, x1, z1, ground y] per village. */
const segs = new Map<number, number[][]>();
let all: number[][] = [];

/** The barricades of a village's guarded places (a group in world coordinates), and their collision. */
export function drawGuards(vm: VillageMap, T: Terrain, id: number): THREE.Group {
  const grp = new THREE.Group(), pb = new PropBatch(), c = G.char, st = c.towns[id], list: number[][] = [];
  const places: { x: number; z: number; w: number; d: number; side: string; face: [number, number] }[] = [];
  if (worksOf(st, 'siteGuard')) { const poi = findPoi(c.world, id); if (poi) places.push(industrySite(vm.seed, industryOf(c.world, poi, vm.seed))); }
  if (worksOf(st, 'plantGuard')) places.push(powerSite(vm.seed));
  for (const s of places) {
    const cx = vm.ox + s.x, cz = vm.oz + s.z, [fx, fz] = s.face, rx = -fz, rz = fx;
    const along = s.side === 'S' ? s.w : s.d, out = s.side === 'S' ? s.d : s.w;
    const hu = along / 2 + PAD, hv = out / 2 + PAD;
    const P = (u: number, v: number): [number, number] => [cx + rx * u + fx * v, cz + rz * u + fz * v];
    // the ring, corner to corner; the side towards the village (v < 0) has the opening in its middle
    const sides: [number, number, number, number][] = [[-hu, hv, hu, hv], [hu, hv, hu, -hv], [-hu, -hv, -hu, hv], [-hu, -hv, -OPEN / 2, -hv], [OPEN / 2, -hv, hu, -hv]];
    for (const [u0, v0, u1, v1] of sides) {
      const [ax, az] = P(u0, v0), [bx, bz] = P(u1, v1);
      bagWall(pb, T, ax, az, bx, bz);
      list.push([ax, az, bx, bz, T.heightAt((ax + bx) / 2, (az + bz) / 2)]);
    }
    // steel hedgehogs along the outer side, spiked timber at its corners and by the opening
    for (let u = -hu + 3; u < hu - 2; u += 6) { const [x, z] = P(u, hv + 1.8); hedgehog(pb, x, T.heightAt(x, z), z); }
    for (const [u, v, a] of [[-hu - 1.2, hv + 1.2, 0.8], [hu + 1.2, hv + 1.2, -0.8], [-OPEN / 2 - 1.5, -hv - 1.6, 0], [OPEN / 2 + 1.5, -hv - 1.6, 0]] as [number, number, number][]) {
      const [x, z] = P(u, v); spikes(pb, x, T.heightAt(x, z), z, Math.atan2(rx, rz) + a);
    }
  }
  segs.set(id, list); all = [...segs.values()].flat();
  if (places.length) grp.add(pb.build());
  return grp;
}
export function forgetGuards(id: number) { segs.delete(id); all = [...segs.values()].flat(); }

/** A sandbag wall from a to b over the ground: courses of bags (staggered seams), each course a little narrower. */
function bagWall(pb: PropBatch, T: Terrain, ax: number, az: number, bx: number, bz: number) {
  const L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L, nx = -uz, nz = ux, bag = 1.1;
  for (let k = 0; k < COURSES; k++) {
    const half = 0.34 - k * 0.05, lift = k * COURSE;
    for (let a = k % 2 ? -bag / 2 : 0; a < L; a += bag) {
      const s0 = Math.max(0, a), s1 = Math.min(L, a + bag);
      if (s1 - s0 < 0.1) continue;
      const q = (s: number, o: number, up: number) => { const x = ax + ux * s + nx * o, z = az + uz * s + nz * o; return [x, T.heightAt(ax + ux * s, az + uz * s) - 0.05 + lift + up, z]; };
      pb.solid8([q(s0 + 0.03, -half, 0), q(s1 - 0.03, -half, 0), q(s1 - 0.03, half, 0), q(s0 + 0.03, half, 0)],
        [q(s0 + 0.08, -half + 0.05, COURSE), q(s1 - 0.08, -half + 0.05, COURSE), q(s1 - 0.08, half - 0.05, COURSE), q(s0 + 0.08, half - 0.05, COURSE)], BAG);
    }
  }
}
/** A steel hedgehog: three beams crossed at their middles. */
function hedgehog(pb: PropBatch, x: number, y: number, z: number) {
  const c = [x, y + 0.55, z], L = 0.8;
  for (const [dx, dy, dz] of [[1, 0.6, 0], [-0.5, 0.6, 0.87], [-0.5, 0.6, -0.87]]) {
    const n = Math.hypot(dx, dy, dz), e = [dx / n * L, dy / n * L, dz / n * L];
    pb.seg(STEEL, [c[0] - e[0], c[1] - e[1], c[2] - e[2]], [c[0] + e[0], c[1] + e[1], c[2] + e[2]]);
    pb.seg(STEEL, [c[0] - e[0] + 0.06, c[1] - e[1], c[2] - e[2]], [c[0] + e[0] + 0.06, c[1] + e[1], c[2] + e[2]]);
  }
}
/** Spiked timber (a cheval de frise): a log on the ground with sharpened stakes through it, crossed both ways. */
function spikes(pb: PropBatch, x: number, y: number, z: number, yaw: number) {
  const ux = Math.sin(yaw), uz = Math.cos(yaw), nx = -uz, nz = ux, L = 1.6;
  pb.box(x - 0.1, y + 0.45, z - 0.1, x + 0.1, y + 0.62, z + 0.1, WOOD);
  pb.seg(WOOD, [x - ux * L, y + 0.55, z - uz * L], [x + ux * L, y + 0.55, z + uz * L]);
  for (let a = -L + 0.3; a <= L - 0.3; a += 0.6) for (const s of [-1, 1]) {
    const bx = x + ux * a, bz = z + uz * a;
    pb.seg(WOOD, [bx - nx * 0.8 * s, y, bz - nz * 0.8 * s], [bx + nx * 0.8 * s, y + 1.1, bz + nz * 0.8 * s]);
  }
}
/** Does a figure (radius r, feet at y) run into a sandbag wall? */
export function guardHit(x: number, y: number, z: number, r: number): boolean {
  for (const [ax, az, bx, bz, gy] of all) {
    if (y > gy + COURSE * COURSES + 0.2) continue;
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
    if (Math.hypot(x - ax - dx * t, z - az - dz * t) < r + 0.34) return true;
  }
  return false;
}
