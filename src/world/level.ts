// Loading places (dungeon sectors, the open world) and moving between them.
import * as THREE from 'three';
import { scene, fog, lineMat, add, V, circlePts, fillMat, GRID } from './render';
import { G, W } from '../game';
import { hash, OPP, DIRV, type Dir } from '../core/rng';
import { VoxelGrid } from '../core/voxel';
import { meshVoxels, type OutlineStyle } from '../core/meshing';
import { generateDungeon } from '../gen/dungeon';
import { findPoi, allVillages, worldDist, poisNear, GRIDHOLM_ID, CHUNK, type Poi } from '../gen/regions';
import { isDiscovered } from '../save';
import { WALL_TIERS, STONE_TIER, type VillageMap } from '../gen/village';
import { placeTunnelDoors, tryPlaceDoor, type PlacedDoor } from '../gen/doors';
import { makeDoor, makeStair, arriveVia, signTexture } from './doors';
import { makeChest, makeHatch, setCrystalXp } from './loot';
import { placeCrystals, clearCrystals } from './flora';
import { decorateDungeon } from './dungeondeco';
import { generateShip } from '../gen/ship';
import { setRobotEnv, spawnGuards } from './robots';
import { dangerAt } from '../gen/danger';
import { clearFires } from './cooking';
import { clearBenches } from './benches';
import { clearFlags, cancelPlacing } from './claims';
import { clearBases } from './building';
import { clearTurrets } from './turrets';
import { buildCave, leaveCave } from './cavelevel';
import type { Cave } from '../gen/caves';
import { makeDrone, placeDrone, makeBoss, setDroneRespawn } from './enemies';
import { drawCrown } from './trees';
import { sky, horizon, buildHorizon, updateSky, darkSky } from './sky';
import { setStreakSources } from './fx';
import { setArmedRule, refreshWeaponVisibility } from './weapons';
import { raidHere } from './villageraid';
import { PropBatch } from './props';
import { onDungeonLoaded, syncQuestWorld } from './quests';
import { driving, leave } from './vehicles';
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
  closeWorld(); leaveCave(); clearCrystals(); clearFires(); clearBenches(); clearFlags(); cancelPlacing(true); clearBases(); clearTurrets();
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
setArmedRule(() => !driving.v && !G.swimming && !G.fly && (G.char.loc === 'dungeon' || !inVillage(G.pos.x, G.pos.z) || raidHere()));

