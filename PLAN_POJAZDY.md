# Plan: eksploracja, mechanik, pojazdy i satelity

Plan wdrożenia dokumentu właściciela „GridWorld 04 — Eksploracja, mechanik, pojazdy i infrastruktura satelitarna v0.3D”. Dotyczy przede wszystkim nowych światów (osady `progressive`). Stare zapisy zachowują dawne zasady (Kuba sprzedaje pojazdy za złoto). Każdy etap jest rozpisany pod kątem gry wieloosobowej (zasada projektu z `CLAUDE.md`).

## Co z dokumentu już było (stan na 0.147)

- **Pojazdy:** RTV-1 Scout i HTV-6 Mastodon u Kuby na placu przed północną bramą Gridholm, porzucone pojazdy w terenie (do przejęcia), części, serwis, zestawy naprawcze (Kuba sprzedaje, kowal robi z planami Engines).
- **Zlecenia czasowe u kowala** (0.142): materiały z hali wioski, praca w godzinach gry, odbiór później (`char.forge`).
- **Stacja łączności:** projekt osady „Satellite link” przy najbliższej ruinie (do 2,2 km), tani (6 kłód, 6 kamieni, 4 złom), po pierwszej farmie. Daje tablet GPS.
- **Mapa:** M (mapa świata) i minimapa działają od początku. Tablet GPS dodaje współrzędne i punkt nawigacyjny.
- **Stara Stacja Radarowa:** wielka instalacja daleko (powyżej 18 km), odkrywa mapę w promieniu 12–20 km.

## Etapy

### A. Mechanik i pierwszy samochód (0.148, zrobione)
- **Mechanik:** Kuba (teraz „Mechanic”) pojawia się w osadzie wcześniej: od poziomu rozwoju 2 (dwie farmy albo farma i magazyn), wcześniej od 3.
- **Warsztat** (opcja „Build me something in your workshop.”, `data/garage.ts`, `ui/garage.ts`):
  - RTV-1 Scout z salvage: 24 złomu, 4 części maszynowe, 4 przekładnie, 2 części silnika, 3 części elektroniczne; 8 h gry;
  - HTV-6 Mastodon: 40 złomu, 8 części, 6 przekładni, 4 części silnika, 5 części elektronicznych, 6 stali; 14 h;
  - 2 zestawy naprawcze (Vehicle Repair Kits): 4 złomu, 1 część maszynowa, 1 część elektroniczna; 2 h.
- **Zlecenia czasowe:** materiały z hali wioski przy zamówieniu, odbiór po czasie (`char.garage`, najwyżej 2 naraz). Pojazd staje na placu, zestawy trafiają do plecaka. Powiadomienie, gdy praca jest gotowa.
- **Wczesne części tylko z salvage:** w nowych światach Kuba nie sprzedaje nowych pojazdów ani części silnika za złoto (opony, poszycie, działko itd. zostają). Części maszynowe dochodzą do łupów: roboty (Guardian, Sentinel, Assault), skrzynie w ruinach i wrakach, bagażniki porzuconych pojazdów (też przekładnie i części silnika).
- **Później:** te same części z produkcji (Machine Shop: części, przekładnie; silniki z Electrical Works) zgodnie z drzewem technologii.
- **MP:** zlecenia są osobiste (`char.garage`), jak u kowala. Materiały idą ze wspólnej hali wioski (`towns`). Złożony pojazd należy do zamawiającego; inni widzą go jak każdy pojazd gracza. Protokół bez zmian.

### B. Komputer w rękawicy (0.149, zrobione)
- Mapa satelitarna (M) w nowym świecie pokazuje ekran rękawicy „NO SATELLITE LINK”, dopóki stacja przy Gridholm nie działa.
- Minimapa działa jak dotąd (decyzja właściciela).
- **MP:** blokada liczy się ze wspólnego stanu stacji (`towns`), więc mapa odblokowuje się wszystkim graczom w świecie naraz.

### C. Stacja radarowo-komunikacyjna jako duży projekt (0.149, zrobione)
- W nowym świecie łącze satelitarne Gridholm to duża stacja w ruinie 2–6 km od wioski (`STATION_RANGE`, `linkRuin`). Inne osady zachowują mały odbiornik w najbliższej ruinie.
- Trzy etapy (`STATION_STAGES`), materiały z hali wioski oddawane przy konsoli stacji:
  1. oczyszczenie: 20 kłód, 20 kamieni, 16 złomu;
  2. zasilanie i okablowanie: 20 złomu, 16 drutu, 6 części elektronicznych, 3 części maszynowe, 1 część silnika;
  3. antena i konsola: 10 części elektronicznych, 2 rdzenie mocy, 4 przekładnie, 4 części maszynowe, 10 złomu.
