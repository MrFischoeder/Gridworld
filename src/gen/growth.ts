// Village life (pure, deterministic): people, food, gold and buildings that grow on their own. A village's people
// eat, work the buildings and live in houses; farms feed them, works earn gold from exports, guards cost wages,
// every building costs upkeep that rises with the village's size, so growth has no hard cap but slows by itself.
// A simple governor spends the treasury by priorities (food, housing, jobs, defence, storage) every few hours.
// Bandit raids (hashed from the seed and the day) take gold, food and lives from villages that cannot hold them.
//
// Nothing here is wired into the game yet: tools/growth.sim.ts runs every village of a world for months of game
// time to tune the numbers first. On the multiplayer server `stepLife` is the per-village tick (hourly), and a
// village far from any player can be caught up in one go (`runLife`).
import { hash } from '../core/rng';

export type LifeBuilding = 'house' | 'farm' | 'works' | 'granary' | 'barracks' | 'market';
/** What the governor leans towards (the elder's focus; players will set it). */
export type LifeFocus = 'balanced' | 'food' | 'industry' | 'defence';

export const LIFE = {
  /** Food eaten per person per day. */
  eat: 1,
  /** Share of the people who can work. */
  workShare: 0.6,
  /** Food a person without a job gathers per day (foraging, gardens). */
  forage: 0.45,
  /** Births per person per day with room, food and a happy village (logistic, to the housing). */
  growth: 0.025,
  /** Share of the people lost per day while the granary is empty. */
  starve: 0.05,
  /** Share leaving per day while the village is unhappy. */
  leave: 0.012,
  /** Newcomers per day while a happy village has free houses. */
  settlers: 0.6,
  /** Nobody leaves a village below this. */
  minPop: 12,
  /** Base price of a unit of food on the market (gold). */
  foodPrice: 2,
  /** Wage per guard per day, and what it costs to take one on. */
  guardWage: 2.5, guardHire: 20,
  /** Guards the hall itself can house. */
  hallGuards: 4,
  /** Food the village holds without a granary. */
  storeBase: 220,
  /** Hours between the governor's decisions. */
  decideEvery: 6,
  /** Gold the governor keeps back for bad days. */
  reserve: 80,
  /** Upkeep grows by this share for every building the village has (the soft limit on growth). */
  sprawl: 0.025,
  /** Wall tiers the governor can raise to (gen/village.ts WALL_TIERS) and their price. */
  wallMax: 2, wallCost: [0, 600, 1500],
};

export interface BuildSpec {
  name: string; cost: number; days: number;
  /** Gold per day at the base size (see `LIFE.sprawl`). */
  upkeep: number;
  jobs?: number; housing?: number; store?: number; guards?: number;
  /** Food per day with every job filled (farms; × the land's fertility). */
  food?: number;
  /** Gold per day with every job filled (works: exports; the n-th works earns `fall`^(n-1) of the first). */
  gold?: number;
}
export const LIFE_BUILD: Record<LifeBuilding, BuildSpec> = {
  house: { name: 'House', cost: 90, days: 1, upkeep: 0.4, housing: 10 },
  farm: { name: 'Farm', cost: 140, days: 2, upkeep: 1, jobs: 6, food: 26 },
  works: { name: 'Works', cost: 220, days: 3, upkeep: 2, jobs: 8, gold: 40 },
  granary: { name: 'Granary', cost: 120, days: 1.5, upkeep: 0.5, store: 260 },
  barracks: { name: 'Barracks', cost: 180, days: 2, upkeep: 1, guards: 6 },
  market: { name: 'Market Hall', cost: 200, days: 2, upkeep: 1, jobs: 3 },
};
/** Each further works earns this share of the one before (the markets for one village's goods fill up). */
export const WORKS_FALL = 0.88;
/** A market hall sells food and goods this much dearer and buys food this much cheaper (diminishing per hall). */
export const MARKET_EDGE = 0.1;

export interface LifeState {
  /** Game hours since the start of the run. */
  t: number;
  pop: number; food: number; gold: number; guards: number;
  /** 0..1: fed, housed, safe, paid. */
  happy: number;
  built: Record<LifeBuilding, number>;
  /** The building going up, and how many hours it still needs. */
  building: { k: LifeBuilding; left: number } | null;
  /** Wall tier (0 stake fence .. 2 stone). */
  wall: number;
  focus: LifeFocus;
  /** Game day of the last lost raid (-1 never). */
  lostAt: number;
  /** Tallies (for reports): raids won / lost, food bought / sold, gold earned, spent on building. */
  log: { won: number; lost: number; bought: number; sold: number; earned: number; spent: number; starvedDays: number; razed: number };
}
/** What never changes about a village (from the world generators). */
export interface LifePlace {
  seed: number;
  /** Danger of the land round it (gen/danger.ts ringDanger), 0..8. */
  danger: number;
  /** The land's fertility (farms, gen/industry.ts), ~0.6..1.6. */
  fertility: number;
  /** Does its industry feed people (farm / fishery) rather than earn? */
  foodIndustry: boolean;
}
/** The world outside the village this hour: market prices as multipliers of the base (set by the server). */
export interface LifeMarket { food: number; goods: number }

