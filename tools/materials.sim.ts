// Writes SUROWCE.md (Polish, for the owner): every raw material and where it comes from, what each can be processed
// into, and everything that can be built from them, straight from the game's data, so it stays true. Run:
//   npx vitest run --config tools/sim.config.ts tools/materials.sim.ts
import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { ITEMS, BULK, SUPPLY_PRICE, TOOL_PRICE, PART_PRICE, type ItemKey } from '../src/data/items';
import { GOODS, GOOD_INFO, type Good } from '../src/gen/market';
import { INDUSTRY, type Industry } from '../src/gen/industry';
import { PLANTS, type PlantKind } from '../src/gen/plants';
import { STATIONS, type StationKind } from '../src/gen/energy';
import { FORTIFY, WORKS, POWER, type WorkKind } from '../src/gen/town';
import { WALL_TIERS } from '../src/gen/village';
import { FARM, UPGRADE, CROPS, type Crop } from '../src/gen/farms';
import { PLANT_LEVELS } from '../src/gen/plantup';
import { IMPROVE, IMPROVE_KINDS } from '../src/gen/improve';
import { RARES } from '../src/gen/deposits';
import { INSTALLS, INSTALL_STAGES, INSTALL_WORK, INSTALL_DRAW, HALL_SETS, RADAR_UP, installWorks, type InstallKind } from '../src/gen/installs';
import { STAGES, CHARIOT } from '../src/gen/shuttle';
import { ORDERS } from '../src/data/orders';
import { GARAGE } from '../src/data/garage';
import { vehicleTitle, VEHICLES, FUEL as CAN, rangeKm, EV } from '../src/data/vehicles';
import { CONVOY_FUEL } from '../src/gen/caravans';
import { PROJECTS, CHARGER } from '../src/gen/settlement';
import { DIG, STORE, OUTPOST } from '../src/gen/outposts';
import { MENU } from '../src/gen/foodshop';
import { DROPS } from '../src/data/creatures';
import { ROBOTS } from '../src/data/robots';
import { TECH_BY_ID } from '../src/gen/tech';
import { classOf, type ItemClass } from '../src/data/itemclass';
import { HOUSE_PRICE } from '../src/data/npcs';
import { FUEL, CHIPS } from '../src/gen/contracts';
import { OWN, HALL } from '../src/gen/hall';
import { BRIDGE } from '../src/gen/bridges';
import { PIER } from '../src/gen/piers';
import { BOATS, type BoatKind } from '../src/gen/boats';

const N = (k: ItemKey) => ITEMS[k]?.name ?? k;
const list = (xs: [ItemKey, number][]) => xs.map(([k, n]) => `${n} × ${N(k)}`).join(', ');
const km = (m: number) => `${(m / 1000).toFixed(0)} km`;
const tech = (t?: string) => (t ? ` · plany: **${TECH_BY_ID[t]?.name ?? t}**` : '');
const INDUSTRY_PL: Record<Industry, string> = { farm: 'wioska rolnicza', mine: 'wioska górnicza', oil: 'wioska naftowa', refinery: 'miasto z rafinerią', lumber: 'wioska drwali', fishery: 'wioska rybacka', workshop: 'wioska rzemieślnicza', salvage: 'wioska złomiarzy' };

// ---------- where each thing is used (the reverse index) ----------
const uses = new Map<ItemKey, string[]>();
const use = (k: ItemKey, what: string) => { const a = uses.get(k) ?? []; if (!a.includes(what)) a.push(what); uses.set(k, a); };

