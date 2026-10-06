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

### 2. Kamień i węgiel (do decyzji)
- Cut Stone / Aggregate (Stoneworks) do dróg i murów.
- Koks (Coke Oven). Dokument wymaga koksu do stali; wcześniej uzgodniono stal bez koksu. Do decyzji właściciela.

### 3. Metale strategiczne
- Nowe złoża: chrom, tytan, metale z grupy platyny (dopisane na końcu `RARES`, więc stare złoża zostają).
- Advanced Steel Alloys (stal + nikiel + chrom), Titanium (Advanced Metallurgy).

### 4. Elektronika
- Purified Silicon (Silicon Processing), Control Units, Optical Components, Computer Systems, High-Power Electronics, Power Control Modules.

### 5. Kompleksy
- Aerospace Components Plant, Ancient Power Complex, materiały kompozytowe.

### 6. Program kosmiczny
- Avionics Modules, Life Support, Rocket Propulsion.
- Etapy Rydwanu według łańcucha „Shuttle” z dokumentu.
