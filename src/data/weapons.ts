// Guns and their attachments. Pure data: world/weapons.ts fires them, the backpack fits attachments into the slots.
import type { ItemKey } from './items';
import { tl } from '../i18n';

export type AttachSlot = 'optic' | 'barrel' | 'mag';
export const ATTACH_SLOTS: AttachSlot[] = ['optic', 'barrel', 'mag'];
export const SLOT_NAME: Record<AttachSlot, string> = { optic: tl('Optic'), barrel: tl('Barrel'), mag: tl('Magazine') };

export interface GunStats {
  /** Damage per hit (before level and relic bonuses). */
  dmg: number;
  /** Seconds between shots (before the Power Cell relic). */
  interval: number;
  /** Hits land only up to this distance (m). */
  range: number;
  /** Rounds per magazine and seconds to reload (rounds come out of the backpack: the gun's `ammo`). */
  mag: number; reload: number;
  /** Field-of-view zoom while aiming (right mouse button / AIM). */
  zoom: number;
  /** How far a shot is heard (m): creatures, bandits and drones in this circle come looking. */
  noise: number;
}
/** How a gun looks in your hands (world/weapons.ts). */
export type GunLook = 'blaster' | 'pistol' | 'shotgun' | 'rifle' | 'smg';
/**
 * A gun: its base stats, attachment slots (only the Blaster takes attachments for now), the rounds it fires (an item
 * in the backpack: ammunition is limited), and for a shotgun the pellets per shot and their spread (radians).
 */
export interface GunSpec { name: string; base: GunStats; slots: AttachSlot[]; ammo: ItemKey; look: GunLook; pellets?: number; spread?: number; /** (0.193) Its own kind of rounds, used only when AMMO_TYPES is on. */ round?: ItemKey }
/**
 * (0.193, the owner's call) Rounds of their own kind per gun are shelved for now: every gun fires Energy Cells
 * ('ammoE') and differs only in how it shoots and how its shots look (SHOT). Pistol rounds, shells and rifle rounds
 * stay as items (old saves keep them) but nothing drops or makes them. Turn this on to bring the old rounds back
 * (each gun's `round`, the loot rolls and the blacksmith's orders follow it).
 */
export const AMMO_TYPES = false;
/** The rounds a gun fires now. */
const fires = (round: ItemKey): ItemKey => (AMMO_TYPES ? round : 'ammoE');
/** The starting gun: an energy rifle that fires Energy Cells. */
export const BLASTER: GunSpec = { name: tl('Blaster'), base: { dmg: 1, interval: 0.16, range: 70, mag: 20, reload: 1.5, zoom: 1.2, noise: 55 }, slots: ATTACH_SLOTS, ammo: 'ammoE', look: 'blaster' };
/** Every gun, by its item. */
export const GUNS: Partial<Record<ItemKey, GunSpec>> = {
  blaster: BLASTER,
  pistol: { name: tl('Old Pistol'), base: { dmg: 1.6, interval: 0.3, range: 45, mag: 12, reload: 1.2, zoom: 1.15, noise: 45 }, slots: [], ammo: fires('ammo9'), round: 'ammo9', look: 'pistol' },
  smg: { name: tl('Scrap SMG'), base: { dmg: 0.75, interval: 0.085, range: 45, mag: 30, reload: 1.7, zoom: 1.15, noise: 50 }, slots: [], ammo: fires('ammo9'), round: 'ammo9', look: 'smg' },
  shotgun: { name: tl('Scattergun'), base: { dmg: 0.9, interval: 0.8, range: 26, mag: 6, reload: 2.6, zoom: 1.1, noise: 70 }, slots: [], ammo: fires('ammoS'), round: 'ammoS', look: 'shotgun', pellets: 7, spread: 0.07 },
  rifle: { name: tl('Hunting Rifle'), base: { dmg: 4.5, interval: 1.0, range: 150, mag: 5, reload: 2.4, zoom: 3, noise: 95 }, slots: [], ammo: fires('ammoR'), round: 'ammoR', look: 'rifle' },
};
export const gunOf = (k: ItemKey | null | undefined): GunSpec | null => (k && GUNS[k]) || null;

