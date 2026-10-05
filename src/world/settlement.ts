// Physical new-world deposits and the surface receiver console at a real nearby ruin.
import * as THREE from 'three';
import { G, W } from '../game';
import { RESOURCE_PLOTS, PROJECTS, progressive, projectDone, projectAvailable, depositsOf, commsRuin, tutorialStep } from '../gen/settlement';
import { ORES } from '../gen/resource-sites';
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

const METAL = 0xa8c8b8, WOOD = 0xb8b060;
const siteBoxes = new Map<number, Box[]>();
const siteRocks = new Map<number, RockShape[]>(), siteMeshes = new Map<number, THREE.Group>();
const oilMotions = new Map<number, OilMotion>();
let oilClock = 0;
export function updateSettlementSites(dt: number) { oilClock += dt; for (const m of oilMotions.values()) animateOil(m, oilClock); }
export function forgetSettlement(id: number) { siteBoxes.delete(id); siteRocks.delete(id); siteMeshes.delete(id); oilMotions.delete(id); }
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
    } else {
      for (const dx of [-3, 3]) box(x + dx - 1, y, z - 2, x + dx + 1, y + 6, z + 2, METAL);
      box(x - .7, y, z - .7, x + .7, y + 9, z + .7, METAL);
      const oil = RESOURCE_PLOTS.oil; pb.line(METAL, [x + 3, y + .5, z], [vm.ox + oil.x, y + .5, z], [vm.ox + oil.x, y + .5, vm.oz + oil.z]);
    }
    const label = k === 'mine' && ore ? ORES[ore].name + ' · ' + ORES[ore].symbol : PROJECTS[k].name;
    const sign = textSprite(label.toUpperCase() + (built ? ' · WORKING SITE' : ' · CONSTRUCTION SITE'), k === 'mine' && ore ? '#' + ORES[ore].color.toString(16).padStart(6, '0') : '#ffd060', 5);
    sign.position.set(x, T.heightAt(x, z + 13) + 2.2, z + 13); grp.add(sign);
  }
  const landscape = natural.build(); siteMeshes.set(id, landscape); grp.add(landscape, pb.build()); return grp;
}
export function drawSettlementComms(poi: Poi, T: Terrain): THREE.Group {
  const grp = new THREE.Group(), pb = new PropBatch();
  for (const v of allVillages(T.world)) {
    const s = G.char.towns[v.id]; if (worldDist(v.x, v.z, poi.x, poi.z) > 2400 || !progressive(s) || commsRuin(T.world, v)?.id !== poi.id) continue;
    const x = poi.rect.x0 - 3, z = poi.z, y = T.heightAt(x, z), built = projectDone(s, 'comms');
    drawComputer(pb, { x0: x - .7, x1: x + .7, z0: z - .4, z1: z + .4, h: 1, n: [0, 1] }, y);
    pb.seg(METAL, [x - 2, y, z], [x - 2 + (built ? 0 : 2), y + (built ? 7 : 3), z - 1]);
    pb.line(built ? 0x9dffb4 : WOOD, [x - 4, y + 6, z - 1], [x - 2, y + 5, z], [x, y + 6, z - 1]);
    const sign = textSprite(built ? 'SATELLITE LINK ONLINE' : 'COMMUNICATIONS RUIN · RESTORE RECEIVER', built ? '#9dffb4' : '#ffd060', 5);
    sign.position.set(x, y + 2, z); grp.add(sign); break;
  }
  grp.add(pb.build()); return grp;
}
export function nearSettlementComms(): number | null {
  if (G.char.loc !== 'overworld') return null;
  for (const v of allVillages(G.char.world)) {
    if (!progressive(G.char.towns[v.id]) || worldDist(v.x, v.z, G.pos.x, G.pos.z) > 2400) continue;
    const r = commsRuin(G.char.world, v);
    if (r && worldDist(r.rect.x0 - 3, r.z + 1.2, G.pos.x, G.pos.z) < 2 && Math.abs(G.pos.y - (OW.terrain?.heightAt(G.pos.x, G.pos.z) ?? 0)) < 2) return v.id;
  }
  return null;
}
let consoleTown: number | null = null;
const root = () => document.getElementById('dlg')!;
function renderConsole(msg = '') { root().querySelector('.panel')!.innerHTML = '<div data-settlement-console="1">' + developmentHTML(consoleTown!, '<h2>Satellite receiver</h2>', msg, true) + '</div>'; }
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
export function settlementMarker(): { x: number; z: number; label: string } | null {
  const c = G.char, v = findPoi(c.world, GRIDHOLM_ID), step = tutorialStep(c.towns[GRIDHOLM_ID]);
  if (!v || !step || !(c.guide === 2)) return null;
  const r = step.project === 'comms' ? commsRuin(c.world, v) : null;
  const p = step.project && step.project in RESOURCE_PLOTS ? RESOURCE_PLOTS[step.project as keyof typeof RESOURCE_PLOTS] : null;
  return { x: nearX(r ? r.rect.x0 - 3 : p ? v.x - 36 + p.x : v.x, G.pos.x), z: r ? r.z : p ? v.z - 36 + p.z : v.z, label: step.title };
}
