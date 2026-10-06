// The mechanic's workshop (the owner's document 04, "Exploration, the mechanic, vehicles and satellites"): Kuba builds
// a vehicle out of salvage you store in the village hall (scrap, machine parts, gears, engine parts, electronic
// components: early on nobody makes these, they come out of wrecks, ruins and robots), and Vehicle Repair Kits. Every
// job takes game hours: order it, go about your business, come back to collect it (`char.garage`, yours alone).
import type { ItemKey } from './items';
import type { VehicleModel } from './vehicles';

export interface GarageJob {
  /** A vehicle (parked in the yard when collected) or an item. */
  car?: VehicleModel; out?: ItemKey; n: number;
  needs: [ItemKey, number][];
  /** Game hours the work takes. */
  hours: number;
  blurb: string;
}
export const GARAGE: GarageJob[] = [
  { car: 'scout', n: 1, hours: 8, needs: [['scrap', 24], ['parts', 4], ['gears', 4], ['engine', 2], ['circuit', 3]], blurb: 'a light four-seater from salvage: a scrap frame, a rebuilt engine, a gearbox of found gears and wiring from old electronics' },
  { car: 'mastodon', n: 1, hours: 14, needs: [['scrap', 40], ['parts', 8], ['gears', 6], ['engine', 4], ['circuit', 5], ['steel', 6]], blurb: 'a heavy truck with a closed cab: twice the engine, a steel chassis and a big trunk' },
  { out: 'repairkit', n: 2, hours: 2, needs: [['scrap', 4], ['parts', 1], ['circuit', 1]], blurb: 'patches, clamps and spare wiring to mend a vehicle in the field' },
];
/** At most this many jobs at the workshop at once. */
export const GARAGE_MAX = 2;
