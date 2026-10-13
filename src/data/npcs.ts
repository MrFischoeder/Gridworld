import { hash } from '../core/rng';
import { BASES_OPEN, BASE_ITEMS } from './building';
import { RELIC_KEYS, ATTACH_KEYS, ATTACH_PRICE, GEAR_PRICE, TOOL_PRICE, SUPPLY_PRICE, type ItemKey } from './items';
import { tl } from '../i18n';

export type NpcRole = 'innkeeper' | 'elder' | 'blacksmith' | 'merchant' | 'grocer' | 'dealer' | 'guard' | 'villager';
/** Dialogue options. New option ids (e.g. quests) are added here and handled in ui/dialog.ts. */
export type OptId = 'status' | 'rest' | 'rumour' | 'oldtech' | 'make' | 'share' | 'farms' | 'plantup' | 'improve' | 'work' | 'lore' | 'shop' | 'sell' | 'cook' | 'craft' | 'chat' | 'fortify' | 'trade' | 'contracts' | 'watch' | 'house' | 'works' | 'garage' | 'bye';
export interface NpcInfo { name?: string; title: string; color: number; hello?: string; opts: OptId[] }

export const NPC_INFO: Record<NpcRole, NpcInfo> = {
  innkeeper: { name: 'Marta', title: tl('Innkeeper'), color: 0xffb347, hello: tl('Welcome to the Glowing Grid, {name}! Warm stew, cold ale and a soft bed. What can I do for you?'), opts: ['rest', 'rumour', 'oldtech', 'work', 'bye'] },
  elder: { name: tl('Elder Maciej'), title: tl('Village Elder'), color: 0xe8fff0, hello: tl('Ah, {name}. Welcome to Gridholm. Few travellers come this way since the machines woke up below us.'), opts: ['status', 'lore', 'share', 'oldtech', 'house', 'farms', 'plantup', 'improve', 'fortify', 'works', 'work', 'bye'] },
  blacksmith: { name: 'Oskar', title: tl('Blacksmith'), color: 0xff7a5c, hello: tl('{name}! The forge is hot. Need something made? I also fit sights, barrels and magazines to blasters. Bring me hides, fangs, plates, wood, stone and scrap and I will pay for them. Bring me materials and I will make you tools, and more, if you find the old plans.'), opts: ['make', 'shop', 'craft', 'sell', 'work', 'bye'] },
  merchant: { name: 'Zofia', title: tl('General Store'), color: 0xffd060, hello: tl('Good to see you, {name}. Supplies for the brave and the foolish alike. Have a look. And if you deal in bulk, I buy and sell trade goods by the crate.'), opts: ['shop', 'trade', 'contracts', 'work', 'bye'] },
  grocer: { name: 'Jan', title: tl('Food & Provisions'), color: 0x9dffe0, hello: tl('Fresh bread, hot stew! {name}, nobody fights well on an empty stomach. I buy meat and anything edible you pick out there, and I will roast your raw meat for a coin.'), opts: ['shop', 'sell', 'cook', 'bye'] },
  dealer: { name: 'Kuba', title: tl('Mechanic'), color: 0x5cc8ff, hello: 'Wheels, {name}! Nobody walks to the ruins twice. Bring me salvage from the wrecks and the robots and I build you something that runs, or mend what you have. Spares and guns too. I buy vehicles back, but do not expect me to pay much for used parts.', opts: ['garage', 'shop', 'sell', 'rumour', 'oldtech', 'bye'] },
  guard: { name: 'Jakub', title: tl('Captain of the Guard'), color: 0x7de8ff, hello: tl('Weapons stay holstered inside the walls, {name}. I keep the gates and the towers; when the bandits come, you will hear me first.'), opts: ['watch', 'rumour', 'oldtech', 'bye'] },
  villager: { title: tl('Villager'), color: 0x9dffb4, opts: ['chat', 'oldtech', 'bye'] },
};
export const VILLAGER_NAMES = ['Kasia', 'Ola', 'Piotr', 'Tomek', 'Ania', 'Marek', 'Ewa', 'Staszek', 'Zosia', 'Bartek', 'Hanna', 'Wojtek'];
export const VILLAGER_LINES = [tl("Nice evening, isn't it? Well, every evening looks the same under the grid."), tl('Mind the drones past the gate. They never come inside the walls, though.'),
  tl('The Elder has been worried lately. Something big stirs in the deep sectors.'), tl("Marta's stew is the best thing in this village. Maybe the only good thing."),
  tl('I heard the doors down there only open for those who carry a key.'), tl('Oskar says his forge runs on pure static. I believe him.'),
  tl('Oh, {name}! Everyone talks about you. Mostly good things.'), tl('Back from the wilds, {name}? You look like you need a drink.'), tl('Stay safe out there, {name}. We need people like you.')];
