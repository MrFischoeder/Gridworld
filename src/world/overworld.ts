// The open world: terrain streamed in 32 m chunks around the player, voxel structures (the village, ruins)
// standing on it, forests, roads, and light field enemies. Generation is deterministic; this module only
// decides what is loaded and turns generator output into meshes.
import * as THREE from 'three';
import { scene, V, GRID, localize } from './render';
import { G, W } from '../game';
import { VoxelGrid, type Space } from '../core/voxel';
import { Terrain, inRect, rectDist, STEP, CELLS, VERTS } from '../gen/terrain';
import { CHUNK, poisNear, X_MIN, WORLD_W, POLE_Z, POLAR_Z, villageContaining, villageDist, villageSeed, GRIDHOLM_ID, type Poi, wrapC } from '../gen/regions';
import { chunkTrees, chunkRocks, type Tree, type Rock } from '../gen/trees';
import { drawTree } from './trees';
import { drawTemple } from './temple';
import { chunkWells, type Well } from '../gen/water';
import { chunkPlants, type Plant } from '../gen/flora';
import { dangerAt } from '../gen/danger';
import { drawPlants, dropPlants, ripe, type PlantNode } from './flora';
import { drawWell, syncLakes, clearLakes } from './water';
import { generateVillage, type VillageMap } from '../gen/village';
import { syncQuestWorld } from './quests';
import { generateRuin } from '../gen/ruins';
import { generateWreck } from '../gen/wreck';
import { drawWreck } from './wreck';
import { tryPlaceDoor } from '../gen/doors';
import { PropBatch, sharedFill, sharedLine } from './props';
import { makeStair, type Door, type Stair } from './doors';
import { makeNpc, type Npc } from './npc';
import { foeRules, type Drone } from './enemies';
import { spawnVehicles, clearVehicles, vehicleHit, syncFound, shielded, driving, damageVehicle, vehiclesNear } from './vehicles';
import { logLine, showToast } from '../ui/hud';
import { setCreatureEnv, clearCreatures } from './creatures';
import { setRobotEnv, clearRobots } from './robots';
import { updateThreat } from './threat';
import { setBanditEnv, clearBandits, spawnCamp, despawnCamp } from './bandits';
import { setRaiderEnv, clearRaiders, ambushHit } from './raiders';
import { generateCamp, type CampMap } from '../gen/camps';
import { add as addMat } from './render';
import { YARD } from '../gen/vehicles';
import { setStreakSources, type EdgeSource } from './fx';
import { voxelObject, villageDeco, wallSign } from './level';
import { NPC_INFO, VILLAGER_NAMES, type NpcRole } from '../data/npcs';
import { DIRV } from '../core/rng';
import { claimDist, CLAIM } from '../gen/claims';
import { baseHit, baseFloor, baseRay, baseSolid } from './building';

export const LOAD_R = 4, UNLOAD_R = 6, STRUCT_LOAD = 170, STRUCT_UNLOAD = 240;
/** Surface structures are drawn in outline style: folds and edges, floor tiles every 2 m, wall seams every 4 m. */
const OUTLINE = { floor: 2, wall: 4 };
const ROAD_COLOR = 0xc8ffd8, TILE_COLOR = 0x4dff7e, ICE_COLOR = 0xbfffe8;

interface Chunk { cx: number; cz: number; group: THREE.Group; trees: Tree[]; rocks: Rock[]; wells: Well[]; plants: Plant[]; nodes: PlantNode[]; lod: number }
interface Structure {
  poi: Poi; grid: VoxelGrid; group: THREE.Group; edges: EdgeSource;
  doors: Door[]; stairs: Stair[]; npcs: Npc[]; village?: VillageMap; camp?: CampMap; flames?: THREE.LineSegments;
}

export const OW = {
  terrain: null as Terrain | null,
  chunks: new Map<number, Chunk>(),
  structs: new Map<number, Structure>(),
  village: null as VillageMap | null,
};
const ckey = (cx: number, cz: number) => (cx + 32768) * 65536 + (cz + 32768);
let queue: [number, number, number][] = [], lastChunk = '';

