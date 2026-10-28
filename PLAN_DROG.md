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
- **D2. Czoło drogi i ekipy.** Ekipę daje wioska albo placówka (reguła „prąd i ludzie”); daleko od domu obóz drogowy z barakami; dowóz materiałów na czoło (gracz albo konwój zbudowanym odcinkiem); wyrąb lasu na trasie (bale); mosty na trasie (mosty z zestawu albo przy brodach); podsypka na bagnach; maszyny z Ciężkich Zakładów przyspieszają.
- **D3. Nawierzchnie i jazda.** Dukt, droga żwirowa (kamień, piasek), utwardzona (cement, asfalt); prędkość, spalanie i zużycie pojazdów według klasy drogi.
- **D4. Konwoje po sieci dróg.** Linie między magazynami i trasy placówek jadą po drogach (graczy i z ziarna), czas i ryzyko z długości i nawierzchni; bez drogi przełajem, wolniej i drożej.
- **D5. Zagrożenia i utrzymanie.** Zasadzki na drogach graczy, strażnice z obsadą i prądem, zużycie (ruch, deszcz), dom drogowy z ekipą.
- **D6. Zajazdy i skrzyżowania.** Stacja paliw, nocleg, mały rynek; karawany wiosek korzystają z dróg graczy.
- **D7. Rywale.** Własność drogi, szlaban, myto, wspólnicy.

## Nie zsynchronizowane / ograniczenia D1
- Drogi graczy nie przecinają jeszcze rzek (D2).
- Osobny wątek, który szuka miejsc dawnych zakładów (`installworker.ts`), liczy teren bez dróg graczy (drogi idą po naturalnym gruncie, różnica znikoma).
- Zasadzki bandytów i konwoje jeszcze nie korzystają z dróg graczy (D4, D5).
- Nazwy dróg zapisuje gra, która je wytyczyła, w swoim języku.
