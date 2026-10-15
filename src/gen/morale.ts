// (0.228, PLAN_WALKI.md stage W6: morale and retreat) A fight does not always end in a death. Bandits and the hunting
// beasts have morale (0..1): losses round them, their own wounds and fire knock it down, a boss's shout lifts it, and
// below `brk` they break. A broken bandit, by chance, runs for good, gives himself up, or runs to fetch help and comes
// back; a broken beast runs for its den. The beasts also keep to their ground: past its edge they give up the chase.
// Machines have no morale (the owner's call), but a squad that lost half falls back to its Repair Drone to regroup.
// Pure: the numbers, the shocks, the fates and the territories; world/morale.ts and the foes' minds run them.
import type { CreatureKind } from '../data/creatures';

export const MORALE = {
  /** Where morale starts: bandits (a boss starts higher), the pack beasts, the lone Leechwing. */
  start: { bandit: 0.6, leader: 0.85, ravager: 0.75, alpha: 0.9, gnawer: 0.55, leechwing: 0.7, skitter: 0.4 } as Record<string, number>,
  /** A boss within `near` m props his men up. */
  leaderNear: 0.2,
  /** The knocks: a comrade falls (`ally`), the boss or the pack's leader falls (`leader`), its own wound below 30%
   *  (`wound`, once), knocked down or staggered (`cond`), half the group gone (`half`, once). */
  shock: { ally: 0.15, leader: 0.35, wound: 0.25, cond: 0.1, half: 0.2 },
  /** Fire scares the beasts: a burning flare or a torch in a hand within `r` m takes `rate` a second. */
  fire: { r: 6, rate: 0.05 },
  /** The boss's shout: once a fight, everyone within `near` m gets `rally` back and the runners turn round. */
  rally: 0.3,
  /** You are badly hurt (below this share): they smell the win. */
  winning: { hp: 0.3, lift: 0.2 },
  /** Below this a member breaks. */
  brk: 0.3,
  /** Back up `regain` a second once nothing has happened for `calm` s, up to its start. */
  regain: 0.02, calm: 10,
  near: 25,
};

/** What a broken bandit does: runs for good, gives himself up, or runs to fetch help and comes back. */
export type Fate = 'run' | 'give' | 'back';
/** The chances (the owner's call: chosen at random); a bandit cornered (you close) gives up more often. */
/** `back`: of those who do not give up, the share who come back with help. */
export const FATE = { give: 0.3, giveCornered: 0.5, back: 0.5, cornered: 14 };
/** The fate from a roll in [0, 1). */
export function fateOf(roll: number, cornered: boolean): Fate {
  const give = cornered ? FATE.giveCornered : FATE.give;
  if (roll < give) return 'give';
  if (roll < give + (1 - give) * FATE.back) return 'back';
  return 'run';
}
/** A runner is gone this far from every player (and out of their sight); one fetching help comes back after a while
 *  with `extra` more; one who gave himself up runs if nobody comes to him within `wait` s, and can be searched within `reach` m. */
export const BROKEN = { gone: 70, help: [35, 70] as [number, number], extra: [1, 3] as [number, number], helpMorale: 0.75, wait: 25, reach: 3 };
/** Driving one off gives this share of the xp a kill would. */
export const DRIVEN_XP = 0.5;

/** How far each beast keeps to its ground round its den (m); past it the chase ends. */
export const TERRITORY: Record<CreatureKind, number> = { ravager: 90, gnawer: 40, bramble: 30, leechwing: 160, lurker: 70, skitter: 50, silverfin: 0 };
/** At the den: it fights on harder (morale never below `floor` within `r` m) and, left alone `calm` s, heals `heal` of its health a second. */
export const DEN = { r: 10, floor: 0.35, calm: 20, heal: 0.02, at: 6 };
/** The posture at the edge before it turns back (s). */
export const LEASH_POSE = 1.2;

/** A squad of machines that lost more than this share falls back to regroup (`time` s at most). */
export const REGROUP = { lost: 0.5, time: 9, at: 5, hp: 0.7 };

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
/** Morale after a knock. */
export const shocked = (m: number, k: keyof typeof MORALE.shock) => clamp01(m - MORALE.shock[k]);
/** What a member's morale counts for now: its own, a boss near, your wounds; near its den a beast holds on. */
export function effective(m: number, o: { leader?: boolean; weakTarget?: boolean; atDen?: boolean }): number {
  let v = m + (o.leader ? MORALE.leaderNear : 0) + (o.weakTarget ? MORALE.winning.lift : 0);
  if (o.atDen) v = Math.max(v, DEN.floor);
  return v;
}
export const breaks = (eff: number) => eff < MORALE.brk;
/** Past the edge of its ground: the target this far from the den. */
export const pastEdge = (k: CreatureKind, targetFromDen: number) => TERRITORY[k] > 0 && targetFromDen > TERRITORY[k];
