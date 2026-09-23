export type ItemType = 'relic' | 'cons' | 'key';
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
  recall: { name: 'Recall Beacon', ab: 'RCL', type: 'cons', desc: 'returns you to the village from the dungeon', stack: 5 },
  emp: { name: 'EMP Charge', ab: 'EMP', type: 'cons', desc: 'damages every drone within 6 m (G key)', stack: 5 },
} satisfies Record<string, ItemDef>;

export type ItemKey = keyof typeof ITEMS;
export const item = (k: ItemKey): ItemDef => ITEMS[k];
export const RELIC_KEYS = (Object.keys(ITEMS) as ItemKey[]).filter((k) => item(k).type === 'relic');
export const INV_SIZE = 12, MOD_SIZE = 3;
export const HEAL: Partial<Record<ItemKey, number>> = { medkit: 50, bread: 20, stew: 45 };
