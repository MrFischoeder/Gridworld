// (0.236, PLAN_SPAWNOW.md stage L2) What a newcomer from the wilds means to do on its way to you (it turned up far
// off and out of sight, world/spawnring.ts):
//  - 'track': a pack of noses (ravagers, gnawers) goes along your track, some way behind you (further when it is far
//    off); where the track breaks off (a vehicle, a boat, the water) it sniffs at the last spot and gives up.
//  - 'cross': a patrol (robots, bandits) walks a line that crosses your way ahead and on past it: unless it makes you
//    out (sight, steps, shots: gen/senses.ts) it walks by.
//  - 'wait': bandits by a road lie in wait on the roadside ahead of you.
// A group that has not met you within `SPAWN.march` s gives up: out of everyone's sight and over 120 m off it goes,
// else it settles where it stands. Once any of them is after you the plan is dropped (its own mind fights).
// The spawning game (spawnAuthority) runs the plans of its foes; the copies on the others' games only follow.
import { G } from '../game';
import { SPAWN } from '../gen/spawnring';
import { myTrack } from './stealth';
import { otherPlayers } from './remote';
import { hiddenFrom, farFromPlayers } from './spawnring';

export type IntentKind = 'track' | 'cross' | 'wait';
/** How a module moves its foes: send one towards (x, z), whether it is fighting, alive, made to stay put, removed. */
export interface IntentOps<T> {
  goto(o: T, x: number, z: number): void;
  engaged(o: T): boolean;
  alive(o: T): boolean;
  /** made to stay put (`k`: the plan it had: a 'wait' sits down by the road) */
  settle(o: T, k?: IntentKind): void;
  drop(o: T): void;
  at(o: T): { x: number; y: number; z: number };
}
interface Plan<T> {
  k: IntentKind; foes: T[]; ops: IntentOps<T>; t0: number;
  /** Each member's offset from the group's point. */
  off: [number, number][];
  /** Whose track ('me' or a peer's id) and the waypoints of a crossing or a wait. */
  who: 'me' | number; pts: [number, number][]; i: number;
  /** Getting round something in the way: a detour point while it lasts, and how far the lead has come since the last check. */
  detour: [number, number] | null; detourT: number; seen: [number, number]; stuck: number;
}
const plans: Plan<any>[] = [];
let tick = 0;
/** Stuck this many checks (s) → a detour this far to a side (and a little on) for at most `time` s. */
const DETOUR = { stuck: 5, side: 30, on: 10, time: 15 };
const now = () => G.char.time; // game minutes (a real second each while playing): the menu does not wear a plan out

/** The nearest player to (x, z): you, or another player in your place by id. */
function nearestWho(x: number, z: number): 'me' | number {
  let best: 'me' | number = 'me', d = Math.hypot(G.pos.x - x, G.pos.z - z);
  for (const p of otherPlayers()) { const e = Math.hypot(p.x - x, p.z - z); if (e < d) { d = e; best = p.id; } }
  return best;
}
const posOf = (who: 'me' | number) => (who === 'me' ? G.pos : otherPlayers().find((p) => p.id === who) ?? null);

/**
 * A group just turned up at (x, z): give it a plan. 'cross' and 'wait' take their points (`pts`: the crossing's
 * meeting point and the one beyond it; the wait's spot), 'track' follows the nearest player's track.
 */