// ---------- collision ----------
/** Voxel structures on top of open air. Each cell belongs to the structure whose footprint covers it. */
export const space: Space = {
  empty(x, y, z) { for (const s of OW.structs.values()) if (s.grid.covers(x, z)) return s.grid.empty(x, y, z); return true; },
  setCell(x, y, z, v) { for (const s of OW.structs.values()) if (s.grid.covers(x, z)) { s.grid.setCell(x, y, z, v); return; } },
};
/** Terrain height, except inside a loaded structure's footprint, where its voxel floor (and shafts) rule. */
const inStructure = (x: number, z: number) => { const fx = Math.floor(x), fz = Math.floor(z); for (const s of OW.structs.values()) if (s.grid.covers(fx, fz)) return true; return false; };
export function groundAt(x: number, z: number): number {
  const fx = Math.floor(x), fz = Math.floor(z);
  for (const s of OW.structs.values()) if (s.grid.covers(fx, fz)) return -Infinity;
  return OW.terrain!.heightAt(x, z);
}
/** Tree trunks (an arch has one per leg): vertical cylinders, solid up to a bit above their base. */
export function treeHit(x: number, y: number, z: number, r: number): boolean {
  const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const c = OW.chunks.get(ckey(cx + i, cz + j)); if (!c) continue;
    for (const t of c.trees) if (y < t.y + 2 + t.h * 0.3) for (const [tx, tz, tr] of t.cols) if (Math.hypot(tx - x, tz - z) < tr + r) return true;
    for (const k of c.rocks) if (k.h > 0.7 && Math.hypot(k.x - x, k.z - z) < k.r * 0.55 + r && y < k.y + k.h * 0.8) return true;
    for (const p of c.plants) if (y < p.y + 2) for (const [px, pz, pr] of p.cols) if (Math.hypot(px - x, pz - z) < pr + r) return true;
    for (const w of c.wells) if (Math.hypot(w.x - x, w.z - z) < 1.05 + r && y < OW.terrain!.heightAt(w.x, w.z) + 0.9) return true;
  }
  return false;
}
/** The village the point is in (inside its walls' footprint), if any. */
export const villageHere = (x: number, z: number): Poi | undefined => (OW.terrain ? villageContaining(OW.terrain.world, x, z) : undefined);
export const inVillage = (x: number, z: number) => !!villageHere(x, z);
/** Distance to the nearest village footprint (Infinity when none is close). */
const nearVillage = (x: number, z: number) => (OW.terrain ? villageDist(OW.terrain.world, x, z) : Infinity);

// ---------- terrain chunks ----------
/** Level of detail by distance (in chunks): near chunks get grid lines every 2 m, far ones every 4 m. */
const lodFor = (cx: number, cz: number, pcx: number, pcz: number) => (Math.max(Math.abs(cx - pcx), Math.abs(cz - pcz)) > 2 ? 2 : 1);

