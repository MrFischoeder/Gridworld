import { lightKey } from './light';
import { throwHint } from './throwing';
import { nearSettlementComms, openSettlementComms } from './settlement';
import { nearFuelPump, openFuelPump } from './fuelpump';
import { nearCharger, chargerPrompt } from './charging';
import { nearGatePanel, nearGateTablet } from './worldgates';
import { openGateConsole, openGateTablet } from '../ui/worldgates';
// What the player is standing next to: chests, locked doors, stairwells, NPCs, the hatch.
import { nearLadder, ladderPrompt, startClimb, climbing } from './ladders';
import type * as THREE from 'three';
import { G, W } from '../game';
import { updateNpcs } from './npc';
import { startStairs } from './doors';
import { metroDescent, nearCityDecoy } from './cities';
import { descend, enterDungeon } from './level';
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
import { openInstall } from '../ui/install';
import { openHall } from '../ui/hall';
import { nearHallTerminal } from './hall';
import { nearInstallDesk } from './installs';
import { nearOutpostLode } from './lodes';
import { nearPortBoard } from './ports';
import { openPort } from '../ui/port';
import { openOutpost } from '../ui/outpost';
import type { Lode } from '../gen/lodes';
import { partName, jobEnd } from '../gen/outposts';
import { nearFogLocker, fogLocker } from './toxic';
import { nearBody } from './bodies';
import { bodyLeft, type Body } from '../gen/bodies';
import { nearGuide, talkGuide, GUIDE } from './guide';
import { nearSurrendered, spareBandit, type Bandit } from './bandits';
import { FOG_SITE } from '../gen/toxic';
import { isFieldPlacing, confirmFieldPlacing, fieldPlacingHint, fieldPlacingOk } from './fields';
import { isLhPlacing, confirmLhPlacing, lhPlacingHint, lhPlacingOk, nearLighthouse, lighthousePrompt, openLighthouse } from './lighthouses';
import { isWhPlacing, confirmWhPlacing, whPlacingHint, whPlacingOk } from './wildstores';
import type { Lighthouse } from '../gen/lighthouses';
import { isStreetPlacing, confirmStreetPlacing, streetPlacingHint, streetPlacingOk, nearStreetLamp, streetLampPrompt, openStreetLamp, type NearLamp } from './streetlamps';
import { sawingHint } from './sawing';
import { handworkTarget, handworkPrompt, updateHandwork, type HandTarget } from './handwork';
import { updateWorkshop, working as workshopWorking, workPrompt } from './workshop';
import { eating, eatingPrompt } from './eating';
import { nearRoadSign, roadSignPrompt, isRoadSurvey, confirmRoadSurvey, roadSurveyHint, roadSurveyOk } from './playerroads';
import { openRoad } from '../ui/road';
import type { PlayerRoad } from '../gen/playerroads';
import { nearBridgeSign, built as bridgeBuilt, isBridgePlacing, confirmBridgePlacing, bridgePlacingHint, bridgePlacingOk } from './bridges';
import { openBridge } from '../ui/bridge';
import { nearPierSign, nearPierCrate, pierCrate, isPierPlacing, confirmPierPlacing, pierPlacingHint, pierPlacingOk } from './piers';
import { openPier } from '../ui/pier';
import { inBoat, nearBoat, board, stepOff, boatHint, boatPrompt } from './boats';
import type { Airship } from '../gen/airships';
import { inAir, nearAirship, boardAir, airUse, airHint, airPrompt } from './airships';
import { inCopter, nearCopter, boardCopter, copterUse, copterHint, copterPrompt } from './copters';
import type { Copter } from '../gen/copters';
import type { Boat } from '../gen/boats';
import type { Pier } from '../gen/piers';
import type { Ford } from '../gen/bridges';
import { INSTALL_STAGES, installDone } from '../gen/installs';
import type { InstallSite } from '../gen/installs';
import { openWorks } from '../ui/works';
import { openStation } from '../ui/stations';
import { openTerminal } from '../ui/terminal';
import { nearTerminal } from './terminal';
import { nearLocker, nearConsole, lockerBox } from './crashpod';
import { salvageTarget, updateSalvage, salvagePrompt, salvageTakesE } from './salvage';
import { nearFall, fallBox } from './skyfall';
import { openLogbook } from '../ui/logbook';
import { nearCarrier, carrierPrompt, takeCarrier } from './datacarriers';
import { openTransfer } from '../ui/transfer';
import { SHIP_NAME } from './lander';
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
import { enterCave, exitCave, enterPyramid } from './level';
import { nearPyramidDoor } from './megaliths';
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
import { driving, vehicleSpot, useVehicle, leave, toggleHeadlights, type VehicleSpot } from './vehicles';
import { nearDrop, dropPrompt, takeDrop } from './drops';
import { riding, rideSpot, ridePrompt, board as boardRide, getOff, type RideSpot } from './ride';
import type { Pickup } from './loot';
import { tl, TL } from '../i18n';

