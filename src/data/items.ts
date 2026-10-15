import { tl } from '../i18n';
export type ItemType = 'relic' | 'cons' | 'key' | 'part' | 'quest' | 'attach' | 'mat' | 'tool' | 'weapon' | 'wear' | 'good' | 'ammo';
export interface ItemDef { name: string; ab: string; type: ItemType; desc: string; stack?: number }

export const ITEMS = {
  shield: { name: tl('Shield Core'), ab: 'SHD', type: 'relic', desc: tl('+20 max HP') },
  lens: { name: tl('Focusing Lens'), ab: 'LNS', type: 'relic', desc: tl('+25% blaster damage') },
  edge: { name: tl('Monomolecular Edge'), ab: 'EDG', type: 'relic', desc: tl('+25% blade damage, longer reach') },
  servo: { name: tl('Leg Servos'), ab: 'SRV', type: 'relic', desc: tl('+8% movement speed') },
  cell: { name: tl('Power Cell'), ab: 'CEL', type: 'relic', desc: tl('blaster fires 10% faster') },
  blaster: { name: tl('Blaster'), ab: 'BLS', type: 'weapon', desc: tl('energy rifle: hold it in your hands to fire, or sling it on your back (keys 1 and 2 draw what is on your back)'), stack: 1 },
  blade: { name: tl('Energy Blade'), ab: 'BLD', type: 'weapon', desc: tl('a humming sword: hard hits for stamina. Hold it in your hands to swing it, or carry it on your back'), stack: 1 },
  pistol: { name: tl('Old Pistol'), ab: 'PST', type: 'weapon', desc: tl('a heavy old-world pistol: quick to raise, hits hard at short range. Fires Pistol Rounds'), stack: 1 },
  smg: { name: tl('Scrap SMG'), ab: 'SMG', type: 'weapon', desc: tl('a submachine gun welded together from scrap: a hail of light rounds up close. Fires Pistol Rounds'), stack: 1 },
  shotgun: { name: tl('Scattergun'), ab: 'SHG', type: 'weapon', desc: tl('a pump shotgun: a cone of pellets that tears apart anything within twenty metres. Fires Shotgun Shells'), stack: 1 },
  rifle: { name: tl('Hunting Rifle'), ab: 'RFL', type: 'weapon', desc: tl('a bolt-action rifle with a fixed scope: slow, loud and deadly far away. Fires Rifle Rounds'), stack: 1 },
  machete: { name: tl('Machete'), ab: 'MCH', type: 'weapon', desc: tl('a long heavy knife: quick, light swings that cost little stamina'), stack: 1 },
  spear: { name: tl('Spear'), ab: 'SPR', type: 'weapon', desc: tl('a steel-tipped spear: keeps things at arm\'s length and more'), stack: 1 },
  sledge: { name: tl('Sledgehammer'), ab: 'SLG', type: 'weapon', desc: tl('a two-handed hammer: slow, tiring swings that crush almost anything'), stack: 1 },
  ammoE: { name: tl('Energy Cells'), ab: 'ENC', type: 'ammo', desc: tl('charge cells for energy weapons such as the Blaster. The old world left crates of them; later a blacksmith with the plans for lead batteries can fill new ones'), stack: 60 },
  ammo9: { name: tl('Pistol Rounds'), ab: '9MM', type: 'ammo', desc: tl('short brass cartridges for pistols and submachine guns'), stack: 50 },
  ammoS: { name: tl('Shotgun Shells'), ab: 'SHL', type: 'ammo', desc: tl('paper-and-brass shells full of lead pellets, for the scattergun'), stack: 24 },
  ammoR: { name: tl('Rifle Rounds'), ab: 'RFR', type: 'ammo', desc: tl('long rifle cartridges, for the hunting rifle'), stack: 30 },
  tablet: { name: tl('GPS Tablet'), ab: 'GPS', type: 'tool', desc: tl('a rugged tablet that finds itself by the old satellites: carry it and the compass strip shows your exact position and height, and you can set a waypoint on the world map (right click) that the compass and the maps point to'), stack: 1 },
  repairkit: { name: tl('Vehicle Repair Kit'), ab: 'RPK', type: 'cons', desc: tl('field supplies that restore 40% vehicle condition, including a disabled vehicle; use beside your vehicle or while aboard'), stack: 3 },
  hideCap: { name: tl('Hide Cap'), ab: 'HCP', type: 'wear', desc: tl('a stitched cap of Ravager hide: takes 4% off every hit'), stack: 1 },
  hideCoat: { name: tl('Hide Coat'), ab: 'HCT', type: 'wear', desc: tl('a coat of layered, hardened hide: takes 10% off every hit'), stack: 1 },
  hideGloves: { name: tl('Hide Gloves'), ab: 'HGL', type: 'wear', desc: tl('hide gloves: take 2% off every hit'), stack: 1 },
  hideLegs: { name: tl('Hide Leggings'), ab: 'HLG', type: 'wear', desc: tl('hide leggings: take 4% off every hit'), stack: 1 },
  hideBoots: { name: tl('Hide Boots'), ab: 'HBT', type: 'wear', desc: tl('hide boots with thick soles: take 3% off every hit'), stack: 1 },
  wovenHood: { name: tl('Woven Hood'), ab: 'WHD', type: 'wear', desc: tl('a hood of tight-woven cloth over wire mesh: takes 7% off every hit'), stack: 1 },
  wovenJacket: { name: tl('Woven Jacket'), ab: 'WJK', type: 'wear', desc: tl('many layers of woven cloth quilted round steel wire: takes 17% off every hit and stays light'), stack: 1 },
  wovenGloves: { name: tl('Woven Gloves'), ab: 'WGL', type: 'wear', desc: tl('mesh-lined gloves: take 4% off every hit'), stack: 1 },
  wovenLegs: { name: tl('Woven Trousers'), ab: 'WLG', type: 'wear', desc: tl('quilted, wire-woven trousers: take 7% off every hit'), stack: 1 },
  wovenBoots: { name: tl('Woven Boots'), ab: 'WBT', type: 'wear', desc: tl('boots with woven uppers and hide soles: take 5% off every hit'), stack: 1 },
  compHelm: { name: tl('Composite Helmet'), ab: 'CHM', type: 'wear', desc: tl('a shell of plastic and alloy laid up over cloth: takes 12% off every hit'), stack: 1 },
  compVest: { name: tl('Composite Armour'), ab: 'CAR', type: 'wear', desc: tl('plates of ceramic and advanced alloy in a plastic-and-cloth carrier: takes 30% off every hit at less than half the weight of plate'), stack: 1 },
  compGloves: { name: tl('Composite Gloves'), ab: 'CGL', type: 'wear', desc: tl('gloves with composite knuckle plates: take 6% off every hit'), stack: 1 },
  compLegs: { name: tl('Composite Greaves'), ab: 'CLG', type: 'wear', desc: tl('composite leg plates on woven trousers: take 10% off every hit'), stack: 1 },
  compBoots: { name: tl('Composite Boots'), ab: 'CBT', type: 'wear', desc: tl('boots with composite shin guards: take 8% off every hit'), stack: 1 },
  rucksack: { name: tl('Hide Rucksack'), ab: 'RKS', type: 'wear', desc: tl('a big rucksack of stitched hide on a wooden frame: worn on the back, your backpack holds 55 L instead of 40'), stack: 1 },
  framepack: { name: tl('Frame Pack'), ab: 'FRP', type: 'wear', desc: tl('a woven-cloth pack on a light aluminium frame: your backpack holds 70 L'), stack: 1 },
  cargopack: { name: tl('Composite Cargo Pack'), ab: 'CGP', type: 'wear', desc: tl('a hard-shelled composite cargo pack: your backpack holds 90 L'), stack: 1 },
  exoL: { name: tl('Salvage Exoframe'), ab: 'EXF', type: 'wear', desc: tl('a strapped-on frame of steel struts and sprung joints along the legs and back: you carry 15 kg more with ease (20 kg more before you are overloaded), walk a little faster and sprinting tires you a fifth less'), stack: 1 },
  exoH: { name: tl('Powered Exoskeleton'), ab: 'EXP', type: 'wear', desc: tl('an Ancient-style powered frame: servo joints, a power cell in the spine and a small mind that walks with you. You carry 30 kg more with ease (40 kg more before you are overloaded), move an eighth faster and sprinting tires you far less'), stack: 1 },
  helmet: { name: tl('Combat Helmet'), ab: 'HLM', type: 'wear', desc: tl('head armour: takes 8% off every hit'), stack: 1 },
  vest: { name: tl('Ballistic Vest'), ab: 'VST', type: 'wear', desc: tl('body armour, light: takes 15% off every hit'), stack: 1 },
  armour: { name: tl('Plate Armour'), ab: 'ARM', type: 'wear', desc: tl('body armour, heavy: takes 25% off every hit, but weighs 12 kg'), stack: 1 },
  gloves: { name: tl('Work Gloves'), ab: 'GLV', type: 'wear', desc: tl('tough gloves: take 3% off every hit'), stack: 1 },
  trousers: { name: tl('Cargo Trousers'), ab: 'TRS', type: 'wear', desc: tl('reinforced trousers: take 4% off every hit'), stack: 1 },
  boots: { name: tl('Field Boots'), ab: 'BTS', type: 'wear', desc: tl('sturdy boots: take 4% off every hit'), stack: 1 },
  gasmask: { name: tl('Gas Mask'), ab: 'GSM', type: 'wear', desc: tl('a rubber face mask with a screw-in filter: worn on the face, it keeps the toxic fog out of your lungs as long as the filter lasts. Spare filters in the backpack are screwed in when one is spent'), stack: 1 },
  filter: { name: tl('Mask Filter'), ab: 'FLT', type: 'cons', desc: tl('a charcoal filter canister for the gas mask: about five minutes in the thickest fog, longer in thin fog. Use it to screw a fresh one into your mask'), stack: 10 },
  // trade goods (gen/market.ts): bulky crates, bought cheap where they are made and sold dear where they are wanted
  grain: { name: tl('Sack of Grain'), ab: 'GRN', type: 'good', desc: tl('trade good: fifty kilos of grain. Farming villages sell it cheap'), stack: 5 },
  timber: { name: tl('Timber Bundle'), ab: 'TMB', type: 'good', desc: tl('trade good: seasoned beams, bound with rope. Forest villages sell it cheap'), stack: 5 },
  ore: { name: tl('Crate of Iron Ore'), ab: 'IRN', type: 'good', desc: tl('trade good: iron ore from a village mine'), stack: 5 },
  carrots: { name: tl('Sack of Carrots'), ab: 'CRT', type: 'good', desc: tl('trade good: carrots from the village fields'), stack: 5 },
  potatoes: { name: tl('Sack of Potatoes'), ab: 'POT', type: 'good', desc: tl('trade good: potatoes from the village fields'), stack: 5 },
  coal: { name: tl('Crate of Coal'), ab: 'COL', type: 'good', desc: tl('trade good: coal from a village mine, for forges and stoves'), stack: 5 },
  copper: { name: tl('Crate of Copper Ore'), ab: 'CPR', type: 'good', desc: tl('trade good: copper ore from a village mine, for wiring and electronics'), stack: 5 },
  crude: { name: tl('Barrel of Crude Oil'), ab: 'OIL', type: 'good', desc: tl('trade good: crude oil from the oil wells; a refinery turns it into fuel'), stack: 5 },
  salt: { name: tl('Salt Blocks'), ab: 'SLT', type: 'good', desc: tl('trade good: pressed salt, for keeping food through the winter'), stack: 5 },
  fish: { name: tl('Dried Fish'), ab: 'FSH', type: 'good', desc: tl('trade good: a bale of fish dried on lake shores'), stack: 5 },
  cloth: { name: tl('Bolt of Cloth'), ab: 'CLT', type: 'good', desc: tl('trade good: woven cloth, dyed green'), stack: 5 },
  tools: { name: tl('Crate of Tools'), ab: 'TLS', type: 'good', desc: tl('trade good: hammers, saws and files from a village forge'), stack: 5 },
  meds: { name: tl('Medical Supplies'), ab: 'MED', type: 'good', desc: tl('trade good: bandages, salves and tinctures'), stack: 5 },
  fuel: { name: tl('Fuel Canister'), ab: 'FUL', type: 'good', desc: tl('twenty litres of diesel: R pours it into your vehicle or motor boat; the village generators and convoys burn it too'), stack: 5 },
  tech: { name: tl('Salvaged Tech'), ab: 'TEC', type: 'good', desc: tl('trade good: cleaned and tested machine parts from the ruins'), stack: 5 },
  eggs: { name: tl('Basket of Eggs'), ab: 'EGG', type: 'good', desc: tl('eggs from a village\'s hens, packed in straw'), stack: 5 },
  milk: { name: tl('Churn of Milk'), ab: 'MLK', type: 'good', desc: tl('fresh milk from a village\'s cows, in a sealed churn'), stack: 5 },
  microchip: { name: tl('Microchips'), ab: 'CHP', type: 'good', desc: tl('etched chips from the Old Chip Foundry, packed in trays in a padded crate. Nobody alive can make them anywhere else'), stack: 5 },
  powercell: { name: tl('Power Cells'), ab: 'PWC', type: 'good', desc: tl('lithium-nickel cells from the Old Battery Plant, sealed in a padded crate. They hold far more than any lead battery; nobody alive can make them anywhere else'), stack: 5 },
  sensor: { name: tl('Sensors'), ab: 'SNS', type: 'good', desc: tl('crystal sensor heads from the Old Optical Works, each in its own felt nest. Eyes and ears for the old machines; nobody alive can grow those crystals anywhere else'), stack: 5 },
  ancalloy: { name: tl('Ancient Alloy'), ab: 'ANA', type: 'good', desc: tl('dull silver plates from the Old Alloy Complex, lighter than steel and harder than anything else you know. The Ancients built their ships of it'), stack: 5 },
  precision: { name: tl('Precision Components'), ab: 'PRC', type: 'good', desc: tl('bearings, gears and spindles from the Old Precision Works, true to a hair and packed in oil paper. The joints of the old machines; nothing made by hand comes close'), stack: 5 },
  automation: { name: tl('Automation Units'), ab: 'AUT', type: 'good', desc: tl('sealed drive-and-brain modules from the Old Robotics Plant: an arm, a motor and a mind in one case. Given work, they do it without rest'), stack: 5 },
  composite: { name: tl('Composite Sheets'), ab: 'CMS', type: 'good', desc: tl('black laminate of resin and cloth over titanium mesh, baked in the autoclaves of the Old Alloy Complex: light as wood, stiff as steel'), stack: 5 },
  avionics: { name: tl('Avionics Modules'), ab: 'AVN', type: 'good', desc: tl('aerospace component: a flight computer, sensor heads and control units in a sealed, shock-mounted rack: the eyes and brain of a spacecraft'), stack: 2 },
  drillrig: { name: tl('Drill Rig'), ab: 'DRL', type: 'good', desc: tl('heavy machinery: a steel derrick with a geared drill head, its motor and pipes; it bores into the deep rare deposits the hand cannot reach'), stack: 1 },
  lifesup: { name: tl('Life Support Systems'), ab: 'LSS', type: 'good', desc: tl('aerospace component: air scrubbers, water recyclers and a pump loop in titanium housings: what keeps a crew alive above the sky'), stack: 2 },
  rocketeng: { name: tl('Rocket Engine'), ab: 'RKT', type: 'good', desc: tl('aerospace component: a combustion chamber and bell of ancient alloy lined with ceramics, on precision turbopumps, from the Old Aerospace Works'), stack: 1 },
  aerocomp: { name: tl('Aerospace Components'), ab: 'AER', type: 'good', desc: tl('airframe ribs, spars and skin panels from the Old Aerospace Works, of titanium, aluminium and composite, numbered for a ship nobody has finished'), stack: 2 },
  ceramics: { name: tl('Advanced Ceramics'), ab: 'CER', type: 'good', desc: tl('white heat-proof tiles fired at the Old Alloy Complex from clay, aluminium and chemicals. They shrug off the fire of re-entry'), stack: 5 },
  nfuel: { name: tl('Nuclear Fuel Rods'), ab: 'NFR', type: 'good', desc: tl('enriched fuel from the Old Enrichment Plant, sealed in a lead-lined crate. The old reactors ran on it'), stack: 5 },
  bauxite: { name: tl('Crate of Bauxite'), ab: 'BXT', type: 'good', desc: tl('rare ore: red earth rich in aluminium. Dug only where the old maps mark it, a few km out'), stack: 5 },
  sulfur: { name: tl('Crate of Sulfur'), ab: 'SUL', type: 'good', desc: tl('rare mineral: yellow crystals from hot springs and old vents; the base of hard chemistry'), stack: 5 },
  lithium: { name: tl('Crate of Lithium Brine Salt'), ab: 'LIT', type: 'good', desc: tl('rare mineral: dried brine rich in lithium. Batteries were made of it once'), stack: 5 },
  rareearth: { name: tl('Crate of Rare Earths'), ab: 'REE', type: 'good', desc: tl('rare ore: heavy black sand of the rare metals. Magnets, lenses, old electronics'), stack: 5 },
  uranium: { name: tl('Crate of Uranium Ore'), ab: 'URN', type: 'good', desc: tl('rare ore, faintly warm: pitchblende from far out on the continent. The fuel of the old reactors, once enriched'), stack: 5 },
  sand: { name: tl('Sack of Quartz Sand'), ab: 'SND', type: 'good', desc: tl('trade good: clean quartz sand from a pit or a lake shore; a glassworks melts it into glass'), stack: 5 },
  steel: { name: tl('Steel Ingots'), ab: 'STL', type: 'good', desc: tl('processed good: iron made into steel with coal and limestone at a steelworks. For machine parts, advanced alloy and the Chariot'), stack: 5 },
  copperbar: { name: tl('Copper Ingots'), ab: 'CUI', type: 'good', desc: tl('processed good: copper ore smelted with coal. Drawn into cable, cast into alloy'), stack: 5 },
  plastic: { name: tl('Plastic Resin'), ab: 'PLS', type: 'good', desc: tl('processed good: resin cracked from crude oil at a refinery. For circuit boards'), stack: 5 },
  glass: { name: tl('Glass Panes'), ab: 'GLS', type: 'good', desc: tl('processed good: quartz sand melted with coal. Windows, lenses, heat tiles'), stack: 5 },
  cable: { name: tl('Copper Cable'), ab: 'CBL', type: 'good', desc: tl('processed good: copper ingots drawn into insulated cable'), stack: 5 },
  boards: { name: tl('Circuit Boards'), ab: 'PCB', type: 'good', desc: tl('processed good: etched boards from cable, resin and glass. The Chariot of the Ancients needs them for its avionics'), stack: 5 },
  parts: { name: tl('Machine Parts'), ab: 'MPT', type: 'good', desc: tl('processed good: gears, bearings and valves machined from steel. For engines'), stack: 5 },
  alloy: { name: tl('Advanced Alloy'), ab: 'ALY', type: 'good', desc: tl('processed good: heat-proof alloy plates cast from steel, aluminium and nickel at an alloy foundry. For the hull and engines of the Chariot of the Ancients'), stack: 5 },
  propellant: { name: tl('Rocket Propellant'), ab: 'PRP', type: 'good', desc: tl('processed good: fuel blended with salts at a chemical works. The Chariot of the Ancients burns it'), stack: 5 },
  clay: { name: tl('Crate of Clay'), ab: 'CLY', type: 'good', desc: tl('trade good: wet river clay dug by farming and fishing villages; a kiln fires it into bricks'), stack: 5 },
  limestone: { name: tl('Crate of Limestone'), ab: 'LMS', type: 'good', desc: tl('trade good: pale limestone from a village mine; burnt into cement, and later the flux that turns iron into steel'), stack: 5 },
  lead: { name: tl('Crate of Lead Ore'), ab: 'PBO', type: 'good', desc: tl('trade good: grey galena from a village mine; smelted into lead for batteries'), stack: 5 },
  nickel: { name: tl('Crate of Nickel Ore'), ab: 'NIK', type: 'good', desc: tl('rare ore: greenish nickel ore from far out on the continent. The old alloys and power cells were made with it'), stack: 5 },
  lumber: { name: tl('Stack of Lumber'), ab: 'LMB', type: 'good', desc: tl('trade good: sawn and dried boards from a timber village\'s sawmill, for building'), stack: 5 },
  iron: { name: tl('Iron Bars'), ab: 'FEB', type: 'good', desc: tl('processed good: pig iron smelted from ore with coal. Steelworks will make steel of it with coal and limestone'), stack: 5 },
  bricks: { name: tl('Pallet of Bricks'), ab: 'BRK', type: 'good', desc: tl('processed good: clay fired in a kiln. For solid buildings and walls'), stack: 5 },
  cement: { name: tl('Sack of Cement'), ab: 'CMT', type: 'good', desc: tl('processed good: limestone burnt with coal and ground fine. Concrete for walls, bunkers and the restoration of old plants'), stack: 5 },
  chems: { name: tl('Industrial Chemicals'), ab: 'CHM', type: 'good', desc: tl('processed good: acids and solvents from crude oil, salt and sulfur, in sealed drums. The heart of hard industry: batteries, plastics, chips, fuel'), stack: 5 },
  aluminium: { name: tl('Aluminium Ingots'), ab: 'ALU', type: 'good', desc: tl('processed good: light metal smelted from bauxite, and a great deal of power. For light frames and hulls'), stack: 5 },
  leadbar: { name: tl('Lead Ingots'), ab: 'PBI', type: 'good', desc: tl('processed good: soft, heavy lead smelted from lead ore. For batteries and shielding'), stack: 5 },
  fibre: { name: tl('Bale of Flax Fibre'), ab: 'FLX', type: 'good', desc: tl('trade good: retted and combed flax from a village farm; a textile mill spins and weaves it into cloth'), stack: 5 },
  wool: { name: tl('Bale of Wool'), ab: 'WOL', type: 'good', desc: tl('trade good: shorn fleece from a village\'s sheep; a textile mill spins it into cloth'), stack: 5 },
  cotton: { name: tl('Bale of Cotton'), ab: 'CTN', type: 'good', desc: tl('trade good: ginned cotton from a village farm; a textile mill spins and weaves it into cloth'), stack: 5 },
  meat: { name: tl('Crate of Meat'), ab: 'MEC', type: 'good', desc: tl('salted beef and fowl from a village\'s cows and hens, packed in a cool crate'), stack: 5 },
  motor: { name: tl('Crate of Electric Motors'), ab: 'MOT', type: 'good', desc: tl('industrial component: wound copper coils on steel frames, insulated with resin; they turn pumps, saws and turbines'), stack: 5 },
  generator: { name: tl('Generator'), ab: 'GEN', type: 'good', desc: tl('industrial component: a copper-wound generator on a steel bed; turned by an engine, a turbine or the wind, it makes power'), stack: 2 },
  pipes: { name: tl('Bundle of Pipes & Valves'), ab: 'PIP', type: 'good', desc: tl('industrial component: steel pipe lengths with copper-seated valves and flanges'), stack: 5 },
  gears: { name: tl('Crate of Gears & Bearings'), ab: 'GRS', type: 'good', desc: tl('industrial component: cut steel gears and ball bearings for gearboxes and machines'), stack: 5 },
  pump: { name: tl('Industrial Pump'), ab: 'PMP', type: 'good', desc: tl('industrial component: a steel pump housing with its impeller and an electric motor; it moves water, oil and chemicals'), stack: 2 },
  chromite: { name: tl('Crate of Chromite Ore'), ab: 'CRO', type: 'good', desc: tl('strategic ore: black chromite from a rare seam; Advanced Metallurgy alloys its chromium into steel'), stack: 5 },
  rutile: { name: tl('Crate of Rutile Sand'), ab: 'RUT', type: 'good', desc: tl('rare ore: red-black titanium sand from a few far deposits; Advanced Metallurgy reduces it to titanium'), stack: 5 },
  pgmore: { name: tl('Crate of Platinum Ore'), ab: 'PGO', type: 'good', desc: tl('very rare ore: grey grains of the platinum group metals, from only the furthest seams'), stack: 5 },
  cutstone: { name: tl('Pallet of Cut Stone'), ab: 'CST', type: 'good', desc: 'material: dressed blocks and crushed aggregate from the stoneworks, for walls, foundations and roads', stack: 5 },
  advsteel: { name: tl('Advanced Steel Ingots'), ab: 'ASL', type: 'good', desc: 'material: steel alloyed with nickel and chromium, hard and rustless, for bearings, turbines and plating', stack: 5 },
  titanium: { name: tl('Titanium Ingots'), ab: 'TIT', type: 'good', desc: 'material: light, strong titanium for aerospace frames and armour plate', stack: 5 },
  silicon: { name: tl('Purified Silicon'), ab: 'SIL', type: 'good', desc: 'material: high-purity silicon refined from glass with chemicals and a great deal of power; the stuff of semiconductors', stack: 5 },
  control: { name: 'Control Units', ab: 'CTU', type: 'good', desc: tl('electronic component: a sealed box of boards and salvaged components that runs a machine on its own'), stack: 5 },
  optics: { name: tl('Optical Components'), ab: 'OPT', type: 'good', desc: 'component: ground lenses and mirrors in light alloy mounts, for sights, scanners and instruments', stack: 5 },
  hpe: { name: tl('High-Power Electronics'), ab: 'HPE', type: 'good', desc: tl('electrical component: heavy silicon switches on copper busbars with cooling pipes; they handle the current of a power station'), stack: 5 },
  computer: { name: tl('Computer System'), ab: 'CMP', type: 'good', desc: tl('advanced component: a rugged computer with a microprocessor, memory and a control unit'), stack: 2 },
  pcm: { name: tl('Power Control Module'), ab: 'PCM', type: 'good', desc: tl('electrical component: high-power electronics under a control unit; it steers the power of a reactor, a battery bank or a big plant'), stack: 2 },
  pgm: { name: tl('Platinum Group Metals'), ab: 'PGM', type: 'good', desc: 'material: refined platinum, palladium and rhodium for catalysts, contacts and fine electronics', stack: 5 },
  batteries: { name: tl('Basic Batteries'), ab: 'BAT', type: 'good', desc: tl('processed good: lead-acid cells filled at an electronics shop. They keep lamps, radios and machines going'), stack: 5 },
  medkit: { name: tl('Medkit'), ab: '+', type: 'cons', desc: tl('restores 50 HP (H key)'), stack: 5 },
  key: { name: tl('Access Key'), ab: 'KEY', type: 'key', desc: tl('Opens one locked door. Stand at the door and press E.'), stack: 9 },
  bread: { name: tl('Bread'), ab: 'BRD', type: 'cons', desc: tl('dense and filling: 1000 kcal, 5 HP'), stack: 9 },
  eggsB: { name: tl('Boiled Eggs'), ab: 'EGB', type: 'cons', desc: tl('two eggs from the village hens: 300 kcal, 3 HP'), stack: 9 },
  milkC: { name: tl('Cup of Milk'), ab: 'MLC', type: 'cons', desc: tl('fresh from the village cows: 250 kcal, water +25'), stack: 9 },
  cheese: { name: tl('Cheese'), ab: 'CHS', type: 'cons', desc: tl('a wedge of village cheese: 900 kcal, 5 HP, keeps well'), stack: 9 },
  stew: { name: tl('Hearty Stew'), ab: 'STW', type: 'cons', desc: tl('a hot meal: 650 kcal, water +10, 15 HP'), stack: 5 },
  flask: { name: tl('Empty Flask'), ab: 'FLS', type: 'cons', desc: tl('fill it at a well or a lake (E at the water)'), stack: 3 },
  waterF: { name: tl('Flask of Clean Water'), ab: 'H2O', type: 'cons', desc: tl('clean water: water +40 (the flask is kept)'), stack: 3 },
  waterM: { name: tl('Flask of Murky Water'), ab: 'MRK', type: 'cons', desc: tl('swamp water: water +25, but it may turn your stomach'), stack: 3 },
  fishR: { name: tl('Raw Fish'), ab: 'FSH', type: 'cons', desc: tl('a fresh sea fish: 250 kcal, fine to eat raw. Silverfin shoals and Sea Lurkers give it'), stack: 8 },
  meatR: { name: tl('Raw Meat'), ab: 'RAW', type: 'cons', desc: tl('Bramble meat: 600 kcal, but raw it may make you sick. Roast it at a campfire (E at the fire) or ask Jan'), stack: 8 },
  meatC: { name: tl('Roasted Meat'), ab: 'MEA', type: 'cons', desc: tl('light and rich: 750 kcal, 10 HP'), stack: 8 },
  cap: { name: tl('Nutrient Cap'), ab: 'CAP', type: 'cons', desc: tl('a pale mushroom cap from a Nutrient Mushroom Cluster: only 45 kcal, water +6. Filling, not nourishing'), stack: 10 },
  pod: { name: tl('Fruit Pod'), ab: 'POD', type: 'cons', desc: tl('a juicy pod from an Alien Fruit Pod Tree: 220 kcal, water +18, but heavy in the stomach'), stack: 8 },
  ncrys: { name: tl('Nutrient Crystal'), ab: 'NCR', type: 'cons', desc: tl('an edible crystal that grows in the dungeons: 700 kcal in a tiny bite, 10 HP'), stack: 6 },
  firekit: { name: tl('Fire Kit'), ab: 'FIR', type: 'cons', desc: tl('lights a campfire at your feet (outdoors); press E at the fire to roast your raw meat'), stack: 5 },
  log: { name: tl('Log'), ab: 'LOG', type: 'mat', desc: tl('raw timber, chopped from a tree with a Hatchet (or taken from a great grove by a lumber camp). Saw it into planks before it is any use for building: by hand with a Saw (3 planks a log) or at a village Sawmill (5)'), stack: 10 },
  stone: { name: tl('Stone'), ab: 'STN', type: 'mat', desc: tl('a chunk of rock, broken off with a Pickaxe. For crafting'), stack: 10 },
  scrap: { name: tl('Scrap Metal'), ab: 'SCR', type: 'mat', desc: tl('twisted machine parts from drones, bandits and wrecks. For crafting'), stack: 10 },
  circuit: { name: tl('Electronic Components'), ab: 'ELC', type: 'mat', desc: tl('circuit boards, sensors and wiring salvaged from robots. For crafting'), stack: 10 },
  pcore: { name: tl('Power Core'), ab: 'PWR', type: 'mat', desc: tl('a still-humming energy core from a heavy robot. Rare; for crafting'), stack: 5 },
  hatchet: { name: tl('Hatchet'), ab: 'HAT', type: 'tool', desc: 'tool: hold it in your hands and press E at a tree to chop it (a few blows fell it; logs drop). In the backpack it does nothing: E at a tree takes it into your hands', stack: 1 },
  pickaxe: { name: tl('Pickaxe'), ab: 'PIK', type: 'tool', desc: 'tool: hold it in your hands and press E at a rock to break stone off it. In the backpack it does nothing: E at a rock takes it into your hands', stack: 1 },
  hammer: { name: tl('Hammer'), ab: 'HMR', type: 'tool', desc: 'tool: hold it in your hands to build in wood (walls, doors, roofs) and to take wooden parts down', stack: 1 },
  saw: { name: tl('Saw'), ab: 'SAW', type: 'tool', desc: 'tool: with it in your kit a Log in the backpack can be sawn into planks; also cuts planks to size when you build in wood', stack: 1 },
  screwdriver: { name: tl('Screwdriver'), ab: 'SCD', type: 'tool', desc: 'tool: fits the hinges and locks of doors', stack: 1 },
  pliers: { name: tl('Pliers'), ab: 'PLR', type: 'tool', desc: 'tool: bends and ties wire when you build in metal', stack: 1 },
  welder: { name: tl('Welder'), ab: 'WLD', type: 'tool', desc: 'tool: welds scrap into metal walls, doors and roofs. Heavy', stack: 1 },
  torch: { name: tl('Acetylene Torch'), ab: 'TRC', type: 'tool', desc: 'tool: cuts metal: hold it in your hands to take metal parts of a building down', stack: 1 },
  shovel: { name: tl('Shovel'), ab: 'SHV', type: 'tool', desc: 'tool: for digging and earthworks (foundations and ditches will need it)', stack: 1 },
  planks: { name: tl('Planks'), ab: 'PLK', type: 'mat', desc: tl('sawn boards: what every building wants. A log gives 3 sawn by hand, 5 at a village Sawmill'), stack: 20 },
  nails: { name: tl('Nails'), ab: 'NLS', type: 'mat', desc: tl('a packet of nails. For building in wood'), stack: 20 },
  rope: { name: tl('Rope'), ab: 'RPE', type: 'mat', desc: tl('a coil of strong rope. For building'), stack: 5 },
  ironO: { name: tl('Iron Ore'), ab: 'FE', type: 'mat', desc: tl('rust-red lumps broken out of a vein in the rock. Smelt it at a forge into metal and wire, or pack it into crates for the markets'), stack: 10 },
  copperO: { name: tl('Copper Ore'), ab: 'CU', type: 'mat', desc: tl('green-streaked lumps from a copper vein. A forge turns it into electronic components; crated, the markets buy it'), stack: 10 },
  wire: { name: tl('Wire'), ab: 'WIR', type: 'mat', desc: tl('a coil of steel wire. For building, doors and metalwork'), stack: 10 },
  turretkit: { name: tl('Auto Turret'), ab: 'TUR', type: 'part', desc: tl('a turret in a crate: build it on your claim (B, Auto Turret) on the ground, a floor or a roof. It shoots whatever hostile comes in range and sight. E at it switches it on or off'), stack: 1 },
  codelock: { name: tl('Code Lock'), ab: 'LCK', type: 'tool', desc: tl('a keypad lock for a door you built: stand at the door and press L, then choose a 4-digit code. Others need the code to open it'), stack: 3 },
  scanner: { name: tl('Sensor Compass'), ab: 'SCN', type: 'tool', desc: tl('a compass with a sensor head from the Old Optical Works: carry it and the compass strip also points to the nearest old installation within 30 km and the nearest toxic fog you have found'), stack: 1 },
  flashlight: { name: tl('Flashlight'), ab: 'FLS', type: 'tool', desc: tl('a hand torch with a strong white beam, held in your other hand (L takes it there): it lights the way ahead in the dark. It runs a Battery flat every three hours and takes a fresh one by itself. A long gun needs both hands, so go with a pistol or a blade'), stack: 1 },
  woodshield: { name: tl('Wooden Shield'), ab: 'WSH', type: 'tool', desc: tl('planks bound with hide on a strap: held in your other hand beside a one-handed weapon (a pistol, a blade, a machete, a hatchet) it takes 15% off every hit. A long gun, a spear or a sledge needs both hands, and then the shield hangs useless on your arm'), stack: 1 },
  riotshield: { name: tl('Riot Shield'), ab: 'RSH', type: 'tool', desc: tl('a curved steel and plastic shield with a view slot: held in your other hand beside a one-handed weapon it takes 30% off every hit. Useless while both your hands are on a long gun'), stack: 1 },
  elampkit: { name: tl('Electric Street Lamp'), ab: 'ESL', type: 'cons', desc: tl('a steel lamp post with its wiring, in pieces: use it in or near a village and click where it should stand. It lights the street by night while the village has power (it draws a little), and needs no tending'), stack: 4 },
  olampkit: { name: tl('Oil Street Lamp'), ab: 'OSL', type: 'cons', desc: tl('a wooden post with an oil lantern on an arm: use it in or near a village and click where it should stand. It needs no power, but its tank has to be filled with Lamp Oil or a fuel canister (E at the lamp); it burns only by night'), stack: 4 },
  flare: { name: tl('Signal Flare'), ab: 'FLR', type: 'cons', desc: tl('a red road flare: throw it (hold Z, let go) and it burns where it lands for most of a minute, hissing and glowing red. Creatures, robots and bandits go to see what it is, and while they look at it they show you their backs. It lights a little round it'), stack: 10 },
  lhkit: { name: tl('Lighthouse Plans'), ab: 'LHP', type: 'cons', desc: tl('the plans of a lighthouse and the stakes to mark it out: use it on dry ground away from the villages (a coast or a hilltop) and click where the tower should stand. Then bring the materials to its door. Its lamp turns and flashes, seen from kilometres away by night, but it lights nothing round it; at its door you set how fast it turns, so your lighthouses can be told apart'), stack: 1 },
  battery: { name: tl('Battery'), ab: 'BTY', type: 'cons', desc: tl('a small dry cell for the flashlight: three hours of light. Zofia sells them; a blacksmith makes them from scrap and electronic components, or a dozen from a crate of Basic Batteries'), stack: 20 },
  firebrand: { name: tl('Torch'), ab: 'TCH', type: 'cons', desc: tl('a stick wrapped in pitch-soaked rags, held in your other hand: press L or use it to light it. It lights all round you, flickering and not as far as a lamp, and burns down in three quarters of an hour; the next one is lit from it by itself'), stack: 10 },
  oillamp: { name: tl('Oil Lamp'), ab: 'LMP', type: 'tool', desc: tl('a hooded lantern held in your other hand: press L to light it. It lights all round you, not as far as a flashlight, and burns a flask of Lamp Oil every six hours'), stack: 1 },
  lampoil: { name: tl('Lamp Oil'), ab: 'OIL', type: 'cons', desc: tl('a flask of oil for the oil lamp: six hours of light. The lamp takes a fresh one by itself when it runs dry'), stack: 10 },
  compass: { name: tl('Compass'), ab: 'CMP', type: 'tool', desc: tl('carry it and a compass strip shows your heading at the top of the screen, with the way to the nearest village'), stack: 1 },
  fieldstake: { name: tl('Survey Stake'), ab: 'STK', type: 'cons', desc: tl('from the village elder, once the materials of a new farm or of a settlement\'s warehouse are in: walk out of the village, use it and click where the field or the warehouse should go (the warehouse\'s doors face you). The ground is levelled and the builders start. Not on roads, water or the ground kept for the quarry, the mine, the oil wells and the other yards'), stack: 1 },
  bridgekit: { name: tl('Bridge Kit'), ab: 'BRK', type: 'cons', desc: tl('survey stakes, a line and a plumb: use it by a river to choose a crossing, click to stake out the site. Then bring the materials to its sign'), stack: 1 },
  pierkit: { name: tl('Dock Kit'), ab: 'DCK', type: 'cons', desc: tl('survey stakes, a sounding line and a float: stand on a beach and use it looking out to sea to stake out a dock out to water deep enough for boats and ships (built and refitted at its slip), click to mark the site. Then bring the materials to its sign'), stack: 1 },
  flagpole: { name: tl('Flagpole'), ab: 'FLG', type: 'cons', desc: tl('claim land for a base: use it to pick a spot (you see how the ground will be levelled), click to raise the flag. The land around it is yours; E at the flag takes it down again'), stack: 1 },
  benchkit: { name: tl('Workbench Kit'), ab: 'WBK', type: 'cons', desc: tl('a folding workbench: use it to set it up in front of you, then E at it to craft anywhere'), stack: 1 },
  hide: { name: tl('Ravager Hide'), ab: 'HID', type: 'mat', desc: tl('a tough, spotted hide. Crafting material; Oskar buys it'), stack: 10 },
  fang: { name: tl('Ravager Fang'), ab: 'FNG', type: 'mat', desc: tl('a hooked fang. Crafting material; Oskar buys it'), stack: 10 },
  plate: { name: tl('Bramble Plate'), ab: 'PLT', type: 'mat', desc: tl('a thorny armour plate from a Bramble. Crafting material; Oskar buys it'), stack: 10 },
  membrane: { name: tl('Leechwing Membrane'), ab: 'MEM', type: 'mat', desc: tl('a thin, strong wing membrane. Crafting material; Oskar buys it'), stack: 10 },
  incisor: { name: tl('Gnawer Incisor'), ab: 'INC', type: 'mat', desc: tl('a long, sharp rodent tooth. Crafting material; Oskar buys it'), stack: 10 },
  recall: { name: tl('Recall Beacon'), ab: 'RCL', type: 'cons', desc: tl('returns you to the village from anywhere'), stack: 5 },
  emp: { name: tl('EMP Charge'), ab: 'EMP', type: 'cons', desc: tl('damages every machine within 6 m and short-circuits it for a few seconds (G key)'), stack: 5 },
  book: { name: tl('Ancient Book'), ab: 'BOK', type: 'quest', desc: tl('a crumbling book of the old machine folk; Elder Maciej wants it'), stack: 1 },
  gearbox: { name: tl('Precision Gearbox'), ab: 'GBX', type: 'quest', desc: tl('a rare pre-war part; Oskar the blacksmith wants it'), stack: 1 },
  datacore: { name: tl('Data Core'), ab: 'COR', type: 'quest', desc: tl('a sealed memory core; Zofia at the store wants it'), stack: 1 },
  logbook: { name: tl("Driver's Logbook"), ab: 'LOG', type: 'quest', desc: tl('a battered logbook from a wreck; Kuba the dealer wants it'), stack: 1 },
  wheelL: { name: tl('Light Tire'), ab: 'TIR', type: 'part', desc: tl('repair supplies for the RTV-1 Scout: restore 20% vehicle condition in service (E at the front)'), stack: 4 },
  wheelH: { name: tl('Heavy Tire'), ab: 'HTR', type: 'part', desc: tl('repair supplies for the HTV-6 Mastodon: restore 20% vehicle condition in service (E at the front)'), stack: 2 },
  engine: { name: tl('Engine Parts'), ab: 'ENG', type: 'part', desc: tl('restores 50% vehicle condition (drop it on STATE in vehicle service)'), stack: 5 },
  drivetrain: { name: tl('Precision Drivetrain'), ab: 'PDT', type: 'part', desc: tl('engine upgrade built from precision components: bearings and gears that never bind. +20% top speed, +25% acceleration, and the vehicle takes half as much damage'), stack: 1 },
  evkit: { name: tl('Electric Drive Kit'), ab: 'EVK', type: 'part', desc: tl('an electric motor, a controller and a lead battery: fitted in vehicle service it replaces the diesel engine, and the vehicle charges at a charging post instead of burning fuel'), stack: 1 },
  evpack: { name: tl('Lithium Battery Pack'), ab: 'LIP', type: 'part', desc: tl('lithium power cells in an armoured case: fitted to an electric vehicle in service it doubles its battery'), stack: 1 },
  turbo: { name: tl('Turbocharger'), ab: 'TRB', type: 'part', desc: tl('engine upgrade: +15% top speed, +30% acceleration'), stack: 1 },
  eguard: { name: tl('Engine Guard'), ab: 'EGD', type: 'part', desc: tl('vehicle upgrade: armour plate that halves vehicle damage'), stack: 1 },
  plating: { name: tl('Hull Plating'), ab: 'HUL', type: 'part', desc: tl('armour plates that restore 40% vehicle condition (fit them at the front of the vehicle)'), stack: 5 },
  cannon: { name: tl('Vehicle Cannon'), ab: 'CAN', type: 'part', desc: tl('roof-mounted gun for any vehicle; fire with the attack button while driving'), stack: 1 },
  reflex: { name: tl('Reflex Sight'), ab: 'RFX', type: 'attach', desc: 'optic: 1.6× zoom when aiming, +10 m range', stack: 1 },
  scope: { name: tl('Long Scope'), ab: 'SCP', type: 'attach', desc: 'optic: 3.5× zoom when aiming, +50 m range', stack: 1 },
  barL: { name: tl('Long Barrel'), ab: 'LBR', type: 'attach', desc: 'barrel: +25% damage, +20 m range, 10% slower fire', stack: 1 },
  barR: { name: tl('Rapid Barrel'), ab: 'RBR', type: 'attach', desc: 'barrel: fires 25% faster, -10% damage', stack: 1 },
  barS: { name: tl('Suppressor'), ab: 'SUP', type: 'attach', desc: 'barrel: shots are heard 78% less far, -5% damage, -5 m range', stack: 1 },
  magX: { name: tl('Extended Magazine'), ab: 'EXM', type: 'attach', desc: 'magazine: +60% capacity', stack: 1 },
  magD: { name: tl('Drum Magazine'), ab: 'DRM', type: 'attach', desc: 'magazine: +150% capacity, reloads 40% slower', stack: 1 },
} satisfies Record<string, ItemDef>;

