import { hash } from '../core/rng';
import { RELIC_KEYS, type ItemKey } from './items';

export type NpcRole = 'innkeeper' | 'elder' | 'blacksmith' | 'merchant' | 'grocer' | 'villager';
/** Dialogue options. New option ids (e.g. quests) are added here and handled in ui/dialog.ts. */
export type OptId = 'rest' | 'rumour' | 'work' | 'lore' | 'shop' | 'chat' | 'bye';
export interface NpcInfo { name?: string; title: string; color: number; hello?: string; opts: OptId[] }

export const NPC_INFO: Record<NpcRole, NpcInfo> = {
  innkeeper: { name: 'Marta', title: 'Innkeeper', color: 0xffb347, hello: 'Welcome to the Glowing Grid! Warm stew, cold ale and a soft bed. What can I do for you?', opts: ['rest', 'rumour', 'work', 'bye'] },
  elder: { name: 'Elder Bogdan', title: 'Village Elder', color: 0xe8fff0, hello: 'Ah, a new face. Welcome to Gridholm. Few travellers come this way since the machines woke up below us.', opts: ['lore', 'work', 'bye'] },
  blacksmith: { name: 'Radek', title: 'Blacksmith', color: 0xff7a5c, hello: 'The forge is hot. Need something made, or just admiring the sparks?', opts: ['shop', 'work', 'bye'] },
  merchant: { name: 'Zofia', title: 'General Store', color: 0xffd060, hello: 'Supplies for the brave and the foolish alike. Have a look.', opts: ['shop', 'work', 'bye'] },
  grocer: { name: 'Jan', title: 'Food & Provisions', color: 0x9dffe0, hello: 'Fresh bread, hot stew! Nobody fights well on an empty stomach.', opts: ['shop', 'bye'] },
  villager: { title: 'Villager', color: 0x9dffb4, opts: ['chat', 'bye'] },
};
export const VILLAGER_NAMES = ['Ola', 'Piotr', 'Kasia', 'Tomek', 'Ania', 'Marek', 'Ewa', 'Staszek'];
export const VILLAGER_LINES = ["Nice evening, isn't it? Well, every evening looks the same under the grid.", 'Mind the drones past the gate. They do not like visitors.',
  'The Elder has been worried lately. Something big stirs in the deep sectors.', "Marta's stew is the best thing in this village. Maybe the only good thing.",
  'I heard the doors down there only open for those who carry a key.', 'Radek says his forge runs on pure static. I believe him.'];
export const RUMOURS = ['They say the guardians below each carry an Access Key. Kill one and the gate is yours.',
  'A trader swore the stairs in the dungeon lead to whole other sectors. Some go up, some go down.',
  'Old Bogdan claims there are open fields beyond the hills. Forests, caves, mines... one day we will see.',
  "If things go wrong down there, a Recall Beacon from Zofia's store will bring you home."];
export const OPT_TEXT: Record<OptId | 'back', string> = {
  rest: 'Rent a bed (10 gold)', rumour: 'Heard any rumours?', work: 'Do you have any work for me?', lore: 'Tell me about the dungeon.',
  shop: 'Show me your wares.', chat: 'How are things?', bye: 'Goodbye.', back: 'Back',
};
export const LORE = 'Beneath the north gate lies a maze of the old machine folk. Drones patrol it, and guardians seal the deeper passages. Stairs connect it to other sectors, and hatches lead ever deeper.';

export function stockFor(role: NpcRole, world: number): [ItemKey, number][] {
  if (role === 'merchant') return [['medkit', 30], ['emp', 45], ['key', 90], ['recall', 60]];
  if (role === 'grocer') return [['bread', 8], ['stew', 18]];
  if (role === 'blacksmith') {
    const a = RELIC_KEYS[hash(world, 11) % RELIC_KEYS.length]; let b = RELIC_KEYS[hash(world, 12) % RELIC_KEYS.length];
    if (b === a) b = RELIC_KEYS[(RELIC_KEYS.indexOf(a) + 1) % RELIC_KEYS.length];
    return [[a, 160], [b, 160]];
  }
  return [];
}
