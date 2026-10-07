# GridWorld: surowce, przetwarzanie i budowy

Plik jest generowany z danych gry (`tools/materials.sim.ts`), więc nazwy i liczby są takie jak w grze. Nazwy przedmiotów są po angielsku, tak jak na ekranie.

**Zasada magazynu:** wszystko, co wioska buduje (mury, zakłady, elektrownie, farmy, ulepszenia, zamówienia u kowala), bierze materiały z **zapasów wioski**, a nie z plecaka. W nowej osadzie, zanim stanie magazyn, zapasy przechowuje starszy (800 L; opcja „Leave materials with me”); po budowie magazynu (drewnianej stodoły z bramą dla pojazdów) 24 000 L; starsze zapisy zachowują halę 6000 L. Do zapasów trafiają tylko materiały (drewno, kamień, rudy, metale, materiały budowlane, skrzynie towarów i wyroby zakładów, a także zestawy wieżyczek i części silników): broń, amunicję, apteczki, jedzenie, narzędzia i ubrania trzyma się w skrzyni we własnym domu. Do zapasów trafiają też własne towary wioski (produkcja jej zakładu i plony farm, do 60 skrzyń każdego).

**Nowe osady (od 0.131.0, rozbudowane w 0.132.0):** starszy wydaje jednorazowo siekierę i kilof na początek. Wykorzystaj je do pierwszych dostaw drewna i kamienia. Po pierwszej farmie kowal robi deski (2 Log → 6 Planks) i gwoździe (1 Scrap → 10 Nails) bez dodatkowych planów. Po przywróceniu łączności w pobliskich ruinach każdy gracz otrzymuje tablet GPS; jeśli nie ma miejsca, nagroda czeka w zapasach wioski.

| Budowa nowej osady | Materiały z magazynu |
| --- | --- |
| Farma (każda z 3) | 8 Log, 6 Stone |
| Odbiornik satelitarny w ruinach | 6 Log, 6 Stone, 4 Scrap |
| Magazyn dla pojazdów | 30 Log, 24 Stone, 24 Planks, 20 Nails |
| Elektrownia wioski | 12 Scrap, 8 Wire, 2 Circuit |
| Kamieniołom | 16 Log, 12 Planks, 4 Scrap |
| Kopalnia lokalnej rudy | 18 Log, 12 Stone, 12 Planks, 6 Scrap |
| Tartak | 20 Log, 10 Stone, 8 Scrap |
| Szyb naftowy | 16 Scrap, 8 Wire, 12 Planks |
| Rafineria | 24 Scrap, 4 Circuit, 12 Wire, 18 Planks |
| Przetwórnia żywności (od 0.142) | 14 Log, 10 Stone, 12 Planks, 16 Nails, 6 Scrap |

Każda rozwijana wioska ma dwa różne własne złoża (od 0.171; jedno od 0.168, podział od 0.169), losowane z tych samych wag, każde na swoim placu około 105 m od palisady: kamieniołom (30%: Stone 0,8/h oraz jeden minerał 0,4/h: Crate of Limestone, Crate of Clay albo Sack of Quartz Sand), wielki gaj z obozem drwali (25%, Gridholm: Log 1,2/h i Timber 0,4/h), kopalnię (30%: węgiel, żelazo, miedź albo ołów, 0,6 skrzyni/h, przy żelazie i miedzi także 0,3 grudki rudy/h) albo szyb naftowy (15%: Crude Oil 0,7/h, w połowie szybów także Salt Blocks 0,25/h). Trzy wioski najbliżej Gridholm mają zawsze (jako pierwsze złoże) kopalnię węgla, kopalnię żelaza i kamieniołom wapienia. Resztę zdobywa się handlem. Tartak osady (od 0.170, zaraz po elektrowni, 3 etaty, prąd 15 / 25 / 40 kW) tnie Log z zapasów wioski na Planks w magazynie: 6 desek z pnia, po pile tarczowej 7, po pile taśmowej 8; ręcznie piłą 4 deski z pnia, około 15 s pracy na pień. Wydobyte wcześniej zapasy zostają dostępne, nawet gdy stary typ kopalni produkował kilka surowców. Paliwo z nowej rafinerii powstaje z jednej skrzyni Crude Oil na jeden Fuel Canister, najwyżej co 2 godziny czasu gry, dopóki jest wsad i miejsce w zapasie. Wydobycie zależy od dostępu do prądu. Przetwórnia żywności (młyn, piekarnia, mleczarnia, wędzarnia; po elektrowni i dwóch farmach, 3 etaty, 8 kW) sprawia, że zboże, ziemniaki, mleko i mięso żywią o 35% więcej ludzi, dopóki ma obsadę. Każdy obiekt osady potrzebuje robotników (od 0.141): farma 4, elektrownia 2, przetwórnia 3, kamieniołom 3, tartak 4, kopalnia 4, szyb 2, rafineria 3, zakład 3, stacja 1. Zamówienia u kowala (od 0.142) trwają godziny gry (podstawowe 1 h, z planów 2–5 h): materiały schodzą z zapasów przy zamówieniu, gotową rzecz odbiera się u kowala, najwyżej 3 zamówienia naraz. Wszystkie budowy przyjmują materiały partiami. Zaparkowany wewnątrz dużego magazynu pojazd rozładowuje się przyciskiem terminala; towary, które się nie zmieszczą, zostają w bagażniku.
**Drabina wartości metali (od 0.173):** ruda (grudka ok. 4,5 g, skrzynia rudy żelaza 36 g) < złom (sztuka 5 g) < sztabki (skrzynia żelaza 60 g, miedzi 175, ołowiu 120) < stal (140) < półprodukty (drut 7 g za sztukę, kabel, rury, przekładnie, części) < zespoły (silniki, pompy, prądnice). Złom nie jest wart tyle co sztabka: to brudny, mieszany metal, który trzeba przetopić. Smelter przetapia 12 Scrap + 1 Coal na 2 skrzynie Iron (marża ok. ×1,5), więc wioska bez kopalni żelaza też dojdzie do żelaza. Drut ciągnie się ze sztabek, nie z rudy: Wire Mill robi z 1 skrzyni Iron 12 Wire, kowal (plany Blast Furnace) 8 Wire z 1 skrzyni Iron. Każdy krok przeróbki daje mniej więcej ×1,25–1,5 wartości wejść.
**Zakłady ciężkie (od 0.174):** Heavy Engineering Works, zakład II stopnia z planami Heavy Machinery (nośnik danych 3–8 km od Gridholm), 100 kW, 3 robotników. Robi Drill Rig (4 Steel + 2 Gears + 1 Electric Motor + 2 Pipes, 4 h, wart ok. 2500) i Engine Parts (1 Steel + 1 Gears → 6 sztuk), więc pojazdy u Kuby nie zależą już tylko od części z wraków. Wiertnicy użyje kopalnia złóż rzadkich (następny etap).

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
| Leechwing Membrane | stworzenie: Skitter (upolowane) |
| Raw Fish | stworzenie: Lurker (upolowane) |
| Ravager Hide | stworzenie: Lurker (upolowane) |
| Ravager Fang | stworzenie: Lurker (upolowane) |
| Raw Fish | stworzenie: Silverfin (upolowane) |
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
| Bale of Cotton | 16 g | tak | — |

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
| Cotton | Bale of Cotton | 4 (× żyzność 0,7–1,3; × 1.6 ze stalowymi pługami) |

### 1.4 Rzadkie złoża (przy niektórych wioskach, w udziale od starszego: 1–3 skrzynie dziennie zależnie od zaufania)

| Złoże | Od odległości od Gridholm | Szansa na wioskę |
|---|---|---|
| Crate of Chromite Ore | 9 km | 20% |
| Crate of Rutile Sand | 12 km | 12% |
| Crate of Platinum Ore | 13 km | 12% |
| Crate of Nickel Ore | 10 km | 14% |
| Crate of Bauxite | 3 km | 30% |
| Crate of Sulfur | 5 km | 18% |
| Crate of Lithium Brine Salt | 8 km | 11% |
| Crate of Rare Earths | 11 km | 8% |
| Crate of Uranium Ore | 15 km | 6% |

### 1.5 Kupowane w sklepach

- **Zofia (sklep ogólny):** Nails 3 g, Rope 6 g, Wire 5 g, Code Lock 120 g
- **Oskar (kowal):** Hammer 20 g, Saw 35 g, Screwdriver 10 g, Pliers 12 g, Welder 200 g, Acetylene Torch 160 g, Shovel 25 g, Auto Turret 350 g, Bridge Kit 80 g, Dock Kit 90 g
- **Kuba (pojazdy, Gridholm):** Light Tire 40 g, Heavy Tire 90 g, Engine Parts 70 g, Hull Plating 60 g, Turbocharger 220 g, Engine Guard 150 g, Vehicle Cannon 400 g, Vehicle Repair Kit 90 g

## 2. Przetwarzanie: co z czego

### 2.1 Zakłady przetwórcze (buduje się je u starszego; potrzebują prądu)

