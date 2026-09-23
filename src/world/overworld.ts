// The open world: terrain streamed in 32 m chunks around the player, voxel structures (the village, ruins)
// standing on it, forests, roads, and light field enemies. Generation is deterministic; this module only
// decides what is loaded and turns generator output into meshes.
import * as THREE from 'three';
import { scene, V, GRID } from './render';
import { G, W } from '../game';
import { VoxelGrid, type Space } from '../core/voxel';
import { Terrain, inRect, rectDist, STEP, CELLS, VERTS } from '../gen/terrain';
import { CHUNK, poisNear, VILLAGE_RECT, type Poi } from '../gen/regions';
import { chunkTrees, type Tree } from '../gen/trees';
import { generateVillage, type VillageMap } from '../gen/village';
import { generateRuin } from '../gen/ruins';
import { tryPlaceDoor } from '../gen/doors';
import { PropBatch, sharedFill, sharedLine } from './props';
import { makeStair, type Door, type Stair } from './doors';
import { makeNpc, type Npc } from './npc';
import { makeDrone, foeRules, type Drone } from './enemies';
import { setStreakSources, type EdgeSource } from './fx';
import { voxelObject, villageDeco, wallSign } from './level';
import { NPC_INFO, VILLAGER_NAMES } from '../data/npcs';
import { DIRV } from '../core/rng';

export const LOAD_R = 4, UNLOAD_R = 6, STRUCT_LOAD = 170, STRUCT_UNLOAD = 240;
const ROAD_COLOR = 0xc8ffd8, TILE_COLOR = 0x4dff7e;

interface Chunk { cx: number; cz: number; group: THREE.Group; trees: Tree[] }
interface Structure {
  poi: Poi; grid: VoxelGrid; group: THREE.Group; edges: EdgeSource;
  doors: Door[]; stairs: Stair[]; npcs: Npc[]; village?: VillageMap;
}

export const OW = {
  terrain: null as Terrain | null,
  chunks: new Map<number, Chunk>(),
  structs: new Map<number, Structure>(),
  village: null as VillageMap | null,
};
const ckey = (cx: number, cz: number) => (cx + 32768) * 65536 + (cz + 32768);
let queue: [number, number][] = [], lastChunk = '';

// ---------- collision ----------
/** Voxel structures on top of open air. Each cell belongs to the structure whose footprint covers it. */
export const space: Space = {
  empty(x, y, z) { for (const s of OW.structs.values()) if (s.grid.covers(x, z)) return s.grid.empty(x, y, z); return true; },
  setCell(x, y, z, v) { for (const s of OW.structs.values()) if (s.grid.covers(x, z)) { s.grid.setCell(x, y, z, v); return; } },
};
/** Terrain height, except inside a loaded structure's footprint, where its voxel floor (and shafts) rule. */
export function groundAt(x: number, z: number): number {
  const fx = Math.floor(x), fz = Math.floor(z);
  for (const s of OW.structs.values()) if (s.grid.covers(fx, fz)) return -Infinity;
  return OW.terrain!.heightAt(x, z);
}
/** Tree trunks: vertical cylinders 0.35 m wide, 2 m tall above their base. */
export function treeHit(x: number, y: number, z: number, r: number): boolean {
  const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const c = OW.chunks.get(ckey(cx + i, cz + j)); if (!c) continue;
    for (const t of c.trees) if (Math.hypot(t.x - x, t.z - z) < 0.35 + r && y < t.y + 2 + t.h * 0.3) return true;
  }
  return false;
}
export const inVillage = (x: number, z: number) => inRect(VILLAGE_RECT, x, z);

