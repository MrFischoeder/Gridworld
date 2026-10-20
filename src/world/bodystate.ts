// (0.234) What the cold or the heat does to you now (world/bodyheat.ts writes it): multipliers read by world/survival.ts
// and world/player.ts. Its own module so they need not import the temperature's runtime (and its chain of imports).
export const BODY_FX = { kcal: 1, water: 1, regen: 1, effort: 1, speed: 1 };
