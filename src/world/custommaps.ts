// (0.207) Hand-made dungeons from the map editor (editor.html): the editor keeps its files in this browser
// (gen/mapfile.ts EDITOR_KEY); the game reads them here. The console's `custom <name>` goes down into one, and the
// editor's 'Test in the game' opens the game with ?test=<name>, which goes down as soon as you are playing.
import { storedMaps, type DungeonFile } from '../gen/mapfile';
import { hash } from '../core/rng';

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
