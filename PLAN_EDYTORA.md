# Plan edytora map (GridWorld)

Prośba właściciela: osobny moduł gry, edytor map, w którym samemu tworzy się mapy do grania i testowania: świat (kształt i rozmiar kontynentów i wysp, rzeki, zasoby), wioski (wszystkie budynki gry do ustawienia) oraz lochy z osobnymi zestawami do tuneli metra, korytarzy statków kosmicznych i ruin starożytnych. Pliki map zapisują się jako JSON, żeby duża gra mogła z nich korzystać.

## Decyzje

- Edytor to osobna strona `editor.html` obok gry (ten sam serwer, ta sama przeglądarka), otwierana przyciskiem **Map editor / Edytor map** w menu głównym. Kod w `src/editor/`, czysty format plików w `src/gen/mapfile.ts` (bez three.js i DOM, więc gra, edytor, testy i kiedyś serwer czytają go tak samo).
- Trzy rodzaje plików: `dungeon` (loch), `world` (świat), `village` (układ wioski). Każdy ma `kind`, `format` (dziś 1), `name`. Pliki są w pamięci przeglądarki (`gridWorld.editor.dungeon` / `.world` / `.village`) i wychodzą / wchodzą jako pliki `.json` (Eksport / Import).
- Lochy zapisują elementy z zestawów (to, co się edytuje) **i** rozwiniętą listę operacji wokselowych `ops` (`{op:'room'|'solid', x,y,z,w,h,d}`, zgodnie z regułą formatu map gry). Gra rozwija elementy na nowo funkcją `expandDungeon`, więc zawsze gra to samo, co widać w edytorze.
- Wszystko dwujęzyczne jak cała gra (angielski w kodzie, polski w `src/i18n/pl.ts`).

## Etapy

- **E1 (0.207, zrobione)**: edytor z trzema kartami.
  - **Loch**: siatka 1 m z góry, trzy style z własnymi zestawami: ruiny (komnata, wielka sala, korytarz, lity blok, wnęka, zawał), statek (przedział, maszynownia, korytarz statku), metro (hala stacji z peronami nad rowem torowym, tunel metra z torami, rozbity pociąg, zawał gruzu, wnęka). Znaczniki: start, schody wyjściowe, skrzynia, kryształy, boss, robot strażnik (rodzaj do wyboru), drzwi. Zagrożenie i liczba dronów. Podgląd 3D z wokseli, sprawdzenie (brak wyjścia, znacznik poza komnatą, skrzynia nie do dojścia pieszo). Cofanie (Ctrl+Z), obrót (R), usuwanie (Delete). **Wypróbuj w grze**: gra otwiera się z `?test=<nazwa>` i od razu schodzi do lochu; schody prowadzą z powrotem na powierzchnię. W konsoli gry `custom` wypisuje mapy, `custom <nazwa>` schodzi do lochu.
  - **Świat**: siatka wysokości (domyślnie 120 × 60 pól po 500 m, rozmiar do zmiany), pędzle (podnieś, obniż, góry, wyrównaj, wygładź, maluj morze, maluj nizinę), start od otwartego morza, losowych kontynentów albo lądu z ziarna gry; rzeki (linie z szerokością i nazwą), złoża (wszystkie rodzaje z gry), miejsca (start, wioska z wybranym układem, ruiny, obóz, wrak, martwe miasto, stary zakład, megality, jaskinia).
  - **Wioska**: kształt i rodzaj muru, cała biblioteka budynków gry (budynki wioski, elektrownia, projekty osady, zakłady, elektrownie dodatkowe, pola z uprawą, obrona, latarnie, latarnia morska), ustawianie, przesuwanie, obracanie, podpisy.
- **E2**: świat z edytora grywalny: nowy rodzaj świata w grze, w którym teren bierze się z siatki pliku (zamiast szumu i morza z ziarna), rzeki, złoża i miejsca z pliku; ziarno dalej generuje szczegóły (drzewa, skały, wnętrza). Wybór w menu: „Graj na mapie z edytora”.
- **E3**: układy wiosek z edytora w grze: wioska w świecie z polem `layout` buduje się z pliku (budynki, mur, pola), reszta jej życia (mieszkańcy, sklepy, zadania) jak dziś.
- **E4**: lochy z edytora w świecie: wejście do lochu (ruiny, wrak, wejście do metra) może wskazać plik lochu zamiast generowanego.
- **E5**: mapy w grze sieciowej: serwer przechowuje pliki map pokoju i rozsyła je graczom (dziś mapa z edytora jest tylko w przeglądarce autora: online widzi ją tylko on).

## Gra sieciowa

Pliki map żyją w przeglądarce autora. Test lochu działa też online, ale to poziom tylko tego gracza: inni go nie mają (ich gry nie znają tej mapy), więc nie zejdą za nim. Nie synchronizowane: pliki edytora (do E5). `PROTOCOL` bez zmian.
