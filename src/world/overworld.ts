import { applyLayouts } from '../gen/layouts';
import { clearCarriers } from './carriers';
import { clearHubTrucks } from './hublines';
import { clearSkyShips } from './skyships';
import { clearCargoDrones } from './airlines';
import { clearIntents } from './intents';
import { biomeTint, biomeOfCell, treeIn, BIOME_LOOK, type TreeLook } from '../gen/biomes';
import { drawTreeLook, LEAF, VINE } from './trees';
import { biomeAt, biomeName, type BiomeHere } from '../gen/biomes';
import { nearestOnRoad } from '../gen/roads';
import { terrainWays } from '../gen/playerroads';
import { shapedWorld } from '../gen/worldrules';
import { syncConvoyStart } from './convoyfuel';
import { drawSettlementSites, drawSettlementComms, settlementHit, settlementFloor, settlementRay, settlementSolid, forgetSettlement } from './settlement';
import { settlementVillage } from '../gen/settlement-village';
import { initializeSettlements, progressive, plotsOf, projectAvailable, depositsOf, mechanicHere } from '../gen/settlement';
import { RESOURCE_YARD, type ResourceProject } from '../gen/resource-sites';
import { peopleAt } from '../gen/people';
import { warehouseSpot, warehouseAt } from '../gen/hall';
import { sitePads, meanGround, projectBegun, SITE_PAD } from '../gen/buildpads';
import { allVillages } from '../gen/regions';
import { syncMegaliths, clearMegaliths, megalithHit, megalithRay, megalithName, megalithFloor, nearMegalith } from './megaliths';
import { syncWorldGates, clearWorldGates, worldGateHit, worldGateRay } from './worldgates';
import { inGateClearing } from '../gen/worldgates';
// The open world: terrain streamed in 32 m chunks around the player, voxel structures (the village, ruins)
// standing on it, forests, roads, and light field enemies. Generation is deterministic; this module only
// decides what is loaded and turns generator output into meshes.
import { insideVehicle, hitOccupiedVehicle } from './damage';
import { setLadders, dropLadders, ladderHit, ladderFloor } from './ladders';
import { setHouses, dropHouses, houseHit, houseRay, houseSolid } from './houses';
import { myHome } from '../gen/homes';
import { fieldClaims } from '../gen/fields';
import { groveTrees } from '../gen/resource-sites';
import { planksForLogs } from '../gen/wood';
import { drawHangar, hangarOps } from './hangar';
import { drawWorks, forgetWorks } from './works';
import { drawStations, forgetStations } from './stations';
import { drawHall, forgetHall, hallHit, hallCeiling } from './hall';
import { drawGuards, forgetGuards, guardHit } from './siteguards';
import { setWalkways, dropWalkways, walkFloor, walkHit } from './walkways';
import { setDoors, dropDoors, doorHit, doorRay } from './housedoors';
import { recentDead } from './villageraid';
import * as THREE from 'three';
import type { Surface } from '../data/vehicles';
import { setCrash, dropCrash, podHit } from './crashpod';
import { installHit, dropInstalls, primeInstalls } from './installs';
import { cityHit, cityRay, dropCities, cityName, cityVaultHint } from './cities';
import { toxicHit, dropToxic, toxicName } from './toxic';
import { lodeHit, dropLodes, lodeName } from './lodes';
import { crystalHit, crystalRay, dropCrystals, crystalName } from './crystals';
import { colossusHit, colossusRay, dropColossi, colossusName } from './colossi';
import { rayCyl, rayHull, type V3 } from '../gen/cover';
import { portHit, dropPorts, portNameAt } from './ports';
import { campHit, dropCamps } from './plantcamps';
import { dropPowerLines } from './powerlines';
import { dropCommuters } from './commute';
import { portClaims } from '../gen/ports';
import { installAt } from '../gen/installs';
import { drawFarms } from './farms';
import { scene, V, GRID, FILL, localize } from './render';
import { G, W } from '../game';
import { VoxelGrid, type Space } from '../core/voxel';
import { Terrain, inRect, rectDist, STEP, CELLS, VERTS, type Pad } from '../gen/terrain';
import { riversOf, riverNear } from '../gen/rivers';
import { bridgeFloor, bridgeHit, bridgeDeck, clearBridges } from './bridges';
import { pierFloor, pierHit, pierDeck, clearPiers } from './piers';
import { lighthouseHit } from './lighthouses';
import { fallHit } from './skyfall';
import { boatHit, shipFloor, shipHit } from './boats';
import { gondolaFloor, gondolaHit } from './airships';
import { CHUNK, poisNear, X_MIN, WORLD_W, POLE_Z, POLAR_Z, villageContaining, villageDist, villageSeed, GRIDHOLM_ID, type Poi, type Rect, wrapC, wrapDx, nearX } from '../gen/regions';
import { chunkTrees, chunkRocks, TREE_SPAN, type Tree, type Rock, type OreKind } from '../gen/trees';
import { rockShape, rockSurface, leanY, type RockShape } from '../gen/rockshape';
import { drawTemple, solidDist, type TempleSolid } from './temple';
import { chunkWells, type Well } from '../gen/water';
import { chunkPlants, type Plant } from '../gen/flora';
import { dangerAt } from '../gen/danger';
import { drawPlants, dropPlants, ripe, type PlantNode } from './flora';
import { drawWell, syncLakes, clearLakes, seaSheet, swampSheet, riverSheet } from './water';
import { generateVillage, WALL_TIERS, STONE_TIER, wallPolygon, villageSides, insideWall, type VillageMap } from '../gen/village';
import { wallOf } from '../gen/town';
import { drawPower, setPlantLamps, forgetPower } from './power';
import { drawIndustry, forgetIndustry } from './industry';
import { caravanHit, clearCaravans } from './caravans';
import { peerCarHit } from './peers';
import { raidHere, clearVillageRaid } from './villageraid';
import { clearOutpostRaid } from './outpostraid';
import { clearRouteTrucks } from './convoyroutes';
import { syncQuestWorld } from './quests';
import { generateRuin } from '../gen/ruins';
import { generateWreck } from '../gen/wreck';
import { drawWreck } from './wreck';
import { tryPlaceDoor } from '../gen/doors';
import { PropBatch, sharedFill, sharedLine, sharedFillV, sharedLineV, tintGroup } from './props';
import { makeStair, disposeStair, type Door, type Stair } from './doors';
import { makeNpc, type Npc } from './npc';
import { foeRules, type Drone } from './enemies';
import { spawnVehicles, clearVehicles, vehicleHit, syncFound, driving, vehiclesNear } from './vehicles';
import { logLine, showToast } from '../ui/hud';
import { dropGarrisons } from './citygarrisons';
import { setCreatureEnv, clearCreatures, colossusBodyHit } from './creatures';
import { chunkSpikes, type Spike } from '../gen/crystalspikes';
import { crystal } from './crystalbeasts';
import { setRobotEnv, clearRobots } from './robots';
import { updateThreat } from './threat';
import { setBanditEnv, clearBandits, spawnCamp, despawnCamp } from './bandits';
import { setRaiderEnv, clearRaiders, ambushHit } from './raiders';
import { drawClosedChest } from './chestmodel';
import { generateCamp, type CampMap } from '../gen/camps';
import { add as addMat } from './render';
import { YARD } from '../gen/vehicles';
import { setStreakSources, type EdgeSource } from './fx';
import { voxelObject, villageDeco, wallSign } from './level';
import { NPC_INFO, VILLAGER_NAMES, type NpcRole } from '../data/npcs';
import { DIRV, hash, rng } from '../core/rng';
import { claimDist, CLAIM } from '../gen/claims';
import { baseHit, baseFloor, baseRay, baseSolid } from './building';
import { chunkCaves, type Cave } from '../gen/caves';
import { drawCave, caveHit } from './caves';
import { trailMarks, drawTrailMark } from './trails';
import { tl, TL } from '../i18n';
/** Ore veins in rocks: rust for iron, verdigris for copper. */
export const ORE_COLOR: Record<OreKind, number> = { iron: 0xd0703c, copper: 0x38d0b8 };

