// A bandit raid on a village you are at (the timetable and the outcomes elsewhere are gen/raids.ts). Scouts warn
// you a while before; then the bandits come from the direction of their camp in waves, making for the gates and the
// power plant outside the fence. Bandits at a gate wear down the village's defences (less behind a better wall),
// bandits at the plant wreck it. Beat every wave and the village pays you; let the defences fall and the raid is
// lost (the plant takes the damage of a lost raid). While a raid is on, the village is no safe place: weapons are
// out and the bandits fight you inside the fence too. Leave the village during a raid and it is settled without
// you, as if you had never been there.
import * as THREE from 'three';
import { G, W } from '../game';
import { loadedVillages, OW } from './overworld';
import { spawnBandit, removeBandit, type Bandit } from './bandits';
import { gainXp, saveChar, calcStats } from '../character';
import { showToast, logLine } from '../ui/hud';
import { raidsBetween, raidSource, RAID, type Raid } from '../gen/raids';
import { powerSite } from '../gen/town';
import { siteCentre } from './industry';
import { fmtTime } from '../core/time';
import { worldDist, nearX } from '../gen/regions';
import type { VillageMap } from '../gen/village';

/** Waves per raid, the defences' drain per bandit at a gate (per second, by wall tier), damage to the plant. */
export const VRAID = { waves: 3, drain: [0.7, 0.42, 0.25], plant: 0.25, plantMax: 45, reach: 450, near: 9 };
interface Target { x: number; z: number; plant: boolean; site?: boolean }
interface LiveRaid { plantHurt: number; r: Raid; vid: number; vm: VillageMap; name: string; wave: number; nextT: number; bandits: Bandit[]; defence: number; targets: Target[] }
let live: LiveRaid | null = null;
const warned = new Set<string>();
let tick = 0;

/** Is a raid on at the village you are in or at (then it is no safe place)? */
export const raidHere = () => !!live && worldDist(G.pos.x, G.pos.z, live.vm.ox + 36, live.vm.oz + 36) < VRAID.reach;

