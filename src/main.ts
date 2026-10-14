import './ui/htmllang'; // (0.190) the page's static texts in the player's language, before anything else
// Entry point: load the character, build the first place, run the frame loop.
import { setVehicleProtection } from './world/damage';
import { relay, net } from './net/client';
import './style.css';
import { VERSION, BUILD } from './version';
import { nearMegalith } from './world/megaliths';
import { renderer, scene, camera, fog } from './world/render';
import { G, W, uiOpen } from './game';
import { loadChar, newChar, SAVE_KEY, type Char } from './save';
import { initItemTips } from './ui/itemtip';
import { calcStats, saveChar, armoured, handsChanged } from './character';
import { loadDungeon, loadOverworld, toVillage, saveOverworldPos, enterDungeon, enterCustom, type Arrival } from './world/level';
import { takeTest, testWaiting, syncCustomWorld, worldAsked } from './world/custommaps';
import { initRebirth } from './ui/rebirth';
import { isFieldPlacing, updateFieldPlacing, confirmFieldPlacing, cancelFieldPlacing } from './world/fields';
import { isLhPlacing, updateLhPlacing, confirmLhPlacing, cancelLhPlacing, updateLighthouses } from './world/lighthouses';
import { isStreetPlacing, updateStreetPlacing, confirmStreetPlacing, cancelStreetPlacing, updateStreetLamps } from './world/streetlamps';
import { updateSawing } from './world/sawing';
import { updateHomes } from './world/home';
import { updatePlayer, EYE } from './world/player';
import { updateClimb, climbing } from './world/ladders';
import { updateDoors, updateTrans } from './world/doors';
import { updateDrones, updateBosses, updateOrbs, animateFoes, updateBossBar, foeRules, makeDrone, damageFoe } from './world/enemies';
import { updateLoot } from './world/loot';
import { updateEntities } from './world/interact';
import './ui/sound';
import { initSound, setSoundCamera, setLocHook, updateMySteps, updateFoeSounds, updateSoundFrame } from './world/sound';
import { updateBodySway, updateRecoil, recoilView, attack, animateVM, refreshWeaponVisibility, vmScene, syncViewmodel, updateGun, refreshGunLook, syncHeld } from './world/weapons';
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
import { updateMountedTurrets } from './world/mountedturrets';
import { syncTurrets, updateTurrets } from './world/turrets';
import { updateFires } from './world/cooking';
import { updatePower } from './world/power';
import { updateSettlementSites } from './world/settlement';
import { updateJobSites } from './world/jobsites';
import { updateForge } from './ui/orders';
import { updateGarage } from './ui/garage';
import { updateCaravans } from './world/caravans';
import { updateVillageRaids, updateFallen } from './world/villageraid';
import { updateIndustry } from './world/industry';
import { updateContracts } from './ui/contracts';
import { regionRoads } from './gen/roads';
import { generateQuest } from './gen/quests';
import { poisNear, nearX } from './gen/regions';
import { sky, horizon, updateSky, shapeHorizon } from './world/sky';
import { updateLight, setDrivingHook, addLights } from './world/light';
import { LIGHT } from './gen/darkness';
import { fireSpots } from './world/cooking';
import { litLamps } from './world/power';
import { peerLights } from './world/peers';
import { campFires } from './world/overworld';
import { MIN_PER_SEC, fmtClock } from './core/time';
import { latitude } from './gen/regions';
import { updateCreatures, spawnCreatureNear } from './world/creatures';
import { updateStealth } from './world/stealth';
import { updateBandits, spawnBanditsNear } from './world/bandits';
import { updateRaiders, spawnRaiderNear, forceAmbush, raiders } from './world/raiders';
import { updateTracker, boardOffers, accept, syncQuestWorld, refreshBoard } from './world/quests';
import { driving, updateDriving, vehicleCamera, vehicles, buyVehicle, fireCannon, smokeWrecks, damageVehicle } from './world/vehicles';
import { interact } from './world/interact';
import { el, updateHud, logLine, showToast } from './ui/hud';
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
import { introOn, renderIntro } from './ui/intro';
import { updateCrash } from './world/crashpod';
import { spinCarrier } from './world/datacarriers';
import { updateFarms } from './world/farms';
import { updateInstalls } from './world/installs';
import { updateCities } from './world/cities';
import { updateToxic, tintToxic, toxicHere } from './world/toxic';
import { updateGuide } from './world/guide';
import { updateBridges, isBridgePlacing, updateBridgePlacing, confirmBridgePlacing, cancelBridgePlacing } from './world/bridges';
import { updatePiers, isPierPlacing, updatePierPlacing, confirmPierPlacing, cancelPierPlacing } from './world/piers';
import { updateBoats, inBoat, boatCamera } from './world/boats';
import { initMp } from './ui/mp';
import { updatePeers, ride, ghostOf, myLoc } from './world/peers';
import { riding, updateRide, rideCamera } from './world/ride';
import { SEATS } from './data/vehicles';
/** Riding at another player's cannon (the crosshair stays for aiming it). */
const SEATS_GUN = () => { const o = ride.on, g = o ? ghostOf(o.owner, o.idx) : null; return !!g && !!SEATS[g.m][o!.seat]?.gun; };
import { syncDrops, clearLocalDrops } from './world/drops';
import { syncWorld, setWorldReload } from './world/share';
import { syncFoes } from './world/foesync';
import { updateGarrisons } from './world/citygarrisons';
import { refreshGateConsole } from './ui/worldgates';
import { teleportVehicle, vehiclesNear, headlightSpot } from './world/vehicles';
import { setRideWarpArrival } from './world/ride';
import { setGateTravel, updateWorldGates, gateTravelPending } from './world/worldgates';
import { gateName } from './gen/worldgates';
import './ui/ground'; // the ground beside the backpack (after the world modules: it imports world/loot)
import { updateCharging } from './world/charging';
import { updateLodes } from './world/lodes';
import { updateOutpostRaids } from './world/outpostraid';
import { updateRouteTrucks } from './world/convoyroutes';
import { updateRivals } from './world/rivals';
import { syncVillagePads } from './world/overworld';
import { tl, TL } from './i18n';
/** Redraw the open world from the save where you stand (after taking the server's shared world). */
function reloadWorld() { if (G.char.loc !== 'overworld') return; saveOverworldPos(); loadOverworld({ kind: 'saved' }); }
setWorldReload(reloadWorld);

