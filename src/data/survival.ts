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
 * Food and water, 0..100, drained over game time (a game hour is a real minute). Water runs out after about
 * 16 game hours, food after about 30. Hard effort (sprinting, fighting with the blade) drains both faster.
 */
export const DRAIN = { water: 100 / (16 * 60), food: 100 / (30 * 60), effort: 1.6 };
/** Below LOW you feel it (slower stamina, a warning); at 0 you start losing health. */
export const LOW = 20, STARVE_DPS = 0.5;

/** What eating and drinking give: food, water and a little health. */
export const NOURISH: Record<string, { food?: number; water?: number; hp?: number }> = {
  bread: { food: 30, hp: 5 },
  stew: { food: 55, water: 10, hp: 15 },
  waterF: { water: 40 },
  waterM: { water: 25 },
};
/** Drinking straight from a clean well or lake, per sip. */
export const SIP = { fresh: 25, murky: 15 };