// ---------- dungeon ----------
const ruinName = (id: number) => findPoi(G.char.world, id)?.name ?? 'Ruins';
export function loadDungeon(arriveDir: string | null) {
  const c = G.char, d = c.dungeon!;
  if (d.cave) { // a cave system: its own kind of place
    buildCave(d, () => { clearLevel(); setLocationLook(false); }, (g) => { worldGroup = g; });
    saveChar(); return;
  }
  const seed = hash(c.world, d.ruinId, d.depth, d.gx, d.gz);
  const wreck = findPoi(c.world, d.ruinId)?.type === 'wreck';
  const map = wreck ? generateShip(seed) : generateDungeon(seed, { surfaceExit: d.depth === 1 && d.gx === 0 && d.gz === 0 });
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
  W.hatch = map.hatch ? makeHatch(map.hatch) : null;
  group.add(decorateDungeon(map));
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
  // a crashed ship is guarded by robots (placed by the generator) and only a few stray drones
  for (let i = 0; i < (wreck ? 2 : map.rooms + 1 + d.depth); i++) { const t = makeDrone(); placeDrone(t); W.drones.push(t); }
  if (wreck) {
    const poi = findPoi(c.world, d.ruinId)!, lv = Math.max(2, dangerAt(c.world, poi.x, poi.z, true));
    setRobotEnv({ ground: () => 0, danger: () => lv, nearRuin: () => false, forbidden: () => false }, { indoor: true });
    spawnGuards(map.guards ?? [], lv);
  }
  onDungeonLoaded(map);
  setMiniMode('voxel'); buildMini();
  el.hudL.textContent = wreck ? ruinName(d.ruinId) : 'Depth ' + d.depth + ', sector ' + d.gx + ', ' + d.gz;
  if (wreck) el.route.style.display = 'none'; // no way further down from a wreck el.seed.value = String(c.world); renderSheet(); saveChar();
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
  if (map.house) homeDeco(props, map.house, y0);
  if (map.tier < STONE_TIER) fenceDeco(props, map, y0);
  else {
  // guard tower lookouts
  for (const t of map.towers) props.lookout(t.x, t.z, t.x + t.w, t.z + t.d, y0 + t.h, GRID);
  // gate arches: chamfer the top corners of each opening, through the whole wall
  for (const g of map.gates) {
    const along = g.dir === 'N' || g.dir === 'S', c = 1, top = y0 + 4, a0 = g.a, a1 = g.a + g.w;
    const P = (a: number, y: number) => (along ? [a, y, g.m] : [g.m, y, a]), v = along ? [0, 0, 1] : [1, 0, 0];
    props.prism([P(a0, top - c), P(a0, top), P(a0 + c, top)], v, GRID);
    props.prism([P(a1, top - c), P(a1, top), P(a1 - c, top)], v, GRID);
  }
  }
  // a spire on the Elder's Hall
  const hall = map.buildings.find((b) => b.role === 'elder');
  if (hall) {
    const cx = hall.x + hall.w / 2, cz = hall.z + hall.d / 2, ry = y0 + hall.h + 2.2;
    props.box(cx - 0.8, ry - 1.2, cz - 0.8, cx + 0.8, ry + 1.4, cz + 0.8, 0x4dff7e);
    props.pyramid(cx - 0.9, cz - 0.9, cx + 0.9, cz + 0.9, ry + 1.4, 5.5, 0x4dff7e);
  }
  grp.add(props.build());
  return lampsAndWell(grp, map, y0);
}
/** The hero's bed (a wooden frame with a headboard, a mattress, a pillow and a blanket) and chest, in their house. */
function homeDeco(pb: PropBatch, h: NonNullable<VillageMap['house']>, y0: number) {
  const WOOD = 0xb8b060, CLOTH = 0x9dffb4, GOLD = 0xffd060, { x0, z0, x1, z1 } = h.bed;
  for (const [x, z] of [[x0, z0], [x1 - 0.12, z0], [x1 - 0.12, z1 - 0.12], [x0, z1 - 0.12]]) pb.box(x, y0, z, x + 0.12, y0 + 0.3, z + 0.12, WOOD);
  pb.box(x0, y0 + 0.3, z0, x1, y0 + 0.42, z1, WOOD);
  pb.box(x0, y0, z0 - 0.06, x1, y0 + 1.0, z0 + 0.06, WOOD); // headboard against the wall
  pb.box(x0 + 0.05, y0 + 0.42, z0 + 0.08, x1 - 0.05, y0 + 0.6, z1 - 0.05, CLOTH);
  pb.box(x0 + 0.2, y0 + 0.6, z0 + 0.15, x1 - 0.2, y0 + 0.72, z0 + 0.55, CLOTH);
  // the blanket over the foot end, folded back once
  const by = y0 + 0.62, bz = z0 + 0.8;
  pb.box(x0 + 0.02, y0 + 0.5, bz, x1 - 0.02, by, z1 - 0.02, WOOD);
  for (let z = bz + 0.3; z < z1 - 0.1; z += 0.3) pb.seg(CLOTH, [x0 + 0.03, by + 0.005, z], [x1 - 0.03, by + 0.005, z]);
  pb.box(x0 + 0.02, by, bz, x1 - 0.02, by + 0.05, bz + 0.25, CLOTH);
  // the chest: a box with a lid, iron bands and a lock plate
  const { x, z } = h.chest, w = 0.5, d = 0.34;
  pb.box(x - w, y0, z - d, x + w, y0 + 0.5, z + d, GOLD);
  pb.box(x - w - 0.03, y0 + 0.5, z - d - 0.03, x + w + 0.03, y0 + 0.66, z + d + 0.03, GOLD);
  for (const bx of [x - w * 0.6, x + w * 0.6]) pb.line(GOLD, [bx, y0, z - d - 0.01], [bx, y0 + 0.67, z - d - 0.04], [bx, y0 + 0.67, z + d + 0.04], [bx, y0, z + d + 0.01]);
  pb.box(x + w + 0.01, y0 + 0.36, z - 0.08, x + w + 0.05, y0 + 0.56, z + 0.08, GOLD);
}
const STAKE = 0xb8b060, SCRAP = 0x8fb89a;
/** A repeatable pseudo-random number for drawing a village's fence (0..1). */
const rnd = (seed: number, i: number) => (hash(seed, i, 0xfe9c) % 10000) / 10000;
/**
 * The wall of a village not yet walled in stone: sharpened stakes of uneven height, some leaning, two rails nailed
 * along the inside, patches of scrap sheet here and there, a gate frame of two posts and a crossbeam at every gate,
 * and watch platforms on stilts in the corners. The collision is the voxel band under it (gen/village.ts).
 */
