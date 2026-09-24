// What the player is standing next to: chests, locked doors, stairwells, NPCs, the hatch.
import type * as THREE from 'three';
import { G, W } from '../game';
import { updateNpcs } from './npc';
import { startStairs } from './doors';
import { descend } from './level';
import { hasItem } from '../character';
import { el } from '../ui/hud';
import { openDialog } from '../ui/dialog';
import { unlockDoor } from './doors';
import { openChest, chestHasLoot } from './loot';
import { OW, campStashes, loadedWells } from './overworld';
import { waterSource, sourcePrompt, useWater, type WaterSource } from './water';
import { nearPlant, plantPrompt, harvest, type PlantNode } from './flora';
import { nearFire, cookAll, fireHasWork } from './cooking';
import { gatherTarget, gatherPrompt, strike, type Target } from './gather';
import { nearBench, type Bench } from './benches';
import { openBench } from '../ui/craft';
import { openAreaMap } from '../ui/areamap';
import { openStash } from './loot';
import { openBoard } from '../ui/board';
import { driving, vehicleSpot, useVehicle, leave, type VehicleSpot } from './vehicles';

/** Hook for places with people (the village). */
export let npcsActive = () => G.char.loc === 'overworld' && W.npcs.length > 0;
export function setNpcsActive(f: () => boolean) { npcsActive = f; }

let nearWater: WaterSource | null = null, nearFood: PlantNode | null = null, nearCook = false, nearWork: Bench | null = null, nearGather: Target | null = null;
let nearMap = false;
let nearVehicle: VehicleSpot | null = null, nearBoard = false, nearStash: ReturnType<typeof campStashes>[number] | null = null;
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
  const bd = G.char.loc === 'overworld' && OW.village?.home ? OW.village.board : null;
  nearBoard = !!bd && Math.hypot(bd.x - pos.x, bd.z + 0.8 - pos.z) < 2.6;
  const mb = G.char.loc === 'overworld' && OW.village ? OW.village.mapBoard : null;
  nearMap = !!mb && Math.hypot(mb.x - pos.x, mb.z + 1 - pos.z) < 2.4;
  nearStash = G.char.loc === 'overworld' ? campStashes().find((s) => Math.hypot(s.x - pos.x, s.z - pos.z) < 1.8) ?? null : null;
  W.nearChest = null; W.nearPortal = null; W.nearLock = null;
  if (npcsActive()) updateNpcs(dt, time); else W.nearNpc = null;
  for (const d of W.doors) if (d.locked && Math.hypot(d.cx - pos.x, d.cz - pos.z) < 3) W.nearLock = d;
  for (const c of W.chests) {
    if (c.anim > 0 && c.anim < 1) c.anim = Math.min(1, c.anim + dt * 3);
    c.lidPivot.rotation.x = -(c.open ? (c.anim || 1) : 0) * 1.9;
    c.beam.visible = !c.open; c.beamMat.opacity = 0.35 + 0.3 * Math.sin(time * 3 + c.i);
    if ((!c.open || chestHasLoot(c)) && Math.hypot(c.g.position.x - pos.x, c.g.position.z - pos.z) < 1.8 && Math.abs(c.g.position.y - pos.y) < 1.2) W.nearChest = c;
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
  const busy = !!(nearNpc || nearLock || nearChest || nearBoard || nearMap || nearStash || nearVehicle);
  nearFood = busy ? null : nearPlant();
  nearWork = busy || nearFood ? null : nearBench();
  nearCook = !busy && !nearFood && !nearWork && G.char.loc === 'overworld' && !!nearFire();
  nearGather = busy || nearFood || nearWork || nearCook ? null : gatherTarget();
  nearWater = G.char.loc === 'overworld' && !nearFood && !nearCook && !nearWork && !nearGather && !nearNpc && !nearChest && !nearBoard && !nearStash && !nearVehicle ? waterSource(loadedWells()) : null;
  if (nearNpc) { prompt.className = ''; prompt.textContent = G.isTouch ? nearNpc.name : 'E — talk to ' + nearNpc.name; }
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
  else if (nearGather) { prompt.className = ''; prompt.textContent = gatherPrompt(nearGather); }
  else if (nearCook) { prompt.className = ''; prompt.textContent = fireHasWork() ? 'E — roast your raw meat' : 'A campfire: bring raw meat to roast'; }
  else if (nearWater) { prompt.className = nearWater.kind === 'toxic' ? 'lock' : ''; prompt.textContent = sourcePrompt(nearWater); }
  prompt.style.display = (nearNpc || nearLock || nearChest || nearBoard || nearMap || nearStash || nearVehicle || nearPortal || nearFood || nearWork || nearGather || nearCook || nearWater) && G.playing && prompt.textContent ? 'block' : 'none';
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

/** E key / use button. */
export function interact() {
  if (driving.v) { leave(); return; }
  if (W.nearNpc) openDialog(W.nearNpc); else if (W.nearLock) unlockDoor(W.nearLock); else if (W.nearChest) openChest(W.nearChest);
  else if (nearBoard) openBoard();
  else if (nearMap && OW.village) openAreaMap({ x: OW.village.ox + 36, z: OW.village.oz + 36, name: OW.village.name });
  else if (nearStash) openStash(nearStash.id, nearStash.name);
  else if (nearVehicle) useVehicle(nearVehicle);
  else if (nearFood) harvest(nearFood);
  else if (nearWork) openBench(nearWork);
  else if (nearGather) strike(nearGather);
  else if (nearCook) cookAll();
  else if (nearWater) useWater(nearWater);
}