export const LOAD_R = 4, UNLOAD_R = 6, STRUCT_LOAD = 170, STRUCT_UNLOAD = 240;
/** Surface structures are drawn in outline style: folds and edges, floor tiles every 2 m, wall seams every 4 m. */
const OUTLINE = { floor: 2, wall: 4 };
const TILE_COLOR = 0x4dff7e, ICE_COLOR = 0xbfffe8;
/** Roads and trails: a lighter, shaded strip over the ground (drawn over the terrain fill, under its grid lines). */
/** (0.280) The players' dirt tracks: an earthier strip than the old roads. */
const TRACK_FILL = new THREE.MeshBasicMaterial({ color: 0x2a3214, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
/** (0.282, D3) The heroes' surfaced tracks: gravel paler, paved grey with pale kerbs. */
const GRAVEL_FILL = new THREE.MeshBasicMaterial({ color: 0x3e4030, transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
const PAVED_FILL = new THREE.MeshBasicMaterial({ color: 0x343b3a, transparent: true, opacity: 0.95, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
const KERB = new THREE.LineBasicMaterial({ color: 0x9aa8a0 });
const ROAD_FILL = new THREE.MeshBasicMaterial({ color: 0x0f4020, transparent: true, opacity: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
/** Chunks reaching above this height (m) are snowy: pale lines. */
const SNOW_LINE = 115;

interface Chunk { cx: number; cz: number; group: THREE.Group; /** the heights it was built on */ lat: Float32Array; trees: Tree[]; rocks: Rock[]; wells: Well[]; plants: Plant[]; nodes: PlantNode[]; caves: Cave[]; lod: number;
  /** (0.277) the crystal spikes of the wastes: solid, and they cut (the shard trees among them): [x, y (ground), z, r, h] */
  spikes: number[][] }
interface Structure {
  poi: Poi; grid: VoxelGrid; group: THREE.Group; edges: EdgeSource;
  doors: Door[]; stairs: Stair[]; npcs: Npc[]; village?: VillageMap; camp?: CampMap; flames?: THREE.LineSegments;
  /** Fallen pieces with no voxels under them, for vehicles: world [x, z, r] (a temple's rubble). */
  blocks?: [number, number, number][];
  /** (0.222) A temple's stone pieces for walking bodies (world/temple.ts): walls to you and the foes, floors on top. */
  solids?: TempleSolid[];
}

/** Things that come and go with a loaded village and live in modules this one must not import (world/wallguns.ts). */
export const villageHooks: { load(id: number, vm: VillageMap, y: number): void; drop(id: number): void }[] = [];
export const OW = {
  terrain: null as Terrain | null,
  chunks: new Map<number, Chunk>(),
  structs: new Map<number, Structure>(),
  village: null as VillageMap | null,
};
const ckey = (cx: number, cz: number) => (cx + 32768) * 65536 + (cz + 32768);
let queue: [number, number, number][] = [], lastChunk = '';

// ---------- collision ----------
/**
 * Vehicles and places (not villages, which keep vehicles out on their own): a loaded place blocks only where it
 * really stands: its voxels at the height of a car's body (walls, pillars, crates, a hull) or a hole in its floor
 * (a stairwell), and the fallen pieces a temple has without voxels. A place not loaded yet blocks its whole square.
 */
export function structBlocks(px: number, pz: number, r: number, h: number): boolean {
  for (const p of poisNear(OW.terrain!.world, px, pz, 50)) {
    if (p.type === 'village' || rectDist(p.rect, px, pz) > r + 1) continue;
    const s = OW.structs.get(p.id);
    if (!s) { if (rectDist(p.rect, px, pz) < r) return true; continue; }
    if (s.blocks?.some(([x, z, br]) => Math.hypot(x - px, z - pz) < br + r)) return true;
    for (const [dx, dz] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) {
      const x = Math.floor(px + dx), z = Math.floor(pz + dz);
      if (!s.grid.covers(x, z)) continue;
      if (!s.grid.empty(x, Math.floor(h + 0.5), z) || !s.grid.empty(x, Math.floor(h + 1.5), z) || s.grid.empty(x, Math.floor(h - 0.5), z)) return true;
    }
  }
  return false;
}
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
/** (0.211.1) Rocks are solid to their real faces (gen/rockshape.ts `rockSurface`): a body of radius r standing at
 *  (x, z) meets the highest part of the stone under its circle. Stones no taller than a step are stepped onto
 *  (`rockFloor`); taller ones are walls up their steep faces and a floor once you are on top (a jump lands there). */
const ROCK_STEP = 0.6, ROCK_TOL = 0.1, BODY_R = 0.3;
const rockShapes = new WeakMap<Rock, RockShape>();
function rockTop(k: Rock, x: number, z: number, r: number): number {
  let dx = x - k.x, dz = z - k.z;
  const d = Math.hypot(dx, dz);
  if (d >= k.r + r) return -Infinity;
  const f = d > r ? (d - r) / d : 0; dx *= f; dz *= f;
  let s = rockShapes.get(k); if (!s) rockShapes.set(k, s = rockShape(k.r, k.h, k.sides, k.rot));
  const top = rockSurface(s, dx, dz);
  return k.y + top + (isFinite(top) ? leanY(k.lean, dx, dz, top, k.h) : 0);
}
/** A body (feet at y, `r` wide) runs into the stone: some of it under the body's circle stands above the feet. */
function rockBlocks(k: Rock, x: number, y: number, z: number, r: number): boolean {
  const tilt = k.lean ? (Math.abs(k.lean[0]) + Math.abs(k.lean[1])) * k.r : 0;
  if (k.h <= ROCK_STEP || y > k.y + k.h + tilt || y + 1.7 < k.y - tilt) return false;
  return y < rockTop(k, x, z, r) - ROCK_TOL;
}
/** The top of the stones under the player you can stand on from height y (-Infinity when none). */
export function rockFloor(x: number, y: number, z: number): number {
  const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
  let best = -Infinity;
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const c = OW.chunks.get(ckey(cx + i, cz + j)); if (!c) continue;
    for (const k of c.rocks) {
      const t = rockTop(k, x, z, BODY_R);
      if (t > best && t <= y + (k.h <= ROCK_STEP ? ROCK_STEP : ROCK_TOL)) best = t;
    }
  }
  return best;
}
/** (0.222, the owner's report) The stone pieces round a ruin (fallen frames, pylon tops, the ring, obelisks, blocks,
 *  rubble) are solid: the low ones (no taller than `TEMPLE_LOW`) are stepped onto like small stones, the rest are
 *  walls until you stand on top. */
const TEMPLE_LOW = 0.75;
function templeNear(x: number, z: number, r: number, f: (s: TempleSolid) => void) {
  for (const st of OW.structs.values()) if (st.solids) for (const s of st.solids) if (x + r > s.x0 && x - r < s.x1 && z + r > s.z0 && z - r < s.z1) f(s);
}
export function templeHit(x: number, y: number, z: number, r: number): boolean {
  let hit = false;
  templeNear(x, z, r, (s) => { if (!hit && s.y1 - s.y0 > TEMPLE_LOW && y < s.y1 - ROCK_TOL && y + 1.7 > s.y0 && solidDist(s, x, z) < r) hit = true; });
  return hit;
}
/** The top of the temple pieces under you that you can stand on from height y (-Infinity when none). */
export function templeFloor(x: number, y: number, z: number): number {
  let best = -Infinity;
  templeNear(x, z, BODY_R, (s) => { if (s.y1 > best && s.y1 <= y + (s.y1 - s.y0 <= TEMPLE_LOW ? ROCK_STEP : ROCK_TOL) && solidDist(s, x, z) < BODY_R) best = s.y1; });
  return best;
}
/**
 * (0.224, PLAN_WALKI.md stage W3: cover) Where a ray first meets natural cover: a tree trunk, a stone taller than a
 * step, a ruin's stone piece or a tall crystal. In `G.rayBlock`, so the player's shots, the foes' sight lines and
 * every bolt stop there: a stone or a trunk hides whoever crouches behind it.
 */
export function natureRay(o: V3, d: V3, maxT: number): number {
  let best = maxT;
  const ex = o.x + d.x * maxT, ez = o.z + d.z * maxT;
  const cx0 = Math.floor((Math.min(o.x, ex) - 8) / CHUNK), cx1 = Math.floor((Math.max(o.x, ex) + 8) / CHUNK);
  const cz0 = Math.floor((Math.min(o.z, ez) - 8) / CHUNK), cz1 = Math.floor((Math.max(o.z, ez) + 8) / CHUNK);
  const hd = Math.hypot(d.x, d.z) || 1e-9, nx = -d.z / hd, nz = d.x / hd; // across the ray, for a quick cull
  const off = (x: number, z: number, r: number) => Math.abs((x - o.x) * nx + (z - o.z) * nz) > r;
  for (let cx = cx0; cx <= cx1; cx++) for (let cz = cz0; cz <= cz1; cz++) {
    const c = OW.chunks.get(ckey(cx, cz)); if (!c) continue;
    for (const t of c.trees) for (const [tx, tz, tr] of t.cols) if (!off(tx, tz, tr)) best = rayCyl(o, d, best, tx, tz, tr, t.y - 1, t.y + 2 + t.h * 0.3);
    for (const k of c.rocks) if (k.h > ROCK_STEP && !off(k.x, k.z, k.r)) best = rayCyl(o, d, best, k.x, k.z, k.r * 0.72, k.y - 1, k.y + k.h * 0.92);
  }
  for (const st of OW.structs.values()) if (st.solids) for (const s of st.solids) {
    if (s.y1 - s.y0 <= TEMPLE_LOW || Math.max(o.x, ex) < s.x0 || Math.min(o.x, ex) > s.x1 || Math.max(o.z, ez) < s.z0 || Math.min(o.z, ez) > s.z1) continue;
    best = s.c ? rayCyl(o, d, best, s.c[0], s.c[1], s.c[2], s.y0, s.y1) : rayHull(o, d, best, s.hull, s.y0, s.y1);
  }
  return colossusRay(o, d, crystalRay(o, d, best)); // (0.275) the colossi stop shots too
}
/** Tree trunks (an arch has one per leg): vertical cylinders, solid up to a bit above their base. */
export function treeHit(x: number, y: number, z: number, r: number): boolean {
  const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const c = OW.chunks.get(ckey(cx + i, cz + j)); if (!c) continue;
    for (const t of c.trees) if (y < t.y + 2 + t.h * 0.3) for (const [tx, tz, tr] of t.cols) if (Math.hypot(tx - x, tz - z) < tr + r) return true;
    for (const k of c.rocks) if (rockBlocks(k, x, y, z, r)) return true;
    for (const p of c.plants) if (y < p.y + 2) for (const [px, pz, pr] of p.cols) if (Math.hypot(px - x, pz - z) < pr + r) return true;
    for (const w of c.wells) if (Math.hypot(w.x - x, w.z - z) < 1.05 + r && y < OW.terrain!.heightAt(w.x, w.z) + 0.9) return true;
    for (const cv of c.caves) if (caveHit(cv, x, y, z, r, cv.y)) return true;
    for (const k of c.spikes) if (y < k[1] + k[4] && Math.hypot(k[0] - x, k[2] - z) < k[3] + r) return true;
  }
  return false;
}
/** (0.277) The crystal spike a body (feet at y, r wide) presses against, within `reach` m more than it can come: [x, z] of
 *  its middle, or null. */
export function spikeTouch(x: number, y: number, z: number, r: number, reach: number): [number, number] | null {
  const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const c = OW.chunks.get(ckey(cx + i, cz + j)); if (!c) continue;
    for (const k of c.spikes) if (y < k[1] + k[4] && Math.hypot(k[0] - x, k[2] - z) < k[3] + r + reach) return [k[0], k[2]];
  }
  return null;
}
/** (0.257) A tree's crown (its whole height and crown radius) in the way of something flying at y, r wide: airships. */
export function crownHit(x: number, y: number, z: number, r: number): boolean {
  const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const c = OW.chunks.get(ckey(cx + i, cz + j)); if (!c) continue;
    for (const t of c.trees) if (y < t.y + t.h + 1 && Math.hypot(t.x - x, t.z - z) < t.r + r) return true;
  }
  return false;
}
/** (0.211.1) What a walking foe (feet at y, r wide) may not pass: the same solid things as the player (trees, rocks,
 *  city ruins, houses, halls, the settlements' yards, wall-walks, ladders, sandbags, the old plants, lighthouses,
 *  outposts, the crash ship, bases, megaliths, gates, doors, fog sites) and every voxel structure (camp palisades,
 *  village fences, ruins), sampled round its circle at the knee and the chest. Vehicles, boats and caravans are left
 *  out: foes must still reach whoever is in them. */
export function foeBody(x: number, y: number, z: number, r: number): boolean {
  if (treeHit(x, y, z, r) || templeHit(x, y, z, r) || crystalHit(x, y, z, r) || colossusHit(x, y, z, r) || cityHit(x, y + 0.5, z, r) || houseHit(x, y, z, r) || hallHit(x, y, z, r) || settlementHit(x, y, z, r) || walkHit(x, y, z, r) || ladderHit(x, y, z, r) || guardHit(x, y, z, r) || installHit(x, y, z, r) || lighthouseHit(x, y, z, r) || fallHit(x, y, z, r) || lodeHit(x, y, z, r) || portHit(x, y, z, r) || campHit(x, y, z, r) || podHit(x, y, z, r) || baseHit(x, y, z, r) || megalithHit(x, y, z, r) || worldGateHit(x, y, z, r) || doorHit(x, y, z, r) || toxicHit(x, y, z, r)) return true;
  const k = r * 0.75, y0 = Math.floor(y + 0.3), y1 = Math.floor(y + 1.2);
  for (const [dx, dz] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r], [k, k], [-k, k], [k, -k], [-k, -k]]) {
    const fx = Math.floor(x + dx), fz = Math.floor(z + dz);
    if (!space.empty(fx, y0, fz) || !space.empty(fx, y1, fz)) return true;
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
  const holes = f.pads.filter((p) => !p.surface).map((p) => p.poi.rect);
  const hole = (ax: number, az: number, bx: number, bz: number) => holes.some((r) => Math.min(ax, bx) >= r.x0 && Math.max(ax, bx) <= r.x1 && Math.min(az, bz) >= r.z0 && Math.max(az, bz) <= r.z1);
  const H = (i: number, j: number) => lat[i + VERTS * j];
  // (0.232) the ground's colours by biome, blended across the borders; snow pales the lines high up
  const polar = Math.abs(z0 + CHUNK / 2) > POLAR_Z + 800, LC: number[][] = [], FC: number[][] = [];
  for (let j = 0; j <= CELLS; j++) for (let i = 0; i <= CELLS; i++) {
    const x = x0 + i * STEP, z = z0 + j * STEP, l = biomeTint(T.world, x, z, 'line'), snow = Math.min(1, Math.max(0, (H(i, j) - SNOW_LINE) / 25));
    LC.push(snow ? [l[0] + (0.75 - l[0]) * snow, l[1] + (1 - l[1]) * snow, l[2] + (0.91 - l[2]) * snow] : l);
    FC.push(biomeTint(T.world, x, z, 'fill'));
  }
  const C = (i: number, j: number) => LC[i + VERTS * j], F = (i: number, j: number) => FC[i + VERTS * j];
  const tri: number[] = [], lines: number[] = [], tcol: number[] = [], lcol: number[] = [];
  for (let j = 0; j < CELLS; j++) for (let i = 0; i < CELLS; i++) {
    const ax = x0 + i * STEP, az = z0 + j * STEP, bx = ax + STEP, bz = az + STEP;
    if (hole(ax, az, bx, bz)) continue;
    const a = [ax, H(i, j), az], b = [bx, H(i + 1, j), az], c = [bx, H(i + 1, j + 1), bz], d = [ax, H(i, j + 1), bz];
    tri.push(...a, ...b, ...c, ...a, ...c, ...d);
    tcol.push(...F(i, j), ...F(i + 1, j), ...F(i + 1, j + 1), ...F(i, j), ...F(i + 1, j + 1), ...F(i, j + 1));
  }
  // grid lines every 2 m, aligned with the world grid (each chunk draws its own lower/left edges)
  for (let j = 0; j < CELLS; j += lod) for (let i = 0; i < CELLS; i++) {
    const ax = x0 + i * STEP, z = z0 + j * STEP;
    if (!hole(ax, z, ax + STEP, z)) { lines.push(ax, H(i, j), z, ax + STEP, H(i + 1, j), z); lcol.push(...C(i, j), ...C(i + 1, j)); }
  }
  for (let i = 0; i < CELLS; i += lod) for (let j = 0; j < CELLS; j++) {
    const x = x0 + i * STEP, az = z0 + j * STEP;
    if (!hole(x, az, x, az + STEP)) { lines.push(x, H(i, j), az, x, H(i, j + 1), az + STEP); lcol.push(...C(i, j), ...C(i, j + 1)); }
  }
  // roads and mountain trails: a shaded strip on the ground, no lines (a way worn into the land, not a highway)
  const road: number[] = [], track: number[] = [], gravel: number[] = [], paved: number[] = [], kerb: number[] = [], trails = f.roads.filter((r) => r.h);
  for (const r of [...f.roads, ...f.ways]) {
    const out = r.gate === 'player' ? (r.cls === 2 ? paved : r.cls === 1 ? gravel : track) : road; // (0.280) the players' tracks, (0.282) by surface
    const hw = r.h ? r.half * 0.8 : r.half;
    for (let k = 0; k + 1 < r.pts.length; k++) {
      const [ax, az] = r.pts[k], [bx, bz] = r.pts[k + 1], L = Math.hypot(bx - ax, bz - az);
      if (L < 0.01) continue;
      const nx = -(bz - az) / L * hw, nz = (bx - ax) / L * hw;
      for (let s = 0; s < L; s += 2) {
        const e = Math.min(L, s + 2), px = ax + (bx - ax) * s / L, pz = az + (bz - az) * s / L, qx = ax + (bx - ax) * e / L, qz = az + (bz - az) * e / L;
        const mx = (px + qx) / 2, mz = (pz + qz) / 2;
        if (mx < x0 || mx >= x0 + CHUNK || mz < z0 || mz >= z0 + CHUNK) continue;
        if (holes.some((h) => inRect(h, mx, mz))) continue;
        const P = (x: number, z: number) => [x, T.heightAt(x, z) + 0.04, z];
        const a = P(px - nx, pz - nz), b = P(px + nx, pz + nz), c = P(qx + nx, qz + nz), d = P(qx - nx, qz - nz);
        out.push(...a, ...b, ...c, ...a, ...c, ...d);
        if (out === paved) { a[1] += 0.04; b[1] += 0.04; c[1] += 0.04; d[1] += 0.04; kerb.push(...a, ...d, ...b, ...c); if (Math.floor(s / 2) % 3 === 0) { const m0 = P((px + qx) / 2 - (qx - px) / 4, (pz + qz) / 2 - (qz - pz) / 4), m1 = P((px + qx) / 2 + (qx - px) / 4, (pz + qz) / 2 + (qz - pz) / 4); m0[1] += 0.06; m1[1] += 0.06; kerb.push(...m0, ...m1); } }
      }
    }
  }
  const group = new THREE.Group();
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3));
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
  // pale lines on the ice caps; elsewhere each vertex takes its biome's colour (and the snow's, high up)
  if (polar) group.add(new THREE.Mesh(fg, sharedFill()), new THREE.LineSegments(lg, sharedLine(ICE_COLOR)));
  else {
    fg.setAttribute('color', new THREE.Float32BufferAttribute(tcol, 3)); lg.setAttribute('color', new THREE.Float32BufferAttribute(lcol, 3));
    group.add(new THREE.Mesh(fg, sharedFillV()), new THREE.LineSegments(lg, sharedLineV()));
  }
  if (road.length) { const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(road, 3)); group.add(new THREE.Mesh(rg, ROAD_FILL)); }
  for (const [pts, m] of [[track, TRACK_FILL], [gravel, GRAVEL_FILL], [paved, PAVED_FILL]] as const) if (pts.length) { const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); group.add(new THREE.Mesh(rg, m)); }
  if (kerb.length) { const kg = new THREE.BufferGeometry(); kg.setAttribute('position', new THREE.Float32BufferAttribute(kerb, 3)); group.add(new THREE.LineSegments(kg, KERB)); }
  const sea = seaSheet(T, cx, cz, lat, lod); if (sea) group.add(sea);
  const swamp = !polar && shapedWorld(T.world) ? swampSheet(T, cx, cz, lat, lod) : null; if (swamp) group.add(swamp); // (0.233) the swamps' pools
  const river = f.rivers.length ? riverSheet(T, cx, cz, f.rivers) : null; if (river) group.add(river);
  const inMonument = (x: number, z: number) => f.megaliths.some(m => Math.hypot(x - m.x, z - m.z) < m.radius + 3);
  const caves = chunkCaves(T, cx, cz).filter(c => !inMonument(c.x, c.z)), wells = chunkWells(T, cx, cz).filter(w => !inMonument(w.x, w.z)), plants = chunkPlants(T, cx, cz).filter((p) => !T.claimAt(p.x, p.z, 2) && !inMonument(p.x, p.z) && !f.ways.some((w) => nearestOnRoad(w, p.x, p.z)[0] < w.half + 4));
  // felled trees and broken rocks (player changes, keyed by their index in the generated list) are left out
  const trees: Tree[] = [], stumps: Tree[] = [], rocks: Rock[] = [];
  // a claimed site is cleared: nothing grows on the levelled ground (the generated lists keep their indices)
  const giants = groveGiants(T.world, cx * CHUNK + CHUNK / 2, cz * CHUNK + CHUNK / 2, CHUNK); // the great groves' giants stand alone
  const onWay = (x: number, z: number, m: number) => f.ways.some((w) => nearestOnRoad(w, x, z)[0] < w.half + m); // (0.280) the players' tracks are cleared
  const cleared = (x: number, z: number) => inMonument(x, z) || !!T.claimAt(x, z, 1) || onWay(x, z, 3) || inGateClearing(T.world, x, z, 2) || giants.some((g) => Math.hypot(x - g.x, z - g.z) < g.r + 7);
  const looks = new Map<Tree, { b: BiomeHere; look: TreeLook; size: number }>();
  const spikes: number[][] = [], spikeList: Spike[] = polar ? [] : chunkSpikes(T.world, cx, cz).filter((k) => !cleared(k.x, k.z) && !holes.some((h) => inRect(h, k.x, k.z)) && !f.roads.some((rd) => nearestOnRoad(rd, k.x, k.z)[0] < rd.half + 1.5 + k.r) && !(T.water(k.x, k.z)?.depth));
  chunkTrees(T, cx, cz).forEach((t, i) => {
    if (t.cols.some(([x, z]) => cleared(x, z))) return;
    const b = polar ? 'ice' : biomeOfCell(T.world, t.x, t.z), as = treeIn(b, hash(t.seed, 0xb10e), TREE_SPAN[t.kind] > 0);
    if (!as) return; // (0.232) the biome does not grow it (the list keeps its index, so the saved keys hold)
    looks.set(t, { b, ...as });
    if (as.look === 'shard') spikes.push([t.x, t.y, t.z, Math.max(0.5, t.cols[0]?.[2] ?? 0.5) + 0.25, 1.4 + t.h * 0.35]); // (0.277) a shard cluster cuts too
    const k = `tree:${wrapC(cx)}:${cz}:${i}`; gatherKey.set(t, k); (ripe(k) ? trees : stumps).push(t);
  });
  chunkRocks(T, cx, cz).forEach((r, i) => { if (cleared(r.x, r.z)) return; const k = `rock:${wrapC(cx)}:${cz}:${i}`; gatherKey.set(r, k); if (ripe(k)) rocks.push(r); });
  let nodes: PlantNode[] = [];
  const marks = trailMarks(trails, x0, z0);
  if (true) {
    const pb = new PropBatch();
    for (const t of stumps) for (const [sx, sz, sr] of t.cols) { const r = Math.max(0.25, sr * 0.8); pb.box(sx - r, t.y - 0.1, sz - r, sx + r, t.y + 0.5, sz + r, GRID); }
    nodes = drawPlants(pb, plants, lod, group);
    for (const w of wells) drawWell(pb, w, T.heightAt(w.x, w.z));
    for (const cv of caves) drawCave(pb, cv, T);
    for (const m of marks) drawTrailMark(pb, m, T);
    for (const t of trees) { const lk = looks.get(t)!; pb.remap = tintOf(lk.b); drawTreeLook(pb, t, lod, lk.look, lk.size); }
    for (const k of spikeList) { // (0.277) the wastes' spikes: 1–4 pointed columns from one foot
      const y = T.heightAt(k.x, k.z), R = rng(k.seed), n = 1 + Math.floor(R() * 4);
      pb.remap = tintOf('crystal');
      for (let q = 0; q < n; q++) { const a = R() * 6.283, lean = q ? 0.25 + R() * 0.45 : R() * 0.15; crystal(pb, [k.x + Math.cos(a) * k.r * 0.3, y - 0.3, k.z + Math.sin(a) * k.r * 0.3], [Math.cos(a) * lean, 1, Math.sin(a) * lean], k.h * (q ? 0.5 + R() * 0.4 : 1), k.r * (q ? 0.35 : 0.5), q ? 4 : 6, GRID); }
      spikes.push([k.x, y, k.z, k.r * 0.8, k.h]);
    }
    for (const k of rocks) { pb.remap = tintOf(polar ? 'ice' : biomeOfCell(T.world, k.x, k.z)); pb.rock(k.x, k.y, k.z, k.r, k.h, k.sides, k.rot, GRID, k.lean); pb.remap = null; if (k.ore) pb.vein(k.x, k.y, k.z, k.r, k.h, k.sides, k.rot, ORE_COLOR[k.ore], k.lean); }
    pb.remap = null;
    if (lod === 1 && !polar) groundDeco(pb, T, cx, cz, (x, z) => cleared(x, z) || holes.some((h) => inRect(h, x, z)) || f.roads.some((rd) => nearestOnRoad(rd, x, z)[0] < rd.half + 1));
    group.add(pb.build());
  }
  localize(group, x0, z0);
  scene.add(group);
  return { cx, cz, group, lat, trees, rocks, wells, plants, nodes, caves, lod, spikes };
}
/** (0.232) A biome's colours for trees and rocks drawn through a PropBatch (bark and stone, leaves, vines). */
const tints = new Map<BiomeHere, Map<number, number>>();
function tintOf(b: BiomeHere): Map<number, number> {
  let m = tints.get(b);
  if (!m) { const L = BIOME_LOOK[b], v = new THREE.Color(L.leaf).multiplyScalar(0.55).getHex(); tints.set(b, (m = new Map([[GRID, L.line], [LEAF, L.leaf], [VINE, v]]))); }
  return m;
}
/** (0.238, the owner's report) A ruin, a wreck or a camp is drawn in the colours of the biome it stands in: its
 *  grid-green lines (and the paving's brighter green) take the biome's line colour, the mint trim and glyphs of
 *  world/wreck.ts and world/temple.ts (`TRIM_GLOW`) a paler shade of it, its fill the biome's fill. */