| Zakład | Przepis | Czas partii |
|---|---|---|
| Sawmill | 1 × Timber Bundle → 1 × Stack of Lumber | 30 min gry |
| Sawmill | 2 × Log → 12 × Planks | 30 min gry |
| Brickworks | 2 × Crate of Clay, 1 × Crate of Coal → 2 × Pallet of Bricks | 45 min gry |
| Cement Works | 2 × Crate of Limestone, 1 × Crate of Coal → 2 × Sack of Cement | 45 min gry |
| Smelter | 2 × Crate of Iron Ore, 1 × Crate of Coal → 2 × Iron Bars | 60 min gry |
| Smelter | 2 × Crate of Copper Ore, 1 × Crate of Coal → 1 × Copper Ingots | 60 min gry |
| Smelter | 2 × Crate of Lead Ore, 1 × Crate of Coal → 1 × Lead Ingots | 60 min gry |
| Smelter | 12 × Scrap Metal, 1 × Crate of Coal → 2 × Iron Bars | 60 min gry |
| Glassworks | 2 × Sack of Quartz Sand, 1 × Crate of Coal → 1 × Glass Panes | 45 min gry |
| Glassworks | 2 × Glass Panes, 1 × Aluminium Ingots → 1 × Optical Components | 45 min gry |
| Wire Mill | 1 × Copper Ingots → 2 × Copper Cable | 45 min gry |
| Wire Mill | 1 × Iron Bars → 12 × Wire | 45 min gry |
| Oil Refinery | 1 × Barrel of Crude Oil → 1 × Fuel Canister | 60 min gry |
| Oil Refinery | 2 × Barrel of Crude Oil → 1 × Plastic Resin | 60 min gry |
| Textile Mill | 2 × Bale of Flax Fibre → 1 × Bolt of Cloth | 60 min gry |
| Textile Mill | 3 × Bale of Wool → 2 × Bolt of Cloth | 60 min gry |
| Textile Mill | 2 × Bale of Cotton → 1 × Bolt of Cloth | 60 min gry |
| Steelworks | 1 × Iron Bars, 1 × Crate of Coal, 1 × Crate of Limestone → 1 × Steel Ingots | 60 min gry |
| Chemical Works | 1 × Barrel of Crude Oil, 1 × Salt Blocks, 1 × Crate of Sulfur → 2 × Industrial Chemicals | 60 min gry |
| Polymer Plant | 1 × Barrel of Crude Oil, 1 × Industrial Chemicals → 2 × Plastic Resin | 60 min gry |
| Aluminium Works | 2 × Crate of Bauxite, 1 × Crate of Coal → 1 × Aluminium Ingots | 90 min gry |
| Battery Works | 1 × Lead Ingots, 1 × Industrial Chemicals → 1 × Basic Batteries | 75 min gry |
| Electronics Shop | 1 × Copper Cable, 1 × Plastic Resin, 1 × Glass Panes → 1 × Circuit Boards | 90 min gry |
| Electronics Shop | 1 × Circuit Boards, 1 × Electronic Components, 1 × Copper Cable → 1 × Control Units | 90 min gry |
| Machine Shop | 2 × Steel Ingots → 1 × Machine Parts | 75 min gry |
| Machine Shop | 1 × Steel Ingots, 1 × Timber Bundle → 3 × Crate of Tools | 75 min gry |
| Machine Shop | 1 × Steel Ingots, 1 × Copper Ingots → 2 × Bundle of Pipes & Valves | 75 min gry |
| Machine Shop | 1 × Steel Ingots → 1 × Crate of Gears & Bearings | 75 min gry |
| Machine Shop | 1 × Steel Ingots, 1 × Machine Parts, 1 × Crate of Electric Motors → 1 × Industrial Pump | 75 min gry |
| Alloy Foundry | 1 × Steel Ingots, 1 × Aluminium Ingots, 1 × Crate of Nickel Ore → 1 × Advanced Alloy | 120 min gry |
| Electrical Works | 1 × Copper Ingots, 1 × Steel Ingots, 1 × Plastic Resin → 1 × Crate of Electric Motors | 90 min gry |
| Electrical Works | 2 × Copper Ingots, 1 × Steel Ingots, 1 × Machine Parts → 1 × Generator | 90 min gry |
| Stoneworks | 3 × Stone → 2 × Pallet of Cut Stone | 40 min gry |
| Advanced Metallurgy | 2 × Steel Ingots, 1 × Crate of Nickel Ore, 1 × Crate of Chromite Ore → 2 × Advanced Steel Ingots | 120 min gry |
| Advanced Metallurgy | 2 × Crate of Rutile Sand, 1 × Industrial Chemicals → 1 × Titanium Ingots | 120 min gry |
| Advanced Metallurgy | 2 × Crate of Platinum Ore, 1 × Industrial Chemicals → 1 × Platinum Group Metals | 120 min gry |
| Silicon Processing | 2 × Glass Panes, 1 × Industrial Chemicals → 2 × Purified Silicon | 120 min gry |
| Advanced Electronics Works | 2 × Copper Ingots, 2 × Purified Silicon, 1 × Bundle of Pipes & Valves → 1 × High-Power Electronics | 150 min gry |
| Advanced Electronics Works | 1 × Control Units, 1 × Microchips, 2 × Purified Silicon → 1 × Computer System | 150 min gry |
| Advanced Electronics Works | 1 × High-Power Electronics, 1 × Control Units → 1 × Power Control Module | 150 min gry |
| Avionics Works | 1 × Computer System, 2 × Sensors, 1 × Control Units → 1 × Avionics Modules | 240 min gry |
| Life Support Works | 1 × Industrial Pump, 2 × Bundle of Pipes & Valves, 2 × Industrial Chemicals, 1 × Titanium Ingots → 1 × Life Support Systems | 180 min gry |
| Heavy Engineering Works | 4 × Steel Ingots, 2 × Crate of Gears & Bearings, 1 × Crate of Electric Motors, 2 × Bundle of Pipes & Valves → 1 × Drill Rig | 240 min gry |
| Heavy Engineering Works | 1 × Steel Ingots, 1 × Crate of Gears & Bearings → 6 × Engine Parts | 240 min gry |

### 2.2 Wielkie instalacje (po odbudowie)

- **Old Enrichment Plant:** 3 × Crate of Uranium Ore, 1 × Industrial Chemicals → 1 × Nuclear Fuel Rods co 6 h gry
- **Old Chip Foundry:** 2 × Glass Panes, 1 × Copper Ingots, 1 × Industrial Chemicals, 1 × Crate of Rare Earths → 1 × Microchips co 4 h gry
- **Old Propellant Plant:** 3 × Fuel Canister, 1 × Industrial Chemicals, 1 × Crate of Sulfur → 3 × Rocket Propellant co 3 h gry
- **Old Battery Plant:** 1 × Crate of Lithium Brine Salt, 1 × Crate of Nickel Ore, 1 × Copper Ingots, 1 × Industrial Chemicals → 1 × Power Cells co 4 h gry
- **Old Optical Works:** 2 × Glass Panes, 1 × Crate of Rare Earths, 1 × Industrial Chemicals → 1 × Sensors co 4 h gry
- **Old Alloy Complex:** 2 × Steel Ingots, 1 × Aluminium Ingots, 1 × Crate of Nickel Ore → 1 × Ancient Alloy co 5 h gry
- **Old Alloy Complex:** 3 × Crate of Clay, 1 × Aluminium Ingots, 1 × Industrial Chemicals → 2 × Advanced Ceramics co 4 h gry
- **Old Alloy Complex:** 2 × Plastic Resin, 2 × Bolt of Cloth, 1 × Titanium Ingots → 2 × Composite Sheets co 4 h gry
- **Old Precision Works:** 2 × Steel Ingots, 1 × Ancient Alloy, 1 × Microchips → 1 × Precision Components co 5 h gry
- **Old Aerospace Works:** 2 × Titanium Ingots, 2 × Aluminium Ingots, 1 × Composite Sheets, 1 × Advanced Steel Ingots → 1 × Aerospace Components co 6 h gry
- **Old Aerospace Works:** 2 × Ancient Alloy, 2 × Precision Components, 1 × Advanced Ceramics, 1 × Industrial Pump → 1 × Rocket Engine co 8 h gry
- **Old Robotics Plant:** 1 × Microchips, 1 × Sensors, 1 × Precision Components, 1 × Power Cells → 1 × Automation Units co 6 h gry
- **Old Radar Station:** nic nie produkuje; odkrywa na mapie wszystko w promieniu 12 km.

**Siłownie instalacji** (wracają z II etapem odbudowy; partia rusza tylko przy pełnym poborze, zestawy palą paliwo tylko podczas pracy): Old Enrichment Plant pobiera 200 kW, Old Chip Foundry pobiera 100 kW, Old Propellant Plant pobiera 120 kW, Old Battery Plant pobiera 150 kW, Old Optical Works pobiera 130 kW, Old Alloy Complex pobiera 180 kW, Old Precision Works pobiera 160 kW, Old Robotics Plant pobiera 200 kW, Old Aerospace Works pobiera 220 kW. Zestawy: Coal boiler 120 kW na Crate of Coal (skrzynia na 2 h pracy, bunkier 30); Diesel sets 100 kW na Fuel Canister (skrzynia na 2.5 h pracy, bunkier 30); The plant's own reactor 250 kW na Nuclear Fuel Rods (skrzynia na 4 dni pracy, bunkier 4); Cell racks 160 kW na Power Cells (skrzynia na 8 h pracy, bunkier 12). Własny reaktor ma tylko Old Enrichment Plant.

