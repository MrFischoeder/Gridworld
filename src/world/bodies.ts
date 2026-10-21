// (0.245) The bodies of the fallen crew (gen/bodies.ts): a figure lying on its back where they died, with their name,
// searched with E (the transfer window on the body's container), gone after a game day with whatever is left in it.
// Multiplayer: the bodies and their containers are shared world state (`bodies`, `containers`); whoever sees one past
// its day removes it (the same on every game), the transfer window locks the container as for any chest.
import * as THREE from 'three';
import { scene } from './render';
import { G } from '../game';
import { makeFigure, textSprite } from './npc';
import { myLoc } from './peers';
import { nearX } from '../gen/regions';
import { BODY, bodyBox, bodyId, bodyLasts, expiredBodies, type Body } from '../gen/bodies';
import type { Slot } from '../save';

const PALE = 0x8a9a8a, SHOW = 160;
const live = new Map<string, THREE.Group>();
let clock = 0;

/** Lay the dying character's body where they stand, with all of `kit` and `gold` in it. */
export function layBody(name: string, pid: string, kit: Slot[], gold: number): Body {
  const c = G.char, b: Body = { id: bodyId(pid, c.time), n: name, x: G.pos.x, y: G.pos.y, z: G.pos.z, yaw: G.yaw, loc: myLoc(), t: Math.round(c.time) };
  (c.bodies ??= {})[b.id] = b;
  c.containers[b.id] = bodyBox(kit, gold);
  return b;
}
function draw(b: Body): THREE.Group {
  const g = new THREE.Group(), f = makeFigure(PALE);
  g.add(f.g); // makeFigure puts it on the scene; it lies in our group instead
  f.g.rotation.x = -Math.PI / 2; f.g.position.y = 0.16; // on its back, the head away from where it faced
  f.legL.rotation.z = 0.15; f.legR.rotation.z = -0.15;
  const tag = textSprite(b.n, '#a8b8a8'); tag.position.set(0, 0.9, -0.8); g.add(tag);
  g.rotation.y = b.yaw; g.userData.loc = b.loc;
  scene.add(g);
  return g;
}
function drop(id: string) { const g = live.get(id); if (g) { scene.remove(g); live.delete(id); } }
/** Main loop: remove the bodies past their day, draw the ones in your place near you. */
export function updateBodies(dt: number) {
  if ((clock -= dt) > 0) return;
  clock = 0.5;
  const c = G.char, all = c.bodies ?? {};
  for (const id of expiredBodies(all, c.time)) { delete all[id]; delete c.containers[id]; drop(id); }
  const here = myLoc();
  for (const [id, g] of live) { const b = all[id]; if (!b || b.loc !== here) drop(id); else if (here === 'o') g.position.x = nearX(b.x, G.pos.x); }
  for (const b of Object.values(all)) {
    if (b.loc !== here || live.has(b.id)) continue;
    const x = here === 'o' ? nearX(b.x, G.pos.x) : b.x;
    if (Math.hypot(x - G.pos.x, b.z - G.pos.z) > SHOW) continue;
    const g = draw(b); g.position.set(x, b.y, b.z); live.set(b.id, g);
  }
}
/** The body you stand by (still lying there), or null. */
export function nearBody(): Body | null {
  const c = G.char, here = myLoc();
  let best: Body | null = null, bd: number = BODY.reach;
  for (const b of Object.values(c.bodies ?? {})) {
    if (b.loc !== here || !bodyLasts(b, c.time) || !c.containers[b.id]) continue;
    const x = here === 'o' ? nearX(b.x, G.pos.x) : b.x, d = Math.hypot(x - G.pos.x, b.z - G.pos.z);
    if (d < bd && Math.abs(b.y - G.pos.y) < 2.5) { bd = d; best = b; }
  }
  return best;
}
/** Leaving a place or a world: the drawn bodies go (they come back from the save). */
export function clearBodies() { for (const id of [...live.keys()]) drop(id); }
