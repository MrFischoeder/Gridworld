// (0.251, PLAN_MAGAZYNOW.md stage M3) The radio mast's numbers (a leaf module, so gen/outposts.ts, gen/energy.ts and
// gen/workforce.ts can read them without going round gen/warehouses.ts). The network itself is gen/radio.ts.
import type { ItemKey } from '../data/items';
import { tl } from '../i18n';

/**
 * A radio mast on a warehouse's roof: `needs`, `hours` to build, `xp`. Masts within `reach` of each other link
 * (and on through each other); a linked warehouse shows its stock to the others. It draws `kw` and wants an operator
 * (`crew`): a village's from its people (gen/workforce.ts), a port's or a wild warehouse's from the warehouse's crew.
 */
export const RADIO = {
  name: tl('Radio mast'),
  text: tl('A lattice mast with a dish on the warehouse\'s roof and a radio set by its terminal: linked warehouses read each other\'s stock.'),
  needs: [['planks', 10], ['wire', 12], ['scrap', 10], ['circuit', 4], ['cable', 2]] as [ItemKey, number][],
  reach: 12000, kw: 2, crew: 1, hours: 6, xp: 120,
};
