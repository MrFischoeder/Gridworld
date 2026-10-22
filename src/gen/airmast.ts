// (0.256, PLAN_LOTNICTWA.md stage F3) The mooring mast's and the airship's numbers (a leaf module, like gen/dronepad.ts,
// so gen/outposts.ts, gen/grid.ts, gen/energy.ts and gen/workforce.ts can read them). The rules are gen/airships.ts.
import type { ItemKey } from '../data/items';
import { tl } from '../i18n';

/** A mooring mast by a warehouse: `needs`, `hours` to build, `xp`; it draws `kw` and wants one hand (`crew`); its head stands `h` m up. */
export const AIRMAST = {
  name: tl('Mooring mast'),
  text: tl('A braced steel mast with a turning cap at its head: an airship ties its nose to it, rides out the wind round it, takes on cargo and, if it runs on cells, charges there.'),
  needs: [['steel', 10], ['cable', 6], ['cement', 8], ['planks', 10], ['motor', 1]] as [ItemKey, number][],
  kw: 6, crew: 1, hours: 10, xp: 180, h: 9,
  /** (0.257) A village's mast is staked out within `near` m of its warehouse; the ground under its moored airship (`clear` m either side) rises at most `rise` m over its foot. */
  near: 150, clear: 6, rise: 1.5,
};
export type AirDrive = 'fuel' | 'cell';
/**
 * The airship: an envelope `len` m long and `r` m round, the gondola's bottom `below` m under its middle (`gond` its
 * length, width and height); `speed` m/s by its drive, astern `back`, `climb` m/s up or down, `turn` rad/s; its
 * gondola keeps `min` m over the ground or the sea and its middle at most `ceil` m over the sea's level. The wind
 * pushes it at `wind` of its speed. `hold` slots, `seats` aboard, at most `max` on a world. Diesel: a `tank` of litres
 * burnt at `burn` L/s at full throttle; cells: `cap` kWh, `burn` kWh/s at full and `idle` kWh/s for the systems,
 * charged at `charge` kWh a second (a game minute) moored at a working mast. Built at a mast from the base `needs` and
 * those of its drive.
 */
export const AIRSHIP = {
  name: tl('Airship'), len: 36, r: 5.5, below: 9, gond: { len: 9, w: 3.2, h: 3.4 },
  speed: { fuel: 15, cell: 12 } as Record<AirDrive, number>, back: 0.35, climb: 3, turn: 0.3,
  min: 1.2, ceil: 320, wind: 0.25, hold: 30, seats: 4, max: 4, xp: 400,
  /** (0.257) The rope ladder: it hangs from the gondola's door while the airship hovers (slower than `slow` m/s) with its floor at most `ladder` m over dry ground; climbed at `climbs` m/s. The door is open `door` m either side of the middle. */
  ladder: 40, slow: 1.5, climbs: 2.2, door: 0.8,
  fuel: { tank: 300, burn: 0.06, can: 20 }, cell: { cap: 200, burn: 0.07, idle: 0.004, charge: 0.5 },
  needs: [['cloth', 30], ['aluminium', 12], ['chems', 6], ['cable', 6], ['control', 1], ['motor', 2], ['planks', 8]] as [ItemKey, number][],
  drive: { fuel: [['engine', 4], ['steel', 4]], cell: [['powercell', 4], ['batteries', 4]] } as Record<AirDrive, [ItemKey, number][]>,
};
