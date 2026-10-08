// The processing works outside a village's fence (gen/plants.ts): drawn by kind, a building site while one is being
// put up, staked plots where there is room for more; a loading hopper and an output bay by each; a glow and smoke
// that show while it works. E at a works opens its window (ui/works.ts).
import { shortHands } from '../ui/villagestats';
import * as THREE from 'three';
import { G } from '../game';
import { PropBatch } from './props';
import { add } from './render';
import { findPoi } from '../gen/regions';
import { industryOf } from '../gen/industry';
import { PLANTS, PLANT_SLOTS, plantSite, plantsOf, running, runPlant, isStation, specOf, type PlantKind } from '../gen/plants';
import { poweredAt } from '../gen/energy';
import type { VillageMap } from '../gen/village';
import type { Terrain } from '../gen/terrain';

const WOOD = 0xb8b060, METAL = 0xb8c4cc, BRICK = 0xd09070, GLASS = 0x9dffe0, STEELC = 0x8fb89a, HOT = 0xffb347, FLAG = 0xffd060, STONEC = 0xc8c8b0;
export interface Works { vid: number; seed: number; slot: number; town: string; x0: number; z0: number; x1: number; z1: number; glow: THREE.Object3D | null }
const placed = new Map<number, Works[]>();

/** A faceted cylinder standing on (x, y, z). */
function cyl(pb: PropBatch, x: number, y: number, z: number, r: number, h: number, c: number, n = 10, r2 = r) {
  const P = (i: number, yy: number, rr: number) => [x + Math.cos(i / n * 6.283) * rr, yy, z + Math.sin(i / n * 6.283) * rr];
  for (let i = 0; i < n; i++) {
    pb.face(P(i, y, r), P(i + 1, y, r), P(i + 1, y + h, r2), P(i, y + h, r2));
    pb.seg(c, P(i, y + h, r2), P(i + 1, y + h, r2)); pb.seg(c, P(i, y, r), P(i + 1, y, r)); if (i % 2 === 0) pb.seg(c, P(i, y, r), P(i, y + h, r2));
  }
  const top: number[][] = []; for (let i = 0; i < n; i++) top.push(P(i, y + h, r2)); pb.face(...top);
}
/** A dome (a stack of rings) on (x, y, z). */
function dome(pb: PropBatch, x: number, y: number, z: number, r: number, c: number) {
  const n = 10, rows = 4, P = (i: number, j: number) => { const a = i / n * 6.283, b = j / rows * Math.PI / 2; return [x + Math.cos(a) * r * Math.cos(b), y + Math.sin(b) * r, z + Math.sin(a) * r * Math.cos(b)]; };
  for (let j = 0; j < rows; j++) for (let i = 0; i < n; i++) { pb.face(P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)); pb.seg(c, P(i, j), P(i + 1, j)); if (i % 2 === 0) pb.seg(c, P(i, j), P(i, j + 1)); }
}

