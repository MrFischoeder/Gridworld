// (0.182) The rules a world follows, read from its seed alone so every generator, worker and player agrees without
// any extra state. Worlds with a negative seed are the new worlds of PLAN_PLACOWEK.md (stage O1): about 20 towns
// instead of a hundred villages, roads only between them, and the deposits lying out in the wilds as places of their
// own. Worlds with a seed of 0 or more keep the rules they were made with.

/** A new world: few towns, deposits in the wilds (PLAN_PLACOWEK.md). */
export const townsWorld = (world: number) => world < 0;
/** How a new world's seed is rolled (on the client; the server rolls its own the same way). Not part of generation. */
export const newWorldSeed = () => -(SHAPED.lo + Math.floor(Math.random() * (SHAPED.hi - SHAPED.lo)));
/** (0.233, PLAN_BIOMOW.md stage B3) Worlds made from this version on have seeds in this band (negated): their biomes
 *  shape the land (dunes, swamps with pools...). Older towns worlds (-1 .. -999 999) and editor worlds keep their land. */
export const SHAPED = { lo: 1_000_000, hi: 999_000_000 };
export const shapedWorld = (world: number) => world <= -SHAPED.lo && world > -SHAPED.hi;