/** How a melee weapon looks in your hands. */
export type MeleeLook = 'blade' | 'machete' | 'spear' | 'sledge';
/** A melee weapon: damage per swing, seconds between swings, reach (m), the stamina a swing costs (× the blade's), how it looks. */
export interface MeleeSpec { name: string; dmg: number; rate: number; reach: number; stamina: number; look: MeleeLook }
export const MELEE: Partial<Record<ItemKey, MeleeSpec>> = {
  blade: { name: tl('Energy Blade'), dmg: 5, rate: 0.42, reach: 2.6, stamina: 1, look: 'blade' },
  machete: { name: tl('Machete'), dmg: 3.5, rate: 0.34, reach: 2.3, stamina: 0.7, look: 'machete' },
  spear: { name: tl('Spear'), dmg: 4, rate: 0.6, reach: 3.6, stamina: 0.9, look: 'spear' },
  sledge: { name: tl('Sledgehammer'), dmg: 10, rate: 1.05, reach: 2.5, stamina: 1.8, look: 'sledge' },
};
export const meleeOf = (k: ItemKey | null | undefined): MeleeSpec | null => (k && MELEE[k]) || null;
/** The kinds of rounds, and the guns that fire them. */
export const AMMO: ItemKey[] = ['ammoE', 'ammo9', 'ammoS', 'ammoR'];
/** The rounds anything gives or makes now (only Energy Cells while AMMO_TYPES is off). */
export const roundsInUse = (k: ItemKey) => AMMO_TYPES || k === 'ammoE' || !AMMO.includes(k);
/**
 * (0.193) How a gun's shots look: 'beam' = a line from the muzzle that fades (`life` s), 'bolt' = a short streak
 * (`len` m) flying to the target at `speed` m/s; `c` the colour, `hit` the sparks' size, `core` a second bright line.
 */
export interface ShotLook { kind: 'beam' | 'bolt'; c: number; life: number; len: number; speed: number; hit: number; core?: number }
export const SHOT: Record<GunLook, ShotLook> = {
  blaster: { kind: 'beam', c: 0x9dffb4, life: 0.12, len: 0, speed: 0, hit: 1 },
  pistol: { kind: 'bolt', c: 0x7fe8ff, life: 0, len: 2.2, speed: 220, hit: 1.1 },
  smg: { kind: 'bolt', c: 0xd0a8ff, life: 0, len: 1.3, speed: 260, hit: 0.7 },
  shotgun: { kind: 'bolt', c: 0xffb060, life: 0, len: 0.8, speed: 170, hit: 0.5 },
  rifle: { kind: 'beam', c: 0xb8f0ff, life: 0.32, len: 0, speed: 0, hit: 1.8, core: 0xffffff },
};

export interface AttachDef { slot: AttachSlot; apply(s: GunStats): void }
export const ATTACHMENTS: Partial<Record<ItemKey, AttachDef>> = {
  reflex: { slot: 'optic', apply: (s) => { s.zoom = 1.6; s.range += 10; } },
  scope: { slot: 'optic', apply: (s) => { s.zoom = 3.5; s.range += 50; } },
  barL: { slot: 'barrel', apply: (s) => { s.dmg *= 1.25; s.range += 20; s.interval *= 1.1; } },
  barR: { slot: 'barrel', apply: (s) => { s.interval /= 1.25; s.dmg *= 0.9; } },
  barS: { slot: 'barrel', apply: (s) => { s.noise *= 0.22; s.dmg *= 0.95; s.range -= 5; } },
  magX: { slot: 'mag', apply: (s) => { s.mag = Math.round(s.mag * 1.6); } },
  magD: { slot: 'mag', apply: (s) => { s.mag = Math.round(s.mag * 2.5); s.reload *= 1.4; } },
};
/** Which slot an item fits in, or null when it is not an attachment. */
export const attachSlot = (k: ItemKey | null | undefined): AttachSlot | null => (k && ATTACHMENTS[k]?.slot) || null;

/** Stats of a gun with the attachments fitted in its slots (same order as spec.slots; a gun without slots takes none). */
export function gunStats(gun: GunSpec, fitted: (ItemKey | null)[]): GunStats {
  const s = { ...gun.base };
  gun.slots.forEach((slot, i) => { const k = fitted[i], a = k && ATTACHMENTS[k]; if (a && a.slot === slot) a.apply(s); });
  return s;
}
