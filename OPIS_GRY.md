# GridWorld: opis gry, cel, plan i historia zmian

Stan na wersję **0.146.0**. Ten dokument opisuje, czym jest GridWorld, jaki jest cel gry, co już w niej jest, czego jeszcze nie ma, dokąd zmierza i jak powstawała, wersja po wersji. Nazwy z gry (przedmioty, miejsca, postacie) są po angielsku, tak jak na ekranie.

---

## 1. Czym jest GridWorld

Mapa deweloperska (komenda `map` w konsoli) otwiera widok całej planety z granicą zawijania na szerokim oceanie między kontynentami. Kontynenty w tym widoku nie są przecięte na pół; Gridholm nie musi być w centrum. Przeciąganie i oddalanie mapy zawija razem tło, rzeki, miasta, wioski, wejścia do podziemi, portale, megality, mgły i znacznik gracza. Kliknięcie dowolnej powtórzonej kopii oznaczenia prowadzi do tego samego miejsca. Przycisk Overview przywraca widok całej planety, a Centre on me centruje gracza przy obecnym powiększeniu. Zmiana dotyczy wyświetlania i działa też w istniejących światach bez przenoszenia lokacji.

Kaniony zostały usunięte z generatora świata i map. Dotyczy to także istniejących zapisów: teren wraca do naturalnej rzeźby, a dawne mosty nad kanionami są wycofywane. Mosty rzeczne pozostają dostępne.

Każde zrujnowane miasto ma 4–6 rozdzielonych wejść do podziemi, na wolnych ulicach. Oznaczają je podniesione pokrywy włazów, poręcze i wysokie niebieskie znaki. Oznaczenia ładowane są od razu z miastem, niezależnie od kolejki fragmentów ulic. Po wejściu do miasta jego zejścia widać na minimapie i mapie M, a HUD podaje odległość do najbliższego. Mapa deweloperska pokazuje zejścia w zbliżeniu i pozwala się do nich przenieść. Aby zejść, podejdź do znaku i naciśnij E. Dawne cztery wejścia zachowują adresy, pozycje i labirynty ze starych zapisów; maksymalna głębokość nadal wynosi trzy poziomy.

Na planecie stoi dokładnie 12 ogromnych, megalitycznych monumentów inspirowanych Stonehenge. Po przeskalowaniu mają około 173–248 m średnicy, a kamienne filary i nadproża dochodzą do 55 m wysokości. Układy są różne: koronowany krąg, dwa i trzy kręgi, podkowa, aleja, spirala, cztery bramy, przerwany pierścień, gwiazda, obelisk, wielka brama i konstelacja. Każdy ma własną stałą nazwę i identyfikator megalith:0–11 oraz deterministyczną lokalizację na kontynencie. Są zarezerwowane do przyszłych specjalnych celów — aktualnie nie uruchamiają zadania ani teleportu. Teren pod nimi jest płaski i oczyszczony, a filary i nadproża blokują ruch oraz ostrzał; prześwity i dziedzińce pozostają dostępne. Mapy oznaczają je jasnym symbolem kamiennego nadproża, a mapa deweloperska pozwala kliknięciem odwiedzić zewnętrzną krawędź. W ich pobliżu nie można zakładać bazy.

Przed menu uruchamia się 20-sekundowy film z lotem kamery przez bramę Gridholm i oblotem wioski. Następne ujęcia prezentują starożytne ruiny i aktywny portal, zrujnowane miasto, rzekę i góry, roboty, bandytów, faunę oraz jadący konwój. Stopniowo pojawiają się GRIDWORLD, „Designed by Luki” i niżej „Music by Iskra”. Film można pominąć przyciskiem, spacją, Enterem lub Escape i powtórzyć z menu przez Opening film. Osobna scena pokazowa nie zmienia zapisu ani pozycji gracza; fabularny prolog katastrofy statku pozostaje przy rozpoczęciu przygody nową postacią.

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
Gracze nie są stąd. To astronauci z przyszłości, zespół zwiadowczy, który leciał uśpiony w komorach kriogenicznych. Ich statek spadł na nieznaną planetę po uderzeniu roju meteorów. Gracze nie są pilotami: statek prowadziła komandor **Ilse Varga**, która nie przeżyła katastrofy (leży pochylona nad konsolą).

Nowa postać zaczyna od intra narysowanego liniami gry:
- statek SV-9 **Kestrel** leci przez zewnętrzny pas nieznanego układu;
- znikąd nadciąga rój meteorów, uderzenie odrywa skrzydło;
- statek koziołkuje w stronę planety, wchodzi w atmosferę i się rozbija;
- ekran pokazuje „SYSTEMS OFFLINE”, potem „<IMIĘ>. WAKE UP.”

Gracz budzi się we wraku, wychodząc z własnej komory kriogenicznej. Każdy gracz ma swoją komorę (są cztery): im więcej graczy na serwerze, tym więcej komór stoi otwartych. Po śmierci gracz budzi się znowu w swojej komorze. W szafce czekają pierwsze zapasy, a rejestrator lotu podpowiada, gdzie jest najbliższa osada. Przed wrakiem stoi **Wiktor**, zwiadowca z Gridholm:
- woła do włazu, dopóki gracz z nim nie porozmawia;
- radzi zabrać ze statku wszystko, co się da;
- prowadzi do bramy wioski i po drodze pokazuje ruiny, wraki, obozy i jeziora.

### Planeta i jej przeszłość
Planeta należała kiedyś do potężnej cywilizacji Starożytnych. Zostały po niej:
- obce świątynie z kryptami i lochami;
- porzucone wielkie instalacje (dziewięć): wzbogacalnia uranu, fabryka czipów, stacja radarowa, fabryka paliwa rakietowego, fabryka ogniw, zakłady optyczne, kombinat stopów, zakłady precyzyjne i fabryka robotów;
- rozbite statki;
- maszyny bojowe (roboty), które wciąż strzegą ruin.

Dzisiejsi mieszkańcy żyją w prostych wioskach za płotami z zaostrzonych pali. Uprawiają pola, kopią rudę, łowią ryby i handlują skrzyniami towarów. Nękają ich bandyci. Wiedza dawnego świata przetrwała w rozproszeniu, na starych nośnikach danych.

### Cel: Rydwan Starożytnych
W hangarze pod Gridholm stoi prom Starożytnych, który miejscowi nazywają **Rydwanem Starożytnych** (Chariot of the Ancients). Tylko rozbitkowie chcą, żeby poleciał, bo to ich jedyna droga do domu.

Rydwan odbudowuje się w sześciu etapach. Każdy wymaga czegoś, co robią tylko wielkie instalacje Starożytnych:

| Etap | Co wymaga |
|---|---|
| **Hull Plating** (poszycie) | 16 stali, 10 aluminium, 6 Ancient Alloy |
| **Main Engines** (silniki) | 6 Ancient Alloy, 8 Precision Components, 10 kabla |
| **Avionics** (awionika) | 8 płytek, 6 mikroczipów, 4 sensory, 12 kabla |
| **Heat Shield** (osłona termiczna) | 16 Advanced Ceramics, 4 Ancient Alloy |
| **Power System** (zasilanie) | 8 Power Cells, 4 mikroczipy, 8 kabla |
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
7. **Rydwan.** Dobra przetworzone w zakładach wiosek i wyroby starych fabryk (stop, komponenty, czipy, sensory, ceramika, ogniwa, paliwo rakietowe) trafiają do hangaru.

---

## 4. Świat

