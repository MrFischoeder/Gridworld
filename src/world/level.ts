// Loading places (dungeon sectors, the open world) and moving between them.
import { progressive, projectDone } from '../gen/settlement';
import { drawClosedChest } from './chestmodel';
import { riding, getOff } from './ride';
import { SHIP_NAME } from './lander';
import * as THREE from 'three';
import { crashSpawn } from './crashpod';
import { rivalStart } from './rivals';
import { placeCarrier, dropCarrier } from './datacarriers';
import { landingSite } from '../gen/landing';
import { Terrain } from '../gen/terrain';
import { scene, fog, lineMat, add, V, fillMat, GRID } from './render';
import { dungeonTurrets, labyrinthTurrets } from '../gen/mountedturrets';
import { populate, guardAlive } from './dungeonfoes';
import { labyrinthDrones } from '../gen/repopulate';
import { labyrinthGuards } from '../gen/dungeonguards';
import { metroCity, metroId, generateMetro } from '../gen/metro';
import { drawMetro } from './metro';
import { stepFloor } from '../core/steps';
import { expandDungeon } from '../gen/mapfile';
import { customDungeon, customId, editorDungeonAt } from './custommaps';
import { setPlaceLight, fixtureModel, torchModel, postLantern } from './light';
import { dungeonLamps, underAmb, villageLanterns } from '../gen/darkness';
import { MOUNTED_TURRET } from '../data/mountedturrets';
import { setRobotEnv, spawnGuards, clearRobots } from './robots';
import { spawnAuthority } from './remote';
import { dangerAt } from '../gen/danger';
import { clearMountedTurrets, loadMountedTurrets, mountedTurretHit } from './mountedturrets';
import { cityEntrance, cityEntrances, dungeonSeed, entranceFront } from '../gen/citydungeons';
import { citySites, type CitySite } from '../gen/cities';
import { G, W } from '../game';
import { hash, OPP, DIRV, type Dir } from '../core/rng';
import { VoxelGrid } from '../core/voxel';
import { meshVoxels, type OutlineStyle } from '../core/meshing';
import { generateDungeon, MAX_DUNGEON_DEPTH } from '../gen/dungeon';
import { myHome } from '../gen/homes';
import { findPoi, allVillages, worldDist, nearX, poisNear, GRIDHOLM_ID, CHUNK, type Poi } from '../gen/regions';
import { isDiscovered } from '../save';
import { WALL_TIERS, STONE_TIER, HOUSE, WALK, type VillageMap } from '../gen/village';
import { placeTunnelDoors, tryPlaceDoor, type PlacedDoor } from '../gen/doors';
import { makeDoor, makeStair, disposeStair, arriveVia, signTexture } from './doors';
import { makeChest, makeHatch, setCrystalXp } from './loot';
import { placeCrystals, clearCrystals } from './flora';
import { decorateDungeon } from './dungeondeco';
import { generateShip } from '../gen/ship';
import { clearFires } from './cooking';
import { clearBenches } from './benches';
import { clearFlags, cancelPlacing } from './claims';
import { cancelBridgePlacing } from './bridges';
import { cancelFieldPlacing } from './fields';
import { cancelStreetPlacing } from './streetlamps';
import { cancelLhPlacing } from './lighthouses';
import { cancelPierPlacing } from './piers';
import { inBoat, clearBoats } from './boats';
import { clearBases } from './building';
import { clearTurrets } from './turrets';
import { buildCave, leaveCave } from './cavelevel';
import type { Cave } from '../gen/caves';
import { placeDrone, makeBoss, setDroneRespawn } from './enemies';
import { drawCrown } from './trees';
import { sky, horizon, buildHorizon, updateSky, darkSky } from './sky';
import { setStreakSources } from './fx';
import { setArmedRule, setOffRule, refreshWeaponVisibility } from './weapons';
import { raidHere } from './villageraid';
import { PropBatch } from './props';
import { drawLadder, climbing, onClimbChange } from './ladders';
import { working, onWorkChange, setToolRule } from './gather';
import { clearThrowing } from './throwing';
import { drawHouse, drawFurniture } from './houses';
import { onDungeonLoaded, syncQuestWorld } from './quests';
import { driving, leave } from './vehicles';
import { openWorld, closeWorld, structFor, setEnterRuin, removeDrone, danger, inVillage, OW } from './overworld';
import { saveChar, depth } from '../character';
import { showToast, logLine, el, renderSheet } from '../ui/hud';
import { buildMini, setMiniMode } from '../ui/minimap';
import { drawWell } from './water';
import { tl, TL } from '../i18n';

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
  dropCarrier(); clearMountedTurrets(); clearRobots();
  closeWorld(); leaveCave(); clearCrystals(); clearFires(); clearBenches(); clearFlags(); cancelPlacing(true); cancelBridgePlacing(true); cancelFieldPlacing(true); cancelStreetPlacing(true); cancelLhPlacing(true); cancelPierPlacing(true); clearBoats(); clearBases(); clearTurrets(); clearThrowing();
  if (worldGroup) { scene.remove(worldGroup); worldGroup.traverse((o) => (o as THREE.Mesh).geometry?.dispose()); worldGroup = null; }
  [...W.crystals.map((c) => c.m), ...W.pickups.map((p) => p.g), ...W.chests.map((c) => c.g), ...W.doors.map((d) => d.g), ...W.bosses.map((b) => b.g),
    ...W.orbs.map((o) => o.m), ...W.drones.map((t) => t.g), ...W.npcs.map((n) => n.g)].forEach((o) => scene.remove(o));
  if (W.hatch) scene.remove(W.hatch.g);
  W.portals.forEach(disposeStair);
  W.crystals = []; W.pickups = []; W.doors = []; W.orbs = []; W.chests = []; W.bosses = []; W.drones = []; W.npcs = []; W.portals = [];
  W.hatch = null; W.spawnCells = []; W.arrivalStair = null; W.villageWalk = []; W.nearNpc = null; W.talkNpc = null;
  G.map = null;
}
function setLocationLook(outdoors: boolean) {
  if (outdoors) setPlaceLight(false); // (0.199) the surface: dark by night (a place below sets its own: loadDungeon, buildCave)
  fog.near = outdoors ? 20 : 3; fog.far = outdoors ? 140 : 46; sky.visible = outdoors; horizon.visible = outdoors;
  if (outdoors) { buildHorizon(G.char.world); updateSky(G.char.time); } else darkSky();
  el.route.style.display = outdoors ? 'none' : '';
  refreshWeaponVisibility();
}
/** Weapons are holstered inside the village walls and drawn everywhere else. */
setToolRule(() => !driving.v && !riding() && !inBoat() && !G.swimming && !climbing());
setOffRule(() => !driving.v && !riding() && !inBoat() && !G.swimming && !climbing() && !G.fly);
setArmedRule(() => !driving.v && !riding() && !inBoat() && !G.swimming && !G.fly && !climbing() && !working() && (G.char.loc === 'dungeon' || !inVillage(G.pos.x, G.pos.z) || raidHere()));
onClimbChange(refreshWeaponVisibility);
onWorkChange(refreshWeaponVisibility);

