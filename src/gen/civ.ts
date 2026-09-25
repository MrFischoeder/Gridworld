// Civilisation on top of village life (gen/growth.ts), pure and deterministic: real goods, development tiers,
// upkeep, what people consume, a shared market, and the regional projects of the Ancients. Not in the game yet;
// tools/civ.sim.ts runs a whole world with it to see whether every material has buyers everywhere (not only the
// Chariot at Gridholm) and how much the villages manage on their own versus with players about.
//
// The ideas it tests:
// - Tiers: a village grows to its tier's housing (`TIERS[t].cap`) and must gather goods to rise (settlement →
//   town → city → metropolis). Higher tiers consume more kinds of goods every day and pay for upkeep in parts.
// - Works: towns and cities build processing works by the margins on the market (steel, cable, boards, alloy…).
// - Projects: ~20 wonders of the Ancients spread over the continent, one per region round an anchor village; its
//   villages chip in goods. The last stage of every project (and the top tier) needs relics that only come out of
//   ruins and wrecks, which only players fetch: villages carry the everyday economy, players unlock the peaks.
import { hash } from '../core/rng';
import { newLife, stepLife, lifeInfo, type LifeState, type LifePlace, type LifeMarket } from './growth';

export type Mat =
  | 'timber' | 'ore' | 'copper' | 'coal' | 'crude' | 'sand' | 'salt' | 'bauxite' | 'sulfur' | 'lithium' | 'rareearth' | 'uranium'
  | 'tools' | 'cloth' | 'meds' | 'fuel'
  | 'steel' | 'copperbar' | 'plastic' | 'glass' | 'cable' | 'boards' | 'parts' | 'alloy' | 'propellant' | 'aluminium' | 'batteries'
  | 'relic';
export type MatKind = 'raw' | 'rare' | 'made' | 'proc' | 'exotic';
export const MAT: Record<Mat, { base: number; kind: MatKind; name: string }> = {
  timber: { base: 24, kind: 'raw', name: 'Timber' }, ore: { base: 36, kind: 'raw', name: 'Iron Ore' }, copper: { base: 48, kind: 'raw', name: 'Copper Ore' },
  coal: { base: 22, kind: 'raw', name: 'Coal' }, crude: { base: 40, kind: 'raw', name: 'Crude Oil' }, sand: { base: 18, kind: 'raw', name: 'Sand' }, salt: { base: 30, kind: 'raw', name: 'Salt' },
  bauxite: { base: 45, kind: 'rare', name: 'Bauxite' }, sulfur: { base: 40, kind: 'rare', name: 'Sulfur' }, lithium: { base: 90, kind: 'rare', name: 'Lithium' },
  rareearth: { base: 120, kind: 'rare', name: 'Rare Earths' }, uranium: { base: 200, kind: 'rare', name: 'Uranium' },
  tools: { base: 68, kind: 'made', name: 'Tools' }, cloth: { base: 44, kind: 'made', name: 'Cloth' }, meds: { base: 85, kind: 'made', name: 'Medicine' }, fuel: { base: 72, kind: 'made', name: 'Fuel' },
  steel: { base: 140, kind: 'proc', name: 'Steel' }, copperbar: { base: 175, kind: 'proc', name: 'Copper Bars' }, plastic: { base: 120, kind: 'proc', name: 'Plastic' },
  glass: { base: 90, kind: 'proc', name: 'Glass' }, cable: { base: 120, kind: 'proc', name: 'Cable' }, boards: { base: 480, kind: 'proc', name: 'Circuit Boards' },
  parts: { base: 400, kind: 'proc', name: 'Machine Parts' }, alloy: { base: 680, kind: 'proc', name: 'Hull Alloy' }, propellant: { base: 170, kind: 'proc', name: 'Propellant' },
  aluminium: { base: 260, kind: 'proc', name: 'Aluminium' }, batteries: { base: 520, kind: 'proc', name: 'Batteries' },
  relic: { base: 900, kind: 'exotic', name: 'Relic of the Ancients' },
};
export const MATS = Object.keys(MAT) as Mat[];
type Bag = Partial<Record<Mat, number>>;