### Planeta
- Świat zawija się ze wschodu na zachód po ok. **120 km** (470 regionów po 256 m).
- Na północy i południu kończy się czapami lodowymi (od 25 km) i ścianą lodu (ok. 30 km), której nie da się przejść.
- Słońce stoi wysoko nad równikiem. Przy biegunach trwa wieczny zmierzch.
- Około **100 wiosek** na świat (80–120; część terenu zajmują martwe miasta). Gęsto przy Gridholm (co ok. 1,4 km), rzadko daleko (co ok. 5 km).
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

### Bramy Starożytnych
- **40 teleportów na planecie**, na suchym terenie wszystkich kontynentów. Pierwsza brama znajduje się 450–1100 m od Gridholm.
- Starożytny, obcy pierścień jest ośmiokątny, z sześcioma wyraźnie różnymi symbolami na górnych narożnikach. Dwa narożniki przy ziemi nie mają oznaczeń. Kamień ma pęknięcia i zdobienia, a przy każdej bramie leży inny układ głazów.
- Obok stoi mniejszy kamienny panel z tymi samymi sześcioma znakami: Eye, Trident, Spiral, Bolt, Twin moons, Star. **E** otwiera konsolę, a trzy kliknięcia w odpowiedniej kolejności wybierają adres. Symbole na pierścieniu zapalają się kolejno; konsola pokazuje same znaki, bez angielskich nazw. **Activate** otwiera połączenie, a **Cancel** kasuje wybór. Każda brama ma własny, niepowtarzalny adres z trzech symboli; znaki mogą się powtarzać.
- Adres tej bramy jest wyryty na panelu i widoczny w konsoli. Przy bramie stoi osobny kamienny tablet: **E** pokazuje trzy stałe, losowo dobrane adresy innych bram. Własny adres i nieprzypisana kombinacja nie otwierają przejścia.
- Po poprawnym wyborze pojawia się migocząca powierzchnia teleportu. Połączenie przyjmuje podróżnych **w obu kierunkach przez 45 rzeczywistych sekund**, także podczas otwartych menu. Na górnej belce bramy docelowej oraz w jej konsoli pojawia się adres bramy, która wywołała połączenie. Transport trwa **około pięciu sekund**; ekran wypełnia animacja ciągłych świetlnych linii przelatujących obok gracza. Oba terminale są w tym czasie zablokowane; przejście nie resetuje czasu. Wejście w 44. sekundzie pozwala dokończyć podróż: bramy pozostają otwarte i zablokowane do zakończenia wszystkich rozpoczętych transportów, ale po 45. sekundzie nie przyjmują nowych podróżnych. Powiększony pierścień pozwala przejść pieszo lub przejechać największym Mastodonem z działkiem. Pojazd z dwoma lub trzema graczami przenosi całą załogę, zachowując miejsca, stan, paliwo, wyposażenie i ładunek. Lądowanie wypada przed docelowym pierścieniem; zajęty wyjazd wymaga poczekania.
- Odkryte bramy mają błękitne, ośmiokątne ikony na minimapie i mapie świata. Rozmieszczenie, adresy i głazy są stałe dla ziarna świata, również w istniejących zapisach.

### Krajobraz
- Skały i wielkie głazy mają nieregularne, wielościenne bryły z szeroką podstawą, załamanymi bokami i ściętą górą zamiast piramidalnego czubka. Ten sam model obejmuje gruz w ruinach i kamienie przy jaskiniach. Kolorowe żyły rudy biegną po rzeczywistych ścianach skał; rozmieszczenie, kolizje, wydobycie i wcześniejsze zapisy pozostają zgodne.
- Kontynenty mają nieregularne półwyspy, większe zatoki i liczne mniejsze zatoczki. Dwa lub trzy lądy nadal oddzielają szerokie oceany; okolica Gridholm pozostaje sucha. Wybrzeża i wyspy przeliczają się także w istniejących światach, więc miejsca wybierane na suchym lądzie mogą się przesunąć; do nowej eksploracji najlepiej rozpocząć nowy świat.
- **Teren**:
  - pagórki i doliny;
  - **góry** do ok. 170 m ze śniegiem na szczytach (ok. jednej czwartej lądu);
  - **szlaki** na nazwane szczyty (Mount …) z serpentynami, kopcami i proporcem na szczycie;
  - **jaskinie**: organiczne labirynty z komnatami, pętlami, skrzyniami i kryształami, czasem z dwoma wylotami.
- **Woda**:
  - **jeziora** czyste, mętne i toksyczne (świecące);
  - **studnie** w wioskach i w dziczy;
  - **morza**: około połowy powierzchni między czapami, słone, z plażami i płyciznami;
  - **rzeki**: 150–200 na świat, od gór do mórz, z dopływami, nazwami i nurtem, który niesie pływaka; drogi przecinają je brodami;
  - **wyspy** na otwartym morzu: nominalnie 480–1400 m średnicy, z nieregularnym brzegiem i łagodnymi wzgórzami 6–18 m ponad wodą; widoczne także na mapie deweloperskiej.
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
- **Wielkie instalacje** (dalej w rozdziale 10), dwa razy większe od reszty świata: Old Enrichment Plant (15–25 km), Old Chip Foundry (12–20 km), Old Radar Station (18–28 km), Old Propellant Plant (10–18 km), Old Battery Plant (14–22 km), Old Optical Works (14–24 km), Old Alloy Complex (16–26 km), Old Precision Works (18–28 km), Old Robotics Plant (20–28 km).
- **Miejsce katastrofy** gracza: wrak Kestrela z bruzdą w ziemi, 260–430 m od Gridholm.
- **Martwe miasta** (10 na świat): zrujnowane metropolie dawnego świata, każda ponad kilometr średnicy, dwie najbliższe 4–8 km od Gridholm. Każde ma własny układ ulic (siatka, pokręcone stare miasto, pierścienie i promienie, siatka z ukośnymi bulwarami), centrum wieżowców z połamanymi szczytami, wypalone szkielety, kopce gruzu, latarnie i wraki aut. Niebezpieczeństwo jest tam o 2 wyższe; nie ma w nich wiosek ani innych miejsc, a rzeki i drogi je omijają.

---

## 5. Postać, przetrwanie, walka

- **Zdrowie, stamina, kalorie, woda.**
  - Stamina schodzi na bieg, pływanie, skoki i ciosy ostrzem.
  - Organizm ma zapas kalorii (do 3000 kcal) i spala go szybciej przy wysiłku i z ciężkim plecakiem.
  - Jedzenie wypełnia **żołądek** wagą, więc lekkie i kaloryczne jedzenie karmi najlepiej.
  - Woda: picie ze studni, jezior i rzek, napełnianie manierek.
- **Plecak**: 40 L objętości to twardy limit. Waga powyżej 20 kg spowalnia, powyżej 35 kg to przeciążenie.
  - Większe plecaki zakłada się w slot **Pack**: Hide Rucksack 55 L (ze skór, u każdego kowala), Frame Pack 70 L (plany Woven Armour), Composite Cargo Pack 90 L (plany Composite Armour).
  - **Egzoszkielety** w slocie **Frame**: Salvage Exoframe (plany Exoframes; +15 kg swobodnie, +20 kg do przeciążenia, 6% szybciej, 20% mniej staminy) i Powered Exoskeleton (plany Automation, części starych fabryk; +30/+40 kg, 12% szybciej, 40% mniej staminy).