function fenceDeco(pb: PropBatch, map: VillageMap, y0: number) {
  const H = map.wallH, tall = map.tier > 0;
  let n = 0;
  for (const r of map.fence) {
    const L = Math.hypot(r.x1 - r.x0, r.z1 - r.z0), ux = (r.x1 - r.x0) / L, uz = (r.z1 - r.z0) / L, nx = -uz, nz = ux;
    const P = (a: number, y: number, o = 0) => [r.x0 + ux * a + nx * o, y, r.z0 + uz * a + nz * o];
    // stakes
    const gap = tall ? 0.42 : 0.62, w = tall ? 0.2 : 0.14;
    for (let a = gap / 2; a < L; a += gap) {
      const k = n++, h = H * (0.82 + rnd(map.seed, k) * 0.3), lean = (rnd(map.seed, k + 7e5) - 0.5) * (tall ? 0.15 : 0.4), yb = y0 - 0.1;
      const b = [P(a - w, yb, -w), P(a + w, yb, -w), P(a + w, yb, w), P(a - w, yb, w)];
      const t = b.map(([x, , z]) => [x + nx * lean, y0 + h, z + nz * lean]);
      pb.solid8(b, t, STAKE);
      const tip = [r.x0 + ux * a + nx * lean, y0 + h + (tall ? 0.45 : 0.35), r.z0 + uz * a + nz * lean];
      for (const c of t) pb.seg(STAKE, c, tip);
      pb.face(t[0], t[1], tip); pb.face(t[1], t[2], tip); pb.face(t[2], t[3], tip); pb.face(t[3], t[0], tip);
    }
    // rails on both faces (the inside one a little higher), in lengths of about 6 m that do not quite meet
    for (let a = 0; a < L; a += 6) {
      const e = Math.min(L, a + 6);
      for (const [o, y] of [[0.24, H * 0.72], [0.24, 0.45], [-0.24, H * 0.62]]) {
        const d = 0.07, sag = (rnd(map.seed, n++) - 0.5) * 0.12;
        pb.solid8([P(a + 0.1, y0 + y - d, o - d), P(e - 0.1, y0 + y - d + sag, o - d), P(e - 0.1, y0 + y - d + sag, o + d), P(a + 0.1, y0 + y - d, o + d)],
          [P(a + 0.1, y0 + y + d, o - d), P(e - 0.1, y0 + y + d + sag, o - d), P(e - 0.1, y0 + y + d + sag, o + d), P(a + 0.1, y0 + y + d, o + d)], STAKE);
      }
    }
    // patches of scrap sheet nailed over the outside, a little askew
    for (let a = 2 + rnd(map.seed, n++) * 5; a < L - 2; a += 5 + rnd(map.seed, n++) * 8) {
      const pw = 0.8 + rnd(map.seed, n++) * 1.3, ph = 0.6 + rnd(map.seed, n++) * H * 0.35, py = 0.3 + rnd(map.seed, n++) * (H - ph - 0.5), tilt = (rnd(map.seed, n++) - 0.5) * 0.35, o = 0.3;
      const c = [[-pw / 2, -ph / 2], [pw / 2, -ph / 2], [pw / 2, ph / 2], [-pw / 2, ph / 2]].map(([u, v]) => P(a + u * Math.cos(tilt) - v * Math.sin(tilt), y0 + py + ph / 2 + u * Math.sin(tilt) + v * Math.cos(tilt), o));
      const c2 = c.map(([x, y, z]) => [x + nx * 0.04, y, z + nz * 0.04]);
      pb.solid8(c, c2, SCRAP);
      pb.seg(SCRAP, c[0], c[2]); // a dent across it
    }
  }
  // gate frames: two posts and a crossbeam
  const top = y0 + WALL_TIERS[map.tier].gate;
  for (const g of map.gates) {
    const along = g.dir === 'N' || g.dir === 'S', m = g.m + 0.5;
    const Q = (a: number, y: number, o: number) => (along ? [a, y, m + o] : [m + o, y, a]);
    for (const a of [g.a - 0.2, g.a + g.w + 0.2]) pb.solid8([Q(a - 0.22, y0, -0.22), Q(a + 0.22, y0, -0.22), Q(a + 0.22, y0, 0.22), Q(a - 0.22, y0, 0.22)],
      [Q(a - 0.2, top + 0.4, -0.2), Q(a + 0.2, top + 0.4, -0.2), Q(a + 0.2, top + 0.4, 0.2), Q(a - 0.2, top + 0.4, 0.2)], STAKE);
    const a0 = g.a - 0.9, a1 = g.a + g.w + 0.9;
    pb.solid8([Q(a0, top - 0.25, -0.18), Q(a1, top - 0.2, -0.18), Q(a1, top - 0.2, 0.18), Q(a0, top - 0.25, 0.18)],
      [Q(a0, top + 0.05, -0.18), Q(a1, top + 0.1, -0.18), Q(a1, top + 0.1, 0.18), Q(a0, top + 0.05, 0.18)], STAKE);
  }
  // watch platforms on stilts: four legs, cross braces, a plank floor with a rail, a little roof
  for (const t of map.towers) {
    const x0 = t.x, z0 = t.z, x1 = t.x + t.w, z1 = t.z + t.d, fy = y0 + t.h;
    const legs = [[x0 + 0.2, z0 + 0.2], [x1 - 0.2, z0 + 0.2], [x1 - 0.2, z1 - 0.2], [x0 + 0.2, z1 - 0.2]];
    for (const [x, z] of legs) pb.box(x - 0.13, y0, z - 0.13, x + 0.13, fy, z + 0.13, STAKE);
    for (let i = 0; i < 4; i++) {
      const [ax, az] = legs[i], [bx, bz] = legs[(i + 1) % 4];
      pb.seg(STAKE, [ax, y0 + 0.3, az], [bx, fy - 0.3, bz]); pb.seg(STAKE, [bx, y0 + 0.3, bz], [ax, fy - 0.3, az]);
    }
    pb.box(x0 - 0.3, fy, z0 - 0.3, x1 + 0.3, fy + 0.2, z1 + 0.3, STAKE);
    for (let a = x0; a <= x1 + 0.01; a += 0.6) pb.seg(STAKE, [a, fy + 0.21, z0 - 0.3], [a, fy + 0.21, z1 + 0.3]);
    pb.lookout(x0 - 0.3, z0 - 0.3, x1 + 0.3, z1 + 0.3, fy + 0.2, STAKE);
  }
}
function lampsAndWell(grp: THREE.Group, map: VillageMap, y0: number) {
  for (const l of map.lamps) {
    const pole = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(l.x, y0, l.z), V(l.x, y0 + 3.2, l.z)]), lineMat(GRID));
    const lamp = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.OctahedronGeometry(0.25)), add(0xffe8a0)); lamp.position.set(l.x, y0 + 3.45, l.z); lamp.name = 'lamp';
    grp.add(pole, lamp);
  }
  const well = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(circlePts(1.4, 16)), lineMat(0x5cc8ff)); well.rotation.x = Math.PI / 2; well.position.set(map.well.x, y0 + 1.02, map.well.z);
  grp.add(well);
  return grp;
}

