export type ItemType = 'relic' | 'cons' | 'key' | 'part' | 'quest' | 'attach' | 'mat' | 'tool';
export interface ItemDef { name: string; ab: string; type: ItemType; desc: string; stack?: number }

export const ITEMS = {
  shield: { name: 'Shield Core', ab: 'SHD', type: 'relic', desc: '+20 max HP' },
  lens: { name: 'Focusing Lens', ab: 'LNS', type: 'relic', desc: '+25% blaster damage' },
  edge: { name: 'Monomolecular Edge', ab: 'EDG', type: 'relic', desc: '+25% blade damage, longer reach' },
  servo: { name: 'Leg Servos', ab: 'SRV', type: 'relic', desc: '+8% movement speed' },
  cell: { name: 'Power Cell', ab: 'CEL', type: 'relic', desc: 'blaster fires 10% faster' },
  medkit: { name: 'Medkit', ab: '+', type: 'cons', desc: 'restores 50 HP (H key)', stack: 5 },
  key: { name: 'Access Key', ab: 'KEY', type: 'key', desc: 'Opens one locked door. Stand at the door and press E.', stack: 9 },
  bread: { name: 'Bread', ab: 'BRD', type: 'cons', desc: 'dense and filling: 1000 kcal, 5 HP', stack: 9 },
  stew: { name: 'Hearty Stew', ab: 'STW', type: 'cons', desc: 'a hot meal: 650 kcal, water +10, 15 HP', stack: 5 },
  flask: { name: 'Empty Flask', ab: 'FLS', type: 'cons', desc: 'fill it at a well or a lake (E at the water)', stack: 3 },
  waterF: { name: 'Flask of Clean Water', ab: 'H2O', type: 'cons', desc: 'clean water: water +40 (the flask is kept)', stack: 3 },
  waterM: { name: 'Flask of Murky Water', ab: 'MRK', type: 'cons', desc: 'swamp water: water +25, but it may turn your stomach', stack: 3 },
  meatR: { name: 'Raw Meat', ab: 'RAW', type: 'cons', desc: 'Bramble meat: 600 kcal, but raw it may make you sick. Roast it at a campfire (E at the fire) or ask Jan', stack: 8 },
  meatC: { name: 'Roasted Meat', ab: 'MEA', type: 'cons', desc: 'light and rich: 750 kcal, 10 HP', stack: 8 },
  cap: { name: 'Nutrient Cap', ab: 'CAP', type: 'cons', desc: 'a pale mushroom cap from a Nutrient Mushroom Cluster: only 45 kcal, water +6. Filling, not nourishing', stack: 10 },
  pod: { name: 'Fruit Pod', ab: 'POD', type: 'cons', desc: 'a juicy pod from an Alien Fruit Pod Tree: 220 kcal, water +18, but heavy in the stomach', stack: 8 },
  ncrys: { name: 'Nutrient Crystal', ab: 'NCR', type: 'cons', desc: 'an edible crystal that grows in the dungeons: 700 kcal in a tiny bite, 10 HP', stack: 6 },
  firekit: { name: 'Fire Kit', ab: 'FIR', type: 'cons', desc: 'lights a campfire at your feet (outdoors); press E at the fire to roast your raw meat', stack: 5 },
  log: { name: 'Log', ab: 'LOG', type: 'mat', desc: 'a length of wood, chopped from a tree with a Hatchet. For crafting', stack: 10 },
  stone: { name: 'Stone', ab: 'STN', type: 'mat', desc: 'a chunk of rock, broken off with a Pickaxe. For crafting', stack: 10 },
  scrap: { name: 'Scrap Metal', ab: 'SCR', type: 'mat', desc: 'twisted machine parts from drones, bandits and wrecks. For crafting', stack: 10 },
  circuit: { name: 'Electronic Components', ab: 'ELC', type: 'mat', desc: 'circuit boards, sensors and wiring salvaged from robots. For crafting', stack: 10 },
  pcore: { name: 'Power Core', ab: 'PWR', type: 'mat', desc: 'a still-humming energy core from a heavy robot. Rare; for crafting', stack: 5 },
  hatchet: { name: 'Hatchet', ab: 'HAT', type: 'tool', desc: 'tool: carry it and press E at a tree to chop it (a few blows fell it; logs drop)', stack: 1 },
  pickaxe: { name: 'Pickaxe', ab: 'PIK', type: 'tool', desc: 'tool: carry it and press E at a rock to break stone off it', stack: 1 },
  compass: { name: 'Compass', ab: 'CMP', type: 'tool', desc: 'carry it and a compass strip shows your heading at the top of the screen, with the way to the nearest village', stack: 1 },
  benchkit: { name: 'Workbench Kit', ab: 'WBK', type: 'cons', desc: 'a folding workbench: use it to set it up in front of you, then E at it to craft anywhere', stack: 1 },
  hide: { name: 'Ravager Hide', ab: 'HID', type: 'mat', desc: 'a tough, spotted hide. Crafting material; Radek buys it', stack: 10 },
  fang: { name: 'Ravager Fang', ab: 'FNG', type: 'mat', desc: 'a hooked fang. Crafting material; Radek buys it', stack: 10 },
  plate: { name: 'Bramble Plate', ab: 'PLT', type: 'mat', desc: 'a thorny armour plate from a Bramble. Crafting material; Radek buys it', stack: 10 },
  membrane: { name: 'Leechwing Membrane', ab: 'MEM', type: 'mat', desc: 'a thin, strong wing membrane. Crafting material; Radek buys it', stack: 10 },
  incisor: { name: 'Gnawer Incisor', ab: 'INC', type: 'mat', desc: 'a long, sharp rodent tooth. Crafting material; Radek buys it', stack: 10 },
  recall: { name: 'Recall Beacon', ab: 'RCL', type: 'cons', desc: 'returns you to the village from anywhere', stack: 5 },
  emp: { name: 'EMP Charge', ab: 'EMP', type: 'cons', desc: 'damages every drone within 6 m (G key)', stack: 5 },
  book: { name: 'Ancient Book', ab: 'BOK', type: 'quest', desc: 'a crumbling book of the old machine folk; Elder Bogdan wants it', stack: 1 },
  gearbox: { name: 'Precision Gearbox', ab: 'GBX', type: 'quest', desc: 'a rare pre-war part; Radek the blacksmith wants it', stack: 1 },
  datacore: { name: 'Data Core', ab: 'COR', type: 'quest', desc: 'a sealed memory core; Zofia at the store wants it', stack: 1 },
  logbook: { name: "Driver's Logbook", ab: 'LOG', type: 'quest', desc: 'a battered logbook from a wreck; Mirek the dealer wants it', stack: 1 },
  wheelL: { name: 'Light Tire', ab: 'TIR', type: 'part', desc: 'tire for the RTV-1 Scout; drag it onto a wheel slot in the vehicle service (E at the front)', stack: 4 },
  wheelH: { name: 'Heavy Tire', ab: 'HTR', type: 'part', desc: 'tire for the HTV-6 Mastodon; drag it onto a wheel slot in the vehicle service (E at the front)', stack: 2 },
  engine: { name: 'Engine Parts', ab: 'ENG', type: 'part', desc: 'repairs a vehicle engine by 50% (drop it on the engine slot)', stack: 5 },
  turbo: { name: 'Turbocharger', ab: 'TRB', type: 'part', desc: 'engine upgrade: +15% top speed, +30% acceleration', stack: 1 },
  eguard: { name: 'Engine Guard', ab: 'EGD', type: 'part', desc: 'engine upgrade: armour plate that halves engine damage', stack: 1 },
  plating: { name: 'Hull Plating', ab: 'HUL', type: 'part', desc: 'armour plates that patch 40% of a vehicle hull (fit them at the front of the vehicle)', stack: 5 },
  cannon: { name: 'Vehicle Cannon', ab: 'CAN', type: 'part', desc: 'roof-mounted gun for any vehicle; fire with the attack button while driving', stack: 1 },
  reflex: { name: 'Reflex Sight', ab: 'RFX', type: 'attach', desc: 'optic: 1.6× zoom when aiming, +10 m range', stack: 1 },
  scope: { name: 'Long Scope', ab: 'SCP', type: 'attach', desc: 'optic: 3.5× zoom when aiming, +50 m range', stack: 1 },
  barL: { name: 'Long Barrel', ab: 'LBR', type: 'attach', desc: 'barrel: +25% damage, +20 m range, 10% slower fire', stack: 1 },
  barR: { name: 'Rapid Barrel', ab: 'RBR', type: 'attach', desc: 'barrel: fires 25% faster, -10% damage', stack: 1 },
  barS: { name: 'Suppressor', ab: 'SUP', type: 'attach', desc: 'barrel: shots are heard 78% less far, -5% damage, -5 m range', stack: 1 },
  magX: { name: 'Extended Magazine', ab: 'EXM', type: 'attach', desc: 'magazine: +60% capacity', stack: 1 },
  magD: { name: 'Drum Magazine', ab: 'DRM', type: 'attach', desc: 'magazine: +150% capacity, reloads 40% slower', stack: 1 },
} satisfies Record<string, ItemDef>;