const TRIM_GLOW = 0x7dffc8;
function biomeLook(group: THREE.Object3D, poi: Poi) {
  const T = OW.terrain!, b: BiomeHere = Math.abs(poi.z) > POLAR_Z + 800 ? 'ice' : biomeOfCell(T.world, poi.x, poi.z), L = BIOME_LOOK[b];
  if (L.line === GRID && L.fill === FILL) return;
  const bright = new THREE.Color(L.line).lerp(new THREE.Color(0xffffff), 0.2).getHex();
  tintGroup(group, new Map([[GRID, L.line], [TILE_COLOR, bright], [TRIM_GLOW, new THREE.Color(L.line).lerp(new THREE.Color(0xffffff), 0.45).getHex()]]), [FILL, L.fill]);
}
/** (0.232) Small things on the ground by the chunk's biome (near chunks only): reeds in a swamp, tufts of grass,
 *  patches of snow, pebbles. Spots from the chunk's own hash, so every player sees the same. */
function groundDeco(pb: PropBatch, T: Terrain, cx: number, cz: number, skip: (x: number, z: number) => boolean) {
  const x0 = cx * CHUNK, z0 = cz * CHUNK, b = biomeOfCell(T.world, x0 + CHUNK / 2, z0 + CHUNK / 2), L = BIOME_LOOK[b];
  if (!L.deco) return;
  const R = rng(hash(T.world, wrapC(cx), cz, 0xdec0)), n = L.deco === 'reeds' ? 14 : L.deco === 'grass' ? 10 : 7;
  for (let k = 0; k < n; k++) {
    const x = x0 + R() * CHUNK, z = z0 + R() * CHUNK, a = R() * 6.283, s = 0.6 + R() * 0.8;
    if (skip(x, z) || biomeOfCell(T.world, x, z) !== b) continue;
    const w = T.water(x, z), y = T.heightAt(x, z);
    if (w && w.depth > (L.deco === 'reeds' ? 0.6 : 0.05)) continue;
    if (L.deco === 'reeds') for (let r = 0; r < 5; r++) { const ox = x + (R() - 0.5) * 0.8, oz = z + (R() - 0.5) * 0.8, h = 1 + R() * 1.2; pb.seg(L.leaf, [ox, y - 0.1, oz], [ox + (R() - 0.5) * 0.3, y + h, oz + (R() - 0.5) * 0.3]); if (R() < 0.4) pb.seg(L.line, [ox, y + h * 0.8, oz], [ox, y + h * 0.95, oz]); }
    else if (L.deco === 'grass') for (let r = 0; r < 5; r++) { const d = a + r * 1.25; pb.seg(L.leaf, [x, y, z], [x + Math.cos(d) * 0.3 * s, y + 0.45 * s + R() * 0.2, z + Math.sin(d) * 0.3 * s]); }
    else if (L.deco === 'snow') { const c = 0xe8fff8, r0 = 0.8 + R() * 1.4, pts: number[][] = []; for (let q = 0; q <= 6; q++) { const d = a + q / 6 * 6.283; pts.push([x + Math.cos(d) * r0 * (0.7 + 0.3 * Math.sin(q * 2.1)), T.heightAt(x + Math.cos(d) * r0, z + Math.sin(d) * r0) + 0.05, z + Math.sin(d) * r0]); } pb.line(c, ...pts); }
    else pb.rock(x, y - 0.05, z, 0.18 + R() * 0.25, 0.15 + R() * 0.2, 5, a, L.line);
  }
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
/** (0.280) Rebuild every loaded chunk within r of a polyline (a track finished there: the trees along it go). */
/** (0.282, D3) The road surface at a point: the heroes' tracks by their surface, the old roads, mountain trails as dirt. */
export function surfaceAt(x: number, z: number): Surface {
  const T = OW.terrain; if (!T) return 'off';
  const f = T.chunkFeatures(Math.floor(x / CHUNK), Math.floor(z / CHUNK));
  let best: Surface = 'off', rank = -1;
  const RANK: Record<Surface, number> = { off: -1, dirt: 0, road: 1, gravel: 2, paved: 3 };
  for (const w of f.ways) if (nearestOnRoad(w, x, z)[0] < w.half + 0.8) { const k: Surface = w.cls === 2 ? 'paved' : w.cls === 1 ? 'gravel' : 'dirt'; if (RANK[k] > rank) { rank = RANK[k]; best = k; } }
  for (const r of f.roads) if (nearestOnRoad(r, x, z)[0] < r.half + 0.8) { const k: Surface = r.h ? 'dirt' : 'road'; if (RANK[k] > rank) { rank = RANK[k]; best = k; } }
  if (best === 'off' && (bridgeDeck(x, z) !== null || pierDeck(x, z) !== null)) best = 'road';
  return best;
}
export function rebuildChunksAlong(pts: [number, number][], r: number) {
  for (const c of [...OW.chunks.values()]) {
    const x0 = c.cx * CHUNK, z0 = c.cz * CHUNK, mx = x0 + CHUNK / 2, mz = z0 + CHUNK / 2;
    const [d] = nearestOnRoad({ id: '', from: 0, to: 0, gate: '', half: 0, pts: pts.map(([x, z]) => [nearX(x, mx), z] as [number, number]) }, mx, mz);
    if (d < r + CHUNK * 0.71) { OW.chunks.set(ckey(c.cx, c.cz), buildChunk(c.cx, c.cz, c.lod)); dropChunk(c); }
  }
}
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
    // on a stone wall the sign hangs above the arch; on a fence it hangs on the gate frame's crossbeam
    const stone = vm.tier >= STONE_TIER, back = stone ? 1.5 : 1.3;
    g.add(wallSign(vm.name.toUpperCase(), '#ffd060', { x: gate.x - o[0] * back, z: gate.z - o[1] * back }, o, vm.y + (stone ? 5.3 : WALL_TIERS[vm.tier].gate + 0.55)));
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
  g.add(wallSign(tl('NOTICE BOARD'), '#ffd060', { x, z: z + 0.1 }, [0, 1], y + 3.4));
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
  g.add(wallSign(tl('MAP'), '#9dffe0', { x, z: z + 0.5 }, [0, 1], y + 3.5));
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
  g.add(wallSign(tl('VEHICLES'), '#ffd060', { x: YARD.sign.x, z: YARD.sign.z }, [0, -1], y + 3.5));
  return g;
}
/** Residents of the other villages: everyone has their own name (Gridholm keeps its familiar faces). */
const FOLK = ['Aldo', 'Bera', 'Casimir', 'Dara', 'Emil', 'Frida', 'Goran', 'Hela', 'Ivo', 'Jana', 'Kasper', 'Lida', 'Marek', 'Nela', 'Oskar', 'Petra', 'Rolf', 'Sabina', 'Tomek', 'Una', 'Vojtek', 'Wanda', 'Zenon', 'Ilse'];
function residentName(vm: VillageMap, role: NpcRole, i: number): string {
  if (vm.home) return NPC_INFO[role].name!;
  const n = FOLK[((vm.seed >>> 0) + i * 7) % FOLK.length];
  return role === 'elder' ? tl('Elder ') + n : n;
}
function loadVillageStruct(poi: Poi): Structure {
  const T = OW.terrain!, y = T.padY(poi), home = poi.id === GRIDHOLM_ID;
  const vm = generateVillage(villageSeed(T.world, poi), y, poi.x, poi.z, poi.name, home, wallOf(G.char.towns[poi.id]));
  const st = G.char.towns[poi.id];
  const pop = peopleAt(vm.seed, home, st, G.char.time);
  settlementVillage(vm, st, pop, (i) => !!st?.homes?.[i] || i === myHome(G.char, poi.id)); // a house a hero bought stands whole
  // the fence of a village that is not walled in stone yet only collides: it is drawn as stakes by villageDeco
  const grid = VoxelGrid.surface(vm.ops, vm.rect, y), shown = vm.tier >= STONE_TIER ? grid : VoxelGrid.surface(vm.shown, vm.rect, y);
  const { group, mesh } = voxelObject(shown, Infinity, OUTLINE);
  group.add(villageDeco(vm, y, poi.id), gateSign(vm));
  group.add(boardDeco(vm, y));
  group.add(mapBoardDeco(vm, y));
  group.add(drawPower(vm, T, poi.id));
  group.add(drawIndustry(vm, T, poi.id));
  group.add(drawFarms(vm, T, poi.id));
  group.add(drawGuards(vm, T, poi.id));
  group.add(drawWorks(vm, T, poi.id));
  group.add(drawStations(vm, T, poi.id));
  group.add(drawHall(vm, T, poi.id));
  group.add(drawSettlementSites(vm, T, poi.id));
  const lamps: THREE.Object3D[] = []; group.traverse((o) => { if (o.name === 'lamp') lamps.push(o); }); setPlantLamps(poi.id, lamps);
  scene.add(group);
  const npcs: Npc[] = [];
  vm.buildings.forEach((b, i) => { if (b.role !== 'house' && b.condition !== 0 && b.condition !== 1) npcs.push(makeNpc(b.role, residentName(vm, b.role, i), V(b.home!.x, b.home!.y, b.home!.z), b)); });
  if (vm.home && (mechanicHere(st) || !!G.char.garage?.length)) { // (your own order keeps his yard open)
    // the mechanic (in a new world once the power plant stands and the village digs its own goods: Oskar's cousin) and his yard just outside the north gate
    npcs.push(makeNpc('dealer', NPC_INFO.dealer.name!, V(YARD.dealer.x, y, YARD.dealer.z), null));
    group.add(yardDeco(y));
  }
  const taken = new Set(npcs.map((n) => n.name.replace('Elder ', '')));
  const folk = vm.home ? VILLAGER_NAMES : FOLK.slice(((vm.seed >>> 0) + 3) % 12).filter((n) => !taken.has(n));
  // the captain of the guard walks the inside of the wall, from gate to gate and past the towers
  const gname = vm.home ? NPC_INFO.guard.name! : folk.pop()!, poly = wallPolygon(villageSides(vm.seed, vm.home)), edge = vm.walk.filter(([x, z]) => !insideWall(poly, x - vm.ox, z - vm.oz, 6)); // walk cells within 6 m of the wall
  const start = edge.length ? edge[0] : vm.walk[0], guard = makeNpc('guard', gname, V(start[0] + 0.5, y, start[1] + 0.5), null);
  guard.route = edge; npcs.push(guard);
  folk.slice(0, progressive(st) ? Math.max(0, Math.min(folk.length, Math.floor(pop) - npcs.length)) : Math.max(2, (vm.home ? 12 : 8) - recentDead(poi.id))).forEach((nm) => { const c = vm.walk[(Math.random() * vm.walk.length) | 0]; npcs.push(makeNpc('villager', nm, V(c[0] + 0.5, y, c[1] + 0.5), null)); });
  for (const n of npcs) n.town = vm.name;
  W.npcs.push(...npcs); W.villageWalk = vm.walk;
  OW.village = vm; setLadders(poi.id, [...vm.towers.flatMap((t) => (t.ladder ? [t.ladder] : [])), ...vm.walkLadders], y); setWalkways(poi.id, vm.walkway, vm.walkLadders, y); for (const h of villageHooks) h.load(poi.id, vm, y); setHouses(poi.id, vm); setDoors(poi.id, vm);
  return { poi, grid, group, edges: mesh, doors: [], stairs: [], npcs, village: vm };
}
export let enterRuin: (id: number) => void = () => {};
export function setEnterRuin(f: (id: number) => void) { enterRuin = f; }
function loadRuinStruct(poi: Poi): Structure {
  const T = OW.terrain!, y = T.padY(poi), rm = generateRuin(T.world, poi, y);
  const grid = VoxelGrid.surface(rm.ops, rm.rect, y);
  const { group, mesh } = voxelObject(VoxelGrid.surface(rm.shown, rm.rect, y), Infinity, OUTLINE); // (0.241) the wall stones are drawn by world/temple.ts
  // fragments of the old paving
  const tlv: number[] = [];
  for (const t of rm.tiles) {
    const a = 0.12, b = 0.88, yy = y + 0.03;
    tlv.push(t.x + a, yy, t.z + a, t.x + b, yy, t.z + a, t.x + b, yy, t.z + a, t.x + b, yy, t.z + b, t.x + b, yy, t.z + b, t.x + a, yy, t.z + b, t.x + a, yy, t.z + b, t.x + a, yy, t.z + a);
  }
  const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(tlv, 3));
  group.add(new THREE.LineSegments(tg, sharedLine(TILE_COLOR)));
  const tpl = drawTemple(rm.temple, poi.id); group.add(tpl.g, drawSettlementComms(poi, T));
  biomeLook(group, poi);
  scene.add(group);
  const s: Structure = { poi, grid, group, edges: mesh, doors: [], stairs: [], npcs: [], blocks: tpl.blocks, solids: tpl.solids };
  OW.structs.set(poi.id, s); // the door below is placed through the shared space
  const p = rm.portal, placed = tryPlaceDoor(space, { axis: p.axis, m: p.m, c: p.c, stair: true, y0: y }, [])!;
  const st = makeStair(p, placed, 0, '▼ ' + poi.name.toUpperCase(), tl('Stairs down into the ') + poi.name, () => enterRuin(poi.id));
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
  biomeLook(group, poi);
  scene.add(group);
  const s: Structure = { poi, grid, group, edges: mesh, doors: [], stairs: [], npcs: [] };
  OW.structs.set(poi.id, s);
  const p = wm.portal, placed = tryPlaceDoor(space, { axis: p.axis, m: p.m, c: p.c, stair: true, y0: y }, [])!;
  const st = makeStair(p, placed, 0, '▼ ' + poi.name.toUpperCase(), tl('Hatch into the ') + poi.name, () => enterRuin(poi.id));
  st.ruinId = poi.id;
  s.doors.push(st.door); s.stairs.push(st);
  W.portals.push(st);
  return s;
}
/** The old hangar with the shuttle (world/hangar.ts): voxel walls and cradle, the arched roof and the shuttle as props. */
function loadHangarStruct(poi: Poi): Structure {
  const T = OW.terrain!, y = T.padY(poi);
  const grid = VoxelGrid.surface(hangarOps(poi, y), poi.rect, y);
  const { group, mesh } = voxelObject(grid, Infinity, OUTLINE);
  group.add(drawHangar(poi, y));
  scene.add(group);
  return { poi, grid, group, edges: mesh, doors: [], stairs: [], npcs: [] };
}
/** Bandit camp: colliding timber palisade and crates, tents, campfire and treasure stash. */
function loadCampStruct(poi: Poi): Structure {
  const T = OW.terrain!, y = T.padY(poi), cm = generateCamp(T.world, poi, y);
  const grid = VoxelGrid.surface(cm.ops, cm.rect, y);
  const { group, mesh } = voxelObject(VoxelGrid.surface(cm.ops.filter(o => !cm.palisade.includes(o)), cm.rect, y), Infinity, OUTLINE);
  const pb = new PropBatch();
  const pal = new Set(cm.palisade.map((o) => o.x + ',' + o.z));
  for (const o of cm.palisade) {
    const alongX = pal.has(o.x - 1 + ',' + o.z) || pal.has(o.x + 1 + ',' + o.z) || !(pal.has(o.x + ',' + (o.z - 1)) || pal.has(o.x + ',' + (o.z + 1))); // the run's direction at this cell
    for (const offset of [.25, .75]) {
      const x = o.x + (alongX ? offset : .5), z = o.z + (alongX ? .5 : offset);
      const h = 3 + (hash(cm.id, o.x * 2 + offset * 4, o.z) % 100) / 500;
      const ring = (yy: number) => Array.from({ length: 8 }, (_, k) => {
        const angle = (k + .5) * Math.PI / 4;
        return [x + Math.cos(angle) * (alongX ? .26 : .5), yy, z + Math.sin(angle) * (alongX ? .5 : .26)];
      });
      const bottom = ring(y), top = ring(y + h), tip = [x, y + h + .4, z];
      for (let k = 0; k < 8; k++) {
        const j = (k + 1) % 8;
        pb.face(bottom[k], bottom[j], top[j], top[k]); pb.face(top[k], top[j], tip);
        pb.seg(0xb8b060, bottom[k], top[k]); pb.seg(0xb8b060, top[k], top[j]); pb.seg(0xb8b060, top[k], tip);
      }
    }
    for (const h of [.8, 2.1]) {
      if (alongX) pb.box(o.x, y + h, o.z + .05, o.x + 1, y + h + .12, o.z + .95, 0x8fb89a);
      else pb.box(o.x + .05, y + h, o.z, o.x + .95, y + h + .12, o.z + 1, 0x8fb89a);
    }
  }
  for (const t of cm.tents) {
    pb.gableRoof(t.x0, t.z0, t.x1, t.z1, y, 2.3, 0xb8b060);
    const along = t.x1 - t.x0 >= t.z1 - t.z0;
    if (along) pb.line(0xb8b060, [t.x0, y, (t.z0 + t.z1) / 2 - 0.6], [t.x0, y + 1.5, (t.z0 + t.z1) / 2], [t.x0, y, (t.z0 + t.z1) / 2 + 0.6]);
    else pb.line(0xb8b060, [(t.x0 + t.x1) / 2 - 0.6, y, t.z0], [(t.x0 + t.x1) / 2, y + 1.5, t.z0], [(t.x0 + t.x1) / 2 + 0.6, y, t.z0]);
  }
  for (let i = 0; i < 7; i++) { const a = i / 7 * 6.283; pb.rock(cm.fire.x + Math.cos(a) * 0.9, y - 0.05, cm.fire.z + Math.sin(a) * 0.9, 0.28, 0.25, 4, a, GRID); }
  // the stash: a heavy crate
  const sx = cm.stash.x, sz = cm.stash.z;
  drawClosedChest(pb, sx, y, sz, 'locker');
  group.add(pb.build());
  const flames = new THREE.LineSegments(new THREE.BufferGeometry(), addMat(0xffb347));
  flames.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(10 * 6), 3));
  flames.frustumCulled = false; flames.position.set(cm.fire.x, y, cm.fire.z); group.add(flames);
  biomeLook(group, poi);
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
  const s = poi.type === 'village' ? loadVillageStruct(poi) : poi.type === 'camp' ? loadCampStruct(poi) : poi.type === 'wreck' ? loadWreckStruct(poi) : poi.type === 'hangar' ? loadHangarStruct(poi) : loadRuinStruct(poi);
  localize(s.group, poi.x, poi.z);
  OW.structs.set(poi.id, s);
  setStreakSources([...OW.structs.values()].map((q) => q.edges));
}
/** Every village loaded near you (POI id and map). */
export const loadedVillages = () => [...OW.structs.values()].filter((s) => s.village).map((s) => ({ id: s.poi.id, poi: s.poi, vm: s.village! }));
/** The loaded village of that name (its POI id and map), for the residents who talk about it. */
export function loadedVillage(name: string): { id: number; vm: VillageMap } | null {
  for (const s of OW.structs.values()) if (s.village && s.village.name === name) return { id: s.poi.id, vm: s.village };
  return null;
}
/** Build a structure again (a village's wall was raised). */
export function reloadStruct(id: number) {
  const s = OW.structs.get(id);
  if (!s) return;
  dropStruct(s); loadStruct(s.poi);
}
function dropStruct(s: Structure) {
  forgetSettlement(s.poi.id);
  scene.remove(s.group); s.group.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
  for (const d of s.doors) { scene.remove(d.g); W.doors.splice(W.doors.indexOf(d), 1); }
  for (const st of s.stairs) { disposeStair(st); W.portals.splice(W.portals.indexOf(st), 1); }
  for (const n of s.npcs) { scene.remove(n.g); W.npcs.splice(W.npcs.indexOf(n), 1); }
  if (s.village && OW.village === s.village) { OW.village = null; W.villageWalk = []; } // another village may have loaded meanwhile
  if (s.camp) despawnCamp(s.poi.id);
  if (s.village) { forgetPower(s.poi.id); forgetIndustry(s.poi.id); dropLadders(s.poi.id); dropWalkways(s.poi.id); for (const h of villageHooks) h.drop(s.poi.id); forgetGuards(s.poi.id); forgetWorks(s.poi.id); forgetStations(s.poi.id); forgetHall(s.poi.id); dropHouses(s.poi.id); dropDoors(s.poi.id); }
  OW.structs.delete(s.poi.id);
  setStreakSources([...OW.structs.values()].map((q) => q.edges));
}

