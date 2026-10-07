// Physical new-world deposits and the surface receiver console at a real nearby ruin.
import * as THREE from 'three';
import { G, W } from '../game';
import { RESOURCE_PLOTS, PROJECTS, progressive, projectDone, projectAvailable, depositsOf, linkRuin, tutorialStep, sideStep, sawLevel, furnaceLevel, isStation, stationStage, STATION_RANGE } from '../gen/settlement';
import { ORES } from '../gen/resource-sites';
import { RARE_NAME } from '../gen/deposits';
import { resourceRockHit, resourceRockFloor } from '../gen/resource-rocks';
import type { RockShape } from '../gen/rockshape';
import { naturalResource, oilSeep, animateOil, type OilMotion } from './resource-props';
import { allVillages, findPoi, GRIDHOLM_ID, nearX, worldDist, type Poi } from '../gen/regions';
import { PropBatch } from './props';
import { textSprite } from './npc';
import { drawComputer } from './computer';
import { OW } from './overworld';
import type { VillageMap } from '../gen/village';
import type { Terrain } from '../gen/terrain';
import { developmentHTML, developmentClick } from '../ui/settlement';
import { lockPointer } from '../ui/input';
import { rayLocal, solidAt, type Box } from '../gen/base';
import { makeFigure, type Figure } from './npc';
import { poseRig, type Kit } from './rig';
import { assign, JOBS } from '../gen/workforce';
import { workersAt } from '../gen/people';
import { villageSeed } from '../gen/regions';