function targetsOf(vm: VillageMap, id: number): Target[] {
  const t: Target[] = vm.gates.map((g) => ({ x: g.x, z: g.z, plant: false }));
  const p = powerSite(vm.seed), s = siteCentre(id);
  t.push({ x: vm.ox + p.x, z: vm.oz + p.z, plant: true });
  if (s) t.push({ x: s.x, z: s.z, plant: false, site: true });
  return t;
}
function spawnWave(L: LiveRaid) {
  const T = OW.terrain!, cx = L.vm.ox + 36, cz = L.vm.oz + 36;
  const ax = nearX(L.r.camp.x, cx) - cx, az = L.r.camp.z - cz, a0 = Math.atan2(ax, az);
  const n = Math.min(7, 3 + Math.floor(L.r.strength / 2) + (L.wave === VRAID.waves - 1 ? 1 : 0)), group: Bandit[] = [];
  for (let i = 0; i < n; i++) {
    const a = a0 + (Math.random() - 0.5) * 0.9, d = 105 + Math.random() * 25, x = cx + Math.sin(a) * d, z = cz + Math.cos(a) * d;
    const role = i === 0 && L.wave === VRAID.waves - 1 ? 'leader' : Math.random() < 0.35 ? 'bruiser' : 'gunner';
    const b = spawnBandit(role, new THREE.Vector3(x, T.heightAt(x, z) + 0.9, z), L.r.strength, group);
    // each makes for the nearest gate or the plant, whichever lies on its side
    // a few go for the power plant, the rest for the nearest gates
    const gates = L.targets.filter((t) => !t.plant && !t.site).sort((p, q) => Math.hypot(p.x - x, p.z - z) - Math.hypot(q.x - x, q.z - z));
    const site = L.targets.find((t) => t.site);
    const tg = i % 3 === 1 ? L.targets.find((t) => t.plant)! : i % 3 === 2 && site ? site : gates[i % 4 === 3 && gates.length > 1 ? 1 : 0];
    b.home.set(tg.x + (Math.random() - 0.5) * 4, b.p.y, tg.z + (Math.random() - 0.5) * 4); b.state = 'return'; b.sight = 45; b.ambush = -1; // kept up to 240 m away, and not counted as a patrol
    L.bandits.push(b);
  }
  L.wave++; L.nextT = 70;
  showToast(L.wave === 1 ? `Raid on ${L.name}!` : `Wave ${L.wave} of ${VRAID.waves}`);
  logLine(L.wave === 1 ? `Bandits from ${L.r.camp.name} fall on ${L.name}. Hold the gates and guard the power plant.` : 'More bandits are coming!');
}
function finish(L: LiveRaid, won: boolean) {
  const c = G.char, st = (c.towns[L.vid] ??= {});
  if (L.r.k > 0) (st.raids ??= {})[L.r.k] = won ? 'won' : 'lost'; // a test raid from the console leaves no record
  for (const b of L.bandits) if (b.hp > 0 && b.g.parent) { b.state = 'flee'; b.timer = 8; }
  if (won) {
    const gold = 60 + Math.round(L.r.strength * 25);
    c.gold += gold; calcStats(); gainXp(40 + L.r.strength * 10);
    showToast('Raid repelled'); logLine(`${L.name} holds! The villagers pay you ${gold} gold.`);
  } else {
    showToast(`${L.name} is overrun`); logLine(`The bandits break through at ${L.name}, loot what they can and wreck the power plant.`);
  }
  saveChar(); live = null;
}
/** Twice a second: warn of raids coming to a village near you, start them, run the waves and the defences. */
export function updateVillageRaids(dt: number) {
  if ((tick -= dt) > 0 || !OW.terrain || G.char.loc !== 'overworld') { if (live) liveTick(dt); return; }
  tick = 0.5;
  const c = G.char, now = c.time;
  if (live) {
    liveTick(0.5);
    if (live && worldDist(G.pos.x, G.pos.z, live.vm.ox + 36, live.vm.oz + 36) > VRAID.reach + 250) { // you left: settled without you
      for (const b of live.bandits) if (b.g.parent) removeBandit(b);
      logLine(`You leave ${live.name} to its fate.`); live = null;
    }
    return;
  }
  for (const v of loadedVillages()) {
    if (worldDist(G.pos.x, G.pos.z, v.poi.x, v.poi.z) > VRAID.reach) continue;
    for (const r of raidsBetween(c.world, v.poi, now - RAID.duration, now + RAID.warn)) {
      if (c.towns[v.id]?.raids?.[r.k]) continue;
      const key = v.id + ':' + r.k;
      if (now < r.t0) {
        if (!warned.has(key)) { warned.add(key); showToast('Bandits are coming!'); logLine(`Scouts: a band from ${r.camp.name} is on its way to ${v.vm.name}. Expect them about ${fmtTime(r.t0)}.`); }
        continue;
      }
      if (now < r.t0 + RAID.duration) {
        live = { plantHurt: 0, r, vid: v.id, vm: v.vm, name: v.vm.name, wave: 0, nextT: 0, bandits: [], defence: 100, targets: targetsOf(v.vm, v.id) };
        spawnWave(live);
        return;
      }
    }
  }
}
function liveTick(dt: number) {
  const L = live!;
  const alive = L.bandits.filter((b) => b.hp > 0 && b.g.parent);
  // bandits at a gate wear down the defences; at the plant they wreck it
  const tier = Math.min(VRAID.drain.length - 1, G.char.towns[L.vid]?.wall ?? 0);
  for (const b of alive) for (const t of L.targets) {
    if (Math.hypot(b.p.x - t.x, b.p.z - t.z) > VRAID.near) continue;
    if (t.site) { const st = (G.char.towns[L.vid] ??= {}); st.siteHurt = Math.min(80, (st.siteHurt ?? 0) + VRAID.plant * 1.5 * dt); st.siteHurtT = G.char.time; }
    else if (t.plant) { if (L.plantHurt < VRAID.plantMax) { const st = (G.char.towns[L.vid] ??= {}), h = VRAID.plant * dt; L.plantHurt += h; st.hurt = Math.min(100, (st.hurt ?? 0) + h); } }
    else L.defence -= VRAID.drain[tier] * dt;
    break;
  }
  if (L.defence <= 0) { finish(L, false); return; }
  L.nextT -= dt;
  const over = G.char.time >= L.r.t0 + RAID.duration;
  if (L.wave < VRAID.waves && !over && (alive.length <= 1 || L.nextT <= 0)) spawnWave(L);
  else if (!alive.length && (L.wave >= VRAID.waves || over)) finish(L, true);
  else if (over) finish(L, L.defence > 40);
}
/** Console / testing: bandits from the nearest camp fall on the village you are at, now. */
export function forceRaid(): string {
  if (live) return 'A raid is already on.';
  const v = loadedVillages().filter((q) => worldDist(G.pos.x, G.pos.z, q.poi.x, q.poi.z) < VRAID.reach).sort((a, b) => worldDist(G.pos.x, G.pos.z, a.poi.x, a.poi.z) - worldDist(G.pos.x, G.pos.z, b.poi.x, b.poi.z))[0];
  if (!v || !OW.terrain) return 'Stand in or by a village.';
  const camp = raidSource(G.char.world, v.poi) ?? { ...v.poi, name: 'the hills', x: v.poi.x + 1500, z: v.poi.z };
  live = { plantHurt: 0, r: { village: v.id, k: 0, t0: G.char.time, camp, strength: 2 }, vid: v.id, vm: v.vm, name: v.vm.name, wave: 0, nextT: 0, bandits: [], defence: 100, targets: targetsOf(v.vm, v.id) };
  spawnWave(live);
  return `Raid on ${v.vm.name}!`;
}
/** The raid for the quest tracker. */
export function raidLine(): string {
  if (!live) return '';
  const alive = live.bandits.filter((b) => b.hp > 0 && b.g.parent).length;
  return `▸ Defend ${live.name}: wave ${live.wave}/${VRAID.waves}, ${alive} bandit${alive === 1 ? '' : 's'} left · defences ${Math.max(0, Math.round(live.defence))}%`;
}
/** Where the raiders are (for the maps). */
export const raidTargets = () => (live ? live.targets : []);
export function clearVillageRaid() { if (live) for (const b of live.bandits) if (b.g.parent) removeBandit(b); live = null; }
void W;
