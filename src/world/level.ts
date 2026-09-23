// Loading locations (dungeon sectors, the village) and moving between them.
import * as THREE from 'three';
import { scene, fog, lineMat, add, V, circlePts, fillMat, GRID } from './render';
import { G, W } from '../game';
import { hash, OPP, DIRV, type Dir } from '../core/rng';
import { VoxelGrid } from '../core/voxel';
import { meshVoxels } from '../core/meshing';
import { generateDungeon } from '../gen/dungeon';
import { generateVillage, type VillageMap } from '../gen/village';
import { placeTunnelDoors, tryPlaceDoor, type PlacedDoor } from '../gen/doors';
import { makeDoor, makeStair, arriveVia, signTexture, type Stair } from './doors';
import { makeChest, makeHatch } from './loot';
import { makeDrone, placeDrone, makeBoss } from './enemies';
import { makeNpc } from './npc';
import { sky } from './sky';
import { PropBatch } from './props';
import { setStreakSources } from './fx';
import { gunVM, bladeVM } from './weapons';
import { NPC_INFO, VILLAGER_NAMES } from '../data/npcs';
import { saveChar } from '../character';
import { showToast, logLine, el, renderSheet } from '../ui/hud';
import { buildMini, revealAll } from '../ui/minimap';

let worldGroup: THREE.Group | null = null, decoGroup: THREE.Group | null = null;

/** Voxel mesh: dark fill with grid lines on top. */
export function voxelObject(grid: VoxelGrid, skyY = Infinity) {
  const m = meshVoxels(grid, skyY);
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(m.tri, 3));
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(m.lines, 3));
  const group = new THREE.Group(); group.add(new THREE.Mesh(fg, fillMat()), new THREE.LineSegments(lg, lineMat(GRID)));
  return { group, mesh: m };
}
function buildMesh(skyY = Infinity) {
  if (worldGroup) { scene.remove(worldGroup); worldGroup.traverse((o) => (o as THREE.Mesh).geometry?.dispose()); }
  const { group, mesh } = voxelObject(G.grid, skyY);
  worldGroup = group; scene.add(group);
  setStreakSources([mesh]);
}

function spawnPlayer() {
  const s = G.map!.spawn; G.pos.set(s[0], s[1], s[2]); G.vel.set(0, 0, 0); G.hp = G.S.maxHp; G.yaw = Math.random() * 6.28; G.pitch = 0;
}
function clearLevel() {
  [...W.crystals.map((c) => c.m), ...W.pickups.map((p) => p.g), ...W.chests.map((c) => c.g), ...W.doors.map((d) => d.g), ...W.bosses.map((b) => b.g),
    ...W.orbs.map((o) => o.m), ...W.drones.map((t) => t.g), ...W.npcs.map((n) => n.g)].forEach((o) => scene.remove(o));
  if (W.hatch) scene.remove(W.hatch.g);
  if (decoGroup) { scene.remove(decoGroup); decoGroup = null; }
  W.crystals = []; W.pickups = []; W.doors = []; W.orbs = []; W.chests = []; W.bosses = []; W.drones = []; W.npcs = []; W.portals = [];
  W.hatch = null; W.spawnCells = []; W.arrivalStair = null;
}
function setLocationLook(village: boolean) {
  fog.near = village ? 10 : 3; fog.far = village ? 95 : 46; sky.visible = village;
  gunVM.visible = !village && G.weapon === 0; bladeVM.visible = !village && G.weapon === 1;
  el.route.style.display = village ? 'none' : '';
}

