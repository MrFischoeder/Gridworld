// New-world settlement rules. Old saves have no `settlement` flag and keep their established economy.
import { townsWorld } from './worldrules';
import type { TownState } from './town';
import type { ItemKey } from '../data/items';
import { hash } from '../core/rng';
import { allVillages, poisNear, GRIDHOLM_ID, worldDist, type Poi } from './regions';
import { villageDeposits, rareDepositsOf, quarryMineral, brine, ORES, YARD_KINDS, type Deposits, type YardKind } from './resource-sites';
import { startJob, jobOf } from './construction';
import { tl, TL } from '../i18n';
export { RESOURCE_PLOTS } from './resource-sites';

export type Project = 'warehouse' | 'power' | 'comms' | 'quarry' | 'mine' | 'lumber' | 'oil' | 'refinery' | 'foodworks' | 'relay' | 'sawmill' | 'sawmill2' | 'sawmill3' | 'raremine' | 'furnace' | 'furnace2' | 'furnace3' | 'fuelpump' | 'charger' | 'depot';
export interface SettlementState {
  v: 1;
  done?: Partial<Record<Project, boolean>>;
  given?: Partial<Record<Project, Partial<Record<ItemKey, number>>>>;
  supplies?: boolean;
  refinedAt?: number;
  /** (0.170) When the sawmill last settled its batches (game minutes). */
  sawnAt?: number;
  /** (0.176) When the furnace last settled its batches (game minutes). */
  smeltAt?: number;
  /** (0.214) When the convoy depot was finished (game minutes): the convoys on the roads run from then on. */
  depotAt?: number;
  deposits?: Deposits;
  /** (0.149, document 04) The start village's satellite link is the big radar and communications station a few km out
   * (`STATION_STAGES`, `stage` = stages done), restored after the first vehicle (`car`: someone in this world has one). */
  station?: true; stage?: number; car?: boolean;
  /** (0.150) The last orbital scan anyone in this world asked for (game time; the start village's state). */
  scanAt?: number;
  /** (0.197) Where the hero staked out the warehouse (plaza-local middle, `d` the side its doors face: gen/hall.ts
   *  `HallSpot`), and `whWait` = its materials are in and it waits for that. */
  wh?: { x: number; z: number; d: number }; whWait?: true;
}
export const progressive = (s: TownState | undefined) => s?.settlement?.v === 1;
export const projectDone = (s: TownState | undefined, k: Project) => !!s?.settlement?.done?.[k];
export const SETTLEMENT_START = 8;
export const PROJECTS: Record<Project, { name: string; needs: [ItemKey, number][]; description: string }> = {
  warehouse: { name: tl('Vehicle warehouse'), needs: [['planks', 84], ['stone', 24], ['nails', 20]], description: tl('Build the plank warehouse outside the wall, wherever you stake it out, with room before its doors for the vehicles and the convoys. From then on the village stores are kept there: drive in through its wide doors and unload your vehicle at the terminal.') },
  power: { name: tl('Village power plant'), needs: [['scrap', 12], ['wire', 8], ['circuit', 2], ['coil', 1], ['inverter', 1]], description: tl('Build electricity on the marked site outside the fence. Farms work by hand until then. A generator needs a stator coil and a power inverter, and nobody makes them any more: the crumpled engine of your own ship still has both. Strip it with a wrench.') },
  comms: { name: tl('Satellite link'), needs: [['planks', 12], ['stone', 6], ['scrap', 4]], description: tl('Restore the receiver in the nearby communications ruin. Use its console to reconnect the satellites and receive a GPS tablet.') },
  quarry: { name: tl('Stone quarry'), needs: [['planks', 44], ['scrap', 4]], description: tl('Build stone-cutting works beside the large pile of boulders about 100 metres beyond our fence. Every village has its own quarry; it supplies building stone.') },
  mine: { name: tl('Ore mine'), needs: [['planks', 48], ['stone', 12], ['scrap', 6]], description: tl('Build a mine at the coloured rocky hollow. Only villages with a local ore seam can extract that ore.') },
  lumber: { name: tl('Lumber camp'), needs: [['planks', 24], ['stone', 10], ['scrap', 8]], description: tl('Build a woodcutters\' camp in the great grove. The giant trees there are too big to fell, but the crews take timber from them for good: logs every day, and you may cut them yourself once the camp stands. Saw the logs into planks by hand or at a sawmill.') },
  oil: { name: tl('Oil well'), needs: [['scrap', 16], ['wire', 8], ['planks', 12]], description: tl('Build a pump at the natural oil seep. Crude oil collects in village stock.') },
  refinery: { name: tl('Oil refinery'), needs: [['scrap', 24], ['circuit', 4], ['wire', 12], ['planks', 18]], description: tl('Build a refinery north of the village. It turns crude oil from the village stores into fuel: crude from our own well if we have one, or crude you bring from the oil villages. Fuel sells for far more than crude.') },
  sawmill: { name: tl('Sawmill'), needs: [['planks', 20], ['stone', 8], ['scrap', 6], ['wire', 4]], description: tl('Build a powered sawmill on the staked plot north-west of the village. Its frame saw cuts logs from the village stores into planks: 6 from a log, where a hand saw gets 4. It runs on electricity and needs a crew of three.') },
  sawmill2: { name: tl('Sawmill: circular saws'), needs: [['scrap', 12], ['parts', 2], ['wire', 6], ['planks', 10]], description: tl('Fit the sawmill with circular saws: 7 planks from a log, and it takes more power.') },
  sawmill3: { name: tl('Sawmill: band saws'), needs: [['motor', 2], ['parts', 3], ['steel', 4], ['cable', 4]], description: tl('Fit band saws driven by electric motors: 8 planks from a log, the best a sawmill can do. It draws the most power.') },
  relay: { name: tl('Relay mast'), needs: [['scrap', 12], ['wire', 10], ['circuit', 4], ['planks', 16], ['gears', 2]], description: tl('Raise a relay mast over the receiver. The satellites talk to it on their own passes, so orbital scans round this village come apart from the rest of the world and reach further.') },
  raremine: { name: tl('Deep mine'), needs: [['drillrig', 1], ['steel', 6], ['cable', 6], ['cement', 8], ['planks', 16]], description: tl('Sink a deep shaft over the rare deposit south-east of the village. A drill rig from a Heavy Engineering Works bores down to it, a winding house and a headframe bring the ore up into the village stores every day. It needs power and a crew of four.') },
  furnace: { name: tl('Coal furnace'), needs: [['stone', 24], ['planks', 16], ['scrap', 12], ['wire', 4]], description: tl('Build a stone shaft furnace on the plot west of the village. Fed with coal from the village stores, it smelts the ore there into bars in the stores: iron ore into iron, copper and lead ore into copper and lead bars, and scrap into iron. It needs power for its blowers and a crew of three.') },
  furnace2: { name: tl('Furnace: coke ovens'), needs: [['stone', 20], ['bricks', 10], ['scrap', 10], ['planks', 8]], description: tl('Build a battery of coke ovens beside the furnace. Coke burns hotter and cleaner than raw coal: every melt gives half as much metal again.') },
  fuelpump: { name: tl('Fuel pump'), needs: [['scrap', 14], ['wire', 6], ['planks', 10], ['parts', 2], ['circuit', 1]], description: tl('Build a fuel pump by the road north-east of the village, beside the refinery\'s plot. It pumps diesel from the village stores straight into your vehicle\'s tank, or a canister for your backpack, at the village\'s price. The village\'s convoys fill up from the same stores.') },
  charger: { name: tl('Charging post'), needs: [['cable', 8], ['steel', 4], ['control', 1], ['batteries', 2], ['planks', 6]], description: tl('Build a charging post east of the village. An electric vehicle parked beside it charges from whatever power the village has to spare, a few gold a kWh: the more you charge, the more the village\'s plant and stations have to make.') },
  depot: { name: tl('Convoy depot'), needs: [['planks', 40], ['stone', 12], ['scrap', 16], ['wire', 6], ['parts', 2]], description: tl('Build a convoy depot by the north road: a yard for the trucks and their gun jeeps, a repair shed and a dispatcher\'s hut. Until it stands no convoys run anywhere; from then on caravans travel the roads between the villages, carrying their goods and moving the prices. Our own convoys fill up with fuel from the village stores before they leave: without fuel they stay home.') },
  furnace3: { name: tl('Furnace: electric arc'), needs: [['steel', 8], ['cable', 10], ['generator', 1], ['parts', 2]], description: tl('Fit an electric arc furnace: no coal at all, twice the melts, the best yield, and a heavy draw of power.') },
  foodworks: { name: tl('Food processing house'), needs: [['planks', 40], ['stone', 10], ['nails', 16], ['scrap', 6]], description: tl('Build a mill, a bakery, a dairy and a smokehouse on the staked plot about 100 metres south-west of the village. While its crew works, grain, potatoes, milk and meat feed a third more people, so the same fields keep a bigger village.') },
};
/**
 * The start village's radar and communications station (document 04): a big project in three stages, salvage and
 * exploration rather than a click. Each stage's materials are handed over bit by bit like any project's.
 */
