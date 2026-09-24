// Inside a cave system (gen/cavegen.ts): the floor and the vault drawn as two warped nets over dark fill that meet in
// rounded walls, stalagmites and stalactites, chests in the pockets, nutrient crystals, stray drones, and daylight at
// each way out. You walk on the smooth floor (G.ground), a coarse voxel grid of the rock keeps you inside and stops
// shots and eyes (rayWorld), and E at a way out takes you back to that cave mouth; in a linked system the other way
// out comes out on the far side of the mountain.
import * as THREE from 'three';
import { scene, lineMat, fillMat, GRID } from './render';
import { G, W } from '../game';
import { hash } from '../core/rng';
import { VoxelGrid } from '../core/voxel';
import { generateCave, headroom, floorAtCave, ceilAtCave, type CaveMap } from '../gen/cavegen';
import { makeChest, setCrystalXp } from './loot';
import { placeCrystals } from './flora';
import { makeDrone, placeDrone, setDroneRespawn } from './enemies';
import { setStreakSources } from './fx';
import { PropBatch } from './props';
import { el } from '../ui/hud';
import { buildMini, setMiniMode, setMiniOpen } from '../ui/minimap';
import type { DungeonPos } from '../save';

const ROCK = 0x8fb89a, EXIT = 0x5cc8ff;
export let cave: CaveMap | null = null;

/** The cave's meshes: floor and vault as nets (lines every 2 m) over a dark fill, closed where they meet. */
function caveMesh(m: CaveMap): THREE.Group {
  const { nx, nz } = m, tri: number[] = [], lines: number[] = [], vault: number[] = [];
  // at every sample: the floor and the vault, pinched together in the rock
  const F = new Float32Array(nx * nz), Cc = new Float32Array(nx * nz);
  for (let o = 0; o < nx * nz; o++) { const f = m.floor[o], c = m.ceil[o]; if (c > f) { F[o] = f; Cc[o] = c; } else { F[o] = Cc[o] = (f + c) / 2; } }
  const open = (o: number) => m.ceil[o] > m.floor[o];
  const P = (i: number, k: number, a: Float32Array) => [i + m.ox, a[i + nx * k], k + m.oz];
  for (let k = 0; k + 1 < nz; k++) for (let i = 0; i + 1 < nx; i++) {
    const o = i + nx * k, cs = [o, o + 1, o + nx + 1, o + nx];
    if (!cs.some(open)) continue;
    for (const [a, up] of [[F, false], [Cc, true]] as const) {
      const p00 = P(i, k, a), p10 = P(i + 1, k, a), p11 = P(i + 1, k + 1, a), p01 = P(i, k + 1, a);
      if (up) tri.push(...p00, ...p11, ...p10, ...p00, ...p01, ...p11); else tri.push(...p00, ...p10, ...p11, ...p00, ...p11, ...p01);
      const L = up ? vault : lines;
      if (k % 2 === 0) L.push(...p00, ...p10);
      if (i % 2 === 0) L.push(...p00, ...p01);
    }
  }
  const geo = (a: number[]) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(a, 3)); return g; };
  const fill = fillMat(); (fill as THREE.MeshBasicMaterial).side = THREE.DoubleSide;
  const grp = new THREE.Group();
  grp.add(new THREE.Mesh(geo(tri), fill), new THREE.LineSegments(geo(lines), lineMat(GRID)), new THREE.LineSegments(geo(vault), lineMat(0x1f9a48)));
  // stalagmites and stalactites, and the daylight at the ways out
  const pb = new PropBatch();
  for (const s of m.spikes) {
    if (headroom(m, s.x, s.z) < s.len + 1.9) continue;
    if (s.up) pb.cone(s.x, floorAtCave(m, s.x, s.z) - 0.1, s.z, s.r, s.len, ROCK, 7);
    else pb.cone(s.x, ceilAtCave(m, s.x, s.z) + 0.1, s.z, s.r, -s.len, ROCK, 7);
  }
  for (const e of m.exits) {
    const y = floorAtCave(m, e.ox, e.oz), pts: number[][] = [];
    for (let t = 0; t <= 12; t++) { const a = Math.PI * t / 12; pts.push([e.ox, y + Math.sin(a) * 2.9, e.oz - Math.cos(a) * 1.8]); }
    pb.line(EXIT, ...pts); pb.line(EXIT, [e.ox, y + 0.05, e.oz - 1.8], [e.ox, y + 0.05, e.oz + 1.8]);
  }
  grp.add(pb.build());
  return grp;
}
/** The rock as a coarse voxel grid: columns open from the floor to the vault (collision, shots, minimap, drones). */
function caveGrid(m: CaveMap): VoxelGrid {
  let lo = Infinity, hi = -Infinity;
  for (let o = 0; o < m.floor.length; o++) if (m.ceil[o] > m.floor[o]) { lo = Math.min(lo, m.floor[o]); hi = Math.max(hi, m.ceil[o]); }
  const oy = Math.floor(lo) - 2, g = new VoxelGrid(m.ox, oy, m.oz, m.nx - 1, Math.ceil(hi) - oy + 2, m.nz - 1);
  for (let k = 0; k < g.nz; k++) for (let i = 0; i < g.nx; i++) {
    const s = [i + m.nx * k, i + 1 + m.nx * k, i + m.nx * (k + 1), i + 1 + m.nx * (k + 1)];
    const fmin = Math.min(...s.map((o) => m.floor[o])), cmax = Math.max(...s.map((o) => m.ceil[o])), room = Math.max(...s.map((o) => m.ceil[o] - m.floor[o]));
    if (room < 0.4) continue;
    for (let j = 0; j < g.ny; j++) { const y = j + oy; if (y + 1 > fmin && y < cmax - 0.3) g.setCell(i + m.ox, y, k + m.oz, 1); }
  }
  return g;
}

