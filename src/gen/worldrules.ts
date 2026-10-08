// (0.182) The rules a world follows, read from its seed alone so every generator, worker and player agrees without
// any extra state. Worlds with a negative seed are the new worlds of PLAN_PLACOWEK.md (stage O1): about 20 towns
// instead of a hundred villages, roads only between them, and the deposits lying out in the wilds as places of their
// own. Worlds with a seed of 0 or more keep the rules they were made with.

/** A new world: few towns, deposits in the wilds (PLAN_PLACOWEK.md). */
export const townsWorld = (world: number) => world < 0;
/** How a new world's seed is rolled (on the client; the server rolls its own the same way). Not part of generation. */
export const newWorldSeed = () => -(1 + Math.floor(Math.random() * 999999));