- **Ręce, plecy, ubranie.**
  - Broń to przedmioty. Palna: Blaster (karabin energetyczny), Old Pistol, Scrap SMG, Scattergun (śrut), Hunting Rifle (luneta 3×). Biała: Energy Blade, Machete, Spear (pchnięcie, duży zasięg), Sledgehammer (wolny, miażdżący).
  - Dwie sztuki mogą być na plecach.
  - Pancerz i odzież są w slotach, do tego maska przeciwgazowa na twarz.
  - Zbroja w trzech rodzajach, każdy z kompletem na głowę, tułów, dłonie, nogi i stopy: **skórzana** (u każdego kowala ze skór), **pleciona** (tkanina przeszyta drutem, plany Woven Armour) i **kompozytowa** (plastik, stop i ceramika, plany Composite Armour; cały komplet zatrzymuje około połowy każdego trafienia).
  - Duże rzeczy (koła, działko) nosi się tylko w rękach.
  - **Narzędzia działają tylko z rąk**: siekiera, kilof i narzędzia budowlane muszą być trzymane w rękach (E przy drzewie lub skale bierze właściwe narzędzie z plecaka do rąk). Kompas, kompas z sensorem i tablet GPS działają z plecaka.
- **Broń**:
  - **amunicja jest ograniczona**: każda broń ma swój magazynek i przeładowuje się z nabojów w plecaku (Energy Cells, Pistol Rounds, Shotgun Shells, Rifle Rounds); na początku naboje tylko się znajduje (skrzynie, obozy, bandyci, roboty, wraki, szafki we mgle), później kowal je robi, jeśli ma się plany Gunsmithing (lub Battery Chemistry dla ogniw);
  - magazynek i przeładowanie, celowanie z przybliżeniem, luneta przy 3×;
  - dodatki: celowniki, lufy (tłumik), magazynki;
  - ostrze bije mocno, ale kosztuje staminę;
  - hałas strzałów ściąga stworzenia z okolicy.
- **Tablet GPS** (plany Radio Triangulation): dokładna pozycja, wysokość i kierunek pod kompasem oraz punkt nawigacyjny stawiany prawym kliknięciem na mapie świata.
- **Ekwipunek w slotach** z przeciąganiem, ikonami i dymkiem z pełnymi parametrami: rodzaj, opis, liczby, waga, objętość, cena, do czego służy.
- **Śmierć** przenosi do najbliższej odkrytej wioski (do własnego łóżka, jeśli ma się dom).
- **Dom gracza w Gridholm** (750 złota): łóżko, w którym się śpi do rana, i skrzynia na 24 sloty.

## 6. Wrogowie

- **Stworzenia**:
  - **Ravager**: stada, flankowanie, doskoki;
  - **Bramble**: terytorialny roślinożerca, szarżuje, z przodu opancerzony; daje mięso;
  - **Leechwing**: krąży, poluje z powietrza, nurkuje;
  - **Gnawer**: szczurze gniazda, które rzucają się rojem.
  - **Skitterwing**: małe latające stworki w stadkach, czasem w pierwszej strefie; pikują i dziobią.
  - **Sea Lurker** (morze): drapieżnik z płetwą nad wodą, atakuje pływających; łódź tylko okrąża.
  - **Silverfin** (morze): niegroźne ławice ryb, uciekają i wyskakują z wody; dają surową rybę.
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
  - Pojazd ma jeden stan użyteczności 0–100%; serwis i zestaw naprawczy odnawiają właśnie ten stan. Koła i silnik nie mają osobnych uszkodzeń.
  - **Vehicle Repair Kit** przywraca 40% stanu pojazdu w terenie, także po jego unieruchomieniu. Ostrzał, zderzenia z przeszkodami i bezpośrednie ataki przeciwników uszkadzają pojazd, a jazda nie powoduje zużycia. Wszyscy pasażerowie są chronieni do chwili opuszczenia pojazdu, również w łaziku i w multiplayerze. Przy 0% pojazd zatrzymuje się, a pasażerowie wysiadają bez obrażeń.
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

**Nowy start osady (nowe światy od 0.131.0)**
- Wioska zaczyna z ośmioma mieszkańcami. Działających elektrowni i zakładów przemysłowych jeszcze nie ma: stoją oznaczenia miejsc pod budowę, naturalne miejsca przyszłego urobku.
- Niezamieszkane domy mają przerwane ściany, odsłonięte krokwie i dziurawe dachy. Rozwój farm i infrastruktury poprawia ich stan; nowe rodziny przybywają stopniowo, do limitu jedzenia i odbudowanych mieszkań.
- Najważniejsze zadania daje starszy: narzędzia i zgromadzenie drewna/kamienia → pierwsza farma → odbiornik satelitarny w pobliskich ruinach i tablet GPS → druga farma → magazyn dla pojazdów → elektrownia → kamieniołom → tartak → lokalna kopalnia i szyb/rafineria (jeśli występują odpowiednie złoża) → trzecia farma.
- Odbiornik naprawia się przy terminalu na powierzchni, na zachodnim skraju wskazanych ruin. Znacznik tutorialu prowadzi do niego bez posiadania GPS. Materiały do naprawy pochodzą z magazynu.
- Tablica początkowo daje dwa proste zlecenia: dostarczyć niewielką ilość zasobów lub pokonać dwóch przeciwników. Kontrakty przewozowe pojawiają się po zbudowaniu dużego magazynu.
- Kowal zaczyna od siekiery, kilofa, zestawu do rozpalania i bukłaka. Po pierwszej farmie potrafi robić deski i gwoździe bez szukania planów; dalszy asortyment wymaga rozwoju oraz odpowiednich starych planów.
- Każda rozwijana osada ma kamieniołom i tartak około 105 m od obrysu palisady. Kamieniołom to duża sterta nieregularnych skał z wolnym miejscem na zakład, tartak zaczyna jako zagajnik z placem pośrodku. Kamieniołom dostarcza Stone, a tartak Log, Timber i Lumber po budowie.
- Złoża rud występują przy około 35% wiosek, ropa przy około 22%; Gridholm ma startowe żelazo. Żelazo (Fe), miedź (Cu), ołów (Pb), nikiel (Ni) i węgiel (C) mają własne kolory i oznaczenia. Rudy leżą w płytkich skalnych zagłębieniach z łagodnym zejściem; ropa tworzy czarne kałuże z animowanymi bąblami i wytryskami. Kopalnia wydobywa lokalny typ rudy. Starszy pomija niewystępujące złoża, więc brak ropy/metalu nie blokuje ukończenia rozwoju.
- Kopalnia, tartak i szyb dają towary dopiero po budowie. Rafineria zużywa rzeczywistą ropę z zapasu wioski, a nie wytwarza paliwa bez wsadu.
- Budowy, zamówienia i rozładunek rezerwują zapas wioski na czas transakcji w multiplayerze: równoczesne kliknięcia nie wydają tych samych materiałów dwukrotnie. Protokół multiplayer ma numer 7: klient i serwer muszą być z tej wersji (aktualizacja serwera zachowuje jego zapisane światy). Gracze dołączający przyjmują reguły świata serwera; nowy pusty pokój serwera zaczyna od małych osad.
- Wcześniejsze zapisy zachowują swoją gospodarkę i budynki. Kod 0.130.0 ma zamrożony tag `v0.130.0`; instrukcja powrotu i kopii zapisu jest w `FROZEN_0.130.0.md`.

