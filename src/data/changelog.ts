// The changelog shown from the main menu (ui/changelog.ts): how the game grew, newest first.
// Every pushed change adds an entry at the top, under the same version as src/version.ts.
export interface Change { v: string; date: string; title: string; notes: string[] }

export const CHANGELOG: Change[] = [
  {
    v: '0.10.0', date: '2026-09-24', title: 'Hands, back and body armour',
    notes: ['The Blaster and the Energy Blade are now real items. You fight with what is in your hands; two more weapons can be slung on your back (any mix: two rifles, two blades...), and more go in the backpack.',
      'Keys: 1 and 2 take the weapon on that side of your back into your hands, Q or the mouse wheel swaps, X slings the one in your hands onto your back. The HUD shows what you hold.',
      'Big things do not fit in the backpack: wheels, the vehicle cannon, the flagpole and the workbench kit are carried in your hands, and while you carry one you cannot hold a weapon. Store it in a trunk or chest, fit it to a vehicle, or sell it. The container and service windows show your hands and back.',
      'Wear armour and clothes: helmet, ballistic vest or plate armour, gloves, trousers and boots. Each takes a share off every hit (the backpack shows your total); Radek sells them, and weapons too. Everything you wear and carry counts towards your weight.'],
  },
  {
    v: '0.9.0', date: '2026-09-24', title: 'Flagpoles: claim land for a base',
    notes: ['Zofia\'s General Store sells a Flagpole (250 gold). Use it from the backpack and a hologram shows where the flag will stand, the levelled floor, how the ground slopes back to the land, how much will be dug out or filled, and the border of your claim. Click to raise it; the right mouse button or Esc cancels. The hologram turns red, with the reason, where a flag cannot stand (villages, places, roads, water, steep ground, the ice).',
      'Raising the flag levels the ground in a 12 m circle and clears the trees, rocks and plants on it: a site for your base. The land 30 m around the flag is your claim ("Your claim" on the HUD); building on it comes next. The claim is not a safe zone.',
      'Your flag shows on the compass and on the maps. E at the flag takes it down again and the land goes back to how it was.'],
  },
  {
    v: '0.8.1', date: '2026-09-24', title: 'Fix: chests can be searched again',
    notes: ['An opened chest no longer stops working once it is empty: walk up to it and press E to look inside, take things out or leave things in it for later.',
      'Chests opened in older versions (before they kept their contents) open as empty chests you can use for storage.'],
  },
  {
    v: '0.8.0', date: '2026-09-24', title: 'Compass and village map boards',
    notes: ['A Compass: buy it from Zofia at the General Store for 40 gold or craft it at a workbench or forge (1 scrap metal, 1 electronic components). Carry it and a compass strip at the top of the screen shows your heading, the way to the nearest village and your quest targets.',
      'Every village has a map board by its plaza. Press E there to see the land about 900 m around: ruins, bandit camps, crash sites, roads and lakes, arrows to the nearest other villages, and a list with the distance and direction to each place. The places you read about go on your own map (M).'],
  },
  {
    v: '0.7.0', date: '2026-09-24', title: 'Developer world map',
    notes: ['For testing: the console (~) has a new "worldmap" command that shows the whole planet with every village; zoom in to see the ruins, bandit camps and crash sites. Click a place or any spot to teleport there.',
      'The console also has "tp <x> <z>" to jump to exact coordinates (Gridholm is at 0 0).'],
  },
  {
    v: '0.6.0', date: '2026-09-24', title: 'Changelog',
    notes: ['A Changelog button in the main menu opens this log: every change to the game is written up here, newest first.'],
  },
  {
    v: '0.5.0', date: '2026-09-24', title: 'Version numbers',
    notes: ['The version number stands next to the title in the main menu and in the browser tab. Features raise the middle number, fixes the last one.'],
  },
  {
    v: '0.4.13', date: '2026-09-24', title: 'Robots guard the crashed ships',
    notes: ['Scouts patrol the spine and the cabins, guardian drones hold the compartments and the bridge, the cargo hold has a sentinel or guardians with a repair drone, and an assault construct or a sentinel waits in the engine room.',
      'The heavy machines only fit the tall rooms: they cannot follow you into the 3 m corridors.'],
  },
  {
    v: '0.4.12', date: '2026-09-24', title: 'Crash sites and angled dungeons',
    notes: ['Wrecked freighters lie half buried out in the wilds: an octagonal hull, a ringed engine nacelle, a fin, cockpit windows and an open side hatch with a ramp.',
      'Inside, a ship laid out like a ship: a straight spine with bulkheads, mirrored cabins and compartments, the airlock, a cargo hold, the bridge and the engine room with its guardian. The lockers hold salvage.',
      'Temple dungeon rooms now have chamfered ceilings, pointed vaults, raking struts and corner squinches; ship corridors have an octagonal section with hull ribs.'],
  },
  {
    v: '0.4.11', date: '2026-09-24', title: 'Fix: ruin entrances',
    notes: ['Standing behind a temple no longer drops you into its dungeon: only the landing behind the front door leads down.'],
  },
  {
    v: '0.4.10', date: '2026-09-24', title: 'Robots, and a calmer countryside',
    notes: ['Six kinds of robot from the RD field sheet: Scout Automaton, Guardian Drone, Repair Drone, Sentinel, Artillery Walker and Assault Construct. They drop scrap, electronics and rare power cores.',
      'Danger now grows with the distance from the nearest village: calm by the gates, deadly deep in the wilds. All enemies share a threat budget, so you are no longer swarmed the moment you step outside.',
      'Bandit camps keep well away from villages. New forge recipes use the electronics.'],
  },
  {
    v: '0.4.9', date: '2026-09-24', title: 'Crafting',
    notes: ['Chop trees with a Hatchet and break rocks with a Pickaxe; felled trees and broken rocks grow back after a few days.',
      'Craft at any village blacksmith\'s forge, or set up your own workbench in the wilds from a Workbench Kit.'],
  },
  {
    v: '0.4.8', date: '2026-09-24', title: 'Calories, a stomach, weight and bulk',
    notes: ['Your body stores calories and burns them faster when you run, swim, fight or carry a heavy pack. Food fills your stomach by its weight, so light, rich food feeds you best.',
      'Every item has a weight and a size: the backpack holds 40 litres, and above 20 kg you slow down.'],
  },
  {
    v: '0.4.7', date: '2026-09-24', title: 'Food from the wilds',
    notes: ['Brambles give meat; other creatures give materials. Roast raw meat at a campfire or at Jan\'s.',
      'Nutrient mushrooms and fruit pod trees grow in the forests, nutrient crystals in the dungeons, and they grow back once picked.'],
  },
  {
    v: '0.4.6', date: '2026-09-23', title: 'Stamina, hunger and thirst',
    notes: ['Sprinting, swimming, jumping and blade swings cost stamina. The blade hits hard, but an exhausted swing is slow and weak.',
      'Food and water run down with time: eat and drink to keep going.'],
  },
  {
    v: '0.4.5', date: '2026-09-23', title: 'Noise, suppressors and hunting Leechwings',
    notes: ['Gunfire draws creatures from all around; a suppressor keeps you quiet.',
      'Leechwings soar in wide circles, spot prey from far away and dive.'],
  },
  {
    v: '0.4.4', date: '2026-09-23', title: 'Gnawers and alien temples',
    notes: ['Rat-like Gnawers with big teeth and spined tails swarm in nests all over the land.',
      'The ruins became fallen alien temples: pylons, a great ring, a stepped portal, an avenue of broken obelisks.'],
  },
  {
    v: '0.4.3', date: '2026-09-23', title: 'Lakes and wells',
    notes: ['Lakes of clean, murky and toxic water; wells in the villages and in the wilds. Wade, swim, drink and fill flasks.'],
  },
  {
    v: '0.4.2', date: '2026-09-23', title: 'A whole planet',
    notes: ['The world wraps round east to west after 120 km and ends at icy poles. Villages are scattered all over it.'],
  },
  {
    v: '0.4.1', date: '2026-09-23', title: 'New trees',
    notes: ['Broadleaf trees and three giants: the Ancient Twisted Tree, the Umbrella Tree and the Hollow Arch you can walk through.'],
  },
  {
    v: '0.4.0', date: '2026-09-23', title: 'Slots, attachments and day and night',
    notes: ['Drag-and-drop item slots, chests that work both ways, tire and engine slots on vehicles, sights, barrels and magazines for the Blaster.',
      'Vehicles have hull points and a fuel gauge; the sun and the moon cross the sky and the notice board refreshes with time.'],
  },
  {
    v: '0.3.2', date: '2026-09-23', title: 'Bandits and raiders',
    notes: ['Bandit camps, patrols and gunfights; raiders in armed vehicles and roadside ambushes.'],
  },
  {
    v: '0.3.1', date: '2026-09-23', title: 'Creatures and the notice board',
    notes: ['Ravager packs, the Bramble and the Leechwing roam the land.', 'A notice board in Gridholm posts bounties, hunts and errands.'],
  },
  {
    v: '0.3.0', date: '2026-09-23', title: 'Vehicles',
    notes: ['Buy a Scout or a Mastodon from Mirek or find one abandoned in the wilds; trunks, damaged parts, repairs and a roof cannon.', 'A developer console on the ~ key.'],
  },
  {
    v: '0.2.0', date: '2026-09-23', title: 'The open world',
    notes: ['Terrain, roads and ruins around the village; the game is renamed GridWorld and starts with one click on Windows.'],
  },
  {
    v: '0.1.0', date: '2026-09-23', title: 'Grid Arena becomes a real project',
    notes: ['The original single-file Grid Arena is rebuilt with Vite and TypeScript; solids get dark fills so the wireframe world hides what is behind it.'],
  },
];
