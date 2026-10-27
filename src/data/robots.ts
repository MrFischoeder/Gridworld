// Robotic enemies of the open world (RD-01..06 field guide sheet): old automatons that still guard the land.
// Pure data; world/robots.ts builds, moves and fights them. They drop salvage: scrap, electronics, power cores.
import type { ItemKey } from './items';
import { tl } from '../i18n';

export type RobotKind = 'guardian' | 'sentinel' | 'scout' | 'artillery' | 'repair' | 'assault';

export interface RobotSpec {
  code: string; name: string; role: string;
  /** Hit sphere radius around the body centre, and the body centre's height above the ground. */
  r: number; lift: number;
  /** Overall height (m): indoors (crashed ships) a robot only goes where the ceiling clears it. */
  h: number;
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
  scout: { code: 'RD-03', name: tl('Scout Automaton'), role: tl('Fast, blade-armed hunter; flanks in packs'), r: 0.8, lift: 0.95, h: 1.8, hp: 3, speed: 8.5, armour: 1, sight: 38, min: 1, cost: 1, dmg: 8,
    loot: [['scrap', 0.8, 1, 2], ['circuit', 0.25, 1, 1], ['gears', 0.12, 1, 1]], crystals: 2 },
  guardian: { code: 'RD-01', name: tl('Guardian Drone'), role: tl('Four-legged combat automaton with an energy cannon'), r: 1.0, lift: 1.25, h: 2.2, hp: 6, speed: 3.4, armour: 0.85, sight: 34, min: 1.8, cost: 1.5, dmg: 6,
    loot: [['scrap', 1, 2, 3], ['circuit', 0.5, 1, 1], ['gears', 0.25, 1, 2], ['parts', 0.25, 1, 1], ['bearing', 0.08, 1, 1]], crystals: 3 },
  repair: { code: 'RD-05', name: tl('Repair Drone'), role: tl('Support: mends other machines, deploys defence drones'), r: 0.95, lift: 1.7, h: 2.4, hp: 8, speed: 4, armour: 1, sight: 30, min: 3, cost: 1.5, dmg: 0,
    loot: [['circuit', 1, 1, 2], ['scrap', 0.7, 1, 1], ['pcore', 0.2, 1, 1], ['motor', 0.2, 1, 1], ['control', 0.15, 1, 1], ['inverter', 0.12, 1, 1]], crystals: 3 },
  sentinel: { code: 'RD-02', name: tl('Sentinel'), role: tl('Heavy patrol unit: arm cannon and crushing blows'), r: 1.5, lift: 2.0, h: 3.5, hp: 22, speed: 2.3, armour: 0.55, sight: 36, min: 4.5, cost: 4, dmg: 10,
    loot: [['scrap', 1, 4, 6], ['circuit', 0.8, 1, 2], ['pcore', 0.25, 1, 1], ['motor', 0.3, 1, 1], ['gears', 0.4, 1, 2], ['control', 0.15, 1, 1], ['parts', 0.4, 1, 2], ['coil', 0.12, 1, 1], ['bearing', 0.12, 1, 1]], crystals: 8 },
  artillery: { code: 'RD-04', name: tl('Artillery Walker'), role: tl('Long-range shelling; slow and helpless up close'), r: 1.7, lift: 2.3, h: 4, hp: 24, speed: 0.9, armour: 0.55, sight: 95, min: 5, cost: 4, dmg: 28,
    loot: [['scrap', 1, 5, 7], ['circuit', 1, 1, 2], ['pcore', 0.4, 1, 1], ['pipes', 0.3, 1, 2], ['generator', 0.12, 1, 1], ['optics', 0.2, 1, 1], ['pvcell', 0.15, 1, 2], ['inverter', 0.1, 1, 1]], crystals: 8 },
  assault: { code: 'RD-06', name: tl('Assault Construct'), role: tl('Heavy melee: charges and smashes with its hammer'), r: 1.6, lift: 2.1, h: 3.8, hp: 28, speed: 4.2, armour: 0.55, sight: 30, min: 6, cost: 4.5, dmg: 30,
    loot: [['scrap', 1, 5, 7], ['circuit', 0.6, 1, 1], ['pcore', 0.35, 1, 1], ['motor', 0.4, 1, 1], ['pump', 0.1, 1, 1], ['hpe', 0.08, 1, 1], ['parts', 0.4, 1, 2], ['coil', 0.15, 1, 1]], crystals: 9 },
};
/** Robots are drawn amber like every hostile machine; a hit flashes white. */
export const ROBOT_COLOR = 0xffb347, BEAM_COLOR = 0x5cc8ff;
/** Artillery shells: flight time, blast radius, the shortest range it can shell. */
export const SHELL = { flight: 1.8, radius: 4, minRange: 16, range: 110, every: 4.5 };

// (0.194) A destroyed machine does not just fall: it stops, pulses brighter and faster for `pulse` seconds, then
// blows up in a ball of fire (world/blast.ts) that hurts whatever stands close, a little, less towards the edge.
export interface BlastSpec {
  /** Radius (m), damage to a player at the middle (HP), damage to another foe at the middle (its hp). */
  r: number; hurt: number; foe: number;
}
export const BLAST = {
  /** Seconds a wreck pulses before it goes off. */
  pulse: 1.15,
  /** At the edge a blast does this share of its damage. */
  edge: 0.3,
  kinds: {
    scout: { r: 3, hurt: 6, foe: 1.5 },
    guardian: { r: 3.5, hurt: 8, foe: 2 },
    repair: { r: 3.5, hurt: 7, foe: 2 },
    sentinel: { r: 5, hurt: 12, foe: 4 },
    artillery: { r: 5.5, hurt: 14, foe: 5 },
    assault: { r: 5, hurt: 12, foe: 4 },
  } as Record<RobotKind, BlastSpec>,
  /** The hanging dungeon drones and the mounted defence guns. */
  drone: { r: 2.4, hurt: 4, foe: 1 } as BlastSpec,
  turret: { r: 3.5, hurt: 8, foe: 2 } as BlastSpec,
};
/** The share of a blast's damage at distance d (0 outside it). */
export function blastShare(d: number, r: number): number {
  if (!(d < r)) return 0;
  return 1 - (1 - BLAST.edge) * Math.max(0, d) / r;
}
/** The pulse while a wreck winds up: 0..1 brightness at time t of BLAST.pulse, quickening towards the end. */
export function blastPulse(t: number): number {
  const k = Math.min(1, Math.max(0, t / BLAST.pulse)), phase = (3 + 9 * k) * t * Math.PI * 2 * 0.5;
  return 0.5 + 0.5 * Math.sin(phase);
}
