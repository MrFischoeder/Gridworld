// A real flashlight attached to one weapon, not a character-wide upgrade. Pure inventory rules.
import { TWO_HANDED, BULK, gearOf, type ItemKey } from '../data/items';
import { gunOf } from '../data/weapons';
import { putItems, bulkOf } from '../inventory';
import type { Char, Slot } from '../save';
import { tl } from '../i18n';

type Kit = Pick<Char, 'inv' | 'hands' | 'back' | 'off' | 'light' | 'wear'>;
export const takesFlashlight = (k: ItemKey) => !!gunOf(k) && TWO_HANDED.has(k);
export const mountedFlashlight = (s: Slot | null | undefined) => !!s?.fl && takesFlashlight(s.k);
const owns = (c: Kit, s: Slot) => [c.inv, c.hands, c.back].some(list => list.includes(s));
/** Empty string on success, otherwise a message; a failure leaves the whole kit untouched. */
export function mountFlashlight(c: Kit, gun: Slot, source?: Slot, cap = gearOf(c.wear).vol): string {
  if (!owns(c, gun) || !takesFlashlight(gun.k) || gun.n !== 1) return tl('A flashlight fits a two-handed gun only.');
  if (gun.fl) return tl('This weapon already has a flashlight.');
  for (const list of [c.inv, c.off, c.hands]) {
    const i = list.findIndex(s => s?.k === 'flashlight' && (!source || s === source));
    if (i < 0) continue;
    const volume = bulkOf(c.inv) + (c.inv.includes(gun) ? BULK.flashlight[1] : 0) - (list === c.inv ? BULK.flashlight[1] : 0);
    if (volume > cap + 1e-6) return tl('No room in the backpack for the flashlight.');
    if (--list[i]!.n <= 0) list[i] = null;
    gun.fl = true;
    if (c.light?.on === 1 && !mountedFlashlight(c.hands[0]) && c.off[0]?.k !== 'flashlight') c.light.on = 0;
    return '';
  }
  return tl('You need a flashlight in your kit to fit it to this weapon.');
}
export function unmountFlashlight(c: Kit, gun: Slot, cap: number): string {
  if (!owns(c, gun) || !mountedFlashlight(gun)) return tl('This weapon has no mounted flashlight.');
  // Removing a lamp from a packed gun frees its own volume before putting that same lamp in the backpack.
  delete gun.fl;
  const inv = c.inv.map(s => s ? { ...s } : null);
  if (putItems(inv, 'flashlight', 1, cap)) { gun.fl = true; return tl('No room in the backpack for the flashlight.'); }
  inv.forEach((s, i) => { c.inv[i] = s; });
  if (c.hands[0] === gun && c.light?.on === 1) c.light.on = 0;
  return '';
}
