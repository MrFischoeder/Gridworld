// New-world settlement rules. Old saves have no `settlement` flag and keep their established economy.
import type { TownState } from './town';
import type { ItemKey } from '../data/items';
import { hash } from '../core/rng';
import { allVillages, poisNear, GRIDHOLM_ID, worldDist, type Poi } from './regions';
import { villageDeposits, quarryMineral, brine, ORES, YARD_KINDS, type Deposits, type YardKind } from './resource-sites';
import { startJob, jobOf } from './construction';
export { RESOURCE_PLOTS } from './resource-sites';

export type Project = 'warehouse' | 'power' | 'comms' | 'quarry' | 'mine' | 'lumber' | 'oil' | 'refinery' | 'foodworks' | 'relay' | 'sawmill' | 'sawmill2' | 'sawmill3';
export interface SettlementState {
  v: 1;
  done?: Partial<Record<Project, boolean>>;
  given?: Partial<Record<Project, Partial<Record<ItemKey, number>>>>;
  supplies?: boolean;
  refinedAt?: number;
  /** (0.170) When the sawmill last settled its batches (game minutes). */
  sawnAt?: number;
  deposits?: Deposits;
  /** (0.149, document 04) The start village's satellite link is the big radar and communications station a few km out
   * (`STATION_STAGES`, `stage` = stages done), restored after the first vehicle (`car`: someone in this world has one). */
  station?: true; stage?: number; car?: boolean;
  /** (0.150) The last orbital scan anyone in this world asked for (game time; the start village's state). */
  scanAt?: number;
}
export const progressive = (s: TownState | undefined) => s?.settlement?.v === 1;
export const projectDone = (s: TownState | undefined, k: Project) => !!s?.settlement?.done?.[k];
export const SETTLEMENT_START = 8;
export const PROJECTS: Record<Project, { name: string; needs: [ItemKey, number][]; description: string }> = {
  warehouse: { name: 'Vehicle warehouse', needs: [['planks', 84], ['stone', 24], ['nails', 20]], description: 'Build the plank warehouse outside the north fence. From then on the village stores are kept there: drive in through its wide doors and unload your vehicle at the terminal.' },
  power: { name: 'Village power plant', needs: [['scrap', 12], ['wire', 8], ['circuit', 2]], description: 'Build electricity on the marked site outside the fence. Farms work by hand until then.' },
  comms: { name: 'Satellite link', needs: [['planks', 12], ['stone', 6], ['scrap', 4]], description: 'Restore the receiver in the nearby communications ruin. Use its console to reconnect the satellites and receive a GPS tablet.' },
  quarry: { name: 'Stone quarry', needs: [['planks', 44], ['scrap', 4]], description: 'Build stone-cutting works beside the large pile of boulders about 100 metres beyond our fence. Every village has its own quarry; it supplies building stone.' },
  mine: { name: 'Ore mine', needs: [['planks', 48], ['stone', 12], ['scrap', 6]], description: 'Build a mine at the coloured rocky hollow. Only villages with a local ore seam can extract that ore.' },
  lumber: { name: 'Lumber camp', needs: [['planks', 24], ['stone', 10], ['scrap', 8]], description: 'Build a woodcutters\' camp in the great grove. The giant trees there are too big to fell, but the crews take timber from them for good: logs every day, and you may cut them yourself once the camp stands. Saw the logs into planks by hand or at a sawmill.' },
  oil: { name: 'Oil well', needs: [['scrap', 16], ['wire', 8], ['planks', 12]], description: 'Build a pump at the natural oil seep. Crude oil collects in village stock.' },
  refinery: { name: 'Oil refinery', needs: [['scrap', 24], ['circuit', 4], ['wire', 12], ['planks', 18]], description: 'Build a refinery north of the village. It turns crude oil from the village stores into fuel: crude from our own well if we have one, or crude you bring from the oil villages. Fuel sells for far more than crude.' },
  sawmill: { name: 'Sawmill', needs: [['planks', 20], ['stone', 8], ['scrap', 6], ['wire', 4]], description: 'Build a powered sawmill on the staked plot north-west of the village. Its frame saw cuts logs from the village stores into planks: 6 from a log, where a hand saw gets 4. It runs on electricity and needs a crew of three.' },
  sawmill2: { name: 'Sawmill: circular saws', needs: [['scrap', 12], ['parts', 2], ['wire', 6], ['planks', 10]], description: 'Fit the sawmill with circular saws: 7 planks from a log, and it takes more power.' },
  sawmill3: { name: 'Sawmill: band saws', needs: [['motor', 2], ['parts', 3], ['steel', 4], ['cable', 4]], description: 'Fit band saws driven by electric motors: 8 planks from a log, the best a sawmill can do. It draws the most power.' },
  relay: { name: 'Relay mast', needs: [['scrap', 12], ['wire', 10], ['circuit', 4], ['planks', 16], ['gears', 2]], description: 'Raise a relay mast over the receiver. The satellites talk to it on their own passes, so orbital scans round this village come apart from the rest of the world and reach further.' },
  foodworks: { name: 'Food processing house', needs: [['planks', 40], ['stone', 10], ['nails', 16], ['scrap', 6]], description: 'Build a mill, a bakery, a dairy and a smokehouse on the staked plot about 100 metres south-west of the village. While its crew works, grain, potatoes, milk and meat feed a third more people, so the same fields keep a bigger village.' },
};
/**
 * The start village's radar and communications station (document 04): a big project in three stages, salvage and
 * exploration rather than a click. Each stage's materials are handed over bit by bit like any project's.
 */
