// Entry point: load the character, build the first place, run the frame loop.
import './style.css';
import { renderer, scene, camera } from './world/render';
import { G, W, uiOpen } from './game';
import { loadChar } from './save';
import { calcStats, saveChar } from './character';
import { loadDungeon, loadOverworld, toVillage, saveOverworldPos } from './world/level';
import { updatePlayer, EYE } from './world/player';
import { updateDoors, updateTrans } from './world/doors';
import { updateDrones, updateBosses, updateOrbs, animateFoes, updateBossBar, foeRules, makeDrone } from './world/enemies';
import { updateLoot } from './world/loot';
import { updateEntities } from './world/interact';
import { attack, animateVM, refreshWeaponVisibility } from './world/weapons';
import { updateFx, updateStreaks } from './world/fx';
import { updateStreaming, updateFieldEnemies, placeName, OW, groundAt, treeHit } from './world/overworld';
import { collides } from './world/player';
import { regionRoads } from './gen/roads';
import { poisNear } from './gen/regions';
import { sky, horizon } from './world/sky';
import { driving, updateDriving, vehicleCamera, vehicles, buyVehicle } from './world/vehicles';
import { interact } from './world/interact';
import { el, updateHud } from './ui/hud';
import { drawMini } from './ui/minimap';
import { toggleMap } from './ui/worldmap';
import { initInput } from './ui/input';
import { initTouch } from './ui/touch';
import { initMenu, showMenu } from './ui/menu';

G.char = loadChar();
calcStats(); G.hp = G.S.maxHp;

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

let last = performance.now(), perfT = 0, saveT = 0;
function frame(now: number) {
  const dt = Math.min((now - last) / 1000, 0.05); last = now;
  const time = now / 1000;
  const outdoors = G.char.loc === 'overworld';
  let moving = false;
  const live = G.playing && !uiOpen() && !G.trans;
  if (outdoors) updateStreaming(G.trans ? 8 : 4);
  if (live) {
    if (driving.v) updateDriving(dt); else moving = updatePlayer(dt);
    G.cooldown -= dt; if (G.firing && !driving.v) attack();
    updateDoors(dt);
    if (outdoors) updateFieldEnemies(dt);
    updateDrones(dt);
    const boss = updateBosses(dt, time); updateOrbs(dt);
    updateBossBar(boss);
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
  if (sky.visible) { sky.position.set(camera.position.x, camera.position.y - 20, camera.position.z); horizon.position.set(camera.position.x, 0, camera.position.z); }
  el.cross.style.display = driving.v && !driving.cockpit ? 'none' : '';
  animateVM(dt, moving);
  animateFoes(dt, time, camera.position);
  updateFx(dt);
  updateHud(dt);
  updateStreaks(dt); drawMini();
  renderer.render(scene, camera);
  if ((perfT -= dt) <= 0 && el.perf.style.display === 'block') {
    perfT = 0.5; const r = renderer.info.render;
    el.perf.textContent = `${Math.round(1 / Math.max(dt, 1e-3))} fps\nlines ${r.lines}\ntriangles ${r.triangles}\ncalls ${r.calls}\nfoes ${W.drones.length}`;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Debug handle for automated checks in development builds.
if (import.meta.env.DEV) Object.assign(window, { __game: { G, W, OW, camera, scene, renderer, regionRoads, poisNear, groundAt, treeHit, collides, vehicles, driving, interact, buy: buyVehicle, foeRules, makeDrone } });
