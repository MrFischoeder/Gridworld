# GridWorld: plan rozbudowy gospodarki

Uzgodniony plan wdrożenia dokumentu „GridWorld: kierunek rozwoju, gospodarka i odbudowa technologiczna” (29.09.2026), rozpisany na kod gry w wersji 0.89.x.

Dokument źródłowy mówi, **co** ma powstać. Ten plik mówi, **jak** to wpasować w istniejące systemy i w jakiej kolejności. Liczby są robocze, do balansu w etapie 8. Nazwy w grze są po angielsku.

## Decyzje właściciela (29.09.2026)

1. **Hutnictwo uproszczone.** Bez koksowni:
   - Iron Foundry: Iron Ore + Coal → Iron;
   - Steelworks: Iron + Coal + Limestone → Steel.
2. **Ancient Facilities mają własną siłownię.** Odbudowuje ją etap II każdej instalacji. Gracz dowozi do niej paliwo: węgiel, Fuel, a później pręty paliwowe. Nie ma linii przesyłowych.
3. **Plany wymagane tylko dla wyższych zakładów.**
   - Tier 1 jest dostępny od startu.
   - Tier 2 wymaga odzyskanej technologii.
   - Tier 3 to wyłącznie Ancient Facilities.
4. **Skala energii zostaje jak w grze.** Obecne moce źródeł i poboru zostają. Nowi odbiorcy (kopalnie, warsztaty, instalacje) dostają liczby w proporcjach z dokumentu, przeliczone na naszą skalę.

## Zasady, których pilnujemy w każdym etapie

- Deterministyczny świat: nowe złoża, przemysły i instalacje pochodzą z hashy.
- **Nowe losowania dopisujemy na końcu** (osobne strumienie hashy, nowe instalacje i technologie na końcu list), żeby istniejące wioski, złoża, nośniki i instalacje nie zmieniły miejsc ani rodzaju.
- Zapisy graczy muszą działać po każdej zmianie. Stare przedmioty zostają ważne albo są migrowane w `loadChar`. Ukończone etapy (Rydwan, instalacje) zostają ukończone, nawet jeśli wymagania się zmienią.
- Każdy nowy przedmiot dostaje:
  - wpis w `ITEMS` i `BULK`;
  - ikonę w `ui/icons.ts` (test `icons.test.ts`);
  - zastosowania w `data/uses.ts`;
  - cenę w `GOOD_INFO`, jeśli jest towarem rynkowym.

  Po każdym etapie regenerujemy `SUROWCE.md` / `.pdf` i dopisujemy wersję do `OPIS_GRY.md`.
- Nie mnożymy bytów. Każdy nowy surowiec ma mieć co najmniej 2 zastosowania.

---

## Etap 1 (0.90.0): surowce i półprodukty

**Nowe surowce (towary rynkowe, raw):**

| Towar | Skąd | Zastosowania |
|---|---|---|
| Clay | wioski rybackie i rolnicze (brzegi rzek; pula przemysłu) | Bricks, Advanced Ceramics |
| Limestone | kopalnie (pula `mine`) | Cement, Steel |
| Lead Ore (`lead`) | kopalnie (pula `mine`) | Lead → Basic Batteries |
| Nickel Ore (`nickel`) | rzadkie złoże (`RARES`, od ok. 10 km, dopisane na końcu losowania) | Advanced Alloy, Power Cells |

**Nowe półprodukty (towary rynkowe, made/proc):**

| Towar | Receptura | Tier |
|---|---|---|
| Lumber | Timber → Lumber | 1 |
| Bricks | Clay + Coal | 1 |
| Cement | Limestone + Coal | 1 |
| Iron | Ore + Coal | 1 |
| Industrial Chemicals (`chems`) | Crude + Sulfur + Salt | 2 |
| Aluminium | Bauxite + dużo prądu | 2 |
| Lead (`leadbar`) | Lead Ore + Coal | 1 |
| Basic Batteries (`batteries`) | Lead + Chemicals | 2 |

W tym etapie towary pojawiają się na rynkach, w pulach przemysłów i w cenach, ale receptury (zakłady) dochodzą dopiero w etapie 2. Istniejące `steel`, `copperbar`, `plastic`, `glass`, `cable`, `boards`, `parts`, `alloy`, `propellant` zostają.

**Hodowla (opcjonalnie, jeśli zostanie czas w tym etapie):**
- Flax Field → Fibre;
- Sheep → Wool;
- Pig Farm → Meat.

Mięso dostają też kury i krowy, skórę (`hide`, już istnieje) krowy. Textile Mill (Fibre / Wool → Cloth) w etapie 2.

## Etap 2 (0.91.0): zakłady wiosek i specjalizacja