function updateStructs(x: number, z: number) {
  for (const p of poisNear(OW.terrain!.world, x, z, STRUCT_LOAD)) if (rectDist(p.rect, x, z) < STRUCT_LOAD) loadStruct(p);
  for (const s of [...OW.structs.values()]) if (rectDist(s.poi.rect, x, z) > STRUCT_UNLOAD) dropStruct(s);
}

// ---------- streaming ----------
/**
 * (0.245.1) When levelled ground changes (a claim, a field, a settlement's yard: `Terrain.rev`), every loaded chunk is
 * checked against the new heights, a few a frame, and rebuilt if they moved, so no chunk keeps old edges beside a
 * rebuilt neighbour (a crack you could see through). `rebuildChunksNear` still rebuilds the nearest at once.
 */
let seenRev = -1, recheck: number[] = [];
function recheckChunks(t0: number, budgetMs: number) {
  const T = OW.terrain!;
  if (T.rev !== seenRev) { seenRev = T.rev; recheck = [...OW.chunks.keys()]; }
  while (recheck.length && performance.now() - t0 < budgetMs) {
    const k = recheck.pop()!, c = OW.chunks.get(k);
    if (!c) continue;
    const a = T.lattice(c.cx, c.cz);
    if (a === c.lat) continue;
    let moved = false;
    for (let i = 0; i < a.length && !moved; i++) moved = Math.abs(a[i] - c.lat[i]) > 1e-4;
    if (!moved) { c.lat = a; continue; }
    OW.chunks.set(k, buildChunk(c.cx, c.cz, c.lod)); dropChunk(c);
  }
}
/** Queue chunks around the player; unload far ones. Cheap unless the player crossed a chunk border. */
export function updateStreaming(budgetMs = 4) {
  const x = G.pos.x, z = G.pos.z, pcx = Math.floor(x / CHUNK), pcz = Math.floor(z / CHUNK), k = pcx + ',' + pcz;
  if (k !== lastChunk) {
    lastChunk = k;
    queue = [];
    const LR = G.fly ? LOAD_R * 2 : nearMegalith(x, z) ? LOAD_R + 2 : LOAD_R; // flying (dev) sees further
    for (let i = -LR; i <= LR; i++) for (let j = -LR; j <= LR; j++) {
      const c = OW.chunks.get(ckey(pcx + i, pcz + j)), lod = lodFor(pcx + i, pcz + j, pcx, pcz);
      if (!c || c.lod !== lod) queue.push([pcx + i, pcz + j, lod]);
    }
    queue.sort((a, b) => Math.hypot(b[0] - pcx, b[1] - pcz) - Math.hypot(a[0] - pcx, a[1] - pcz)); // nearest last (popped first)
    for (const c of [...OW.chunks.values()]) if (Math.max(Math.abs(c.cx - pcx), Math.abs(c.cz - pcz)) > (G.fly ? LOAD_R * 2 + 2 : nearMegalith(x, z) ? UNLOAD_R + 2 : UNLOAD_R)) { dropChunk(c); OW.chunks.delete(ckey(c.cx, c.cz)); }
    updateStructs(x, z);
    syncWorldGates(OW.terrain!, x, z);
    syncMegaliths(OW.terrain!.world, x, z);
    syncLakes(x, z);
    syncFound(OW.terrain!, x, z);
    syncQuestWorld();
  }
  const t0 = performance.now();
  recheckChunks(t0, budgetMs);
  while (queue.length && (performance.now() - t0 < budgetMs)) {
    const [cx, cz, lod] = queue.pop()!, old = OW.chunks.get(ckey(cx, cz));
    if (old && old.lod === lod) continue;
    OW.chunks.set(ckey(cx, cz), buildChunk(cx, cz, lod)); // swap in the new one first, then drop the old: no gap
    if (old) dropChunk(old);
  }
}

