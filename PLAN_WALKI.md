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
- **W2. Zapowiedzi i drugie tryby ataku.** Każdy przeciwnik dostaje drugi atak i jego zapowiedź *(Zrobione w 0.226.0.)*:
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
  - Zrobione: stworzenia mają nowe stany (`howl`, `stun`, `screech`, `grounded`, `scatter` w `world/creatures.ts`); przewodnik stada wyje 1,3 s i dołącza samotne Ravagery do 70 m; 30% skoków to zmyłki (po 0,45 s odskok). Bramble grzebie racicą 1,4 s (kurz); zablokowany w szarży jest ogłuszony 2 s. Leechwing skrzeczy 0,8 s przed nurkowaniem; chybione nurkowanie przy ziemi = 2,6 s na ziemi. Śmierć Gnawera rozprasza resztę gniazda na boki.
  - Roboty i bandyci mają `mode` (pole 14 wpisu w `world/foesync.ts`, więc kopie u innych graczy pokazują to samo i tak samo obrywają). Sentinel: `shield` przy serii (przód ×0,45), potem `hot` 1,6 s (×1,8, cofa się, iskry). Artillery: `mark` 1,2 s, czerwony promień, potem salwa w znakowane miejsce. Assault: drugi cios młota 0,5 s po pierwszym, szarża po stałej prostej, chybiona = `exposed` 2,4 s (×1,25, tył ×1,4). Guardian bez wzroku strzela seriami po 3 w ostatnie znane miejsce. Scouty w grupie ≥ 3: dwa krążą na 6,5 m, atakujący zmienia się co 4 s. Repair chowa się 4 m za najbliższym ciężkim robotem.
  - Mnożniki stanów są w `STATE_MULT` w `gen/tactics.ts` (`hitMult(..., state)`), komunikaty w dzienniku („Stunned! ×2”, „Overheated! ×1.8”...).
  - Bandyci: granaty (`GRENADE` w `gen/throwing.ts`: zapalnik 2,2 s, promień 4,5 m, 22 HP, odrzut) rzucane w miejsce, gdzie gracz zniknął z oczu, z 6–24 m, co 14–20 s, grupa nie częściej niż co 7 s; migają, piszczą, czerwony krąg pokazuje zasięg. Przy ≥ 3 strzelcach ostatni flankuje (punkt 13 m od gracza, obrócony o ±100° od grupy, do 9 s), reszta strzela ×0,55 częściej.
  - Gra wieloosobowa: zachowanie prowadzi gra właściciela; stany stworzeń idą w polu `state`, robotów i bandytów w nowym polu `mode`. Granat idzie tym samym przekazem `throw` co rzuty (k 'grenade'); obrażenia liczy tylko gra rzucającego (lokalny gracz i `hurtOther` dla reszty). Protokół i serwer bez zmian.
- **W3. Zasłony.** Bandyci i Guardiany szukają osłony (kamień, ściana, pojazd) i strzelają zza niej. Gracz za niską zasłoną może się kucając wychylić i strzelić. Trafienia w osłonę widać po iskrach. *(Zrobione w 0.224.0.)*
  - Pnie drzew, kamienie wyższe niż stopień, kamienne bloki ruin i wysokie kryształy zatrzymują każdy promień gry (`natureRay` w `world/overworld.ts`, w łańcuchu `G.rayBlock`): strzały gracza, linie wzroku przeciwników i pociski. Geometria jest w czystym `gen/cover.ts` (`rayCyl`, `rayHull`, `rayRod`).
  - Strzał, który kończy się na osłonie, sypie jasnymi odpryskami i daje dźwięk rykoszetu.
  - `world/cover.ts`: `findCover` sprawdza miejsca na pierścieniach 3–11 m wokół przeciwnika (najpierw te od strony odwrotnej do gracza). Miejsce jest dobre, kiedy ciało się tam mieści, coś twardego (także zaparkowany pojazd albo teren) stoi w ciągu 3,5 m w stronę gracza na wysokości przykucniętej piersi, a z pozycji stojącej albo z kroku w bok jest czysta linia strzału. `coverStep` prowadzi przeciwnika: biegnie, kuca 1,8–3 s, wstaje albo wychyla się na 1,4–2,2 s i strzela. Co 3 s sprawdza, czy osłona nadal chroni; jeśli gracz ją obszedł albo podszedł bliżej niż ~6 m, porzuca ją. Za osłoną przeciwnik dłużej nie uznaje, że zgubił cel.
  - Strzelcy, bossowie i Guardiany (na powierzchni) walczą z osłon; osiłki dalej szarżują. Przykucnięty przeciwnik obniża się razem z kulą trafień.
  - Gracz: kucanie i celowanie podnosi oko prawie do pozycji stojącej (`peekK` w `world/weapons.ts`); wtedy pociski znajdują więcej ciała, a przeciwnicy celują wyżej. Raz na grę podpowiedź, kiedy kucasz za niską osłoną.
  - Gra wieloosobowa: osłonę wybiera gra właściciela przeciwnika; przykucnięcie idzie w 13. polu wpisu przeciwnika (`world/foesync.ts`), więc kopie u innych też kucają i są trafiane nisko. Wychylenie gracza wysyła się jako zwykłe `cr` (wychylony gracz liczy się jako stojący). Protokół bez zmian.