export const STATION_STAGES: { title: string; text: string; needs: [ItemKey, number][] }[] = [
  { title: tl('Clearing the station'), text: tl('The mast lies across the compound and the bunker is buried in rubble. Timber for props, stone to wall up the bunker, scrap to patch the doors.'), needs: [['planks', 40], ['stone', 20], ['scrap', 16]] },
  { title: tl('Power and cabling'), text: tl('The station needs its own power and new cable runs: wire, old electronics for the switchboard, machine parts and an engine to turn the generator.'), needs: [['scrap', 20], ['wire', 16], ['circuit', 6], ['parts', 3], ['engine', 1]] },
  { title: tl('The dish and the console'), text: tl('The mast goes up again with the dish on top, and the console must find the satellites: power cores for the transmitter, electronics, gears for the dish drive, machine parts.'), needs: [['circuit', 10], ['pcore', 2], ['gears', 4], ['parts', 4], ['scrap', 10]] },
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
  if (k === 'raremine') return projectDone(s, k) || !!depositsOf(s).rares?.length || !!s?.settlement?.given?.[k];
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
  if (!progressive(s)) return tl('This settlement uses the established village rules.');
  if (projectDone(s, k)) return tl('Already built.');
  if (!projectAvailable(s, k)) return k === 'raremine' ? tl('There is no rare deposit under this village.') : k === 'mine' ? tl('There is no ore seam here. Import metals from another village.') : k === 'lumber' ? tl('There is no great grove here. Cut wild trees, or bring logs from a village that has one.') : tl('There is no oil field here. Import crude or fuel from another village.');
  if (k === 'relay') return isStation(s) ? tl('The station itself is this village\'s relay.') : projectDone(s, 'comms') ? '' : tl('Restore the satellite receiver first.');
  // (0.167, the owner's order) farms, then power, then the warehouse, then the village's own extraction; the satellite
  // link is a side task once the power plant stands
  if (k === 'comms') return projectDone(s, 'power') ? '' : tl('Build the village power plant first.');
  if (k === 'power') return (s?.farms ?? 0) >= 2 ? '' : tl('Build two farms first.');
  if (k === 'sawmill') return projectDone(s, 'power') ? '' : tl('Build the village power plant first: the sawmill runs on electricity.');
  if (k === 'sawmill2') return projectDone(s, 'sawmill') && projectDone(s, 'warehouse') ? '' : tl('Build the sawmill and the warehouse first.');
  if (k === 'sawmill3') return projectDone(s, 'sawmill2') ? '' : tl('Fit the circular saws first.');
  if (k === 'warehouse') return projectDone(s, 'power') ? '' : tl('Build the village power plant first.');
  if (k === 'quarry' || k === 'mine' || k === 'lumber' || k === 'oil') return projectDone(s, 'warehouse') ? '' : tl('Build the warehouse first.');
  if (k === 'refinery') return projectDone(s, 'warehouse') ? '' : tl('Build the warehouse first.');
  if (k === 'raremine') return projectDone(s, 'warehouse') ? '' : tl('Build the warehouse first.');
  if (k === 'furnace') return projectDone(s, 'power') && projectDone(s, 'warehouse') ? '' : tl('Build the village power plant and the warehouse first.');
  if (k === 'charger') return projectDone(s, 'power') ? '' : tl('Build the village power plant first: the post charges from it.');
  if (k === 'depot') return !mechanicHere(s) ? tl('Wait for the mechanic: he will fit out the trucks.') : projectDone(s, 'warehouse') ? '' : tl('Build the warehouse first.');
  if (k === 'fuelpump') return projectDone(s, 'warehouse') ? '' : tl('Build the warehouse first: the pump draws on the village stores.');
  if (k === 'furnace2') return projectDone(s, 'furnace') ? '' : tl('Build the coal furnace first.');
  if (k === 'furnace3') return projectDone(s, 'furnace2') ? '' : tl('Build the coke ovens first.');
  if (k === 'foodworks') return projectDone(s, 'power') && (s?.farms ?? 0) >= 2 ? '' : tl('Build the village power plant and two farms first.');
  return '';
}
export function projectPlan(s: TownState | undefined, k: Project) {
  const needs = k === 'comms' && isStation(s) ? STATION_STAGES[Math.min(stationStage(s), STATION_STAGES.length - 1)].needs : PROJECTS[k].needs;
  return needs.map(([i, n]) => ({ k: i, n, given: Math.min(n, s?.settlement?.given?.[k]?.[i] ?? 0) }));
}
/** Partial deliveries; callers remove exactly `taken` from shared stock. Repeated completion is a no-op. */
export function buildProject(s: TownState, k: Project, have: (i: ItemKey) => number, at?: number) {
  const taken: [ItemKey, number][] = [];
  if (projectProblem(s, k) || jobOf(s, 'project', k) || (k === 'warehouse' && s.settlement?.whWait)) return { taken, built: false, stage: false, started: false };
  const g = ((s.settlement!.given ??= {})[k] ??= {});
  for (const r of projectPlan(s, k)) {
    const n = Math.max(0, Math.min(r.n - r.given, Math.floor(have(r.k))));
    if (n) { g[r.k] = r.given + n; taken.push([r.k, n]); }
  }
  if (!projectPlan(s, k).every((r) => r.given === r.n)) return { taken, built: false, stage: false, started: false };
  if (at !== undefined && k === 'warehouse' && !s.settlement!.wh) { s.settlement!.whWait = true; return { taken, built: false, stage: false, started: false, wait: true }; } // (0.197) the hero stakes out where it goes (world/fields.ts), then the builders start: placeWarehouse
  if (at !== undefined) { startJob(s, 'project', k, at); return { taken, built: false, stage: false, started: true }; } // the builders take their time
  return { taken, ...completeProject(s, k) };
}
/** (0.197) The warehouse waiting for its spot is staked out there: saved, and the builders start. False if none waits. */
export function placeWarehouse(s: TownState, spot: { x: number; z: number; d: number }, now: number): boolean {
  const st = s.settlement;
  if (!st?.whWait || jobOf(s, 'project', 'warehouse') || st.done?.warehouse) return false;
  st.wh = { x: spot.x, z: spot.z, d: spot.d }; delete st.whWait;
  startJob(s, 'project', 'warehouse', now);
  return true;
}
/** Project k (or the station's current stage) stands: its builders are done. */
export function completeProject(s: TownState, k: Project): { built: boolean; stage: boolean } {
  let built = true, stage = false;
  if (k === 'comms' && isStation(s)) { // a stage of the station: the next one, until the last
    s.settlement!.stage = stationStage(s) + 1; delete s.settlement!.given?.[k]; stage = true;
    built = s.settlement!.stage >= STATION_STAGES.length;
  }
  if (built) { (s.settlement!.done ??= {})[k] = true; delete s.settlement!.given?.[k]; }
  return { built, stage };
}
/** Development repairs housing before migrants arrive. Food still limits population separately. */
export function development(s: TownState | undefined): number {
  if (!progressive(s)) return 6;
  return Math.min(6, (s?.farms ?? 0) + (projectDone(s, 'warehouse') ? 1 : 0) + (projectDone(s, 'power') ? 1 : 0) + (projectDone(s, 'quarry') || projectDone(s, 'mine') || projectDone(s, 'lumber') || s?.built ? 1 : 0));
}
export const housingCapacity = (s: TownState | undefined) => SETTLEMENT_START + development(s) * 8;
export const basicSmith = ['hatchet', 'pickaxe', 'firekit', 'flask', 'saw', 'oillamp', 'lampoil', 'firebrand', 'battery', 'woodshield', 'elampkit', 'olampkit', 'lhkit', 'whkit', 'flare', 'wrench', 'roadkit'] as ItemKey[];
export function smithAllows(s: TownState | undefined, k: ItemKey): boolean {
  if (!progressive(s)) return true;
  if (basicSmith.includes(k)) return true;
  if ((s?.farms ?? 0) < 1) return false;
  if (['planks', 'nails', 'hammer', 'saw', 'hideCap', 'hideCoat', 'hideGloves', 'hideLegs', 'hideBoots', 'rucksack'].includes(k)) return true;
  return projectDone(s, 'power');
}
export const starterRecipe = (s: TownState | undefined, k: ItemKey) => progressive(s) && (s?.farms ?? 0) >= 1 && ['planks', 'nails'].includes(k);
/** (0.182) The wall a new world's town starts with (gen/town.ts WALL_TIERS): a palisade or a stone wall. */
export const TOWN_WALL = [1, 1, 2];
export function initializeSettlements(c: { settlementRules: number; world: number; towns: Record<string, TownState> }) {
  if (c.settlementRules !== 1) return;
  for (const v of allVillages(c.world)) {
    if (townsWorld(c.world) && v.id !== GRIDHOLM_ID && !c.towns[v.id]?.settlement) { // (0.182) a new world's towns stand built: a wall from the start ((0.189) a rival's home is a settlement)
      const t = (c.towns[v.id] ??= {});
      t.wall ??= TOWN_WALL[hash(c.world, v.id, 0x70a1) % TOWN_WALL.length];
      continue;
    }
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
          ...(has('oil') ? { salt: had?.salt ?? fresh.salt ?? brine(c.world, v.id) } : {}), rares: fresh.rares };
      }
    }
    if (s.deposits && !s.deposits.rares) s.deposits.rares = rareDepositsOf(c.world, v.id); // (0.175) the deep deposits
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
export const STATION_TEXT = tl('Travellers speak of a ruined radar and communications station a few kilometres out. It might help us map the land: restore it and its dish will find the satellites still circling the planet, and the map in your glove computer comes alive.');
/** The crops the first farms of a new settlement are sown with (the elder's tutorial): grain, then hens. */
export const FIRST_CROPS = ['wheat', 'hens'] as const;
export function tutorialStep(s: TownState | undefined): { title: string; text: string; project?: Project; farm?: number } | null {
  if (!progressive(s)) return null;
  // (0.167) farms → power → warehouse → extraction → the third farm → food processing; the satellite link runs beside
  // it (`sideStep`), and Kuba the mechanic turns up once the village digs its own goods (`mechanicHere`)
  if (!(s?.farms ?? 0)) return { title: tl('Build the first farm'), text: tl('Bring 16 planks and 6 stones to the village stores (saw logs into planks with a saw) and ask me to build a farm. Its field will grow wheat: grain for bread. It feeds new families even without electricity.'), farm: 1 };
  if ((s?.farms ?? 0) < 2) return { title: tl('Build the second farm'), text: tl('A second farm, and this one keeps hens: eggs, and a little meat. Two kinds of food keep the families healthy.'), farm: 2 };
  for (const k of ['power', 'sawmill', 'warehouse', 'quarry', 'lumber', 'mine', 'oil'] as Project[]) if (projectAvailable(s, k) && !projectDone(s, k)) return { title: PROJECTS[k].name, text: k === 'warehouse' ? tl('Until now I have kept the village stores in my hall, and it is full to the rafters. ') + PROJECTS[k].description : PROJECTS[k].description, project: k };
  if ((s?.farms ?? 0) < 3) return { title: tl('Build the third farm'), text: tl('Finish the food supply for our growing settlement.'), farm: 3 };
  if (!projectDone(s, 'foodworks')) return { title: PROJECTS.foodworks.name, text: PROJECTS.foodworks.description, project: 'foodworks' };
  return { title: tl('A thriving settlement'), text: tl('Our homes, farms and industry are restored. You can now expand the village with advanced works and improvements.') };
}
/** (0.170) The sawmill's level (0 = none) and the planks it cuts from a log; a log sawn by hand gives `HAND_PLANKS`. */
export const sawLevel = (s: TownState | undefined) => (projectDone(s, 'sawmill3') ? 3 : projectDone(s, 'sawmill2') ? 2 : projectDone(s, 'sawmill') ? 1 : 0);
export const SAW = { perLog: [0, 6, 7, 8], kw: [0, 15, 25, 40], batch: 30, logs: 2 };
export const HAND_PLANKS = 4;
/** (0.176, development tree stage 4) The village furnace: its level (0 none, 1 coal, 2 coke ovens, 3 electric arc),
 *  minutes a melt, coal a melt, power, and what a melt takes and gives (`out[0]` with coal, `out[1]` with coke or the arc). */
