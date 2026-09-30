import { describe, it, expect } from 'vitest';
import { ITEMS, WEAR, BULK, PACK, gearOf, PACK_VOL, EXO, type ItemKey } from '../src/data/items';
import { ORDERS } from '../src/data/orders';
import { TECHS } from '../src/gen/tech';

const SETS = { hide: ['hideCap', 'hideCoat', 'hideGloves', 'hideLegs', 'hideBoots'], woven: ['wovenHood', 'wovenJacket', 'wovenGloves', 'wovenLegs', 'wovenBoots'], comp: ['compHelm', 'compVest', 'compGloves', 'compLegs', 'compBoots'] } as Record<string, ItemKey[]>;
const total = (ks: ItemKey[]) => 1 - ks.reduce((a, k) => a * (1 - WEAR[k]!.def), 1);

describe('armour, packs and exoskeletons', () => {
  it('three kinds of armour, each set better than the one before, all made by the blacksmith', () => {
    const t = [total(SETS.hide), total(SETS.woven), total(SETS.comp)];
    expect(t[0]).toBeLessThan(t[1]); expect(t[1]).toBeLessThan(t[2]);
    const slots = (ks: ItemKey[]) => ks.map((k) => WEAR[k]!.slot).sort();
    expect(slots(SETS.woven)).toEqual(slots(SETS.hide)); expect(slots(SETS.comp)).toEqual(slots(SETS.hide));
    // the composite armour stops more than plate at well under its weight
    expect(WEAR.compVest!.def).toBeGreaterThan(WEAR.armour!.def); expect(BULK.compVest[0]).toBeLessThan(BULK.armour[0] / 2);
    const ids = new Set(TECHS.map((x) => x.id));
    for (const k of [...SETS.hide, ...SETS.woven, ...SETS.comp, 'rucksack', 'framepack', 'cargopack', 'exoL', 'exoH'] as ItemKey[]) {
      const o = ORDERS.find((o) => o.out === k)!;
      expect(o, k).toBeTruthy(); if (o.tech) expect(ids.has(o.tech)).toBe(true);
      for (const [i] of o.needs) expect(ITEMS[i], i).toBeTruthy();
    }
    for (const k of SETS.hide) expect(ORDERS.find((o) => o.out === k)!.tech).toBe(''); // hide armour needs no plans
  });
  it('a bigger pack holds more; an exoskeleton carries more, walks faster and saves stamina', () => {
    expect(gearOf({})).toEqual({ vol: PACK.vol, comfy: PACK.comfy, max: PACK.max, speed: 1, stamina: 1 });
    const v = ['rucksack', 'framepack', 'cargopack'].map((k) => gearOf({ pack: k as ItemKey }).vol);
    expect(v[0]).toBeGreaterThan(PACK.vol); expect(v[1]).toBeGreaterThan(v[0]); expect(v[2]).toBeGreaterThan(v[1]);
    for (const k of Object.keys(PACK_VOL) as ItemKey[]) expect(WEAR[k]!.slot).toBe('pack');
    const l = gearOf({ frame: 'exoL' }), h = gearOf({ frame: 'exoH' });
    expect(l.comfy).toBe(PACK.comfy + EXO.exoL!.comfy); expect(h.max).toBeGreaterThan(l.max);
    expect(l.speed).toBeGreaterThan(1); expect(h.speed).toBeGreaterThan(l.speed);
    expect(l.stamina).toBeLessThan(1); expect(h.stamina).toBeLessThan(l.stamina);
    // an exoskeleton's own weight is covered by what it carries
    expect(EXO.exoL!.comfy).toBeGreaterThan(BULK.exoL[0]); expect(EXO.exoH!.comfy).toBeGreaterThan(BULK.exoH[0]);
  });
});

import { HAND_TOOLS } from '../src/data/items';
describe('tools work from the hands', () => {
  it('every hand tool is a tool; instruments that work carried are not hand tools', () => {
    for (const k of HAND_TOOLS) expect(ITEMS[k].type).toBe('tool');
    for (const k of ['compass', 'scanner', 'tablet'] as ItemKey[]) expect(HAND_TOOLS.has(k)).toBe(false);
    for (const k of ['hatchet', 'pickaxe', 'hammer', 'torch'] as ItemKey[]) expect(HAND_TOOLS.has(k)).toBe(true);
  });
});