const emptyBuilt = (): Record<LifeBuilding, number> => ({ house: 0, farm: 0, works: 0, granary: 0, barracks: 0, market: 0 });

/** A village as it starts: a few dozen people, a couple of fields, a works if its industry earns. */
export function newLife(p: LifePlace): LifeState {
  const pop = 28 + (hash(p.seed, 0x11fe) % 18), built = emptyBuilt();
  built.house = Math.ceil(pop / 10) + 1;
  built.farm = p.foodIndustry ? 2 : 1;
  built.works = p.foodIndustry ? 0 : 1;
  return { t: 0, pop, food: 120, gold: 180, guards: 2, happy: 0.6, built, building: null, wall: 0, focus: 'balanced', lostAt: -1,
    log: { won: 0, lost: 0, bought: 0, sold: 0, earned: 0, spent: 0, starvedDays: 0, razed: 0 } };
}

/** Everything the numbers of a village follow from, right now. */
export function lifeInfo(s: LifeState, p: LifePlace) {
  const b = s.built, B = LIFE_BUILD;
  const count = Object.values(b).reduce((a, n) => a + n, 0);
  const jobs = b.farm * B.farm.jobs! + b.works * B.works.jobs! + b.market * B.market.jobs!;
  const workers = Math.floor(s.pop * LIFE.workShare), staff = jobs ? Math.min(1, workers / jobs) : 0, jobless = Math.max(0, workers - jobs);
  const housing = b.house * B.house.housing!, store = LIFE.storeBase + b.granary * B.granary.store!;
  const guardSlots = LIFE.hallGuards + b.barracks * B.barracks.guards!;
  const edge = 1 + MARKET_EDGE * (1 - Math.pow(0.6, b.market));
  const foodMade = b.farm * B.farm.food! * staff * (p.foodIndustry ? p.fertility : Math.min(1, p.fertility)) + jobless * LIFE.forage;
  const foodNet = foodMade - s.pop * LIFE.eat;
  // works: each one earns a little less than the one before
  let worksGold = 0;
  for (let i = 0; i < b.works; i++) worksGold += B.works.gold! * Math.pow(WORKS_FALL, i);
  worksGold *= staff * edge;
  const sprawl = 1 + LIFE.sprawl * count;
  const upkeep = (Object.keys(b) as LifeBuilding[]).reduce((a, k) => a + b[k] * B[k].upkeep, 0) * sprawl + s.guards * LIFE.guardWage;
  return { count, jobs, workers, staff, jobless, housing, store, guardSlots, edge, foodNet, worksGold, upkeep, sprawl };
}

/** A raid's strength against the village's hold, by the danger round it and its wealth. */
export function raidOdds(s: LifeState, p: LifePlace): { chance: number; strength: number; hold: number } {
  const loot = 0.35 + Math.min(1.15, (s.gold + s.food * LIFE.foodPrice * 0.3) / 600); // bandits go where there is something to take
  const chance = p.danger < 0.5 ? 0 : (0.02 + 0.01 * p.danger) * loot;   // per day
  const strength = 1 + p.danger * 0.55 + Math.min(2, s.gold / 800);      // rich villages draw bigger bands
  const hold = 1.2 + s.wall * 1.8 + s.guards * 0.6 + s.happy;
  return { chance, strength, hold };
}

/** The governor: what to build (or hire) next, by the village's needs and its focus. Null = save up. */
/**
 * A village losing money for days on end pulls down what pays least: an extra market hall, the last works, a farm
 * it does not need, a spare granary or empty houses. Returns what it would pull down (or null).
 */
