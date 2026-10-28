# Plan: drogi budowane przez graczy

Cel (właściciel, 28.10.2026): gracze budują drogi między ośrodkami infrastruktury (wioski, placówki, magazyny, porty) i prowadzą nimi konwoje. Droga ma być inwestycją: trzeba ją poprowadzić przez teren, zaopatrzyć budowę i potem utrzymać.

Drogi z ziarna świata (`gen/roads.ts`, między wioskami) zostają bez zmian. Drogi graczy to osobna, wspólna warstwa: `Char.proads` (id → `PlayerRoad`, `gen/playerroads.ts`), pole `proads` we wspólnym stanie i w `FIELDS` serwera, blokada `wlock` na 'proads'.

## Etapy

- **D1. Tyczenie trasy i dukt.** *(Zrobione w 0.280.0.)*
  - Tyczki geodety (`roadkit`, narzędzie, nie zużywa się; zamówienie u kowala: 3 deski + lina, Oskar 40 zł).
  - Tyczenie: start przy punkcie infrastruktury (brama wioski, placówka, magazyn, port, droga z ziarna, inna droga gracza). Klik stawia tyczkę (odcinek 6–70 m), R: mierniczy wytyczają przebieg do miejsca, na które patrzysz, albo do punktu z mapy (A* po siatce 12 m, grubszej dla dłuższych tras, potem prostowanie odcinków). Prawy przycisk cofa tyczkę, Esc przerywa. Hologram pokazuje krawędzie drogi, tyczki i błędny odcinek na czerwono.
  - Teren: nachylenie najwyżej 20%, bez wody (morze, rzeki, jeziora), bez wnętrza wiosek, miejsc (ruiny, obozy, wraki), martwych miast, dawnych kamieni i lodu; do 8 km, do 240 tyczek, końce co najmniej 60 m od siebie, najwyżej 2 niezbudowane drogi na gracza.
  - Budowa: przy tablicy na każdym końcu oddaje się kamień (1 na 16 m) i deski (1 na 22 m) z plecaka albo pojazdów oraz zapłatę kopaczom (0,35 zł na metr). Gdy wszystko jest, kopacze pracują 2 h + 6 h na km czasu gry; ich obóz z trzema postaciami przesuwa się z czołem robót, za nim widać wyrównaną ziemię. Doświadczenie 0,15 xp na metr przy starcie robót. Kto wytyczył, może zwinąć budowę przed startem (materiały i zapłata wracają).
  - Gotowa droga: teren wyrównany w poprzek (`Terrain.setWays`, `Features.ways`, wysokość jak drogi z ziarna, sucho nad bagnami), drzewa, kamienie i rośliny usunięte w działającej grze (nie w generatorze, więc klucze ściętych drzew się nie przesuwają), ziemisty pas na ziemi, tablice z nazwą na końcach, linia na mapach.
  - Gra wieloosobowa: wspólny stan `proads`, oddawanie pod blokadą drogi; postęp i koniec z zegara gry, więc każda gra zmienia teren w tej samej chwili. Serwer wymaga aktualizacji (nowe pole i blokada); protokół bez zmian.