**Hala i magazyn**
- **Hala wioski** to jeden wspólny zapas. W nowym świecie zaczyna jako mały magazyn 800 L, do którego można wejść. Kolejny etap stawia magazyn 24 × 24 m, 24 000 L, poza północnym ogrodzeniem: otwór 6 m szerokości i 4,8 m wysokości pozwala wjechać również Mastodonem. Po zaparkowaniu w środku i wyjściu z kabiny terminal rozładowuje bagażnik bezpośrednio do zapasu; nadmiar pozostaje w pojeździe. Dawne zapisy zachowują halę 6000 L.
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
- **Ulepszenia wioski** z części starych fabryk (u starszego, z zapasów hali):
  - Battery Bank (ogniwa, akumulatory) oddaje prąd nocą i przy ciszy wiatrowej;
  - Battery Lamps: wioska bierze mniej prądu, a lampy świecą nawet przy padniętej elektrowni;
  - Automated Site (moduły automatyki, komponenty precyzyjne): miejsce przemysłu daje o połowę więcej i nie potrzebuje rąk do pracy;
  - Sensor Sights (sensory, mikroczipy): turrety na murach widzą dalej i strzelają szybciej;
  - Armoured Wall (aluminium, stop, na kamiennym murze): najazdy częściej się rozbijają.

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

- **25 technologii** na starych nośnikach (dyskietki, dyski, kryształy pamięci). Każda leży w stałym miejscu świata: w ruinie, wraku albo jaskini, tym dalej, im wyższy poziom (od 600 m do 30 km).
  - Przykłady: Irrigated Fields, Forged Tools, Steel Ploughs, Solar Cells, Integrated Circuits, Radio Triangulation, Uranium Enrichment, Rocket Propellant Synthesis, Filter Masks.