/** Build the cave of the current dungeon position and put the player at the entrance they came in by. */
export function buildCave(d: DungeonPos, clear: () => void, setGroup: (g: THREE.Group) => void) {
  const c = G.char, info = d.cave!;
  const m = generateCave(hash(c.world, d.ruinId, 0xca11), info.mouths.length >= 2 ? 2 : 1);
  clear(); cave = m;
  setDroneRespawn(placeDrone); setCrystalXp(() => 6);
  G.grid = caveGrid(m); G.space = G.grid;
  G.ground = (x, z) => floorAtCave(m, x, z);
  // stalagmites are solid; so are places too low to stand in
  G.obstacle = (x, y, z, r) => {
    if (headroom(m, x, z) < 1.8) return true;
    for (const s of m.spikes) if (s.up && Math.hypot(s.x - x, s.z - z) < s.r * 0.8 + r && y < floorAtCave(m, s.x, s.z) + s.len) return true;
    return false;
  };
  const grp = caveMesh(m); setGroup(grp); scene.add(grp); setStreakSources([]);
  const e = m.exits[Math.min(info.from, m.exits.length - 1)];
  G.pos.set(e.x, e.y, e.z); G.vel.set(0, 0, 0); G.yaw = e.yaw; G.pitch = 0;
  W.chests = m.chests.map((p, i) => { const ch = makeChest(p, i); if (ch) ch.g.position.y = floorAtCave(m, ch.g.position.x, ch.g.position.z); return ch; }).filter((x) => !!x);
  placeCrystals(m.crystals.map((p) => ({ ...p, y: floorAtCave(m, Math.floor(p.x) + 0.5, Math.floor(p.z) + 0.5) })));
  for (let k = 0; k < m.nz - 1; k += 2) for (let i = 0; i < m.nx - 1; i += 2) if (headroom(m, i + 0.5, k + 0.5) > 3.2) W.spawnCells.push([i, Math.floor(floorAtCave(m, i + 0.5, k + 0.5)), k]);
  const n = 3 + (hash(d.ruinId, 7) % 4);
  for (let i = 0; i < n; i++) { const t = makeDrone(); placeDrone(t); W.drones.push(t); }
  setMiniOpen((x, z) => headroom(m, x + 0.5, z + 0.5) > 1.2);
  setMiniMode('voxel'); buildMini();
  el.hudL.textContent = info.name; el.route.style.display = 'none';
}
export function leaveCave() { cave = null; setMiniOpen(null); }
/** The way out you stand at (its index), or -1. */
export function caveExitNear(): number {
  if (!cave) return -1;
  return cave.exits.findIndex((e) => Math.hypot(e.ox - G.pos.x, e.oz - G.pos.z) < 3);
}
