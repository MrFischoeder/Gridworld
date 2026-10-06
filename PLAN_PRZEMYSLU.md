# Plan: surowce, przemysł, komponenty i technologie

Plan wdrożenia dokumentu właściciela „GridWorld 03 — Surowce, przemysł, komponenty i technologie v0.3C”. Każdy etap jest rozpisany pod kątem gry wieloosobowej (zasada projektu z `CLAUDE.md`).

## Co z dokumentu już było (stan na 0.142)

- **Etapy gospodarki:**
  - I: ręczne zbieranie (drewno, kamień, jedzenie) i proste warsztaty;
  - II: lokalny przemysł (kopalnie, huta, szklarnia, walcownia drutu);
  - III: salvage z ruin, robotów i wraków (Electronic Components, Power Core);
  - V: starożytne kompleksy;
  - VI: Rydwan jako program kosmiczny.
- **Surowce:**
  - Wood, Stone, Clay, Coal, Iron Ore, Copper Ore, Bauxite, Lead, Crude Oil, Sulfur, Salt;
  - Quartz sand (`sand`), Lithium, Nickel, Uranium, Rare Earths, Limestone;
  - woda: rzeki, jeziora, studnie.
- **Materiały:**
  - Lumber, Bricks, Cement, Iron, Steel (bez koksu: decyzja właściciela z `PLAN_GOSPODARKI.md`);
  - Copper ingots, Aluminium, Lead, Glass, Fuel, Plastic, Industrial Chemicals;
  - Advanced Alloy, Propellant, Ceramics, Ancient Alloy.
- **Komponenty:**
  - Machine Parts, Cable, Circuit Boards, Batteries, Power Cells;
  - Electronic Components (salvage), Microchips, Sensors, Precision Components, Automation Units.
- **Kompleksy:** wzbogacanie uranu, fabryka układów (Semiconductor Fab), materiały zaawansowane (Alloy Complex), czujniki (Optical Works), paliwo rakietowe, akumulatory, precyzja, robotyka, radar.
- **Technologie:** 29 technologii z nośników danych.

## Etapy

### 1. Komponenty przemysłowe, etap IV „Industrialization” (0.143, zrobione)
- **Nowe komponenty** (towary rynkowe, przetworzone):
  - Electric Motors (miedź + stal + tworzywo);
  - Generators (2 miedź + stal + części);
  - Pipes & Valves (stal + miedź → 2);
  - Gears & Bearings (stal);
  - Industrial Pumps (stal + części + silnik).
- **Nowy zakład Electrical Works** (silniki, generatory; technologia „Electric Machines”, dopisana na końcu `TECHS`, więc pozostałe zachowują swoje miejsca).
- **Machine Shop** dostaje receptury rur, przekładni i pomp (dopisane na końcu: stare receptury zachowują numery).
- **Salvage (pkt 8 dokumentu):** roboty i skrzynie we wrakach dają czasem silniki, przekładnie, rury, generatory i pompy, więc zanim gracz sam je wyprodukuje, zdobywa pojedyncze sztuki.
- **Zastosowania:**
  - farma wiatrowa: przekładnie;
  - zespół generatorów diesla: generatory;
  - elektrownia węglowa: generator i pompa;
  - przebudowa elektrowni wioski (poziom 2): generator;
  - Automated Site: silniki;
  - zakład chemiczny: rury i pompa;
  - zakład tworzyw: rury.
- **Hierarchia przedmiotów (pkt 9):** każdy przedmiot ma klasę RAW / FOOD / MATERIAL / INDUSTRIAL / ELECTRICAL / ADVANCED / AEROSPACE, pokazaną w podpowiedzi przedmiotu i w `SUROWCE.md`.
- **MP:** towary i zakłady we wspólnym stanie wioski i rynku, łupy przez wspólne zrzuty; protokół bez zmian.

### 2. Kamień (0.144, zrobione)
- Zakład Stoneworks (dla każdego, bez planów): 3 kamienie → 2 palety ciosanego kamienia (Cut Stone).
- Ciosany kamień potrzebny do kamiennego muru (Stone Wall) i elektrowni węglowej.
- Koks: decyzja właściciela, stal zostaje bez koksu.
- **MP:** zakład we wspólnym stanie wioski; protokół bez zmian.

### 3. Metale strategiczne (0.144, zrobione)
- Nowe złoża: chromit (od 9 km), rutyl (od 12 km), ruda platyny (od 13 km). Losowane osobno jako drugie złoże wioski (`metalOf`), więc stare złoża zostają bez zmian. Wydobycie w ramach dziennego przydziału zaufania (ten sam limit co stare złoże).
- Zakład Advanced Metallurgy (technologia z nośnika danych): stal stopowa (stal + nikiel + chromit), tytan (rutyl + chemia), metale z grupy platyny (ruda platyny + chemia).
- Zastosowania: opancerzony mur, Powered Exoskeleton (tytan, stal stopowa), Sensor Compass i macierz radaru (platyna).
- **MP:** złoża liczone z ziarna świata, identyczne u wszystkich; zakłady i przydział we wspólnym stanie wioski; protokół bez zmian.

### 4. Elektronika (0.145, zrobione)
- **Nowe towary** (rynkowe, przetworzone): Purified Silicon, Control Units, Optical Components, High-Power Electronics, Computer Systems, Power Control Modules.
- **Zakłady:**
  - Silicon Processing (technologia Semiconductor Industry): 2 szkło + chemia → 2 krzem;
  - Advanced Electronics Works (technologia Advanced Computing): elektronika dużej mocy (miedź, krzem, rury chłodzące), komputery (jednostka sterująca, mikroprocesor ze starej fabryki układów, krzem), moduły sterowania zasilaniem (elektronika dużej mocy + jednostka sterująca);
  - Electronics Shop dostaje jednostki sterujące (płytki, salvage, kabel), Glassworks optykę (szkło + aluminium); stare receptury zachowują numery.
- **Salvage:** roboty, skrzynie we wrakach, szafki w toksycznej mgle.
- **Zastosowania:** mały reaktor, bank baterii, Automated Site, elektrownia poziomu 3, Sensor Sights, Sensor Compass, macierz radaru, Powered Exoskeleton.
- **MP:** towary i zakłady we wspólnym stanie wiosek i rynku, łupy przez wspólne zrzuty; protokół bez zmian.

### 5. Kompleksy
- Aerospace Components Plant, Ancient Power Complex, materiały kompozytowe.

### 6. Program kosmiczny
- Avionics Modules, Life Support, Rocket Propulsion.
- Etapy Rydwanu według łańcucha „Shuttle” z dokumentu.
