import { describe, it, expect } from 'vitest';
import { offersAt, payFor, postingOf, CONTRACT } from '../src/gen/contracts';
import { profileOf } from '../src/gen/market';
import { allVillages, villageSeed, worldDist } from '../src/gen/regions';
import { hash } from '../src/core/rng';

const w = hash(10, 10);
describe('delivery contracts', () => {
  const vs = allVillages(w).slice(0, 40);
  it('are posted per village and posting, the same for everyone, and change with the next posting', () => {
    let supply = 0, haul = 0;
    for (const v of vs) {
      const s = villageSeed(w, v), a = offersAt(w, v, s, 3000), b = offersAt(w, v, s, 3000 + 60);
      expect(a).toEqual(b);
      expect(postingOf(3000)).toBe(postingOf(3060));
      for (const o of a) {
        expect(o.n).toBeGreaterThan(0); expect(o.pay).toBeGreaterThan(0); expect(o.due).toBeGreaterThan(3000);
        if (o.kind === 'supply') { supply++; expect(o.to).toBe(v.id); expect(profileOf(w, v, s).wants).toContain(o.good); }
        else {
          haul++;
          expect(profileOf(w, v, s).makes).toContain(o.good);
          const d = worldDist(v.x, v.z, o.tx, o.tz);
          expect(d).toBeGreaterThan(CONTRACT.near); expect(d).toBeLessThan(CONTRACT.far);
          expect(o.deposit).toBeGreaterThan(0);
        }
      }
    }
    expect(supply).toBeGreaterThan(5); expect(haul).toBeGreaterThan(5);
    const v = vs[0], s = villageSeed(w, v);
    expect(offersAt(w, v, s, 3000 + CONTRACT.period)[0]?.id).not.toBe(offersAt(w, v, s, 3000)[0]?.id);
  });
  it('pay per crate, and a haul returns its deposit with the last crates', () => {
    const o = vs.flatMap((v) => offersAt(w, v, villageSeed(w, v), 3000)).find((x) => x.kind === 'haul')!;
    expect(payFor(o, 1)).toBe(o.pay);
    expect(payFor({ ...o, done: o.n - 2 }, 2)).toBe(2 * o.pay + o.deposit);
  });
});
