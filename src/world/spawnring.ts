// (0.235, PLAN_SPAWNOW.md stage L1) Where encounters in the wilds begin and when they go: out where the eye no longer
// reaches (just past the fog, 120-310 m off), never in sight of any player and never within `minPlayer` of one; then
// they make their way towards where you are heading (`meetPoint`), so you meet them instead of watching them appear.
// They go only past `despawn` m from every player and after `unseen` s hidden from all of them, never before your eyes.
// The rules are pure (gen/spawnring.ts); this module asks the world (the fog, rays, the other players).
import { G } from '../game';
import { fog } from './render';
import { rayWorld } from './player';
import { otherPlayers, nearestPlayer } from './remote';
import { SPAWN, ringOf, leadOf } from '../gen/spawnring';

export { SPAWN };
/** Where the eye still makes something out now (m): the fog's far edge. */
export const viewRange = () => fog.far;
/** The ring encounters begin in now: [near, far] m from you. */
export const spawnRing = () => ringOf(viewRange());

const eyes = () => [{ x: G.pos.x, y: G.pos.y + 1.6, z: G.pos.z }, ...otherPlayers().map((p) => ({ x: p.x, y: p.y + 1.6, z: p.z }))];
const dir = { x: 0, y: 0, z: 0 };
/** Can an eye make out the point (within the fog, nothing solid between)? */
function sees(e: { x: number; y: number; z: number }, x: number, y: number, z: number): boolean {
  const dx = x - e.x, dy = y - e.y, dz = z - e.z, d = Math.hypot(dx, dy, dz);
  if (d > viewRange() || d < 0.01) return d < 0.01;
  dir.x = dx / d; dir.y = dy / d; dir.z = dz / d;
  return rayWorld(e, dir, d) >= d - 0.6;
}
/** Is a body standing at (x, y feet, z), `h` m tall, out of sight of every player in your place? */
export function hiddenFrom(x: number, y: number, z: number, h = 1.6): boolean {
  for (const e of eyes()) if (sees(e, x, y + 0.3, z) || sees(e, x, y + h, z)) return false;
  return true;
}
/** Is (x, z) at least `m` m from every player in your place? */
export const farFromPlayers = (x: number, z: number, m = SPAWN.minPlayer) => nearestPlayer(x, z) >= m;
/** A spot on the ring round you: `a` the bearing (sin, cos like the foes' headings), `t` 0..1 across the ring. */
export function ringSpot(a: number, t: number): { x: number; z: number; d: number } {
  const [n, f] = spawnRing(), d = n + (f - n) * t;
  return { x: G.pos.x + Math.sin(a) * d, z: G.pos.z + Math.cos(a) * d, d };
}
/** The bearing you are heading along (moving) or looking along (standing). */
export function heading(): number {
  const s = Math.hypot(G.vel.x, G.vel.z);
  return s > 0.8 ? Math.atan2(G.vel.x, G.vel.z) : Math.atan2(-Math.sin(G.yaw), -Math.cos(G.yaw));
}
/** Where a newcomer makes for: a little ahead on your way, so you meet it rather than it piling up behind you. */
export function meetPoint(secs: number = SPAWN.lead): { x: number; z: number } {
  const s = Math.hypot(G.vel.x, G.vel.z), a = heading(), lead = leadOf(s, secs), j = (Math.random() - 0.5) * 2 * SPAWN.jitter;
  return { x: G.pos.x + Math.sin(a) * lead + Math.cos(a) * j, z: G.pos.z + Math.cos(a) * lead - Math.sin(a) * j };
}

/** (0.236) Whether a group at (x, z) can walk straight towards you: no water, wall or place in the way (sampled every
 *  12 m by `bad`, the spawner's own forbidden ground), so it does not stand stuck behind a river all the way. */
export function wayClear(x: number, z: number, bad: (x: number, z: number) => boolean): boolean {
  const dx = G.pos.x - x, dz = G.pos.z - z, L = Math.hypot(dx, dz);
  for (let s = 12; s < L - 20; s += 12) if (bad(x + dx / L * s, z + dz / L * s)) return false;
  return true;
}
/** (0.236) Two points of a crossing: where the group meets your way (`SPAWN.crossLead` s ahead of you) and a point
 *  `SPAWN.crossOn` m on past it, away from where the group turned up at (x, z). */
export function crossPoints(x: number, z: number): [number, number][] {
  const m = meetPoint(SPAWN.crossLead), dx = m.x - x, dz = m.z - z, L = Math.hypot(dx, dz) || 1;
  return [[m.x, m.z], [m.x + dx / L * SPAWN.crossOn, m.z + dz / L * SPAWN.crossOn]];
}
let roadAhead: (d0: number, d1: number) => [number, number] | null = () => null;
/** world/raiders.ts tells where the roadside ahead of you is (it knows the roads). */
export function setRoadAhead(f: typeof roadAhead) { roadAhead = f; }
/** A roadside spot ahead of you on the road you are on, for bandits to lie in wait at; null off the road. */
export const roadsideSpot = () => roadAhead(SPAWN.wait[0], SPAWN.wait[1]);

const hid = new WeakMap<object, { t: number; next: number }>();
/**
 * May a foe of the wilds at (x, y feet, z) go now? Only past `despawn` m from every player and once it has been out
 * of everyone's sight for `unseen` s (checked once a second); past `hard` m always.
 */
export function mayDrop(o: object, x: number, y: number, z: number): boolean {
  const d = nearestPlayer(x, z), now = G.char.time; // game minutes, a real second each while playing
  if (d > SPAWN.hard) return true;
  if (d <= SPAWN.despawn) { hid.delete(o); return false; }
  let s = hid.get(o);
  if (!s) hid.set(o, (s = { t: now, next: 0 }));
  if (now >= s.next) { s.next = now + 1; if (!hiddenFrom(x, y, z)) s.t = now; }
  return now - s.t >= SPAWN.unseen;
}
