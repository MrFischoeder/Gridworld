# GridWorld: opis gry, cel, plan i historia zmian

Stan na wersję **0.94.0**. Ten dokument opisuje, czym jest GridWorld, jaki jest cel gry, co już w niej jest, czego jeszcze nie ma, dokąd zmierza i jak powstawała, wersja po wersji. Nazwy z gry (przedmioty, miejsca, postacie) są po angielsku, tak jak na ekranie.

---

## 1. Czym jest GridWorld

GridWorld to strzelanka FPP z otwartym światem, przetrwaniem, handlem i odbudową, grana w przeglądarce. Cały świat jest rysowany zielonymi liniami wektorowymi na czarnym tle, w stylu retro sci-fi: Tron, ekrany CRT, stare terminale. Każda bryła ma ciemne wypełnienie, więc linie tworzą prawdziwe, nieprzezroczyste kształty. Za dnia niebo i mgła na powierzchni stają się jasne, zamglone i zielone, o świcie i zmierzchu bursztynowe, w nocy czarne i pełne gwiazd.

Gra powstała z jednoplikowego prototypu **Grid Arena** (areny z dronami w lochach, zachowanej w `legacy/grid-arena.html`). Z niego wyrosła cała planeta: wioski, drogi, rzeki, morza, góry, ruiny obcej cywilizacji, rozbite statki, bandyci, roboty, pojazdy i łodzie.

**Filary gry:**
- **Przetrwanie i walka.** Głód, pragnienie, kalorie, zmęczenie, ciężar plecaka, stworzenia, roboty i bandyci.
- **Eksploracja.** Planeta o obwodzie ok. 120 km: ruiny z lochami, wraki, jaskinie, szczyty ze szlakami, wyspy, toksyczna mgła, wielkie instalacje dawnego świata.
- **Odbudowa wiosek.** Gracz nie buduje własnej bazy w dziczy. Pomaga wioskom: wznosi mury, farmy, zakłady, elektrownie, broni je przed najazdami.
- **Handel i logistyka.** Towary w skrzyniach, rynki z cenami zależnymi od podaży, kontrakty, karawany, eskorty, pojazdy z bagażnikami, łodzie z ładowniami.
- **Wiedza.** Technologie nie pochodzą z punktów doświadczenia. Odzyskuje się je ze starych nośników danych ukrytych w świecie.
- **Wspólny cel.** Rydwan Starożytnych (Chariot of the Ancients), prom, którym rozbitkowie mogą wrócić do domu.

**Technologia:**
- Vite + TypeScript (strict) + three.js.
- Interfejs z czystego DOM i CSS, bez frameworka.
- Cały świat pochodzi z ziarna (seed) i deterministycznych generatorów. Ten sam seed i te same współrzędne dają zawsze ten sam wynik.
- Zapis przechowuje tylko zmiany gracza. To podstawa zapisów i przyszłego trybu wieloosobowego.
- Obecnie tylko komputer (mysz i klawiatura). Sterowanie dotykowe jest wstrzymane.

---

## 2. Fabuła i cel gry

### Rozbitkowie
Gracze nie są stąd. To astronauci z przyszłości, załoga statków zwiadowczych. Ich statki spadły na nieznaną planetę po uderzeniu roju meteorów.

Nowa postać zaczyna od intra narysowanego liniami gry:
- statek SV-9 **Kestrel** leci przez zewnętrzny pas nieznanego układu;
- znikąd nadciąga rój meteorów, uderzenie odrywa skrzydło;
- statek koziołkuje w stronę planety, wchodzi w atmosferę i się rozbija;
- ekran pokazuje „SYSTEMS OFFLINE”, potem „<IMIĘ>. WAKE UP.”

Gracz budzi się we wraku. W szafce czekają pierwsze zapasy, a rejestrator lotu podpowiada, gdzie jest najbliższa osada. Przed wrakiem stoi **Wiktor**, zwiadowca z Gridholm:
- woła do włazu, dopóki gracz z nim nie porozmawia;
- radzi zabrać ze statku wszystko, co się da;
- prowadzi do bramy wioski i po drodze pokazuje ruiny, wraki, obozy i jeziora.

### Planeta i jej przeszłość
Planeta należała kiedyś do potężnej cywilizacji Starożytnych. Zostały po niej:
- obce świątynie z kryptami i lochami;
- porzucone wielkie instalacje: wzbogacalnia uranu, fabryka czipów, stacja radarowa;
- rozbite statki;
- maszyny bojowe (roboty), które wciąż strzegą ruin.

Dzisiejsi mieszkańcy żyją w prostych wioskach za płotami z zaostrzonych pali. Uprawiają pola, kopią rudę, łowią ryby i handlują skrzyniami towarów. Nękają ich bandyci. Wiedza dawnego świata przetrwała w rozproszeniu, na starych nośnikach danych.

### Cel: Rydwan Starożytnych
W hangarze pod Gridholm stoi prom Starożytnych, który miejscowi nazywają **Rydwanem Starożytnych** (Chariot of the Ancients). Tylko rozbitkowie chcą, żeby poleciał, bo to ich jedyna droga do domu.

Rydwan odbudowuje się w pięciu etapach:

