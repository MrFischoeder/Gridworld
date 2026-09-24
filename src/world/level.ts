// Loading places (dungeon sectors, the open world) and moving between them.
import * as THREE from 'three';
import { scene, fog, lineMat, add, V, circlePts, fillMat, GRID } from './render';
import { G, W } from '../game';
import { hash, OPP, DIRV, type Dir } from '../core/rng';
import { VoxelGrid } from '../core/voxel';
import { meshVoxels, type OutlineStyle } from '../core/meshing';
import { generateDungeon } from '../gen/dungeon';
import { findPoi, allVillages, worldDist, GRIDHOLM_ID, CHUNK } from '../gen/regions';
import { isDiscovered } from '../save';
import type { VillageMap } from '../gen/village';
import { placeTunnelDoors, tryPlaceDoor, type PlacedDoor } from '../gen/doors';
import { makeDoor, makeStair, arriveVia, signTexture } from './doors';
import { makeChest, makeHatch, setCrystalXp } from './loot';
import { placeCrystals, clearCrystals } from './flora';
import { clearFires } from './cooking';
import { makeDrone, placeDrone, makeBoss, setDroneRespawn } from './enemies';
import { drawCrown } from './trees';
import { sky, horizon, buildHorizon, updateSky, darkSky } from './sky';
import { setStreakSources } from './fx';
import { setArmedRule, refreshWeaponVisibility } from './weapons';
import { PropBatch } from './props';
import { onDungeonLoaded, syncQuestWorld } from './quests';
import { driving } from './vehicles';
import { openWorld, closeWorld, structFor, setEnterRuin, removeDrone, danger, inVillage, OW } from './overworld';
import { saveChar, depth } from '../character';
import { showToast, logLine, el, renderSheet } from '../ui/hud';
import { buildMini, setMiniMode } from '../ui/minimap';

let worldGroup: THREE.Group | null = null;

/** Voxel mesh: dark fill with grid lines on top. */
export function voxelObject(grid: VoxelGrid, skyY = Infinity, outline?: OutlineStyle) {
  const m = meshVoxels(grid, skyY, outline);
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(m.tri, 3));
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(m.lines, 3));
  const group = new THREE.Group(); group.add(new THREE.Mesh(fg, fillMat()), new THREE.LineSegments(lg, lineMat(GRID)));
  return { group, mesh: m };
}

/** Removes every entity of the current place (the open world also unloads its chunks and structures). */
function clearLevel() {
  closeWorld(); clearCrystals(); clearFires();
  if (worldGroup) { scene.remove(worldGroup); worldGroup.traverse((o) => (o as THREE.Mesh).geometry?.dispose()); worldGroup = null; }
  [...W.crystals.map((c) => c.m), ...W.pickups.map((p) => p.g), ...W.chests.map((c) => c.g), ...W.doors.map((d) => d.g), ...W.bosses.map((b) => b.g),
    ...W.orbs.map((o) => o.m), ...W.drones.map((t) => t.g), ...W.npcs.map((n) => n.g)].forEach((o) => scene.remove(o));
  if (W.hatch) scene.remove(W.hatch.g);
  W.crystals = []; W.pickups = []; W.doors = []; W.orbs = []; W.chests = []; W.bosses = []; W.drones = []; W.npcs = []; W.portals = [];
  W.hatch = null; W.spawnCells = []; W.arrivalStair = null; W.villageWalk = []; W.nearNpc = null; W.talkNpc = null;
  G.map = null;
}
function setLocationLook(outdoors: boolean) {
  fog.near = outdoors ? 20 : 3; fog.far = outdoors ? 140 : 46; sky.visible = outdoors; horizon.visible = outdoors;
  if (outdoors) { buildHorizon(G.char.world); updateSky(G.char.time); } else darkSky();
  el.route.style.display = outdoors ? 'none' : '';
  refreshWeaponVisibility();
}
/** Weapons are holstered inside the village walls and drawn everywhere else. */
setArmedRule(() => !driving.v && !G.swimming && (G.char.loc === 'dungeon' || !inVillage(G.pos.x, G.pos.z)));