// ---------- terrain chunks ----------
function buildChunk(cx: number, cz: number): Chunk {
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
  for (let j = 0; j <= CELLS; j++) for (let i = 0; i < CELLS; i++) {
    const ax = x0 + i * STEP, z = z0 + j * STEP;
    if (j < CELLS && !hole(ax, z, ax + STEP, z)) lines.push(ax, H(i, j), z, ax + STEP, H(i + 1, j), z);
  }
  for (let i = 0; i < CELLS; i++) for (let j = 0; j < CELLS; j++) {
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
  group.add(new THREE.Mesh(fg, sharedFill()), new THREE.LineSegments(lg, sharedLine(GRID)));
  if (road.length) { const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(road, 3)); group.add(new THREE.LineSegments(rg, sharedLine(ROAD_COLOR))); }
  const trees = chunkTrees(T, cx, cz);
  if (trees.length) {
    const pb = new PropBatch();
    for (const t of trees) { pb.box(t.x - 0.3, t.y - 0.5, t.z - 0.3, t.x + 0.3, t.y + 2, t.z + 0.3, GRID); pb.cone(t.x, t.y + 2, t.z, t.r, t.h, GRID); }
    group.add(pb.build());
  }
  scene.add(group);
  return { cx, cz, group, trees };
}
function dropChunk(c: Chunk) {
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
function loadVillageStruct(poi: Poi): Structure {
  const T = OW.terrain!, y = T.padY(poi), vm = generateVillage(T.world, y);
  const grid = VoxelGrid.surface(vm.ops, vm.rect, y);
  const { group, mesh } = voxelObject(grid);
  group.add(villageDeco(vm, y), gateSign(vm));
  scene.add(group);
  const npcs: Npc[] = [];
  for (const b of vm.buildings) if (b.role !== 'house') npcs.push(makeNpc(b.role, NPC_INFO[b.role].name!, V(b.home!.x, b.home!.y, b.home!.z), b));
  VILLAGER_NAMES.slice(0, 6).forEach((nm) => { const c = vm.walk[(Math.random() * vm.walk.length) | 0]; npcs.push(makeNpc('villager', nm, V(c[0] + 0.5, y, c[1] + 0.5), null)); });
  W.npcs.push(...npcs); W.villageWalk = vm.walk;
  OW.village = vm;
  return { poi, grid, group, edges: mesh, doors: [], stairs: [], npcs, village: vm };
}
export let enterRuin: (id: number) => void = () => {};
export function setEnterRuin(f: (id: number) => void) { enterRuin = f; }
function loadRuinStruct(poi: Poi): Structure {
  const T = OW.terrain!, y = T.padY(poi), rm = generateRuin(T.world, poi, y);
  const grid = VoxelGrid.surface(rm.ops, rm.rect, y);
  const { group, mesh } = voxelObject(grid);
  // fragments of the old paving
  const tl: number[] = [];
  for (const t of rm.tiles) {
    const a = 0.12, b = 0.88, yy = y + 0.03;
    tl.push(t.x + a, yy, t.z + a, t.x + b, yy, t.z + a, t.x + b, yy, t.z + a, t.x + b, yy, t.z + b, t.x + b, yy, t.z + b, t.x + a, yy, t.z + b, t.x + a, yy, t.z + b, t.x + a, yy, t.z + a);
  }
  const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(tl, 3));
  group.add(new THREE.LineSegments(tg, sharedLine(TILE_COLOR)));
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
function loadStruct(poi: Poi) {
  if (OW.structs.has(poi.id)) return;
  const s = poi.type === 'village' ? loadVillageStruct(poi) : loadRuinStruct(poi);
  OW.structs.set(poi.id, s);
  setStreakSources([...OW.structs.values()].map((q) => q.edges));
}
function dropStruct(s: Structure) {
  scene.remove(s.group); s.group.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
  for (const d of s.doors) { scene.remove(d.g); W.doors.splice(W.doors.indexOf(d), 1); }
  for (const st of s.stairs) W.portals.splice(W.portals.indexOf(st), 1);
  for (const n of s.npcs) { scene.remove(n.g); W.npcs.splice(W.npcs.indexOf(n), 1); }
  if (s.village) { OW.village = null; W.villageWalk = []; }
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
    for (let i = -LOAD_R; i <= LOAD_R; i++) for (let j = -LOAD_R; j <= LOAD_R; j++) if (!OW.chunks.has(ckey(pcx + i, pcz + j))) queue.push([pcx + i, pcz + j]);
    queue.sort((a, b) => Math.hypot(b[0] - pcx, b[1] - pcz) - Math.hypot(a[0] - pcx, a[1] - pcz)); // nearest last (popped first)
    for (const c of [...OW.chunks.values()]) if (Math.max(Math.abs(c.cx - pcx), Math.abs(c.cz - pcz)) > UNLOAD_R) { dropChunk(c); OW.chunks.delete(ckey(c.cx, c.cz)); }
    updateStructs(x, z);
  }
  const t0 = performance.now();
  while (queue.length && (performance.now() - t0 < budgetMs)) {
    const [cx, cz] = queue.pop()!;
    if (!OW.chunks.has(ckey(cx, cz))) OW.chunks.set(ckey(cx, cz), buildChunk(cx, cz));
  }
}