| Etap | Co wymaga |
|---|---|
| **Hull Plating** (poszycie) | stal, stop kadłubowy |
| **Main Engines** (silniki) | części maszyn, stop, kabel |
| **Avionics** (awionika) | płytki drukowane, **mikroczipy ze Starej Fabryki Czipów**, kabel, szkło |
| **Heat Shield** (osłona termiczna) | szkło, stop, plastik |
| **Propellant** (paliwo) | 30 skrzyń paliwa rakietowego |

Tych dóbr nie znajdzie się w dziczy. Trzeba je wyprodukować. To wymaga:
- ożywienia gospodarki wiosek (farmy, przemysł, zakłady przetwórcze, elektrownie);
- odzyskania technologii;
- przywrócenia do życia wielkich instalacji;
- przewiezienia wszystkiego do hangaru.

Rydwan jest więc osią, wokół której kręci się cała reszta gry. Wszystkie systemy prowadzą do niego.

### Kampania (zaplanowana, jeszcze nie w grze)
Docelowo kampania ma trwać **ok. 80 godzin dla jednego gracza** (ok. 50 h we dwóch, ok. 33 h w czterech). Cel jest skalibrowany symulacją bota gracza (`tools/campaign.sim.ts`).
- Oprócz Rydwanu na kontynencie leży **20 cudów Starożytnych** (np. Cold Forge, Deep Engine, Star Well, Signal Tower, Glass Spire, Warden Pylon, Rain Mill, Last Lighthouse).
- Każdy cud stoi przy ruinie w innym regionie.
- Każdy ma 3 etapy odbudowy: oczyszczenie, hala maszyn, serce z reliktami.
- Każdy daje regionowi premię, np. tańszą stal, darmowy prąd, bezpieczne drogi, lepsze plony.
- **Trzy niespodzianki.** Po etapach 1, 2 i 4 Rydwanu załoga hangaru odkrywa, że dalej nie da się iść bez części, którą może dać tylko jeden z cudów. Cud leży 7–12, 13–20 albo 21–30 km dalej. Gracz musi zostawić Rydwan i najpierw go odbudować.
- Niespodzianek nie da się zaplanować z góry. Gracz dostaje wskazówkę: kierunek, odległość i wioskę w pobliżu.
- Zamiarem jest wyciągnięcie graczy z głównego wątku w świat. Nie ma finałowego ataku.

### Kooperacja
Gra jest pomyślana jako **kooperacja do 8 graczy** na autorytatywnym serwerze (Node + WebSocket). Każdy gracz to rozbitek z własnego statku. Wioski będą punktami odrodzenia, a stan rynków i wiosek będzie wspólną gospodarką świata.

**Zakończenie:** start Rydwanu i powrót do domu (lot jeszcze nie powstał).

---

## 3. Jak wygląda rozgrywka dziś

1. **Intro i wrak.** Katastrofa, przebudzenie we wraku. Szafka z zapasami (apteczki, woda, chleb, zestaw do rozpalania ognia, kompas), rejestrator lotu.
2. **Wiktor i droga do Gridholm.** Kilkaset metrów przez spokojną okolicę.
3. **Gridholm**, wioska startowa. Są tam:
   - Starszy Maciej: odbudowa wioski, farmy, zakłady, elektrownia, udział w dobrach;
   - Marta w tawernie;
   - kowal Oskar: broń, narzędzia, zestawy do mostów i pomostów, zamówienia z planów;
   - Zofia w sklepie: dostawy, kontrakty, kompas;
   - Jan, sklep z jedzeniem;
   - Kuba, handlarz pojazdami;
   - kapitan straży Jakub;
   - tablica ogłoszeń, tablica z mapą, hala wioski z terminalem, komputer w domu starszego, dom gracza do kupienia.
4. **Pierwsze zadania.** Ogłoszenia (nagrody za zabicie, polowania, obozy bandytów, zlecenia), dostawy, zbieranie drewna i kamienia, polowanie.
5. **Rozwój.** Pojazd, handel między wioskami, eskorty karawan, pomoc wioskom (mury, farmy, zakłady, prąd), reputacja i udział w ich dobrach.
6. **Wyprawy dalej.** Im dalej od Gridholm, tym groźniej (niebezpieczeństwo 0–8). Tam leżą:
   - rzadkie złoża;
   - nośniki danych z technologiami;
   - wielkie instalacje;
   - toksyczna mgła z zamkniętymi szafkami;
   - wyspy, na które płynie się łodzią.
7. **Rydwan.** Dobra przetworzone w zakładach wiosek i czipy z fabryki trafiają do hangaru.

---

## 4. Świat

### Planeta
- Świat zawija się ze wschodu na zachód po ok. **120 km** (470 regionów po 256 m).
- Na północy i południu kończy się czapami lodowymi (od 25 km) i ścianą lodu (ok. 30 km), której nie da się przejść.
- Słońce stoi wysoko nad równikiem. Przy biegunach trwa wieczny zmierzch.
- Około **140 wiosek** na świat. Gęsto przy Gridholm (co ok. 1,4 km), rzadko daleko (co ok. 5 km).
- **Pierścienie niebezpieczeństwa** wokół Gridholm:

  | Odległość | Niebezpieczeństwo |
  |---|---|
  | przy murach | 0 |
  | 0,6–1,6 km | 1 |
  | 4 km | 2 |
  | 8 km | 3 |
  | 13 km | 4 |
  | 19 km | 5 |
  | 26 km | 6 |
  | 34 km | 7 |
  | 44 km | 8 |

  Granice pierścieni falują. Każda wioska jest azylem. Przy ruinach jest groźniej.

