import { describe, it, expect } from 'vitest';
import { GOODS, profileOf, quote, trade, shiftNow, MARKET, GOOD_INFO, type MarketState } from '../src/gen/market';
import { powerKind } from '../src/gen/town';
import { industryOf, INDUSTRY } from '../src/gen/industry';
import { allVillages, villageSeed } from '../src/gen/regions';
import { hash } from '../src/core/rng';

const w = hash(4, 4);
describe('village markets', () => {
  const vs = allVillages(w).slice(0, 60);
  it('every village makes one or two goods (by its industry) and wants two others; generator villages want fuel; villages differ', () => {
    const seen = new Set<string>();
    for (const v of vs) {
      const s = villageSeed(w, v), p = profileOf(w, v, s);
      expect(p).toEqual(profileOf(w, v, s));
      expect(p.makes.length).toBeGreaterThanOrEqual(1); expect(p.makes.length).toBeLessThanOrEqual(2); expect(p.wants.length).toBe(2);
      for (const g of p.makes) expect(INDUSTRY[industryOf(w, v, s)].pool).toContain(g);
      for (const g of p.makes) expect(p.wants).not.toContain(g);
      if (powerKind(s) === 'generator' && !p.makes.includes('fuel')) expect(p.wants).toContain('fuel');
      seen.add(p.makes.join() + '|' + p.wants.join());
    }
    expect(seen.size).toBeGreaterThan(20);
  });
  it('is cheap where a good is made, dear where it is wanted, so carrying it pays', () => {
    let pairs = 0;
    for (const a of vs) for (const b of vs) {
      const pa = profileOf(w, a, villageSeed(w, a)), pb = profileOf(w, b, villageSeed(w, b));
      const g = pa.makes.find((x) => pb.wants.includes(x));
      if (!g || a === b) continue;
      const buy = quote(a, villageSeed(w, a), w, g, {}, 5000, false).buy, sell = quote(b, villageSeed(w, b), w, g, {}, 5000, false).sell;
      expect(sell).toBeGreaterThan(buy * 1.6);
      pairs++;
    }
    expect(pairs).toBeGreaterThan(50);
    for (const g of GOODS) expect(GOOD_INFO[g].base).toBeGreaterThan(0);
  });
  it('moves with trade: buying dearens, selling cheapens, and it settles back with time', () => {
    const v = vs[3], s = villageSeed(w, v), g = profileOf(w, v, s).wants[0], st: MarketState = {};
    const before = quote(v, s, w, g, st, 1000).sell;
    for (let i = 0; i < 10; i++) trade(st, v.id, g, 1, 1000);
    const flooded = quote(v, s, w, g, st, 1000).sell;
    expect(flooded).toBeLessThan(before);
    expect(shiftNow(st, v.id, g, 1000 + MARKET.half)).toBeCloseTo(5, 5);
    expect(Math.abs(quote(v, s, w, g, st, 1000 + MARKET.half * 8).sell - quote(v, s, w, g, {}, 1000 + MARKET.half * 8).sell)).toBeLessThanOrEqual(1);
    const m = profileOf(w, v, s).makes[0], stock = quote(v, s, w, m, {}, 1000).stock;
    for (let i = 0; i < stock; i++) trade(st, v.id, m, -1, 1000);
    const q = quote(v, s, w, m, st, 1000);
    expect(q.stock).toBe(0);
    expect(q.buy).toBeGreaterThan(quote(v, s, w, m, {}, 1000).buy);
    expect(JSON.parse(JSON.stringify(st))).toEqual(st); // plain data: a server can hold and share it
  });
});
