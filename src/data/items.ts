export type ItemType = 'relic' | 'cons' | 'key' | 'part' | 'quest' | 'attach';
export interface ItemDef { name: string; ab: string; type: ItemType; desc: string; stack?: number }

export const ITEMS = {
  shield: { name: 'Shield Core', ab: 'SHD', type: 'relic', desc: '+20 max HP' },
  lens: { name: 'Focusing Lens', ab: 'LNS', type: 'relic', desc: '+25% blaster damage' },
  edge: { name: 'Monomolecular Edge', ab: 'EDG', type: 'relic', desc: '+25% blade damage, longer reach' },
  servo: { name: 'Leg Servos', ab: 'SRV', type: 'relic', desc: '+8% movement speed' },
  cell: { name: 'Power Cell', ab: 'CEL', type: 'relic', desc: 'blaster fires 10% faster' },
  medkit: { name: 'Medkit', ab: '+', type: 'cons', desc: 'restores 50 HP (H key)', stack: 5 },
  key: { name: 'Access Key', ab: 'KEY', type: 'key', desc: 'Opens one locked door. Stand at the door and press E.', stack: 9 },
  bread: { name: 'Bread', ab: 'BRD', type: 'cons', desc: 'food +30, 5 HP', stack: 9 },
  stew: { name: 'Hearty Stew', ab: 'STW', type: 'cons', desc: 'food +55, water +10, 15 HP', stack: 5 },
  flask: { name: 'Empty Flask', ab: 'FLS', type: 'cons', desc: 'fill it at a well or a lake (E at the water)', stack: 3 },
  waterF: { name: 'Flask of Clean Water', ab: 'H2O', type: 'cons', desc: 'clean water: water +40 (the flask is kept)', stack: 3 },
  waterM: { name: 'Flask of Murky Water', ab: 'MRK', type: 'cons', desc: 'swamp water: water +25, but it may turn your stomach', stack: 3 },
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
/** What Mirek charges for vehicle parts. He buys them back for only a fifth of that. */
export const PART_PRICE: Partial<Record<ItemKey, number>> = { wheelL: 40, wheelH: 90, engine: 70, plating: 60, turbo: 220, eguard: 150, cannon: 400 };
export const PART_BUYBACK = 0.2;
export const HEAL: Partial<Record<ItemKey, number>> = { medkit: 50 };
/** Weapon attachments and what Radek the blacksmith charges for them. */
export const ATTACH_PRICE: Partial<Record<ItemKey, number>> = { reflex: 80, scope: 180, barL: 140, barR: 160, barS: 150, magX: 90, magD: 200 };
export const ATTACH_KEYS = Object.keys(ATTACH_PRICE) as ItemKey[];
