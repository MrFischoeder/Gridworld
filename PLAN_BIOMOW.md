# Plan biomów

Ustalenia z właścicielem (19 października 2026):
- na początek 10 biomów i biom wielkich kryształów;
- kształt terenu (B3) zmienia się tylko w nowych światach, żeby nie przesunąć ziemi pod polami, placówkami i budowlami w starych zapisach;
- kolory mogą odchodzić od zieleni (bursztyn na pustyni, biel w zimie i tak dalej);
- na razie biomy nie mają wpływu na mechanikę; mechanika przyjdzie później (B4).

## Biomy

| Biom | Nazwa w grze | Gdzie |
|---|---|---|
| Równiny | Plains | umiarkowanie, sucho; zawsze wokół Gridholm |
| Las | Forest | umiarkowanie, wilgotno |
| Tajga | Taiga | chłodno, wilgotno |
| Tundra | Tundra | zimno i sucho, przed czapami lodowymi |
| Pustynia | Desert | gorąco, sucho |
| Sawanna | Savanna | gorąco, średnio sucho |
| Bagna | Swamp | bardzo mokro, nisko (poniżej 18 m) |
| Dżungla | Jungle | gorąco, bardzo mokro |
| Góry | Mountains | maska gór powyżej 0,35 |
| Wybrzeże | Coast | do 260 m od morza i poniżej 10 m |
| Kryształowe Pustkowia | Crystal Wastes | rzadkie plamy (ok. 2–3% lądu), co najmniej 6 km od Gridholm |

Morze i czapy lodowe zostają jak były (`sea`, `ice`).

## Jak powstaje biom (`gen/biomes.ts`)

- **Ciepło:** 0..1, cieplej przy równiku, chłodniej ku biegunom i wyżej (spadek 1/320 na metr), do tego wolny szum (9 km), który rysuje plamy klimatu.
- **Wilgotność:** 0..1, wolny szum (6,5 km), wilgotniej przy rzekach (+0,22 do 250 m, +0,1 do 900 m).
- **Wokół Gridholm:** do 3,5 km zawsze umiarkowanie, potem przez 3 km przechodzi w miejscowy klimat.
- **Kolejność:** lód → morze → góry → wybrzeże → kryształy → bagna → zimno (tajga lub tundra) → gorąco (pustynia, sawanna, dżungla) → umiarkowanie (las lub równiny).
- Wszystko z ziarna świata: każdy gracz widzi ten sam biom w tym samym miejscu; nic nie trafia do zapisu ani przez sieć.

Rozkład lądu (ok. 58% planety to ląd, świat 12345): góry 17%, równiny 14%, sawanna 14%, las 9%, pustynia 9%, tundra 9%, wybrzeże 7%, dżungla 7%, kryształy 5%, tajga 5%, bagna 5%.

## Etapy

- **B1 (0.231, zrobione): mapa biomów.** `biomeAt`, nazwa biomu w HUD zamiast „Dzicz”, warstwa biomów na mapie M (klawisz B, legenda), biomy na mapie deweloperskiej, testy.
- **B2 (0.232, zrobione): wygląd.** Kolory linii i wypełnienia terenu według biomu (mieszane między komórkami 24 m, śnieg wysoko w górach), drzewa biomów na tych samych miejscach (kaktusy, akacje, palmy, sosny, martwe drzewa, bujne korony, kryształowe odłamki; część drzew znika, indeksy zapisów zostają), skały w kolorze biomu, drobiazgi na ziemi (trzciny, trawa, śnieg, kamyki), dzienna mgła w kolorze biomu i gęstsze powietrze nad bagnami i dżunglą, Kryształowe Pustkowia pełne pól kryształów.
- **B3 (0.233, zrobione): kształt terenu (tylko nowe światy).** Nowe światy mają ziarna od −1 000 000 do −999 000 000 (`shapedWorld`); starsze i światy z edytora zachowują teren. Wysokość bazowa (`baseHeight`) i kształt biomu (`gen/biomeshape.ts`, wagi płynnie wygasające na granicach, bez rzek, żeby nie było pętli): wydmy na pustyni (fale 64 m, 2,5–6 m), bagna obniżone do lustra wody (2,2 m nad morzem + ćwierć dawnej rzeźby) i pełne płytkich rozlewisk mętnej wody (ok. 2/3 powierzchni w środku bagna, najwyżej ok. 0,85 m głębokości), pofałdowana tundra (±1,6 m), kryształowe grzbiety (do 6 m). Woda bagien jest tylko tam, gdzie grunt jest naturalny (nie pod drogą, placem, polem); drogi nad wodą. Tafla, brzegi i zmarszczki rysowane per kawałek terenu, rozlewiska na mapie.
- **B4: mechanika.** Ustalenia (20 października 2026): we wszystkich światach; zimno i upał tylko osłabiają (bez utraty zdrowia); nowe ubrania tak.
  - **B4a (0.234, zrobione): temperatura i ubiór.** Każdy biom ma temperaturę dnia i nocy (np. tundra −8 / −22 °C, pustynia 40 / 6 °C, dżungla 31 / 23 °C), mieszaną na granicach biomów; wysokość, deszcz, burza, chmury i wiatr ochładzają. Odczuwalna temperatura: powietrze + ubranie (ciepłe przeciw zimnu, przewiewne przeciw upałowi) + ogień do 6 m (do +15 °C), pochodnia w ręku (+3), lampa (+1); dom, mury wioski i zamknięta kabina przyciągają ją ku 18 °C; pływanie wychładza; pod ziemią stałe 12 °C (jaskinie 8 °C). Ciało powoli (ok. 90 s) dąża do odczuwalnej: zmarznięty spalasz więcej kalorii (zamarzając do ×2,2, wolniejsza regeneracja i krok), przegrzany tracisz więcej wody (do ×2,6, szybciej się męczysz). Nowe ubrania u kowala (proste zamówienia) i u Oskara: futrzany kaptur, futro, rękawice, spodnie i buty; pustynna szata i szemag. Pasek pod jedzeniem, °C przy zegarze.
  - **B4b: woda i jedzenie według biomu.** Pragnienie na pustyni, owoce i grzyby typowe dla biomów.
  - **B4c: ruch, pojazdy i widoczność.** Bagno i śnieg spowalniają, piasek męczy pojazdy, gęste powietrze dżungli skraca widok.
  - **B4d: stwory według biomu.** Wagi pojawiania się istniejących stworów według biomu, później nowe stwory.
  - **B4e: ziemia według biomu.** Żyzność, plony, złoża i energia (słońce na pustyni, wiatr na tundrze); pytanie do właściciela: czy także w istniejących wioskach.
  - **B4f: pogoda biomu.** Burze piaskowe, zamiecie, burze rezonansowe nad kryształami.

## Gra wieloosobowa

Biom wynika tylko z ziarna świata, więc nic nie jest wspólne ani wysyłane. Ciepło ciała (B4a) jest osobiste i zapisuje się z postacią; nic nowego nie idzie przez sieć. Protokół i serwer bez zmian.