export function addIntent<T>(k: IntentKind, foes: T[], ops: IntentOps<T>, x: number, z: number, pts: [number, number][] = []) {
  if (!foes.length) return;
  const off = foes.map((o) => { const p = ops.at(o); return [p.x - x, p.z - z] as [number, number]; });
  const plan: Plan<T> = { k, foes, ops, t0: now(), off, who: nearestWho(x, z), pts, i: 0, detour: null, detourT: 0, seen: [x, z], stuck: 0 };
  plans.push(plan);
  steer(plan);
}
/** The point a group makes for now; null = it has arrived at the end (a crossing) or the track is lost. */
function aim(p: Plan<any>): [number, number] | null {
  if (p.k === 'track') {
    const lead = p.ops.at(p.foes[0]), who = posOf(p.who);
    if (!who) return null;
    const d = Math.hypot(who.x - lead.x, who.z - lead.z), lag = Math.max(6, Math.min(40, d / 6)); // far off it follows older steps
    if (p.who !== 'me') return [who.x, who.z]; // another player's track: where they are (not synced: their steps)
    const t = myTrack(lag);
    if (!t || Math.hypot(t.x - lead.x, t.z - lead.z) > d * 1.5 + 30) return [who.x, who.z]; // no track (or one far from here): where you are
    if (t.broken && Math.hypot(t.x - lead.x, t.z - lead.z) < 6) return null; // at the end of a broken track: nothing more to follow
    return [t.x, t.z];
  }
  while (p.i < p.pts.length) {
    const [x, z] = p.pts[p.i], at = p.ops.at(p.foes[0]);
    if (Math.hypot(x - at.x, z - at.z) > 6) return [x, z];
    if (p.k === 'wait') return null; // there: it lies in wait
    p.i++;
  }
  return null;
}
function steer(p: Plan<any>) {
  let a = aim(p);
  if (!a) { for (const o of p.foes) if (p.ops.alive(o)) p.ops.settle(o, p.k); return false; }
  // stuck against water, rocks or a wall (its own steps go round small things only): a detour to one side for a while
  const lead = p.ops.at(p.foes.find((o) => p.ops.alive(o)) ?? p.foes[0]);
  if (Math.hypot(lead.x - p.seen[0], lead.z - p.seen[1]) < 1.5 && Math.hypot(a[0] - lead.x, a[1] - lead.z) > 8) p.stuck++;
  else { p.stuck = 0; p.seen = [lead.x, lead.z]; }
  if (p.stuck >= DETOUR.stuck && !p.detour) {
    const dx = a[0] - lead.x, dz = a[1] - lead.z, L = Math.hypot(dx, dz) || 1, side = Math.random() < 0.5 ? 1 : -1;
    p.detour = [lead.x - dz / L * DETOUR.side * side + dx / L * DETOUR.on, lead.z + dx / L * DETOUR.side * side + dz / L * DETOUR.on];
    p.detourT = DETOUR.time; p.stuck = 0;
  }
  if (p.detour) {
    if ((p.detourT -= 1) <= 0 || Math.hypot(p.detour[0] - lead.x, p.detour[1] - lead.z) < 5) p.detour = null;
    else a = p.detour;
  }
  p.foes.forEach((o, i) => { if (p.ops.alive(o)) p.ops.goto(o, a[0] + p.off[i][0], a[1] + p.off[i][1]); });
  return true;
}
/** Once a second (main loop, the open world): steer every plan, drop the fighting, the dead and the stale. */
export function updateIntents(dt: number) {
  if ((tick -= dt) > 0) return;
  tick = 1;
  const t = now();
  for (let i = plans.length - 1; i >= 0; i--) {
    const p = plans[i], live = p.foes.filter((o) => p.ops.alive(o));
    if (!live.length || live.some((o) => p.ops.engaged(o))) { plans.splice(i, 1); continue; }
    if (t - p.t0 > SPAWN.march) { // it never met you: it goes, or (in sight or near) it stays where it is
      for (const o of live) {
        const q = p.ops.at(o);
        if (farFromPlayers(q.x, q.z, SPAWN.minPlayer) && hiddenFrom(q.x, q.y, q.z)) p.ops.drop(o); else p.ops.settle(o, p.k);
      }
      plans.splice(i, 1); continue;
    }
    if (!steer(p) && p.k !== 'wait') plans.splice(i, 1); // the crossing is done, the track lost: they stay as they are
  }
}
/** Leaving the open world or loading a place: forget every plan. */
export function clearIntents() { plans.length = 0; }
/** How many groups are on their way (tests, the console). */
export const intentCount = () => plans.length;