### Krajobraz
- **Teren**:
  - pagórki i doliny;
  - **góry** do ok. 170 m ze śniegiem na szczytach (ok. jednej czwartej lądu);
  - **szlaki** na nazwane szczyty (Mount …) z serpentynami, kopcami i proporcem na szczycie;
  - **jaskinie**: organiczne labirynty z komnatami, pętlami, skrzyniami i kryształami, czasem z dwoma wylotami.
- **Woda**:
  - **jeziora** czyste, mętne i toksyczne (świecące);
  - **studnie** w wioskach i w dziczy;
  - **morza**: ok. 25% lądu między czapami, słone, z plażami i płyciznami;
  - **rzeki**: 150–200 na świat, od gór do mórz, z dopływami, nazwami i nurtem, który niesie pływaka; drogi przecinają je brodami;
  - **wyspy** na otwartym morzu (ok. 150).
- **Las**: sosny, drzewa liściaste i trzy olbrzymy (Ancient Twisted, Umbrella, Hollow Arch, przez który można przejść), jadalne grzyby i drzewa z owocami.
- **Pogoda**: bezchmurnie, pochmurno, deszcz, mgła (częściej rano) i burze z piorunami. Każda okolica ma własną pogodę, a fronty przesuwają się godzinami.
- **Zegar gry**: 1 sekunda = 1 minuta gry, doba trwa 24 minuty.
- **Toksyczna mgła**: zielone opary nad częścią wysp (od 6 km) i nad płatami lądu (od 15 km). Szczegóły w rozdziale 6.

### Miejsca
- **Wioski**:
  - każda ma własny kształt muru (4, 6, 8 lub 12 boków), bramy, wieże z drabinami, domy z pruskiego muru z meblami, drzwi otwierane i zamykane, mieszkańców z imionami i strażnika;
  - każda ma przemysł (farma, kopalnia, ropa, rafineria, tartak, rybołówstwo, warsztat, złomowisko), elektrownię (generator, słoneczną albo wiatrową) i halę wioski;
  - drogi łączą je w sieć.
- **Ruiny, czyli świątynie obcych**: 60 m, krzyżowy plan, pylony, pierścień, aleja obelisków, wszystko zniszczone. W krypcie są schody do **lochów** na kilku poziomach, z skrzyniami, strażnikami i bossami.
- **Wraki frachtowców** na wpół zakopane w ziemi. W środku są zatoki: maszynownia, śluza, kajuty, ładownia, mostek. Pilnują ich roboty.
- **Obozy bandytów**: namioty, barykady, ognisko, skrytka i boss. Po oczyszczeniu stoją puste przez 30 minut.
- **Hangar Rydwanu** przy Gridholm.
- **Wielkie instalacje** (dalej w rozdziale 10): Old Enrichment Plant (15–25 km), Old Chip Foundry (12–20 km), Old Radar Station (18–28 km).
- **Miejsce katastrofy** gracza: wrak Kestrela z bruzdą w ziemi, 260–430 m od Gridholm.

---

## 5. Postać, przetrwanie, walka

- **Zdrowie, stamina, kalorie, woda.**
  - Stamina schodzi na bieg, pływanie, skoki i ciosy ostrzem.
  - Organizm ma zapas kalorii (do 3000 kcal) i spala go szybciej przy wysiłku i z ciężkim plecakiem.
  - Jedzenie wypełnia **żołądek** wagą, więc lekkie i kaloryczne jedzenie karmi najlepiej.
  - Woda: picie ze studni, jezior i rzek, napełnianie manierek.
- **Plecak**: 40 L objętości to twardy limit. Waga powyżej 20 kg spowalnia, powyżej 35 kg to przeciążenie.
- **Ręce, plecy, ubranie.**
  - Broń to przedmioty: Blaster (karabin energetyczny) i Energy Blade.
  - Dwie sztuki mogą być na plecach.
  - Pancerz i odzież są w slotach, do tego maska przeciwgazowa na twarz.
  - Duże rzeczy (koła, działko) nosi się tylko w rękach.
- **Broń**:
  - magazynek i przeładowanie, celowanie z przybliżeniem, luneta przy 3×;
  - dodatki: celowniki, lufy (tłumik), magazynki;
  - ostrze bije mocno, ale kosztuje staminę;
  - hałas strzałów ściąga stworzenia z okolicy.
- **Ekwipunek w slotach** z przeciąganiem, ikonami i dymkiem z pełnymi parametrami: rodzaj, opis, liczby, waga, objętość, cena, do czego służy.
- **Śmierć** przenosi do najbliższej odkrytej wioski (do własnego łóżka, jeśli ma się dom).
- **Dom gracza w Gridholm** (750 złota): łóżko, w którym się śpi do rana, i skrzynia na 24 sloty.

