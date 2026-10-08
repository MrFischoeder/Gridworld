# Plan: miasta, placówki i logistyka

Ustalenia z właścicielem gry (8 października 2026). Plan dotyczy **tylko nowych światów**. Stare światy (z ~100 wioskami i osadami) zostają na dotychczasowych zasadach, tak samo jak przy wprowadzaniu osad.

## Idea

- Wiosek jest dużo mniej, tylko ok. **20 miast na świat**. Są rzadkie, duże i żywe.
- **Złoża** (ropa, rudy, kamień, wielkie gaje, złoża rzadkie) leżą w dziczy jako osobne miejsca, a nie przy wioskach.
- Gracz zakłada przy złożach **placówki** (outposty): wydobycie, magazyn, zasilanie, ludzie, jedzenie, ogrodzenie, przetwórnia. Nie płaci za złoże, tylko o nie dba: musi zapewnić prąd, jedzenie i obronę.
- Gracz nie zarabia na handlu między wioskami, tylko **organizuje logistykę**: wydobycie, przewóz, przetwarzanie, aż do Rydwanu.
- Placówka, która ma farmy, elektrownię, domy i ludzi, z czasem **przeradza się w wioskę**.

## Dwa tryby gry (wybierane przy tworzeniu świata lub serwera)

- **Współpraca** (domyślny; gra solo to zawsze współpraca): wszystko jest wspólne dla załogi. Jest jedna wioska startowa (Gridholm), a placówki należą do wszystkich.
- **Rywalizacja**: każdy gracz zaczyna przy **własnej** wiosce podobnej do Gridholm, a wioski graczy leżą daleko od siebie. Kto pierwszy zajmie złoże, ten je ma. Gracze mogą się dogadywać: właściciel może dać innemu graczowi dostęp do placówki (lista partnerów). Nie ma PvP z bronią, rywalizacja idzie o miejsca i czas.

W modelu danych każda placówka od początku ma **właściciela** (id gracza albo „załoga”), więc tryb rywalizacji nie wymaga przebudowy.

## Miasta (ok. 20 na świat)

- Rozstawione równomiernie po planecie, poza górami, morzem i lodem. Drogi biegną tylko między nimi (oraz do wioski lub wiosek startowych).
- Gotowe od startu: farmy, elektrownia, mur, mieszkańcy. Miasta nie rozbudowuje się od zera.
- Mają **targ i sklepy** (urozmaicenie: kupno jedzenia, narzędzi, części, sprzedaż nadwyżek). Nie ma werbunku ani kontraktów.
- Karawany kursują między miastami, jak dziś.

## Ludzie

- Nikogo się nie werbuje. **Ludzie przychodzą sami**, gdy osada (wioska startowa, placówka albo dawna placówka, która stała się wioską) ma nadwyżkę jedzenia i wolne miejsca w domach lub barakach. Wyjaśnienie fabularne: przychodzą z miast.
- Gdy brakuje jedzenia, ludzie pracują wolniej, a w końcu odchodzą (to już działa w osadach: `settleTarget`, `peopleFed`).

## Ziemia pod uprawę

- Każde miejsce na planecie ma **żyzność** od 0,4 do 1,8. Liczy się ją z szumu i terenu: płaskie, niskie tereny przy rzekach są żyźniejsze, a góry, piaski i tereny przy morzu słabsze.
- Farma daje tyle jedzenia, ile wynosi żyzność jej pola. Mapa ma warstwę żyzności.
- W efekcie powstają **zagłębia rolnicze** i **zagłębia kopalniane**, a jedzenie trzeba wozić między nimi. Farmy można stawiać przy każdej placówce.

## Prąd z zasięgiem (bez kabli)

- Każde źródło prądu (generator, wiatraki, panele, elektrownia węglowa, reaktor) ma **promień**, a wszystko w promieniu tworzy jedną sieć.
- Sieć dzieli moc tak jak dziś bilans wioski: najpierw ludzie i farmy, potem wydobycie, potem przetwórnie.
- Przy niedoborze mocy wszystko pracuje wolniej. Przetwórnia na miejscu (np. rafineria przy pompie) wymaga więc dodatkowego źródła prądu.

## Zagrożenia

- **Bandyci** najeżdżają placówki według rozkładu, jak dziś wioski. Bez obrony placówka traci zapasy i wydajność; gdy jesteś na miejscu, walczysz na żywo.
- **Dzikie zwierzęta** niszczą placówki bez ogrodzenia.
- Obrona: płot, palisada, mur i wieżyczki, wykorzystujące dzisiejsze progi murów i działka.

## Logistyka

- **Wywóz ręczny:** ładujesz ciężarówkę w magazynie placówki i wieziesz.
- **Trasy konwojów:** ustawiasz trasę (placówka → wioska, wioska → placówka z jedzeniem), przydzielasz ciężarówkę, a konwój jeździ według rozkładu. Pali paliwo albo prąd i może zostać napadnięty. Trasy liczone ze wzoru, jak dzisiejsze karawany.

## Etapy

1. **O1 – nowy świat:** ok. 20 miast z targiem i sklepami, drogi między nimi, wioska startowa (Gridholm), złoża jako miejsca na mapie (odkrywane wyprawą, skanem, plotkami), mapa żyzności. Stare światy bez zmian.
2. **O2 – placówka:** palik przy złożu, budowa wydobycia i magazynu, produkcja liczona ze wzoru, wywóz ciężarówką; właściciel w danych (załoga albo gracz).
3. **O3 – sieć prądu z zasięgiem:** źródła prądu przy placówkach, wspólna sieć w promieniu.
4. **O4 – ludzie i jedzenie:** baraki i domy, zużycie jedzenia, samoczynny napływ ludzi przy nadwyżce, farmy przy placówkach z żyznością; placówka przeradza się w wioskę.
5. **O5 – obrona:** płoty, mury, wieżyczki, najazdy bandytów i szkody od zwierząt.
6. **O6 – trasy konwojów** ustawiane przez gracza.
7. **O7 – przetwórnie na miejscu** (rafineria przy pompie, huta przy kopalni, tartak przy gaju) i konwoje elektryczne (dawne P5).
8. **O8 – tryb rywalizacji:** własne wioski startowe graczy, zajmowanie złóż przez pierwszego, udostępnianie placówek partnerom. Wymaga zmiany `PROTOCOL` i aktualizacji serwera.

## Multiplayer (zasada właściciela gry dla każdego etapu)

- Stan miast, placówek, sieci i tras siedzi we wspólnym stanie świata (`towns` albo nowe pole współdzielone, z odpowiednikiem w `FIELDS` po stronie serwera). Rozlicza go ten, kto pierwszy zajrzy, a obliczenia są deterministyczne, więc wszyscy widzą to samo.
- Budowa i wybieranie z magazynu idą pod blokadą miejsca (jak `withTownStock`).
- W trybie współpracy każdy może budować, dowozić i bronić. W trybie rywalizacji tylko właściciel i jego partnerzy.
- Najazdy na placówki uruchamia gra z `spawnAuthority`, jak dziś najazdy na wioski.
