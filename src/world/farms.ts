import { refineStock } from '../gen/hall';
import { progressive } from '../gen/settlement';
import { peopleAt } from '../gen/people';
import { reloadStruct } from './overworld';
// The farms a village has built (gen/farms.ts): fenced fields outside the corners of its wall, crop rows over furrows,
// or grass with a coop and hens or a byre and cows (gen/farms.ts CROPS), a scarecrow. Drawn with the village (world/overworld.ts loadVillageStruct).
import * as THREE from 'three';
import { G } from '../game';
import { PropBatch } from './props';
import { farmsOf, farmPlot, farmTarget, upgradedOf, cropOf } from '../gen/farms';
import { farmPower } from '../gen/energy';
import { retarget } from '../gen/people';
import { findPoi, villageSeed, GRIDHOLM_ID } from '../gen/regions';
import { OW } from './overworld';
import type { VillageMap } from '../gen/village';
import type { Terrain } from '../gen/terrain';

const WOOD = 0xb8b060, SOIL = 0x6f8f76, CROP = 0xd8ff7a, GRAIN = 0xe8d880, METAL = 0xa8c8b8, ANIMAL = 0xe8e0c0, FLAX = 0x7ab8ff;

export function drawFarms(vm: VillageMap, T: Terrain, id: number): THREE.Group {
  const n = farmsOf(G.char.towns[id]), up = upgradedOf(G.char.towns[id]), pb = new PropBatch();
  for (let i = 0; i < n; i++) {
    const p = farmPlot(vm.seed, i), x0 = vm.ox + p.x0, z0 = vm.oz + p.z0, x1 = vm.ox + p.x1, z1 = vm.oz + p.z1;
    const at = (x: number, z: number, dy = 0) => [x, T.heightAt(x, z) + dy, z];
    // the fence: posts every 2 m and two rails, a gap on the side facing the wall
    const edge = (ax: number, az: number, bx: number, bz: number) => {
      const L = Math.hypot(bx - ax, bz - az), k = Math.round(L / 2);
      for (let j = 0; j <= k; j++) { const x = ax + (bx - ax) * j / k, z = az + (bz - az) * j / k; pb.seg(WOOD, at(x, z), at(x, z, 1.1)); }
      for (const h of [0.5, 1]) { const pts: number[][] = []; for (let j = 0; j <= k; j++) pts.push(at(ax + (bx - ax) * j / k, az + (bz - az) * j / k, h)); pb.line(WOOD, ...pts); }
    };
    edge(x0, z0, x1, z0); edge(x1, z0, x1, z1); edge(x1, z1, x0, z1); edge(x0, z1, x0, z0);
    const crop = cropOf(G.char.towns[id], i);
    if (crop === 'flax') {
      // tall thin stalks in close rows with a small blue flower on top
      for (let x = x0 + 1.2; x < x1 - 1; x += 1.2) {
        pb.line(SOIL, at(x, z0 + 0.8, 0.03), at(x, (z0 + z1) / 2, 0.03), at(x, z1 - 0.8, 0.03));
        for (let z = z0 + 1.1; z < z1 - 0.8; z += 0.7) {
          const [px, py, pz] = at(x, z);
          pb.seg(CROP, [px, py, pz], [px - 0.04, py + 1.05, pz]); pb.seg(FLAX, [px - 0.12, py + 1.05, pz], [px + 0.04, py + 1.12, pz]);
        }
      }
    } else if (crop === 'wheat' || crop === 'carrots' || crop === 'potatoes') {
      // crop rows over furrows: tall grain, or low leafy rows (potatoes bushier)
      for (let x = x0 + 1.2; x < x1 - 1; x += 1.5) {
        pb.line(SOIL, at(x, z0 + 0.8, 0.03), at(x, (z0 + z1) / 2, 0.03), at(x, z1 - 0.8, 0.03));
        for (let z = z0 + 1.1; z < z1 - 0.8; z += 0.9) {
          const [px, py, pz] = at(x, z);
          if (crop === 'wheat') { pb.seg(GRAIN, [px, py, pz], [px + 0.05, py + 0.9, pz]); pb.seg(GRAIN, [px + 0.05, py + 0.9, pz], [px + 0.12, py + 1.1, pz + 0.05]); }
          else { const w = crop === 'potatoes' ? 0.35 : 0.25, h = crop === 'potatoes' ? 0.45 : 0.35; pb.seg(CROP, [px - w, py + 0.05, pz], [px, py + h, pz]); pb.seg(CROP, [px, py + h, pz], [px + w, py + 0.05, pz]); if (crop === 'potatoes') pb.seg(CROP, [px, py + 0.05, pz - w], [px, py + h, pz]); }
        }
      }
    } else {
      // livestock: grass tufts, a shelter at the back, the animals about the field
      for (let x = x0 + 1; x < x1 - 0.8; x += 1.7) for (let z = z0 + 1; z < z1 - 0.8; z += 1.9) { const [px, py, pz] = at(x + ((x * 7 + z * 3) % 1), z); pb.seg(CROP, [px - 0.12, py, pz], [px, py + 0.25, pz]); pb.seg(CROP, [px + 0.12, py, pz], [px, py + 0.25, pz]); }
      const cows = crop === 'cows', sheep = crop === 'sheep', [hx, hy, hz] = at(x0 + 3, z0 + 2.5);
      const hw = cows ? 2.2 : sheep ? 1.8 : 1.2, hd = cows ? 1.6 : sheep ? 1.2 : 1, hh = cows ? 2.2 : sheep ? 1.6 : 1.3;
      pb.box(hx - hw, hy - 0.1, hz - hd, hx + hw, hy + hh, hz + hd, WOOD);
      pb.gableRoof(hx - hw - 0.2, hz - hd - 0.2, hx + hw + 0.2, hz + hd + 0.2, hy + hh, cows ? 0.9 : sheep ? 0.7 : 0.5, WOOD);
      const n = cows ? 3 : sheep ? 5 : 7;
      for (let k = 0; k < n; k++) {
        const ax = x0 + 3 + ((k * 37 + i * 11) % 70) / 10, az = z0 + 6 + ((k * 53 + i * 7) % 50) / 10, [px, py, pz] = at(ax, az), yaw = k * 1.3;
        const c = Math.cos(yaw), sn = Math.sin(yaw), P = (u: number, v: number, y: number) => [px + u * c - v * sn, py + y, pz + u * sn + v * c];
        if (cows) { // a body on four legs, a head
          pb.box(px - 0.45, py + 0.7, pz - 0.45, px + 0.45, py + 1.3, pz + 0.45, ANIMAL);
          for (const [u, v] of [[-0.35, -0.3], [0.35, -0.3], [-0.35, 0.3], [0.35, 0.3]]) pb.seg(ANIMAL, P(u, v, 0), P(u, v, 0.7));
          pb.line(ANIMAL, P(0.55, 0, 1.2), P(0.95, 0, 1.35), P(1.05, 0, 1.05), P(0.55, 0, 0.95));
        } else if (sheep) { // a woolly body (a squat box), thin legs, a dark head
          pb.box(px - 0.35, py + 0.4, pz - 0.28, px + 0.35, py + 0.85, pz + 0.28, ANIMAL);
          for (const [u, v] of [[-0.25, -0.18], [0.25, -0.18], [-0.25, 0.18], [0.25, 0.18]]) pb.seg(ANIMAL, P(u, v, 0), P(u, v, 0.4));
          pb.line(SOIL, P(0.4, 0, 0.8), P(0.62, 0, 0.82), P(0.66, 0, 0.62), P(0.42, 0, 0.6));
        } else { // a hen: a small body, a head, legs
          pb.line(ANIMAL, P(-0.15, 0, 0.2), P(0.1, 0, 0.35), P(0.2, 0, 0.45), P(0.18, 0, 0.3), P(0.1, 0, 0.15), P(-0.15, 0, 0.2));
          pb.seg(ANIMAL, P(0, 0, 0.15), P(0, 0, 0));
        }
      }
    }
    if (i < up) { // steel ploughs and an irrigation pump: a lattice mast with a tank, a pipe along the rows
      const [mx, my, mz] = at(x1 - 1.2, z0 + 1.2);
      for (const [dx, dz] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]) pb.seg(METAL, [mx + dx, my, mz + dz], [mx + dx * 0.6, my + 3.2, mz + dz * 0.6]);
      pb.box(mx - 0.7, my + 3.2, mz - 0.7, mx + 0.7, my + 4.3, mz + 0.7, METAL);
      pb.line(METAL, at(x1 - 1.2, z0 + 1.2, 0.3), at(x0 + 1, z0 + 1.2, 0.3));
      const [px, py, pz] = at(x0 + 1.5, z1 - 1.5); // a steel plough left at the end of a row
      pb.line(METAL, [px - 0.9, py + 0.15, pz], [px + 0.9, py + 0.15, pz], [px + 1.2, py + 0.7, pz]); pb.seg(METAL, [px - 0.4, py + 0.15, pz], [px - 0.6, py, pz + 0.3]); pb.seg(METAL, [px + 0.3, py + 0.15, pz], [px + 0.1, py, pz + 0.3]);
    }
    // a scarecrow in the middle of a sown field
    if (crop !== 'hens' && crop !== 'cows' && crop !== 'sheep') {
      const [sx, sy, sz] = at((x0 + x1) / 2, (z0 + z1) / 2);
      pb.seg(WOOD, [sx, sy, sz], [sx, sy + 2.2, sz]); pb.seg(WOOD, [sx - 0.8, sy + 1.6, sz], [sx + 0.8, sy + 1.6, sz]);
      pb.box(sx - 0.18, sy + 2.2, sz - 0.18, sx + 0.18, sy + 2.55, sz + 0.18, GRAIN);
    }
  }
  return pb.build();
}