// ---------- dungeon ----------
const sectorLabel = (p: { up: boolean; dir: Dir }) => {
  const o = DIRV[p.dir]; return [G.char.gx + o[0], G.char.gz + o[1]];
};
export function loadDungeon(arriveDir: string | null) {
  const c = G.char;
  const seed = hash(c.world, c.depth, c.gx, c.gz);
  const map = generateDungeon(seed, { surfaceExit: c.depth === 1 && c.gx === 0 && c.gz === 0 }); G.map = map;
  const name = 'Depth ' + c.depth + ', sector ' + c.gx + ', ' + c.gz;
  clearLevel(); setLocationLook(false);
  G.grid = VoxelGrid.fromOps(map.ops); G.space = G.grid;
  buildMesh(); spawnPlayer();
  const placed: PlacedDoor[] = placeTunnelDoors(G.space, map.doorCands);
  placed.forEach((d, i) => W.doors.push(makeDoor(d, i)));
  W.chests = map.chests.map(makeChest).filter((x) => !!x);
  W.hatch = makeHatch(map.hatch);
  for (const p of map.portals) {
    const pd = tryPlaceDoor(G.space, { axis: p.axis, m: p.m, c: p.c, stair: true }, placed)!;
    const [tx, tz] = sectorLabel(p);
    const st = p.key === 'V'
      ? makeStair(p, pd, placed.length - 1, '▲ VILLAGE', 'Stairs up to the village', () => toVillage('gate'))
      : makeStair(p, pd, placed.length - 1, (p.up ? '▲ ' : '▼ ') + 'SECTOR ' + tx + ', ' + tz, 'Stairs ' + (p.up ? 'up' : 'down') + ' to sector ' + tx + ', ' + tz, () => travel(p.dir));
    W.portals.push(st);
  }
  W.bosses = map.bosses.map(makeBoss).filter((x) => !!x);
  if (arriveDir) {
    const p = W.portals.find((q) => q.key === arriveDir);
    if (p) { W.arrivalStair = p; G.pos.copy(p.spawn); G.yaw = p.yawIn; G.pitch = 0; }
  }
  const g = G.grid;
  W.spawnCells = [];
  for (let k = 0; k < g.nz; k++) for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) {
    const x = i + g.ox, y = j + g.oy, z = k + g.oz;
    if (y >= 0 && y <= 2 && g.empty(x, y, z) && g.empty(x, y + 1, z) && g.empty(x, y + 2, z) && !g.empty(x, y - 1, z)) W.spawnCells.push([x, y, z]);
  }
  for (let i = 0; i < map.rooms + 1 + c.depth; i++) { const t = makeDrone(); placeDrone(t); W.drones.push(t); }
  buildMini(); el.hudL.textContent = name; el.seed.value = String(c.world); renderSheet(); saveChar();
}

