// (0.279, the owner's request) Eating and drinking take a moment: the food comes up to your mouth a few times in
// front of the view, you walk slowly and the weapon is put away, and only when you have finished is it used up and
// does it feed you (world/loot.ts `useItem` hands the effect in as `done`). Firing, swimming, dying or the food
// leaving your kit stops it, and nothing is lost.
// MP: personal; nothing is sent (the others see you walking slowly with your weapon away).
import * as THREE from 'three';
import { G } from '../game';
import { ITEMS, type ItemKey } from '../data/items';
import { EAT, NOURISH, eatSecs } from '../data/survival';
import { hasItem } from '../character';
import { camera } from './render';
import { lyingModel } from './pickmodels';
import { setBusy } from './gather';
import { EATING } from './eatstate';
import { play } from './sound';
import { logLine } from '../ui/hud';
import { reportWork } from '../ui/workring';
import { tl, TL } from '../i18n';

interface Job { k: ItemKey; t: number; secs: number; done: () => void; bite: number; drink: boolean }
let job: Job | null = null;
/** The food in front of the view: held low, raised to the mouth at each bite. */
const hand = new THREE.Group();
hand.visible = false; camera.add(hand);

export const eating = () => !!job;

/** Start eating or drinking k; `done` feeds you at the end. Returns why not, or ''. */
export function startEating(k: ItemKey, done: () => void): string {
  if (job) return tl('You are still eating.');
  if (G.swimming) return tl('Not while you swim.');
  const drink = !NOURISH[k]?.kcal;
  job = { k, t: 0, secs: eatSecs(k) || EAT.drink, done, bite: 0, drink };
  hand.clear();
  const m = lyingModel(k, ITEMS[k].type);
  if (m) { m.scale.setScalar(0.55); m.rotation.set(0.6, 0.4, 0.2); hand.add(m); }
  else hand.add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.08), new THREE.MeshBasicMaterial({ color: 0xd8ff7a, wireframe: true })));
  hand.visible = true; setBusy(true); EATING.on = true;
  return '';
}
/** Stop without eating (the food stays where it was). */
export function cancelEating(why = '') {
  if (!job) return;
  job = null; hand.visible = false; hand.clear(); setBusy(false); EATING.on = false;
  if (why) logLine(why);
}
/** Every frame: the bites, the end. */
export function updateEating(dt: number) {
  if (!job) return;
  if (!G.playing) return; // paused: it waits
  if (G.hp <= 0) { cancelEating(); return; }
  if (G.swimming) { cancelEating(tl('You stop eating to swim.')); return; }
  if (G.firing) { cancelEating(tl('You put the food away to fight.')); return; }
  if (!hasItem(job.k)) { cancelEating(TL`The ${ITEMS[job.k].name} is gone.`); return; }
  job.t += dt;
  const f = Math.min(1, job.t / job.secs);
  reportWork(f);
  // up to the mouth and back once a bite; a drink is one long tilt
  const ph = job.drink ? Math.min(1, job.t / (job.secs * 0.6)) : (job.t / EAT.bite) % 1;
  const up = job.drink ? Math.sin(Math.min(1, ph) * Math.PI / 2) : Math.sin(ph * Math.PI);
  hand.position.set(0.12 - up * 0.1, -0.32 + up * 0.2, -0.42 + up * 0.18);
  hand.rotation.set(up * (job.drink ? 1.1 : 0.4), 0, -up * 0.3);
  const bites = Math.floor(job.t / EAT.bite);
  if (bites > job.bite) { job.bite = bites; if (f < 0.95) play(job.drink ? 'drink' : 'eat', { vol: 0.3, rate: 1.1 }); }
  if (job.t >= job.secs) { const j = job; cancelEating(); j.done(); }
}
/** The prompt while eating. */
export const eatingPrompt = () => (job ? TL`${job.drink ? tl('Drinking') : tl('Eating')} ${ITEMS[job.k].name}… ${Math.round(Math.min(1, job.t / job.secs) * 100)}% · fire to stop` : '');