export type ItemKey = keyof typeof ITEMS;
export const item = (k: ItemKey): ItemDef => ITEMS[k];
export const RELIC_KEYS = (Object.keys(ITEMS) as ItemKey[]).filter((k) => item(k).type === 'relic');
export const INV_SIZE = 12, MOD_SIZE = 3;

/**
 * Weight (kg) and bulk (litres) of one item. Bulk has to fit in the backpack (PACK.vol); weight only slows you down.
 * Equipped relics and fitted attachments are part of your kit and weigh nothing here.
 */
export const BULK: Record<ItemKey, [kg: number, litres: number]> = {
  shield: [1.5, 1], lens: [0.3, 0.3], edge: [0.5, 0.5], servo: [2, 2], cell: [1, 0.5],
  medkit: [0.5, 1], key: [0.05, 0.05], recall: [0.4, 0.3], emp: [0.8, 0.6], flask: [0.3, 0.8], firekit: [1, 1.5],
  bread: [0.4, 1], stew: [0.6, 0.8], waterF: [1, 0.8], waterM: [1, 0.8],
  meatR: [0.5, 0.6], meatC: [0.35, 0.5], cap: [0.15, 0.4], pod: [0.5, 0.8], ncrys: [0.15, 0.2],
  log: [4, 6], stone: [3, 2], scrap: [1.5, 1.5], circuit: [0.3, 0.4], pcore: [2, 1], hatchet: [1.5, 2], pickaxe: [2.5, 3], compass: [0.2, 0.1], benchkit: [15, 20],
  hide: [2, 3], fang: [0.1, 0.1], plate: [3, 2.5], membrane: [0.3, 1], incisor: [0.05, 0.05],
  book: [1, 1], gearbox: [4, 2], datacore: [1, 0.5], logbook: [0.5, 0.5],
  wheelL: [12, 22], wheelH: [28, 36], engine: [8, 6], turbo: [6, 5], eguard: [5, 4], plating: [7, 5], cannon: [25, 30],
  reflex: [0.3, 0.3], scope: [0.8, 1], barL: [1.2, 1], barR: [1, 0.8], barS: [0.9, 0.8], magX: [0.5, 0.4], magD: [1.2, 1],
};
/** The backpack: how much fits (litres), the load you carry easily, and beyond `max` you are overloaded (kg). */
export const PACK = { vol: 40, comfy: 20, max: 35 };
/** What Mirek charges for vehicle parts. He buys them back for only a fifth of that. */
export const PART_PRICE: Partial<Record<ItemKey, number>> = { wheelL: 40, wheelH: 90, engine: 70, plating: 60, turbo: 220, eguard: 150, cannon: 400 };
export const PART_BUYBACK = 0.2;
export const HEAL: Partial<Record<ItemKey, number>> = { medkit: 50 };
/** Weapon attachments and what Radek the blacksmith charges for them. */
export const ATTACH_PRICE: Partial<Record<ItemKey, number>> = { reflex: 80, scope: 180, barL: 140, barR: 160, barS: 150, magX: 90, magD: 200 };
export const ATTACH_KEYS = Object.keys(ATTACH_PRICE) as ItemKey[];