function buildChunk(cx: number, cz: number, lod = 1): Chunk {
  const T = OW.terrain!, lat = T.lattice(cx, cz), f = T.chunkFeatures(cx, cz), x0 = cx * CHUNK, z0 = cz * CHUNK;
  const holes = f.pads.map((p) => p.poi.rect);
  const hole = (ax: number, az: number, bx: number, bz: number) => holes.some((r) => Math.min(ax, bx) >= r.x0 && Math.max(ax, bx) <= r.x1 && Math.min(az, bz) >= r.z0 && Math.max(az, bz) <= r.z1);
  const H = (i: number, j: number) => lat[i + VERTS * j];
  const tri: number[] = [], lines: number[] = [];
  for (let j = 0; j < CELLS; j++) for (let i = 0; i < CELLS; i++) {
    const ax = x0 + i * STEP, az = z0 + j * STEP, bx = ax + STEP, bz = az + STEP;
    if (hole(ax, az, bx, bz)) continue;
    const a = [ax, H(i, j), az], b = [bx, H(i + 1, j), az], c = [bx, H(i + 1, j + 1), bz], d = [ax, H(i, j + 1), bz];
    tri.push(...a, ...b, ...c, ...a, ...c, ...d);
  }
  // grid lines every 2 m, aligned with the world grid (each chunk draws its own lower/left edges)
  for (let j = 0; j < CELLS; j += lod) for (let i = 0; i < CELLS; i++) {
    const ax = x0 + i * STEP, z = z0 + j * STEP;
    if (!hole(ax, z, ax + STEP, z)) lines.push(ax, H(i, j), z, ax + STEP, H(i + 1, j), z);
  }
  for (let i = 0; i < CELLS; i += lod) for (let j = 0; j < CELLS; j++) {
    const x = x0 + i * STEP, az = z0 + j * STEP;
    if (!hole(x, az, x, az + STEP)) lines.push(x, H(i, j), az, x, H(i, j + 1), az + STEP);
  }
  // roads: brighter lines along both edges, sampled every metre of the road
  const road: number[] = [];
  for (const r of f.roads) {
    for (let k = 0; k + 1 < r.pts.length; k++) {
      const [ax, az] = r.pts[k], [bx, bz] = r.pts[k + 1], L = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / L, nz = (bx - ax) / L;
      for (let s = 0; s < L; s += 1) {
        const e = Math.min(L, s + 1);
        for (const side of (Math.floor(s) % 3 === 0 ? [-2.2, 0, 2.2] : [-2.2, 2.2])) {
          const px = ax + (bx - ax) * s / L + nx * side, pz = az + (bz - az) * s / L + nz * side;
          const qx = ax + (bx - ax) * e / L + nx * side, qz = az + (bz - az) * e / L + nz * side;
          if (px < x0 || px >= x0 + CHUNK || pz < z0 || pz >= z0 + CHUNK) continue;
          if (holes.some((h) => inRect(h, px, pz) || inRect(h, qx, qz))) continue;
          road.push(px, T.heightAt(px, pz) + 0.1, pz, qx, T.heightAt(qx, qz) + 0.1, qz);
        }
      }
    }
  }
  const group = new THREE.Group();
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3));
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
  group.add(new THREE.Mesh(fg, sharedFill()), new THREE.LineSegments(lg, sharedLine(Math.abs(z0 + CHUNK / 2) > POLAR_Z + 800 ? ICE_COLOR : GRID)));
  if (road.length) { const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(road, 3)); group.add(new THREE.LineSegments(rg, sharedLine(ROAD_COLOR))); }
  const wells = chunkWells(T, cx, cz), plants = chunkPlants(T, cx, cz).filter((p) => !T.claimAt(p.x, p.z, 2));
  // felled trees and broken rocks (player changes, keyed by their index in the generated list) are left out
  const trees: Tree[] = [], stumps: Tree[] = [], rocks: Rock[] = [];
  // a claimed site is cleared: nothing grows on the levelled ground (the generated lists keep their indices)
  const cleared = (x: number, z: number) => !!T.claimAt(x, z, 1);
  chunkTrees(T, cx, cz).forEach((t, i) => { if (t.cols.some(([x, z]) => cleared(x, z))) return; const k = `tree:${wrapC(cx)}:${cz}:${i}`; gatherKey.set(t, k); (ripe(k) ? trees : stumps).push(t); });
  chunkRocks(T, cx, cz).forEach((r, i) => { if (cleared(r.x, r.z)) return; const k = `rock:${wrapC(cx)}:${cz}:${i}`; gatherKey.set(r, k); if (ripe(k)) rocks.push(r); });
  let nodes: PlantNode[] = [];
  if (trees.length || stumps.length || rocks.length || wells.length || plants.length) {
    const pb = new PropBatch();
    for (const t of stumps) for (const [sx, sz, sr] of t.cols) { const r = Math.max(0.25, sr * 0.8); pb.box(sx - r, t.y - 0.1, sz - r, sx + r, t.y + 0.5, sz + r, GRID); }
    nodes = drawPlants(pb, plants, lod, group);
    for (const w of wells) drawWell(pb, w, T.heightAt(w.x, w.z));
    for (const t of trees) drawTree(pb, t, lod);
    for (const k of rocks) pb.rock(k.x, k.y, k.z, k.r, k.h, k.sides, k.rot, GRID);
    group.add(pb.build());
  }
  localize(group, x0, z0);
  scene.add(group);
  return { cx, cz, group, trees, rocks, wells, plants, nodes, lod };
}
/** Save keys of the trees and rocks in loaded chunks ("tree:<cx>:<cz>:<i>", canonical chunk x). */
export const gatherKey = new WeakMap<object, string>();
/** Standing trees and workable rocks around (x, z), for the Hatchet and the Pickaxe. */
export function gatherables(x: number, z: number) {
  const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK), trees: Tree[] = [], rocks: Rock[] = [];
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const c = OW.chunks.get(ckey(cx + i, cz + j)); if (c) { trees.push(...c.trees); rocks.push(...c.rocks); } }
  return { trees, rocks };
}
/** Rebuild the chunk under (x, z) (a tree was felled, a rock broken up). */
export function rebuildChunkAt(x: number, z: number) {
  const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK), old = OW.chunks.get(ckey(cx, cz));
  if (!old) return;
  OW.chunks.set(ckey(cx, cz), buildChunk(cx, cz, old.lod));
  dropChunk(old);
}
/** Rebuild every loaded chunk that comes within r of (x, z) (a claim levelled the ground there). */
export function rebuildChunksNear(x: number, z: number, r: number) {
  for (const c of [...OW.chunks.values()]) {
    const x0 = c.cx * CHUNK, z0 = c.cz * CHUNK, d = Math.hypot(Math.max(x0 - x, 0, x - x0 - CHUNK), Math.max(z0 - z, 0, z - z0 - CHUNK));
    if (d < r) { OW.chunks.set(ckey(c.cx, c.cz), buildChunk(c.cx, c.cz, c.lod)); dropChunk(c); }
  }
}
function dropChunk(c: Chunk) {
  dropPlants(c.nodes);
  scene.remove(c.group);
  c.group.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
}