- **D2. Czoło drogi i ekipy.** *(Zrobione w 0.281.0; drogi wytyczone przed 0.281 zostają na zasadach D1.)*
  - Ekipa: przy tyczeniu gra wybiera dom ekipy, najbliższą wioskę albo placówkę z ludźmi w promieniu 2,5 km od któregoś końca (najpierw taką, która ma teraz wolne ręce). Robota zawsze idzie od końca bliższego domowi (trasa jest wtedy odwracana). Bez domu w zasięgu drogi nie da się wytyczyć.
  - Ilu kopaczy: przy starcie robót tylu, ile dom ma wolnych rąk, najwyżej 8, co najmniej 2. Osada (nowy świat) daje ludzi bez przydziału (`assign(...).free`), stara wioska najmuje zawsze 8, placówka daje bezczynnych osadników. Gdy nikt nie jest wolny, materiały zostają, a robota czeka.
  - Tempo: 0,45 m na minutę gry na kopacza (4 kopaczy ≈ 108 m/h), 90 minut na rozbicie obozu przed startem.
  - Dowóz na czoło: materiały i zapłatę można oddawać po trochu przy tablicy na końcu albo przy obozie kopaczy na czole robót (plecak albo pojazd zaparkowany obok). Robota rusza, gdy dostawy wystarczą na pierwsze 120 m. Czoło idzie tylko tak daleko, jak wystarczą materiały i zapłata (najmniejszy udział z nich). Potem kopacze stoją z napisem CZEKAJĄ NA DOSTAWY.
  - Obóz drogowy (16 desek, 12 gwoździ, 4 liny, 2 skóry): bez niego kopacze odchodzą najwyżej 2,2 km od domu. Potrzebny tylko na dłuższych drogach. Rysowany jako barak przy namiocie na czole.
  - Równiarka parowa (2 części silnika, 2 skrzynie kół zębatych, 2 sztaby stali, z Zakładów Ciężkiej Inżynierii): czoło idzie 1,8 razy szybciej.
  - Bagna: każde 4 m podmokłego gruntu na trasie kosztuje 1 kamień więcej (podsypka).
  - Wyrąb: drzewa stojące na trasie dają bale (2 z drzewa, 6 z wielkiego), układane przy tablicy początku w miarę postępu. Bierze je ktokolwiek, a to, co się nie mieści, ląduje u stóp.
  - Rzeki: droga przechodzi tylko po zbudowanym moście (przy brodzie albo postawionym z zestawu mostowego). Najpierw most, potem tyczenie przez niego.
  - Mierniczy: zaproponowana trasa jest sprawdzana w całości; gdy któryś odcinek mimo wszystko wychodzi za stromy, szukają ponownie ostrożniej (poprawka błędu D1).
  - Zapis i gra wieloosobowa: czoło to jedna kotwica `fr` [metry, minuta gry] przestawiana przy każdym oddaniu (pod blokadą drogi). Miejsce czoła i chwila końca wynikają z zegara, więc wszystkie gry widzą to samo. Ekipa jest liczona raz, przy starcie (ludzie w domu się przez to nie zmieniają).

- **D3. Nawierzchnie i jazda.** Do zrobienia:
  - Klasy drogi: dukt (D1/D2), żwirówka, droga utwardzona. Ulepszenie to kolejna robota na tej samej drodze, z czołem jak w D2: żwirówka za kamień i piasek, utwardzona za cement i kamień łamany (później asfalt z rafinerii). Zapis `PlayerRoad.cls` i osobna kotwica czoła ulepszenia.
  - Wygląd: dukt ziemisty, żwirówka jaśniejsza z obrzeżem, utwardzona z krawężnikiem i linią środkową; mapy rysują klasy różnie.
  - Jazda: pojazd na drodze (gracza albo z ziarna) jedzie szybciej, pali mniej i mniej niszczy koła. Poza drogą wolniej i drożej. Potrzebne `onWay(x, z)` w `world/vehicles.ts` (szybki indeks odcinków po kratkach), mnożniki w `VehicleSpec` i `fuelBurn`.
  - Teren: utwardzona droga dostaje szerszy, gładszy profil (mniej nierówności) i mostki przepustowe na małych ciekach.
  - Gra wieloosobowa: nowe pola w `proads`, bez zmian serwera poza tym, co już jest.

