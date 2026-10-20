// (0.235, PLAN_SPAWNOW.md stage L1) The numbers of where encounters in the wilds begin and go (world/spawnring.ts
// runs them). Pure.
export const SPAWN = {
  /** The ring's near edge: `past` m beyond what the eye makes out, kept within `near`. */
  near: [120, 200] as [number, number], past: 15,
  /** How deep the ring is (m). */
  span: 110,
  /** Never closer than this to any player (m). */
  minPlayer: 120,
  /** A foe goes past this from every player and unseen for `unseen` s; past `hard` it goes at once. */
  despawn: 350, unseen: 5, hard: 650,
  /** The threat already about is counted within this (m): foes on their way count too. */
  threat: 350,
  /** Where a newcomer makes for: `lead` s ahead of you on your way (at most `leadMax` m), give or take `jitter` m. */
  lead: 20, leadMax: 120, jitter: 25,
  /** Raiders begin further out (m): their cars are fast. */
  raiders: [300, 420] as [number, number],
  /** A roadblock goes up this far ahead along the road, behind a bend or a rise when it can (m). */
  ambush: [90, 160] as [number, number],
  /** (0.236) How long (s) a group on its way keeps at it before it gives up (goes, unseen and far, or settles). */
  march: 180,
  /** A crossing meets your way this many seconds ahead of you and walks on this far (m) past it. */
  crossLead: 35, crossOn: 90,
  /** Bandits lie in wait by the road this far ahead (m). */
  wait: [110, 170] as [number, number],
};
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
/** The spawn ring [near, far] m for a view range (the fog's far edge). */
export function ringOf(view: number): [number, number] {
  const n = clamp(view + SPAWN.past, SPAWN.near[0], SPAWN.near[1]);
  return [n, n + SPAWN.span];
}
/** How far ahead (m) a newcomer aims for you moving at `speed` m/s. */
export const leadOf = (speed: number, secs: number = SPAWN.lead) => clamp(speed * secs, 0, SPAWN.leadMax * secs / SPAWN.lead);