// ---------- structures ----------
function gateSign(vm: VillageMap) {
  const g = new THREE.Group();
  for (const gate of vm.gates) {
    const o = DIRV[gate.dir];
    g.add(wallSign(vm.name.toUpperCase(), '#ffd060', { x: gate.x - o[0] * 1.5, z: gate.z - o[1] * 1.5 }, o, vm.y + 5.3));
  }
  return g;
}
/** The notice board: two posts, a panel with pinned notes, a little roof and a sign. */
function boardDeco(vm: VillageMap, y: number) {
  const g = new THREE.Group(), pb = new PropBatch(), { x, z } = vm.board, zf = z + 0.12;
  pb.box(x - 1.45, y, z - 0.08, x - 1.3, y + 2.7, z + 0.08, GRID); pb.box(x + 1.3, y, z - 0.08, x + 1.45, y + 2.7, z + 0.08, GRID);
  pb.solid8([[x - 1.35, y + 0.9, z - 0.05], [x + 1.35, y + 0.9, z - 0.05], [x + 1.35, y + 0.9, z + 0.1], [x - 1.35, y + 0.9, z + 0.1]],
    [[x - 1.35, y + 2.4, z - 0.05], [x + 1.35, y + 2.4, z - 0.05], [x + 1.35, y + 2.4, z + 0.1], [x - 1.35, y + 2.4, z + 0.1]], GRID);
  pb.solid8([[x - 1.7, y + 2.7, z - 0.45], [x + 1.7, y + 2.7, z - 0.45], [x + 1.7, y + 2.7, z + 0.55], [x - 1.7, y + 2.7, z + 0.55]],
    [[x - 1.7, y + 3.05, z], [x + 1.7, y + 3.05, z], [x + 1.7, y + 3.05, z + 0.02], [x - 1.7, y + 3.05, z + 0.02]], GRID);
  for (const [nx, ny, w, h] of [[-1.1, 1.3, 0.55, 0.7], [-0.35, 1.55, 0.5, 0.6], [0.35, 1.2, 0.6, 0.75], [0.95, 1.6, 0.4, 0.55]]) {
    const x0 = x + nx, y0 = y + ny;
    pb.line(0xffd060, [x0, y0, zf], [x0 + w, y0, zf], [x0 + w, y0 + h, zf], [x0, y0 + h, zf], [x0, y0, zf]);
    for (let r = 0.15; r < h - 0.1; r += 0.15) pb.line(0x9dffb4, [x0 + 0.06, y0 + h - r, zf], [x0 + w - 0.08, y0 + h - r, zf]);
  }
  g.add(pb.build());
  g.add(wallSign('NOTICE BOARD', '#ffd060', { x, z: z + 0.1 }, [0, 1], y + 3.4));
  return g;
}
/** The map board (every village): a slanted table on two legs with the land drawn on it, under a little roof. */
function mapBoardDeco(vm: VillageMap, y: number) {
  const g = new THREE.Group(), pb = new PropBatch(), { x, z } = vm.mapBoard;
  for (const s of [-1, 1]) pb.box(x + s * 1.2 - 0.07, y, z - 0.07, x + s * 1.2 + 0.07, y + 2.9, z + 0.07, GRID);
  // the map panel, tilted back towards the reader
  const lo = y + 0.9, hi = y + 2.2, zb = z - 0.35, zf = z + 0.05;
  pb.solid8([[x - 1.1, lo, zf], [x + 1.1, lo, zf], [x + 1.1, lo, zf - 0.08], [x - 1.1, lo, zf - 0.08]], [[x - 1.1, hi, zb + 0.08], [x + 1.1, hi, zb + 0.08], [x + 1.1, hi, zb], [x - 1.1, hi, zb]], GRID);
  const P = (u: number, v: number) => [x + u, lo + (hi - lo) * v + 0.02, zf + (zb - zf) * v + 0.06]; // on the panel's face
  pb.line(0x2ac8b0, P(-0.8, 0.25), P(-0.55, 0.45), P(-0.75, 0.6), P(-0.95, 0.4), P(-0.8, 0.25)); // a lake
  pb.line(0xc8ffd8, P(-0.5, 0.1), P(-0.1, 0.4), P(0.3, 0.45), P(0.85, 0.85)); // a road
  pb.line(0xffd060, P(-0.15, 0.3), P(-0.05, 0.3), P(-0.05, 0.4), P(-0.15, 0.4), P(-0.15, 0.3)); // the village
  pb.line(0x5cc8ff, P(0.45, 0.65), P(0.55, 0.8), P(0.65, 0.65), P(0.45, 0.65)); // ruins
  pb.line(0x7dffc8, P(0.6, 0.2), P(0.9, 0.25), P(0.6, 0.3)); // a wreck
  pb.solid8([[x - 1.5, y + 2.9, z - 0.55], [x + 1.5, y + 2.9, z - 0.55], [x + 1.5, y + 2.9, z + 0.45], [x - 1.5, y + 2.9, z + 0.45]],
    [[x - 1.5, y + 3.2, z - 0.05], [x + 1.5, y + 3.2, z - 0.05], [x + 1.5, y + 3.2, z - 0.03], [x - 1.5, y + 3.2, z - 0.03]], GRID);
  g.add(pb.build());
  g.add(wallSign('MAP', '#9dffe0', { x, z: z + 0.5 }, [0, 1], y + 3.5));
  return g;
}
/** Sign post and painted parking bays of the vehicle yard. */
function yardDeco(y: number) {
  const g = new THREE.Group(), pb = new PropBatch();
  pb.box(YARD.sign.x - 0.08, y, YARD.sign.z - 0.08, YARD.sign.x + 0.08, y + 3.2, YARD.sign.z + 0.08, GRID);
  for (const b of YARD.bays) {
    const hw = 2.5, hl = 5.5, yy = y + 0.04;
    pb.line(0x9dffb4, [b.x - hw, yy, b.z + hl], [b.x - hw, yy, b.z - hl]); pb.line(0x9dffb4, [b.x + hw, yy, b.z + hl], [b.x + hw, yy, b.z - hl]);
    pb.line(0x9dffb4, [b.x - hw, yy, b.z + hl], [b.x + hw, yy, b.z + hl]);
  }
  g.add(pb.build());
  g.add(wallSign('VEHICLES', '#ffd060', { x: YARD.sign.x, z: YARD.sign.z }, [0, -1], y + 3.5));
  return g;
}
/** Residents of the other villages: everyone has their own name (Gridholm keeps its familiar faces). */
const FOLK = ['Aldo', 'Bera', 'Casimir', 'Dara', 'Emil', 'Frida', 'Goran', 'Hela', 'Ivo', 'Jana', 'Kasper', 'Lida', 'Marek', 'Nela', 'Oskar', 'Petra', 'Rolf', 'Sabina', 'Tomek', 'Una', 'Vojtek', 'Wanda', 'Zenon', 'Ilse'];
function residentName(vm: VillageMap, role: NpcRole, i: number): string {
  if (vm.home) return NPC_INFO[role].name!;
  const n = FOLK[((vm.seed >>> 0) + i * 7) % FOLK.length];
  return role === 'elder' ? 'Elder ' + n : n;
}
function loadVillageStruct(poi: Poi): Structure {
  const T = OW.terrain!, y = T.padY(poi), home = poi.id === GRIDHOLM_ID;
  const vm = generateVillage(villageSeed(T.world, poi), y, poi.x, poi.z, poi.name, home);
  const grid = VoxelGrid.surface(vm.ops, vm.rect, y);
  const { group, mesh } = voxelObject(grid, Infinity, OUTLINE);
  group.add(villageDeco(vm, y), gateSign(vm));
  if (vm.home) group.add(boardDeco(vm, y));
  group.add(mapBoardDeco(vm, y));
  scene.add(group);
  const npcs: Npc[] = [];
  vm.buildings.forEach((b, i) => { if (b.role !== 'house') npcs.push(makeNpc(b.role, residentName(vm, b.role, i), V(b.home!.x, b.home!.y, b.home!.z), b)); });
  if (vm.home) {
    // the vehicle dealer and his yard just outside the north gate
    npcs.push(makeNpc('dealer', NPC_INFO.dealer.name!, V(YARD.dealer.x, y, YARD.dealer.z), null));
    group.add(yardDeco(y));
  }
  const taken = new Set(npcs.map((n) => n.name.replace('Elder ', '')));
  const folk = vm.home ? VILLAGER_NAMES : FOLK.slice(((vm.seed >>> 0) + 3) % 12).filter((n) => !taken.has(n));
  folk.slice(0, 6).forEach((nm) => { const c = vm.walk[(Math.random() * vm.walk.length) | 0]; npcs.push(makeNpc('villager', nm, V(c[0] + 0.5, y, c[1] + 0.5), null)); });
  for (const n of npcs) n.town = vm.name;
  W.npcs.push(...npcs); W.villageWalk = vm.walk;
  OW.village = vm;
  return { poi, grid, group, edges: mesh, doors: [], stairs: [], npcs, village: vm };
}
export let enterRuin: (id: number) => void = () => {};
export function setEnterRuin(f: (id: number) => void) { enterRuin = f; }
function loadRuinStruct(poi: Poi): Structure {
  const T = OW.terrain!, y = T.padY(poi), rm = generateRuin(T.world, poi, y);
  const grid = VoxelGrid.surface(rm.ops, rm.rect, y);
  const { group, mesh } = voxelObject(grid, Infinity, OUTLINE);
  // fragments of the old paving
  const tl: number[] = [];
  for (const t of rm.tiles) {
    const a = 0.12, b = 0.88, yy = y + 0.03;
    tl.push(t.x + a, yy, t.z + a, t.x + b, yy, t.z + a, t.x + b, yy, t.z + a, t.x + b, yy, t.z + b, t.x + b, yy, t.z + b, t.x + a, yy, t.z + b, t.x + a, yy, t.z + b, t.x + a, yy, t.z + a);
  }
  const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(tl, 3));
  group.add(new THREE.LineSegments(tg, sharedLine(TILE_COLOR)));
  group.add(drawTemple(rm.temple, poi.id));
  scene.add(group);
  const s: Structure = { poi, grid, group, edges: mesh, doors: [], stairs: [], npcs: [] };
  OW.structs.set(poi.id, s); // the door below is placed through the shared space
  const p = rm.portal, placed = tryPlaceDoor(space, { axis: p.axis, m: p.m, c: p.c, stair: true, y0: y }, [])!;
  const st = makeStair(p, placed, 0, '▼ ' + poi.name.toUpperCase(), 'Stairs down into the ' + poi.name, () => enterRuin(poi.id));
  st.ruinId = poi.id;
  s.doors.push(st.door); s.stairs.push(st);
  W.portals.push(st);
  return s;
}
/** Crash site: the wrecked freighter (voxel slices inside a drawn hull) with its hatch and the stairs down. */
function loadWreckStruct(poi: Poi): Structure {
  const T = OW.terrain!, y = T.padY(poi), wm = generateWreck(T.world, poi, y);
  const grid = VoxelGrid.surface(wm.ops, wm.rect, y);
  const { group, mesh } = voxelObject(grid, Infinity, OUTLINE);
  group.add(drawWreck(wm.deco, poi.id));
  scene.add(group);
  const s: Structure = { poi, grid, group, edges: mesh, doors: [], stairs: [], npcs: [] };
  OW.structs.set(poi.id, s);
  const p = wm.portal, placed = tryPlaceDoor(space, { axis: p.axis, m: p.m, c: p.c, stair: true, y0: y }, [])!;
  const st = makeStair(p, placed, 0, '▼ ' + poi.name.toUpperCase(), 'Hatch into the ' + poi.name, () => enterRuin(poi.id));
  st.ruinId = poi.id;
  s.doors.push(st.door); s.stairs.push(st);
  W.portals.push(st);
  return s;
}
/** Bandit camp: crates and barricades (voxels), A-frame tents, a campfire, the stash; its bandits. */
function loadCampStruct(poi: Poi): Structure {
  const T = OW.terrain!, y = T.padY(poi), cm = generateCamp(T.world, poi, y);
  const grid = VoxelGrid.surface(cm.ops, cm.rect, y);
  const { group, mesh } = voxelObject(grid, Infinity, OUTLINE);
  const pb = new PropBatch();
  for (const t of cm.tents) {
    pb.gableRoof(t.x0, t.z0, t.x1, t.z1, y, 2.3, 0xb8b060);
    const along = t.x1 - t.x0 >= t.z1 - t.z0;
    if (along) pb.line(0xb8b060, [t.x0, y, (t.z0 + t.z1) / 2 - 0.6], [t.x0, y + 1.5, (t.z0 + t.z1) / 2], [t.x0, y, (t.z0 + t.z1) / 2 + 0.6]);
    else pb.line(0xb8b060, [(t.x0 + t.x1) / 2 - 0.6, y, t.z0], [(t.x0 + t.x1) / 2, y + 1.5, t.z0], [(t.x0 + t.x1) / 2 + 0.6, y, t.z0]);
  }
  for (let i = 0; i < 7; i++) { const a = i / 7 * 6.283; pb.rock(cm.fire.x + Math.cos(a) * 0.9, y - 0.05, cm.fire.z + Math.sin(a) * 0.9, 0.28, 0.25, 4, a, GRID); }
  // the stash: a heavy crate
  const sx = cm.stash.x, sz = cm.stash.z;
  pb.box(sx - 0.5, y, sz - 0.4, sx + 0.5, y + 0.7, sz + 0.4, 0xffd060);
  group.add(pb.build());
  const flames = new THREE.LineSegments(new THREE.BufferGeometry(), addMat(0xffb347));
  flames.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(10 * 6), 3));
  flames.frustumCulled = false; flames.position.set(cm.fire.x, y, cm.fire.z); group.add(flames);
  scene.add(group);
  const s: Structure = { poi, grid, group, edges: mesh, doors: [], stairs: [], npcs: [], camp: cm, flames };
  OW.structs.set(poi.id, s);
  spawnCamp(cm);
  return s;
}
/** Flickering campfires (called every frame). */
export function animateCamps(time: number) {
  for (const s of OW.structs.values()) {
    if (!s.flames) continue;
    const a = s.flames.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < 10; i++) {
      const ang = i / 10 * 6.283 + time * 0.7, r = 0.25 + 0.2 * Math.sin(time * 5 + i), h = 0.6 + 0.5 * Math.abs(Math.sin(time * 7 + i * 1.7));
      a.setXYZ(i * 2, Math.cos(ang) * r, 0.05, Math.sin(ang) * r);
      a.setXYZ(i * 2 + 1, Math.cos(ang + 0.6) * r * 0.2, h, Math.sin(ang + 0.6) * r * 0.2);
    }
    a.needsUpdate = true;
  }
}
/** Loaded camp campfires (for cooking). */
export const campFires = () => [...OW.structs.values()].filter((s) => s.camp).map((s) => ({ x: s.camp!.fire.x, y: s.camp!.y, z: s.camp!.fire.z }));
/** Loaded camp stashes, for the E interaction. */
export const campStashes = () => [...OW.structs.values()].filter((s) => s.camp).map((s) => ({ id: s.poi.id, name: s.poi.name, y: s.camp!.y, ...s.camp!.stash }));
function loadStruct(poi: Poi) {
  if (OW.structs.has(poi.id)) return;
  const s = poi.type === 'village' ? loadVillageStruct(poi) : poi.type === 'camp' ? loadCampStruct(poi) : poi.type === 'wreck' ? loadWreckStruct(poi) : loadRuinStruct(poi);
  localize(s.group, poi.x, poi.z);
  OW.structs.set(poi.id, s);
  setStreakSources([...OW.structs.values()].map((q) => q.edges));
}
function dropStruct(s: Structure) {
  scene.remove(s.group); s.group.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
  for (const d of s.doors) { scene.remove(d.g); W.doors.splice(W.doors.indexOf(d), 1); }
  for (const st of s.stairs) W.portals.splice(W.portals.indexOf(st), 1);
  for (const n of s.npcs) { scene.remove(n.g); W.npcs.splice(W.npcs.indexOf(n), 1); }
  if (s.village && OW.village === s.village) { OW.village = null; W.villageWalk = []; } // another village may have loaded meanwhile
  if (s.camp) despawnCamp(s.poi.id);
  OW.structs.delete(s.poi.id);
  setStreakSources([...OW.structs.values()].map((q) => q.edges));
}