// ---------- dungeon ----------
const ruinName = (id: number) => { const m = metroCity(G.char.world, id); return m ? TL`${m.name} Metro` : findPoi(G.char.world, id)?.name ?? tl('Ruins'); };
export function loadDungeon(arriveDir: string | null) {
  const c = G.char, d = c.dungeon!;
  if (d.cave) { // a cave system: its own kind of place
    buildCave(d, () => { clearLevel(); setLocationLook(false); }, (g) => { worldGroup = g; });
    placeCarrier();
    saveChar(); return;
  }
  // (0.207) a hand-made level from the map editor; gone from this browser → back up to the surface
  const custom = d.custom ? customDungeon(d.custom) : undefined;
  if (d.custom && !custom) { const n = d.custom; c.loc = 'overworld'; c.dungeon = null; saveChar(); loadOverworld({ kind: 'saved' }); showToast(TL`The map ${n} is not in the editor any more.`); return; }
  const wreck = !custom && findPoi(c.world, d.ruinId)?.type === 'wreck';
  // (0.195) a dead city's vaults are one metro now: saved under its first entrance, one level (gen/metro.ts)
  const metro = wreck || custom ? null : metroCity(c.world, d.ruinId);
  if (metro) { d.ruinId = metroId(c.world, metro); d.depth = 1; d.gx = 0; d.gz = 0; }
  if (!wreck) d.depth = Math.max(1, Math.min(MAX_DUNGEON_DEPTH, d.depth));
  const seed = dungeonSeed(c.world, d);
  // Old saves below the depth limit resume at the deepest supported floor; no sector travel is generated.
  const map = custom ? expandDungeon(custom) : wreck ? generateShip(seed) : metro ? generateMetro(c.world, metro) : generateDungeon(seed, { depth: d.depth });
  clearLevel(); G.map = map; G.floor = null;
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
  if (map.metro) { // (0.205) the half steps up from the track's trench onto the platforms
    group.add(drawMetro(map));
    const floors = [...map.metro.steps, ...map.metro.decks]; G.floor = (x, y, z) => stepFloor(floors, x, y, z);
  }
  { // (0.199) how dark it is down here, and the lamps that still burn (gen/darkness.ts)
    const lamps = dungeonLamps(map, d.depth);
    setPlaceLight(true, underAmb(wreck || map.style === 'ship' ? 'wreck' : map.style === 'metro' ? 'metro' : 'labyrinth', d.depth), lamps);
    for (const l of lamps) group.add(l.k === 'torch' ? torchModel(l.x, l.y, l.z, l.n) : fixtureModel(l.x, l.y, l.z, map.style === 'metro' ? 1.4 : 0.6, map.style === 'ship' ? 0xff8a5c : 0xdff2ff));
  }
  for (const p of map.portals) {
    const pd = tryPlaceDoor(G.space, { axis: p.axis, m: p.m, c: p.c, stair: true, y0: p.y0 }, placed)!;
    const o = DIRV[p.dir], tx = d.gx + o[0], tz = d.gz + o[1];
    const name = ruinName(d.ruinId);
    if (custom && p.key[0] === 'V') { // the editor's stairs out: back where you came from
      W.portals.push(makeStair(p, pd, placed.length - 1, '▲ ' + tl('EXIT'), tl('Stairs back up to the surface'), exitCustom));
      continue;
    }
    if (metro && p.key[0] === 'V') { // an entrance station's stairs: up to its own street
      const n = Number(p.key.slice(1)), st = map.metro!.stations.find((s) => s.entrance === n)!;
      W.portals.push(makeStair(p, pd, placed.length - 1, '▲ ' + TL`EXIT · ${st.name.toUpperCase()}`, TL`Stairs up to the street at ${st.name} Station`, () => exitMetro(metro, n)));
      continue;
    }
    W.portals.push(p.key === 'V'
      ? makeStair(p, pd, placed.length - 1, '▲ ' + (d.depth > 1 && !wreck ? tl('DEPTH ') + (d.depth - 1) : name.toUpperCase()), d.depth > 1 && !wreck ? tl('Stairs up to depth ') + (d.depth - 1) : tl('Stairs up to the ') + name, () => { if (d.depth > 1 && !wreck) ascend(); else exitToRuin(); })
      : p.key === 'D' ? makeStair(p, pd, placed.length - 1, '▼ ' + tl('DEPTH ') + (d.depth + 1), tl('Stairs down to depth ') + (d.depth + 1), descend)
      : makeStair(p, pd, placed.length - 1, (p.up ? '▲ ' : '▼ ') + tl('SECTOR ') + tx + ', ' + tz, (p.up ? TL`Stairs up to sector ${tx}, ${tz}` : TL`Stairs down to sector ${tx}, ${tz}`), () => travel(p.dir)));
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
  // A crashed ship retains only a few stray drones alongside its anchored security guns.
  // none come back while any of them lives: more of them, at their own spots (world/dungeonfoes.ts)
  // (0.194) labyrinths get robots too, heavier the deeper you go (gen/dungeonguards.ts)
  const guards = wreck || metro || custom ? (map.guards ?? []) : labyrinthGuards(map, d.depth);
  populate(custom ? custom.drones : wreck ? 2 : labyrinthDrones(map.rooms, d.depth), guards.length, seed);
  // Ship security and labyrinth defences are anchored guns, separate from roaming enemy robots.
  loadMountedTurrets(dungeonTurrets(map, G.grid, custom ? 0 : wreck ? MOUNTED_TURRET.wreck : labyrinthTurrets(seed))); G.obstacle = mountedTurretHit;
  // ... and its robot crew still patrols the ship (on a server only the first player aboard brings them: shared foes)
  {
    const poi = metro ?? findPoi(c.world, d.ruinId), dz = poi ? dangerAt(c.world, poi.x, poi.z, true) : 1;
    const lv = custom ? Math.max(1, Math.min(8, custom.danger)) : wreck || metro ? Math.max(2, dz) : Math.max(1, dz) + (d.depth - 1) * 0.5;
    setRobotEnv({ ground: () => 0, danger: () => lv, nearRuin: () => false, forbidden: () => false, water: () => null }, { indoor: true });
    if (guards.length && spawnAuthority()) spawnGuards(guards, lv, guardAlive);
  }
  onDungeonLoaded(map);
  placeCarrier();
  setMiniMode('voxel'); buildMini();
  el.hudL.textContent = custom ? TL`${custom.name} · editor map` : wreck || metro ? ruinName(d.ruinId) : tl('Depth ') + d.depth + ', sector ' + d.gx + ', ' + d.gz;
  if (wreck || metro || custom) el.route.style.display = 'none'; // no way further down from a wreck
  el.seed.value = String(c.world); renderSheet(); saveChar();
}

// ---------- village decoration ----------
export function wallSign(text: string, color: string, at: { x: number; z: number }, out: [number, number], y: number) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.6), new THREE.MeshBasicMaterial({ map: signTexture(text, color, 54) }));
  m.position.set(at.x + out[0] * 0.53, y, at.z + out[1] * 0.53); m.rotation.y = Math.atan2(out[0], out[1]); return m;
}
/** Roofs, tree crowns, lamps and the well of a village standing at height y0. */
/** The sign over a house's door: yours, a hero's, or for sale (gen/homes.ts). */
function homeSign(vid: number | undefined, b: VillageMap['buildings'][number]): string {
  if (b.hero === undefined || vid === undefined) return b.name;
  if (myHome(G.char, vid) === b.hero) return tl('YOUR HOUSE');
  const o = G.char.towns[vid]?.homes?.[b.hero];
  return o ? TL`${o.n.toUpperCase()}'S HOUSE` : b.condition === 0 ? tl('RUIN FOR SALE') : tl('FOR SALE');
}
export function villageDeco(map: VillageMap, y0 = 0, vid?: number) {
  const grp = new THREE.Group();
  const props = new PropBatch();
  for (const b of map.buildings) {
    drawHouse(props, b, y0); drawFurniture(props, b, y0);
    const name = b.condition === 1 ? tl('HOME REPAIRS') : b.hero !== undefined ? homeSign(vid, b) : b.condition === 0 ? tl('VACANT RUIN') : b.name;
    if (name) grp.add(wallSign(name, b.role === 'innkeeper' ? '#ffb347' : '#ffd060', { x: b.door.x + b.out[0] * 0.15, z: b.door.z + b.out[1] * 0.15 }, b.out, y0 + (b.role === 'house' ? HOUSE.doorH + 0.45 : b.h + 0.35)));
  }
  for (const t of map.trees) drawCrown(props, t.x + 0.5, y0 + 2, t.z + 0.5, 1.8, t.h, hash(t.x, t.z, 0x7e3e));
  map.buildings.forEach((b) => { if (b.hero !== undefined && b.condition !== 0 && b.condition !== 1) homeDeco(props, map.homes[b.hero], y0, !!b.mine); }); // every house's chest (Gridholm's first house its own bed too)
  drawWell(props, map.well, y0); // the stone well in the middle, like the wild ones
  for (const t of map.towers) if (t.ladder) drawLadder(props, t.ladder, y0, map.tier < STONE_TIER ? STAKE : GRID);
  walkwayDeco(props, map, y0);
  if (map.tier < STONE_TIER) fenceDeco(props, map, y0);
  else {
  // guard tower lookouts
  for (const t of map.towers) props.lookout(t.x, t.z, t.x + t.w, t.z + t.d, y0 + t.h, GRID, 2.5);
  // gate arches: chamfer the top corners of each opening, through the whole wall
  for (const g of map.gates) {
    const along = g.dir === 'N' || g.dir === 'S', c = 1, top = y0 + 4, a0 = g.a, a1 = g.a + g.w;
    const P = (a: number, y: number) => (along ? [a, y, g.m] : [g.m, y, a]), v = along ? [0, 0, 1] : [1, 0, 0];
    props.prism([P(a0, top - c), P(a0, top), P(a0 + c, top)], v, GRID);
    props.prism([P(a1, top - c), P(a1, top), P(a1 - c, top)], v, GRID);
  }
  }
  grp.add(props.build());
  return lamps(grp, map, y0, vid);
}
/** The hero's bed (a wooden frame with a headboard, a mattress, a pillow and a blanket) and chest, in their house. */
function homeDeco(pb: PropBatch, h: VillageMap['homes'][number], y0: number, bed: boolean) {
  const WOOD = 0xb8b060, CLOTH = 0x9dffb4, { x0, z0, x1, z1 } = h.bed;
  if (!bed) { drawClosedChest(pb, h.chest.x, y0, h.chest.z, 'wood'); return; } // the house's own bed is its furniture
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
  drawClosedChest(pb, h.chest.x, y0, h.chest.z);
}
const STAKE = 0xb8b060, SCRAP = 0x8fb89a;
/** A repeatable pseudo-random number for drawing a village's fence (0..1). */
const rnd = (seed: number, i: number) => (hash(seed, i, 0xfe9c) % 10000) / 10000;
/**
 * The wall of a village not yet walled in stone: sharpened stakes of uneven height, some leaning, two rails nailed
 * along the inside, patches of scrap sheet here and there, a gate frame of two posts and a crossbeam at every gate,
 * and watch platforms on stilts in the corners. The collision is the voxel band under it (gen/village.ts).
 */
