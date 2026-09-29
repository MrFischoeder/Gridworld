# GridWorld: surowce, przetwarzanie i budowy

Plik jest generowany z danych gry (`tools/materials.sim.ts`), więc nazwy i liczby są takie jak w grze. Nazwy przedmiotów są po angielsku, tak jak na ekranie.

**Zasada magazynu:** wszystko, co wioska buduje (mury, zakłady, elektrownie, farmy, ulepszenia, zamówienia u kowala), bierze materiały z **hali magazynowej wioski** (Village Hall, 6000 L pojemności), a nie z plecaka. Do hali trafiają: to, co tam złożysz przy terminalu, oraz własne towary wioski (produkcja jej zakładu i plony farm, do 60 skrzyń każdego).

Spis: 1. Surowce · 2. Przetwarzanie · 3. Budowy · 4. Indeks: gdzie użyć każdego materiału · 5. Surowce bez zastosowania

## 1. Surowce: skąd je wziąć

### 1.1 Zbierane w terenie

| Materiał | Skąd |
|---|---|
| Log | ścinanie drzew siekierą (przytrzymaj E): 3 kłody, duże drzewo 8; odrasta po 3 dniach gry |
| Stone | rozbijanie skał kilofem: 2 kamienie, duża skała 5; odnawia się po 2 dniach |
| Iron Ore | żyły rudy w skałach (zygzaki na skale), więcej w górach; kilofem, obok kamieni |
| Copper Ore | żyły rudy miedzi w skałach, jak wyżej |
| Scrap Metal | roboty (6 rodzajów), bandyci, bagażniki wraków, skrzynie w ruinach i wrakach |
| Electronic Components | roboty (strażnicy, wartownicy, konstrukty), skrzynie we wrakach, szafki skażonych obiektów w toksycznej mgle |
| Power Core | rzadko: drony naprawcze, wartownicy, konstrukty; skrzynie we wrakach; szafki skażonych obiektów w toksycznej mgle (często, potrzebna maska gazowa) |
| Mask Filter | kowal (zamówienie, plany Filter Masks), czasem w szafkach skażonych obiektów |
| Raw Meat | stworzenie: Bramble (upolowane) |
| Bramble Plate | stworzenie: Bramble (upolowane) |
| Ravager Fang | stworzenie: Ravager (upolowane) |
| Ravager Hide | stworzenie: Ravager (upolowane) |
| Leechwing Membrane | stworzenie: Leechwing (upolowane) |
| Gnawer Incisor | stworzenie: Gnawer (upolowane) |
| Nutrient Cap, Fruit Pod, Nutrient Crystal | grzyby w lesie, drzewa z owocami, kryształy w podziemiach (jedzenie) |

### 1.2 Towary, które wioski wydobywają i wytwarzają same

Każda wioska ma jeden rodzaj zakładu i robi 1–2 towary z jego listy; część wiosek robi do tego jeszcze jeden z nowszych towarów (glina, wapień, ołów, tarcica: „czasem” w tabeli). Towary trafiają do jej hali; kupujesz je na targu, dostajesz w udziale od starszego (za zaufanie) albo przewozisz w kontraktach.

| Towar | Cena bazowa | Surowy? | Kto go robi |
|---|---|---|---|
| Sack of Grain | 20 g | tak | wioska rolnicza |
| Sack of Carrots | 16 g | tak | wioska rolnicza |
| Sack of Potatoes | 14 g | tak | wioska rolnicza |
| Timber Bundle | 24 g | tak | wioska drwali |
| Crate of Coal | 22 g | tak | wioska górnicza |
| Crate of Iron Ore | 36 g | tak | wioska górnicza |
| Crate of Copper Ore | 48 g | tak | wioska górnicza |
| Salt Blocks | 30 g | tak | wioska rybacka |
| Dried Fish | 26 g | tak | wioska rybacka |
| Barrel of Crude Oil | 40 g | tak | wioska naftowa |
| Sack of Quartz Sand | 18 g | tak | wioska górnicza, wioska rybacka |
| Bolt of Cloth | 44 g | wyrób | wioska rzemieślnicza |
| Crate of Tools | 68 g | wyrób | wioska rzemieślnicza |
| Medical Supplies | 85 g | wyrób | wioska złomiarzy |
| Fuel Canister | 72 g | wyrób | miasto z rafinerią |
| Salvaged Tech | 110 g | wyrób | wioska złomiarzy |
| Crate of Clay | 14 g | tak | wioska rolnicza (czasem, 25%), wioska rybacka (czasem, 40%) |
| Crate of Limestone | 26 g | tak | wioska górnicza (czasem, 60%) |
| Crate of Lead Ore | 34 g | tak | wioska górnicza (czasem, 60%) |
| Stack of Lumber | 46 g | wyrób | wioska drwali (czasem, 65%) |
| Bale of Flax Fibre | 16 g | tak | — |
| Bale of Wool | 20 g | tak | — |

### 1.3 Plony farm (wybierasz uprawę każdej farmy u starszego)

| Uprawa | Daje | Skrzyń dziennie (ziemia przeciętna) |
|---|---|---|
| Wheat | Sack of Grain | 4 (× żyzność 0,7–1,3; × 1.6 ze stalowymi pługami) |
| Carrots | Sack of Carrots | 4 (× żyzność 0,7–1,3; × 1.6 ze stalowymi pługami) |
| Potatoes | Sack of Potatoes | 5 (× żyzność 0,7–1,3; × 1.6 ze stalowymi pługami) |
| Hens | Basket of Eggs | 3 (× żyzność 0,7–1,3; × 1.6 ze stalowymi pługami) |
| Cows | Churn of Milk | 3 (× żyzność 0,7–1,3; × 1.6 ze stalowymi pługami) |
| Flax | Bale of Flax Fibre | 4 (× żyzność 0,7–1,3; × 1.6 ze stalowymi pługami) |
| Sheep | Bale of Wool | 3 (× żyzność 0,7–1,3; × 1.6 ze stalowymi pługami) |

