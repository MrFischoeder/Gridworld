import { describe, it, expect } from 'vitest';
import { dropStack, moveStack, putSlot, putItems } from '../src/inventory';
import { gunStats, BLASTER, attachSlot } from '../src/data/weapons';
import { freshParts, upgradeParts, engineBoost, hurtEngine, type VehicleParts } from '../src/data/vehicles';
import type { Slot } from '../src/save';

const slots = (...s: (Slot | null)[]) => s;

describe('drag and drop between slots', () => {
  it('drops into an empty slot, merges stacks, swaps different items', () => {
    const a = slots({ k: 'medkit', n: 2 }, null), b = slots({ k: 'medkit', n: 4 }, { k: 'emp', n: 1 });
    dropStack(a, 0, b, 1); // medkits onto the EMP: swap
    expect(a[0]).toEqual({ k: 'emp', n: 1 }); expect(b[1]).toEqual({ k: 'medkit', n: 2 });
    dropStack(b, 1, b, 0); // 2 medkits onto 4 (stack of 5): 1 moves, 1 stays
    expect(b[0]!.n).toBe(5); expect(b[1]!.n).toBe(1);
    dropStack(b, 1, a, 1);
    expect(a[1]).toEqual({ k: 'medkit', n: 1 }); expect(b[1]).toBeNull();
  });
  it('worn parts keep their condition and never stack', () => {
    const inv = slots({ k: 'wheelL', n: 1, c: 40 }, null, null);
    putSlot(inv, { k: 'wheelL', n: 1, c: 70 });
    expect(inv[1]).toEqual({ k: 'wheelL', n: 1, c: 70 });
    putItems(inv, 'wheelL', 1); // a new tire does not join a worn one
    expect(inv[2]).toEqual({ k: 'wheelL', n: 1 });
    const box = slots(null, null);
    moveStack(inv, 0, box);
    expect(box[0]).toEqual({ k: 'wheelL', n: 1, c: 40 });
    dropStack(inv, 1, inv, 2); // worn onto new: swap, no merge
    expect(inv[2]).toEqual({ k: 'wheelL', n: 1, c: 70 });
  });
});
describe('gun attachments', () => {
  it('each attachment fits one slot and changes the stats', () => {
    expect(attachSlot('scope')).toBe('optic'); expect(attachSlot('magD')).toBe('mag'); expect(attachSlot('medkit')).toBeNull();
    const base = gunStats(BLASTER, [null, null, null]);
    expect(base).toEqual(BLASTER.base);
    const s = gunStats(BLASTER, ['scope', 'barL', 'magX']);
    expect(s.range).toBe(BLASTER.base.range + 70);
    expect(s.zoom).toBe(3.5); expect(s.mag).toBe(32); expect(s.dmg).toBeCloseTo(1.25);
    // an attachment in the wrong slot does nothing
    expect(gunStats(BLASTER, ['magD', null, null])).toEqual(BLASTER.base);
  });
});
describe('engine upgrades', () => {
  it('turbo boosts, the guard halves engine damage, old saves get empty slots', () => {
    const p = freshParts('scout');
    expect(engineBoost(p).speed).toBe(1);
    p.mods = ['turbo', 'eguard'];
    expect(engineBoost(p).speed).toBeGreaterThan(1);
    hurtEngine(p, 20); expect(p.engine).toBe(90);
    const old = { wheels: [100, 100, 100, 100], engine: 100, gun: false } as unknown as VehicleParts;
    expect(upgradeParts('scout', old).mods).toEqual([null, null]);
  });
});
