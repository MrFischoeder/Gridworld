// (0.268) Bandits gather round a fallen container and keep you from it. The first game (spawnAuthority) with a
// player near the wreck puts them there; the shared record (`SkyFall.guards`) says how many are left, so killed ones
// stay dead, others see them through the foe snapshots, and they come back to the same number when you return.
// (0.285.1) Only a real defeat (killed, fled, gave up: `SkyFall.out`) counts; guards that merely vanished (your death,
// a reload, leaving) are put back when a player comes near again.
import * as THREE from 'three';
import { G, W } from '../game';
import { saveChar } from '../character';
import { OW, danger } from './overworld';
import { spawnAuthority, nearestPlayer } from './remote';
import { foeRules } from './enemies';
import { spawnBandit, removeBandit, setPostDown, type Bandit } from './bandits';
import { FALL, fallGuards, guardsLeft } from '../gen/skyfall';

const WAKE = 150, SLEEP = 230;
const post = (id: string) => 'fall:' + id + ':';
let tick = 0;
/** The guards of this record as they are in this game (own and copies). */
const mine = (id: string) => W.bandits.filter((b) => b.cityPost?.startsWith(post(id)) && b.hp > 0 && b.mode !== 'give' && b.mode !== 'rout');

export function updateFallGuards(dt: number) {
  const c = G.char;
  if (c.loc !== 'overworld' || !OW.terrain || G.fly) return;
  if ((tick -= dt) > 0) return; tick = 1;
  for (const r of Object.values(c.skyfalls)) {
    if (c.time - r.t < FALL.secs + 3) continue;
    const d = Math.hypot(r.x - G.pos.x, r.z - G.pos.z), auth = spawnAuthority();
    if (r.guards === undefined || !r.out) { // first time, or a record from before 0.285.1 whose count fell when guards only vanished
      if (d < WAKE && auth) { r.guards = fallGuards(c.world, r.slot); r.out = []; saveChar(); } else continue;
    }
    const left = guardsLeft(r);
    if (!left.length) continue; // beaten for good
    const here = mine(r.id);
    if (here.length > 0) {
      // (0.285.1) the game running them puts them to sleep only when every player is far off; they come back as they were
      if (auth && nearestPlayer(r.x, r.z) > SLEEP) for (const b of here) removeBandit(b);
    } else if (auth && d < WAKE) raise(r, left); // first time, or back after they vanished (a death, leaving, a reload)
  }
}
/** (0.285.1) A guard beaten for real (bandits.ts tells only the game running him): his index joins the shared record. */
setPostDown((b) => {
  const p = b.cityPost ?? '';
  if (!p.startsWith('fall:')) return;
  const cut = p.lastIndexOf(':'), id = p.slice(5, cut), i = Number(p.slice(cut + 1)), r = G.char.skyfalls[id];
  if (!r || !Number.isInteger(i)) return;
  const out = (r.out ??= []);
  if (!out.includes(i)) { out.push(i); saveChar(); }
});

function raise(r: { id: string; x: number; z: number }, left: number[]): boolean {
  const lv = Math.max(2, danger(r.x, r.z)), n = left.length;
  let made = 0;
  const groups: Bandit[][] = [[], []];
  left.forEach((i, k) => {
    const g = groups[k % 2], a = k / n * Math.PI * 2 + 0.4;
    let b: Bandit | null = null;
    for (let t = 0; t < 6 && !b; t++) {
      const dd = 7 + (k % 3) * 3 + t * 1.5, px = r.x + Math.cos(a + t * 0.3) * dd, pz = r.z + Math.sin(a + t * 0.3) * dd, y = G.ground?.(px, pz) ?? 0;
      if (foeRules.blocked(new THREE.Vector3(px, y + 1, pz))) continue;
      b = spawnBandit(i === 0 ? 'leader' : i % 3 === 1 ? 'bruiser' : 'gunner', new THREE.Vector3(px, y + 0.9, pz), lv, g);
      b.cityPost = post(r.id) + i; b.sight = 45; b.heading = Math.atan2(r.x - px, r.z - pz); made++;
    }
  });
  return made > 0;
}
export function clearFallGuards() { for (const b of [...W.bandits]) if (b.cityPost?.startsWith('fall:')) removeBandit(b); }
