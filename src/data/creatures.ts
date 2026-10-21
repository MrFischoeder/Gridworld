// Wild creatures of the open world (from the PF field guide sheets).
import type { ItemKey } from './items';
import { tl } from '../i18n';
import { WILD, isWild, type WildKind } from '../gen/wildlife';
export type CreatureKind = 'ravager' | 'bramble' | 'leechwing' | 'gnawer' | 'skitter' | 'lurker' | 'silverfin'
  // (0.240) the wildlife (gen/wildlife.ts): animals living in the land, most of them not out to get you
  | WildKind;
/** Creatures that fly (they fall out of the sky when killed) and those that live in the sea. */
export const FLYERS: CreatureKind[] = ['leechwing', 'skitter'];
export const SWIMMERS: CreatureKind[] = ['lurker', 'silverfin'];

export interface CreatureSpec {
  code: string; name: string; role: string;
  /** Hit sphere radius around the body centre, and body centre height above the ground. */
  r: number; lift: number;
  hp: number; damage: number; speed: number;
  /** Crystals dropped when killed. */
  crystals: number;
}

export const CREATURES: Record<CreatureKind, CreatureSpec> = {
  ravager: { code: tl('PF-01A'), name: tl('Ravager'), role: tl('Predatory quadruped, hunts in packs'), r: 0.65, lift: 0.66, hp: 3, damage: 8, speed: 7.5, crystals: 3 },
  bramble: { code: 'PF-02', name: tl('Bramble'), role: tl('Armoured herbivore, charges when threatened'), r: 1.35, lift: 1.05, hp: 16, damage: 28, speed: 11, crystals: 6 },
  leechwing: { code: 'PF-04', name: tl('Leechwing'), role: tl('Aerial hunter, diving attacks'), r: 1.0, lift: 0, hp: 5, damage: 16, speed: 18, crystals: 4 },
  skitter: { code: 'PF-06', name: tl('Skitterwing'), role: tl('Small flier in flocks: flutters low and pecks at whoever comes near'), r: 0.35, lift: 0, hp: 1, damage: 3, speed: 12, crystals: 1 },
  lurker: { code: 'PF-07', name: tl('Sea Lurker'), role: tl('Long finned predator of the seas, hunts what swims'), r: 0.8, lift: 0, hp: 9, damage: 18, speed: 7, crystals: 4 },
  silverfin: { code: 'PF-08', name: tl('Silverfin'), role: tl('Shoaling sea fish, leaps and flees'), r: 0.3, lift: 0, hp: 1, damage: 0, speed: 6, crystals: 0 },
  gnawer: { code: 'PF-05', name: tl('Gnawer'), role: tl('Rat-like scavenger with long incisors and a spined tail, swarms anywhere'), r: 0.45, lift: 0.3, hp: 1, damage: 4, speed: 8.5, crystals: 1 },
  // (0.240) the wildlife; the first five are the owner's designs (docs/fauna), the last three ours
  ridgeback: { code: 'PF-09', name: tl('Ridgeback Bear'), role: tl('Shaggy forest giant: it warns you off, and charges if you keep coming'), r: 1.4, lift: 1.6, hp: 22, damage: 24, speed: 9, crystals: 5 },
  hexastrider: { code: 'PF-10', name: tl('Hexastrider'), role: tl('Six-legged grazer of the open land, in herds; it runs from anyone'), r: 1.3, lift: 1.8, hp: 9, damage: 10, speed: 13, crystals: 3 },
  serpent: { code: 'PF-11', name: tl('Banded Serpent'), role: tl('A 22 m snake of the swamps: come at it quietly and it lets you pass'), r: 3.2, lift: 2, hp: 45, damage: 32, speed: 4.5, crystals: 10 },
  crestjaw: { code: 'PF-12', name: tl('Crestjaw'), role: tl('Crocodilian lying still by the water; it strikes at whatever comes near'), r: 2.2, lift: 0.6, hp: 28, damage: 26, speed: 9, crystals: 6 },
  titan: { code: 'PF-13', name: tl('Crown Titan'), role: tl('A colossal grazer that walks the plains; harmless until it is attacked'), r: 6.5, lift: 5.6, hp: 300, damage: 45, speed: 3.2, crystals: 30 },
  hopling: { code: 'PF-14', name: tl('Hopling'), role: tl('Small long-eared hopper, grazes in little groups and bolts'), r: 0.35, lift: 0.35, hp: 1, damage: 0, speed: 9, crystals: 0 },
  tusker: { code: 'PF-15', name: tl('Tusker'), role: tl('Bristled boar in a sounder; hurt one and they all come for you'), r: 0.75, lift: 0.75, hp: 7, damage: 12, speed: 8.5, crystals: 2 },
  scorpid: { code: 'PF-16', name: tl('Scorpid'), role: tl('Desert scorpion: crouch and go slowly, or feel its sting'), r: 0.9, lift: 0.45, hp: 10, damage: 16, speed: 7, crystals: 3 },
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
  skitter: [['membrane', 0.25, 1, 1]],
  lurker: [['fishR', 1, 2, 3], ['hide', 0.5, 1, 1], ['fang', 0.6, 1, 2]],
  silverfin: [['fishR', 1, 1, 1]],
  ridgeback: [['meatR', 1, 2, 4], ['hide', 0.9, 1, 2], ['fang', 0.6, 1, 2]],
  hexastrider: [['meatR', 1, 2, 3], ['hide', 0.7, 1, 1]],
  serpent: [['hide', 1, 2, 3], ['fang', 0.8, 1, 2], ['meatR', 1, 2, 4]],
  crestjaw: [['meatR', 1, 2, 3], ['hide', 0.8, 1, 2], ['plate', 0.6, 1, 1]],
  titan: [['meatR', 1, 8, 14], ['hide', 1, 3, 5], ['plate', 1, 2, 4]],
  hopling: [['meatR', 0.8, 1, 1]],
  tusker: [['meatR', 1, 1, 3], ['hide', 0.5, 1, 1], ['fang', 0.4, 1, 2]],
  scorpid: [['plate', 0.6, 1, 1], ['fang', 0.5, 1, 1]],
};

/** Hostile creatures are drawn amber like drones; a calm Bramble is olive until provoked. */
export const HOSTILE = 0xffb347, CALM = 0xb8b060;

/** The states in which a wild animal (0.240) is roused against someone; otherwise it counts as calm. */
const ROUSED = new Set(['threat', 'charge', 'hunt', 'dash', 'retreat', 'leash']);
/** Not a danger right now (nothing new is held back for it, and the music stays calm): a grazing Bramble, the fish,
 *  and wildlife that is not roused. */
export function calmBeast(kind: CreatureKind, state: string): boolean {
  if (kind === 'silverfin') return true;
  if (kind === 'bramble') return state === 'roam';
  if (isWild(kind)) return WILD[kind].temper === 'timid' || !ROUSED.has(state);
  return false;
}