/**
 * The wall-walk (gen/village.ts `WalkRun`): a plank deck on joists along the inside of the wall, carried by posts with
 * knee braces, a hand rail on the inner side (open where a ladder comes up) with a toe board, and the ladders.
 */
function walkwayDeco(pb: PropBatch, map: VillageMap, y0: number) {
  const C = STAKE;
  for (const w of map.walkway) {
    const L = Math.hypot(w.x1 - w.x0, w.z1 - w.z0), ux = (w.x1 - w.x0) / L, uz = (w.z1 - w.z0) / L, h = y0 + w.h;
    const P = (a: number, y: number, o: number) => [w.x0 + ux * a + w.nx * o, y, w.z0 + uz * a + w.nz * o];
    const i0 = WALK.in0, i1 = WALK.in1, th = 0.12;
    // the deck, planks across it and the joist under each end
    pb.solid8([P(0, h - th, i0), P(L, h - th, i0), P(L, h - th, i1), P(0, h - th, i1)], [P(0, h, i0), P(L, h, i0), P(L, h, i1), P(0, h, i1)], C);
    for (let a = 0.3; a < L; a += 0.3) pb.seg(C, P(a, h + 0.005, i0), P(a, h + 0.005, i1));
    // posts every 2 m at the inner edge, braced back to the wall, and the rail on them (a gap at each ladder)
    const gaps = map.walkLadders.filter((l) => Math.abs((l.x - w.x0) * w.nx + (l.z - w.z0) * w.nz - (i1 + 0.05)) < 0.2)
      .map((l) => (l.x - w.x0) * ux + (l.z - w.z0) * uz).filter((a) => a > -0.5 && a < L + 0.5);
    const inGap = (a: number) => gaps.some((g) => Math.abs(a - g) < 0.45), posts: number[] = [];
    for (let a = 0.1; a < L - 0.4; a += 2) posts.push(a);
    posts.push(L - 0.1);
    for (const a of posts) {
      const q = 0.08, [x, , z] = P(a, 0, i1);
      pb.solid8([P(a - q, y0, i1 - q), P(a + q, y0, i1 - q), P(a + q, y0, i1 + q), P(a - q, y0, i1 + q)], [P(a - q, h - th, i1 - q), P(a + q, h - th, i1 - q), P(a + q, h - th, i1 + q), P(a - q, h - th, i1 + q)], C);
      pb.seg(C, P(a, h - 0.9, i1), P(a, h - th, i0)); // the knee brace
      if (!inGap(a)) pb.box(x - 0.05, h, z - 0.05, x + 0.05, h + 1.05, z + 0.05, C); // a rail post
    }
    for (let a = 0; a < L; ) { // the rail and the toe board, in lengths between the gaps
      let b = L;
      for (const g of gaps) if (g - 0.45 > a && g - 0.45 < b) b = g - 0.45;
      if (b - a > 0.2) { pb.seg(C, P(a, h + 1.05, i1), P(b, h + 1.05, i1)); pb.seg(C, P(a, h + 0.55, i1), P(b, h + 0.55, i1)); pb.seg(C, P(a, h + 0.15, i1), P(b, h + 0.15, i1)); }
      const next = gaps.filter((g) => g + 0.45 > b).sort((p, q) => p - q)[0];
      a = next !== undefined && b < L ? next + 0.45 : L;
    }
    for (const a of [0, L]) pb.seg(C, P(a, h + 1.05, i0), P(a, h + 1.05, i1)); // across the ends
  }
  for (const l of map.walkLadders) drawLadder(pb, l, y0, C);
}
function fenceDeco(pb: PropBatch, map: VillageMap, y0: number) {
  const H = map.wallH, tall = map.tier > 0;
  let n = 0;
  for (const r of map.fence) {
    const L = Math.hypot(r.x1 - r.x0, r.z1 - r.z0), ux = (r.x1 - r.x0) / L, uz = (r.z1 - r.z0) / L, nx = -uz, nz = ux;
    const P = (a: number, y: number, o = 0) => [r.x0 + ux * a + nx * o, y, r.z0 + uz * a + nz * o];
    // stakes
    const gap = tall ? 0.42 : 0.62, w = tall ? 0.2 : 0.14;
    for (let a = gap / 2; a < L; a += gap) {
      const k = n++, h = H * (tall ? 0.8 + rnd(map.seed, k) * 0.2 : 0.82 + rnd(map.seed, k) * 0.3), lean = (rnd(map.seed, k + 7e5) - 0.5) * (tall ? 0.15 : 0.4), yb = y0 - 0.1;
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
    pb.lookout(x0 - 0.3, z0 - 0.3, x1 + 0.3, z1 + 0.3, fy + 0.2, STAKE, 2.5);
  }
}
function lamps(grp: THREE.Group, map: VillageMap, y0: number, vid?: number) {
  // (0.202) a new settlement has no electricity until its power plant stands: no electric lamp posts before that
  const s = vid !== undefined ? G.char.towns[vid] : undefined;
  if (!progressive(s) || projectDone(s, 'power')) for (const l of map.lamps) {
    const pole = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(l.x, y0, l.z), V(l.x, y0 + 3.2, l.z)]), lineMat(GRID));
    const lamp = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.OctahedronGeometry(0.25)), add(0xffe8a0)); lamp.position.set(l.x, y0 + 3.45, l.z); lamp.name = 'lamp';
    grp.add(pole, lamp);
  }
  for (const l of villageLanterns(map)) grp.add(postLantern(l.x, y0, l.z)); // (0.200) oil lanterns by the gates and the shops' doors
  return grp;
}