function updateStructs(x: number, z: number) {
  for (const p of poisNear(OW.terrain!.world, x, z, STRUCT_LOAD)) if (rectDist(p.rect, x, z) < STRUCT_LOAD) loadStruct(p);
  for (const s of [...OW.structs.values()]) if (rectDist(s.poi.rect, x, z) > STRUCT_UNLOAD) dropStruct(s);
}

// ---------- streaming ----------
/** Queue chunks around the player; unload far ones. Cheap unless the player crossed a chunk border. */
export function updateStreaming(budgetMs = 4) {
  const x = G.pos.x, z = G.pos.z, pcx = Math.floor(x / CHUNK), pcz = Math.floor(z / CHUNK), k = pcx + ',' + pcz;
  if (k !== lastChunk) {
    lastChunk = k;
    queue = [];
    for (let i = -LOAD_R; i <= LOAD_R; i++) for (let j = -LOAD_R; j <= LOAD_R; j++) {
      const c = OW.chunks.get(ckey(pcx + i, pcz + j)), lod = lodFor(pcx + i, pcz + j, pcx, pcz);
      if (!c || c.lod !== lod) queue.push([pcx + i, pcz + j, lod]);
    }
    queue.sort((a, b) => Math.hypot(b[0] - pcx, b[1] - pcz) - Math.hypot(a[0] - pcx, a[1] - pcz)); // nearest last (popped first)
    for (const c of [...OW.chunks.values()]) if (Math.max(Math.abs(c.cx - pcx), Math.abs(c.cz - pcz)) > UNLOAD_R) { dropChunk(c); OW.chunks.delete(ckey(c.cx, c.cz)); }
    updateStructs(x, z);
    syncLakes(x, z);
    syncFound(OW.terrain!, x, z);
    syncQuestWorld();
  }
  const t0 = performance.now();
  while (queue.length && (performance.now() - t0 < budgetMs)) {
    const [cx, cz, lod] = queue.pop()!, old = OW.chunks.get(ckey(cx, cz));
    if (old && old.lod === lod) continue;
    OW.chunks.set(ckey(cx, cz), buildChunk(cx, cz, lod)); // swap in the new one first, then drop the old: no gap
    if (old) dropChunk(old);
  }
}

