// The welcome: a scout of Gridholm who saw the ship come down waits outside the wreck for a new character. When you
// step out he greets you ("Don't shoot, I'm a friend!") and walks you to Gridholm's nearest gate, stopping to wait
// whenever you fall behind, then sends you in to the elder. He is not a foe: shots and blades pass him by (he is in
// neither `foes()` nor the village's folk), and shooting near him only makes him shout.
// Saved: `char.guide` (0 waiting at the ship, 1 leading, 2 done: old characters and anyone who reached Gridholm).
import * as THREE from 'three';
import { scene } from './render';
import { G } from '../game';
import { OW, groundAt } from './overworld';
import { makeFigure, textSprite, type Figure } from './npc';
import { poseRig } from './rig';
import { crashLanding, crashWorld } from './crashpod';
import { gateToward, gatePoint } from '../gen/roads';
import { findPoi, villageContaining, GRIDHOLM_ID, nearX } from '../gen/regions';
import { DIRV } from '../core/rng';
import { NPC_INFO } from '../data/npcs';
import { saveChar } from '../character';
import { say } from '../ui/speech';

export const GUIDE = {
  name: 'Wiktor',
  /** How near you must come for him to greet you; how far behind you may fall before he stops and waits (m). */
  greet: 8, lag: 15,
  /** His walking pace (m/s): slower than yours. */
  speed: 3.3,
};
const LINES = {
  greet: 'Easy, easy! Don\'t shoot, I\'m a friend. We saw your ship fall out of the sky like a burning star. Come, stranger, I will take you to our village. Gridholm is not far.',
  shot: ['Don\'t shoot! I\'m a friend!', 'Hey! Put that thing away, I\'m on your side!', 'Careful with that! I mean you no harm!'],
  wait: ['This way, stranger! Stay close.', 'Over here! Keep up, the wilds are no place to wander alone.', 'Come on, it is not much further.'],
  road: [
    'The land round here is quiet, but further out the old machines still walk. And the bandits are worse.',
    'Your ship came down in a storm of fire. Nobody in Gridholm has ever seen anything like it.',
    'There, you can see our walls. Gridholm: the oldest village on this side of the hills.',
  ],
  arrive: 'Here we are: Gridholm. Go and see Elder Maciej in the hall, he will want to meet you. Marta at the tavern will feed you, and Oskar the smith can mend what your fall broke. Welcome, stranger.',
};

interface Guide { f: Figure; p: THREE.Vector3; path: [number, number][]; i: number; face: number; phase: number; waitT: number; shotT: number; road: number; total: number; leave: number }
let gd: Guide | null = null;

function drop() { if (gd) { scene.remove(gd.f.g); gd = null; } }
export const dropGuide = drop;
const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const gridholm = () => findPoi(G.char.world, GRIDHOLM_ID);

/** From (x, z) to Gridholm's gate facing it, then a few steps inside. */
function pathFrom(x: number, z: number): [number, number][] {
  const v = gridholm()!, g = gateToward(G.char.world, v, x, z), [gx, gz] = gatePoint(v, g), [ox, oz] = DIRV[g];
  return [[gx + ox * 14, gz + oz * 14], [gx, gz], [gx - ox * 14, gz - oz * 14]];
}
const lengthOf = (x: number, z: number, path: [number, number][]) => path.reduce((a, q, i) => { const [px, pz] = i ? path[i - 1] : [x, z]; return a + Math.hypot(q[0] - px, q[1] - pz); }, 0);
function spawn(x: number, z: number, face: number) {
  const f = makeFigure(NPC_INFO.villager.color);
  const label = textSprite(GUIDE.name, '#9dffb4'); label.position.y = 2.15; f.g.add(label);
  const path = pathFrom(x, z);
  gd = { f, p: new THREE.Vector3(x, 0, z), path, i: 0, face, phase: 0, waitT: 4, shotT: 0, road: 0, total: lengthOf(x, z, path), leave: -1 };
}
function heightAt(x: number, z: number) { const h = groundAt(x, z); return Number.isFinite(h) ? h : G.pos.y; }