/** Draw the works (built, being built, empty plots) of village vm, and remember where they stand. */
export function drawWorks(vm: VillageMap, T: Terrain, id: number): THREE.Group {
  const grp = new THREE.Group(), pb = new PropBatch(), c = G.char, st = c.towns[id], poi = findPoi(c.world, id);
  const list: Works[] = [];
  if (!poi) return grp;
  const ind = industryOf(c.world, poi, vm.seed), plants = plantsOf(st);
  for (let slot = 0; slot < PLANT_SLOTS; slot++) {
    const s = plantSite(vm.seed, ind, slot), cx = vm.ox + s.x, cz = vm.oz + s.z, [fx, fz] = s.face, rx = -fz, rz = fx;
    const along = s.side === 'S' ? s.w : s.d, out = s.side === 'S' ? s.d : s.w;
    const P = (u: number, v: number): [number, number] => [cx + rx * u + fx * v, cz + rz * u + fz * v];
    const H = (u: number, v: number) => { const [x, z] = P(u, v); return T.heightAt(x, z); };
    const box = (u: number, v: number, hu: number, hv: number, y0: number, y1: number, col: number) => {
      const [x, z] = P(u, v), ax = Math.abs(rx) * hu + Math.abs(fx) * hv, az = Math.abs(rz) * hu + Math.abs(fz) * hv;
      pb.box(x - ax, y0, z - az, x + ax, y1, z + az, col);
    };
    const shed = (u: number, v: number, hu: number, hv: number, h: number, col = WOOD) => {
      const g = H(u, v); box(u, v, hu, hv, g - 0.1, g + h, col);
      const [a, b] = P(u - hu, v - hv), [cc, d] = P(u + hu, v + hv);
      pb.gableRoof(Math.min(a, cc), Math.min(b, d), Math.max(a, cc), Math.max(b, d), g + h, 1.3, col);
    };
    const cylAt = (u: number, v: number, r: number, h: number, col: number, lift = 0, r2 = r) => { const [x, z] = P(u, v); cyl(pb, x, H(u, v) + lift, z, r, h, col, 10, r2); };
    const [x0a, z0a] = P(-along / 2, -out / 2), [x1a, z1a] = P(along / 2, out / 2);
    const w: Works = { vid: id, seed: vm.seed, slot, town: vm.name, x0: Math.min(x0a, x1a), z0: Math.min(z0a, z1a), x1: Math.max(x0a, x1a), z1: Math.max(z0a, z1a), glow: null };
    const p = plants[slot], k: PlantKind | undefined = p?.k;
    if (!p) {
      // a staked plot (and, if the elder has one going up here, the building site)
      const building = slot === plants.length && st?.pbuild && !isStation(st.pbuild.k);
      if (!building) continue; // (0.181) nothing marks a plot until a works is going up there
      for (const [u, v] of [[-along / 2 + 1, -out / 2 + 1], [along / 2 - 1, -out / 2 + 1], [along / 2 - 1, out / 2 - 1], [-along / 2 + 1, out / 2 - 1]]) {
        const [x, z] = P(u, v), g = T.heightAt(x, z); pb.box(x - 0.06, g, z - 0.06, x + 0.06, g + 1.1, z + 0.06, WOOD);
        pb.seg(FLAG, [x, g + 1.1, z], [x + 0.3, g + 0.95, z]);
      }
      if (building) {
        const g = H(0, 0);
        for (let u = -along / 2 + 2; u <= along / 2 - 2; u += 3) for (const v of [-out / 2 + 2, out / 2 - 2]) { const [x, z] = P(u, v); pb.box(x - 0.08, g, z - 0.08, x + 0.08, g + 6, z + 0.08, WOOD); }
        for (let y = 2; y <= 6; y += 2) box(0, -out / 2 + 2, along / 2 - 2, 0.05, g + y, g + y + 0.12, WOOD), box(0, out / 2 - 2, along / 2 - 2, 0.05, g + y, g + y + 0.12, WOOD);
        for (let i = 0; i < 4; i++) box(-along / 2 + 3 + i * 1.3, 0, 0.5, 0.8, g, g + 0.6 + (i % 2) * 0.4, i % 2 ? BRICK : WOOD);
      }
      list.push(w); continue;
    }
    // the hopper (a funnel on legs) and the output bay (a pallet) at the side facing the village
    { const [hx, hz] = P(-along / 2 + 2, -out / 2 + 1.5), g = T.heightAt(hx, hz);
      for (const [a, b] of [[-0.6, -0.6], [0.6, -0.6], [0.6, 0.6], [-0.6, 0.6]]) pb.seg(METAL, [hx + a, g, hz + b], [hx + a * 0.9, g + 1.6, hz + b * 0.9]);
      pb.solid8([[hx - 0.3, g + 1.6, hz - 0.3], [hx + 0.3, g + 1.6, hz - 0.3], [hx + 0.3, g + 1.6, hz + 0.3], [hx - 0.3, g + 1.6, hz + 0.3]], [[hx - 0.9, g + 2.6, hz - 0.9], [hx + 0.9, g + 2.6, hz - 0.9], [hx + 0.9, g + 2.6, hz + 0.9], [hx - 0.9, g + 2.6, hz + 0.9]], METAL); }
    box(along / 2 - 2.5, -out / 2 + 1.5, 1.2, 1, H(along / 2 - 2.5, -out / 2 + 1.5), H(along / 2 - 2.5, -out / 2 + 1.5) + 0.2, WOOD);
    let glowAt: [number, number, number] = [cx, H(0, 0) + 3, cz];
    const g0 = H(0, 1);
    switch (k) {
      case 'smelter': { // a blast furnace, its stack, a skip incline, the casting shed
        cylAt(2, 2, 2.4, 9, BRICK, 0, 1.7); cylAt(2, 2, 0.7, 7, BRICK, 9);
        const [a, b] = P(-5, 2), [d, e] = P(1, 2); pb.line(METAL, [a, H(-5, 2), b], [d, g0 + 9, e]); pb.line(METAL, [a, H(-5, 2) + 0.4, b], [d, g0 + 9.4, e]);
        shed(-3, -2.5, 3.5, 2.2, 3.2, BRICK); glowAt = [P(2, -0.4)[0], g0 + 1, P(2, -0.4)[1]];
        break;
      }
      case 'refinery': {
        cylAt(-3, 2, 1.1, 12, METAL); cylAt(0, 3, 0.9, 9, METAL);
        for (const [u, v] of [[4, 3], [6.5, 3], [5, -1]]) cylAt(u, v, 1.4, 3, METAL);
        box(0, -1, 5, 0.15, g0 + 2.5, g0 + 2.8, METAL);
        cylAt(-7, -3, 0.25, 10, METAL); glowAt = [P(-7, -3)[0], H(-7, -3) + 10.6, P(-7, -3)[1]];
        break;
      }
      case 'glassworks': {
        const [x, z] = P(-2, 2); dome(pb, x, H(-2, 2), z, 3.2, BRICK); cylAt(-2, 2, 0.5, 5, BRICK, 3);
        shed(4, 1, 3, 2.5, 3.2);
        for (let i = 0; i < 4; i++) { const [a, b] = P(-6 + i * 0.8, -3), g = H(-6, -3); pb.line(GLASS, [a, g, b], [a, g + 1.6, b], [a + fx * 1.2, g + 1.6, b + fz * 1.2], [a + fx * 1.2, g, b + fz * 1.2]); }
        glowAt = [P(-2, -1.3)[0], H(-2, 2) + 1, P(-2, -1.3)[1]];
        break;
      }
      case 'wiremill': {
        shed(0, 1.5, 6, 3, 3.6);
        for (let i = 0; i < 4; i++) { const [x, z] = P(-5 + i * 2.6, -3.5), g = H(-5 + i * 2.6, -3.5); cyl(pb, x, g, z, 0.8, 0.6, HOT, 10); cyl(pb, x, g + 0.6, z, 0.35, 0.3, METAL, 8); }
        glowAt = [P(0, -1.6)[0], g0 + 2, P(0, -1.6)[1]];
        break;
      }
      case 'electronics': {
        box(0, 1.5, 5.5, 3, g0 - 0.1, g0 + 4, STEELC);
        for (let u = -4.5; u <= 4.5; u += 1.5) { const [a, b] = P(u, -1.52), [d, e] = P(u + 1, -1.52); pb.line(GLASS, [a, g0 + 1.4, b], [d, g0 + 1.4, e], [d, g0 + 2.6, e], [a, g0 + 2.6, b], [a, g0 + 1.4, b]); }
        { const [x, z] = P(3.5, 2.5); pb.box(x - 0.08, g0 + 4, z - 0.08, x + 0.08, g0 + 9, z + 0.08, METAL); pb.seg(METAL, [x - 1, g0 + 8, z], [x + 1, g0 + 8, z]); }
        { const [x, z] = P(-3.5, 2.5); cyl(pb, x, g0 + 4, z, 0.9, 0.2, METAL, 10); }
        glowAt = [P(0, -1.6)[0], g0 + 3.2, P(0, -1.6)[1]];
        break;
      }
      case 'machineshop': {
        box(0, 1.5, 6, 3, g0 - 0.1, g0 + 4, WOOD);
        for (let u = -6; u < 6; u += 2) { const [a, b] = P(u, -1.5), [d, e] = P(u, 4.5), [a2, b2] = P(u + 2, -1.5), [d2, e2] = P(u + 2, 4.5); pb.face([a, g0 + 4, b], [d, g0 + 4, e], [d, g0 + 5.4, e], [a, g0 + 5.4, b]); pb.line(WOOD, [a, g0 + 5.4, b], [d, g0 + 5.4, e], [d2, g0 + 4, e2], [a2, g0 + 4, b2], [a, g0 + 5.4, b]); }
        for (const u of [-7.5, 7.5]) { const [x, z] = P(u, -3); pb.box(x - 0.15, g0, z - 0.15, x + 0.15, g0 + 5, z + 0.15, FLAG); }
        box(0, -3, 7.7, 0.15, g0 + 5, g0 + 5.3, FLAG);
        glowAt = [P(0, -1.6)[0], g0 + 2, P(0, -1.6)[1]];
        break;
      }
      case 'foundry': {
        cylAt(-2, 2, 2.2, 7, BRICK, 0, 1.6); cylAt(-2, 2, 0.6, 9, BRICK, 7);
        for (const u of [1, 6]) { const [x, z] = P(u, -1); pb.box(x - 0.2, g0, z - 0.2, x + 0.2, g0 + 6, z + 0.2, METAL); }
        box(3.5, -1, 2.7, 0.2, g0 + 6, g0 + 6.4, METAL);
        cylAt(3.5, -1, 0.7, 0.9, HOT, 3.5, 0.9);
        for (let i = 0; i < 5; i++) box(-6 + i * 1.3, -3.5, 0.5, 0.35, H(-6, -3.5), H(-6, -3.5) + 0.25, STEELC);
        glowAt = [P(3.5, -1)[0], g0 + 4.2, P(3.5, -1)[1]];
        break;
      }
      case 'electrical': { // a winding hall, a test bed with a big generator, a transformer yard and its insulators
        box(0, 2, 6, 3.2, g0, g0 + 4.6, BRICK);
        cylAt(-3, -3.5, 1.1, 1.6, METAL, 0, 1.1); cylAt(-3, -3.5, 0.5, 0.5, HOT, 1.6, 0.5);
        for (const u of [2.5, 5.5]) { box(u, -3.8, 0.7, 0.6, g0, g0 + 1.6, METAL); const [x, z] = P(u, -3.8); for (const d of [-0.4, 0, 0.4]) pb.seg(METAL, [x + d, g0 + 1.6, z], [x + d, g0 + 2.4, z]); }
        { const [a, b] = P(2.5, -3.8), [c, d] = P(5.5, -3.8), [e, f] = P(5.5, -0.9); pb.line(METAL, [a, g0 + 2.4, b], [c, g0 + 2.4, d], [e, g0 + 3.6, f]); }
        glowAt = [P(-3, -3.5)[0], g0 + 1.9, P(-3, -3.5)[1]];
        break;
      }
      case 'heavyworks': { // a tall brick erecting hall, a gantry crane over the yard with an engine block on its hook, a drill derrick being tested
        box(1.5, 2.5, 5.5, 3.5, g0 - 0.1, g0 + 6.5, BRICK);
        for (const v of [-4.5, 5.6]) for (const u of [-7.6, 7.6]) { const [x, z] = P(u, v); pb.box(x - 0.2, g0, z - 0.2, x + 0.2, g0 + 7.4, z + 0.2, STEELC); }
        for (const u of [-7.6, 7.6]) { const [a, b] = P(u, -4.5), [d, e] = P(u, 5.6); pb.seg(STEELC, [a, g0 + 7.4, b], [d, g0 + 7.4, e]); }
        { const [a, b] = P(-7.6, -3.2), [d, e] = P(7.6, -3.2); pb.seg(METAL, [a, g0 + 7.6, b], [d, g0 + 7.6, e]); pb.seg(METAL, [a, g0 + 7.2, b], [d, g0 + 7.2, e]); }
        { const [x, z] = P(-2.5, -3.2); pb.seg(METAL, [x, g0 + 7.2, z], [x, g0 + 2.4, z]); }
        box(-2.5, -3.2, 0.9, 0.7, g0 + 1.0, g0 + 2.2, METAL);
        { // the drill derrick: four legs to a crown block, braces, the drill pipe down the middle
          const [cx0, cz0] = P(-6, 3), top = g0 + 9.5;
          for (const [du, dv] of [[-1.3, -1.3], [1.3, -1.3], [1.3, 1.3], [-1.3, 1.3]]) { const [x, z] = P(-6 + du, 3 + dv); pb.seg(STEELC, [x, g0, z], [cx0, top, cz0]); }
          for (const y of [2.5, 5]) { const k = 1 - (y / 9.5); const pts = [[-1.3, -1.3], [1.3, -1.3], [1.3, 1.3], [-1.3, 1.3], [-1.3, -1.3]].map(([du, dv]) => { const [x, z] = P(-6 + du * k, 3 + dv * k); return [x, g0 + y, z] as [number, number, number]; }); pb.line(STEELC, ...pts); }
          pb.seg(METAL, [cx0, top, cz0], [cx0, g0 - 0.5, cz0]);
        }
        glowAt = [P(-2.5, -3.2)[0], g0 + 1.6, P(-2.5, -3.2)[1]];
        break;
      }
      case 'stoneworks': { // an open saw shed with a frame saw over a block, dressed blocks stacked, a heap of chippings
        for (const [u, v] of [[-4.5, -1], [4.5, -1], [4.5, 4.5], [-4.5, 4.5]]) { const [x, z] = P(u, v); pb.box(x - 0.15, g0 - 0.1, z - 0.15, x + 0.15, g0 + 3.4, z + 0.15, WOOD); }
        { const [a, b] = P(-4.8, -1.3), [d, e] = P(4.8, 4.8); pb.gableRoof(Math.min(a, d), Math.min(b, e), Math.max(a, d), Math.max(b, e), g0 + 3.4, 1.0, WOOD); }
        box(0, 1.8, 1.4, 0.9, g0, g0 + 1.1, STONEC);
        { const [a, b] = P(-1.6, 1.8), [d, e] = P(1.6, 1.8); for (const y of [1.6, 2.6]) pb.seg(METAL, [a, g0 + y, b], [d, g0 + y, e]); pb.seg(METAL, [a, g0 + 1.1, b], [a, g0 + 2.8, b]); pb.seg(METAL, [d, g0 + 1.1, e], [d, g0 + 2.8, e]); }
        for (let i = 0; i < 6; i++) { const u = -6.5 + (i % 3) * 1.1, h = H(-6, -3.5) + Math.floor(i / 3) * 0.6; box(u, -3.5, 0.5, 0.5, h, h + 0.55, STONEC); }
        { const [x, z] = P(6, -3.5), h = H(6, -3.5); pb.rock(x, h - 0.1, z, 1.6, 0.9, 7, 0.4, STONEC); }
        glowAt = [P(0, 1.8)[0], g0 + 1.6, P(0, 1.8)[1]];
        break;
      }
      case 'metallurgy': { // a tall arc furnace hall, three electrode furnaces under a gantry, retorts and a transformer
        box(-1, 2.5, 6, 3.4, g0 - 0.1, g0 + 7, STEELC);
        for (const u of [-4, -1, 2]) { cylAt(u, -2.6, 1.0, 2.2, BRICK, 0, 1.0); cylAt(u, -2.6, 0.55, 0.4, HOT, 2.2, 0.55); const [x, z] = P(u, -2.6); for (const d of [-0.3, 0, 0.3]) pb.seg(METAL, [x + d, g0 + 2.6, z], [x + d, g0 + 5.4, z]); }
        { const [a, b] = P(-5.5, -2.6), [d, e] = P(3.5, -2.6); pb.line(METAL, [a, g0, b], [a, g0 + 6, b], [d, g0 + 6, e], [d, g0, e]); }
        for (const u of [5.5, 7]) cylAt(u, 3.5, 0.6, 3.2, METAL, 0, 0.6);
        box(6.2, -3, 0.9, 0.8, g0, g0 + 1.8, METAL);
        cylAt(-6.8, 5, 0.6, 12, BRICK, 0, 0.45);
        glowAt = [P(-1, -2.6)[0], g0 + 2.6, P(-1, -2.6)[1]];
        break;
      }
      case 'siliconworks': { // a furnace hall with three crucible towers through its roof, acid tanks and a stack
        box(-1, 2, 5.5, 3, g0 - 0.1, g0 + 4.5, BRICK);
        for (const u of [-4, -1, 2]) { cylAt(u, 2, 0.8, 7.5, METAL, 0, 0.6); cylAt(u, 2, 0.45, 0.3, HOT, 7.5, 0.45); }
        for (const u of [5.5, 7]) { cylAt(u, -2.5, 0.7, 2.6, GLASS, 0, 0.7); const [x, z] = P(u, -2.5); pb.gableRoof(x - 0.9, z - 0.9, x + 0.9, z + 0.9, H(u, -2.5) + 2.8, 0.4, METAL); }
        { const [a, b] = P(4.6, 1), [d, e] = P(6.3, -2.5); pb.line(METAL, [a, g0 + 2.2, b], [d, g0 + 2.2, e], [d, g0 + 1.2, e]); }
        cylAt(-7, 4.5, 0.55, 11, BRICK, 0, 0.4);
        glowAt = [P(-1, 2)[0], g0 + 8, P(-1, 2)[1]];
        break;
      }
      case 'advelec': { // a white clean hall with a band of lit windows, roof air units, a transformer and a dish
        box(0, 2, 6.5, 3, g0 - 0.1, g0 + 4.2, STEELC);
        for (let u = -5.8; u <= 5; u += 1.4) { const [a, b] = P(u, -1.02), [d, e] = P(u + 0.9, -1.02); pb.line(GLASS, [a, g0 + 2.2, b], [d, g0 + 2.2, e], [d, g0 + 3.2, e], [a, g0 + 3.2, b], [a, g0 + 2.2, b]); }
        for (const u of [-4, 0, 4]) { box(u, 2, 0.9, 0.9, g0 + 4.2, g0 + 5, METAL); const [x, z] = P(u, 2); cyl(pb, x, g0 + 5, z, 0.6, 0.12, METAL, 10); }
        box(-8, -2, 0.9, 0.9, H(-8, -2), H(-8, -2) + 2, METAL);
        { const [x, z] = P(-8, -2); for (const d of [-0.5, 0, 0.5]) pb.seg(METAL, [x + d, H(-8, -2) + 2, z], [x + d, H(-8, -2) + 2.8, z]); }
        { const [x, z] = P(5.5, 4.5); pb.box(x - 0.08, g0 + 4.2, z - 0.08, x + 0.08, g0 + 6.5, z + 0.08, METAL); cyl(pb, x, g0 + 6.5, z, 1.1, 0.25, METAL, 12); }
        glowAt = [P(0, -1.1)[0], g0 + 2.7, P(0, -1.1)[1]];
        break;
      }
      case 'avionworks': { // a low white assembly hall with a band of lit windows, a mast with a star tracker dome, a test rack
        box(0, 2, 6, 3, g0 - 0.1, g0 + 3.6, STEELC);
        for (let u = -5.2; u <= 4.6; u += 1.3) { const [a, b] = P(u, -1.02), [d, e] = P(u + 0.8, -1.02); pb.line(GLASS, [a, g0 + 1.8, b], [d, g0 + 1.8, e], [d, g0 + 2.8, e], [a, g0 + 2.8, b], [a, g0 + 1.8, b]); }
        { const [x, z] = P(4, 3.5); pb.box(x - 0.1, g0 + 3.6, z - 0.1, x + 0.1, g0 + 8, z + 0.1, METAL); cyl(pb, x, g0 + 8, z, 0.7, 0.7, GLASS, 10); }
        box(-7.5, -2.5, 0.7, 1.2, H(-7.5, -2.5), H(-7.5, -2.5) + 2.2, METAL);
        { const [x, z] = P(-7.5, -2.5); for (const y of [0.6, 1.2, 1.8]) pb.seg(GLASS, [x - 0.4, H(-7.5, -2.5) + y, z], [x + 0.4, H(-7.5, -2.5) + y, z]); }
        glowAt = [P(0, -1.1)[0], g0 + 2.3, P(0, -1.1)[1]];
        break;
      }
      case 'lifeworks': { // a hall with round tanks for air and water, a scrubber tower and pipe runs between them
        box(-1, 2, 5, 3, g0 - 0.1, g0 + 4, STEELC);
        for (const u of [5.5, 7.2]) cylAt(u, 0, 0.7, 3.2, GLASS, 0, 0.7);
        for (const u of [5.5, 7.2]) cylAt(u, 3.4, 0.7, 3.2, METAL, 0, 0.7);
        cylAt(-7, 4, 0.9, 7, METAL, 0, 0.6);
        { const [a, b] = P(4, 1), [d, e] = P(5.5, 0), [f, g] = P(5.5, 3.4); pb.line(METAL, [a, g0 + 2.6, b], [d, g0 + 2.6, e], [f, g0 + 2.6, g]); }
        glowAt = [P(5.5, 0)[0], g0 + 3.4, P(5.5, 0)[1]];
        break;
      }
      case 'sawmill': { // an open saw shed with a circular saw, a log deck and stacks of boards
        for (const [u, v] of [[-5, -1], [5, -1], [5, 5], [-5, 5], [0, -1], [0, 5]]) { const [x, z] = P(u, v); pb.box(x - 0.15, g0 - 0.1, z - 0.15, x + 0.15, g0 + 3.2, z + 0.15, WOOD); }
        { const [a, b] = P(-5.3, -1.3), [d, e] = P(5.3, 5.3); pb.gableRoof(Math.min(a, d), Math.min(b, e), Math.max(a, d), Math.max(b, e), g0 + 3.2, 1.2, WOOD); }
        { const [x, z] = P(0, 2); cyl(pb, x, g0 + 0.9, z, 0.7, 0.08, METAL, 12); pb.box(x - 1.5, g0, z - 0.4, x + 1.5, g0 + 0.9, z + 0.4, WOOD); }
        for (let i = 0; i < 5; i++) box(-6.5, 3 - (i % 3) * 0.55, 0.28, 2.6, H(-6.5, 3) + (i < 3 ? 0 : 0.5), H(-6.5, 3) + (i < 3 ? 0.5 : 1), WOOD);
        for (const u of [4, 6.5]) box(u, -3.5, 0.9, 1.3, H(u, -3.5), H(u, -3.5) + 1.1, WOOD);
        glowAt = [P(0, 2)[0], g0 + 2.2, P(0, 2)[1]];
        break;
      }
      case 'brickworks': { // a long ring kiln, its tall stack, a drying shed and pallets of bricks
        box(0, 2, 6, 2.2, g0 - 0.1, g0 + 2.4, BRICK);
        for (let u = -5; u <= 5; u += 2) { const [a, b] = P(u, -0.2); pb.line(HOT, [a - rx * 0.4, g0, b - rz * 0.4], [a - rx * 0.4, g0 + 1.2, b - rz * 0.4], [a + rx * 0.4, g0 + 1.2, b + rz * 0.4], [a + rx * 0.4, g0, b + rz * 0.4]); }
        cylAt(7, 4, 0.8, 13, BRICK, 0, 0.55);
        for (let i = 0; i < 3; i++) box(-5 + i * 2.2, -3.8, 0.8, 0.6, H(-5, -3.8), H(-5, -3.8) + 0.9, BRICK);
        glowAt = [P(0, -0.3)[0], g0 + 0.8, P(0, -0.3)[1]];
        break;
      }
      case 'cementworks': { // a rotary kiln on piers, a preheater tower and two silos
        for (const u of [-5, -1, 3]) box(u, 1, 0.3, 0.6, H(u, 1), g0 + 1.6 + (u + 5) * 0.08, BRICK);
        { const [a, b] = P(-6, 1), [d, e] = P(4.5, 1); for (const dy of [1.9, 3.1]) for (const dv of [-0.7, 0.7]) pb.line(METAL, [a + fx * dv, g0 + dy, b + fz * dv], [d + fx * dv, g0 + dy + 0.8, e + fz * dv]);
          for (let i = 0; i <= 5; i++) { const t = i / 5, x = a + (d - a) * t, z = b + (e - b) * t, y = g0 + 1.9 + 0.8 * t; pb.seg(METAL, [x - fx * 0.7, y, z - fz * 0.7], [x + fx * 0.7, y + 1.2, z + fz * 0.7]); } }
        box(6.5, 1.5, 1.4, 1.4, H(6.5, 1.5) - 0.1, H(6.5, 1.5) + 9, STEELC);
        for (const u of [-6, -3.2]) cylAt(u, 4.5, 1.2, 7, METAL, 0, 1.2);
        glowAt = [P(-6, 1)[0], g0 + 2.2, P(-6, 1)[1]];
        break;
      }
      case 'textile': { // a two-storey brick mill with rows of windows, a stack and bales by the door
        box(0, 2.5, 6.5, 2.8, g0 - 0.1, g0 + 6, BRICK);
        { const [a, b] = P(-6.8, 2.5), [d, e] = P(6.8, 2.5); pb.gableRoof(Math.min(a, d) - Math.abs(fx) * 3, Math.min(b, e) - Math.abs(fz) * 3, Math.max(a, d) + Math.abs(fx) * 3, Math.max(b, e) + Math.abs(fz) * 3, g0 + 6, 1.4, BRICK); }
        for (const y of [1.3, 3.8]) for (let u = -5.5; u <= 5; u += 1.6) { const [a, b] = P(u, -0.32), [d, e] = P(u + 0.9, -0.32); pb.line(GLASS, [a, g0 + y, b], [d, g0 + y, e], [d, g0 + y + 1.2, e], [a, g0 + y + 1.2, b], [a, g0 + y, b]); }
        cylAt(7.5, 4.5, 0.5, 10, BRICK);
        for (let i = 0; i < 3; i++) box(-6 + i * 1.3, -3.5, 0.55, 0.55, H(-6, -3.5), H(-6, -3.5) + 0.9, WOOD);
        glowAt = [P(0, -0.4)[0], g0 + 4.4, P(0, -0.4)[1]];
        break;
      }
      case 'steelworks': { // a tilting converter on trunnions, the steel hall behind, two stacks
        box(3, 2.5, 4, 2.8, g0 - 0.1, g0 + 7, STEELC);
        for (const v of [-0.8, 0.8]) { const [x, z] = P(-4, 1 + v); pb.box(x - 0.2, g0, z - 0.2, x + 0.2, g0 + 3.2, z + 0.2, METAL); }
        cylAt(-4, 1, 1.6, 3.4, METAL, 1.5, 1.1);
        for (const u of [5.5, 7.2]) cylAt(u, 5, 0.5, 13, BRICK);
        glowAt = [P(-4, 1)[0], g0 + 5.1, P(-4, 1)[1]];
        break;
      }
      case 'polymer': { // three slim reactors, a column, a pipe rack and drums
        for (const u of [-5, -2.5, 0]) { cylAt(u, 3, 0.8, 5, METAL, 0.8); cylAt(u, 3, 0.15, 0.8, METAL); }
        cylAt(4, 3.5, 0.7, 11, METAL);
        box(0, 0.5, 7, 0.12, g0 + 3, g0 + 3.2, METAL);
        for (let u = -6; u <= 6; u += 3) { const [x, z] = P(u, 0.5); pb.seg(METAL, [x, g0, z], [x, g0 + 3, z]); }
        for (let i = 0; i < 4; i++) cylAt(-6 + i * 1.1, -3.5, 0.4, 0.9, i % 2 ? HOT : METAL);
        glowAt = [P(4, 3.5)[0], g0 + 11.4, P(4, 3.5)[1]];
        break;
      }
      case 'alworks': { // a long low potroom with roof vents, a transformer yard and busbars
        box(0, 2.5, 7.5, 2.5, g0 - 0.1, g0 + 3.4, STEELC);
        for (let u = -6.5; u <= 6.5; u += 1.6) box(u, 2.5, 0.35, 0.8, g0 + 3.4, g0 + 4.1, METAL);
        for (const u of [-6.5, -4.5]) box(u, -3.4, 0.7, 0.9, H(u, -3.4), H(u, -3.4) + 1.8, METAL);
        { const [a, b] = P(-5.5, -2.5), [d, e] = P(-5.5, 0); for (const dy of [2.2, 2.6]) pb.seg(HOT, [a, g0 + dy, b], [d, g0 + dy, e]); }
        for (let u = -6; u <= 6; u += 2) { const [a, b] = P(u, 0.05); pb.seg(HOT, [a, g0 + 1, b], [a, g0 + 2, b]); }
        glowAt = [P(0, -0.1)[0], g0 + 1.5, P(0, -0.1)[1]];
        break;
      }
      case 'batteryworks': { // a casting shed, acid tanks under little roofs, pallets of cells
        shed(1, 2.5, 5, 2.5, 3.4, STEELC);
        for (const u of [-5.5, -3.5]) { const [x, z] = P(u, 3), g = H(u, 3); cyl(pb, x, g, z, 0.8, 2, METAL, 10); dome(pb, x, g + 2, z, 0.8, METAL); }
        for (let i = 0; i < 4; i++) box(-6 + i * 1.3, -3.5, 0.5, 0.45, H(-6, -3.5), H(-6, -3.5) + 0.7, i % 2 ? HOT : STEELC);
        glowAt = [P(1, -0.1)[0], g0 + 2, P(1, -0.1)[1]];
        break;
      }
      case 'chemworks': {
        for (const [u, v] of [[-4, 2], [0, 2.5]]) { const [x, z] = P(u, v), g = H(u, v); cyl(pb, x, g, z, 0.3, 1.2, METAL, 6); dome(pb, x, g + 1.2, z, 1.8, METAL); }
        cylAt(4, 2, 0.8, 8, METAL); shed(4, -2, 2.5, 1.5, 2.8);
        for (let u = -4; u <= 4; u += 2) { const [a, b] = P(u, 0), [d, e] = P(u + 2, 0); pb.seg(HOT, [a, g0 + 1.5, b], [d, g0 + 1.5, e]); }
        glowAt = [P(4, 2)[0], g0 + 8.6, P(4, 2)[1]];
        break;
      }
    }
    // the glow of the furnace (or the lit windows) while it works
    const fl = new PropBatch();
    fl.seg(HOT, [0, 0, 0], [0, 0.9, 0]); fl.seg(HOT, [-0.3, 0.2, 0], [0.3, 0.2, 0]); fl.seg(HOT, [0, 0.2, -0.3], [0, 0.2, 0.3]);
    const glow = fl.build(); glow.position.set(...glowAt); glow.traverse((o) => { if ((o as THREE.LineSegments).material) (o as THREE.LineSegments).material = add(HOT); }); grp.add(glow);
    w.glow = glow;
    list.push(w);
  }
  placed.set(id, list);
  grp.add(pb.build());
  return grp;
}
export function forgetWorks(id: number) { placed.delete(id); }
/** Is works w powered at time t (gen/energy.ts)? */
export function powerOf(w: { vid: number; seed: number; slot: number }): ((t: number) => boolean) | undefined {
  const poi = findPoi(G.char.world, w.vid);
  return poi ? poweredAt(G.char.world, poi, w.seed, G.char.towns[w.vid], w.slot) : undefined;
}

