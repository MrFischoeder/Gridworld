// (0.227, PLAN_WALKI.md stage W5: conditions) A hit can do more than take hit points. A heavy enough blow staggers
// a foe (its attack is broken off), a sledge or a crushing blow knocks the lighter ones down (they lie a moment and
// take more), a cut makes a beast bleed (it loses blood for a few seconds after), and an EMP charge short-circuits
// the machines (they stand frozen and take more). The same can happen to you: a Bramble's charge or the Assault
// Construct's hammer throws you down, a bite or a blade makes you bleed (a medkit stops it), a heavy blow staggers you.
// Pure: what a hit does by its weight against each foe's poise, how long it lasts and what it costs.
import type { FoeKey } from './tactics';

export type Cond = 'stagger' | 'down' | 'stun';
/** What a hit carries besides its damage: its weight (`impact`: a blunt sledge more, a pellet less), whether it is
 *  a knocking blow (the sledge), a cut (blades: beasts bleed) or an EMP pulse (machines short-circuit). */
export interface HitFx { impact: number; knock?: boolean; cut?: boolean; emp?: boolean }

/** The share of its full health one hit must take (times its impact) to stagger a foe; heavier ones stand firmer. */
export const POISE: Record<FoeKey, number> = {
  ravager: 0.3, bramble: 0.32, leechwing: 0.3, skitter: 0.3, lurker: 0.35, silverfin: 0.3, gnawer: 0.3,
  ridgeback: 0.3, hexastrider: 0.25, serpent: 0.35, crestjaw: 0.35, titan: 0.6, hopling: 0.3, tusker: 0.3, scorpid: 0.3,
  shardling: 0.3, prismwalker: 0.32, colossus: 9, // (0.277) the colossus is never staggered by a hit
  scout: 0.3, guardian: 0.3, repair: 0.3, sentinel: 0.3, artillery: 0.28, assault: 0.4,
  gunner: 0.28, bruiser: 0.32, leader: 0.3, drone: 0.4,
};
/** The ones a blow can knock down (the big beasts and the heavy machines only stagger; fliers are brought down
 *  to the ground instead, see world/creatures.ts). */
export const FELLS: Partial<Record<FoeKey, boolean>> = { ravager: true, gnawer: true, hexastrider: true, hopling: true, tusker: true, scorpid: true, leechwing: true, scout: true, guardian: true, gunner: true, bruiser: true, leader: true };
/** The machines an EMP short-circuits. */
export const MACHINES: Partial<Record<FoeKey, boolean>> = { scout: true, guardian: true, repair: true, sentinel: true, artillery: true, assault: true, drone: true };
const HEAVY: Partial<Record<FoeKey, boolean>> = { sentinel: true, artillery: true, assault: true };

export const COND = {
  /** How long each lasts (s); heavy machines shake off an EMP sooner. */
  stagger: 0.7, down: 1.9, stun: 3.2, stunHeavy: 2,
  /** A knocking blow fells when it would stagger; any other blow only when it takes `fell` × the poise. */
  fell: 2.2,
  /** The foe takes more while down or short-circuited. */
  mult: { down: 1.3, stun: 1.25 } as Partial<Record<Cond, number>>,
  /** After a stagger or a fall a foe cannot be staggered again for this long (s), so it is not held down for good. */
  guard: 1.4,
};
/** A cut's bleeding: each cut adds `share` of its damage a second for `time` s, at most `cap` of the beast's health a second. */
export const BLEED = { share: 0.12, time: 5, cap: 0.08 };
/** The weight of a weapon's blow: a sledge hits hardest, a spear's thrust and the rifle carry more than a blade. */
export const IMPACT = { sledge: 1.6, spear: 1.15, blade: 1, machete: 0.9, gun: 1, rifle: 1.3, shotgun: 0.6, emp: 0 };

/** What a hit of `dmg` on a foe of kind `k` with full health `maxHp` does (null: nothing beyond the damage). */
export function condOf(k: FoeKey, dmg: number, maxHp: number, fx: HitFx): Cond | null {
  if (fx.emp) return MACHINES[k] ? 'stun' : null;
  const blow = (dmg / Math.max(1e-6, maxHp)) * fx.impact, poise = POISE[k];
  if (blow < poise) return null;
  return FELLS[k] && (fx.knock || blow >= poise * COND.fell) ? 'down' : 'stagger';
}
/** How long a condition holds a foe of kind `k`. */
export const condTime = (k: FoeKey, c: Cond) => (c === 'stun' ? (HEAVY[k] ? COND.stunHeavy : COND.stun) : COND[c]);
/** The bleeding after a cut: the new damage a second (added to `dps`, capped by the beast's health). */
export const bleedDps = (dps: number, dmg: number, maxHp: number) => Math.min(maxHp * BLEED.cap, dps + dmg * BLEED.share);
/** The extra a foe takes in a condition. */
export const condMult = (c: string | undefined) => (c ? COND.mult[c as Cond] ?? 1 : 1);

/** The player's side: a stagger (view jolted, slowed), a fall (down on the ground, nothing to do) and bleeding. */
export const PLAYER_COND = {
  stagger: 0.4, down: 1.2, slow: 0.35,
  /** A hit taking this share of your full health staggers you. */
  heavy: 0.18,
  /** Bleeding: HP a second per wound for `time` s, at most `max` wounds at once. */
  bleed: { dps: 0.8, time: 8, max: 3 },
};
/** Your bleeding's HP a second with n wounds open. */
export const playerBleed = (n: number) => Math.min(n, PLAYER_COND.bleed.max) * PLAYER_COND.bleed.dps;