- **Plotki**: mieszkańcy pytani o stare maszyny wskazują nośniki i instalacje, z kierunkiem i odległością.
- **Zamówienia u kowala**: z odzyskanych planów kowal robi narzędzia, maski i filtry z zapasów hali.
- **Wielkie instalacje**:
  - **Old Enrichment Plant** robi z uranu pręty paliwowe;
  - **Old Chip Foundry** robi ze szkła i miedzi mikroczipy;
  - **Old Radar Station** odkrywa na mapie wszystko w promieniu 12 km;
  - **Old Propellant Plant** robi paliwo rakietowe (jedyne źródło);
  - **Old Battery Plant** robi ogniwa (Power Cells);
  - **Old Optical Works** robi sensory;
  - **Old Alloy Complex** robi Ancient Alloy albo Advanced Ceramics;
  - **Old Precision Works** robi ze stali, Ancient Alloy i mikroczipów komponenty precyzyjne (Precision Components);
  - **Old Robotics Plant**, największa ze wszystkich, robi z mikroczipów, sensorów, komponentów precyzyjnych i ogniw moduły automatyki (Automation Units): szczyt łańcucha produkcji.

  Każdą odbudowuje się w trzech etapach przy jej pulpicie sterowniczym. Na ostatni etap potrzebne są plany. Od drugiego etapu działa jej własna siłownia (kocioł na węgiel, agregaty diesla, w wzbogacalni reaktor); gracz dowozi każde wejście i każde paliwo sam.

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
- dziewięć wielkich instalacji z siłowniami;
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
- pełnego trybu wieloosobowego: wszystko w świecie jest już wspólne (wioski, rynki, budowle, działki, tablice ogłoszeń, skrzynie, łupy na ziemi, wszyscy wrogowie z rabusiami, dronami, bossami i wieżyczkami, wspólna jazda pojazdami, czat), ale postać zapisuje się w przeglądarce, nie na serwerze, a spacery mieszkańców wiosek nie są zsynchronizowane; nie ma statków innych graczy;
- kombinezonu przeciwchemicznego, mgły w lochach i stworzeń mgły;
- nurkowania;
- spalania paliwa przez pojazdy (bak jest pokazywany, ale na razie się nie opróżnia);
- budowania własnych baz w dziczy (kod jest, funkcja zamknięta);
- ręcznego rzemiosła (zamrożone, rzeczy robi się w wioskach);
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
7. **Woda.** Nurkowanie i porty.
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
- **0.95.0 Olbrzymy dawnego świata** (etap 5, część 2). Wszystkie instalacje Starożytnych dwa razy większe (pulpity w skali człowieka, położenie bez zmian); Old Optical Works (sensory) i Old Alloy Complex (Ancient Alloy lub Advanced Ceramics); technologie Advanced Sensors i Ancient Metallurgy.
- **0.96.0 Szczyt łańcucha** (etap 5, część 3). Old Precision Works (Precision Components ze stali, Ancient Alloy i mikroczipów) i Old Robotics Plant (Automation Units z mikroczipów, sensorów, komponentów precyzyjnych i ogniw), obie w podwójnej skali; technologie Precision Manufacturing i Automation; etap 5 zamknięty.
- **0.97.0 Do czego służą stare części** (etap 6). Ulepszenia wiosek (bank akumulatorów, lampy akumulatorowe, zautomatyzowane miejsce przemysłu, celowniki sensorowe turretów, opancerzony mur); stojaki ogniw w siłowniach starych fabryk; antena sensorowa radaru (20 km); u kowala napęd precyzyjny do pojazdów i kompas z sensorem, który wskazuje instalacje i znane strefy mgły; automatyzacja elektrowni wymaga też komponentów precyzyjnych.
- **0.98.0 Rydwan na końcu łańcucha** (etap 7). Rydwan ma sześć etapów (nowy Power System) i każdy wymaga wyrobów starych fabryk; etapy ukończone w starych zapisach zostają ukończone, a skrzynie, których nowe wymagania już nie biorą, wracają do hali Gridholm; kampania (cuda) dostała nowe dobra i nową kalibrację (~80 h w pojedynkę).
- **0.99.0 Amunicja, nowa broń, GPS i naprawy w polu.** Amunicja jest ograniczona (każda broń ma własny magazynek i własny rodzaj nabojów, przeładowanie z plecaka); na początku tylko do znalezienia, potem u kowala z planami Gunsmithing (nowa technologia) lub Battery Chemistry. Nowa broń palna (pistolet, pistolet maszynowy, strzelba, karabin myśliwski) i biała (maczeta, włócznia, młot). Tablet GPS z punktem nawigacyjnym. Zestaw do naprawy pojazdów (kadłub, silnik, koła) u Kuby lub u kowala z planami Combustion Engines.
- **0.100.0 Zbroje, plecaki i egzoszkielety.** Dwa nowe sloty na ciele (Pack i Frame). Trzy większe plecaki (55, 70 i 90 L), dwa egzoszkielety (większy udźwig, szybszy chód, mniejsze zużycie staminy), zbroja w trzech rodzajach: skórzana, pleciona i kompozytowa. Nowe technologie: Woven Armour, Composite Armour i Exoframes.
- **0.101.0 Narzędzia w rękach.** Siekiera, kilof i narzędzia budowlane działają tylko trzymane w rękach, nie z plecaka; E przy drzewie lub skale bierze narzędzie do rąk, a trzymaną siekierę lub kilof widać w dłoniach.
- **0.101.1 Pełne modele narzędzi.** Siekiera, kilof i pozostałe narzędzia ręczne mają pełne (nieprześwitujące) modele, w dłoni i leżące na ziemi; każde narzędzie ma własny kształt w ręku.
- **0.102.0 Skrzydła i płetwy.** Stadka małych Skitterwingów czasem pojawiają się w pierwszej strefie zagrożenia: trzepoczą nisko, pikują i dziobią. W morzu żyją Sea Lurkery (drapieżniki z płetwą nad wodą, atakują pływających, łódź tylko okrążają) i ławice Silverfin (niegroźne, wyskakują z wody). Nowe jedzenie: surowa ryba.
- **0.103.0 Razem (multiplayer, pierwszy krok).** Gracz, który uruchomi grę przez start-gry.bat, wybiera w menu Host a game; znajomi w tej samej sieci otwierają w przeglądarce jego adres i klikają Join (do 8 graczy). Świat i zegar gospodarza są wspólne, własny zapis dołączającego czeka w kopii (Back to my own world). Inni gracze widoczni jako postacie w swoich kolorach z imieniem i tym, co trzymają; czat pod T. Gdy gospodarz wyjdzie, gospodarzem zostaje najdłużej grający. Wrogowie, łupy i wioski są na razie osobne dla każdego.
- **0.104.0 Własny serwer.** Gra może stać na serwerze VPS: jeden program podaje grę przeglądarce i prowadzi tryb wieloosobowy na jednym porcie. Świat należy do serwera (stałe ziarno, zegar chodzi i zapisuje się także bez graczy), nikt nie musi być gospodarzem. W menu nazwa serwera, kto jest online i przycisk Join the server. Instalacja jedną komendą (deploy/install.sh, z domeną także https), Dockerfile, instrukcja w SERWER.md.
- **0.104.1 Dobry sąsiad.** Serwer instaluje się obok innych aplikacji, niczego w nich nie ruszając: własny folder, własny Node.js, własny port 8517 (skrypt przerywa, gdy jest zajęty), bez zmian w serwerze WWW, proxy i zaporze. Gra działa też za portalem pod podścieżką, np. https://domena/gridworld/.
- **0.105.0 Martwe miasta.** Na planecie stoi 10 wielkich zrujnowanych miast dawnego świata, każde ponad kilometr średnicy (przejście zajmuje minuty); dwa najbliższe 4–8 km od Gridholm. Każde ma własny układ (zwykła siatka kwartałów, pokręcone stare miasto, pierścienie i promienie wokół placu, siatka przecięta ukośnymi bulwarami), własne centrum wieżowców i odsetek zawalonych budynków. Ulice z krawężnikami, pasami, przejściami, latarniami i wrakami aut; budynki z siatką pięter i okien, połamanymi szczytami, wypalone szkielety z wiszącymi belkami, kopce gruzu. Miasta są niebezpieczne (zagrożenie +2), budynki zatrzymują ruch i strzały. Na mapie widać obrys i ulice odkrytych części. W miastach nie ma wiosek, świątyń, wraków i obozów, a rzeki i drogi je omijają.
- **0.105.1 Szybszy start.** Wyszukiwanie miejsc wielkich instalacji (kilka sekund) blokowało menu i pole imienia przy starcie; teraz liczy się w tle, w osobnym wątku przeglądarki.
- **0.106.0 Lista serwerów i komory kriogeniczne.** Serwer na VPS pokazuje w menu listę swoich serwerów gry (nazwa, kto gra, czy działa, czy stoi w pauzie); gracz wybiera jeden i klika Join albo zakłada własny z nazwą (w nowym świecie albo w swoim). Serwer działa, dopóki ktoś na nim jest, a gdy ostatni gracz wyjdzie, jego zegar staje. Gracz, który wyjdzie do menu, nie znika: zostaje w świecie z dopiskiem „(in menu)”, a świat toczy się dalej dla innych. Fabuła: gracze nie są pilotami; pilotka zginęła w katastrofie i leży nad konsolą, a gracze budzą się z komór kriogenicznych, każdy ze swojej (więcej graczy, więcej otwartych komór). Po śmierci budzisz się znowu w swojej komorze na statku.
- **0.106.1 Wspólne pojazdy.** W trybie wieloosobowym widać pojazdy innych graczy: zaparkowane tam, gdzie je zostawili, i ten, którym jadą, z kierowcą za kierownicą (wcześniej kierowca wisiał w powietrzu, a auta nie było). Cudze auta blokują drogę, ale prowadzić je, otwierać bagażnik i serwisować może tylko właściciel. Inni gracze poruszają się płynniej: są rysowani z małym opóźnieniem, między dwiema ostatnimi pozycjami, więc nierówno przychodzące pakiety nie powodują szarpania.
- **0.107.0 Zostaw to na ziemi.** „Drop” w plecaku nie niszczy już przedmiotu, tylko kładzie go pod nogami, a E podnosi go z powrotem. W grze wieloosobowej wszyscy w tym samym miejscu widzą położone rzeczy (z dopiskiem, kto je zostawił) i mogą je podnieść: tak przekazuje się sprzęt, broń, jedzenie czy koła. Przedmiot dostaje tylko ten, kto pierwszy po niego sięgnie, więc nic się nie duplikuje. Na serwerze rzeczy leżą 6 godzin, także po wyjściu gracza i po restarcie serwera.
- **0.108.0 Miejsce dla jeszcze jednego.** Wspólna jazda: E przy drzwiach cudzego pojazdu zajmuje wolne miejsce pasażera albo strzelca, E wysiada obok, V zmienia widok. Klawisze 1, 2 i 3 przesiadają między wolnymi miejscami (kierowca, pasażer, strzelec); kierownica zostaje u właściciela pojazdu. We własnym pojeździe też można się przesiąść, a gdy nikt nie siedzi za kierownicą, pojazd się zatrzymuje. Ze stanowiska strzelca obsługuje się działko na dachu: celuje się widokiem, inni widzą, jak się obraca. Wszyscy widzą, kto gdzie siedzi.
- **0.109.0 Jeden świat dla wszystkich.** Na serwerze wszyscy grają w jednym, wspólnym świecie: wioski (mury, obrona, farmy i uprawy, zakłady, elektrownie, ulepszenia, magazyn w ratuszu, zaufanie), rynki, mosty, pomosty i łodzie, wielkie instalacje, Rydwan, zawartość skrzyń i postęp w ruinach, ścięte drzewa i zebrane rośliny, rozbite obozy bandytów i losy karawan. Zmiany jednego gracza inni widzą po sekundzie lub dwóch. Własne pozostają: ekwipunek, złoto, poziom, zadania i kontrakty, mapa i znalezione plany, pojazdy i skrzynia w domu. Pierwszy gracz, który już grał w świecie serwera, wnosi do niego swój postęp; kolejni dołączają do wspólnego świata.
- **0.110.0 Miasta pełne wrogów.** Martwe miasta roją się od przeciwników: oddziały maszyn dawnego świata pilnują ulic, gryzonie gnieżdżą się w gruzach, a gangi szabrowników okupują ruiny. Każde miasto ma setki takich grup w stałych miejscach przy ulicach, więcej i większych bliżej centrum. Budzą się, gdy podejdziesz na ok. 100 m, więc przez miasto idzie się ulica po ulicy, często z kilkoma grupami naraz (w centrum ok. 50 wrogów wokół gracza). Wybita grupa milknie na ok. 45 minut gry.
- **0.111.0 Wspólni wrogowie.** Na serwerze wszyscy gracze walczą z tymi samymi wrogami: stwory, roboty i bandyci (losowe spotkania, obozy, garnizony miast, napady na wioski, strażnicy wraków) są wspólni. Wrogów w danym miejscu prowadzi gra pierwszego gracza, pozostali widzą ich ruchy i pociski, mogą do nich strzelać, a zabójstwo, łup i nagrodę dostaje ten, kto zadał ostatni cios. Wrogowie idą na najbliższego gracza. Jeszcze osobno: pojazdy rabusiów, drony w podziemiach, bossowie.

- **0.116.0 Przepaście i pola głazów.** Na suchych kontynentach pojawiają się wąwozy szerokie na 50–100 m, długie na 320–600 m, z dwoma łagodnymi zejściami wzdłuż ścian. Bridge Kit pozwala wyznaczyć nad nimi most dla pieszych i samochodów, zbudować go z materiałów i zapisać we wspólnym świecie. Skupiska głazów o promieniu 2,5–5,5 m utrudniają jazdę poza drogami. Generator zmienia także teren istniejących zapisów; zalecany nowy świat.

