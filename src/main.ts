// Entry point: load the character, build the first place, run the frame loop.
import './style.css';
import { VERSION, BUILD } from './version';
import { renderer, scene, camera } from './world/render';
import { G, W, uiOpen } from './game';
import { loadChar } from './save';
import { calcStats, saveChar } from './character';
import { loadDungeon, loadOverworld, toVillage, saveOverworldPos, enterDungeon } from './world/level';
import { updatePlayer, EYE } from './world/player';
import { updateClimb } from './world/ladders';
import { updateDoors, updateTrans } from './world/doors';
import { updateDrones, updateBosses, updateOrbs, animateFoes, updateBossBar, foeRules, makeDrone, damageFoe } from './world/enemies';
import { updateLoot } from './world/loot';
import { updateEntities } from './world/interact';
import { attack, animateVM, refreshWeaponVisibility, vmScene, syncViewmodel, updateGun, refreshGunLook, syncHeld } from './world/weapons';
import { updateFx, updateStreaks } from './world/fx';
import { updateStreaming, updateFieldEnemies, placeName, OW, groundAt, treeHit, animateCamps, keepOnPlanet, villageHere } from './world/overworld';
import { collides, setWaterNote } from './world/player';
import { animateWater } from './world/water';
import { updateSurvival } from './world/survival';
import { updateRobots } from './world/robots';
import { updateFlora } from './world/flora';
import { updateCompass } from './ui/compass';
import { syncBenches } from './world/benches';
import { syncFlags, updatePlacing, isPlacing, confirmPlacing, cancelPlacing } from './world/claims';
import { syncBases, isBuilding, updateBuilding, placePart, stopBuilding } from './world/building';
import { syncTurrets, updateTurrets } from './world/turrets';
import { updateFires } from './world/cooking';
import { updatePower } from './world/power';
import { updateCaravans } from './world/caravans';
import { updateVillageRaids, updateFallen } from './world/villageraid';
import { updateIndustry } from './world/industry';
import { updateContracts } from './ui/contracts';
import { regionRoads } from './gen/roads';
import { generateQuest } from './gen/quests';
import { poisNear } from './gen/regions';
import { sky, horizon, updateSky } from './world/sky';
import { MIN_PER_SEC, fmtClock } from './core/time';
import { latitude } from './gen/regions';
import { updateCreatures, spawnCreatureNear } from './world/creatures';
import { updateBandits, spawnBanditsNear } from './world/bandits';
import { updateRaiders, spawnRaiderNear, forceAmbush, raiders } from './world/raiders';
import { updateTracker, boardOffers, accept, syncQuestWorld, refreshBoard } from './world/quests';
import { driving, updateDriving, vehicleCamera, vehicles, buyVehicle, fireCannon, smokeWrecks, damageVehicle } from './world/vehicles';
import { interact } from './world/interact';
import { el, updateHud, logLine } from './ui/hud';
import { drawMini } from './ui/minimap';
import { toggleMap } from './ui/worldmap';
import { initInput } from './ui/input';
import { initTouch } from './ui/touch';
import { initMenu, showMenu } from './ui/menu';
import { farPeaks, updateFarPeaks } from './world/farpeaks';
import { updateHouseDoors } from './world/housedoors';
import { updateWallGuns } from './world/wallguns';
import { updateWorks } from './world/works';
import { updateStations } from './world/stations';
import { updateChariot } from './ui/shuttle';
import { updateWeather, seen } from './world/weather';
import { WEATHER_NAME } from './gen/weather';

G.char = loadChar();
document.getElementById('vnum')!.textContent = 'v' + VERSION;
document.getElementById('version')!.textContent = BUILD;
document.title = 'GridWorld v' + VERSION;
setWaterNote(logLine);
calcStats(); G.hp = G.S.maxHp; G.ammo = G.gun.mag;

initInput(() => { toggleMap(false); showMenu(); });
initTouch();
initMenu({
  newWorld(seed) {
    const c = G.char;
    Object.assign(c, { world: seed, loc: 'overworld', ow: null, dungeon: null, discovered: {}, opened: {}, unlocked: {}, killed: {} });
    saveChar(); loadOverworld({ kind: 'new' });
  },
  freshStart() { loadOverworld({ kind: 'new' }); },
});

if (G.char.loc === 'dungeon' && G.char.dungeon) loadDungeon(null); else { G.char.loc = 'overworld'; loadOverworld({ kind: 'saved' }); }