## 6. Wrogowie

- **Stworzenia**:
  - **Ravager**: stada, flankowanie, doskoki;
  - **Bramble**: terytorialny roślinożerca, szarżuje, z przodu opancerzony; daje mięso;
  - **Leechwing**: krąży, poluje z powietrza, nurkuje;
  - **Gnawer**: szczurze gniazda, które rzucają się rojem.
- **Roboty** (arkusz RD):
  - Scout Automaton;
  - Guardian Drone (działo energetyczne);
  - Repair Drone (leczy inne roboty, wypuszcza drony);
  - Sentinel (ciężki dwunóg);
  - Artillery Walker (ostrzał z daleka);
  - Assault Construct (szarża z młotem).

  Zostawiają złom, elektronikę i rdzenie mocy.
- **Bandyci**:
  - strzelcy z karabinami i pistoletami;
  - osiłki z ostrzami i tarczami;
  - boss w każdym obozie;
  - patrole.
- **Rajdowcy**: uzbrojone pojazdy z kierowcą i strzelcem. Rozbity pojazd można przejąć.
- **Zasadzki** na drogach: blokady z barykad i ukryci bandyci.
- **Najazdy na wioski i karawany** (rozdziały 7–8).
- **Tempo spotkań.**
  - Spotkania przychodzą pojedynczo, z przerwą (ok. minuty przy wioskach, 20–30 s w głębokiej dziczy).
  - W czasie walki nic nowego nie dołącza.
  - Każde spotkanie musi się zmieścić w budżecie zagrożenia danego pierścienia.
- **Toksyczna mgła.**
  - Bez maski pali płuca.
  - Maska z filtrem wystarcza na ok. 5 minut w najgęstszej mgle.
  - W środku każdej mgły stoi skażony obiekt (skład wojskowy, laboratorium albo rozbita sonda) z zamkniętymi szafkami pełnymi rzadkich rzeczy.

## 7. Pojazdy i łodzie

- **Pojazdy**: RTV-1 Scout (lekki łazik) i HTV-6 Mastodon (ciężarówka z zamkniętą kabiną).
  - Kupuje się je u Kuby albo znajduje porzucone w dziczy (uszkodzone).
  - Mają koła, silnik, kadłub, bak, działko na dachu, ulepszenia silnika i bagażnik.
  - Mają 3 miejsca: kierowca, pasażer i strzelec przy działku.
  - Serwis naprawia koła, silnik i kadłub (poszycie).
- **Budowle gracza nad wodą**:
  - **Mosty** na brodach dróg albo w dowolnym miejscu rzeki (Bridge Kit);
  - **Pomosty** na wybrzeżu morza (Pier Kit), z lampą i skrzynią.
- **Łodzie** buduje się na pochylni pomostu:
  - **Rowboat**: wiosła, męczy;
  - **Sailboat**: żagiel na wietrze z pogody, halsowanie, nie mieści się pod mostami;
  - **Motor Boat**: najszybsza, pali paliwo.

  Pływają po morzach, rzekach i jeziorach, a nurt rzeki je niesie. Każda ma ładownię. Można mieć do 3 łodzi.

## 8. Wioski i ich odbudowa

To serce gry. Gracz nie ma własnej bazy (budowanie w dziczy jest zamknięte). Zamiast tego pomaga wioskom.

**Hala i magazyn**
- **Hala wioski** to jedyny magazyn wioski.
- Wszystko, co wioska produkuje, trafia do hali.
- Każda budowa (mury, farmy, zakłady, elektrownie, ulepszenia, zamówienia u kowala) bierze materiały tylko z zapasu hali.
- Gracz składa materiały przez terminal w hali.

**Mury i obrona**
- **Mury**: płot z pali, potem palisada, potem kamienny mur.
- Mur ma chodnik na koronie, z którego strzela się nad murem.
- Na murze stoją **działka**, a przy obiektach **barykady z worków**.

**Prąd i produkcja**
- **Elektrownia wioski** zużywa się. Naprawia się ją częściami.
- Elektrownię można ulepszyć trzy razy (Overhauled, Rebuilt, Automated z czipami).
- **Stacje zasilania**:
  - farma słoneczna;
  - farma wiatrowa;
  - elektrownia węglowa;
  - agregaty diesla;
  - **mały reaktor** na pręty paliwowe z wzbogacalni.
- **Przemysł**: miejsce pracy za murem z robotnikami, którzy kopią, orzą i dźwigają skrzynie. Wydajność zależy od stanu miejsca i liczby ludzi.
- **Farmy** (do 3): uprawy do wyboru.
  - Pszenica daje zboże.
  - Marchew i ziemniaki.
  - Kury dają jajka, krowy mleko.
  - Stalowe pługi podnoszą plon, a farmy potrzebują prądu na pompy.
- **Sklep z jedzeniem** gotuje z zapasów hali: chleb, gulasz, jajka, mleko i ser.
- **Zakłady przetwórcze** (2 na wioskę): huta, rafineria, huta szkła, walcownia drutu, elektronika, warsztat maszynowy, odlewnia, chemia. Z surowców robią 9 dóbr przetworzonych: stal, sztaby miedzi, plastik, szkło, kabel, płytki, części, stop, paliwo rakietowe.