export type ItemKey = keyof typeof ITEMS;
export const item = (k: ItemKey): ItemDef => ITEMS[k];
export const RELIC_KEYS = (Object.keys(ITEMS) as ItemKey[]).filter((k) => item(k).type === 'relic');
export const INV_SIZE = 24, MOD_SIZE = 3; // (0.201) the backpack has 24 slots (was 12); its litres stay the limit

/**
 * Weight (kg) and bulk (litres) of one item. Bulk has to fit in the backpack (PACK.vol); weight only slows you down.
 * Equipped relics and fitted attachments are part of your kit and weigh nothing here.
 */
export const BULK: Record<ItemKey, [kg: number, litres: number]> = {
  blaster: [3.5, 9], blade: [1.5, 4], pistol: [1.2, 1.5], smg: [2.8, 5], shotgun: [3.4, 8], rifle: [4, 10], machete: [0.9, 2], spear: [1.8, 6], sledge: [6, 6], ammoE: [0.02, 0.02], ammo9: [0.012, 0.01], ammoS: [0.04, 0.04], ammoR: [0.025, 0.02], tablet: [0.6, 0.5], repairkit: [3, 4], helmet: [1.5, 5], vest: [4, 10], armour: [12, 18], gloves: [0.3, 0.5], trousers: [0.8, 1.5], boots: [1.2, 3], gasmask: [0.7, 2], filter: [0.25, 0.3], hideCap: [0.8, 2], hideCoat: [3, 6], hideGloves: [0.3, 0.5], hideLegs: [1.2, 2], hideBoots: [1, 2.5], wovenHood: [1, 3], wovenJacket: [3.5, 6], wovenGloves: [0.3, 0.5], wovenLegs: [1.5, 2], wovenBoots: [1.1, 2.5], compHelm: [1.3, 4], compVest: [5, 8], compGloves: [0.4, 0.6], compLegs: [2, 3], compBoots: [1.3, 3], rucksack: [1.5, 3], framepack: [2.5, 4], cargopack: [3, 5], exoL: [9, 10], exoH: [14, 12],
  shield: [1.5, 1], lens: [0.3, 0.3], edge: [0.5, 0.5], servo: [2, 2], cell: [1, 0.5],
  flashlight: [0.4, 0.4], oillamp: [1, 1.5], lampoil: [0.5, 0.5], battery: [0.06, 0.04], firebrand: [0.5, 1], woodshield: [3, 6], riotshield: [5, 8], elampkit: [7, 9], olampkit: [5, 8], lhkit: [1, 2], flare: [0.2, 0.3],
  medkit: [0.5, 1], key: [0.05, 0.05], recall: [0.4, 0.3], emp: [0.8, 0.6], flask: [0.3, 0.8], firekit: [1, 1.5],
  bread: [0.4, 1], stew: [0.6, 0.8], eggsB: [0.15, 0.2], milkC: [0.3, 0.3], cheese: [0.25, 0.3], waterF: [1, 0.8], waterM: [1, 0.8],
  fishR: [0.3, 0.4], meatR: [0.5, 0.6], meatC: [0.35, 0.5], cap: [0.15, 0.4], pod: [0.5, 0.8], ncrys: [0.15, 0.2],
  log: [4, 6], stone: [3, 2], scrap: [1.5, 1.5], circuit: [0.3, 0.4], pcore: [2, 1], hatchet: [1.5, 2], pickaxe: [2.5, 3], compass: [0.2, 0.1], codelock: [0.6, 0.5], turretkit: [18, 16],
  hammer: [1, 1.5], saw: [1, 2.5], screwdriver: [0.2, 0.2], pliers: [0.3, 0.3], welder: [9, 10], torch: [6, 8], shovel: [2, 4],
  ironO: [2.5, 1.2], copperO: [2.5, 1.2],
  planks: [1.5, 1.5], nails: [0.3, 0.2], rope: [0.8, 1.5], wire: [0.5, 0.5], benchkit: [15, 20], flagpole: [9, 14], bridgekit: [3, 4], pierkit: [3, 4], fieldstake: [1, 1.5],
  hide: [2, 3], fang: [0.1, 0.1], plate: [3, 2.5], membrane: [0.3, 1], incisor: [0.05, 0.05],
  book: [1, 1], gearbox: [4, 2], datacore: [1, 0.5], logbook: [0.5, 0.5],
  grain: [12, 14], timber: [16, 20], ore: [18, 10], carrots: [10, 14], potatoes: [12, 14], coal: [16, 10], copper: [18, 10], crude: [16, 14], salt: [10, 7], fish: [7, 10], cloth: [5, 9], tools: [14, 14], meds: [4, 7], fuel: [11, 12], tech: [6, 8],
  eggs: [6, 10], milk: [22, 20], microchip: [6, 6], powercell: [14, 8], sensor: [5, 6], ancalloy: [16, 6], ceramics: [12, 10], composite: [8, 12], aerocomp: [30, 30], avionics: [14, 14], lifesup: [40, 30], drillrig: [120, 60], rocketeng: [90, 60], precision: [10, 6], automation: [24, 12], nfuel: [30, 8], bauxite: [20, 10], sulfur: [14, 10], lithium: [12, 10], rareearth: [22, 8], uranium: [25, 8],
  sand: [20, 12], steel: [20, 8], copperbar: [20, 8], plastic: [12, 14], glass: [14, 12], cable: [10, 10], boards: [5, 8], parts: [15, 12], alloy: [20, 8], propellant: [15, 14],
  clay: [22, 10], limestone: [22, 10], lead: [24, 8], nickel: [22, 8], lumber: [14, 16], iron: [20, 8], bricks: [24, 12], cement: [25, 16], chems: [18, 16], aluminium: [8, 8], leadbar: [26, 6], batteries: [16, 10], fibre: [10, 16], wool: [8, 18], cotton: [9, 16], meat: [20, 16], motor: [30, 14], generator: [80, 40], pipes: [24, 20], gears: [26, 10], pump: [60, 30], chromite: [26, 10], rutile: [24, 10], pgmore: [22, 8], cutstone: [40, 24], advsteel: [20, 6], titanium: [12, 6], pgm: [10, 3], silicon: [10, 6], control: [8, 8], optics: [5, 6], hpe: [18, 12], computer: [16, 20], pcm: [24, 18],
  wheelL: [12, 22], wheelH: [28, 36], engine: [8, 6], evkit: [16, 12], evpack: [10, 8], turbo: [6, 5], drivetrain: [9, 6], scanner: [0.4, 0.3], eguard: [5, 4], plating: [7, 5], cannon: [25, 30],
  reflex: [0.3, 0.3], scope: [0.8, 1], barL: [1.2, 1], barR: [1, 0.8], barS: [0.9, 0.8], magX: [0.5, 0.4], magD: [1.2, 1],
};
/** What you wear, one piece per slot: which slot, and the share of every hit it takes off (pieces multiply). */
export type WearSlot = 'head' | 'face' | 'body' | 'gloves' | 'legs' | 'feet' | 'pack' | 'frame';
export const WEAR_SLOTS: WearSlot[] = ['head', 'face', 'body', 'gloves', 'legs', 'feet', 'pack', 'frame'];
export const WEAR_NAME: Record<WearSlot, string> = { head: tl('Head'), face: tl('Face'), body: tl('Body'), gloves: tl('Gloves'), legs: tl('Legs'), feet: tl('Feet'), pack: tl('Pack'), frame: tl('Frame') };
export const WEAR: Partial<Record<ItemKey, { slot: WearSlot; def: number }>> = {
  helmet: { slot: 'head', def: 0.08 }, vest: { slot: 'body', def: 0.15 }, armour: { slot: 'body', def: 0.25 },
  gloves: { slot: 'gloves', def: 0.03 }, trousers: { slot: 'legs', def: 0.04 }, boots: { slot: 'feet', def: 0.04 },
  gasmask: { slot: 'face', def: 0 },
  hideCap: { slot: 'head', def: 0.04 }, hideCoat: { slot: 'body', def: 0.1 }, hideGloves: { slot: 'gloves', def: 0.02 }, hideLegs: { slot: 'legs', def: 0.04 }, hideBoots: { slot: 'feet', def: 0.03 }, wovenHood: { slot: 'head', def: 0.07 }, wovenJacket: { slot: 'body', def: 0.17 }, wovenGloves: { slot: 'gloves', def: 0.04 }, wovenLegs: { slot: 'legs', def: 0.07 }, wovenBoots: { slot: 'feet', def: 0.05 }, compHelm: { slot: 'head', def: 0.12 }, compVest: { slot: 'body', def: 0.3 }, compGloves: { slot: 'gloves', def: 0.06 }, compLegs: { slot: 'legs', def: 0.1 }, compBoots: { slot: 'feet', def: 0.08 }, rucksack: { slot: 'pack', def: 0 }, framepack: { slot: 'pack', def: 0 }, cargopack: { slot: 'pack', def: 0 }, exoL: { slot: 'frame', def: 0 }, exoH: { slot: 'frame', def: 0 },
};
/** Weapons in the hands: which one it is for world/weapons.ts (0 = gun, 1 = blade). Only weapons go on your back. */
export const WEAPON_KIND: Partial<Record<ItemKey, 0 | 1>> = { blaster: 0, pistol: 0, smg: 0, shotgun: 0, rifle: 0, blade: 1, machete: 1, spear: 1, sledge: 1 };
/** Tools that work only from your hands (a hatchet in the backpack fells no tree); instruments like the compass work carried. */
export const HAND_TOOLS = new Set<ItemKey>(['hatchet', 'pickaxe', 'hammer', 'saw', 'screwdriver', 'pliers', 'welder', 'torch', 'shovel']);
/** Too big or awkward for the backpack: carried in your hands (and then you cannot hold a weapon). */
export const HANDS_ONLY = new Set<ItemKey>(['wheelL', 'wheelH', 'cannon', 'benchkit', 'flagpole']);
/**
 * (0.201) Two hands: the weapon (or tool) in your main hand, and in the other (`Char.off`) a light or a shield. What
 * goes in the other hand, the share of a hit a shield takes, and what needs both hands (then the other hand's light
 * goes out and its shield does nothing).
 */
