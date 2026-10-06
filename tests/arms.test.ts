import { describe, it, expect } from 'vitest';
import { GUNS, MELEE, AMMO, gunOf, meleeOf } from '../src/data/weapons';
import { ITEMS, WEAPON_KIND, BULK } from '../src/data/items';
import { ORDERS } from '../src/data/orders';
import { TECHS } from '../src/gen/tech';
import { freshParts, repairWithKit, VEHICLES, KIT } from '../src/data/vehicles';
import { usesOf } from '../src/data/uses';

describe('arms, rounds, the GPS tablet and the repair kit', () => {
  it('every gun fires a kind of round that exists; every weapon has a kind and a weight', () => {
    for (const [k, g] of Object.entries(GUNS)) {
      expect(AMMO).toContain(g!.ammo); expect(ITEMS[g!.ammo].type).toBe('ammo');
      expect(WEAPON_KIND[k as keyof typeof WEAPON_KIND]).toBe(0); expect(gunOf(k as never)).toBe(g);
      expect(usesOf(g!.ammo).length).toBeGreaterThan(0);
    }
    for (const k of Object.keys(MELEE)) { expect(WEAPON_KIND[k as keyof typeof WEAPON_KIND]).toBe(1); expect(meleeOf(k as never)).toBeTruthy(); }
    for (const k of [...Object.keys(GUNS), ...Object.keys(MELEE), ...AMMO, 'tablet', 'repairkit']) expect(BULK[k as keyof typeof BULK]).toBeTruthy();
  });
  it('rounds, guns, the tablet and the kit can be ordered once the plans are yours (none without)', () => {
    const ids = new Set(TECHS.map((t) => t.id));
    for (const k of [...AMMO, ...Object.keys(GUNS).filter((k) => k !== 'blaster'), ...Object.keys(MELEE).filter((k) => k !== 'blade'), 'tablet', 'repairkit']) {
      const o = ORDERS.find((o) => o.out === k);
      expect(o, k).toBeTruthy(); expect(o!.tech).not.toBe(''); expect(ids.has(o!.tech)).toBe(true);
      for (const [i] of o!.needs) expect(ITEMS[i]).toBeTruthy();
    }
    expect(TECHS.map((t) => t.id).slice(-10)).toEqual(['gunsmith', 'weaving', 'composites', 'exoframe', 'electricity', 'metallurgy', 'semiconductors', 'computing', 'aerospace', 'powergrid']); // appended: the others keep their sites
  });
  it('the repair kit repairs the shared condition pool, including a disabled vehicle', () => {
    const p = freshParts('scout'), max = VEHICLES.scout.hull;
    expect(repairWithKit('scout', p)).toBe('');
    p.hull = max * 0.3; p.engine = 50; p.wheels = [60, -1, 100, 90];
    expect(repairWithKit('scout', p)).not.toBe('');
    expect(p.hull).toBeCloseTo(max * (0.3 + KIT.hull)); expect(p.engine).toBe(50); expect(p.wheels).toEqual([60, -1, 100, 90]);
    p.hull = 0; expect(repairWithKit('scout', p)).not.toBe(''); expect(p.hull).toBe(max * KIT.hull);
  });
});
