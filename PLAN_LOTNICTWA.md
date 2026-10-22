# Plan: maszyny latające

Do akceptacji właściciela. Wyrasta z ostatniego etapu planu magazynów (`PLAN_MAGAZYNOW.md`, M6: maszyny latające obsługujące magazyny bez dróg). Etapy po kolei, każdy jako osobna wersja. Oznaczenie **F** (od *flight*), bo litery L, M, P, W, B są już zajęte przez inne plany.

## Założenia (do potwierdzenia)

- **Najpierw transport, potem latanie samemu.** Pierwsze maszyny latają same, według rozkładu, jak ciężarówki na liniach konwojowych (`gen/hublines.ts`) i statki na liniach towarowych (`gen/shiplines.ts`). Pojazd, którym gracz steruje w powietrzu, przychodzi później, bo to dużo pracy: fizyka, kamera, lądowanie, gra wieloosobowa.
- **W powietrzu nie ma dróg, ale są granice.** Maszyny latają prosto, nad morzem, górami i rzekami. Ograniczają je:
  - zasięg (bateria albo paliwo);
  - pogoda (burza i mgła uziemiają);
  - pojemność.
- **Wszystko potrzebuje prądu i ludzi** (zasada z `PLAN_PRAD_I_LUDZIE.md`). Lądowisko to budowla przy magazynie: ma pobór prądu i obsługę (z ludzi wioski albo osadników magazynu w dziczy czy portu). Bez nich maszyny stoją.
- **Technologia z nośników danych.** Nowa technologia **Lotnictwo** (`aviation`, poziom 3) dopisana na końcu `TECHS`, tak że dotychczasowe miejsca nośników się nie zmieniają. Bez planów nie da się zbudować ani drona, ani sterowca. Później ewentualnie druga technologia dla wiropłatu.
- **Pojazdy niczyje** (zasada z 0.248). Każda maszyna latająca jest wspólna jak samochody i statki: kto pierwszy wsiądzie albo ją przekaże, ten nią dysponuje.
- **Multiplayer od początku:**
  - linie i maszyny leżą we wspólnych `towns` i `outposts`, pod blokadą magazynu, z którego startują;
  - przyjęcie towaru odbywa się pod blokadą magazynu docelowego, z własnym licznikiem, tak jak w M4 i M5 (nigdy podwójnie);
  - pozycje w locie wynikają z zegara gry, więc każdy widzi to samo;
  - sterowanym samemu sterowcem kieruje jedna gra (ta, której gracz trzyma ster), a reszta podąża za jej pozycją, jak przy statkach (`world/boats.ts`).

## Etapy

### F1: drony towarowe
- **Lądowisko dronów:** nowa część magazynu.
  - We wsi budowane z zapasu przy terminalu magazynu.
  - W porcie i w magazynie w dziczy budowane przy tablicy.
  - Pobór ok. 4 kW, jedna osoba obsługi.
  - Wygląd: betonowa płyta z kręgiem, maszt z wiatrowskazem, szafka z ładowarką.
- **Dron towarowy:** przedmiot z warsztatu (zamówienie u kowala po zdobyciu planów `aviation`).
  - Składniki z grubsza: aluminium, silniki, sterownik, ogniwa, tworzywo.
  - Odkłada się go na lądowisku, nie wozi w plecaku.
- **Linia powietrzna:** od lądowiska do innego magazynu z lądowiskiem w tej samej sieci radiowej (M3, także przez statki z M5).
  - Zasięg ok. 8–10 km w linii prostej.
  - Dron zabiera mało: 2–4 skrzynie na lot.
  - Za to lata szybko, często i nie zważa na teren.
- **Kurs** działa jak na linii konwojowej:
  - według rozkładu;
  - wybór towarów;
  - tranzyt z M5 (towar może przejść z ciężarówki na drona i dalej);
  - dron ładuje się z prądu magazynu w domu, a bez prądu nie startuje.
- **Pogoda:** w burzy dron nie startuje. Bandyci go nie rabują, ale na terenach o dużym zagrożeniu lot może się nie udać (dron spada, ładunek przepada, dron trzeba odbudować). Szansa niewielka, rośnie z zagrożeniem po drodze.
- **Widok:** dron lata nad ziemią po prostej, z migającymi światłami. Na mapach jest kropkowana linia i kropka.