/** The giants of the great groves (gen/resource-sites.ts) within `r` + 60 m of (x, z), world: only villages of the new
 *  rules with a grove. Pure of the saved state (the shared towns), so every player sees the same. */
export function groveGiants(world: number, x: number, z: number, r: number): { x: number; z: number; r: number; h: number; vid: number; i: number; y?: number }[] {
  const out: { x: number; z: number; r: number; h: number; vid: number; i: number }[] = [];
  for (const v of poisNear(world, x, z, r + 320)) {
    if (v.type !== 'village') continue;
    const s = G.char.towns[v.id];
    if (!progressive(s) || depositsOf(s).grove === false) continue;
    const lp = plotsOf(world, v.id).lumber, px = v.x - 36 + lp.x, pz = v.z - 36 + lp.z;
    if (Math.hypot(px - x, pz - z) > r + 100) continue;
    groveTrees(world, v.id).forEach((g, i) => out.push({ x: px + g.u, z: pz + g.v, r: g.r, h: g.h, vid: v.id, i }));
  }
  return out;
}
/**
 * (0.181, the owner's rule) The ground round the villages: nothing is levelled in advance. A building site, a
 * settlement's yard or its warehouse gets a gentle pad only once it stands or is going up (`projectBegun`): its own
 * mean natural height, keeping some of the land's relief (`SITE_PAD.soft`; the warehouse, which vehicles drive into,
 * is flat), eased back over a wide blend. Called again when a village's look changes (`settlementsChanged`).
 */