/** Hook for places with people (the village). */
export let npcsActive = () => G.char.loc === 'overworld' && W.npcs.length > 0;
export function setNpcsActive(f: () => boolean) { npcsActive = f; }

let nearWater: WaterSource | null = null, nearFood: PlantNode | null = null, nearCook = false, nearWork: Bench | null = null, nearGather: Target | null = null;
let nearCave: Cave | null = null, caveOut = -1, nearPyr: ReturnType<typeof nearPyramidDoor> = null;
let nearHatch = false;
let nearDecoy = false;
let nearFl = false, nearLock2 = false, nearRec = false, nearData: ReturnType<typeof nearCarrier> = null;
let nearRd: PlayerRoad | null = null; // (0.280) a track's sign
let nearLd: Lode | null = null, nearIns: InstallSite | null = null, nearHall: number | null = null, nearComms: number | null = null, nearPump: number | null = null, nearSL: NearLamp | null = null, nearLH: Lighthouse | null = null, nearChg: number | null = null, nearBrg: Ford | null = null, nearPier: Pier | null = null, nearPCrate: Pier | null = null, nearBt: Boat | null = null, nearAir: Airship | null = null, nearCop: Copter | null = null, nearFogL: ReturnType<typeof nearFogLocker> = null, nearBd: Body | null = null, nearGd = false, nearSur: Bandit | null = null, nearPt: ReturnType<typeof nearPortBoard> = null;
let nearSv: ReturnType<typeof salvageTarget> = null;
let nearHW: HandTarget | null = null, nearDp: Pickup | null = null, nearRide: RideSpot | null = null;
let nearAncient: ReturnType<typeof nearGatePanel> = null, nearAncientTablet: ReturnType<typeof nearGateTablet> = null;
let nearMap = false, nearClaim: SavedClaim | null = null, nearGate: ReturnType<typeof nearDoor> = null, nearHD: ReturnType<typeof nearHouseDoor> = null, nearDesk = false, nearWk: ReturnType<typeof nearWorks> = null, nearSt: ReturnType<typeof nearStation> = null, nearTerm: ReturnType<typeof nearTerminal> = null, nearGun: ReturnType<typeof nearTurret> = null;
let nearMine: ReturnType<typeof nearHome> = null, nearPow: Plant | null = null, nearCar: Caravan | null = null, nearWork2: ReturnType<typeof nearSite> = null;
let nearLad: ReturnType<typeof nearLadder> = null, nearVehicle: VehicleSpot | null = null, nearBoard = false, nearStash: ReturnType<typeof campStashes>[number] | null = null;
export function updateEntities(dt: number, time: number) {
  const pos = G.pos;
  if (driving.v) {
    if (npcsActive()) updateNpcs(dt, time);
    W.nearNpc = null; W.nearChest = null; W.nearPortal = null; W.nearLock = null; nearVehicle = null;
    // controls hint for the first few seconds behind the wheel, then out of the way
    el.prompt.className = ''; el.prompt.textContent = tl('E — get out · V — view · space — brake');
    el.prompt.style.display = G.playing && !G.isTouch && performance.now() - driving.since < 4000 ? 'block' : 'none';
    el.bUse.textContent = tl('EXIT'); el.bUse.classList.toggle('on', G.playing);
    return;
  }
  if (riding()) { // along for the ride in another player's vehicle: the HUD line says the keys
    if (npcsActive()) updateNpcs(dt, time);
    W.nearNpc = null; W.nearChest = null; W.nearPortal = null; W.nearLock = null; nearVehicle = null; nearRide = null; nearDp = null;
    el.prompt.style.display = 'none'; el.bUse.textContent = tl('EXIT'); el.bUse.classList.toggle('on', G.playing);
    return;
  }
  nearHatch = !!W.hatch && Math.hypot(W.hatch.g.position.x - pos.x, W.hatch.g.position.z - pos.z) < 1.6 && Math.abs(W.hatch.g.position.y - pos.y) < 0.5;
  // (0.238.2) the metro: walking into an entrance's opening takes you down its stairs, no key
  const down = G.playing && !G.trans && !G.fly && !inBoat() ? metroDescent() : null;
  if (down) {
    G.firing = false; for (const k in G.keys) G.keys[k] = false;
    const id = down.e.id;
    G.trans = { phase: 'out', t: 0, dur: 1.7, st: {}, pts: down.pts, yaw0: G.yaw, yaw1: down.yaw, p0: G.pitch, p1: -0.35, go: () => enterDungeon(id) };
  }
  nearDecoy = nearCityDecoy();
  nearVehicle = G.char.loc === 'overworld' ? vehicleSpot() : null;
  nearRide = nearVehicle ? null : rideSpot();
  const bd = G.char.loc === 'overworld' && OW.village ? OW.village.board : null;
  nearBoard = !!bd && Math.hypot(bd.x - pos.x, bd.z + 0.8 - pos.z) < 2.6;
  const mb = G.char.loc === 'overworld' && OW.village ? OW.village.mapBoard : null;
  nearMap = !!mb && Math.hypot(mb.x - pos.x, mb.z + 1 - pos.z) < 2.4;
  nearStash = G.char.loc === 'overworld' ? campStashes().find((s) => Math.hypot(s.x - pos.x, s.z - pos.z) < 1.8) ?? null : null;
  nearLad = nearLadder();
  nearMine = nearHome(); nearPow = nearMine ? null : nearPower(); nearCar = nearMine || nearPow ? null : nearCaravan(); nearWork2 = nearMine || nearPow || nearCar ? null : nearSite();
  nearCave = G.char.loc === 'overworld' ? loadedCaves().find((c) => atMouth(c, pos.x, pos.z)) ?? null : null;
  caveOut = G.char.loc === 'dungeon' && G.char.dungeon?.cave ? caveExitNear() : -1;
  nearPyr = G.char.loc === 'overworld' && !driving.v ? nearPyramidDoor(pos.x, pos.y, pos.z) : null; // (0.275) a pyramid's shrine: the way down
  nearAncient = nearGatePanel(); nearAncientTablet = nearGateTablet();
  nearGate = nearDoor(); nearGun = nearGate ? null : nearTurret(); nearHD = nearGate || nearGun ? null : nearHouseDoor(); nearDesk = atShuttleDesk(); nearWk = nearGate || nearGun || nearHD || nearDesk ? null : nearWorks(); nearSt = nearGate || nearGun || nearHD || nearDesk || nearWk ? null : nearStation(); nearTerm = nearGate || nearHD ? null : nearTerminal();
  nearComms = nearSettlementComms(); nearPump = nearFuelPump(); nearSL = nearStreetLamp(); nearLH = nearLighthouse(); nearChg = nearPump === null ? nearCharger() : null; nearIns = nearInstallDesk(); nearLd = nearIns || nearVehicle ? null : nearOutpostLode(); nearPt = nearLd ? null : nearPortBoard(); nearHall = nearHallTerminal(); nearBrg = nearBridgeSign(); nearRd = nearBrg ? null : nearRoadSign(); nearPier = nearPierSign(); nearPCrate = nearPier ? null : nearPierCrate(); nearBt = nearPier || nearPCrate ? null : nearBoat(); nearAir = nearBt ? null : nearAirship(); nearCop = nearBt || nearAir ? null : nearCopter();
  nearFogL = nearFogLocker(); nearBd = nearBody(); nearGd = G.char.loc === 'overworld' && nearGuide(); nearSur = G.char.loc === 'overworld' ? nearSurrendered() : null;
  updateWorkshop(dt); nearSv = salvageTarget(); updateSalvage(dt, nearSv); nearDp = nearDrop(); nearHW = handworkTarget(); if (nearHW) nearDp = nearHW.p; updateHandwork(dt, nearHW);
  nearFl = nearFall(); nearLock2 = nearLocker(); nearRec = !nearLock2 && nearConsole(); nearData = nearCarrier();
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
    // (0.238.2) measured against the tread under you, not the landing: a quick climb used to rise past y0 + 1
    // within 0.35 m of the doorway, skip the window and leave you standing on the stairs
    const tread = (p.up ? 1 : -1) * Math.min(6, Math.max(0, along - 0.25));
    if (along > 0.9 && along < 4 && lat < 1.6 && Math.abs(pos.y - p.y0 - tread) < 1.2 && G.playing && !G.trans) enter = p;
  }
  const { nearNpc, nearLock, nearChest, nearPortal } = W, prompt = el.prompt;
  const busy = !!(nearRd || nearFl || nearBd || nearLd || nearPt || nearAncientTablet || nearAncient || inBoat() || inAir() || nearAir || nearCop || nearDp || nearRide || nearGd || nearSur || nearFogL || nearBt || (nearHall !== null || nearComms !== null || nearPump !== null || nearSL !== null || nearLH !== null || nearChg !== null) || nearIns || nearBrg || nearPier || nearPCrate || nearData || nearLock2 || nearRec || nearLad || nearMine || nearPow || nearCar || nearWork2 || nearNpc || nearLock || nearChest || nearBoard || nearMap || nearStash || nearVehicle || nearGate || nearHD || nearDesk || nearWk || nearSt || nearTerm || nearSt || nearGun || nearHatch || nearCave || nearPyr || caveOut >= 0);
  nearFood = busy ? null : nearPlant();
  nearWork = busy || nearFood ? null : nearBench();
  nearClaim = busy || nearFood || nearWork ? null : nearFlag();
  nearCook = !busy && !nearFood && !nearWork && !nearClaim && G.char.loc === 'overworld' && !!nearFire();
  nearGather = busy || nearFood || nearWork || nearClaim || nearCook ? null : gatherTarget();
  updateGather(dt, nearGather);
  nearWater = G.char.loc === 'overworld' && !nearFood && !nearCook && !nearWork && !nearClaim && !nearGather && !nearNpc && !nearChest && !nearBoard && !nearStash && !nearVehicle && !nearMine && !nearPow && !nearCar && !nearWork2 ? waterSource(loadedWells()) : null;
  if (eating()) { prompt.className = ''; prompt.textContent = eatingPrompt(); } // (0.279)
  else if (workshopWorking()) { prompt.className = ''; prompt.textContent = workPrompt(); }
  else if (climbing()) { prompt.className = ''; prompt.textContent = tl('W / S — up or down · Space — let go'); }
  else if (nearSv && (salvageTakesE(nearSv) || !W.nearChest)) { prompt.className = salvageTakesE(nearSv) ? '' : 'lock'; prompt.textContent = salvagePrompt(nearSv); }
  else if (nearHW) { prompt.className = ''; prompt.textContent = handworkPrompt(nearHW); }
  else if (nearDp) { prompt.className = ''; prompt.textContent = dropPrompt(nearDp); }
  else if (nearRide) { prompt.className = nearRide.seat < 0 ? 'lock' : ''; prompt.textContent = ridePrompt(nearRide); }
  else if (nearAncientTablet) { prompt.className = 'portal'; prompt.textContent = tl('E — read the ancient address tablet'); }
  else if (nearAncient) { prompt.className = 'portal'; prompt.textContent = tl('E — dial the ancient gate'); }
  else if (nearHatch) { prompt.className = 'portal'; prompt.textContent = tl('E — descend one level'); }
  else if (nearDecoy) { prompt.className = ''; prompt.textContent = tl('METRO · Caved in: the stairs are buried under rubble. No way down here.'); }
  else if (nearComms !== null) { prompt.className = ''; prompt.textContent = tl('E — restore the satellite receiver'); }
  else if (nearPump !== null) { prompt.className = ''; prompt.textContent = tl('E — the fuel pump (fill your vehicle from the village stores)'); }
  else if (nearSL !== null) { prompt.className = ''; prompt.textContent = streetLampPrompt(nearSL); }
  else if (nearLH !== null) { prompt.className = ''; prompt.textContent = lighthousePrompt(nearLH); }
  else if (nearChg !== null) { prompt.className = ''; prompt.textContent = chargerPrompt(nearChg); }
  else if (nearHall !== null) { prompt.className = ''; prompt.textContent = tl('E — the village hall\'s terminal (the village\'s stock)'); }
  else if (nearBt) { prompt.className = ''; prompt.textContent = boatPrompt(nearBt); }
  else if (nearPier) { prompt.className = ''; prompt.textContent = nearPier.done ? tl('E — the dock') : tl('E — build the dock'); }
  else if (nearPCrate) { prompt.className = ''; prompt.textContent = tl('E — open the crate on the dock'); }
  else if (nearRd) { prompt.className = ''; prompt.textContent = roadSignPrompt(nearRd); }
  else if (nearBrg) { prompt.className = ''; prompt.textContent = bridgeBuilt(nearBrg) ? TL`E — the bridge over the ${nearBrg.river}` : TL`E — build a bridge over the ${nearBrg.river}`; }
  else if (nearPt) { prompt.className = ''; const o = G.char.outposts[nearPt.id]; prompt.textContent = TL`E — ${o?.name ?? tl('the port')}` + (o?.job ? TL` (building the ${partName(o.k, o.job.p, o.pk).toLowerCase()}, ${Math.max(0, Math.ceil((jobEnd(o) - G.char.time) / 60))} h left)` : ''); }
  else if (nearLd) { prompt.className = ''; const o = G.char.outposts[nearLd.id]; prompt.textContent = !o?.k ? TL`E — ${nearLd.name}: stake an outpost` : TL`E — outpost at ${nearLd.name}` + (o.job ? TL` (building the ${partName(o.k, o.job.p, o.pk).toLowerCase()}, ${Math.max(0, Math.ceil((jobEnd(o) - G.char.time) / 60))} h left)` : o.done?.dig ? ' (working)' : tl(' (nothing built yet)')); }
  else if (nearIns) { prompt.className = ''; prompt.textContent = TL`E — the control desk (${installDone(nearIns.k, G.char.installs[nearIns.k]) ? tl('restored') : TL`${G.char.installs[nearIns.k]?.stage ?? 0} of ${INSTALL_STAGES[nearIns.k].length} stages restored`})`; }
  else if (nearSur) { prompt.className = ''; prompt.textContent = tl('E — take his things and let him go'); } // (0.228)
  else if (nearGd) { prompt.className = ''; prompt.textContent = TL`E — talk to ${GUIDE.name}`; }
  else if (nearBd) { prompt.className = ''; prompt.textContent = TL`E — search the body of ${nearBd.n}`; }
  else if (nearFogL) { prompt.className = ''; prompt.textContent = G.char.containers[`${nearFogL.f.id}:${nearFogL.i}`] ? tl('E — search the locker') : tl('E — force the sealed locker open'); }
  else if (nearData) { prompt.className = ''; prompt.textContent = carrierPrompt(nearData); }
  else if (nearFl) { prompt.className = ''; prompt.textContent = tl('E — search the fallen container'); }
  else if (nearLock2) { prompt.className = ''; prompt.textContent = tl('E — search the ship\'s locker'); }
  else if (nearRec) { prompt.className = ''; prompt.textContent = tl('E — read the flight recorder'); }
  else if (nearLad) { prompt.className = ''; prompt.textContent = ladderPrompt(nearLad); }
  else if (nearGate) { prompt.className = ''; prompt.textContent = doorPrompt(nearGate); }
  else if (nearDesk) { prompt.className = ''; prompt.textContent = TL`E — the ${CHARIOT} (${stagesDone(G.char.shuttle)} of ${STAGES.length} stages done)`; }
  else if (nearTerm) { prompt.className = ''; prompt.textContent = tl('E — use the village computer'); }
  else if (nearSt) { const t = stationPrompt(nearSt); prompt.className = t.startsWith('E') ? '' : 'lock'; prompt.textContent = t; }
  else if (nearWk) { const t = worksPrompt(nearWk); prompt.className = t.startsWith('E') ? '' : 'lock'; prompt.textContent = t; }
  else if (nearHD) { const t = houseDoorPrompt(nearHD); prompt.className = t.locked ? 'lock' : ''; prompt.textContent = t.text; }
  else if (nearPyr) { prompt.className = 'portal'; prompt.textContent = TL`E — go down into ${nearPyr.site.name}`; }
  else if (nearCave) { prompt.className = 'portal'; prompt.textContent = tl('E — enter ') + nearCave.name + (nearCave.other ? tl(' (it runs through the mountain)') : ''); }
  else if (caveOut >= 0) { const info = G.char.dungeon!.cave!; prompt.className = 'portal'; prompt.textContent = tl('E — leave the cave') + (info.mouths.length > 1 && caveOut !== info.from ? tl(' (the far side of the mountain)') : ''); }
  else if (nearGun) { prompt.className = ''; prompt.textContent = nearGun.p.off ? tl('E — switch the turret on') : tl('E — switch the turret off'); }
  else if (nearMine) { prompt.className = ''; prompt.textContent = homePrompt(nearMine); }
  else if (nearWork2) { const t = sitePrompt(nearWork2); prompt.className = t.startsWith('E') ? '' : 'lock'; prompt.textContent = t; }
  else if (nearCar) { prompt.className = ''; prompt.textContent = TL`E — talk to the caravan (${nearCar.fromName} → ${nearCar.toName}, ${ITEMS[nearCar.good].name})`; }
  else if (nearPow) { const t = powerPrompt(nearPow); prompt.className = t.startsWith('E') ? '' : 'lock'; prompt.textContent = t; }
  else if (nearNpc) { prompt.className = ''; prompt.textContent = G.isTouch ? nearNpc.name : tl('E — talk to ') + nearNpc.name; }
  else if (nearLock) {
    prompt.className = 'lock';
    prompt.textContent = hasItem('key') ? (G.isTouch ? tl('Locked door') : tl('E — unlock with an Access Key')) : tl('Locked. Requires an Access Key');
  }
  else if (nearChest) { prompt.className = ''; prompt.textContent = G.isTouch ? tl('Chest') : nearChest.open ? tl('E — search the chest') : tl('E — open chest'); }
  else if (nearBoard) { prompt.className = ''; prompt.textContent = G.isTouch ? '' : tl('E — read the notice board'); }
  else if (nearMap) { prompt.className = ''; prompt.textContent = tl('E — study the map of the surroundings'); }
  else if (nearStash) { prompt.className = ''; prompt.textContent = G.isTouch ? '' : tl('E — search the bandit stash'); }
  else if (nearVehicle) { prompt.className = ''; prompt.textContent = G.isTouch ? '' : 'E — ' + nearVehicle.label; }
  else if (nearPortal) { prompt.className = 'portal'; prompt.textContent = nearPortal.label; }
  else if (nearFood) { prompt.className = ''; prompt.textContent = plantPrompt(nearFood); }
  else if (nearWork) { prompt.className = ''; prompt.textContent = tl('E — use the workbench'); }
  else if (nearClaim) { prompt.className = ''; prompt.textContent = tl('E — take down your flag (the land goes back to how it was)'); }
  else if (nearGather) { prompt.className = ''; prompt.textContent = gatherPrompt(nearGather); }
  else if (nearCook) { prompt.className = ''; prompt.textContent = fireHasWork() ? tl('E — roast your raw meat') : tl('A campfire: bring raw meat to roast'); }
  else if (nearWater) { prompt.className = nearWater.kind === 'toxic' || nearWater.kind === 'sea' ? 'lock' : ''; prompt.textContent = sourcePrompt(nearWater); }
  prompt.style.display = (nearRd || nearSv || nearFl || nearBd || nearLd || nearPt || nearAncientTablet || nearAncient || climbing() || nearDp || nearRide || nearGd || nearSur || nearFogL || nearBt || (nearHall !== null || nearComms !== null) || nearIns || nearBrg || nearPier || nearPCrate || nearData || nearLock2 || nearRec || nearLad || nearMine || nearPow || nearCar || nearWork2 || nearGate || nearHD || nearDesk || nearWk || nearSt || nearTerm || nearTerm || nearGun || nearHatch || nearDecoy || nearCave || nearPyr || caveOut >= 0 || nearNpc || nearLock || nearChest || nearBoard || nearMap || nearStash || nearVehicle || nearPortal || nearFood || nearWork || nearClaim || nearGather || nearCook || nearWater) && G.playing && prompt.textContent ? 'block' : 'none';
  const bh = buildHint();
  if (bh !== null && !nearGate && !nearGun) { prompt.className = buildOk() ? '' : 'lock'; prompt.textContent = bh; prompt.style.display = G.playing && bh ? 'block' : 'none'; }
  const bth = boatHint();
  if (bth !== null) { prompt.className = ''; prompt.textContent = bth; prompt.style.display = G.playing ? 'block' : 'none'; }
  const ath = copterHint() ?? airHint() ?? (nearAir ? airPrompt(nearAir) : nearCop ? copterPrompt(nearCop) : null); // (0.256) the airship you sit in or stand by
  if (ath !== null) { prompt.className = ''; prompt.textContent = ath; prompt.style.display = G.playing && ath ? 'block' : 'none'; }
  const phint = pierPlacingHint();
  if (phint !== null) { prompt.className = pierPlacingOk() ? '' : 'lock'; prompt.textContent = phint; prompt.style.display = G.playing && phint ? 'block' : 'none'; }
  const shint = sawingHint();
  if (shint !== null) { prompt.className = ''; prompt.textContent = shint; prompt.style.display = G.playing ? 'block' : 'none'; }
  const whint = whPlacingHint(); // (0.249) staking out a warehouse
  if (whint !== null) { prompt.className = whPlacingOk() ? '' : 'lock'; prompt.textContent = whint; prompt.style.display = G.playing && whint ? 'block' : 'none'; }
  const hhint = lhPlacingHint();
  if (hhint !== null) { prompt.className = lhPlacingOk() ? '' : 'lock'; prompt.textContent = hhint; prompt.style.display = G.playing && hhint ? 'block' : 'none'; }
  const lhint = streetPlacingHint();
  if (lhint !== null) { prompt.className = streetPlacingOk() ? '' : 'lock'; prompt.textContent = lhint; prompt.style.display = G.playing && lhint ? 'block' : 'none'; }
  const fhint = fieldPlacingHint();
  if (fhint !== null) { prompt.className = fieldPlacingOk() ? '' : 'lock'; prompt.textContent = fhint; prompt.style.display = G.playing && fhint ? 'block' : 'none'; }
  const rhint = roadSurveyHint(); // (0.280) staking out a track
  if (rhint !== null) { prompt.className = roadSurveyOk() ? '' : 'lock'; prompt.textContent = rhint; prompt.style.display = G.playing && rhint ? 'block' : 'none'; }
  const bhint = bridgePlacingHint();
  if (bhint !== null) { prompt.className = bridgePlacingOk() ? '' : 'lock'; prompt.textContent = bhint; prompt.style.display = G.playing && bhint ? 'block' : 'none'; }
  const thint = throwHint(); // (0.225) the swing of a throw
  if (thint !== null) { prompt.className = ''; prompt.textContent = thint; prompt.style.display = G.playing ? 'block' : 'none'; }
  const hint = placingHint();
  if (hint !== null) { prompt.className = placingOk() ? '' : 'lock'; prompt.textContent = hint; prompt.style.display = G.playing && hint ? 'block' : 'none'; }
  const canUse = nearHatch || nearNpc || nearChest || nearBoard || nearStash || nearVehicle || (nearLock && hasItem('key'));
  el.bUse.textContent = nearHatch ? tl('DESCEND') : nearNpc ? tl('TALK') : nearLock ? tl('UNLOCK') : nearChest ? tl('OPEN') : nearBoard ? tl('READ') : nearStash ? tl('OPEN') : nearVehicle ? (nearVehicle.kind === 'drive' ? tl('DRIVE') : tl('TRUNK')) : tl('OPEN');
  el.bUse.classList.toggle('on', !!canUse && G.playing);
  const hatch = W.hatch;
  if (hatch) {
    hatch.rings.forEach((r, i) => { const ph = (time * 0.8 + i / 4) % 1; (r.material as THREE.Material).opacity = 1 - ph; r.scale.setScalar(1 - ph * 0.35); });
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
export function lockKey() { if (driving.v) { const m = toggleHeadlights(); if (m) logLine(m); return; } if (nearGate) lockMenu(nearGate); else lightKey(); } // (0.199) away from a lockable door L switches your light; (0.203) at the wheel the headlights
/** E key / use button. */
export function interact() {
  if (driving.v) { leave(); return; }
  if (riding()) { getOff(); return; }
  if (climbing()) return;
  if (nearHatch) { nearHatch = false; descend(); return; }
  if (inCopter()) { copterUse(); return; }
  if (inAir()) { airUse(); return; }
  if (inBoat()) { stepOff(); return; }
  if (salvageTakesE(nearSv)) return; // (0.272) held E strips the machine: world/salvage.ts
  if (nearHW) return; // (0.263) held E works it, a tap picks it up: world/handwork.ts
  if (nearDp) { takeDrop(nearDp); return; }
  if (nearRide) { boardRide(nearRide); return; }
  if (nearBt) { board(nearBt); return; }
  if (nearAir) { boardAir(nearAir); return; }
  if (nearCop) { boardCopter(nearCop); return; }
  if (nearComms !== null) { openSettlementComms(nearComms); return; }
  if (nearPump !== null) { openFuelPump(nearPump); return; }
  if (nearSL !== null) { openStreetLamp(nearSL); return; }
  if (nearLH !== null) { openLighthouse(nearLH); return; }
  if (nearHall !== null) { openHall(nearHall); return; }
  if (nearLd) { openOutpost(nearLd); return; }
  if (nearPt) { openPort(nearPt.id, nearPt.p.id); return; }
  if (nearIns) { openInstall(nearIns); return; }
  if (isRoadSurvey()) { confirmRoadSurvey(); return; }
  if (nearRd) { openRoad(nearRd); return; }
  if (nearBrg) { openBridge(nearBrg); return; }
  if (nearPier) { openPier(nearPier); return; }
  if (nearPCrate) { openTransfer({ title: tl('Crate'), subtitle: tl('Your dock'), boxLabel: tl('Crate'), box: pierCrate(nearPCrate) }); return; }
  if (nearSur) { spareBandit(nearSur); return; }
  if (nearGd) { talkGuide(); return; }
  if (nearBd) { const h = Math.ceil(bodyLeft(nearBd, G.char.time) / 60); openTransfer({ title: TL`The body of ${nearBd.n}`, subtitle: TL`Gone in ${h} h`, boxLabel: tl('Body'), box: G.char.containers[nearBd.id] }); return; }
  if (nearFogL) { openTransfer({ title: tl('Locker'), subtitle: `${FOG_SITE[nearFogL.f.site].name}, ${nearFogL.f.name}`, boxLabel: tl('Locker'), box: fogLocker(nearFogL.f, nearFogL.i) }); return; }
  if (nearData) { takeCarrier(nearData); return; }
  if (nearFl) { const b = fallBox(); if (b) openTransfer({ title: tl('Fallen container'), subtitle: tl('It came down from orbit'), boxLabel: tl('Container'), box: b }); return; }
  if (nearLock2) { openTransfer({ title: G.char.name ? TL`${G.char.name}'s locker` : tl('Locker'), subtitle: SHIP_NAME + tl(' · only you open it'), boxLabel: tl('Locker'), box: lockerBox() }); return; }
  if (nearRec) { openLogbook(); return; }
  if (nearLad) { const m = startClimb(nearLad); if (m) logLine(m); return; }
  if (isPlacing()) { confirmPlacing(); return; }
  if (isLhPlacing()) { confirmLhPlacing(); return; }
  if (isWhPlacing()) { void confirmWhPlacing(); return; }
  if (isStreetPlacing()) { void confirmStreetPlacing(); return; }
  if (isFieldPlacing()) { void confirmFieldPlacing(); return; }
  if (isBridgePlacing()) { confirmBridgePlacing(); return; }
  if (isPierPlacing()) { confirmPierPlacing(); return; }
  if (nearGate) { toggleDoor(nearGate); return; }
  if (nearHD) { const m = toggleHouseDoor(nearHD); if (m) logLine(m); return; }
  if (nearDesk) { openShuttle(); return; }
  if (nearWk) { if (!openWorks(nearWk)) logLine(worksPrompt(nearWk) + '.'); return; }
  if (nearAncientTablet) { openGateTablet(nearAncientTablet); return; }
  if (nearAncient) { openGateConsole(nearAncient); return; }
  if (nearTerm) { openTerminal(nearTerm); return; }
  if (nearSt) { if (!openStation(nearSt)) logLine(stationPrompt(nearSt) + '.'); return; }
  if (nearGun) { toggleTurret(nearGun); return; }
  if (nearPyr) { enterPyramid(nearPyr.site, nearPyr.door.i); return; }
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
  else if (nearClaim) { const err = takeDownFlag(nearClaim); logLine(err || tl('You take the flag down. The land is no longer yours.')); }
  else if (nearGather) strike(nearGather);
  else if (nearCook) cookAll();
  else if (nearWater) useWater(nearWater);
}
