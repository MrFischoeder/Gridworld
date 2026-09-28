import { describe, it, expect } from 'vitest';
import { Terrain } from '../src/gen/terrain';
import { techSites, TECHS, TIER_BAND, TECH_BY_ID, siteIn, carrierChest } from '../src/gen/tech';
import { worldDist, findPoi } from '../src/gen/regions';

describe('technology carriers', () => {
  it('lie in fixed places, one per place, further out for later tiers', () => {
    for (const w of [12345, 777, 1, 4242]) {
      const t = new Terrain(w), a = techSites(t), b = techSites(new Terrain(w));
      expect(a).toEqual(b); // the same seed places the same carriers
      expect(a.length).toBeGreaterThanOrEqual(TECHS.length - 1);
      expect(new Set(a.map((s) => s.place)).size).toBe(a.length); // no place holds two
      expect(new Set(a.map((s) => s.tech)).size).toBe(a.length);
      for (const s of a) {
        const [d0, d1] = TIER_BAND[TECH_BY_ID[s.tech].tier], d = worldDist(s.x, s.z, 0, 0);
        expect(d).toBeGreaterThanOrEqual(d0 * 0.85); expect(d).toBeLessThanOrEqual(d1 * 1.15);
        if (s.kind !== 'cave') expect(findPoi(w, s.place)?.type).toBe(s.kind);
        expect(siteIn(t, s.place)).toEqual(s);
      }
      // every early technology is within reach of the start
      expect(a.filter((s) => TECH_BY_ID[s.tech].tier === 1).length).toBe(TECHS.filter((x) => x.tier === 1).length);
    }
  });
  it('picks the same chest every time', () => {
    expect(carrierChest(5, 99, 4)).toBe(carrierChest(5, 99, 4));
    expect(carrierChest(5, 99, 0)).toBe(-1);
  });
});