### F2: osady i lądowiska
- **Lądowisko jako projekt osady** (rozwój po magazynie): miejsce wytycza się palikiem, jak magazyn.
- **Kilka dronów na jednym lądowisku** (np. do 3): każdy na osobnej linii do innego magazynu, dzięki czemu wioska staje się węzłem powietrznym.
- **Komputer wioski:** w zakładce MAGAZYNY pokazuje linie powietrzne.

### F3: sterowiec (pojazd, którym steruje gracz)
- **Budowa:** duży, wolny statek powietrzny budowany przy maszcie cumowniczym.
  - Maszt cumowniczy to nowa budowla magazynu albo osady.
  - Materiały: tkanina na powłokę, aluminium na szkielet, silniki, sterownik, gaz nośny z zakładów chemicznych.
- **Sterowanie:**
  - W/S: ciąg;
  - A/D: obrót;
  - Space/C: wznoszenie i opadanie;
  - wiatr z pogody (`weatherAt`) spycha go z kursu;
  - kamera z tyłu albo z gondoli.
- **Gondola:** z ładownią (ok. 30–40 skrzyń) i pokładem, po którym da się chodzić w locie (jak po statku: `shipFloor`, `carry`).
- **Lądowanie:**
  - cumuje się przy maszcie;
  - może też zawisnąć nisko nad płaskim terenem i spuścić drabinkę.
- **Paliwo:** ropa albo ogniwa (do ustalenia), zasięg kilkadziesiąt km.
- **Multiplayer:** jak statki z 0.140:
  - jedna gra prowadzi (gracz przy sterze);
  - pozostali widzą pozycję wysyłaną co 100 ms (nowy typ `air` w `RELAY`; serwer trzeba dopisać, protokół bez zmian);
  - gracze na pokładzie lecą razem z nim.

### F4: sterowiec na linii
- **Przekazanie na linię:** sterowiec przekazuje się linii między dwoma masztami, jak ciężarówkę albo statek.
- **Porównanie z innymi środkami transportu:**
  - duży zasięg (także nad morzem, między kontynentami);
  - duża ładownia;
  - wolniejszy od drona;
  - wrażliwy na burze.
- **Tranzyt:** sterowiec działa jako trzeci sposób wysyłki dalej (obok konwoju i statku).

### F5: wiropłat (opcjonalnie)
- Mała, szybka maszyna dla gracza:
  - dwa miejsca;
  - mała ładownia;
  - ląduje na każdym płaskim miejscu.
- Służy do zwiadu i dowozu w głąb dziczy, do placówek bez dróg.
- Osobna technologia (np. `rotorcraft`, poziom 4).

### F6: zagrożenia w powietrzu
- Pijawkoskrzydłe (`leechwing`) atakują nisko lecące maszyny.
- Bandyci w obozach mają czasem działko przeciwlotnicze.
- Burze z piorunami uszkadzają powłokę sterowca.
- Na liniach dronów i sterowców pojawia się szansa straty zależna od zagrożenia i pogody (już w F1 dla dronów, tu rozbudowana).

## Otwarte sprawy (do decyzji właściciela)

- **Kolejność:** czy zaczynamy od dronów (F1), czy od razu od sterowca, którym się lata (F3)?
- **Napęd sterowca:** ropa (prościej, pasuje do stacji paliw) czy ogniwa i prąd (spójne z dronami)?
- **Gaz nośny:** osobny towar z zakładów chemicznych (np. „wodór w butlach”), czy uproszczenie: powłoka po prostu jest napełniona przy budowie?
- **Strata drona:** czy rozbity dron przepada razem z ładunkiem, czy da się go odnaleźć i naprawić w miejscu upadku (ślad na mapie)?
- **Wiropłat:** czy F5 w ogóle wchodzi do planu?
- **Odległości:** czy maszyny latające mają mieć limit odległości od ostatniego magazynu (żeby nie zastępowały całkiem dróg i statków)? Proponuję tak: drony do ok. 10 km, sterowiec do ok. 40–60 km.
