# Plan: wioski, populacja i progresja

Plan wdrożenia dokumentu właściciela „GridWorld 01 — Wioski, populacja i progresja v0.3A”. Dotyczy osad według nowych zasad (`progressive`: nowe światy od 0.131). Wioski starych zapisów zachowują dawne zasady. Każdy etap jest rozpisany pod kątem gry wieloosobowej (zasada projektu z `CLAUDE.md`).

## Co z dokumentu już było (stan na 0.140)

- **Stan początkowy:** brak zakładów. Złoża widoczne ok. 100 m za palisadą: kamień (zachód), las (wschód), ruda Fe/Cu/Pb/Ni/C (południe, nie w każdej wiosce), ropa (północ, nie w każdej). Projekty u starszego: kamieniołom, tartak, kopalnia, szyb, rafineria.
- **Ruiny → odbudowa:** stacja łączności w pobliskiej ruinie (daje tablet GPS). Wielkie instalacje też są odbudowywanymi ruinami.
- **Populacja:**
  - liczona w czasie, ludzie przybywają stopniowo;
  - pojemność mieszkań = 8 + 8 × poziom rozwoju (0–6);
  - liczba mieszkańców na placu rośnie z populacją.
- **Domy:** puste stoją jako ruiny i są naprawiane wraz z rozwojem.
- **Magazyny:** mały u starszego, potem stodoła z deskami poza palisadą z wjazdem dla pojazdu (0.137).
- **Starszy:** prowadzi tutorial, pokazuje tylko bieżący krok. Proste zadania dają tablica i mieszkańcy.

## Etapy

### A. Panel osady (0.141, zrobione)
Sześć parametrów z dokumentu w jednym miejscu, u starszego (opcja „How is the village doing?”) i w terminalu (VILLAGE):
- populacja;
- robotnicy przy pracy;
- wolni robotnicy;
- pojemność mieszkań;
- bezpieczeństwo żywnościowe;
- poziom rozwoju (z nazwą).

Panel podaje też, co ogranicza wzrost: brak jedzenia, brak mieszkań albo brak rąk do pracy.

- **MP:** liczone czysto (`gen/villagestats.ts`) ze wspólnego stanu wioski (`towns`). Każdy gracz widzi to samo. Bez nowej synchronizacji, bez zmiany protokołu.

### B. Robotnicy przypisani do zakładów (0.141, zrobione)
- Każdy obiekt ma etaty (`gen/workforce.ts` `JOBS`):
  - farma 4, elektrownia wioski 2;
  - kamieniołom 3, tartak 4, kopalnia 4, szyb 2, rafineria 3;
  - zakład przetwórczy 3, stacja energetyczna 1.
- Robotnicy to 60% mieszkańców. Przydział jest automatyczny według stałego priorytetu: farmy (jedzenie), elektrownia, wydobycie, rafineria, zakłady przetwórcze w kolejności budowy, stacje.
- Niedobór ludzi proporcjonalnie zmniejsza wydobycie i plony farm.
- Zakład przetwórczy albo stacja bez pełnej obsady stoi („short of hands”).
- Elektrownia bez ludzi daje mniej prądu.
- **MP:** przydział to deterministyczna funkcja wspólnego stanu i liczby mieszkańców, identyczna u wszystkich. Nic nowego się nie zapisuje. Ewentualne ręczne priorytety (później) pójdą przez wspólny stan wioski z istniejącą blokadą transakcji.

### C. Bezpieczeństwo żywnościowe (0.141, zrobione)
- Mieszkańcy jedzą to, co dają farmy:
  - zboże, marchew, ziemniaki: wartość 1 na skrzynię;
  - jajka i mleko: 4/3;
  - len i wełna nie są jedzeniem.
- Każdy mieszkaniec ponad 8 pierwszych (żyjących z dziczy) zjada `FOOD.eat` 0,26 skrzyni na dobę.
- Do magazynu trafia tylko nadwyżka ponad to, co zjedzą.
- Ludzie przybywają, gdy jest jedzenie z zapasem 10% (`FOOD.margin`), wolne mieszkania i robotnicy do farm. Cel populacji to punkt stały: więcej ludzi → więcej rąk na farmach → więcej jedzenia.
- Przy niedoborze cel spada i ludzie powoli odchodzą. Tak się dzieje, gdy farmy przestawiono na len, brakuje rąk albo odeszli ludzie.
- **Bezpieczeństwo:**
  - Short: jedzenia mniej niż 95% potrzeb, ludzie odchodzą;
  - Tight: nikt nowy nie przyjdzie;
  - Secure: ludzie mogą przybywać;
  - do tego zapas w dniach w magazynie.
- **MP:** zapasy i krzywa populacji są we wspólnym stanie i w zamkniętej formie (kotwice). Nowy cel liczy każdy gracz tak samo. Zapis kotwicy przy zmianie celu robi każdy obecny gracz (te same wartości, wygrywa ostatni, jak dotąd przy farmach).

### D. Widoczny napływ (później)
- Starszy ogłasza przybycie rodziny (dziennik). Nowi mieszkańcy wchodzą przez bramę.
- W nocy w zamieszkanych domach palą się okna.
- **MP:** liczba wspólna, postacie przy bramie są tylko wizualne, każdy klient rysuje je sam.

### E. System wodny (później)
- Projekt w trzech krokach: studnia → pompownia → wieża ciśnień. Podnosi plony i pozwala osadzie rosnąć wyżej.
- **MP:** zwykły projekt osady we wspólnym stanie.

### F. Kolejność u starszego zgodna z dokumentem (później)
- Farma (z materiałami) → drewno i kamień, mały magazyn → łączność → farmy i domy → duży magazyn → przemysł (z elektrownią).
- Zrobione projekty zostają zrobione.
- **MP:** kolejny krok liczy się ze wspólnego stanu.

### G. Duży magazyn jako węzeł transportu między osadami (później)
