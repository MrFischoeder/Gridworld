// New-world settlement rules. Old saves have no `settlement` flag and keep their established economy.
import type { TownState } from './town';
import type { ItemKey } from '../data/items';
import { hash } from '../core/rng';
import { allVillages, poisNear, GRIDHOLM_ID, worldDist, type Poi } from './regions';
import { villageDeposits, ORES, type Deposits } from './resource-sites';
export { RESOURCE_PLOTS } from './resource-sites';

export type Project = 'warehouse' | 'power' | 'comms' | 'quarry' | 'mine' | 'lumber' | 'oil' | 'refinery' | 'foodworks';
export interface SettlementState {
  v: 1;
  done?: Partial<Record<Project, boolean>>;
  given?: Partial<Record<Project, Partial<Record<ItemKey, number>>>>;
  supplies?: boolean;
  refinedAt?: number;
  deposits?: Deposits;
}
export const progressive = (s: TownState | undefined) => s?.settlement?.v === 1;
export const projectDone = (s: TownState | undefined, k: Project) => !!s?.settlement?.done?.[k];
export const SETTLEMENT_START = 8;
export const PROJECTS: Record<Project, { name: string; needs: [ItemKey, number][]; description: string }> = {
  warehouse: { name: 'Vehicle warehouse', needs: [['log', 30], ['stone', 24], ['planks', 24], ['nails', 20]], description: 'Build the plank warehouse outside the north fence. From then on the village stores are kept there: drive in through its wide doors and unload your vehicle at the terminal.' },
  power: { name: 'Village power plant', needs: [['scrap', 12], ['wire', 8], ['circuit', 2]], description: 'Build electricity on the marked site outside the fence. Farms work by hand until then.' },
  comms: { name: 'Satellite link', needs: [['log', 6], ['stone', 6], ['scrap', 4]], description: 'Restore the receiver in the nearby communications ruin. Use its console to reconnect the satellites and receive a GPS tablet.' },
  quarry: { name: 'Stone quarry', needs: [['log', 16], ['planks', 12], ['scrap', 4]], description: 'Build stone-cutting works beside the large pile of boulders about 100 metres beyond our fence. Every village has its own quarry; it supplies building stone.' },
  mine: { name: 'Ore mine', needs: [['log', 18], ['stone', 12], ['planks', 12], ['scrap', 6]], description: 'Build a mine at the coloured rocky hollow. Only villages with a local ore seam can extract that ore.' },
  lumber: { name: 'Sawmill', needs: [['log', 20], ['stone', 10], ['scrap', 8]], description: 'Build the marked timber works. It supplies timber and sawn lumber.' },
  oil: { name: 'Oil well', needs: [['scrap', 16], ['wire', 8], ['planks', 12]], description: 'Build a pump at the natural oil seep. Crude oil collects in village stock.' },
  refinery: { name: 'Oil refinery', needs: [['scrap', 24], ['circuit', 4], ['wire', 12], ['planks', 18]], description: 'Build a refinery beside the oil well. It consumes crude from village stock to make fuel.' },
  foodworks: { name: 'Food processing house', needs: [['log', 14], ['stone', 10], ['planks', 12], ['nails', 16], ['scrap', 6]], description: 'Build a mill, a bakery, a dairy and a smokehouse on the staked plot about 100 metres south-west of the village. While its crew works, grain, potatoes, milk and meat feed a third more people, so the same fields keep a bigger village.' },
};
/** Saves predating deposit metadata keep their commissioned extraction sites. */
export const depositsOf = (s: TownState | undefined): Deposits => s?.settlement?.deposits ?? { ore: 'iron', oil: true };
export function projectAvailable(s: TownState | undefined, k: Project): boolean {
  return projectDone(s, k) || (k === 'mine' ? !!depositsOf(s).ore : k === 'oil' || k === 'refinery' ? depositsOf(s).oil : true);
}
export function localIndustryDone(s: TownState | undefined): boolean {
  return projectDone(s, 'quarry') && projectDone(s, 'lumber') && (!projectAvailable(s, 'mine') || projectDone(s, 'mine')) && (!projectAvailable(s, 'oil') || projectDone(s, 'refinery'));
}
export function projectProblem(s: TownState | undefined, k: Project): string {
  if (!progressive(s)) return 'This settlement uses the established village rules.';
  if (projectDone(s, k)) return 'Already built.';
  if (!projectAvailable(s, k)) return k === 'mine' ? 'There is no ore seam here. Import metals from another village.' : 'There is no oil field here. Import crude or fuel from another village.';
  if (k === 'comms') return (s?.farms ?? 0) >= 1 ? '' : 'Build the first farm first.';
  if (k === 'warehouse') return (s?.farms ?? 0) >= 2 && projectDone(s, 'comms') ? '' : 'Restore satellite communications and build two farms first.';
  if (k === 'power') return projectDone(s, 'warehouse') ? '' : 'Build the vehicle warehouse first.';
  if (k === 'quarry' || k === 'mine' || k === 'lumber' || k === 'oil') return projectDone(s, 'power') ? '' : 'Build the village power plant first.';
  if (k === 'refinery') return projectDone(s, 'oil') ? '' : 'Build the oil well first.';
  if (k === 'foodworks') return projectDone(s, 'power') && (s?.farms ?? 0) >= 2 ? '' : 'Build the village power plant and two farms first.';
  return '';
}
export function projectPlan(s: TownState | undefined, k: Project) {
  return PROJECTS[k].needs.map(([i, n]) => ({ k: i, n, given: Math.min(n, s?.settlement?.given?.[k]?.[i] ?? 0) }));
}
/** Partial deliveries; callers remove exactly `taken` from shared stock. Repeated completion is a no-op. */
export function buildProject(s: TownState, k: Project, have: (i: ItemKey) => number) {
  const taken: [ItemKey, number][] = [];
  if (projectProblem(s, k)) return { taken, built: false };
  const g = ((s.settlement!.given ??= {})[k] ??= {});
  for (const r of projectPlan(s, k)) {
    const n = Math.max(0, Math.min(r.n - r.given, Math.floor(have(r.k))));
    if (n) { g[r.k] = r.given + n; taken.push([r.k, n]); }
  }
  const built = projectPlan(s, k).every((r) => r.given === r.n);
  if (built) { (s.settlement!.done ??= {})[k] = true; delete s.settlement!.given![k]; }
  return { taken, built };
}
/** Development repairs housing before migrants arrive. Food still limits population separately. */
export function development(s: TownState | undefined): number {
  if (!progressive(s)) return 6;
  return Math.min(6, (s?.farms ?? 0) + (projectDone(s, 'warehouse') ? 1 : 0) + (projectDone(s, 'power') ? 1 : 0) + (projectDone(s, 'quarry') || projectDone(s, 'mine') || projectDone(s, 'lumber') || s?.built ? 1 : 0));
}
export const housingCapacity = (s: TownState | undefined) => SETTLEMENT_START + development(s) * 8;
export const basicSmith = ['hatchet', 'pickaxe', 'firekit', 'flask'] as ItemKey[];
export function smithAllows(s: TownState | undefined, k: ItemKey): boolean {
  if (!progressive(s)) return true;
  if (basicSmith.includes(k)) return true;
  if ((s?.farms ?? 0) < 1) return false;
  if (['planks', 'nails', 'hammer', 'saw', 'hideCap', 'hideCoat', 'hideGloves', 'hideLegs', 'hideBoots', 'rucksack'].includes(k)) return true;
  return projectDone(s, 'power');
}
export const starterRecipe = (s: TownState | undefined, k: ItemKey) => progressive(s) && (s?.farms ?? 0) >= 1 && ['planks', 'nails'].includes(k);
export function initializeSettlements(c: { settlementRules: number; world: number; towns: Record<string, TownState> }) {
  if (c.settlementRules !== 1) return;
  for (const v of allVillages(c.world)) {
    const s = ((c.towns[v.id] ??= {}).settlement ??= { v: 1 });
    if (!s.deposits) {
      s.deposits = villageDeposits(c.world, v.id);
      if (s.done?.mine || s.given?.mine) s.deposits.ore = 'iron';
      if (s.done?.oil || s.done?.refinery || s.given?.oil || s.given?.refinery) s.deposits.oil = true;
    }
  }
}
/** Reuse a genuine nearby ruin; independent stream leaves existing village/ruin identities untouched. */
const commsCache = new Map<string, Poi>();
export function commsRuin(world: number, v: Poi): Poi | null {
  const key = world + ':' + v.id, old = commsCache.get(key); if (old) return old;
  const candidates = poisNear(world, v.x, v.z, 2200).filter((p) => p.type === 'ruin');
  candidates.sort((a, b) => worldDist(v.x, v.z, a.x, a.z) - worldDist(v.x, v.z, b.x, b.z) || a.id - b.id);
  const p = candidates[0]; if (p) { if (commsCache.size > 4000) commsCache.clear(); commsCache.set(key, p); }
  return p ?? null;
}
export function tutorialStep(s: TownState | undefined): { title: string; text: string; project?: Project; farm?: number; supplies?: boolean } | null {
  if (!progressive(s)) return null;
  if (!s!.settlement!.supplies) return { title: 'Gather and store supplies', text: 'Collect 4 logs and 4 stones and leave them with the elder: until a warehouse stands, he keeps the village\'s stores. Then report to him. Ask the elder for starter tools, then hold E at trees and rocks.', supplies: true };
  if (!(s?.farms ?? 0)) return { title: 'Build the first farm', text: 'Bring 8 logs and 6 stones to the village stores. Ask the elder to build a farm; it feeds new families even without electricity.', farm: 1 };
  if (!projectDone(s, 'comms')) return { title: 'Restore satellite communications', text: PROJECTS.comms.description, project: 'comms' };
  if ((s?.farms ?? 0) < 2) return { title: 'Build the second farm', text: 'Extend food production and repair more homes with a second farm.', farm: 2 };
  for (const k of ['warehouse', 'power', 'quarry', 'lumber', 'mine', 'oil', 'refinery'] as Project[]) if (projectAvailable(s, k) && !projectDone(s, k)) return { title: PROJECTS[k].name, text: PROJECTS[k].description, project: k };
  if ((s?.farms ?? 0) < 3) return { title: 'Build the third farm', text: 'Finish the food supply for our growing settlement.', farm: 3 };
  if (!projectDone(s, 'foodworks')) return { title: PROJECTS.foodworks.name, text: PROJECTS.foodworks.description, project: 'foodworks' };
  return { title: 'A thriving settlement', text: 'Our homes, farms and industry are restored. You can now expand the village with advanced works and improvements.' };
}
/** Crates per game hour. Refineries are handled by the runtime so actual crude is consumed. */
export function resourceYield(s: TownState | undefined): Partial<Record<ItemKey, number>> {
  if (!progressive(s)) return {};
  const ore = depositsOf(s).ore, vein = ore && ORES[ore];
  return { ...(projectDone(s, 'quarry') ? { stone: .8 } : {}), ...(projectDone(s, 'mine') && vein ? { [vein.good]: .6, ...(vein.lump ? { [vein.lump]: .3 } : {}) } : {}), ...(projectDone(s, 'lumber') ? { log: .8, timber: .5, lumber: .3 } : {}), ...(projectDone(s, 'oil') && depositsOf(s).oil ? { crude: .7 } : {}), ...(projectDone(s, 'refinery') ? { fuel: 0 } : {}) };
}
/** Stable labels for the deposit marker geometry. */
export const depositVariant = (world: number, vid: number) => hash(world, vid, 0x5e77) % 3;
export { GRIDHOLM_ID };
