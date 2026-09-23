// Guns and their attachments. Pure data: world/weapons.ts fires them, the backpack fits attachments into the slots.
import type { ItemKey } from './items';

export type AttachSlot = 'optic' | 'barrel' | 'mag';
export const ATTACH_SLOTS: AttachSlot[] = ['optic', 'barrel', 'mag'];
export const SLOT_NAME: Record<AttachSlot, string> = { optic: 'Optic', barrel: 'Barrel', mag: 'Magazine' };

export interface GunStats {
  /** Damage per hit (before level and relic bonuses). */
  dmg: number;
  /** Seconds between shots (before the Power Cell relic). */
  interval: number;
  /** Hits land only up to this distance (m). */
  range: number;
  /** Rounds per magazine and seconds to reload. Reserve ammo is unlimited for now. */
  mag: number; reload: number;
  /** Field-of-view zoom while aiming (right mouse button / AIM). */
  zoom: number;
  /** How far a shot is heard (m): creatures, bandits and drones in this circle come looking. */
  noise: number;
}
export interface GunSpec { name: string; base: GunStats; slots: AttachSlot[] }
/** The starting gun. More guns can come later with their own base stats and slots. */
export const BLASTER: GunSpec = { name: 'Blaster', base: { dmg: 1, interval: 0.16, range: 70, mag: 20, reload: 1.5, zoom: 1.2, noise: 55 }, slots: ATTACH_SLOTS };

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

/** Stats of a gun with the attachments fitted in its slots (same order as spec.slots). */
export function gunStats(gun: GunSpec, fitted: (ItemKey | null)[]): GunStats {
  const s = { ...gun.base };
  gun.slots.forEach((slot, i) => { const k = fitted[i], a = k && ATTACHMENTS[k]; if (a && a.slot === slot) a.apply(s); });
  return s;
}
