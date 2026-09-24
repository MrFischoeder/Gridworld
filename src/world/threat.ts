// The threat budget: how much hostile life may be about the player at once, shared by every spawner (creatures,
// robots, bandit patrols). It grows with the danger level (gen/danger.ts), so the fields by a village hold a
// gnawer nest or a lone ravager, while the deep wilds can throw packs, patrols and heavy machines at you.
// Right after you leave a village nothing new turns up for a little while.
import { G, W } from '../game';
import { ROBOTS } from '../data/robots';
import type { CreatureKind } from '../data/creatures';
import { inVillage } from './overworld';

const CREATURE_COST: Record<CreatureKind, number> = { gnawer: 0.5, ravager: 1, bramble: 0.4, leechwing: 1.5 };
export const BANDIT_COST = 1.5;
/** Threat allowed at a danger level (at 0: a small nest of gnawers or one bramble; at 8: a small army). */
export const budget = (lv: number) => 1 + lv * 2.1;
/** Seconds after leaving a village before anything new may spawn. */
export const GRACE = 20;

let outside = 0;
export function updateThreat(dt: number) { outside = inVillage(G.pos.x, G.pos.z) ? 0 : outside + dt; }

/** What is already about (within 160 m). */
export function threat(): number {
  const p = G.pos, near = (q: { x: number; z: number }) => Math.hypot(q.x - p.x, q.z - p.z) < 160;
  let t = 0;
  for (const c of W.creatures) if (near(c.p)) t += CREATURE_COST[c.kind];
  for (const r of W.robots) if (near(r.p)) t += ROBOTS[r.model].cost;
  for (const b of W.bandits) if (b.campId === undefined && near(b.p)) t += BANDIT_COST;
  return t;
}
/** Whether something costing `cost` may turn up where the danger is `lv` (noise lets a little more in). */
export const mayspawn = (cost: number, lv: number, heat = 0) => outside > GRACE && threat() + cost <= budget(lv) + heat * 1.2;
