// (0.207) Hand-made dungeons from the map editor (editor.html): the editor keeps its files in this browser
// (gen/mapfile.ts EDITOR_KEY); the game reads them here. The console's `custom <name>` goes down into one, and the
// editor's 'Test in the game' opens the game with ?test=<name>, which goes down as soon as you are playing.
// (0.208) Worlds drawn in the editor too: `syncCustomWorld` registers the character's world file (gen/customworld.ts)
// before the world is opened, so the generators take its land, rivers and places.
import { storedMaps, type DungeonFile, type WorldFile } from '../gen/mapfile';
import { hash } from '../core/rng';
import { setCustomWorld, customWorld } from '../gen/customworld';
import type { Char } from '../save';

const store = () => { try { return globalThis.localStorage; } catch { return undefined; } };
/** Every dungeon the editor has kept here (name → file). */
export function customDungeons(): Record<string, DungeonFile> {
  return storedMaps('dungeon', store()) as Record<string, DungeonFile>;
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
/** Register the drawn world the character plays on (if any). False when its file is not in this browser (the land
 *  then comes from the seed alone). */
export function syncCustomWorld(c: Char): boolean {
  if (!c.cw) return true;
  if (customWorld(c.world)) return true; // (once a page: the generators' caches keep what they worked out)
  const f = customWorlds()[c.cw];
  if (!f) return false;
  setCustomWorld(c.world, f);
  return true;
}
/** The world the editor's 'Test in the game' asked for (?world=<name>), offered in the menu. */
export const worldAsked = (() => { try { return new URLSearchParams(location.search).get('world'); } catch { return null; } })();
