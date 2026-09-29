// The welcome: a scout of Gridholm who saw the ship come down waits outside the wreck for a new character, calling
// into the hatch ("Hello? Anyone in there?"). He says nothing more until you walk up and talk to him (E): then he
// greets you, tells you to take what you can from the ship, and when you talk to him again walks you to Gridholm's
// nearest gate, stopping to wait whenever you fall behind. On the way he points out the places you pass (ruins,
// wrecks, bandit camps, the Chariot's hangar, a lake) without stopping, then sends you in to the elder. He is not a foe: shots and blades pass him by (he is in
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
import { findPoi, villageContaining, poisNear, GRIDHOLM_ID, CHUNK, nearX } from '../gen/regions';
import { DIRV } from '../core/rng';
import { NPC_INFO } from '../data/npcs';
import { saveChar } from '../character';
import { say } from '../ui/speech';

export const GUIDE = {
  name: 'Wiktor',
  /** How far behind you may fall before he stops and waits (m). */
  lag: 15,
  /** His walking pace (m/s): slower than yours. */
  speed: 3.3,
};
const LINES = {
  call: ['Hello? Is anyone in there? Come out, I am a friend!', 'Hey! Anyone alive in there? Come out, I won\'t hurt you!', 'Hello-o? Stranger? Come out, it is safe. I am a friend!'],
  greet: 'Easy, easy! Don\'t shoot, I\'m a friend. My name is Wiktor, a scout from Gridholm, the village over the hill. We saw your ship fall out of the sky like a burning star.',
  advice: 'Before we go: look through your ship once more and take everything you can carry, the locker too. Nobody comes back out here in a hurry. Talk to me when you are ready, and I will take you to the village.',
  go: 'Good. Stay close and follow me: Gridholm is not far.',
  shot: ['Don\'t shoot! I\'m a friend!', 'Hey! Put that thing away, I\'m on your side!', 'Careful with that! I mean you no harm!'],
  wait: ['This way, stranger! Stay close.', 'Over here! Keep up, the wilds are no place to wander alone.', 'Come on, it is not much further.'],
  road: [
    'The land round here is quiet, but further out the old machines still walk. And the bandits are worse.',
    'Your ship came down in a storm of fire. Nobody in Gridholm has ever seen anything like it.',
    'There, you can see our walls. Gridholm: the oldest village on this side of the hills.',
  ],
  /** Passing a place on the way ({side}: 'on your left' ...; {Side} capitalised). */
  sights: {
    ruin: 'See those stones {side}? An old ruin of the machine folk. Nobody from the village goes there: the old machines still guard it. They say there are treasures below, but not today, stranger. Keep walking, we must reach the village.',
    wreck: '{Side} lies another ship that fell from the sky, long before yours. Robots still guard it. One day you may look inside, but not now: keep up.',
    camp: 'Quiet now. {Side} is a bandit camp. We do not stop here: keep walking and keep your head down.',
    hangar: 'That great hall {side} is where the old ones keep the Chariot of the Ancients. The Elder will tell you about it. Come, the gate is close.',
    lake: 'The lake {side} is clean water: drink when you are thirsty, or fill a flask. Later, though. Let us keep going.',
  } as Record<string, string>,
  arrive: 'Here we are: Gridholm. Go and see Elder Maciej in the hall, he will want to meet you. Marta at the tavern will feed you, and Oskar the smith can mend what your fall broke. Welcome, stranger.',
};

interface Guide {
  f: Figure; p: THREE.Vector3; path: [number, number][]; i: number; face: number; phase: number; waitT: number; shotT: number; road: number; total: number; leave: number;
  /** Talked to at the ship (runtime: after a reload you talk to him again); calling out from outside; places already told of. */
  talked: boolean; callT: number; told: Set<string>; lookT: number;
  /** Lines waiting to be said, and how long the one on screen still shows; time since he last spoke. */
  queue: [string, number][]; sayT: number; quiet: number;
}
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
  gd = { f, p: new THREE.Vector3(x, 0, z), path, i: 0, face, phase: 0, waitT: 4, shotT: 0, road: 0, total: lengthOf(x, z, path), leave: -1, talked: false, callT: 3, told: new Set(), lookT: 0, queue: [], sayT: 0, quiet: 0 };
}
/** Say a line now (anything waiting is dropped), or after what is being said. */
function speak(text: string, secs: number, now = false) {
  if (!gd) return;
  if (now) { gd.queue = []; gd.sayT = 0; }
  gd.queue.push([text, secs]);
}
/** 'on your left' / 'on your right' / 'ahead of us' for a place at (x, z), from his heading. */
function sideOf(g: Guide, x: number, z: number): string {
  const dx = x - g.p.x, dz = z - g.p.z, d = Math.hypot(dx, dz) || 1, hx = Math.sin(g.face), hz = Math.cos(g.face);
  if ((dx * hx + dz * hz) / d > 0.8) return 'ahead of us';
  return dx * -hz + dz * hx > 0 ? 'on your right' : 'on your left';
}
/** A place worth a word near him that he has not spoken of yet. */
function sight(g: Guide): { key: string; kind: string; x: number; z: number } | null {
  const world = G.char.world;
  for (const p of poisNear(world, g.p.x, g.p.z, 150)) {
    const kind = p.type === 'ruin' || p.type === 'wreck' || p.type === 'camp' || p.type === 'hangar' ? p.type : '';
    if (kind && !g.told.has('p' + p.id) && Math.hypot(p.x - g.p.x, p.z - g.p.z) < 150) return { key: 'p' + p.id, kind, x: p.x, z: p.z };
  }
  const f = OW.terrain!.chunkFeatures(Math.floor(g.p.x / CHUNK), Math.floor(g.p.z / CHUNK));
  for (const l of f.lakes) { const key = `l${Math.round(l.x)}:${Math.round(l.z)}`; if (l.kind === 'fresh' && !g.told.has(key) && Math.hypot(l.x - g.p.x, l.z - g.p.z) < 90) return { key, kind: 'lake', x: l.x, z: l.z }; }
  return null;
}
function heightAt(x: number, z: number) { const h = groundAt(x, z); return Number.isFinite(h) ? h : G.pos.y; }

