# Ruined-city vaults

Each large city has four cyan `VAULT 1`–`VAULT 4` entrances on clear street locations, separated by at least 35% of the city's radius. Approach on foot and press E (or the ENTER touch button). Each entrance has a distinct, labyrinth of at most three floors. Floors 1 and 2 have one E-operated descent in the starting room; floor 3 has none. Upstairs returns one floor at a time, then to that entrance, including after saving and reloading underground.

Entrance placement is deterministic from the world seed and uses existing city layouts without moving streets, buildings or wrecks. IDs start at 2^32, outside the signed 32-bit region POI namespace. Dungeon seeds use a separate salt so these IDs cannot alias existing ruin seeds. Save and multiplayer location keys preserve the full ID; ordinary ruin IDs and dungeon seeds remain unchanged.

Automated coverage checks all cities in three worlds for entrance count, separation, clear arrival space, world/local coordinates, ID resolution after JSON round-trip, distinct dungeon seeds, and an unlocked route to the surface in the new vaults. The full dungeon suite also checks surface-exit reachability across many seeds.

Browser checks to perform: find a city using the developer map, visit multiple cyan entrances, enter with E, return via the surface stairs, reload while underground and return again. Repeat in multiplayer and across the planet's wrap seam. These checks require a running browser and were not performed by the automated suite.