export const furnaceLevel = (s: TownState | undefined) => (projectDone(s, 'furnace3') ? 3 : projectDone(s, 'furnace2') ? 2 : projectDone(s, 'furnace') ? 1 : 0);
export const FURNACE = {
  batch: [0, 60, 60, 30], coal: [0, 1, 1, 0], kw: [0, 20, 30, 70],
  melts: [
    { inp: 'ore', n: 2, out: 'iron', got: [2, 3] }, { inp: 'copper', n: 4, out: 'copperbar', got: [2, 3] },
    { inp: 'lead', n: 4, out: 'leadbar', got: [2, 3] }, { inp: 'scrap', n: 12, out: 'iron', got: [2, 3] },
  ] as { inp: ItemKey; n: number; out: ItemKey; got: [number, number] }[],
};
/** (0.175) What a deep mine brings up a game hour, split over the village's rare deposits (6 crates a day), and its power. */
export const DEEP = { rate: 0.25, kw: 40 };
/** Builds beside the tutorial that every village may take on (shown by the elder under the step): the refinery, the sawmill's next saws, the deep mine over a rare deposit. */
export function optionalProjects(s: TownState | undefined): Project[] {
  if (!progressive(s) || !projectDone(s, 'warehouse')) return [];
  const saw = (['sawmill2', 'sawmill3'] as Project[]).find((k) => !projectDone(s, k) && !projectProblem(s, k));
  const deep = projectAvailable(s, 'raremine') && !projectDone(s, 'raremine');
  const fire = (['furnace', 'furnace2', 'furnace3'] as Project[]).find((k) => !projectDone(s, k) && !projectProblem(s, k));
  return [...(projectDone(s, 'refinery') ? [] : ['refinery' as Project]), ...(projectDone(s, 'fuelpump') ? [] : ['fuelpump' as Project]), ...(projectDone(s, 'charger') || !projectDone(s, 'power') ? [] : ['charger' as Project]), ...(projectDone(s, 'depot') || !mechanicHere(s) ? [] : ['depot' as Project]), ...(saw ? [saw] : []), ...(fire ? [fire] : []), ...(deep ? ['raremine' as Project] : [])];
}
/** The side task beside the tutorial: the village's satellite link (the start village's big station), once its power plant stands. */
export function sideStep(s: TownState | undefined): { title: string; text: string; project: Project } | null {
  if (!progressive(s) || !projectDone(s, 'power') || projectDone(s, 'comms')) return null;
  return isStation(s)
    ? { title: tl('Restore the radar station'), text: TL`${STATION_TEXT} Stage ${stationStage(s) + 1} of ${STATION_STAGES.length}: ${STATION_STAGES[stationStage(s)].title.toLowerCase()}.`, project: 'comms' }
    : { title: tl('Restore the satellite receiver'), text: PROJECTS.comms.description, project: 'comms' };
}
/** Has Kuba the mechanic come to the village (the start village of a new world: once the power plant stands and the village digs its own goods; worlds where someone already has a vehicle keep him)? */
export const mechanicHere = (s: TownState | undefined) => !progressive(s) || !!s?.settlement?.car || (projectDone(s, 'power') && (['quarry', 'mine', 'oil', 'lumber'] as Project[]).some((k) => projectDone(s, k)));
/**
 * (0.202, the owner's rule) In a new world there are no vehicles of any kind (abandoned ones in the wilds, raiders'
 * cars, the caravans' convoys) until the mechanic has come to the start village; worlds before the rule, or a player
 * who already owns or ordered a vehicle, keep them. Pure of the shared `towns`, so every player agrees.
 */
