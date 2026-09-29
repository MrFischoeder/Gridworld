import { describe, it, expect } from 'vitest';
import { ITEMS, type ItemKey } from '../src/data/items';
import { hasIcon, itemIcon } from '../src/ui/icons';
import { itemTip, shortName } from '../src/ui/itemtip';
import { usesOf } from '../src/data/uses';

const KEYS = Object.keys(ITEMS) as ItemKey[];
describe('item icons and tooltips', () => {
  it('every item has an icon of well-formed path data', () => {
    const missing = KEYS.filter((k) => !hasIcon(k));
    expect(missing).toEqual([]);
    for (const k of KEYS) { const d = /d="([^"]*)"/.exec(itemIcon(k))![1]; expect(d).toMatch(/^M[-\d. MLZQAHVmahvlz]*$/); expect(d).not.toMatch(/NaN|undefined/); }
  });
  it('every item has a tooltip with its weight', () => {
    for (const k of KEYS) { const t = itemTip(k, 3); expect(t).toContain(ITEMS[k].name); expect(t).toMatch(/kg/); expect(t).not.toMatch(/undefined|NaN/); }
  });
  it('shows numbers and uses', () => {
    expect(itemTip('blaster')).toMatch(/damage/);
    expect(itemTip('vest')).toMatch(/15% off/);
    expect(itemTip('barL')).toMatch(/damage \+25%/);
    expect(itemTip('bread')).toMatch(/kcal/);
    expect(usesOf('log').length).toBeGreaterThanOrEqual(3);
    expect(itemTip('log')).toMatch(/Used for/);
    expect(shortName('grain')).toBe('Grain');
  });
});