const padSig = new Map<number, string>();
function villagePads(w: number): Pad[] {
  padSig.clear();
  const all = allVillages(w).map((v) => { const p = padsOf(w, v); padSig.set(v.id, sigOf(p)); return p; });
  return all.flat();
}
const sigOf = (p: Pad[]) => p.map((q) => `${q.poi.rect.x0},${q.poi.rect.z0},${q.poi.rect.x1},${q.poi.rect.z1}`).join(';');
function padsOf(w: number, v: Poi): Pad[] {
  const levelled = sitePads(w, v, G.char.towns[v.id]);
  const pads = [v].filter((v) => progressive(G.char.towns[v.id])).flatMap((v) => {
    const s = G.char.towns[v.id], ox = v.x - 36, oz = v.z - 36;
    const plots = Object.entries(plotsOf(w, v.id)).filter(([k]) => projectAvailable(s, k as ResourceProject) && projectBegun(s, k as ResourceProject));
    const wh = warehouseSpot(s), rects = [...(wh ? [{ rect: warehouseAt(wh) as Rect, depression: false, soft: 0 }] : []), ...plots.map(([k, p]) => ({ rect: { x0: p.x - RESOURCE_YARD.halfX, x1: p.x + RESOURCE_YARD.halfX, z0: p.z - RESOURCE_YARD.halfZ, z1: p.z + RESOURCE_YARD.halfZ }, depression: k === 'mine', soft: SITE_PAD.soft }))];
    return rects.map(({ rect: r, depression, soft }, i) => {
      const rect = { x0: ox + r.x0, x1: ox + r.x1, z0: oz + r.z0, z1: oz + r.z1 };
      return { y: meanGround(w, rect), surface: true, depression, soft, poi: { ...v, id: -v.id * 8 - i - 1, rect, flat: 3, blend: SITE_PAD.blend } };
    });
  });
  return [...levelled, ...pads];
}
let padT = 0;
/**
 * Once a second (main loop): a village whose building sites in use changed (a project begun or done, a works or
 * station going up) gets its ground eased under them; the chunks round it and the village are redrawn. The same on
 * every player's game, from the shared towns.
 */