### 2.3 Kowal: „Make something for me” (materiały z hali wioski)

| Wyrób | Z czego | Plany |
|---|---|---|
| Hatchet | 1 × Log, 2 × Stone | podstawowe (bez planów) |
| Pickaxe | 1 × Log, 3 × Stone | podstawowe (bez planów) |
| Fire Kit | 2 × Log | podstawowe (bez planów) |
| Empty Flask | 1 × Ravager Hide | podstawowe (bez planów) |
| Saw | 1 × Log, 2 × Stone | podstawowe (bez planów) |
| Hammer | 1 × Planks, 2 × Scrap Metal | Forged Tools |
| Screwdriver | 1 × Scrap Metal, 1 × Planks | Forged Tools |
| Pliers | 2 × Scrap Metal | Forged Tools |
| 6 × Planks | 2 × Log | Timber Framing |
| 10 × Nails | 1 × Scrap Metal | Timber Framing |
| 3 × Scrap Metal | 2 × Iron Ore, 1 × Log | Blast Furnace |
| 8 × Wire | 1 × Iron Bars | Blast Furnace |
| Electronic Components | 2 × Copper Ore, 1 × Scrap Metal | Basic Circuits |
| Compass | 1 × Scrap Metal, 1 × Electronic Components | Basic Circuits |
| Light Tire | 4 × Planks, 2 × Scrap Metal | Wagon Axles |
| Hull Plating | 3 × Scrap Metal, 4 × Planks | Wagon Axles |
| Engine Parts | 4 × Scrap Metal, 1 × Electronic Components | Combustion Engines |
| Gas Mask | 2 × Ravager Hide, 1 × Leechwing Membrane, 2 × Scrap Metal | Filter Masks |
| 2 × Mask Filter | 2 × Log, 1 × Scrap Metal | Filter Masks |
| Turbocharger | 6 × Scrap Metal, 3 × Electronic Components, 1 × Power Core | Combustion Engines |
| Precision Drivetrain | 2 × Precision Components, 2 × Machine Parts, 1 × Advanced Alloy | Precision Manufacturing |
| Sensor Compass | 1 × Sensors, 2 × Electronic Components, 1 × Scrap Metal, 1 × Platinum Group Metals, 1 × Optical Components | Advanced Sensors |
| 30 × Pistol Rounds | 1 × Lead Ingots, 1 × Industrial Chemicals, 1 × Scrap Metal | Gunsmithing |
| 16 × Shotgun Shells | 1 × Lead Ingots, 1 × Industrial Chemicals, 1 × Scrap Metal | Gunsmithing |
| 20 × Rifle Rounds | 1 × Lead Ingots, 1 × Industrial Chemicals, 1 × Steel Ingots | Gunsmithing |
| Old Pistol | 2 × Steel Ingots, 3 × Scrap Metal | Gunsmithing |
| Scrap SMG | 2 × Steel Ingots, 6 × Scrap Metal, 2 × Wire | Gunsmithing |
| Scattergun | 3 × Steel Ingots, 1 × Stack of Lumber, 2 × Scrap Metal | Gunsmithing |
| Hunting Rifle | 3 × Steel Ingots, 1 × Stack of Lumber, 1 × Glass Panes, 2 × Scrap Metal | Gunsmithing |
| 40 × Energy Cells | 1 × Basic Batteries, 1 × Electronic Components | Battery Chemistry |
| Machete | 3 × Scrap Metal, 1 × Ravager Hide | Forged Tools |
| Spear | 2 × Planks, 2 × Scrap Metal | Forged Tools |
| Sledgehammer | 1 × Planks, 5 × Scrap Metal | Forged Tools |
| GPS Tablet | 3 × Electronic Components, 1 × Glass Panes, 1 × Basic Batteries, 1 × Power Core | Radio Triangulation |
| Vehicle Repair Kit | 4 × Scrap Metal, 2 × Wire, 1 × Electronic Components, 1 × Rope | Combustion Engines |
| Hide Cap | 1 × Ravager Hide | podstawowe (bez planów) |
| Hide Coat | 3 × Ravager Hide, 1 × Rope | podstawowe (bez planów) |
| Hide Gloves | 1 × Ravager Hide | podstawowe (bez planów) |
| Hide Leggings | 2 × Ravager Hide | podstawowe (bez planów) |
| Hide Boots | 2 × Ravager Hide | podstawowe (bez planów) |
| Hide Rucksack | 3 × Ravager Hide, 2 × Rope, 2 × Planks | podstawowe (bez planów) |
| Woven Hood | 1 × Bolt of Cloth, 1 × Wire | Woven Armour |
| Woven Jacket | 3 × Bolt of Cloth, 3 × Wire, 1 × Ravager Hide | Woven Armour |
| Woven Gloves | 1 × Bolt of Cloth, 1 × Wire | Woven Armour |
| Woven Trousers | 2 × Bolt of Cloth, 2 × Wire | Woven Armour |
| Woven Boots | 1 × Bolt of Cloth, 1 × Ravager Hide, 1 × Wire | Woven Armour |
| Frame Pack | 2 × Bolt of Cloth, 1 × Aluminium Ingots, 2 × Rope | Woven Armour |
| Composite Helmet | 1 × Plastic Resin, 1 × Advanced Alloy, 1 × Bolt of Cloth | Composite Armour |
| Composite Armour | 2 × Plastic Resin, 2 × Advanced Alloy, 2 × Bolt of Cloth, 1 × Advanced Ceramics, 1 × Composite Sheets | Composite Armour |
| Composite Gloves | 1 × Plastic Resin, 1 × Bolt of Cloth | Composite Armour |
| Composite Greaves | 1 × Plastic Resin, 1 × Advanced Alloy, 1 × Bolt of Cloth | Composite Armour |
| Composite Boots | 1 × Plastic Resin, 1 × Advanced Alloy, 1 × Ravager Hide | Composite Armour |
| Composite Cargo Pack | 2 × Plastic Resin, 1 × Advanced Alloy, 2 × Bolt of Cloth | Composite Armour |
| Salvage Exoframe | 3 × Steel Ingots, 2 × Machine Parts, 4 × Wire, 2 × Ravager Hide | Exoframes |
| Powered Exoskeleton | 2 × Ancient Alloy, 2 × Precision Components, 2 × Power Cells, 1 × Automation Units, 4 × Copper Cable, 2 × Titanium Ingots, 2 × Advanced Steel Ingots, 1 × Power Control Module | Automation |

**Warsztat mechanika** (Kuba, „Build me something in your workshop”; salvage z hali wioski, praca w godzinach gry):

| Wyrób | Z czego | Czas |
|---|---|---|
| RTV-1 Scout | 24 × Scrap Metal, 4 × Machine Parts, 4 × Crate of Gears & Bearings, 2 × Engine Parts, 3 × Electronic Components | 8 h |
| HTV-6 Mastodon | 40 × Scrap Metal, 8 × Machine Parts, 6 × Crate of Gears & Bearings, 4 × Engine Parts, 5 × Electronic Components, 6 × Steel Ingots | 14 h |
| 2 × Vehicle Repair Kit | 4 × Scrap Metal, 1 × Machine Parts, 1 × Electronic Components | 2 h |

### 2.4 Sklep spożywczy (gotuje z hali wioski)

| Danie | Z czego | Porcji ze skrzyni | Cena |
|---|---|---|---|
| Bread | Sack of Grain | 10 | 8 g (bez zboża: 16 g) |
| Hearty Stew | Sack of Potatoes lub Sack of Carrots | 8 | 18 g |
| Boiled Eggs | Basket of Eggs | 12 | 5 g |
| Cup of Milk | Churn of Milk | 10 | 4 g |
| Cheese | Churn of Milk | 5 | 14 g |
| Roasted Meat | Crate of Meat | 8 | 20 g |

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

- **Timber Palisade** (4 m): 80 × Planks, 40 × Nails, 10 × Rope · wioska płaci 350 g
- **Stone Wall** (7 m): 50 × Stone, 12 × Sack of Cement, 30 × Scrap Metal, 20 × Planks, 30 × Nails, 20 × Pallet of Cut Stone · wioska płaci 900 g

### 3.2 Obrona

- **Auto Turret** (do 6): 1 × Auto Turret, 2 × Electronic Components, 4 × Wire, 4 × Scrap Metal · wioska płaci 150 g
- **Barricades round the works** (do 1): 24 × Planks, 20 × Stone, 8 × Scrap Metal, 6 × Rope · wioska płaci 220 g
- **Barricades round the power plant** (do 1): 16 × Planks, 16 × Stone, 6 × Scrap Metal, 4 × Rope · wioska płaci 180 g

### 3.3 Zakłady przetwórcze (2 na wioskę)

