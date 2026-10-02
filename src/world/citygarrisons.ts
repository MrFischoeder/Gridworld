// The dead cities' garrisons (gen/cities.ts cityGarrisons): fixed spots on a city's streets where machines stand
// guard, gnawers nest or a scavenger gang holds out. A garrison wakes when you come within `GARRISON_RT.wake` of it
// (outside the pacing of world/threat.ts: a city is crowded), sleeps again when you walk off, and once you have
// beaten it stays quiet for `GARRISON_RT.respawn` game minutes. Runtime only: nothing is saved.
import * as THREE from 'three';
import { G, W } from '../game';
import { OW, danger } from './overworld';
import { citySites, cityGarrisons, cityToWorld, type Garrison, type CitySite } from '../gen/cities';
import { nearX, worldDist } from '../gen/regions';
import { spawnRobotSquad, removeRobot, type Robot } from './robots';
import { spawnNest, removeCreature, type Creature } from './creatures';
import { spawnBandit, removeBandit, type Bandit } from './bandits';

export const GARRISON_RT = {
  /** Wake within (m), sleep again past (m); the creatures' own reach is 130 m. */
  wake: 105, sleep: 122,
  /** How many garrisons may be awake at once. */
  awake: 9,
  /** Game minutes a beaten garrison stays quiet. */
  respawn: 45,
};
type Foe = Robot | Creature | Bandit;
interface Live { key: string; x: number; z: number; foes: Foe[] }
const live = new Map<string, Live>();
/** Beaten garrisons: key → game time when they stir again. */
const beaten = new Map<string, number>();

const alive = (f: Foe) => (f.kind === 'robot' ? W.robots.includes(f as Robot) : f.kind === 'bandit' ? W.bandits.includes(f as Bandit) : W.creatures.includes(f as Creature));
function wake(g: Garrison, x: number, z: number): Foe[] {
  const lv = Math.max(2, danger(x, z));
  if (g.kind === 'machines') return spawnRobotSquad(x, z, lv, g.size);
  if (g.kind === 'nest') return spawnNest(x, z, lv, 4 + g.size * 3);
  const gang: Bandit[] = [], n = 2 + g.size * 2;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.283, px = x + Math.cos(a) * 3, pz = z + Math.sin(a) * 3, y = (G.ground ? G.ground(px, pz) : 0) + 0.9;
    spawnBandit(i === 0 ? 'leader' : i % 3 === 1 ? 'bruiser' : 'gunner', new THREE.Vector3(px, y, pz), lv, gang);
  }
  return gang;
}
function sleep(l: Live) {
  for (const f of l.foes) if (alive(f)) { if (f.kind === 'robot') removeRobot(f as Robot); else if (f.kind === 'bandit') removeBandit(f as Bandit); else removeCreature(f as Creature); }
  live.delete(l.key);
}

let tick = 0, world = 0;
/** Main loop (open world): wake the garrisons you come near, put the far ones back to sleep, note the beaten ones. */
export function updateGarrisons(dt: number) {
  const T = OW.terrain;
  if (!T || G.char.loc !== 'overworld' || G.fly) { if (live.size) dropGarrisons(); return; }
  if ((tick -= dt) > 0) return;
  tick = 0.5;
  if (T.world !== world) { world = T.world; beaten.clear(); } // another world: its own garrisons
  const now = G.char.time;
  for (const l of [...live.values()]) {
    const d = Math.hypot(l.x - G.pos.x, l.z - G.pos.z);
    if (d > GARRISON_RT.sleep) { sleep(l); continue; }
    if (!l.foes.some(alive)) { live.delete(l.key); if (d < GARRISON_RT.wake) beaten.set(l.key, now + GARRISON_RT.respawn); }
  }
  let room = GARRISON_RT.awake - live.size;
  if (room <= 0) return;
  for (const c of citySites(T.world)) {
    if (worldDist(c.x, c.z, G.pos.x, G.pos.z) > c.r + GARRISON_RT.wake) continue;
    const near: [Garrison, number, number, number][] = [];
    for (const g of cityGarrisons(T.world, c)) {
      const key = c.i + ':' + g.k;
      if (live.has(key) || (beaten.get(key) ?? 0) > now) continue;
      const [wx, wz] = here(c, g), d = Math.hypot(wx - G.pos.x, wz - G.pos.z);
      if (d < GARRISON_RT.wake) near.push([g, wx, wz, d]);
    }
    near.sort((a, b) => a[3] - b[3]);
    for (const [g, x, z] of near) {
      if (room <= 0) return;
      const key = c.i + ':' + g.k, foes = wake(g, x, z);
      if (!foes.length) { beaten.set(key, now + GARRISON_RT.respawn); continue; } // nowhere to stand: leave it be
      live.set(key, { key, x, z, foes }); room--;
    }
  }
}
/** A garrison's spot on the copy of the planet you are on. */
function here(c: CitySite, g: Garrison): [number, number] {
  const [x, z] = cityToWorld(c, g.u, g.v);
  return [nearX(x, G.pos.x), z];
}
/** Leaving the open world: the foes go with the level; forget which garrisons were awake. */
export function dropGarrisons() { for (const l of [...live.values()]) sleep(l); live.clear(); }
