// The farms a village has built (gen/farms.ts): fenced fields outside the corners of its wall, crop rows over furrows,
// a small tool shed and a scarecrow. Drawn with the village (world/overworld.ts loadVillageStruct).
import * as THREE from 'three';
import { G } from '../game';
import { PropBatch } from './props';
import { farmsOf, farmPlot } from '../gen/farms';
import type { VillageMap } from '../gen/village';
import type { Terrain } from '../gen/terrain';

const WOOD = 0xb8b060, SOIL = 0x6f8f76, CROP = 0xd8ff7a, GRAIN = 0xe8d880;

export function drawFarms(vm: VillageMap, T: Terrain, id: number): THREE.Group {
  const n = farmsOf(G.char.towns[id]), pb = new PropBatch();
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
    // crop rows: grain in one field, leafy rows in the next
    const grain = i % 2 === 0;
    for (let x = x0 + 1.2; x < x1 - 1; x += 1.5) {
      pb.line(SOIL, at(x, z0 + 0.8, 0.03), at(x, (z0 + z1) / 2, 0.03), at(x, z1 - 0.8, 0.03));
      for (let z = z0 + 1.1; z < z1 - 0.8; z += 0.9) {
        const [px, py, pz] = at(x, z);
        if (grain) { pb.seg(GRAIN, [px, py, pz], [px + 0.05, py + 0.9, pz]); pb.seg(GRAIN, [px + 0.05, py + 0.9, pz], [px + 0.12, py + 1.1, pz + 0.05]); }
        else { pb.seg(CROP, [px - 0.25, py + 0.05, pz], [px, py + 0.35, pz]); pb.seg(CROP, [px, py + 0.35, pz], [px + 0.25, py + 0.05, pz]); }
      }
    }
    // a scarecrow in the middle
    const [sx, sy, sz] = at((x0 + x1) / 2, (z0 + z1) / 2);
    pb.seg(WOOD, [sx, sy, sz], [sx, sy + 2.2, sz]); pb.seg(WOOD, [sx - 0.8, sy + 1.6, sz], [sx + 0.8, sy + 1.6, sz]);
    pb.box(sx - 0.18, sy + 2.2, sz - 0.18, sx + 0.18, sy + 2.55, sz + 0.18, GRAIN);
  }
  return pb.build();
}