// ---------- the open world ----------
/** `pod`: out of your cryo-pod in the crashed ship (after dying). */
export type Arrival = { kind: 'saved' } | { kind: 'new' } | { kind: 'pod' } | { kind: 'tavern'; id?: number; bed?: boolean } | { kind: 'ruin'; id: number };
export function loadOverworld(a: Arrival) {
  const c = G.char;
  if (a.kind === 'pod' || (!c.intro && (a.kind === 'new' || (a.kind === 'saved' && !c.ow)))) {
    const h = rivalStart(); // (0.189) a rival of seat 1 and up wakes at their own home
    if (h !== null) { loadOverworld({ kind: 'tavern', id: h }); return; }
  }
  clearLevel(); setLocationLook(true);
  setDroneRespawn(removeDrone);
  G.vel.set(0, 0, 0); G.hp = Math.max(G.hp, 1); G.pitch = 0;
  // Where to stand. The village and ruins sit on fixed spots, so positions are known before loading.
  let x = 0, z = 12, yaw = 0;
  if (a.kind === 'saved' && c.ow) { x = c.ow.x; z = c.ow.z; yaw = c.ow.yaw; }
  if (a.kind === 'ruin') { const p = findPoi(c.world, a.id); if (p) { x = p.x; z = p.z; } }
  // a new character wakes in the wreck of their ship (world/crashpod.ts): load the land round it
  const crash = a.kind === 'pod' || (!c.intro && (a.kind === 'new' || (a.kind === 'saved' && !c.ow)));
  if (crash) { const l = landingSite(OW.terrain?.world === c.world ? OW.terrain : new Terrain(c.world)); x = l.x; z = l.z; }
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
    const mine = a.kind === 'tavern' && a.bed && a.id !== undefined && vm ? myHome(c, a.id) : -1, hb = mine >= 0 ? vm.buildings.find((b) => b.hero === mine) : undefined;
    if (mine >= 0 && vm.homes[mine] && hb) { // by your own bed, facing the door
      const s = vm.homes[mine].bed.side; G.pos.set(s.x, vm.y, s.z); G.yaw = Math.atan2(-(hb.door.x - s.x), -(hb.door.z - s.z));
    } else if (a.kind === 'tavern') {
      const t = vm.buildings.find((b) => b.role === 'innkeeper')!;
      G.pos.set(t.door.x + t.out[0] * 2, vm.y, t.door.z + t.out[1] * 2); G.yaw = Math.atan2(t.out[0], t.out[1]);
    } else if (crash && crashSpawn()) {
      const sp = crashSpawn()!; G.pos.set(sp.x, OW.terrain!.heightAt(sp.x, sp.z), sp.z); G.yaw = sp.yaw;
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
  if (G.trans) return tl('Busy travelling, try again in a moment.');
  if (driving.v) leave();
  if (riding()) getOff(true);
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
  return tl('Teleported to ') + (poi ? poi.name : `${Math.round(x)}, ${Math.round(z)}`) + '.';
}
export function saveOverworldPos() {
  if (G.char.loc !== 'overworld') return;
  G.char.ow = { x: +G.pos.x.toFixed(2), y: +G.pos.y.toFixed(2), z: +G.pos.z.toFixed(2), yaw: +G.yaw.toFixed(3) };
  saveChar();
}

// ---------- moving between places ----------
export function descend() {
  const d = G.char.dungeon;
  if (!d || d.cave || (!W.hatch && !W.portals.some(p => p.key === 'D')) || d.depth >= MAX_DUNGEON_DEPTH) return;
  d.depth++; saveChar(); loadDungeon('V'); showToast(tl('Depth ') + depth()); arriveVia(W.arrivalStair);
}
export function ascend() {
  const d = G.char.dungeon;
  if (!d || d.cave) return;
  if (d.depth <= 1) { exitToRuin(); return; }
  d.depth--; saveChar(); loadDungeon('D'); showToast(tl('Depth ') + depth()); arriveVia(W.arrivalStair);
}
export function travel(dir: Dir) {
  const d = G.char.dungeon!;
  d.gx += DIRV[dir][0]; d.gz += DIRV[dir][1]; saveChar();
  loadDungeon(OPP[dir]); showToast(tl('Sector ') + d.gx + ', ' + d.gz); arriveVia(W.arrivalStair);
}
/** Into a cave system by one of its mouths (world/caves.ts): the mouths are remembered, so either can be the way out. */
export function enterCave(cv: Cave) {
  const c = G.char, self = { x: cv.x, z: cv.z, face: cv.face };
  const mouths = cv.other ? (cv.mouth === 0 ? [self, cv.other] : [cv.other, self]) : [self];
  c.loc = 'dungeon'; c.dungeon = { ruinId: cv.sys, depth: 1, gx: 0, gz: 0, cave: { name: cv.name, mouths, from: cv.other ? cv.mouth : 0 } }; saveChar();
  loadDungeon(null); showToast(cv.name); logLine(cv.other ? tl('The cave runs deep into the mountain. They say it comes out on the far side.') : tl('Your steps echo in the dark.'));
}
/** Out of a cave system by way out i: in front of that mouth, facing out. */
export function exitCave(i: number) {
  const c = G.char, info = c.dungeon!.cave!, m = info.mouths[Math.min(i, info.mouths.length - 1)];
  c.loc = 'overworld'; c.dungeon = null;
  const fx = Math.cos(m.face), fz = Math.sin(m.face);
  c.ow = { x: m.x + fx * 3.5, y: -1e4, z: m.z + fz * 3.5, yaw: Math.atan2(-fx, -fz) }; saveChar();
  loadOverworld({ kind: 'saved' }); showToast(info.name);
  if (info.mouths.length > 1 && i !== info.from) logLine(tl('You come out on the far side of the mountain.'));
}
export function enterDungeon(ruinId: number) {
  saveOverworldPos();
  const c = G.char, entrance = cityEntrance(c.world, ruinId), city = entrance && metroCity(c.world, ruinId);
  const drawn = editorDungeonAt(c.world, ruinId);
  if (drawn) { // (0.210, stage E4) a drawn world's place with a level from the editor: down into it; its stairs bring you back here
    c.loc = 'dungeon'; c.dungeon = { ruinId, depth: 1, gx: 0, gz: 0, custom: drawn }; saveChar();
    loadDungeon(customDungeon(drawn)!.marks.some((m) => m.k === 'spawn') ? null : 'V0');
    showToast(entrance?.name ?? findPoi(c.world, ruinId)?.name ?? drawn); arriveVia(W.arrivalStair); return;
  }
  if (entrance && city) { // (0.195) down into the city's metro, at this entrance's station
    c.loc = 'dungeon'; c.dungeon = { ruinId: metroId(c.world, city), depth: 1, gx: 0, gz: 0 }; saveChar();
    loadDungeon('V' + entrance.n); showToast(entrance.name); arriveVia(W.arrivalStair); return;
  }
  c.loc = 'dungeon'; c.dungeon = { ruinId, depth: 1, gx: 0, gz: 0 }; saveChar();
  loadDungeon('V'); showToast(ruinName(ruinId)); logLine('Depth 1'); arriveVia(W.arrivalStair);
}
setEnterRuin(enterDungeon);
/** (0.207) Down into a hand-made level from the map editor (world/custommaps.ts); its stairs bring you back here. */
export function enterCustom(name: string): boolean {
  if (!customDungeon(name)) return false;
  const c = G.char;
  if (c.loc === 'overworld') saveOverworldPos();
  c.loc = 'dungeon'; c.dungeon = { ruinId: customId(name), depth: 1, gx: 0, gz: 0, custom: name }; saveChar();
  // in at its start marker if it has one, else at its first stairs
  loadDungeon(customDungeon(name)!.marks.some((m) => m.k === 'spawn') ? null : 'V0'); showToast(name); arriveVia(W.arrivalStair);
  return true;
}
function exitCustom() {
  const c = G.char, d = c.dungeon!;
  if (d.custom && d.ruinId !== customId(d.custom)) { exitToRuin(); return; } // (0.210) under a place of the world: out at that place
  c.loc = 'overworld'; c.dungeon = null; saveChar();
  loadOverworld({ kind: 'saved' }); arriveVia(null);
}
/** (0.195) Up a metro station's stairs onto its own street (gen/metro.ts): in at one end of the city, out at another. */
function exitMetro(city: CitySite, n: number) {
  const c = G.char, e = cityEntrances(c.world, city)[n], f = entranceFront(city, e);
  c.ow = { x: nearX(f.x, c.ow?.x ?? f.x), y: -1e4, z: f.z, yaw: f.yaw };
  c.loc = 'overworld'; c.dungeon = null; saveChar();
  loadOverworld({ kind: 'saved' }); showToast(e.name); arriveVia(null);
}
export function exitToRuin() {
  const c = G.char, id = c.dungeon!.ruinId;
  const entrance = cityEntrance(c.world, id);
  const site = entrance && citySites(c.world).find((s) => s.i === entrance.city);
  if (entrance && site) {
    const f = entranceFront(site, entrance);
    c.ow = { x: nearX(f.x, c.ow?.x ?? f.x), y: -1e4, z: f.z, yaw: f.yaw };
    c.loc = 'overworld'; c.dungeon = null; saveChar();
    loadOverworld({ kind: 'saved' }); showToast(entrance.name); arriveVia(null); return;
  }
  c.loc = 'overworld'; c.dungeon = null; saveChar();
  loadOverworld({ kind: 'ruin', id }); showToast(ruinName(id)); arriveVia(W.arrivalStair);
}
/**
 * Where a beacon takes you: the nearest village you have been to (its tavern), else Gridholm. `id` picks a village
 * directly (the console's `home` goes to Gridholm). A bad day ('death') ends where the castaway first woke: out of
 * their cryo-pod in the crashed ship (world/crashpod.ts), the ship's medical systems having patched them up.
 */
/** Online a death ends the character (ui/rebirth.ts): another crew member wakes instead. */
let crewDeath: (() => boolean) | null = null;
export function setCrewDeath(f: () => boolean) { crewDeath = f; }
export function toVillage(how: 'death' | 'recall', id?: number) {
  const c = G.char;
  // online a death ends the character: the next crew member wakes in a pod (ui/rebirth.ts); the screen fades back in
  if (how === 'death' && id === undefined && crewDeath?.()) { arriveVia(null); return; }
  if (how === 'death' && id === undefined) {
    c.loc = 'overworld'; c.dungeon = null; saveChar();
    loadOverworld({ kind: 'pod' }); G.hp = G.S.maxHp;
    c.kcal = Math.max(c.kcal, 1500); c.water = Math.max(c.water, 50); // the pod's drip kept you going
    showToast(tl('You wake up in your cryo-pod aboard the ') + SHIP_NAME);
    arriveVia(null);
    return;
  }
  const from = c.loc === 'dungeon' && c.dungeon ? c.dungeon.cave?.mouths[0] ?? cityEntrance(c.world, c.dungeon.ruinId) ?? findPoi(c.world, c.dungeon.ruinId) ?? { x: 0, z: 0 } : { x: G.pos.x, z: G.pos.z };
  const home = rivalStart() ?? GRIDHOLM_ID, known = allVillages(c.world).filter((v) => v.id === home || isDiscovered(c.discovered, Math.floor(v.x / CHUNK), Math.floor(v.z / CHUNK)));
  const v = id !== undefined ? findPoi(c.world, id) ?? known[0] : known.reduce((a, b) => (worldDist(b.x, b.z, from.x, from.z) < worldDist(a.x, a.z, from.x, from.z) ? b : a));
  c.loc = 'overworld'; c.dungeon = null; saveChar();
  // Gridholm is home once you own the house there: you wake up in your own bed, anywhere else in the tavern
  const bed = myHome(c, v.id) >= 0;
  loadOverworld({ kind: 'tavern', id: v.id, bed }); G.hp = G.S.maxHp;
  if (how === 'death') { c.kcal = Math.max(c.kcal, 1500); c.water = Math.max(c.water, 50); } // the innkeeper (or a neighbour) fed you
  showToast(how === 'death' ? (bed ? tl('You wake up in your own bed') : tl('You wake up in the tavern of ') + v.name) : bed ? tl('Home') : v.name);
  arriveVia(null);
}
export const canRecall = () => G.char.loc === 'dungeon' || !inVillage(G.pos.x, G.pos.z);