// ---------- dungeon ----------
const ruinName = (id: number) => findPoi(G.char.world, id)?.name ?? 'Ruins';
export function loadDungeon(arriveDir: string | null) {
  const c = G.char, d = c.dungeon!;
  const seed = hash(c.world, d.ruinId, d.depth, d.gx, d.gz);
  const map = generateDungeon(seed, { surfaceExit: d.depth === 1 && d.gx === 0 && d.gz === 0 });
  clearLevel(); G.map = map;
  setLocationLook(false);
  setDroneRespawn(placeDrone); setCrystalXp(() => 5 * depth());
  G.grid = VoxelGrid.fromOps(map.ops); G.space = G.grid;
  const { group, mesh } = voxelObject(G.grid); worldGroup = group; scene.add(group); setStreakSources([mesh]);
  G.pos.set(...map.spawn); G.vel.set(0, 0, 0); G.hp = G.S.maxHp; G.yaw = Math.random() * 6.28; G.pitch = 0;
  const placed: PlacedDoor[] = placeTunnelDoors(G.space, map.doorCands);
  placed.forEach((pd, i) => W.doors.push(makeDoor(pd, i)));
  W.chests = map.chests.map(makeChest).filter((x) => !!x);
  placeCrystals(map.crystals);
  W.hatch = makeHatch(map.hatch);
  for (const p of map.portals) {
    const pd = tryPlaceDoor(G.space, { axis: p.axis, m: p.m, c: p.c, stair: true }, placed)!;
    const o = DIRV[p.dir], tx = d.gx + o[0], tz = d.gz + o[1];
    const name = ruinName(d.ruinId);
    W.portals.push(p.key === 'V'
      ? makeStair(p, pd, placed.length - 1, '▲ ' + name.toUpperCase(), 'Stairs up to the ' + name, exitToRuin)
      : makeStair(p, pd, placed.length - 1, (p.up ? '▲ ' : '▼ ') + 'SECTOR ' + tx + ', ' + tz, 'Stairs ' + (p.up ? 'up' : 'down') + ' to sector ' + tx + ', ' + tz, () => travel(p.dir)));
  }
  W.bosses = map.bosses.map(makeBoss).filter((x) => !!x);
  if (arriveDir) {
    const p = W.portals.find((q) => q.key === arriveDir);
    if (p) { W.arrivalStair = p; G.pos.copy(p.spawn); G.yaw = p.yawIn; G.pitch = 0; }
  }
  const g = G.grid;
  for (let k = 0; k < g.nz; k++) for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) {
    const x = i + g.ox, y = j + g.oy, z = k + g.oz;
    if (y >= 0 && y <= 2 && g.empty(x, y, z) && g.empty(x, y + 1, z) && g.empty(x, y + 2, z) && !g.empty(x, y - 1, z)) W.spawnCells.push([x, y, z]);
  }
  for (let i = 0; i < map.rooms + 1 + d.depth; i++) { const t = makeDrone(); placeDrone(t); W.drones.push(t); }
  onDungeonLoaded(map);
  setMiniMode('voxel'); buildMini();
  el.hudL.textContent = 'Depth ' + d.depth + ', sector ' + d.gx + ', ' + d.gz; el.seed.value = String(c.world); renderSheet(); saveChar();
}

