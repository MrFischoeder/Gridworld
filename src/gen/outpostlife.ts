// (0.185, PLAN_PLACOWEK.md stage O4) People and food at the outposts. Bunkhouses give beds, fields grow food by the
// land's fertility (gen/fertility.ts), and the pantry holds what the fields make and what the players bring. Settlers
// come on their own while there are free beds and food to spare, eat every day, work the fields first and then the
// extraction (a full crew digs half again as fast), and go away when the food runs out. An outpost with two bunkhouses,
// two fields, a power source and 16 people has become a hamlet.
//
// Pure and deterministic from the shared `outposts`: the life is stepped on whole two-hour marks (`LIFE.step`), so
// whenever and on whichever game it is settled, the result is the same. Food or a build added between two marks counts
// from the next one.
import type { ItemKey } from '../data/items';
import { FOOD } from './farms';
import { fertility } from './fertility';
import { hash } from '../core/rng';
import { PORT, turretsOf, type OutpostLife, type OutpostState } from './outposts';

export const LIFE = {
  /** Game minutes a step; the longest catch-up (older life is skipped to it). */
  step: 120, catchup: 60 * 24 * 60,
  /** Beds a bunkhouse; people a field needs; food units a field makes a day at fertility 1 with its full crew. */
  beds: 8, fieldCrew: 3, field: 4,
  /** Food units a person eats a day (the villages' share); the pantry (units) in the open and with a storage shed. */
  eat: FOOD.eat, pantry: 30, shed: 90,
  /** Settlers come one in so many steps while welcome; when hungry, this share leaves a step (at least half a person). */
  arrive: 0.25, leave: 0.1,
  /** Days of food (for one more mouth) the pantry must hold, or the fields must make with this margin, to draw a settler. */
  reserve: 2, margin: 1.1,
  /** The dig crew: a full one adds `boost` to the digging. */
  digCrew: 6, boost: 0.5,
  /** A hamlet: bunkhouses, fields, power and people. */
  hamlet: { bunks: 2, field: 2, people: 16 },
};

/** (0.186, stage O5) Animals at an outpost without even a stake fence: the share of the fields they trample, the daily
 *  chance they get into the pantry and the share they eat then. */
export const PESTS = { trample: 0.25, pantry: 0.25, eat: 0.2 };
/** Food units a crate of k is worth to the pantry (0 = not food). */
export const foodValue = (k: ItemKey) => FOOD.value[k] ?? 0;
export const bedsOf = (o: OutpostState) => (o.n?.bunks ?? 0) * LIFE.beds;
export const pantryOf = (o: OutpostState) => (o.done?.store || o.done?.port || o.k === 'camp' ? LIFE.shed : LIFE.pantry);
const fresh = (t: number): OutpostLife => ({ t, n: 0, food: 0, fed: 1 });
const mark = (t: number) => Math.floor(t / LIFE.step) * LIFE.step;

/** How the people are put to work: the fields' crews first, (0.221, stage Z7) then a guard at each turret, then the
 *  dig (or, 0.216, a port's warehouse crew). */
export function crews(o: OutpostState, people: number, extra = commuters(o)) {
  const n = Math.floor(people), fields = o.n?.field ?? 0, need = fields * LIFE.fieldCrew;
  const work = workCap(o), walk = Math.min(work, Math.max(0, Math.floor(extra))); // (0.220) commuters from a nearby village work the post first
  const farm = Math.min(n, need), guard = Math.min(n - farm, turretsOf(o)), mine = Math.min(n - farm - guard, work - walk), dig = walk + mine;
  return { farm, guard, dig, idle: n - farm - guard - mine, walk, farmFill: need ? farm / need : 0, digFill: work ? dig / work : 0 };
}
/** The crew the outpost's work post wants: the dig, a port's crane, (0.218) a crew camp's old plant. */
export const workCap = (o: OutpostState) => (o.done?.dig ? LIFE.digCrew : o.done?.port ? PORT.crew : o.k === 'camp' ? o.cw ?? 0 : 0);
/** (0.220, PLAN_PRAD_I_LUDZIE.md stage Z6) How many commuters from a nearby village work at the outpost now (gen/commute.ts);
 *  set by the game from the shared `towns` (world/commute.ts); unset (tests, workers): none. */
