// What the player is standing next to: chests, locked doors, stairwells, NPCs, the hatch.
import { nearLadder, ladderPrompt, startClimb, climbing } from './ladders';
import type * as THREE from 'three';
import { G, W } from '../game';
import { updateNpcs } from './npc';
import { startStairs } from './doors';
import { descend } from './level';
import { hasItem } from '../character';
import { el, logLine } from '../ui/hud';
import { openDialog } from '../ui/dialog';
import { unlockDoor } from './doors';
import { openChest } from './loot';
import { OW, campStashes, loadedWells, loadedCaves } from './overworld';
import { waterSource, sourcePrompt, useWater, type WaterSource } from './water';
import { nearPlant, plantPrompt, harvest, type PlantNode } from './flora';
import { nearFire, cookAll, fireHasWork } from './cooking';
import { openShuttle } from '../ui/shuttle';
import { openWorks } from '../ui/works';
import { openStation } from '../ui/stations';
import { openTerminal } from '../ui/terminal';
import { nearTerminal } from './terminal';
import { nearStation, stationPrompt } from './stations';
import { nearWorks, worksPrompt } from './works';
import { STAGES, CHARIOT, stagesDone } from '../gen/shuttle';
import { HANGAR_ID, findPoi } from '../gen/regions';
import { deskOf } from './hangar';
import { nearHouseDoor, houseDoorPrompt, toggleHouseDoor } from './housedoors';
import { gatherTarget, gatherPrompt, strike, updateGather, type Target } from './gather';
import { nearBench, type Bench } from './benches';
import { nearTurret, toggleTurret } from './turrets';
import { atMouth } from './caves';
import { caveExitNear } from './cavelevel';
import { enterCave, exitCave } from './level';
import type { Cave } from '../gen/caves';
import { nearDoor, toggleDoor, buildHint, buildOk, doorPrompt, lockMenu } from './building';
import { nearFlag, takeDownFlag, isPlacing, confirmPlacing, placingHint, placingOk, type SavedClaim } from './claims';
import { openBench } from '../ui/craft';
import { openAreaMap } from '../ui/areamap';
import { openStash } from './loot';
import { openBoard } from '../ui/board';
import { nearHome, homePrompt, useHome } from './home';
import { nearPower, powerPrompt, repairPower, type Plant } from './power';
import { nearCaravan } from './caravans';
import { nearSite, sitePrompt, repairSite } from './industry';
import { openCaravan } from '../ui/caravan';
import { ITEMS } from '../data/items';
import type { Caravan } from '../gen/caravans';
import { driving, vehicleSpot, useVehicle, leave, type VehicleSpot } from './vehicles';

/** Hook for places with people (the village). */
export let npcsActive = () => G.char.loc === 'overworld' && W.npcs.length > 0;
export function setNpcsActive(f: () => boolean) { npcsActive = f; }

