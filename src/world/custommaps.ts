// (0.207) Hand-made dungeons from the map editor (editor.html): the editor keeps its files in this browser
// (gen/mapfile.ts EDITOR_KEY); the game reads them here. The console's `custom <name>` goes down into one, and the
// editor's 'Test in the game' opens the game with ?test=<name>, which goes down as soon as you are playing.
// (0.208) Worlds drawn in the editor too: `syncCustomWorld` registers the character's world file (gen/customworld.ts)
// before the world is opened, so the generators take its land, rivers and places.
import { storedMaps, readMapFile, type DungeonFile, type WorldFile, type VillageFile } from '../gen/mapfile';
import { hash } from '../core/rng';
import { setCustomWorld, customWorld, placeDungeon, cityDungeon } from '../gen/customworld';
import { metroCity } from '../gen/metro';
import type { Char } from '../save';
import { onRoomMaps, type RoomMaps } from '../net/client';

// (0.211, stage E5) The maps a multiplayer room plays on come with its welcome (server/mp.mjs keeps them with the
// room): registered here before the world is built, so every player's game makes the same land, villages and levels.
const room: { world: number | null; dungeons: Record<string, DungeonFile> } = { world: null, dungeons: {} };
onRoomMaps((world, maps) => {
  room.dungeons = {}; room.world = null;
  if (!maps) return;
  const f = readMapFile(maps.world);
  if (!f || f.kind !== 'world') return;
  const pick = <K extends 'village' | 'dungeon'>(o: Record<string, unknown>, k: K) => Object.fromEntries(Object.entries(o ?? {}).map(([n, v]) => [n, readMapFile(v)]).filter(([, v]) => v && (v as { kind: string }).kind === k));
  room.dungeons = pick(maps.dungeons, 'dungeon') as Record<string, DungeonFile>;
  setCustomWorld(world, f, pick(maps.villages, 'village') as Record<string, VillageFile>);
  room.world = world;
});
/** The room's maps arrived for this world (its land is the drawn one, whatever the character's own files say). */
export const roomWorld = (world: number) => room.world === world;
/** What a player who brings their own drawn world to a room sends along: the world, the layouts and the dungeons it
 *  names (null when the character plays no drawn world, or its file is not here). */
export function mapsFor(c: Char): RoomMaps | undefined {
  const cw = c.cw ? customWorld(c.world) : null;
  if (!cw) return undefined;
  const dungeons: Record<string, DungeonFile> = {}, all = customDungeons();
  for (const p of cw.f.places) if (p.dungeon && all[p.dungeon]) dungeons[p.dungeon] = all[p.dungeon];
  return { world: cw.f, villages: cw.villages, dungeons };
}

const store = () => { try { return globalThis.localStorage; } catch { return undefined; } };
/** Every dungeon the editor has kept here (name → file). */
export function customDungeons(): Record<string, DungeonFile> {
  return { ...storedMaps('dungeon', store()) as Record<string, DungeonFile>, ...room.dungeons }; // (0.211) a room's own first
}
export const customDungeon = (name: string): DungeonFile | undefined => customDungeons()[name];
/** A save id of its own for a hand-made level (negative, so it never meets a real place's id). */
export const customId = (name: string) => -1 - (hash(0xc057, ...[...name].map((ch) => ch.charCodeAt(0))) % 1e6);

let pending: string | null = (() => { try { return new URLSearchParams(location.search).get('test'); } catch { return null; } })();
/** The editor's test run: the name asked for in the page's address, taken once you are playing. */
export function takeTest(): string | null { const p = pending; pending = null; return p; }
export const testWaiting = () => pending !== null;

/** Every world the editor has kept here (name → file). */
export function customWorlds(): Record<string, WorldFile> {
  return storedMaps('world', store()) as Record<string, WorldFile>;
}
/** Every village layout the editor has kept here (name → file). */
export function customVillages(): Record<string, VillageFile> {
  return storedMaps('village', store()) as Record<string, VillageFile>;
}
/** Register the drawn world the character plays on (if any). False when its file is not in this browser (the land
 *  then comes from the seed alone). */
export function syncCustomWorld(c: Char): boolean {
  if (!c.cw) return true;
  if (customWorld(c.world)) return true; // (once a page: the generators' caches keep what they worked out)
  const f = customWorlds()[c.cw];
  if (!f) return false;
  setCustomWorld(c.world, f, customVillages()); // (0.209) with the village layouts it names
  return true;
}
/** The world the editor's 'Test in the game' asked for (?world=<name>), offered in the menu. */
export const worldAsked = (() => { try { return new URLSearchParams(location.search).get('world'); } catch { return null; } })();
/** (0.210, stage E4) The editor's level under a place of a drawn world (a ruin, a wreck or a metro entrance of a dead
 *  city), when its file is in this browser. */
export function editorDungeonAt(world: number, id: number): string | undefined {
  const city = metroCity(world, id), name = city ? cityDungeon(world, city.i) : placeDungeon(world, id);
  return name && customDungeon(name) ? name : undefined;
}