/** Load (or reload) the open world of the current character's seed, synchronously around (x, z). */
export function openWorld(x: number, z: number) {
  const w = G.char.world;
  if (!OW.terrain || OW.terrain.world !== w) OW.terrain = new Terrain(w);
  OW.terrain.setClaims(G.char.claims);
  closeWorld();
  G.water = (px, pz) => (inStructure(px, pz) ? null : OW.terrain!.water(px, pz));
  G.space = space; G.ground = groundAt; G.obstacle = (px, py, pz, r) => treeHit(px, py, pz, r) || vehicleHit(px, py, pz, r) || ambushHit(px, py, pz, r) || baseHit(px, py, pz, r);
  G.floor = baseFloor; G.rayBlock = baseRay; G.solid = baseSolid;
  foeRules.blocked = (p) => nearVillage(p.x, p.z) < 2;
  foeRules.playerSafe = () => inVillage(G.pos.x, G.pos.z);
  foeRules.ground = (px, pz) => OW.terrain!.heightAt(px, pz);
  foeRules.shielded = shielded;
  foeRules.shieldHit = (dmg) => { if (driving.v) damageVehicle(driving.v, dmg); };
  updateStructs(x, z);
  const pcx = Math.floor(x / CHUNK), pcz = Math.floor(z / CHUNK);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) OW.chunks.set(ckey(pcx + i, pcz + j), buildChunk(pcx + i, pcz + j));
  lastChunk = '';
  const T = OW.terrain;
  spawnVehicles({
    height: (px, pz) => T.heightAt(px, pz),
    water: (px, pz) => T.water(px, pz)?.depth ?? 0,
    blocked: (px, pz, r) => poisNear(T.world, px, pz, 40).some((p) => rectDist(p.rect, px, pz) < r) || treeHit(px, T.heightAt(px, pz) + 0.5, pz, r) || ambushHit(px, 0, pz, r),
  });
  syncFound(T, x, z);
  const envHooks = {
    ground: (px: number, pz: number) => T.heightAt(px, pz),
    danger,
    nearRuin: (px: number, pz: number) => poisNear(T.world, px, pz, 90).some((p) => (p.type === 'ruin' || p.type === 'wreck') && rectDist(p.rect, px, pz) < 60),
    forbidden: (px: number, pz: number) => nearVillage(px, pz) < 35 || baseHit(px, T.heightAt(px, pz), pz, 0.7) || (T.water(px, pz)?.depth ?? 0) > 0.5 || [...OW.structs.values()].some((s) => rectDist(s.poi.rect, px, pz) < 1),
  };
  setCreatureEnv(envHooks);
  setRobotEnv(envHooks);
  setBanditEnv(envHooks);
  setRaiderEnv({ terrain: T, danger, forbidden: envHooks.forbidden });
  // camps loaded before the bandit hooks existed get their bandits now
  for (const s of OW.structs.values()) if (s.camp) spawnCamp(s.camp);
}
export function closeWorld() {
  clearVehicles();
  setCreatureEnv(null); clearCreatures();
  setRobotEnv(null); clearRobots();
  setBanditEnv(null); clearBandits();
  setRaiderEnv(null); clearRaiders();
  for (const c of OW.chunks.values()) dropChunk(c);
  OW.chunks.clear();
  for (const s of [...OW.structs.values()]) dropStruct(s);
  clearLakes();
  queue = []; lastChunk = '';
  G.water = null;
  foeRules.blocked = () => false; foeRules.playerSafe = () => false; foeRules.ground = null; foeRules.shielded = () => false; foeRules.shieldHit = () => {};
  G.ground = null; G.obstacle = null; G.floor = null; G.rayBlock = null; G.solid = null;
}
export const structFor = (id: number) => OW.structs.get(id);

