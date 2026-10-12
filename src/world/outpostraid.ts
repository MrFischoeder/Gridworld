// (0.186, PLAN_PLACOWEK.md stage O5) A bandit raid on an outpost you are at (the timetable and the rolled outcomes are
// gen/outpostraids.ts). Scouts warn you a while before; then two waves come from the wilds and make for the outpost:
// for the nearest point of its wall, or its middle without one. Bandits there wear its defences down (less behind a
// better wall). Beat every wave and it is won (the crew pays you); let the defences fall and it is lost. Either way
// the outcome is saved for the raid's settling at its end (`OutpostState.raids`). Leave and it is rolled as if you had
// never been there. The outposts' turrets shoot raiders and beasts in range and sight.
//
// MP: the game with `spawnAuthority` runs the raid (the others fight its bandits as copies) and fires the turrets
// (the others' turret heads only sweep), so nothing is hit twice; the outcome goes into the shared `outposts` under the
// outpost's lock.
import * as THREE from 'three';
import { G } from '../game';
import { OW } from './overworld';
import { spawnBandit, removeBandit, type Bandit } from './bandits';
import { spawnAuthority } from './remote';
import { foes, damageFoe, type Foe } from './enemies';
import { rayWorld } from './player';
import { addFx, burst } from './fx';
import { add } from './render';
import { makeNoise } from './noise';
import { gainXp, saveChar, calcStats } from '../character';
import { showToast, logLine } from '../ui/hud';
import { withOutpost } from '../ui/stock';
import { nextRaid, worthRobbing, OUTRAID, type OutRaid } from '../gen/outpostraids';
import { wallOf, type OutpostState } from '../gen/outposts';
import { worldDist, nearX } from '../gen/regions';
import { hash } from '../core/rng';
import { outpostGuns, outpostRing } from './lodes';

/** Waves, the defences' drain per bandit at the wall (per second, by wall tier), how near counts as at it, reach. */
export const ORAID = { waves: 2, drain: [1.0, 0.7, 0.45, 0.28], near: 9, reach: 450, leave: 700 };
/** The outposts' turrets. */
export const OUT_GUN = { range: 80, rate: 0.55, dmg: 1.2, turn: 2.6, noise: 40 };
interface Live { id: string; r: OutRaid; name: string; wave: number; nextT: number; bandits: Bandit[]; defence: number }
let live: Live | null = null, tick = 0;
const warned = new Set<string>();

