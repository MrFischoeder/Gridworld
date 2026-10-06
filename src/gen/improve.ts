// Village improvements (pure; the economy plan's stage 6: the components of the old plants put to use). Each is a
// one-off commission from the elder, built from the village hall's stock like the other village builds, and each
// changes how the village works:
// - Battery Bank (power cells, lead batteries): gives back at night and in a lull what the panels and turbines made
//   in the sun and the wind (`bankKw`, gen/energy.ts balance);
// - Battery Lamps (lead batteries, glass): the village takes less power (`villageKw`) and its lamps stay lit when
//   the plant is down;
// - Automated Site (automation units, precision components): the industry site makes half as much again and needs no
//   workers (`autoMult`, `autoStaffing` in gen/industry.ts);
// - Sensor Sights (sensors, microchips): the turrets on the wall see further and fire faster (world/wallguns.ts);
// - Armoured Wall (aluminium, advanced alloy on a stone wall): raids break on it more often (gen/raids.ts) and a
//   live raid wears the gates down slower (world/villageraid.ts).
import type { ItemKey } from '../data/items';
import type { TownState } from './town';
import { startJob, jobOf } from './construction';

export type ImproveKind = 'bank' | 'lamps' | 'automation' | 'sights' | 'armour';
export const IMPROVE_KINDS: ImproveKind[] = ['bank', 'lamps', 'automation', 'sights', 'armour'];
export interface ImproveSpec {
  name: string; blurb: string;
  needs: [ItemKey, number][];
  /** The wall tier it needs first (the armoured wall goes on stone). */
  wall?: number;
  gold: number; xp: number;
}
export const IMPROVE: Record<ImproveKind, ImproveSpec> = {
  bank: { name: 'Battery Bank', blurb: 'racks of power cells in a shed by the plant: they charge while the sun shines and the wind blows, and give it back at night and in a lull', needs: [['powercell', 4], ['batteries', 6], ['cable', 6], ['bricks', 6], ['pcm', 1]], gold: 250, xp: 250 },
  lamps: { name: 'Battery Lamps', blurb: 'the old oil and filament lamps swapped for battery lamps: the village takes less power, and its lamps stay lit when the plant is down', needs: [['batteries', 4], ['glass', 4], ['cable', 4]], gold: 120, xp: 120 },
  automation: { name: 'Automated Site', blurb: 'automation units bolted to the industry site\'s machines: it makes half as much again and runs whether the village has the hands or not', needs: [['automation', 2], ['precision', 2], ['cable', 6], ['steel', 4], ['motor', 2], ['control', 2]], gold: 500, xp: 500 },
  sights: { name: 'Sensor Sights', blurb: 'sensor heads and a chip on every turret on the wall: they see half as far again and fire faster', needs: [['sensor', 2], ['microchip', 2], ['cable', 4], ['optics', 2]], gold: 300, xp: 300 },
  armour: { name: 'Armoured Wall', blurb: 'the stone wall faced with plates of aluminium and advanced alloy: raids break on it more often and the gates hold longer', needs: [['aluminium', 8], ['alloy', 6], ['steel', 8], ['cement', 10], ['titanium', 4], ['advsteel', 6]], wall: 2, gold: 400, xp: 400 },
};
export const hasImprove = (s: TownState | undefined, k: ImproveKind) => !!s?.imp?.[k];

/** What an improvement still needs, and why it cannot be built yet ('' when it can); null once built. */
export function improvePlan(k: ImproveKind, s: TownState | undefined) {
  if (hasImprove(s, k)) return null;
  const spec = IMPROVE[k], rows = spec.needs.map(([i, n]) => ({ k: i, n, given: Math.min(n, s?.igiven?.[k]?.[i] ?? 0) }));
  const problem = spec.wall !== undefined && (s?.wall ?? 0) < spec.wall ? 'It goes on a stone wall: the village needs one first.' : '';
  return { spec, rows, problem, done: rows.every((r) => r.given >= r.n) };
}
/** Hand over materials for k (bit by bit); builds it once complete. */
export function handOverImprove(k: ImproveKind, s: TownState, have: (i: ItemKey) => number, at?: number): { taken: [ItemKey, number][]; built: boolean; started?: boolean } {
  const plan = improvePlan(k, s);
  if (!plan || plan.problem || jobOf(s, 'improve', k)) return { taken: [], built: false };
  const g = ((s.igiven ??= {})[k] ??= {}), taken: [ItemKey, number][] = [];
  for (const r of plan.rows) { const n = Math.min(r.n - r.given, have(r.k)); if (n > 0) { g[r.k] = r.given + n; taken.push([r.k, n]); } }
  if (!improvePlan(k, s)!.done) return { taken, built: false };
  if (at !== undefined) { startJob(s, 'improve', k, at); return { taken, built: false, started: true }; }
  completeImprove(s, k);
  return { taken, built: true };
}
export function completeImprove(s: TownState, k: ImproveKind) { (s.imp ??= {})[k] = true; if (s.igiven) delete s.igiven[k]; }

// ---------- the effects ----------
/** The battery bank: what it gives back (kW) is BANK.back of the renewables' shortfall below their rating, at most BANK.kw. */
export const BANK = { kw: 60, back: 0.5 };
export function bankKw(s: TownState | undefined, rated: number, now: number): number {
  return hasImprove(s, 'bank') ? Math.min(BANK.kw, BANK.back * Math.max(0, rated - now)) : 0;
}
/** What the village itself takes (kW): less with battery lamps. */
export const VILLAGE_BASE_KW = 25, LAMPS_KW = 15;
export const villageKw = (s: TownState | undefined) => (hasImprove(s, 'lamps') ? LAMPS_KW : VILLAGE_BASE_KW);
/** The automated site: its output factor, and the least staffing it works at (it needs no hands). */
export const AUTO = { mult: 1.5 };
export const autoMult = (s: TownState | undefined) => (hasImprove(s, 'automation') ? AUTO.mult : 1);
export const autoStaffing = (s: TownState | undefined, staffing: number) => (hasImprove(s, 'automation') ? Math.max(1, staffing) : staffing);
/** Sensor sights: the wall turrets' range and rate factors. */
export const SIGHTS = { range: 1.5, rate: 0.65 };
/** The armoured wall: added to the chance a raid breaks on the wall, and the factor on the gates' wear in a live raid. */
export const ARMOUR = { hold: 0.06, drain: 0.6 };
export const armourHold = (s: TownState | undefined) => (hasImprove(s, 'armour') && (s?.wall ?? 0) >= 2 ? ARMOUR.hold : 0);
export const armourDrain = (s: TownState | undefined) => (hasImprove(s, 'armour') && (s?.wall ?? 0) >= 2 ? ARMOUR.drain : 1);