- **0.117.0 Garnizony i frakcje.** Wielkie miasta mają po 16 placówek, z mniejszymi grupami i najwyżej trzema aktywnymi w pobliżu. Po wybiciu placówki przez 10 rzeczywistych minut aktywnego czasu świata nie ma posiłków; polegli i zdrowie ocalałych pozostają zapisane przy objazdach, wczytaniu i w multiplayerze. Zwykłe losowe spotkania nie pojawiają się w miastach. Roboty oraz dzikie stworzenia mogą walczyć z bandytami, którzy odpowiadają ogniem, ale roboty i zwierzęta nie walczą ze sobą. Walka między przeciwnikami nie przyznaje graczowi bezpośredniego złota ani postępu zadań.

- **0.118.0 Palisady i wyposażenie.** Obozy bandytów otacza wysoka palisada z zaostrzonych drewnianych pali z otwartymi wejściami od północy i południa. Skrzynie skarbów i obozowe skrytki mają deski, zaokrąglone wieka, okucia, zawiasy, zamki i uchwyty; skrzynie w podziemiach zachowują animację otwierania. Komputery w magazynach wiosek, dawnych zakładach, przy elektrowniach i we wraku statku używają modelu z domu starszego: monitor CRT, klawiatura i osobna obudowa.

- **0.119.0 Jeden stan pojazdu.** Osobne uszkodzenia kół i silnika zastępuje wspólny stan użyteczności. Ostrzał, zderzenia i ataki przeciwników uszkadzają pojazd; zwykła jazda nie powoduje zużycia. Kierowca, pasażer i strzelec nie tracą zdrowia wewnątrz, również w otwartym łaziku i w cudzym pojeździe. Przy 0% pojazd zatrzymuje się i pasażerowie wysiadają bez obrażeń. Serwis i zestaw naprawczy odnawiają wspólny stan. Zachowano zgodność zapisów i wyposażenie.

- **0.128.0 Mniejsze megality i widoczne wejścia miejskie.** Megality mają o 25% mniejszą szerokość i o 30% mniejszą wysokość; zmniejszono też kolizje i oczyszczone podłoże, zachowując stałe miejsca. Każde miasto ma 4–6 wejść do podziemi: wysokie niebieskie znaki, od razu ładowane modele, znaczniki na mapach i odległość na HUD. Dawne adresy i labirynty są zachowane.
- **0.127.1 Lądowanie na kamieniach i ruinach.** Usunięto zaokrąglanie wysokości stóp do pełnych metrów po lądowaniu. Postać zatrzymuje się na dokładnej granicy kolizji kamienia, ruiny, podłogi lub sufitu i może odejść oraz ponownie skoczyć. Naprawiane są płytko zatopione, zaokrąglone pozycje ze starych zapisów.
- **0.127.0 Usunięcie kanionów.** Usunięto generator kanionów, ścieżki zejścia, skanowanie i oznaczenia na mapie oraz projektowanie mostów nad kanionami. Zapisane światy mają ponownie naturalny teren; dawne mosty nad kanionami są wycofywane. Mosty rzeczne i pola głazów pozostają.
- **0.126.0 Dwanaście kolosalnych megalitów.** Odrębne, wielkie układy Stonehenge o średnicy 230–330 m i wysokości do 78 m, z kamiennymi filarami, nadprożami i rzeźbieniami. Stałe lokalizacje i identyfikatory pod przyszłe funkcje, kolizje i osłona przed ostrzałem, oczyszczone dziedzińce, znaczniki na mapach oraz wydłużony widok przy monumentach.
- **0.125.0 Portale i kaniony na mapie deweloperskiej.** Polecenie map w konsoli pokazuje wszystkie 40 portali jako turkusowe ośmiokąty i kaniony jako pomarańczowe obrysy. W zbliżeniu widać ścieżki zejścia; najechanie podaje rozmiar i głębokość, a kliknięcie przenosi obok pierścienia albo na początek ścieżki. Skanowanie kanionów działa stopniowo, także poza odkrytym terenem.
- **0.124.0 Film wejściowy z drona.** Dwudziestosekundowa prezentacja wioski, ruin, portalu, miasta, rzeki, gór, trzech grup przeciwników i konwoju. Stopniowe napisy GRIDWORLD, Designed by Luki i Music by Iskra; pomijanie, powtórka z menu i brak wpływu na zapis gry.
- **0.123.0 Naturalne, wielościenne skały.** Piramidalne kamienie zastąpione głazami o szerokiej podstawie, nieregularnych bokach i ściętej górze. Zmiana obejmuje teren, gruz w ruinach i kamienie przy jaskiniach. Żyły rudy dopasowane do nowych ścian; rozmieszczenie, kolizje i wydobywanie zgodne z dotychczasowymi zapisami.
- **0.122.0 Wybieranie adresu i animacja podróży.** Symbole zapalają się kolejno na pierścieniu. Przyciski Activate i Cancel zastępują automatyczne otwieranie; znikają angielskie nazwy znaków. Brama docelowa pokazuje kod źródłowy. Pięciosekundowy transport całej załogi ma animację ciągłych linii, a bramy nie zamykają się przed ukończeniem podróży rozpoczętej przed upływem 45 sekund.
- **0.121.0 Bramy dla pojazdów i stałe tablety.** Własny adres wyryty na terminalu, trzy stałe adresy na osobnym tablecie. Dwukierunkowe połączenie przez 45 rzeczywistych sekund blokuje obie konsole. Powiększone bramy przepuszczają Mastodona z dwoma lub trzema graczami, zachowując miejsca i cały ładunek.
- **0.120.0 Bramy Starożytnych.** Sieć 40 obcych, kamiennych, ośmiokątnych teleportów na kontynentach. Sześć różnych symboli na górnych narożnikach, dwa dolne bez znaków. Panel przy każdej bramie wybiera unikalny trzyznakowy adres; archiwum podaje adresy do podróży i powrotu. Przejście pieszo przenosi przed docelowy pierścień bez zmiany zdrowia i ekwipunku. Bramy mają różne rozsypane głazy, płaskie podejścia i znaczniki na mapach.

- **0.129.0 Organiczne wybrzeża i większe wyspy.** Kontynenty mają półwyspy, głębokie zatoki i liczne zatoczki, przy zachowanych szerokich oceanach. Wyspy powiększono do nominalnej średnicy 480–1400 m i wzgórz 6–18 m. Poprawiono wyszukiwanie pełnych obrzeży na granicach komórek i planety; mapa deweloperska pokazuje wyspy. Nowa geografia przelicza się w istniejących światach.

- **0.130.0 Oceaniczna granica mapy deweloperskiej.** Widok całej planety zaczyna i kończy się na oceanie pomiędzy kontynentami. Wszystkie warstwy i znaczniki powtarzają się zgodnie przy przesuwaniu i oddalaniu, a kliknięcia trafiają do oryginalnych lokacji. Przycisk Overview przywraca pełny widok; istniejące światy zachowują geografię i zapisy.

- **0.131.0 Od małej osady do przemysłu.** Zamrożona wersja 0.130.0, mały start nowych światów, zrujnowane puste domy i stopniowy przyrost mieszkańców. Tutorial starszego prowadzi przez zasoby, farmy, odbudowę odbiornika GPS w pobliskich ruinach, magazyn z wjazdem i rozładunkiem pojazdu oraz budowę kopalni, tartaku, elektrowni, szybu i rafinerii. Ograniczony początkowy kowal i krótkie zlecenia poboczne; zachowanie starszych zapisów i wspólne budowy w multiplayerze.