let tick = 0;
/** Twice a second: the glow shows while a works has something to do. */
export function updateWorks(dt: number) {
  if ((tick -= dt) > 0) return;
  tick = 0.5;
  const t = performance.now() / 1000;
  for (const list of placed.values()) for (const w of list) {
    if (!w.glow) continue;
    const p = plantsOf(G.char.towns[w.vid])[w.slot];
    if (!p) continue;
    const pw = powerOf(w);
    runPlant(p, G.char.time, pw);
    w.glow.visible = running(p) && (!pw || pw(G.char.time));
    w.glow.scale.setScalar(0.8 + Math.sin(t * 7 + w.slot) * 0.2);
  }
}
/** The works (or plot) you stand at. */
export function nearWorks(): Works | null {
  if (G.char.loc !== 'overworld') return null;
  for (const list of placed.values()) for (const w of list) if (Math.hypot(Math.max(w.x0 - G.pos.x, 0, G.pos.x - w.x1), Math.max(w.z0 - G.pos.z, 0, G.pos.z - w.z1)) < 2.5) return w;
  return null;
}
export function worksPrompt(w: Works): string {
  const st = G.char.towns[w.vid], p = plantsOf(st)[w.slot];
  if (!p) return st?.pbuild && !isStation(st.pbuild.k) && w.slot === plantsOf(st).length ? `${/^[AEIOU]/.test(specOf(st.pbuild.k).name) ? 'An' : 'A'} ${specOf(st.pbuild.k).name} is going up here: the elder keeps count of the materials` : 'An empty plot for a works: ask the elder';
  const pw = powerOf(w);
  runPlant(p, G.char.time, pw);
  const ready = Object.values(p.out).reduce((a, n) => a + (n ?? 0), 0), on = pw ? pw(G.char.time) : true;
  return `E — the ${PLANTS[p.k].name} (${!running(p) ? 'idle' : on ? 'working' : shortHands(w.vid, 'works', w.slot) ? 'short of hands' : 'no power'}${ready ? ` · ${ready} crate${ready > 1 ? 's' : ''} ready` : ''})`;
}