// ---------- village ----------
function wallSign(text: string, color: string, at: { x: number; z: number }, out: [number, number], y: number) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.6), new THREE.MeshBasicMaterial({ map: signTexture(text, color, 54) }));
  m.position.set(at.x + out[0] * 0.53, y, at.z + out[1] * 0.53); m.rotation.y = Math.atan2(out[0], out[1]); return m;
}
/** Roofs, tree crowns, lamps and the well of a village. */
function villageDeco(map: VillageMap, y0 = 0) {
  const grp = new THREE.Group();
  const props = new PropBatch();
  for (const b of map.buildings) {
    props.gableRoof(b.x, b.z, b.x + b.w, b.z + b.d, y0 + b.h, 2.2, 0x4dff7e);
    if (b.name) grp.add(wallSign(b.name, b.role === 'innkeeper' ? '#ffb347' : '#ffd060', { x: b.door.x, z: b.door.z }, b.out, y0 + 3.5));
  }
  for (const t of map.trees) props.cone(t.x + 0.5, y0 + 2, t.z + 0.5, 1.6, t.h, GRID);
  grp.add(props.build());
  for (const l of map.lamps) {
    const pole = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(l.x, y0, l.z), V(l.x, y0 + 3.2, l.z)]), lineMat(GRID));
    const lamp = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.OctahedronGeometry(0.25)), add(0xffe8a0)); lamp.position.set(l.x, y0 + 3.45, l.z);
    grp.add(pole, lamp);
  }
  const well = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(circlePts(1.4, 16)), lineMat(0x5cc8ff)); well.rotation.x = Math.PI / 2; well.position.set(map.well.x, y0 + 1.02, map.well.z);
  grp.add(well);
  return grp;
}
export function loadVillage(how: 'new' | 'gate' | 'death' | 'recall') {
  const map = generateVillage(G.char.world); G.map = map;
  clearLevel(); setLocationLook(true); sky.position.set(36, 0, 36);
  G.grid = VoxelGrid.fromOps(map.ops); G.space = G.grid;
  buildMesh(7); spawnPlayer(); G.yaw = 0;
  const placed: PlacedDoor[] = [];
  for (const p of map.portals) {
    const pd = tryPlaceDoor(G.space, { axis: p.axis, m: p.m, c: p.c, stair: true }, placed)!;
    W.portals.push(makeStair(p, pd, placed.length - 1, '▼ DUNGEON', 'Stairs down to the dungeon', () => toDungeon()));
  }
  decoGroup = villageDeco(map); scene.add(decoGroup);
  for (const b of map.buildings) if (b.role !== 'house') { const info = NPC_INFO[b.role]; W.npcs.push(makeNpc(b.role, info.name!, V(b.home!.x, b.home!.y, b.home!.z), b)); }
  W.villageWalk = [];
  for (let x = 2; x < 70; x++) for (let z = 2; z < 70; z++) {
    if (map.buildings.some((b) => x >= b.x - 1 && x < b.x + b.w + 1 && z >= b.z - 1 && z < b.z + b.d + 1)) continue;
    if (z < 4 || !G.space.empty(x, 0, z) || !G.space.empty(x, 1, z)) continue; W.villageWalk.push([x, z]);
  }
  VILLAGER_NAMES.slice(0, 6).forEach((nm) => { const c = W.villageWalk[(Math.random() * W.villageWalk.length) | 0]; W.npcs.push(makeNpc('villager', nm, V(c[0] + 0.5, 0, c[1] + 0.5), null)); });
  if (how === 'gate') { const p = W.portals.find((q) => q.key === 'D'); if (p) { W.arrivalStair = p; G.pos.copy(p.spawn); G.yaw = p.yawIn; } }
  else if (how === 'death' || how === 'recall') {
    const t = map.buildings.find((b) => b.role === 'innkeeper')!;
    G.pos.set(t.door.x + t.out[0] * 2, 0, t.door.z + t.out[1] * 2); G.yaw = Math.atan2(t.out[0], t.out[1]);
  }
  buildMini(); revealAll();
  el.hudL.textContent = 'Gridholm (village)'; el.seed.value = String(G.char.world); renderSheet(); saveChar();
}

// ---------- moving between places ----------
export function descend() { G.char.depth++; saveChar(); loadDungeon(null); showToast('Depth ' + G.char.depth); logLine('Drones are tougher down here'); }
export function travel(dir: Dir) {
  G.char.gx += DIRV[dir][0]; G.char.gz += DIRV[dir][1]; saveChar();
  loadDungeon(OPP[dir]); showToast('Sector ' + G.char.gx + ', ' + G.char.gz); arriveVia(W.arrivalStair);
}
export function toVillage(how: 'gate' | 'death' | 'recall') {
  G.char.loc = 'village'; saveChar(); loadVillage(how);
  showToast(how === 'death' ? 'You wake up in the tavern' : 'Gridholm');
  arriveVia(how === 'gate' ? W.arrivalStair : null);
}
export function toDungeon() {
  const c = G.char; c.loc = 'dungeon'; c.depth = 1; c.gx = 0; c.gz = 0; saveChar();
  loadDungeon('V'); showToast('Depth 1'); arriveVia(W.arrivalStair);
}
export const canRecall = () => G.char.loc !== 'village';
/** Current stairwell objects (kept for the minimap). */
export const stairs = (): Stair[] => W.portals;
