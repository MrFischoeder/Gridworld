import { describe, it, expect } from 'vitest';
import { newChar, gunModsOut } from '../src/save';
import { stackable, putSlot } from '../src/inventory';
import { GUNS, ATTACH_SLOTS, gunStats } from '../src/data/weapons';
import { eatSecs, EAT, NOURISH } from '../src/data/survival';

describe('(0.279) every gun keeps its own attachments', () => {
  it('every gun has the three slots', () => {
    for (const g of Object.values(GUNS)) expect(g!.slots).toEqual(ATTACH_SLOTS);
  });
  it('a pistol with an extended magazine and a scope', () => {
    const p = GUNS.pistol!, s = gunStats(p, ['scope', null, 'magX']);
    expect(s.mag).toBeGreaterThan(p.base.mag);
    expect(s.zoom).toBe(3.5);
    // a scope never makes the rifle's own sight worse; a reflex sight neither
    expect(gunStats(GUNS.rifle!, ['reflex', null, null]).zoom).toBe(GUNS.rifle!.base.zoom);
  });
  it('the old Blaster slots go onto the Blaster', () => {
    const c = newChar();
    c.gunMods = ['reflex', 'barS', null];
    c.hands = [{ k: 'blaster', n: 1 }];
    gunModsOut(c);
    expect(c.hands[0]!.m).toEqual(['reflex', 'barS', null]);
    expect(c.gunMods).toEqual([null, null, null]);
  });
  it('with no Blaster they go into the backpack loose', () => {
    const c = newChar();
    c.hands = [null]; c.inv = c.inv.map(() => null);
    c.gunMods = ['scope', null, 'magD'];
    gunModsOut(c);
    expect(c.inv.filter(Boolean).map((s) => s!.k).sort()).toEqual(['magD', 'scope']);
  });
  it('a gun with attachments never stacks and keeps them when put away', () => {
    const a = { k: 'pistol' as const, n: 1, m: ['reflex', null, null] as ('reflex' | null)[] }, b = { k: 'pistol' as const, n: 1 };
    expect(stackable(a, b)).toBe(false);
    const inv = Array(4).fill(null);
    expect(putSlot(inv, a, 40)).toBe(0);
    expect(inv.find(Boolean)!.m).toEqual(['reflex', null, null]);
  });
});

describe('(0.279) eating takes a moment', () => {
  it('a drink is quick, a big meal longer, never past the limit', () => {
    const drink = Object.keys(NOURISH).find((k) => !NOURISH[k].kcal && NOURISH[k].water)!;
    expect(eatSecs(drink)).toBe(EAT.drink);
    for (const k of Object.keys(NOURISH)) { const s = eatSecs(k); expect(s).toBeGreaterThan(1); expect(s).toBeLessThanOrEqual(EAT.max); }
    const small = Object.keys(NOURISH).filter((k) => NOURISH[k].kcal).sort((x, y) => NOURISH[x].kcal! - NOURISH[y].kcal!);
    expect(eatSecs(small[0])).toBeLessThanOrEqual(eatSecs(small[small.length - 1]));
  });
});
