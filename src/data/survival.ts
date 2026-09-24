// Survival numbers: stamina (effort), food and water. Pure data and rules; world/survival.ts runs them.

/** Stamina: spent by sprinting, sword swings, jumping and swimming; comes back when you ease off. */
export const STAMINA = {
  max: 100,
  /** Points per second back, after a short pause (REGEN_DELAY) since you last spent any. */
  regen: 20, regenDelay: 0.8,
  sprint: 14, swim: 7, jump: 6,
  /** One sword swing. */
  swing: 22,
  /** At 0 you are exhausted until stamina is back up to this. */
  recover: 30,
};

/** The blade hits hard but costs stamina; exhausted, every swing is slow and weak whatever your gear says. */
export const BLADE = { dmg: 5, rate: 0.42, tiredRate: 1.15, tiredDmg: 0.5 };

/**
 * Water, 0..100, drained over game time (a game hour is a real minute): it runs out after about 16 game hours,
 * faster during hard effort (sprinting, swimming, fighting with the blade).
 */
export const DRAIN = { water: 100 / (16 * 60), effort: 1.6 };
/** Below LOW water you feel it (slower stamina, a warning); at 0 you start losing health. */
export const LOW = 20, STARVE_DPS = 0.5;

/**
 * Energy: the calories your body has in store (char.kcal). A body at rest burns `perDay` in a game day; walking,
 * sprinting, swimming, jumping, swinging the blade and carrying a heavy load burn more. Below `low` you are hungry
 * (stamina comes back slower); at 0 you are starving and lose health. More than `max` cannot be stored.
 */
export const KCAL = { max: 3000, start: 2400, low: 500, perDay: 2000 };
/** Burn rate multipliers by activity, and one-off costs (kcal). */
export const BURN = { walk: 1.6, sprint: 4, swim: 4, jump: 5, swing: 4, /** extra burn per kg carried */ perKg: 0.02 };
/**
 * The stomach holds `cap` kg of food and digests `digest` kg a game hour. Food fills it by its weight (data/items
 * BULK), so light, rich food (roasted meat, crystals, bread) feeds you far better than bulky fruit or mushrooms:
 * eat a pile of those and you are full long before you have eaten enough.
 */
export const STOMACH = { cap: 2, digest: 0.3 };

/** Kcal burnt per game minute at an activity level (1 = at rest) carrying `kg`. */
export const burnPerMin = (activity: number, kg: number) => KCAL.perDay / 1440 * activity * (1 + kg * BURN.perKg);
/** Why you cannot eat a food of `kg` now ('' = you can): the stomach is too full, or you are not hungry at all. */
export function cantEat(kg: number, kcal: number, stomach: number): '' | 'full' | 'sated' {
  if (kcal >= KCAL.max - 50) return 'sated';
  if (stomach + kg > STOMACH.cap + 1e-6) return 'full';
  return '';
}

/** What eating and drinking give: calories, water and a little health. */
export const NOURISH: Record<string, { kcal?: number; water?: number; hp?: number }> = {
  bread: { kcal: 1000, hp: 5 },
  stew: { kcal: 650, water: 10, hp: 15 },
  waterF: { water: 40 },
  waterM: { water: 25 },
  meatR: { kcal: 600 },
  meatC: { kcal: 750, hp: 10 },
  cap: { kcal: 45, water: 6 },
  pod: { kcal: 220, water: 18 },
  ncrys: { kcal: 700, hp: 10 },
};
/** Edible things (plants' fruit, food pickups) are drawn in this lime. */
export const FOOD_COLOR = 0xd8ff7a;
/** Raw meat: the chance it makes you sick, and how much that hurts. */
export const RAW_SICK = { chance: 0.4, hp: 8 };

/**
 * Edible plants (gen/flora.ts, world/flora.ts): what one harvest yields and how many game minutes it takes to grow
 * back (a game day is 1440 minutes). The Fruit Pod Tree gives as many pods as hang on it.
 */
export const FORAGE = {
  shroom: { item: 'cap', min: 2, max: 4, regrow: 12 * 60 },
  pod: { item: 'pod', min: 0, max: 0, regrow: 24 * 60 },
  crys: { item: 'ncrys', min: 1, max: 2, regrow: 48 * 60 },
} as const;
export type ForageKind = keyof typeof FORAGE;
/** A campfire lit from a Fire Kit burns this long (real seconds). */
export const FIRE_LIFE = 240;
/** Drinking straight from a clean well or lake, per sip. */
export const SIP = { fresh: 25, murky: 15 };

/**
 * Sleeping in your bed (world/home.ts): at night (from `night` o'clock until `dawn`) you sleep through to `wake`
 * o'clock; by day you take a nap of `nap` game minutes. Asleep the body burns `burn` of its resting rate and dries
 * out at `water` of the waking rate; a night's sleep heals you fully, a nap `napHeal` of your health.
 */
export const SLEEP = { night: 20, dawn: 6, wake: 7, nap: 120, burn: 0.85, water: 0.5, napHeal: 0.5 };
/** How long (game minutes) you sleep when you lie down at game time `t`, and whether it is a full night. */
export function sleepSpan(t: number): { min: number; night: boolean } {
  const day = 1440, now = ((t % day) + day) % day, h = now / 60;
  if (h >= SLEEP.night || h < SLEEP.dawn) { const wake = SLEEP.wake * 60; return { min: (wake - now + day) % day, night: true }; }
  return { min: SLEEP.nap, night: false };
}