export function shrink(s: LifeState, p: LifePlace, m: LifeMarket = { food: 1, goods: 1 }): LifeBuilding | null {
  const i = lifeInfo(s, p), b = s.built;
  const balance = i.worksGold * m.goods + Math.max(0, i.foodNet) * LIFE.foodPrice * m.food * 0.9 - i.upkeep;
  // food nobody wants: plough a field under when the market is glutted and the village grows far more than it eats
  if (m.food < 0.7 && i.foodNet > s.pop * 0.3 && b.farm > 2) return 'farm';
  if (balance >= 0 || s.gold > LIFE.reserve) return null;
  if (s.guards > 0) return null; // guards go first (see stepLife), buildings after
  if (b.market > Math.floor(b.works / 4)) return 'market';
  if (i.jobs > i.workers && b.works > 1) return 'works';
  if (i.foodNet > s.pop * 0.35 && b.farm > 1) return 'farm';
  if (b.granary > 1 && s.food < i.store * 0.4) return 'granary';
  if (s.pop < i.housing - 25 && b.house > 2) return 'house';
  if (b.works > 1) return 'works';
  return null;
}
export function decide(s: LifeState, p: LifePlace, m: LifeMarket = { food: 1, goods: 1 }): LifeBuilding | 'guard' | 'wall' | null {
  const i = lifeInfo(s, p), day = Math.floor(s.t / 24), threatened = s.lostAt >= 0 && day - s.lostAt < 12;
  const want: (LifeBuilding | 'guard' | 'wall')[] = [];
  const foodDays = s.food / Math.max(1, s.pop * LIFE.eat);
  const hungry = i.foodNet < 0 || foodDays < 3;
  if (hungry) want.push(i.jobless > 0 || i.staff >= 0.95 ? 'farm' : 'house');
  if (s.pop > i.housing * 0.88) want.push('house');
  if (threatened || p.danger >= 3) {
    if (s.guards < i.guardSlots && s.guards < 2 + p.danger) want.push('guard');
    else if (s.guards >= i.guardSlots && s.guards < 2 + p.danger) want.push('barracks');
  }
  if ((threatened || p.danger >= 4) && s.wall < LIFE.wallMax) want.push('wall');
  if (i.jobless > 5) want.push(i.foodNet < s.pop * 0.15 && m.food > 0.8 ? 'farm' : 'works');
  if (s.food > i.store * 0.85 && i.foodNet > 0 && s.built.granary < Math.ceil(s.built.farm / 2)) want.push('granary');
  if (s.built.works >= 3 && s.built.market < s.built.works / 4) want.push('market');
  // an idle treasury grows the village: more houses (people), then more works
  if (!want.length && s.gold > 600) want.push(s.pop > i.housing * 0.7 ? 'house' : 'works');
  // the focus moves its favourite to the front when it is wanted at all
  const fav: Record<LifeFocus, (LifeBuilding | 'guard' | 'wall')[]> = { balanced: [], food: ['farm', 'granary'], industry: ['works', 'market'], defence: ['guard', 'wall', 'barracks'] };
  want.sort((a, b) => (fav[s.focus].includes(b) ? 1 : 0) - (fav[s.focus].includes(a) ? 1 : 0));
  const hungryFirst = hungry && want[0] !== 'farm' && want.includes('farm') ? ['farm' as const] : [];
  // the day's balance: what the village earns over what it pays (food sold at today's price counts)
  const balance = i.worksGold * m.goods + Math.max(0, i.foodNet) * LIFE.foodPrice * m.food * 0.9 - i.upkeep;
  /** Does a building pay its way (its own upkeep and the extra it adds to everyone else's)? */
  const pays = (k: LifeBuilding) => {
    const B = LIFE_BUILD[k], more = B.upkeep * i.sprawl + (i.upkeep - s.guards * LIFE.guardWage) / i.sprawl * LIFE.sprawl;
    let gain = 0;
    if (k === 'works') gain = B.gold! * Math.pow(WORKS_FALL, s.built.works) * Math.min(1, (i.workers - i.jobs + B.jobs!) / B.jobs!) * i.edge * m.goods;
    if (k === 'farm') gain = B.food! * p.fertility * LIFE.foodPrice * m.food * 0.9;
    if (k === 'market') gain = (i.worksGold * m.goods) * MARKET_EDGE * Math.pow(0.6, s.built.market);
    return balance + gain - more > 0;
  };
  for (const w of [...hungryFirst, ...want]) {
    const essential = w === 'guard' || w === 'wall' || (w === 'farm' && hungry) || (w === 'house' && s.pop > i.housing);
    if (!essential && !pays(w as LifeBuilding)) continue;
    const cost = w === 'guard' ? LIFE.guardHire : w === 'wall' ? LIFE.wallCost[s.wall + 1] : LIFE_BUILD[w].cost;
    if (s.gold - cost >= (w === 'guard' ? 0 : LIFE.reserve)) return w;
    if (w === 'farm' && hungry) return null; // save for the farm rather than spend on anything else
  }
  return null;
}

/**
 * One hour of a village's life. `m` is the market this hour; returns the food it bought (-) or sold (+) so the
 * server can move the prices of the whole world.
 */