it('writes SUROWCE.md', () => {
  const out: string[] = [];
  const P = (s = '') => out.push(s);
  P('# GridWorld: surowce, przetwarzanie i budowy');
  P('');
  P('Plik jest generowany z danych gry (`tools/materials.sim.ts`), więc nazwy i liczby są takie jak w grze. Nazwy przedmiotów są po angielsku, tak jak na ekranie.');
  P('');
  // (written by hand: the stores' rule and the new settlements' builds)
  for (const line of ["**Zasada magazynu:** wszystko, co wioska buduje (mury, zakłady, elektrownie, farmy, ulepszenia, zamówienia u kowala), bierze materiały z **zapasów wioski**, a nie z plecaka. W nowej osadzie, zanim stanie magazyn, zapasy przechowuje starszy (800 L; opcja „Leave materials with me”); po budowie magazynu (drewnianej stodoły z bramą dla pojazdów) 24 000 L; starsze zapisy zachowują halę 6000 L. Do zapasów trafiają tylko materiały (drewno, kamień, rudy, metale, materiały budowlane, skrzynie towarów i wyroby zakładów, a także zestawy wieżyczek i części silników): broń, amunicję, apteczki, jedzenie, narzędzia i ubrania trzyma się w skrzyni we własnym domu. Do zapasów trafiają też własne towary wioski (produkcja jej zakładu i plony farm, do 60 skrzyń każdego).", "", "**Nowe osady (od 0.131.0, rozbudowane w 0.132.0):** starszy wydaje jednorazowo siekierę i kilof na początek. Wykorzystaj je do pierwszych dostaw drewna i kamienia. Po pierwszej farmie kowal robi deski (2 Log → 6 Planks) i gwoździe (1 Scrap → 10 Nails) bez dodatkowych planów. Po przywróceniu łączności w pobliskich ruinach każdy gracz otrzymuje tablet GPS; jeśli nie ma miejsca, nagroda czeka w zapasach wioski.", "", "| Budowa nowej osady | Materiały z magazynu |", "| --- | --- |", "| Farma (każda z 3) | 8 Log, 6 Stone |", "| Odbiornik satelitarny w ruinach | 6 Log, 6 Stone, 4 Scrap |", "| Magazyn dla pojazdów | 30 Log, 24 Stone, 24 Planks, 20 Nails |", "| Elektrownia wioski | 12 Scrap, 8 Wire, 2 Circuit |", "| Kamieniołom | 16 Log, 12 Planks, 4 Scrap |", "| Kopalnia lokalnej rudy | 18 Log, 12 Stone, 12 Planks, 6 Scrap |", "| Tartak | 20 Log, 10 Stone, 8 Scrap |", "| Szyb naftowy | 16 Scrap, 8 Wire, 12 Planks |", "| Rafineria | 24 Scrap, 4 Circuit, 12 Wire, 18 Planks |", "| Przetwórnia żywności (od 0.142) | 14 Log, 10 Stone, 12 Planks, 16 Nails, 6 Scrap |", "", "Każda rozwijana wioska ma dwa różne własne złoża (od 0.171; jedno od 0.168, podział od 0.169), losowane z tych samych wag, każde na swoim placu około 105 m od palisady: kamieniołom (30%: Stone 0,8/h oraz jeden minerał 0,4/h: Crate of Limestone, Crate of Clay albo Sack of Quartz Sand), wielki gaj z obozem drwali (25%, Gridholm: Log 1,2/h i Timber 0,4/h), kopalnię (30%: węgiel, żelazo, miedź albo ołów, 0,6 skrzyni/h, przy żelazie i miedzi także 0,3 grudki rudy/h) albo szyb naftowy (15%: Crude Oil 0,7/h, w połowie szybów także Salt Blocks 0,25/h). Trzy wioski najbliżej Gridholm mają zawsze (jako pierwsze złoże) kopalnię węgla, kopalnię żelaza i kamieniołom wapienia. Resztę zdobywa się handlem. Tartak osady (od 0.170, zaraz po elektrowni, 3 etaty, prąd 15 / 25 / 40 kW) tnie Log z zapasów wioski na Planks w magazynie: 6 desek z pnia, po pile tarczowej 7, po pile taśmowej 8; ręcznie piłą 4 deski z pnia, około 15 s pracy na pień. Wydobyte wcześniej zapasy zostają dostępne, nawet gdy stary typ kopalni produkował kilka surowców. Paliwo z nowej rafinerii powstaje z jednej skrzyni Crude Oil na jeden Fuel Canister, najwyżej co 2 godziny czasu gry, dopóki jest wsad i miejsce w zapasie. Wydobycie zależy od dostępu do prądu. Przetwórnia żywności (młyn, piekarnia, mleczarnia, wędzarnia; po elektrowni i dwóch farmach, 3 etaty, 8 kW) sprawia, że zboże, ziemniaki, mleko i mięso żywią o 35% więcej ludzi, dopóki ma obsadę. Każdy obiekt osady potrzebuje robotników (od 0.141): farma 4, elektrownia 2, przetwórnia 3, kamieniołom 3, tartak 4, kopalnia 4, szyb 2, rafineria 3, zakład 3, stacja 1. Zamówienia u kowala (od 0.142) trwają godziny gry (podstawowe 1 h, z planów 2–5 h): materiały schodzą z zapasów przy zamówieniu, gotową rzecz odbiera się u kowala, najwyżej 3 zamówienia naraz. Wszystkie budowy przyjmują materiały partiami. Zaparkowany wewnątrz dużego magazynu pojazd rozładowuje się przyciskiem terminala; towary, które się nie zmieszczą, zostają w bagażniku."]) P(line);
  P('**Drabina wartości metali (od 0.173):** ruda (grudka ok. 4,5 g, skrzynia rudy żelaza 36 g) < złom (sztuka 5 g) < sztabki (skrzynia żelaza 60 g, miedzi 175, ołowiu 120) < stal (140) < półprodukty (drut 7 g za sztukę, kabel, rury, przekładnie, części) < zespoły (silniki, pompy, prądnice). Złom nie jest wart tyle co sztabka: to brudny, mieszany metal, który trzeba przetopić. Smelter przetapia 12 Scrap + 1 Coal na 2 skrzynie Iron (marża ok. ×1,5), więc wioska bez kopalni żelaza też dojdzie do żelaza. Drut ciągnie się ze sztabek, nie z rudy: Wire Mill robi z 1 skrzyni Iron 12 Wire, kowal (plany Blast Furnace) 8 Wire z 1 skrzyni Iron. Każdy krok przeróbki daje mniej więcej ×1,25–1,5 wartości wejść.');
  P('**Zakłady ciężkie (od 0.174):** Heavy Engineering Works, zakład II stopnia z planami Heavy Machinery (nośnik danych 3–8 km od Gridholm), 100 kW, 3 robotników. Robi Drill Rig (4 Steel + 2 Gears + 1 Electric Motor + 2 Pipes, 4 h, wart ok. 2500) i Engine Parts (1 Steel + 1 Gears → 6 sztuk), więc pojazdy u Kuby nie zależą już tylko od części z wraków. Wiertnicy używa głęboka kopalnia.');
  P('**Głęboka kopalnia (od 0.175):** w nowej osadzie, która stoi nad złożem rzadkim (boksyt, siarka, lit, ziemie rzadkie, uran, nikiel, chromit, rutyl, ruda platyny; 3–30 km od Gridholm), po magazynie można zbudować Deep Mine na placu ok. 105 m na południowy wschód od palisady: 1 Drill Rig, 6 Steel, 6 Cable, 8 Cement, 16 Planks, 16 h budowy. Wydobywa 0,25 skrzyni na godzinę gry (6 dziennie, po równo z każdego złoża wioski) prosto do zapasów, pobiera 40 kW i potrzebuje 4 robotników. Dzienny przydział od starszego (za zaufanie) zostaje obok.');
  P('**Piec wioski (od 0.176):** w nowej osadzie po elektrowni i magazynie: Coal furnace (24 Stone, 16 Planks, 12 Scrap, 4 Wire; plac ok. 105 m na zachód) sam przetapia zapasy wioski na sztabki w magazynie, jedna partia co godzinę gry, 1 Coal na partię: 2 Crate of Iron Ore → 2 Iron, 4 Copper Ore → 2 Copper Ingots, 4 Lead Ore → 2 Lead Bars, a gdy rudy brak, 12 Scrap → 2 Iron. Koksownia (Furnace: coke ovens: 20 Stone, 10 Bricks, 10 Scrap, 8 Planks) daje 3 sztabki zamiast 2 z tego samego wsadu. Piec łukowy (Furnace: electric arc: 8 Steel, 10 Cable, 1 Generator, 2 Parts) nie potrzebuje węgla, robi partię co pół godziny z wydajnością koksowni, ale pobiera 70 kW (prąd 20 / 30 / 70 kW). 3 robotników.');
  { const need = (n: [ItemKey, number][]) => n.map(([k, q]) => `${q} ${ITEMS[k].name}`).join(', ');
    P(`**Paliwo (od 0.177):** ${ITEMS.fuel.name} to ${CAN.can} l oleju. Scout pali ${VEHICLES.scout.fuelUse} l/km przy pełnym gazie (bak ${VEHICLES.scout.tank} l, ok. ${Math.round(rangeKm('scout', VEHICLES.scout.tank))} km), Mastodon ${VEHICLES.mastodon.fuelUse} l/km (bak ${VEHICLES.mastodon.tank} l, ok. ${Math.round(rangeKm('mastodon', VEHICLES.mastodon.tank))} km); R wlewa kanister. Konwoje (od 0.178) biorą z wioski, z której ruszają, kanister na każde ${CONVOY_FUEL.can / CONVOY_FUEL.lpkm} km drogi; osada bez paliwa zatrzymuje konwój w domu. Dystrybutor (od 0.179): projekt osady po magazynie, ${PROJECTS.fuelpump.name} (${need(PROJECTS.fuelpump.needs)}), tankuje pojazd z zapasów wioski po jej cenie. Paliwo robi rafineria z ropy (1 Barrel of Crude Oil → 1 kanister co 2 h). Napęd elektryczny (od 0.180): ${ITEMS.evkit.name} (plany Electric Drive) zamienia diesel na akumulator ${EV.scout.cap} / ${EV.mastodon.cap} kWh, ${ITEMS.evpack.name} go podwaja; ${PROJECTS.charger.name} (${need(PROJECTS.charger.needs)}) ładuje do ${CHARGER.kw} kW z nadwyżki prądu wioski, ${EV.price} zł za kWh.`);
    P(`**Placówki przy złożach (od 0.183, nowe światy):** przy złożu w dziczy wbijasz palik (E), potem budujesz wydobycie: ${Object.values(DIG).map((d) => `${d.name} (${need(d.needs)})`).join('; ')}, oraz ${STORE.name} (${need(STORE.needs)}). Wydobycie po ${OUTPOST.hours.dig} h budowy daje ${OUTPOST.rate} skrzyni na godzinę × bogactwo złoża (rzadkie ${OUTPOST.rare}), drugi surowiec ${OUTPOST.second * 100}% tego; bez szopy na miejscu leży do ${OUTPOST.pile} skrzyń każdego, w szopie do ${OUTPOST.cap}. Skrzynie zabierasz ręcznie albo do bagażnika.`); }
  P('');
  P('Spis: 1. Surowce · 2. Przetwarzanie · 3. Budowy · 4. Indeks: gdzie użyć każdego materiału · 5. Surowce bez zastosowania');
  P('');

  // ===== 1. raw materials =====
  P('## 1. Surowce: skąd je wziąć');
  P('');
  P('### 1.1 Zbierane w terenie');
  P('');
  P('| Materiał | Skąd |');
  P('|---|---|');
  P(`| ${N('log')} | ścinanie drzew siekierą (przytrzymaj E): 3 kłody, duże drzewo 8; odrasta po 3 dniach gry |`);
  P(`| ${N('stone')} | rozbijanie skał kilofem: 2 kamienie, duża skała 5; odnawia się po 2 dniach |`);
  P(`| ${N('ironO')} | żyły rudy w skałach (zygzaki na skale), więcej w górach; kilofem, obok kamieni |`);
  P(`| ${N('copperO')} | żyły rudy miedzi w skałach, jak wyżej |`);
  P(`| ${N('scrap')} | roboty (${Object.values(ROBOTS).filter((r) => r.loot.some(([k]) => k === 'scrap')).length} rodzajów), bandyci, bagażniki wraków, skrzynie w ruinach i wrakach |`);
  P(`| ${N('circuit')} | roboty (strażnicy, wartownicy, konstrukty), skrzynie we wrakach, szafki skażonych obiektów w toksycznej mgle |`);
  P(`| ${N('pcore')} | rzadko: drony naprawcze, wartownicy, konstrukty; skrzynie we wrakach; szafki skażonych obiektów w toksycznej mgle (często, potrzebna maska gazowa) |`);
  P(`| ${N('filter')} | kowal (zamówienie, plany Filter Masks), czasem w szafkach skażonych obiektów |`);
  for (const [cr, drops] of Object.entries(DROPS)) for (const [k] of drops) P(`| ${N(k)} | stworzenie: ${cr[0].toUpperCase() + cr.slice(1)} (upolowane) |`);
  P(`| ${N('cap')}, ${N('pod')}, ${N('ncrys')} | grzyby w lesie, drzewa z owocami, kryształy w podziemiach (jedzenie) |`);
  P('');
  P('### 1.2 Towary, które wioski wydobywają i wytwarzają same');
  P('');
  P('Każda wioska ma jeden rodzaj zakładu i robi 1–2 towary z jego listy; część wiosek robi do tego jeszcze jeden z nowszych towarów (glina, wapień, ołów, tarcica: „czasem” w tabeli). Towary trafiają do jej hali; kupujesz je na targu, dostajesz w udziale od starszego (za zaufanie) albo przewozisz w kontraktach.');
  P('');
  P('| Towar | Cena bazowa | Surowy? | Kto go robi |');
  P('|---|---|---|---|');
  for (const g of GOODS.filter((x) => !GOOD_INFO[x].proc)) {
    const who = (Object.keys(INDUSTRY) as Industry[]).filter((k) => INDUSTRY[k].pool.includes(g)).map((k) => INDUSTRY_PL[k])
      .concat((Object.keys(INDUSTRY) as Industry[]).filter((k) => INDUSTRY[k].extra?.goods.includes(g)).map((k) => `${INDUSTRY_PL[k]} (czasem, ${INDUSTRY[k].extra!.chance}%)`));
    P(`| ${N(g)} | ${GOOD_INFO[g].base} g | ${GOOD_INFO[g].raw ? 'tak' : 'wyrób'} | ${who.join(', ') || '—'} |`);
  }
  P('');
  P('### 1.3 Plony farm (wybierasz uprawę każdej farmy u starszego)');
  P('');
  P('| Uprawa | Daje | Skrzyń dziennie (ziemia przeciętna) |');
  P('|---|---|---|');
  for (const c of Object.keys(CROPS) as Crop[]) P(`| ${CROPS[c].name} | ${N(CROPS[c].out)} | ${CROPS[c].perDay} (× żyzność 0,7–1,3; × ${UPGRADE.mult} ze stalowymi pługami) |`);
  P('');
  P('### 1.4 Rzadkie złoża (przy niektórych wioskach, w udziale od starszego: 1–3 skrzynie dziennie zależnie od zaufania)');
  P('');
  P('| Złoże | Od odległości od Gridholm | Szansa na wioskę |');
  P('|---|---|---|');
  for (const r of [...RARES].reverse()) P(`| ${N(r.k)} | ${km(r.from)} | ${Math.round(r.chance * 100)}% |`);
  P('');
  P('### 1.5 Kupowane w sklepach');
  P('');
  P(`- **Zofia (sklep ogólny):** ${Object.entries(SUPPLY_PRICE).map(([k, p]) => `${N(k as ItemKey)} ${p} g`).join(', ')}`);
  P(`- **Oskar (kowal):** ${Object.entries(TOOL_PRICE).map(([k, p]) => `${N(k as ItemKey)} ${p} g`).join(', ')}`);
  P(`- **Kuba (pojazdy, Gridholm):** ${Object.entries(PART_PRICE).map(([k, p]) => `${N(k as ItemKey)} ${p} g`).join(', ')}`);
  P('');

  // ===== 2. processing =====
  P('## 2. Przetwarzanie: co z czego');
  P('');
  P('### 2.1 Zakłady przetwórcze (buduje się je u starszego; potrzebują prądu)');
  P('');
  P('| Zakład | Przepis | Czas partii |');
  P('|---|---|---|');
  for (const k of Object.keys(PLANTS) as PlantKind[]) for (const r of PLANTS[k].recipes) {
    P(`| ${PLANTS[k].name} | ${list(r.in)} → ${list([r.out])} | ${PLANTS[k].batch} min gry |`);
    for (const [i] of r.in) use(i, `przetwarzanie: ${PLANTS[k].name} → ${N(r.out[0])}`);
  }
  P('');
  P('### 2.2 Wielkie instalacje (po odbudowie)');
  P('');
  for (const k of Object.keys(INSTALL_WORK) as InstallKind[]) for (const w of installWorks(k)) {
    const name = INSTALLS.find((s) => s.k === k)!.name;
    P(`- **${name}:** ${list(w.inp)} → ${w.n ?? 1} × ${N(w.out)} co ${w.batch / 60} h gry`);
    for (const [i] of w.inp) use(i, `przetwarzanie: ${name} → ${N(w.out)}`);
  }
  P(`- **Old Radar Station:** nic nie produkuje; odkrywa na mapie wszystko w promieniu 12 km.`);
  P('');
  P(`**Siłownie instalacji** (wracają z II etapem odbudowy; partia rusza tylko przy pełnym poborze, zestawy palą paliwo tylko podczas pracy): ${Object.entries(INSTALL_DRAW).map(([k, kw]) => `${INSTALLS.find((s) => s.k === k)!.name} pobiera ${kw} kW`).join(', ')}. Zestawy: ${HALL_SETS.map((h) => `${h.name} ${h.kw} kW na ${N(h.fuel)} (skrzynia na ${h.burn >= 1440 ? h.burn / 1440 + ' dni' : h.burn / 60 + ' h'} pracy, bunkier ${h.bunker})`).join('; ')}. Własny reaktor ma tylko Old Enrichment Plant.`);
  for (const h of HALL_SETS) use(h.fuel, h.fuel === 'nfuel' ? 'paliwo: własny reaktor Old Enrichment Plant' : 'paliwo: siłownie wielkich instalacji');
  P('');
  P('### 2.3 Kowal: „Make something for me” (materiały z hali wioski)');
  P('');
  P('| Wyrób | Z czego | Plany |');
  P('|---|---|---|');
  for (const o of ORDERS) {
    P(`| ${o.n > 1 ? o.n + ' × ' : ''}${N(o.out)} | ${list(o.needs)} | ${o.tech ? TECH_BY_ID[o.tech]?.name ?? o.tech : 'podstawowe (bez planów)'} |`);
    for (const [i] of o.needs) use(i, `kowal → ${N(o.out)}`);
  }
  P('');
  P('**Warsztat mechanika** (Kuba, „Build me something in your workshop”; salvage z hali wioski, praca w godzinach gry):');
  P('');
  P('| Wyrób | Z czego | Czas |');
  P('|---|---|---|');
  for (const g of GARAGE) {
    const out = g.car ? vehicleTitle(g.car) : `${g.n > 1 ? g.n + ' × ' : ''}${N(g.out!)}`;
    P(`| ${out} | ${list(g.needs)} | ${g.hours} h |`);
    for (const [i] of g.needs) use(i, `mechanik → ${out}`);
  }
  P('');
  P('### 2.4 Sklep spożywczy (gotuje z hali wioski)');
  P('');
  P('| Danie | Z czego | Porcji ze skrzyni | Cena |');
  P('|---|---|---|---|');
  for (const d of MENU) {
    P(`| ${N(d.k)} | ${d.from.map(N).join(' lub ')} | ${d.per} | ${d.price} g${d.fallback ? ` (bez zboża: ${d.fallback} g)` : ''} |`);
    for (const i of d.from) use(i, `sklep spożywczy → ${N(d.k)}`);
  }
  P('');
  P('### 2.5 Paliwo dla elektrowni');
  P('');
  for (const k of Object.keys(STATIONS) as StationKind[]) { const s = STATIONS[k]; if (s.fuel) { P(`- **${s.name}:** spala 1 × ${N(s.fuel)} co ${s.burn! >= 1440 ? s.burn! / 1440 + ' dni' : s.burn! / 60 + ' h'} gry (${s.kw} kW)`); use(s.fuel, `paliwo: ${s.name}`); } }
  P('');
  P('### 2.6 Zamówienia specjalne');
  P('');
  P(`- **${N('nfuel')}:** wioski ze starym reaktorem (od ${km(FUEL.from)}) płacą od ${FUEL.pay} g za skrzynię.`);
  P(`- **${N('microchip')}:** wioski rzemieślnicze (od ${km(CHIPS.from)}) płacą od ${CHIPS.pay} g za skrzynię.`);
  use('nfuel', 'zamówienia na paliwo (stare reaktory)'); use('microchip', 'zamówienia na czipy (wioski rzemieślnicze)');
  P('');

  // ===== 3. builds =====
  P('## 3. Budowy: co można zbudować i z czego');
  P('');
  P('Materiały biorą się z hali wioski; złoto płacisz ze swojej sakiewki (opłata dla budowniczych albo nagroda od wioski).');
  P('');
  P('### 3.1 Mury wioski (starszy: fortify)');
  P('');
  FORTIFY.forEach((f, i) => { P(`- **${WALL_TIERS[i + 1].name}** (${WALL_TIERS[i + 1].h} m): ${list(f.needs)} · wioska płaci ${f.gold} g`); for (const [k] of f.needs) use(k, `budowa: mur ${WALL_TIERS[i + 1].name}`); });
  P('');
  P('### 3.2 Obrona');
  P('');
  for (const k of Object.keys(WORKS) as WorkKind[]) { const w = WORKS[k]; P(`- **${w.name}** (do ${w.max}): ${list(w.needs)} · wioska płaci ${w.gold} g`); for (const [i] of w.needs) use(i, `budowa: ${w.name}`); }
  P('');
  P('### 3.3 Zakłady przetwórcze (2 na wioskę)');
  P('');
  for (const k of Object.keys(PLANTS) as PlantKind[]) { const p = PLANTS[k]; P(`- **${p.name}:** ${list(p.needs)} · opłata ${p.fee} g`); for (const [i] of p.needs) use(i, `budowa: ${p.name}`); }
  P('');
  P('### 3.4 Elektrownie (2 na wioskę)');
  P('');
  for (const k of Object.keys(STATIONS) as StationKind[]) { const s = STATIONS[k]; P(`- **${s.name}** (${s.kw} kW): ${list(s.needs)} · opłata ${s.fee} g${tech(s.tech)}`); for (const [i] of s.needs) use(i, `budowa: ${s.name}`); }
  P('');
  P('### 3.5 Rafineria (tylko w miastach z rafinerią)');
  P('');
  P(`- ${list(INDUSTRY.refinery.build!)} · wioska płaci 1200 g`); for (const [i] of INDUSTRY.refinery.build!) use(i, 'budowa: rafineria');
  P('');
  P('### 3.6 Farmy');
  P('');
  P(`- **Farma** (do ${FARM.max}): ${list(FARM.needs)} · wioska płaci ${FARM.gold} g`); for (const [i] of FARM.needs) use(i, 'budowa: farma');
  P(`- **Stalowe pługi** (na farmę): ${list(UPGRADE.needs)}${tech(UPGRADE.tech)} · plon × ${UPGRADE.mult}`); for (const [i] of UPGRADE.needs) use(i, 'budowa: stalowe pługi');
  P('');
  P('### 3.7 Ulepszenia elektrowni wioski');
  P('');
  PLANT_LEVELS.slice(1).forEach((l) => { P(`- **${l.name}** (× ${l.mult} mocy): ${list(l.needs)}${Object.keys(l.tech).length ? ` · plany: ${Object.entries(l.tech).map(([p, t]) => `${p === 'wind' ? 'wiatraki' : 'panele'} — ${TECH_BY_ID[t!]?.name}`).join(', ')}` : ''}`); for (const [i] of l.needs) use(i, `ulepszenie elektrowni: ${l.name}`); });
  P('');
  P('**Ulepszenia wioski** (u starszego: „What could the old parts do for us?”, z zapasów hali wioski; jednorazowe):');
  P('');
  for (const k of IMPROVE_KINDS) { const u = IMPROVE[k]; P(`- **${u.name}**: ${list(u.needs)}${u.wall ? ' · wymaga kamiennego muru' : ''} · wioska płaci ${u.gold} g`); for (const [i] of u.needs) use(i, `ulepszenie wioski: ${u.name}`); }
  P('');
  P('### 3.8 Wielkie instalacje (odbudowa w 3 etapach, materiały z plecaka i bagażnika)');
  P('');
  for (const k of Object.keys(INSTALL_STAGES) as InstallKind[]) {
    const name = INSTALLS.find((s) => s.k === k)!.name;
    P(`**${name}**`);
    INSTALL_STAGES[k].forEach((st, i) => { P(`${i + 1}. ${st.title}: ${list(st.needs)}${tech(st.tech)} · nagroda ${st.gold} g`); for (const [m] of st.needs) use(m, `odbudowa: ${name}`); });
    P('');
  }
  P(`**Old Radar Station, sensor array** (po odbudowie, zasięg ${RADAR_UP.r / 1000} km): ${list(RADAR_UP.needs)} · nagroda ${RADAR_UP.gold} g`); for (const [m] of RADAR_UP.needs) use(m, 'ulepszenie: radar (sensor array)');
  P('');
  P(`### 3.9 ${CHARIOT} (Rydwan w hangarze przy Gridholm)`);
  P('');
  for (const st of STAGES) { P(`- **${st.name}:** ${list(st.needs)}`); for (const [g] of st.needs) use(g, `Rydwan: ${st.name}`); }
  P('');
  P('### 3.10 Naprawy (materiały z plecaka)');
  P('');
  for (const [k, p] of Object.entries(POWER)) { P(`- **${p.name}:** ${list(p.fix)}`); for (const [i] of p.fix) use(i, `naprawa: ${p.name}`); void k; }
  for (const k of Object.keys(INDUSTRY) as Industry[]) { P(`- **${INDUSTRY[k].site}** (${INDUSTRY_PL[k]}): ${list(INDUSTRY[k].fix)}`); for (const [i] of INDUSTRY[k].fix) use(i, `naprawa: ${INDUSTRY[k].site}`); }
  P('');
  P('### 3.11 Mosty, doki, łodzie i statki (budujesz sam, materiały z plecaka i bagażnika)');
  P('');
  const per = (m: Partial<Record<ItemKey, number>>) => (Object.entries(m) as [ItemKey, number][]).map(([k, r]) => `${N(k)} 1 na ${(1 / r).toFixed(1).replace('.0', '')} m`).join(', ');
  P(`- **Most na brodzie drogi** albo w wybranym miejscu (Bridge Kit u kowala): na długość pomostu: ${per(BRIDGE.per)} (np. pomost 40 m: ${(Object.entries(BRIDGE.per) as [ItemKey, number][]).map(([k, r]) => `${Math.ceil(40 * r)} × ${N(k)}`).join(', ')})`);
  for (const k of Object.keys(BRIDGE.per) as ItemKey[]) use(k, 'most');
  P(`- **Dok** (Dock Kit u kowala): na długość pomostu: ${per(PIER.per)}, do tego ${list(Object.entries(PIER.fittings) as [ItemKey, number][])} na głowicę`);
  for (const k of [...Object.keys(PIER.per), ...Object.keys(PIER.fittings)] as ItemKey[]) use(k, 'dok');
  for (const k of Object.keys(BOATS) as BoatKind[]) {
    const b = BOATS[k], where = b.from ? `przeróbka łodzi wiosłowej przy doku` : `na pochylni gotowego doku`;
    P(`- **${b.name}** (${where}; ładownia ${b.hold}): ${list(b.needs)}`); for (const [i] of b.needs) use(i, b.name);
  }
  P(`- Napęd silnikowy pali **${N('fuel')}** (${BOATS.motor.motor!.can} L w kanistrze; bak: ${BOATS.motor.name} ${BOATS.motor.motor!.tank} L, ${BOATS.steamer.name} ${BOATS.steamer.motor!.tank} L)`);
  use('fuel', 'paliwo łodzi i statków z silnikiem');
  P('');
  P('### 3.12 Za złoto');
  P('');
  P(`- Dom w Gridholm: ${HOUSE_PRICE} g · pojazdy u Kuby: RTV-1 Scout 350 g, HTV-6 Mastodon 900 g`);
  P('');

  // ===== 4. the index =====
  P('## 4. Indeks: gdzie użyć każdego materiału');
  P('');
  P('| Materiał | Objętość | Użycie |');
  P('|---|---|---|');
  for (const [k, a] of [...uses].sort((x, y) => N(x[0]).localeCompare(N(y[0])))) P(`| ${N(k)} | ${BULK[k]?.[1] ?? '?'} L | ${a.join('; ')} |`);
  P('');
  // what has no use yet (only sold at markets, eaten, or not at all)
  const all: ItemKey[] = [...GOODS, ...RARES.map((r) => r.k), ...(Object.values(CROPS).map((c) => c.out)), 'log', 'stone', 'ironO', 'copperO', 'scrap', 'circuit', 'pcore', ...Object.values(DROPS).flatMap((d) => d.map(([k]) => k))];
  const idle = [...new Set(all)].filter((k) => !uses.has(k));
  P('## 5. Surowce bez zastosowania w budowach i przetwarzaniu (na razie)');
  P('');
  P('Te rzeczy można tylko sprzedać (na targu albo kowalowi/Janowi), zjeść albo przewieźć w kontraktach:');
  P('');
  P(idle.map(N).join(', ') + '.');
  P('');
  P('## 6. Klasy przedmiotów');
  P('');
  P('Hierarchia z dokumentu „Surowce, przemysł, komponenty i technologie” (pkt 9); klasa jest też w podpowiedzi przedmiotu w grze.');
  P('');
  const CLASS_PL: Record<ItemClass, string> = { raw: 'RAW · surowce', food: 'FOOD / AGRICULTURE · żywność i uprawy', material: 'MATERIAL · materiały', industrial: 'INDUSTRIAL · komponenty przemysłowe', electrical: 'ELECTRICAL / ELECTRONIC · elektryka i elektronika', advanced: 'ADVANCED · zaawansowane', aerospace: 'AEROSPACE · program kosmiczny' };
  for (const c of Object.keys(CLASS_PL) as ItemClass[]) {
    const ks = (Object.keys(ITEMS) as ItemKey[]).filter((k) => classOf(k) === c);
    P(`- **${CLASS_PL[c]}:** ${ks.length ? ks.map(N).join(', ') : '(jeszcze nic)'}`);
  }
  P('');
  writeFileSync(new URL('../SUROWCE.md', import.meta.url), out.join('\n'));
  void ([] as Good[]);
});
