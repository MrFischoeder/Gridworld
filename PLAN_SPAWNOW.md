# Plan spotkań w dziczy

Ustalenia z właścicielem (20 października 2026):
- bierzemy cztery rzeczy: spawn dalej i poza wzrokiem, wróg przychodzi zamiast wyrastać, ostrzeżenia zanim go zobaczysz, stałe legowiska i patrole z ziarna świata;
- wyczyszczone legowisko wraca po 6–9 dniach gry;
- **zmiana z 20 października (po L2): legowisk na razie nie robimy** (za bardzo stałe, łatwo je farmić); patrole tak, ale losowe, nie na tej samej ścieżce (zob. L3 niżej);
- zmiana obejmuje wszystkie światy (także te już grane).

## Jak jest dziś (0.234)

- Stwory pojawiają się 60–85 m od gracza (roboty 65–95 m), przed nim albo z boku, a przy strzałach wokół miejsca hałasu. Bandyci w patrolach podobnie.
- Za dnia widać na około 200 m, więc wróg często wyrasta na otwartym polu na oczach gracza.
- Znikają, gdy gracz odejdzie: stwory już od 130 m (Pijawki 220 m), roboty 150 m, bandyci 160 m (zasadzki 240 m), najeźdźcy 260 m.
- Tempo pilnuje budżet zagrożenia (`world/threat.ts`): jedno spotkanie naraz, przerwa 20–75 s zależna od niebezpieczeństwa, nic nowego w trakcie walki, zagrożenie liczone do 160 m.
- Wszystko jest chwilowe i losowe (`Math.random`), nic nie zostaje w świecie. Wyjątek to garnizony martwych miast (`gen/garrisons.ts`): stałe, z ziarna, ich stan jest wspólny i zapisywany.

## Etapy

### L1: dalej i poza wzrokiem (0.235, zrobione)

Zrobione: pierścień spawnu tuż za granicą mgły (za dnia ok. 180–290 m, w nocy ok. 130–240 m), test widoczności dla wszystkich graczy, znikanie dopiero za 350 m i po 5 s poza wzrokiem, najeźdźcy 300–420 m z tyłu, zasadzki 90–160 m przed graczem na drodze (za zakrętem lub wzniesieniem, gdy się da), budżet zagrożenia do 350 m. Żeby wrogowie z daleka w ogóle do gracza dotarli, już w L1 idą do punktu spotkania na jego drodze (20 s przed nim, najwyżej 120 m): Rozszarpywacze i Gryzacze idą tam węsząc, roboty i patrole bandytów idą tam i patrolują okolicę, Pijawki i Skrzydlaki przenoszą tam krąg lotu, Bramble pasą się, gdzie się pojawiły. L2 zastąpi to zamiarami (trop, przecięcie, czatowanie).


**Gdzie się pojawia.**
- Nowy pierścień spawnu `SPAWN`:
  - za dnia 180–300 m;
  - w nocy i we mgle bliżej: 120–200 m, bo i tak dalej nie widać.
- Odległość skalowana tym, jak daleko dziś sięga wzrok: mgła z pogody i biomu, pora dnia.

**Poza wzrokiem.**
- Kandydat na miejsce przechodzi test widoczności `hiddenFrom`. Gracz nie może go widzieć, gdy:
  - zasłania go teren (próbkowanie wysokości wzdłuż linii oko–cel);
  - zasłania go `rayWorld`: drzewa, skały, ruiny, budynki;
  - jest dalej niż obecna mgła.
- Sprawdzane na dwóch wysokościach (nogi i głowa wroga).
- Z 10–12 prób wybieramy pierwsze ukryte miejsce. Gdy żadne nie jest ukryte, spotkanie czeka na następną próbę.

**Znikanie.**
- Wróg znika dopiero ponad 350 m od każdego gracza i gdy od 5 s nikt go nie widzi. Nigdy na oczach.
- Wyjątki zostają: wrogowie z zadań, garnizony, obozy.

**Budżet zagrożenia.**
- Zagrożenie liczone do 350 m zamiast 160 m, żeby wrogowie w drodze się liczyli.
- `FIGHT_R` (45 m) bez zmian.

**Kogo dotyczy.**
- Stworzenia, roboty i patrole bandytów.
- Najeźdźcy w pojazdach pojawiają się 300–450 m z tyłu albo przed graczem na drodze, poza wzrokiem.
- Zasadzki na drogach dalej stoją przed graczem, ale za zakrętem albo wzniesieniem (ten sam test widoczności), nie na prostej.

**Morze.** Stwory morskie bez zmian (woda jest płaska, widać daleko). Tylko pierścień rośnie do 120–200 m.