- **W4. Przynęty i odwracanie uwagi.** Rzucony kamień albo flara robi hałas w miejscu upadku (system hałasu już jest). Mięso zwabia drapieżniki, a hałas rozjusza Bramble'a. Odwrócony przeciwnik pokazuje tył. *(Zrobione w 0.225.0.)*
  - Rzut: przytrzymaj Z i puść. Im dłużej trzymasz, tym dalej leci (8–22 m/s, pełny zamach po 0,9 s). Rzuca się kamień, flarę sygnałową albo kawałek mięsa (surowe mięso, ryba); w plecaku „Przygotuj do rzutu” wybiera, co poleci. Czyste zasady są w `gen/throwing.ts` (`THROW`, `throwSpeed`, `throwVelocity`, `stepFlight`, `landing`), lot i lądowanie w `world/throwing.ts` (zatrzymuje się na pierwszej przeszkodzie z `rayWorld` albo na wodzie).
  - Kamień: hałas 24 m w miejscu upadku i leży tam do podniesienia. Flara: syczy (hałas 30 m, ponownie co 5 s), świeci na czerwono przez 50 s, widać ją z daleka. Nowy przedmiot `flare` (Zofia, kowal: 3 z oleju do lamp i złomu).
  - Hałas z rzutu (`makeNoise(..., decoy)`) ściąga stworzenia, roboty i bandytów do sprawdzenia miejsca, ale nie podgrzewa spawnów jak strzały.
  - Mięso: przynęta na 60 s (`world/baits.ts`). Ravagery i Gnawery wyczuwają ją z 35 m, a te, które polują, z 14 m (jeśli gracz jest dalej niż 9 m). Jedzą z głową w dół (stan `feed`). Trafienie albo podejście blisko kończy posiłek.
  - Bramble: hałas bliżej niż 28 m rozwściecza pasącego się Bramble'a i ten szarżuje na źródło dźwięku, nie na gracza.
  - Gra wieloosobowa: gra rzucającego wysyła `{t:'throw', loc, k, p, v}`; każda gra w tym samym miejscu leci tym samym rzutem i w miejscu upadku robi hałas dla swoich przeciwników, zapala flarę i kładzie przynętę. Kamień do podniesienia kładzie tylko gra rzucającego (wspólny drop). Serwer przepuszcza nowy typ `throw` (starszy go odrzuca). Protokół bez zmian.
