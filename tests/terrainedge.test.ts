import { describe, expect, it } from 'vitest';
import { Terrain } from '../src/gen/terrain';
import { findPoi, GRIDHOLM_ID } from '../src/gen/regions';

describe('(0.245.1) the ground meets a place\'s floor at its edge', () => {
  it('a field levelled near a village does not pull the ground away from the village floor', () => {
    const W = -123456789, t = new Terrain(W), v = findPoi(W, GRIDHOLM_ID)!, y = t.padY(v);
    // a field 14 m outside the village's north edge, levelled 4 m lower than the village floor
    t.setClaims([{ x: v.x, z: v.rect.z0 - 14, y: y - 4, flat: 9, blend: 14 }]);
    for (let x = v.rect.x0; x <= v.rect.x1; x += 2) {
      expect(t.exact(x, v.rect.z0)).toBeCloseTo(y, 5); // the hole's edge: the floor's height
      expect(Math.abs(t.exact(x, v.rect.z0 - 2) - y)).toBeLessThan(2); // easing back to the field below; the deep floor slab covers the rest
    }
  });
  it('bumps the revision when the levelled ground changes', () => {
    const t = new Terrain(5), r = t.rev;
    t.setClaims([]); expect(t.rev).toBe(r + 1);
    t.setSettlementPads([]); expect(t.rev).toBe(r + 2);
  });
});