/** Where bandit i makes for: the nearest point outside the wall, or the outpost's middle. */
function targetOf(id: string, o: OutpostState, x: number, z: number): [number, number] {
  const ring = outpostRing(id), cx = ring?.x ?? nearX(o.x, G.pos.x), cz = ring?.z ?? o.z;
  if (!wallOf(o) || !ring) return [cx, cz];
  const a = Math.atan2(z - cz, x - cx), d = ring.R + 2;
  return [cx + Math.cos(a) * d, cz + Math.sin(a) * d];
}
function spawnWave(L: Live) {
  const T = OW.terrain!, o = G.char.outposts[L.id];
  if (!o) return;
  const cx = nearX(o.x, G.pos.x), cz = o.z, a0 = (hash(G.char.world, L.r.k, o.x | 0, 0x0a62) % 628) / 100;
  const n = Math.min(6, 2 + Math.floor(L.r.strength / 2) + (L.wave === ORAID.waves - 1 ? 1 : 0)), group: Bandit[] = [];
  for (let i = 0; i < n; i++) {
    const a = a0 + (Math.random() - 0.5) * 0.9, d = 110 + Math.random() * 25, x = cx + Math.sin(a) * d, z = cz + Math.cos(a) * d;
    const role = i === 0 && L.wave === ORAID.waves - 1 ? 'leader' : Math.random() < 0.35 ? 'bruiser' : 'gunner';
    const b = spawnBandit(role, new THREE.Vector3(x, T.heightAt(x, z) + 0.9, z), L.r.strength, group);
    const [tx, tz] = targetOf(L.id, o, x, z);
    b.home.set(tx + (Math.random() - 0.5) * 4, b.p.y, tz + (Math.random() - 0.5) * 4); b.state = 'return'; b.sight = 45; b.ambush = -1;
    L.bandits.push(b);
  }
  L.wave++; L.nextT = 60;
  showToast(L.wave === 1 ? `Raid on ${L.name}!` : `Wave ${L.wave} of ${ORAID.waves}`);
  logLine(L.wave === 1 ? `Bandits fall on ${L.name}. Keep them off the wall.` : 'More bandits are coming!');
}
function finish(L: Live, won: boolean) {
  const id = L.id, k = L.r.k, str = L.r.strength;
  for (const b of L.bandits) if (b.hp > 0 && b.g.parent) { b.state = 'flee'; b.timer = 8; }
  live = null;
  if (k > 0) void withOutpost(id, () => { const o = G.char.outposts[id]; if (o && (o.rk ?? 0) < k) (o.raids ??= {})[k] = won ? 'won' : 'lost'; }).then(() => saveChar());
  if (won) {
    const gold = 40 + Math.round(str * 20);
    G.char.gold += gold; calcStats(); gainXp(30 + str * 10);
    showToast('Raid repelled'); logLine(`${L.name} holds! The crew pays you ${gold} gold.`);
  } else { showToast(`${L.name} is overrun`); logLine(`The bandits break in at ${L.name}. When the raid is over they will have carried off most of the crates and half the pantry.`); }
}
/** Twice a second: warn of raids on outposts near you, start them, run the waves and the defences. */
export function updateOutpostRaids(dt: number) {
  updateGuns(dt);
  if ((tick -= dt) > 0 || !OW.terrain || G.char.loc !== 'overworld') return;
  tick = 0.5;
  const c = G.char, now = c.time;
  if (live) {
    const L = live, o = c.outposts[L.id];
    if (!o || worldDist(G.pos.x, G.pos.z, o.x, o.z) > ORAID.leave) { // you left: rolled without you
      for (const b of L.bandits) if (b.g.parent) removeBandit(b);
      logLine(`You leave ${L.name} to its fate.`); live = null; return;
    }
    tickLive(L, o, 0.5);
    return;
  }
  for (const [id, o] of Object.entries(c.outposts)) {
    if (!o?.k || worldDist(G.pos.x, G.pos.z, o.x, o.z) > ORAID.reach || !worthRobbing(o)) continue;
    const r = nextRaid(c.world, id, o, now);
    if (!r || (o.rk ?? 0) >= r.k || o.raids?.[r.k] || now < r.t0 - OUTRAID.warn) continue;
    const key = id + ':' + r.k;
    if (now < r.t0) {
      if (!warned.has(key)) { warned.add(key); showToast('Bandits are coming!'); logLine(`Scouts at ${o.name}: bandits are coming, about an hour out. Get ready to hold them off.`); }
      continue;
    }
    if (!spawnAuthority()) return; // another player here runs the raid (you fight their bandits)
    live = { id, r, name: o.name, wave: 0, nextT: 0, bandits: [], defence: 100 };
    spawnWave(live);
    return;
  }
}
function tickLive(L: Live, o: OutpostState, dt: number) {
  const alive = L.bandits.filter((b) => b.hp > 0 && b.g.parent), tier = Math.min(ORAID.drain.length - 1, wallOf(o));
  for (const b of alive) if (Math.hypot(b.p.x - b.home.x, b.p.z - b.home.z) < ORAID.near) L.defence -= ORAID.drain[tier] * dt;
  if (L.defence <= 0) { finish(L, false); return; }
  L.nextT -= dt;
  const over = G.char.time >= L.r.t0 + OUTRAID.duration;
  if (L.wave < ORAID.waves && !over && (alive.length <= 1 || L.nextT <= 0)) spawnWave(L);
  else if (!alive.length && (L.wave >= ORAID.waves || over)) finish(L, true);
  else if (over) finish(L, L.defence > 40);
}
/** Console / testing: bandits fall on the outpost you are at, now (k 0: its outcome is not recorded). */
export function forceOutpostRaid(): string {
  if (live) return 'A raid is already on.';
  const e = Object.entries(G.char.outposts).filter(([, o]) => o?.k && worldDist(G.pos.x, G.pos.z, o.x, o.z) < ORAID.reach).sort(([, a], [, b]) => worldDist(G.pos.x, G.pos.z, a.x, a.z) - worldDist(G.pos.x, G.pos.z, b.x, b.z))[0];
  if (!e || !OW.terrain) return 'Stand at an outpost.';
  live = { id: e[0], r: { k: 0, t0: G.char.time, strength: 2 }, name: e[1].name, wave: 0, nextT: 0, bandits: [], defence: 100 };
  spawnWave(live);
  return `Raid on ${e[1].name}!`;
}
/** The tracker's line while a raid is on. */
export function outpostRaidLine(): string {
  return live ? `Raid on ${live.name}: wave ${live.wave}/${ORAID.waves}, defences ${Math.max(0, Math.round(live.defence))}%` : '';
}
export function clearOutpostRaid() { if (live) for (const b of live.bandits) if (b.g.parent) removeBandit(b); live = null; }

// ---------- the turrets ----------
const hostile = (f: Foe) => !('kind' in f && f.kind === 'bramble' && (f as { state?: string }).state === 'roam');
const tmp = new THREE.Vector3();
function updateGuns(dt: number) {
  const list = outpostGuns();
  if (!list.length) return;
  const fire = spawnAuthority(), all = fire ? foes() : [], t0 = performance.now() / 1000;
  for (const { gun: t } of list) {
    t.cd -= dt; t.look -= dt;
    const o = t.head.getWorldPosition(tmp).clone();
    let target = t.target as Foe | null;
    if (target && (!all.includes(target) || target.g.position.distanceTo(o) > OUT_GUN.range)) target = null;
    if (fire && t.look <= 0) {
      t.look = 0.35; let bd = OUT_GUN.range; target = null;
      for (const f of all) {
        if (!hostile(f)) continue;
        const to = f.g.position.clone().sub(o), d = to.length();
        if (d >= bd || d < 1) continue;
        if (rayWorld(o, to.normalize(), d) < d - ((f as { r?: number }).r ?? 0.6)) continue;
        target = f; bd = d;
      }
    }
    t.target = target;
    let want = t.home + Math.sin(t0 * 0.35 + t.home * 3) * 0.9;
    if (target) { const to = target.g.position.clone().sub(o); want = Math.atan2(-to.x, -to.z); }
    const dy = ((want - t.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    t.yaw += Math.max(-OUT_GUN.turn * dt, Math.min(OUT_GUN.turn * dt, dy));
    t.head.rotation.y = t.yaw;
    if (target && Math.abs(dy) < 0.12 && t.cd <= 0) {
      t.cd = OUT_GUN.rate;
      const end = target.g.position.clone(), muzzle = new THREE.Vector3(0, 0.2, -1.1).applyEuler(t.head.rotation).add(o);
      addFx(new THREE.Line(new THREE.BufferGeometry().setFromPoints([muzzle, end]), add(0x9dffe0)), 0.08);
      burst(end, 0xffb347, 6, 0.4); burst(muzzle, 0xffe0a0, 3, 0.2);
      makeNoise(o, OUT_GUN.noise);
      const flash = G.hitFlash; damageFoe(target, OUT_GUN.dmg); G.hitFlash = flash; // the hit marker is for your own shots
    }
  }
}