export function stepLife(s: LifeState, p: LifePlace, m: LifeMarket): number {
  const dt = 1 / 24, i = lifeInfo(s, p), day = Math.floor(s.t / 24);
  // food and gold
  s.food += i.foodNet * dt;
  const earned = i.worksGold * m.goods * dt;
  s.gold += earned - i.upkeep * dt; s.log.earned += earned;
  if (s.gold < 0) { // cannot pay: guards walk off, people grumble
    s.gold = 0;
    if (s.guards > 0 && hash(p.seed, s.t, 0x9a1d) % 6 === 0) s.guards--;
    s.happy = Math.max(0, s.happy - 0.15 * dt);
  }
  // trade food once a day: sell the overflow, buy when the granary runs low
  let traded = 0;
  if (s.t % 24 === 12) {
    const price = LIFE.foodPrice * m.food;
    const keep = Math.min(i.store, s.pop * LIFE.eat * 5 + 40); // sell what is beyond five days' need (or the granary)
    if (s.food > keep) { const n = s.food - keep; s.food = keep; s.gold += n * price * 0.9 * i.edge; s.log.sold += n; traded += n; }
    const need = s.pop * LIFE.eat * 3 - s.food;
    if (need > 0) {
      const afford = Math.max(0, Math.floor((s.gold - 10) / (price * 1.2 / i.edge))), n = Math.min(need, afford);
      if (n > 0) { s.food += n; s.gold -= n * price * 1.2 / i.edge; s.log.bought += n; traded -= n; }
    }
  }
  // people
  if (s.food <= 0) {
    s.food = 0; s.pop -= s.pop * LIFE.starve * dt;
    if (s.t % 24 === 0) s.log.starvedDays++;
  } else if (s.pop < i.housing) {
    const room = 1 - s.pop / i.housing, mood = Math.max(0, (s.happy - 0.35) / 0.65);
    s.pop += (LIFE.growth * s.pop * room * mood + (s.happy > 0.6 ? LIFE.settlers : 0)) * dt;
  }
  if (s.happy < 0.35) s.pop -= s.pop * LIFE.leave * dt;
  if (s.pop > i.housing * 1.15) s.pop -= (s.pop - i.housing * 1.15) * 0.2 * dt; // the overcrowded move on
  s.pop = Math.max(LIFE.minPop, s.pop);
  // mood eases towards how things are
  const foodDays = s.food / Math.max(1, s.pop * LIFE.eat);
  const target = 0.45 + (foodDays > 2 ? 0.2 : foodDays > 0 ? 0 : -0.35) + (s.pop <= i.housing ? 0.1 : -0.15)
    + Math.min(0.15, s.guards * 0.03) - (s.lostAt >= 0 && day - s.lostAt < 6 ? 0.2 : 0) + (s.gold > 0 ? 0.05 : -0.1);
  s.happy += (Math.max(0, Math.min(1, target)) - s.happy) * 0.25 * dt; // a quarter of the way in a day
  // building
  if (s.building && (s.building.left -= 1) <= 0) { s.built[s.building.k]++; s.building = null; }
  // raids: at most one a day, rolled at dawn
  if (s.t % 24 === 5) {
    const r = raidOdds(s, p);
    if ((hash(p.seed, day, 0x7a1d) % 10000) / 10000 < r.chance) {
      const luck = 0.7 + (hash(p.seed, day, 0x7a1e) % 1000) / 1000 * 0.6;
      if (r.hold * luck >= r.strength) { s.log.won++; if (s.guards > 0 && hash(p.seed, day, 0x7a1f) % 3 === 0) s.guards--; }
      else { s.log.lost++; s.lostAt = day; s.gold *= 0.8; s.food *= 0.85; s.pop *= 0.98; s.happy = Math.max(0, s.happy - 0.2); if (s.guards > 0) s.guards--; }
    }
  }
  // the governor
  if (s.t % 24 === 18) { // once a day: a village losing money lets a guard go, then pulls down what pays least
    const i2 = lifeInfo(s, p), balance = i2.worksGold * m.goods + Math.max(0, i2.foodNet) * LIFE.foodPrice * m.food * 0.9 - i2.upkeep;
    if (balance < 0 && s.gold <= LIFE.reserve && s.guards > (p.danger >= 3 ? 1 : 0)) s.guards--;
    const k = shrink(s, p, m);
    if (k) { s.built[k]--; s.log.razed++; }
  }
  if (s.t % LIFE.decideEvery === 0 && !s.building) {
    const w = decide(s, p, m);
    if (w === 'guard') { s.gold -= LIFE.guardHire; s.guards++; }
    else if (w === 'wall') { const c = LIFE.wallCost[s.wall + 1]; s.gold -= c; s.log.spent += c; s.wall++; }
    else if (w) { const spec = LIFE_BUILD[w]; s.gold -= spec.cost; s.log.spent += spec.cost; s.building = { k: w, left: Math.round(spec.days * 24) }; }
  }
  s.t++;
  return traded;
}

/** Catch a village up by `hours` (a far village the server has not ticked, or a save loaded after a while). */
export function runLife(s: LifeState, p: LifePlace, hours: number, m: LifeMarket = { food: 1, goods: 1 }) {
  for (let h = 0; h < hours; h++) stepLife(s, p, m);
}