setVehicleProtection(() => !!driving.v || riding(), damage => {
  if (driving.v) damageVehicle(driving.v, damage);
  else if (ride.on) relay({ t: 'hurt', dmg: damage, loc: 'o', car: net.peers.get(ride.on.owner)?.st?.carIds?.[ride.on.idx], carIndex: ride.on.idx }, ride.on.owner);
}, armoured);
G.char = loadChar();
const cwMissing = !syncCustomWorld(G.char); // (0.208) a world drawn in the editor: its file, before anything is generated
document.getElementById('vnum')!.textContent = 'v' + VERSION;
document.getElementById('version')!.textContent = BUILD;
document.title = tl('GridWorld v') + VERSION;
setWaterNote(logLine);
calcStats(); G.hp = G.S.maxHp; G.ammo = G.gun.mag;

initInput(() => { toggleMap(false); showMenu(); });
initTouch();
/** Play another character from now on (a new game, or your hero on a server): stats, hands, then the place it stands in. */
function useChar(c: Char, a?: Arrival) {
  G.char = c; G.crouch = false;
  if (!syncCustomWorld(c)) setTimeout(() => showToast(TL`The editor world ${c.cw ?? ''} is not in this browser: its land comes from the seed alone.`));
  G.trans = null; el.warp.style.opacity = '0'; // a switch of character never keeps a death's or a stairway's black fade
  calcStats(); handsChanged(); G.hp = G.S.maxHp;
  clearLocalDrops(); saveChar();
  if (!a && c.loc === 'dungeon' && c.dungeon) loadDungeon(null);
  else { c.loc = 'overworld'; c.dungeon = null; loadOverworld(a ?? { kind: c.ow ? 'saved' : 'new' }); } // a new castaway wakes in their cryo-pod
  refreshGunLook(); syncHeld();
}
initMenu({
  newWorld(seed, cw) { // a new map is a new game: an empty kit, an undeveloped town, no quests, Wiktor waiting at the ship
    const old = G.char;
    try {
      localStorage.setItem('gridWorld.world.backup.' + old.world, JSON.stringify(old));
      const solo = localStorage.getItem(SAVE_KEY + '.solo'); // your own save that waited while you were online: kept aside too, the new game is now yours
      if (solo) { localStorage.setItem('gridWorld.world.backup.' + (JSON.parse(solo).world ?? 'solo'), solo); localStorage.removeItem(SAVE_KEY + '.solo'); }
    } catch { /* unavailable */ }
    useChar(Object.assign(newChar(), { world: seed, name: old.name }, cw ? { cw } : {})); // (0.208) cw: a world drawn in the editor
  },
  freshStart() { loadOverworld({ kind: 'new' }); },
});
initMp({ useChar, reloadWorld });
if (cwMissing) setTimeout(() => showToast(TL`The editor world ${G.char.cw ?? ''} is not in this browser: its land comes from the seed alone.`), 1500);
initRebirth(useChar); // online a death ends the character: another crew member wakes