/** Processing: what a works turns into what (one batch). */
export const RECIPES: { out: Mat; n: number; in: Bag }[] = [
  { out: 'steel', n: 1, in: { ore: 2, coal: 1 } }, { out: 'copperbar', n: 1, in: { copper: 2, coal: 1 } },
  { out: 'glass', n: 1, in: { sand: 2, coal: 1 } }, { out: 'fuel', n: 1, in: { crude: 1 } },
  { out: 'plastic', n: 1, in: { crude: 1, sulfur: 1 } }, { out: 'cable', n: 2, in: { copperbar: 1 } },
  { out: 'parts', n: 1, in: { steel: 2 } }, { out: 'tools', n: 3, in: { steel: 1, timber: 1 } },
  { out: 'aluminium', n: 1, in: { bauxite: 3, coal: 1 } }, { out: 'boards', n: 1, in: { cable: 1, plastic: 1, rareearth: 1 } },
  { out: 'alloy', n: 1, in: { steel: 2, aluminium: 1, copperbar: 1 } }, { out: 'batteries', n: 1, in: { lithium: 2, aluminium: 1 } },
  { out: 'propellant', n: 1, in: { fuel: 1, sulfur: 1 } },
];
/** Development tiers: the housing a village may reach, what it takes to rise to the next, what it consumes per 100 people a day. */
export const TIERS: { name: string; cap: number; rise: Bag; use: Bag; plants: number }[] = [
  { name: 'Settlement', cap: 160, rise: { steel: 8, glass: 8, tools: 8, timber: 20 }, use: { timber: 1, tools: 0.2, cloth: 0.4 }, plants: 2 },
  { name: 'Town', cap: 380, rise: { steel: 20, parts: 8, cable: 16, glass: 16, aluminium: 10, boards: 4 },
    use: { timber: 1, tools: 0.25, cloth: 0.5, glass: 0.3, fuel: 0.6, meds: 0.2, parts: 0.08 }, plants: 3 },
  { name: 'City', cap: 800, rise: { alloy: 10, batteries: 8, boards: 12, aluminium: 20, uranium: 6, relic: 3 },
    use: { timber: 1, tools: 0.25, cloth: 0.6, glass: 0.4, fuel: 0.8, meds: 0.3, parts: 0.15, boards: 0.1, plastic: 0.3, cable: 0.3, batteries: 0.08, aluminium: 0.15 }, plants: 4 },
  { name: 'Metropolis', cap: 1600, rise: {},
    use: { timber: 1, tools: 0.3, cloth: 0.7, glass: 0.5, fuel: 1, meds: 0.4, parts: 0.25, boards: 0.2, plastic: 0.4, cable: 0.4, batteries: 0.15, aluminium: 0.25, alloy: 0.08, uranium: 0.06 }, plants: 5 },
];
/** Batches a works runs a day, what it costs to build and keep, parts it wears out. */
export const WORKS = { batches: 5, cost: 260, upkeep: 3, wear: { parts: 0.05, cable: 0.03 } as Bag };
/** Units a village's extraction (its life works) digs per works per day with every job filled. */
export const DIG = 7;

export const PROJECT_NAMES = ['Sunward Beacon', 'Deep Engine', 'Glass Spire', 'Star Well', 'Iron Choir', 'Warden Pylon', 'Sky Loom', 'Old Reactor',
  'Signal Tower', 'Stone Heart', 'Rain Mill', 'Night Lantern', 'Gate of Ash', 'Echo Dish', 'Cold Forge', 'High Aerial', 'Sand Clock', 'Storm Mast',
  'Root Engine', 'Last Lighthouse'];
export interface Project {
  name: string; anchor: number; danger: number;
  /** Village indices whose region it is (each village belongs to its nearest project). */
  members: number[];
  stages: Bag[]; stage: number; given: Bag;
  /** Day each stage was finished. */
  doneAt: number[];
  /** Players only (the Chariot): villages do not give to it. */
  playersOnly?: boolean;
}
/** The three stages of a regional project (scaled up with the danger round it), the rare it wants from its own land. */
function projectStages(danger: number, rare: Mat): Bag[] {
  const k = 1 + danger * 0.08, sc = (b: Bag): Bag => Object.fromEntries(Object.entries(b).map(([m, n]) => [m, Math.round(n! * k)]));
  return [sc({ steel: 60, glass: 40, timber: 80, tools: 30 }), sc({ parts: 40, cable: 60, aluminium: 40, [rare]: 40 }), sc({ alloy: 30, boards: 30, batteries: 15, relic: 12 })];
}
/** The Chariot of the Ancients at Gridholm (gen/shuttle.ts STAGES), in these goods. */
export const CHARIOT_STAGES: Bag[] = [{ alloy: 12, steel: 20 }, { parts: 16, alloy: 8, cable: 10 }, { boards: 14, cable: 12, glass: 6 }, { glass: 24, alloy: 4, plastic: 6 }, { propellant: 30 }];

