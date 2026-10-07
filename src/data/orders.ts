// What the village craftsmen make for you once you have recovered the plans (gen/tech.ts). Not crafting of your own:
// you bring the materials, the blacksmith knows the work only if the technology is yours. Pure data and rules.
import type { ItemKey } from './items';
import { craft, count, type Recipe } from './crafting';
import type { Slot } from '../save';

/** An order: the technology it needs ('' = none, a basic), what comes out, and what you hand over. */
export interface Order { tech: string; out: ItemKey; n: number; needs: [ItemKey, number][] }
export const ORDERS: Order[] = [
  // the basics every smith knows without any plans ('' = no technology), so nobody is stuck without tools
  { tech: '', out: 'hatchet', n: 1, needs: [['log', 1], ['stone', 2]] },
  { tech: '', out: 'pickaxe', n: 1, needs: [['log', 1], ['stone', 3]] },
  { tech: '', out: 'firekit', n: 1, needs: [['log', 2]] },
  { tech: '', out: 'flask', n: 1, needs: [['hide', 1]] },
  // (0.165) a saw with no plans: logs are only raw timber, every building wants planks (world/sawing.ts)
  { tech: '', out: 'saw', n: 1, needs: [['log', 1], ['stone', 2]] },
  { tech: 'forging', out: 'hammer', n: 1, needs: [['planks', 1], ['scrap', 2]] },
  { tech: 'forging', out: 'screwdriver', n: 1, needs: [['scrap', 1], ['planks', 1]] },
  { tech: 'forging', out: 'pliers', n: 1, needs: [['scrap', 2]] },
  { tech: 'framing', out: 'planks', n: 6, needs: [['log', 2]] },
  { tech: 'framing', out: 'nails', n: 10, needs: [['scrap', 1]] },
  { tech: 'furnace', out: 'scrap', n: 3, needs: [['ironO', 2], ['log', 1]] },
  { tech: 'furnace', out: 'wire', n: 8, needs: [['iron', 1]] }, // (0.173) drawn from a crate of iron bars, not from ore
  { tech: 'circuits', out: 'circuit', n: 1, needs: [['copperO', 2], ['scrap', 1]] },
  { tech: 'circuits', out: 'compass', n: 1, needs: [['scrap', 1], ['circuit', 1]] },
  { tech: 'wagons', out: 'wheelL', n: 1, needs: [['planks', 4], ['scrap', 2]] },
  { tech: 'wagons', out: 'plating', n: 1, needs: [['scrap', 3], ['planks', 4]] },
  { tech: 'engines', out: 'engine', n: 1, needs: [['scrap', 4], ['circuit', 1]] },
  { tech: 'filters', out: 'gasmask', n: 1, needs: [['hide', 2], ['membrane', 1], ['scrap', 2]] },
  { tech: 'filters', out: 'filter', n: 2, needs: [['log', 2], ['scrap', 1]] },
  { tech: 'engines', out: 'turbo', n: 1, needs: [['scrap', 6], ['circuit', 3], ['pcore', 1]] },
  // the components of the old plants (economy stage 6)
  { tech: 'precision', out: 'drivetrain', n: 1, needs: [['precision', 2], ['parts', 2], ['alloy', 1]] },
  { tech: 'sensors', out: 'scanner', n: 1, needs: [['sensor', 1], ['circuit', 2], ['scrap', 1], ['pgm', 1], ['optics', 1]] },
  // arms and rounds: at first only found (chests, stashes, the fallen), made once the plans are yours
  { tech: 'gunsmith', out: 'ammo9', n: 30, needs: [['leadbar', 1], ['chems', 1], ['scrap', 1]] },
  { tech: 'gunsmith', out: 'ammoS', n: 16, needs: [['leadbar', 1], ['chems', 1], ['scrap', 1]] },
  { tech: 'gunsmith', out: 'ammoR', n: 20, needs: [['leadbar', 1], ['chems', 1], ['steel', 1]] },
  { tech: 'gunsmith', out: 'pistol', n: 1, needs: [['steel', 2], ['scrap', 3]] },
  { tech: 'gunsmith', out: 'smg', n: 1, needs: [['steel', 2], ['scrap', 6], ['wire', 2]] },
  { tech: 'gunsmith', out: 'shotgun', n: 1, needs: [['steel', 3], ['lumber', 1], ['scrap', 2]] },
  { tech: 'gunsmith', out: 'rifle', n: 1, needs: [['steel', 3], ['lumber', 1], ['glass', 1], ['scrap', 2]] },
  { tech: 'batteries', out: 'ammoE', n: 40, needs: [['batteries', 1], ['circuit', 1]] },
  { tech: 'forging', out: 'machete', n: 1, needs: [['scrap', 3], ['hide', 1]] },
  { tech: 'forging', out: 'spear', n: 1, needs: [['planks', 2], ['scrap', 2]] },
  { tech: 'forging', out: 'sledge', n: 1, needs: [['planks', 1], ['scrap', 5]] },
  { tech: 'radio', out: 'tablet', n: 1, needs: [['circuit', 3], ['glass', 1], ['batteries', 1], ['pcore', 1]] },
  { tech: 'engines', out: 'repairkit', n: 1, needs: [['scrap', 4], ['wire', 2], ['circuit', 1], ['rope', 1]] },
  // armour in three kinds (hide for anyone, woven and composite with the plans), bigger packs and exoskeletons
  { tech: '', out: 'hideCap', n: 1, needs: [['hide', 1]] },
  { tech: '', out: 'hideCoat', n: 1, needs: [['hide', 3], ['rope', 1]] },
  { tech: '', out: 'hideGloves', n: 1, needs: [['hide', 1]] },
  { tech: '', out: 'hideLegs', n: 1, needs: [['hide', 2]] },
  { tech: '', out: 'hideBoots', n: 1, needs: [['hide', 2]] },
  { tech: '', out: 'rucksack', n: 1, needs: [['hide', 3], ['rope', 2], ['planks', 2]] },
  { tech: 'weaving', out: 'wovenHood', n: 1, needs: [['cloth', 1], ['wire', 1]] },
  { tech: 'weaving', out: 'wovenJacket', n: 1, needs: [['cloth', 3], ['wire', 3], ['hide', 1]] },
  { tech: 'weaving', out: 'wovenGloves', n: 1, needs: [['cloth', 1], ['wire', 1]] },
  { tech: 'weaving', out: 'wovenLegs', n: 1, needs: [['cloth', 2], ['wire', 2]] },
  { tech: 'weaving', out: 'wovenBoots', n: 1, needs: [['cloth', 1], ['hide', 1], ['wire', 1]] },
  { tech: 'weaving', out: 'framepack', n: 1, needs: [['cloth', 2], ['aluminium', 1], ['rope', 2]] },
  { tech: 'composites', out: 'compHelm', n: 1, needs: [['plastic', 1], ['alloy', 1], ['cloth', 1]] },
  { tech: 'composites', out: 'compVest', n: 1, needs: [['plastic', 2], ['alloy', 2], ['cloth', 2], ['ceramics', 1], ['composite', 1]] },
  { tech: 'composites', out: 'compGloves', n: 1, needs: [['plastic', 1], ['cloth', 1]] },
  { tech: 'composites', out: 'compLegs', n: 1, needs: [['plastic', 1], ['alloy', 1], ['cloth', 1]] },
  { tech: 'composites', out: 'compBoots', n: 1, needs: [['plastic', 1], ['alloy', 1], ['hide', 1]] },
  { tech: 'composites', out: 'cargopack', n: 1, needs: [['plastic', 2], ['alloy', 1], ['cloth', 2]] },
  { tech: 'exoframe', out: 'exoL', n: 1, needs: [['steel', 3], ['parts', 2], ['wire', 4], ['hide', 2]] },
  { tech: 'automation', out: 'exoH', n: 1, needs: [['ancalloy', 2], ['precision', 2], ['powercell', 2], ['automation', 1], ['cable', 4], ['titanium', 2], ['advsteel', 2], ['pcm', 1]] },
];
/** Technologies that are for the villages themselves (farms, power, works), not for the craftsmen's bench. */
export const VILLAGE_TECHS = ['fields', 'plough', 'rotor', 'solar', 'chips', 'radio', 'chemistry', 'enrichment', 'propellant', 'rail', 'aluminium', 'batteries', 'alloys', 'powercells', 'sensors', 'ancmetal', 'precision', 'automation', 'electricity', 'metallurgy', 'semiconductors', 'computing', 'aerospace', 'powergrid', 'avionics', 'lifesupport', 'rocketry'];

/** The smith knows the work: a basic, or the technology is yours. */
export const known = (o: Order, tech: Record<string, number>) => !o.tech || tech[o.tech] !== undefined;
/** Can it be ordered: 'plans' (the technology is not yours), 'missing' (not all materials with you), or ''. */
export function orderState(o: Order, tech: Record<string, number>, inv: (Slot | null)[]): '' | 'plans' | 'missing' {
  if (!known(o, tech)) return 'plans';
  return o.needs.every(([k, n]) => count(inv, k) >= n) ? '' : 'missing';
}
/** Hands the materials over and takes the work: '' when done, else why not (as `craft`). */
export function placeOrder(o: Order, tech: Record<string, number>, inv: (Slot | null)[], cap: number, hands: (Slot | null)[]): '' | 'plans' | 'missing' | 'room' | 'hands' {
  if (!known(o, tech)) return 'plans';
  const r: Recipe = { out: o.out, n: o.n, needs: o.needs, at: 'forge' };
  return craft(inv, r, cap, hands);
}