if (G.char.loc === 'dungeon' && G.char.dungeon) loadDungeon(null); else { G.char.loc = 'overworld'; loadOverworld({ kind: 'saved' }); }

refreshGunLook(); syncHeld();
renderer.info.autoReset = false;
let cinematic: typeof import('./ui/cinematic') | null = null;
let last = performance.now(), perfT = 0, saveT = 0, clockT = 0;
addEventListener('visibilitychange', () => { last = performance.now(); });
/** How far the eye sinks when you crouch (eased). */
const CROUCH_DROP = 0.6;
let crouchDrop = 0;
let benchT = 0; // workbenches in the wilds are synced about once a second
// (0.199) what lights the dark besides your own light: fires, powered village lamps, the other players' lights
addLights((out) => {
  // (0.203) headlights left on: your parked vehicles and the other players' (the one you drive throws its beam itself)
  if (G.char.loc === 'overworld') {
    for (const v of vehicles) if (v.st.lights && v !== driving.v && G.char.vehicles.includes(v.st)) { const s = headlightSpot(v.st.x, v.st.z, v.st.heading, v.st.model); out.push({ x: s.x, y: v.y + 1, z: s.z, r: 13, k: 'electric' }); }
    for (const p of net.peers.values()) if (p.st?.loc === 'o') for (const c of p.st.cars ?? []) if (c[11]) { const s = headlightSpot(nearX(c[1], G.pos.x), c[3], c[4], c[0] ? 'mastodon' : 'scout'); out.push({ x: s.x, y: c[2] + 1, z: s.z, r: 13, k: 'electric' }); }
  }
  for (const f of [...fireSpots(), ...campFires().map((c) => ({ x: c.x, y: c.y + 0.8, z: c.z }))]) out.push({ ...f, r: LIGHT.fire, k: 'fire' });
  for (const l of litLamps()) out.push({ ...l, r: LIGHT.village });
  for (const p of peerLights()) out.push({ x: p.x, y: p.y, z: p.z, r: LIGHT.peer[p.k as 1 | 2 | 3] ?? 10, k: p.k === 3 ? 'fire' : undefined });
});
function frame(now: number) {
  const elapsed = (now - last) / 1000;
  const dt = Math.min(elapsed, 0.05); last = now;
  if (cinematic?.cinematicOn()) { cinematic.renderCinematic(renderer, elapsed); requestAnimationFrame(frame); return; }
  if (introOn() && !renderIntro(renderer, dt)) { requestAnimationFrame(frame); return; } // the opening has the screen
  const time = now / 1000;
  const outdoors = G.char.loc === 'overworld';
  let moving = false;
  const live = G.playing && !uiOpen() && !G.trans && !gateTravelPending();
  if (outdoors) updateStreaming(G.trans ? 8 : G.fly ? 14 : 4); // flying fast needs the land streamed in quicker
  if (outdoors) updateWorldGates(dt);
  refreshGateConsole();
  // the clock runs whenever the game is not paused in the menu
  if (G.playing && !gateTravelPending()) { G.char.time += dt * MIN_PER_SEC; updateSurvival(dt); updateFlora(dt); updateFires(dt, time); updatePower(dt); updateSettlementSites(dt); updateJobSites(dt); updateHouseDoors(dt); updateWallGuns(dt); updateWorks(dt); updateStations(dt); updateChariot(dt); updateCaravans(dt); updateVillageRaids(dt); updateFallen(dt); updateIndustry(dt); updateFarms(dt); updateInstalls(dt); updateCities(dt); updateToxic(dt); updateGuide(dt); updateBridges(dt); updatePiers(dt); updateStreetLamps(dt); updateLighthouses(dt); updateContracts(dt); updateForge(dt); updateGarage(dt); updateHomes(dt); updateSawing(dt); updateCharging(dt); syncVillagePads(dt); updateLodes(dt); updateOutpostRaids(dt); updateRouteTrucks(); updateRivals(dt); if (testWaiting() && !G.trans && !G.intro) { const n = takeTest(); if (n) setTimeout(() => { if (!enterCustom(n)) showToast(TL`No editor map called ${n} in this browser.`); }); } /* after this frame (its place name) */ if ((benchT -= dt) <= 0) { benchT = 1; syncBenches(); syncFlags(); syncBases(); syncTurrets(); } }
  updateCompass(dt); // hides itself while paused
  const clock = fmtClock(G.char.time) + (G.char.loc === 'overworld' && seen.kind !== 'clear' ? ' · ' + WEATHER_NAME[seen.kind] : '');
  if (el.clock.textContent !== clock) el.clock.textContent = clock;
  if ((clockT -= dt) <= 0) {
    clockT = 1;
    { const up = refreshBoard(); if (up.length) { saveChar(); const v = outdoors ? villageHere(G.pos.x, G.pos.z) : undefined; if (v && up.includes(v.id)) logLine(tl('New notices are up on the board.')); } }
  }
  if (live) {
    if (driving.v) updateDriving(dt); else if (riding()) updateRide(dt); else if (!(outdoors && updateBoats(dt)) && !updateClimb(dt)) moving = updatePlayer(dt);
    if (outdoors) { keepOnPlanet(dt); updateWorldGates(0, !riding() && !inBoat()); }
    G.cooldown -= dt;
    if (isPlacing()) { // holding a Flagpole: the mouse picks its spot instead of fighting
      updatePlacing();
      if (G.firing) { G.firing = false; confirmPlacing(); }
      if (G.aiming) { G.aiming = false; cancelPlacing(); }
    } else if (isPierPlacing()) { // a Pier Kit: where you stand and look picks the pier
      updatePierPlacing();
      if (G.firing) { G.firing = false; confirmPierPlacing(); }
      if (G.aiming) { G.aiming = false; cancelPierPlacing(); }
    } else if (isLhPlacing()) { // (0.204) Lighthouse Plans: the mouse picks the tower's spot
      updateLhPlacing();
      if (G.firing) { G.firing = false; confirmLhPlacing(); }
      if (G.aiming) { G.aiming = false; cancelLhPlacing(); }
    } else if (isStreetPlacing()) { // (0.203) a street lamp kit: the mouse picks its spot
      updateStreetPlacing();
      if (G.firing) { G.firing = false; void confirmStreetPlacing(); }
      if (G.aiming) { G.aiming = false; cancelStreetPlacing(); }
    } else if (isFieldPlacing()) { // a Survey Stake: the mouse picks a new farm's field
      updateFieldPlacing();
      if (G.firing) { G.firing = false; void confirmFieldPlacing(); }
      if (G.aiming) { G.aiming = false; cancelFieldPlacing(); }
    } else if (isBridgePlacing()) { // a Bridge Kit: the mouse picks where the bridge crosses
      updateBridgePlacing();
      if (G.firing) { G.firing = false; confirmBridgePlacing(); }
      if (G.aiming) { G.aiming = false; cancelBridgePlacing(); }
    } else if (isBuilding()) { // building on your claim: the mouse builds
      updateBuilding();
      if (G.firing) { G.firing = false; placePart(); }
      if (G.aiming) { G.aiming = false; stopBuilding(); }
    } else if (G.firing && !driving.v && !inBoat() && !riding()) attack();
    updateTurrets(dt); updateMountedTurrets(dt);
    updateGun(dt, !driving.v && !inBoat() && !riding());
    if (driving.v) fireCannon(dt);
    updateDoors(dt);
    updateRobots(dt, time); // the open world's robots, or a crashed ship's guards
    if (outdoors) { updateGarrisons(dt); updateFieldEnemies(dt); updateCreatures(dt, time); updateBandits(dt, time); updateRaiders(dt); animateCamps(time); smokeWrecks(dt); updateCrash(dt, time); animateWater(time); }
    updateDrones(dt);
    updateFoeSounds(dt);
    const boss = updateBosses(dt, time); updateOrbs(dt);
    updateBossBar(boss);
    if (G.god) G.hp = G.S.maxHp;
    if (G.hp <= 0) { el.warp.style.opacity = '1'; toVillage('death'); }
    updateStealth(dt, !driving.v && !riding() && !inBoat() && !G.swimming && !climbing() && !G.fly);
    updateLoot(dt, time); spinCarrier(time); updateEntities(dt, time);
    if (outdoors) {
      const name = placeName(G.pos.x, G.pos.z);
      if (el.hudL.textContent !== name) el.hudL.textContent = name;
      refreshWeaponVisibility();
      if ((saveT -= dt) <= 0) { saveT = 3; saveOverworldPos(); }
    }
  } else { el.prompt.style.display = 'none'; el.bUse.classList.remove('on'); el.bossbar.style.display = 'none'; }
  let sw: ReturnType<typeof updateBodySway> | null = null;
  if (G.trans) updateTrans(dt, camera); else if (driving.v) vehicleCamera(camera); else if (riding()) rideCamera(camera); else if (inBoat()) boatCamera(camera); else {
    crouchDrop += ((G.crouch ? CROUCH_DROP : 0) - crouchDrop) * Math.min(1, dt * 10); camera.position.set(G.pos.x, G.pos.y + EYE - crouchDrop, G.pos.z);
    if (!G.fly && G.playing) { // (0.191) the body rocks with the steps and the breath (core/sway.ts)
      sw = updateBodySway(dt);
      if (!driving.v && !riding() && !inBoat() && !climbing()) updateMySteps(dt); // (0.212)
      camera.position.x += Math.cos(G.yaw) * sw.right; camera.position.z -= Math.sin(G.yaw) * sw.right; camera.position.y += sw.up;
    }
  }
  if (sw) updateRecoil(dt);
  const rc = sw ? recoilView() : null; // (0.192) the shot's punch, on foot only
  camera.rotation.set(G.pitch + (sw?.pitch ?? 0) + (rc?.up ?? 0), G.yaw + (sw?.yaw ?? 0) + (rc?.side ?? 0), sw?.roll ?? 0);
  updateSoundFrame(dt);
  updateWeather(dt, sky.visible);
  if (sky.visible) { sky.position.set(camera.position.x, camera.position.y - 20, camera.position.z); horizon.position.set(camera.position.x, 0, camera.position.z); shapeHorizon(camera.position.x, camera.position.z); updateSky(G.char.time, latitude(G.pos.z)); tintToxic(); updateFarPeaks(camera.position); } else farPeaks.visible = false;
  // A sanctuary spans hundreds of metres: give it room in clear weather while preserving dense fog.
  const monumentView = sky.visible && nearMegalith(G.pos.x, G.pos.z);
  if (monumentView && !G.fly && seen.fog < .45 && toxicHere() < .3) { fog.near *= 1.8; fog.far *= 2.5; }
  // flying (dev): the real land reaches past the horizon rings, so they step aside and the camera sees further
  if (sky.visible) { const thick = seen.fog > 0.45 || toxicHere() > 0.3; horizon.visible = !G.fly && !thick; if (G.fly || thick) farPeaks.visible = false; } // fog hides the far ranges
  const far = G.fly || monumentView ? 600 : 200; if (camera.far !== far) { camera.far = far; camera.updateProjectionMatrix(); }
  el.cross.style.display = driving.v && !driving.cockpit && !driving.v.turret ? 'none' : riding() && !ride.cockpit && !SEATS_GUN() ? 'none' : '';
  updatePeers(dt, moving); // multiplayer: say where you are, draw the others
  syncDrops(false, dt); // what the players put down on the ground
  syncWorld(dt); // the shared world: send what changed here
  syncFoes(dt); // the shared foes: tell the others about yours, drop copies nobody speaks for
  animateVM(dt, moving);
  animateFoes(dt, time, camera.position);
  updateFx(dt);
  updateHud(dt); updateTracker(dt);
  updateStreaks(dt); drawMini();
  setDrivingHook(() => !!driving.v?.st.lights); updateLight(dt); // (0.199) the dark and the lights: the light map the shaders read
  renderer.info.reset(); // two passes per frame: count both (F3 overlay)
  if (!gateTravelPending()) {
    // The opaque transit canvas owns the screen; spare the GPU hidden world and weapon passes.
    renderer.render(scene, camera);
    camera.updateMatrixWorld(); syncViewmodel();
    renderer.autoClear = false; renderer.clearDepth(); renderer.render(vmScene, camera); renderer.autoClear = true;
  }
  if ((perfT -= dt) <= 0 && el.perf.style.display === 'block') {
    perfT = 0.5; const r = renderer.info.render;
    el.perf.textContent = TL`${Math.round(1 / Math.max(dt, 1e-3))} fps\nlines ${r.lines}\ntriangles ${r.triangles}\ncalls ${r.calls}\nfoes ${W.drones.length}`;
  }
  requestAnimationFrame(frame);
}
initItemTips();
initSound(); setSoundCamera(camera); setLocHook(myLoc); // (0.212) sound wakes on the first key or click
// Load the display models after gameplay modules initialise, avoiding their world import cycles.
// The opening film plays as soon as the game has loaded (the boot screen covers the loading), then the menu shows.
// After "Back to my own world" (a reload) the menu comes straight back.
const noFilm = (() => { try { const f = sessionStorage.getItem('gridWorld.noFilm'); sessionStorage.removeItem('gridWorld.noFilm'); return !!f; } catch { return false; } })();
void import('./ui/cinematic').then(module => {
  cinematic = module; document.getElementById('boot')?.remove();
  if (noFilm || testWaiting() || worldAsked) showMenu(false); else module.playCinematic(() => showMenu(false));
  last = performance.now(); requestAnimationFrame(frame);
}, () => { document.getElementById('boot')?.remove(); showMenu(false); last = performance.now(); requestAnimationFrame(frame); });

// Gate travel moves the existing occupants and vehicle, then streams the destination.
setGateTravel((gate, x, z, heading, car) => {
  if (car) {
    const delta = heading - car.st.heading;
    teleportVehicle(car, x, z, heading); G.yaw += delta;
  } else { G.pos.set(x, gate.y, z); G.vel.set(0, 0, 0); G.yaw = heading + Math.PI; }
  vehiclesNear(x); updateStreaming(12); saveOverworldPos();
  showToast(tl('Arrived at ') + gateName(gate) + tl('. The connection stays open until its timer ends.'));
});
setRideWarpArrival(() => { vehiclesNear(G.pos.x); updateStreaming(12); saveOverworldPos(); });

// Debug handle for automated checks in development builds.
if (import.meta.env.DEV) Object.assign(window, { __game: { G, W, OW, camera, scene, renderer, regionRoads, poisNear, groundAt, treeHit, collides, vehicles, driving, interact, buy: buyVehicle, foeRules, makeDrone, spawnCreature: spawnCreatureNear, damageFoe, boardOffers, accept, syncQuestWorld, enterDungeon, generateQuest, spawnBandits: spawnBanditsNear, spawnRaider: spawnRaiderNear, forceAmbush, raiders, damageVehicle } });