### 1.4 Rzadkie złoża (przy niektórych wioskach, w udziale od starszego: 1–3 skrzynie dziennie zależnie od zaufania)

| Złoże | Od odległości od Gridholm | Szansa na wioskę |
|---|---|---|
| Crate of Nickel Ore | 10 km | 14% |
| Crate of Bauxite | 3 km | 30% |
| Crate of Sulfur | 5 km | 18% |
| Crate of Lithium Brine Salt | 8 km | 11% |
| Crate of Rare Earths | 11 km | 8% |
| Crate of Uranium Ore | 15 km | 6% |

### 1.5 Kupowane w sklepach

- **Zofia (sklep ogólny):** Nails 3 g, Rope 6 g, Wire 5 g, Code Lock 120 g
- **Oskar (kowal):** Hammer 20 g, Saw 35 g, Screwdriver 10 g, Pliers 12 g, Welder 200 g, Acetylene Torch 160 g, Shovel 25 g, Auto Turret 350 g, Bridge Kit 80 g, Pier Kit 90 g
- **Kuba (pojazdy, Gridholm):** Light Tire 40 g, Heavy Tire 90 g, Engine Parts 70 g, Hull Plating 60 g, Turbocharger 220 g, Engine Guard 150 g, Vehicle Cannon 400 g

## 2. Przetwarzanie: co z czego

### 2.1 Zakłady przetwórcze (buduje się je u starszego; potrzebują prądu)

| Zakład | Przepis | Czas partii |
|---|---|---|
| Sawmill | 1 × Timber Bundle → 1 × Stack of Lumber | 30 min gry |
| Brickworks | 2 × Crate of Clay, 1 × Crate of Coal → 2 × Pallet of Bricks | 45 min gry |
| Cement Works | 2 × Crate of Limestone, 1 × Crate of Coal → 2 × Sack of Cement | 45 min gry |
| Smelter | 2 × Crate of Iron Ore, 1 × Crate of Coal → 2 × Iron Bars | 60 min gry |
| Smelter | 2 × Crate of Copper Ore, 1 × Crate of Coal → 1 × Copper Ingots | 60 min gry |
| Smelter | 2 × Crate of Lead Ore, 1 × Crate of Coal → 1 × Lead Ingots | 60 min gry |
| Glassworks | 2 × Sack of Quartz Sand, 1 × Crate of Coal → 1 × Glass Panes | 45 min gry |
| Wire Mill | 1 × Copper Ingots → 2 × Copper Cable | 45 min gry |
| Oil Refinery | 1 × Barrel of Crude Oil → 1 × Fuel Canister | 60 min gry |
| Oil Refinery | 2 × Barrel of Crude Oil → 1 × Plastic Resin | 60 min gry |
| Textile Mill | 2 × Bale of Flax Fibre → 1 × Bolt of Cloth | 60 min gry |
| Textile Mill | 3 × Bale of Wool → 2 × Bolt of Cloth | 60 min gry |
| Steelworks | 1 × Iron Bars, 1 × Crate of Coal, 1 × Crate of Limestone → 1 × Steel Ingots | 60 min gry |
| Chemical Works | 1 × Barrel of Crude Oil, 1 × Salt Blocks, 1 × Crate of Sulfur → 2 × Industrial Chemicals | 60 min gry |
| Polymer Plant | 1 × Barrel of Crude Oil, 1 × Industrial Chemicals → 2 × Plastic Resin | 60 min gry |
| Aluminium Works | 2 × Crate of Bauxite, 1 × Crate of Coal → 1 × Aluminium Ingots | 90 min gry |
| Battery Works | 1 × Lead Ingots, 1 × Industrial Chemicals → 1 × Basic Batteries | 75 min gry |
| Electronics Shop | 1 × Copper Cable, 1 × Plastic Resin, 1 × Glass Panes → 1 × Circuit Boards | 90 min gry |
| Machine Shop | 2 × Steel Ingots → 1 × Machine Parts | 75 min gry |
| Machine Shop | 1 × Steel Ingots, 1 × Timber Bundle → 3 × Crate of Tools | 75 min gry |
| Alloy Foundry | 1 × Steel Ingots, 1 × Aluminium Ingots, 1 × Crate of Nickel Ore → 1 × Advanced Alloy | 120 min gry |

### 2.2 Wielkie instalacje (po odbudowie)

- **Old Enrichment Plant:** 3 × Crate of Uranium Ore, 1 × Industrial Chemicals → 1 × Nuclear Fuel Rods co 6 h gry
- **Old Chip Foundry:** 2 × Glass Panes, 1 × Copper Ingots, 1 × Industrial Chemicals, 1 × Crate of Rare Earths → 1 × Microchips co 4 h gry
- **Old Propellant Plant:** 3 × Fuel Canister, 1 × Industrial Chemicals, 1 × Crate of Sulfur → 3 × Rocket Propellant co 3 h gry
- **Old Battery Plant:** 1 × Crate of Lithium Brine Salt, 1 × Crate of Nickel Ore, 1 × Copper Ingots, 1 × Industrial Chemicals → 1 × Power Cells co 4 h gry
- **Old Optical Works:** 2 × Glass Panes, 1 × Crate of Rare Earths, 1 × Industrial Chemicals → 1 × Sensors co 4 h gry
- **Old Alloy Complex:** 2 × Steel Ingots, 1 × Aluminium Ingots, 1 × Crate of Nickel Ore → 1 × Ancient Alloy co 5 h gry
- **Old Alloy Complex:** 3 × Crate of Clay, 1 × Aluminium Ingots, 1 × Industrial Chemicals → 2 × Advanced Ceramics co 4 h gry
- **Old Precision Works:** 2 × Steel Ingots, 1 × Ancient Alloy, 1 × Microchips → 1 × Precision Components co 5 h gry
- **Old Robotics Plant:** 1 × Microchips, 1 × Sensors, 1 × Precision Components, 1 × Power Cells → 1 × Automation Units co 6 h gry
- **Old Radar Station:** nic nie produkuje; odkrywa na mapie wszystko w promieniu 12 km.

