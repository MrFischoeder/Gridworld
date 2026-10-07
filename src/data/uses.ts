// Where each item is used, straight from the game's data (the same index as SUROWCE.md, in English): the item
// tooltip (ui/itemtip.ts) lists it under "Used for". Pure; built once on first use.
import { ITEMS, type ItemKey } from './items';
import { ORDERS } from './orders';
import { GARAGE } from './garage';
import { vehicleTitle } from './vehicles';
import { GUNS } from './weapons';
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
import { BOATS, type BoatKind } from '../gen/boats';

/** The kinds of use, in the order the tooltip lists them. */
export const USE_GROUPS = ['Blacksmith makes', 'Processed into', 'Cooked into', 'Fuel for', 'Building', 'Repairs', 'Restoring', 'The Chariot', 'Other'] as const;
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
  for (const o of ORDERS) for (const [i] of o.needs) use(i, 'Blacksmith makes', N(o.out));
  use('log', 'Other', 'sawn into 4 Planks by hand, slowly (a Saw in your kit: the backpack\'s Saw into planks); a village sawmill gets 6 to 8'); // world/sawing.ts
  for (const g of GARAGE) for (const [i] of g.needs) use(i, 'Other', 'the mechanic: ' + (g.car ? vehicleTitle(g.car) : N(g.out!)));
  for (const k of Object.keys(PLANTS) as PlantKind[]) for (const r of PLANTS[k].recipes) for (const [i] of r.in) use(i, 'Processed into', `${N(r.out[0])} (${PLANTS[k].name})`);
  for (const k of Object.keys(INSTALL_WORK) as InstallKind[]) for (const w of installWorks(k)) for (const [i] of w.inp) use(i, 'Processed into', `${N(w.out)} (${INSTALLS.find((s) => s.k === k)!.name})`);
  for (const d of MENU) for (const i of d.from) use(i, 'Cooked into', N(d.k));
  for (const k of Object.keys(STATIONS) as StationKind[]) { const s = STATIONS[k]; if (s.fuel) use(s.fuel, 'Fuel for', s.name); }
  FORTIFY.forEach((f, i) => { for (const [k] of f.needs) use(k, 'Building', WALL_TIERS[i + 1].name); });
  for (const k of Object.keys(WORKS) as WorkKind[]) for (const [i] of WORKS[k].needs) use(i, 'Building', WORKS[k].name);
  for (const k of Object.keys(PLANTS) as PlantKind[]) for (const [i] of PLANTS[k].needs) use(i, 'Building', PLANTS[k].name);
  for (const k of Object.keys(STATIONS) as StationKind[]) for (const [i] of STATIONS[k].needs) use(i, 'Building', STATIONS[k].name);
  for (const [i] of INDUSTRY.refinery.build ?? []) use(i, 'Building', 'Village refinery');
  for (const [i] of FARM.needs) use(i, 'Building', 'Farm');
  for (const [i] of UPGRADE.needs) use(i, 'Building', 'Steel ploughs');
  for (const l of PLANT_LEVELS.slice(1)) for (const [i] of l.needs) use(i, 'Building', `Power plant: ${l.name}`);
  for (const k of IMPROVE_KINDS) for (const [i] of IMPROVE[k].needs) use(i, 'Building', `Village improvement: ${IMPROVE[k].name}`);
  for (const [i] of RADAR_UP.needs) use(i, 'Restoring', 'Old Radar Station: the sensor array');
  for (const k of Object.keys(INSTALL_STAGES) as InstallKind[]) for (const st of INSTALL_STAGES[k]) for (const [i] of st.needs) use(i, 'Restoring', INSTALLS.find((s) => s.k === k)!.name);
  for (const st of STAGES) for (const [g] of st.needs) use(g as ItemKey, 'The Chariot', `${st.name}`);
  for (const p of Object.values(POWER)) for (const [i] of p.fix) use(i, 'Repairs', p.name);
  for (const k of Object.keys(INDUSTRY) as Industry[]) for (const [i] of INDUSTRY[k].fix) use(i, 'Repairs', INDUSTRY[k].site);
  for (const k of Object.keys(BRIDGE.per) as ItemKey[]) use(k, 'Building', 'Bridge');
  for (const k of [...Object.keys(PIER.per), ...Object.keys(PIER.fittings)] as ItemKey[]) use(k, 'Building', 'Pier');
  for (const k of Object.keys(BOATS) as BoatKind[]) for (const [i] of BOATS[k].needs) use(i, 'Building', BOATS[k].name);
  use('fuel', 'Fuel for', 'Motor Boat');
  for (const h of HALL_SETS) use(h.fuel, 'Fuel for', h.fuel === 'nfuel' ? 'the Old Enrichment Plant\'s own reactor' : 'the power halls of the old plants');
  use('filter', 'Other', 'breathing in toxic fog (in a Gas Mask)');
  for (const g of Object.values(GUNS)) use(g!.ammo, 'Other', `rounds for the ${g!.name}`);
  use('repairkit', 'Repairs', 'the shared condition of your vehicles in the field');
  return m;
}
/** What the item is used for, by kind of use (empty when nothing takes it). */
export function usesOf(k: ItemKey): [UseGroup, string[]][] {
  const gs = (index ??= build()).get(k);
  return gs ? USE_GROUPS.filter((g) => gs.has(g)).map((g) => [g, gs.get(g)!]) : [];
}