- **Kolejność (decyzja właściciela: stacja za samochodem):** zapasy → farma 1 → farma 2 (mechanik otwiera plac) → pierwszy pojazd (zbudowany u Kuby albo przejęty w terenie; flaga `car` we wspólnym stanie wioski) → stacja → magazyn i dalej jak dotąd. Druga farma nie czeka już na łącze w Gridholm.
- **Nagroda:** odblokowana mapa w rękawicy, tablet GPS, przegląd okolicy (wszystkie miejsca w promieniu 5 km trafiają na mapę), nagroda za każdy etap.
- **Wygląd:** maszt leżący w gruzach i zasypany bunkier → bunkier zamurowany, kikut masztu → szopa z generatorem i kable → maszt z anteną i światłami.
- **Stare zapisy:** łącze już zbudowane zostaje zbudowane; niezbudowane w Gridholm staje się stacją (oddane materiały na mały odbiornik przepadają).
- **MP:** etapy, oddane materiały i flaga pojazdu są we wspólnym stanie Gridholm; każdy widzi ten sam etap (przebudowa ruiny przy zmianie, `townLook` uwzględnia etap). Protokół bez zmian.

### D. Nawigacja i infrastruktura planetarna (D1 w 0.150 zrobione)
Dokument opisuje ten etap ogólnie („podstawa późniejszych systemów GPS, nawigacji i infrastruktury planetarnej”), więc rozpisuję go na kroki.

**D1. Rękawica jako GPS, skany orbitalne, pogoda z orbity (0.150, zrobione)**
- Gdy łącze satelitarne działa, rękawica jest GPS-em: współrzędne, wysokość, kurs, pasek kompasu i punkt nawigacyjny (prawy klik na mapie) bez tabletu. W starych światach robi to nadal tablet.
- Skan orbitalny: klawisz O na mapie satelitarnej. Satelita patrzy w promieniu 3 km wokół punktu nawigacyjnego (albo wokół gracza): wszystkie miejsca, stare instalacje i strefy toksycznej mgły trafiają na mapę. Satelita przelatuje co 6 h gry; jeden skan na przelot dla całego świata.
- Pogoda z orbity: mapa pokazuje pogodę teraz i za 4 h w miejscu gracza.
- **MP:** czas ostatniego skanu jest we wspólnym stanie Gridholm (`scanAt`), więc przelot zużywa jeden gracz dla wszystkich. Odkryte miejsca trafiają na mapę skanującego. Nie synchronizowane: wyniki skanu na mapach innych graczy. Protokół bez zmian.

**D2. Maszty przekaźnikowe w osadach (0.151, zrobione)**
- Projekt „Relay mast” przy konsoli odbiornika osady (nie w Gridholm: tam stacja sama jest przekaźnikiem), gdy odbiornik działa, a stacja Gridholm odpowiada: 12 złomu, 10 drutu, 4 części elektroniczne, 8 kłód, 2 przekładnie.
- Skan orbitalny w promieniu 4 km od osady z masztem idzie przez jej własny przelot (co 6 h, osobno od reszty świata) i sięga 4,5 km zamiast 3. Sieć łączności rośnie razem z siecią osad.
- Wygląd: maszt kratowy z odciągami, talerzem i światłami nad odbiornikiem.
- **MP:** maszt i czas jego przelotu (`scanAt`) we wspólnym stanie tej osady; protokół bez zmian.

**D3. Planowanie tras (0.151, zrobione)**
- R na mapie satelitarnej: trasa drogami od osady najbliższej graczowi do osady najbliższej punktowi nawigacyjnemu (najkrótsza po sieci dróg, `planRoute` w `gen/roads.ts`); ponownie R czyści trasę.
- Trasa rysuje się przerywaną linią na mapie i minimapie, a pasek kompasu prowadzi znacznikiem „Route” ok. 120 m przed graczem wzdłuż trasy; po dojściu na koniec trasa znika.
- Wymaga GPS (łącze satelitarne albo tablet).
- **MP:** trasa jest tylko u gracza, który ją wyznaczył (nie zapisuje się, nie synchronizuje).

**Poprawka przy okazji:** mapa liczyła wszystkie nowe kafelki w jednej klatce; po dużym skanie albo przeglądzie radaru oddalenie mapy potrafiło zawiesić grę. Teraz najbliższe kafelki są najpierw, a nowych powstaje najwyżej kilka na klatkę.
