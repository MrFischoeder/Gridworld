// Wild creatures of the open world (from the PF field guide sheets).
export type CreatureKind = 'ravager' | 'bramble' | 'leechwing';

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
};

/** Hostile creatures are drawn amber like drones; a calm Bramble is olive until provoked. */
export const HOSTILE = 0xffb347, CALM = 0xb8b060;