- **Sawmill:** 32 × Planks, 10 × Stone, 6 × Scrap Metal · opłata 350 g
- **Brickworks:** 30 × Stone, 22 × Planks, 6 × Scrap Metal · opłata 400 g
- **Cement Works:** 20 × Stone, 10 × Pallet of Bricks, 10 × Scrap Metal, 10 × Planks · opłata 500 g
- **Smelter:** 20 × Stone, 12 × Pallet of Bricks, 12 × Scrap Metal, 32 × Planks · opłata 600 g
- **Glassworks:** 15 × Stone, 10 × Pallet of Bricks, 8 × Scrap Metal, 12 × Planks · opłata 450 g
- **Wire Mill:** 16 × Scrap Metal, 8 × Wire, 12 × Planks, 1 × Engine Parts · opłata 700 g
- **Oil Refinery:** 30 × Scrap Metal, 12 × Wire, 4 × Electronic Components, 16 × Planks · opłata 900 g
- **Textile Mill:** 14 × Stack of Lumber, 6 × Planks, 20 × Nails, 4 × Scrap Metal · opłata 400 g
- **Steelworks:** 30 × Pallet of Bricks, 12 × Sack of Cement, 24 × Scrap Metal, 1 × Engine Parts · opłata 1200 g
- **Chemical Works:** 20 × Scrap Metal, 8 × Wire, 4 × Electronic Components, 8 × Sack of Cement, 12 × Planks, 4 × Bundle of Pipes & Valves, 1 × Industrial Pump · opłata 1000 g
- **Polymer Plant:** 20 × Scrap Metal, 10 × Wire, 4 × Electronic Components, 8 × Sack of Cement, 10 × Stack of Lumber, 4 × Bundle of Pipes & Valves · opłata 1100 g
- **Aluminium Works:** 24 × Pallet of Bricks, 16 × Sack of Cement, 20 × Scrap Metal, 6 × Copper Cable, 6 × Electronic Components · opłata 1600 g
- **Battery Works:** 14 × Scrap Metal, 8 × Wire, 6 × Electronic Components, 10 × Stack of Lumber, 6 × Sack of Cement · opłata 1000 g
- **Electronics Shop:** 8 × Electronic Components, 10 × Wire, 10 × Scrap Metal, 16 × Planks · opłata 1400 g
- **Machine Shop:** 20 × Scrap Metal, 1 × Engine Parts, 10 × Stack of Lumber, 20 × Nails · opłata 1100 g
- **Alloy Foundry:** 20 × Pallet of Bricks, 10 × Sack of Cement, 24 × Scrap Metal, 1 × Power Core, 10 × Stack of Lumber · opłata 1800 g
- **Electrical Works:** 16 × Pallet of Bricks, 10 × Stack of Lumber, 16 × Scrap Metal, 6 × Copper Cable, 2 × Electronic Components · opłata 1300 g
- **Stoneworks:** 34 × Planks, 6 × Scrap Metal, 10 × Nails · opłata 300 g
- **Advanced Metallurgy:** 24 × Pallet of Bricks, 12 × Sack of Cement, 10 × Steel Ingots, 8 × Copper Cable, 1 × Generator, 1 × Industrial Pump · opłata 2000 g
- **Silicon Processing:** 16 × Pallet of Bricks, 10 × Sack of Cement, 8 × Steel Ingots, 6 × Copper Cable, 6 × Bundle of Pipes & Valves, 1 × Industrial Pump · opłata 1800 g
- **Advanced Electronics Works:** 12 × Pallet of Bricks, 8 × Sack of Cement, 6 × Steel Ingots, 10 × Copper Cable, 4 × Circuit Boards, 2 × Crate of Electric Motors · opłata 2200 g
- **Avionics Works:** 12 × Pallet of Bricks, 8 × Sack of Cement, 8 × Steel Ingots, 10 × Copper Cable, 1 × Computer System, 2 × Optical Components · opłata 2600 g
- **Life Support Works:** 14 × Pallet of Bricks, 10 × Sack of Cement, 8 × Steel Ingots, 6 × Bundle of Pipes & Valves, 1 × Industrial Pump, 1 × Control Units · opłata 2000 g
- **Heavy Engineering Works:** 20 × Pallet of Bricks, 12 × Sack of Cement, 12 × Steel Ingots, 8 × Copper Cable, 2 × Crate of Electric Motors, 4 × Crate of Gears & Bearings · opłata 1800 g

### 3.4 Elektrownie (2 na wioskę)

- **Solar Farm** (70 kW): 12 × Scrap Metal, 12 × Wire, 6 × Electronic Components, 10 × Planks · opłata 500 g
- **Wind Farm** (80 kW): 20 × Scrap Metal, 10 × Wire, 20 × Planks, 1 × Engine Parts, 2 × Crate of Gears & Bearings · opłata 650 g
- **Coal Power Station** (140 kW): 10 × Stone, 20 × Pallet of Bricks, 8 × Sack of Cement, 20 × Scrap Metal, 16 × Planks, 1 × Engine Parts, 1 × Generator, 1 × Industrial Pump, 10 × Pallet of Cut Stone · opłata 900 g
- **Diesel Generator Bank** (110 kW): 16 × Scrap Metal, 2 × Engine Parts, 6 × Wire, 2 × Generator · opłata 800 g
- **Small Reactor** (250 kW): 12 × Steel Ingots, 6 × Advanced Alloy, 8 × Copper Cable, 10 × Electronic Components, 2 × Power Core, 20 × Sack of Cement, 2 × Power Control Module · opłata 2000 g · plany: **Uranium Enrichment**

### 3.5 Rafineria (tylko w miastach z rafinerią)

- 40 × Scrap Metal, 10 × Electronic Components, 20 × Wire, 30 × Planks · wioska płaci 1200 g

### 3.6 Farmy

- **Farma** (do 3): 16 × Planks, 6 × Stone · wioska płaci 40 g
- **Stalowe pługi** (na farmę): 5 × Scrap Metal, 4 × Wire · plany: **Steel Ploughs** · plon × 1.6

### 3.7 Ulepszenia elektrowni wioski

- **Overhauled** (× 1.5 mocy): 6 × Scrap Metal, 4 × Wire, 4 × Planks · plany: wiatraki — Improved Wind Rotor, panele — Solar Cells
- **Rebuilt with old electronics** (× 2 mocy): 4 × Electronic Components, 1 × Power Core, 6 × Wire, 1 × Generator
- **Automated** (× 2.5 mocy): 4 × Microchips, 4 × Copper Cable, 2 × Electronic Components, 2 × Precision Components, 2 × Control Units, 1 × High-Power Electronics

**Ulepszenia wioski** (u starszego: „What could the old parts do for us?”, z zapasów hali wioski; jednorazowe):

- **Battery Bank**: 4 × Power Cells, 6 × Basic Batteries, 6 × Copper Cable, 6 × Pallet of Bricks, 1 × Power Control Module · wioska płaci 250 g
- **Battery Lamps**: 4 × Basic Batteries, 4 × Glass Panes, 4 × Copper Cable · wioska płaci 120 g
- **Automated Site**: 2 × Automation Units, 2 × Precision Components, 6 × Copper Cable, 4 × Steel Ingots, 2 × Crate of Electric Motors, 2 × Control Units · wioska płaci 500 g
- **Sensor Sights**: 2 × Sensors, 2 × Microchips, 4 × Copper Cable, 2 × Optical Components · wioska płaci 300 g
- **Armoured Wall**: 8 × Aluminium Ingots, 6 × Advanced Alloy, 8 × Steel Ingots, 10 × Sack of Cement, 4 × Titanium Ingots, 6 × Advanced Steel Ingots · wymaga kamiennego muru · wioska płaci 400 g

### 3.8 Wielkie instalacje (odbudowa w 3 etapach, materiały z plecaka i bagażnika)

**Old Enrichment Plant**
1. Securing the plant: 8 × Steel Ingots, 10 × Sack of Cement, 4 × Machine Parts · nagroda 250 g
2. Power and control: 10 × Copper Cable, 4 × Circuit Boards, 4 × Machine Parts, 4 × Industrial Chemicals · nagroda 400 g
3. The core: 2 × Power Core, 4 × Advanced Alloy, 6 × Electronic Components · plany: **Uranium Enrichment** · nagroda 500 g

**Old Radar Station**
1. Clearing the compound: 20 × Planks, 8 × Stone, 10 × Scrap Metal · nagroda 150 g
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

**Old Aerospace Works**
1. Clearing the assembly hangar: 14 × Steel Ingots, 12 × Sack of Cement, 10 × Pallet of Cut Stone, 8 × Machine Parts · nagroda 350 g
2. The wind tunnel and power: 16 × Copper Cable, 4 × Control Units, 4 × Crate of Electric Motors, 2 × Industrial Pump, 4 × Industrial Chemicals · nagroda 500 g
3. The airframe line: 2 × Computer System, 4 × Titanium Ingots, 4 × Composite Sheets, 2 × Precision Components · plany: **Aerospace Engineering** · nagroda 800 g

