// (0.251, PLAN_MAGAZYNOW.md stage M3) The radio link between warehouses. A warehouse with a working radio mast
// (gen/radiomast.ts `RADIO`) reaches every other mast within `RADIO.reach`, and on through them: one network. Every
// warehouse in a network shows its stock to the others (the village computers' WAREHOUSES tab, the warehouses'
// windows). A village builds its mast from its stock at the warehouse's terminal (`TownState.mast`, a timed job 'radio');
// a port or a wild warehouse as its part 'radio' (gen/outposts.ts). A mast works while its warehouse works and, in a
// settlement, with its operator and power (gen/energy.ts `mastOf`); old villages' masts always work.
//
// (0.253, stage M5) Two ports whose masts work and that a cargo line with a ship joins are one network, however far
// apart: the ship carries the mail, so warehouses on other shores show their stock too.
//
// Pure: everything from the shared `towns` and `outposts`, the same on every game.
import type { ItemKey } from '../data/items';
import type { TownState } from './town';
import type { OutpostState } from './outposts';
import { allVillages, villageSeed, worldDist } from './regions';
import { hubs, hubWorks, type Hub } from './warehouses';
import { mastOf } from './energy';
import { stockOf } from './hall';
import { startJob, jobOf } from './construction';
import { RADIO } from './radiomast';

/** A village mast's materials with what was handed over. */
export const mastPlan = (s: TownState | undefined) => RADIO.needs.map(([k, n]) => ({ k, n, given: Math.min(n, s?.mgiven?.[k] ?? 0) }));
/** Hand over what the village's mast still needs (from the stock: `have` / the caller takes `taken`); with all of it in, the builders start. */
export function handOverMast(s: TownState, have: (k: ItemKey) => number, at: number): { taken: [ItemKey, number][]; started: boolean } {
  const taken: [ItemKey, number][] = [];
  if (s.mast || jobOf(s, 'radio')) return { taken, started: false };
  const g = (s.mgiven ??= {});
  for (const r of mastPlan(s)) { const n = Math.max(0, Math.min(r.n - r.given, Math.floor(have(r.k)))); if (n) { g[r.k] = r.given + n; taken.push([r.k, n]); } }
  if (!mastPlan(s).every((r) => r.given >= r.n)) return { taken, started: false };
  startJob(s, 'radio', undefined, at, RADIO.hours);
  return { taken, started: true };
}
/** The builders are done (gen/jobs.ts). */
export function completeMast(s: TownState, now: number) { s.mast = now; delete s.mgiven; }

/** Whether warehouse h has a mast standing. */
export const hasMast = (h: Hub, towns: Record<string, TownState | undefined>, outposts: Record<string, OutpostState | undefined>) =>
  h.kind === 'village' ? !!towns[h.vid!]?.mast : !!outposts[h.id]?.done?.radio;
/** Why h's mast does not work ('' = it works): none, the warehouse stands idle, no operator, no power. */
export function mastWhy(world: number, h: Hub, towns: Record<string, TownState | undefined>, outposts: Record<string, OutpostState>, t: number): '' | 'none' | 'idle' | 'hands' | 'power' {
  if (!hasMast(h, towns, outposts)) return 'none';
  if (!hubWorks(world, h, towns, outposts, t)) return 'idle';
  if (h.kind === 'village') { const v = allVillages(world).find((q) => q.id === h.vid); if (v) return mastOf(world, v, villageSeed(world, v), towns[v.id], t).why; }
  return '';
}
/** The radio networks at t: each working mast's warehouse id → its network's number (masts within reach join, and on through each other). */
export function radioNet(world: number, towns: Record<string, TownState | undefined>, outposts: Record<string, OutpostState>, t: number): Map<string, number> {
  const on = hubs(world, towns, outposts).filter((h) => !mastWhy(world, h, towns, outposts, t)), up = on.map((_, i) => i);
  const find = (i: number): number => (up[i] === i ? i : (up[i] = find(up[i])));
  for (let i = 0; i < on.length; i++) for (let j = i + 1; j < on.length; j++) if (worldDist(on[i].x, on[i].z, on[j].x, on[j].z) <= RADIO.reach) up[find(i)] = find(j);
  const at = new Map(on.map((h, i) => [h.id, i]));
  for (const [i, h] of on.entries()) { const l = outposts[h.id]?.line, j = l?.ship ? at.get(l.to) : undefined; if (j !== undefined) up[find(i)] = find(j); } // (0.253) a ship on a cargo line carries the mail between two ports
  return new Map(on.map((h, i) => [h.id, find(i)]));
}
/** The other warehouses warehouse `id` is linked to by radio now (none without a working mast). */
export function linkedHubs(world: number, towns: Record<string, TownState | undefined>, outposts: Record<string, OutpostState>, id: string, t: number): Hub[] {
  const net = radioNet(world, towns, outposts, t), g = net.get(id);
  if (g === undefined) return [];
  return hubs(world, towns, outposts).filter((h) => h.id !== id && net.get(h.id) === g);
}
/** What warehouse h holds: a village's hold and own goods (whole crates), a port's or a wild one's hold; most first. */
export function hubStock(world: number, h: Hub, towns: Record<string, TownState | undefined>, outposts: Record<string, OutpostState>, t: number): [ItemKey, number][] {
  const out = new Map<ItemKey, number>();
  if (h.kind === 'village') {
    const v = allVillages(world).find((q) => q.id === h.vid), s = towns[h.vid!];
    for (const [k, n] of Object.entries(s?.hold ?? {}) as [ItemKey, number][]) if (n) out.set(k, n);
    if (v) { const sk = stockOf(world, v, villageSeed(world, v), s, t); for (const g of sk.own) { const n = Math.floor(sk.ownOf(g)); if (n) out.set(g, (out.get(g) ?? 0) + n); } }
  } else for (const [k, n] of Object.entries(outposts[h.id]?.hold ?? {}) as [ItemKey, number][]) if (n) out.set(k, n);
  return [...out].sort((a, b) => b[1] - a[1]);
}