**Ludzie i reputacja**
- **Ludność**: 40–90 osób (Gridholm 70). Farmy ją podnoszą, straty w najazdach zmniejszają.
- **Reputacja**: Stranger, Known, Friend, Honoured. Za pomoc wioska dzieli się swoimi dobrami (do 8 skrzyń dziennie) i rzadkim surowcem ze swojego złoża.

**Najazdy**
- Wioska w zasięgu obozu bandytów jest najeżdżana co kilka dni.
- Najpierw przyjeżdża jeździec i żąda trybutu. Można zapłacić albo walczyć.
- Najazd na żywo to trzy fale. Bandyci atakują bramy, elektrownię i miejsce przemysłu. Przegrany najazd obniża mur o poziom.

**Komputer wioski** pokazuje wszystko do odczytu: wioskę, prąd, handel, sąsiednie wioski, Rydwan i archiwum technologii.

## 9. Handel i gospodarka

- **Towary w skrzyniach**: 15 zwykłych dóbr plus 9 przetworzonych. Ceny zależą od tego, co wioska robi, a czego chce, od podaży i od karawan. Sprzedaż i kupno przesuwają cenę.
- **Kontrakty** w sklepie i na tablicy:
  - dostawy;
  - przewozy (hauls) z kaucją;
  - **zamówienia paliwa jądrowego** do wiosek ze starym reaktorem;
  - **zamówienia mikroczipów** do warsztatów.
- **Karawany**: konwoje (jeep z działkiem, Mastodon z ładunkiem, jeep) jeżdżą po drogach według rozkładu.
  - Można od nich kupować.
  - Bywają napadane. Uratowana karawana daje nagrodę i zniżkę.
  - Można najmować się jako eskorta.
- **Rzadkie złoża** daleko od Gridholm: boksyt, siarka, lit, ziemie rzadkie, uran.

## 10. Wiedza i wielkie instalacje

- **16 + 1 technologii** na starych nośnikach (dyskietki, dyski, kryształy pamięci). Każda leży w stałym miejscu świata: w ruinie, wraku albo jaskini, tym dalej, im wyższy poziom (od 600 m do 30 km).
  - Przykłady: Irrigated Fields, Forged Tools, Steel Ploughs, Solar Cells, Integrated Circuits, Radio Triangulation, Uranium Enrichment, Rocket Propellant Synthesis, Filter Masks.
- **Plotki**: mieszkańcy pytani o stare maszyny wskazują nośniki i instalacje, z kierunkiem i odległością.
- **Zamówienia u kowala**: z odzyskanych planów kowal robi narzędzia, maski i filtry z zapasów hali.
- **Wielkie instalacje**:
  - **Old Enrichment Plant** robi z uranu pręty paliwowe;
  - **Old Chip Foundry** robi ze szkła i miedzi mikroczipy;
  - **Old Radar Station** odkrywa na mapie wszystko w promieniu 12 km.

  Każdą odbudowuje się w trzech etapach przy jej pulpicie sterowniczym. Na ostatni etap potrzebne są plany.

## 11. Interfejs i pomoce

- Minimapa i mapa świata (M), kompas, tablice z mapą w wioskach.
- Tracker zadań, znaczniki celów i plotek.
- Ogłoszenia w każdej wiosce (do 3 zadań naraz).
- Ikony i dymki przedmiotów.
- Changelog w menu.
- Plik **SUROWCE.md / .pdf**: przewodnik po wszystkich surowcach, przetwórstwie i budowach, generowany z danych gry.
- **Konsola deweloperska** (~):
  - `cash`, `god`, `home`, `time`;
  - `map` (mapa całej planety z teleportem i strefami mgły);
  - `tp`, `fly`, `spawn`, `raid`, `weather`, `sites`, `fogs`.
- **Strona gry** na GitHub Pages (po polsku), z wersją do zagrania w przeglądarce.

---

## 12. Co już jest, a czego jeszcze nie ma

**Gotowe i grywalne:**
- intro, wrak i przewodnik;
- cała planeta z terenem, wodą, pogodą, dniem i nocą;
- walka i przetrwanie;
- pojazdy, mosty, pomosty i łodzie;
- wioski z pełną odbudową (mury, obrona, prąd, farmy, zakłady, stacje, hala, jedzenie, ludność, reputacja);
- handel, kontrakty i karawany;
- technologie i plotki;
- trzy wielkie instalacje;
- toksyczna mgła;
- zbieranie etapów Rydwanu w hangarze.

**Tylko w symulacji (jeszcze nie w grze):**
- *Życie wiosek* (`gen/growth.ts`): wioski rosną same, jedzą, budują i zatrudniają straż.
- *Warstwa cywilizacji* (`gen/civ.ts`): miasta, metropolie, regionalne projekty.
- *Kampania* (`gen/campaign.ts`): 20 cudów, 3 niespodzianki, kalibracja na 80 h.

Wyniki symulacji posłużyły do decyzji, że gra ma się opierać na prostych, stałych regułach, dostrojonych do docelowego czasu gry, a nie na w pełni symulowanej gospodarce.