let nearWater: WaterSource | null = null, nearFood: PlantNode | null = null, nearCook = false, nearWork: Bench | null = null, nearGather: Target | null = null;
let nearCave: Cave | null = null, caveOut = -1;
let nearMap = false, nearClaim: SavedClaim | null = null, nearGate: ReturnType<typeof nearDoor> = null, nearHD: ReturnType<typeof nearHouseDoor> = null, nearDesk = false, nearWk: ReturnType<typeof nearWorks> = null, nearSt: ReturnType<typeof nearStation> = null, nearTerm: ReturnType<typeof nearTerminal> = null, nearGun: ReturnType<typeof nearTurret> = null;
let nearMine: ReturnType<typeof nearHome> = null, nearPow: Plant | null = null, nearCar: Caravan | null = null, nearWork2: ReturnType<typeof nearSite> = null;
let nearLad: ReturnType<typeof nearLadder> = null, nearVehicle: VehicleSpot | null = null, nearBoard = false, nearStash: ReturnType<typeof campStashes>[number] | null = null;
export function updateEntities(dt: number, time: number) {
  const pos = G.pos;
  if (driving.v) {
    if (npcsActive()) updateNpcs(dt, time);
    W.nearNpc = null; W.nearChest = null; W.nearPortal = null; W.nearLock = null; nearVehicle = null;
    // controls hint for the first few seconds behind the wheel, then out of the way
    el.prompt.className = ''; el.prompt.textContent = 'E — get out · V — view · space — brake';
    el.prompt.style.display = G.playing && !G.isTouch && performance.now() - driving.since < 4000 ? 'block' : 'none';
    el.bUse.textContent = 'EXIT'; el.bUse.classList.toggle('on', G.playing);
    return;
  }
  nearVehicle = G.char.loc === 'overworld' ? vehicleSpot() : null;
  const bd = G.char.loc === 'overworld' && OW.village ? OW.village.board : null;
  nearBoard = !!bd && Math.hypot(bd.x - pos.x, bd.z + 0.8 - pos.z) < 2.6;
  const mb = G.char.loc === 'overworld' && OW.village ? OW.village.mapBoard : null;
  nearMap = !!mb && Math.hypot(mb.x - pos.x, mb.z + 1 - pos.z) < 2.4;
  nearStash = G.char.loc === 'overworld' ? campStashes().find((s) => Math.hypot(s.x - pos.x, s.z - pos.z) < 1.8) ?? null : null;
  nearLad = nearLadder();
  nearMine = nearHome(); nearPow = nearMine ? null : nearPower(); nearCar = nearMine || nearPow ? null : nearCaravan(); nearWork2 = nearMine || nearPow || nearCar ? null : nearSite();
  nearCave = G.char.loc === 'overworld' ? loadedCaves().find((c) => atMouth(c, pos.x, pos.z)) ?? null : null;
  caveOut = G.char.loc === 'dungeon' && G.char.dungeon?.cave ? caveExitNear() : -1;
  nearGate = nearDoor(); nearGun = nearGate ? null : nearTurret(); nearHD = nearGate || nearGun ? null : nearHouseDoor(); nearDesk = atShuttleDesk(); nearWk = nearGate || nearGun || nearHD || nearDesk ? null : nearWorks(); nearSt = nearGate || nearGun || nearHD || nearDesk || nearWk ? null : nearStation(); nearTerm = nearGate || nearHD ? null : nearTerminal();
  W.nearChest = null; W.nearPortal = null; W.nearLock = null;
  if (npcsActive()) updateNpcs(dt, time); else W.nearNpc = null;
  for (const d of W.doors) if (d.locked && Math.hypot(d.cx - pos.x, d.cz - pos.z) < 3) W.nearLock = d;
  for (const c of W.chests) {
    if (c.anim > 0 && c.anim < 1) c.anim = Math.min(1, c.anim + dt * 3);
    c.lidPivot.rotation.x = -(c.open ? (c.anim || 1) : 0) * 1.9;
    c.beam.visible = !c.open; c.beamMat.opacity = 0.35 + 0.3 * Math.sin(time * 3 + c.i);
    if (Math.hypot(c.g.position.x - pos.x, c.g.position.z - pos.z) < 1.8 && Math.abs(c.g.position.y - pos.y) < 1.2) W.nearChest = c;
  }
  let enter = null;
  for (const p of W.portals) {
    const d = Math.hypot(p.cx - pos.x, p.cz - pos.z);
    if (d < 4.5 && Math.abs(pos.y - p.y0) < 4) W.nearPortal = p;
    // the player walked through the doorway onto the stair landing
    const along = (p.axis === 'x' ? pos.x - p.cx : pos.z - p.cz) * (p.o[0] || p.o[1]), lat = Math.abs(p.axis === 'x' ? pos.z - p.cz : pos.x - p.cx);
    // only on the landing just behind the doorway: from behind the building (further along the same line) it does not count
    if (along > 0.9 && along < 3 && lat < 1.6 && Math.abs(pos.y - p.y0) < 1 && G.playing && !G.trans) enter = p;
  }
  const { nearNpc, nearLock, nearChest, nearPortal } = W, prompt = el.prompt;
  const busy = !!(nearLad || nearMine || nearPow || nearCar || nearWork2 || nearNpc || nearLock || nearChest || nearBoard || nearMap || nearStash || nearVehicle || nearGate || nearHD || nearDesk || nearWk || nearSt || nearTerm || nearSt || nearGun || nearCave || caveOut >= 0);
  nearFood = busy ? null : nearPlant();
  nearWork = busy || nearFood ? null : nearBench();
  nearClaim = busy || nearFood || nearWork ? null : nearFlag();
  nearCook = !busy && !nearFood && !nearWork && !nearClaim && G.char.loc === 'overworld' && !!nearFire();
  nearGather = busy || nearFood || nearWork || nearClaim || nearCook ? null : gatherTarget();
  updateGather(dt, nearGather);
  nearWater = G.char.loc === 'overworld' && !nearFood && !nearCook && !nearWork && !nearClaim && !nearGather && !nearNpc && !nearChest && !nearBoard && !nearStash && !nearVehicle && !nearMine && !nearPow && !nearCar && !nearWork2 ? waterSource(loadedWells()) : null;
  if (climbing()) { prompt.className = ''; prompt.textContent = 'W / S — up or down · Space — let go'; }
  else if (nearLad) { prompt.className = ''; prompt.textContent = ladderPrompt(nearLad); }
  else if (nearGate) { prompt.className = ''; prompt.textContent = doorPrompt(nearGate); }
  else if (nearDesk) { prompt.className = ''; prompt.textContent = `E — the ${CHARIOT} (${stagesDone(G.char.shuttle)} of ${STAGES.length} stages done)`; }
  else if (nearTerm) { prompt.className = ''; prompt.textContent = 'E — use the village computer'; }
  else if (nearSt) { const t = stationPrompt(nearSt); prompt.className = t.startsWith('E') ? '' : 'lock'; prompt.textContent = t; }
  else if (nearWk) { const t = worksPrompt(nearWk); prompt.className = t.startsWith('E') ? '' : 'lock'; prompt.textContent = t; }
  else if (nearHD) { const t = houseDoorPrompt(nearHD); prompt.className = t.locked ? 'lock' : ''; prompt.textContent = t.text; }
  else if (nearCave) { prompt.className = 'portal'; prompt.textContent = 'E — enter ' + nearCave.name + (nearCave.other ? ' (it runs through the mountain)' : ''); }
  else if (caveOut >= 0) { const info = G.char.dungeon!.cave!; prompt.className = 'portal'; prompt.textContent = 'E — leave the cave' + (info.mouths.length > 1 && caveOut !== info.from ? ' (the far side of the mountain)' : ''); }
  else if (nearGun) { prompt.className = ''; prompt.textContent = nearGun.p.off ? 'E — switch the turret on' : 'E — switch the turret off'; }
  else if (nearMine) { prompt.className = ''; prompt.textContent = homePrompt(nearMine); }
  else if (nearWork2) { const t = sitePrompt(nearWork2); prompt.className = t.startsWith('E') ? '' : 'lock'; prompt.textContent = t; }
  else if (nearCar) { prompt.className = ''; prompt.textContent = `E — talk to the caravan (${nearCar.fromName} → ${nearCar.toName}, ${ITEMS[nearCar.good].name})`; }
  else if (nearPow) { const t = powerPrompt(nearPow); prompt.className = t.startsWith('E') ? '' : 'lock'; prompt.textContent = t; }
  else if (nearNpc) { prompt.className = ''; prompt.textContent = G.isTouch ? nearNpc.name : 'E — talk to ' + nearNpc.name; }
  else if (nearLock) {
    prompt.className = 'lock';
    prompt.textContent = hasItem('key') ? (G.isTouch ? 'Locked door' : 'E — unlock with an Access Key') : 'Locked. Requires an Access Key';
  }
  else if (nearChest) { prompt.className = ''; prompt.textContent = G.isTouch ? 'Chest' : nearChest.open ? 'E — search the chest' : 'E — open chest'; }
  else if (nearBoard) { prompt.className = ''; prompt.textContent = G.isTouch ? '' : 'E — read the notice board'; }
  else if (nearMap) { prompt.className = ''; prompt.textContent = 'E — study the map of the surroundings'; }
  else if (nearStash) { prompt.className = ''; prompt.textContent = G.isTouch ? '' : 'E — search the bandit stash'; }
  else if (nearVehicle) { prompt.className = ''; prompt.textContent = G.isTouch ? '' : 'E — ' + nearVehicle.label; }
  else if (nearPortal) { prompt.className = 'portal'; prompt.textContent = nearPortal.label; }
  else if (nearFood) { prompt.className = ''; prompt.textContent = plantPrompt(nearFood); }
  else if (nearWork) { prompt.className = ''; prompt.textContent = 'E — use the workbench'; }
  else if (nearClaim) { prompt.className = ''; prompt.textContent = 'E — take down your flag (the land goes back to how it was)'; }
  else if (nearGather) { prompt.className = ''; prompt.textContent = gatherPrompt(nearGather); }
  else if (nearCook) { prompt.className = ''; prompt.textContent = fireHasWork() ? 'E — roast your raw meat' : 'A campfire: bring raw meat to roast'; }
  else if (nearWater) { prompt.className = nearWater.kind === 'toxic' ? 'lock' : ''; prompt.textContent = sourcePrompt(nearWater); }
  prompt.style.display = (climbing() || nearLad || nearMine || nearPow || nearCar || nearWork2 || nearGate || nearHD || nearDesk || nearWk || nearSt || nearTerm || nearTerm || nearGun || nearCave || caveOut >= 0 || nearNpc || nearLock || nearChest || nearBoard || nearMap || nearStash || nearVehicle || nearPortal || nearFood || nearWork || nearClaim || nearGather || nearCook || nearWater) && G.playing && prompt.textContent ? 'block' : 'none';
  const bh = buildHint();
  if (bh !== null && !nearGate && !nearGun) { prompt.className = buildOk() ? '' : 'lock'; prompt.textContent = bh; prompt.style.display = G.playing && bh ? 'block' : 'none'; }
  const hint = placingHint();
  if (hint !== null) { prompt.className = placingOk() ? '' : 'lock'; prompt.textContent = hint; prompt.style.display = G.playing && hint ? 'block' : 'none'; }
  const canUse = nearNpc || nearChest || nearBoard || nearStash || nearVehicle || (nearLock && hasItem('key'));
  el.bUse.textContent = nearNpc ? 'TALK' : nearLock ? 'UNLOCK' : nearChest ? 'OPEN' : nearBoard ? 'READ' : nearStash ? 'OPEN' : nearVehicle ? (nearVehicle.kind === 'drive' ? 'DRIVE' : 'TRUNK') : 'OPEN';
  el.bUse.classList.toggle('on', !!canUse && G.playing);
  const hatch = W.hatch;
  if (hatch) {
    hatch.rings.forEach((r, i) => { const ph = (time * 0.8 + i / 4) % 1; (r.material as THREE.Material).opacity = 1 - ph; r.scale.setScalar(1 - ph * 0.35); });
    if (G.playing && Math.hypot(hatch.g.position.x - pos.x, hatch.g.position.z - pos.z) < 0.9 && Math.abs(hatch.g.position.y - pos.y) < 0.3 && G.onGround) { descend(); return; }
  }
  if (enter) startStairs(enter);
}