export const STATION_STAGES: { title: string; text: string; needs: [ItemKey, number][] }[] = [
  { title: 'Clearing the station', text: 'The mast lies across the compound and the bunker is buried in rubble. Timber for props, stone to wall up the bunker, scrap to patch the doors.', needs: [['planks', 40], ['stone', 20], ['scrap', 16]] },
  { title: 'Power and cabling', text: 'The station needs its own power and new cable runs: wire, old electronics for the switchboard, machine parts and an engine to turn the generator.', needs: [['scrap', 20], ['wire', 16], ['circuit', 6], ['parts', 3], ['engine', 1]] },
  { title: 'The dish and the console', text: 'The mast goes up again with the dish on top, and the console must find the satellites: power cores for the transmitter, electronics, gears for the dish drive, machine parts.', needs: [['circuit', 10], ['pcore', 2], ['gears', 4], ['parts', 4], ['scrap', 10]] },
];
/** Is this village's satellite link the big station (the start village of a new world)? */
export const isStation = (s: TownState | undefined) => !!s?.settlement?.station;
/** Station stages done (0..3). */
export const stationStage = (s: TownState | undefined) => (projectDone(s, 'comms') ? STATION_STAGES.length : s?.settlement?.stage ?? 0);
/** Is the satellite link up in this world (a new world whose start village has its link)? Old worlds use the GPS tablet. */
export const satelliteUp = (home: TownState | undefined) => progressive(home) && projectDone(home, 'comms');
/**
 * Orbital scans (document 04 stage D): with the link up the glove asks a passing satellite to look at the ground round a
 * point: every place within `r` goes on your map. A satellite passes every `every` game minutes; one scan a pass for
 * the whole world (`scanAt` in the start village's shared state).
 */
export const ORBIT = { r: 3000, every: 360 };
/** Game minutes until the next pass can scan (0 = now). */
/** Relay masts (stage D2): a scan centred within `reach` of a village with one uses its own pass, `every` apart, and reaches `r`. */
export const RELAY = { reach: 4000, r: 4500 };
export const hasRelay = (s: TownState | undefined) => progressive(s) && !isStation(s) && projectDone(s, 'relay');
export const scanWait = (home: TownState | undefined, now: number) => { const t = home?.settlement?.scanAt; return t === undefined ? 0 : Math.max(0, t + ORBIT.every - now); };
/** Saves predating deposit metadata keep their commissioned extraction sites. */
export const depositsOf = (s: TownState | undefined): Deposits => s?.settlement?.deposits ?? { ore: 'iron', oil: true, grove: true };
/** (0.168, 0.171) Can project k be built here: one of the village's own yards (`Deposits.kinds`), a yard already built or begun,
 *  or anything that is not an extraction yard (the refinery is open to every village: it refines crude brought in). */