**Czego jeszcze nie ma:**
- lotu Rydwanem i zakończenia gry;
- cudów Starożytnych i niespodzianek w samej grze;
- trybu wieloosobowego (serwer, inni gracze i ich statki);
- kombinezonu przeciwchemicznego, mgły w lochach i stworzeń mgły;
- nurkowania;
- spalania paliwa przez pojazdy (bak jest pokazywany, ale na razie się nie opróżnia);
- budowania własnych baz w dziczy (kod jest, funkcja zamknięta);
- ręcznego rzemiosła (zamrożone, rzeczy robi się w wioskach);
- kanionów;
- sterowania dotykowego (wstrzymane).

---

## 13. Plan rozwoju

**Najbliżej (0.90–0.99): rozbudowa gospodarki** według `PLAN_GOSPODARKI.md`. Nowe surowce (glina, wapień, ołów, nikiel), półprodukty i zakłady wiosek (tier 1 od startu, tier 2 z planów), prąd jako ograniczenie przemysłu, sześć nowych instalacji Starożytnych z własnymi siłowniami (paliwo rakietowe, ogniwa, sensory, stop Starożytnych, precyzyjne komponenty, automatyka) i Rydwan wymagający całej gospodarki planety.

Kierunek wyznaczony przez właściciela projektu, w przybliżonej kolejności:

1. **Kampania w grze.** Cuda Starożytnych przy ruinach (3 etapy każdy, premie regionalne), trzy niespodzianki, które zatrzymują Rydwan, wskazówki załogi hangaru.
2. **Lot Rydwanu i zakończenie.** Start promu, powrót rozbitków do domu.
3. **Tryb wieloosobowy do 8 graczy.** Autorytatywny serwer (Node + WebSocket), wioski jako punkty odrodzenia, statki innych graczy na planecie, wspólna gospodarka (rynki i stan wiosek po stronie serwera). Generatory są już deterministyczne, a logika świata wolna od grafiki, właśnie z myślą o tym.
4. **Wioski, które żyją same.** Włączenie symulacji życia wiosek w prostej, dostrojonej postaci: przyrost ludności z farm i jedzenia, popyt graczy, handel między wioskami.
5. **Więcej technologii dla samych wiosek** (`VILLAGE_TECHS`): spichlerze, większe budynki, kolej, wozy.
6. **Mgła i skażenie.** Kombinezon NBC, mgła w lochach, stworzenia mgły.
7. **Woda.** Nurkowanie, porty, kaniony.
8. **Dopracowanie.** Dźwięk (np. grzmoty), spalanie paliwa w pojazdach, skutki pogody (pioruny, burze zrywające dachy, deszcz na drogach, chmury a panele słoneczne).
9. **Ewentualnie** zmniejszenie mapy, jeśli okaże się za duża do gry. Właściciel to rozważa.

---

## 14. Historia zmian, wersja po wersji

Pełne notatki (po angielsku) są w grze pod przyciskiem **Changelog** w menu głównym i w `src/data/changelog.ts`. Poniżej streszczenie po polsku.

### Początki: od Grid Arena do otwartego świata
- **0.1.0 Grid Arena staje się prawdziwym projektem.** Jednoplikowa gra przepisana na Vite i TypeScript. Bryły dostają ciemne wypełnienia.
- **0.2.0 Otwarty świat.** Teren, drogi i ruiny wokół wioski. Gra dostaje nazwę GridWorld i uruchamia się jednym kliknięciem w Windows.
- **0.3.0 Pojazdy.** Scout i Mastodon do kupienia albo do znalezienia. Bagażniki, uszkodzone części, naprawy, działko na dachu.
- **0.3.1 Stworzenia i tablica ogłoszeń.** Ravagery, Bramble, Leechwingi. Pierwsze zadania.
- **0.3.2 Bandyci i rajdowcy.** Obozy, patrole, strzelaniny, uzbrojone pojazdy i zasadzki przy drogach.
- **0.4.0 Sloty, dodatki, dzień i noc.** Przeciąganie przedmiotów, skrzynie działające w obie strony, sloty opon i silnika, celowniki, lufy i magazynki do Blastera, cykl dnia.
- **0.4.1 Nowe drzewa.** Drzewa liściaste i trzy olbrzymy.
- **0.4.2 Cała planeta.** Świat zawija się po 120 km, bieguny są lodowe, wioski leżą na całej planecie.
- **0.4.3 Jeziora i studnie.** Woda czysta, mętna i toksyczna. Brodzenie, pływanie, picie, manierki.
- **0.4.4 Gnawery i świątynie obcych.** Szczurze gniazda. Ruiny stają się świątyniami obcej cywilizacji.
- **0.4.5 Hałas, tłumiki, polujące Leechwingi.** Strzały ściągają stworzenia.
- **0.4.6 Stamina, głód, pragnienie.**
- **0.4.7 Jedzenie z dziczy.** Mięso z Bramble, materiały z innych stworzeń, pieczenie przy ognisku.
- **0.4.8 Kalorie, żołądek, waga i objętość.**
- **0.4.9 Rzemiosło.** Siekiera i kilof. Ścięte drzewa i rozbite skały odrastają.
- **0.4.10 Roboty i spokojniejsza okolica.** Sześć rodzajów robotów z arkusza RD.
- **0.4.11 Poprawka wejść do ruin.**
- **0.4.12 Wraki i kanciaste lochy.** Na wpół zakopane frachtowce z wnętrzami.
- **0.4.13 Roboty strzegą wraków.**
- **0.5.0 Numery wersji** w menu i w karcie przeglądarki.
- **0.6.0 Changelog** w menu głównym.
- **0.7.0 Deweloperska mapa świata** z teleportem.
- **0.8.0 Kompas i tablice z mapą w wioskach.**
- **0.8.1 Poprawka:** skrzynie można znów przeszukiwać.

