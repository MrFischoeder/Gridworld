// Entry point: load the character, build the first place, run the frame loop.
import './style.css';
import { renderer, scene, camera } from './world/render';
import { G, W, uiOpen } from './game';
import { loadChar } from './save';
import { calcStats, saveChar } from './character';
import { loadDungeon, loadOverworld, toVillage, saveOverworldPos, enterDungeon } from './world/level';
import { updatePlayer, EYE } from './world/player';
import { updateDoors, updateTrans } from './world/doors';
import { updateDrones, updateBosses, updateOrbs, animateFoes, updateBossBar, foeRules, makeDrone, damageFoe } from './world/enemies';
import { updateLoot } from './world/loot';
import { updateEntities } from './world/interact';
import { attack, animateVM, refreshWeaponVisibility, vmScene, syncViewmodel, updateGun, refreshGunLook } from './world/weapons';
import { updateFx, updateStreaks } from './world/fx';
import { updateStreaming, updateFieldEnemies, placeName, OW, groundAt, treeHit, animateCamps, keepOnPlanet } from './world/overworld';
import { collides, setWaterNote } from './world/player';
import { animateWater } from './world/water';
import { updateSurvival } from './world/survival';
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

G.char = loadChar();
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

refreshGunLook();
renderer.info.autoReset = false;
let last = performance.now(), perfT = 0, saveT = 0, clockT = 0;
function frame(now: number) {
  const dt = Math.min((now - last) / 1000, 0.05); last = now;
  const time = now / 1000;
  const outdoors = G.char.loc === 'overworld';
  let moving = false;
  const live = G.playing && !uiOpen() && !G.trans;
  if (outdoors) updateStreaming(G.trans ? 8 : 4);
  // the clock runs whenever the game is not paused in the menu
  if (G.playing) { G.char.time += dt * MIN_PER_SEC; updateSurvival(dt); }
  const clock = fmtClock(G.char.time);
  if (el.clock.textContent !== clock) el.clock.textContent = clock;
  if ((clockT -= dt) <= 0) {
    clockT = 1;
    if (refreshBoard()) { saveChar(); if (outdoors && Math.hypot(G.pos.x, G.pos.z) < 120) logLine('New notices are up on the board.'); }
  }
  if (live) {
    if (driving.v) updateDriving(dt); else moving = updatePlayer(dt);
    if (outdoors) keepOnPlanet(dt);
    G.cooldown -= dt; if (G.firing && !driving.v) attack();
    updateGun(dt, !driving.v);
    if (driving.v) fireCannon(dt);
    updateDoors(dt);
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
  if (sky.visible) { sky.position.set(camera.position.x, camera.position.y - 20, camera.position.z); horizon.position.set(camera.position.x, 0, camera.position.z); updateSky(G.char.time, latitude(G.pos.z)); }
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
