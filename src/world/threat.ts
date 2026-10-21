// The threat budget and the pacing of encounters, shared by every spawner (creatures, robots, bandit patrols,
// raiders, ambushes). Encounters come one at a time: after something turns up the next one waits a while (less in
// dangerous land, less when gunfire has been heard), nothing new joins while you are fighting, and how much may be
// about at once grows with the danger level (gen/danger.ts). Fewer foes, but they hit harder (FOE_HIT).
// Right after you leave a village nothing new turns up for a little while.
import { SPAWN } from '../gen/spawnring';
import { spawnAuthority } from './remote';
import { G, W } from '../game';
import { ROBOTS } from '../data/robots';
import { calmBeast, type CreatureKind } from '../data/creatures';
import { inCity } from '../gen/cities';
import { inVillage } from './overworld';

const CREATURE_COST: Record<CreatureKind, number> = { gnawer: 0.5, ravager: 1, bramble: 0.4, leechwing: 1.5, skitter: 0.3, lurker: 1.2, silverfin: 0,
  // (0.240) the wildlife keeps to itself: it barely holds back the hunters (WILDLIFE in gen/wildlife.ts paces it apart)
  hexastrider: 0, hopling: 0, titan: 0, tusker: 0.2, ridgeback: 0.5, serpent: 0.5, crestjaw: 0.4, scorpid: 0.3 };
export const BANDIT_COST = 1.5;
/** Threat allowed at a danger level (at 0: a small nest of gnawers or one bramble; at 8: a small army). */
export const budget = (lv: number) => 1 + lv * 1.1;
/** Creatures and robots hit this much harder than their data says (fewer of them, but each one counts). */
export const FOE_HIT = 1.35;
/** Seconds between encounters at a danger level: ~45-75 s by the villages, ~20-30 s in the deepest wilds. */
const gap = (lv: number) => (60 - Math.min(8, lv) * 4.8) * (0.75 + Math.random() * 0.5);
/** Nothing new turns up while something hostile is this close (m). */
const FIGHT_R = 45;
/** Seconds after leaving a village before anything new may spawn. */
export const GRACE = 20;

let outside = 0, next = 12;
export function updateThreat(dt: number) { outside = inVillage(G.pos.x, G.pos.z) ? 0 : outside + dt; next -= dt; }

/** What is already about (0.235: within SPAWN.threat 350 m, so foes on their way count too). */
export function threat(): number {
  const p = G.pos, near = (q: { x: number; z: number }) => Math.hypot(q.x - p.x, q.z - p.z) < SPAWN.threat;
  let t = 0;
  for (const c of W.creatures) if (near(c.p)) t += CREATURE_COST[c.kind];
  for (const r of W.robots) if (near(r.p)) t += ROBOTS[r.model].cost;
  for (const b of W.bandits) if (b.campId === undefined && near(b.p)) t += BANDIT_COST;
  return t;
}
/** Is anything hostile close enough to count as a fight going on? */
function fighting(): boolean {
  const p = G.pos, near = (q: { x: number; z: number }) => Math.hypot(q.x - p.x, q.z - p.z) < FIGHT_R;
  return W.creatures.some((c) => near(c.p) && !calmBeast(c.kind, c.state)) || W.robots.some((r) => near(r.p)) || W.bandits.some((b) => b.campId === undefined && near(b.p));
}
/** (0.240) Whether wildlife may turn up now (its own pacing, not the encounters'): not in a city, not flying, not
 *  right outside a village, and only on the game that spawns for this place. */
export function wildOk(): boolean {
  return !inCity(G.char.world, G.pos.x, G.pos.z) && spawnAuthority() && !G.fly && outside > GRACE;
}
/**
 * Whether an encounter costing `cost` may turn up where the danger is `lv`. When it may, the next one is put off
 * (the caller spawns it now). Gunfire (`heat`) brings the next one sooner and lets a little more in.
 */
export function mayspawn(cost: number, lv: number, heat = 0): boolean {
  if (inCity(G.char.world, G.pos.x, G.pos.z)) return false; // city posts replace endless field encounters
  if (!spawnAuthority()) return false; // another player here spawns the foes (world/remote.ts); you see theirs
  if (G.fly || outside <= GRACE || next - heat * 6 > 0 || fighting()) return false;
  if (threat() + cost > budget(lv) + heat * 0.6) return false;
  next = gap(lv);
  return true;
}