export function syncVillagePads(dt: number) {
  if ((padT -= dt) > 0 || !OW.terrain || G.char.loc !== 'overworld') return;
  padT = 1;
  const w = OW.terrain.world; let changed: Poi[] = [];
  for (const v of allVillages(w)) { const s = sigOf(padsOf(w, v)); if (padSig.get(v.id) !== s) { padSig.set(v.id, s); changed.push(v); } }
  if (!changed.length) return;
  OW.terrain.setSettlementPads(allVillages(w).flatMap((v) => padsOf(w, v)));
  for (const v of changed) { rebuildChunksNear(v.x, v.z, 420); if (OW.structs.has(v.id)) reloadStruct(v.id); }
}
/** Load (or reload) the open world of the current character's seed, synchronously around (x, z). */
export function openWorld(x: number, z: number) {
  initializeSettlements(G.char); applyLayouts(G.char); planksForLogs(G.char); syncConvoyStart(0, true); // (0.214) convoys only once a depot stands // (0.165: also after a server's world is taken over; 0.209 the editor's village layouts)
  for (const v of G.char.vehicles) { // (0.198) the villages grew 12 m a side: a vehicle left just outside an old wall (Kuba's old bays) moves out with it
    const p = villageContaining(G.char.world, v.x, v.z);
    if (!p) continue;
    const dx = wrapDx(v.x - p.x), dz = v.z - p.z;
    if (Math.abs(dz) >= Math.abs(dx)) v.z = p.z + Math.sign(dz || -1) * (Math.abs(dz) + 12); else v.x = p.x + Math.sign(dx) * (Math.abs(dx) + 12);
  }
  const w = G.char.world;
  if (!OW.terrain || OW.terrain.world !== w) { OW.terrain = new Terrain(w); riversOf(w); } // the rivers are worked out once, while the world loads
  OW.terrain.setClaims([...G.char.claims, ...fieldClaims(G.char.towns), ...portClaims(w, G.char.outposts)]); // bases and the villages' fields are levelled
  OW.terrain.setSettlementPads(villagePads(w));
  OW.terrain.setWays(terrainWays(G.char.proads, G.char.time)); // (0.280) the players' finished tracks
  primeInstalls(w, [...G.char.claims, ...fieldClaims(G.char.towns), ...portClaims(w, G.char.outposts)]); // the installations' sites are worked out in a worker meanwhile
  closeWorld();
  G.water = (px, pz) => (inStructure(px, pz) ? null : OW.terrain!.water(px, pz));
  G.space = space; G.ground = groundAt; G.obstacle = (px, py, pz, r) => settlementHit(px, py, pz, r) || colossusBodyHit(px, py, pz, r) || templeHit(px, py, pz, r) || crystalHit(px, py, pz, r) || colossusHit(px, py, pz, r) || megalithHit(px, py, pz, r) || worldGateHit(px, py, pz, r) || treeHit(px, py, pz, r) || vehicleHit(px, py, pz, r) || caravanHit(px, py, pz, r) || peerCarHit(px, py, pz, r) || ambushHit(px, py, pz, r) || baseHit(px, py, pz, r) || ladderHit(px, py, pz, r) || walkHit(px, py, pz, r) || guardHit(px, py, pz, r) || houseHit(px, py, pz, r) || doorHit(px, py, pz, r) || podHit(px, py, pz, r) || installHit(px, py, pz, r) || cityHit(px, py, pz, r) || hallHit(px, py, pz, r) || bridgeHit(px, py, pz, r) || pierHit(px, py, pz, r) || lighthouseHit(px, py, pz, r) || boatHit(px, py, pz, r) || shipHit(px, py, pz, r) || gondolaHit(px, py, pz, r) || toxicHit(px, py, pz, r) || lodeHit(px, py, pz, r) || portHit(px, py, pz, r) || campHit(px, py, pz, r) || fallHit(px, py, pz, r);
  G.floor = (x, y, z) => Math.max(rockFloor(x, y, z), templeFloor(x, y, z), settlementFloor(x, y, z), megalithFloor(x, y, z), baseFloor(x, y, z), ladderFloor(x, y, z), walkFloor(x, y, z), bridgeFloor(x, y, z), pierFloor(x, y, z), shipFloor(x, y, z), gondolaFloor(x, y, z)); G.rayBlock = (o, d, t) => natureRay(o, d, settlementRay(o, d, megalithRay(o, d, worldGateRay(o, d, cityRay(o, d, doorRay(o, d, houseRay(o, d, baseRay(o, d, t)))))))); G.solid = (p) => settlementSolid(p) || megalithHit(p.x, p.y, p.z, 0) || worldGateHit(p.x, p.y, p.z, 0) || baseSolid(p) || houseSolid(p);
  foeRules.blocked = (p) => megalithHit(p.x, p.y, p.z, .7) || nearVillage(p.x, p.z) < 2;
  foeRules.body = foeBody;
  foeRules.playerSafe = () => inVillage(G.pos.x, G.pos.z) && !raidHere(); // no safe place while bandits raid it
  foeRules.ground = (px, pz) => OW.terrain!.heightAt(px, pz);
  foeRules.shielded = () => insideVehicle(); // a foe's turn against another player: your cab is not theirs
  foeRules.shieldHit = (dmg) => hitOccupiedVehicle(dmg);
  setCrash(OW.terrain);
  updateStructs(x, z);
  syncWorldGates(OW.terrain, x, z);
  syncMegaliths(w, x, z);
  const pcx = Math.floor(x / CHUNK), pcz = Math.floor(z / CHUNK);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) OW.chunks.set(ckey(pcx + i, pcz + j), buildChunk(pcx + i, pcz + j));
  lastChunk = '';
  const T = OW.terrain;
  spawnVehicles({
    height: (px, pz) => Math.max(T.heightAt(px, pz), bridgeDeck(px, pz) ?? -Infinity, pierDeck(px, pz) ?? -Infinity), // over a bridge or a pier, its deck
    water: (px, pz) => (bridgeDeck(px, pz) !== null || pierDeck(px, pz) !== null ? 0 : T.water(px, pz)?.depth ?? 0),
    blocked: (px, pz, r) => settlementHit(px, T.heightAt(px, pz), pz, r) || megalithHit(px, T.heightAt(px, pz) + .5, pz, r) || worldGateHit(px, T.heightAt(px, pz) + .5, pz, r) || structBlocks(px, pz, r, T.heightAt(px, pz)) || treeHit(px, T.heightAt(px, pz) + 0.5, pz, r) || crystalHit(px, T.heightAt(px, pz), pz, r) || colossusHit(px, T.heightAt(px, pz), pz, r) || ambushHit(px, 0, pz, r) || peerCarHit(px, T.heightAt(px, pz) + 0.5, pz, r) || cityHit(px, T.heightAt(px, pz) + 0.5, pz, r) || hallHit(px, T.heightAt(px, pz), pz, r) || bridgeHit(px, (bridgeDeck(px, pz) ?? -99) + 0.5, pz, r), // a bridge's rails keep you on its deck
    ceiling: hallCeiling,
    surface: (px, pz) => surfaceAt(px, pz),
  });
  syncFound(T, x, z);
  const envHooks = {
    ground: (px: number, pz: number) => T.heightAt(px, pz),
    biome: (px: number, pz: number): BiomeHere => (Math.abs(pz) > POLAR_Z + 800 ? 'ice' : biomeOfCell(T.world, px, pz)), // (0.240) where the wildlife lives
    danger,
    nearRuin: (px: number, pz: number) => poisNear(T.world, px, pz, 90).some((p) => (p.type === 'ruin' || p.type === 'wreck') && rectDist(p.rect, px, pz) < 60),
    water: (px: number, pz: number) => T.water(px, pz),
    forbidden: (px: number, pz: number) => megalithHit(px, T.heightAt(px, pz), pz, .7) || inGateClearing(T.world, px, pz, 4) || nearVillage(px, pz) < 35 || baseHit(px, T.heightAt(px, pz), pz, 0.7) || cityHit(px, T.heightAt(px, pz) + 0.5, pz, 0.7) || (T.water(px, pz)?.depth ?? 0) > 0.5 || [...OW.structs.values()].some((s) => rectDist(s.poi.rect, px, pz) < 1) || (Math.hypot(px - G.pos.x, pz - G.pos.z) > STRUCT_LOAD - 30 && poisNear(T.world, px, pz, 40).some((p) => rectDist(p.rect, px, pz) < 1)), // (0.235) places not loaded yet too: spawns come from further off
  };
  setCreatureEnv(envHooks);
  setRobotEnv(envHooks);
  setBanditEnv(envHooks);
  setRaiderEnv({ terrain: T, danger, forbidden: envHooks.forbidden });
  // camps loaded before the bandit hooks existed get their bandits now
  for (const s of OW.structs.values()) if (s.camp) spawnCamp(s.camp);
}
export function closeWorld() {
  clearMegaliths();
  clearWorldGates();
  dropGarrisons(); clearVehicles(); dropCrash(); dropInstalls(); dropCities(); dropToxic(); dropLodes(); dropCrystals(); dropColossi(); dropPorts(); clearCarriers(); clearHubTrucks(); clearSkyShips(); clearCargoDrones(); dropCamps(); dropPowerLines(); dropCommuters(); clearBridges(); clearPiers();
  setCreatureEnv(null); clearCreatures(); clearIntents();
  setRobotEnv(null); clearRobots();
  setBanditEnv(null); clearBandits();
  setRaiderEnv(null); clearRaiders();
  for (const c of OW.chunks.values()) dropChunk(c);
  OW.chunks.clear();
  for (const s of [...OW.structs.values()]) dropStruct(s);
  clearLakes();
  queue = []; lastChunk = '';
  G.water = null;
  foeRules.blocked = () => false; foeRules.body = () => false; foeRules.playerSafe = () => false; foeRules.ground = null; foeRules.shielded = () => false; foeRules.shieldHit = () => {};
  clearVillageRaid(); clearOutpostRaid(); clearRouteTrucks();
  clearCaravans();
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
    if (wallWarnT <= 0) { wallWarnT = 5; logLine(tl('The ice wall of the pole rises sheer before you. There is no way on.')); }
  }
  const x = G.pos.x;
  if (x >= X_MIN && x < X_MIN + WORLD_W) return;
  const d = x < X_MIN ? WORLD_W : -WORLD_W;
  G.pos.x += d;
  // unsaved foes are simply let go (new ones turn up); loot on the ground moves along
  clearCreatures(); clearBandits(); clearRaiders(); clearRobots(); clearIntents();
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
  syncWorldGates(OW.terrain!, G.pos.x, G.pos.z);
  syncMegaliths(OW.terrain!.world, G.pos.x, G.pos.z);
  showToast(tl('You have gone round the world'));
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
  if (Math.abs(z) > POLE_Z - 400) return z < 0 ? tl('North Pole ice wall') : tl('South Pole ice wall');
  if (Math.abs(z) > POLAR_Z) return z < 0 ? tl('Northern ice cap') : tl('Southern ice cap');
  const lv = Math.round(danger(x, z)), tag = !G.god ? '' : lv ? TL` · danger ${lv}` : tl(' · calm'); // (0.246) the danger shows only in god mode
  if (G.char.claims.some((c) => claimDist(c, x, z) < CLAIM.r)) return tl('Your claim') + tag;
  { const segs = OW.terrain!.chunkFeatures(Math.floor(x / CHUNK), Math.floor(z / CHUNK)).rivers, r = riverNear(segs, x, z); if (r && r.d < r.half + 25) return riversOf(OW.terrain!.world).list[r.seg.r].name + tag; }
  for (const cv of loadedCaves()) if (Math.hypot(cv.x - x, cv.z - z) < 30) return cv.name + tag;
  { const ins = installAt(OW.terrain!, x, z, 25); if (ins) return ins.name + tag; }
  { const mn = megalithName(x, z); if (mn) return mn + tag; }
  { const cn = cityName(x, z); if (cn) return cn + cityVaultHint(x,z) + tag; }
  { const f = toxicName(x, z); if (f) return f + tag; }
  { const l = lodeName(x, z) ?? portNameAt(x, z) ?? crystalName(x, z) ?? colossusName(x, z); if (l) return l + tag; }
  for (const r of OW.terrain!.chunkFeatures(Math.floor(x / CHUNK), Math.floor(z / CHUNK)).roads) {
    if (!r.h) continue;
    const top = r.pts[r.pts.length - 1], foot = r.pts[0];
    if (Math.hypot(top[0] - x, top[1] - z) < 25) return TL`${r.name}, summit ${Math.round(r.h[r.h.length - 1])} m` + tag;
    if (Math.hypot(foot[0] - x, foot[1] - z) < 20) return TL`Trail to ${r.name}` + tag;
  }
  for (const s of OW.structs.values()) if (s.poi.type !== 'village' && rectDist(s.poi.rect, x, z) < 10) return s.poi.name + tag;
  return tl(biomeName(biomeHere(x, z))) + tag;
}
/** (0.231) The biome under the player, cached per 32 m cell (placeName asks every frame). */
const biomeCells = new Map<string, BiomeHere>();
let biomeWorld = NaN;
function biomeHere(x: number, z: number): BiomeHere {
  const w = OW.terrain!.world;
  if (w !== biomeWorld) { biomeCells.clear(); biomeWorld = w; }
  const k = Math.floor(x / 32) + ',' + Math.floor(z / 32);
  let b = biomeCells.get(k);
  if (!b) { if (biomeCells.size > 4000) biomeCells.clear(); b = biomeAt(w, x, z); biomeCells.set(k, b); }
  return b;
}

/** Cave mouths in the loaded chunks. */
export const loadedCaves = (): Cave[] => [...OW.chunks.values()].flatMap((c) => c.caves);
/** Wells in the loaded chunks (for the E interaction). */
export const loadedWells = (): Well[] => [...OW.chunks.values()].flatMap((c) => c.wells);
