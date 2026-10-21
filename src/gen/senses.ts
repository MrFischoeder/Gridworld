// (0.236, PLAN_SPAWNOW.md stage L2) How each kind of foe finds you, besides its eyes' range (which each mind keeps):
// where it looks (`view`), how well it sees in the dark and the fog (`dark`), how far it hears shots and other loud
// things (`hear`, times the noise's own reach), how close it hears your footsteps (`steps`), whether it smells you
// (`scent` m, through walls and bushes alike) and keeps to your track once it has your scent (`trail` s: while it
// can follow it, losing sight of you does not lose you; water and vehicles leave no track), and how long it looks for
// you once it has lost you (`lose` s). Pure.
import type { CreatureKind } from '../data/creatures';
import type { RobotKind } from '../data/robots';

export type SenseKey = CreatureKind | RobotKind | 'bandit' | 'drone';
export interface Senses {
  /** 'cone': sees well only ahead; 'wide': all round but behind; 'all': all round (from above, sensors). */
  view: 'cone' | 'wide' | 'all';
  /** 0: night and fog hide you as well as from a man; 1: it sees as well in the dark (heat, motion, vibration). */
  dark: number;
  /** A noise's reach for it (× the noise's radius). */
  hear: number;
  /** Your steps (upright and moving) are heard within this (m), even from behind. */
  steps: number;
  /** It smells you within this (m) whatever stands between; 0 = no nose. */
  scent: number;
  /** Once on your scent it follows your track this long (s) after it lost sight of you; 0 = no tracking. */
  trail: number;
  /** How long (s) it searches once it has lost you. */
  lose: number;
}
export const SENSES: Record<SenseKey, Senses> = {
  // beasts: hunters by nose (ravagers, gnawers), by eye from above (leechwings), the bramble half blind
  ravager:   { view: 'cone', dark: 0.3, hear: 1.2, steps: 10, scent: 30, trail: 120, lose: 30 },
  gnawer:    { view: 'wide', dark: 0.5, hear: 1, steps: 8, scent: 18, trail: 45, lose: 15 },
  bramble:   { view: 'cone', dark: 0, hear: 0.5, steps: 6, scent: 10, trail: 0, lose: 6 },
  leechwing: { view: 'all', dark: 0, hear: 1.8, steps: 0, scent: 0, trail: 0, lose: 12 },
  skitter:   { view: 'wide', dark: 0, hear: 0.6, steps: 5, scent: 0, trail: 0, lose: 8 },
  lurker:    { view: 'all', dark: 1, hear: 0.5, steps: 12, scent: 0, trail: 0, lose: 10 },
  silverfin: { view: 'all', dark: 0, hear: 0.3, steps: 6, scent: 0, trail: 0, lose: 3 },
  // (0.240) the wildlife: its temper (gen/wildlife.ts) does most of the noticing; these are for noises and searches
  ridgeback: { view: 'wide', dark: 0.3, hear: 1, steps: 10, scent: 25, trail: 20, lose: 10 },
  hexastrider: { view: 'all', dark: 0.2, hear: 1.2, steps: 14, scent: 20, trail: 0, lose: 4 },
  serpent: { view: 'cone', dark: 1, hear: 0.4, steps: 12, scent: 10, trail: 0, lose: 6 },
  crestjaw: { view: 'cone', dark: 0.5, hear: 0.5, steps: 8, scent: 0, trail: 0, lose: 6 },
  titan: { view: 'wide', dark: 0, hear: 0.6, steps: 0, scent: 0, trail: 0, lose: 15 },
  hopling: { view: 'all', dark: 0.3, hear: 1.4, steps: 12, scent: 12, trail: 0, lose: 3 },
  tusker: { view: 'wide', dark: 0.3, hear: 1, steps: 8, scent: 22, trail: 15, lose: 10 },
  scorpid: { view: 'wide', dark: 1, hear: 0.6, steps: 10, scent: 0, trail: 0, lose: 6 },
  // machines: motion sensors, thermal sights, a seismic ear on the artillery; none of them smells
  scout:     { view: 'wide', dark: 0.6, hear: 1, steps: 8, scent: 0, trail: 0, lose: 14 },
  guardian:  { view: 'cone', dark: 0.5, hear: 1, steps: 4, scent: 0, trail: 0, lose: 18 },
  repair:    { view: 'all', dark: 0.5, hear: 0.6, steps: 4, scent: 0, trail: 0, lose: 10 },
  sentinel:  { view: 'cone', dark: 1, hear: 0.8, steps: 4, scent: 0, trail: 0, lose: 20 },
  artillery: { view: 'cone', dark: 0.8, hear: 1.3, steps: 4, scent: 0, trail: 0, lose: 25 },
  assault:   { view: 'cone', dark: 0.3, hear: 1, steps: 6, scent: 0, trail: 0, lose: 14 },
  // people: eyes and ears only
  bandit:    { view: 'cone', dark: 0, hear: 0.8, steps: 4, scent: 0, trail: 0, lose: 12 },
  drone:     { view: 'all', dark: 0.7, hear: 0.5, steps: 0, scent: 0, trail: 0, lose: 7 },
};
/** A kind's senses (unknown kinds see like a man). */
export const sensesOf = (k: SenseKey | undefined): Senses => (k && SENSES[k]) || SENSES.bandit;
/** How it reads where you stand from its facing: all-round eyes see you as if ahead, wide ones everywhere but behind. */
export function viewFacing(s: Senses, facing: number): number {
  if (s.view === 'all') return 1;
  if (s.view === 'wide') return facing >= -0.5 ? 1 : facing;
  return facing;
}
/** Your visibility for it: in the dark or fog `lit` (how you would show in good light) counts by its `dark`. */
export const seenAs = (s: Senses, vis: number, lit: number) => vis + (Math.max(vis, lit) - vis) * s.dark;
/** A noise of reach `r` m is heard by it within this. */
export const hears = (k: SenseKey, r: number) => r * sensesOf(k).hear;
/** How far behind you (s) a tracker follows your track. */
export const TRACK = { lag: 6, every: 2, keep: 240 };