Dalej 2 zakłady na wioskę (`PLANT_SLOTS`). Istniejące klucze `PlantKind` zostają, żeby stare zapisy działały. Stan z nieistniejącą już recepturą wraca do receptury 0.

**Tier 1 (od startu):**

| Zakład | Receptury |
|---|---|
| Sawmill (nowy) | Timber → Lumber |
| Brickworks (nowy) | Clay + Coal → Bricks |
| Cement Works (nowy) | Limestone + Coal → Cement |
| Iron Foundry (dotychczasowy `smelter`) | Ore + Coal → Iron; Copper + Coal → Copper Ingots; Lead Ore + Coal → Lead |
| Glassworks | Sand + Coal → Glass |
| Wire Mill | Copper Ingots → Cable (tymczasowo; w etapie 2b Cable = Copper Ingots + Plastic, jak w dokumencie) |
| Oil Refinery | Crude → Fuel |
| Textile Mill (nowy, jeśli jest hodowla) | Fibre / Wool → Cloth |

**Tier 2 (wymagają planów):**

| Zakład | Receptury | Technologia |
|---|---|---|
| Steelworks (nowy) | Iron + Coal + Limestone → Steel | `furnace` (Blast Furnace, już jest) |
| Chemical Plant (dotychczasowy `chemworks`) | Crude + Sulfur + Salt → Industrial Chemicals | `chemistry` (już jest) |
| Polymer Plant (część Oil Refinery albo nowy) | Crude + Chemicals → Plastic | `chemistry` |
| Aluminium Works (nowy) | Bauxite → Aluminium (pobór ok. 120 kW w naszej skali) | nowa: Aluminium Processing |
| Electronics Shop | Cable + Plastic + Glass → Circuit Boards | `circuits` (już jest) |
| Machine Shop | Steel + Copper Ingots → Machine Parts | `forging` (już jest) |
| Battery Works (nowy) | Lead + Chemicals → Basic Batteries | nowa: Battery Chemistry |
| Alloy Foundry (dotychczasowy `foundry`) | Steel + Aluminium + Nickel → Advanced Alloy (dotychczasowy `alloy`, przemianowany na Advanced Alloy) | nowa: Alloy Metallurgy |

- Paliwo rakietowe znika z zakładów wiosek, gdy powstanie Old Propellant Plant (etap 5). Do tego czasu Chemical Works robi je po staremu.
- Nowe technologie dopisujemy **na końcu `TECHS`**, żeby nośniki dotychczasowych technologii zostały na miejscu.
- Budowy nowych zakładów biorą Bricks, Cement i Lumber zamiast części desek i kamienia, żeby nowe półprodukty miały zastosowanie od razu.

## Etap 3 (0.92.0): energia ograniczeniem produkcji

- Miejsca przemysłu wiosek zaczynają pobierać prąd. Przykładowe liczby w naszej skali:
  - kopalnia 20 kW;
  - warsztat / złomowisko 25 kW;
  - tartak 15 kW;
  - szyby naftowe 20 kW;
  - rybołówstwo 5 kW;
  - rafineria 50 kW.
- Bez prądu miejsce przemysłu produkuje o połowę mniej. Farmy działają jak dziś.
- Kolejność zasilania w `balance`: wioska, farmy, miejsce przemysłu, zakłady (w kolejności budowy).
- Elder i terminal pokazują nowy podział w zakładce POWER.

## Etap 4 (0.93.0): model Ancient Facility na dwóch istniejących instalacjach

- **Siłownia instalacji** powstaje w etapie II odbudowy. Ma własny bunkier z paliwem (węgiel / Fuel / pręty) i moc, np.:
  - Enrichment: generatory 150 kW, a po rozruchu pierwszych prętów własny reaktor 250 kW;
  - Chip Foundry: 120 kW.

  Partia produkcji wymaga prądu na końcu, jak w zakładach wiosek.
- **Enrichment:** Uranium + Industrial Chemicals + prąd (pobór ok. 200 kW) → Nuclear Fuel. Pętla z dokumentu: najpierw paliwo z zewnątrz, potem reaktor na własnych prętach.
- **Chip Foundry:** Glass + Copper Ingots + Industrial Chemicals + Rare Earths + prąd (ok. 100 kW) → Microchips.
- Etapy odbudowy dostają funkcje z dokumentu:
  - I: Steel, Cement, Machine Parts;
  - II: Cable, Circuit Boards, Machine Parts, Chemicals oraz siłownia;
  - III: technologia i rzadkie komponenty.

  Już ukończone etapy zostają ukończone.
- Terminal instalacji w stylu z sekcji 11 dokumentu: POWER x/y kW, zapasy każdego wejścia, produkt, NEXT BATCH.

