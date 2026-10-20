import { describe, it, expect } from 'vitest';
import { airTemp, feltTemp, bodyTarget, stepBody, bodyState, bodyEffects, clothing, BIOME_TEMP, CLOTH_TEMP, TEMP } from '../src/gen/temperature';
import { biomeAt } from '../src/gen/biomes';
import { ITEMS, WEAR, BULK } from '../src/data/items';
import { ORDERS } from '../src/data/orders';

describe('temperature and clothing (B4a)', () => {
  it('every piece with a temperature is worn and orderable or sold', () => {
    for (const k of Object.keys(CLOTH_TEMP) as (keyof typeof ITEMS)[]) { expect(ITEMS[k]).toBeTruthy(); expect(WEAR[k]).toBeTruthy(); expect(BULK[k]).toBeTruthy(); }
    for (const k of ['furHood', 'furCoat', 'furMitts', 'furTrousers', 'furBoots', 'desertRobe', 'shemagh']) expect(ORDERS.some((o) => o.out === k && !o.tech)).toBe(true);
  });
  it('day is warmer than night, height and weather cool the air', () => {
    const w = 12345;
    const day = airTemp(w, 0, 0, 5, { day: 1 }), night = airTemp(w, 0, 0, 5, { day: 0 });
    expect(day).toBeGreaterThan(night);
    expect(airTemp(w, 0, 0, 300, { day: 1 })).toBeLessThan(day);
    expect(airTemp(w, 0, 0, 5, { day: 1, rain: 1 })).toBeLessThan(day);
    expect(day).toBeGreaterThan(14); expect(day).toBeLessThan(22); // temperate round Gridholm
  });
  it('biomes have their own air', () => {
    const w = 12345, hits: Record<string, number[]> = {};
    for (let i = 0; i < 4000 && Object.keys(hits).length < 8; i++) {
      const x = ((i * 7919) % 200) * 300 - 30000, z = ((i * 104729) % 160) * 300 - 24000, b = biomeAt(w, x, z);
      (hits[b] ??= []).push(airTemp(w, x, z, 5, { day: 0.5 }));
    }
    for (const [b, ts] of Object.entries(hits)) { const [d, n] = BIOME_TEMP[b as keyof typeof BIOME_TEMP]; const m = ts.reduce((a, t) => a + t, 0) / ts.length; expect(m).toBeGreaterThan(n - 8); expect(m).toBeLessThan(d + 2); }
  });
  it('furs keep the tundra night bearable, a robe the desert noon', () => {
    const furs = clothing(['furHood', 'furCoat', 'furMitts', 'furTrousers', 'furBoots']);
    const bare = bodyTarget(feltTemp({ air: BIOME_TEMP.tundra[1], warm: 0, cool: 0 }));
    const clad = bodyTarget(feltTemp({ air: BIOME_TEMP.tundra[1], ...furs }));
    expect(bodyState(bare)).toBe('freezing'); expect(clad).toBeGreaterThan(bare + 50);
    const desert = clothing(['desertRobe', 'shemagh']);
    expect(bodyState(bodyTarget(feltTemp({ air: 40, warm: 0, cool: 0 })))).toBe('overheated');
    expect(bodyTarget(feltTemp({ air: 40, ...desert }))).toBeLessThan(20);
    // a fur coat in the heat is worse than nothing
    expect(feltTemp({ air: 35, ...furs })).toBeGreaterThan(35);
  });
  it('a fire and a roof help, the body follows slowly, only weakens', () => {
    expect(feltTemp({ air: -10, warm: 0, cool: 0, heat: TEMP.fire.add })).toBeGreaterThan(4);
    expect(feltTemp({ air: -10, warm: 0, cool: 0, shelter: TEMP.house })).toBeGreaterThan(10);
    let b = 0; for (let i = 0; i < 30; i++) b = stepBody(b, -100, 1);
    expect(b).toBeLessThan(-20); expect(b).toBeGreaterThan(-40);
    const cold = bodyEffects(-100), hot = bodyEffects(100), ok = bodyEffects(0);
    expect(ok).toEqual({ kcal: 1, water: 1, regen: 1, effort: 1, speed: 1 });
    expect(cold.kcal).toBeGreaterThan(2); expect(cold.speed).toBeLessThan(1);
    expect(hot.water).toBeGreaterThan(2.5); expect(hot.effort).toBeGreaterThan(1.5);
    expect(bodyEffects(-20)).toEqual(ok);
  });
});