let commuteHook: ((o: OutpostState) => number) | null = null;
export const setCommuteHook = (f: typeof commuteHook) => { commuteHook = f; };
export const commuters = (o: OutpostState) => (commuteHook ? commuteHook(o) : 0);
/** Food units the fields make a day with these people (fertility f). */
export const foodMade = (o: OutpostState, people: number, f: number) => (o.n?.field ?? 0) * LIFE.field * f * crews(o, people).farmFill * (o.n?.wall ? 1 : 1 - PESTS.trample);
/** Food units the people eat a day. */
export const foodEaten = (people: number) => Math.floor(people) * LIFE.eat;

/** The life at `now` (stepped to the last whole mark), without writing. */
export function lifeNow(world: number, o: OutpostState, now: number, fert?: number): OutpostLife {
  const end = mark(now), L: OutpostLife = { ...(o.life ?? fresh(end)) };
  if (L.t < end - LIFE.catchup) L.t = mark(end - LIFE.catchup);
  if (L.t >= end) return L;
  const beds = bedsOf(o), cap = pantryOf(o), f = fert ?? fertility(world, o.x, o.z), k = LIFE.step / 1440;
  const done = !!o.done?.power && (o.n?.bunks ?? 0) >= LIFE.hamlet.bunks && (o.n?.field ?? 0) >= LIFE.hamlet.field;
  for (; L.t < end; L.t += LIFE.step) {
    const made = foodMade(o, L.n, f) * k, eat = foodEaten(L.n) * k, have = L.food + made;
    L.fed = eat > 0 ? Math.min(1, have / eat) : 1;
    L.food = Math.min(cap, Math.max(0, have - eat));
    if (!o.n?.wall && L.t % 1440 === 0 && L.food > 0 && hash(world, o.x | 0, o.z | 0, L.t / 1440, 0x0a61) % 1000 < PESTS.pantry * 1000) L.food *= 1 - PESTS.eat; // the beasts got into the pantry
    if (L.fed < 1) L.n = Math.max(0, L.n - Math.max(0.5, L.n * LIFE.leave)); // hungry: some go away
    else if (L.n + 1 <= beds) { // welcome: free beds, food to spare
      const more = Math.floor(L.n) + 1, day = more * LIFE.eat;
      if (L.food >= day * LIFE.reserve || foodMade(o, more, f) >= day * LIFE.margin) L.n = Math.min(beds, L.n + LIFE.arrive);
    }
    L.n = Math.min(L.n, beds);
    if (!L.v && done && L.n >= LIFE.hamlet.people) L.v = L.t + LIFE.step;
  }
  return L;
}
/** Bring the life forward to `now` (writes `o.life`; only once there are beds or fields). */
export function settleLife(world: number, o: OutpostState, now: number) {
  if (!o.n?.bunks && !o.n?.field && !o.life) return;
  o.life = lifeNow(world, o, now);
}
/** Load up to n crates of food k into the pantry (after settling); how many went in. */
export function loadFood(world: number, o: OutpostState, k: ItemKey, n: number, now: number): number {
  const v = foodValue(k);
  if (!v) return 0;
  settleLife(world, o, now);
  const L = (o.life ??= fresh(mark(now))), m = Math.max(0, Math.min(n, Math.floor((pantryOf(o) - L.food) / v)));
  L.food += m * v;
  return m;
}
/** What the people add to the digging (1 with no dig crew, up to 1 + `boost`). */
export function crewFactor(o: OutpostState): number {
  const L = o.life;
  if (!L) return commuters(o) ? 1 + LIFE.boost * crews(o, 0).digFill : 1; // (0.220) commuters alone, fed at home
  const w = crews(o, L.n), own = w.dig - w.walk, cap = workCap(o);
  return 1 + LIFE.boost * (cap ? (w.walk + own * L.fed) / cap : 0); // the settlers' share as fed as they are, the commuters' whole
}
/** Has it become a hamlet? */
export const isHamlet = (o: OutpostState) => !!o.life?.v;
