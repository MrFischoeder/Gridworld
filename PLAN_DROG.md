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

- **D3. Nawierzchnie i jazda.** *(Zrobione w 0.282.0.)*
  - Gotową drogę można ulepszyć w jej oknie: dukt → żwirówka (kamień 1 na 5 m, piasek 1 na 60 m, 0,2 zł/m) → droga utwardzona (cięty kamień 1 na 10 m, cement 1 na 20 m, kamień 1 na 8 m, 0,3 zł/m). Ulepszenie to robota jak w D2: ekipa z tego samego domu (wolne ręce w chwili startu), dostawy po trochu do tablicy albo czoła, start po pokryciu 120 m, obóz drogowy i równiarka działają tak samo; żwir układa się 1,6 razy szybciej niż kopie dukt, bruk 0,8 razy.
  - Teren dostaje nową nawierzchnię co 50 m za czołem (przerysowany jest tylko nowy odcinek). Wygląd: dukt ziemisty, żwirówka jaśniejsza, utwardzona szara z jasnymi krawężnikami i przerywaną linią środkową; mapy rysują klasy innymi kolorami, a ułożony już odcinek nowej nawierzchni na wierzchu.
  - Jazda: prędkość maksymalna i spalanie zależą od tego, po czym jadą koła: poza drogą 80% prędkości i 120% paliwa, dukt i szlak 100%, stara droga między wioskami 108% / 95%, żwirówka 112% / 92%, utwardzona 125% / 85%. HUD pojazdu pokazuje nawierzchnię.
  - Gra wieloosobowa: ulepszenie siedzi we wspólnej drodze (`PlayerRoad.cls`, `up`), oddawanie pod blokadą drogi, czoło z zegara; każda gra liczy jazdę swojego kierowcy. Serwer i protokół bez zmian.
  - Na później (z D5): zużycie nawierzchni, mostki przepustowe.
- **D4. Konwoje po sieci dróg.** *(Zrobione w 0.283.0.)*
  - Sieć (`gen/roadnet.ts`): węzły to wioski (ich magazyny), placówki, porty, dzikie magazyny i obozy ekip starych fabryk; krawędzie to drogi z ziarna między wioskami i gotowe drogi graczy. Droga gracza kończąca się na drodze z ziarna albo innej drodze gracza łączy się z nią w skrzyżowaniu, które dzieli tamtą drogę na dwie części.
  - Trasa: najszybsza drogą (Dijkstra po czasie przejazdu, lepsza nawierzchnia szybsza). Linia konwojów między magazynami i trasa placówki do wioski dają się otworzyć tylko tam, gdzie łączy je droga. Czas kursu i paliwo liczone są z trasy (długość, nawierzchnia), a ciężarówki jadą po drodze. Mapy rysują linie wzdłuż dróg.
  - Zgodność: linie i trasy otwarte przed 0.283 zostają przy linii prostej. W oknie linii jest przycisk „Poślij ją szybszą drogą”, gdy pojawi się szybsza droga (rozkład zaczyna się od nowa, kursy zaległe są rozliczone).
  - Lotnictwo po drogach (nowe światy): lądowisko dronów, maszt sterowców i wiatrakowiec można zacząć budować przy magazynie dopiero wtedy, gdy droga łączy go z zakładami (placówką, kamieniołomem, szybem, portem albo obozem starej fabryki). To, co już stoi, zostaje.
  - Jedzenie dla ekipy: 4 skrzynki jedzenia na km duktu (zboże, ziemniaki, marchew, jajka, mleko, mięso liczone w jednostkach jak w spiżarni placówek), na żwirówkę 60% tego, na bruk tyle samo co na dukt. Przynoszone po trochu, czoło idzie tylko tak daleko, jak starczy też jedzenia. Drogi wytyczone wcześniej go nie potrzebują.
  - Planowanie na mapie: z GPS na mapie satelitarnej i z tyczkami przy sobie punkt trasy przy bramie, placówce, magazynie albo drodze i T, potem przy drugim końcu i T: mierniczy wyznaczają przebieg, mapa pokazuje go z kosztem (kamień, deski, jedzenie, zapłata), trzecie T go wytycza, Backspace porzuca plan. Bez GPS tyczy się pieszo, tyczka po tyczce, a podpowiedź pokazuje koszt dotychczasowego odcinka; przy starcie tyczenia dziennik podaje koszt kilometra.
  - Gra wieloosobowa: sieć wynika z ziarna i wspólnych dróg, tak samo w każdej grze; linia i trasa trzymają swój przebieg we wspólnym stanie, więc ciężarówka jest w tym samym miejscu u wszystkich. Serwer i protokół bez zmian.

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
1. ~~Jazda po drogach (D3)~~: zrobione w 0.282 (pojazdy są szybsze i oszczędniejsze na drogach, wolniejsze poza nimi). Linie konwojów liczą to od 0.283; karawany NPC jeszcze nie (D6).
2. ~~Sieć zamiast linii prostych (D4)~~: zrobione w 0.283. Ryzyko rabunku nadal liczy groźność w połowie odległości w linii prostej (D5).
3. **Ryzyko na trasie (D5)**: rabunek konwojów zależy od groźności w połowie drogi, a nie od tego, czy jadą drogą i czy jest strzeżona.
4. **Utrzymanie (D5)**: drogi są wieczne. Zużycie da powód do domów drogowych i ekip.
5. **Wątek szukający miejsc dawnych zakładów** (`installworker.ts`) liczy teren bez dróg graczy (różnica znikoma, do dorobienia przy D3).

## Nie zsynchronizowane / ograniczenia
- Ekipa D2 jest liczona przy starcie robót; ludzie w domu nie mają jeszcze stanowiska „przy drodze” (`postsOf`), więc ich liczba nie spada w trakcie budowy.
- Osobny wątek, który szuka miejsc dawnych zakładów (`installworker.ts`), liczy teren bez dróg graczy (drogi idą po naturalnym gruncie, różnica znikoma).
- Zasadzki bandytów jeszcze nie korzystają z dróg graczy (D5); karawany NPC jeżdżą tylko drogami z ziarna (D6).
- Linie i trasy otwarte przed 0.283 jadą dalej w linii prostej, dopóki ktoś nie pośle ich szybszą drogą (trasy placówek nie mają tego przycisku: trzeba je zamknąć i otworzyć na nowo).
- Nazwy dróg zapisuje gra, która je wytyczyła, w swoim języku.
