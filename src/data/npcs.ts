import { hash } from '../core/rng';
import { RELIC_KEYS, ATTACH_KEYS, ATTACH_PRICE, GEAR_PRICE, TOOL_PRICE, SUPPLY_PRICE, type ItemKey } from './items';

export type NpcRole = 'innkeeper' | 'elder' | 'blacksmith' | 'merchant' | 'grocer' | 'dealer' | 'villager';
/** Dialogue options. New option ids (e.g. quests) are added here and handled in ui/dialog.ts. */
export type OptId = 'rest' | 'rumour' | 'work' | 'lore' | 'shop' | 'sell' | 'cook' | 'craft' | 'chat' | 'bye';
export interface NpcInfo { name?: string; title: string; color: number; hello?: string; opts: OptId[] }

export const NPC_INFO: Record<NpcRole, NpcInfo> = {
  innkeeper: { name: 'Marta', title: 'Innkeeper', color: 0xffb347, hello: 'Welcome to the Glowing Grid! Warm stew, cold ale and a soft bed. What can I do for you?', opts: ['rest', 'rumour', 'work', 'bye'] },
  elder: { name: 'Elder Bogdan', title: 'Village Elder', color: 0xe8fff0, hello: 'Ah, a new face. Welcome to Gridholm. Few travellers come this way since the machines woke up below us.', opts: ['lore', 'work', 'bye'] },
  blacksmith: { name: 'Radek', title: 'Blacksmith', color: 0xff7a5c, hello: 'The forge is hot. Need something made? I also fit sights, barrels and magazines to blasters. Bring me hides, fangs, plates, wood, stone and scrap and I will pay for them, or use my workbench and the forge yourself.', opts: ['shop', 'craft', 'sell', 'work', 'bye'] },
  merchant: { name: 'Zofia', title: 'General Store', color: 0xffd060, hello: 'Supplies for the brave and the foolish alike. Have a look.', opts: ['shop', 'work', 'bye'] },
  grocer: { name: 'Jan', title: 'Food & Provisions', color: 0x9dffe0, hello: 'Fresh bread, hot stew! Nobody fights well on an empty stomach. I buy meat and anything edible you pick out there, and I will roast your raw meat for a coin.', opts: ['shop', 'sell', 'cook', 'bye'] },
  dealer: { name: 'Mirek', title: 'Vehicle Dealer', color: 0x5cc8ff, hello: 'Wheels! Nobody walks to the ruins twice. Everything I sell waits in the yard, keys in the ignition. Spares and guns too. I buy vehicles back, but do not expect me to pay much for used parts.', opts: ['shop', 'sell', 'rumour', 'bye'] },
  villager: { title: 'Villager', color: 0x9dffb4, opts: ['chat', 'bye'] },
};
export const VILLAGER_NAMES = ['Ola', 'Piotr', 'Kasia', 'Tomek', 'Ania', 'Marek', 'Ewa', 'Staszek'];
export const VILLAGER_LINES = ["Nice evening, isn't it? Well, every evening looks the same under the grid.", 'Mind the drones past the gate. They never come inside the walls, though.',
  'The Elder has been worried lately. Something big stirs in the deep sectors.', "Marta's stew is the best thing in this village. Maybe the only good thing.",
  'I heard the doors down there only open for those who carry a key.', 'Radek says his forge runs on pure static. I believe him.'];
export const RUMOURS = ['They say the guardians below each carry an Access Key. Kill one and the gate is yours.',
  'A trader swore the stairs in the dungeon lead to whole other sectors. Some go up, some go down.',
  'Old Bogdan claims there is more beyond the hills than ruins. Other villages, caves, mines... one day we will see.',
  "If things go wrong down there, a Recall Beacon from Zofia's store will bring you home.",
  'Bandits have dug in out in the wilds. Tents, a fire, a stash of stolen goods. Clear a camp and the stash is yours.',
  'Folk who fled the drones left their vehicles out in the hills. Find one and it is yours, along with whatever is in the trunk.'];
export const OPT_TEXT: Record<OptId | 'back', string> = {
  rest: 'Rent a bed (10 gold)', rumour: 'Heard any rumours?', work: 'Do you have any work for me?', lore: 'Tell me about the dungeon.',
  shop: 'Show me your wares.', sell: 'I want to sell something.', cook: 'Roast my raw meat (2 gold a piece).', craft: 'Let me use your workbench (crafting).', chat: 'How are things?', bye: 'Goodbye.', back: 'Back',
};
export const LORE = 'Old ruins stand in the hills around Gridholm. Beneath each one lies a maze of the old machine folk. Drones patrol it, and guardians seal the deeper passages. Stairs connect it to other sectors, and hatches lead ever deeper. Follow the roads from our gates and you will find them.';

/** What the traders (other than Mirek) buy, and for how much. */
export const BUYS: Partial<Record<NpcRole, Partial<Record<ItemKey, number>>>> = {
  grocer: { meatR: 5, meatC: 9, cap: 3, pod: 4, ncrys: 10 },
  blacksmith: { hide: 14, fang: 9, plate: 22, membrane: 16, incisor: 5, log: 2, stone: 1, scrap: 5, circuit: 12, pcore: 60, planks: 1,
    blaster: 60, blade: 30, helmet: 25, vest: 50, armour: 100, gloves: 8, trousers: 12, boots: 16 },
};
export const COOK_PRICE = 2;
export function stockFor(role: NpcRole, world: number): [ItemKey, number][] {
  if (role === 'merchant') return [['medkit', 30], ['emp', 45], ['key', 90], ['recall', 60], ['flask', 15], ['firekit', 12], ['compass', 40], ['flagpole', 250],
    ...(Object.keys(SUPPLY_PRICE) as ItemKey[]).map((k): [ItemKey, number] => [k, SUPPLY_PRICE[k]!])];
  if (role === 'grocer') return [['bread', 8], ['stew', 18], ['waterF', 25]];
  if (role === 'blacksmith') {
    const a = RELIC_KEYS[hash(world, 11) % RELIC_KEYS.length]; let b = RELIC_KEYS[hash(world, 12) % RELIC_KEYS.length];
    if (b === a) b = RELIC_KEYS[(RELIC_KEYS.indexOf(a) + 1) % RELIC_KEYS.length];
    return [['hatchet', 35], ['pickaxe', 50], ...(Object.keys(TOOL_PRICE) as ItemKey[]).map((k): [ItemKey, number] => [k, TOOL_PRICE[k]!]), [a, 160], [b, 160], ...ATTACH_KEYS.map((k): [ItemKey, number] => [k, ATTACH_PRICE[k]!]),
      ...(Object.keys(GEAR_PRICE) as ItemKey[]).map((k): [ItemKey, number] => [k, GEAR_PRICE[k]!])];
  }
  return [];
}