- **D4. Konwoje po sieci dróg.** Do zrobienia:
  - Graf sieci: węzły to bramy, magazyny, placówki i skrzyżowania. Krawędzie to drogi z ziarna (`network`) i gotowe drogi graczy. Łączenie na wspólnych końcach i punktach przyłączenia (`RoadEnd` kind road/track).
  - Planowanie trasy (Dijkstra jak `planRoute`) z kosztem: długość ÷ prędkość klasy drogi; przełaj z karą.
  - Linie konwojów między magazynami (`gen/hublines.ts`) i trasy placówek (`gen/routes.ts`) liczą czas i paliwo z trasy po sieci, a nie z linii prostej. Ciężarówki rysowane jadą po drodze.
  - Okno linii pokazuje trasę i jej klasę. Bez połączenia drogą konwój jedzie przełajem (wolniej, więcej paliwa, większe ryzyko).
  - Zgodność: istniejące linie przechodzą na nowe liczenie od następnego kursu (kotwice kursów zostają).

- **D5. Zagrożenia i utrzymanie.** Do zrobienia:
  - Zasadzki i rajdy na drogach graczy (dziś tylko na drogach z ziarna): `tryAmbush` bierze też drogi graczy. Ryzyko konwoju z D4 rośnie z groźnością terenu na trasie.
  - Strażnice przy drodze (budowa przy drodze, obsada 2 i prąd jak wieżyczki Z7): zmniejszają ryzyko na odcinku w zasięgu.
  - Zużycie: ruch konwojów i deszcz obniżają stan drogi (closed form z liczby kursów i pogody). Zniszczony odcinek jest wolniejszy.
  - Dom drogowy z ekipą łatających (obsada z najbliższej wioski) albo naprawa ręczna materiałami.

- **D6. Zajazdy i skrzyżowania.** Do zrobienia:
  - Budynki przy drodze stawiane z zestawu: stacja paliw (jak dystrybutor osady, zasilana z magazynu), zajazd (nocleg, zapis gry, jedzenie), mały targ.
  - Skrzyżowania: nazwane węzły sieci, drogowskazy z odległościami.
  - Karawany wiosek (`gen/caravans.ts`) wybierają drogi graczy, gdy są krótsze, i kupują paliwo na stacjach.

- **D7. Rywale.** Do zrobienia (tylko w trybie rywali O8):
  - Właściciel drogi (kto wytyczył, wspólnicy jak przy placówkach).
  - Szlaban i myto: przejazd cudzym konwojem kosztuje złoto (do kasy właściciela, rozliczane przy kursie).
  - Drogi wspólne (co-op) zostają otwarte dla wszystkich.

## Co jeszcze potrzeba, żeby drogi i konwoje działały jak należy
1. **Jazda po drogach (D3)**: dziś droga tylko wygładza teren, pojazd nie jedzie po niej szybciej. Bez tego drogi dla gracza za kierownicą niewiele dają.
2. **Sieć zamiast linii prostych (D4)**: linie konwojów i trasy placówek liczą czas i ryzyko z odległości w linii prostej, więc drogi jeszcze ich nie skracają ani nie zabezpieczają.
3. **Ryzyko na trasie (D5)**: rabunek konwojów zależy od groźności w połowie drogi, a nie od tego, czy jadą drogą i czy jest strzeżona.
4. **Utrzymanie (D5)**: drogi są wieczne. Zużycie da powód do domów drogowych i ekip.
5. **Wątek szukający miejsc dawnych zakładów** (`installworker.ts`) liczy teren bez dróg graczy (różnica znikoma, do dorobienia przy D3).

## Nie zsynchronizowane / ograniczenia
- Ekipa D2 jest liczona przy starcie robót; ludzie w domu nie mają jeszcze stanowiska „przy drodze” (`postsOf`), więc ich liczba nie spada w trakcie budowy.
- Osobny wątek, który szuka miejsc dawnych zakładów (`installworker.ts`), liczy teren bez dróg graczy (drogi idą po naturalnym gruncie, różnica znikoma).
- Zasadzki bandytów i konwoje jeszcze nie korzystają z dróg graczy (D4, D5).
- Nazwy dróg zapisuje gra, która je wytyczyła, w swoim języku.
