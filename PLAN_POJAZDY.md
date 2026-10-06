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

### B. Komputer w rękawicy (do zrobienia)
- Każdy rozbitek ma rękawicę z komputerem. Mapa satelitarna (M) istnieje od początku jako funkcja urządzenia, ale w nowym świecie pokazuje „NO SATELLITE LINK”, dopóki stacja nie działa.
- Minimapa: tylko lokalne czujniki rękawicy (najbliższe otoczenie, bez odkrytych kafelków świata). Do decyzji właściciela, czy blokować także minimapę.
- **MP:** odblokowanie zależy od wspólnego stanu stacji, więc obejmuje wszystkich graczy w świecie naraz.

### C. Stacja radarowo-komunikacyjna jako duży projekt (do zrobienia)
- Zrujnowana stacja kilka km od Gridholm (ruina w odległości ok. 2–5 km). Gracz słyszy o niej w osadzie.
- Odbudowa w kilku etapach: oczyszczenie (drewno, kamień, złom), zasilanie i okablowanie (drut, części elektroniczne, części maszynowe), antena i konsola (rdzenie mocy, części elektroniczne, przekładnie z salvage). Wymusza eksplorację i zbieranie salvage, nie jedno kliknięcie.
- **Nagroda:** łączność z satelitami, odblokowana mapa w rękawicy, tablet GPS, przegląd okolicy (odkrycie miejsc w promieniu kilku km), podstawa późniejszej nawigacji.
- **Kolejność w samouczku** zgodnie z dokumentem: żywność i mały magazyn → wzrost populacji → mechanik → części → pierwszy samochód → stacja → mapa. Dziś „Satellite link” jest po pierwszej farmie i blokuje magazyn. Do decyzji właściciela, czy przenieść go za samochód, a w innych osadach zostawić mały odbiornik.
- **MP:** stan stacji we wspólnym stanie wioski; protokół bez zmian.

### D. Nawigacja i infrastruktura planetarna (później)
- GPS, nawigacja, kolejne systemy oparte na satelitach (dokument mówi o nich jako o podstawie na przyszłość).
