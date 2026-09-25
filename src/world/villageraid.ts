// A bandit raid on a village you are at (the timetable and the outcomes elsewhere are gen/raids.ts). Scouts warn
// you a while before; then the bandits come from the direction of their camp in waves, making for the gates and the
// power plant outside the fence. Bandits at a gate wear down the village's defences (less behind a better wall),
// bandits at the plant wreck it. Beat every wave and the village pays you; let the defences fall and the raid is
// lost (the plant takes the damage of a lost raid). While a raid is on, the village is no safe place: weapons are
// out and the bandits fight you inside the fence too. Leave the village during a raid and it is settled without
// you, as if you had never been there.
//
// The bandits' terms: when the scouts see them coming, a rider brings a demand (gen/raids.ts `tribute`, more from a
// village with a full storehouse). Pay it (at the elder or the captain of the guard) and they leave; refuse and they
// come. While they fight, their gunners shoot at the wall and at any villager in sight, and when the defences fall
// they tear down part of the wall (it drops a tier) besides wrecking the plant.
import * as THREE from 'three';
import { G, W } from '../game';
import { loadedVillages, OW } from './overworld';
import { spawnBandit, removeBandit, type Bandit } from './bandits';
import { gainXp, saveChar, calcStats } from '../character';
import { showToast, logLine } from '../ui/hud';
import { raidsBetween, raidSource, tribute, RAID, type Raid } from '../gen/raids';
import { storeWealth } from './industry';
import { reloadStruct } from './overworld';
import { addFx, burst } from './fx';
import { add as addMat } from './render';
import { BANDIT } from './bandits';
import type { Npc } from './npc';
import { powerSite, worksOf, GUARDED } from '../gen/town';
import { siteCentre } from './industry';
import { fmtTime } from '../core/time';
import { worldDist, nearX } from '../gen/regions';
import type { VillageMap } from '../gen/village';