// ---------- the farms' power and the people they feed ----------
let tick = 0;
/** A village's population heads for what its farms feed with the power they got over the last day. */
export function syncFarmVillage(vid: number) {
  const c = G.char, st = c.towns[vid], poi = findPoi(c.world, vid);
  if (!st || !poi || (!farmsOf(st) && !progressive(st))) return; // a settlement's target also follows its homes and hands
  const seed = villageSeed(c.world, poi), home = vid === GRIDHOLM_ID;
  retarget(st, seed, home, c.time, farmTarget(seed, home, st, farmPower(c.world, poi, seed, st, c.time)));
}
/** Every few seconds for the loaded villages (main loop). */
export function updateFarms(dt: number) {
  if ((tick -= dt) > 0) return;
  tick = 5;
  for (const s of [...OW.structs.values()]) if (s.village) {
    syncFarmVillage(s.poi.id);
    const st = G.char.towns[s.poi.id];
    if (!progressive(st) || !st) continue;
    refineStock(G.char.world, s.poi, s.village.seed, st, G.char.time);
    const homes = s.village.buildings.filter((b) => b.role === 'house' && !b.mine), occupied = Math.max(0, Math.floor((peopleAt(s.village.seed, s.poi.id === GRIDHOLM_ID, st, G.char.time) - 8) / 6));
    if (homes.some((b, i) => i < occupied && b.condition !== undefined && b.condition < 2)) reloadStruct(s.poi.id);
  }
}