### Bazy gracza (potem zamknięte)
- **0.9.0 Maszty z flagą.** Zajmowanie ziemi pod bazę, hologram wyrównania terenu.
- **0.10.0 Ręce, plecy i pancerz.** Broń jako przedmioty, dwie sztuki na plecach.
- **0.11.0 Budowanie.** Ściany, drzwi i dachy z drewna i metalu.
- **0.12.0 Piętra, schody, ściany zatrzymujące pociski, zamki szyfrowe.**
- **0.13.0 Automatyczne działka.**

### Góry, drogi, niebezpieczeństwo
- **0.14.0 Góry i wyloty jaskiń.**
- **0.15.0 Szlaki na szczyty** z serpentynami i półkami.
- **0.16.0 Systemy jaskiń.** Organiczne labirynty.
- **0.17.0 Deweloperski lot** (`fly`).
- **0.17.1 Poprawka:** wrogowie przychodzą pojedynczo.
- **0.18.0 Więcej gór, jezior i studni.**
- **0.19.0 Drogi między miastami.**
- **0.20.0 Pierścienie niebezpieczeństwa** wokół Gridholm (0–8).
- **0.20.1 Bazy gracza zamknięte.** Zwrot w stronę pomagania wioskom.

### Zwrot ku wioskom
- **0.21.0 Prowizoryczne płoty wiosek** z pali.
- **0.22.0 Własny dom** w Gridholm.
- **0.23.0 Umacnianie wiosek i utrzymanie prądu.** Palisada, kamienny mur, naprawa elektrowni.
- **0.24.0 Handel między wioskami.** Towary w skrzyniach, rynki.
- **0.25.0 Karawany na drogach.**
- **0.26.0 Napady na karawany i eskorty.**
- **0.27.0 Konwoje zmotoryzowane i blokady dróg.**
- **0.28.0 Najazdy bandytów na wioski.**
- **0.29.0 Przemysł wiosek.** Farmy, kopalnie, ropa, tartaki i inne.
- **0.30.0 Kontrakty dostaw.**
- **0.31.0 Dostawy na tablicy ogłoszeń.**
- **0.32.0 Tablice ogłoszeń w każdej wiosce.**
- **0.33.0 Drabiny na wieże.**
- **0.34.0 Domy z pruskiego muru i nowe twarze.**
- **0.35.0 Umeblowane domy.**
- **0.36.0 Ręce na broni.** Ramiona z łokciami, chwyt broni.
- **0.37.0 Bandyci padają.** Animacja śmierci, broń wypada z rąk.
- **0.38.0 Stworzenia i maszyny padają.**
- **0.39.0 Robotnicy, magazyny i trybut.**
- **0.40.0 Wioski o wielu kształtach.** Mury o 4, 6, 8 i 12 bokach.
- **0.41.0 Transporty i własne imię bohatera.**
- **0.42.0 Ciężka praca.** Rąbanie i kopanie przytrzymując E, żyły rudy.
- **0.43.0 Łup wygląda na to, czym jest.**
- **0.44.0 Drzwi, które się otwierają, i dom do kupienia.**
- **0.45.0 Chodniki na murach, działka na murach, barykady.**

### Przetwórstwo, prąd i Rydwan
- **0.46.0 Zakłady, dobra przetworzone i prom.** Dziewięć dóbr przetworzonych.
- **0.47.0 Stacje zasilania i Rydwan Starożytnych.**
- **0.48.0 Dzień i noc**: prawdziwe niebo.
- **0.49.0 Pogoda.**
- **0.50.0 Komputer wioski.**
- **0.51.0 Ludzie w pojazdach.** Widoczni kierowcy, pasażerowie i strzelcy.
- **0.51.1–0.51.3 Strona gry**, publikacja i zrzuty ekranu.
- **0.51.4 Studnie w wioskach** jak te w dziczy.

### Za kulisami: symulacje gospodarki
- **0.52.0 Wioski żyjące same.** Symulacja wzrostu.
- **0.53.0 Projekty regionalne i nowe materiały.** Symulacja cywilizacji.
- **0.54.0 Droga do startu.** Zaplanowana kampania: 5 etapów Rydwanu, 20 cudów, niespodzianki.
- **0.54.1 Kampania przerobiona.** Zamiast ataku w noc startu Rydwan trzy razy zatrzymuje się na cud.