/** Waves per raid, the defences' drain per bandit at a gate (per second, by wall tier), damage to the plant. */
export const VRAID = { waves: 3, drain: [0.7, 0.42, 0.25], plant: 0.25, plantMax: 45, reach: 450, near: 9 };
interface Target { x: number; z: number; plant: boolean; site?: boolean }
interface LiveRaid { shootT: number; killT: number; plantHurt: number; r: Raid; vid: number; vm: VillageMap; name: string; wave: number; nextT: number; bandits: Bandit[]; defence: number; targets: Target[] }
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
    if ((st.wall ?? 0) > 0 && L.r.k > 0) { // they pull down what they can of the wall
      st.wall = (st.wall ?? 0) - 1; st.given = {};
      logLine(`They tear down part of the wall on their way out: ${L.name} is back behind a weaker one. The elder will want it raised again.`);
      saveChar(); live = null; reloadStruct(L.vid); return;
    }
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
        if (!warned.has(key)) {
          warned.add(key); showToast('Bandits are coming!');
          logLine(`A rider from ${r.camp.name} at ${v.vm.name}'s gate: "Pay us ${demandOf(v.id, v.vm.seed, r)} gold by ${fmtTime(r.t0)}, or we burn you out." Pay at the elder or the captain of the guard, or get ready to fight.`);
        }
        continue;
      }
      if (now < r.t0 + RAID.duration) {
        live = { shootT: 2, killT: 25, plantHurt: 0, r, vid: v.id, vm: v.vm, name: v.vm.name, wave: 0, nextT: 0, bandits: [], defence: 100, targets: targetsOf(v.vm, v.id) };
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
    if (t.site) { const st = (G.char.towns[L.vid] ??= {}); st.siteHurt = Math.min(80, (st.siteHurt ?? 0) + VRAID.plant * 1.5 * dt * (worksOf(st, 'siteGuard') ? GUARDED.live : 1)); st.siteHurtT = G.char.time; }
    else if (t.plant) { if (L.plantHurt < VRAID.plantMax) { const st = (G.char.towns[L.vid] ??= {}), h = VRAID.plant * dt * (worksOf(st, 'plantGuard') ? GUARDED.live : 1); L.plantHurt += h; st.hurt = Math.min(100, (st.hurt ?? 0) + h); } }
    else L.defence -= VRAID.drain[tier] * dt;
    break;
  }
  shelling(L, alive, dt);
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
  live = { shootT: 2, killT: 25, plantHurt: 0, r: { village: v.id, k: 0, t0: G.char.time, camp, strength: 2 }, vid: v.id, vm: v.vm, name: v.vm.name, wave: 0, nextT: 0, bandits: [], defence: 100, targets: targetsOf(v.vm, v.id) };
  spawnWave(live);
  return `Raid on ${v.vm.name}!`;
}
// ---------- the bandits' terms ----------
const demandOf = (vid: number, seed: number, r: Raid) => tribute(r, storeWealth(vid, seed), G.char.towns[vid]?.wall ?? 0);
/** The raid on a loaded village `vid` whose rider has come and that has not started yet (you can still pay), or null. */
export function pendingTribute(vid: number): { r: Raid; amount: number; camp: string } | null {
  const c = G.char, v = loadedVillages().find((q) => q.id === vid);
  if (!v || (live && live.vid === vid)) return null;
  const r = raidsBetween(c.world, v.poi, c.time, c.time + RAID.warn).find((q) => !c.towns[vid]?.raids?.[q.k]);
  return r ? { r, amount: demandOf(vid, v.vm.seed, r), camp: r.camp.name } : null;
}
/** Pay the bandits off: they will not come this time. */
export function payTribute(vid: number): string {
  const p = pendingTribute(vid), c = G.char;
  if (!p) return 'There is nobody to pay.';
  if (c.gold < p.amount) return `You do not have ${p.amount} gold.`;
  c.gold -= p.amount; ((c.towns[vid] ??= {}).raids ??= {})[p.r.k] = 'paid'; calcStats(); saveChar();
  showToast('Tribute paid'); logLine(`The rider counts the gold and rides back to ${p.camp}. They will leave the village be, this time.`);
  return `You pay the ${p.amount} gold. The rider rides off to ${p.camp}.`;
}
/** Their gunners shoot at the wall and at villagers in the open; now and then one falls. */
function shelling(L: LiveRaid, alive: Bandit[], dt: number) {
  const gunners = alive.filter((b) => b.role !== 'bruiser' && b.state !== 'fight' && Math.hypot(b.p.x - b.home.x, b.p.z - b.home.z) < 30);
  if (!gunners.length) return;
  if ((L.shootT -= dt) <= 0) { // a burst at the wall: the defences suffer a little more
    L.shootT = 0.9 + Math.random() * 1.2;
    const b = gunners[Math.floor(Math.random() * gunners.length)], cx = L.vm.ox + 36, cz = L.vm.oz + 36;
    const dx = cx - b.p.x, dz = cz - b.p.z, d = Math.hypot(dx, dz), wall = Math.max(2, d - 37);
    const hit = new THREE.Vector3(b.p.x + dx / d * wall + (Math.random() - 0.5) * 4, b.p.y + Math.random() * 1.5, b.p.z + dz / d * wall + (Math.random() - 0.5) * 4);
    tracer(b.p.clone().add(new THREE.Vector3(0, 0.45, 0)), hit); burst(hit, 0xffe0a0, 8, 0.6);
    b.heading = Math.atan2(dx, dz); L.defence -= 0.35;
  }
  if ((L.killT -= dt) <= 0) { // a villager caught in the open
    L.killT = 20 + Math.random() * 25;
    const b = gunners[Math.floor(Math.random() * gunners.length)];
    const folk = W.npcs.filter((n) => n.role === 'villager' && n.town === L.name && Math.hypot(n.p.x - b.p.x, n.p.z - b.p.z) < 70);
    if (!folk.length) return;
    const n = folk[Math.floor(Math.random() * folk.length)];
    tracer(b.p.clone().add(new THREE.Vector3(0, 0.45, 0)), n.p.clone().add(new THREE.Vector3(0, 1.2, 0)));
    killVillager(n, L.vid);
  }
}
function tracer(a: THREE.Vector3, b: THREE.Vector3) { addFx(new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), addMat(BANDIT)), 0.15); }
const falling: { n: Npc; t: number; dir: number }[] = [];
function killVillager(n: Npc, vid: number) {
  const i = W.npcs.indexOf(n); if (i >= 0) W.npcs.splice(i, 1);
  ((G.char.towns[vid] ??= {}).dead ??= []).push(G.char.time); saveChar();
  falling.push({ n, t: 0, dir: Math.random() < 0.5 ? 1 : -1 });
  logLine(`${n.name} is shot down by the bandits!`);
}
/** Villagers shot in a raid fall and lie still (every frame). */
export function updateFallen(dt: number) {
  for (let i = falling.length - 1; i >= 0; i--) {
    const f = falling[i]; f.t += dt;
    const k = Math.min(1, f.t / 0.7);
    f.n.g.rotation.x = f.dir * k * k * 1.5; f.n.legL.rotation.x = -0.6 * k;
    if (f.t > 40 || !f.n.g.parent) { f.n.g.parent?.remove(f.n.g); falling.splice(i, 1); }
  }
}
/** Villagers of a village killed in the last two days (they are not there when it loads). */
export const recentDead = (vid: number) => (G.char.towns[vid]?.dead ?? []).filter((t) => G.char.time - t < 2 * 1440).length;

/** The raid for the quest tracker (a pending demand too). */
export function raidLine(): string {
  if (!live) {
    for (const v of loadedVillages()) {
      if (worldDist(G.pos.x, G.pos.z, v.poi.x, v.poi.z) > VRAID.reach) continue;
      const p = pendingTribute(v.id);
      if (p) return `▸ ${p.camp} demands ${p.amount} gold from ${v.vm.name} by ${fmtTime(p.r.t0)} · pay at the elder or the guard, or fight`;
    }
    return '';
  }
  const alive = live.bandits.filter((b) => b.hp > 0 && b.g.parent).length;
  return `▸ Defend ${live.name}: wave ${live.wave}/${VRAID.waves}, ${alive} bandit${alive === 1 ? '' : 's'} left · defences ${Math.max(0, Math.round(live.defence))}%`;
}
/** Where the raiders are (for the maps). */
export const raidTargets = () => (live ? live.targets : []);
export function clearVillageRaid() { if (live) for (const b of live.bandits) if (b.g.parent) removeBandit(b); live = null; }
void W;
