// The changelog shown from the main menu (ui/changelog.ts): how the game grew, newest first.
// Every pushed change adds an entry at the top, under the same version as src/version.ts.
export interface Change { v: string; date: string; title: string; notes: string[] }

export const CHANGELOG: Change[] = [
  { v: '0.140.0', date: '2026-10-06', title: 'Crews', notes: [
    'Online, several players can now sail one boat or ship together. Whoever holds the oars, the tiller or the wheel steers for everyone; the others see her move as she does and are carried along on deck.',
    'The rowboat has a second pair of oars. A second player who climbs in takes the aft oars: when both of you pull the same way she goes about half as fast again; pulling against each other gets you nowhere.',
    'A ship\'s wheel takes one helmsman: while someone holds it, the others can only walk the deck.',
    'Ships carry rope ladders on both sides amidships: swim to one and press E to climb up onto the deck.',
    'Gangplanks: when a ship lies still alongside a dock, a bridge or a shore within about three metres, a plank slides out of the gap in her bulwark on that side, so you walk ashore. It comes in again when she gets under way. A new ship is launched alongside the dock\'s head whenever the water allows, and the dock\'s lamp and crate now stand at the inner end of the head, out of the way of her gangway.',
    'Servers need updating with the game (multiplayer protocol 9).',
  ] },
  { v: '0.139.0', date: '2026-10-06', title: 'Ships', notes: [
    'Piers are now docks (the Pier Kit is the Dock Kit). Every boat and ship is built on a dock\'s slip and launched alongside it; a ship needs deeper water there.',
    'Two kinds of vessel. The small boat is the rowboat (10 loads in its hold). Brought alongside a dock it can be refitted with a mast and a hide sail (Sailing Skiff) or with an outboard motor (Motor Skiff), 14 loads either way. The old sailboats and motor boats become these skiffs.',
    'The ship: a 16-metre two-masted Sailing Ship (48 loads; it only sails, so it needs a wind and cannot sail into it) or a 15-metre Motor Ship with a funnel and a wheelhouse (40 loads; it steams on fuel canisters). Both are decked: step across from the dock through the gap in the bulwark amidships, or press E beside the hull to climb up from the water.',
    'Take the wheel aft with E and steer as with the boats (Space sets or furls the sails, W/S trim the sheets or set the throttle). E again leaves the wheel: the ship holds her course with the sails or the engine as you left them, and you can walk her deck while she goes, carried along with her. F opens the hold anywhere on deck. Watch the shore: she will run aground.',
  ] },
  { v: '0.138.0', date: '2026-10-06', title: 'Military cases', notes: [
    'Chests in ruins, wrecks and caves now come as three military sci-fi cases: an ammunition footlocker (ribbed steel on skids, corner guards, a hazard panel, latches and handles), a sealed tech canister (an octagonal case with thick end rings, lit seams and a readout on its lid) and an armoured strongbox (a wedge-fronted steel case with a keypad, a status lamp and side vents). All open the same way.',
    'The old wooden treasure chest still turns up, but only now and then. Bandit camps keep their stash in a footlocker.',
  ] },
  { v: '0.137.0', date: '2026-10-05', title: 'The village stores', notes: [
    'A new settlement has no storehouse at first: bring the logs, stones and other materials to the elder (Leave materials with me). He keeps the village\'s stores until the warehouse is built; its plot outside the north fence is staked out meanwhile.',
    'The warehouse is now a big plank barn: boarded walls on posts with knee braces, a gable roof over wide double doors standing open, a plank floor, timber racks and a painted parking bay. Drive a truck straight in, park in the bay and unload it at the terminal; the camera stays under the roof while you are inside. The older village halls get the same plank look.',
    'The village stores take only materials: wood, stone, ore and metals, building supplies, crates of goods and what the works make of them (and the turret kits and engine parts the builds need). Weapons, ammunition, medkits, food, tools and clothes stay yours: keep them in the chest of your own house. Unloading a vehicle leaves such things in its trunk.',
  ] },
  { v: '0.136.0', date: '2026-10-05', title: 'Beside the backpack', notes: [
    'Opening the backpack now also shows what lies on the ground around you (within 3 m) in a panel beside it. Click an item there, or drag it into the backpack, to pick it up; drag one of yours onto the ground (or press Drop) to put it down at your feet. Pick up all takes everything at once.',
    'Chests, stashes, trunks, lockers and holds now open beside the backpack too, so the whole backpack (modules, body, contents) is there while you move things. Click an item in the container to take it, drag between the two, or select one of yours and press Store. E or Esc closes it.',
    'Fixed: hovering an item in the chest window rewrote the line under the slots and resized the window, so with the cursor on the edge of an icon the window flickered. The item tooltip is now the only thing that appears on hover, and the windows keep their size.',
  ] },
  { v: '0.135.0', date: '2026-10-05', title: 'The colossal heads', notes: [
    'Ten new ancient landmarks stand on the continents: valleys of colossal stone heads, buried to the shoulders among great boulders, 15 to 50 metres tall, their faceted faces carved with heavy brows, long noses and ears, and visor eyes lit with rows of glowing script.',
    'Each site is different: the Vale of the Watchers (two rows facing across a path), the Council of Stone Faces (a circle looking inwards), the Seaward Gaze (a line looking one way), the Sunken Choir (half swallowed by the earth), the Twin Guardians, the Leaning Elders, the Grand Assembly, the Eyes of the Old Sky (looking outwards), the Patriarch (one giant among four) and the Long Vigil (a growing line).',
    'The heads and boulders are solid; you can walk between them. Their names show when you arrive, and they appear on the maps like the other monuments. The twelve existing monuments keep their places.',
  ] },
  { v: '0.134.0', date: '2026-10-05', title: 'One world for everyone', notes: [
    'On a server everything in the world is now shared. What falls to the ground (a kill\'s loot, logs from a felled tree, stones from a rock) lies there for everyone, once, and goes to whoever walks over it first.',
    'Raider vehicles, roadblocks, dungeon drones and the bosses of the depths are the same for every player in a place, like the other enemies. The killing blow earns the reward; the enemy\'s own game no longer drops a second set of loot.',
    'Ancient defence turrets fire at whichever player is nearest, and every hit on a turret counts for everyone.',
    'When a player leaves or moves on, the enemies they brought stay and fight on in the game of the players still there, instead of vanishing.',
    'Land claims with everything built on them, wild workbenches and the villages\' notice boards are shared: a notice taken by one player is gone for the others.',
    'Your character (equipment, gold, experience, quests, maps and knowledge) remains your own. Multiplayer protocol is now 8: update both the server and the game.',
  ] },
  { v: '0.133.0', date: '2026-10-05', title: 'Gentler turrets, crewed wrecks', notes: [
    'Mounted defence turrets are much less deadly. Their heads turn slowly, so they need a moment to swing round onto you, and they only open fire once they are lined up after a longer warning (the sensor glows amber).',
    'Turrets now fire short three-round bursts with a two-second pause between them, and their shots scatter a little. Keep moving across their line of fire, or step out of sight between bursts.',
    'The turret head is now a faceted armoured dome with a visor slit and twin barrels, standing out of a low collar on its mount.',
    'Crashed ships have a single turret instead of three, but their robot crew is back: scouts, guardians, repair drones, sentinels and assault constructs patrol the corridors, cargo hold and engine room.',
  ] },
  { v: '0.132.0', date: '2026-10-05', title: 'Natural village resource sites', notes: [
    'Every developing village has a stone quarry and its own sawmill woodland about 100 metres beyond the fence. Quarries are broad piles of irregular boulders with room for a stone-cutting shed; sawmill sites begin as standing groves around an open work yard.',
    'Ore seams occur at roughly 35% of villages and oil fields at roughly 22%. Gridholm retains an introductory iron seam. Iron, copper, lead, nickel and coal have distinct colours and element markings; mines extract their actual local ore instead of making every metal.',
    'Ore deposits lie in real shallow terrain bowls bordered by veined rocks, with a clear walk-in gap and matching walkable ground. Oil fields have irregular black pools, continuously expanding bubble rings and pulsing jets of dark sludge.',
    'The elder guides quarry and sawmill construction in every settlement, then only the rare extraction projects available there. Villages without metal or oil deposits can complete their tutorial and third farm; missing resources can be transported between villages.',
    'Constructed quarries supply building stone; sawmills supply logs as well as timber and lumber. Existing commissioned mines, oil wells, partial deliveries and extracted goods survive migration. New scenery also appears in existing developing worlds; the frozen 0.130.0 rules are preserved.',
    'Resource scenery uses seeded batches and reusable animation buffers. Boulder collision follows its faceted faces, allowing movement off crowns and shoulders. Multiplayer protocol is now 7: update both client and server.',
  ] },
  { v: '0.131.0', date: '2026-10-04', title: 'From a small settlement to working industry', notes: [
    'Version 0.130.0 is frozen at tag v0.130.0. Existing characters keep their established villages; new worlds start with eight residents, a small 800-litre warehouse and marked construction sites instead of working power plants or industry.',
    'Vacant homes have broken walls and roofs. Farms and infrastructure repair the village, increase its housing and gradually attract new families.',
    'The elder guides a sequential tutorial: supplies, first farm, nearby satellite receiver and GPS tablet, second farm, vehicle warehouse, power, mine, sawmill, oil well, refinery and third farm. Starter tools and rewards are issued once to each traveller.',
    'Restore communications at a surface console beside a real nearby ruin. Tutorial markers guide you before GPS is available. Early notice boards offer just two small resource deliveries or kill jobs; long-distance deliveries open with the vehicle warehouse.',
    'The large warehouse stands outside the north fence with a six-metre vehicle entrance and 24,000 litres of storage. Drive a Mastodon inside, leave the cab and unload cargo directly at the terminal; excess cargo stays in its trunk.',
    'The starting smith offers basic tools. The first farm unlocks boards and nails without lost plans; advanced work requires village development and the relevant technology. Constructed extraction sites feed shared village stock; the refinery consumes real crude to make fuel.',
    'Settlement construction and repairs synchronize through the shared multiplayer world. Village-stock transactions are reserved before changing materials or vehicle cargo; multiplayer clients and servers now use protocol 6 and must both be updated. Older save JSON is backed up locally before migration, and generating another world also attempts to retain a snapshot of the previous character.',
  ] },
  { v: '0.130.0', date: '2026-10-04', title: 'Ocean seam on the developer map', notes: [
    'The developer map opens on the whole planet with its longitude seam in the broad ocean between continents. Mainland coastlines stay together; Gridholm no longer needs to be in the centre.',
    'Panning and zooming repeat rivers, villages, cities, underground entrances, portals, megaliths, toxic fog and the player together with the terrain. Clicking any repeated marker reaches the same original location.',
    'Overview restores the whole-planet view; Centre on me follows the player. This display change works in existing worlds without moving places or changing saves.',
  ] },
  { v: '0.129.0', date: '2026-10-04', title: 'Organic coasts and larger ocean islands', notes: [
    'Continents have asymmetric headlands, deep bays and many smaller coves instead of almost elliptical outlines. Two or three mainlands remain separated by broad oceans, with Gridholm safely inland.',
    'Ocean islands grow from nominal radii of 60–220 metres to 240–700 metres, with gentle 6–18 metre hills. Their full lobed shores and underwater footprints remain continuous across generator cells and the planet seam.',
    'The developer map now shows offshore island land as well as mainland coastlines. Geography remains deterministic for every world seed.',
    'Coastlines and offshore terrain regenerate in existing worlds; places that require dry mainland may move. Use a new world for a fresh exploration of the revised geography.',
  ] },
  { v: '0.128.0', date: '2026-10-04', title: 'Compact megaliths and visible city vaults', notes: [
    'All twelve megaliths are 25% narrower and 30% lower, including stonework, collisions and cleared grounds. Sanctuaries span about 173–248 metres and reach up to 55 metres. Their reserved locations and ids stay the same.',
    'Every ruined city has four to six separated underground entrances. Tall blue signs, raised hatch lids and guide beacons identify them; all signs load with the city instead of waiting for street tiles.',
    'The city HUD shows the closest underground entrance and its distance. Entering a city reveals its entrances on the local and world maps; the developer map marks them when zoomed in. Approach a sign and press E to descend.',
    'The original four entrance addresses, positions and dungeon seeds remain compatible with existing saves. The three-floor limit is unchanged.',
  ] },
  { v: '0.127.1', date: '2026-10-04', title: 'Safe landings on rocks and ruins', notes: [
    'Landing on a rock or a city ruin no longer rounds your feet down into its collider. Vertical movement stops precisely at fractional surfaces, so you can walk away and jump again.',
    'Shallow integer-rounded contact positions left by older saves are recovered. Voxel floors, small stairs and ceilings keep their collision boundaries.',
  ] },
  { v: '0.127.0', date: '2026-10-04', title: 'Canyons removed', notes: [
    'Canyon generation, descent paths, developer map markers and canyon bridge planning have been removed. Existing worlds use the underlying natural terrain again.',
    'Old bridges over removed canyons are retired when loading saves or shared worlds. River bridges, rocky fields, portals and megaliths remain available.',
  ] },
  {
    v: '0.126.0', date: '2026-10-04', title: 'Twelve colossal megalithic sanctuaries',
    notes: [
      'Twelve enormous Stonehenge-inspired monuments stand across the continents: crowned, twin and triple stone circles, a horseshoe, an avenue, a spiral, cardinal arches, a broken halo, a star assembly, a towering obelisk, a giant gate and a constellation court.',
      'Sanctuaries span 230–330 metres, with pillars and lintels up to 78 metres high. Weathered stone faces have opaque fills, fractures and old carvings; open archways and courtyards remain passable.',
      'Every monument has a fixed name, id and seeded location, reserved for future special purposes. They do not activate a quest or portal yet. Their grounds are kept clear and cannot be claimed as a base.',
      'Stonework blocks movement, vehicles, shots and sight. The local view extends near these huge sites, and their named markers appear on the explored map and the full developer map. Click a developer marker to visit the outer edge.',
    ],
  },
  {
    v: '0.125.0', date: '2026-10-04', title: 'Developer map portals and canyons',
    notes: [
      'The console’s developer map shows all 40 ancient portals as cyan octagons and scans the planet for canyons, drawn as orange rims with their real orientation and size.',
      'Zoom in to see the canyon descent paths and entrances. Hover for dimensions and depth; click a canyon to arrive at its path entrance or a portal to arrive beside its ring.',
      'The legend and scan counters identify the new landmarks, including unexplored places. Canyon discovery runs in short frame slices and is cached per world.',
    ],
  },
  {
    v: '0.124.0', date: '2026-10-04', title: 'Twenty-second drone opening',
    notes: [
      'A twenty-second opening film plays before the menu: fly through Gridholm’s gate and circle its houses, then discover ancient ruins and an active portal, fallen cities, rivers and mountain ranges.',
      'Close flybys show robots, armed bandits, wild fauna and a moving vehicle convoy using the game’s models. GRIDWORLD gradually appears, followed by Designed by Luki and Music by Iskra.',
      'Skip with the on-screen button, Space, Enter or Escape; replay with Opening film in the menu. The separate showcase leaves your position, world clock, foes and saves untouched. New heroes still have their shipwreck story after Play.',
    ],
  },
  {
    v: '0.123.0', date: '2026-10-04', title: 'Faceted natural boulders',
    notes: [
      'Scattered stones and large terrain boulders now have broad bodies, uneven shoulders and flat broken crowns instead of pyramid tips. Their faceted shapes vary deterministically.',
      'The same stone model updates rubble in ruins, cave entrances, trail markers and decorative stones throughout the world, with opaque dark fills beneath the wireframe.',
      'Coloured ore veins follow the new stone faces and their folds. Rock placement, collision, mining rewards and existing harvested-rock saves are preserved.',
    ],
  },
  {
    v: '0.122.0', date: '2026-10-04', title: 'Manual gate dialling and animated transit',
    notes: [
      'Symbols light up on the ring as you enter them. Select three symbols, then press Activate; Cancel clears the draft. The console shows symbols without their English names.',
      'The receiving gate displays the initiating gate address in three large slots on its upper lintel, and in its console.',
      'Walk or drive through for a five-second journey with continuous light trails flying past. Vehicle passengers and roof gunners see the same transit and keep their seats and cargo.',
      'Entering before the 45-second deadline reserves your journey. Both gates stay open and their terminals stay locked until every accepted traveller arrives; no new journey starts after the deadline.',
    ],
  },
  {
    v: '0.121.0', date: '2026-10-04', title: 'Vehicle gates and permanent address tablets',
    notes: [
      'Your gate address is engraved on its console. A stationary stone tablet nearby permanently lists three seeded random destination addresses.',
      'Connections stay open in both directions for 45 real seconds, including time in menus. Both terminals lock until the connection expires; crossing never resets the timer.',
      'Larger rings and clear approaches admit the largest Mastodon, including its roof cannon and gunner. Driving through preserves the vehicle, condition, fuel, equipment and cargo.',
      'Multiplayer passengers and gunners travel with the driver, retain their seats and appear immediately at the destination. Two-player and three-player vehicle crossings are supported.',
    ],
  },
  {
    v: '0.120.0', date: '2026-10-04', title: 'Ancient addressed world gates',
    notes: [
      'Forty ancient alien gates stand on dry ground across the continents, with one near Gridholm. Each weathered octagonal stone ring has six distinct symbols; its two grounded corners are unmarked.',
      'Use the nearby console with E, then press three symbols in address order. Every gate has a unique address, recorded in the engraved archive alongside its own address.',
      'A valid address opens a shimmering portal for 45 seconds of active play. Walk through on foot to arrive safely outside the destination ring, with your health and inventory intact; dial the previous gate to return.',
      'Each gate has its own seeded scatter of boulders. Cleared level approaches need no jumping, and discovered gates have octagonal cyan markers on both surface maps.',
    ],
  },
  {
    v: '0.119.0', date: '2026-10-04', title: 'One vehicle condition and protected occupants',
    notes: [
      'Every vehicle has one condition percentage. Gunfire, direct enemy attacks and collisions damage this pool; wheels and engines no longer break separately.',
      'Drivers, passengers and roof gunners take no damage while aboard, including in the open Scout and another player\'s vehicle. The hit that disables a vehicle never spills onto its occupants.',
      'Ordinary driving causes no wear. A vehicle retains full performance until condition reaches 0%, then stops and its occupants get out unharmed.',
      'Service and repair kits restore the shared condition, including disabled vehicles. Existing saves retain hull damage, equipment and cargo while old wheel and engine faults are retired.',
    ],
  },
  {
    v: '0.118.0', date: '2026-10-04', title: 'Timber camps and detailed props',
    notes: [
      'Bandit camps are enclosed by tall sharpened timber palisades, with open north and south entrances.',
      'Treasure chests and camp stashes have wooden planks, curved lids, metal bands, hinges, locks and carrying handles. Dungeon lids still open on their hinges.',
      'Village halls, ancient facilities, power controls and the crashed ship use the elder\'s CRT computer model with a keyboard and separate case.',
    ],
  },
  {
    v: '0.117.0', date: '2026-10-03', title: 'City posts and rival factions',
    notes: [
      'Each ruined city has sixteen spaced-out enemy posts instead of hundreds. At most three nearby posts are awake at once, with smaller fixed groups.',
      'A defeated post stays quiet for ten real minutes of active world time. Reinforcements wait until you move away from the post. Casualties and wounded survivors persist when you leave, reload or join multiplayer.',
      'Random wilderness encounters no longer spawn inside cities: their fixed garrisons provide the threat.',
      'Robots and wildlife can attack nearby bandits, who can fight back. Robots and wildlife never target or damage each other. Players remain hostile targets for all three groups.',
      'Melee, shots, delayed robot bursts and artillery follow faction rules. Enemy-on-enemy kills do not grant the player direct gold, kill credit or kill-based quest progress.',
    ],
  },
  {
    v: '0.116.0', date: '2026-10-03', title: 'Ravines and rough country',
    notes: [
      'Dry mainland ravines are 50–100 metres wide and 320–600 metres long, with steep walls and a flat bottom. Two broad paths descend along their walls so you can walk down and back out without jumping.',
      'Use a Bridge Kit beside a ravine to stake out a vehicle-width crossing. Bring the materials to its sign; completed bridges carry people and cars over the gap and are shared in multiplayer.',
      'Local boulder fields contain dense clusters of large rocks that block vehicles, encouraging off-road detours. Existing roads and the starting area remain clear.',
      'Generated ravines and boulders also appear in existing worlds; terrain around saved structures can change. A new world is recommended.',
    ],
  },
  {
    v: '0.115.0', date: '2026-10-03', title: 'Across the great seas',
    notes: [
      'Each world has two or three large continents separated by wide seas. Long sea crossings give boats and coastal transport a purpose.',
      'There are twelve large ruined cities instead of ten, spread evenly between the continents. Each still has four underground entrances.',
      'Old industrial installations are searched for on dry continents, including distant shores; their previous narrow distance bands no longer force them into water.',
      'Gridholm remains on the home continent, with dry land around the starting area. Small offshore islands and the polar ice remain.',
      'This changes generated terrain and settlements in existing worlds. Start a new world for a fresh exploration of the new geography.',
    ],
  },
  {
    v: '0.114.1', date: '2026-10-03', title: 'Anchored armoured defences',
    notes: [
      'Ship interiors now use stationary mounted security turrets instead of walking robot guards. Labyrinth turrets also stay anchored: only their aiming head turns.',
      'Heavy armour increases turret health from 8 to 32 and absorbs half of incoming damage. Their fixed housing and mounting brace are clearly visible.',
      'Turrets maintain automatic fire every 0.45 seconds while a player remains visible in range. Walls and closed doors still block shots.',
    ],
  },
  {
    v: '0.114.0', date: '2026-10-03', title: 'Small steps and ancient defences',
    notes: [
      'Ruin stairwells now have real 25 cm steps. Walk or sprint up and down without jumping.',
      'The single descent on floors 1 and 2 is now a marked staircase near the return stairs, rather than a flat hatch. The three-floor limit remains.',
      'Labyrinths contain automatic ancient turrets mounted in walls, floors and ceilings. Their sensors warn before firing; walls and closed doors block their shots.',
      'Shoot or strike a turret to destroy it. Destroyed defences stay gone after reloading and their destruction is shared in multiplayer.',
      'These ancient defences use a reusable mount and model specification for future player construction. Building these mounted variants is not available yet.',
    ],
  },
  {
    v: '0.113.0', date: '2026-10-03', title: 'Three floors, one way down',
    notes: [
      'Ruin and city-vault labyrinths have at most three floors. Floors 1 and 2 each have exactly one descent; floor 3 has none.',
      'The descent is in the starting room, close to the stairs back up. Press E to descend one floor instead of falling automatically.',
      'Upstairs leads back one floor at a time, with the first floor returning to the surface entrance. There are no side-sector passages.',
      'Old saves deeper than floor 3 resume on floor 3. Natural caves and crashed ships keep their existing layouts.',
    ],
  },
  {
    v: '0.112.0', date: '2026-10-03', title: 'Beneath the ruined cities',
    notes: [
      'Every large ruined city has four underground entrances, spread across its streets and marked with cyan VAULT signs. Approach an entrance and press E.',
      'Each entrance leads to its own single-level labyrinth with stairs back to the same entrance. There are no passages into deeper levels or neighbouring sectors.',
      'Entrances and their labyrinths stay the same when you reload a save or explore together in multiplayer.',
    ],
  },
  {
    v: '0.111.2', date: '2026-10-03', title: 'A way out of the labyrinth',
    notes: [
      'Ruins now have one self-contained level. The four passages into neighbouring sectors and the automatic hatch into deeper levels are gone.',
      'Every ruin level has stairs back to the surface near its entrance, reachable without unlocking the guardian gates.',
      'If your save is already deep inside an old ruin, its rooms and saved loot stay in place, with a direct surface exit added.',
      'Natural cave systems and crashed ships keep their existing layouts.',
    ],
  },
  {
    v: '0.111.1', date: '2026-10-03', title: 'Multiplayer consistency fixes',
    notes: [
      'World changes now return to everyone, including the player who made them. Independent property edits and different dungeon openings are preserved when players act together.',
      'Only one player at a time can search a shared chest or locker. The next player sees what remains, and the chest becomes available when its visitor closes it or disconnects.',
      'The server resolves competing passenger and gunner seat requests. Drivers and riders keep their existing roles; removed vehicles release their passengers.',
      'Joining applies the current shared dungeon progress after changing worlds. Hosted games retain their shared world while everyone is disconnected, until the server restarts.',
      'Servers and clients must both update to this version. Vehicle ownership, raiders, dungeon drones and bosses retain their existing multiplayer limitations.',
    ],
  },
  {
    v: '0.111.0', date: '2026-10-28', title: 'Shared foes',
    notes: [
      'On a server everyone now fights the same enemies: creatures, robots and bandits (field spawns, camps, city garrisons, village raids, wreck guards) are the same for every player in a place.',
      'The first player in an area brings the foes; the others see them move, see their shots fly and can shoot them. Whoever lands the killing blow gets the kill, the loot and the bounty.',
      'Foes go for whichever player is nearest, so a friend can draw them off you.',
      'Not shared yet: raider vehicles, dungeon drones and bosses. If the player who brought a group of foes leaves, those foes go with them.',
    ],
  },
  {
    v: '0.110.0', date: '2026-10-27', title: 'The cities swarm',
    notes: [
      'The dead cities are no longer empty: machines of the old world guard their streets in squads, gnawers nest in the rubble and scavenger gangs hold out in the ruins. The closer to a city\'s core, the more of them and the bigger the groups.',
      'Each city has hundreds of such groups at fixed places along its streets. They wake as you come within about 100 m, so walking through a city means fighting street by street, often with several groups at once.',
      'A group you have wiped out stays quiet for about 45 game minutes, then something moves back in.',
      'Bring friends, a vehicle with a cannon, and plenty of ammunition.',
    ],
  },
  {
    v: '0.109.0', date: '2026-10-26', title: 'One world for everyone',
    notes: [
      'On a server everyone now plays in one shared world. What one player does to it, the others see within a second or two.',
      'Shared: the villages (walls, defences, farms and crops, works, power stations, plant upgrades, improvements, the village hall\'s stock, standing), the markets, bridges, piers and boats, the great installations, the Chariot, the contents of chests and what has been looted or unlocked in the ruins, felled trees and picked plants, cleared bandit camps and what became of the caravans.',
      'Your own things stay yours: your kit, gold, level, quests and contracts, your map and the plans you have found, your vehicles and the chest in your house.',
      'The first player to join a server who already played its world brings their progress along; everyone after that joins the shared world. Your own single-player save waits for you as before ("Back to my own world").',
      'If two players change the same thing at the same moment, the later change wins.',
    ],
  },
  {
    v: '0.108.0', date: '2026-10-25', title: 'Room for one more',
    notes: [
      'In multiplayer you can ride along in another player\'s vehicle: walk up to its door and press E to take a free seat, the passenger\'s or the gunner\'s. E gets you out beside it, V switches between the chase view and the view from your seat.',
      'Keys 1, 2 and 3 move you between the free seats: the driver\'s, the passenger\'s and the gunner\'s. The wheel stays with the vehicle\'s owner.',
      'In your own vehicle you can change seats too. Away from the wheel nobody drives, so the vehicle rolls to a stop.',
      'From the gunner\'s seat you work the roof cannon: aim it with your view and fire. The others see it turn. While a friend stands at your cannon, the driver no longer fires it.',
      'Everyone sees who sits where. If two players reach for the same seat at once, the later one moves to another free seat or gets out.',
    ],
  },
  {
    v: '0.107.0', date: '2026-10-24', title: 'Leave it on the ground',
    notes: [
      'Drop in the backpack no longer destroys the item: it is laid on the ground at your feet, as what it is, and E picks it up again.',
      'In multiplayer everyone in the same place sees what you put down and can pick it up: this is how you hand over gear, weapons, food or wheels to a friend. The note says who left it.',
      'Only the first to reach for an item gets it, so nothing is ever doubled. A worn part keeps its condition.',
      'On a server the items stay on the ground for 6 hours, even if you leave, and survive a server restart. Playing alone, they lie there until you leave the game.',
    ],
  },
  {
    v: '0.106.1', date: '2026-10-23', title: 'Shared vehicles',
    notes: [
      'In multiplayer you now see the other players\' vehicles: the ones they bought or found, parked where they left them, and the one they drive, with the driver sitting at the wheel instead of floating in the air.',
      'Other players\' vehicles block your way like any other, but only their owner can drive them, open the trunk or service them.',
      'Other players move more smoothly: they are drawn a fifth of a second behind, between the last updates, so uneven packets no longer make them stutter and jump.',
    ],
  },
  {
    v: '0.106.0', date: '2026-10-23', title: 'The server list and the cryo-pods',
    notes: [
      'Multiplayer on a dedicated server now shows a list of its game servers: each with its name, who is playing, and whether it is running or paused. Pick one and press Join, or create your own with a name (in a fresh world or in yours).',
      'A server runs while anyone is on it and pauses when the last player leaves: its clock stands still until somebody comes back.',
      'Going to the menu no longer takes you out of the game: your character stays where you left it, marked (in menu), and the world keeps running for the others.',
      'You were never the pilot. Commander Ilse Varga flew the SV-9 Kestrel and did not survive the crash: she lies slumped over the console. The survey team slept in cryo-pods in the cabin, and you wake from one of them.',
      'Every castaway has their own cryo-pod: the more players on the server, the more pods stand open.',
      'When you die you wake up again in your cryo-pod aboard the ship, healed and with some strength back.',
      'Players with an older version of the game are told to reload the page (Ctrl+F5) before joining.',
    ],
  },
  {
    v: '0.105.1', date: '2026-10-22', title: 'A quicker start',
    notes: [
      'The game starts much faster: working out where the great installations stand took several seconds when the menu first appeared, freezing the menu and the name field. It now runs in the background while you play.',
    ],
  },
  {
    v: '0.105.0', date: '2026-10-22', title: 'The dead cities',
    notes: [
      'Ten great ruined cities of the old world now stand on the planet, each a kilometre or more across: walking through one takes minutes. The nearest two lie 4 to 8 km from Gridholm, the others further out.',
      'Every city is laid out its own way: a plain grid of blocks, a warped old town, a city of rings and spokes round a plaza, or a grid cut by diagonal boulevards. Each has its own block sizes, its own core of towers and its own share of fallen buildings.',
      'Streets with kerbs and sidewalks, centre lines and crossings, lamp posts (some bent or down) and wrecked cars. Buildings show their floors and window bays; their crowns are broken, the gutted towers stand as bare frames of columns and slabs with beams hanging, and the fallen ones are heaps of rubble.',
      'The cities are dangerous: the danger there is two steps higher than around them. Buildings block your way, your shots and the sight of whatever hunts you.',
      'The maps show the cities you have seen: their outline and name, and the streets and buildings of the parts you have explored.',
      'No villages, temples, crash sites or camps stand in a city, and rivers and roads go round them, so some worlds have a few villages fewer and some rivers run elsewhere.',
    ],
  },
  {
    v: '0.104.1', date: '2026-10-21', title: 'A good neighbour',
    notes: [
      'The server now installs beside other apps on the same machine without touching them: its own folder, its own copy of Node.js, its own port (8517 by default; the installer stops if it is taken) and no changes to any web server, proxy or firewall.',
      'The game works behind a portal or reverse proxy at a sub-path, such as https://your-domain/gridworld/: the page, the server info and the multiplayer connection all follow the page\'s own address.',
    ],
  },
  {
    v: '0.104.0', date: '2026-10-21', title: 'A server of its own',
    notes: [
      'GridWorld can run on its own server (a VPS) that stays up: one program serves the game to the browser and runs the multiplayer. Nobody has to host any more: the world belongs to the server.',
      'Opened from such a server, the main menu shows the server\'s name and who is online, and one button: Join the server. Type your hero\'s name, join, then Play.',
      'The server\'s world has a fixed seed and its own clock, which keeps running and is saved, so the day goes on while everyone is away.',
      'Setting it up on a fresh Ubuntu or Debian VPS takes one command (deploy/install.sh; with a domain it also gets https). SERWER.md explains it, and there is a Dockerfile too.',
      'Your hero is still saved in your browser, and enemies, loot and villages are still each player\'s own.',
    ],
  },
  {
    v: '0.103.0', date: '2026-10-20', title: 'Together (multiplayer, first step)',
    notes: [
      'Multiplayer: up to 8 castaways in one world. The player who starts the game with start-gry.bat presses Host a game in the main menu; friends on the same network open the host\'s address in their browser (start-gry.bat prints it, e.g. http://192.168.1.20:5173) and press Join.',
      'The host\'s world and clock are everyone\'s. A friend whose own world is another one comes over to the host\'s; their own save is kept, and Back to my own world in the menu brings it back.',
      'You see the others walking about the open world, or in the same dungeon sector, each in their own colour with their name over their head and what they hold in their hands.',
      'Chat: press T while playing online, type, Enter to send. Who joins or leaves shows in the chat and the log; the badge in the corner says how many are online.',
      'If the host leaves, the player who has been in the game longest hosts it. Enemies, loot and the villages are still each player\'s own for now: sharing them comes in the next steps.',
    ],
  },
  {
    v: '0.102.0', date: '2026-10-19', title: 'Wings and fins',
    notes: [
      'Skitterwings: small beaked fliers that now and then turn up in flocks of three to five in the near wilds. They flutter a few metres up, follow you once they have seen you and swoop down one or two at a time to peck. One hit brings one down.',
      'The sea is alive. Sea Lurkers roam it with their dorsal fin cutting the surface: swim within their reach and one circles in, lunges and bites, then comes again. From a boat they only circle. They are found from the danger-1 ring outwards, two together far out.',
      'Shoals of Silverfin drift near the surface, dart away from anyone close and now and then leap out of the water. They are harmless.',
      'New food: Raw Fish (250 kcal, fine raw), from Silverfin and Sea Lurkers; what a sea creature leaves floats on the surface. Jan buys it.',
    ],
  },
  {
    v: '0.101.1', date: '2026-10-18', title: 'Solid tools',
    notes: [
      'The hatchet, the pickaxe and every other hand tool are solid now: you no longer see the world through them, in your hands or lying on the ground.',
      'Every hand tool has its own model in your hands (hammer, saw, screwdriver, pliers, welder, torch, shovel), not a plain box, and its own model when dropped.',
    ],
  },
  {
    v: '0.101.0', date: '2026-10-18', title: 'Tools in your hands',
    notes: [
      'A tool in the backpack is not enough any more: the Hatchet, the Pickaxe and the building tools work only while you hold them in your hands.',
      'At a tree or a rock with the right tool in your backpack, E takes it into your hands (your weapon goes on your back); then hold E to work. The backpack has a Take in hands button for every tool.',
      'The hatchet or pickaxe you hold is drawn in your hands, at rest and while you swing.',
      'Building on a claim: the first tool of a part (the hammer for wood) must be in your hands, the others carried; taking a part down needs its tool in your hands.',
      'The compass, the sensor compass and the GPS tablet still work from the backpack.',
    ],
  },
  {
    v: '0.100.0', date: '2026-10-17', title: 'Armour, packs and exoskeletons',
    notes: [
      'Two new slots on your body: Pack and Frame.',
      'Bigger packs: the Hide Rucksack (55 L, any blacksmith makes it from hides and rope), the Frame Pack (70 L, Woven Armour plans) and the Composite Cargo Pack (90 L, Composite Armour plans). You cannot take a big pack off while the backpack holds more than it would without it.',
      'Exoskeletons: the Salvage Exoframe (Exoframes plans: steel, machine parts, wire, hide) lets you carry 15 kg more with ease and 20 kg more before you are overloaded, walk 6% faster and spend a fifth less stamina. The Powered Exoskeleton (Automation plans, parts of the old plants) adds 30 / 40 kg, 12% more speed and 40% less stamina.',
      'Armour in three kinds, each a full set of head, body, gloves, legs and feet: hide (any blacksmith, from hides), woven cloth over wire (Woven Armour plans) and composite shells of plastic, alloy and ceramic (Composite Armour plans). The composite set stops about half of every hit; its body piece beats plate armour at less than half the weight.',
      'Three new technologies to find: Woven Armour, Composite Armour and Exoframes.',
    ],
  },
  {
    v: '0.99.0', date: '2026-10-16', title: 'Rounds, new arms, GPS and field repairs',
    notes: [
      'Ammunition is limited now. Every gun keeps its own magazine and reloads from the rounds in your backpack: Energy Cells for the Blaster, Pistol Rounds, Shotgun Shells and Rifle Rounds. With none left, R does nothing.',
      'At first rounds are only found: in chests, bandit stashes and camps, on fallen bandits and robots, in raider wrecks, crashed ships and the lockers in the toxic fog. The ship\'s locker holds a first box of cells. Old characters get 120 Energy Cells.',
      'New firearms: the Old Pistol, the Scrap SMG, the Scattergun (seven pellets a shot) and the Hunting Rifle (a 3× scope, hits hard, loud). New melee weapons: the Machete (quick and light), the Spear (long reach, a thrust) and the Sledgehammer (slow, crushing, tiring). Found out there; Oskar sells some and buys them back.',
      'New technology to find: Gunsmithing. With its plans the blacksmith makes pistol rounds, shells and rifle rounds from lead, industrial chemicals and scrap or steel, and all four new guns. With Battery Chemistry plans he fills Energy Cells from basic batteries; with Forged Tools he forges the machete, spear and sledgehammer.',
      'The GPS Tablet (Radio Triangulation plans: circuits, glass, a lead battery and a power core): your exact position, altitude and heading under the compass, and a waypoint: right click on the world map to set it, again on it to clear it. The compass and the maps mark it.',
      'The Vehicle Repair Kit (Kuba sells it; Combustion Engines plans let the blacksmith make it): use it by one of your vehicles or while driving to patch the hull, the engine and every fitted wheel in the field. It cannot bring back a wreck.',
    ],
  },
  {
    v: '0.98.1', date: '2026-10-15', title: 'Measuring the economy',
    notes: [
      'Nothing changes in play. New tools behind the scenes measure what every good of the old plants costs, what the orders pay and how long the whole road to the Chariot takes, ready for the balance pass once the remaining changes are in.',
    ],
  },
  {
    v: '0.98.0', date: '2026-10-14', title: 'The last buyer',
    notes: [
      'The Chariot of the Ancients now wants what only the old plants make. Hull Plating: steel, aluminium and ancient alloy. Main Engines: ancient alloy, precision components and cable. Avionics: circuit boards, microchips, sensors and cable. Heat Shield: advanced ceramics and ancient alloy. Propellant as before.',
      'A sixth stage, the Power System (power cells, microchips, cable), goes in before the propellant. Once done, racks of cells stand by the Chariot\'s cradle with a cable into its belly.',
      'Old saves: a stage you finished stays finished. Crates you gave to an unfinished stage that it no longer takes are waiting for you in Gridholm\'s village hall.',
    ],
  },
  {
    v: '0.97.0', date: '2026-10-13', title: 'What the old parts are for',
    notes: [
      'Village improvements: ask the elder "What could the old parts do for us?" and build them from the village hall\'s stock. Battery Bank (power cells, batteries): gives power back at night and in a lull, and stands as racks of cells by the power plant. Battery Lamps: the village takes 15 kW instead of 25, and its lamps stay lit when the plant is down. Automated Site (automation units, precision components): the industry site makes half as much again and needs no hands. Sensor Sights (sensors, microchips): the wall turrets see half as far again and fire faster. Armoured Wall (aluminium, advanced alloy, on a stone wall): raids break on it more often and a live raid wears the gates down slower.',
      'The power halls of the old plants take Cell Racks: 160 kW on power cells, a crate for 8 hours of work. A hall now runs any two sets together when one is not enough.',
      'The Old Radar Station takes a sensor array once restored (sensors, microchips, cable): it hears 20 km instead of 12.',
      'New orders at the blacksmith: the Precision Drivetrain (plans for Precision Manufacturing: +20% top speed, +25% acceleration, half the engine wear from knocks; fits an engine upgrade slot) and the Sensor Compass (plans for Advanced Sensors: the compass strip also points to the nearest old installation not yet restored and the nearest toxic fog you have found).',
      'The Automated power plant level now also wants 2 precision components.',
    ],
  },
  {
    v: '0.96.0', date: '2026-10-12', title: 'The top of the chain',
    notes: [
      'The Old Precision Works (18 to 28 km from Gridholm): a barrel-vaulted hall full of machine tools, a lattice test tower and a white measuring dome. Restored, it makes Precision Components from steel, Ancient Alloy and microchips (160 kW).',
      'The Old Robotics Plant (20 to 28 km), the greatest of the Ancient works: an assembly hall like a hangar, a gantry yard, three giant robot arms on their pedestals, a walled test arena with a walker frozen mid-step, and a control tower. Restored, the arms rise and one of them turns, and it makes Automation Units from microchips, sensors, precision components and power cells (200 kW: its boiler and diesel sets together).',
      'Their cores want the plans for Precision Manufacturing and Automation, two new technologies on data carriers far out. As at the other old plants, you bring every crate and every fuel yourself.',
      'Villagers now tell of both in their rumours of old machines; they stand clear of the polar ice.',
    ],
  },
  {
    v: '0.95.0', date: '2026-10-11', title: 'Giants of the old world',
    notes: [
      'Every great installation of the Ancients now stands twice as big: halls, towers, tanks, furnaces, stacks, fences and power halls. You see them from far off and they tower over you when you walk in. They stand where they always stood; the control desks stay at a person\'s height by the gate.',
      'Two more of them: the Old Optical Works (14 to 24 km from Gridholm: glass-roofed grinding halls, a crystal-growing tower and a row of annealing kilns) and the Old Alloy Complex (16 to 26 km: a towering casting hall, two arc furnaces crowned with electrodes, twin stacks and heaps of slag).',
      'The optical works makes Sensors from glass, Rare Earths and chemicals (130 kW). The alloy complex makes Ancient Alloy from steel, aluminium and nickel, or, set to it at the desk while its bay is empty, 2 crates of Advanced Ceramics from clay, aluminium and chemicals (180 kW). As at the others, you bring every crate yourself.',
      'Their cores want the plans for Advanced Sensors (8 to 16 km out) and Ancient Metallurgy (16 to 30 km), two new technologies on data carriers.',
      'New: Sensors, Ancient Alloy and Advanced Ceramics. The Chariot of the Ancients will want them.',
    ],
  },
  {
    v: '0.94.0', date: '2026-10-11', title: 'The fuel works and the cell works',
    notes: [
      'Two more great installations of the Ancients stand far out on the continent: the Old Propellant Plant (10 to 18 km from Gridholm: spherical tanks on legs, two distillation columns, a flare stack and a bunkered mixing house) and the Old Battery Plant (14 to 22 km: a long hall under a sawtooth roof, electrolyte tanks and a brine basin). Villagers within 16 km tell of them; console `sites` shows where they are.',
      'Both are restored like the others, in three stages at the control desk (steel, cement, machine parts; then cable, circuit boards, chemicals and the power hall; then the core, which wants the plans for Rocket Propellant Synthesis or for Power Cell Chemistry, a new technology on a memory card 8 to 16 km out).',
      'Nothing comes to them by itself: you bring every crate. The propellant plant blends 3 crates of Rocket Propellant a batch from fuel canisters, Industrial Chemicals and sulfur (120 kW: the coal boiler alone is enough). The battery plant makes Power Cells from lithium, nickel, copper ingots and chemicals (150 kW: the coal boiler and the diesel sets together).',
      'Rocket Propellant now comes only from the Old Propellant Plant: the village Chemical Works makes Industrial Chemicals only (a works that was blending propellant switches to chemicals; what was made stays in its bay).',
      'New: Power Cells, and cell orders: salvage villages 5 km and more from Gridholm order them on some days and pay well, like the chip and fuel orders.',
    ],
  },
  {
    v: '0.93.0', date: '2026-10-11', title: 'The old plants need power',
    notes: [
      'The Old Enrichment Plant and the Old Chip Foundry now run on power of their own: each has a power hall by the gate, a burnt-out shell until the second stage of the restoration brings it back as a generator house with a stack, a coal bin and a fuel tank.',
      'A batch runs only while the hall gives the plant\'s draw: 100 kW for the chip foundry (the coal boiler or the diesel sets alone), 200 kW for the enrichment plant (both together, or the plant\'s own reactor on the rods it makes, 250 kW). Load coal, fuel canisters or fuel rods into the hall\'s bunkers at the control desk; the sets burn only while a batch is under way.',
      'New inputs: the enrichment plant makes fuel rods from uranium ore and Industrial Chemicals; the chip foundry makes microchips from glass, copper ingots, Industrial Chemicals and Rare Earths.',
      'The restoration stages follow the old plants\' real needs: first the structure (steel, cement, machine parts), then the systems and the power hall (cable, circuit boards, machine parts, chemicals, and glass for the foundry\'s filters), then the core as before. Stages already restored stay restored.',
      'The control desk shows the plant\'s own screen: power given and drawn, every input in the hopper, what it makes and when the next batch is due, or why it waits.',
    ],
  },
  {
    v: '0.92.0', date: '2026-10-11', title: 'Power for industry',
    notes: [
      'A village\'s industry site now draws power: fields 3 kW, fish racks 3, a sawmill 8, oil wells and a salvage yard 10, a mine and workshops 12, a refinery 30. It is fed after the village and its farms and before the works.',
      'Without power a site makes only half of what it could; how well it was powered over the last day counts, so solar nights and wind lulls even out. Mend the power plant, upgrade it or build a power station and the village\'s goods pile up faster in its hall, sell cheaper and come in bigger shares.',
      'The villages\' own power plants are a little stronger (55 kW for a generator or solar array, 52 for wind turbines) so a plant in good repair runs the village and a small site.',
      'Villagers now patch up their own power plant: wear alone never takes it below 60%, and what a lost raid did to it mends over four days. Mending it yourself still brings it to 100%.',
      'The elder\'s power talk and the village computer\'s POWER tab show the site\'s draw, how much of it it gets now and over the last day, and what that does to its output.',
    ],
  },
  {
    v: '0.91.0', date: '2026-10-11', title: 'Village works for every step',
    notes: [
      'Eight new works the elder can build outside the fence (still two per village): the Sawmill (timber into lumber), the Brickworks (clay and coal into bricks), the Cement Works (limestone and coal into cement), the Textile Mill (flax fibre or wool into cloth), the Steelworks, the Polymer Plant, the Aluminium Works and the Battery Works. Each has its own look: an open saw shed, a ring kiln with a tall stack, a rotary kiln and silos, a brick mill with rows of windows, a converter and a steel hall, reactors and a column, a long potroom with roof vents, a casting shed with acid tanks.',
      'Steel is made in two steps now: the Smelter smelts iron ore into iron bars (and copper and lead ore into ingots), and the Steelworks blows iron into steel with coal and limestone.',
      'Advanced Alloy (the old hull alloy) is cast at the Alloy Foundry from steel, aluminium and nickel. Aluminium comes from the new Aluminium Works, batteries from the Battery Works, and the Polymer Plant makes twice the plastic a refinery gets from the same crude, with chemicals.',
      'Some works need the old plans: the Steelworks (Blast Furnace), the Chemical Works and the Polymer Plant (Industrial Chemistry), the Electronics Shop (Basic Circuits), the Machine Shop (Forged Tools), and three new technologies on data carriers: Aluminium Processing and Battery Chemistry (3 to 8 km out) and Alloy Metallurgy (8 to 16 km). The elder lists the works anyone can build first. Works you have already built keep working.',
      'Two new farm crops: Flax (fibre) and Sheep (wool), for the Textile Mill. New goods: Bale of Flax Fibre and Bale of Wool.',
      'Bricks, cement and lumber go into building now: the new works, the Smelter and the Glassworks take bricks, the Stone Wall takes cement, the Coal Power Station bricks and cement, the Small Reactor cement.',
      'Works that were making something they no longer make switch to their first recipe.',
    ],
  },
  {
    v: '0.90.0', date: '2026-10-11', title: 'New raw materials and goods',
    notes: [
      'The land gives more: Clay (dug by some farming and fishing villages), Limestone and Lead Ore (some mining villages) and Lumber (sawn boards from some timber villages). They are made there, trade at every market and pile up in those villages\' halls like their other goods.',
      'A new rare deposit: Nickel Ore, from about 10 km out. Villages that stand by one dig it for friends, like the other rare materials.',
      'Seven new processed goods, traded at every market: Iron Bars, Pallets of Bricks, Sacks of Cement, Industrial Chemicals, Aluminium Ingots, Lead Ingots and Basic Batteries.',
      'The works you know can make them for now: the Smelter smelts iron and lead, the Glassworks fires bricks from clay and burns cement from limestone, the Chemical Works makes industrial chemicals from crude oil, salt and sulfur, the Alloy Foundry smelts bauxite into aluminium, and the Electronics Shop fills batteries from lead and chemicals. Works take the rare materials (sulfur, bauxite) into their hoppers too.',
      'The item sheet of a rare material says what it is worth to the works.',
      'This is the first step of the new economy: dedicated works (sawmill, brickworks, steelworks, chemical plant...) and uses for the new goods come next.',
    ],
  },
  {
    v: '0.89.2', date: '2026-10-11', title: 'The economy plan',
    notes: [
      'The download now includes PLAN_GOSPODARKI.md (in Polish): the agreed plan for the next big step of the economy, from new raw materials (clay, limestone, lead, nickel) and village works (sawmill, brickworks, cement, iron foundry, steelworks, chemical plant, aluminium works, batteries) through power for industry, six new great installations of the Ancients with their own power halls, to a Chariot that needs the whole planet\'s industry. No change to the game itself.',
    ],
  },
  {
    v: '0.89.1', date: '2026-10-11', title: 'The game described',
    notes: [
      'The download now includes OPIS_GRY.md and OPIS_GRY.pdf (in Polish): what GridWorld is, its story and goal (the castaways and the Chariot of the Ancients), every system of the world, what is ready and what is still to come, the plan ahead, and every version so far in order. No change to the game itself.',
    ],
  },
  {
    v: '0.89.0', date: '2026-10-11', title: 'Greater temples',
    notes: [
      'The alien temples are half as big again: taller bodies and pylons, a wider ring of broken walls, longer arms and a longer avenue of bigger obelisks. You see them from much further off. (Their places in the world moved a little.)',
      'No more invisible walls round places: a vehicle now stops only at what really stands there, the temple\'s walls, pillars, obelisks and the fallen pieces lying about, a crashed ship\'s hull, a camp\'s crates. You can drive round a temple, up its avenue to the portal, and park right by it. The stairwell down still keeps vehicles out.',
      'Developer console: the planet map is now opened with `map` and shows every toxic fog zone as a lime ring (found while the map is open); click one to be put at its edge. Rivers no longer draw stray lines across the map where they cross the planet\'s seam.',
    ],
  },
  {
    v: '0.88.1', date: '2026-10-10', title: 'Wiktor waits to be spoken to',
    notes: [
      'Wiktor no longer starts talking the moment you come near. He stands outside the wreck calling into the hatch ("Hello? Is anyone in there? Come out, I am a friend!") until you walk up and talk to him (E).',
      'Then he introduces himself and tells you to look through your ship once more and take everything you can carry. Talk to him again when you are ready and he sets off for Gridholm.',
      'On the way he points out what you pass, left or right: old ruins (dangerous, treasure below, but not today), other crashed ships, bandit camps, the Chariot\'s hangar, a lake with clean water. He never stops for them: keep walking.',
    ],
  },
  {
    v: '0.88.0', date: '2026-10-10', title: 'A welcome at the wreck',
    notes: [
      'A new character is no longer left to find Gridholm alone: Wiktor, a scout of Gridholm who saw your ship fall, waits outside the wreck. Step out and he greets you, begs you not to shoot and walks you to the village gate, stopping to wait and call when you fall behind, and chatting on the way.',
      'At the gate he sends you to Elder Maciej, Marta at the tavern and Oskar the smith, then walks on into the village.',
      'He cannot be hurt: shots and blades pass him by, and shooting near him only makes him shout. You can talk to him with E, the quest tracker shows where he is taking you and the maps and compass mark him.',
      'Characters that already know the way are not met again.',
    ],
  },
  {
    v: '0.87.0', date: '2026-10-09', title: 'Item icons and tooltips',
    notes: [
      'Every item now has its own small line icon in the backpack, chests, trunks, the vehicle service and wherever items sit in slots, with its name under it instead of a two-letter code (the count sits in the corner).',
      'Hover the mouse over any item to see its full sheet: what kind of thing it is, what it does, its numbers (weapon damage and fire rate, how much armour takes off, what an attachment changes, calories and water of food), weight and bulk (and of the whole stack), the shop or market price, and what it is used for: what the blacksmith makes from it, what it is processed or cooked into, and which buildings, repairs, restorations and Chariot stages need it.',
      'Shop, market, village hall and building lists show the icons too, with the same sheet on hover.',
    ],
  },
  {
    v: '0.86.0', date: '2026-10-08', title: 'Toxic fog',
    notes: [
      'Small islands now rise out of the open seas, a few km offshore and further out: somewhere to sail to.',
      'Some of them lie under a heavy green toxic fog, and so do patches of land far out, 15 km and more from Gridholm. You see the fog banks from a distance; inside, the air goes thick and green and the fog burns your lungs quickly without protection.',
      'The Gas Mask (a new Face slot in your backpack) keeps it out while its filter lasts: a Mask Filter lasts about five minutes in the thickest fog, longer in thin fog. Spare filters in your backpack are screwed in when one is spent, or use one to swap it. The bar at the top shows how thick the fog is and what is left of the filter.',
      'The mask and its filters are made by any village blacksmith once you have recovered the plans for Filter Masks (a new technology, on a data disk 3 to 8 km out): mask from 2 hides, a Leechwing membrane and 2 scrap; 2 filters from 2 logs and a scrap.',
      'In the middle of every fog stands a contaminated site: an old army depot, a research lab or a crashed probe. Their sealed lockers hold rare things: power cores, electronics, relics, engine parts, spare filters.',
      'Fog you have found is marked on the maps as a dashed lime ring.',
    ],
  },
  {
    v: '0.85.0', date: '2026-10-07', title: 'Sailboats and motor boats',
    notes: [
      'Two new boats on your piers\' slips, beside the rowboat: the Sailboat (24 logs, 30 nails, 14 rope, 6 Ravager hides) and the Motor Boat (14 logs, 18 nails, 4 rope, 10 scrap, 2 engine parts).',
      'The Sailboat sails on the wind of the weather: Space raises and lowers the sail, W lets the sheet out and S hauls it in, A/D work the rudder. It is fastest with the wind on the beam and cannot sail into the wind: tack across it. The prompt tells you how the wind comes and whether to let out or haul in. With the sail down you row with the spare oars. Its mast will not pass under a bridge. Hold: 24 slots.',
      'The Motor Boat is the fastest on the water, against wind and current: W/S throttle and reverse, A/D steer. It burns fuel: R pours a Fuel Canister (from its hold or your backpack) into the 40 L tank; a new one comes with 10 L. Hold: 18 slots.',
      'The materials guide (SUROWCE.md / .pdf) now lists bridges, piers and boats.',
    ],
  },
  {
    v: '0.84.0', date: '2026-10-06', title: 'Rowboats',
    notes: [
      'Your finished piers have a slip: at the pier\'s sign choose to build a rowboat (10 logs, 14 nails, 4 rope, handed over bit by bit). When it is done it is launched beside the pier\'s head. You can keep up to three boats.',
      'E beside your boat gets you in. Row with W (S backs water), turn with A/D; the boat also turns on the spot, one oar against the other. Rowing tires you: out of breath you only row weakly. V switches between the seat and a view from behind.',
      'Rowboats go wherever the water is deep enough: the sea, rivers and lakes. A river\'s current carries you along; the boat runs aground in the shallows and will not pass under a pier. You can row under bridges.',
      'E aboard steps you out onto a pier, a bridge, a bank or a beach beside the boat; with nowhere dry, press E again to go over the side. The boat stays where you left it.',
      'Every boat has a hold of ten slots: F beside it or aboard opens it.',
      'Your boats show on the minimap and the big map.',
      'Out on the water the distant ranges on the horizon no longer stand in dark blocks over the sea.',
    ],
  },
  {
    v: '0.83.0', date: '2026-10-05', title: 'Piers on the coast',
    notes: [
      'New item: the Pier Kit (survey stakes, a sounding line and a float), 90 gold at the blacksmith. Stand on a beach, use it and look out to sea: a hologram shows a pier running straight out from the beach until the water under its head is 1.8 m deep (deep enough for a boat). Click to stake it out, right mouse or Esc to cancel.',
      'The hologram turns red and says why when it cannot go there: no sea in front of you (piers are not for lakes and rivers), water too shallow for 45 m, a shore too steep, a village or another place too close, or another pier.',
      'Build it like a bridge: bring logs, stones, nails, rope, some scrap and wire to its sign on the beach and hand them over bit by bit. While it is unfinished you can pull up the stakes and get everything back.',
      'A finished pier has a planked deck on piles ramping up from the beach, and a wider head with bollards, a lamp and a crate: E at the crate stores goods there. Walk or drive out onto it. Boats will tie up here when they come.',
      'Piers show on the minimap and the big map like bridges.',
    ],
  },
  {
    v: '0.82.0', date: '2026-10-04', title: 'Bridges anywhere',
    notes: [
      'New item: the Bridge Kit (survey stakes, a line and a plumb), 80 gold at the blacksmith. Use it from your backpack by a river: a hologram shows the bridge straight across the water from the bank you stand on, with its piles and ramps. Click to stake out the site, right mouse or Esc to cancel.',
      'The hologram turns red and says why when a bridge cannot go there: the river is too wide (over ~24 m), the banks are too steep, it runs out into the sea there, two rivers meet, a village or another place is too close, or another bridge or bridge site is.',
      'A staked-out site works like a ford\'s: bring logs, stones, nails and rope to its sign and the bridge rises as you hand them over. While it is unfinished you can pull up the stakes: what you handed over and the kit come back.',
      'Bridges now show on the minimap and the big map: built ones as a white bar across the river, your unfinished sites dashed in gold.',
    ],
  },
  {
    v: '0.81.1', date: '2026-10-03', title: 'Save check for bridges',
    notes: [
      'The save tests now cover the bridges you build. No change to the game itself.',
    ],
  },
  {
    v: '0.81.0', date: '2026-10-03', title: 'Bridges at the fords',
    notes: [
      'Every ford where a road crosses a river is now a bridge site: survey stakes and a line across the water, and a BRIDGE SITE sign at both ends.',
      'At a sign press E to open the building window: the length of the deck and what the bridge takes (logs, stones, nails and rope, more for a wider river). Hand over what you carry, bit by bit; materials in the trunk of a vehicle parked by the site count too. The piles rise and the logs pile up as the work goes on.',
      'When everything is in, a timber bridge stands: piles in the river bed, beams, a planked deck well above the water, ramps down to both banks and a rail each side. Walk or drive across dry; caravans roll over it too. You can still swim under it.',
      'Finishing a bridge gives experience by its length. Bridges stay built for good.',
    ],
  },
  {
    v: '0.80.0', date: '2026-10-02', title: 'Rivers',
    notes: [
      'Rivers now run across the land: from the uplands down to the seas, gathering tributaries on the way, winding through valleys they have cut. Each has a name (you see it at the top when you are by one). A world has well over a hundred of them, some kilometres long.',
      'They grow as they go: a small stream at the head, a broad river of 20-30 m by the mouth, deeper in the middle. The water runs downstream: swim in it and the current carries you along.',
      'River water is fresh: you can drink it and fill a flask from it.',
      'Where a road meets a river it crosses at a shallow ford: you can wade it, and the Scout and the Mastodon drive through. Bridges will come later.',
      'Rivers keep clear of Gridholm (the land round it is as it was) and of every village. Ruins, camps, crash sites, lakes, wells, mountain trails, caves and the great installations keep clear of the rivers.',
      'The maps show the rivers: the minimap and the big map, the map boards in the villages (as wide as they are), and the dev world map.',
      'Note for old saves: the rivers change the land further out, so some far places you knew may have moved or gone. Gridholm and its surroundings are untouched.',
    ],
  },
  {
    v: '0.79.0', date: '2026-10-01', title: 'Seas',
    notes: [
      'The planet now has seas: a few great bodies of salt water that together cover about a quarter of the land between the ice caps. Every world has its own; the land round Gridholm is as it was, the nearest coast is at least a few kilometres off.',
      'The land slopes down into them: beaches and shallows along the shore, deep water further out. The sea has its own blue colour, a shoreline and slow ripples, and the distant ranges on the horizon give way to open water where the sea lies.',
      'You can swim in the sea, but it is salt: you cannot drink it or fill a flask from it. Vehicles stop where it gets too deep. Boats will come later.',
      'Villages, ruins, bandit camps, crash sites, lakes, wells, roads, trails, caves, the great installations and trees all keep to dry land. Roads go round the seas.',
      'The maps show the seas: the minimap and the big map in blue, the map boards in the villages too, and the dev world map (console) the seas of the whole planet.',
      'Note for old saves: the seas change the land further out, so some far places you knew may have moved or gone. Gridholm and its surroundings are untouched.',
    ],
  },
  {
    v: '0.78.2', date: '2026-09-30', title: 'The materials guide as a PDF',
    notes: [
      'The download now also includes SUROWCE.pdf: the same guide to materials, processing and builds, laid out for reading and printing. No change to the game itself.',
    ],
  },
  {
    v: '0.78.1', date: '2026-09-30', title: 'A guide to materials',
    notes: [
      'The download now includes SUROWCE.md (in Polish): every raw material and where to get it, what the works, the great installations, the blacksmith and the food shop make of them, everything villages can build and what it takes, and an index of where each material is used. No change to the game itself.',
    ],
  },
  {
    v: '0.78.0', date: '2026-09-29', title: 'Food from the village',
    notes: [
      'The food shop in every village now cooks from what the village has in its hall: bread from grain, hearty stew from potatoes or carrots, boiled eggs from the hens, cups of milk and cheese from the cows.',
      'A crate from the hall makes several portions (10 loaves, 8 stews, 12 servings of eggs, 10 cups of milk or 5 wedges of cheese). The shop shows how many are ready and where they come from; what the village has not got, the shop has not got.',
      'Without grain in the hall the grocer still bakes a little bread from bought flour, at double the price. Water is always there.',
      'New food: Boiled Eggs (300 kcal), Cup of Milk (250 kcal, water +25) and Cheese (900 kcal).',
    ],
  },
  {
    v: '0.77.0', date: '2026-09-29', title: 'What the farms grow',
    notes: [
      'Every farm now grows what you choose at the elder\'s farms panel: Wheat (grain), Carrots, Potatoes, Hens (eggs) or Cows (milk). Farms you had grow wheat and potatoes by turns until you change them.',
      'The harvest goes into the village hall: about 3 to 5 crates a day per farm, more on rich soil and half as much again with steel ploughs, up to 60 crates of each, then that farm rests. The hall\'s terminal and the farms panel show what is in.',
      'Sowing another crop keeps what was harvested so far; the new one starts from the day you choose it.',
      'The fields show it: grain or leafy rows with a scarecrow, or a pasture with a coop and hens, or a byre and cows.',
      'New goods: Basket of Eggs and Churn of Milk (not traded at markets yet). Next: the village shop makes food from the hall\'s stock.',
    ],
  },
  {
    v: '0.76.0', date: '2026-09-29', title: 'One store for every village',
    notes: [
      'The village hall is now the village\'s only store. The storehouse by the industry site is gone (with its tiers, the shipments and the convoy): what the village makes piles up in its hall, up to 60 crates of each good, and while it is at that the work stops. At the site a carrier stacks the crates on a loading pallet.',
      'Every build draws on the hall\'s stock, never on your backpack: the wall, the refinery, turrets and barricades, works and power stations, farms and steel ploughs, the power plant upgrades, and the blacksmith\'s orders. Store the materials at the hall\'s terminal; each panel shows what the hall has and what it still lacks, and its button builds from the stock.',
      'The village\'s own goods count too: a build that needs what the village makes takes it from the hall.',
      'The market, the elder\'s share and haul contracts sell only the village\'s own goods, never what you stored. The market sells them wholesale while the hall is nearly full of them.',
      'Repairs, loading works and power station bunkers, and the great installations still take what you carry.',
    ],
  },
  {
    v: '0.75.0', date: '2026-09-29', title: 'Village halls',
    notes: [
      'Every village has a storage hall outside its north wall, west of the north gate, with a terminal inside against the back wall.',
      'At the terminal you move things into the village\'s stock: from your backpack, from your vehicles parked by the hall, and crates you set down on the hall\'s floor. Store one, all of a kind, or everything at once; take anything back out whenever you like.',
      'The hold takes 6000 litres. Crates stack up along its walls as it fills.',
      'The terminal also shows the village\'s own goods waiting in its industry storehouse, which belong to the same stock.',
      'Next: the village\'s builds (farms, the power plant, works, walls, the blacksmith\'s orders) will draw on this stock.',
    ],
  },
  {
    v: '0.74.0', date: '2026-09-29', title: 'The radar station',
    notes: [
      'A third great installation stands 18 to 28 km from Gridholm: the Old Radar Station, a compound with a bunker, a lattice tower, a guyed mast and a generator shed. Its dish lies on its back in the grass.',
      'Restore it at its control desk in three stages: clearing the compound (logs, stone, scrap), power and cable (copper cable, steel, electronics), and the dish and the console (circuit boards, electronics, hull alloy, and the plans for Radio Triangulation).',
      'The station changes as you work: the rubble at the bunker door goes, the snapped mast stands whole, the shed gets its roof and cables run to the bunker and the tower; restored, the dish goes up on its tower and turns.',
      'A restored station makes nothing, but its sweep copies every village, ruin, wreck and camp within 12 km onto your map (and any great installation in reach). Sweep again at the desk whenever you like.',
      'Villagers within 16 km of it tell of it when asked about old machines.',
    ],
  },
  {
    v: '0.73.0', date: '2026-09-29', title: 'Chips for the Chariot',
    notes: [
      'The Chariot\'s avionics now need 6 crates of Microchips from the Old Chip Foundry, and 8 circuit boards instead of 14 (cable and glass as before). Its flight computers want chips no works can etch, so the way home now runs through the foundry.',
      'The hangar crew unload microchips like any other crate; the desk and the village computer show the new row.',
      'Saves that already gave more than 8 circuit boards to the avionics keep the stage at 8 of 8.',
    ],
  },
  {
    v: '0.72.0', date: '2026-09-29', title: 'Word of the old plants',
    notes: [
      'Ask the villagers about old machines within 16 km of a great installation and they tell you of it first: the Old Enrichment Plant or the Old Chip Foundry, with the distance and direction from their village.',
      'The lead goes on your map and compass as a lime diamond (data carriers stay violet) and into the quest tracker, until you reach the place.',
      'Lead labels at the edge of the big map are no longer cut off.',
    ],
  },
  {
    v: '0.71.0', date: '2026-09-29', title: 'What chips are for',
    notes: [
      'A village\'s own power plant has a third upgrade: Automated, 2.5 times what it made as built. It needs 4 crates of Microchips from the Old Chip Foundry, 4 copper cable and 2 electronic components (the elder\'s power plant option). An automated plant gets a control cabinet with a lit screen and a radio mast.',
      'Craft villages 3 km and more from Gridholm order Microchips for their radios and tools: 1 to 4 crates on most days, from about 680 gold a crate (more in the dangerous lands), due in 3 to 6 days. The orders are posted at their stores and on notice boards up to 20 km away.',
      'The Old Chip Foundry\'s control desk lists the three nearest workshops that buy chips and what they order today; the village computer marks them.',
    ],
  },
  {
    v: '0.70.0', date: '2026-09-28', title: 'The chip foundry',
    notes: [
      'A second great installation stands 12 to 20 km from Gridholm: the Old Chip Foundry, a sealed clean-room block with a tank farm and a water tower. Console `sites` shows where.',
      'Restore it at its control desk inside the gate, in three stages: opening the block (logs, stone, scrap), air and water (glass, copper cable, steel), and the etching line (circuit boards, electronics, a power core, and the plans for Integrated Circuits).',
      'The foundry changes as you work: the rubble and the slab over the air lock go, the fallen roof corner is mended, fans turn on the roof, the water tower gets its roof back, and once it runs its windows glow.',
      'A restored foundry makes a crate of Microchips from 2 glass panes and 1 copper ingots every 4 game hours. Load each input and collect the chips at the desk.',
      'The Old Enrichment Plant keeps working as before; its hopper now shows its ore the same way.',
    ],
  },
  {
    v: '0.69.0', date: '2026-09-28', title: 'Fuel orders',
    notes: [
      'A few villages far out (8 km and more from Gridholm) still run an old reactor of their own. Most days they post a fuel order: 1 to 3 crates of Nuclear Fuel Rods, due in 3 to 6 days, paid far better than anything else (from about 520 gold a crate, more in the dangerous lands).',
      'Fuel orders are posted at the village\'s store and on the notice boards of villages up to 20 km away, and handed over at the village\'s store like any other order.',
      'The Old Enrichment Plant\'s control desk lists the three old reactors nearest to it and what they order today.',
      'The village computer marks villages with an old reactor (VILLAGES) and shows today\'s order in its own village (VILLAGE).',
    ],
  },
  {
    v: '0.68.0', date: '2026-09-28', title: 'Small reactors',
    notes: [
      'A new power station: the Small Reactor, 250 kW of steady power, more than any other. The elder offers it among the power stations once you have the plans for Uranium Enrichment (steel, hull alloy, copper cable, electronics, power cores and 2000 gold).',
      'It burns the Nuclear Fuel Rods made by the Old Enrichment Plant: its core holds 4 crates, and one crate lasts 4 days while it is switched on.',
      'Drawn outside the fence as a concrete dome with a turbine hall, a squat cooling tower and a fence round it.',
      'The village computer\'s POWER tab now lists the old installations: how far each is restored, and where it lies from the village.',
    ],
  },
  {
    v: '0.67.0', date: '2026-09-28', title: 'The plant wakes',
    notes: [
      'The Old Enrichment Plant has a control desk just inside its gate. Press E there to see the restoration: three stages, each handed over bit by bit from your backpack or a vehicle parked by the plant.',
      'Clearing the rubble (logs, stone, scrap), the centrifuge hall (steel, cable, electronics) and the core (power cores, alloy, electronics, and the plans for Uranium Enrichment from an old data carrier). Each stage pays gold and xp.',
      'The plant changes as you work: the rubble and toppled centrifuges go, the fence is mended, the hall gets its walls and a new roof, and once restored its windows and centrifuges glow.',
      'A restored plant turns 3 crates of uranium ore into a crate of Nuclear Fuel Rods every 6 game hours. Load the ore and collect the fuel at the desk (hopper 30, bay 10).',
    ],
  },
  {
    v: '0.66.0', date: '2026-09-28', title: 'The dead plant',
    notes: ['Far out on the continent, 15 to 25 km from Gridholm, stands the first of the old world\'s great installations: the Old Enrichment Plant, where ore was once made into reactor fuel. Every world has it in its own place, on bare, level ground.',
      'A broken fence with a warning sign at the gate, the centrifuge hall with its fallen corner and bare roof trusses, rows of centrifuges inside (some toppled), two cooling towers (one snapped off) and a tall stack. You can walk into the hall.',
      'Once you have explored its ground it shows on the maps as a lime hexagon. Bringing it back to life comes in the next update.'],
  },
  {
    v: '0.65.0', date: '2026-09-28', title: 'Far-off riches',
    notes: ['Many villages away from Gridholm stand by a deposit of a rare material the old industries needed: bauxite from about 3 km out, sulfur from 5 km, lithium brine from 8 km, rare earths from 11 km and uranium only from 15 km. The rarer it is, the further out it first turns up and the fewer villages have it.',
      'A village shares its deposit with those it trusts: 1 crate a day to someone Known, 2 to a Friend, 3 to the Honoured, besides its usual goods (ask the elder what the village can spare). Near Gridholm there are none: the rare things mean going far.',
      'The village computer shows each village\'s deposit (VILLAGE and VILLAGES). The rare crates are not traded at the markets; the great works of later updates will need them.'],
  },
  {
    v: '0.64.0', date: '2026-09-28', title: 'More current',
    notes: ['Every village\'s own power plant can now be upgraded twice. Ask the elder: "Could our power plant give more?".',
      'Overhauled (×1.5 power): 6 scrap, 4 wire and 2 logs. Wind turbines need the old plans for the Improved Wind Rotor and a solar array those for Solar Cells; a diesel generator needs no plans. Rebuilt with old electronics (×2): 4 electronic components, a power core and 6 wire, found in the ruins and wrecks.',
      'The upgrades show: longer blades on the turbines, another row of panels and battery cabinets by a solar array, a second stack, a radiator bank and a second generator set by a diesel plant. More power means the farms keep their pumps running and the works more hours in the day. Each upgrade earns the village\'s trust.'],
  },
  {
    v: '0.63.0', date: '2026-09-28', title: 'Steel and current',
    notes: ['Farms now need power: 3 kW each for the irrigation pumps and lamps, taken from the village\'s power before any works get theirs. A farm that gets no power feeds only 60% of what it could, so a village\'s power plant matters to its people too (the share over the last day counts, so solar nights and wind lulls even out).',
      'With the old plans for Steel Ploughs, the elder can fit a farm with steel ploughs and a pump (5 scrap and 4 wire, handed over bit by bit). With power it feeds 1.6 times as many people; it draws 8 kW, so a village with several such farms will want a power station.',
      'When the farms lose power the village shrinks towards what they can feed, slowly, and grows back once the power returns. The farms panel, the elder\'s power talk and the village computer (POWER) show what the farms draw and get. An upgraded field has a pump mast and a steel plough at its edge.'],
  },
  {
    v: '0.62.0', date: '2026-09-28', title: 'Fields',
    notes: ['Ask the elder: "Could we clear land for a farm?". Bring 8 logs and 6 stones (in your backpack or the trunk of a vehicle parked by the village; bit by bit is fine) and the villagers clear a field outside a corner of the wall, fence it and sow it. Up to 3 farms per village.',
      'Each farm feeds more people (15, more on rich soil, fewer on poor). Over the next days the village grows to that number, so it has more hands at work: its fields, mine or workshops put out more, its storehouse fills faster, and so does your share.',
      'A new farm also earns the village\'s trust. Metal ploughs and farms that need power come later.'],
  },
  {
    v: '0.61.0', date: '2026-09-28', title: 'The people behind the walls',
    notes: ['The few villagers you meet stand for many more: every village now has its own population, 40 to 90 people (Gridholm 70), and a share of them work its fields, mine or workshops.',
      'The workers drive the output: fewer hands, less from the land and a slower storehouse. Villagers killed in a raid are missed, and a village overrun by bandits loses about an eighth of its people. Over the following days the numbers grow back.',
      'The village computer (VILLAGE) shows the people, the workers and the staffing; the elder mentions them too. Farms that feed more people come next.'],
  },
  {
    v: '0.60.0', date: '2026-09-28', title: 'Standing',
    notes: ['Every village now remembers what you have done for it. Raising its wall, building defences, a storehouse, works or a power station, mending the power plant or the industry site, beating off a raid, fulfilling a delivery contract or a notice of its board all earn its trust.',
      'Trust opens its storehouse. Known (25 trust): the elder spares you 2 crates a day of what the village makes, free. Friend (60): 4 a day. Honoured (100): 8 a day. Ask the elder: "What can the village spare me?". The share renews every midnight and comes out of the storehouse, so it is still bounded by what the village makes.',
      'The village computer shows your standing in each village. The market with its prices stays as it was, side by side.'],
  },
  {
    v: '0.59.0', date: '2026-09-28', title: 'The smith\'s trade',
    notes: ['Crafting by your own hand is set aside for now: things are made in the villages. The blacksmith no longer lends you his workbench, and a workbench you set up in the wilds can only be packed up.',
      'Instead every blacksmith makes the basics from what you bring, no plans needed: a hatchet and a pickaxe from wood and stone, a fire kit, a flask from a hide. Everything finer needs the old plans: hammer, saw, screwdriver and pliers now come with Forged Tools.',
      'Electronics, engine parts, tires and plating come from the plans (Basic Circuits, Combustion Engines, Wagon Axles, Blast Furnace), from the shops or from what you find out there.'],
  },
  {
    v: '0.58.0', date: '2026-09-28', title: 'Old plans, new work',
    notes: ['The recovered plans are good for something now. Ask the blacksmith: "Make something for me." He makes whatever the plans you found show, from the materials you bring him, on the spot.',
      'Forged Tools: hatchet, pickaxe, hammer, saw. Timber Framing: planks and nails. Blast Furnace: scrap metal and wire from iron ore. Basic Circuits: electronic components from copper ore, and compasses. Wagon Axles: light tires and hull plating. Combustion Engines: engine parts and turbochargers.',
      'Plans he has no use for (farming, power, chips, radio, chemistry, uranium, rocket fuel, rail) are for the villages themselves; they come later. The old workbench and forge crafting still works for now.'],
  },
  {
    v: '0.57.0', date: '2026-09-28', title: 'Word of mouth',
    notes: ['Ask around: the innkeeper, the elder, the guard, the vehicle dealer and the villagers now answer "Seen any old machines out there?". Someone always has a story: a shepherd who sheltered in a ruin, a cousin who dug by a wreck, hunters back from a cave, and a violet light where the old data lies.',
      'Each story is a lead to a real data carrier, the nearest one to that village that you have not found yet (villagers know of places up to 12 km away). It is marked on your map and compass with a violet diamond and listed in the tracker until you take the carrier.',
      'Two open leads at a time: until you follow one up, people keep reminding you of the nearest instead of telling you more. Ask in villages further out to learn of the rarer knowledge.'],
  },
  {
    v: '0.56.0', date: '2026-09-28', title: 'Lost knowledge',
    notes: ['The old civilisation\'s knowledge is not gone, only scattered. Sixteen technologies survive as plans on old data carriers (floppy disks, data disks and memory crystals), each lying in one fixed place of the world: the first vault of a ruin, a crashed ship or a cave. Look for a violet beam over a small pedestal and take the carrier with E.',
      'The simpler knowledge (farming, timber framing, wind rotors, tools) lies within a few km of Gridholm; circuits, furnaces and solar cells further out; chips, radio navigation and engines further still; the rarest (uranium, rocket propellant, rail lines) far out on the continent.',
      'Every village computer has a new ARCHIVE tab: the plans you have recovered and how many are still lost at each level.',
      'For now the plans are only recorded: what each one unlocks comes in the next updates.'],
  },
  {
    v: '0.55.0', date: '2026-09-28', title: 'Castaways',
    notes: ['You are no longer from here. A new character starts with an opening drawn in the game\'s own lines: your survey ship, the Kestrel, cruising the outer belt of an uncharted system, a meteor stream out of nowhere, the hit that tears off a wing, the tumble into a strange planet\'s gravity and the burning fall through its air. Space, Enter or a click skips it.',
      'You wake in the wreck a few hundred metres out of Gridholm, at the end of the furrow it ploughed. Smoke rises from the torn roof and the crumpled engine and an emergency lamp blinks inside. Search the locker for the survival kit (medkits, water, bread, a fire kit and a compass) and read the flight recorder at the console: what happened, what is left of the ship, and what the scanners saw on the way down.',
      'The villagers do not care about the stars. Only you, and the other castaways who will one day come down beside you, want the Chariot of the Ancients to fly: it is your way home.',
      'Characters that already exist skip the opening. The wreck stays where it fell for everyone.'],
  },
  {
    v: '0.54.1', date: '2026-09-25', title: 'The road to the launch, reworked',
    notes: ['No launch-night attack after all. Instead the Chariot will stop you three times: the hangar crew finds it cannot go on without a part that only one of the wonders of the Ancients can give, and you have to leave the Chariot and restore that wonder first. Each lies further out than the last, so nobody reaches the launch without the side roads.',
      'Timed again by the player bot: about 80 hours alone, of which some 35 go into those three wonders; around 50 hours with a friend and 33 with four.'],
  },
  {
    v: '0.54.0', date: '2026-09-25', title: 'The road to the launch (behind the scenes)',
    notes: ['The whole campaign is planned out: the Chariot of the Ancients in five stages, twenty wonders of the Ancients over the continent to restore, and surprises on the way that you will not see coming. Twice the hangar crew will find that the Chariot cannot go on without a part only a far-off wonder can give, and on the night of the launch the bandits come for the hangar.',
      'Each world has its own surprises, the same for every player on it. A player bot has timed the whole road: about 80 hours alone, around 50 with a friend and 32 with four, plus well over 200 hours of optional wonders.',
      'Not in the game yet: next it gets built in.'],
  },
  {
    v: '0.53.0', date: '2026-09-25', title: 'Regional projects and new materials (behind the scenes)',
    notes: ['The economy simulator now trades real goods: new materials (bauxite, sulfur, lithium, rare earths, uranium; aluminium and batteries), villages that rise from settlement to town, city and metropolis by gathering goods, works they build by what pays and what they need, upkeep in machine parts, and what their people use every day.',
      'Twenty wonders of the Ancients are spread over the continent, one for each region; the villages of a region build theirs together, but the last stage of every wonder needs relics that only you can bring out of ruins and wrecks.',
      'None of it is in the game yet: the simulator shows how it all would behave over two years of game time, with and without players, before we build it in.'],
  },
  {
    v: '0.52.0', date: '2026-09-25', title: 'Villages that live on their own (behind the scenes)',
    notes: ['Groundwork for villages that grow by themselves: people who eat, work and need houses, farms that feed them, works that earn gold, guards who want wages, upkeep that rises as a village grows, bandit raids, and an elder who spends the treasury on what the village needs most.',
      'Nothing of it shows in the game yet: first it runs in a simulator, all the villages of a world for months of game time, so the numbers can be tuned before your villages depend on them. In the tests every village lives through two years, grows several times over and levels off without starving or dying out.'],
  },
  {
    v: '0.51.4', date: '2026-09-25', title: 'Village wells',
    notes: ['The well in the middle of every village is now the same old stone well you find out in the wilds: an octagonal wall with water inside, two posts, a crossbar with a rope and bucket, and a little roof.'],
  },
  {
    v: '0.51.3', date: '2026-09-25', title: 'Screenshots on the website',
    notes: ['The website shows screenshots from the game and says plainly that this is a very early version: much may still change, and multiplayer for about 8 players is being worked on now.'],
  },
  {
    v: '0.51.2', date: '2026-09-25', title: 'Website fix',
    notes: ['The website and the browser version of the game now publish properly.'],
  },
  {
    v: '0.51.1', date: '2026-09-25', title: 'The Gridworld website',
    notes: ['Gridworld has a website: what the game is about, the numbers of the planet (its size, villages, roads, ruins, wrecks), the economy, the Chariot of the Ancients and where the game is heading. It also lets you play the game straight in the browser.'],
  },
  {
    v: '0.51.0', date: '2026-09-25', title: 'People in vehicles',
    notes: ['Whoever rides in a vehicle is now seen in it: you at the wheel when you drive, the raiders\' driver and gunner, the drovers and gunners of the caravans. Everyone who gets in takes the next free seat, so you can see at a glance how many are aboard (the vehicle panel counts them too). Every vehicle has three seats: the driver, a passenger and a gunner standing at the roof cannon.',
      'The Mastodon\'s cab has real windows now, and the Scout\'s roll cage is taller, with a steering wheel in front of the driver.',
      'Shots go where they are aimed. A shot through a window or over the side of an open Scout hits the person inside; anywhere else it hits the vehicle. This works both ways: bandits aim at you behind the wheel, and a closed cab only protects the parts of you that are behind metal.',
      'Kill a raider vehicle\'s gunner and its cannon falls silent. Kill the driver and it rolls to a stop, the rest of the crew bails out, and the vehicle is left almost whole for you to take.'],
  },
  {
    v: '0.50.0', date: '2026-09-25', title: 'The village computer',
    notes: ['Every elder\'s hall now has a computer on a desk by the shelves. Press E in front of it to log on.',
      'VILLAGE: what the village makes and wants, the condition and output of its site, how full the storehouse is and when the convoy leaves, the works and what they are doing, the defences, and the last and next raid.',
      'POWER: how much power the village makes, how much it uses itself and how much is left for the works; each source and station, which works get power, and a forecast of the free power over the next 24 hours with the weather.',
      'TRADE: your delivery contracts, whom you have lately bought from and sold to, the caravans leaving and arriving on the village\'s roads over the next day, and this market\'s prices.',
      'VILLAGES: every village you have explored, traded with or that shares a road with this one: how far, what it makes and wants, its wall, and the works it has built. CHARIOT: how far the Chariot of the Ancients has come.'],
  },
  {
    v: '0.49.0', date: '2026-09-25', title: 'Weather',
    notes: ['The weather changes now: clear skies, overcast, rain, fog and thunderstorms. Each part of the world has its own weather, and fronts drift in and out over the hours rather than switching at once. Fog likes the early morning.',
      'Rain falls in streaks slanted by the wind. Cloud banks drift overhead and grey the sky, hiding the stars and the sun. Fog closes in until the far hills vanish. In a thunderstorm, forked lightning strikes out in the land and lights up the whole sky.',
      'The clock in the corner shows the weather. For now it only changes the look of the world; later it may strike, tear at roofs and dim the solar farms.'],
  },
  {
    v: '0.48.0', date: '2026-09-25', title: 'Day and night',
    notes: ['The sky now really changes with the day. At night it is black and full of stars; as the sun comes up the horizon glows amber, and by day the sky turns a bright, hazy green, lighter towards the horizon and glowing round the sun. Dusk brings the amber back before the dark.',
      'The land fades into the horizon\'s colour, and by day you see further. The sun shines brighter by day, and the moon no longer shows as a dark hole in a daytime sky.',
      'Solar farms follow the same sun: full power at noon, none at night.'],
  },
  {
    v: '0.47.0', date: '2026-09-25', title: 'Power stations, and the Chariot of the Ancients',
    notes: ['Works need electricity now. A village\'s own little plant only just keeps its lamps and homes going, so a works without a power station stands idle. The elder shows the power balance: what the village makes, what it takes itself, and which works get power (in the order they were built).',
      'Build power stations through the elder, two per village: a Solar Farm (by day only), a Wind Farm (as the wind blows; the turbines turn), a Coal Power Station and a Diesel Generator Bank. The last two give steady power as long as you keep their bunkers filled with coal or fuel. E at a station shows its output and lets you load the bunker or switch it off.',
      'The locals call the shuttle in the Old Hangar the Chariot of the Ancients. Nothing is bought or sold there any more: bring the processed goods it needs to the hangar, in your backpack or a vehicle parked by it, and the crew unload them straight onto the Chariot. The desk shows how far the repair has come.'],
  },
  {
    v: '0.46.0', date: '2026-09-25', title: 'Works, processed goods and the shuttle',
    notes: ['Processing is now the way to earn. Nine new processed goods (steel, copper ingots, plastic resin, glass, copper cable, circuit boards, machine parts, hull alloy, rocket propellant) are worth far more than the raw goods they are made from.',
      'Any village can put up any works, two per village: a smelter, an oil refinery, a glassworks, a wire mill, an electronics shop, a machine shop, an alloy foundry or a chemical works. Ask the elder ("Could we build works here?"), bring the materials and pay the builders. Once it stands it is yours to run: load its hopper with crates (from your backpack or vehicles parked by the village), pick what it makes, and collect the output.',
      'Villages still differ in what their land gives: ore, coal, copper, oil, timber, fish and salt, and now quartz sand from mines and lake shores. Farming villages have better or poorer fields. Rich fields grow a surplus, so their food is plentiful and cheap.',
      'North-east of Gridholm stands the Old Hangar, and in it a shuttle from before the machines woke. Repairing it is the long goal: hull plating, main engines, avionics, heat shield and propellant, each needing processed goods that no field, mine or robot will give you. The desk in the hangar takes your crates and pays well for every one, and you can watch the shuttle come back together.',
      'Two ruins next to Gridholm may have moved a little to make room for the hangar.'],
  },
  {
    v: '0.45.0', date: '2026-09-25', title: 'Wall-walks, wall turrets and barricades',
    notes: ['A timber palisade or a stone wall now has a wall-walk: a plank walkway on posts along the inside, with ladders up to it (E to climb) and a hand rail. Stand on it with the wall at your chest and shoot over it at raiders.',
      'The elder can have auto turrets mounted on the wall (up to six, starting by the gates). Bring a Turret Kit (Oskar sells them again), electronic components, wire and scrap; the village pays you for each. The turrets pick off bandits, creatures and robots outside the walls.',
      'The elder also wants barricades round the village\'s works (the fields, mine, refinery...) and round the power plant: sandbag walls with steel hedgehogs and spiked timber. Behind them bandits do much less damage, both in the raids you fight and in the ones you miss.',
      'The palisade\'s stakes are a little shorter, so you can see over them from the wall-walk.'],
  },
  {
    v: '0.44.0', date: '2026-09-24', title: 'Doors that open, and a house to buy',
    notes: ['Village doors are real now: they swing open and shut (E), a shut door blocks your way and your shots, and it hides the room behind it.',
      'Shops, the Elder\'s Hall and the tavern stand open by day, from 06:00 to 21:00. At night the shops and the hall are locked, while the tavern is only shut. Folk\'s houses are shut: you may open them by day, but at night they are locked. A door you open or close stays that way until the next dawn or dusk.',
      'The house in Gridholm is no longer yours for free: it is for sale. Buy it from Elder Maciej for 750 gold to unlock its door, use its bed and chest, and wake in your own bed after a bad day. If you already kept things in its chest, it stays yours.',
      'Building outside the villages is closed for now, including setting up a workbench in the wilds (existing ones still work). Use a village blacksmith\'s forge instead.'],
  },
  {
    v: '0.43.0', date: '2026-09-24', title: 'Loot that looks like what it is',
    notes: ['Things you drop or knock loose no longer float about as spinning dice. They lie on the ground as what they are: logs with cut ends and growth rings, stacked planks, stones, ore lumps streaked with iron or copper.',
      'Kills leave recognisable remains too: hides spread flat with their legs, curved fangs, long gnawer incisors, armour plates, wing membranes and meat on the bone.',
      'Robot scrap is a bent plate with a cog and a pipe end, electronic components are circuit boards, and a power core is a ringed cell. Mushrooms, fruit pods, crystals, bread, flasks, tools, coils of wire and rope, nails and trade crates each have their own shape.'],
  },
  {
    v: '0.42.0', date: '2026-09-24', title: 'Hard work: chopping, mining and ore',
    notes: ['Chopping a tree and breaking a rock is now real work. Hold E and your hero swings the hatchet or pickaxe (you see it in your hands), about one blow a second. A small tree takes around 6 seconds and a big one 15. Let go and your progress is kept while you stay.',
      'Some rocks carry veins of iron (rust streaks) or copper (green-blue streaks). They are rare near Gridholm and common in the mountains. Mining a vein takes longer and gives ore lumps besides the stones, and a mined-out vein takes 4 days to come back.',
      'At the forge, iron ore smelts into scrap metal and wire, and copper ore becomes electronic components. At any workbench, 8 lumps and 2 planks pack into a crate of ore for the markets. Oskar buys ore lumps.',
      'Crafting takes time: a progress bar fills while you work (planks 5 s, tools 5 s, forge work 6–8 s). Craft ×5 makes a batch after batch; closing the window stops the work without wasting materials.'],
  },
  {
    v: '0.41.0', date: '2026-09-24', title: 'Shipments, and a name of your own',
    notes: ['A full storehouse no longer stands still for good. The village offers its load to you first: a Shipment, a big haul to another village that pays better than the usual ones, posted at the store and on the notice board.',
      'If nobody takes the shipment within 12 hours, the village sends its own convoy, which empties most of the storehouse, and the works start up again. The elder tells you when the convoy leaves.',
      'Or run your own caravan: while a storehouse is nearly full, the market sells the goods the village makes wholesale, 20% off, and has more of them. Buy them up and sell them wherever they pay best.',
      'Name your hero in the main menu before you play. Innkeepers, smiths, guards, merchants and villagers now greet you by name.'],
  },
  {
    v: '0.40.0', date: '2026-09-24', title: 'Villages of many shapes',
    notes: ['Villages are no longer all square. Each has a wall of its own shape: square, hexagonal, octagonal or twelve-sided, with watch towers (and ladders) at its corners. Gridholm stays square.',
      'In villages that are not square, the houses and shops arrange themselves in a ring round the plaza, each facing the middle, pushed out towards the wall and clear of the lanes from the gates. Hexagonal villages have gates to the north and south only.',
      'The fence, the palisade and the stone wall all follow the shape, and the maps draw every village with its own outline.'],
  },
  {
    v: '0.39.0', date: '2026-09-24', title: 'Workers, storehouses and tribute',
    notes: ['Villagers now work every industry site: they hoe the fields, swing picks at the mine, hammer at the pumps, benches and racks, and one carries the crates, one at a time, to the storehouse at the corner of the site.',
      'Every village keeps what it makes in a storehouse. The crates stack up in front of its door as it fills, the caravans take some away, and the goods you buy at the market come out of it. When it is full, the work stops: the workers stand about and the site stands still.',
      'The elder commissions a bigger storehouse: a Storage Shed holds 40 crates, a Warehouse 100, a Depot 220. Bring the materials a load at a time and the village pays you when it is built. A bigger storehouse means more goods to buy and trade. E at a site shows how full its storehouse is.',
      'Bandits now send a rider before they raid, demanding a tribute: more from a village with a full storehouse and a strong band, less behind a better wall. Pay it at the elder or the captain of the guard and they leave you be. The quest tracker shows the demand and the deadline. Villages you are not at sometimes pay too.',
      'Refuse, and they come. Their gunners shoot at the wall, wearing down the defences, and at any villager caught in the open; the dead are missed for a couple of days. Lose the fight and they tear down part of the wall on their way out: it drops a tier and has to be raised again.'],
  },
  {
    v: '0.38.0', date: '2026-09-24', title: 'Creatures and machines go down',
    notes: ['Killed creatures fall instead of vanishing. Ravagers stumble on, slide to a stop and roll onto their side with their legs kicking. A Bramble\'s legs fold under its weight and it sinks down nose first. Gnawers flip onto their backs. A Leechwing drops out of the sky tumbling and lands with its wings spread.',
      'Destroyed robots break down. They shudder and throw sparks while their lights flicker. Bipeds topple over, walkers\' legs splay and the body drops, and the Repair Drone falls out of the air. They hit the ground with a blast that can tear an arm off a heavy machine, then lie there smoking and dark.',
      'The dead stay on the ground for a few seconds, drained of colour, then sink away. They no longer count as foes the moment they die.'],
  },
  {
    v: '0.37.0', date: '2026-09-24', title: 'Bandits fall',
    notes: ['Killed bandits no longer vanish in a puff. The body flashes white, the weapon flies from the hand (a shield too) and clatters to the ground, the knees give, and the bandit topples away from the blow: backwards when hit from the front, forwards from behind, with a small bounce as he lands.',
      'Bodies lie along the ground, even on a slope. Their colour drains away, and after a few seconds they sink into the ground with their weapons. The Bandit Boss falls a little slower, and his name tag goes when he does.',
      'Bandits shot by caravan guards fall the same way.'],
  },
  {
    v: '0.36.0', date: '2026-09-24', title: 'Hands on the weapons',
    notes: ['People now have proper arms with elbows, and their hands hold what they carry. A bandit with a rifle holds it in both hands, the barrel lowered while he walks, and shoulders it to fire; it kicks with every shot, and the bolts come out of its muzzle.',
      'Some gunners carry a pistol instead: held low at their side, then raised in one outstretched hand to shoot.',
      'Bruisers carry a sword, and half of them a round shield. They hold the blade on guard, then wind up over the shoulder and slash down across you. The blow now lands with the slash, not the moment they reach you. A raised shield takes half the damage of shots from the front, so go for their flank.',
      'The Bandit Boss carries a longer rifle with a scope. Raider crews keep their hands on the wheel and the cannon\'s handles.',
      'Jakub and the other guard captains hold their spear upright at their side, with their shield on the other arm, and villagers swing their arms as they walk.'],
  },
  {
    v: '0.35.0', date: '2026-09-24', title: 'Furnished houses',
    notes: ['The metre-sized blocks inside the village houses are gone. Every shop now has a panelled counter with an overhanging top and shelves of jars, boxes and bottles behind it, and the wares of the house on the counter: mugs and a keg in the tavern, tongs and a hammer at the smithy, a balance in the general store, baskets of produce and a loaf at the grocer\'s.',
      'The tavern has tables with benches on both sides and barrels behind the bar. The smithy has a stone forge with a glowing mouth and a hood up through the roof, an anvil and a quenching barrel. The store and the grocer\'s have crates, sacks and barrels.',
      'The Elder\'s Hall has a desk with a book and a candle, two chairs for visitors, benches along the walls and bookshelves. The houses have a bed, a table with stools and a shelf, and your own house in Gridholm now has a table and a shelf besides your bed and chest.',
      'You walk round the furniture, and the way from each door to the counter stays clear.'],
  },
  {
    v: '0.34.0', date: '2026-09-24', title: 'Timber houses and new faces',
    notes: ['Village houses are rebuilt as timber-framed houses, like the bases: thin plank walls on a sill with corner posts, windows with open shutters, a doorway with the door standing open, gabled roofs with shingles and an overhang, boarded gables and chimneys. Shops have an awning over the door and the Elder\'s Hall a bell turret. The houses are smaller and lower than the old blocks, so the villages feel less cramped.',
      'Gridholm\'s residents have new names: Elder Maciej, Oskar the blacksmith and Kuba the vehicle dealer. Marta still runs the tavern, and Kasia still strolls round the plaza.',
      'Every village now has a Captain of the Guard (Jakub in Gridholm) who walks his rounds along the inside of the wall with a spear and a shield. Ask him how safe the village is: he knows about the wall, the raiders and when they are expected.',
      'Gridholm has more folk about: twelve villagers now stroll round the plaza, eight in the other villages.'],
  },
  {
    v: '0.33.0', date: '2026-09-24', title: 'Tower ladders',
    notes: ['Every watch tower of a village now has a ladder on the side facing the plaza: the stilt platforms of a fence or palisade, and the stone towers of a walled village.',
      'Press E at the foot of a ladder and you climb it rung by rung, hand over hand, then swing over onto the deck at the top. E at the top takes you back down. While on the ladder, W and S turn you up or down, and Space lets go.',
      'Your weapons are put away while you climb, and you cannot climb with your hands full.',
      'Up on a tower a rail keeps you from walking off the edge, and the lookout roofs sit higher, so you can see out over the land.'],
  },
  {
    v: '0.32.0', date: '2026-09-24', title: 'Notice boards everywhere',
    notes: ['Every village now has a notice board on its plaza, next to the map board. Each posts its own four notices: bounties, hunts, errands for its own residents and bandit camps to clear, all measured from that village.',
      'Villages out in wilder country pay more for the same work: about a third more for every step of danger.',
      'A board\'s rewards are claimed at the board that posted them, and errands are run for the resident of that village. The quest tracker, compass and maps point you back there when a job is done.',
      'Each board also lists its village\'s delivery contracts and the supply orders of villages round about.',
      'The same bandit camp is no longer posted twice on one board.'],
  },
  {
    v: '0.31.0', date: '2026-09-24', title: 'Deliveries on the notice board',
    notes: ['The notice board on Gridholm\'s plaza now has a Deliveries section: Gridholm\'s own delivery contracts plus supply orders from villages within nine kilometres, the four nearest of each posting.',
      'Take a contract right at the board, or drop one you no longer want (a haul\'s deposit is lost). The board shows when the next notices go up.'],
  },
  {
    v: '0.30.0', date: '2026-09-24', title: 'Delivery contracts',
    notes: ['Every general store now posts delivery work: ask "Any deliveries to be done?". New notices go up every 12 hours, two per village, and you can hold three contracts at once.',
      'Orders: the village wants crates of something it needs, brought by a deadline, and pays about a third more than its market would. Get them wherever you like: another village\'s market, a passing caravan.',
      'Hauls: the village sends its own goods to another village two to nine kilometres off. The crates are loaded into the trunk of your vehicle parked by the gates (and your backpack) against a deposit; hand them over at the other end and you get the deposit back with your pay, more for longer roads and wilder country.',
      'Hand the crates over at the destination\'s general store, all at once or a load at a time. Miss the deadline and the contract fails (a haul\'s deposit is lost). Your contracts show in the quest tracker, and their destinations on the compass and the maps.'],
  },
  {
    v: '0.29.0', date: '2026-09-24', title: 'Village industries',
    notes: ['Every village now lives on its own industry, worked at a site outside its fence: farming villages till fields (grain, carrots, potatoes), mining villages dig a mine with a headframe and an adit into a spoil mound (coal, iron ore, copper; mostly near the hills), oil villages pump crude from nodding pumpjacks, and there are sawmills, fish racks and salt pans, workshops (tools, cloth) and salvage yards (tech, medicine).',
      'Five new trade goods: Sack of Carrots, Sack of Potatoes, Crate of Coal, Crate of Copper Ore and Barrel of Crude Oil (the old Crate of Ore is now Crate of Iron Ore). What a village sells is what its industry makes.',
      'Refineries: some villages near the oil fields mean to refine crude into fuel, but their refinery has to be built first. The elder commissions it (scrap, electronics, wire and planks, handed over a load at a time); once it stands, its columns rise, its flare burns, and it buys crude and sells fuel.',
      'Raids hit the industry too: bandits go for the site, and a lost raid wrecks it for a few days. A damaged site makes less, so its goods are scarce and dear, until the villagers patch it up or you mend it (E at the site, with the parts it needs) for pay. The elder and the general store tell you what the village lives on and how its works are doing.'],
  },
  {
    v: '0.28.0', date: '2026-09-24', title: 'Bandit raids on villages',
    notes: ['Villages with a bandit camp within about three and a half kilometres are raided from it every few days. The elder tells you which camp troubles the village, how the last raid went and when the scouts expect the next one.',
      'Be at a village when its raid comes and you fight it: the scouts warn you an hour and a half before, then three waves of bandits march in from the direction of their camp, making for the gates and the power plant outside the fence. Bandits at a gate wear down the village\'s defences (a Timber Palisade or a Stone Wall holds them much longer than the Stake Fence), bandits at the plant wreck it. While a raid is on the village is no safe place: your weapons are out and the bandits fight you inside the fence too.',
      'Beat all three waves and the village pays you well. Let the defences fall and the raid is lost: the bandits loot and wreck the power plant.',
      'Raids on villages you are not at are settled without you, by the strength of the wall: a lost one leaves the power plant damaged until someone mends it. The quest tracker shows the fight: the wave, the bandits left and the defences.',
      'Bandits now edge sideways round fences and walls instead of getting stuck on them.'],
  },
  {
    v: '0.27.0', date: '2026-09-24', title: 'Motor convoys and roadblocks',
    notes: ['Caravans are motor convoys now: a heavy HTV-6 Mastodon truck carrying the cargo between two RTV-1 Scout jeeps with roof cannons. When bandits attack, the jeeps turn their guns on them and fire, so a convoy can hold out for a while, but it still needs your help.',
      'Bandits block the road: every roadblock is a row of barricades (crates and spiked frames) across the road, and each barricade can be shot apart with your Blaster or a vehicle cannon (a cannon shell does three times the damage). Roadblocks stay up after their bandits are dead: shoot them down or drive round.',
      'A raid on a convoy now comes with a roadblock ahead of it: the convoy stops until the road is clear, and its gunners shoot at the barricades once the bandits are down.'],
  },
  {
    v: '0.26.0', date: '2026-09-24', title: 'Raids and escorts on the caravan roads',
    notes: ['Bandits now fall on caravans out on the roads, more often in dangerous land. The wagons stop while the bandits are on them and lose their load bit by bit: drive the bandits off before they strip the wagons. Save a caravan and the drovers pay you and sell you their goods at a friend\'s price; lose it and it is gone for good, its goods never reach the market.',
      'Escort jobs: talk to the drover of a caravan that has only just set out and they may ask you to ride along to the next village, for pay that grows with the length of the road and the danger. Bandits will try for the wagons on the way, once and maybe twice. Stay with the wagons: wander more than a few hundred metres off for a minute and the drovers will not pay you. Be there when they roll in and you get your money. The quest tracker shows the job.',
      'Caravans on the map: the wagons near you show on the minimap and the map (gold: the one you guard, red rim: under attack), and the big map shows every caravan on the roads between the villages you know, as an arrow pointing the way it goes.'],
  },
  {
    v: '0.25.0', date: '2026-09-24', title: 'Caravans on the roads',
    notes: ['Trade caravans now roll along the roads between the villages: one to three covered wagons one behind the other, crates showing at the tail. Every road has its own timetable, with caravans setting out from each end in turn every six to sixteen hours.',
      'A caravan carries what its home village makes, preferably something the village it is heading for wants. Its setting out thins the stock at home, its arrival fills the market at the other end, so prices move with the traffic: a good is cheap for a while where a caravan has just come in. The general store tells you which caravan came in last.',
      'Walk up to a wagon and press E to talk to the drover: where they come from, where they are going, when they expect to arrive, and they will sell you crates of their cargo on the spot, at a price between the two markets.',
      'The wagons are solid and shove you aside if you stand in their way. Where each caravan is follows from the time of day alone, so later on every player in a world will see the same caravans.'],
  },
  {
    v: '0.24.0', date: '2026-09-24', title: 'Trade between the villages',
    notes: ['Ten trade goods travel the roads by the crate: grain, timber, ore, salt, dried fish, cloth, tools, medical supplies, fuel and salvaged tech.',
      'Every village makes two goods (cheap there, plenty in stock) and wants two others (dear there, little in stock). What a village trades follows its land: villages in the hills mine ore and salt, a village on a diesel generator always wants fuel, the far villages sell raw goods and hunger for made ones.',
      'Ask the general store in any village: "Trade goods by the crate". Buy where a good is made and sell where it is wanted. Every crate you buy or sell moves the price, and the market settles back over a day or two, so flooding one village does not pay for long. Prices also drift over the days.',
      'Crates are heavy and bulky: a backpack takes two or three. Park your vehicle by the village gates and the store loads and unloads straight from its trunk: a Scout carries 40 crates, a Mastodon 120. A trading run is a caravan, and the roads are not safe.',
      'The store remembers nothing for you, but you do: every market you visit goes into your ledger, and each good shows the best price you have seen elsewhere, where and how long ago. The merchant also passes on word of nearby markets you have not seen yet and what they pay well for, so it pays to explore.'],
  },
  {
    v: '0.23.0', date: '2026-09-24', title: 'Fortify the villages, keep the power on',
    notes: ['Every village elder now has work for you: "How can I help the village?" Help raise the wall from the Stake Fence to a Timber Palisade (planks, logs, nails, rope) and later a Stone Wall (stone, scrap, planks, nails). Bring the materials a load at a time: the elder keeps count, and when all is in, the new wall stands and the village pays you.',
      'Each village draws its power from its own plant outside the fence: a diesel generator, a solar array or a pair of wind turbines, cabled in on wooden poles. Villages differ in the details now.',
      'The plants wear down over the days. A status light shows how they run (pale green, gold when failing, blinking red when down); when the power is down the turbines stop and the village lamps go dark. E at the plant mends it with the right parts (generator: Engine Parts and scrap; solar: electronics and wire; turbines: scrap, wire and rope), and the village pays you for it. The elder tells you how the power is doing.'],
  },
  {
    v: '0.22.0', date: '2026-09-24', title: 'A house of your own',
    notes: ['You have your own house in Gridholm: the little house by the west fence, south of the Elder\'s Hall, with YOUR HOUSE over the door.',
      'Inside stands a chest with 24 slots: whatever you put in it stays there, safe, for as long as you like.',
      'And a bed: lie down at night (from 20:00) and you sleep until 07:00 and wake fully healed and rested; by day you take a two-hour nap that heals half your health. You still get hungry and thirsty while you sleep.',
      'When you die, or use a Recall Beacon, and Gridholm is the nearest village you know, you now wake up in your own bed instead of the tavern.'],
  },
  {
    v: '0.21.0', date: '2026-09-24', title: 'Makeshift village fences',
    notes: ['The villages lost their tall stone walls: they now hide behind low, flimsy fences of sharpened stakes, uneven and leaning, with rails nailed along them and patches of scrap sheet over the holes.',
      'Watch platforms on stilts stand in the corners instead of stone towers, and every gate is a frame of two posts and a crossbeam with the village name.',
      'This is the first step towards fortifying the villages: later you will help raise their defences, from the stake fence to a timber palisade and a stone wall with towers.'],
  },
  {
    v: '0.20.1', date: '2026-09-24', title: 'Player bases closed for now',
    notes: ['Building your own base in the wilds is closed for now: a Flagpole can no longer be raised, B no longer opens the build list, and the shops stop selling the Flagpole, the Auto Turret and the Code Lock. The game is turning towards helping the villages instead: fortifying their walls and a house of your own in town (coming later).',
      'A claim you already have stays as it is: its walls, doors, locks and turrets still work, and E at the flag still takes it down.'],
  },
  {
    v: '0.20.0', date: '2026-09-24', title: 'Rings of danger',
    notes: ['Danger now grows in rings round Gridholm: the country round the start is a calm patch (danger about 1), and the further out you travel the harsher it gets, up to 8 some 45 km away. The ring edges wander, so they are no perfect circles.',
      'Further out there is more about: encounters come more often, groups are bigger, and the heavy machines (Sentinels, Artillery Walkers, Assault Constructs, Repair Drones) make up a growing share of what you meet.',
      'Every village is still a refuge: calm right outside its walls, the danger of its ring returning over the next few hundred metres.',
      'Villages thin out with the distance from Gridholm: close to home they stand about 2 km apart, in the far wilds 5-7 km. Roads there run longer, so every town is still linked.',
      'Note: the world changes with this update: many villages far from Gridholm are gone, and so are the roads that led to them.'],
  },
  {
    v: '0.19.0', date: '2026-09-24', title: 'Roads between towns',
    notes: ['Roads now join the villages to each other: some towns sit at a crossroads with three or more roads, others at the end of a single one. Follow any road and it takes you to a town.',
      'Roads no longer lead to ruins, bandit camps or crash sites: they give them a wide berth, so those have to be found by exploring. Roads also go round the mountains.',
      'Roads and mountain trails are drawn as a plain shaded path worn into the ground instead of a two-lane road with edge lines.'],
  },
  {
    v: '0.18.0', date: '2026-09-24', title: 'More mountains, lakes and wells',
    notes: ['Mountains are twice as common: about a quarter of the land now rises into massifs, closer together, with more peaks, trails and caves. The country round Gridholm stays as it was.',
      'Two and a half times as many lakes: more regions have one, and many also have a smaller pond. Clean water is the most common; murky water lies in the low valleys, toxic water mostly near the ruins (and rarely anywhere).',
      'More old wells out in the wilds (about two regions in five).',
      'Note: the land away from Gridholm changes with this update: some villages, ruins and camps farther out have moved or given way to mountains.'],
  },
  {
    v: '0.17.1', date: '2026-09-24', title: 'Fix: enemies turn up one at a time',
    notes: ['Encounters are paced: after a group turns up the next one waits a while (about a minute near the villages, 20-30 s in the deepest wilds; gunfire brings them sooner), and nothing new joins while you are fighting. No more waves piling up the moment you stop.',
      'Enemies now turn up ahead of you or off to a side instead of behind you, so running across the wilds you meet them on the way.',
      'Fewer foes are about at once (about half the old limit), but creatures and robots hit a third harder. Raiders and roadside ambushes follow the same pacing.'],
  },
  {
    v: '0.17.0', date: '2026-09-24', title: 'Developer flight',
    notes: ['For testing: the console (~) has a "fly" command. You fly over the land without gravity or collisions at 40 m/s (Shift: three times as fast): W/S along your view, A/D sideways, Space up, C down. "fly <speed>" sets the speed; "fly" again lands you.',
      'While flying you see much further (twice the land streamed in, the fog pushed back), nothing new spawns, and your weapon is put away.'],
  },
  {
    v: '0.16.0', date: '2026-09-24', title: 'Cave systems',
    notes: ['The cave mouths in the mountains are open. Inside is an organic labyrinth: winding tunnels with rounded walls, chambers of every size and shape, loops that bring you back round, and dead-end pockets that sometimes hide a chest. Stalagmites and stalactites, nutrient crystals, and a few stray drones in the dark.',
      'Some mountains have two mouths that belong to the same cave system and carry the same name: the cave runs right through the mountain, and going in on one side you can come out on the other, a shortcut under the peaks. The prompt at the mouth tells you when a cave runs through.',
      'Daylight marks the way out (E). Every cave is the same each time you come back; what you take from its chests stays taken.'],
  },
  {
    v: '0.15.0', date: '2026-09-24', title: 'Trails to the summits',
    notes: ['The true peaks of the mountains have names (Mount ...) and a trail up to them from the foot of the mountain. The trails climb at an easy grade, turn across the slope in switchbacks where it gets steep, and run on a level bench cut into the mountainside, so you can walk all the way up.',
      'A signpost marks the trailhead, stone cairns stand beside the way, and a big cairn with a pennant crowns the summit. The HUD names the trail at its start and the summit (with its height) at the top.',
      'Trails show on the minimap, the map and the village map boards (dashed). Trees and rocks keep off them.'],
  },
  {
    v: '0.14.0', date: '2026-09-24', title: 'Mountains and cave mouths',
    notes: ['Now and then the land rises into mountains: ranges of sharp ridges and peaks up to about 170 m, with snow lines near the tops. Some slopes are too steep to climb. The country round Gridholm stays as it was; villages, ruins, camps, crash sites, roads and lakes keep off the mountains.',
      'Real mountains show on the horizon from a few kilometres away, and the maps shade them paler towards the peaks. The forest thins out up the slopes.',
      'Cave mouths open in the mountain flanks, reached over a gentle slope. For now every cave has fallen in: E at the mouth tells you the way is blocked. Cave systems will come later.'],
  },
  {
    v: '0.13.0', date: '2026-09-24', title: 'Auto turrets',
    notes: ['Radek sells the Auto Turret (350 gold). Build it on your claim like any other part (B, Auto Turret, with 2 wire, a Screwdriver and Pliers): on the ground, on a floor or up on a roof.',
      'A turret shoots anything hostile within about 30 m that it can see: creatures, robots, drones, bandits and raiders, but not a calm Bramble. It turns its head towards the nearest target and fires; walls, floors and the land block its view, so give it a clear field of fire (a roof is a good spot). Its shots make noise.',
      'E at a turret switches it off or on. Taking it down with a Screwdriver gives the turret back.'],
  },
  {
    v: '0.12.0', date: '2026-09-24', title: 'Storeys, stairs, walls that stop bullets, code locks',
    notes: ['Build upwards: a floor on top of your walls is the roof of the room below and the floor of the one above. Walls go up to the third storey; a floor needs a wall under one of its sides or a floor next to it, and a wall up there needs a floor beside it or a wall under it.',
      'Wooden and Metal Stairs take two cells and climb one storey the way you face when you build them. Leave the stairwell open above them. You walk up stairs and stand on floors; you bump your head on the floor above.',
      'Walls, shut doors and floors now stop shots and eyes: bandits, robots and creatures cannot see or shoot you through them, and neither can you shoot through them.',
      'Code Lock (Zofia, 120 gold): stand at one of your doors and press L, choose a 4-digit code. A locked door opens for you; anyone else has to enter the code on the keypad. L again changes the code, leaves the door unlocked or takes the lock off.',
      'A part that something above rests on cannot be taken down until that is gone.'],
  },
  {
    v: '0.11.0', date: '2026-09-24', title: 'Building: walls, doors and roofs',
    notes: ['On your claim press B to open the build list: wooden and metal walls, doors and roofs. Pick one, look where it should stand (a hologram snaps to a 2 m grid round your flag: white when it fits, red with the reason) and click. Right mouse or Esc stops building.',
      'Each part is made from what you carry: planks, nails, rope and wire for wood; scrap metal and wire for metal. The tools stay in your backpack: Hammer and Saw for wood, Welder and Pliers for metal, a Screwdriver for doors.',
      'F takes down the part you look at (a Hammer for wood, an Acetylene Torch for metal) and gives half the materials back. E opens and shuts doors. Walls and shut doors stop you and the creatures of the wilds.',
      'New tools at Radek\'s: Hammer, Saw, Screwdriver, Pliers, Welder, Acetylene Torch and Shovel. Zofia sells nails, rope and wire. Cut logs into planks with a Saw at any workbench (one log makes four).',
      'A flag with a building on its claim cannot be taken down until the building is gone.'],
  },
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