- **W5. Stany.** *(Zrobione w 0.227.0.)*
  - Zachwianie: mocny cios przerywa atak.
  - Powalenie: młot, sledge i szarża Bramble'a mogą przewrócić.
  - Krwawienie stworzeń.
  - Ogłuszenie maszyn przez EMP.
  - Te same stany mogą dotknąć gracza.
  - *(Zrobione w 0.227.0.)* Czyste zasady są w `gen/conditions.ts`: `POISE` (jaką część zdrowia musi zabrać jedno trafienie razy jego „ciężar”, żeby przeciwnik się zachwiał), `FELLS` (kogo da się przewrócić: Ravager, Gnawer, Leechwing, Scout, Guardian, bandyci; Bramble i ciężkie roboty tylko się zachwieją), `MACHINES` (co wyłącza EMP), `IMPACT` (sledge 1,6, włócznia 1,15, ostrze 1, maczeta 0,9, karabin 1,3, śrut 0,6), `COND` (zachwianie 0,7 s, powalenie 1,9 s, zwarcie 3,2 s, ciężkie roboty 2 s; leżący ×1,3, w zwarciu ×1,25; po wstaniu 1,4 s odporności), `BLEED` (każde cięcie dokłada 12% obrażeń na sekundę przez 5 s, najwyżej 8% zdrowia na sekundę), `PLAYER_COND`.
  - `world/conditions.ts`: `applyFx` (z `damageFoe`, w grze właściciela) przerywa atak (skok, szarżę, nurkowanie, zamach, serię, znakowanie), Leechwinga sprowadza na ziemię; `tickCond` w pętlach stworzeń, robotów, bandytów i dronów trzyma przeciwnika i sączy krwawienie. Wygląd: zwierzę na boku wierzga nogami, bandyta leży na plecach, robot przewraca się na bok, w zwarciu stoi zamrożony w niebieskich iskrach; krwawiący zostawia krople. Komunikaty „It is down! ×1.3”, „Short-circuited ×1.3”.
  - Gracz: szarża Bramble'a, młot Assaulta (odrzut ≥ 10) i granat pod nogami przewracają (1,2 s na ziemi, kamera nisko i przechylona, bez ruchu i strzału); cios za ≥ 18% zdrowia, salwa artylerii i dalszy wybuch granatu zachwiewają (0,4 s wolniej); ugryzienia Ravagera (30%), Gnawera (12%), Sea Lurkera (45%), ostrza Scouta (20%) i osiłka (35%) otwierają ranę (0,8 HP/s przez 8 s, najwyżej 3 rany). Apteczka tamuje krwawienie (także przy pełnym zdrowiu).
  - Gra wieloosobowa: skutki trafienia idą z `fhit` (`fx`), krwawienie z cudzego cięcia zabija na konto tego gracza (`kill`), stan i krwawienie w polach 15 i 16 wpisu przeciwnika, a skutki dla innego gracza z `hurt` (`fx`: down / stagger / bleed). Leżący gracz jest widziany jako przykucnięty. Protokół i serwer bez zmian.
