// Robotic enemies of the open world (RD-01..06 field guide sheet): old automatons that still guard the land.
// Pure data; world/robots.ts builds, moves and fights them. They drop salvage: scrap, electronics, power cores.
import type { ItemKey } from './items';

export type RobotKind = 'guardian' | 'sentinel' | 'scout' | 'artillery' | 'repair' | 'assault';

export interface RobotSpec {
  code: string; name: string; role: string;
  /** Hit sphere radius around the body centre, and the body centre's height above the ground. */
  r: number; lift: number;
  hp: number; speed: number;
  /** Damage taken is multiplied by this (heavy armour shrugs off most of a hit). */
  armour: number;
  /** How far it notices you (with a clear line of sight). */
  sight: number;
  /** Danger level (gen/danger.ts) from which it turns up, and how much of the threat budget it uses. */
  min: number; cost: number;
  /** Damage of one attack (a bolt, a blade, a slam, a shell). */
  dmg: number;
  /** Salvage: [item, chance, min, max]. */
  loot: [ItemKey, number, number, number][];
  crystals: number;
}

export const ROBOTS: Record<RobotKind, RobotSpec> = {
  scout: { code: 'RD-03', name: 'Scout Automaton', role: 'Fast, blade-armed hunter; flanks in packs', r: 0.8, lift: 0.95, hp: 3, speed: 8.5, armour: 1, sight: 38, min: 1, cost: 1, dmg: 8,
    loot: [['scrap', 0.8, 1, 2], ['circuit', 0.25, 1, 1]], crystals: 2 },
  guardian: { code: 'RD-01', name: 'Guardian Drone', role: 'Four-legged combat automaton with an energy cannon', r: 1.0, lift: 1.25, hp: 6, speed: 3.4, armour: 0.85, sight: 34, min: 1.8, cost: 1.5, dmg: 6,
    loot: [['scrap', 1, 2, 3], ['circuit', 0.5, 1, 1]], crystals: 3 },
  repair: { code: 'RD-05', name: 'Repair Drone', role: 'Support: mends other machines, deploys defence drones', r: 0.95, lift: 1.7, hp: 8, speed: 4, armour: 1, sight: 30, min: 3, cost: 1.5, dmg: 0,
    loot: [['circuit', 1, 1, 2], ['scrap', 0.7, 1, 1], ['pcore', 0.2, 1, 1]], crystals: 3 },
  sentinel: { code: 'RD-02', name: 'Sentinel', role: 'Heavy patrol unit: arm cannon and crushing blows', r: 1.5, lift: 2.0, hp: 22, speed: 2.3, armour: 0.55, sight: 36, min: 4.5, cost: 4, dmg: 10,
    loot: [['scrap', 1, 4, 6], ['circuit', 0.8, 1, 2], ['pcore', 0.25, 1, 1]], crystals: 8 },
  artillery: { code: 'RD-04', name: 'Artillery Walker', role: 'Long-range shelling; slow and helpless up close', r: 1.7, lift: 2.3, hp: 24, speed: 0.9, armour: 0.55, sight: 95, min: 5, cost: 4, dmg: 28,
    loot: [['scrap', 1, 5, 7], ['circuit', 1, 1, 2], ['pcore', 0.4, 1, 1]], crystals: 8 },
  assault: { code: 'RD-06', name: 'Assault Construct', role: 'Heavy melee: charges and smashes with its hammer', r: 1.6, lift: 2.1, hp: 28, speed: 4.2, armour: 0.55, sight: 30, min: 6, cost: 4.5, dmg: 30,
    loot: [['scrap', 1, 5, 7], ['circuit', 0.6, 1, 1], ['pcore', 0.35, 1, 1]], crystals: 9 },
};
/** Robots are drawn amber like every hostile machine; a hit flashes white. */
export const ROBOT_COLOR = 0xffb347, BEAM_COLOR = 0x5cc8ff;
/** Artillery shells: flight time, blast radius, the shortest range it can shell. */
export const SHELL = { flight: 1.8, radius: 4, minRange: 16, range: 110, every: 4.5 };