## Etap 5 (0.94–0.96): nowe Ancient Facilities

Dopisywane **na końcu `INSTALLS`**, żeby dotychczasowe zostały na miejscu. Każda ma 3 etapy odbudowy, własną siłownię, pulpit i rysunek.

| Instalacja | Wejście | Produkt | Pas | Technologia (etap III) |
|---|---|---|---|---|
| Old Propellant Plant | Fuel + Chemicals + Sulfur | Rocket Propellant | 10–18 km | `propellant` (już jest) |
| Old Battery Plant | Lithium + Nickel + Copper Ingots + Chemicals | Power Cells | 14–22 km | nowa: Power Cell Chemistry |
| Old Optical Works | Glass + Rare Earths + Chemicals | Sensors | 14–24 km | nowa: Advanced Sensors |
| Old Alloy Complex | Steel + Aluminium + Nickel | Ancient Alloy; drugi produkt Advanced Ceramics z Clay + Aluminium + Chemicals | 16–26 km | nowa: Ancient Metallurgy |
| Old Precision Works | Steel + Ancient Alloy + Microchips | Precision Components | 18–28 km | nowa: Precision Manufacturing |
| Old Robotics Plant | Microchips + Sensors + Precision Components + Power Cells | Automation Units | 22–32 km | nowa: Automation |

**Advanced Ceramics:** w dokumencie źródłowym brakowało receptury. Uzupełniamy ją jako drugi produkt Old Alloy Complex.

Kolejność wydań: 0.94 Propellant i Battery, 0.95 Optical i Alloy Complex, 0.96 Precision i Robotics. Plotki w wioskach (`askLead`) i konsola `sites` obejmują nowe instalacje od razu.

## Etap 6 (0.97.0): zastosowania komponentów (żadnych quest-itemów)

| Komponent | Zastosowania |
|---|---|
| Microchips | Automated Power Plant (już jest), Robotics, zamówienia czipów (już są), turrety na murach v2 |
| Power Cells | magazyn energii w wiosce (nocą oddaje moc farm słonecznych), silnik elektryczny Motor Boat / pojazdów, siłownie instalacji |
| Sensors | Radar Station v2 (większy zasięg), celownik turretów, ulepszenie kompasu (pokazuje instalacje) |
| Precision Components | ulepszenia silnika pojazdów, Rebuilt/Automated plant, naprawy instalacji |
| Automation Units | automatyzacja miejsca przemysłu (produkcja ×1,5 bez robotników), karawany wioski bez eskorty |
| Basic Batteries | lampy i radio wiosek, latarka gracza, turrety |
| Aluminium, Advanced Alloy | kadłuby łodzi i pojazdów (lżejsze), Stone Wall v2 |

## Etap 7 (0.98.0): Rydwan jako końcowy konsument

| System | Wymagania |
|---|---|
| Hull Plating | Steel + Aluminium + Ancient Alloy |
| Main Engines | Ancient Alloy + Precision Components + Cable |
| Avionics | Circuit Boards + Microchips + Sensors + Cable |
| Heat Shield | Advanced Ceramics + Ancient Alloy |
| Power System (nowy, 6. etap) | Power Cells + Microchips + Cable |
| Propellant | Rocket Propellant |

- Zapisy: to, co gracz już oddał, zostaje w `char.shuttle.given`. Etap ukończony po staremu zostaje ukończony. Nowe wymagania dotyczą tylko etapów nieukończonych.
- `gen/campaign.ts` (cuda i niespodzianki) dostaje nowe dobra w etapach „machine hall” i „heart”.

## Etap 8 (0.99.0): balans

- `tools/campaign.sim.ts` uczy się nowych łańcuchów (liczba zakładów, siłownie instalacji, odległości złóż). Cel: nadal ok. 80 h w pojedynkę.
- `SUROWCE.md`: sprawdzenie, że każdy surowiec ma co najmniej 2 zastosowania i każda receptura zarabia co najmniej 1,2× wartości wejść (istniejący test).
- Pomiar wydajności (F3) przy nowych instalacjach.

---

## Łańcuchy po zmianach (skrót)

- **Stal:** Ore + Coal → Iron → (+ Coal + Limestone) Steel.
- **Czipy:** Sand → Glass; Copper → Copper Ingots; Crude + Sulfur + Salt → Chemicals; Rare Earths ze złoża → Old Chip Foundry (+ prąd) → Microchips.
- **Energetyka jądrowa:** Uranium (złoże) + Chemicals → Old Enrichment Plant (na paliwie z zewnątrz) → Nuclear Fuel → własny reaktor instalacji i Small Reactor w wioskach.
- **Rydwan:** praktycznie cała gospodarka planety, czyli wszystkie 6 nowych instalacji oraz Chip Foundry.