// ---------- the open world ----------
export type Arrival = { kind: 'saved' } | { kind: 'new' } | { kind: 'tavern'; id?: number; bed?: boolean } | { kind: 'ruin'; id: number };
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
    if (a.kind === 'tavern' && a.bed && vm.house) { // by your own bed in Gridholm, facing the door
      G.pos.set(vm.house.bed.side.x, vm.y, vm.house.bed.side.z); G.yaw = -Math.PI / 2;
    } else if (a.kind === 'tavern') {
      const t = vm.buildings.find((b) => b.role === 'innkeeper')!;
      G.pos.set(t.door.x + t.out[0] * 2, vm.y, t.door.z + t.out[1] * 2); G.yaw = Math.atan2(t.out[0], t.out[1]);
    } else { G.pos.set(...vm.spawn); G.yaw = 0; }
  }
  setCrystalXp(() => 3 + 2 * Math.floor(danger(G.pos.x, G.pos.z)));
  setMiniMode('world');
  syncQuestWorld();
  el.seed.value = String(c.world); renderSheet(); saveOverworldPos();
}
/**
 * Developer teleport (the console's world map, ui/devmap.ts): anywhere on the surface. A village puts you outside
 * its tavern, a ruin or a wreck at its entrance; any other point on the ground there (never inside a structure).
 */
