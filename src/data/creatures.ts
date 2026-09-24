// Wild creatures of the open world (from the PF field guide sheets).
import type { ItemKey } from './items';
export type CreatureKind = 'ravager' | 'bramble' | 'leechwing' | 'gnawer';

export interface CreatureSpec {
  code: string; name: string; role: string;
  /** Hit sphere radius around the body centre, and body centre height above the ground. */
  r: number; lift: number;
  hp: number; damage: number; speed: number;
  /** Crystals dropped when killed. */
  crystals: number;
}

export const CREATURES: Record<CreatureKind, CreatureSpec> = {
  ravager: { code: 'PF-01A', name: 'Ravager', role: 'Predatory quadruped, hunts in packs', r: 0.65, lift: 0.66, hp: 3, damage: 8, speed: 7.5, crystals: 3 },
  bramble: { code: 'PF-02', name: 'Bramble', role: 'Armoured herbivore, charges when threatened', r: 1.35, lift: 1.05, hp: 16, damage: 28, speed: 11, crystals: 6 },
  leechwing: { code: 'PF-04', name: 'Leechwing', role: 'Aerial hunter, diving attacks', r: 1.0, lift: 0, hp: 5, damage: 16, speed: 18, crystals: 4 },
  gnawer: { code: 'PF-05', name: 'Gnawer', role: 'Rat-like scavenger with long incisors and a spined tail, swarms anywhere', r: 0.45, lift: 0.3, hp: 1, damage: 4, speed: 8.5, crystals: 1 },
};

/**
 * What a kill leaves behind besides crystals: [item, chance, min, max]. Only the big herbivore (the Bramble) is
 * food; the rest give materials for crafting later (Oskar buys them for now).
 */
export const DROPS: Record<CreatureKind, [ItemKey, number, number, number][]> = {
  bramble: [['meatR', 1, 2, 4], ['plate', 0.6, 1, 1]],
  ravager: [['fang', 0.5, 1, 2], ['hide', 0.4, 1, 1]],
  leechwing: [['membrane', 0.6, 1, 1]],
  gnawer: [['incisor', 0.35, 1, 1]],
};

/** Hostile creatures are drawn amber like drones; a calm Bramble is olive until provoked. */
export const HOSTILE = 0xffb347, CALM = 0xb8b060;
