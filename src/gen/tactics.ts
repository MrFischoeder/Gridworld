// (0.223, PLAN_WALKI.md stage W1, the owner's request: combat should be tactical, every foe with its own strengths
// and weaknesses) How hard a hit lands on each kind of foe: where it strikes from (the front, a side or behind, by
// the foe's facing), where on the body (the top or the bottom of its hit sphere: a head, a sensor dome, legs, a belly)
// and with what (a gun or a blade). Pure numbers; the game multiplies a hit's damage by `hitMult` before it goes to
// the foe (world/weapons.ts), so online the shooter's game works it out and the owner of the foe only gets the result.
import type { CreatureKind } from '../data/creatures';
import type { RobotKind } from '../data/robots';
import type { BanditRole } from './camps';

export type FoeKey = CreatureKind | RobotKind | BanditRole | 'drone';
export interface Tactic {
  /** Damage from in front, from a side and from behind (by the foe's facing). */
  front: number; side: number; back: number;
  /** A weak (or hard) spot: the top or the bottom of the hit sphere, and its multiplier. */
  spot?: { at: 'top' | 'low'; k: number };
  /** From a gun, from a blade. */
  gun: number; melee: number;
}
const T = (front: number, side: number, back: number, gun = 1, melee = 1, spot?: Tactic['spot']): Tactic => ({ front, side, back, gun, melee, spot });
export const TACTICS: Record<FoeKey, Tactic> = {
  // beasts
  ravager: T(1, 1.2, 1.4, 1, 1.25, { at: 'top', k: 1.6 }), // the head; a blade meets its lunge
  bramble: T(0.4, 1, 1.7, 1, 1, { at: 'low', k: 1.5 }), // plated head and shoulders, soft flanks and belly
  leechwing: T(1, 1.25, 1, 1.3, 0.8, { at: 'top', k: 1.4 }), // thin wings; hard to reach with a blade
  gnawer: T(1, 1, 1, 1, 1.5), // a swing cuts through the swarm
  skitter: T(1, 1, 1, 1, 1.4),
  lurker: T(0.8, 1, 1.4, 1, 1, { at: 'top', k: 1.5 }), // the fin and the back above the water
  silverfin: T(1, 1, 1),
  // machines
  scout: T(1, 1.1, 1.3, 1, 1.2, { at: 'low', k: 1.5 }), // thin legs
  guardian: T(0.8, 1, 1.6, 1, 1, { at: 'top', k: 1.8 }), // the sensor dome over the cannon
  repair: T(1, 1, 1.2, 1, 1, { at: 'top', k: 1.3 }),
  sentinel: T(0.6, 1, 1.5, 1, 0.8, { at: 'top', k: 2 }), // a heavy front plate, the head above it
  artillery: T(0.8, 1.1, 1.4, 1, 1.6, { at: 'low', k: 1.5 }), // helpless up close; spindly legs
  assault: T(0.5, 1, 1.8, 1, 0.8, { at: 'top', k: 1.4 }), // the hammer guards its front
  drone: T(1, 1, 1, 1, 1.3),
  // people
  gunner: T(1, 1.1, 1.3, 1, 1.3, { at: 'top', k: 2 }), // a rifle is clumsy at arm's length
  bruiser: T(1, 1.1, 1.5, 1, 0.9, { at: 'top', k: 1.8 }), // (the shield itself still halves what comes at its front)
  leader: T(0.9, 1, 1.3, 1, 1, { at: 'top', k: 1.5 }), // a helmet
};
/**
 * (0.226, stage W2) What a foe's moment does to a hit: a Bramble stunned against a tree, a Leechwing down on the ground
 * after a missed dive, a Sentinel with its arm shield up (front) or overheated after a burst, an Assault Construct
 * stranded after a missed charge. Keyed by the foe's `state` (creatures) or `mode` (robots, bandits), which the
 * other players' copies carry too, so the shooter's game reckons it the same way.
 */
export interface StateMult { all?: number; front?: number; back?: number; why: 'stun' | 'grounded' | 'shield' | 'hot' | 'exposed' }
export const STATE_MULT: Partial<Record<FoeKey, Record<string, StateMult>>> = {
  bramble: { stun: { all: 1.6, front: 2, why: 'stun' } }, // the plate does not matter while it reels
  leechwing: { grounded: { all: 1.5, why: 'grounded' } },
  sentinel: { shield: { front: 0.45, why: 'shield' }, hot: { all: 1.8, why: 'hot' } },
  assault: { exposed: { all: 1.25, back: 1.4, why: 'exposed' } },
};
/** The sphere's share above / below which a hit is on the top / the bottom of the body. */
export const SPOT_EDGE = 0.45;
export type HitFrom = 'front' | 'side' | 'back';
/** Which way a hit comes: `cos` = the cosine between the foe's facing and the way to the attacker. */
export const fromOf = (cos: number): HitFrom => (cos > 0.5 ? 'front' : cos < -0.4 ? 'back' : 'side');
/**
 * The multiplier of a hit on foe `k`: `cos` as above (NaN when the foe has no facing: all round), `u` the hit's
 * height in the sphere −1..1 (null for a blade), `melee` a blade. Also says what made it count, for the hint.
 */
export function hitMult(k: FoeKey, cos: number, u: number | null, melee: boolean, state = ''): { k: number; from: HitFrom | null; spot: boolean; why: StateMult['why'] | null } {
  const t = TACTICS[k];
  const from = Number.isFinite(cos) ? fromOf(cos) : null;
  let m = (from ? t[from] : 1) * (melee ? t.melee : t.gun), spot = false;
  if (t.spot && u !== null && (t.spot.at === 'top' ? u > SPOT_EDGE : u < -SPOT_EDGE)) { m *= t.spot.k; spot = true; }
  const s = state ? STATE_MULT[k]?.[state] : undefined;
  if (s) m *= (s.all ?? 1) * (from === 'front' ? s.front ?? 1 : from === 'back' ? s.back ?? 1 : 1);
  return { k: m, from, spot, why: s ? s.why : null };
}