**Ancient Power Complex**
1. Clearing the turbine halls: 16 × Steel Ingots, 16 × Sack of Cement, 12 × Pallet of Bricks, 8 × Machine Parts · nagroda 400 g
2. Generators and the switchyard: 4 × Generator, 20 × Copper Cable, 2 × High-Power Electronics, 2 × Industrial Pump · nagroda 550 g
3. Waking the core: 4 × Power Control Module, 1 × Computer System, 6 × Advanced Steel Ingots, 2 × Power Core · plany: **Ancient Power Grid** · nagroda 900 g

**Old Radar Station, sensor array** (po odbudowie, zasięg 20 km): 4 × Sensors, 2 × Microchips, 6 × Copper Cable, 2 × Platinum Group Metals, 1 × Computer System · nagroda 300 g

### 3.9 Chariot of the Ancients (Rydwan w hangarze przy Gridholm)

- **Hull Plating:** 16 × Steel Ingots, 10 × Aluminium Ingots, 6 × Ancient Alloy, 6 × Aerospace Components, 4 × Composite Sheets
- **Main Engines:** 6 × Ancient Alloy, 8 × Precision Components, 10 × Copper Cable, 3 × Rocket Engine
- **Avionics:** 8 × Circuit Boards, 6 × Microchips, 4 × Sensors, 12 × Copper Cable, 3 × Avionics Modules
- **Heat Shield:** 16 × Advanced Ceramics, 4 × Ancient Alloy
- **Power System:** 8 × Power Cells, 4 × Microchips, 8 × Copper Cable, 2 × Power Control Module
- **Life Support:** 4 × Life Support Systems, 2 × Composite Sheets, 1 × Computer System
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

### 3.11 Mosty, doki, łodzie i statki (budujesz sam, materiały z plecaka i bagażnika)

- **Most na brodzie drogi** albo w wybranym miejscu (Bridge Kit u kowala): na długość pomostu: Planks 1 na 0.8 m, Stone 1 na 4 m, Nails 1 na 2 m, Rope 1 na 6 m (np. pomost 40 m: 50 × Planks, 10 × Stone, 20 × Nails, 7 × Rope)
- **Dok** (Dock Kit u kowala): na długość pomostu: Planks 1 na 0.7 m, Stone 1 na 5 m, Nails 1 na 2 m, Rope 1 na 4 m, do tego 3 × Scrap Metal, 2 × Wire na głowicę
- **Rowboat** (na pochylni gotowego doku; ładownia 10): 20 × Planks, 14 × Nails, 4 × Rope
- **Sailing Skiff** (przeróbka łodzi wiosłowej przy doku; ładownia 14): 12 × Planks, 10 × Rope, 6 × Ravager Hide, 8 × Nails
- **Motor Skiff** (przeróbka łodzi wiosłowej przy doku; ładownia 14): 8 × Scrap Metal, 2 × Engine Parts, 6 × Nails, 2 × Rope, 4 × Planks
- **Sailing Ship** (na pochylni gotowego doku; ładownia 48): 160 × Planks, 90 × Nails, 40 × Rope, 20 × Ravager Hide, 10 × Scrap Metal
- **Motor Ship** (na pochylni gotowego doku; ładownia 40): 140 × Planks, 80 × Nails, 16 × Rope, 40 × Scrap Metal, 6 × Engine Parts, 12 × Wire
- Napęd silnikowy pali **Fuel Canister** (20 L w kanistrze; bak: Motor Skiff 30 L, Motor Ship 200 L)

### 3.12 Za złoto

- Dom w Gridholm: 750 g · pojazdy u Kuby: RTV-1 Scout 350 g, HTV-6 Mastodon 900 g

## 4. Indeks: gdzie użyć każdego materiału