// ---------- the round planet ----------
let wallWarnT = 0;
/**
 * Keeps the player on the planet (called every frame outdoors). Walking past the east or west end of the canonical
 * strip moves the player, the vehicles and whatever is near to the matching copy of the world on the other side,
 * so coordinates stay within ±60 km; the land there is identical, so nothing visibly jumps. The poles stop you.
 */
export function keepOnPlanet(dt: number) {
  const lim = POLE_Z - 40;
  wallWarnT -= dt;
  if (Math.abs(G.pos.z) > lim) {
    G.pos.z = Math.sign(G.pos.z) * lim; G.vel.z = 0;
    if (driving.v) { driving.v.st.z = G.pos.z; driving.v.speed = 0; }
    if (wallWarnT <= 0) { wallWarnT = 5; logLine('The ice wall of the pole rises sheer before you. There is no way on.'); }
  }
  const x = G.pos.x;
  if (x >= X_MIN && x < X_MIN + WORLD_W) return;
  const d = x < X_MIN ? WORLD_W : -WORLD_W;
  G.pos.x += d;
  // unsaved foes are simply let go (new ones turn up); loot on the ground moves along
  clearCreatures(); clearBandits(); clearRaiders(); clearRobots();
  for (const t of W.drones) scene.remove(t.g);
  W.drones = [];
  for (const c of W.crystals) { c.p.x += d; c.m.position.x += d; }
  for (const p of W.pickups) { p.p.x += d; p.g.position.x += d; }
  vehiclesNear(G.pos.x);
  for (const c of OW.chunks.values()) dropChunk(c);
  OW.chunks.clear();
  for (const s of [...OW.structs.values()]) dropStruct(s);
  clearLakes();
  queue = []; lastChunk = '';
  const pcx = Math.floor(G.pos.x / CHUNK), pcz = Math.floor(G.pos.z / CHUNK);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) OW.chunks.set(ckey(pcx + i, pcz + j), buildChunk(pcx + i, pcz + j));
  updateStructs(G.pos.x, G.pos.z);
  showToast('You have gone round the world');
}