/** Load (or reload) the open world of the current character's seed, synchronously around (x, z). */
export function openWorld(x: number, z: number) {
  const w = G.char.world;
  if (!OW.terrain || OW.terrain.world !== w) OW.terrain = new Terrain(w);
  closeWorld();
  G.space = space; G.ground = groundAt; G.obstacle = treeHit;
  foeRules.blocked = (p) => rectDist(VILLAGE_RECT, p.x, p.z) < 2;
  foeRules.playerSafe = () => inVillage(G.pos.x, G.pos.z);
  foeRules.ground = (px, pz) => OW.terrain!.heightAt(px, pz);
  updateStructs(x, z);
  const pcx = Math.floor(x / CHUNK), pcz = Math.floor(z / CHUNK);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) OW.chunks.set(ckey(pcx + i, pcz + j), buildChunk(pcx + i, pcz + j));
  lastChunk = '';
}
export function closeWorld() {
  for (const c of OW.chunks.values()) dropChunk(c);
  OW.chunks.clear();
  for (const s of [...OW.structs.values()]) dropStruct(s);
  queue = []; lastChunk = '';
  foeRules.blocked = () => false; foeRules.playerSafe = () => false; foeRules.ground = null;
  G.ground = null; G.obstacle = null;
}
export const structFor = (id: number) => OW.structs.get(id);

// ---------- field enemies ----------
let spawnT = 1;
/** How dangerous the fields are here: grows slowly with distance from the start, a little more near ruins. */
export function danger(x: number, z: number): number {
  const near = poisNear(OW.terrain!.world, x, z, 80).some((p) => p.type === 'ruin' && rectDist(p.rect, x, z) < 50);
  return Math.hypot(x, z) / 250 + (near ? 0.6 : 0);
}
export function updateFieldEnemies(dt: number) {
  const pos = G.pos, T = OW.terrain!;
  for (let i = W.drones.length - 1; i >= 0; i--) {
    const t = W.drones[i];
    if (t.p.distanceTo(pos) > 95) { scene.remove(t.g); W.drones.splice(i, 1); }
  }
  if ((spawnT -= dt) > 0) return;
  spawnT = 2.5;
  if (inVillage(pos.x, pos.z) || rectDist(VILLAGE_RECT, pos.x, pos.z) < 25) return;
  const dg = danger(pos.x, pos.z), cap = Math.min(5, 1 + Math.floor(dg * 1.5));
  if (W.drones.length >= cap || Math.random() > 0.45) return;
  const fwx = -Math.sin(G.yaw), fwz = -Math.cos(G.yaw);
  for (let tries = 0; tries < 12; tries++) {
    // behind the player, out of sight
    const a = Math.atan2(-fwx, -fwz) + (Math.random() - 0.5) * 2.4, d = 35 + Math.random() * 20;
    const x = pos.x + Math.sin(a) * d, z = pos.z + Math.cos(a) * d;
    if (rectDist(VILLAGE_RECT, x, z) < 30) continue;
    if ([...OW.structs.values()].some((s) => rectDist(s.poi.rect, x, z) < 3)) continue;
    if ((x - pos.x) * fwx + (z - pos.z) * fwz > d * Math.cos(1.0)) continue;
    const t: Drone = makeDrone();
    const lv = danger(x, z);
    t.p.set(x, T.heightAt(x, z) + 1.8, z);
    t.hp = 1 + Math.floor(lv * 0.7);
    t.scout = { speed: 2.2 + 0.3 * Math.min(lv, 3), dps: 6 + 3 * Math.min(lv, 4), detect: 9 + 2 * Math.min(lv, 3), lose: 22 };
    t.g.scale.setScalar(0.8);
    W.drones.push(t);
    return;
  }
}
/** Destroyed field drones are gone for good (new ones spawn over time). */
export function removeDrone(t: Drone) { scene.remove(t.g); const i = W.drones.indexOf(t); if (i >= 0) W.drones.splice(i, 1); }

// ---------- where am I ----------
export function placeName(x: number, z: number): string {
  if (inVillage(x, z)) return 'Gridholm (village)';
  for (const s of OW.structs.values()) if (s.poi.type === 'ruin' && rectDist(s.poi.rect, x, z) < 10) return s.poi.name;
  return 'Wilds';
}