| Materiał | Objętość | Użycie |
|---|---|---|
| Advanced Alloy | 8 L | kowal → Precision Drivetrain; kowal → Composite Helmet; kowal → Composite Armour; kowal → Composite Greaves; kowal → Composite Boots; kowal → Composite Cargo Pack; budowa: Small Reactor; ulepszenie wioski: Armoured Wall; odbudowa: Old Enrichment Plant; odbudowa: Old Radar Station; odbudowa: Old Propellant Plant; odbudowa: Old Battery Plant; odbudowa: Old Optical Works; odbudowa: Old Alloy Complex |
| Advanced Ceramics | 10 L | przetwarzanie: Old Aerospace Works → Rocket Engine; kowal → Composite Armour; Rydwan: Heat Shield |
| Advanced Steel Ingots | 6 L | przetwarzanie: Old Aerospace Works → Aerospace Components; kowal → Powered Exoskeleton; ulepszenie wioski: Armoured Wall; odbudowa: Ancient Power Complex |
| Aerospace Components | 30 L | Rydwan: Hull Plating |
| Aluminium Ingots | 8 L | przetwarzanie: Glassworks → Optical Components; przetwarzanie: Alloy Foundry → Advanced Alloy; przetwarzanie: Old Alloy Complex → Ancient Alloy; przetwarzanie: Old Alloy Complex → Advanced Ceramics; przetwarzanie: Old Aerospace Works → Aerospace Components; kowal → Frame Pack; ulepszenie wioski: Armoured Wall; Rydwan: Hull Plating |
| Ancient Alloy | 6 L | przetwarzanie: Old Precision Works → Precision Components; przetwarzanie: Old Aerospace Works → Rocket Engine; kowal → Powered Exoskeleton; odbudowa: Old Precision Works; Rydwan: Hull Plating; Rydwan: Main Engines; Rydwan: Heat Shield |
| Auto Turret | 16 L | budowa: Auto Turret |
| Automation Units | 12 L | kowal → Powered Exoskeleton; ulepszenie wioski: Automated Site |
| Avionics Modules | 14 L | Rydwan: Avionics |
| Bale of Cotton | 16 L | przetwarzanie: Textile Mill → Bolt of Cloth |
| Bale of Flax Fibre | 16 L | przetwarzanie: Textile Mill → Bolt of Cloth |
| Bale of Wool | 18 L | przetwarzanie: Textile Mill → Bolt of Cloth |
| Barrel of Crude Oil | 14 L | przetwarzanie: Oil Refinery → Fuel Canister; przetwarzanie: Oil Refinery → Plastic Resin; przetwarzanie: Chemical Works → Industrial Chemicals; przetwarzanie: Polymer Plant → Plastic Resin |
| Basic Batteries | 10 L | kowal → Energy Cells; kowal → GPS Tablet; ulepszenie wioski: Battery Bank; ulepszenie wioski: Battery Lamps |
| Basket of Eggs | 10 L | sklep spożywczy → Boiled Eggs |
| Bolt of Cloth | 9 L | przetwarzanie: Old Alloy Complex → Composite Sheets; kowal → Woven Hood; kowal → Woven Jacket; kowal → Woven Gloves; kowal → Woven Trousers; kowal → Woven Boots; kowal → Frame Pack; kowal → Composite Helmet; kowal → Composite Armour; kowal → Composite Gloves; kowal → Composite Greaves; kowal → Composite Cargo Pack |
| Bundle of Pipes & Valves | 20 L | przetwarzanie: Advanced Electronics Works → High-Power Electronics; przetwarzanie: Life Support Works → Life Support Systems; przetwarzanie: Heavy Engineering Works → Drill Rig; budowa: Chemical Works; budowa: Polymer Plant; budowa: Silicon Processing; budowa: Life Support Works |
| Churn of Milk | 20 L | sklep spożywczy → Cup of Milk; sklep spożywczy → Cheese |
| Circuit Boards | 8 L | przetwarzanie: Electronics Shop → Control Units; budowa: Advanced Electronics Works; odbudowa: Old Enrichment Plant; odbudowa: Old Radar Station; odbudowa: Old Chip Foundry; odbudowa: Old Propellant Plant; odbudowa: Old Battery Plant; odbudowa: Old Optical Works; odbudowa: Old Alloy Complex; odbudowa: Old Precision Works; odbudowa: Old Robotics Plant; Rydwan: Avionics |
| Composite Sheets | 12 L | przetwarzanie: Old Aerospace Works → Aerospace Components; kowal → Composite Armour; odbudowa: Old Aerospace Works; Rydwan: Hull Plating; Rydwan: Life Support |
| Computer System | 20 L | przetwarzanie: Avionics Works → Avionics Modules; budowa: Avionics Works; odbudowa: Old Aerospace Works; odbudowa: Ancient Power Complex; ulepszenie: radar (sensor array); Rydwan: Life Support |
| Control Units | 8 L | przetwarzanie: Advanced Electronics Works → Computer System; przetwarzanie: Advanced Electronics Works → Power Control Module; przetwarzanie: Avionics Works → Avionics Modules; budowa: Life Support Works; ulepszenie elektrowni: Automated; ulepszenie wioski: Automated Site; odbudowa: Old Aerospace Works |
| Copper Cable | 10 L | przetwarzanie: Electronics Shop → Circuit Boards; przetwarzanie: Electronics Shop → Control Units; kowal → Powered Exoskeleton; budowa: Aluminium Works; budowa: Electrical Works; budowa: Advanced Metallurgy; budowa: Silicon Processing; budowa: Advanced Electronics Works; budowa: Avionics Works; budowa: Heavy Engineering Works; budowa: Small Reactor; ulepszenie elektrowni: Automated; ulepszenie wioski: Battery Bank; ulepszenie wioski: Battery Lamps; ulepszenie wioski: Automated Site; ulepszenie wioski: Sensor Sights; odbudowa: Old Enrichment Plant; odbudowa: Old Radar Station; odbudowa: Old Chip Foundry; odbudowa: Old Propellant Plant; odbudowa: Old Battery Plant; odbudowa: Old Optical Works; odbudowa: Old Alloy Complex; odbudowa: Old Precision Works; odbudowa: Old Robotics Plant; odbudowa: Old Aerospace Works; odbudowa: Ancient Power Complex; ulepszenie: radar (sensor array); Rydwan: Main Engines; Rydwan: Avionics; Rydwan: Power System |
| Copper Ingots | 8 L | przetwarzanie: Wire Mill → Copper Cable; przetwarzanie: Machine Shop → Bundle of Pipes & Valves; przetwarzanie: Electrical Works → Crate of Electric Motors; przetwarzanie: Electrical Works → Generator; przetwarzanie: Advanced Electronics Works → High-Power Electronics; przetwarzanie: Old Chip Foundry → Microchips; przetwarzanie: Old Battery Plant → Power Cells |
| Copper Ore | 1.2 L | kowal → Electronic Components |
| Crate of Bauxite | 10 L | przetwarzanie: Aluminium Works → Aluminium Ingots |
| Crate of Chromite Ore | 10 L | przetwarzanie: Advanced Metallurgy → Advanced Steel Ingots |
| Crate of Clay | 10 L | przetwarzanie: Brickworks → Pallet of Bricks; przetwarzanie: Old Alloy Complex → Advanced Ceramics |
| Crate of Coal | 10 L | przetwarzanie: Brickworks → Pallet of Bricks; przetwarzanie: Cement Works → Sack of Cement; przetwarzanie: Smelter → Iron Bars; przetwarzanie: Smelter → Copper Ingots; przetwarzanie: Smelter → Lead Ingots; przetwarzanie: Glassworks → Glass Panes; przetwarzanie: Steelworks → Steel Ingots; przetwarzanie: Aluminium Works → Aluminium Ingots; paliwo: siłownie wielkich instalacji; paliwo: Coal Power Station |
| Crate of Copper Ore | 10 L | przetwarzanie: Smelter → Copper Ingots |
| Crate of Electric Motors | 14 L | przetwarzanie: Machine Shop → Industrial Pump; przetwarzanie: Heavy Engineering Works → Drill Rig; budowa: Advanced Electronics Works; budowa: Heavy Engineering Works; ulepszenie wioski: Automated Site; odbudowa: Old Aerospace Works |
| Crate of Gears & Bearings | 10 L | przetwarzanie: Heavy Engineering Works → Drill Rig; przetwarzanie: Heavy Engineering Works → Engine Parts; mechanik → RTV-1 Scout; mechanik → HTV-6 Mastodon; budowa: Heavy Engineering Works; budowa: Wind Farm |
| Crate of Iron Ore | 10 L | przetwarzanie: Smelter → Iron Bars |
| Crate of Lead Ore | 8 L | przetwarzanie: Smelter → Lead Ingots |
| Crate of Limestone | 10 L | przetwarzanie: Cement Works → Sack of Cement; przetwarzanie: Steelworks → Steel Ingots |
| Crate of Lithium Brine Salt | 10 L | przetwarzanie: Old Battery Plant → Power Cells |
| Crate of Meat | 16 L | sklep spożywczy → Roasted Meat |
| Crate of Nickel Ore | 8 L | przetwarzanie: Alloy Foundry → Advanced Alloy; przetwarzanie: Advanced Metallurgy → Advanced Steel Ingots; przetwarzanie: Old Battery Plant → Power Cells; przetwarzanie: Old Alloy Complex → Ancient Alloy |
| Crate of Platinum Ore | 8 L | przetwarzanie: Advanced Metallurgy → Platinum Group Metals |
| Crate of Rare Earths | 8 L | przetwarzanie: Old Chip Foundry → Microchips; przetwarzanie: Old Optical Works → Sensors |
| Crate of Rutile Sand | 10 L | przetwarzanie: Advanced Metallurgy → Titanium Ingots |
| Crate of Sulfur | 10 L | przetwarzanie: Chemical Works → Industrial Chemicals; przetwarzanie: Old Propellant Plant → Rocket Propellant |
| Crate of Uranium Ore | 8 L | przetwarzanie: Old Enrichment Plant → Nuclear Fuel Rods |
| Electronic Components | 0.4 L | przetwarzanie: Electronics Shop → Control Units; kowal → Compass; kowal → Engine Parts; kowal → Turbocharger; kowal → Sensor Compass; kowal → Energy Cells; kowal → GPS Tablet; kowal → Vehicle Repair Kit; mechanik → RTV-1 Scout; mechanik → HTV-6 Mastodon; mechanik → 2 × Vehicle Repair Kit; budowa: Auto Turret; budowa: Oil Refinery; budowa: Chemical Works; budowa: Polymer Plant; budowa: Aluminium Works; budowa: Battery Works; budowa: Electronics Shop; budowa: Electrical Works; budowa: Solar Farm; budowa: Small Reactor; budowa: rafineria; ulepszenie elektrowni: Rebuilt with old electronics; ulepszenie elektrowni: Automated; odbudowa: Old Enrichment Plant; odbudowa: Old Radar Station; odbudowa: Old Chip Foundry; odbudowa: Old Propellant Plant; odbudowa: Old Battery Plant; odbudowa: Old Optical Works; odbudowa: Old Alloy Complex; odbudowa: Old Precision Works; naprawa: Solar Array; naprawa: Refinery |
| Engine Parts | 6 L | mechanik → RTV-1 Scout; mechanik → HTV-6 Mastodon; budowa: Wire Mill; budowa: Steelworks; budowa: Machine Shop; budowa: Wind Farm; budowa: Coal Power Station; budowa: Diesel Generator Bank; naprawa: Diesel Generator; Motor Skiff; Motor Ship |
| Fuel Canister | 12 L | przetwarzanie: Old Propellant Plant → Rocket Propellant; paliwo: siłownie wielkich instalacji; paliwo: Diesel Generator Bank; paliwo łodzi i statków z silnikiem |
| Generator | 40 L | budowa: Advanced Metallurgy; budowa: Coal Power Station; budowa: Diesel Generator Bank; ulepszenie elektrowni: Rebuilt with old electronics; odbudowa: Ancient Power Complex |
| Glass Panes | 12 L | przetwarzanie: Glassworks → Optical Components; przetwarzanie: Electronics Shop → Circuit Boards; przetwarzanie: Silicon Processing → Purified Silicon; przetwarzanie: Old Chip Foundry → Microchips; przetwarzanie: Old Optical Works → Sensors; kowal → Hunting Rifle; kowal → GPS Tablet; ulepszenie wioski: Battery Lamps; odbudowa: Old Chip Foundry; odbudowa: Old Battery Plant; odbudowa: Old Optical Works; odbudowa: Old Precision Works |
| High-Power Electronics | 12 L | przetwarzanie: Advanced Electronics Works → Power Control Module; ulepszenie elektrowni: Automated; odbudowa: Ancient Power Complex |
| Industrial Chemicals | 16 L | przetwarzanie: Polymer Plant → Plastic Resin; przetwarzanie: Battery Works → Basic Batteries; przetwarzanie: Advanced Metallurgy → Titanium Ingots; przetwarzanie: Advanced Metallurgy → Platinum Group Metals; przetwarzanie: Silicon Processing → Purified Silicon; przetwarzanie: Life Support Works → Life Support Systems; przetwarzanie: Old Enrichment Plant → Nuclear Fuel Rods; przetwarzanie: Old Chip Foundry → Microchips; przetwarzanie: Old Propellant Plant → Rocket Propellant; przetwarzanie: Old Battery Plant → Power Cells; przetwarzanie: Old Optical Works → Sensors; przetwarzanie: Old Alloy Complex → Advanced Ceramics; kowal → Pistol Rounds; kowal → Shotgun Shells; kowal → Rifle Rounds; odbudowa: Old Enrichment Plant; odbudowa: Old Chip Foundry; odbudowa: Old Propellant Plant; odbudowa: Old Battery Plant; odbudowa: Old Optical Works; odbudowa: Old Alloy Complex; odbudowa: Old Precision Works; odbudowa: Old Robotics Plant; odbudowa: Old Aerospace Works |
| Industrial Pump | 30 L | przetwarzanie: Life Support Works → Life Support Systems; przetwarzanie: Old Aerospace Works → Rocket Engine; budowa: Chemical Works; budowa: Advanced Metallurgy; budowa: Silicon Processing; budowa: Life Support Works; budowa: Coal Power Station; odbudowa: Old Aerospace Works; odbudowa: Ancient Power Complex |
| Iron Bars | 8 L | przetwarzanie: Wire Mill → Wire; przetwarzanie: Steelworks → Steel Ingots; kowal → Wire |
| Iron Ore | 1.2 L | kowal → Scrap Metal |
| Lead Ingots | 6 L | przetwarzanie: Battery Works → Basic Batteries; kowal → Pistol Rounds; kowal → Shotgun Shells; kowal → Rifle Rounds |
| Leechwing Membrane | 1 L | kowal → Gas Mask |
| Life Support Systems | 30 L | Rydwan: Life Support |
| Log | 6 L | przetwarzanie: Sawmill → Planks; kowal → Hatchet; kowal → Pickaxe; kowal → Fire Kit; kowal → Saw; kowal → Planks; kowal → Scrap Metal; kowal → Mask Filter |
| Machine Parts | 12 L | przetwarzanie: Machine Shop → Industrial Pump; przetwarzanie: Electrical Works → Generator; kowal → Precision Drivetrain; kowal → Salvage Exoframe; mechanik → RTV-1 Scout; mechanik → HTV-6 Mastodon; mechanik → 2 × Vehicle Repair Kit; odbudowa: Old Enrichment Plant; odbudowa: Old Chip Foundry; odbudowa: Old Propellant Plant; odbudowa: Old Battery Plant; odbudowa: Old Optical Works; odbudowa: Old Alloy Complex; odbudowa: Old Precision Works; odbudowa: Old Robotics Plant; odbudowa: Old Aerospace Works; odbudowa: Ancient Power Complex |
| Microchips | 6 L | przetwarzanie: Advanced Electronics Works → Computer System; przetwarzanie: Old Precision Works → Precision Components; przetwarzanie: Old Robotics Plant → Automation Units; zamówienia na czipy (wioski rzemieślnicze); ulepszenie elektrowni: Automated; ulepszenie wioski: Sensor Sights; odbudowa: Old Precision Works; odbudowa: Old Robotics Plant; ulepszenie: radar (sensor array); Rydwan: Avionics; Rydwan: Power System |
| Nails | 0.2 L | budowa: mur Timber Palisade; budowa: mur Stone Wall; budowa: Textile Mill; budowa: Machine Shop; budowa: Stoneworks; naprawa: Fields; naprawa: Sawmill; most; dok; Rowboat; Sailing Skiff; Motor Skiff; Sailing Ship; Motor Ship |
| Nuclear Fuel Rods | 8 L | paliwo: własny reaktor Old Enrichment Plant; paliwo: Small Reactor; zamówienia na paliwo (stare reaktory) |
| Optical Components | 6 L | kowal → Sensor Compass; budowa: Avionics Works; ulepszenie wioski: Sensor Sights |
| Pallet of Bricks | 12 L | budowa: Cement Works; budowa: Smelter; budowa: Glassworks; budowa: Steelworks; budowa: Aluminium Works; budowa: Alloy Foundry; budowa: Electrical Works; budowa: Advanced Metallurgy; budowa: Silicon Processing; budowa: Advanced Electronics Works; budowa: Avionics Works; budowa: Life Support Works; budowa: Heavy Engineering Works; budowa: Coal Power Station; ulepszenie wioski: Battery Bank; odbudowa: Old Battery Plant; odbudowa: Old Alloy Complex; odbudowa: Old Robotics Plant; odbudowa: Ancient Power Complex |
| Pallet of Cut Stone | 24 L | budowa: mur Stone Wall; budowa: Coal Power Station; odbudowa: Old Aerospace Works |
| Planks | 1.5 L | kowal → Hammer; kowal → Screwdriver; kowal → Light Tire; kowal → Hull Plating; kowal → Spear; kowal → Sledgehammer; kowal → Hide Rucksack; budowa: mur Timber Palisade; budowa: mur Stone Wall; budowa: Barricades round the works; budowa: Barricades round the power plant; budowa: Sawmill; budowa: Brickworks; budowa: Cement Works; budowa: Smelter; budowa: Glassworks; budowa: Wire Mill; budowa: Oil Refinery; budowa: Textile Mill; budowa: Chemical Works; budowa: Electronics Shop; budowa: Stoneworks; budowa: Solar Farm; budowa: Wind Farm; budowa: Coal Power Station; budowa: rafineria; budowa: farma; ulepszenie elektrowni: Overhauled; odbudowa: Old Radar Station; naprawa: Fields; naprawa: Mine; naprawa: Sawmill; naprawa: Fish Racks; naprawa: Workshops; most; dok; Rowboat; Sailing Skiff; Motor Skiff; Sailing Ship; Motor Ship |
| Plastic Resin | 14 L | przetwarzanie: Electronics Shop → Circuit Boards; przetwarzanie: Electrical Works → Crate of Electric Motors; przetwarzanie: Old Alloy Complex → Composite Sheets; kowal → Composite Helmet; kowal → Composite Armour; kowal → Composite Gloves; kowal → Composite Greaves; kowal → Composite Boots; kowal → Composite Cargo Pack |
| Platinum Group Metals | 3 L | kowal → Sensor Compass; ulepszenie: radar (sensor array) |
| Power Cells | 8 L | przetwarzanie: Old Robotics Plant → Automation Units; paliwo: siłownie wielkich instalacji; kowal → Powered Exoskeleton; ulepszenie wioski: Battery Bank; odbudowa: Old Robotics Plant; Rydwan: Power System |
| Power Control Module | 18 L | kowal → Powered Exoskeleton; budowa: Small Reactor; ulepszenie wioski: Battery Bank; odbudowa: Ancient Power Complex; Rydwan: Power System |
| Power Core | 1 L | kowal → Turbocharger; kowal → GPS Tablet; budowa: Alloy Foundry; budowa: Small Reactor; ulepszenie elektrowni: Rebuilt with old electronics; odbudowa: Old Enrichment Plant; odbudowa: Old Chip Foundry; odbudowa: Old Propellant Plant; odbudowa: Old Battery Plant; odbudowa: Old Optical Works; odbudowa: Old Alloy Complex; odbudowa: Ancient Power Complex |
| Precision Components | 6 L | przetwarzanie: Old Aerospace Works → Rocket Engine; przetwarzanie: Old Robotics Plant → Automation Units; kowal → Precision Drivetrain; kowal → Powered Exoskeleton; ulepszenie elektrowni: Automated; ulepszenie wioski: Automated Site; odbudowa: Old Robotics Plant; odbudowa: Old Aerospace Works; Rydwan: Main Engines |
| Purified Silicon | 6 L | przetwarzanie: Advanced Electronics Works → High-Power Electronics; przetwarzanie: Advanced Electronics Works → Computer System |
| Ravager Hide | 3 L | kowal → Empty Flask; kowal → Gas Mask; kowal → Machete; kowal → Hide Cap; kowal → Hide Coat; kowal → Hide Gloves; kowal → Hide Leggings; kowal → Hide Boots; kowal → Hide Rucksack; kowal → Woven Jacket; kowal → Woven Boots; kowal → Composite Boots; kowal → Salvage Exoframe; Sailing Skiff; Sailing Ship |
| Rocket Engine | 60 L | Rydwan: Main Engines |
| Rocket Propellant | 14 L | Rydwan: Propellant |
| Rope | 1.5 L | kowal → Vehicle Repair Kit; kowal → Hide Coat; kowal → Hide Rucksack; kowal → Frame Pack; budowa: mur Timber Palisade; budowa: Barricades round the works; budowa: Barricades round the power plant; naprawa: Wind Turbines; naprawa: Fish Racks; most; dok; Rowboat; Sailing Skiff; Motor Skiff; Sailing Ship; Motor Ship |
| Sack of Carrots | 14 L | sklep spożywczy → Hearty Stew |
| Sack of Cement | 16 L | budowa: mur Stone Wall; budowa: Steelworks; budowa: Chemical Works; budowa: Polymer Plant; budowa: Aluminium Works; budowa: Battery Works; budowa: Alloy Foundry; budowa: Advanced Metallurgy; budowa: Silicon Processing; budowa: Advanced Electronics Works; budowa: Avionics Works; budowa: Life Support Works; budowa: Heavy Engineering Works; budowa: Coal Power Station; budowa: Small Reactor; ulepszenie wioski: Armoured Wall; odbudowa: Old Enrichment Plant; odbudowa: Old Chip Foundry; odbudowa: Old Propellant Plant; odbudowa: Old Battery Plant; odbudowa: Old Optical Works; odbudowa: Old Alloy Complex; odbudowa: Old Precision Works; odbudowa: Old Robotics Plant; odbudowa: Old Aerospace Works; odbudowa: Ancient Power Complex |
| Sack of Grain | 14 L | sklep spożywczy → Bread |
| Sack of Potatoes | 14 L | sklep spożywczy → Hearty Stew |
| Sack of Quartz Sand | 12 L | przetwarzanie: Glassworks → Glass Panes |
| Salt Blocks | 7 L | przetwarzanie: Chemical Works → Industrial Chemicals |
| Scrap Metal | 1.5 L | przetwarzanie: Smelter → Iron Bars; kowal → Hammer; kowal → Screwdriver; kowal → Pliers; kowal → Nails; kowal → Electronic Components; kowal → Compass; kowal → Light Tire; kowal → Hull Plating; kowal → Engine Parts; kowal → Gas Mask; kowal → Mask Filter; kowal → Turbocharger; kowal → Sensor Compass; kowal → Pistol Rounds; kowal → Shotgun Shells; kowal → Old Pistol; kowal → Scrap SMG; kowal → Scattergun; kowal → Hunting Rifle; kowal → Machete; kowal → Spear; kowal → Sledgehammer; kowal → Vehicle Repair Kit; mechanik → RTV-1 Scout; mechanik → HTV-6 Mastodon; mechanik → 2 × Vehicle Repair Kit; budowa: mur Stone Wall; budowa: Auto Turret; budowa: Barricades round the works; budowa: Barricades round the power plant; budowa: Sawmill; budowa: Brickworks; budowa: Cement Works; budowa: Smelter; budowa: Glassworks; budowa: Wire Mill; budowa: Oil Refinery; budowa: Textile Mill; budowa: Steelworks; budowa: Chemical Works; budowa: Polymer Plant; budowa: Aluminium Works; budowa: Battery Works; budowa: Electronics Shop; budowa: Machine Shop; budowa: Alloy Foundry; budowa: Electrical Works; budowa: Stoneworks; budowa: Solar Farm; budowa: Wind Farm; budowa: Coal Power Station; budowa: Diesel Generator Bank; budowa: rafineria; budowa: stalowe pługi; ulepszenie elektrowni: Overhauled; odbudowa: Old Radar Station; naprawa: Diesel Generator; naprawa: Wind Turbines; naprawa: Mine; naprawa: Oil Wells; naprawa: Refinery; naprawa: Workshops; naprawa: Salvage Yard; dok; Motor Skiff; Sailing Ship; Motor Ship |
| Sensors | 6 L | przetwarzanie: Avionics Works → Avionics Modules; przetwarzanie: Old Robotics Plant → Automation Units; kowal → Sensor Compass; ulepszenie wioski: Sensor Sights; odbudowa: Old Robotics Plant; ulepszenie: radar (sensor array); Rydwan: Avionics |
| Stack of Lumber | 16 L | kowal → Scattergun; kowal → Hunting Rifle; budowa: Textile Mill; budowa: Polymer Plant; budowa: Battery Works; budowa: Machine Shop; budowa: Alloy Foundry; budowa: Electrical Works |
| Steel Ingots | 8 L | przetwarzanie: Machine Shop → Machine Parts; przetwarzanie: Machine Shop → Crate of Tools; przetwarzanie: Machine Shop → Bundle of Pipes & Valves; przetwarzanie: Machine Shop → Crate of Gears & Bearings; przetwarzanie: Machine Shop → Industrial Pump; przetwarzanie: Alloy Foundry → Advanced Alloy; przetwarzanie: Electrical Works → Crate of Electric Motors; przetwarzanie: Electrical Works → Generator; przetwarzanie: Advanced Metallurgy → Advanced Steel Ingots; przetwarzanie: Heavy Engineering Works → Drill Rig; przetwarzanie: Heavy Engineering Works → Engine Parts; przetwarzanie: Old Alloy Complex → Ancient Alloy; przetwarzanie: Old Precision Works → Precision Components; kowal → Rifle Rounds; kowal → Old Pistol; kowal → Scrap SMG; kowal → Scattergun; kowal → Hunting Rifle; kowal → Salvage Exoframe; mechanik → HTV-6 Mastodon; budowa: Advanced Metallurgy; budowa: Silicon Processing; budowa: Advanced Electronics Works; budowa: Avionics Works; budowa: Life Support Works; budowa: Heavy Engineering Works; budowa: Small Reactor; ulepszenie wioski: Automated Site; ulepszenie wioski: Armoured Wall; odbudowa: Old Enrichment Plant; odbudowa: Old Radar Station; odbudowa: Old Chip Foundry; odbudowa: Old Propellant Plant; odbudowa: Old Battery Plant; odbudowa: Old Optical Works; odbudowa: Old Alloy Complex; odbudowa: Old Precision Works; odbudowa: Old Robotics Plant; odbudowa: Old Aerospace Works; odbudowa: Ancient Power Complex; Rydwan: Hull Plating |
| Stone | 2 L | przetwarzanie: Stoneworks → Pallet of Cut Stone; kowal → Hatchet; kowal → Pickaxe; kowal → Saw; budowa: mur Stone Wall; budowa: Barricades round the works; budowa: Barricades round the power plant; budowa: Sawmill; budowa: Brickworks; budowa: Cement Works; budowa: Smelter; budowa: Glassworks; budowa: Coal Power Station; budowa: farma; odbudowa: Old Radar Station; most; dok |
| Timber Bundle | 20 L | przetwarzanie: Sawmill → Stack of Lumber; przetwarzanie: Machine Shop → Crate of Tools |
| Titanium Ingots | 6 L | przetwarzanie: Life Support Works → Life Support Systems; przetwarzanie: Old Alloy Complex → Composite Sheets; przetwarzanie: Old Aerospace Works → Aerospace Components; kowal → Powered Exoskeleton; ulepszenie wioski: Armoured Wall; odbudowa: Old Aerospace Works |
| Wire | 0.5 L | kowal → Scrap SMG; kowal → Vehicle Repair Kit; kowal → Woven Hood; kowal → Woven Jacket; kowal → Woven Gloves; kowal → Woven Trousers; kowal → Woven Boots; kowal → Salvage Exoframe; budowa: Auto Turret; budowa: Wire Mill; budowa: Oil Refinery; budowa: Chemical Works; budowa: Polymer Plant; budowa: Battery Works; budowa: Electronics Shop; budowa: Solar Farm; budowa: Wind Farm; budowa: Diesel Generator Bank; budowa: rafineria; budowa: stalowe pługi; ulepszenie elektrowni: Overhauled; ulepszenie elektrowni: Rebuilt with old electronics; naprawa: Solar Array; naprawa: Wind Turbines; naprawa: Oil Wells; naprawa: Salvage Yard; dok; Motor Ship |

