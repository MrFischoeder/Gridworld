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
import { openChest } from './loot';

/** Hook for places with people (the village). */
export let npcsActive = () => G.char.loc === 'overworld' && W.npcs.length > 0;
export function setNpcsActive(f: () => boolean) { npcsActive = f; }

export function updateEntities(dt: number, time: number) {
  const pos = G.pos;
  W.nearChest = null; W.nearPortal = null; W.nearLock = null;
  if (npcsActive()) updateNpcs(dt, time); else W.nearNpc = null;
  for (const d of W.doors) if (d.locked && Math.hypot(d.cx - pos.x, d.cz - pos.z) < 3) W.nearLock = d;
  for (const c of W.chests) {
    if (c.anim > 0 && c.anim < 1) c.anim = Math.min(1, c.anim + dt * 3);
    c.lidPivot.rotation.x = -(c.open ? (c.anim || 1) : 0) * 1.9;
    c.beam.visible = !c.open; c.beamMat.opacity = 0.35 + 0.3 * Math.sin(time * 3 + c.i);
    if (!c.open && Math.hypot(c.g.position.x - pos.x, c.g.position.z - pos.z) < 1.8 && Math.abs(c.g.position.y - pos.y) < 1.2) W.nearChest = c;
  }
  let enter = null;
  for (const p of W.portals) {
    const d = Math.hypot(p.cx - pos.x, p.cz - pos.z);
    if (d < 4.5 && Math.abs(pos.y - p.y0) < 4) W.nearPortal = p;
    // the player walked through the doorway onto the stair landing
    const along = (p.axis === 'x' ? pos.x - p.cx : pos.z - p.cz) * (p.o[0] || p.o[1]), lat = Math.abs(p.axis === 'x' ? pos.z - p.cz : pos.x - p.cx);
    if (along > 0.9 && lat < 1.6 && Math.abs(pos.y - p.y0) < 1 && G.playing && !G.trans) enter = p;
  }
  const { nearNpc, nearLock, nearChest, nearPortal } = W, prompt = el.prompt;
  if (nearNpc) { prompt.className = ''; prompt.textContent = G.isTouch ? nearNpc.name : 'E — talk to ' + nearNpc.name; }
  else if (nearLock) {
    prompt.className = 'lock';
    prompt.textContent = hasItem('key') ? (G.isTouch ? 'Locked door' : 'E — unlock with an Access Key') : 'Locked. Requires an Access Key';
  }
  else if (nearChest) { prompt.className = ''; prompt.textContent = G.isTouch ? 'Chest' : 'E — open chest'; }
  else if (nearPortal) { prompt.className = 'portal'; prompt.textContent = nearPortal.label; }
  prompt.style.display = (nearNpc || nearLock || nearChest || nearPortal) && G.playing ? 'block' : 'none';
  const canUse = nearNpc || nearChest || (nearLock && hasItem('key'));
  el.bUse.textContent = nearNpc ? 'TALK' : nearLock ? 'UNLOCK' : 'OPEN';
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
  if (W.nearNpc) openDialog(W.nearNpc); else if (W.nearLock) unlockDoor(W.nearLock); else if (W.nearChest) openChest(W.nearChest);
}
