// Where an item stands in the economy (the owner's industry document, point 9): raw resources, food and farm crops,
// materials, industrial components, electrical and electronic parts, advanced parts, aerospace parts. Pure; shown in
// the item tooltip (ui/itemtip.ts) and SUROWCE.md. Items outside the economy (weapons, gear, dishes...) have none.
import { ITEMS, type ItemKey } from './items';
import { GOOD_INFO, type Good } from '../gen/market';
import { isRare } from '../gen/deposits';

export type ItemClass = 'raw' | 'food' | 'material' | 'industrial' | 'electrical' | 'advanced' | 'aerospace';
export const CLASS_NAME: Record<ItemClass, string> = { raw: 'Raw resource', food: 'Food & farm crop', material: 'Material', industrial: 'Industrial component', electrical: 'Electrical & electronic', advanced: 'Advanced component', aerospace: 'Aerospace component' };
const SETS: [ItemClass, string[]][] = [
  ['food', ['grain', 'carrots', 'potatoes', 'fish', 'eggs', 'milk', 'meat', 'fibre', 'wool', 'cotton']],
  ['industrial', ['parts', 'tools', 'motor', 'pump', 'gears', 'pipes', 'engine', 'plating', 'drillrig']],
  ['electrical', ['cable', 'boards', 'circuit', 'batteries', 'generator', 'powercell', 'wire', 'control', 'hpe', 'pcm']],
  ['advanced', ['microchip', 'sensor', 'precision', 'automation', 'pcore', 'ancalloy', 'ceramics', 'alloy', 'optics', 'computer']],
  ['aerospace', ['aerocomp', 'avionics', 'lifesup', 'rocketeng']],
  ['material', ['steel', 'copperbar', 'plastic', 'glass', 'iron', 'bricks', 'cement', 'chems', 'aluminium', 'leadbar', 'silicon', 'composite', 'lumber', 'cloth', 'fuel', 'propellant', 'nfuel', 'planks', 'nails', 'rope', 'scrap', 'meds', 'tech']],
  ['raw', ['log', 'stone', 'ironO', 'copperO', 'hide', 'fang', 'plate', 'membrane', 'incisor']],
];
const BY = new Map<string, ItemClass>(SETS.flatMap(([c, ks]) => ks.map((k) => [k, c] as [string, ItemClass])));
export function classOf(k: ItemKey): ItemClass | null {
  const c = BY.get(k);
  if (c) return c;
  if (isRare(k)) return 'raw';
  const g = GOOD_INFO[k as Good];
  if (g) return g.raw ? 'raw' : 'material';
  return ITEMS[k]?.type === 'good' || ITEMS[k]?.type === 'mat' ? 'material' : null;
}
