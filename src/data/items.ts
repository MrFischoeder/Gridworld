export type ItemType = 'relic' | 'cons' | 'key' | 'part' | 'quest' | 'attach' | 'mat' | 'tool' | 'weapon' | 'wear' | 'good';
export interface ItemDef { name: string; ab: string; type: ItemType; desc: string; stack?: number }

export const ITEMS = {
  shield: { name: 'Shield Core', ab: 'SHD', type: 'relic', desc: '+20 max HP' },
  lens: { name: 'Focusing Lens', ab: 'LNS', type: 'relic', desc: '+25% blaster damage' },
  edge: { name: 'Monomolecular Edge', ab: 'EDG', type: 'relic', desc: '+25% blade damage, longer reach' },
  servo: { name: 'Leg Servos', ab: 'SRV', type: 'relic', desc: '+8% movement speed' },
  cell: { name: 'Power Cell', ab: 'CEL', type: 'relic', desc: 'blaster fires 10% faster' },
  blaster: { name: 'Blaster', ab: 'BLS', type: 'weapon', desc: 'energy rifle: hold it in your hands to fire, or sling it on your back (keys 1 and 2 draw what is on your back)', stack: 1 },
  blade: { name: 'Energy Blade', ab: 'BLD', type: 'weapon', desc: 'a humming sword: hard hits for stamina. Hold it in your hands to swing it, or carry it on your back', stack: 1 },
  helmet: { name: 'Combat Helmet', ab: 'HLM', type: 'wear', desc: 'head armour: takes 8% off every hit', stack: 1 },
  vest: { name: 'Ballistic Vest', ab: 'VST', type: 'wear', desc: 'body armour, light: takes 15% off every hit', stack: 1 },
  armour: { name: 'Plate Armour', ab: 'ARM', type: 'wear', desc: 'body armour, heavy: takes 25% off every hit, but weighs 12 kg', stack: 1 },
  gloves: { name: 'Work Gloves', ab: 'GLV', type: 'wear', desc: 'tough gloves: take 3% off every hit', stack: 1 },
  trousers: { name: 'Cargo Trousers', ab: 'TRS', type: 'wear', desc: 'reinforced trousers: take 4% off every hit', stack: 1 },
  boots: { name: 'Field Boots', ab: 'BTS', type: 'wear', desc: 'sturdy boots: take 4% off every hit', stack: 1 },
  // trade goods (gen/market.ts): bulky crates, bought cheap where they are made and sold dear where they are wanted
  grain: { name: 'Sack of Grain', ab: 'GRN', type: 'good', desc: 'trade good: fifty kilos of grain. Farming villages sell it cheap', stack: 5 },
  timber: { name: 'Timber Bundle', ab: 'TMB', type: 'good', desc: 'trade good: seasoned beams, bound with rope. Forest villages sell it cheap', stack: 5 },
  ore: { name: 'Crate of Iron Ore', ab: 'IRN', type: 'good', desc: 'trade good: iron ore from a village mine', stack: 5 },
  carrots: { name: 'Sack of Carrots', ab: 'CRT', type: 'good', desc: 'trade good: carrots from the village fields', stack: 5 },
  potatoes: { name: 'Sack of Potatoes', ab: 'POT', type: 'good', desc: 'trade good: potatoes from the village fields', stack: 5 },
  coal: { name: 'Crate of Coal', ab: 'COL', type: 'good', desc: 'trade good: coal from a village mine, for forges and stoves', stack: 5 },
  copper: { name: 'Crate of Copper Ore', ab: 'CPR', type: 'good', desc: 'trade good: copper ore from a village mine, for wiring and electronics', stack: 5 },
  crude: { name: 'Barrel of Crude Oil', ab: 'OIL', type: 'good', desc: 'trade good: crude oil from the oil wells; a refinery turns it into fuel', stack: 5 },
  salt: { name: 'Salt Blocks', ab: 'SLT', type: 'good', desc: 'trade good: pressed salt, for keeping food through the winter', stack: 5 },
  fish: { name: 'Dried Fish', ab: 'FSH', type: 'good', desc: 'trade good: a bale of fish dried on lake shores', stack: 5 },
  cloth: { name: 'Bolt of Cloth', ab: 'CLT', type: 'good', desc: 'trade good: woven cloth, dyed green', stack: 5 },
  tools: { name: 'Crate of Tools', ab: 'TLS', type: 'good', desc: 'trade good: hammers, saws and files from a village forge', stack: 5 },
  meds: { name: 'Medical Supplies', ab: 'MED', type: 'good', desc: 'trade good: bandages, salves and tinctures', stack: 5 },
  fuel: { name: 'Fuel Canister', ab: 'FUL', type: 'good', desc: 'trade good: diesel for the village generators', stack: 5 },
  tech: { name: 'Salvaged Tech', ab: 'TEC', type: 'good', desc: 'trade good: cleaned and tested machine parts from the ruins', stack: 5 },
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
  hammer: { name: 'Hammer', ab: 'HMR', type: 'tool', desc: 'tool: carry it to build in wood (walls, doors, roofs) and to take wooden parts down', stack: 1 },
  saw: { name: 'Saw', ab: 'SAW', type: 'tool', desc: 'tool: cuts logs into planks at a workbench, and planks to size when you build in wood', stack: 1 },
  screwdriver: { name: 'Screwdriver', ab: 'SCD', type: 'tool', desc: 'tool: fits the hinges and locks of doors', stack: 1 },
  pliers: { name: 'Pliers', ab: 'PLR', type: 'tool', desc: 'tool: bends and ties wire when you build in metal', stack: 1 },
  welder: { name: 'Welder', ab: 'WLD', type: 'tool', desc: 'tool: welds scrap into metal walls, doors and roofs. Heavy', stack: 1 },
  torch: { name: 'Acetylene Torch', ab: 'TRC', type: 'tool', desc: 'tool: cuts metal: carry it to take metal parts of a building down', stack: 1 },
  shovel: { name: 'Shovel', ab: 'SHV', type: 'tool', desc: 'tool: for digging and earthworks (foundations and ditches will need it)', stack: 1 },
  planks: { name: 'Planks', ab: 'PLK', type: 'mat', desc: 'sawn boards: a log makes four with a Saw at a workbench. For building', stack: 20 },
  nails: { name: 'Nails', ab: 'NLS', type: 'mat', desc: 'a packet of nails. For building in wood', stack: 20 },
  rope: { name: 'Rope', ab: 'RPE', type: 'mat', desc: 'a coil of strong rope. For building', stack: 5 },
  wire: { name: 'Wire', ab: 'WIR', type: 'mat', desc: 'a coil of steel wire. For building, doors and metalwork', stack: 10 },
  turretkit: { name: 'Auto Turret', ab: 'TUR', type: 'part', desc: 'a turret in a crate: build it on your claim (B, Auto Turret) on the ground, a floor or a roof. It shoots whatever hostile comes in range and sight. E at it switches it on or off', stack: 1 },
  codelock: { name: 'Code Lock', ab: 'LCK', type: 'tool', desc: 'a keypad lock for a door you built: stand at the door and press L, then choose a 4-digit code. Others need the code to open it', stack: 3 },
  compass: { name: 'Compass', ab: 'CMP', type: 'tool', desc: 'carry it and a compass strip shows your heading at the top of the screen, with the way to the nearest village', stack: 1 },
  flagpole: { name: 'Flagpole', ab: 'FLG', type: 'cons', desc: 'claim land for a base: use it to pick a spot (you see how the ground will be levelled), click to raise the flag. The land around it is yours; E at the flag takes it down again', stack: 1 },
  benchkit: { name: 'Workbench Kit', ab: 'WBK', type: 'cons', desc: 'a folding workbench: use it to set it up in front of you, then E at it to craft anywhere', stack: 1 },
  hide: { name: 'Ravager Hide', ab: 'HID', type: 'mat', desc: 'a tough, spotted hide. Crafting material; Oskar buys it', stack: 10 },
  fang: { name: 'Ravager Fang', ab: 'FNG', type: 'mat', desc: 'a hooked fang. Crafting material; Oskar buys it', stack: 10 },
  plate: { name: 'Bramble Plate', ab: 'PLT', type: 'mat', desc: 'a thorny armour plate from a Bramble. Crafting material; Oskar buys it', stack: 10 },
  membrane: { name: 'Leechwing Membrane', ab: 'MEM', type: 'mat', desc: 'a thin, strong wing membrane. Crafting material; Oskar buys it', stack: 10 },
  incisor: { name: 'Gnawer Incisor', ab: 'INC', type: 'mat', desc: 'a long, sharp rodent tooth. Crafting material; Oskar buys it', stack: 10 },
  recall: { name: 'Recall Beacon', ab: 'RCL', type: 'cons', desc: 'returns you to the village from anywhere', stack: 5 },
  emp: { name: 'EMP Charge', ab: 'EMP', type: 'cons', desc: 'damages every drone within 6 m (G key)', stack: 5 },
  book: { name: 'Ancient Book', ab: 'BOK', type: 'quest', desc: 'a crumbling book of the old machine folk; Elder Maciej wants it', stack: 1 },
  gearbox: { name: 'Precision Gearbox', ab: 'GBX', type: 'quest', desc: 'a rare pre-war part; Oskar the blacksmith wants it', stack: 1 },
  datacore: { name: 'Data Core', ab: 'COR', type: 'quest', desc: 'a sealed memory core; Zofia at the store wants it', stack: 1 },
  logbook: { name: "Driver's Logbook", ab: 'LOG', type: 'quest', desc: 'a battered logbook from a wreck; Kuba the dealer wants it', stack: 1 },
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
  blaster: [3.5, 9], blade: [1.5, 4], helmet: [1.5, 5], vest: [4, 10], armour: [12, 18], gloves: [0.3, 0.5], trousers: [0.8, 1.5], boots: [1.2, 3],
  shield: [1.5, 1], lens: [0.3, 0.3], edge: [0.5, 0.5], servo: [2, 2], cell: [1, 0.5],
  medkit: [0.5, 1], key: [0.05, 0.05], recall: [0.4, 0.3], emp: [0.8, 0.6], flask: [0.3, 0.8], firekit: [1, 1.5],
  bread: [0.4, 1], stew: [0.6, 0.8], waterF: [1, 0.8], waterM: [1, 0.8],
  meatR: [0.5, 0.6], meatC: [0.35, 0.5], cap: [0.15, 0.4], pod: [0.5, 0.8], ncrys: [0.15, 0.2],
  log: [4, 6], stone: [3, 2], scrap: [1.5, 1.5], circuit: [0.3, 0.4], pcore: [2, 1], hatchet: [1.5, 2], pickaxe: [2.5, 3], compass: [0.2, 0.1], codelock: [0.6, 0.5], turretkit: [18, 16],
  hammer: [1, 1.5], saw: [1, 2.5], screwdriver: [0.2, 0.2], pliers: [0.3, 0.3], welder: [9, 10], torch: [6, 8], shovel: [2, 4],
  planks: [1.5, 1.5], nails: [0.3, 0.2], rope: [0.8, 1.5], wire: [0.5, 0.5], benchkit: [15, 20], flagpole: [9, 14],
  hide: [2, 3], fang: [0.1, 0.1], plate: [3, 2.5], membrane: [0.3, 1], incisor: [0.05, 0.05],
  book: [1, 1], gearbox: [4, 2], datacore: [1, 0.5], logbook: [0.5, 0.5],
  grain: [12, 14], timber: [16, 20], ore: [18, 10], carrots: [10, 14], potatoes: [12, 14], coal: [16, 10], copper: [18, 10], crude: [16, 14], salt: [10, 7], fish: [7, 10], cloth: [5, 9], tools: [14, 14], meds: [4, 7], fuel: [11, 12], tech: [6, 8],
  wheelL: [12, 22], wheelH: [28, 36], engine: [8, 6], turbo: [6, 5], eguard: [5, 4], plating: [7, 5], cannon: [25, 30],
  reflex: [0.3, 0.3], scope: [0.8, 1], barL: [1.2, 1], barR: [1, 0.8], barS: [0.9, 0.8], magX: [0.5, 0.4], magD: [1.2, 1],
};
/** What you wear, one piece per slot: which slot, and the share of every hit it takes off (pieces multiply). */
export type WearSlot = 'head' | 'body' | 'gloves' | 'legs' | 'feet';
export const WEAR_SLOTS: WearSlot[] = ['head', 'body', 'gloves', 'legs', 'feet'];
export const WEAR_NAME: Record<WearSlot, string> = { head: 'Head', body: 'Body', gloves: 'Gloves', legs: 'Legs', feet: 'Feet' };
export const WEAR: Partial<Record<ItemKey, { slot: WearSlot; def: number }>> = {
  helmet: { slot: 'head', def: 0.08 }, vest: { slot: 'body', def: 0.15 }, armour: { slot: 'body', def: 0.25 },
  gloves: { slot: 'gloves', def: 0.03 }, trousers: { slot: 'legs', def: 0.04 }, boots: { slot: 'feet', def: 0.04 },
};
/** Weapons in the hands: which one it is for world/weapons.ts (0 = gun, 1 = blade). Only weapons go on your back. */
export const WEAPON_KIND: Partial<Record<ItemKey, 0 | 1>> = { blaster: 0, blade: 1 };
/** Too big or awkward for the backpack: carried in your hands (and then you cannot hold a weapon). */
export const HANDS_ONLY = new Set<ItemKey>(['wheelL', 'wheelH', 'cannon', 'benchkit', 'flagpole']);
/** Weapons and gear Oskar sells. */
/** Tools and building supplies: what Oskar (tools) and Zofia (supplies) charge. */
export const TOOL_PRICE: Partial<Record<ItemKey, number>> = { hammer: 20, saw: 35, screwdriver: 10, pliers: 12, welder: 200, torch: 160, shovel: 25, turretkit: 350 };
export const SUPPLY_PRICE: Partial<Record<ItemKey, number>> = { nails: 3, rope: 6, wire: 5, codelock: 120 };
export const GEAR_PRICE: Partial<Record<ItemKey, number>> = { blaster: 150, blade: 80, helmet: 60, vest: 120, armour: 260, gloves: 20, trousers: 30, boots: 40 };
/** The backpack: how much fits (litres), the load you carry easily, and beyond `max` you are overloaded (kg). */
export const PACK = { vol: 40, comfy: 20, max: 35 };
/** What Kuba charges for vehicle parts. He buys them back for only a fifth of that. */
export const PART_PRICE: Partial<Record<ItemKey, number>> = { wheelL: 40, wheelH: 90, engine: 70, plating: 60, turbo: 220, eguard: 150, cannon: 400 };
export const PART_BUYBACK = 0.2;
export const HEAL: Partial<Record<ItemKey, number>> = { medkit: 50 };
/** Weapon attachments and what Oskar the blacksmith charges for them. */
export const ATTACH_PRICE: Partial<Record<ItemKey, number>> = { reflex: 80, scope: 180, barL: 140, barR: 160, barS: 150, magX: 90, magD: 200 };
export const ATTACH_KEYS = Object.keys(ATTACH_PRICE) as ItemKey[];
