// Sneaking (pure): how visible the player is, and how fast a foe that can see them makes them out. A foe's awareness
// climbs from 0 (nothing there) through suspicion to 1 (spotted) while you are in its sight, and sinks again when you
// slip out of it; once it has lost you it goes to where it saw you last, looks round, and gives up after a while.
// The runtime (world/stealth.ts) keeps one awareness per foe and feeds it the numbers worked out here.

export const STEALTH = {
  /** Crouched you are about half as easy to see, and you move at this share of your walking speed. */
  crouch: 0.5, crouchSpeed: 0.45,
  /** Standing still, walking, sprinting. */
  still: 0.8, walk: 1, sprint: 1.35,
  /** At night (no daylight) you are this share as visible; underground the lamps leave you at `below`. */
  night: 0.55, below: 0.85,
  /** A shot gives you away: × `fire`, fading over `fireFade` s. */
  fire: 1.7, fireFade: 2.5,
  /** Fog and rain hide you (× 1 − fog·`fog` − rain·`rain`). */
  fog: 0.45, rain: 0.15,
  min: 0.12, max: 1.8,
  /** Inside this distance a foe in sight always makes you out, crouched or not. */
  touch: 2.5,
  /** A foe that is not looking for you sees well only ahead (cos of the half-angle), badly to the sides and hardly behind. */
  cone: 0.3, side: 0.35, back: -0.3, behind: 0.12,
  /** Upright and moving, your steps are heard this close even from behind. */
  steps: 4,
  /** A foe hunting you looks about: further, and nearly as well behind (`huntSide`). */
  hunt: 1.5, huntSide: 0.7,
  /** How fast awareness rises (per second) at the edge of sight and close in, and how fast it falls when it cannot see you. */
  edge: 0.55, near: 2.6, huntRise: 4, fall: 0.22, huntFall: 0.06,
  /** Awareness at which a foe stops and looks (suspicious) and at which it has you (spotted). */
  suspicious: 0.3, spotted: 1,
} as const;

export interface Exposure {
  crouch: boolean;
  /** Horizontal speed (m/s) and whether you are sprinting. */
  speed: number; sprint: boolean;
  /** 0 night .. 1 full day; `under` = in a dungeon or cave. */
  light: number; under: boolean;
  fog: number; rain: number;
  /** Seconds since your last shot (Infinity for never). */
  shot: number;
}
/** How visible you are: about 1 for someone walking in daylight, down to ~0.15 crouched and still on a foggy night. */
export function visibility(e: Exposure): number {
  const S = STEALTH;
  let v = e.crouch ? S.crouch : 1;
  v *= e.speed < 0.3 ? S.still : e.sprint ? S.sprint : S.walk;
  v *= e.under ? S.below : S.night + (1 - S.night) * Math.max(0, Math.min(1, e.light));
  if (!e.under) v *= Math.max(0.35, 1 - e.fog * S.fog - e.rain * S.rain);
  if (e.shot < S.fireFade) v *= 1 + (S.fire - 1) * (1 - e.shot / S.fireFade);
  return Math.max(S.min, Math.min(S.max, v));
}
/**
 * How far a foe whose sight is `sight` m makes you out: by your visibility, whether you are in front of it
 * (`facing` = cos of the angle between where it looks and you) and whether it is hunting you.
 */
export function reach(sight: number, vis: number, facing: number, hunting: boolean): number {
  const S = STEALTH;
  const front = facing >= S.cone ? 1 : hunting ? S.huntSide : facing >= S.back ? S.side : S.behind;
  return sight * vis * front * (hunting ? S.hunt : 1);
}
/** The new awareness after `dt` s: rising while it sees you (faster the closer, very fast when hunting), sinking otherwise. */
export function awareness(a: number, dt: number, seen: boolean, dist: number, range: number, hunting: boolean, close = dist < STEALTH.touch): number {
  const S = STEALTH;
  if (seen) {
    if (close) return Math.max(a, S.spotted);
    const k = Math.max(0, 1 - dist / Math.max(1, range));
    return Math.min(1.2, a + dt * (hunting ? S.huntRise : S.edge + (S.near - S.edge) * k));
  }
  return Math.max(0, a - dt * (hunting ? S.huntFall : S.fall));
}
/** Whether a foe this close notices you at once: anything in front of it or hunting, and anyone it can hear (upright and moving within `steps`). */
export const atOnce = (dist: number, facing: number, hunting: boolean, loud: boolean) =>
  dist < STEALTH.touch && (facing >= STEALTH.back || hunting) || loud && dist < STEALTH.steps;
/** How long (s) each kind keeps looking for you after losing sight of you, and the bonus for striking an unaware foe. */
export const LOSE = { bandit: 12, robot: 14, creature: 9, drone: 7 };
export const SNEAK = { melee: 3, gun: 1.5 };