**Siłownie instalacji** (wracają z II etapem odbudowy; partia rusza tylko przy pełnym poborze, zestawy palą paliwo tylko podczas pracy): Old Enrichment Plant pobiera 200 kW, Old Chip Foundry pobiera 100 kW, Old Propellant Plant pobiera 120 kW, Old Battery Plant pobiera 150 kW, Old Optical Works pobiera 130 kW, Old Alloy Complex pobiera 180 kW, Old Precision Works pobiera 160 kW, Old Robotics Plant pobiera 200 kW. Zestawy: Coal boiler 120 kW na Crate of Coal (skrzynia na 2 h pracy, bunkier 30); Diesel sets 100 kW na Fuel Canister (skrzynia na 2.5 h pracy, bunkier 30); The plant's own reactor 250 kW na Nuclear Fuel Rods (skrzynia na 4 dni pracy, bunkier 4). Własny reaktor ma tylko Old Enrichment Plant.

### 2.3 Kowal: „Make something for me” (materiały z hali wioski)

| Wyrób | Z czego | Plany |
|---|---|---|
| Hatchet | 1 × Log, 2 × Stone | podstawowe (bez planów) |
| Pickaxe | 1 × Log, 3 × Stone | podstawowe (bez planów) |
| Fire Kit | 2 × Log | podstawowe (bez planów) |
| Empty Flask | 1 × Ravager Hide | podstawowe (bez planów) |
| Hammer | 1 × Log, 2 × Scrap Metal | Forged Tools |
| Saw | 1 × Log, 2 × Scrap Metal | Forged Tools |
| Screwdriver | 1 × Scrap Metal, 1 × Log | Forged Tools |
| Pliers | 2 × Scrap Metal | Forged Tools |
| 6 × Planks | 2 × Log | Timber Framing |
| 10 × Nails | 1 × Scrap Metal | Timber Framing |
| 3 × Scrap Metal | 2 × Iron Ore, 1 × Log | Blast Furnace |
| 4 × Wire | 1 × Iron Ore | Blast Furnace |
| Electronic Components | 2 × Copper Ore, 1 × Scrap Metal | Basic Circuits |
| Compass | 1 × Scrap Metal, 1 × Electronic Components | Basic Circuits |
| Light Tire | 2 × Log, 2 × Scrap Metal | Wagon Axles |
| Hull Plating | 3 × Scrap Metal, 2 × Log | Wagon Axles |
| Engine Parts | 4 × Scrap Metal, 1 × Electronic Components | Combustion Engines |
| Gas Mask | 2 × Ravager Hide, 1 × Leechwing Membrane, 2 × Scrap Metal | Filter Masks |
| 2 × Mask Filter | 2 × Log, 1 × Scrap Metal | Filter Masks |
| Turbocharger | 6 × Scrap Metal, 3 × Electronic Components, 1 × Power Core | Combustion Engines |

### 2.4 Sklep spożywczy (gotuje z hali wioski)

| Danie | Z czego | Porcji ze skrzyni | Cena |
|---|---|---|---|
| Bread | Sack of Grain | 10 | 8 g (bez zboża: 16 g) |
| Hearty Stew | Sack of Potatoes lub Sack of Carrots | 8 | 18 g |
| Boiled Eggs | Basket of Eggs | 12 | 5 g |
| Cup of Milk | Churn of Milk | 10 | 4 g |
| Cheese | Churn of Milk | 5 | 14 g |

### 2.5 Paliwo dla elektrowni

- **Coal Power Station:** spala 1 × Crate of Coal co 2 h gry (140 kW)
- **Diesel Generator Bank:** spala 1 × Fuel Canister co 2.5 h gry (110 kW)
- **Small Reactor:** spala 1 × Nuclear Fuel Rods co 4 dni gry (250 kW)

### 2.6 Zamówienia specjalne

- **Nuclear Fuel Rods:** wioski ze starym reaktorem (od 8 km) płacą od 520 g za skrzynię.
- **Microchips:** wioski rzemieślnicze (od 3 km) płacą od 680 g za skrzynię.

## 3. Budowy: co można zbudować i z czego

Materiały biorą się z hali wioski; złoto płacisz ze swojej sakiewki (opłata dla budowniczych albo nagroda od wioski).

### 3.1 Mury wioski (starszy: fortify)

- **Timber Palisade** (4 m): 60 × Planks, 16 × Log, 40 × Nails, 10 × Rope · wioska płaci 350 g
- **Stone Wall** (7 m): 50 × Stone, 12 × Sack of Cement, 30 × Scrap Metal, 20 × Planks, 30 × Nails · wioska płaci 900 g

### 3.2 Obrona

- **Auto Turret** (do 6): 1 × Auto Turret, 2 × Electronic Components, 4 × Wire, 4 × Scrap Metal · wioska płaci 150 g
- **Barricades round the works** (do 1): 24 × Planks, 20 × Stone, 8 × Scrap Metal, 6 × Rope · wioska płaci 220 g
- **Barricades round the power plant** (do 1): 16 × Planks, 16 × Stone, 6 × Scrap Metal, 4 × Rope · wioska płaci 180 g

### 3.3 Zakłady przetwórcze (2 na wioskę)