- **0.132.0 Naturalne miejsca urobku.** Kamieniołom i własny tartak przy każdej rozwijanej wiosce, około 100 m poza palisadą; rzadsze, oznaczone kolorami złoża metali i bulgoczące rozlewiska ropy. Rzeczywiste skalne zagłębienia, łagodne wejścia, kolizje zgodne ze skałami, produkcja lokalnych surowców oraz tutorial dopasowany do dostępnych złóż. Istniejące budowy i zapasy pozostają zachowane; multiplayer używa protokołu 7.

- **0.133.0 Łagodniejsze wieżyczki, wraki z załogą robotów.** Wieżyczki obronne w podziemiach i wrakach obracają głowicę powoli, dłużej ostrzegają (bursztynowy czujnik) i strzelają krótkimi seriami po trzy pociski z dwusekundową przerwą i lekkim rozrzutem, więc da się przed nimi uciec w bok albo za osłonę. Głowica ma nowy kształt: fasetowana kopułka z wizjerem i podwójną lufą, osadzona w niskim pierścieniu. We wrakach statków jest już tylko jedna wieżyczka, za to wróciła załoga robotów: zwiadowcy, strażnicy, drony naprawcze, sentinele i konstrukty szturmowe.

- **0.134.0 Jeden świat dla wszystkich.** Na serwerze wspólne jest już wszystko w świecie: łup z wrogów, kłody i kamienie leżą raz dla wszystkich i bierze je ten, kto pierwszy po nich przejdzie; pojazdy rabusiów, blokady dróg, drony i bossowie w podziemiach są wspólni jak inni wrogowie, a nagrodę dostaje ten, kto zadał ostatni cios. Wieżyczki strzelają do najbliższego gracza, a trafienia w nie liczą się u wszystkich. Gdy gracz wychodzi, jego wrogowie zostają i walczą dalej u pozostałych. Wspólne są też działki graczy z budowlami, warsztaty w terenie i tablice ogłoszeń. Własna zostaje tylko postać: ekwipunek, złoto, doświadczenie, zadania, mapa i wiedza. Protokół multiplayer 8.