/**
 * (0.214, the owner's rule) When convoys began in this world (gen/caravans.ts `setConvoyStart`): worlds before the
 * rule (an established start village) always had them (-Infinity); otherwise the first convoy depot any settlement
 * finished, or Infinity while none stands. Pure of the shared `towns`, so every player agrees.
 */
export function convoyStartOf(towns: Record<string, TownState>): number {
  if (!progressive(towns[GRIDHOLM_ID])) return -Infinity;
  let t = Infinity;
  for (const s of Object.values(towns)) if (progressive(s) && projectDone(s, 'depot')) t = Math.min(t, s.settlement!.depotAt ?? 0);
  return t;
}
export const vehiclesOpen = (c: { towns: Record<string, TownState>; vehicles?: unknown[]; garage?: unknown[] }) => {
  const s = c.towns[GRIDHOLM_ID];
  return !progressive(s) || mechanicHere(s) || !!c.vehicles?.length || !!c.garage?.length;
};
/** Crates per game hour. Refineries are handled by the runtime so actual crude is consumed. The lumber camp works the
 *  great grove: logs for good (sawn into planks at a sawmill or by hand). */
export function resourceYield(s: TownState | undefined): Partial<Record<ItemKey, number>> {
  if (!progressive(s)) return {};
  const d = depositsOf(s), ore = d.ore, vein = ore && ORES[ore];
  // (0.169) a quarry also digs its mineral, an oil field with brine boils salt
  return { ...(projectDone(s, 'quarry') ? { stone: .8, ...(d.mineral ? { [d.mineral]: .4 } : {}) } : {}), ...(projectDone(s, 'mine') && vein ? { [vein.good]: .6, ...(vein.lump ? { [vein.lump]: .3 } : {}) } : {}), ...(projectDone(s, 'lumber') ? { log: 1.2, timber: .4 } : {}), ...(projectDone(s, 'oil') && d.oil ? { crude: .7, ...(d.salt ? { salt: .25 } : {}) } : {}), ...(projectDone(s, 'refinery') ? { fuel: 0 } : {}), ...(projectDone(s, 'raremine') ? Object.fromEntries((d.rares ?? []).map((r) => [r, DEEP.rate / d.rares!.length])) : {}) };
}
/** Stable labels for the deposit marker geometry. */
export const depositVariant = (world: number, vid: number) => hash(world, vid, 0x5e77) % 3;
export { GRIDHOLM_ID };
/**
 * (0.179, the fuel plan's P3) A settlement's fuel pump, built like any project (it does not come by itself): it fills
 * your vehicle from the village stores (a canister at a time, at the village's buy price). `reach` = how far from the
 * pump island a vehicle may stand (m); `pumps` = the two pump columns (plot-local x).
 */
export const FUEL_PUMP = { reach: 12, use: 2.2, pumps: [-2.2, 2.2] };
/**
 * (0.180, the fuel plan's P4) A settlement's charging post, built as a project after the power plant: an electric
 * vehicle within `reach` of it charges at up to `kw` from the village's spare power (gen/energy.ts `balance().free`).
 * `posts` = the two charging pillars (plot-local x).
 */
export const CHARGER = { kw: 40, reach: 10, near: 2.4, posts: [-2.5, 2.5] };