export const RUMOURS = [tl('They say the guardians below each carry an Access Key. Kill one and the gate is yours.'),
  tl('A trader swore the stairs in the dungeon lead to whole other sectors. Some go up, some go down.'),
  tl('Old Maciej claims there is more beyond the hills than ruins. Other villages, caves, mines... one day we will see.'),
  tl("If things go wrong down there, a Recall Beacon from Zofia's store will bring you home."),
  tl('Bandits have dug in out in the wilds. Tents, a fire, a stash of stolen goods. Clear a camp and the stash is yours.'),
  tl('Raw ore sells for little. Smelt it, draw it, cast it, and the same crates are worth three times as much. The elders can put up works in any village.'),
  tl('They say the Chariot of the Ancients in the old hangar could reach the sky again, if anyone brought it enough advanced alloy and circuit boards.'),
  tl('Works stand idle without power. A village that wants to smelt or cast needs a power station first: sun, wind, coal or diesel.'),
  tl('Folk who fled the drones left their vehicles out in the hills. Find one and it is yours, along with whatever is in the trunk.')];
export const OPT_TEXT: Record<OptId | 'back', string> = {
  status: tl('How is the village doing? (people, food, work)'), rest: tl('Rent a bed (10 gold)'), rumour: tl('Heard any rumours?'), oldtech: tl('Seen any old machines out there?'), make: tl('Make something for me.'), share: tl('What can the village spare me? (your standing)'), farms: tl('Could we clear land for a farm? (food, people)'), plantup: tl('Could our power plant give more? (upgrade)'), improve: tl('What could the old parts do for us? (improvements)'), work: tl('Do you have any work for me?'), lore: tl('Tell me about the dungeon.'),
  garage: tl('Build me something in your workshop.'), shop: tl('Show me your wares.'), sell: tl('I want to sell something.'), cook: tl('Roast my raw meat (2 gold a piece).'), craft: tl('Let me use your workbench (crafting).'), chat: tl('How are things?'), fortify: tl('How can I help the village? (walls, turrets, power)'), trade: tl('Trade goods by the crate (market).'), contracts: tl('Any deliveries to be done? (contracts)'), watch: tl('How safe is the village?'), house: tl('Are there houses for sale?'), works: tl('Could we build works here? (processing)'), bye: tl('Goodbye.'), back: tl('Back'),
};
export const LORE = tl('Old ruins stand in the hills around Gridholm. Beneath each one lies a maze of the old machine folk. Drones patrol it, and guardians seal the deeper passages. Stairs connect it to other sectors, and hatches lead ever deeper. Follow the roads from our gates and you will find them.');
/** Gridholm's elder adds the Chariot of the Ancients (the shuttle, gen/shuttle.ts). */
export const LORE_SHUTTLE = tl(' And north-east of the village, in the old hangar, stands the Chariot of the Ancients, a sky-ship our fathers could never fly. We mean to mend it, {name}. It will not be mended with scrap from the ruins: it wants steel, alloy, cable, circuit boards and propellant, made in works, and works want power. Bring what you make to the hangar: the crew unload it straight onto the Chariot.');

/** What the traders (other than Kuba) buy, and for how much. */
export const BUYS: Partial<Record<NpcRole, Partial<Record<ItemKey, number>>>> = {
  grocer: { fishR: 4, meatR: 5, meatC: 9, cap: 3, pod: 4, ncrys: 10 },
  blacksmith: { hide: 14, fang: 9, plate: 22, membrane: 16, incisor: 5, log: 2, stone: 1, scrap: 5, circuit: 12, pcore: 60, planks: 1, ironO: 4, copperO: 6,
    blaster: 60, blade: 30, pistol: 50, smg: 70, shotgun: 90, rifle: 110, machete: 20, spear: 15, sledge: 25, helmet: 25, vest: 50, armour: 100, gloves: 8, trousers: 12, boots: 16,
    hideCap: 6, hideCoat: 18, hideGloves: 5, hideLegs: 10, hideBoots: 10, rucksack: 20 },
};
export const COOK_PRICE = 2;
/** What the empty house in Gridholm costs (the elder sells it; it becomes the hero's own). */
export const HOUSE_PRICE = 750;
export function stockFor(role: NpcRole, world: number): [ItemKey, number][] {
  const stock = stockAll(role, world);
  return BASES_OPEN ? stock : stock.filter(([k]) => !BASE_ITEMS.includes(k));
}
function stockAll(role: NpcRole, world: number): [ItemKey, number][] {
  if (role === 'merchant') return [['medkit', 30], ['emp', 45], ['key', 90], ['recall', 60], ['flask', 15], ['firekit', 12], ['compass', 40], ['flagpole', 250],
    ...(Object.keys(SUPPLY_PRICE) as ItemKey[]).map((k): [ItemKey, number] => [k, SUPPLY_PRICE[k]!])];
  if (role === 'grocer') return [['waterF', 25]]; // the dishes come from the village hall (ui/foodshop.ts)
  if (role === 'blacksmith') {
    const a = RELIC_KEYS[hash(world, 11) % RELIC_KEYS.length]; let b = RELIC_KEYS[hash(world, 12) % RELIC_KEYS.length];
    if (b === a) b = RELIC_KEYS[(RELIC_KEYS.indexOf(a) + 1) % RELIC_KEYS.length];
    return [['hatchet', 35], ['pickaxe', 50], ...(Object.keys(TOOL_PRICE) as ItemKey[]).map((k): [ItemKey, number] => [k, TOOL_PRICE[k]!]), [a, 160], [b, 160], ...ATTACH_KEYS.map((k): [ItemKey, number] => [k, ATTACH_PRICE[k]!]),
      ...(Object.keys(GEAR_PRICE) as ItemKey[]).map((k): [ItemKey, number] => [k, GEAR_PRICE[k]!])];
  }
  return [];
}