## 5. Surowce bez zastosowania w budowach i przetwarzaniu (na razie)

Te rzeczy można tylko sprzedać (na targu albo kowalowi/Janowi), zjeść albo przewieźć w kontraktach:

Dried Fish, Crate of Tools, Medical Supplies, Salvaged Tech, Drill Rig, Raw Meat, Bramble Plate, Ravager Fang, Gnawer Incisor, Raw Fish.

## 6. Klasy przedmiotów

Hierarchia z dokumentu „Surowce, przemysł, komponenty i technologie” (pkt 9); klasa jest też w podpowiedzi przedmiotu w grze.

- **RAW · surowce:** Timber Bundle, Crate of Iron Ore, Crate of Coal, Crate of Copper Ore, Barrel of Crude Oil, Salt Blocks, Crate of Bauxite, Crate of Sulfur, Crate of Lithium Brine Salt, Crate of Rare Earths, Crate of Uranium Ore, Sack of Quartz Sand, Crate of Clay, Crate of Limestone, Crate of Lead Ore, Crate of Nickel Ore, Crate of Chromite Ore, Crate of Rutile Sand, Crate of Platinum Ore, Log, Stone, Iron Ore, Copper Ore, Ravager Hide, Ravager Fang, Bramble Plate, Leechwing Membrane, Gnawer Incisor
- **FOOD / AGRICULTURE · żywność i uprawy:** Sack of Grain, Sack of Carrots, Sack of Potatoes, Dried Fish, Basket of Eggs, Churn of Milk, Bale of Flax Fibre, Bale of Wool, Bale of Cotton, Crate of Meat
- **MATERIAL · materiały:** Bolt of Cloth, Medical Supplies, Fuel Canister, Salvaged Tech, Composite Sheets, Nuclear Fuel Rods, Steel Ingots, Copper Ingots, Plastic Resin, Glass Panes, Rocket Propellant, Stack of Lumber, Iron Bars, Pallet of Bricks, Sack of Cement, Industrial Chemicals, Aluminium Ingots, Lead Ingots, Pallet of Cut Stone, Advanced Steel Ingots, Titanium Ingots, Purified Silicon, Platinum Group Metals, Scrap Metal, Planks, Nails, Rope
- **INDUSTRIAL · komponenty przemysłowe:** Crate of Tools, Drill Rig, Machine Parts, Crate of Electric Motors, Bundle of Pipes & Valves, Crate of Gears & Bearings, Industrial Pump, Engine Parts, Hull Plating
- **ELECTRICAL / ELECTRONIC · elektryka i elektronika:** Power Cells, Copper Cable, Circuit Boards, Generator, Control Units, High-Power Electronics, Power Control Module, Basic Batteries, Electronic Components, Wire
- **ADVANCED · zaawansowane:** Microchips, Sensors, Ancient Alloy, Precision Components, Automation Units, Advanced Ceramics, Advanced Alloy, Optical Components, Computer System, Power Core
- **AEROSPACE · program kosmiczny:** Avionics Modules, Life Support Systems, Rocket Engine, Aerospace Components
