// Who still lives down below (pure): a dungeon sector's (or a cave's, or a wreck's) drones and robot guards stay dead
// once killed. Nothing respawns while any of them lives; once the last one falls, the sector stands empty for 7 to 14
// game days (hashed), then fills up again all at once. Kept in the shared `killed` lists (one per dungeon key) as
// numbers beside the bosses' and turrets' indices: drone i = DRONE + i, guard i = GUARD + i, and the time it was
// cleared = CLEARED + game minute. `mergeProgress` merges these sets for every player, removals included.
import { hash } from '../core/rng';

export const DRONE = 10_000, GUARD = 20_000, CLEARED = 1_000_000_000;
/** How long a cleared sector stays empty (game minutes): 7 to 14 days. */
export const REPOP = { min: 7 * 1440, max: 14 * 1440 };
const strHash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
export const clearedAt = (killed: readonly number[]) => { const m = killed.find((n) => n >= CLEARED); return m === undefined ? null : m - CLEARED; };
/** When a sector cleared at `at` fills up again. */
export const refillAt = (world: number, key: string, at: number) => at + REPOP.min + hash(world, strHash(key), Math.floor(at), 0x7e9) % (REPOP.max - REPOP.min + 1);
/** On arrival: true when the sector's time is up (then drop every drone, guard and the clearing mark: they are back). */
export function refill(world: number, key: string, killed: number[], now: number): boolean {
  const at = clearedAt(killed);
  if (at === null || now < refillAt(world, key, at)) return false;
  const keep = killed.filter((n) => n < DRONE || (n >= GUARD + 10_000 && n < CLEARED)); // bosses, turrets and the like stay
  killed.splice(0, killed.length, ...keep);
  return true;
}
/** Record a kill; marks the sector cleared when nothing of its `drones` and `guards` is left. Returns true when it just was. */
export function recordKill(killed: number[], id: number, drones: number, guards: number, now: number): boolean {
  if (!killed.includes(id)) killed.push(id);
  if (clearedAt(killed) !== null) return false;
  for (let i = 0; i < drones; i++) if (!killed.includes(DRONE + i)) return false;
  for (let i = 0; i < guards; i++) if (!killed.includes(GUARD + i)) return false;
  killed.push(CLEARED + Math.floor(now));
  return true;
}
/** How many drones a labyrinth sector holds: more than before, since none come back. */
export const labyrinthDrones = (rooms: number, depth: number) => 2 * rooms + 2 + depth;