export interface CivVillage {
  name: string; place: LifePlace; life: LifeState;
  x: number; z: number;
  tier: number;
  /** What its land yields (from its industry, plus a rare deposit further out). */
  dig: Mat[];
  /** Its processing works (recipe outputs). */
  plants: Mat[];
  /** Goods gathered towards the next tier. */
  toward: Bag;
  project: number;
  unmet: number; wanted: number;
}
export interface Pool { stock: Record<Mat, number>; price: Record<Mat, number> }
export interface CivWorld {
  day: number; villages: CivVillage[]; projects: Project[]; chariot: Project; pool: Pool;
  /** Tallies for the report. */
  made: Record<Mat, number>; used: Record<string, Record<Mat, number>>;
  players: { n: number; purse: number; relics: number; delivered: number };
  /** Works a village's region paid for. */
  invested: number;
}
export interface CivSeed { name: string; x: number; z: number; industry: string; place: LifePlace; home?: boolean }

const zeroMats = () => Object.fromEntries(MATS.map((m) => [m, 0])) as Record<Mat, number>;
const INDUSTRY_DIG: Record<string, Mat[]> = {
  farm: ['cloth'], mine: ['coal', 'ore', 'copper', 'sand'], oil: ['crude'], refinery: ['fuel'], lumber: ['timber'],
  fishery: ['salt', 'sand'], workshop: ['tools', 'cloth'], salvage: ['meds'],
};
/** A rare deposit, likelier and richer further out (the dangerous land is where the rare things are). */
function rareOf(seed: number, danger: number): Mat | null {
  if ((hash(seed, 0xa11) % 1000) / 1000 > Math.min(0.6, 0.1 + 0.07 * danger)) return null;
  const opts: [Mat, number][] = [['bauxite', 30], ['sulfur', 30], ['lithium', danger >= 1.5 ? 18 : 0], ['rareearth', danger >= 2.5 ? 14 : 0], ['uranium', danger >= 4 ? 9 : 0]];
  let r = hash(seed, 0xa12) % opts.reduce((a, [, w]) => a + w, 0);
  for (const [m, w] of opts) if ((r -= w) < 0) return m;
  return 'bauxite';
}

/** A world of villages at day 0, its regional projects (farthest-point anchors, each village joining its nearest) and the Chariot. */
export function newCiv(seeds: CivSeed[], players = 0, nProjects = 20): CivWorld {
  const villages: CivVillage[] = seeds.map((s) => {
    const mine = INDUSTRY_DIG[s.industry] ?? ['timber'], dig = s.industry === 'mine' ? [mine[hash(s.place.seed, 1) % 4], mine[hash(s.place.seed, 2) % 4]] : [...mine];
    const rare = rareOf(s.place.seed, s.place.danger);
    if (rare) dig.push(rare);
    const life = newLife(s.place);
    life.popCap = TIERS[0].cap;
    return { name: s.name, place: s.place, life, x: s.x, z: s.z, tier: 0, dig: [...new Set(dig)], plants: [], toward: {}, project: -1, unmet: 0, wanted: 0 };
  });
  // anchors: spread over the continent by farthest-point sampling (Gridholm keeps the Chariot, not a project)
  const home = seeds.findIndex((s) => s.home), anchors: number[] = [];
  const dist = (a: CivVillage, b: CivVillage) => Math.hypot(a.x - b.x, a.z - b.z);
  const first = villages.reduce((best, v, i) => (i !== home && (best < 0 || hash(v.place.seed, 0x51) < hash(villages[best].place.seed, 0x51)) ? i : best), -1);
  anchors.push(first);
  while (anchors.length < Math.min(nProjects, villages.length - 1)) {
    let bi = -1, bd = -1;
    villages.forEach((v, i) => { if (i === home || anchors.includes(i)) return; const d = Math.min(...anchors.map((a) => dist(v, villages[a]))); if (d > bd) { bd = d; bi = i; } });
    anchors.push(bi);
  }
  const projects: Project[] = anchors.map((a, k) => {
    const v = villages[a], rare = (['bauxite', 'sulfur', 'lithium', 'rareearth'] as Mat[])[hash(v.place.seed, 0x77) % 4];
    return { name: PROJECT_NAMES[k % PROJECT_NAMES.length], anchor: a, danger: v.place.danger, members: [], stages: projectStages(v.place.danger, rare), stage: 0, given: {}, doneAt: [] };
  });
  villages.forEach((v, i) => {
    let bk = 0, bd = Infinity;
    projects.forEach((p, k) => { const d = dist(v, villages[p.anchor]); if (d < bd) { bd = d; bk = k; } });
    v.project = bk; projects[bk].members.push(i);
  });
  const chariot: Project = { name: 'Chariot of the Ancients', anchor: Math.max(0, home), danger: 0, members: [], stages: CHARIOT_STAGES, stage: 0, given: {}, doneAt: [], playersOnly: true };
  const stock = zeroMats(), price = zeroMats();
  for (const m of MATS) { stock[m] = MAT[m].kind === 'exotic' ? 0 : MAT[m].kind === 'proc' ? 10 : 30; price[m] = MAT[m].base; }
  return { day: 0, villages, projects, chariot, pool: { stock, price }, made: zeroMats(), used: {}, invested: 0, players: { n: players, purse: 0, relics: 0, delivered: 0 } };
}

