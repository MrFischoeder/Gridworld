// Sixteen fixed posts per city. Casualties and reinforcement deadlines survive streaming, saves and multiplayer.
import * as THREE from 'three';
import { G, W } from '../game';
import { saveChar } from '../character';
import { OW, danger } from './overworld';
import { citySites, cityGarrisons, cityToWorld, GARRISON, type Garrison, type CitySite } from '../gen/cities';
import { garrisonRoster, garrisonReady, recordGarrison } from '../gen/garrisons';
import { nearX, worldDist } from '../gen/regions';
import { spawnCityRobot, removeRobot, type Robot } from './robots';
import { spawnRemoteCreature, removeCreature, type Creature } from './creatures';
import { CREATURES } from '../data/creatures';
import { spawnAuthority } from './remote';
import { foeRules } from './enemies';
import { spawnBandit, removeBandit, type Bandit } from './bandits';

export const GARRISON_RT = { wake: 105, sleep: 160, awake: 3, respawn: GARRISON.respawn };
type Foe = Robot | Creature | Bandit;
interface Live { world: number; key: string; x: number; z: number; foes: { slot: number; foe: Foe }[] }
const live = new Map<string, Live>();
const alive = (f: Foe) => (f.kind === 'robot' ? W.robots.includes(f as Robot) : f.kind === 'bandit' ? W.bandits.includes(f as Bandit) : W.creatures.includes(f as Creature));
function record(l: Live) {
  if (l.world !== G.char.world) return;
  const s = G.char.cityGarrisons[l.key]; if (!s) return;
  const before = JSON.stringify(s);
  recordGarrison(s, Object.fromEntries(l.foes.map(({ slot, foe }) => [slot, Math.max(0, foe.hp)])), G.char.time);
  if (JSON.stringify(s) !== before) saveChar();
}
function wake(c: CitySite, g: Garrison, x: number, z: number, key: string): Live['foes'] {
  const lv = Math.max(2, danger(x, z)), state = G.char.cityGarrisons[key], robots: Robot[] = [], nest: Creature[] = [], gang: Bandit[] = [];
  const roster = garrisonRoster(G.char.world, c.i, g), out: Live['foes'] = [];
  roster.forEach((m, slot) => {
    if (state.hp[slot] === 0) return;
    let f: Foe | null = null;
    for (let attempt = 0; attempt < 5 && !f; attempt++) {
      const a = slot / roster.length * Math.PI * 2 + attempt * 0.5, d = 3 + attempt * 1.5;
      const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d, y = G.ground?.(px, pz) ?? 0;
      if (foeRules.blocked(new THREE.Vector3(px, y + 1, pz))) continue;
      if (m.type === 'robot') f = spawnCityRobot(m.model, px, pz, lv, robots);
      else if (m.type === 'wildlife') { const cc = spawnRemoteCreature('gnawer', new THREE.Vector3(px, y + CREATURES.gnawer.lift, pz), lv); cc.pack = nest; nest.push(cc); f = cc; }
      else f = spawnBandit(m.role, new THREE.Vector3(px, y + 0.9, pz), lv, gang);
    }
    if (!f) { state.hp[slot] = 0; return; }
    f.cityPost = key;
    if (state.hp[slot] !== undefined) f.hp = Math.min(f.maxHp, state.hp[slot]);
    state.hp[slot] = f.hp; out.push({ slot, foe: f });
  });
  recordGarrison(state, {}, G.char.time); saveChar();
  return out;
}
function sleep(l: Live) {
  record(l);
  for (const { foe: f } of l.foes) if (alive(f)) { if (f.kind === 'robot') removeRobot(f as Robot); else if (f.kind === 'bandit') removeBandit(f as Bandit); else removeCreature(f as Creature); }
  live.delete(l.key);
}
let tick = 0;
export function updateGarrisons(dt: number) {
  const T = OW.terrain;
  if (!T || G.char.loc !== 'overworld' || G.fly) { if (live.size) dropGarrisons(); return; }
  if ((tick -= dt) > 0) return; tick = 0.5;
  for (const l of [...live.values()]) {
    record(l);
    if (Math.hypot(l.x - G.pos.x, l.z - G.pos.z) > GARRISON_RT.sleep || !l.foes.some(({ foe }) => alive(foe))) sleep(l);
  }
  let room = GARRISON_RT.awake - live.size;
  if (room <= 0 || !spawnAuthority()) return;
  for (const c of citySites(T.world)) {
    if (worldDist(c.x, c.z, G.pos.x, G.pos.z) > c.r + GARRISON_RT.wake) continue;
    const near = cityGarrisons(T.world, c).map(g => {
      const [wx, z] = cityToWorld(c, g.u, g.v), x = nearX(wx, G.pos.x);
      return { g, x, z, d: Math.hypot(x - G.pos.x, z - G.pos.z), key: c.i + ':' + g.k };
    }).filter(p => p.d < GARRISON_RT.wake).sort((a, b) => a.d - b.d);
    for (const { g, x, z, key, d } of near) {
      if (room <= 0) return;
      const state = G.char.cityGarrisons[key];
      if (live.has(key) || !garrisonReady(state, G.char.time)) continue;
      // Someone else's live post is already represented by the shared foe snapshots.
      if ([...W.robots, ...W.creatures, ...W.bandits].some(f => f.cityPost === key)) continue;
      if (state?.until && d < 45) continue; // no reinforcements materialise on the player
      if (!state || state.until > 0) G.char.cityGarrisons[key] = { until: 0, hp: {} };
      const foes = wake(c, g, x, z, key);
      if (foes.length) { live.set(key, { world: G.char.world, key, x, z, foes }); room--; }
    }
  }
}
export function dropGarrisons() { for (const l of [...live.values()]) sleep(l); live.clear(); }