export function projectAvailable(s: TownState | undefined, k: Project): boolean {
  if (projectDone(s, k) || !(YARD_KINDS as string[]).includes(k)) return true;
  const d = depositsOf(s);
  const own = d.kinds ?? (d.kind ? [d.kind] : undefined);
  if (own) return own.includes(k as YardKind) || !!s?.settlement?.given?.[k];
  return k === 'mine' ? !!d.ore : k === 'oil' ? d.oil : k === 'lumber' ? d.grove !== false : true; // (no kind: worlds made in tests by hand)
}
/** Every extraction yard the village has (its own two) stands. */
export function localIndustryDone(s: TownState | undefined): boolean {
  return YARD_KINDS.every((k) => !projectAvailable(s, k) || projectDone(s, k));
}
export function projectProblem(s: TownState | undefined, k: Project): string {
  if (!progressive(s)) return 'This settlement uses the established village rules.';
  if (projectDone(s, k)) return 'Already built.';
  if (!projectAvailable(s, k)) return k === 'mine' ? 'There is no ore seam here. Import metals from another village.' : k === 'lumber' ? 'There is no great grove here. Cut wild trees, or bring logs from a village that has one.' : 'There is no oil field here. Import crude or fuel from another village.';
  if (k === 'relay') return isStation(s) ? 'The station itself is this village\'s relay.' : projectDone(s, 'comms') ? '' : 'Restore the satellite receiver first.';
  // (0.167, the owner's order) farms, then power, then the warehouse, then the village's own extraction; the satellite
  // link is a side task once the power plant stands
  if (k === 'comms') return projectDone(s, 'power') ? '' : 'Build the village power plant first.';
  if (k === 'power') return (s?.farms ?? 0) >= 2 ? '' : 'Build two farms first.';
  if (k === 'sawmill') return projectDone(s, 'power') ? '' : 'Build the village power plant first: the sawmill runs on electricity.';
  if (k === 'sawmill2') return projectDone(s, 'sawmill') && projectDone(s, 'warehouse') ? '' : 'Build the sawmill and the warehouse first.';
  if (k === 'sawmill3') return projectDone(s, 'sawmill2') ? '' : 'Fit the circular saws first.';
  if (k === 'warehouse') return projectDone(s, 'power') ? '' : 'Build the village power plant first.';
  if (k === 'quarry' || k === 'mine' || k === 'lumber' || k === 'oil') return projectDone(s, 'warehouse') ? '' : 'Build the warehouse first.';
  if (k === 'refinery') return projectDone(s, 'warehouse') ? '' : 'Build the warehouse first.';
  if (k === 'foodworks') return projectDone(s, 'power') && (s?.farms ?? 0) >= 2 ? '' : 'Build the village power plant and two farms first.';
  return '';
}
export function projectPlan(s: TownState | undefined, k: Project) {
  const needs = k === 'comms' && isStation(s) ? STATION_STAGES[Math.min(stationStage(s), STATION_STAGES.length - 1)].needs : PROJECTS[k].needs;
  return needs.map(([i, n]) => ({ k: i, n, given: Math.min(n, s?.settlement?.given?.[k]?.[i] ?? 0) }));
}
/** Partial deliveries; callers remove exactly `taken` from shared stock. Repeated completion is a no-op. */
export function buildProject(s: TownState, k: Project, have: (i: ItemKey) => number, at?: number) {
  const taken: [ItemKey, number][] = [];
  if (projectProblem(s, k) || jobOf(s, 'project', k)) return { taken, built: false, stage: false, started: false };
  const g = ((s.settlement!.given ??= {})[k] ??= {});
  for (const r of projectPlan(s, k)) {
    const n = Math.max(0, Math.min(r.n - r.given, Math.floor(have(r.k))));
    if (n) { g[r.k] = r.given + n; taken.push([r.k, n]); }
  }
  if (!projectPlan(s, k).every((r) => r.given === r.n)) return { taken, built: false, stage: false, started: false };
  if (at !== undefined) { startJob(s, 'project', k, at); return { taken, built: false, stage: false, started: true }; } // the builders take their time
  return { taken, ...completeProject(s, k) };
}
/** Project k (or the station's current stage) stands: its builders are done. */
export function completeProject(s: TownState, k: Project): { built: boolean; stage: boolean } {
  let built = true, stage = false;
  if (k === 'comms' && isStation(s)) { // a stage of the station: the next one, until the last
    s.settlement!.stage = stationStage(s) + 1; delete s.settlement!.given![k]; stage = true;
    built = s.settlement!.stage >= STATION_STAGES.length;
  }
  if (built) { (s.settlement!.done ??= {})[k] = true; delete s.settlement!.given![k]; }
  return { built, stage };
}
/** Development repairs housing before migrants arrive. Food still limits population separately. */
export function development(s: TownState | undefined): number {
  if (!progressive(s)) return 6;
  return Math.min(6, (s?.farms ?? 0) + (projectDone(s, 'warehouse') ? 1 : 0) + (projectDone(s, 'power') ? 1 : 0) + (projectDone(s, 'quarry') || projectDone(s, 'mine') || projectDone(s, 'lumber') || s?.built ? 1 : 0));
}
export const housingCapacity = (s: TownState | undefined) => SETTLEMENT_START + development(s) * 8;
export const basicSmith = ['hatchet', 'pickaxe', 'firekit', 'flask', 'saw'] as ItemKey[];
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
    if (v.id === GRIDHOLM_ID && !s.done?.comms && !s.station) { s.station = true; delete s.given?.comms; } // (0.149) the big station
    if (s.deposits?.v !== 3) { // (0.168 one own resource, 0.169 the new mix, 0.171 two) a yard already built or begun keeps its ground
      const fresh = villageDeposits(c.world, v.id), had = s.deposits;
      const begun = (k: YardKind) => !!s.done?.[k] || !!(s.given?.[k] && Object.keys(s.given[k]!).length);
      if (!YARD_KINDS.some(begun)) s.deposits = fresh;
      else {
        // the first: the one a v 2 save had, else the yard built (or begun); the second: the fresh roll unless it repeats the first
        const first: YardKind = (had?.v === 2 && had.kind) || YARD_KINDS.find((k) => s.done?.[k]) || YARD_KINDS.find(begun)!;
        const kinds: YardKind[] = [first, ...YARD_KINDS.filter((k) => k !== first && begun(k))];
        if (kinds.length < 2) kinds.push(fresh.kinds![0] !== first ? fresh.kinds![0] : fresh.kinds![1]);
        const has = (k: YardKind) => kinds.includes(k);
        s.deposits = { kinds, v: 3, oil: has('oil'), grove: has('lumber'),
          ...(has('mine') ? { ore: had?.ore ?? fresh.ore ?? 'iron' } : {}),
          ...(has('quarry') ? { mineral: had?.mineral ?? fresh.mineral ?? quarryMineral(c.world, v.id) } : {}),
          ...(has('oil') ? { salt: had?.salt ?? fresh.salt ?? brine(c.world, v.id) } : {}) };
      }
    }
  }
}
/** Reuse a genuine nearby ruin; independent stream leaves existing village/ruin identities untouched. */
const commsCache = new Map<string, Poi>();
/** How far out the start village's station lies (m). */
export const STATION_RANGE = [2000, 6000];
/** The ruin of village v's satellite link (the station's for the start village). */
export const linkRuin = (world: number, v: Poi, s: TownState | undefined) => commsRuin(world, v, isStation(s));
export function commsRuin(world: number, v: Poi, station = false): Poi | null {
  const key = world + ':' + v.id + (station ? ':s' : ''), old = commsCache.get(key); if (old) return old;
  // the start village's station lies a few km out (STATION_RANGE); the other villages' receivers in the nearest ruin
  const candidates = station ? poisNear(world, v.x, v.z, STATION_RANGE[1]).filter((p) => p.type === 'ruin' && worldDist(v.x, v.z, p.x, p.z) >= STATION_RANGE[0])
    : poisNear(world, v.x, v.z, 2200).filter((p) => p.type === 'ruin');
  if (station && !candidates.length) return commsRuin(world, v);
  candidates.sort((a, b) => worldDist(v.x, v.z, a.x, a.z) - worldDist(v.x, v.z, b.x, b.z) || a.id - b.id);
  const p = candidates[0]; if (p) { if (commsCache.size > 4000) commsCache.clear(); commsCache.set(key, p); }
  return p ?? null;
}
export const STATION_TEXT = 'Travellers speak of a ruined radar and communications station a few kilometres out. It might help us map the land: restore it and its dish will find the satellites still circling the planet, and the map in your glove computer comes alive.';
/** The crops the first farms of a new settlement are sown with (the elder's tutorial): grain, then hens. */
export const FIRST_CROPS = ['wheat', 'hens'] as const;
export function tutorialStep(s: TownState | undefined): { title: string; text: string; project?: Project; farm?: number } | null {
  if (!progressive(s)) return null;
  // (0.167) farms → power → warehouse → extraction → the third farm → food processing; the satellite link runs beside
  // it (`sideStep`), and Kuba the mechanic turns up once the village digs its own goods (`mechanicHere`)
  if (!(s?.farms ?? 0)) return { title: 'Build the first farm', text: 'Bring 16 planks and 6 stones to the village stores (saw logs into planks with a saw) and ask me to build a farm. Its field will grow wheat: grain for bread. It feeds new families even without electricity.', farm: 1 };
  if ((s?.farms ?? 0) < 2) return { title: 'Build the second farm', text: 'A second farm, and this one keeps hens: eggs, and a little meat. Two kinds of food keep the families healthy.', farm: 2 };
  for (const k of ['power', 'sawmill', 'warehouse', 'quarry', 'lumber', 'mine', 'oil'] as Project[]) if (projectAvailable(s, k) && !projectDone(s, k)) return { title: PROJECTS[k].name, text: k === 'warehouse' ? 'Until now I have kept the village stores in my hall, and it is full to the rafters. ' + PROJECTS[k].description : PROJECTS[k].description, project: k };
  if ((s?.farms ?? 0) < 3) return { title: 'Build the third farm', text: 'Finish the food supply for our growing settlement.', farm: 3 };
  if (!projectDone(s, 'foodworks')) return { title: PROJECTS.foodworks.name, text: PROJECTS.foodworks.description, project: 'foodworks' };
  return { title: 'A thriving settlement', text: 'Our homes, farms and industry are restored. You can now expand the village with advanced works and improvements.' };
}
/** (0.170) The sawmill's level (0 = none) and the planks it cuts from a log; a log sawn by hand gives `HAND_PLANKS`. */
export const sawLevel = (s: TownState | undefined) => (projectDone(s, 'sawmill3') ? 3 : projectDone(s, 'sawmill2') ? 2 : projectDone(s, 'sawmill') ? 1 : 0);
export const SAW = { perLog: [0, 6, 7, 8], kw: [0, 15, 25, 40], batch: 30, logs: 2 };
export const HAND_PLANKS = 4;
/** Builds beside the tutorial that every village may take on (shown by the elder under the step): the refinery, the sawmill's next saws. */
export function optionalProjects(s: TownState | undefined): Project[] {
  if (!progressive(s) || !projectDone(s, 'warehouse')) return [];
  const saw = (['sawmill2', 'sawmill3'] as Project[]).find((k) => !projectDone(s, k) && !projectProblem(s, k));
  return [...(projectDone(s, 'refinery') ? [] : ['refinery' as Project]), ...(saw ? [saw] : [])];
}
/** The side task beside the tutorial: the village's satellite link (the start village's big station), once its power plant stands. */
export function sideStep(s: TownState | undefined): { title: string; text: string; project: Project } | null {
  if (!progressive(s) || !projectDone(s, 'power') || projectDone(s, 'comms')) return null;
  return isStation(s)
    ? { title: 'Restore the radar station', text: `${STATION_TEXT} Stage ${stationStage(s) + 1} of ${STATION_STAGES.length}: ${STATION_STAGES[stationStage(s)].title.toLowerCase()}.`, project: 'comms' }
    : { title: 'Restore the satellite receiver', text: PROJECTS.comms.description, project: 'comms' };
}
/** Has Kuba the mechanic come to the village (the start village of a new world: once the power plant stands and the village digs its own goods; worlds where someone already has a vehicle keep him)? */
export const mechanicHere = (s: TownState | undefined) => !progressive(s) || !!s?.settlement?.car || (projectDone(s, 'power') && (['quarry', 'mine', 'oil', 'lumber'] as Project[]).some((k) => projectDone(s, k)));
/** Crates per game hour. Refineries are handled by the runtime so actual crude is consumed. The lumber camp works the
 *  great grove: logs for good (sawn into planks at a sawmill or by hand). */
export function resourceYield(s: TownState | undefined): Partial<Record<ItemKey, number>> {
  if (!progressive(s)) return {};
  const d = depositsOf(s), ore = d.ore, vein = ore && ORES[ore];
  // (0.169) a quarry also digs its mineral, an oil field with brine boils salt
  return { ...(projectDone(s, 'quarry') ? { stone: .8, ...(d.mineral ? { [d.mineral]: .4 } : {}) } : {}), ...(projectDone(s, 'mine') && vein ? { [vein.good]: .6, ...(vein.lump ? { [vein.lump]: .3 } : {}) } : {}), ...(projectDone(s, 'lumber') ? { log: 1.2, timber: .4 } : {}), ...(projectDone(s, 'oil') && d.oil ? { crude: .7, ...(d.salt ? { salt: .25 } : {}) } : {}), ...(projectDone(s, 'refinery') ? { fuel: 0 } : {}) };
}
/** Stable labels for the deposit marker geometry. */
export const depositVariant = (world: number, vid: number) => hash(world, vid, 0x5e77) % 3;
export { GRIDHOLM_ID };
