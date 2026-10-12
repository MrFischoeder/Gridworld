// (0.189, PLAN_PLACOWEK.md stage O8) The rivals mode at runtime (the rules are gen/rivals.ts): whether this game is a
// rivals game, your seat and owner id, your home village, the shared roster of seats (names and homes), and the start
// at your own home. Alone, on a hosted LAN game or on a co-op server everything stays the crew's.
//
// MP: the seat comes from the server (kept per account); the roster lives in the shared `rivals` field, each seat
// written only by its own player; a home is turned into a settlement by its player on their first arrival (the
// shared `towns`).
import { G } from '../game';
import { net, online } from '../net/client';
import { townsWorld } from '../gen/worldrules';
import { GRIDHOLM_ID, findPoi } from '../gen/regions';
import { seatOwner, seatOf, homeOf, makeHome, type RivalSeat } from '../gen/rivals';
import { saveChar } from '../character';
import { logLine } from '../ui/hud';

/** Is this a rivals game (online, on a rivals server, in a new world of towns)? */
export const rivalsOn = () => online() && net.mode === 'rivals' && net.slot >= 0 && townsWorld(G.char.world);
/** Your owner id: your seat in a rivals game, else the crew. */
export const myOwner = () => (rivalsOn() ? seatOwner(net.slot) : 'crew');
/** Your home village: your seat's in a rivals game, else Gridholm. */
export const myHomeId = () => (rivalsOn() ? homeOf(G.char.world, net.slot) : GRIDHOLM_ID);
/** The seats in the roster (but `except`), as [owner id, seat]. */
export const seats = (except: string[] = []): [string, RivalSeat][] =>
  Object.entries(G.char.rivals ?? {}).map(([k, v]) => [seatOwner(+k), v] as [string, RivalSeat]).filter(([o]) => !except.includes(o)).sort((a, b) => seatOf(a[0]) - seatOf(b[0]));
/** How an owner id is shown: you, the crew, or the name its seat goes by. */
export function ownerName(owner: string): string {
  if (owner === 'crew') return 'the whole crew';
  if (rivalsOn() && owner === myOwner()) return 'you';
  const s = G.char.rivals?.[String(seatOf(owner))];
  return s?.n || 'a rival';
}
/** A rival's home village's name (for the roster lines). */
export const homeName = (vid: number) => findPoi(G.char.world, vid)?.name ?? 'Gridholm';

/**
 * Take your seat (after joining a rivals game): your line in the roster, and your home made a settlement if it is
 * not one yet. A seat other than Gridholm's skips the Gridholm scout's welcome. True when the world changed (draw it again).
 */
export function takeSeat(): boolean {
  if (!rivalsOn()) return false;
  const c = G.char, key = String(net.slot), v = homeOf(c.world, net.slot), n = c.name || net.name;
  const was = c.rivals[key];
  if (!was || was.n !== n || was.v !== v) c.rivals[key] = { n, v };
  const fresh = makeHome(c, net.slot);
  if (net.slot > 0 && c.guide < 2) c.guide = 2;
  if (fresh) logLine(`This is a rivals world. Your home is ${homeName(v)}: ruins for you to raise, far from the others' homes. Deposits go to whoever stakes them first.`);
  saveChar();
  return fresh;
}
/** Keep your roster line's name current (a rename, a new crew member): every few seconds from the main loop. */
let tick = 0;
export function updateRivals(dt: number) {
  if ((tick -= dt) > 0) return;
  tick = 3;
  if (!rivalsOn()) return;
  const s = G.char.rivals[String(net.slot)], n = G.char.name || net.name;
  if (s && s.n !== n) s.n = n;
}
/** Where a castaway of seat 1 and up wakes: their own home, not in the ship by Gridholm (world/level.ts loadOverworld). */
export const rivalStart = (): number | null => (rivalsOn() && net.slot > 0 ? myHomeId() : null);