// ---------- village decoration ----------
export function wallSign(text: string, color: string, at: { x: number; z: number }, out: [number, number], y: number) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.6), new THREE.MeshBasicMaterial({ map: signTexture(text, color, 54) }));
  m.position.set(at.x + out[0] * 0.53, y, at.z + out[1] * 0.53); m.rotation.y = Math.atan2(out[0], out[1]); return m;
}
/** Roofs, tree crowns, lamps and the well of a village standing at height y0. */
export function villageDeco(map: VillageMap, y0 = 0) {
  const grp = new THREE.Group();
  const props = new PropBatch();
  for (const b of map.buildings) {
    props.gableRoof(b.x, b.z, b.x + b.w, b.z + b.d, y0 + b.h, 2.2, 0x4dff7e);
    if (b.name) grp.add(wallSign(b.name, b.role === 'innkeeper' ? '#ffb347' : '#ffd060', { x: b.door.x, z: b.door.z }, b.out, y0 + 3.5));
  }
  for (const t of map.trees) drawCrown(props, t.x + 0.5, y0 + 2, t.z + 0.5, 1.8, t.h, hash(t.x, t.z, 0x7e3e));
  // guard tower lookouts
  for (const t of map.towers) props.lookout(t.x, t.z, t.x + t.w, t.z + t.d, y0 + t.h, GRID);
  // gate arches: chamfer the top corners of each opening, through the whole wall
  for (const g of map.gates) {
    const along = g.dir === 'N' || g.dir === 'S', c = 1, top = y0 + 4, a0 = g.a, a1 = g.a + g.w;
    const P = (a: number, y: number) => (along ? [a, y, g.m] : [g.m, y, a]), v = along ? [0, 0, 1] : [1, 0, 0];
    props.prism([P(a0, top - c), P(a0, top), P(a0 + c, top)], v, GRID);
    props.prism([P(a1, top - c), P(a1, top), P(a1 - c, top)], v, GRID);
  }
  // a spire on the Elder's Hall
  const hall = map.buildings.find((b) => b.role === 'elder');
  if (hall) {
    const cx = hall.x + hall.w / 2, cz = hall.z + hall.d / 2, ry = y0 + hall.h + 2.2;
    props.box(cx - 0.8, ry - 1.2, cz - 0.8, cx + 0.8, ry + 1.4, cz + 0.8, 0x4dff7e);
    props.pyramid(cx - 0.9, cz - 0.9, cx + 0.9, cz + 0.9, ry + 1.4, 5.5, 0x4dff7e);
  }
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

// ---------- the open world ----------
export type Arrival = { kind: 'saved' } | { kind: 'new' } | { kind: 'tavern'; id?: number } | { kind: 'ruin'; id: number };
export function loadOverworld(a: Arrival) {
  const c = G.char;
  clearLevel(); setLocationLook(true);
  setDroneRespawn(removeDrone);
  G.vel.set(0, 0, 0); G.hp = Math.max(G.hp, 1); G.pitch = 0;
  // Where to stand. The village and ruins sit on fixed spots, so positions are known before loading.
  let x = 0, z = 12, yaw = 0;
  if (a.kind === 'saved' && c.ow) { x = c.ow.x; z = c.ow.z; yaw = c.ow.yaw; }
  if (a.kind === 'ruin') { const p = findPoi(c.world, a.id); if (p) { x = p.x; z = p.z; } }
  if (a.kind === 'tavern' && a.id !== undefined) { const p = findPoi(c.world, a.id); if (p) { x = p.x; z = p.z + 12; } }
  G.pos.set(x, G.pos.y, z); // vehicles are placed on the copy of the world nearest to the player
  openWorld(x, z);
  if (a.kind === 'ruin') {
    const st = structFor(a.id)?.stairs[0];
    if (st) { W.arrivalStair = st; G.pos.copy(st.spawn); G.yaw = st.yawIn; }
  } else if (a.kind === 'saved' && c.ow) {
    G.pos.set(c.ow.x, c.ow.y, c.ow.z); G.yaw = yaw;
    if (G.ground) G.pos.y = Math.max(G.pos.y, G.ground(G.pos.x, G.pos.z));
  } else {
    const vm = OW.village!;
    if (a.kind === 'tavern') {
      const t = vm.buildings.find((b) => b.role === 'innkeeper')!;
      G.pos.set(t.door.x + t.out[0] * 2, vm.y, t.door.z + t.out[1] * 2); G.yaw = Math.atan2(t.out[0], t.out[1]);
    } else { G.pos.set(...vm.spawn); G.yaw = 0; }
  }
  setCrystalXp(() => 3 + 2 * Math.floor(danger(G.pos.x, G.pos.z)));
  setMiniMode('world');
  syncQuestWorld();
  el.seed.value = String(c.world); renderSheet(); saveOverworldPos();
}
export function saveOverworldPos() {
  if (G.char.loc !== 'overworld') return;
  G.char.ow = { x: +G.pos.x.toFixed(2), y: +G.pos.y.toFixed(2), z: +G.pos.z.toFixed(2), yaw: +G.yaw.toFixed(3) };
  saveChar();
}

// ---------- moving between places ----------
export function descend() { G.char.dungeon!.depth++; saveChar(); loadDungeon(null); showToast('Depth ' + depth()); logLine('Drones are tougher down here'); }
export function travel(dir: Dir) {
  const d = G.char.dungeon!;
  d.gx += DIRV[dir][0]; d.gz += DIRV[dir][1]; saveChar();
  loadDungeon(OPP[dir]); showToast('Sector ' + d.gx + ', ' + d.gz); arriveVia(W.arrivalStair);
}
export function enterDungeon(ruinId: number) {
  const c = G.char;
  c.loc = 'dungeon'; c.dungeon = { ruinId, depth: 1, gx: 0, gz: 0 }; saveChar();
  loadDungeon('V'); showToast(ruinName(ruinId)); logLine('Depth 1'); arriveVia(W.arrivalStair);
}
setEnterRuin(enterDungeon);
export function exitToRuin() {
  const c = G.char, id = c.dungeon!.ruinId;
  c.loc = 'overworld'; c.dungeon = null; saveChar();
  loadOverworld({ kind: 'ruin', id }); showToast(ruinName(id)); arriveVia(W.arrivalStair);
}
/**
 * Where a beacon or a bad day takes you: the nearest village you have been to (its tavern), else Gridholm.
 * `id` picks a village directly (the console's `home` goes to Gridholm).
 */
export function toVillage(how: 'death' | 'recall', id?: number) {
  const c = G.char;
  const from = c.loc === 'dungeon' && c.dungeon ? findPoi(c.world, c.dungeon.ruinId) ?? { x: 0, z: 0 } : { x: G.pos.x, z: G.pos.z };
  const known = allVillages(c.world).filter((v) => v.id === GRIDHOLM_ID || isDiscovered(c.discovered, Math.floor(v.x / CHUNK), Math.floor(v.z / CHUNK)));
  const v = id !== undefined ? findPoi(c.world, id) ?? known[0] : known.reduce((a, b) => (worldDist(b.x, b.z, from.x, from.z) < worldDist(a.x, a.z, from.x, from.z) ? b : a));
  c.loc = 'overworld'; c.dungeon = null; saveChar();
  loadOverworld({ kind: 'tavern', id: v.id }); G.hp = G.S.maxHp;
  if (how === 'death') { c.kcal = Math.max(c.kcal, 1500); c.water = Math.max(c.water, 50); } // the innkeeper fed you
  showToast(how === 'death' ? 'You wake up in the tavern of ' + v.name : v.name);
  arriveVia(null);
}
export const canRecall = () => G.char.loc === 'dungeon' || !inVillage(G.pos.x, G.pos.z);