// ---------- the market ----------
const TARGET: Record<MatKind, number> = { raw: 80, rare: 40, made: 50, proc: 30, exotic: 10 };
/** Take up to n of m from the market, paid from `gold` (buying dearer than the price); returns [taken, cost]. */
function buy(w: CivWorld, m: Mat, n: number, gold: number, keep = 0): [number, number] {
  const unit = w.pool.price[m] * 1.08, can = Math.max(0, (gold - keep) / unit), take = Math.max(0, Math.min(n, w.pool.stock[m], can));
  w.pool.stock[m] -= take;
  return [take, take * unit];
}
const sell = (w: CivWorld, m: Mat, n: number) => { w.pool.stock[m] += n; w.made[m] += n; return n * w.pool.price[m] * 0.92; };
const use = (w: CivWorld, why: string, m: Mat, n: number) => { const u = (w.used[why] ??= zeroMats()); u[m] += n; };
function reprice(w: CivWorld) {
  for (const m of MATS) {
    const t = TARGET[MAT[m].kind], r = (w.pool.stock[m] + 3) / t;
    w.pool.price[m] = MAT[m].base * Math.max(0.25, Math.min(5, Math.pow(r, -0.6)));
    if (MAT[m].kind !== 'exotic') w.pool.stock[m] *= 0.994; // what leaves the region (other lands, spoilage)
  }
}

// ---------- a day ----------
const margin = (w: CivWorld, r: (typeof RECIPES)[number]) => r.n * w.pool.price[r.out] - Object.entries(r.in).reduce((a, [m, n]) => a + n! * w.pool.price[m as Mat] * 1.08, 0);
/** The goods-price factor a village's life works earn at (what it digs is worth on the market today). */
const goodsFactor = (w: CivWorld, v: CivVillage) => Math.max(0.7, Math.min(1.8, v.dig.reduce((a, m) => a + w.pool.price[m] / MAT[m].base, 0) / Math.max(1, v.dig.length)));

