# Ruined-city vaults

Each large city has four cyan `VAULT 1`–`VAULT 4` entrances on clear street locations, separated by at least 35% of the city's radius. Approach on foot and press E (or the ENTER touch button). Each entrance has a distinct, labyrinth of at most three floors. Floors 1 and 2 have one marked downward staircase in the starting room; floor 3 has none. Upstairs returns one floor at a time, then to that entrance, including after saving and reloading underground.

Entrance placement is deterministic from the world seed and uses existing city layouts without moving streets, buildings or wrecks. IDs start at 2^32, outside the signed 32-bit region POI namespace. Dungeon seeds use a separate salt so these IDs cannot alias existing ruin seeds. Save and multiplayer location keys preserve the full ID; ordinary ruin IDs and dungeon seeds remain unchanged.

Automated coverage checks all cities in three worlds for entrance count, separation, clear arrival space, world/local coordinates, ID resolution after JSON round-trip, distinct dungeon seeds, and an unlocked route to the surface in the new vaults. The full dungeon suite also checks surface-exit reachability across many seeds.

Browser checks to perform: find a city using the developer map, visit multiple cyan entrances, enter with E, return via the surface stairs, reload while underground and return again. Repeat in multiplayer and across the planet's wrap seam. These checks require a running browser and were not performed by the automated suite.


As of 0.114.0 stairwells use 25 cm fractional solids in addition to the metre voxel grid. They participate in player movement, collision and weapon rays. Headless tests exercise actual player physics in both directions without jump input.

Stationary ancient defences in labyrinths and ship interiors use `data/mountedturrets.ts` (mount/spec and combat constants), `gen/mountedturrets.ts` (deterministic surface-supported placement, separate RNG namespace), and `world/mountedturrets.ts` (reusable model, combat and lifecycle). They warn for 0.8 seconds, fire every 0.45 seconds within 24 metres with clear sight, and have 32 health and absorb half of incoming damage (64 raw damage to destroy). Progress IDs start at 1,000,000 in the existing per-dungeon killed list, separate from guardian indices. Each client applies turret attacks to its own player; destruction uses shared world progress. Partial turret damage is runtime only. Player placement/crafting of these mounted variants remains future work.

Geometry verification confirms each staircase is batched into two draw objects (330 triangles and 396 line segments), with its rendered world bounds matching the physics bounds in all four orientations. Browser F3 frame-rate checks and manual combat/playthrough checks remain unperformed.

Version 0.114.1 replaces the runtime walking robot guards in ship interiors with anchored wall/floor/ceiling guns. The housing and mounting brace stay fixed; only the aiming head rotates. Existing room, loot and guardian indices are preserved.