/** Standing at the project desk in the hangar. */
function atShuttleDesk(): boolean {
  if (G.char.loc !== 'overworld' || !OW.structs.has(HANGAR_ID)) return false;
  const p = findPoi(G.char.world, HANGAR_ID);
  if (!p) return false;
  const d = deskOf(p);
  return Math.hypot(G.pos.x - d.x, G.pos.z - (d.z + 1.2)) < 1.6;
}
/** L key: the code lock of the door you stand at. */
export function lockKey() { if (nearGate) lockMenu(nearGate); }
/** E key / use button. */
export function interact() {
  if (driving.v) { leave(); return; }
  if (climbing()) return;
  if (nearLad) { const m = startClimb(nearLad); if (m) logLine(m); return; }
  if (isPlacing()) { confirmPlacing(); return; }
  if (nearGate) { toggleDoor(nearGate); return; }
  if (nearHD) { const m = toggleHouseDoor(nearHD); if (m) logLine(m); return; }
  if (nearDesk) { openShuttle(); return; }
  if (nearWk) { if (!openWorks(nearWk)) logLine(worksPrompt(nearWk) + '.'); return; }
  if (nearTerm) { openTerminal(nearTerm); return; }
  if (nearSt) { if (!openStation(nearSt)) logLine(stationPrompt(nearSt) + '.'); return; }
  if (nearGun) { toggleTurret(nearGun); return; }
  if (nearCave) { enterCave(nearCave); return; }
  if (caveOut >= 0) { exitCave(caveOut); return; }
  if (nearMine) { useHome(nearMine); return; }
  if (nearPow) { repairPower(nearPow); return; }
  if (nearCar) { openCaravan(nearCar); return; }
  if (nearWork2) { repairSite(nearWork2); return; }
  if (W.nearNpc) openDialog(W.nearNpc); else if (W.nearLock) unlockDoor(W.nearLock); else if (W.nearChest) openChest(W.nearChest);
  else if (nearBoard) openBoard();
  else if (nearMap && OW.village) openAreaMap({ x: OW.village.ox + 36, z: OW.village.oz + 36, name: OW.village.name });
  else if (nearStash) openStash(nearStash.id, nearStash.name);
  else if (nearVehicle) useVehicle(nearVehicle);
  else if (nearFood) harvest(nearFood);
  else if (nearWork) openBench(nearWork);
  else if (nearClaim) { const err = takeDownFlag(nearClaim); logLine(err || 'You take the flag down. The land is no longer yours.'); }
  else if (nearGather) strike(nearGather);
  else if (nearCook) cookAll();
  else if (nearWater) useWater(nearWater);
}