/** Every frame on the surface. */
export function updateGuide(dt: number) {
  const c = G.char;
  if (c.guide >= 2 && (!gd || gd.leave < 0)) { if (gd) drop(); return; }
  if (c.loc !== 'overworld' || !OW.terrain) { drop(); return; }
  // reached Gridholm on your own: nothing left to show
  if (c.guide < 2 && villageContaining(c.world, G.pos.x, G.pos.z)?.id === GRIDHOLM_ID) {
    if (gd && gd.leave < 0) { if (c.guide === 1) speak(LINES.arrive, 11, true); gd.leave = 10; gd.i = gd.path.length - 1; }
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
  if (G.firing && dP < 45 && g.shotT <= 0 && c.guide < 2) { speak(pick(LINES.shot), 3, true); g.shotT = 5; }
  let moving = false;
  if (g.leave >= 0) { // done: he walks on into the village and is gone
    g.leave -= dt;
    const t = g.path[g.path.length - 1], ex = t[0] - g.p.x, ez = t[1] - g.p.z, L = Math.hypot(ex, ez);
    if (L > 0.5) { g.p.x += ex / L * GUIDE.speed * dt; g.p.z += ez / L * GUIDE.speed * dt; g.face = Math.atan2(ex, ez); moving = true; }
    if (g.leave <= 0 && dP > 20) { drop(); return; }
  } else if (c.guide === 0) { // waiting at the ship: he calls into the hatch until you come and talk to him
    if (dP < 25) g.face = Math.atan2(dx, dz);
    else g.face += Math.sin(performance.now() / 1300) * dt * 0.2;
    if (!g.talked && dP < 70 && (g.callT -= dt) <= 0 && !g.queue.length && g.sayT <= 0) { speak(pick(LINES.call), 4); g.callT = 10 + Math.random() * 5; }
  } else { // leading
    const t = g.path[g.i], ex = t[0] - g.p.x, ez = t[1] - g.p.z, L = Math.hypot(ex, ez);
    if (dP > GUIDE.lag) { // you fell behind: he waits and calls
      g.face = Math.atan2(dx, dz);
      if ((g.waitT -= dt) <= 0) { speak(pick(LINES.wait), 4, true); g.waitT = 10; }
    } else if (L < 0.6) {
      if (g.i < g.path.length - 2) g.i++;
      else if (g.i === g.path.length - 2) { // at the gate
        g.face = Math.atan2(dx, dz);
        if (dP < 12) { speak(LINES.arrive, 11, true); c.guide = 2; saveChar(); g.i++; g.leave = 12; }
      }
    } else {
      g.p.x += ex / L * GUIDE.speed * dt; g.p.z += ez / L * GUIDE.speed * dt; g.face = Math.atan2(ex, ez); moving = true;
      g.waitT = Math.min(g.waitT, 3);
      // a few words on the way: the places you pass (he points them out but does not stop), else small talk
      if ((g.lookT -= dt) <= 0) {
        g.lookT = 0.5;
        const sp = !g.queue.length && g.sayT <= 0 ? sight(g) : null;
        if (sp) {
          g.told.add(sp.key);
          const side = sideOf(g, sp.x, sp.z);
          speak(LINES.sights[sp.kind].replace('{side}', side).replace('{Side}', side[0].toUpperCase() + side.slice(1)), 9);
        } else {
          const done = 1 - lengthOf(g.p.x, g.p.z, g.path.slice(g.i)) / g.total;
          if (g.road < LINES.road.length && done > 0.12 + g.road * 0.3 && g.quiet > 12 && !g.queue.length) speak(LINES.road[g.road++], 7);
        }
      }
    }
    if (!moving && dP <= GUIDE.lag && g.i < g.path.length - 1 && L >= 0.6) g.face = Math.atan2(ex, ez);
  }
  // speaking: one line at a time
  g.sayT -= dt; g.quiet += dt;
  if (g.sayT <= 0 && g.queue.length) { const [t, secs] = g.queue.shift()!; say(GUIDE.name, t, secs); g.sayT = secs; g.quiet = 0; }
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
  const c = G.char;
  if (c.guide === 0 && !gd.talked) { gd.talked = true; speak(LINES.greet, 8, true); speak(LINES.advice, 11); }
  else if (c.guide === 0) { c.guide = 1; saveChar(); speak(LINES.go, 5, true); gd.waitT = 6; }
  else speak('Follow me, stranger. Gridholm is just ahead: I will show you the way.', 4, true);
}
/** The tracker line and the map marker while he leads. */
export function guideLine(): string {
  if (!gd || G.char.guide >= 2 || gd.leave >= 0) return '';
  return G.char.guide === 0 ? (gd.talked ? `▸ Take what you need from the ship, then talk to ${GUIDE.name}` : `▸ Someone is calling outside your ship`) : `▸ Follow ${GUIDE.name} to Gridholm`;
}
export const guideMarker = (): { x: number; z: number; label: string } | null => (gd && G.char.guide < 2 && gd.leave < 0 ? { x: nearX(gd.p.x, G.pos.x), z: gd.p.z, label: GUIDE.name } : null);