const METAL = 0xa8c8b8, WOOD = 0xb8b060, SAIL = 0xe8e0c0;
const siteBoxes = new Map<number, Box[]>();
const siteRocks = new Map<number, RockShape[]>(), siteMeshes = new Map<number, THREE.Group>();
const oilMotions = new Map<number, OilMotion>();
let oilClock = 0;
/** The hands at a settlement's yard: as many figures as it has posts, those the village staffs (gen/workforce.ts) at work, the rest out of sight. */
interface Hand { f: Figure; x: number; z: number; face: number; phase: number }
interface Crew { id: number; yard: string; T: Terrain; hands: Hand[]; got: number }
const crews = new Map<number, Crew[]>();
const KIT: Record<string, Kit> = { quarry: 'pick', mine: 'pick', lumber: 'hammer', oil: 'hammer', refinery: 'hammer', foodworks: 'carry', sawmill: 'carry', raremine: 'pick', furnace: 'hammer' };
const WORKER = 0xdce8ff;
/** Where a yard's hands stand: [x offset of the work's middle, radius, first angle] (yard-local; they go round from there). */
const YARD_RING: Record<string, [number, number, number]> = { quarry: [-4, 12.5, 1.7], mine: [0, 8, 1.6], lumber: [0, 8, 0.4], oil: [0, 4.2, 0.8], refinery: [0, 5.5, 1.2], foodworks: [-1, 8.5, 1.9] };
let crewT = 0;
const tmpV = new THREE.Vector3();
export function updateSettlementSites(dt: number) {
  oilClock += dt; for (const m of oilMotions.values()) animateOil(m, oilClock);
  if ((crewT -= dt) <= 0) { // who works the yards follows the village's people (every few seconds; the same for every player)
    crewT = 2;
    for (const [id, list] of crews) {
      const poi = findPoi(G.char.world, id), s = G.char.towns[id];
      if (!poi) continue;
      const posts = assign(s, workersAt(villageSeed(G.char.world, poi), id === GRIDHOLM_ID, s, G.char.time)).posts;
      for (const c of list) { c.got = posts.find((p) => p.id === c.yard)?.got ?? 0; c.hands.forEach((h, i) => { h.f.g.visible = i < c.got; }); }
    }
  }
  for (const list of crews.values()) for (const c of list) for (let i = 0; i < c.got; i++) {
    const h = c.hands[i], f = h.f;
    if (Math.abs(h.x - G.pos.x) > 160 || Math.abs(h.z - G.pos.z) > 160) continue;
    h.phase += dt;
    poseRig(f.rig, { swing: 0, strike: (h.phase * 0.85) % 1 });
    const o = f.g.parent ? f.g.parent.getWorldPosition(tmpV) : tmpV.set(0, 0, 0); // the village group is localised
    f.g.position.set(h.x - o.x, c.T.heightAt(h.x, h.z) - o.y, h.z - o.z); f.g.rotation.y = h.face;
  }
}
export function forgetSettlement(id: number) { siteBoxes.delete(id); siteRocks.delete(id); siteMeshes.delete(id); oilMotions.delete(id); crews.delete(id); }
/** The figures of a built yard, standing round it facing the work. */
function yardCrew(grp: THREE.Group, T: Terrain, id: number, yard: string, x: number, z: number): Crew {
  const hands: Hand[] = [];
  // round the work (the quarry's boulder pile lies 4 m west of the yard's middle), clear of the rocks and the sheds
  const [cx, r, a0] = YARD_RING[yard] ?? [0, 5, 0], mx = x + cx;
  for (let i = 0; i < (JOBS[yard as keyof typeof JOBS] ?? 2); i++) {
    const a = a0 + i * 0.9, hx = mx + Math.cos(a) * r, hz = z + Math.sin(a) * r;
    const f = makeFigure(WORKER, KIT[yard] ?? 'hammer'); f.g.visible = false; grp.add(f.g);
    hands.push({ f, x: hx, z: hz, face: Math.atan2(mx - hx, z - hz), phase: i * 0.37 });
  }
  return { id, yard, T, hands, got: 0 };
}
export function settlementHit(x: number, y: number, z: number, r: number): boolean {
  for (const list of siteBoxes.values()) for (const { b } of list) {
    if (y >= b[4] - .01 || y + 1.7 <= b[1]) continue;
    if (Math.hypot(x - Math.max(b[0], Math.min(b[3], x)), z - Math.max(b[2], Math.min(b[5], z))) < r) return true;
  }
  return [...siteRocks.values()].some((rocks) => rocks.some((rock) => resourceRockHit(rock, x, y, z, r)));
}
export function settlementFloor(x: number, y: number, z: number): number {
  let floor = -Infinity;
  for (const list of siteBoxes.values()) for (const { b } of list) if (x >= b[0] && x <= b[3] && z >= b[2] && z <= b[5] && y >= b[4] - .03) floor = Math.max(floor, b[4]);
  for (const rocks of siteRocks.values()) for (const rock of rocks) floor = Math.max(floor, resourceRockFloor(rock, x, y, z));
  return floor;
}
const caster = new THREE.Raycaster();
export function settlementRay(o: { x: number; y: number; z: number }, d: { x: number; y: number; z: number }, max: number) {
  for (const list of siteBoxes.values()) max = rayLocal([o.x, o.y, o.z], [d.x, d.y, d.z], max, list);
  caster.ray.origin.set(o.x, o.y, o.z); caster.ray.direction.set(d.x, d.y, d.z); caster.near = 0;
  for (const group of siteMeshes.values()) { caster.far = max; group.updateMatrixWorld(true); const hit = caster.intersectObjects(group.children.filter(c => c instanceof THREE.Mesh), false)[0]; if (hit) max = Math.min(max, hit.distance); }
  return max;
}
export const settlementSolid = (p: { x: number; y: number; z: number }) => [...siteBoxes.values()].some((list) => solidAt(p.x, p.y, p.z, list)) || [...siteRocks.values()].some((rocks) => rocks.some(r => resourceRockHit(r, p.x, p.y, p.z, 0)));
export function drawSettlementSites(vm: VillageMap, T: Terrain, id: number): THREE.Group {
  const grp = new THREE.Group(), pb = new PropBatch(), natural = new PropBatch(), s = G.char.towns[id];
  const rocks: RockShape[] = []; siteRocks.set(id, rocks);
  const boxes: Box[] = []; siteBoxes.set(id, boxes);
  const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: number) => {
    pb.box(x0, y0, z0, x1, y1, z1, color); boxes.push({ b: [x0, y0, z0, x1, y1, z1], slab: false });
  };
  if (!progressive(s)) return grp;
  const crew: Crew[] = []; crews.set(id, crew); crewT = 0;
  for (const [k, p] of Object.entries(RESOURCE_PLOTS) as [keyof typeof RESOURCE_PLOTS, { x: number; z: number }][]) {
    if (!projectAvailable(s, k)) continue;
    const x = vm.ox + p.x, z = vm.oz + p.z, y = T.heightAt(x, z), built = projectDone(s, k);
    const ore = depositsOf(s).ore;
    if (k === 'quarry' || k === 'mine' || k === 'lumber') naturalResource(natural, T, id, k, x, z, rocks, boxes, ore);
    if (k === 'oil') { const seep = oilSeep(T, id, x, z); oilMotions.set(id, seep.motion); animateOil(seep.motion, oilClock); grp.add(seep.group); }
    if (!built) {
      for (const [dx, dz] of [[-17, -13], [17, -13], [-17, 13], [17, 13]]) { const yy = T.heightAt(x + dx, z + dz); pb.seg(WOOD, [x + dx, yy, z + dz], [x + dx, yy + .8, z + dz]); }
    } else if (k === 'quarry') {
      box(x + 8, y, z - 4, x + 13, y + 1, z + 4, METAL);
      box(x + 9, y + 1, z - 3, x + 10, y + 3.2, z - 2.6, WOOD);
      pb.gableRoof(x + 6, z - 5, x + 15, z + 5, y + 3.4, 1.2, WOOD);
      for (let i = 0; i < 3; i++) box(x + 7, y, z + 7 + i, x + 10, y + .6, z + 7.7 + i, 0xb2b2a3);
    } else if (k === 'mine') {
      const yy = T.heightAt(x + 11, z);
      box(x + 10, yy, z - 3, x + 10.35, yy + 4, z - 2.65, WOOD); box(x + 13, yy, z - 3, x + 13.35, yy + 4, z - 2.65, WOOD);
      pb.gableRoof(x + 9, z - 4, x + 15, z + 2, yy + 4, 1.4, WOOD);
      box(x + 10, yy, z - 1, x + 13, yy + 1.1, z + 1, METAL);
      for (const dz of [-.5, .5]) pb.seg(METAL, [x + 2, y + .1, z + dz], [x + 12, yy + .1, z + dz]);
    } else if (k === 'lumber') {
      for (const dx of [-5, 5]) for (const dz of [-4, 4]) box(x + dx - .15, y, z + dz - .15, x + dx + .15, y + 4, z + dz + .15, WOOD);
      pb.gableRoof(x - 6, z - 5, x + 6, z + 5, y + 4, 1.5, WOOD);
      box(x - 3, y, z - .7, x + 3, y + 1.1, z + .7, METAL);
      pb.seg(METAL, [x, y + 1, z - .7], [x, y + 2.2, z]);
    } else if (k === 'oil') {
      for (const dx of [-2, 2]) for (const dz of [-2, 2]) pb.seg(METAL, [x + dx, y, z + dz], [x + dx * .25, y + 8, z + dz * .25]);
      box(x - 3, y + 4, z - .25, x + 3, y + 4.5, z + .25, METAL); pb.seg(METAL, [x + 3, y + 4, z], [x + 3, y + .1, z]);
    } else if (k === 'foodworks') {
      // the mill-and-bakery hall with a smokehouse chimney, a windmill tower with its sails, a grain silo, sacks
      box(x - 7, y, z - 4, x + 5, y + 3.4, z + 4, WOOD); pb.gableRoof(x - 7.6, z - 4.6, x + 5.6, z + 4.6, y + 3.4, 1.8, WOOD);
      box(x - 6, y, z - 1, x - 5, y + 6.2, z, METAL);
      box(x + 7, y, z - 2, x + 10, y + 7, z + 1, WOOD); pb.pyramid(x + 6.6, z - 2.4, x + 10.4, z + 1.4, y + 7, 1.6, WOOD);
      const hub = [x + 8.5, y + 6, z + 1.25];
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4; pb.seg(SAIL, hub, [hub[0] + Math.cos(a) * 4.2, hub[1] + Math.sin(a) * 4.2, hub[2]]); pb.seg(SAIL, [hub[0] + Math.cos(a) * 1.2, hub[1] + Math.sin(a) * 1.2, hub[2]], [hub[0] + Math.cos(a + 0.25) * 4, hub[1] + Math.sin(a + 0.25) * 4, hub[2]]); }
      box(x - 1, y, z + 6, x + 2, y + 6.5, z + 9, METAL); pb.cone(x + 0.5, y + 6.5, z + 7.5, 2.1, 1.4, METAL);
      for (let i = 0; i < 4; i++) box(x + 3 + (i % 2) * 0.9, y, z + 5.5 + (i >> 1) * 0.9, x + 3.8 + (i % 2) * 0.9, y + 0.5, z + 6.3 + (i >> 1) * 0.9, 0xd8d0a0);
    } else if (k === 'sawmill') {
      // (0.170) an open saw shed on posts, the saw bench, a log deck and stacked planks; circular saws (2), band-saw motors (3)
      const lv = sawLevel(s);
      for (const dx of [-6, 6]) for (const dz of [-4, 4]) box(x + dx - .15, y, z + dz - .15, x + dx + .15, y + 4.2, z + dz + .15, WOOD);
      pb.gableRoof(x - 7, z - 5, x + 7, z + 5, y + 4.2, 1.6, WOOD);
      box(x - 5, y, z - .6, x + 4, y + .9, z + .6, WOOD); // the saw bench
      box(x - 1.2, y + .9, z - .9, x - .9, y + 2.6, z + .9, METAL); // the frame saw
      for (let i = 0; i < 4; i++) box(x - 12, y + i * .5, z - 3 + i * .2, x - 8, y + i * .5 + .45, z + 3 - i * .2, WOOD); // the log deck
      for (let i = 0; i < 3; i++) box(x + 8, y + i * .2, z - 2, x + 11, y + i * .2 + .18, z + 2, 0xd8c890); // planks
      if (lv >= 2) pb.cone(x + 1.5, y + .9, z, .9, .08, METAL); // a circular saw's disc
      if (lv >= 3) { box(x + 2.5, y, z + 1.2, x + 3.8, y + 1.3, z + 2.4, METAL); box(x + 2.8, y + 1.3, z - .9, x + 3.5, y + 3.6, z + .9, METAL); } // the band saw and its motor
    } else if (k === 'furnace') {
      // (0.176) a stone shaft furnace with its charging ramp and casting shed; coke ovens (2); the electric arc furnace (3)
      const lv = furnaceLevel(s), HOTC = 0xffb347, STONE = 0xc8c8b0, BRK = 0xd09070;
      { const n = 8, r0 = 2.6, r1 = 1.5, h = 8.5, ring = (r: number, yy: number) => Array.from({ length: n + 1 }, (_, i) => { const a = i / n * 6.283; return [x + Math.cos(a) * r, yy, z + Math.sin(a) * r]; });
        pb.line(STONE, ...ring(r0, y)); pb.line(STONE, ...ring(r0 * .9, y + 4)); pb.line(STONE, ...ring(r1, y + h));
        for (let i = 0; i < n; i++) { const a = i / n * 6.283; pb.seg(STONE, [x + Math.cos(a) * r0, y, z + Math.sin(a) * r0], [x + Math.cos(a) * r1, y + h, z + Math.sin(a) * r1]); }
        box(x - 1.2, y, z - 1.2, x + 1.2, y + 6, z + 1.2, STONE); }
      pb.seg(WOOD, [x + 9, y, z - 1], [x + 1.6, y + 8, z - 1]); pb.seg(WOOD, [x + 9, y, z + 1], [x + 1.6, y + 8, z + 1]); // the charging ramp
      for (let i = 0; i < 6; i++) { const t = i / 5; pb.seg(WOOD, [x + 9 - t * 7.4, y + t * 8, z - 1], [x + 9 - t * 7.4, y + t * 8, z + 1]); }
      box(x - 3, y, z - 1, x - 2.4, y + .6, z + 1, HOTC); // the tap hole
      box(x - 10, y, z - 4, x - 4, y + 3, z + 4, WOOD); pb.gableRoof(x - 10.4, z - 4.4, x - 3.6, z + 4.4, y + 3, 1.2, WOOD); // the casting shed
      for (let i = 0; i < 4; i++) box(x - 9 + i * 1.2, y, z + 5, x - 8.2 + i * 1.2, y + .3, z + 6.2, METAL); // bars
      if (lv >= 2) { for (let i = 0; i < 5; i++) box(x - 6 + i * 2.2, y, z - 10, x - 4.2 + i * 2.2, y + 2.6, z - 7, BRK); box(x + 6, y, z - 10, x + 7.6, y + 7, z - 8.4, BRK); } // coke ovens and the quench tower
      if (lv >= 3) { box(x + 4, y, z + 4, x + 10, y + 4.5, z + 10, METAL); for (const dx of [-1.2, 0, 1.2]) pb.seg(METAL, [x + 7 + dx, y + 4.5, z + 7], [x + 7 + dx, y + 8, z + 7]); box(x + 11, y, z + 5, x + 13, y + 2.5, z + 8, METAL); } // the arc furnace, its electrodes, the transformer
    } else if (k === 'raremine') {
      // (0.175) the deep mine: a steel headframe over the shaft with its sheave wheel, the winding house, the drill rig's derrick, an ore bin
      for (const dx of [-2, 2]) for (const dz of [-2, 2]) pb.seg(METAL, [x + dx, y, z + dz], [x + dx * .35, y + 12, z + dz * .35]);
      for (const h of [4, 8]) { const k2 = 1 - h / 12 * .65; pb.line(METAL, [x - 2 * k2, y + h, z - 2 * k2], [x + 2 * k2, y + h, z - 2 * k2], [x + 2 * k2, y + h, z + 2 * k2], [x - 2 * k2, y + h, z + 2 * k2], [x - 2 * k2, y + h, z - 2 * k2]); }
      { const pts: number[][] = []; for (let i = 0; i <= 12; i++) { const a = i / 12 * 6.283; pts.push([x + Math.cos(a) * 1.3, y + 12 + Math.sin(a) * 1.3, z]); } pb.line(METAL, ...pts); }
      box(x - 1.6, y, z - 1.6, x + 1.6, y + .5, z + 1.6, METAL); // the shaft collar
      box(x + 6, y, z - 3, x + 12, y + 4, z + 3, WOOD); pb.gableRoof(x + 5.6, z - 3.4, x + 12.4, z + 3.4, y + 4, 1.4, WOOD); // the winding house
      pb.seg(METAL, [x + 6, y + 3.5, z], [x, y + 12, z]); // the hoist rope over the sheave
      for (const [dx, dz] of [[-1.1, -1.1], [1.1, -1.1], [1.1, 1.1], [-1.1, 1.1]]) pb.seg(METAL, [x - 9 + dx, y, z + 6 + dz], [x - 9, y + 9, z + 6]); // the drill rig
      pb.seg(METAL, [x - 9, y + 9, z + 6], [x - 9, y, z + 6]);
      box(x - 4, y, z - 9, x + 1, y + 2.4, z - 6, METAL); // the ore bin
    } else {
      for (const dx of [-3, 3]) box(x + dx - 1, y, z - 2, x + dx + 1, y + 6, z + 2, METAL);
      box(x - .7, y, z - .7, x + .7, y + 9, z + .7, METAL);
      const oil = RESOURCE_PLOTS.oil; pb.line(METAL, [x + 3, y + .5, z], [vm.ox + oil.x, y + .5, z], [vm.ox + oil.x, y + .5, vm.oz + oil.z]);
    }
    if (built) crew.push(yardCrew(grp, T, id, k, x, z));
    const rares = depositsOf(s).rares ?? [];
    const label = k === 'mine' && ore ? ORES[ore].name + ' · ' + ORES[ore].symbol : k === 'raremine' && rares.length ? 'Deep mine · ' + rares.map((r) => RARE_NAME[r]).join(', ') : PROJECTS[k].name;
    const sign = textSprite(label.toUpperCase() + (built ? ' · WORKING SITE' : ' · CONSTRUCTION SITE'), k === 'mine' && ore ? '#' + ORES[ore].color.toString(16).padStart(6, '0') : '#ffd060', 5);
    sign.position.set(x, T.heightAt(x, z + 13) + 2.2, z + 13); grp.add(sign);
  }
  const landscape = natural.build(); siteMeshes.set(id, landscape); grp.add(landscape, pb.build()); return grp;
}
export function drawSettlementComms(poi: Poi, T: Terrain): THREE.Group {
  const grp = new THREE.Group(), pb = new PropBatch();
  for (const v of allVillages(T.world)) {
    const s = G.char.towns[v.id]; if (worldDist(v.x, v.z, poi.x, poi.z) > (isStation(s) ? STATION_RANGE[1] + 400 : 2400) || !progressive(s) || linkRuin(T.world, v, s)?.id !== poi.id) continue;
    const x = poi.rect.x0 - 3, z = poi.z, y = T.heightAt(x, z), built = projectDone(s, 'comms');
    drawComputer(pb, { x0: x - .7, x1: x + .7, z0: z - .4, z1: z + .4, h: 1, n: [0, 1] }, y);
    if (isStation(s)) { drawStation(pb, grp, T, x, z, stationStage(s)); break; }
    if (projectDone(s, 'relay')) { // (D2) the relay mast over the receiver: a guyed lattice mast with a dish and lamps
      const mx = x + 5, mz = z - 4, my = T.heightAt(mx, mz), h = 16, w = 0.8, LIT = 0x9dffb4;
      for (const [dx, dz] of [[-w, -w], [w, -w], [w, w], [-w, w]]) pb.seg(METAL, [mx + dx, my, mz + dz], [mx + dx * 0.4, my + h, mz + dz * 0.4]);
      for (let r = 0; r + 2 <= h; r += 2) { const k = 1 - 0.6 * r / h; pb.seg(METAL, [mx - w * k, my + r, mz - w * k], [mx + w * k, my + r + 2, mz + w * k]); }
      for (const [gx, gz] of [[-7, 0], [7, 0], [0, 7]]) pb.seg(METAL, [mx, my + h * 0.7, mz], [mx + gx, T.heightAt(mx + gx, mz + gz), mz + gz]);
      const pts: number[][] = []; for (let i = 0; i <= 12; i++) { const a = i / 12 * 6.283; pts.push([mx + Math.cos(a) * 1.6, my + h + 1 + Math.sin(a) * 0.8, mz + Math.sin(a) * 1.4 - 0.6]); }
      pb.line(LIT, ...pts); pb.box(mx - 0.15, my + h, mz - 0.15, mx + 0.15, my + h + 0.4, mz + 0.15, LIT);
    }
    pb.seg(METAL, [x - 2, y, z], [x - 2 + (built ? 0 : 2), y + (built ? 7 : 3), z - 1]);
    pb.line(built ? 0x9dffb4 : WOOD, [x - 4, y + 6, z - 1], [x - 2, y + 5, z], [x, y + 6, z - 1]);
    const sign = textSprite(built ? 'SATELLITE LINK ONLINE' : 'COMMUNICATIONS RUIN · RESTORE RECEIVER', built ? '#9dffb4' : '#ffd060', 5);
    sign.position.set(x, y + 2, z); grp.add(sign); break;
  }
  grp.add(pb.build()); return grp;
}
/**
 * The start village's radar and communications station beside its ruin's console at (x, z), by the stages done: a
 * mast lying in the rubble and a buried bunker; cleared (1) a bunker walled up and the mast's stump; powered (2) a
 * generator shed and cable runs; restored (3) the mast up with the dish on top, its lamps lit.
 */