// ---------- field enemies ----------
/** How dangerous the wilds are here (gen/danger.ts): calm by any village, worse the further out, a bit more near ruins. */
export function danger(x: number, z: number): number {
  const near = poisNear(OW.terrain!.world, x, z, 80).some((p) => p.type === 'ruin' && rectDist(p.rect, x, z) < 50);
  return dangerAt(OW.terrain!.world, x, z, near);
}
export function updateFieldEnemies(dt: number) {
  const pos = G.pos;
  for (let i = W.drones.length - 1; i >= 0; i--) {
    const t = W.drones[i];
    if (t.p.distanceTo(pos) > 95) { scene.remove(t.g); W.drones.splice(i, 1); }
  }
  updateThreat(dt);
}
/** Destroyed field drones (a repair drone's defence drones) are gone for good. */
export function removeDrone(t: Drone) { scene.remove(t.g); const i = W.drones.indexOf(t); if (i >= 0) W.drones.splice(i, 1); }

// ---------- where am I ----------
export function placeName(x: number, z: number): string {
  const v = villageHere(x, z);
  if (v) return v.name + ' (village)';
  if (Math.abs(z) > POLE_Z - 400) return z < 0 ? 'North Pole ice wall' : 'South Pole ice wall';
  if (Math.abs(z) > POLAR_Z) return z < 0 ? 'Northern ice cap' : 'Southern ice cap';
  const lv = Math.round(danger(x, z)), tag = lv ? ` · danger ${lv}` : ' · calm';
  if (G.char.claims.some((c) => claimDist(c, x, z) < CLAIM.r)) return 'Your claim' + tag;
  for (const s of OW.structs.values()) if (s.poi.type !== 'village' && rectDist(s.poi.rect, x, z) < 10) return s.poi.name + tag;
  return 'Wilds' + tag;
}

/** Wells in the loaded chunks (for the E interaction). */
export const loadedWells = (): Well[] => [...OW.chunks.values()].flatMap((c) => c.wells);
