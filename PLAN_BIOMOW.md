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
- **B2: wygląd.** Odcień linii terenu, wypełnienia i mgły według biomu (z płynnym przejściem na granicach), rodzaje i gęstość drzew, roślin i skał (pustynia: kaktusy i skały, tundra: karłowate drzewa i śnieg, bagna: trzciny i martwe drzewa, dżungla: wielkie drzewa, kryształowe pustkowia: dużo kryształów), kolor trawy.
- **B3: kształt terenu (tylko nowe światy).** Wydmy na pustyni, płaskie bagna z oczkami wody, ostrzejsze zbocza tundry, kryształowe grzbiety.
- **B4: mechanika (później).** Temperatura i ubiór, pragnienie na pustyni, plony zależne od biomu, stwory i surowce typowe dla biomu, pogoda biomu (burze piaskowe, zamiecie).

## Gra wieloosobowa

Biom wynika tylko z ziarna świata, więc nic nie jest wspólne ani wysyłane. Protokół i serwer bez zmian.