**Gra wieloosobowa.**
- Spawnuje, jak dziś, gra z `spawnAuthority`.
- Miejsce musi być ukryte przed każdym graczem w tym miejscu i co najmniej 120 m od każdego (pozycje z `otherPlayers`).
- Znikanie liczy najbliższego gracza (`nearestPlayer`, już jest).
- Protokół i serwer bez zmian.

**Testy.**
- `hiddenFrom` na płaskim terenie i za wzgórzem.
- Pierścień spawnu w dzień i w nocy.
- Nic nie znika w zasięgu wzroku.

### L2: wróg przychodzi, a nie wyrasta

**Zrobione w 0.236.** Na prośbę właściciela doszły do tego zmysły każdego rodzaju wroga (`gen/senses.ts`): jak widzi (stożek przed sobą, prawie dookoła albo dookoła), czy noc i mgła go zwodzą, jak daleko słyszy strzały i kroki, czy ma węch i jak długo idzie tropem.

| Wróg | Wzrok | Ciemność i mgła | Słuch (strzały) | Kroki | Węch | Trop | Szuka po zgubieniu |
|---|---|---|---|---|---|---|---|
| Rozszarpywacz | przed sobą | trochę go mylą | ×1,2 | 10 m | 30 m | 120 s | 30 s |
| Gryzacz | prawie dookoła | połowicznie | ×1 | 8 m | 18 m | 45 s | 15 s |
| Bramble | przed sobą | mylą | ×0,5 | 6 m | 10 m | — | 6 s |
| Pijawka | dookoła (z góry) | mylą | ×1,8 | — | — | — | 12 s |
| Skrzydlak | prawie dookoła | mylą | ×0,6 | 5 m | — | — | 8 s |
| Morski Czajacz | dookoła | widzi (drgania wody) | ×0,5 | 12 m | — | — | 10 s |
| Zwiadowca | prawie dookoła (czujnik ruchu) | w dużej części widzi | ×1 | 8 m | — | — | 14 s |
| Strażnik | przed sobą | połowicznie | ×1 | 4 m | — | — | 18 s |
| Dron naprawczy | dookoła | połowicznie | ×0,6 | 4 m | — | — | 10 s |
| Wartownik | przed sobą, termowizja | widzi | ×0,8 | 4 m | — | — | 20 s |
| Artyleria | przed sobą | prawie widzi | ×1,3 | 4 m | — | — | 25 s |
| Konstrukt szturmowy | przed sobą | trochę go mylą | ×1 | 6 m | — | — | 14 s |
| Bandyta | przed sobą | mylą | ×0,8 | 4 m | — | — | 12 s |
| Dron | dookoła | w dużej części widzi | ×0,5 | — | — | — | 7 s |

- Węch działa przez krzaki i ściany. Kto raz złapał zapach, idzie twoim tropem (6 s za tobą); zgubienie go z oczu nic nie daje, dopóki trop trwa. Trop przerywa woda, łódź i pojazd.
- Słuch: zasięg hałasu (strzał z blastera 55 m, z tłumikiem ok. 12 m) razy mnożnik z tabeli.
- Zamiary (`world/intents.ts`): watahy Rozszarpywaczy i gniazda Gryzaczy idą twoim tropem (im dalej, tym starszym, do 40 s za tobą); patrole robotów i bandytów idą linią przecinającą twoją drogę 35 s przed tobą i dalej 90 m; na drodze bandyci idą 110–170 m przed ciebie i czekają na poboczu. Spotkanie bez kontaktu przez 3 minuty wygasa (znika, jeśli nikt go nie widzi i jest dalej niż 120 m; inaczej zostaje na miejscu). Przy strzałach stwory nadal idą do miejsca hałasu.
- Gra wieloosobowa: zamiary prowadzi gra, która stworzyła wrogów; tropiciel idący za innym graczem idzie tam, gdzie ten gracz jest (jego ślady nie są wysyłane).

Plan pierwotny:

Każde losowe spotkanie dostaje zamiar (`Intent`) i idzie z nim do gracza w swoim tempie. Gracz ma 20–90 s, żeby go zauważyć, przyczaić się, zająć osłonę albo zejść z drogi.

**Zamiary.**
- **trop** (wataha Rozszarpywaczy, Gryzacze):
  - idą śladem gracza: okruchy pozycji co 8 s, ostatnie 3 minuty;
  - w kłusie, nie biegiem;
  - zgubiony trop (gracz wszedł do wody, do wioski, odjechał pojazdem) → węszą przy ostatnim śladzie i rozchodzą się;
  - jeśli gracz ich nie widzi, a mają widok, przechodzą w łowy (stan `hunt` jak dziś).
