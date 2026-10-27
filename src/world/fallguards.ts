// (0.268) Bandits gather round a fallen container and keep you from it. The first game (spawnAuthority) with a
// player near the wreck puts them there; the shared record (`SkyFall.guards`) says how many are left, so killed ones
// stay dead, others see them through the foe snapshots, and they come back to the same number when you return.
import * as THREE from 'three';
import { G, W } from '../game';
import { saveChar } from '../character';
import { OW, danger } from './overworld';
import { spawnAuthority } from './remote';
import { foeRules } from './enemies';
import { spawnBandit, removeBandit, type Bandit } from './bandits';
import { FALL, fallGuards } from '../gen/skyfall';

const WAKE = 150, SLEEP = 230;
const post = (id: string) => 'fall:' + id + ':';
let tick = 0;
/** The guards of this record as they are in this game (own and copies). */
const mine = (id: string) => W.bandits.filter((b) => b.cityPost?.startsWith(post(id)) && b.hp > 0);

export function updateFallGuards(dt: number) {
  const c = G.char;
  if (c.loc !== 'overworld' || !OW.terrain || G.fly) return;
  if ((tick -= dt) > 0) return; tick = 1;
  for (const r of Object.values(c.skyfalls)) {
    if (c.time - r.t < FALL.secs + 3) continue;
    const d = Math.hypot(r.x - G.pos.x, r.z - G.pos.z), here = mine(r.id), auth = spawnAuthority();
    if (r.guards === undefined) {
      if (d < WAKE && auth) { r.guards = fallGuards(c.world, r.slot); saveChar(); } else continue;
    }
    if (r.guards <= 0) continue;
    if (here.length > 0) {
      if (auth && here.length < r.guards) { r.guards = here.length; saveChar(); } // the shared count follows the casualties
      if (auth && d > SLEEP) { for (const b of here) removeBandit(b); raised.delete(r.id); }
    } else if (auth && d < WAKE) {
      if (raised.has(r.id)) { r.guards = 0; saveChar(); raised.delete(r.id); } // all of them fell: the way is open for good
      else if (raise(r)) raised.add(r.id);
    }
  }
}
const raised = new Set<string>();

function raise(r: { id: string; x: number; z: number; guards?: number }): boolean {
  const n = r.guards ?? 0, lv = Math.max(2, danger(r.x, r.z));
  let made = 0;
  const groups: Bandit[][] = [[], []];
  for (let i = 0; i < n; i++) {
    const g = groups[i % 2], a = i / n * Math.PI * 2 + 0.4;
    let b: Bandit | null = null;
    for (let t = 0; t < 6 && !b; t++) {
      const dd = 7 + (i % 3) * 3 + t * 1.5, px = r.x + Math.cos(a + t * 0.3) * dd, pz = r.z + Math.sin(a + t * 0.3) * dd, y = G.ground?.(px, pz) ?? 0;
      if (foeRules.blocked(new THREE.Vector3(px, y + 1, pz))) continue;
      b = spawnBandit(i === 0 ? 'leader' : i % 3 === 1 ? 'bruiser' : 'gunner', new THREE.Vector3(px, y + 0.9, pz), lv, g);
      b.cityPost = post(r.id) + i; b.sight = 45; b.heading = Math.atan2(r.x - px, r.z - pz); made++;
    }
  }
  return made > 0;
}
export function clearFallGuards() { for (const b of [...W.bandits]) if (b.cityPost?.startsWith('fall:')) removeBandit(b); raised.clear(); }
