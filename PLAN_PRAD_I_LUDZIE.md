# Plan: wszystko potrzebuje prądu i ludzi

Ustalenie z właścicielem gry (14 października 2026, po wersji 0.214.0). Zasada obowiązuje w **nowych światach** (osady, placówki, miasta). Stare światy z dawnymi wioskami zostają przy swoich zasadach, tak jak przy wprowadzaniu osad i placówek.

## Zasada

- **Każdy budynek, który coś robi, potrzebuje prądu i ludzi.** Magazyn, dystrybutor, baza konwojów, port, przetwórnia, stara fabryka: każdy ma swój pobór prądu (kW) i swoją obsadę (ludzi do pracy).
- **Bez prądu albo bez ludzi budynek stoi albo pracuje słabiej.** Zasady działania są te same co w zakładach osady: zakład bez pełnej obsady nie rusza, wydobycie bez prądu daje połowę.
- **Prąd i ludzie są lokalni.** Budynek przy wiosce bierze prąd z sieci wioski i ludzi spośród jej mieszkańców. Budynek daleko od wioski (np. magazyn w porcie na wybrzeżu) nie ma ani jednego, ani drugiego. Trzeba przy nim postawić źródło prądu, domy (baraki) i farmy, żeby ludzie mieli gdzie mieszkać i co jeść.
- **Z takiego miejsca z czasem robi się osada.** To już działa przy placówkach (przysiółek: 2 baraki, 2 pola, prąd, 16 ludzi). Port, kopalnia czy stara fabryka rozwijają się tak samo.
- Ludzi się nie werbuje. Przychodzą sami, gdy są wolne łóżka i nadwyżka jedzenia, a odchodzą, gdy jest głód. Tak jak dziś w osadach i placówkach.

## Co dziś działa bez prądu albo bez ludzi (przegląd kodu)

- **W osadzie:** dystrybutor paliwa (ani prądu, ani ludzi), stacja ładowania (prąd jest, obsady brak), baza konwojów (ani jednego, ani drugiego), magazyn i hala wioski (ani jednego, ani drugiego), odbiornik satelitarny i maszt przekaźnikowy.
- **Placówki przy złożach:** już spełniają zasadę (sieć O3, ludzie O4). Wyjątkiem jest szopa magazynowa, która działa bez obsady.
- **Doki (pomosty):** działają bez prądu i bez ludzi. Statki pływają tylko z graczem przy sterze, nie ma rejsów towarowych.
- **Stare fabryki (instalacje):** mają własną halę zasilania, ale nie mają ludzi. Produkują same, gdy dostarczy się wsad.
- **Działka na murach, latarnie morskie:** bez prądu i bez obsady.
- **Sieć:** wioski nie są podłączone do sieci placówek. Prąd z placówki nie zasila osady ani odwrotnie.

## Etapy

- **Z1. Wspólny model „prąd + ludzie” w osadzie.** Każdy budynek osady dostaje pobór prądu i obsadę w tych samych tabelach, które już mają zakłady (`JOBS`, `siteKw`):
  - dystrybutor: 2 kW i 1 osoba;
  - stacja ładowania: 1 osoba;
  - baza konwojów: 6 kW i 4 osoby (kierowcy i mechanik); bez obsady konwoje osady nie wyjeżdżają;
  - magazyn: 3 kW i 2 osoby (oświetlenie, magazynierzy); bez nich terminal rozładowuje wolniej.

  Panel starszego i terminal pokazują, czego brakuje („brak prądu”, „brak rąk do pracy”).
- **Z2. Port.** Na gotowym doku można zbudować **magazyn portowy** (plac, szopa, dźwig). Port działa jak placówka: wybierasz mu źródło prądu (generator, wiatrak, panele, elektrownia węglowa z sieci placówek), stawiasz baraki i pola, a mieszkańcy przychodzą sami. Magazyn portowy bez prądu i ludzi stoi.
- **Z3. Rejsy towarowe.** Statek (żaglowiec albo motorowiec) przydzielony do trasy między dwoma portami pływa sam według rozkładu, jak ciężarówka na trasach placówek (O6). Przewozi skrzynie z magazynu do magazynu i spala paliwo (motorowiec) albo płynie z wiatrem (żaglowiec). Rejs rusza tylko wtedy, gdy oba porty mają prąd i ludzi. Później dojdą napady piratów.
- **Z4. Ludzie w starych fabrykach.** Każda odbudowana instalacja potrzebuje obsady, np. 6–10 osób. Leży daleko od wiosek, więc trzeba przy niej postawić baraki i pola (tak jak przy placówce) albo dowozić ludzi i jedzenie trasą.
- **Z5. Linie przesyłowe.** Słupy z kablem łączą sieć wioski z siecią placówek i portów. Nadwyżka prądu z jednego miejsca zasila drugie, z ograniczeniem przepustowości linii.
- **Z6. Dojeżdżający ludzie.** Miejsce blisko wioski (do ok. 1–2 km drogą) może brać wolnych mieszkańców wioski, bez budowy własnych domów. Dalej trzeba już budować własną osadę.
- **Z7. Obrona i drobne budynki.** Działka na murach i latarnie morskie elektryczne biorą prąd z sieci, a strażnicy przy działkach to obsada. Bez prądu działko nie strzela.

## Gra wieloosobowa (dla każdego etapu)

- Wszystko liczy się ze wspólnego stanu (`towns`, `outposts`, a dla portów i rejsów też wspólnego pola `ports`). Każda gra wylicza to samo, deterministycznie, tak jak dziś sieć placówek.
- Budowy i przekazywanie materiałów idą pod blokadą wioski lub placówki (`withTownStock`, `withOutpost`), więc dwóch graczy nie zbuduje tego samego naraz.
- Rejsy (Z3) liczą się z rozkładu, jak trasy ciężarówek: dwa liczniki skumulowane, każdy zapisywany przez jedną stronę, więc opóźniony zapis nie dubluje dostawy.
- **Serwer:** Z2 i Z3 dodają nowe wspólne pole (`ports`) do `SHARED` i do `FIELDS` serwera. Serwer trzeba będzie zaktualizować (zapis w `SERWER.md` i changelogu). Protokół nie musi się zmieniać.

## Pytania do właściciela przed startem

1. **Brak prądu albo ludzi: stop czy wolniej?** Proponuję: zakłady, które coś produkują, stoją; magazyny i dystrybutory działają wolniej albo tylko „ręcznie” (gracz sam rozładowuje).
2. **Granica „za daleko od wioski”:** proponuję 600 m od muru. Bliżej działa sieć i ludzie wioski, dalej potrzebna jest własna osada.
3. **Od czego zacząć:** proponuję kolejność Z1 → Z2 → Z3 (port i rejsy), potem Z4–Z7.
