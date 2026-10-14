// Where each item is used, straight from the game's data (the same index as SUROWCE.md, in English): the item
// tooltip (ui/itemtip.ts) lists it under "Used for". Pure; built once on first use.
import { PROJECTS, type Project } from '../gen/settlement';
import { DIG, STORE, BUNKS, FIELD, WALL, TURRET, PORT } from '../gen/outposts';
import { PROC } from '../gen/outpostproc';
import { POWER_SRC } from '../gen/grid';
import { FOOD } from '../gen/farms';
import { ITEMS, type ItemKey } from './items';
import { ORDERS } from './orders';
import { GARAGE } from './garage';
import { vehicleTitle } from './vehicles';
import { GUNS, roundsInUse } from './weapons';
import { PLANTS, type PlantKind } from '../gen/plants';
import { STATIONS, type StationKind } from '../gen/energy';
import { FORTIFY, WORKS, POWER, type WorkKind } from '../gen/town';
import { WALL_TIERS } from '../gen/village';
import { FARM, UPGRADE } from '../gen/farms';
import { PLANT_LEVELS } from '../gen/plantup';
import { IMPROVE, IMPROVE_KINDS } from '../gen/improve';
import { INSTALLS, INSTALL_STAGES, INSTALL_WORK, HALL_SETS, RADAR_UP, installWorks, type InstallKind } from '../gen/installs';
import { STAGES } from '../gen/shuttle';
import { MENU } from '../gen/foodshop';
import { INDUSTRY, type Industry } from '../gen/industry';
import { BRIDGE } from '../gen/bridges';
import { PIER } from '../gen/piers';
import { LH } from '../gen/lighthouses';
import { BOATS, type BoatKind } from '../gen/boats';
import { tl, TL } from '../i18n';

/** The kinds of use, in the order the tooltip lists them. */
export const USE_GROUPS = [tl('Blacksmith makes'), tl('Processed into'), tl('Cooked into'), tl('Fuel for'), tl('Building'), tl('Repairs'), tl('Restoring'), tl('The Chariot'), tl('Other')] as const;
export type UseGroup = typeof USE_GROUPS[number];
let index: Map<ItemKey, Map<UseGroup, string[]>> | null = null;
const N = (k: ItemKey) => ITEMS[k]?.name ?? k;

