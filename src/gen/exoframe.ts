// (0.285, the owner's request) The exoskeleton's modules and the frame you build up. What used to be called relics are
// modules that plug into sockets on your harness and frame: the plain harness everyone wears has `HARNESS` sockets, a
// worn exoskeleton adds its own (`FRAME_SOCKETS`), and every extension built onto the frame (`EXO_EXT`, from materials
// in the backpack) adds one more socket and carrying strength. Extensions belong to you and work only while a frame is
// worn. Pure: the state is `Char.exoExt` and the worn `frame`.
import type { ItemKey, WearSlot } from '../data/items';
import { tl } from '../i18n';

/** Sockets on the plain harness (the three module slots of old saves). */
export const HARNESS = 3;
/** Sockets a worn frame adds. */
export const FRAME_SOCKETS: Partial<Record<ItemKey, number>> = { exoL: 1, exoH: 2 };
/** The extensions, in order: what each takes, and the kg it adds to what you carry with ease / before you are overloaded. */
export const EXO_EXT: { name: string; needs: [ItemKey, number][]; comfy: number; max: number }[] = [
  { name: tl('Load struts'), needs: [['scrap', 6], ['wire', 4], ['circuit', 2]], comfy: 4, max: 5 },
  { name: tl('Shoulder servos'), needs: [['steel', 4], ['motor', 2], ['circuit', 3]], comfy: 5, max: 6 },
  { name: tl('Spine core'), needs: [['steel', 4], ['control', 2], ['pcore', 1]], comfy: 6, max: 8 },
];
/** The most sockets anybody has: the harness, the biggest frame and every extension. */
export const MOD_MAX = HARNESS + Math.max(...Object.values(FRAME_SOCKETS).map(Number)) + EXO_EXT.length;

/** Extensions working now (only with a frame on). */
export const extActive = (wear: Partial<Record<WearSlot, ItemKey | null>>, ext = 0) => (wear.frame ? Math.max(0, Math.min(EXO_EXT.length, ext | 0)) : 0);
/** How many module sockets are open. */
export function modSockets(wear: Partial<Record<WearSlot, ItemKey | null>>, ext = 0): number {
  const f = wear.frame;
  return HARNESS + (f ? FRAME_SOCKETS[f] ?? 0 : 0) + extActive(wear, ext);
}
/** The extensions' extra kg (with ease, before overload). */
export function extLoad(wear: Partial<Record<WearSlot, ItemKey | null>>, ext = 0): { comfy: number; max: number } {
  let comfy = 0, max = 0;
  for (let i = 0; i < extActive(wear, ext); i++) { comfy += EXO_EXT[i].comfy; max += EXO_EXT[i].max; }
  return { comfy, max };
}
/** Why the next extension cannot be built now ('' = it can): `have` counts what you carry. */
export function extProblem(wear: Partial<Record<WearSlot, ItemKey | null>>, ext: number, have: (k: ItemKey) => number): string {
  if (!wear.frame) return 'frame';
  if (ext >= EXO_EXT.length) return 'full';
  return EXO_EXT[ext].needs.some(([k, n]) => have(k) < n) ? 'needs' : '';
}
/** The module slots past the open sockets that hold something (a frame coming off would leave them). */
export const strandedMods = (mods: (ItemKey | null)[], open: number) => mods.slice(open).filter(Boolean).length;
