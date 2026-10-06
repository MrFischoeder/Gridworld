// A village at a glance (pure): the six numbers of the owner's design (people, workers at work, free workers, homes,
// food security, development) and what holds its growth back. Worked out from the shared village state alone, so
// every player sees the same.
import { progressive, development, housingCapacity, SETTLEMENT_START } from './settlement';
import { peopleAt, targetNow, workersAt } from './people';
import { assign, type Post } from './workforce';
import { foodMade, foodNeed, peopleFed, settleTarget, FOOD } from './farms';
import type { TownState } from './town';

/** What each development level is called (gen/settlement.ts `development`, 0–6). */
export const DEV_NAMES = ['Ruined camp', 'Farmstead', 'Hamlet', 'Village', 'Working village', 'Busy village', 'Thriving settlement'];
export type FoodState = 'short' | 'tight' | 'secure';
export interface VillageStats {
  /** Settled under the new rules (the rest keep their old, fixed population rules). */
  settled: boolean;
  people: number; target: number; housing: number;
  workers: number; assigned: number; free: number; jobs: number; posts: Post[];
  /** Food a game day (crate value): grown, eaten; how many the farms feed; the state and days of food in the stores. */
  food: { made: number; need: number; fed: number; ratio: number; state: FoodState; days: number };
  development: number; devName: string;
  /** Why it does not grow (or '' while it does / is full). */
  limit: string;
}
/** `stored` = crate value of food in the village's stores (gen/hall.ts stock), for the days of reserve; `power` = what the farms' pumps got (gen/energy.ts farmPower). */
export function villageStats(seed: number, home: boolean, s: TownState | undefined, now: number, stored = 0, power = 1): VillageStats {
  const settled = progressive(s), people = peopleAt(seed, home, s, now), workers = workersAt(seed, home, s, now);
  const a = assign(s, workers), dev = development(s);
  const made = settled ? foodMade(seed, s, workers, power) * 24 : 0, need = settled ? foodNeed(people) * 24 : 0;
  const ratio = need > 0 ? made / need : made > 0 || people <= SETTLEMENT_START ? Infinity : 0;
  const state: FoodState = ratio < FOOD.short ? 'short' : ratio < FOOD.margin ? 'tight' : 'secure';
  const target = Math.round(targetNow(seed, home, s)), housing = settled ? housingCapacity(s) : Math.round(people);
  let limit = '';
  if (settled) {
    const fedAll = peopleFed(seed, s, Math.floor(housing * 0.6), power), best = settleTarget(seed, s, power);
    if (best >= housing) limit = Math.round(people) >= housing ? 'Every home is taken: develop the village so more houses are repaired.' : '';
    else if ((s?.farms ?? 0) === 0) limit = 'No farms: only the few who live off the wilds stay.';
    else if (SETTLEMENT_START + (fedAll - SETTLEMENT_START) / FOOD.margin < housing) limit = 'Not enough food for more families: build or improve farms, or grow food crops instead of flax and wool.';
    else limit = 'Too few hands to work the farms for more people.';
  }
  return {
    settled, people, target, housing, workers, assigned: a.used, free: a.free, jobs: a.jobs, posts: a.posts,
    food: { made, need, fed: settled ? peopleFed(seed, s, workers, power) : people, ratio, state, days: need > 0 ? stored / need : Infinity },
    development: dev, devName: DEV_NAMES[Math.max(0, Math.min(6, dev))], limit,
  };
}