- **Sawmill:** 12 × Log, 10 × Stone, 8 × Planks, 6 × Scrap Metal · opłata 350 g
- **Brickworks:** 30 × Stone, 10 × Planks, 6 × Log, 6 × Scrap Metal · opłata 400 g
- **Cement Works:** 20 × Stone, 10 × Pallet of Bricks, 10 × Scrap Metal, 10 × Planks · opłata 500 g
- **Smelter:** 20 × Stone, 12 × Pallet of Bricks, 12 × Scrap Metal, 16 × Planks, 8 × Log · opłata 600 g
- **Glassworks:** 15 × Stone, 10 × Pallet of Bricks, 8 × Scrap Metal, 12 × Planks · opłata 450 g
- **Wire Mill:** 16 × Scrap Metal, 8 × Wire, 12 × Planks, 1 × Engine Parts · opłata 700 g
- **Oil Refinery:** 30 × Scrap Metal, 12 × Wire, 4 × Electronic Components, 16 × Planks · opłata 900 g
- **Textile Mill:** 14 × Stack of Lumber, 6 × Planks, 20 × Nails, 4 × Scrap Metal · opłata 400 g
- **Steelworks:** 30 × Pallet of Bricks, 12 × Sack of Cement, 24 × Scrap Metal, 1 × Engine Parts · opłata 1200 g
- **Chemical Works:** 20 × Scrap Metal, 8 × Wire, 4 × Electronic Components, 8 × Sack of Cement, 12 × Planks · opłata 1000 g
- **Polymer Plant:** 20 × Scrap Metal, 10 × Wire, 4 × Electronic Components, 8 × Sack of Cement, 10 × Stack of Lumber · opłata 1100 g
- **Aluminium Works:** 24 × Pallet of Bricks, 16 × Sack of Cement, 20 × Scrap Metal, 6 × Copper Cable, 6 × Electronic Components · opłata 1600 g
- **Battery Works:** 14 × Scrap Metal, 8 × Wire, 6 × Electronic Components, 10 × Stack of Lumber, 6 × Sack of Cement · opłata 1000 g
- **Electronics Shop:** 8 × Electronic Components, 10 × Wire, 10 × Scrap Metal, 16 × Planks · opłata 1400 g
- **Machine Shop:** 20 × Scrap Metal, 1 × Engine Parts, 10 × Stack of Lumber, 20 × Nails · opłata 1100 g
- **Alloy Foundry:** 20 × Pallet of Bricks, 10 × Sack of Cement, 24 × Scrap Metal, 1 × Power Core, 10 × Stack of Lumber · opłata 1800 g

### 3.4 Elektrownie (2 na wioskę)

- **Solar Farm** (70 kW): 12 × Scrap Metal, 12 × Wire, 6 × Electronic Components, 10 × Planks · opłata 500 g
- **Wind Farm** (80 kW): 20 × Scrap Metal, 10 × Wire, 20 × Planks, 1 × Engine Parts · opłata 650 g
- **Coal Power Station** (140 kW): 10 × Stone, 20 × Pallet of Bricks, 8 × Sack of Cement, 20 × Scrap Metal, 16 × Planks, 1 × Engine Parts · opłata 900 g
- **Diesel Generator Bank** (110 kW): 16 × Scrap Metal, 2 × Engine Parts, 6 × Wire · opłata 800 g
- **Small Reactor** (250 kW): 12 × Steel Ingots, 6 × Advanced Alloy, 8 × Copper Cable, 10 × Electronic Components, 2 × Power Core, 20 × Sack of Cement · opłata 2000 g · plany: **Uranium Enrichment**

### 3.5 Rafineria (tylko w miastach z rafinerią)

- 40 × Scrap Metal, 10 × Electronic Components, 20 × Wire, 30 × Planks · wioska płaci 1200 g

### 3.6 Farmy

- **Farma** (do 3): 8 × Log, 6 × Stone · wioska płaci 40 g
- **Stalowe pługi** (na farmę): 5 × Scrap Metal, 4 × Wire · plany: **Steel Ploughs** · plon × 1.6

### 3.7 Ulepszenia elektrowni wioski

- **Overhauled** (× 1.5 mocy): 6 × Scrap Metal, 4 × Wire, 2 × Log · plany: wiatraki — Improved Wind Rotor, panele — Solar Cells
- **Rebuilt with old electronics** (× 2 mocy): 4 × Electronic Components, 1 × Power Core, 6 × Wire
- **Automated** (× 2.5 mocy): 4 × Microchips, 4 × Copper Cable, 2 × Electronic Components

### 3.8 Wielkie instalacje (odbudowa w 3 etapach, materiały z plecaka i bagażnika)

**Old Enrichment Plant**
1. Securing the plant: 8 × Steel Ingots, 10 × Sack of Cement, 4 × Machine Parts · nagroda 250 g
2. Power and control: 10 × Copper Cable, 4 × Circuit Boards, 4 × Machine Parts, 4 × Industrial Chemicals · nagroda 400 g
3. The core: 2 × Power Core, 4 × Advanced Alloy, 6 × Electronic Components · plany: **Uranium Enrichment** · nagroda 500 g

**Old Radar Station**
1. Clearing the compound: 10 × Log, 8 × Stone, 10 × Scrap Metal · nagroda 150 g
2. Power and cable: 8 × Copper Cable, 6 × Steel Ingots, 6 × Electronic Components · nagroda 250 g
3. The dish and the console: 4 × Circuit Boards, 8 × Electronic Components, 4 × Advanced Alloy · plany: **Radio Triangulation** · nagroda 400 g

**Old Chip Foundry**
1. Opening the block: 10 × Steel Ingots, 10 × Sack of Cement, 6 × Machine Parts · nagroda 250 g
2. Air, water and power: 12 × Copper Cable, 6 × Circuit Boards, 4 × Industrial Chemicals, 6 × Glass Panes · nagroda 400 g
3. The etching line: 4 × Circuit Boards, 8 × Electronic Components, 1 × Power Core · plany: **Integrated Circuits** · nagroda 450 g