export const OFF_HAND = new Set<ItemKey>(['flashlight', 'oillamp', 'firebrand', 'woodshield', 'riotshield']);
export const SHIELD: Partial<Record<ItemKey, number>> = { woodshield: 0.15, riotshield: 0.3 };
export const TWO_HANDED = new Set<ItemKey>(['blaster', 'smg', 'shotgun', 'rifle', 'spear', 'sledge', 'pickaxe', 'shovel', 'welder', ...HANDS_ONLY]);
/** Weapons and gear Oskar sells. */
/** Tools and building supplies: what Oskar (tools) and Zofia (supplies) charge. */
export const TOOL_PRICE: Partial<Record<ItemKey, number>> = { hammer: 20, saw: 35, screwdriver: 10, pliers: 12, welder: 200, torch: 160, shovel: 25, turretkit: 350, bridgekit: 80, pierkit: 90 };
export const SUPPLY_PRICE: Partial<Record<ItemKey, number>> = { nails: 3, rope: 6, wire: 5, codelock: 120, oillamp: 45, lampoil: 8, flashlight: 160, battery: 10, firebrand: 4, flare: 12 };
export const GEAR_PRICE: Partial<Record<ItemKey, number>> = { blaster: 150, blade: 80, pistol: 140, shotgun: 240, machete: 60, spear: 45, sledge: 70, woodshield: 50, riotshield: 220, helmet: 60, vest: 120, armour: 260, gloves: 20, trousers: 30, boots: 40 };
/** The backpack: how much fits (litres), the load you carry easily, and beyond `max` you are overloaded (kg). */
export const PACK = { vol: 40, comfy: 20, max: 35 };
/** A bigger pack worn in the 'pack' slot: the backpack's litres. */
export const PACK_VOL: Partial<Record<ItemKey, number>> = { rucksack: 55, framepack: 70, cargopack: 90 };
/** An exoskeleton in the 'frame' slot: extra kg carried with ease / before overload, walking speed and sprint stamina factors. */
export const EXO: Partial<Record<ItemKey, { comfy: number; max: number; speed: number; stamina: number }>> = {
  exoL: { comfy: 15, max: 20, speed: 1.06, stamina: 0.8 },
  exoH: { comfy: 30, max: 40, speed: 1.12, stamina: 0.6 },
};
/** What you wear makes of the backpack and your legs: litres, easy and overload limits (kg), speed and stamina factors. */
export function gearOf(wear: Partial<Record<WearSlot, ItemKey | null>>) {
  const p = wear.pack, x = wear.frame ? EXO[wear.frame] : undefined;
  return { vol: (p && PACK_VOL[p]) || PACK.vol, comfy: PACK.comfy + (x?.comfy ?? 0), max: PACK.max + (x?.max ?? 0), speed: x?.speed ?? 1, stamina: x?.stamina ?? 1 };
}
/** What Kuba charges for vehicle parts. He buys them back for only a fifth of that. */
export const PART_PRICE: Partial<Record<ItemKey, number>> = { wheelL: 40, wheelH: 90, engine: 70, plating: 60, turbo: 220, eguard: 150, cannon: 400, repairkit: 90, fuel: 80 };
export const PART_BUYBACK = 0.2;
export const HEAL: Partial<Record<ItemKey, number>> = { medkit: 50 };
/** Weapon attachments and what Oskar the blacksmith charges for them. */
export const ATTACH_PRICE: Partial<Record<ItemKey, number>> = { reflex: 80, scope: 180, barL: 140, barR: 160, barS: 150, magX: 90, magD: 200 };
export const ATTACH_KEYS = Object.keys(ATTACH_PRICE) as ItemKey[];