### Rozbitkowie i wiedza
- **0.55.0 Rozbitkowie.** Intro z katastrofą Kestrela, wrak jako start.
- **0.56.0 Utracona wiedza.** 16 technologii na nośnikach danych.
- **0.57.0 Poczta pantoflowa.** Plotki o starych maszynach.
- **0.58.0 Stare plany, nowa praca.** Zamówienia u kowala.
- **0.59.0 Fach kowala.** Ręczne rzemiosło odłożone.
- **0.60.0 Reputacja** i udział w dobrach wioski.
- **0.61.0 Ludzie za murami.** Ludność wiosek.
- **0.62.0 Pola.** Budowa farm.
- **0.63.0 Stal i prąd.** Farmy na prądzie, stalowe pługi.
- **0.64.0 Więcej prądu.** Ulepszenia elektrowni.
- **0.65.0 Odległe bogactwa.** Rzadkie złoża.

### Wielkie instalacje
- **0.66.0 Martwa instalacja.** Old Enrichment Plant.
- **0.67.0 Instalacja się budzi.** Odbudowa w 3 etapach, pręty paliwowe.
- **0.68.0 Małe reaktory** (250 kW).
- **0.69.0 Zamówienia paliwa.**
- **0.70.0 Fabryka czipów.**
- **0.71.0 Do czego służą czipy.** Elektrownia Automated, zamówienia czipów.
- **0.72.0 Wieści o starych instalacjach.**
- **0.73.0 Czipy dla Rydwanu.** Awionika wymaga mikroczipów.
- **0.74.0 Stacja radarowa.** Odkrywa mapę w promieniu 12 km.

### Hala wioski i jedzenie
- **0.75.0 Hale wiosek** z terminalem.
- **0.76.0 Jeden magazyn dla wioski.** Wszystkie budowy biorą z hali.
- **0.77.0 Co rośnie na farmach.** Pszenica, marchew, ziemniaki, kury, krowy.
- **0.78.0 Jedzenie z wioski.** Sklep gotuje z zapasów.
- **0.78.1–0.78.2 Przewodnik po surowcach** (SUROWCE.md i PDF).

### Woda: morza, rzeki, mosty, łodzie
- **0.79.0 Morza.**
- **0.80.0 Rzeki** z nazwami, dopływami, nurtem i brodami.
- **0.81.0 Mosty na brodach.**
- **0.81.1 Testy zapisu mostów.**
- **0.82.0 Mosty w dowolnym miejscu** (Bridge Kit).
- **0.83.0 Pomosty na wybrzeżu** (Pier Kit).
- **0.84.0 Łodzie wiosłowe.**
- **0.85.0 Żaglówki i motorówki.**

### Najnowsze
- **0.86.0 Toksyczna mgła.** Wyspy, strefy mgły, maska z filtrami, skażone obiekty z szafkami.
- **0.87.0 Ikony przedmiotów i dymki** z pełnymi parametrami.
- **0.88.0 Powitanie przy wraku.** Wiktor prowadzi do Gridholm.
- **0.88.1 Wiktor czeka, aż się do niego odezwiesz.** Woła, radzi przeszukać wrak, po drodze pokazuje miejsca.
- **0.89.0 Większe świątynie** (o 50%). Brak niewidzialnych ścian dla pojazdów. Komenda `map` pokazuje strefy mgły.
- **0.89.1 Opis gry.** Ten dokument (OPIS_GRY.md i PDF).
- **0.89.2 Plan gospodarki.** Uzgodniony plan rozbudowy gospodarki w `PLAN_GOSPODARKI.md` (etapy 0.90–0.99).
- **0.90.0 Nowe surowce i towary** (etap 1 planu gospodarki). Glina, wapień, ruda ołowiu, tarcica, rzadki nikiel; półprodukty: żelazo, cegły, cement, chemikalia przemysłowe, aluminium, ołów, baterie (na razie w istniejących zakładach).
- **0.91.0 Zakłady na każdy krok** (etap 2 planu gospodarki). Tartak, cegielnia, cementownia, przędzalnia, stalownia, zakład polimerów, huta aluminium, fabryka baterii; stal z żelaza, wapienia i węgla; stop z stali, aluminium i niklu; plany dla zakładów tier 2 (3 nowe technologie); len i owce na farmach.
- **0.92.0 Prąd dla przemysłu** (etap 3 planu gospodarki). Miejsca przemysłu wiosek pobierają prąd (3–30 kW), bez prądu dają połowę; elektrownie wiosek mocniejsze, mieszkańcy sami je łatają (nie spadają poniżej 60%, szkody po najazdach goją się przez 4 dni).
- **0.93.0 Stare zakłady potrzebują prądu** (etap 4 planu gospodarki). Wzbogacalnia i fabryka czipów mają własne siłownie (wracają z II etapem; kocioł węglowy 120 kW, zespoły diesla 100 kW, własny reaktor wzbogacalni 250 kW); nowe wejścia (chemikalia, ziemie rzadkie), etapy odbudowy ze stalą, cementem, częściami i chemikaliami; ekran terminala przy pulpicie.
- **0.94.0 Fabryka paliwa i fabryka ogniw** (etap 5 planu gospodarki, część 1). Old Propellant Plant (paliwo rakietowe, jedyne źródło) i Old Battery Plant (Power Cells), z siłowniami i trzema etapami; gracz dowozi wszystkie wejścia; nowa technologia Power Cell Chemistry; zamówienia na ogniwa w wioskach złomiarzy.