**Old Propellant Plant**
1. Securing the tank farm: 8 × Steel Ingots, 10 × Sack of Cement, 4 × Machine Parts · nagroda 250 g
2. Lines, pumps and power: 10 × Copper Cable, 4 × Circuit Boards, 4 × Machine Parts, 6 × Industrial Chemicals · nagroda 400 g
3. The mixing column: 1 × Power Core, 4 × Advanced Alloy, 6 × Electronic Components · plany: **Rocket Propellant Synthesis** · nagroda 500 g

**Old Battery Plant**
1. Opening the cell hall: 8 × Steel Ingots, 8 × Sack of Cement, 10 × Pallet of Bricks, 4 × Machine Parts · nagroda 250 g
2. Formation lines and power: 12 × Copper Cable, 6 × Circuit Boards, 6 × Industrial Chemicals, 4 × Glass Panes · nagroda 400 g
3. The electrolyte plant: 2 × Power Core, 2 × Advanced Alloy, 8 × Electronic Components · plany: **Power Cell Chemistry** · nagroda 500 g

**Old Optical Works**
1. Opening the lens halls: 8 × Steel Ingots, 8 × Sack of Cement, 6 × Glass Panes, 4 × Machine Parts · nagroda 250 g
2. Clean air, water and power: 12 × Copper Cable, 6 × Circuit Boards, 6 × Industrial Chemicals, 6 × Glass Panes · nagroda 400 g
3. The crystal furnace: 1 × Power Core, 4 × Advanced Alloy, 8 × Electronic Components · plany: **Advanced Sensors** · nagroda 500 g

**Old Alloy Complex**
1. Securing the casting hall: 12 × Steel Ingots, 12 × Sack of Cement, 16 × Pallet of Bricks, 6 × Machine Parts · nagroda 300 g
2. The arc furnaces and power: 16 × Copper Cable, 4 × Circuit Boards, 6 × Machine Parts, 4 × Industrial Chemicals · nagroda 450 g
3. The alloy recipe: 2 × Power Core, 6 × Advanced Alloy, 6 × Electronic Components · plany: **Ancient Metallurgy** · nagroda 600 g

**Old Precision Works**
1. Opening the machine hall: 10 × Steel Ingots, 10 × Sack of Cement, 6 × Machine Parts · nagroda 300 g
2. Drives, air and power: 12 × Copper Cable, 6 × Circuit Boards, 4 × Industrial Chemicals, 4 × Glass Panes · nagroda 450 g
3. The master machines: 4 × Microchips, 2 × Ancient Alloy, 6 × Electronic Components · plany: **Precision Manufacturing** · nagroda 600 g

**Old Robotics Plant**
1. Raising the assembly hall: 14 × Steel Ingots, 12 × Sack of Cement, 10 × Pallet of Bricks, 8 × Machine Parts · nagroda 350 g
2. The lines and power: 16 × Copper Cable, 8 × Circuit Boards, 2 × Power Cells, 4 × Industrial Chemicals · nagroda 500 g
3. Waking the arms: 6 × Microchips, 4 × Sensors, 4 × Precision Components · plany: **Automation** · nagroda 800 g

### 3.9 Chariot of the Ancients (Rydwan w hangarze przy Gridholm)

- **Hull Plating:** 12 × Advanced Alloy, 20 × Steel Ingots
- **Main Engines:** 16 × Machine Parts, 8 × Advanced Alloy, 10 × Copper Cable
- **Avionics:** 8 × Circuit Boards, 6 × Microchips, 12 × Copper Cable, 6 × Glass Panes
- **Heat Shield:** 24 × Glass Panes, 4 × Advanced Alloy, 6 × Plastic Resin
- **Propellant:** 30 × Rocket Propellant

### 3.10 Naprawy (materiały z plecaka)

- **Diesel Generator:** 1 × Engine Parts, 2 × Scrap Metal
- **Solar Array:** 2 × Electronic Components, 2 × Wire
- **Wind Turbines:** 3 × Scrap Metal, 2 × Wire, 1 × Rope
- **Fields** (wioska rolnicza): 6 × Planks, 10 × Nails
- **Mine** (wioska górnicza): 8 × Planks, 4 × Scrap Metal
- **Oil Wells** (wioska naftowa): 6 × Scrap Metal, 4 × Wire
- **Refinery** (miasto z rafinerią): 8 × Scrap Metal, 2 × Electronic Components
- **Sawmill** (wioska drwali): 4 × Planks, 10 × Nails
- **Fish Racks** (wioska rybacka): 4 × Planks, 3 × Rope
- **Workshops** (wioska rzemieślnicza): 4 × Planks, 3 × Scrap Metal
- **Salvage Yard** (wioska złomiarzy): 5 × Scrap Metal, 3 × Wire

### 3.11 Mosty, przystanie i łodzie (budujesz sam, materiały z plecaka i bagażnika)

- **Most na brodzie drogi** albo w wybranym miejscu (Bridge Kit u kowala): na długość pomostu: Log 1 na 1.6 m, Stone 1 na 4 m, Nails 1 na 2 m, Rope 1 na 6 m (np. pomost 40 m: 25 × Log, 10 × Stone, 20 × Nails, 7 × Rope)
- **Przystań** (Pier Kit u kowala): na długość pomostu: Log 1 na 1.4 m, Stone 1 na 5 m, Nails 1 na 2 m, Rope 1 na 4 m, do tego 3 × Scrap Metal, 2 × Wire na głowicę
- **Rowboat** (na pochylni gotowej przystani): 10 × Log, 14 × Nails, 4 × Rope
- **Sailboat** (na pochylni gotowej przystani): 24 × Log, 30 × Nails, 14 × Rope, 6 × Ravager Hide
- **Motor Boat** (na pochylni gotowej przystani): 14 × Log, 18 × Nails, 4 × Rope, 10 × Scrap Metal, 2 × Engine Parts
- Łódź motorowa pali **Fuel Canister** (20 L w kanistrze, bak 40 L)