- **W6. Morale i odwrót.** *(Zrobione w 0.228.0.)* Bandyci uciekają, kiedy zginie boss albo połowa grupy. Stworzenia pilnują swojego terytorium i odpuszczają pościg za jego granicą, więc gracz może uciec i wrócić z inną taktyką.
  - **Projekt (15 października 2026, zatwierdzony przez właściciela z decyzjami niżej).** Cel: walka nie zawsze kończy się śmiercią jednej ze stron. Przeciwnik może się złamać i uciec, a gracz może uciec poza terytorium zwierzęcia i wrócić z innym planem. Każda ucieczka ma być widoczna i słyszalna (zasada 2), a gracz ma ją rozumieć (zasada 4).
  - **Morale (czyste zasady w nowym `gen/morale.ts`).**
    - Każda grupa ludzi i zwierząt ma morale 0–1. Start: bandyci 0,6, z żywym bossem w zasięgu 25 m +0,2; stado Ravagerów 0,75 (z przewodnikiem +0,15); gniazdo Gnawerów 0,55; Leechwing 0,7; Skitterwingi 0,4. Bramble i Sea Lurker nie mają morale (walczą o swoje miejsce, patrz terytorium).
    - Wstrząsy (liczone u właściciela przeciwnika, widziane w promieniu 25 m): śmierć towarzysza −0,15, śmierć bossa albo przewodnika −0,35, własna rana poniżej 30% zdrowia −0,25, powalenie albo zwarcie −0,1, wybuch granatu albo maszyny obok −0,1, połowa grupy martwa −0,2 (raz). Płonąca flara albo pochodnia w ręku gracza w promieniu 6 m obniża morale zwierząt o 0,05 na sekundę (zwierzęta boją się ognia; łączy się z W4 i światłem z 0.200).
    - Wzmocnienia: gracz poniżej 30% zdrowia +0,2 (czują przewagę), dołączenie nowych towarzyszy +0,1 za każdego, okrzyk bossa bandytów („Trzymać się!”) raz na walkę +0,3 dla wszystkich w 25 m.
    - Próg: poniżej 0,3 członek grupy się łamie. Morale wraca o 0,02 na sekundę, kiedy nikt nie strzela przez 10 s.
  - **Bandyci.**
    - Złamany bandyta krzyczy (dymek i dziennik: „Uciekamy!”, „Nie strzelaj!”), czasem upuszcza broń i biegnie do obozu albo z dala od gracza. Nie strzela i nie szuka osłony. Trafienie w plecy liczy się jak dotąd (W1).
    - Kto dobiegnie do obozu, w którym żyje boss, odzyskuje 0,5 morale i broni obozu. Kto ucieknie 120 m od gracza, znika (wraca do życia regionu jak patrol).
    - Poddanie się (do decyzji): osaczony złamany bandyta (gracz w 8 m, droga ucieczki zablokowana albo ranny poniżej 20%) podnosi ręce. E przy nim: „Puść go wolno” (zostawia broń i część łupu, czasem mówi, gdzie jest skrytka obozu albo dane o technologii: łączy się z poszlakami z `askLead`) albo „Zabierz mu wszystko” (pełny łup, mniejsze zaufanie najbliższej wioski: nowy wpis w `TRUST`). Zastrzelenie poddanego nie daje nagrody za zlecenie łowcy.
    - Obóz: kiedy zginie boss albo połowa obsady, reszta się łamie. Obóz liczy się jako oczyszczony, kiedy w promieniu 60 m nie ma żywego bandyty, który walczy (uciekinierzy się nie liczą), więc zlecenia „oczyść obóz” da się wykonać bez gonienia każdego.
  - **Zwierzęta i terytorium.**
    - Każde zwierzę dostaje stałe `den` (miejsce narodzin, gniazdo, legowisko), które nie przesuwa się jak dzisiejsze `home`, i zasięg: Ravager 90 m, Gnawer 40 m od gniazda, Bramble 30 m, Leechwing 160 m, Sea Lurker 70 m, Skitterwing 50 m.
    - Pościg za graczem kończy się na granicy: zwierzę staje, zapowiada odwrót (Ravager wyje, Bramble prycha i grzebie, Leechwing krąży wyżej) i wraca do `den`. Dziennik: „Stado odpuszcza pościg.”
    - Przy legowisku walczą zacieklej: w 10 m od `den` morale nie spada poniżej 0,35 (ostatnie Gnawery bronią gniazda zamiast uciekać).
    - Złamane zwierzę ucieka do `den`. Tam po 20 s bez walki leczy się o 2% zdrowia na sekundę, więc odwrót gracza nie jest darmowy, ale powrót z innym planem (przynęta, flara, młot) ma sens.
    - Ostrzał spoza terytorium: zwierzę, które dostaje z odległości, a nie może dobiec, chowa się za `den` poza linią strzału (nie stoi jak cel).
  - **Roboty (bez morale).** Maszyny się nie boją. Mają za to protokół: oddział, który straci ponad połowę, wycofuje się do Repair Drone albo do punktu patrolu i przegrupowuje (Repair naprawia). Ich granicą jest dzisiejszy powrót (`return`) przy 2,2 × zasięgu wzroku, ujednolicony z terytorium zwierząt.
  - **Nagrody.** Przepędzony przeciwnik nie zostawia łupu. Za przepędzenie całej grupy jest połowa doświadczenia, jakie dałoby jej zabicie. Zlecenia łowcy (zabij N) liczą tylko zabitych.
  - **Gra wieloosobowa.**
    - Morale, terytorium i ucieczkę liczy gra właściciela przeciwnika. Stan ucieczki bandytów już idzie w polu `state` ('flee'); poddanie się i złamanie zwierząt idą w polu `mode` ('surrender', 'rout'). Kopie u innych graczy pokazują to samo.
    - Wstrząs od zabójstwa liczy właściciel, bo widzi śmierć u siebie (także z `kill` od innego gracza). Pochodnia i flara innego gracza działają przez jego pozycję i `PeerState.lt` (już wysyłane).
    - Przejęcie przeciwnika (gracz odszedł): nowy właściciel ustawia `den` na bieżące miejsce i morale na 0,5.
    - Poddanie się wymaga nowego przekazu `spare` (gracz przy kopii → właściciel rozstrzyga, łup trafia do gracza): serwer trzeba zaktualizować (`RELAY` + 'spare'), `PROTOCOL` bez zmian; starszy serwer odrzuci przekaz, a poddany po prostu ucieknie po 10 s.
    - Dwóch graczy naraz przy poddanym: wygrywa pierwszy przekaz, który dotrze do właściciela; drugi dostaje „Już go puszczono”.
    - Gra jednoosobowa działa tak samo (jesteś właścicielem wszystkiego).
  - **Testy.** Czyste: wstrząsy i progi (`tests/morale.test.ts`), granica terytorium. W przeglądarce: śmierć bossa łamie grupę, ucieczka do obozu, pościg stada kończy się na granicy, leczenie przy legowisku; dwóch graczy: złamany bandyta u właściciela ucieka też u drugiego, `spare` z kopii.
  - **Decyzje właściciela (15 października 2026):** (1) bandyci mogą się poddawać, a to, czy złamany bandyta ucieknie, podda się, czy pobiegnie po posiłki, jest losowane; puszczenie ani obrabowanie poddanego nie zmienia zaufania wiosek; (2) uciekinierzy mogą wracać z posiłkami (losowo, jak wyżej); (3) przepędzenie obsady obozu zalicza „oczyść obóz”: kiedy wszyscy się rozpierzchną, obóz jest oczyszczony i nikogo nie trzeba ścigać; (4) roboty nie mają morale.
  - **Zrobione w 0.228.0 (jak w projekcie, z tymi różnicami):**
    - `gen/morale.ts`: `MORALE` (start, `leaderNear`, `shock`, `fire`, `rally`, `winning`, `brk`, `regain`, `calm`, `near`), `FATE` i `fateOf` (poddaje się 30%, osaczony w 14 m 50%; z pozostałych połowa biegnie po posiłki, reszta ucieka na dobre), `BROKEN` (znika 70 m od każdego gracza; po posiłki wraca po 35–70 s z 1–3 kompanami, morale 0,75, raz; poddany czeka 25 s, potem ucieka; zasięg E 3 m), `DRIVEN_XP` 0,5, `TERRITORY`, `DEN`, `LEASH_POSE`, `REGROUP`, `shocked`, `effective`, `breaks`, `pastEdge`.
    - Bandyci (`world/bandits.ts`): `morale`, `fate`, `mode` 'give' / 'rout' (kopie widzą ręce w górze albo ucieczkę), `moraleBreaks` w walce i w szukaniu, okrzyk bossa raz na walkę (+0,3, uciekający w 25 m wracają do walki), `breakBandit` (wypada z liczby obozu: `campCheck` zalicza obóz, gdy nikt już o niego nie walczy), `brokenTurn`, `comebacks`, `spareBandit` (E: rzuca broń, czasem amunicję, apteczkę i złom; 30% szans, że zdradzi poszlakę starej technologii przez `askLead`), `nearSurrendered`. Zabicie poddanego nie daje złota ani zlecenia. Najazdy na wioski, placówki i karawany nie liczą złamanych jako walczących.
    - Zwierzęta (`world/creatures.ts`): `den`, `morale`, `calm`, stany 'leash' (staje i woła na granicy, wraca do legowiska, wraca do pościgu, gdy gracz wejdzie z powrotem) i 'rout' (ucieka do legowiska); Leechwing, Skitterwingi i Sea Lurker zawracają w powietrzu albo w wodzie; leczenie przy legowisku. Ogień: flary leżące i pochodnie w rękach (twoja i innych graczy przez `PeerState.lt`) w `fires` (`world/baits.ts`).
    - Roboty (`world/robots.ts`): `mode` 'regroup' raz na walkę, do Repair Drone (bez niej walczą dalej), do 70% zdrowia albo 9 s.
    - Nie zrobione: +0,1 za dołączenie nowych towarzyszy, chowanie się zwierzęcia za legowiskiem przed ostrzałem z daleka, powrót złamanego bandyty do obozu (uciekinier po prostu znika albo wraca z posiłkami), przejęty przeciwnik zachowuje swoje `den` i morale z chwili utworzenia kopii.
    - Gra wieloosobowa: przekaz `spare` (gracz przy kopii poddanego → gra właściciela rzuca jego rzeczy jako wspólne łupy i puszcza go); serwer trzeba zaktualizować (`RELAY` + 'spare'), `PROTOCOL` bez zmian. Starszy serwer odrzuca przekaz: poddany cudzego przeciwnika ucieka po 25 s. Poszlakę dostaje szukający (jego gra). Pozostałe przekazy bez zmian: tryby w polu 14 wpisu przeciwnika, stany zwierząt w `state`.
