export type ItemType = 'relic' | 'cons' | 'key' | 'part' | 'quest';
export interface ItemDef { name: string; ab: string; type: ItemType; desc: string; stack?: number }

export const ITEMS = {
  shield: { name: 'Shield Core', ab: 'SHD', type: 'relic', desc: '+20 max HP' },
  lens: { name: 'Focusing Lens', ab: 'LNS', type: 'relic', desc: '+25% blaster damage' },
  edge: { name: 'Monomolecular Edge', ab: 'EDG', type: 'relic', desc: '+25% blade damage, longer reach' },
  servo: { name: 'Leg Servos', ab: 'SRV', type: 'relic', desc: '+8% movement speed' },
  cell: { name: 'Power Cell', ab: 'CEL', type: 'relic', desc: 'blaster fires 10% faster' },
  medkit: { name: 'Medkit', ab: '+', type: 'cons', desc: 'restores 50 HP (H key)', stack: 5 },
  key: { name: 'Access Key', ab: 'KEY', type: 'key', desc: 'Opens one locked door. Stand at the door and press E.', stack: 9 },
  bread: { name: 'Bread', ab: 'BRD', type: 'cons', desc: 'restores 20 HP', stack: 9 },
  stew: { name: 'Hearty Stew', ab: 'STW', type: 'cons', desc: 'restores 45 HP', stack: 5 },
  recall: { name: 'Recall Beacon', ab: 'RCL', type: 'cons', desc: 'returns you to the village from anywhere', stack: 5 },
  emp: { name: 'EMP Charge', ab: 'EMP', type: 'cons', desc: 'damages every drone within 6 m (G key)', stack: 5 },
  book: { name: 'Ancient Book', ab: 'BOK', type: 'quest', desc: 'a crumbling book of the old machine folk; Elder Bogdan wants it', stack: 1 },
  gearbox: { name: 'Precision Gearbox', ab: 'GBX', type: 'quest', desc: 'a rare pre-war part; Radek the blacksmith wants it', stack: 1 },
  datacore: { name: 'Data Core', ab: 'COR', type: 'quest', desc: 'a sealed memory core; Zofia at the store wants it', stack: 1 },
  logbook: { name: "Driver's Logbook", ab: 'LOG', type: 'quest', desc: 'a battered logbook from a wreck; Mirek the dealer wants it', stack: 1 },
  wheelL: { name: 'Light Wheel', ab: 'WHL', type: 'part', desc: 'spare wheel for the RTV-1 Scout (fit it at the front of the vehicle)', stack: 4 },
  wheelH: { name: 'Heavy Wheel', ab: 'HWL', type: 'part', desc: 'spare wheel for the HTV-6 Mastodon (fit it at the front of the vehicle)', stack: 2 },
  engine: { name: 'Engine Parts', ab: 'ENG', type: 'part', desc: 'repairs a vehicle engine by 50%', stack: 5 },
  plating: { name: 'Hull Plating', ab: 'HUL', type: 'part', desc: 'armour plates that patch 40% of a vehicle hull (fit them at the front of the vehicle)', stack: 5 },
  cannon: { name: 'Vehicle Cannon', ab: 'CAN', type: 'part', desc: 'roof-mounted gun for any vehicle; fire with the attack button while driving', stack: 1 },
} satisfies Record<string, ItemDef>;

export type ItemKey = keyof typeof ITEMS;
export const item = (k: ItemKey): ItemDef => ITEMS[k];
export const RELIC_KEYS = (Object.keys(ITEMS) as ItemKey[]).filter((k) => item(k).type === 'relic');
export const INV_SIZE = 12, MOD_SIZE = 3;
/** What Mirek charges for vehicle parts. He buys them back for only a fifth of that. */
export const PART_PRICE: Partial<Record<ItemKey, number>> = { wheelL: 40, wheelH: 90, engine: 70, plating: 60, cannon: 400 };
export const PART_BUYBACK = 0.2;
export const HEAL: Partial<Record<ItemKey, number>> = { medkit: 50, bread: 20, stew: 45 };
