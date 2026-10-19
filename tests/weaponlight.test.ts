import { describe, it, expect } from 'vitest';
import { mountFlashlight, unmountFlashlight, takesFlashlight, mountedFlashlight } from '../src/gen/weaponlight';
import { newChar, loadChar, SAVE_KEY, type Slot } from '../src/save';
import { BULK, type ItemKey } from '../src/data/items';
import { moveStack, dropStack, bulkOf, weightOf, slotBulk } from '../src/inventory';

describe('flashlights mounted on individual weapons', () => {
  it('fits the four two-handed guns, not pistols, melee weapons or two-handed tools', () => {
    for (const k of ['blaster', 'smg', 'shotgun', 'rifle'] as ItemKey[]) expect(takesFlashlight(k)).toBe(true);
    for (const k of ['pistol', 'spear', 'sledge', 'pickaxe', 'blade', 'flashlight'] as ItemKey[]) expect(takesFlashlight(k)).toBe(false);
  });
  it('consumes one owned flashlight, retains the gun in both hands and leaves battery charge unchanged', () => {
    const c = newChar(), gun: Slot = { k: 'rifle', n: 1 }, spare: Slot = { k: 'rifle', n: 1 };
    c.hands = [gun]; c.back = [spare, null]; c.off = [{ k: 'flashlight', n: 1 }]; c.light = { on: 1, flash: 23, oil: 0 };
    expect(mountFlashlight(c, gun)).toBe(''); expect(c.hands[0]).toBe(gun); expect(c.off[0]).toBeNull();
    expect(mountedFlashlight(gun)).toBe(true); expect(spare.fl).toBeUndefined(); expect(c.light).toMatchObject({ on: 1, flash: 23 });
    const before = JSON.stringify(c); expect(mountFlashlight(c, gun)).not.toBe(''); expect(JSON.stringify(c)).toBe(before);
  });
  it('requires a real flashlight and an owned compatible weapon; mounting on a back slot extinguishes a hand light', () => {
    const c = newChar(), rifle: Slot = { k: 'rifle', n: 1 };
    c.back[0] = rifle;
    expect(mountFlashlight(c, rifle)).not.toBe(''); expect(rifle.fl).toBeUndefined();
    c.off[0] = { k: 'flashlight', n: 1 }; c.back[1] = { k: 'blade', n: 1 }; c.light = { on: 1, flash: 12, oil: 0 };
    const before = JSON.stringify(c);
    expect(mountFlashlight(c, { k: 'rifle', n: 1 })).not.toBe(''); expect(JSON.stringify(c)).toBe(before);
    expect(mountFlashlight(c, c.back[1]!)).not.toBe(''); // a blade cannot take a rail light
    expect(mountFlashlight(c, rifle)).toBe(''); expect(c.light.on).toBe(0); expect(c.light.flash).toBe(12);
  });
  it('removes the same flashlight safely, refusing a full backpack without changing the weapon or its light', () => {
    const c = newChar(), gun: Slot = { k: 'rifle', n: 1, fl: true };
    c.hands[0] = gun; c.inv = [{ k: 'scrap', n: 1 }]; c.light = { on: 1, flash: 33, oil: 0 };
    const before = JSON.stringify(c); expect(unmountFlashlight(c, gun, 40)).not.toBe(''); expect(JSON.stringify(c)).toBe(before);
    c.inv[0] = null; expect(unmountFlashlight(c, gun, 40)).toBe(''); expect(gun.fl).toBeUndefined();
    expect(c.inv[0]).toEqual({ k: 'flashlight', n: 1 }); expect(c.light).toMatchObject({ on: 0, flash: 33 });
  });
  it('keeps mounted lights through backpack, chest, drag swaps and save/load, without copying them to spare guns', () => {
    const c = newChar(), gun: Slot = { k: 'rifle', n: 1, fl: true }, box: (Slot | null)[] = [null, null];
    c.hands = [gun]; c.inv[0] = { k: 'rifle', n: 1 };
    expect(moveStack(c.hands, 0, c.inv, 40)).toBe(1); expect(c.inv[1]).toEqual(gun);
    expect(dropStack(c.inv, 1, c.inv, 0)).toBe(true); expect(c.inv[0]?.fl).toBe(true); expect(c.inv[1]?.fl).toBeUndefined();
    expect(moveStack(c.inv, 0, box)).toBe(1); expect(box[0]?.fl).toBe(true);
    c.containers.test = { items: box, gold: 0 };
    const loaded = loadChar({ getItem: k => k === SAVE_KEY ? JSON.stringify(c) : null });
    expect(loaded.containers.test.items[0]).toEqual(gun);
    expect(loaded.inv.some(s => s?.fl)).toBe(false);
  });
  it('counts the attached flashlight in weight and bulk and refuses transfers where only a bare gun would fit', () => {
    const gun: Slot = { k: 'rifle', n: 1, fl: true }, box: (Slot | null)[] = [gun], inv: (Slot | null)[] = [null];
    expect(weightOf(box)).toBeCloseTo(BULK.rifle[0] + BULK.flashlight[0]); expect(bulkOf(box)).toBeCloseTo(BULK.rifle[1] + BULK.flashlight[1]);
    expect(moveStack(box, 0, inv, BULK.rifle[1])).toBe(0); expect(box[0]).toBe(gun);
    expect(dropStack(box, 0, inv, 0, slotBulk(gun))).toBe(true); expect(inv[0]?.fl).toBe(true);
  });
  it('can detach a packed gun at its exact volume limit, with enough slots for the same two items', () => {
    const c = newChar(), gun: Slot = { k: 'rifle', n: 1, fl: true }; c.inv = [gun, null];
    const cap = bulkOf(c.inv); expect(unmountFlashlight(c, gun, cap)).toBe('');
    expect(c.inv).toEqual([{ k: 'rifle', n: 1 }, { k: 'flashlight', n: 1 }]); expect(bulkOf(c.inv)).toBeCloseTo(cap);
  });
  it('does not overfill a packed gun when the flashlight comes from the other hand', () => {
    const c = newChar(), gun: Slot = { k: 'rifle', n: 1 }; c.inv = [gun]; c.off[0] = { k: 'flashlight', n: 1 };
    const before = JSON.stringify(c); expect(mountFlashlight(c, gun, undefined, bulkOf(c.inv))).not.toBe('');
    expect(JSON.stringify(c)).toBe(before);
  });
});