/** Every frame on the surface. */
export function updateGuide(dt: number) {
  const c = G.char;
  if (c.guide >= 2 && (!gd || gd.leave < 0)) { if (gd) drop(); return; }
  if (c.loc !== 'overworld' || !OW.terrain) { drop(); return; }
  // reached Gridholm on your own: nothing left to show
  if (c.guide < 2 && villageContaining(c.world, G.pos.x, G.pos.z)?.id === GRIDHOLM_ID) {
    if (gd && gd.leave < 0) { if (c.guide === 1) say(GUIDE.name, LINES.arrive, 11); gd.leave = 10; gd.i = gd.path.length - 1; }
    c.guide = 2; saveChar();
  }
  if (!gd && c.guide < 2) {
    const s = crashLanding();
    if (c.guide === 0 && s) { const [x, z] = crashWorld(7.5, 0.4), [hx, hz] = crashWorld(2.2, 0.2); spawn(x, z, Math.atan2(hx - x, hz - z)); }
    else { const a = G.yaw; spawn(G.pos.x - Math.sin(a) * 4, G.pos.z - Math.cos(a) * 4, a); } // a saved game on the way: he is right beside you
  }
  if (!gd) return;
  const g = gd, dx = G.pos.x - g.p.x, dz = G.pos.z - g.p.z, dP = Math.hypot(dx, dz);
  // shooting near him
  g.shotT -= dt;
  if (G.firing && dP < 45 && g.shotT <= 0 && c.guide < 2) { say(GUIDE.name, pick(LINES.shot), 3); g.shotT = 5; }
  let moving = false;
  if (g.leave >= 0) { // done: he walks on into the village and is gone
    g.leave -= dt;
    const t = g.path[g.path.length - 1], ex = t[0] - g.p.x, ez = t[1] - g.p.z, L = Math.hypot(ex, ez);
    if (L > 0.5) { g.p.x += ex / L * GUIDE.speed * dt; g.p.z += ez / L * GUIDE.speed * dt; g.face = Math.atan2(ex, ez); moving = true; }
    if (g.leave <= 0 && dP > 20) { drop(); return; }
  } else if (c.guide === 0) { // waiting at the ship, watching the hatch
    if (dP < GUIDE.greet) { c.guide = 1; saveChar(); say(GUIDE.name, LINES.greet, 9); g.waitT = 5; }
    else g.face += Math.sin(performance.now() / 1300) * dt * 0.2;
  } else { // leading
    const t = g.path[g.i], ex = t[0] - g.p.x, ez = t[1] - g.p.z, L = Math.hypot(ex, ez);
    if (dP > GUIDE.lag) { // you fell behind: he waits and calls
      g.face = Math.atan2(dx, dz);
      if ((g.waitT -= dt) <= 0) { say(GUIDE.name, pick(LINES.wait), 4); g.waitT = 10; }
    } else if (L < 0.6) {
      if (g.i < g.path.length - 2) g.i++;
      else if (g.i === g.path.length - 2) { // at the gate
        g.face = Math.atan2(dx, dz);
        if (dP < 12) { say(GUIDE.name, LINES.arrive, 11); c.guide = 2; saveChar(); g.i++; g.leave = 12; }
      }
    } else {
      g.p.x += ex / L * GUIDE.speed * dt; g.p.z += ez / L * GUIDE.speed * dt; g.face = Math.atan2(ex, ez); moving = true;
      g.waitT = Math.min(g.waitT, 3);
      // a few words on the way
      const done = 1 - lengthOf(g.p.x, g.p.z, g.path.slice(g.i)) / g.total;
      if (g.road < LINES.road.length && done > 0.12 + g.road * 0.3) say(GUIDE.name, LINES.road[g.road++], 7);
    }
    if (!moving && dP <= GUIDE.lag && g.i < g.path.length - 1 && L >= 0.6) g.face = Math.atan2(ex, ez);
  }
  // the figure: legs, arms, height, turning
  g.phase += dt * (moving ? 7 : 0);
  const sw = moving ? Math.sin(g.phase) * 0.5 : 0;
  g.f.legL.rotation.x = sw; g.f.legR.rotation.x = -sw; poseRig(g.f.rig, { swing: sw });
  g.f.g.position.set(nearX(g.p.x, G.pos.x), heightAt(g.p.x, g.p.z) + (moving ? Math.abs(Math.sin(g.phase)) * 0.04 : 0), g.p.z);
  let dr = g.face - g.f.g.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); g.f.g.rotation.y += dr * Math.min(1, dt * 6);
}

/** Standing by him (for the E prompt). */
export const nearGuide = () => !!gd && gd.leave < 0 && Math.hypot(G.pos.x - gd.p.x, G.pos.z - gd.p.z) < 2.8;
/** E at him: greets you, or tells you to follow. */
export function talkGuide() {
  if (!gd) return;
  if (G.char.guide === 0) { G.char.guide = 1; saveChar(); say(GUIDE.name, LINES.greet, 9); }
  else say(GUIDE.name, 'Follow me, stranger. Gridholm is just ahead: I will show you the way.', 4);
}
/** The tracker line and the map marker while he leads. */
export function guideLine(): string {
  if (!gd || G.char.guide >= 2 || gd.leave >= 0) return '';
  return G.char.guide === 0 ? `▸ Someone is waiting outside your ship` : `▸ Follow ${GUIDE.name} to Gridholm`;
}
export const guideMarker = (): { x: number; z: number; label: string } | null => (gd && G.char.guide < 2 && gd.leave < 0 ? { x: nearX(gd.p.x, G.pos.x), z: gd.p.z, label: GUIDE.name } : null);
