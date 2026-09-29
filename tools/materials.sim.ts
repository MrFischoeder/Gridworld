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
import { RARES } from '../src/gen/deposits';
import { INSTALLS, INSTALL_STAGES, INSTALL_WORK, type InstallKind } from '../src/gen/installs';
import { STAGES, CHARIOT } from '../src/gen/shuttle';
import { ORDERS } from '../src/data/orders';
import { MENU } from '../src/gen/foodshop';
import { DROPS } from '../src/data/creatures';
import { ROBOTS } from '../src/data/robots';
import { TECH_BY_ID } from '../src/gen/tech';
import { HOUSE_PRICE } from '../src/data/npcs';
import { FUEL, CHIPS } from '../src/gen/contracts';
import { OWN, HALL } from '../src/gen/hall';

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
  P(`**Zasada magazynu:** wszystko, co wioska buduje (mury, zakłady, elektrownie, farmy, ulepszenia, zamówienia u kowala), bierze materiały z **hali magazynowej wioski** (Village Hall, ${HALL.vol} L pojemności), a nie z plecaka. Do hali trafiają: to, co tam złożysz przy terminalu, oraz własne towary wioski (produkcja jej zakładu i plony farm, do ${OWN.cap} skrzyń każdego).`);
  P('');
  P('Spis: 1. Surowce · 2. Przetwarzanie · 3. Budowy · 4. Indeks: gdzie użyć każdego materiału');
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
  P(`| ${N('circuit')} | roboty (strażnicy, wartownicy, konstrukty), skrzynie we wrakach |`);
  P(`| ${N('pcore')} | rzadko: drony naprawcze, wartownicy, konstrukty; skrzynie we wrakach |`);
  for (const [cr, drops] of Object.entries(DROPS)) for (const [k] of drops) P(`| ${N(k)} | stworzenie: ${cr[0].toUpperCase() + cr.slice(1)} (upolowane) |`);
  P(`| ${N('cap')}, ${N('pod')}, ${N('ncrys')} | grzyby w lesie, drzewa z owocami, kryształy w podziemiach (jedzenie) |`);
  P('');
  P('### 1.2 Towary, które wioski wydobywają i wytwarzają same');
  P('');
  P('Każda wioska ma jeden rodzaj zakładu i robi 1–2 towary z jego listy. Towary trafiają do jej hali; kupujesz je na targu, dostajesz w udziale od starszego (za zaufanie) albo przewozisz w kontraktach.');
  P('');
  P('| Towar | Cena bazowa | Surowy? | Kto go robi |');
  P('|---|---|---|---|');
  for (const g of GOODS.filter((x) => !GOOD_INFO[x].proc)) {
    const who = (Object.keys(INDUSTRY) as Industry[]).filter((k) => INDUSTRY[k].pool.includes(g)).map((k) => INDUSTRY_PL[k]);
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
  for (const k of Object.keys(INSTALL_WORK) as InstallKind[]) {
    const w = INSTALL_WORK[k]!, name = INSTALLS.find((s) => s.k === k)!.name;
    P(`- **${name}:** ${list(w.inp)} → 1 × ${N(w.out)} co ${w.batch / 60} h gry`);
    for (const [i] of w.inp) use(i, `przetwarzanie: ${name} → ${N(w.out)}`);
  }
  P(`- **Old Radar Station:** nic nie produkuje; odkrywa na mapie wszystko w promieniu 12 km.`);
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
  P('### 3.8 Wielkie instalacje (odbudowa w 3 etapach, materiały z plecaka i bagażnika)');
  P('');
  for (const k of Object.keys(INSTALL_STAGES) as InstallKind[]) {
    const name = INSTALLS.find((s) => s.k === k)!.name;
    P(`**${name}**`);
    INSTALL_STAGES[k].forEach((st, i) => { P(`${i + 1}. ${st.title}: ${list(st.needs)}${tech(st.tech)} · nagroda ${st.gold} g`); for (const [m] of st.needs) use(m, `odbudowa: ${name}`); });
    P('');
  }
  P(`### 3.9 ${CHARIOT} (Rydwan w hangarze przy Gridholm)`);
  P('');
  for (const st of STAGES) { P(`- **${st.name}:** ${list(st.needs)}`); for (const [g] of st.needs) use(g, `Rydwan: ${st.name}`); }
  P('');
  P('### 3.10 Naprawy (materiały z plecaka)');
  P('');
  for (const [k, p] of Object.entries(POWER)) { P(`- **${p.name}:** ${list(p.fix)}`); for (const [i] of p.fix) use(i, `naprawa: ${p.name}`); void k; }
  for (const k of Object.keys(INDUSTRY) as Industry[]) { P(`- **${INDUSTRY[k].site}** (${INDUSTRY_PL[k]}): ${list(INDUSTRY[k].fix)}`); for (const [i] of INDUSTRY[k].fix) use(i, `naprawa: ${INDUSTRY[k].site}`); }
  P('');
  P('### 3.11 Za złoto');
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
  writeFileSync(new URL('../SUROWCE.md', import.meta.url), out.join('\n'));
  void ([] as Good[]);
});