- **0.135.0 Kolosalne głowy.** Dziesięć nowych starożytnych miejsc na kontynentach: doliny gigantycznych kamiennych głów zakopanych po ramiona wśród wielkich głazów, od 15 do 50 m wysokości, z fasetowanymi twarzami, ciężkimi łukami brwiowymi, długimi nosami i uszami oraz oczami-wizjerami, w których świecą rzędy znaków. Każde miejsce jest inne: Dolina Strażników (dwa rzędy twarzami do ścieżki), Rada Kamiennych Twarzy (krąg patrzący do środka), Spojrzenie ku Morzu (rząd w jedną stronę), Zatopiony Chór (na wpół połknięty przez ziemię), Bliźniaczy Strażnicy, Pochyleni Starsi, Wielkie Zgromadzenie, Oczy Dawnego Nieba (patrzą na zewnątrz), Patriarcha (olbrzym wśród czterech) i Długie Czuwanie (rosnący rząd). Głowy i głazy są lite, między nimi można chodzić; nazwy i znaczniki na mapach jak przy innych monumentach. Dwanaście dawnych monumentów zostaje na swoich miejscach.
- **0.136.0 Obok plecaka.** Po otwarciu plecaka obok niego pojawia się panel „On the ground” z tym, co leży w promieniu 3 m: kliknięcie albo przeciągnięcie do plecaka podnosi przedmiot, przeciągnięcie własnego przedmiotu na ziemię (albo „Drop”) kładzie go pod nogami, „Pick up all” zbiera wszystko. Skrzynie, schowki, bagażniki, szafki i ładownie łodzi otwierają się teraz w tym samym oknie, obok całego plecaka (moduły, ciało, zawartość): klik w skrzyni bierze przedmiot, a własny zaznaczony przedmiot odkłada się przyciskiem „Store”. Naprawione mruganie okna: najechanie na przedmiot w oknie skrzyni przepisywało opis pod siatką i zmieniało rozmiar okna; teraz na najechanie pokazuje się tylko dymek z opisem, a okna nie zmieniają rozmiaru.
- **0.137.0 Magazyn wioski.** Nowa osada nie ma na początku magazynu: drewno, kamień i inne materiały zanosi się do starszego (opcja „Leave materials with me”), który przechowuje zapasy wioski, dopóki nie stanie magazyn; jego działka za północnym płotem jest do tego czasu wytyczona palikami. Magazyn wygląda teraz jak duża drewniana stodoła: deskowane ściany na słupach z zastrzałami, dwuspadowy dach nad szeroką, otwartą dwuskrzydłową bramą, deskowa podłoga, regały i wymalowane miejsce postojowe; ciężarówką wjeżdża się do środka i rozładowuje ją przy terminalu, a kamera zostaje pod dachem. Starsze hale wiosek dostały ten sam drewniany wygląd. Do magazynu trafiają tylko materiały: drewno, kamień, rudy i metale, materiały budowlane, skrzynie towarów i to, co z nich robią zakłady (oraz zestawy wieżyczek i części silników potrzebne do budów); broń, amunicja, apteczki, jedzenie, narzędzia i ubrania zostają przy graczu i trzyma się je w skrzyni we własnym domu.
- **0.138.0 Wojskowe skrzynie.** Skrzynie w ruinach, wrakach i jaskiniach mają trzy nowe, wojskowe modele w stylu sci-fi: skrzynię amunicyjną (żebrowana stal na płozach, okucia narożników, panel w ukośne pasy ostrzegawcze, zatrzaski i uchwyty), zaplombowany kontener techniczny (ośmiokątna kapsuła z grubymi pierścieniami na końcach, świecącymi szwami i wyświetlaczem na wieku) oraz opancerzony sejf (stalowa skrzynia ze skośnym przodem, klawiaturą, lampką stanu i wywietrznikami). Stara drewniana skrzynia skarbów trafia się już tylko od czasu do czasu (mniej więcej co czternasta); schowek w obozie bandytów to skrzynia amunicyjna.
- **0.139.0 Statki.** Pomosty to teraz doki (Dock Kit): na ich pochylni buduje się wszystkie łodzie i statki, wodowane obok doku (statek potrzebuje głębszej wody). Mała łódź to łódź wiosłowa (ładownia 10); przyprowadzona do doku może zostać przerobiona na łódź z masztem i żaglem (Sailing Skiff) albo z silnikiem przyczepnym (Motor Skiff), obie z ładownią 14; dawne żaglówki i motorówki stały się tymi łodziami. Duży statek to dwumasztowy żaglowiec (Sailing Ship, 16 m, ładownia 48, tylko żagle: potrzebuje wiatru i nie popłynie pod wiatr) albo statek motorowy (Motor Ship, 15 m, komin i sterówka, ładownia 40, pali kanistry paliwa). Statki mają pokład: wchodzi się z doku przez furtę w nadburciu na śródokręciu albo z wody klawiszem E przy kadłubie. E przy kole sterowym na rufie przejmuje ster (sterowanie jak w łodziach: spacja stawia lub zwija żagle, W/S szoty albo przepustnica); ponowne E puszcza ster, a statek płynie dalej tym samym kursem z żaglami lub silnikiem ustawionymi jak zostawiono, więc po pokładzie można chodzić w czasie rejsu (gracz jest niesiony razem ze statkiem). F otwiera ładownię w dowolnym miejscu pokładu. Bez sternika statek może wpaść na mieliznę.
- **0.140.0 Załogi.** W grze sieciowej kilku graczy może płynąć jedną łodzią lub statkiem: kto trzyma wiosła, rumpel albo ster, ten prowadzi za wszystkich, a pozostali widzą ten sam ruch i są niesieni na pokładzie. Łódź wiosłowa ma drugą parę wioseł: drugi gracz siada przy rufowych i gdy obaj wiosłują w tę samą stronę, łódź płynie o połowę szybciej. Ster statku ma jednego sternika naraz. Statki mają po obu burtach drabinki sznurowe (z wody E, by wejść na pokład) oraz trapy, które same wysuwają się z furty do doku, mostu albo brzegu w odległości około 3 m, gdy statek stoi, i chowają się, gdy rusza; nowy statek woduje się burtą przy głowicy doku, gdy tylko woda na to pozwala, a latarnia i skrzynia na doku stoją teraz na wewnętrznym końcu głowicy, z dala od trapu. Serwer trzeba zaktualizować razem z grą (protokół 9).
- **0.140.1 Zasada: najpierw gra wieloosobowa.** Nowa stała zasada tworzenia gry: każda zmiana, nawet tylko rozważana, jest od początku rozpracowywana pod kątem wielu graczy w jednym świecie (kto ją prowadzi, co widzą inni, co się zapisuje dla wszystkich, co gdy dwóch graczy działa naraz, ktoś dołącza później albo wychodzi, czy trzeba zmienić protokół i zaktualizować serwer) i sprawdzana na dwóch graczach.
- **0.141.0 Ręce i chleb.** Pierwsze etapy planu wiosek (`PLAN_WIOSEK.md`, z dokumentu „Wioski, populacja i progresja”). Panel osady u starszego („How is the village doing?”) i w terminalu: populacja, robotnicy przy pracy, wolni robotnicy, pojemność mieszkań, bezpieczeństwo żywnościowe i poziom rozwoju, kto gdzie pracuje i co hamuje wzrost. Każdy obiekt osady ma etaty (farma 4, elektrownia 2, kamieniołom 3, tartak 4, kopalnia 4, szyb 2, rafineria 3, zakład 3, stacja 1); 60% mieszkańców pracuje, przydział idzie po kolei: farmy, prąd, wydobycie, rafineria, zakłady, stacje. Farma i wydobycie bez pełnej obsady dają mniej, zakład i stacja bez całej załogi stoją; przy kamieniołomie, tartaku, kopalni i szybie widać robotników. Mieszkańcy jedzą plony farm (len i wełna to nie jedzenie), do magazynu trafia tylko nadwyżka; rodziny przybywają, gdy są wolne domy i jedzenie z zapasem 10%, a odchodzą, gdy jedzenia brakuje. W grze wieloosobowej wszystko liczy się ze wspólnego stanu wioski, więc każdy gracz widzi to samo; protokół bez zmian.
- **0.142.0 Pola i kuźnia.** Dokument „Rolnictwo, żywność i gospodarka lokalna”: nowa uprawa bawełna (włókno dla przędzalni, 2 bele → bela sukna, na rynku jak len i wełna); hodowla daje też mięso (krowy mleko i mięso, kury jajka i trochę mięsa), skrzynie mięsa trafiają do zapasów, dobrze żywią mieszkańców, a sklep spożywczy je piecze. Osady mogą postawić przetwórnię żywności (młyn, piekarnia, mleczarnia, wędzarnia; po elektrowni i dwóch farmach, plac ok. 100 m na południowy zachód, 3 etaty, 8 kW): dopóki pracuje, zboże, ziemniaki, mleko i mięso żywią o 35% więcej ludzi. W osadach pompy stalowych pługów potrzebują prądu. Praca u kowala trwa teraz godziny gry (podstawowe 1 h, z planów 2–5 h): materiały schodzą z zapasów przy zamówieniu, gotową rzecz odbiera się później (gra powiadamia), najwyżej 3 zamówienia naraz. Multiplayer: uprawy, przetwórnia i zapasy są we wspólnym stanie wioski; zamówienia u kowala należą do gracza (nie są dzielone), materiały schodzą ze wspólnych zapasów pod blokadą jak dotąd; protokół bez zmian.
- **0.143.0 Silniki i pompy.** Pierwszy etap dokumentu „Surowce, przemysł, komponenty i technologie” (plan w `PLAN_PRZEMYSLU.md`): pięć komponentów przemysłowych (silniki elektryczne, generatory, rury i zawory, przekładnie i łożyska, pompy przemysłowe), towary rynkowe. Nowy zakład Electrical Works (silniki, generatory; technologia Electric Machines z nośnika danych), Machine Shop robi też rury, przekładnie i pompy. Zanim gracz sam je zrobi, zdobywa je jako salvage: roboty i szafki we wrakach. Potrzebne są do farmy wiatrowej, zespołu generatorów diesla, elektrowni węglowej, przebudowy elektrowni wioski, zautomatyzowanego zakładu, zakładu chemicznego i zakładu tworzyw. Każdy materiał ma klasę z hierarchii dokumentu (surowiec, żywność, materiał, komponent przemysłowy, elektryka, zaawansowane), widoczną w podpowiedzi. Multiplayer: wspólny rynek i stan wiosek, łupy przez wspólne zrzuty; protokół bez zmian.
- **0.144.0 Kamień i metale strategiczne.** Etapy 2 i 3 dokumentu „Surowce, przemysł…” (stal dalej bez koksu, decyzja właściciela): zakład Stoneworks (dla każdego) robi z kamienia ciosany kamień, potrzebny teraz do kamiennego muru i elektrowni węglowej. Trzy rudy metali strategicznych (chromit, rutyl, ruda platyny) jako drugie złoże wiosek daleko od Gridholm, wydobywane w ramach dziennego przydziału zaufania; stare złoża zostają. Zakład Advanced Metallurgy (technologia z nośnika danych) robi stal stopową, tytan i metale z grupy platyny, potrzebne do opancerzonego muru, egzoszkieletu, kompasu z czujnikiem i macierzy radaru. Multiplayer: wspólny stan wiosek i rynku, złoża liczone z ziarna świata; protokół bez zmian.
- **0.145.0 Elektronika.** Etap 4 dokumentu „Surowce, przemysł…”: sześć towarów elektronicznych (oczyszczony krzem, jednostki sterujące, komponenty optyczne, elektronika dużej mocy, systemy komputerowe, moduły sterowania zasilaniem). Nowe zakłady Silicon Processing (technologia Semiconductor Industry) i Advanced Electronics Works (Advanced Computing); warsztat elektroniczny składa jednostki sterujące, huta szkła szlifuje optykę. Najpierw salvage: roboty, wraki, szafki w toksycznej mgle. Potrzebne do małego reaktora, banku baterii, automatyzacji, celowników, kompasu z czujnikiem, radaru i egzoszkieletu. Multiplayer: wspólny rynek i stan wiosek; protokół bez zmian.
- **0.146.0 Płatowce i starożytna sieć.** Etap 5 dokumentu „Surowce, przemysł…”: dwie nowe instalacje Starożytnych. Stara Fabryka Lotnicza (technologia Aerospace Engineering) robi komponenty lotnicze z tytanu, aluminium, kompozytu i stali stopowej. Starożytny Kompleks Energetyczny (technologia Ancient Power Grid), zasilany prętami paliwowymi, daje prąd wszystkim starym zakładom w promieniu 16 km: ich partie nie spalają wtedy własnego paliwa. Stary Kompleks Stopów wypieka też arkusze kompozytowe (żywica, tkanina, tytan). Multiplayer: stan instalacji wspólny (`installs`), sieć liczona tak samo u każdego; protokół bez zmian.
