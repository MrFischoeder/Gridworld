# GridWorld — project rules

Browser FPS in a green vector-grid style (wireframe on black, retro sci-fi / Tron / CRT terminal).
`legacy/grid-arena.html` is the original single-file version (from when the game was called Grid Arena), kept as the reference for behaviour.

## Commands
- `npm run dev` — dev server (Vite)
- `npm test` — Vitest (generators, terrain, saves)
- `npm run typecheck` / `npm run build`
- In a dev build, `window.__game` exposes `{ G, W, camera, scene, renderer }` for debugging; F3 toggles the perf overlay (fps, lines, triangles, draw calls).

## Rules
- **Stack:** Vite + TypeScript (strict), three.js from npm. No UI framework: HUD and windows are plain DOM + CSS.
- **Game language: English.** Every player-visible text (HUD, menus, dialogue, items, hints) is English. Identifiers and comments in English.
- **Deterministic generation:** the whole world (dungeons, villages, terrain, ruins, object placement) comes only from seeded RNG (`core/rng.ts`: `rng`, `hash`, noise). Generators **never** call `Math.random()`. `Math.random()` is allowed only for effects and unsaved things (sparks, drone loot, NPC wandering). Same seed + same coordinates = identical result. This is the basis of saves and future multiplayer.
- **Save only player changes** (opened chests, killed bosses, unlocked doors, position, character) — never generated geometry.
- **Visual style:** grid lines `#2fe060`, black background, fog to black. Every solid that should hide what is behind it needs a dark fill (e.g. `0x010d04`, see `fillMat()` in `world/render.ts`) with `polygonOffset`, lines on top. Lines without a fill are see-through — a bug, unless the object is meant to be openwork (drones, bosses, pickups).
- **Functional colours:** drones `#ffb347`, bosses `#ff6a4a`, gold/chests `#ffd060`, stairwells `#5cc8ff`, XP `#9dffe0`, locked doors `#ff5a3c`.
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
- Vehicles (`data/vehicles.ts` specs, `world/vehicles.ts` models/driving): RTV-1 Scout and HTV-6 Mastodon, parked outside Gridholm's north gate in a new world (`gen/vehicles.ts`). Each has seats (driver = seat 1; the rest are for multiplayer) and a trunk. Vehicles stay out of the village and ruins. Saved in `char.vehicles` (position, heading, trunk).
- Containers: chests roll their contents once on first open and keep what the player leaves (`char.containers`, key `chest:<dungeonKey>:<index>`). Chests and trunks use the transfer window (`ui/transfer.ts`); stack moves are pure functions in `inventory.ts`.
- `data/` — items, NPC texts, vehicles. `save.ts` — persistence and version migrations.
