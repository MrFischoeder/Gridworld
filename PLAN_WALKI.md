# Plan: taktyczna walka (W1–W8)

Prośba właściciela (15 października 2026): walka ma być bardziej taktyczna. Nie chodzi w niej o to, żeby podejść i wypruć w przeciwnika jak najdłuższą serię. Każdy przeciwnik ma mieć własny sposób ataku, mocne strony i słabości. Gracz ma mieć do dyspozycji różne taktyki: skradanie, uniki, okrążanie, ucieczkę, zasłony i przynęty. Opis wszystkich przeciwników jest w księdze gry (`OPIS_GRY.md`, rozdział 6).

## Zasady

1. **Każdy przeciwnik ma odpowiedź.** Każdy ma słabe miejsce, z którego dostaje więcej (bok, tył, głowa, nogi), oraz takie, które trafienia odbija. Ma też broń, na którą jest bardziej podatny: palną albo białą. Nikt nie jest nieśmiertelny. Najsłabszy mnożnik w tabeli to 0,4.
2. **Ostrzeżenie przed ciosem.** Każdy duży atak ma widoczną albo słyszalną zapowiedź, żeby gracz mógł się uchylić (od W2).
3. **Ruch daje przewagę.** Unik, zasłona i zajście od tyłu dają więcej niż stanie w miejscu z palcem na spuście.
4. **Gracz dostaje informację zwrotną.** Krótki komunikat mówi, że trafienie było mocniejsze albo słabsze i dlaczego. Gracz uczy się w ten sposób przeciwnika.
5. **Gra wieloosobowa.** Mnożniki liczy gra strzelającego i wysyła je ze zwykłym trafieniem (`fhit`). Właściciel przeciwnika dostaje sam wynik, więc protokół się nie zmienia. Każdy nowy atak przeciwnika (od W2) prowadzi gra jego właściciela, a pozostali widzą kopię, jak dotąd. Zapowiedzi trzeba będzie przesyłać jako stan kopii (`state`).

## Etapy

- **W1. Słabe i mocne strony, unik.** *(Zrobione w 0.223.0.)*
  - Tabela `gen/tactics.ts` `TACTICS` ma osobny wpis dla każdego stworzenia, robota, roli bandyty i drona. Zapisuje w niej:
    - mnożniki z przodu, z boku i z tyłu (według kierunku, w który patrzy przeciwnik);
    - słaby punkt na górze albo na dole ciała (głowa, kopuła czujnika, nogi, brzuch);
    - mnożniki dla broni palnej i białej.
  - Funkcja `hitMult` liczy wynikowy mnożnik. `world/weapons.ts` stosuje go przy każdym strzale (wysokość trafienia w kuli trafień) i przy każdym ciosie.
  - Komunikaty: „Słaby punkt! ×2”, „Od tyłu ×1.7”, „Pancerz odbija: ×0.4”.
  - Pancerz Bramble'a z przodu został przeniesiony do tej tabeli.
  - Unik: dwa szybkie stuknięcia W/A/S/D albo lewy Alt z kierunkiem. Krótki zryw 12 m/s przez 0,24 s, kosztuje 18 punktów wytrzymałości, potem 0,75 s przerwy. Nie działa w wodzie, w powietrzu ani przy przeciążeniu.
- **W2. Zapowiedzi i drugie tryby ataku.** Każdy przeciwnik dostaje drugi atak i jego zapowiedź:
  - Ravager: zwód (udaje doskok) i okrążanie; samiec alfa wyje i zbiera stado.
  - Bramble: przed szarżą grzebie ziemię. Jeśli wpadnie na przeszkodę, jest oszołomiony przez 2 s.
  - Leechwing: krzyczy przed nurkowaniem. Po chybionym ataku siedzi chwilę na ziemi.
  - Gnawer: rozbiega się i znika w trawie.
  - Scout: dwa okrążają gracza, trzeci atakuje.
  - Guardian: ogień zaporowy (seria w miejsce, gdzie gracz był) i cofanie się za zasłonę.
  - Sentinel: podnosi tarczę ramienia, kiedy strzela. Po serii się przegrzewa i wtedy przez chwilę jest słaby.
  - Artillery: przed salwą znakuje cel czerwonym promieniem.
  - Assault: podwójny zamach młotem; po chybionej szarży zostaje odsłonięty tył.
  - Repair: chowa się za ciężkimi robotami.
  - Bandyci: rzucają granaty, które wypłaszają gracza zza zasłony; jedni przyszpilają ogniem, a inni w tym czasie flankują.
- **W3. Zasłony.** Bandyci i Guardiany szukają osłony (kamień, ściana, pojazd) i strzelają zza niej. Gracz za niską zasłoną może się kucając wychylić i strzelić. Trafienia w osłonę widać po iskrach.
- **W4. Przynęty i odwracanie uwagi.** Rzucony kamień albo flara robi hałas w miejscu upadku (system hałasu już jest). Mięso zwabia drapieżniki, a hałas rozjusza Bramble'a. Odwrócony przeciwnik pokazuje tył.
- **W5. Stany.**
  - Zachwianie: mocny cios przerywa atak.
  - Powalenie: młot, sledge i szarża Bramble'a mogą przewrócić.
  - Krwawienie stworzeń.
  - Ogłuszenie maszyn przez EMP.
  - Te same stany mogą dotknąć gracza.
- **W6. Morale i odwrót.** Bandyci uciekają, kiedy zginie boss albo połowa grupy. Stworzenia pilnują swojego terytorium i odpuszczają pościg za jego granicą, więc gracz może uciec i wrócić z inną taktyką.
- **W7. Okrążanie i ciasne przejścia.** Grupy próbują otoczyć gracza z kilku stron. Gracz broni się w wąskim przejściu, tyłem do ściany albo z wysokości (pomost na murze, skała). Ataki z wysokości dają premię.
- **W8. Bestiariusz w grze.** Notatnik polowy wypełnia się sam: po pierwszym spotkaniu opis przeciwnika, po zabiciu jego słabości, po kilku zabiciach najlepsza taktyka. Jest prywatny dla każdego gracza.

## Kolejność

Proponuję W2 → W5 → W3 → W4 → W6 → W7 → W8. Zapowiedzi i stany zmieniają najwięcej przy najmniejszym koszcie. Zasłony i przynęty wymagają więcej pracy nad zachowaniem przeciwników.