- **W7. Okrążanie i ciasne przejścia.** *(Zrobione w 0.229.0.)* Grupy próbują otoczyć gracza z kilku stron. Gracz broni się w wąskim przejściu, tyłem do ściany albo z wysokości (pomost na murze, skała). Ataki z wysokości dają premię.
  - Czyste zasady w `gen/surround.ts`: `SURROUND` (12 miejsc na pierścieniu 4,5 m wokół celu, czekający 8 m dalej, podział co 0,5 s albo gdy cel przejdzie 1,5 m; boki gracza sprawdzane 1,8 m dalej, „plecami do ściany” od 3 zamkniętych z 8), `shareSlots` (najbliżsi celu wybierają pierwsi: otwarte miejsce najbliżej własnego kierunku, oddalone od zajętych o 12 / liczba członków, potem dowolne wolne, inaczej czeka), `HEIGHT` i `heightMult` (strzał lub cios z co najmniej 1,5 m nad ziemią przeciwnika liczy się mocniej, do ×1,3 od 4 m; nie wobec latającego w powietrzu), `upSpread` (strzał bandyty pod górę na więcej niż 2 m rozrzuca bardziej).
  - `world/surround.ts`: `openAt` (ciało się mieści, ziemia bez uskoku ponad 2,5 m, nic twardego między miejscem a celem według `rayWorld`), `slotFor` (miejsce członka grupy albo punkt oczekiwania na jego kierunku), `sidesBlocked`, `updateSurround` (raz na 90 s, gdy przeciwnicy są blisko: „Stoisz plecami do ściany...”).
  - Kto okrąża: stado Ravagerów (biegnie na swoje miejsce, skacze z niego; bez miejsca krąży dalej i czeka; na dobiegnięcie ma do 6 s), gniazdo Gnawerów (zygzakiem na swoje miejsce 2,5 m, potem prosto; bez miejsca czeka), osiłki bandytów (z różnych stron 1,6 m; reszta czeka). Strzelcy dalej flankują po jednym (W2) i szukają osłon (W3). Plecami do ściany zostaje tylko otwarta połowa miejsc, w wąskim przejściu po jednym z każdego końca.
  - Gra wieloosobowa: miejsca liczy gra właściciela grupy, wobec gracza, na którego idzie tura; premię z wysokości liczy gra strzelającego. Nic nowego nie idzie przez sieć; protokół i serwer bez zmian.
- **W8. Bestiariusz w grze.** Notatnik polowy wypełnia się sam: po pierwszym spotkaniu opis przeciwnika, po zabiciu jego słabości, po kilku zabiciach najlepsza taktyka. Jest prywatny dla każdego gracza.

## Kolejność

Proponuję W2 → W5 → W3 → W4 → W6 → W7 → W8. Zapowiedzi i stany zmieniają najwięcej przy najmniejszym koszcie. Zasłony i przynęty wymagają więcej pracy nad zachowaniem przeciwników.
