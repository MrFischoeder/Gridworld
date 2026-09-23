# GridWorld — project rules

Browser FPS in a green vector-grid style (wireframe on black, retro sci-fi / Tron / CRT terminal).
`legacy/grid-arena.html` is the original single-file version (from when the game was called Grid Arena), kept as the reference for behaviour.

## Commands
- `npm run dev` — dev server (Vite)
- `npm test` — Vitest (generators, terrain, saves)
- `npm run typecheck` / `npm run build`
- Dev console: ~ (Backquote) opens it in every build (`ui/console.ts`): `cash` (+10000 gold), `god` (full health + immortality, toggle), `home` (back to Gridholm), `help`, `clear`. Add commands to `COMMANDS` there.
- In a dev build, `window.__game` exposes `{ G, W, camera, scene, renderer }` for debugging; F3 toggles the perf overlay (fps, lines, triangles, draw calls).

## Rules
- **Stack:** Vite + TypeScript (strict), three.js from npm. No UI framework: HUD and windows are plain DOM + CSS.
- **Game language: English.** Every player-visible text (HUD, menus, dialogue, items, hints) is English. Identifiers and comments in English.
- **Deterministic generation:** the whole world (dungeons, villages, terrain, ruins, object placement) comes only from seeded RNG (`core/rng.ts`: `rng`, `hash`, noise). Generators **never** call `Math.random()`. `Math.random()` is allowed only for effects and unsaved things (sparks, drone loot, NPC wandering). Same seed + same coordinates = identical result. This is the basis of saves and future multiplayer.
- **Save only player changes** (opened chests, killed bosses, unlocked doors, position, character) — never generated geometry.
- **Visual style:** grid lines `#2fe060`, black background, fog to black. Every solid that should hide what is behind it needs a dark fill (e.g. `0x010d04`, see `fillMat()` in `world/render.ts`) with `polygonOffset`, lines on top. Lines without a fill are see-through — a bug, unless the object is meant to be openwork (drones, bosses, pickups).
- **Functional colours:** drones and hostile creatures `#ffb347` (a calm Bramble is olive `#b8b060`), bosses `#ff6a4a`, gold/chests `#ffd060`, stairwells `#5cc8ff`, XP `#9dffe0`, locked doors `#ff5a3c`.
- **Controls:** desktop (pointer lock, WASD, mouse) and touch (joystick, buttons) must work at all times.
- **Performance:** smooth on an average laptop and phone. Measure line/triangle counts (F3) on big changes.
- **Map format:** voxel maps are ordered op lists `{op:'room'|'solid', x,y,z,w,h,d}` (later ops override earlier). The future map editor will save this format — keep it.
- **Multiplayer later** (up to 8 players, Node + WebSocket, authoritative server): keep world logic (`core/`, `gen/`) free of three.js and DOM, generators deterministic, game state serialisable.

## Layout
- `core/` — pure: RNG/hash, voxel grids, meshing, noise.
- `gen/` — pure generators: dungeon, stairs, village, doors placement, reachability; open world: `regions` (256 m regions, POIs), `terrain` (heightfield, flattening), `roads`, `ruins`, `trees`.
- `world/` — runtime with three.js: player, doors/stairs, enemies, loot, NPCs, `level` (loading places, transitions), `overworld` (chunk streaming, structures, field enemies).
- `ui/` — DOM: HUD, minimap, `worldmap` (surface minimap + M map), backpack, dialogue, menu, input, touch.

## Open world notes
- Regions (rx, rz) span [rx*256-128, rx*256+128); region (0,0) holds Gridholm at the origin. New place types = new `PoiType` + a placement rule in `gen/regions.ts`.
- Line styles: dungeons keep the original 1 m grid on every face; surface structures use the outline style (`meshVoxels(..., outline)`: folds and edges, 2 m floor tiles, 4 m wall seams). Decorative non-voxel shapes (roofs, lookouts, gate arches, rocks) go through `PropBatch` — collision stays on voxels.
- Terrain LOD: chunks more than 2 chunks away draw grid lines every 4 m instead of 2 m. Distant mountains (`world/sky.ts`) are a fog-free ring that follows the camera.
- Structures are `VoxelGrid.surface(...)` grids: their footprint replaces the terrain (terrain mesh has a hole there, collision uses voxels only).
- Dungeon seeds: `hash(world, ruinId, depth, gx, gz)`; save keys `ruinId:depth:gx:gz`. Save format v3 (`gridWorld.character.v3`; older `gridArena.*` keys are still read), migrations in `save.ts`.
- Vehicles (`data/vehicles.ts` specs incl. price and `enclosed`, `world/vehicles.ts` models/driving): RTV-1 Scout and HTV-6 Mastodon. Bought from Mirek, the dealer at the yard outside Gridholm's north gate (`YARD` in `gen/vehicles.ts`, first free bay), or found abandoned in the wilds (`regionVehicle`, deterministic per region, id `found:rx:rz`; claimed on first use, trunk loot rolled then). Seats: driver = seat 1, the rest wait for multiplayer. Only closed cabs (`enclosed`) shield the driver from drone contact damage (`foeRules.shielded`). Vehicles stay out of the village and ruins. Owned ones are saved in `char.vehicles`.
- Vehicle parts (`VehicleParts` in `data/vehicles.ts`, saved per vehicle): wheel conditions (-1 missing, 0 wrecked), engine, roof cannon. Missing/wrecked wheels or a dead engine stop the vehicle; wear lowers speed. Found vehicles come damaged (rolled from the region seed, visible before claiming). The service window (`ui/service.ts`, E at the vehicle's front) fits Light/Heavy Wheels, Engine Parts and the Vehicle Cannon. Mirek sells parts (`PART_PRICE`) and buys them back at `PART_BUYBACK` (20%); vehicles sell back for half price scaled by condition (`resaleValue`), trunk must be empty.
- Creatures (`data/creatures.ts`, `world/creatures.ts`), open world only, unsaved like drones: Ravager packs (flank, dash, bite, retreat; plains), Bramble (territorial ~11 m, head-down charge with knockback, 60% less damage from the front; valleys h < 9), Leechwing (circles ruins/high ground, stalks, dives; flies over terrain). Models are PropBatch bodies with origin at the body centre so weapons (`t.g.position`, `t.r`) and EMP (`t.p`) work unchanged; `damageFoe` routes them to `hurtCreature`. Console: `spawn ravager|bramble|leechwing`.
- Quests (`gen/quests.ts` pure generator, `world/quests.ts` progress, `ui/board.ts` window): the notice board on Gridholm's plaza (`VillageMap.board`) shows 4 notices numbered by `char.board.seq` (deterministic per world); up to 3 accepted (`char.quests`). Kinds: bounty (kill N of a kind anywhere), hunt (a group + leader — Pack Alpha / Old Bull / Matriarch — at a real spot; `describeSpot` derives the wording and the creature from the terrain there), fetch (a resident errand: talk to the giver, then an item in a real ruin's dungeon — first guardian's room of depth 1 sector 0,0 — or by a real abandoned vehicle's parking spot). Board quests are claimed at the board, errands at the giver. HUD tracker `#qtrack`, gold markers on the maps.
- Containers: chests roll their contents once on first open and keep what the player leaves (`char.containers`, key `chest:<dungeonKey>:<index>`). Chests and trunks use the transfer window (`ui/transfer.ts`); stack moves are pure functions in `inventory.ts`.
- `data/` — items, NPC texts, vehicles. `save.ts` — persistence and version migrations.