function build(): Map<ItemKey, Map<UseGroup, string[]>> {
  const m = new Map<ItemKey, Map<UseGroup, string[]>>();
  const use = (k: ItemKey, g: UseGroup, what: string) => {
    const gs = m.get(k) ?? new Map<UseGroup, string[]>(), a = gs.get(g) ?? [];
    if (!a.includes(what)) a.push(what);
    gs.set(g, a); m.set(k, gs);
  };
  for (const o of ORDERS) if (roundsInUse(o.out)) for (const [i] of o.needs) use(i, tl('Blacksmith makes'), N(o.out));
  use('log', tl('Other'), tl('sawn into 4 Planks by hand, slowly (a Saw in your kit: the backpack\'s Saw into planks); a village sawmill gets 6 to 8')); // world/sawing.ts
  for (const g of GARAGE) for (const [i] of g.needs) use(i, tl('Other'), tl('the mechanic: ') + (g.car ? vehicleTitle(g.car) : N(g.out!)));
  for (const k of Object.keys(PLANTS) as PlantKind[]) for (const r of PLANTS[k].recipes) for (const [i] of r.in) use(i, tl('Processed into'), `${N(r.out[0])} (${PLANTS[k].name})`);
  for (const k of Object.keys(INSTALL_WORK) as InstallKind[]) for (const w of installWorks(k)) for (const [i] of w.inp) use(i, tl('Processed into'), `${N(w.out)} (${INSTALLS.find((s) => s.k === k)!.name})`);
  for (const d of MENU) for (const i of d.from) use(i, tl('Cooked into'), N(d.k));
  for (const k of Object.keys(STATIONS) as StationKind[]) { const s = STATIONS[k]; if (s.fuel) use(s.fuel, tl('Fuel for'), s.name); }
  FORTIFY.forEach((f, i) => { for (const [k] of f.needs) use(k, tl('Building'), WALL_TIERS[i + 1].name); });
  for (const k of Object.keys(WORKS) as WorkKind[]) for (const [i] of WORKS[k].needs) use(i, tl('Building'), WORKS[k].name);
  for (const k of Object.keys(PLANTS) as PlantKind[]) for (const [i] of PLANTS[k].needs) use(i, tl('Building'), PLANTS[k].name);
  for (const k of Object.keys(STATIONS) as StationKind[]) for (const [i] of STATIONS[k].needs) use(i, tl('Building'), STATIONS[k].name);
  for (const [i] of INDUSTRY.refinery.build ?? []) use(i, tl('Building'), tl('Village refinery'));
  for (const [i] of FARM.needs) use(i, tl('Building'), tl('Farm'));
  for (const d of Object.values(DIG)) for (const [i] of d.needs) use(i, tl('Building'), TL`Outposts: ${d.name}`); // (0.183)
  for (const [i] of STORE.needs) use(i, tl('Building'), TL`Outposts: ${STORE.name}`);
  for (const b of [BUNKS, FIELD, ...WALL, TURRET]) for (const [i] of b.needs) use(i, tl('Building'), TL`Outposts: ${b.name}`); // (0.185)
  for (const [i] of PORT.needs) use(i, tl('Building'), TL`Ports: ${PORT.name}`); // (0.216)
  for (const k of Object.keys(FOOD.value) as ItemKey[]) use(k, tl('Other'), tl('Outposts: the settlers\' pantry'));
  use('fuel', tl('Fuel for'), tl('Outposts: convoy trucks on a route')); // (0.187)
  for (const p of new Set(Object.values(PROC))) { if (!p) continue; for (const [i] of p.needs) use(i, tl('Building'), TL`Outposts: ${p.name}`); use(p.inp, tl('Processed into'), TL`Outposts: ${p.name} (${ITEMS[p.out].name})`); } // (0.188)
  for (const q of Object.values(POWER_SRC)) { for (const [i] of q.needs) use(i, tl('Building'), TL`Outposts: ${q.name}`); if (q.fuel) use(q.fuel, tl('Fuel for'), TL`Outposts: ${q.name}`); } // (0.184)
  for (const k of Object.keys(PROJECTS) as Project[]) for (const [i] of PROJECTS[k].needs) use(i, tl('Building'), TL`New settlements: ${PROJECTS[k].name}`); // (0.175: the deep mine's drill rig among them)
  for (const [i] of UPGRADE.needs) use(i, tl('Building'), tl('Steel ploughs'));
  for (const l of PLANT_LEVELS.slice(1)) for (const [i] of l.needs) use(i, tl('Building'), TL`Power plant: ${l.name}`);
  for (const k of IMPROVE_KINDS) for (const [i] of IMPROVE[k].needs) use(i, tl('Building'), TL`Village improvement: ${IMPROVE[k].name}`);
  for (const [i] of RADAR_UP.needs) use(i, tl('Restoring'), tl('Old Radar Station: the sensor array'));
  for (const k of Object.keys(INSTALL_STAGES) as InstallKind[]) for (const st of INSTALL_STAGES[k]) for (const [i] of st.needs) use(i, tl('Restoring'), INSTALLS.find((s) => s.k === k)!.name);
  for (const st of STAGES) for (const [g] of st.needs) use(g as ItemKey, tl('The Chariot'), `${st.name}`);
  for (const p of Object.values(POWER)) for (const [i] of p.fix) use(i, tl('Repairs'), p.name);
  for (const k of Object.keys(INDUSTRY) as Industry[]) for (const [i] of INDUSTRY[k].fix) use(i, tl('Repairs'), INDUSTRY[k].site);
  for (const k of Object.keys(BRIDGE.per) as ItemKey[]) use(k, tl('Building'), tl('Bridge'));
  for (const k of [...Object.keys(PIER.per), ...Object.keys(PIER.fittings)] as ItemKey[]) use(k, tl('Building'), tl('Pier'));
  for (const [k] of LH.needs) use(k, tl('Building'), tl('Lighthouse')); // (0.204)
  for (const k of Object.keys(BOATS) as BoatKind[]) for (const [i] of BOATS[k].needs) use(i, tl('Building'), BOATS[k].name);
  use('fuel', tl('Fuel for'), tl('Motor Boat')); use('fuel', tl('Fuel for'), tl('Scout and Mastodon (20 L a canister)')); use('fuel', tl('Fuel for'), tl('village convoys (a canister per 10 km of road, from the village stores)'));
  for (const h of HALL_SETS) use(h.fuel, tl('Fuel for'), h.fuel === 'nfuel' ? tl('the Old Enrichment Plant\'s own reactor') : tl('the power halls of the old plants'));
  use('filter', tl('Other'), tl('breathing in toxic fog (in a Gas Mask)'));
  for (const g of Object.values(GUNS)) use(g!.ammo, tl('Other'), TL`rounds for the ${g!.name}`);
  use('repairkit', tl('Repairs'), tl('the shared condition of your vehicles in the field'));
  return m;
}
/** What the item is used for, by kind of use (empty when nothing takes it). */
export function usesOf(k: ItemKey): [UseGroup, string[]][] {
  const gs = (index ??= build()).get(k);
  return gs ? USE_GROUPS.filter((g) => gs.has(g)).map((g) => [g, gs.get(g)!]) : [];
}
