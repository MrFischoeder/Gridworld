// (0.254, PLAN_LOTNICTWA.md stage F1) The drone pad's and the cargo drone's numbers (a leaf module, like
// gen/radiomast.ts, so gen/outposts.ts, gen/energy.ts and gen/workforce.ts can read them). The air lines are gen/airlines.ts.
import type { ItemKey } from '../data/items';
import { tl } from '../i18n';

/** A drone pad by a warehouse: `needs`, `hours` to build, `xp`; it draws `kw` and wants one hand (`crew`). */
export const PAD = {
  name: tl('Drone pad'),
  text: tl('A concrete pad with a ring painted on it, a windsock mast and a charging cabinet: cargo drones land and charge here.'),
  needs: [['cement', 6], ['steel', 2], ['cable', 4], ['planks', 6], ['circuit', 2]] as [ItemKey, number][],
  kw: 4, crew: 1, hours: 8, xp: 140,
};
/**
 * A cargo drone on an air line: it flies straight to a warehouse with a pad within `reach` (m) on the same radio
 * network, `cap` crates a flight, `pace` m a game minute at `alt` m over the ground, `load` minutes at each end.
 * It charges at home while the home warehouse works; a storm (`storm`) keeps it down; over dangerous land a flight
 * may be lost (`lose` + `losePer` × the danger half way, at most `loseMax`).
 */
export const DRONE = { reach: 10000, cap: 3, pace: 90, load: 8, alt: 35, storm: 0.45, lose: 0.004, losePer: 0.008, loseMax: 0.08, catchup: 300 };