export function teleportTo(x: number, z: number, poi?: Poi): string {
  const c = G.char;
  if (G.trans) return 'Busy travelling, try again in a moment.';
  if (driving.v) leave();
  c.loc = 'overworld'; c.dungeon = null;
  if (poi?.type === 'village') loadOverworld({ kind: 'tavern', id: poi.id });
  else if (poi && (poi.type === 'ruin' || poi.type === 'wreck')) loadOverworld({ kind: 'ruin', id: poi.id });
  else {
    // step out of any place's footprint (a camp, or a click on a building)
    for (const p of poisNear(c.world, x, z, 80)) if (x >= p.rect.x0 - 2 && x <= p.rect.x1 + 2 && z >= p.rect.z0 - 2 && z <= p.rect.z1 + 2) z = p.rect.z1 + 5;
    c.ow = { x, y: -1e4, z, yaw: G.yaw };
    loadOverworld({ kind: 'saved' });
  }
  saveChar();
  return 'Teleported to ' + (poi ? poi.name : `${Math.round(x)}, ${Math.round(z)}`) + '.';
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
/** Into a cave system by one of its mouths (world/caves.ts): the mouths are remembered, so either can be the way out. */
export function enterCave(cv: Cave) {
  const c = G.char, self = { x: cv.x, z: cv.z, face: cv.face };
  const mouths = cv.other ? (cv.mouth === 0 ? [self, cv.other] : [cv.other, self]) : [self];
  c.loc = 'dungeon'; c.dungeon = { ruinId: cv.sys, depth: 1, gx: 0, gz: 0, cave: { name: cv.name, mouths, from: cv.other ? cv.mouth : 0 } }; saveChar();
  loadDungeon(null); showToast(cv.name); logLine(cv.other ? 'The cave runs deep into the mountain. They say it comes out on the far side.' : 'Your steps echo in the dark.');
}
/** Out of a cave system by way out i: in front of that mouth, facing out. */
export function exitCave(i: number) {
  const c = G.char, info = c.dungeon!.cave!, m = info.mouths[Math.min(i, info.mouths.length - 1)];
  c.loc = 'overworld'; c.dungeon = null;
  const fx = Math.cos(m.face), fz = Math.sin(m.face);
  c.ow = { x: m.x + fx * 3.5, y: -1e4, z: m.z + fz * 3.5, yaw: Math.atan2(-fx, -fz) }; saveChar();
  loadOverworld({ kind: 'saved' }); showToast(info.name);
  if (info.mouths.length > 1 && i !== info.from) logLine('You come out on the far side of the mountain.');
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
  const from = c.loc === 'dungeon' && c.dungeon ? c.dungeon.cave?.mouths[0] ?? findPoi(c.world, c.dungeon.ruinId) ?? { x: 0, z: 0 } : { x: G.pos.x, z: G.pos.z };
  const known = allVillages(c.world).filter((v) => v.id === GRIDHOLM_ID || isDiscovered(c.discovered, Math.floor(v.x / CHUNK), Math.floor(v.z / CHUNK)));
  const v = id !== undefined ? findPoi(c.world, id) ?? known[0] : known.reduce((a, b) => (worldDist(b.x, b.z, from.x, from.z) < worldDist(a.x, a.z, from.x, from.z) ? b : a));
  c.loc = 'overworld'; c.dungeon = null; saveChar();
  // Gridholm is home: you wake up in your own bed there, anywhere else in the tavern
  const bed = v.id === GRIDHOLM_ID;
  loadOverworld({ kind: 'tavern', id: v.id, bed }); G.hp = G.S.maxHp;
  if (how === 'death') { c.kcal = Math.max(c.kcal, 1500); c.water = Math.max(c.water, 50); } // the innkeeper (or a neighbour) fed you
  showToast(how === 'death' ? (bed ? 'You wake up in your own bed' : 'You wake up in the tavern of ' + v.name) : bed ? 'Home' : v.name);
  arriveVia(null);
}
export const canRecall = () => G.char.loc === 'dungeon' || !inVillage(G.pos.x, G.pos.z);