- **przecięcie** (patrole robotów, bandyci):
  - idą trasą, która przetnie przewidzianą drogę gracza (z kierunku i prędkości ostatnich 20 s);
  - jeśli go nie wypatrzą (skradanie, `sense` z `world/stealth.ts`), mijają go i idą dalej.
- **czatowanie** (bandyci przy drodze, Bramble):
  - czekają przy drodze albo na skraju lasu na trasie gracza;
  - Bramble po prostu pasie się dalej (nie poluje).
- **krążenie** (Pijawki): krążą nad wzgórzem na trasie gracza; jak dziś, lecą, gdy go wypatrzą.

**Czas.** Spotkanie, które przez 3 minuty nie dotarło (gracz zmienił kierunek), wygasa i zwalnia budżet. Znikanie jak w L1.

**Gra wieloosobowa.**
- Zamiar liczy gra-właściciel przeciw jednemu graczowi, najbliższemu przy spawnie; gdy ten odejdzie, przeciw kolejnemu najbliższemu.
- Okruchy toru są lokalne (z pozycji graczy, które gra i tak zna).
- Nic nowego nie idzie przez sieć.

**Testy.**
- Trop prowadzi do gracza.
- Przecięcie trafia w drogę gracza.
- Spotkanie wygasa.

### L3: legowiska i stałe patrole (odłożone)

Właściciel (20 października 2026): legowisk na razie nie chce. Stałe legowisko, które wraca po kilku dniach, za bardzo przypomina miejsce do farmienia, a w świecie i tak ma być coraz mniej rzeczy, które się odnawiają. Stałe trasy patroli z ziarna odpadają z tego samego powodu: gracz nauczyłby się ich na pamięć.

**Patrole zostają losowe (tak działa już L2, 0.236).**
- Każdy patrol (roboty, bandyci) pojawia się w innym, losowym miejscu pierścienia za mgłą (`Math.random`, nic z ziarna, nic zapisane).
- Jego linia przecina drogę gracza w losowym punkcie przed nim (`crossPoints`: rozrzut ±25 m) i idzie dalej; bandyci przy drodze czatują w losowym miejscu 110–170 m przed graczem.
- Po 3 minutach bez spotkania patrol odchodzi; następny wyjdzie z zupełnie innej strony. Nie ma tras, które można by obstawić.

**Do rozważenia (pomysły właściciela, bez decyzji).**
- Raz wyczyszczone ruiny i wraki nie odradzają się więcej (dziś drony i strażnicy wracają po 7–14 dniach, `REPOP` w `gen/repopulate.ts`), żeby gracze szukali dalszych okolic.
- Legowisko jako jednorazowe miejsce walki: widoczne, po wyczyszczeniu po jakimś czasie znika i nic już tam nie wychodzi.

### L4: ostrzeżenia, zanim go zobaczysz

**Dźwięki z oddali.**
- Głosy stworów (wycie, skrzek, pomruk), serwa i kroki robotów, rozmowy i śmiech bandytów słychać do 250 m (dziś głosy co 5–15 s z bliska).
- Odległe brzmią ciszej i mają kierunek (dźwięk ma już stereo).

**Ślady.**
- Wróg w drodze (L2) zostawia tropy na ziemi: odciski łap, gąsienicowe pasy robotów, buty.
- Tropy blakną po 2 minutach gry. Są rysowane, nie zapisywane.
- Kierunek tropu pokazuje, skąd i dokąd szedł.

**Znaki grup w drodze.**
- Dym z ogniska grupy bandytów, która stanęła na postój (czatowanie), widoczny z daleka (słup bez mgły, jak latarnie z 0.204), nocą jako poświata.

**Gra wieloosobowa.**
- Dźwięki i tropy liczy każda gra sama z widzianych wrogów, ich kopii u innych i ich ruchu.
- Nic nie idzie przez sieć.

**Testy.** Tropy powstają i znikają, dym tylko przy czatujących bandytach.

## Kolejność i wersje

- **L1 (0.235):** podstawa; od razu widać różnicę.
- **L2 (0.236):** zamiary i podchodzenie.
- **L3:** odłożone (legowiska nie teraz; patrole są losowe od L2).
- **L4 (0.237):** dźwięki, ślady, dym.

Po każdym etapie: krótki test w grze i strojenie liczb (odległości, przerwy, liczebność).

## Później

- Skład wrogów według biomu (etap B4d planu biomów): kto wychodzi z pierścienia, zależy od biomu.
- Pora dnia: nocą więcej stworów, za dnia więcej bandytów i robotów.