function villageDay(w: CivWorld, vi: number) {
  const v = w.villages[vi], s = v.life, info = lifeInfo(s, v.place), T = TIERS[v.tier];
  // 1. digging: the village's works bring up what its land holds (the gold for it is in the life model's works)
  const dug = s.built.works * info.staff * DIG;
  // people dig less of what nobody buys (they turn to other work): the output follows the price
  for (const m of v.dig) sell(w, m, dug / v.dig.length * Math.min(1, 0.15 + w.pool.price[m] / MAT[m].base));
  // 2. works: run while the margin pays and the inputs are on the market
  for (const out of v.plants) {
    const r = RECIPES.find((x) => x.out === out)!;
    for (let b = 0; b < WORKS.batches; b++) {
      const cost = Object.entries(r.in).reduce((a, [m, n]) => a + n! * w.pool.price[m as Mat] * 1.08, 0);
      if (margin(w, r) <= 0 || cost > s.gold || Object.entries(r.in).some(([m, n]) => w.pool.stock[m as Mat] < n!)) break;
      for (const [m, n] of Object.entries(r.in)) { const [, c] = buy(w, m as Mat, n!, Infinity); s.gold -= c; use(w, 'works', m as Mat, n!); }
      s.gold += sell(w, r.out, r.n);
    }
    s.gold = Math.max(0, s.gold - WORKS.upkeep);
    for (const [m, n] of Object.entries(WORKS.wear)) { const [t, c] = buy(w, m as Mat, n!, s.gold); s.gold -= c; use(w, 'upkeep', m as Mat, t); }
  }
  // 3. what the people use every day (unmet wants sour the mood)
  let want = 0, got = 0;
  for (const [m, per] of Object.entries(T.use)) {
    const n = per! * s.pop / 100; want += n;
    const [t, c] = buy(w, m as Mat, n, s.gold, 0); s.gold -= c; got += t; use(w, 'people', m as Mat, t);
  }
  v.wanted += want; v.unmet += want - got;
  if (want > 0) s.happy = Math.max(0, Math.min(1, s.happy + (got / want > 0.9 ? 0.01 : -0.02 * (1 - got / want))));
  // 4. rising to the next tier once the village fills its houses
  if (v.tier < TIERS.length - 1 && s.pop > T.cap * 0.85) {
    let left = 0;
    for (const [m, n] of Object.entries(T.rise)) {
      const have = v.toward[m as Mat] ?? 0, need = n! - have; if (need <= 0) continue;
      if (MAT[m as Mat].kind === 'exotic') { left += need; continue; } // relics come from players (see playersDay)
      const [t, c] = buy(w, m as Mat, Math.ceil(need * 0.25), s.gold, 120); s.gold -= c; v.toward[m as Mat] = have + t; use(w, 'tiers', m as Mat, t); left += need - t;
    }
    if (left <= 0) { v.tier++; v.toward = {}; s.popCap = TIERS[v.tier].cap; s.bonus = { gold: (s.bonus?.gold ?? 0) + 0.12, happy: (s.bonus?.happy ?? 0) + 0.02 }; }
  }
  // 5. a new works when the tier allows and the treasury can spare it: the best margin on today's market
  // a poor village can have its works paid for by the richest in its region (the region invests in itself)
  const region = w.projects[v.project].members.map((i) => w.villages[i]);
  const patron = s.gold > WORKS.cost + 120 ? null : region.filter((o) => o !== v && o.life.gold > 2500).sort((a, b) => b.life.gold - a.life.gold)[0];
  if (v.plants.length < TIERS[v.tier].plants && (s.gold > WORKS.cost + 120 || patron) && info.jobless + s.pop * 0.1 > 4) {
    // what pays best, but what the village (its next tier, its region's project) needs counts extra
    const p = w.projects[v.project], needs = new Set([...Object.keys(TIERS[v.tier].rise), ...Object.keys(p.stages[p.stage] ?? {})]);
    // …and a works is only worth it if its inputs are there (on the market or dug at home) and not every village
    // is already making the same thing (otherwise they all build what paid best yesterday and starve each other)
    const makers = (o: Mat) => w.villages.reduce((a, x) => a + (x.plants.includes(o) ? 1 : 0), 0);
    const inputs = (r: (typeof RECIPES)[number]) => Math.min(1, ...Object.entries(r.in).map(([m, n]) => (v.dig.includes(m as Mat) ? 1 : Math.min(1, w.pool.stock[m as Mat] / (n! * WORKS.batches * 6)))));
    const score = (r: (typeof RECIPES)[number]) => margin(w, r) * (needs.has(r.out) ? 2.5 : 1) * inputs(r) * (Object.keys(r.in).some((m) => v.dig.includes(m as Mat)) ? 1.5 : 1) / (1 + makers(r.out) / 3);
    const best = RECIPES.filter((r) => !v.plants.includes(r.out)).map((r) => ({ r, m: score(r) })).sort((a, b) => b.m - a.m)[0];
    if (best && best.m > 0) { v.plants.push(best.r.out); if (patron) { patron.life.gold -= WORKS.cost; w.invested++; } else s.gold -= WORKS.cost; }
  }
  // 6. giving to the region's project
  const p = w.projects[v.project];
  if (v.tier >= 1 && s.gold > 350 && p.stage < p.stages.length) give(w, p, v.tier * 2 + 1, (n) => { const g = s.gold; s.gold -= n; return g; }, s.gold - 250);
}
/** Buy the most lacking goods of a project's current stage (not relics) and hand them over. */
function give(w: CivWorld, p: Project, n: number, pay: (cost: number) => number, budget: number) {
  const st = p.stages[p.stage];
  const lacking = (Object.entries(st) as [Mat, number][]).filter(([m, k]) => MAT[m].kind !== 'exotic' && (p.given[m] ?? 0) < k).sort((a, b) => (a[1] - (p.given[a[0]] ?? 0)) - (b[1] - (p.given[b[0]] ?? 0))).reverse();
  for (const [m, k] of lacking) {
    if (n <= 0 || budget <= 0) break;
    const [t, c] = buy(w, m, Math.min(n, k - (p.given[m] ?? 0)), budget);
    if (!t) continue;
    pay(c); budget -= c; n -= t; p.given[m] = (p.given[m] ?? 0) + t; use(w, p.playersOnly ? 'chariot' : 'projects', m, t);
  }
  finishStage(w, p);
}
function finishStage(w: CivWorld, p: Project) {
  const st = p.stages[p.stage];
  if (!st || (Object.entries(st) as [Mat, number][]).some(([m, k]) => (p.given[m] ?? 0) < k)) return;
  p.doneAt.push(w.day); p.stage++; p.given = {};
  for (const i of p.members) {
    const v = w.villages[i], b = (v.life.bonus ??= { gold: 0, happy: 0 });
    if (p.stage === 1) b.happy += 0.03;
    if (p.stage === 2) b.gold += 0.08;
    if (p.stage === 3) { b.happy += 0.05; v.place.danger = Math.max(0, v.place.danger - 1.5); } // the region is safer round a working wonder
  }
}
/** Players: they fetch relics from ruins, haul goods for the Chariot and hand relics to the stages that need them. */
function playersDay(w: CivWorld) {
  const P = w.players;
  if (!P.n) return;
  P.purse += 180 * P.n;           // what they earn trading and hauling
  let relics = 2 * P.n;           // what they bring out of ruins and wrecks a day
  P.relics += relics;
  // the Chariot first: players buy its goods on the market (competing with the villages)
  if (w.chariot.stage < w.chariot.stages.length) give(w, w.chariot, 12 * P.n, (c) => (P.purse -= c), P.purse);
  // relics: to the project nearest its relic stage being done, then to cities that need them for their tier
  const want = w.projects.filter((p) => p.stage === 2).sort((a, b) => (b.given.relic ?? 0) - (a.given.relic ?? 0));
  for (const p of want) {
    if (!relics) break;
    const need = (p.stages[2].relic ?? 0) - (p.given.relic ?? 0), t = Math.min(need, relics);
    p.given.relic = (p.given.relic ?? 0) + t; relics -= t; P.delivered += t; use(w, 'projects', 'relic', t);
    // and they haul some of the stage's other goods too
    give(w, p, 6 * P.n, (c) => (P.purse -= c), P.purse * 0.3);
    finishStage(w, p);
  }
  for (const v of w.villages) {
    if (!relics) break;
    const need = (TIERS[v.tier].rise.relic ?? 0) - (v.toward.relic ?? 0);
    if (need > 0 && v.life.pop > TIERS[v.tier].cap * 0.85) { const t = Math.min(need, relics); v.toward.relic = (v.toward.relic ?? 0) + t; relics -= t; P.delivered += t; use(w, 'tiers', 'relic', t); }
  }
  if (relics) sell(w, 'relic', relics); // the rest goes on the market
}

/** One game day for the whole world: 24 hours of life for every village, then the goods, the projects, the players. */
export function civDay(w: CivWorld) {
  for (const v of w.villages) {
    const m: LifeMarket = { food: 1, goods: goodsFactor(w, v) };
    for (let h = 0; h < 24; h++) stepLife(v.life, v.place, m);
  }
  const n = w.villages.length, start = w.day % n; // a different village shops first each day
  for (let k = 0; k < n; k++) villageDay(w, (start + k) % n);
  playersDay(w);
  reprice(w);
  w.day++;
}