### 3.12 Za złoto

- Dom w Gridholm: 750 g · pojazdy u Kuby: RTV-1 Scout 350 g, HTV-6 Mastodon 900 g

## 4. Indeks: gdzie użyć każdego materiału

| Materiał | Objętość | Użycie |
|---|---|---|
| Advanced Alloy | 8 L | budowa: Small Reactor; odbudowa: Old Enrichment Plant; odbudowa: Old Radar Station; odbudowa: Old Propellant Plant; odbudowa: Old Battery Plant; odbudowa: Old Optical Works; odbudowa: Old Alloy Complex; Rydwan: Hull Plating; Rydwan: Main Engines; Rydwan: Heat Shield |
| Aluminium Ingots | 8 L | przetwarzanie: Alloy Foundry → Advanced Alloy; przetwarzanie: Old Alloy Complex → Ancient Alloy; przetwarzanie: Old Alloy Complex → Advanced Ceramics |
| Ancient Alloy | 6 L | przetwarzanie: Old Precision Works → Precision Components; odbudowa: Old Precision Works |
| Auto Turret | 16 L | budowa: Auto Turret |
| Bale of Flax Fibre | 16 L | przetwarzanie: Textile Mill → Bolt of Cloth |
| Bale of Wool | 18 L | przetwarzanie: Textile Mill → Bolt of Cloth |
| Barrel of Crude Oil | 14 L | przetwarzanie: Oil Refinery → Fuel Canister; przetwarzanie: Oil Refinery → Plastic Resin; przetwarzanie: Chemical Works → Industrial Chemicals; przetwarzanie: Polymer Plant → Plastic Resin |
| Basket of Eggs | 10 L | sklep spożywczy → Boiled Eggs |
| Churn of Milk | 20 L | sklep spożywczy → Cup of Milk; sklep spożywczy → Cheese |
| Circuit Boards | 8 L | odbudowa: Old Enrichment Plant; odbudowa: Old Radar Station; odbudowa: Old Chip Foundry; odbudowa: Old Propellant Plant; odbudowa: Old Battery Plant; odbudowa: Old Optical Works; odbudowa: Old Alloy Complex; odbudowa: Old Precision Works; odbudowa: Old Robotics Plant; Rydwan: Avionics |
| Copper Cable | 10 L | przetwarzanie: Electronics Shop → Circuit Boards; budowa: Aluminium Works; budowa: Small Reactor; ulepszenie elektrowni: Automated; odbudowa: Old Enrichment Plant; odbudowa: Old Radar Station; odbudowa: Old Chip Foundry; odbudowa: Old Propellant Plant; odbudowa: Old Battery Plant; odbudowa: Old Optical Works; odbudowa: Old Alloy Complex; odbudowa: Old Precision Works; odbudowa: Old Robotics Plant; Rydwan: Main Engines; Rydwan: Avionics |
| Copper Ingots | 8 L | przetwarzanie: Wire Mill → Copper Cable; przetwarzanie: Old Chip Foundry → Microchips; przetwarzanie: Old Battery Plant → Power Cells |
| Copper Ore | 1.2 L | kowal → Electronic Components |
| Crate of Bauxite | 10 L | przetwarzanie: Aluminium Works → Aluminium Ingots |
| Crate of Clay | 10 L | przetwarzanie: Brickworks → Pallet of Bricks; przetwarzanie: Old Alloy Complex → Advanced Ceramics |
| Crate of Coal | 10 L | przetwarzanie: Brickworks → Pallet of Bricks; przetwarzanie: Cement Works → Sack of Cement; przetwarzanie: Smelter → Iron Bars; przetwarzanie: Smelter → Copper Ingots; przetwarzanie: Smelter → Lead Ingots; przetwarzanie: Glassworks → Glass Panes; przetwarzanie: Steelworks → Steel Ingots; przetwarzanie: Aluminium Works → Aluminium Ingots; paliwo: siłownie wielkich instalacji; paliwo: Coal Power Station |
| Crate of Copper Ore | 10 L | przetwarzanie: Smelter → Copper Ingots |
| Crate of Iron Ore | 10 L | przetwarzanie: Smelter → Iron Bars |
| Crate of Lead Ore | 8 L | przetwarzanie: Smelter → Lead Ingots |
| Crate of Limestone | 10 L | przetwarzanie: Cement Works → Sack of Cement; przetwarzanie: Steelworks → Steel Ingots |
| Crate of Lithium Brine Salt | 10 L | przetwarzanie: Old Battery Plant → Power Cells |
| Crate of Nickel Ore | 8 L | przetwarzanie: Alloy Foundry → Advanced Alloy; przetwarzanie: Old Battery Plant → Power Cells; przetwarzanie: Old Alloy Complex → Ancient Alloy |
| Crate of Rare Earths | 8 L | przetwarzanie: Old Chip Foundry → Microchips; przetwarzanie: Old Optical Works → Sensors |
| Crate of Sulfur | 10 L | przetwarzanie: Chemical Works → Industrial Chemicals; przetwarzanie: Old Propellant Plant → Rocket Propellant |
| Crate of Uranium Ore | 8 L | przetwarzanie: Old Enrichment Plant → Nuclear Fuel Rods |
| Electronic Components | 0.4 L | kowal → Compass; kowal → Engine Parts; kowal → Turbocharger; budowa: Auto Turret; budowa: Oil Refinery; budowa: Chemical Works; budowa: Polymer Plant; budowa: Aluminium Works; budowa: Battery Works; budowa: Electronics Shop; budowa: Solar Farm; budowa: Small Reactor; budowa: rafineria; ulepszenie elektrowni: Rebuilt with old electronics; ulepszenie elektrowni: Automated; odbudowa: Old Enrichment Plant; odbudowa: Old Radar Station; odbudowa: Old Chip Foundry; odbudowa: Old Propellant Plant; odbudowa: Old Battery Plant; odbudowa: Old Optical Works; odbudowa: Old Alloy Complex; odbudowa: Old Precision Works; naprawa: Solar Array; naprawa: Refinery |
| Engine Parts | 6 L | budowa: Wire Mill; budowa: Steelworks; budowa: Machine Shop; budowa: Wind Farm; budowa: Coal Power Station; budowa: Diesel Generator Bank; naprawa: Diesel Generator; Motor Boat |
| Fuel Canister | 12 L | przetwarzanie: Old Propellant Plant → Rocket Propellant; paliwo: siłownie wielkich instalacji; paliwo: Diesel Generator Bank; paliwo łodzi motorowej |
| Glass Panes | 12 L | przetwarzanie: Electronics Shop → Circuit Boards; przetwarzanie: Old Chip Foundry → Microchips; przetwarzanie: Old Optical Works → Sensors; odbudowa: Old Chip Foundry; odbudowa: Old Battery Plant; odbudowa: Old Optical Works; odbudowa: Old Precision Works; Rydwan: Avionics; Rydwan: Heat Shield |
| Industrial Chemicals | 16 L | przetwarzanie: Polymer Plant → Plastic Resin; przetwarzanie: Battery Works → Basic Batteries; przetwarzanie: Old Enrichment Plant → Nuclear Fuel Rods; przetwarzanie: Old Chip Foundry → Microchips; przetwarzanie: Old Propellant Plant → Rocket Propellant; przetwarzanie: Old Battery Plant → Power Cells; przetwarzanie: Old Optical Works → Sensors; przetwarzanie: Old Alloy Complex → Advanced Ceramics; odbudowa: Old Enrichment Plant; odbudowa: Old Chip Foundry; odbudowa: Old Propellant Plant; odbudowa: Old Battery Plant; odbudowa: Old Optical Works; odbudowa: Old Alloy Complex; odbudowa: Old Precision Works; odbudowa: Old Robotics Plant |
| Iron Bars | 8 L | przetwarzanie: Steelworks → Steel Ingots |
| Iron Ore | 1.2 L | kowal → Scrap Metal; kowal → Wire |
| Lead Ingots | 6 L | przetwarzanie: Battery Works → Basic Batteries |
| Leechwing Membrane | 1 L | kowal → Gas Mask |
| Log | 6 L | kowal → Hatchet; kowal → Pickaxe; kowal → Fire Kit; kowal → Hammer; kowal → Saw; kowal → Screwdriver; kowal → Planks; kowal → Scrap Metal; kowal → Light Tire; kowal → Hull Plating; kowal → Mask Filter; budowa: mur Timber Palisade; budowa: Sawmill; budowa: Brickworks; budowa: Smelter; budowa: farma; ulepszenie elektrowni: Overhauled; odbudowa: Old Radar Station; most; przystań; Rowboat; Sailboat; Motor Boat |
| Machine Parts | 12 L | odbudowa: Old Enrichment Plant; odbudowa: Old Chip Foundry; odbudowa: Old Propellant Plant; odbudowa: Old Battery Plant; odbudowa: Old Optical Works; odbudowa: Old Alloy Complex; odbudowa: Old Precision Works; odbudowa: Old Robotics Plant; Rydwan: Main Engines |
| Microchips | 6 L | przetwarzanie: Old Precision Works → Precision Components; przetwarzanie: Old Robotics Plant → Automation Units; zamówienia na czipy (wioski rzemieślnicze); ulepszenie elektrowni: Automated; odbudowa: Old Precision Works; odbudowa: Old Robotics Plant; Rydwan: Avionics |
| Nails | 0.2 L | budowa: mur Timber Palisade; budowa: mur Stone Wall; budowa: Textile Mill; budowa: Machine Shop; naprawa: Fields; naprawa: Sawmill; most; przystań; Rowboat; Sailboat; Motor Boat |
| Nuclear Fuel Rods | 8 L | paliwo: własny reaktor Old Enrichment Plant; paliwo: Small Reactor; zamówienia na paliwo (stare reaktory) |
| Pallet of Bricks | 12 L | budowa: Cement Works; budowa: Smelter; budowa: Glassworks; budowa: Steelworks; budowa: Aluminium Works; budowa: Alloy Foundry; budowa: Coal Power Station; odbudowa: Old Battery Plant; odbudowa: Old Alloy Complex; odbudowa: Old Robotics Plant |
| Planks | 1.5 L | budowa: mur Timber Palisade; budowa: mur Stone Wall; budowa: Barricades round the works; budowa: Barricades round the power plant; budowa: Sawmill; budowa: Brickworks; budowa: Cement Works; budowa: Smelter; budowa: Glassworks; budowa: Wire Mill; budowa: Oil Refinery; budowa: Textile Mill; budowa: Chemical Works; budowa: Electronics Shop; budowa: Solar Farm; budowa: Wind Farm; budowa: Coal Power Station; budowa: rafineria; naprawa: Fields; naprawa: Mine; naprawa: Sawmill; naprawa: Fish Racks; naprawa: Workshops |
| Plastic Resin | 14 L | przetwarzanie: Electronics Shop → Circuit Boards; Rydwan: Heat Shield |
| Power Cells | 8 L | przetwarzanie: Old Robotics Plant → Automation Units; odbudowa: Old Robotics Plant |
| Power Core | 1 L | kowal → Turbocharger; budowa: Alloy Foundry; budowa: Small Reactor; ulepszenie elektrowni: Rebuilt with old electronics; odbudowa: Old Enrichment Plant; odbudowa: Old Chip Foundry; odbudowa: Old Propellant Plant; odbudowa: Old Battery Plant; odbudowa: Old Optical Works; odbudowa: Old Alloy Complex |
| Precision Components | 6 L | przetwarzanie: Old Robotics Plant → Automation Units; odbudowa: Old Robotics Plant |
| Ravager Hide | 3 L | kowal → Empty Flask; kowal → Gas Mask; Sailboat |
| Rocket Propellant | 14 L | Rydwan: Propellant |
| Rope | 1.5 L | budowa: mur Timber Palisade; budowa: Barricades round the works; budowa: Barricades round the power plant; naprawa: Wind Turbines; naprawa: Fish Racks; most; przystań; Rowboat; Sailboat; Motor Boat |
| Sack of Carrots | 14 L | sklep spożywczy → Hearty Stew |
| Sack of Cement | 16 L | budowa: mur Stone Wall; budowa: Steelworks; budowa: Chemical Works; budowa: Polymer Plant; budowa: Aluminium Works; budowa: Battery Works; budowa: Alloy Foundry; budowa: Coal Power Station; budowa: Small Reactor; odbudowa: Old Enrichment Plant; odbudowa: Old Chip Foundry; odbudowa: Old Propellant Plant; odbudowa: Old Battery Plant; odbudowa: Old Optical Works; odbudowa: Old Alloy Complex; odbudowa: Old Precision Works; odbudowa: Old Robotics Plant |
| Sack of Grain | 14 L | sklep spożywczy → Bread |
| Sack of Potatoes | 14 L | sklep spożywczy → Hearty Stew |
| Sack of Quartz Sand | 12 L | przetwarzanie: Glassworks → Glass Panes |
| Salt Blocks | 7 L | przetwarzanie: Chemical Works → Industrial Chemicals |
| Scrap Metal | 1.5 L | kowal → Hammer; kowal → Saw; kowal → Screwdriver; kowal → Pliers; kowal → Nails; kowal → Electronic Components; kowal → Compass; kowal → Light Tire; kowal → Hull Plating; kowal → Engine Parts; kowal → Gas Mask; kowal → Mask Filter; kowal → Turbocharger; budowa: mur Stone Wall; budowa: Auto Turret; budowa: Barricades round the works; budowa: Barricades round the power plant; budowa: Sawmill; budowa: Brickworks; budowa: Cement Works; budowa: Smelter; budowa: Glassworks; budowa: Wire Mill; budowa: Oil Refinery; budowa: Textile Mill; budowa: Steelworks; budowa: Chemical Works; budowa: Polymer Plant; budowa: Aluminium Works; budowa: Battery Works; budowa: Electronics Shop; budowa: Machine Shop; budowa: Alloy Foundry; budowa: Solar Farm; budowa: Wind Farm; budowa: Coal Power Station; budowa: Diesel Generator Bank; budowa: rafineria; budowa: stalowe pługi; ulepszenie elektrowni: Overhauled; odbudowa: Old Radar Station; naprawa: Diesel Generator; naprawa: Wind Turbines; naprawa: Mine; naprawa: Oil Wells; naprawa: Refinery; naprawa: Workshops; naprawa: Salvage Yard; przystań; Motor Boat |
| Sensors | 6 L | przetwarzanie: Old Robotics Plant → Automation Units; odbudowa: Old Robotics Plant |
| Stack of Lumber | 16 L | budowa: Textile Mill; budowa: Polymer Plant; budowa: Battery Works; budowa: Machine Shop; budowa: Alloy Foundry |
| Steel Ingots | 8 L | przetwarzanie: Machine Shop → Machine Parts; przetwarzanie: Machine Shop → Crate of Tools; przetwarzanie: Alloy Foundry → Advanced Alloy; przetwarzanie: Old Alloy Complex → Ancient Alloy; przetwarzanie: Old Precision Works → Precision Components; budowa: Small Reactor; odbudowa: Old Enrichment Plant; odbudowa: Old Radar Station; odbudowa: Old Chip Foundry; odbudowa: Old Propellant Plant; odbudowa: Old Battery Plant; odbudowa: Old Optical Works; odbudowa: Old Alloy Complex; odbudowa: Old Precision Works; odbudowa: Old Robotics Plant; Rydwan: Hull Plating |
| Stone | 2 L | kowal → Hatchet; kowal → Pickaxe; budowa: mur Stone Wall; budowa: Barricades round the works; budowa: Barricades round the power plant; budowa: Sawmill; budowa: Brickworks; budowa: Cement Works; budowa: Smelter; budowa: Glassworks; budowa: Coal Power Station; budowa: farma; odbudowa: Old Radar Station; most; przystań |
| Timber Bundle | 20 L | przetwarzanie: Sawmill → Stack of Lumber; przetwarzanie: Machine Shop → Crate of Tools |
| Wire | 0.5 L | budowa: Auto Turret; budowa: Wire Mill; budowa: Oil Refinery; budowa: Chemical Works; budowa: Polymer Plant; budowa: Battery Works; budowa: Electronics Shop; budowa: Solar Farm; budowa: Wind Farm; budowa: Diesel Generator Bank; budowa: rafineria; budowa: stalowe pługi; ulepszenie elektrowni: Overhauled; ulepszenie elektrowni: Rebuilt with old electronics; naprawa: Solar Array; naprawa: Wind Turbines; naprawa: Oil Wells; naprawa: Salvage Yard; przystań |

## 5. Surowce bez zastosowania w budowach i przetwarzaniu (na razie)

Te rzeczy można tylko sprzedać (na targu albo kowalowi/Janowi), zjeść albo przewieźć w kontraktach:

Dried Fish, Bolt of Cloth, Crate of Tools, Medical Supplies, Salvaged Tech, Basic Batteries, Raw Meat, Bramble Plate, Ravager Fang, Gnawer Incisor.
