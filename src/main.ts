// Entry point: load the character, build the first location, run the frame loop.
import './style.css';
import { renderer, scene, camera } from './world/render';
import { G, W } from './game';
import { loadChar } from './save';
import { calcStats } from './character';
import { loadDungeon, loadVillage, toVillage } from './world/level';
import { updatePlayer, EYE } from './world/player';
import { updateDoors, updateTrans } from './world/doors';
import { updateDrones, updateBosses, updateOrbs, animateFoes, updateBossBar } from './world/enemies';
import { updateLoot } from './world/loot';
import { updateEntities } from './world/interact';
import { attack, animateVM } from './world/weapons';
import { updateFx, updateStreaks } from './world/fx';
import { el, updateHud } from './ui/hud';
import { drawMini } from './ui/minimap';
import { initInput } from './ui/input';
import { initTouch } from './ui/touch';
import { initMenu, showMenu } from './ui/menu';

G.char = loadChar();
calcStats(); G.hp = G.S.maxHp;

initInput(showMenu);
initTouch();
initMenu({
  newWorld(seed) { const c = G.char; c.world = seed; c.gx = 0; c.gz = 0; c.depth = 1; c.loc = 'village'; loadVillage('new'); },
  freshStart() { loadVillage('new'); },
});

if (G.char.loc === 'dungeon') loadDungeon(null); else { G.char.loc = 'village'; loadVillage('new'); }

let last = performance.now(), perfT = 0;
function frame(now: number) {
  const dt = Math.min((now - last) / 1000, 0.05); last = now;
  const time = now / 1000;
  let moving = false;
  const live = G.playing && !G.packOpen && !G.dlgOpen && !G.trans;
  if (live) {
    moving = updatePlayer(dt);
    G.cooldown -= dt; if (G.firing) attack();
    updateDoors(dt);
    updateDrones(dt);
    const boss = updateBosses(dt, time); updateOrbs(dt);
    updateBossBar(boss);
    if (G.hp <= 0) { el.warp.style.opacity = '1'; toVillage('death'); }
    updateLoot(dt, time); updateEntities(dt, time);
  } else { el.prompt.style.display = 'none'; el.bUse.classList.remove('on'); el.bossbar.style.display = 'none'; }
  if (G.trans) updateTrans(dt, camera); else camera.position.set(G.pos.x, G.pos.y + EYE, G.pos.z);
  camera.rotation.set(G.pitch, G.yaw, 0);
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
if (import.meta.env.DEV) Object.assign(window, { __game: { G, W, camera, scene, renderer } });