refreshGunLook(); syncHeld();
renderer.info.autoReset = false;
let last = performance.now(), perfT = 0, saveT = 0, clockT = 0;
let benchT = 0; // workbenches in the wilds are synced about once a second
function frame(now: number) {
  const dt = Math.min((now - last) / 1000, 0.05); last = now;
  const time = now / 1000;
  const outdoors = G.char.loc === 'overworld';
  let moving = false;
  const live = G.playing && !uiOpen() && !G.trans;
  if (outdoors) updateStreaming(G.trans ? 8 : G.fly ? 14 : 4); // flying fast needs the land streamed in quicker
  // the clock runs whenever the game is not paused in the menu
  if (G.playing) { G.char.time += dt * MIN_PER_SEC; updateSurvival(dt); updateFlora(dt); updateFires(dt, time); updatePower(dt); updateHouseDoors(dt); updateWallGuns(dt); updateWorks(dt); updateStations(dt); updateChariot(dt); updateCaravans(dt); updateVillageRaids(dt); updateFallen(dt); updateIndustry(dt); updateContracts(dt); if ((benchT -= dt) <= 0) { benchT = 1; syncBenches(); syncFlags(); syncBases(); syncTurrets(); } }
  updateCompass(dt); // hides itself while paused
  const clock = fmtClock(G.char.time) + (G.char.loc === 'overworld' && seen.kind !== 'clear' ? ' · ' + WEATHER_NAME[seen.kind] : '');
  if (el.clock.textContent !== clock) el.clock.textContent = clock;
  if ((clockT -= dt) <= 0) {
    clockT = 1;
    { const up = refreshBoard(); if (up.length) { saveChar(); const v = outdoors ? villageHere(G.pos.x, G.pos.z) : undefined; if (v && up.includes(v.id)) logLine('New notices are up on the board.'); } }
  }
  if (live) {
    if (driving.v) updateDriving(dt); else if (!updateClimb(dt)) moving = updatePlayer(dt);
    if (outdoors) keepOnPlanet(dt);
    G.cooldown -= dt;
    if (isPlacing()) { // holding a Flagpole: the mouse picks its spot instead of fighting
      updatePlacing();
      if (G.firing) { G.firing = false; confirmPlacing(); }
      if (G.aiming) { G.aiming = false; cancelPlacing(); }
    } else if (isBuilding()) { // building on your claim: the mouse builds
      updateBuilding();
      if (G.firing) { G.firing = false; placePart(); }
      if (G.aiming) { G.aiming = false; stopBuilding(); }
    } else if (G.firing && !driving.v) attack();
    updateTurrets(dt);
    updateGun(dt, !driving.v);
    if (driving.v) fireCannon(dt);
    updateDoors(dt);
    updateRobots(dt, time); // the open world's robots, or a crashed ship's guards
    if (outdoors) { updateFieldEnemies(dt); updateCreatures(dt, time); updateBandits(dt, time); updateRaiders(dt); animateCamps(time); smokeWrecks(dt); animateWater(time); }
    updateDrones(dt);
    const boss = updateBosses(dt, time); updateOrbs(dt);
    updateBossBar(boss);
    if (G.god) G.hp = G.S.maxHp;
    if (G.hp <= 0) { el.warp.style.opacity = '1'; toVillage('death'); }
    updateLoot(dt, time); updateEntities(dt, time);
    if (outdoors) {
      const name = placeName(G.pos.x, G.pos.z);
      if (el.hudL.textContent !== name) el.hudL.textContent = name;
      refreshWeaponVisibility();
      if ((saveT -= dt) <= 0) { saveT = 3; saveOverworldPos(); }
    }
  } else { el.prompt.style.display = 'none'; el.bUse.classList.remove('on'); el.bossbar.style.display = 'none'; }
  if (G.trans) updateTrans(dt, camera); else if (driving.v) vehicleCamera(camera); else camera.position.set(G.pos.x, G.pos.y + EYE, G.pos.z);
  camera.rotation.set(G.pitch, G.yaw, 0);
  updateWeather(dt, sky.visible);
  if (sky.visible) { sky.position.set(camera.position.x, camera.position.y - 20, camera.position.z); horizon.position.set(camera.position.x, 0, camera.position.z); updateSky(G.char.time, latitude(G.pos.z)); updateFarPeaks(camera.position); } else farPeaks.visible = false;
  // flying (dev): the real land reaches past the horizon rings, so they step aside and the camera sees further
  if (sky.visible) { horizon.visible = !G.fly && seen.fog < 0.45; if (G.fly || seen.fog > 0.45) farPeaks.visible = false; } // fog hides the far ranges
  const far = G.fly ? 600 : 200; if (camera.far !== far) { camera.far = far; camera.updateProjectionMatrix(); }
  el.cross.style.display = driving.v && !driving.cockpit && !driving.v.turret ? 'none' : '';
  animateVM(dt, moving);
  animateFoes(dt, time, camera.position);
  updateFx(dt);
  updateHud(dt); updateTracker(dt);
  updateStreaks(dt); drawMini();
  renderer.info.reset(); // two passes per frame: count both (F3 overlay)
  renderer.render(scene, camera);
  // held weapon on top of the world
  camera.updateMatrixWorld(); syncViewmodel();
  renderer.autoClear = false; renderer.clearDepth(); renderer.render(vmScene, camera); renderer.autoClear = true;
  if ((perfT -= dt) <= 0 && el.perf.style.display === 'block') {
    perfT = 0.5; const r = renderer.info.render;
    el.perf.textContent = `${Math.round(1 / Math.max(dt, 1e-3))} fps\nlines ${r.lines}\ntriangles ${r.triangles}\ncalls ${r.calls}\nfoes ${W.drones.length}`;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Debug handle for automated checks in development builds.
if (import.meta.env.DEV) Object.assign(window, { __game: { G, W, OW, camera, scene, renderer, regionRoads, poisNear, groundAt, treeHit, collides, vehicles, driving, interact, buy: buyVehicle, foeRules, makeDrone, spawnCreature: spawnCreatureNear, damageFoe, boardOffers, accept, syncQuestWorld, enterDungeon, generateQuest, spawnBandits: spawnBanditsNear, spawnRaider: spawnRaiderNear, forceAmbush, raiders, damageVehicle } });
