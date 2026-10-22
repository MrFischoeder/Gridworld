# Plan: sieć magazynów

Na podstawie opisu właściciela z 22.10.2026. Etapy po kolei, każdy jako osobna wersja.

## Założenia (decyzje)

- **Obszar magazynu to heks, nie okrąg.** Planeta jest podzielona stałą siatką heksów: 120 w poprzek obwodu, więc heksy domykają się na szwie planety. Heks ma około kilometra od boku do boku (~0,87 km²). Siatka jest stała i ta sama dla wszystkich, więc magazyny układają się w sieć, która się nie nakłada.
- **Jeden magazyn na heks.** Magazyn obsługuje heks, w którym stoi. Drugiego w tym samym heksie nie da się postawić; dotyczy to magazynów wiosek, magazynów portowych i magazynów w dziczy. Magazyny, które stały już przed 0.249, zostają; zasada obowiązuje nowe budowy.
- **Rodzaje magazynów:**
  - **wioski:** hala starej wioski albo magazyn wytyczony przez gracza w osadzie;
  - **portu:** przy doku;
  - **w dziczy** (nowy): stawia się go z Planów magazynu (`whkit`), np. przy kopalni czy kamieniołomie.
- **Wszystko potrzebuje prądu i ludzi** (zasada z `PLAN_PRAD_I_LUDZIE.md`). Magazyn w dziczy działa jak port: własne źródło prądu, baraki, pola i osadnicy. Jego magazynierzy (4 osoby i prąd) przyjmują towar.
- **Urobek trafia do magazynu sam.** Co dwie godziny tragarze zanoszą skrzynie z placówek przy złożach w heksie do magazynu tego heksu, o ile magazyn działa. Wioska swój towar ma już we własnej hali.
- **Nazwy.** Każdy magazyn ma nazwę, którą gracze mogą zmienić: przy terminalu magazynu w wiosce albo przy tablicy magazynu w dziczy lub w porcie.
- **Multiplayer.** Wszystko jest w już wspólnych `towns` i `outposts`:
  - dwa liczniki narastające, każdy pisany tylko przez swoją stronę: placówka liczy, co zabrali tragarze; magazyn liczy, co przyjął (pod swoją blokadą);
  - stary zapis może opóźnić dostawę, ale nigdy jej nie podwaja;
  - protokół i serwer bez zmian.

## Etapy

- **M1 (0.249): heksy, magazyny w dziczy, nazwy, urobek do magazynu, lista w sieci.**
  - `gen/warehouses.ts`: siatka heksów, lista magazynów, zasada jednego magazynu na heks, przekazanie urobku, przyjmowanie.
  - Plany magazynu: wytyczanie z hologramem heksu. Magazyn w dziczy rysuje się i działa jak port bez dźwigu.
  - Zmiana nazwy.
  - Zakładka MAGAZYNY w komputerze wioski: wszystkie magazyny, gdzie stoją, co obsługują i czy działają; bez stanów.
  - Heksy magazynów na mapach.
- **M2 (0.250): tragarze i więcej miejsca.**
  - Widoczni tragarze: rolnik z workami zboża z pól do magazynu, ludzie ze skrzyniami urobku z kopalni, toczone beczki ropy.
  - Magazyn przechowuje więcej, gdy dostanie skrzynie i beczki (data/cargo.ts) na regały: każda podnosi pojemność.
- **M3 (0.251): łączność między magazynami.** Przy okazji (decyzja właściciela): skrzynie i beczki nie są budowane, pojawiają się same, gdy w kieszeniach jest za dużo materiału (np. 11 kamieni), i znikają po opróżnieniu; jedna skrzynia i jedna beczka. Później: większe skrzynie z materiałów.
  - Ulepszenie: maszt radiowy przy magazynie.
  - Magazyny połączone radiem pokazują w komputerze swoje stany.
- **M4 (0.252): konwoje między magazynami.** Na razie ciężarówka jedzie prosto między magazynami (jak trasy placówek), łączność sprawdzana przy każdym kursie, wozi tylko to, co złożono w magazynie (nie własne towary wsi).
  - Ciężarówka przypisana do trasy magazyn → magazyn, z wyborem towarów.
  - Jeździ sama, po drogach, z paliwem albo prądem, z ryzykiem napadu (jak trasy placówek, `gen/routes.ts`).
  - Wymaga łączności z M3.
- **M5: porty jako węzły sieci.**
  - Linie statków (`gen/shiplines.ts`) jako transport między magazynami portowymi, także między kontynentami.
  - Łączenie z konwojami lądowymi: towar przechodzi przez port.
- **M6: maszyny latające** obsługujące magazyny bez dróg (gdy powstaną pojazdy latające).

## Otwarte sprawy

- Czy hala starej wioski i magazyn portowy w tym samym heksie mają się wykluczać? Na razie tak: nowy port w heksie wioski jest odrzucany.
- Czy magazyn w dziczy ma przyjmować także towar wioski leżącej w jego heksie (wioska bez własnego magazynu)? Na razie nie: wioski trzymają się w odległości 260 m od magazynu w dziczy.
