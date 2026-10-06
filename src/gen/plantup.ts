// Upgrading a village's own power plant (pure): three levels over the plant it was built with. Level 1 needs the
// plans for the plant's kind (Improved Wind Rotor for wind turbines, Solar Cells for a solar array; a diesel
// generator needs none) and common metal; level 2 needs electronics from the old world (components and a power
// core, found in ruins and wrecks); level 3 automates it with microchips from the Old Chip Foundry and precision
// components from the Old Precision Works (gen/installs.ts).
// Each level multiplies what the plant makes (gen/energy.ts baseKw).
import type { ItemKey } from '../data/items';
import { powerKind, type TownState, type PowerKind } from './town';
import { startJob, jobOf } from './construction';

export interface PlantLevel { name: string; mult: number; tech: Partial<Record<PowerKind, string>>; needs: [ItemKey, number][]; gold: number; xp: number }
export const PLANT_LEVELS: PlantLevel[] = [
  { name: 'as built', mult: 1, tech: {}, needs: [], gold: 0, xp: 0 },
  { name: 'Overhauled', mult: 1.5, tech: { wind: 'rotor', solar: 'solar' }, needs: [['scrap', 6], ['wire', 4], ['log', 2]], gold: 60, xp: 80 },
  { name: 'Rebuilt with old electronics', mult: 2, tech: {}, needs: [['circuit', 4], ['pcore', 1], ['wire', 6], ['generator', 1]], gold: 120, xp: 150 },
  { name: 'Automated', mult: 2.5, tech: {}, needs: [['microchip', 4], ['cable', 4], ['circuit', 2], ['precision', 2], ['control', 2], ['hpe', 1]], gold: 200, xp: 250 },
];
export const plantLevel = (s: TownState | undefined) => Math.min(PLANT_LEVELS.length - 1, s?.pup ?? 0);
export const plantMult = (s: TownState | undefined) => PLANT_LEVELS[plantLevel(s)].mult;
/** The plans the next level needs for this village's plant (null: none), or undefined at the top. */
export function levelTech(seed: number, s: TownState | undefined): string | null | undefined {
  const next = PLANT_LEVELS[plantLevel(s) + 1];
  return next ? next.tech[powerKind(seed)] ?? null : undefined;
}
/** The next level: what is still missing, whether its plans are known; null at the top. */
export function plantUpPlan(seed: number, s: TownState | undefined, known: Record<string, number>) {
  const to = plantLevel(s) + 1, lv = PLANT_LEVELS[to];
  if (!lv) return null;
  const tech = lv.tech[powerKind(seed)] ?? null;
  const rows = lv.needs.map(([k, n]) => ({ k, n, given: Math.min(n, s?.pupgiven?.[k] ?? 0) }));
  return { to, lv, tech, plans: !tech || known[tech] !== undefined, rows, done: rows.every((r) => r.given >= r.n) };
}
/** Hand over materials for the next level (bit by bit; nothing without its plans); raises the level once complete. */
export function handOverPlantUp(seed: number, s: TownState, known: Record<string, number>, have: (k: ItemKey) => number, at?: number): { taken: [ItemKey, number][]; built: boolean; started?: boolean } {
  const plan = plantUpPlan(seed, s, known);
  if (!plan || !plan.plans || jobOf(s, 'plantup')) return { taken: [], built: false };
  s.pupgiven ??= {};
  const taken: [ItemKey, number][] = [];
  for (const r of plan.rows) { const n = Math.min(r.n - r.given, have(r.k)); if (n > 0) { s.pupgiven[r.k] = r.given + n; taken.push([r.k, n]); } }
  if (!plantUpPlan(seed, s, known)!.done) return { taken, built: false };
  if (at !== undefined) { startJob(s, 'plantup', String(plan.to), at); return { taken, built: false, started: true }; }
  completePlantUp(s);
  return { taken, built: true };
}
export function completePlantUp(s: TownState) { s.pup = plantLevel(s) + 1; s.pupgiven = {}; }