function drawStation(pb: PropBatch, grp: THREE.Group, T: Terrain, x: number, z: number, stage: number) {
  const H = (dx: number, dz: number) => T.heightAt(x + dx, z + dz), RUST = 0x9aa870, LIT = 0x9dffb4, CONC = 0x7fa08c;
  const box = (x0: number, z0: number, x1: number, z1: number, h: number, c: number) => { const y = Math.min(H(x0, z0), H(x1, z1)) - 0.2; pb.box(x + x0, y, z + z0, x + x1, y + h, z + z1, c); };
  // the bunker: rubble heaps until cleared, then walled up with a door
  if (stage < 1) for (let i = 0; i < 6; i++) box(-12 + i * 1.6, 4 + (i % 2), -11 + i * 1.6, 5.4 + (i % 2), 0.6 + (i % 3) * 0.4, CONC);
  else { box(-13, 3, -6, 9, 3, CONC); pb.line(METAL, [x - 10, H(-10, 3) , z + 2.98], [x - 10, H(-10, 3) + 2.2, z + 2.98], [x - 8.8, H(-9, 3) + 2.2, z + 2.98], [x - 8.8, H(-9, 3), z + 2.98]); }
  // the mast: lying in the weeds, a stump once cleared, up with the dish when restored
  const mx = 6, mz = 6, my = H(mx, mz);
  if (stage < 1) { for (const o of [-0.6, 0.6]) pb.seg(RUST, [x + mx + o, my + 0.3, z + mz], [x + mx + 16 + o, H(mx + 16, mz) + 0.3, z + mz + 4]); for (let i = 0; i < 16; i += 2) pb.seg(RUST, [x + mx + i - 0.6, my + 0.3, z + mz + i / 4], [x + mx + i + 0.6, my + 0.3, z + mz + i / 4]); }
  else {
    const h = stage >= 3 ? 18 : 5, c = stage >= 3 ? METAL : RUST, w = 1.2;
    for (const [dx, dz] of [[-w, -w], [w, -w], [w, w], [-w, w]]) pb.seg(c, [x + mx + dx, my, z + mz + dz], [x + mx + dx * 0.4, my + h, z + mz + dz * 0.4]);
    for (let r = 0; r + 3 <= h; r += 3) { const k0 = 1 - 0.6 * r / 18, k1 = 1 - 0.6 * (r + 3) / 18; pb.seg(c, [x + mx - w * k0, my + r, z + mz - w * k0], [x + mx + w * k1, my + r + 3, z + mz + w * k1]); pb.seg(c, [x + mx + w * k0, my + r, z + mz - w * k0], [x + mx - w * k1, my + r + 3, z + mz + w * k1]); }
    if (stage >= 3) { // the dish, tilted to the sky, and the lamps
      const dy = my + h + 1, R = 3.2, pts: number[][] = [];
      for (let i = 0; i <= 16; i++) { const a = i / 16 * 6.283; pts.push([x + mx + Math.cos(a) * R, dy + Math.sin(a) * R * 0.5 + 1, z + mz + Math.sin(a) * R * 0.85 - 1]); }
      pb.line(LIT, ...pts); for (let i = 0; i < 16; i += 4) pb.seg(METAL, pts[i], [x + mx, dy + 2.5, z + mz - 2.5]);
      pb.seg(METAL, [x + mx, my + h, z + mz], [x + mx, dy + 1, z + mz - 1]);
      for (const d of [-1, 1]) pb.box(x + mx + d * 0.5 - 0.15, my + h - 0.3, z + mz - 0.15, x + mx + d * 0.5 + 0.15, my + h, z + mz + 0.15, LIT);
    }
  }
  // the generator shed and the cable runs once powered
  if (stage >= 2) { box(-4, 8, 0, 12, 2.6, METAL); pb.gableRoof(x - 4.2, z + 7.8, x + 0.2, z + 12.2, H(-2, 10) + 2.4, 0.8, WOOD); pb.line(stage >= 3 ? LIT : METAL, [x, H(0, 10) + 1, z + 10], [x + mx, my + 1, z + mz], [x - 6, H(-6, 3) + 2, z + 3]); }
  const sign = textSprite(stage >= 3 ? 'RADAR & COMMUNICATIONS STATION · ONLINE' : `RADAR & COMMUNICATIONS STATION · STAGE ${stage + 1}/3`, stage >= 3 ? '#9dffb4' : '#ffd060', 5);
  sign.position.set(x, H(0, 0) + 2.4, z); grp.add(sign);
}
export function nearSettlementComms(): number | null {
  if (G.char.loc !== 'overworld') return null;
  for (const v of allVillages(G.char.world)) {
    const sv = G.char.towns[v.id];
    if (!progressive(sv) || worldDist(v.x, v.z, G.pos.x, G.pos.z) > (isStation(sv) ? STATION_RANGE[1] + 400 : 2400)) continue;
    const r = linkRuin(G.char.world, v, sv);
    if (r && worldDist(r.rect.x0 - 3, r.z + 1.2, G.pos.x, G.pos.z) < 2 && Math.abs(G.pos.y - (OW.terrain?.heightAt(G.pos.x, G.pos.z) ?? 0)) < 2) return v.id;
  }
  return null;
}
let consoleTown: number | null = null;
const root = () => document.getElementById('dlg')!;
function renderConsole(msg = '') { root().querySelector('.panel')!.innerHTML = '<div data-settlement-console="1">' + developmentHTML(consoleTown!, isStation(G.char.towns[consoleTown!]) ? '<h2>Radar and communications station</h2>' : '<h2>Satellite receiver</h2>', msg, true) + '</div>'; }
export function openSettlementComms(vid: number) {
  if (!G.playing || G.dlgOpen || G.packOpen || G.xferOpen) return;
  consoleTown = vid; G.dlgOpen = true; G.firing = false; W.talkNpc = null; for (const k in G.keys) G.keys[k] = false;
  renderConsole(); root().style.display = 'flex'; if (document.pointerLockElement) document.exitPointerLock();
}
export function settlementConsoleClick(t: HTMLElement): boolean {
  if (consoleTown === null || !G.dlgOpen || !t.closest('[data-settlement-console]')) return false;
  if (t.closest('[data-devclose]')) { consoleTown = null; G.dlgOpen = false; root().style.display = 'none'; if (!G.isTouch) lockPointer(); return true; }
  const m = developmentClick(t, consoleTown, true); if (m !== null) { renderConsole(m); return true; }
  return false;
}
/** The side task's marker (the start village's radar station, once its power plant stands). */
export function sideMarker(): { x: number; z: number; label: string } | null {
  const c = G.char, v = findPoi(c.world, GRIDHOLM_ID), s = c.towns[GRIDHOLM_ID], side = sideStep(s);
  if (!v || !side || c.guide !== 2) return null;
  const r = linkRuin(c.world, v, s); return r ? { x: nearX(r.rect.x0 - 3, G.pos.x), z: r.z, label: side.title } : null;
}
export function settlementMarker(): { x: number; z: number; label: string } | null {
  const c = G.char, v = findPoi(c.world, GRIDHOLM_ID), step = tutorialStep(c.towns[GRIDHOLM_ID]);
  if (!v || !step || !(c.guide === 2)) return null;
  const r = step.project === 'comms' ? linkRuin(c.world, v, c.towns[GRIDHOLM_ID]) : null;
  const p = step.project && step.project in RESOURCE_PLOTS ? RESOURCE_PLOTS[step.project as keyof typeof RESOURCE_PLOTS] : null;
  return { x: nearX(r ? r.rect.x0 - 3 : p ? v.x - 36 + p.x : v.x, G.pos.x), z: r ? r.z : p ? v.z - 36 + p.z : v.z, label: step.title };
}
